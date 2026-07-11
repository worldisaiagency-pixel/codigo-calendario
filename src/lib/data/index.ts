import { sheetsProvider } from "./sheets-provider";
import type { DataProvider } from "./provider";

// The one line to change when migrating off Google Sheets to a real backend.
export const dataProvider: DataProvider = sheetsProvider;

export { scheduleForDate, weekdayFromDate } from "./schedule";
export { resolveDay } from "./schedule-overrides";
export { loadProfile, saveProfile } from "./profile-store";
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
