import { proxiedDataProvider } from "./proxied-reads";
import type { DataProvider } from "./provider";

// Client-side code reads through this app's own Netlify Functions
// (list-businesses.ts / list-reservas.ts) rather than fetching Google's
// CSV export directly — keeps SHEET_ID/SHEET_GID out of the browser
// bundle. sheets-provider.ts / reservas-sync.ts (the direct-to-Google
// implementation) are still used, just only from server-side code now:
// these two Netlify Functions, plus availability.ts and
// create-appointment.ts which already read them server-side.
export const dataProvider: DataProvider = proxiedDataProvider;

export { scheduleForDate, weekdayFromDate } from "./schedule";
export { resolveDay } from "./schedule-overrides";
export {
  saveProfileToSheet,
  updateBusinessIdentity,
  createBusinessInSheet,
  deleteBusinessFromSheet,
  createAppointmentInSheet,
  updateAppointmentInSheet,
  deleteAppointmentFromSheet,
  createOverrideInSheet,
  deleteOverrideFromSheet,
} from "./sheets-writer";
export {
  fetchReservasProxied as fetchReservas,
  fetchOverridesProxied as fetchOverrides,
} from "./proxied-reads";
export type { PendingReserva } from "./reservas-sync";
export type { SheetWriteResult } from "./sheets-writer";
export { emptyProfile, emptyHours, isProfileConfigured, WEEKDAYS } from "./types";

export type {
  Business,
  BusinessProfile,
  BusinessService,
  DaySchedule,
  ScheduleOverride,
  ScheduleOverrideKind,
  VacationRange,
  Weekday,
} from "./types";
export type { ManualBlock, ResolvedDay } from "./schedule-overrides";
export type { DataProvider } from "./provider";
