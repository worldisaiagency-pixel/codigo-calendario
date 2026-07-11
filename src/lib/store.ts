import { create } from "zustand";
import type { Appointment, Dog, Owner } from "./types";
import type { Business, BusinessProfile, PendingReserva, ScheduleOverride, SheetWriteResult } from "./data";
import {
  saveProfileToSheet,
  fetchReservas,
  createAppointmentInSheet,
  updateAppointmentInSheet,
  deleteAppointmentFromSheet,
} from "./data";
import { toDateKey } from "./time";
import { createLocalTable } from "./realtime/local-table";
import type { RealtimeChangePayload, RealtimeTable } from "./realtime/types";

// How often each open app polls the shared "Reservas" sheet for bookings
// made elsewhere (the public website, or this same business on another
// device) — gviz's public CSV export itself lags up to ~1 min behind writes,
// so polling faster than that wouldn't surface anything sooner.
const RESERVAS_POLL_MS = 45_000;

interface NewAppointmentInput {
  ownerName: string;
  dogName: string;
  breed?: string;
  phone?: string;
  service: string;
  startMin: number;
  durationMin: number;
  date: string;
  existingDogId?: string;
  existingOwnerId?: string;
}

interface AppState {
  business: Business | null;
  appointments: Appointment[];
  dogs: Dog[];
  owners: Owner[];
  scheduleOverrides: ScheduleOverride[];
  selectedDate: Date;
  realtimeReady: boolean;
  /** Creates (or re-creates) this business's local tables, wires up
   * cross-tab sync, and hydrates the store from them. Returns an unsubscribe
   * for the realtime listeners. */
  loadBusiness: (business: Business) => () => void;
  setSelectedDate: (d: Date) => void;
  /** Inserts locally right away for a snappy UI, then awaits the Sheet
   * write — which is the actual single source of truth, checked and
   * written atomically on the Apps Script side (see handleCreateAppointment
   * in scripts/sheet-write-apps-script.js). If that write is rejected
   * (most importantly "slot_taken" — someone else, app or web, just booked
   * the same range), the local insert is rolled back so the calendar never
   * shows a confirmed appointment the Sheet doesn't actually have. */
  addAppointment: (
    input: NewAppointmentInput
  ) => Promise<{ ok: true; appointment: Appointment } | { ok: false; error: string }>;
  removeAppointment: (id: string) => void;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  /** Idempotently imports one row pulled from the shared "Reservas" sheet
   * (a booking made on the website, or by this business on another device)
   * into the local tables — a no-op if that id is already present. */
  mergeRemoteAppointment: (row: PendingReserva) => void;
  addScheduleOverride: (override: Omit<ScheduleOverride, "id">) => ScheduleOverride;
  removeScheduleOverride: (id: string) => void;
  /** Patches services/hours/vacations, updates the UI immediately, and
   * writes the change back to the Sheet (shared across every device for
   * this negocio+usuario). Returns whether the Sheet write succeeded — the
   * local/UI state stays updated either way, so the caller can offer a
   * retry ("no se pudo guardar en la hoja") without losing the edit. */
  updateProfile: (patch: Partial<BusinessProfile>) => Promise<boolean>;
}

let seq = 1000;

// Tables are created per-business (see loadBusiness) so different tenants
// never share localStorage/BroadcastChannel state under one deployment.
let appointmentsTable: RealtimeTable<Appointment> | null = null;
let dogsTable: RealtimeTable<Dog> | null = null;
let ownersTable: RealtimeTable<Owner> | null = null;
let scheduleOverridesTable: RealtimeTable<ScheduleOverride> | null = null;
let reservasPollId: ReturnType<typeof setInterval> | null = null;

function reduceList<T extends { id: string }>(
  rows: T[],
  payload: RealtimeChangePayload<T>
): T[] {
  if (payload.eventType === "INSERT" && payload.new) {
    return rows.some((r) => r.id === payload.new!.id) ? rows : [...rows, payload.new];
  }
  if (payload.eventType === "UPDATE" && payload.new) {
    return rows.map((r) => (r.id === payload.new!.id ? payload.new! : r));
  }
  if (payload.eventType === "DELETE" && payload.old) {
    return rows.filter((r) => r.id !== payload.old!.id);
  }
  return rows;
}

