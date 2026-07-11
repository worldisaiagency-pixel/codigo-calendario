import type { Appointment, Dog, Owner, RailBlock } from "./types";
import type { DaySchedule, ManualBlock } from "./data";
import { MIN_BOOKABLE_GAP, nowMinutes } from "./time";

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
  let cursor = schedule.open;

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
  if (tailGap >= MIN_BOOKABLE_GAP) {
    blocks.push({ kind: "free", startMin: cursor, durationMin: tailGap });
  }

  return blocks;
}

export function findDog(dogs: Dog[], query: string): Dog[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return dogs.filter((d) => d.name.toLowerCase().includes(q));
}
