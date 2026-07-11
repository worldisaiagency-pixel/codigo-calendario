import { create } from "zustand";
import type { Appointment, Dog, Owner } from "./types";
import type { Business, ScheduleOverride } from "./data";
import { toDateKey } from "./time";
import { createLocalTable } from "./realtime/local-table";
import type { RealtimeChangePayload, RealtimeTable } from "./realtime/types";

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
  addAppointment: (input: NewAppointmentInput) => Appointment;
  removeAppointment: (id: string) => void;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  addScheduleOverride: (override: Omit<ScheduleOverride, "id">) => ScheduleOverride;
  removeScheduleOverride: (id: string) => void;
}

let seq = 1000;

// Tables are created per-business (see loadBusiness) so different tenants
// never share localStorage/BroadcastChannel state under one deployment.
let appointmentsTable: RealtimeTable<Appointment> | null = null;
let dogsTable: RealtimeTable<Dog> | null = null;
let ownersTable: RealtimeTable<Owner> | null = null;
let scheduleOverridesTable: RealtimeTable<ScheduleOverride> | null = null;

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

export const useAppStore = create<AppState>((set) => ({
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
    return () => {
      unsubAppt();
      unsubDogs();
      unsubOwners();
      unsubOverrides();
    };
  },

  setSelectedDate: (d) => set({ selectedDate: d }),

  addAppointment: (input) => {
    if (!ownersTable || !dogsTable || !appointmentsTable) {
      throw new Error("addAppointment called before a business was loaded");
    }
    let ownerId = input.existingOwnerId;
    let dogId = input.existingDogId;

    if (!ownerId) {
      ownerId = `o-new-${seq++}`;
      ownersTable.insert({ id: ownerId, name: input.ownerName, phone: input.phone ?? "" });
    }
    if (!dogId) {
      dogId = `d-new-${seq++}`;
      dogsTable.insert({
        id: dogId,
        name: input.dogName,
        breed: input.breed || "Sin especificar",
        ownerId,
        avgDurationMin: input.durationMin,
      });
    }

    const newAppt: Appointment = {
      id: `a-new-${seq++}`,
      dogId,
      ownerId,
      date: input.date,
      startMin: input.startMin,
      durationMin: input.durationMin,
      service: input.service,
      status: "confirmed",
    };
    appointmentsTable.insert(newAppt);
    return newAppt;
  },

  removeAppointment: (id) => appointmentsTable?.remove(id),

  updateAppointment: (id, patch) => appointmentsTable?.update(id, patch),

  addScheduleOverride: (override) => {
    if (!scheduleOverridesTable) {
      throw new Error("addScheduleOverride called before a business was loaded");
    }
    const row: ScheduleOverride = { id: `so-${seq++}`, ...override };
    scheduleOverridesTable.insert(row);
    return row;
  },

  removeScheduleOverride: (id) => scheduleOverridesTable?.remove(id),
}));

export function selectedDateKey(state: Pick<AppState, "selectedDate">): string {
  return toDateKey(state.selectedDate);
}