export const useAppStore = create<AppState>((set, get) => ({
  business: null,
  appointments: [],
  dogs: [],
  owners: [],
  scheduleOverrides: [],
  selectedDate: new Date(),
  realtimeReady: false,

  loadBusiness: (business) => {
    appointmentsTable = createLocalTable<Appointment>(`appointments:${business.id}`, []);
    dogsTable = createLocalTable<Dog>(`dogs:${business.id}`, []);
    ownersTable = createLocalTable<Owner>(`owners:${business.id}`, []);
    scheduleOverridesTable = createLocalTable<ScheduleOverride>(
      `scheduleOverrides:${business.id}`,
      []
    );

    set({
      business,
      appointments: appointmentsTable.list(),
      dogs: dogsTable.list(),
      owners: ownersTable.list(),
      scheduleOverrides: scheduleOverridesTable.list(),
      realtimeReady: true,
    });

    const unsubAppt = appointmentsTable.subscribe((payload) =>
      set((s) => ({ appointments: reduceList(s.appointments, payload) }))
    );
    const unsubDogs = dogsTable.subscribe((payload) =>
      set((s) => ({ dogs: reduceList(s.dogs, payload) }))
    );
    const unsubOwners = ownersTable.subscribe((payload) =>
      set((s) => ({ owners: reduceList(s.owners, payload) }))
    );
    const unsubOverrides = scheduleOverridesTable.subscribe((payload) =>
      set((s) => ({ scheduleOverrides: reduceList(s.scheduleOverrides, payload) }))
    );

    // Pull in anything booked elsewhere (the public website, or this same
    // business on another device) — once on load, then on a timer for as
    // long as this business stays logged in here.
    const pullReservas = () => {
      fetchReservas(business.name, business.username).then((rows) => {
        for (const row of rows) get().mergeRemoteAppointment(row);
      });
    };
    pullReservas();
    reservasPollId = setInterval(pullReservas, RESERVAS_POLL_MS);

    return () => {
      unsubAppt();
      unsubDogs();
      unsubOwners();
      unsubOverrides();
      if (reservasPollId) clearInterval(reservasPollId);
    };
  },

  setSelectedDate: (d) => set({ selectedDate: d }),

  addAppointment: async (input) => {
    if (!ownersTable || !dogsTable || !appointmentsTable) {
      throw new Error("addAppointment called before a business was loaded");
    }
    let ownerId = input.existingOwnerId;
    let dogId = input.existingDogId;
    let insertedOwnerId: string | null = null;
    let insertedDogId: string | null = null;

    if (!ownerId) {
      ownerId = `o-new-${seq++}`;
      insertedOwnerId = ownerId;
      ownersTable.insert({ id: ownerId, name: input.ownerName, phone: input.phone ?? "" });
    }
    if (!dogId) {
      dogId = `d-new-${seq++}`;
      insertedDogId = dogId;
      dogsTable.insert({
        id: dogId,
        name: input.dogName,
        breed: input.breed || "Sin especificar",
        ownerId,
        avgDurationMin: input.durationMin,
      });
    }

    // A real (not per-device-counter) id: this appointment's id is also the
    // key it's written to the shared Reservas sheet under, so it must not
    // collide with one generated on a different device.
    const newAppt: Appointment = {
      id: crypto.randomUUID(),
      dogId,
      ownerId,
      date: input.date,
      startMin: input.startMin,
      durationMin: input.durationMin,
      service: input.service,
      status: "confirmed",
    };
    appointmentsTable.insert(newAppt);

    const { business } = get();
    if (!business) {
      return { ok: true, appointment: newAppt };
    }

    let result: SheetWriteResult;
    try {
      result = await createAppointmentInSheet({
        id: newAppt.id,
        negocio: business.name,
        usuario: business.username,
        date: newAppt.date,
        startMin: newAppt.startMin,
        durationMin: newAppt.durationMin,
        service: newAppt.service,
        ownerName: input.ownerName,
        phone: input.phone ?? "",
        dogName: input.dogName,
        breed: input.breed ?? "",
        status: newAppt.status,
        origin: "app",
      });
    } catch {
      result = { ok: false, error: "network_error" };
    }

    if (!result.ok) {
      // The Sheet is the single source of truth — if it rejected the
      // write (most importantly a slot someone else just took), this
      // device's local copy must not disagree with it.
      appointmentsTable.remove(newAppt.id);
      if (insertedDogId) dogsTable.remove(insertedDogId);
      if (insertedOwnerId) ownersTable.remove(insertedOwnerId);
      return { ok: false, error: result.error ?? "write_failed" };
    }

    return { ok: true, appointment: newAppt };
  },

  removeAppointment: (id) => {
    appointmentsTable?.remove(id);
    deleteAppointmentFromSheet({ id });
  },

  updateAppointment: (id, patch) => {
    appointmentsTable?.update(id, patch);
    updateAppointmentInSheet({
      id,
      date: patch.date,
      startMin: patch.startMin,
      durationMin: patch.durationMin,
      service: patch.service,
      status: patch.status,
    });
  },

  mergeRemoteAppointment: (row) => {
    if (!appointmentsTable || !dogsTable || !ownersTable) return;
    const { appointments, dogs, owners } = get();
    if (appointments.some((a) => a.id === row.id)) return;

    let owner = row.phone ? owners.find((o) => o.phone === row.phone) : undefined;
    if (!owner) {
      owner = { id: crypto.randomUUID(), name: row.ownerName, phone: row.phone };
      ownersTable.insert(owner);
    }

    let dog = dogs.find(
      (d) => d.ownerId === owner!.id && d.name.toLowerCase() === row.dogName.toLowerCase()
    );
    if (!dog) {
      dog = {
        id: crypto.randomUUID(),
        name: row.dogName,
        breed: row.breed || "Sin especificar",
        ownerId: owner.id,
        avgDurationMin: row.durationMin,
      };
      dogsTable.insert(dog);
    }

    appointmentsTable.insert({
      id: row.id,
      dogId: dog.id,
      ownerId: owner.id,
      date: row.date,
      startMin: row.startMin,
      durationMin: row.durationMin,
      service: row.service,
      status: row.status,
    });
  },

  addScheduleOverride: (override) => {
    if (!scheduleOverridesTable) {
      throw new Error("addScheduleOverride called before a business was loaded");
    }
    const row: ScheduleOverride = { id: `so-${seq++}`, ...override };
    scheduleOverridesTable.insert(row);
    return row;
  },

  removeScheduleOverride: (id) => scheduleOverridesTable?.remove(id),

  updateProfile: async (patch) => {
    const { business } = get();
    if (!business) return false;
    const next: Business = { ...business, ...patch };
    set({ business: next });
    return saveProfileToSheet({
      negocio: next.name,
      usuario: next.username,
      profile: next,
    });
  },
}));

export function selectedDateKey(state: Pick<AppState, "selectedDate">): string {
  return toDateKey(state.selectedDate);
}
