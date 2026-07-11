import { WEEKDAYS } from "./types";
import type { Business, DaySchedule, Weekday } from "./types";
import { toDateKey } from "../time";

export function weekdayFromDate(d: Date): Weekday {
  // Date#getDay(): 0=Sunday..6=Saturday. WEEKDAYS starts at lunes (Monday).
  const index = (d.getDay() + 6) % 7;
  return WEEKDAYS[index];
}

/** The business's open/close window for a given date, or null if closed that
 * weekday or the date falls inside a vacation range. */
export function scheduleForDate(business: Business, date: Date): DaySchedule | null {
  const dateKey = toDateKey(date);
  const onVacation = business.vacations.some(
    (v) => dateKey >= v.start && dateKey <= v.end
  );
  if (onVacation) return null;
  return business.hours[weekdayFromDate(date)];
}
