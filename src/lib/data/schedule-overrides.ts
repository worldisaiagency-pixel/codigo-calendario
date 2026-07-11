import { scheduleForDate } from "./schedule";
import { toDateKey } from "../time";
import type { BusinessProfile, DaySchedule, ScheduleOverride } from "./types";

export interface ManualBlock {
  startMin: number;
  durationMin: number;
  note?: string;
}

export interface ResolvedDay {
  schedule: DaySchedule | null;
  blocks: ManualBlock[];
}

/** Applies any override for this date on top of the business's normal
 * schedule. "closed"/"hours" replace the day's open/close window; "block"
 * carves out a sub-range without changing it (rendered as a manual block on
 * the rail, occupying time exactly like an appointment does). Multiple
 * overrides on the same date compose in order (later "closed"/"hours" wins,
 * "block" entries accumulate). */
export function resolveDay(
  profile: BusinessProfile,
  overrides: ScheduleOverride[],
  date: Date
): ResolvedDay {
  const dateKey = toDateKey(date);
  const dayOverrides = overrides.filter((o) => o.date === dateKey);

  let schedule = scheduleForDate(profile, date);
  const blocks: ManualBlock[] = [];

  for (const o of dayOverrides) {
    if (o.kind === "closed") {
      schedule = null;
    } else if (o.kind === "hours" && o.open != null && o.close != null) {
      schedule = { open: o.open, close: o.close };
    } else if (o.kind === "block" && o.blockStart != null && o.blockEnd != null) {
      blocks.push({
        startMin: o.blockStart,
        durationMin: o.blockEnd - o.blockStart,
        note: o.note,
      });
    }
  }

  return { schedule, blocks };
}
