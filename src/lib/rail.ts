import type { Appointment, Dog, Owner, RailBlock } from "./types";
import type { DaySchedule, ManualBlock } from "./data";
import { MIN_BOOKABLE_GAP, earliestBookableStart, nowMinutes } from "./time";

type Occupied =
  | { kind: "appt"; startMin: number; durationMin: number; appointment: Appointment }
  | { kind: "block"; startMin: number; durationMin: number; note?: string };

export function buildRail(params: {
  dateKey: string;
  isToday: boolean;
  appointments: Appointment[];
  dogById: Map<string, Dog>;
  ownerById: Map<string, Owner>;
  /** The business's open/close window for this date, or null if closed
   * (weekly day off, a vacation range, or a schedule override) — no
   * bookable slots either way. */
  schedule: DaySchedule | null;
  /** Spontaneous per-date blocks (schedule overrides) — occupy time exactly
   * like an appointment for the purposes of gap math, rendered separately. */
  manualBlocks?: ManualBlock[];
}): RailBlock[] {
  const { dateKey, isToday, appointments, dogById, ownerById, schedule, manualBlocks = [] } = params;
  if (!schedule) return [];

  const dayAppts = appointments
    .filter((a) => a.date === dateKey)
    .sort((a, b) => a.startMin - b.startMin);

  const now = isToday ? nowMinutes() : -1;
  const nextAppt = isToday
    ? dayAppts.find((a) => a.startMin + a.durationMin > now)
    : undefined;

  const occupied: Occupied[] = [
    ...dayAppts.map((a) => ({
      kind: "appt" as const,
      startMin: a.startMin,
      durationMin: a.durationMin,
      appointment: a,
    })),
    ...manualBlocks.map((b) => ({
      kind: "block" as const,
      startMin: b.startMin,
      durationMin: b.durationMin,
      note: b.note,
    })),
  ].sort((a, b) => a.startMin - b.startMin);

  const blocks: RailBlock[] = [];

  // The rail always spans the full day (00:00-24:00) so a short shift (e.g.
  // Saturday 10:00-14:00) still reads in context — only the schedule's own
  // open/close window gets real free/busy/blocked slots; the rest of the
  // day is a plain non-interactive "closed" filler.
  if (schedule.open > 0) {
    blocks.push({ kind: "closed", startMin: 0, durationMin: schedule.open });
  }

  // Same rule the availability search already applies (earliestBookableStart):
  // today's free gaps never start before "now" rounded up — no separate
  // validation needed downstream, since every tappable slot already derives
  // from this.
  let cursor = earliestBookableStart(schedule.open, isToday);

  for (const item of occupied) {
    const gap = item.startMin - cursor;
    if (gap >= MIN_BOOKABLE_GAP) {
      blocks.push({ kind: "free", startMin: cursor, durationMin: gap });
    }
    if (item.kind === "appt") {
      const dog = dogById.get(item.appointment.dogId);
      const owner = ownerById.get(item.appointment.ownerId);
      if (dog && owner) {
        blocks.push({
          kind: "busy",
          appointment: item.appointment,
          dog,
          owner,
          startMin: item.startMin,
          durationMin: item.durationMin,
          isNext: nextAppt?.id === item.appointment.id,
        });
      }
    } else {
      blocks.push({
        kind: "blocked",
        startMin: item.startMin,
        durationMin: item.durationMin,
        note: item.note,
      });
    }
    cursor = Math.max(cursor, item.startMin + item.durationMin);
  }

  const tailGap = schedule.close - cursor;
  // A trailing sliver too short to book (< MIN_BOOKABLE_GAP) folds into the
  // closed filler below instead of vanishing, so the timeline stays
  // continuous right up to midnight.
  const closedStart = tailGap >= MIN_BOOKABLE_GAP ? schedule.close : cursor;
  if (tailGap >= MIN_BOOKABLE_GAP) {
    blocks.push({ kind: "free", startMin: cursor, durationMin: tailGap });
  }

  if (closedStart < 1440) {
    blocks.push({ kind: "closed", startMin: closedStart, durationMin: 1440 - closedStart });
  }

  return blocks;
}

export function findDog(dogs: Dog[], query: string): Dog[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return dogs.filter((d) => d.name.toLowerCase().includes(q));
}
