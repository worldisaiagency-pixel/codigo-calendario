import type { Appointment, Dog, Owner } from "./types";
import type { BusinessProfile, ScheduleOverride } from "./data";
import { resolveDay } from "./data";
import { buildRail } from "./rail";
import { addDays, isSameDay, nowMinutes, toDateKey } from "./time";

export interface AvailabilitySlot {
  date: string;
  blockStartMin: number;
  blockDurationMin: number;
  slotStartMin: number;
}

// Walks forward day by day from `rangeStart`, taking the earliest bookable
// moment in each free gap that's long enough for `durationMin`. One result
// per gap (not every 30-min increment inside it) keeps the ranked list
// spread across distinct times/days instead of clustering in one gap.
export function findAvailableSlots(params: {
  profile: BusinessProfile;
  scheduleOverrides?: ScheduleOverride[];
  appointments: Appointment[];
  dogById: Map<string, Dog>;
  ownerById: Map<string, Owner>;
  durationMin: number;
  rangeStart: Date;
  rangeEnd: Date;
  limit?: number;
}): AvailabilitySlot[] {
  const {
    profile,
    scheduleOverrides = [],
    appointments,
    dogById,
    ownerById,
    durationMin,
    rangeStart,
    rangeEnd,
    limit = 8,
  } = params;
  const results: AvailabilitySlot[] = [];
  const today = new Date();

  let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());

  while (cursor <= end && results.length < limit) {
    const { schedule, blocks: manualBlocks } = resolveDay(profile, scheduleOverrides, cursor);
    if (!schedule) {
      cursor = addDays(cursor, 1);
      continue;
    }

    const dateKey = toDateKey(cursor);
    const isToday = isSameDay(cursor, today);
    const blocks = buildRail({
      dateKey,
      isToday,
      appointments,
      dogById,
      ownerById,
      schedule,
      manualBlocks,
    });
    const earliestStart = isToday
      ? Math.max(schedule.open, Math.ceil(nowMinutes() / 30) * 30)
      : schedule.open;

    for (const block of blocks) {
      if (block.kind !== "free") continue;
      const effectiveStart = Math.max(block.startMin, earliestStart);
      const effectiveDuration = block.startMin + block.durationMin - effectiveStart;
      if (effectiveDuration < durationMin) continue;
      results.push({
        date: dateKey,
        blockStartMin: block.startMin,
        blockDurationMin: block.durationMin,
        slotStartMin: effectiveStart,
      });
      if (results.length >= limit) break;
    }

    cursor = addDays(cursor, 1);
  }

  return results;
}
