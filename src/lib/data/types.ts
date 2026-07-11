export type Weekday =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

export interface BusinessService {
  name: string;
  priceLabel: string;
  durationMin: number;
}

export interface DaySchedule {
  open: number; // minutes from 00:00
  close: number;
}

export interface VacationRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export interface Business {
  id: string;
  name: string;
  username: string;
  services: BusinessService[];
  hours: Record<Weekday, DaySchedule | null>;
  vacations: VacationRange[];
}

export type ScheduleOverrideKind = "closed" | "hours" | "block";

/** A spontaneous, per-date change to a business's normal schedule — "closed
 * Tuesday", "opening late Thursday", "blocked 19:00-20:00 today". Lives in
 * localStorage (see store.ts), never in the Sheet: it's transient
 * operational data, not business config. */
export interface ScheduleOverride {
  id: string;
  date: string; // YYYY-MM-DD — one row per affected date
  kind: ScheduleOverrideKind;
  /** kind "hours": the day's new open/close window. */
  open?: number;
  close?: number;
  /** kind "block": an unavailable sub-range inside an otherwise normal day. */
  blockStart?: number;
  blockEnd?: number;
  note?: string;
}

export const WEEKDAYS: Weekday[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];
