import { create } from "zustand";
import type { Appointment, Dog, Owner } from "./types";
import {
  appointments as initialAppointments,
  dogs as initialDogs,
  owners as initialOwners,
} from "./mock-data";
import { toDateKey } from "./time";
import { createLocalTable } from "./realtime/local-table";
import type { RealtimeChangePayload } from "./realtime/types";

const appointmentsTable = createLocalTable<Appointment>("appointments", initialAppointments);
const dogsTable = createLocalTable<Dog>("dogs", initialDogs);
const ownersTable = createLocalTable<Owner>("owners", initialOwners);

interface NewAppointmentInput {
  ownerName: string;
  dogName: string;
  breed?: string;
  service: string;
  startMin: number;
  durationMin: number;
  date: string;
  existingDogId?: string;
  existingOwnerId?: string;
}

interface AppState {
  appointments: Appointment[];
  dogs: Dog[];
  owners: Owner[];
  selectedDate: Date;
  realtimeReady: boolean;
  initRealtime: () => () => void;
  setSelectedDate: (d: Date) => void;
  addAppointment: (input: NewAppointmentInput) => Appointment;
  removeAppointment: (id: string) => void;
}

let seq = 1000;

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
  appointments: initialAppointments,
  dogs: initialDogs,
  owners: initialOwners,
  selectedDate: new Date(),
  realtimeReady: false,

  // Local state mirrors each table; every mutation — from this tab or a
  // BroadcastChannel message sent by another one — flows through here.
  // Swapping `createLocalTable` for real Supabase Realtime channels later
  // requires no changes below this line.
  initRealtime: () => {
    set({
      appointments: appointmentsTable.list(),
      dogs: dogsTable.list(),
      owners: ownersTable.list(),
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
    return () => {
      unsubAppt();
      unsubDogs();
      unsubOwners();
    };
  },

  setSelectedDate: (d) => set({ selectedDate: d }),

  addAppointment: (input) => {
    let ownerId = input.existingOwnerId;
    let dogId = input.existingDogId;

    if (!ownerId) {
      ownerId = `o-new-${seq++}`;
      ownersTable.insert({ id: ownerId, name: input.ownerName, phone: "" });
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

  removeAppointment: (id) => appointmentsTable.remove(id),
}));

export function selectedDateKey(state: Pick<AppState, "selectedDate">): string {
  return toDateKey(state.selectedDate);
}
