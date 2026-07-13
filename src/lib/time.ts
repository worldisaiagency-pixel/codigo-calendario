export const MIN_BOOKABLE_GAP = 20; // don't surface slivers under this as "free"

export function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return h === 1 ? "1 h" : `${h} h`;
  return `${h}h ${m}m`;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inverse of toDateKey — parses "YYYY-MM-DD" as a local-time date, never UTC
 * (avoids the classic off-by-one-day bug in negative UTC offsets). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function addMonths(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
}

/** Monday-start week containing the given date. */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const dow = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - dow);
  return copy;
}

export function weekDays(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function endOfWeek(d: Date): Date {
  return weekDays(d)[6];
}

/** Full 6-week (42-day) grid for the month containing the given date, Monday-start. */
export function monthGridDays(d: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(d));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function formatDayHeading(d: Date): { weekday: string; day: number; month: string } {
  return {
    weekday: WEEKDAYS[d.getDay()],
    day: d.getDate(),
    month: MONTHS[d.getMonth()],
  };
}

export function monthName(d: Date): string {
  return MONTHS[d.getMonth()];
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

export function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/** Derived, not stored: an appointment is "completed" purely from the
 * current moment vs. its own date/startMin/durationMin — no separate status
 * to keep in sync. A past date is always completed; a future date never is;
 * today it depends on whether now is past its end time. */
export function isAppointmentCompleted(
  date: string,
  startMin: number,
  durationMin: number
): boolean {
  const today = toDateKey(new Date());
  if (date < today) return true;
  if (date > today) return false;
  return nowMinutes() > startMin + durationMin;
}

export function relativeTimeUntil(min: number): string {
  const now = nowMinutes();
  const diff = min - now;
  if (diff <= 0) return "ahora";
  if (diff < 60) return `en ${diff} min`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (m === 0) return `en ${h} h`;
  return `en ${h}h ${m}m`;
}
