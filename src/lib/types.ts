export type Breed = string;

export interface Dog {
  id: string;
  name: string;
  breed: Breed;
  ownerId: string;
  avgDurationMin: number;
  lastService?: string;
  behaviorNote?: string;
  photoColor?: string;
}

export interface Owner {
  id: string;
  name: string;
  phone: string;
}

export type AppointmentStatus = "confirmed" | "done";

export interface Appointment {
  id: string;
  dogId: string;
  ownerId: string;
  date: string; // YYYY-MM-DD
  startMin: number; // minutes from 00:00
  durationMin: number;
  service: string;
  status: AppointmentStatus;
  notes?: string;
}

export interface HistoryEntry {
  id: string;
  dogId: string;
  date: string;
  service: string;
  durationMin: number;
}

export type RailBlock =
  | { kind: "busy"; appointment: Appointment; dog: Dog; owner: Owner; startMin: number; durationMin: number; isNext: boolean }
  | { kind: "free"; startMin: number; durationMin: number }
  | { kind: "blocked"; startMin: number; durationMin: number; note?: string }
  | { kind: "closed"; startMin: number; durationMin: number };

export type ViewMode = "day" | "week" | "month";
