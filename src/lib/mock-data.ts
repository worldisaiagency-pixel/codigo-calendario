import type { Appointment, Dog, HistoryEntry, Owner } from "./types";
import { addDays, toDateKey } from "./time";

const today = new Date();
const key = (offset: number) => toDateKey(addDays(today, offset));

export const owners: Owner[] = [
  { id: "o1", name: "María Fernández", phone: "655 123 456" },
  { id: "o2", name: "Javier Ortiz", phone: "699 234 567" },
  { id: "o3", name: "Lucía Gómez", phone: "611 345 678" },
  { id: "o4", name: "Sandra Ruiz", phone: "622 456 789" },
  { id: "o5", name: "Pablo Serrano", phone: "633 567 890" },
  { id: "o6", name: "Elena Vidal", phone: "644 678 901" },
  { id: "o7", name: "Marta Iglesias", phone: "666 789 012" },
  { id: "o8", name: "Diego Salas", phone: "677 890 123" },
];

export const dogs: Dog[] = [
  { id: "d1", name: "Luna", breed: "Bichón Maltés", ownerId: "o1", avgDurationMin: 45, lastService: "Baño + corte higiénico" },
  { id: "d2", name: "Rocky", breed: "Pastor Alemán", ownerId: "o2", avgDurationMin: 90, lastService: "Corte completo", behaviorNote: "Se estresa con el secador — usar modo silencioso" },
  { id: "d3", name: "Kiwi", breed: "Caniche", ownerId: "o3", avgDurationMin: 40, lastService: "Baño y secado" },
  { id: "d4", name: "Toby", breed: "Yorkshire", ownerId: "o4", avgDurationMin: 45, lastService: "Corte + uñas" },
  { id: "d5", name: "Nala", breed: "Golden Retriever", ownerId: "o5", avgDurationMin: 75, lastService: "Deslanado + baño" },
  { id: "d6", name: "Simba", breed: "Shih Tzu", ownerId: "o6", avgDurationMin: 50, lastService: "Corte completo", behaviorNote: "Muerde al cortar las patas — sujetar con bozal suave" },
  { id: "d7", name: "Mia", breed: "Cocker Spaniel", ownerId: "o7", avgDurationMin: 60, lastService: "Baño + corte de orejas" },
  { id: "d8", name: "Thor", breed: "Bulldog Francés", ownerId: "o8", avgDurationMin: 35, lastService: "Baño e hidratación" },
];

export const dogById = new Map(dogs.map((d) => [d.id, d]));
export const ownerById = new Map(owners.map((o) => [o.id, o]));

let apptSeq = 1;
function appt(
  partial: Omit<Appointment, "id" | "status"> & Partial<Pick<Appointment, "status">>
): Appointment {
  return { id: `a${apptSeq++}`, status: "confirmed", ...partial };
}

export const appointments: Appointment[] = [
  // Today
  appt({ dogId: "d1", ownerId: "o1", date: key(0), startMin: 9 * 60, durationMin: 45, service: "Baño + corte higiénico" }),
  appt({ dogId: "d2", ownerId: "o2", date: key(0), startMin: 10 * 60 + 30, durationMin: 90, service: "Corte completo" }),
  appt({ dogId: "d3", ownerId: "o3", date: key(0), startMin: 14 * 60, durationMin: 40, service: "Baño y secado" }),
  appt({ dogId: "d6", ownerId: "o6", date: key(0), startMin: 15 * 60 + 30, durationMin: 50, service: "Corte completo" }),
  appt({ dogId: "d8", ownerId: "o8", date: key(0), startMin: 17 * 60, durationMin: 35, service: "Baño e hidratación" }),

  // Tomorrow
  appt({ dogId: "d5", ownerId: "o5", date: key(1), startMin: 9 * 60 + 15, durationMin: 75, service: "Deslanado + baño" }),
  appt({ dogId: "d4", ownerId: "o4", date: key(1), startMin: 11 * 60, durationMin: 45, service: "Corte + uñas" }),
  appt({ dogId: "d7", ownerId: "o7", date: key(1), startMin: 16 * 60, durationMin: 60, service: "Baño + corte de orejas" }),

  // Day after tomorrow
  appt({ dogId: "d1", ownerId: "o1", date: key(2), startMin: 10 * 60, durationMin: 45, service: "Baño + corte higiénico" }),
  appt({ dogId: "d2", ownerId: "o2", date: key(2), startMin: 12 * 60, durationMin: 90, service: "Corte completo" }),

  // Yesterday (history)
  appt({ dogId: "d3", ownerId: "o3", date: key(-1), startMin: 9 * 60, durationMin: 40, service: "Baño y secado", status: "done" }),
  appt({ dogId: "d6", ownerId: "o6", date: key(-1), startMin: 11 * 60, durationMin: 50, service: "Corte completo", status: "done" }),
];

export const history: HistoryEntry[] = [
  { id: "h1", dogId: "d2", date: key(-28), service: "Corte completo", durationMin: 85 },
  { id: "h2", dogId: "d2", date: key(-56), service: "Baño y cepillado", durationMin: 50 },
  { id: "h3", dogId: "d2", date: key(-84), service: "Corte completo", durationMin: 90 },
  { id: "h4", dogId: "d1", date: key(-21), service: "Baño + corte higiénico", durationMin: 45 },
  { id: "h5", dogId: "d1", date: key(-49), service: "Baño + corte higiénico", durationMin: 40 },
  { id: "h6", dogId: "d6", date: key(-30), service: "Corte completo", durationMin: 55 },
  { id: "h7", dogId: "d4", date: key(-18), service: "Corte + uñas", durationMin: 45 },
];

export const services: { name: string; durationMin: number }[] = [
  { name: "Baño y secado", durationMin: 30 },
  { name: "Corte completo", durationMin: 60 },
  { name: "Baño + corte higiénico", durationMin: 45 },
  { name: "Corte + uñas", durationMin: 15 },
  { name: "Deslanado + baño", durationMin: 60 },
  { name: "Baño + corte de orejas", durationMin: 45 },
  { name: "Baño e hidratación", durationMin: 40 },
];

export const serviceOptions = services.map((s) => s.name);

export const serviceDurationMin: Record<string, number> = Object.fromEntries(
  services.map((s) => [s.name, s.durationMin])
);

export function visitsCount(dogId: string): number {
  return history.filter((h) => h.dogId === dogId).length + 1;
}

export function historyForDog(dogId: string): HistoryEntry[] {
  return history
    .filter((h) => h.dogId === dogId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function cadenceLabel(dogId: string): string {
  const entries = historyForDog(dogId);
  if (entries.length < 2) return "—";
  const d0 = new Date(entries[0].date).getTime();
  const d1 = new Date(entries[1].date).getTime();
  const weeks = Math.round((d0 - d1) / (7 * 24 * 60 * 60 * 1000));
  return `${weeks} sem`;
}
