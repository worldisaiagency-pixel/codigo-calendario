import type { Appointment, Dog } from "./types";
import { toDateKey } from "./time";

/** A client "ficha" (dog+owner) drops out of the search buscador on its own
 * once it goes this long without any appointment — past or future — see
 * isDogSearchable below. Booking again naturally brings it back, since a
 * new appointment date resets the inactivity window. */
export const INACTIVE_CLIENT_MONTHS = 2;

/** True if this dog has at least one appointment (any status) within the
 * inactivity window — future-dated appointments count too, so a client with
 * an upcoming booking never disappears from search in the meantime. */
function hasRecentAppointment(dogId: string, appointments: Appointment[], now: Date): boolean {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - INACTIVE_CLIENT_MONTHS, now.getDate());
  const cutoffKey = toDateKey(cutoff);
  return appointments.some((a) => a.dogId === dogId && a.date >= cutoffKey);
}

/** Whether a dog's ficha should appear in the search buscador — false if
 * either manually archived (see store.ts's archiveClient) or if it has gone
 * INACTIVE_CLIENT_MONTHS without any appointment. Purely a display filter:
 * never deletes the dog/owner rows or any appointment, so history (the
 * calendar rail, client sheets opened from an existing appointment, stats)
 * keeps resolving them exactly as before. */
export function isDogSearchable(dog: Dog, appointments: Appointment[], now: Date = new Date()): boolean {
  if (dog.archived) return false;
  return hasRecentAppointment(dog.id, appointments, now);
}
