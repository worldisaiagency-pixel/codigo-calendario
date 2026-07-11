import type { Appointment, Dog, Owner } from "./types";
import type { BusinessProfile, DaySchedule, ManualBlock, ScheduleOverride } from "./data";
import { resolveDay } from "./data";
import { findAvailableSlots } from "./availability";
import { addDays, parseDateKey } from "./time";

export interface RebookMove {
  appointment: Appointment;
  dog: Dog;
  owner: Owner;
  fromDate: string;
  fromStartMin: number;
  toDate: string;
  toStartMin: number;
}

export interface RebookUnresolved {
  appointment: Appointment;
  dog: Dog;
  owner: Owner;
}

export interface ScheduleChangePlan {
  moves: RebookMove[];
  unresolved: RebookUnresolved[];
}

const SEARCH_HORIZON_DAYS = 60;

function fitsSchedule(
  appt: Appointment,
  schedule: DaySchedule | null,
  blocks: ManualBlock[]
): boolean {
  if (!schedule) return false;
  const start = appt.startMin;
  const end = appt.startMin + appt.durationMin;
  if (start < schedule.open || end > schedule.close) return false;
  return blocks.every((b) => {
    const blockEnd = b.startMin + b.durationMin;
    return end <= b.startMin || start >= blockEnd; // no overlap
  });
}

/** For a set of pending (not-yet-saved) schedule overrides, finds every
 * confirmed appointment that would no longer fit its date's effective
 * schedule, and tries to relocate each to the nearest slot that still fits
 * its service — respecting the pending overrides too, so the search never
 * proposes a slot inside the newly-blocked time. Processed in chronological
 * order so two displaced appointments never get proposed the same new slot
 * (each accepted move is folded back in before searching for the next). */
export function planScheduleChange(params: {
  profile: BusinessProfile;
  existingOverrides: ScheduleOverride[];
  pendingOverrides: ScheduleOverride[];
  appointments: Appointment[];
  dogById: Map<string, Dog>;
  ownerById: Map<string, Owner>;
}): ScheduleChangePlan {
  const { profile, existingOverrides, pendingOverrides, appointments, dogById, ownerById } =
    params;

  const pendingDates = new Set(pendingOverrides.map((o) => o.date));
  const combinedOverrides = [...existingOverrides, ...pendingOverrides];

  const moves: RebookMove[] = [];
  const unresolved: RebookUnresolved[] = [];

  const displaced = appointments
    .filter((a) => {
      if (!pendingDates.has(a.date) || a.status !== "confirmed") return false;
      const { schedule, blocks } = resolveDay(profile, combinedOverrides, parseDateKey(a.date));
      return !fitsSchedule(a, schedule, blocks);
    })
    .sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1));

  let working = [...appointments];

  for (const appt of displaced) {
    const dog = dogById.get(appt.dogId);
    const owner = ownerById.get(appt.ownerId);
    if (!dog || !owner) continue;

    working = working.filter((a) => a.id !== appt.id);

    const fromDate = parseDateKey(appt.date);
    const results = findAvailableSlots({
      profile,
      scheduleOverrides: combinedOverrides,
      appointments: working,
      dogById,
      ownerById,
      durationMin: appt.durationMin,
      rangeStart: fromDate,
      rangeEnd: addDays(fromDate, SEARCH_HORIZON_DAYS),
      limit: 1,
    });

    if (results.length === 0) {
      unresolved.push({ appointment: appt, dog, owner });
      working.push(appt); // still a real booking until the owner deals with it
      continue;
    }

    const slot = results[0];
    moves.push({
      appointment: appt,
      dog,
      owner,
      fromDate: appt.date,
      fromStartMin: appt.startMin,
      toDate: slot.date,
      toStartMin: slot.slotStartMin,
    });
    working.push({ ...appt, date: slot.date, startMin: slot.slotStartMin });
  }

  return { moves, unresolved };
}
