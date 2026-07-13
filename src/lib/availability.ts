import type { Appointment, Dog, Owner } from "./types";
import type { Business, ScheduleOverride } from "./data";
import { resolveDay } from "./data";
import { buildRail } from "./rail";
import { addDays, earliestBookableStart, isSameDay, toDateKey } from "./time";

export interface AvailabilitySlot {
  date: string;
  blockStartMin: number;
  blockDurationMin: number;
  slotStartMin: number;
}

const SLOT_STEP_MIN = 30;

// Upper bound on slots a range can possibly produce, used by callers that
// need every slot in the range (allSlotsPerGap: true) so `limit` scales with
// the requested date range instead of being a fixed count that silently
// truncates the range once enough slots pile up in the first few days.
// A day fully open 24h in SLOT_STEP_MIN increments is the worst case per day.
export function maxSlotsForRange(days: number): number {
  return Math.max(1, days) * Math.ceil((24 * 60) / SLOT_STEP_MIN);
}

// Walks forward day by day from `rangeStart`. Default mode takes only the
// earliest bookable moment in each free gap — one result per gap (not every
// 30-min increment inside it) keeps the internal "ver disponibilidad"
// picker's ranked list spread across distinct times/days instead of
// clustering in one gap, which is deliberate there.
//
// Public-facing callers (the /reservar page, availability.ts,
// create-appointment.ts's pre-check) pass `allSlotsPerGap: true` instead —
// a customer booking from a website needs to actually choose a time of day,
// not just be handed whatever the earliest opening happens to be.
export function findAvailableSlots(params: {
  business: Business;
  scheduleOverrides?: ScheduleOverride[];
  appointments: Appointment[];
  dogById: Map<string, Dog>;
  ownerById: Map<string, Owner>;
  durationMin: number;
  rangeStart: Date;
  rangeEnd: Date;
  limit?: number;
  allSlotsPerGap?: boolean;
}): AvailabilitySlot[] {
  const {
    business,
    scheduleOverrides = [],
    appointments,
    dogById,
    ownerById,
    durationMin,
    rangeStart,
    rangeEnd,
    limit = 8,
    allSlotsPerGap = false,
  } = params;
  const results: AvailabilitySlot[] = [];
  const today = new Date();

  let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());

  while (cursor <= end && results.length < limit) {
    const { schedule, blocks: manualBlocks } = resolveDay(business, scheduleOverrides, cursor);
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
    const earliestStart = earliestBookableStart(schedule.open, isToday);

    for (const block of blocks) {
      if (block.kind !== "free") continue;
      const effectiveStart = Math.max(block.startMin, earliestStart);
      const effectiveDuration = block.startMin + block.durationMin - effectiveStart;
      if (effectiveDuration < durationMin) continue;

      if (!allSlotsPerGap) {
        results.push({
          date: dateKey,
          blockStartMin: block.startMin,
          blockDurationMin: block.durationMin,
          slotStartMin: effectiveStart,
        });
        if (results.length >= limit) break;
        continue;
      }

      const gapEnd = block.startMin + block.durationMin;
      for (let start = effectiveStart; start + durationMin <= gapEnd; start += SLOT_STEP_MIN) {
        results.push({
          date: dateKey,
          blockStartMin: block.startMin,
          blockDurationMin: block.durationMin,
          slotStartMin: start,
        });
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }

    cursor = addDays(cursor, 1);
  }

  return results;
}
