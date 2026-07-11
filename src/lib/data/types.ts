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

/** The editable part of a business's config — services, hours, vacations.
 * Sourced from (and written back to) the Sheet, keyed by NEGOCIO+USUARIO, so
 * it's the same for that business on every device (see sheets-writer.ts). */
export interface BusinessProfile {
  services: BusinessService[];
  hours: Record<Weekday, DaySchedule | null>;
  vacations: VacationRange[];
}

/** A logged-in business: identity from the Sheet plus its profile, also
 * sourced from the Sheet. Editing the profile in-app writes back to the
 * Sheet (see sheets-writer.ts) — never stored per-device. */
export interface Business extends BusinessProfile {
  id: string;
  name: string;
  username: string;
  websiteUrl: string;
}

export function emptyHours(): Record<Weekday, DaySchedule | null> {
  return {
    lunes: null,
    martes: null,
    miercoles: null,
    jueves: null,
    viernes: null,
    sabado: null,
    domingo: null,
  };
}

export function emptyProfile(): BusinessProfile {
  return { services: [], hours: emptyHours(), vacations: [] };
}

export function isProfileConfigured(profile: BusinessProfile): boolean {
  const hasHours = Object.values(profile.hours).some((d) => d !== null);
  return profile.services.length > 0 || hasHours || profile.vacations.length > 0;
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
