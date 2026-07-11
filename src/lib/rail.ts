import type { Appointment, Dog, Owner, RailBlock } from "./types";
import { DAY_END_MIN, DAY_START_MIN, MIN_BOOKABLE_GAP, nowMinutes } from "./time";

export function buildRail(params: {
  dateKey: string;
  isToday: boolean;
  appointments: Appointment[];
  dogById: Map<string, Dog>;
  ownerById: Map<string, Owner>;
}): RailBlock[] {
  const { dateKey, isToday, appointments, dogById, ownerById } = params;

  const dayAppts = appointments
    .filter((a) => a.date === dateKey)
    .sort((a, b) => a.startMin - b.startMin);

  const now = isToday ? nowMinutes() : -1;
  const nextAppt = isToday
    ? dayAppts.find((a) => a.startMin + a.durationMin > now)
    : undefined;

  const blocks: RailBlock[] = [];
  let cursor = DAY_START_MIN;

  for (const a of dayAppts) {
    const gap = a.startMin - cursor;
    if (gap >= MIN_BOOKABLE_GAP) {
      blocks.push({ kind: "free", startMin: cursor, durationMin: gap });
    }
    const dog = dogById.get(a.dogId);
    const owner = ownerById.get(a.ownerId);
    if (dog && owner) {
      blocks.push({
        kind: "busy",
        appointment: a,
        dog,
        owner,
        startMin: a.startMin,
        durationMin: a.durationMin,
        isNext: nextAppt?.id === a.id,
      });
    }
    cursor = Math.max(cursor, a.startMin + a.durationMin);
  }

  const tailGap = DAY_END_MIN - cursor;
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
