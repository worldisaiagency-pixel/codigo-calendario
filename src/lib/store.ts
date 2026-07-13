import { create } from "zustand";
import type { Appointment, Dog, Owner } from "./types";
import type { Business, BusinessProfile, PendingReserva, ScheduleOverride, SheetWriteResult } from "./data";
import {
  saveProfileToSheet,
  fetchReservas,
  fetchOverrides,
  createAppointmentInSheet,
  updateAppointmentInSheet,
  deleteAppointmentFromSheet,
  createOverrideInSheet,
  deleteOverrideFromSheet,
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
  /** Same await-then-rollback shape as addAppointment/updateAppointment:
   * removes locally right away, then awaits the Sheet delete. If that write
   * fails, the appointment is re-inserted locally instead of leaving the
   * calendar permanently missing something the Sheet still has. */
  removeAppointment: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Same await-then-rollback shape as addAppointment: applies the patch
   * locally right away, then awaits the Sheet write (which re-checks for
   * overlaps against every OTHER appointment when date/time actually
   * change — see handleUpdateAppointment in scripts/sheet-write-apps-
   * script.js). On rejection, the local change is reverted to whatever it
   * was before, instead of leaving the calendar showing a move the Sheet
   * refused. */
  updateAppointment: (
    id: string,
    patch: Partial<Appointment>
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Idempotently imports one row pulled from the shared "Reservas" sheet
   * (a booking made on the website, or by this business on another device)
   * into the local tables — a no-op if that id is already present. */
  mergeRemoteAppointment: (row: PendingReserva) => void;
  /** Archives a client's ficha (dog+owner) out of the search buscador — see
   * src/lib/clients.ts. Never touches the dog/owner rows themselves or any
   * appointment, so calendar history keeps rendering normally; the ficha
   * reappears on its own the next time this dog gets a new appointment. */
  archiveClient: (dogId: string) => void;
  /** Same idempotent-import shape as mergeRemoteAppointment, for the shared
   * "Overrides" sheet — a closure/hour change made on another device. */
  mergeRemoteOverride: (override: ScheduleOverride) => void;
  /** Writes through to the shared "Overrides" sheet (fire-and-forget — a
   * closure syncing a little late is a much lower-stakes gap than an
   * appointment double-booking, so this doesn't need the same
   * await-then-rollback treatment as addAppointment). */
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
    // long as this business stays logged in here. Same cadence for
    // schedule overrides, so a closure set from another device (or one a
    // public site would need to respect) shows up here too.
    const pullReservas = () => {
      fetchReservas(business.name, business.username).then((rows) => {
        for (const row of rows) get().mergeRemoteAppointment(row);
      });
      fetchOverrides(business.name, business.username).then((rows) => {
        for (const row of rows) get().mergeRemoteOverride(row);
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

    // Booking (or re-booking) for an existing dog brings its ficha back to
    // the search buscador if it had been archived — restored below if the
    // Sheet ends up rejecting this appointment.
    const wasArchived = dogsTable.list().find((d) => d.id === dogId)?.archived === true;
    if (wasArchived) dogsTable.update(dogId, { archived: false });

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
      else if (wasArchived) dogsTable.update(dogId, { archived: true });
      return { ok: false, error: result.error ?? "write_failed" };
    }

    return { ok: true, appointment: newAppt };
  },

  removeAppointment: async (id) => {
    const before = get().appointments.find((a) => a.id === id);
    appointmentsTable?.remove(id);

    let ok: boolean;
    try {
      ok = await deleteAppointmentFromSheet({ id });
    } catch {
      ok = false;
    }

    if (!ok) {
      if (before) appointmentsTable?.insert(before);
      return { ok: false, error: "write_failed" };
    }
    return { ok: true };
  },

  updateAppointment: async (id, patch) => {
    const before = get().appointments.find((a) => a.id === id);
    appointmentsTable?.update(id, patch);

    let result: SheetWriteResult;
    try {
      result = await updateAppointmentInSheet({
        id,
        date: patch.date,
        startMin: patch.startMin,
        durationMin: patch.durationMin,
        service: patch.service,
        status: patch.status,
      });
    } catch {
      result = { ok: false, error: "network_error" };
    }

    if (!result.ok) {
      if (before) appointmentsTable?.update(id, before);
      return { ok: false, error: result.error ?? "write_failed" };
    }
    return { ok: true };
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
    } else if (dog.archived) {
      // A booking made elsewhere (the public website, another device) for a
      // previously archived ficha brings it back to the search buscador too.
      dogsTable.update(dog.id, { archived: false });
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

  archiveClient: (dogId) => {
    dogsTable?.update(dogId, { archived: true });
  },

  mergeRemoteOverride: (override) => {
    if (!scheduleOverridesTable) return;
    if (get().scheduleOverrides.some((o) => o.id === override.id)) return;
    scheduleOverridesTable.insert(override);
  },

  addScheduleOverride: (override) => {
    if (!scheduleOverridesTable) {
      throw new Error("addScheduleOverride called before a business was loaded");
    }
    // A real id (not the old per-page-load `so-${seq}` counter): this is
    // now the shared Sheet row's key too, so it must not collide with one
    // generated on a different device.
    const row: ScheduleOverride = { id: crypto.randomUUID(), ...override };
    scheduleOverridesTable.insert(row);

    const { business } = get();
    if (business) {
      createOverrideInSheet({
        id: row.id,
        negocio: business.name,
        usuario: business.username,
        date: row.date,
        kind: row.kind,
        openMin: row.open,
        closeMin: row.close,
        blockStart: row.blockStart,
        blockEnd: row.blockEnd,
        note: row.note,
      });
    }
    return row;
  },

  removeScheduleOverride: (id) => {
    scheduleOverridesTable?.remove(id);
    deleteOverrideFromSheet({ id });
  },

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
