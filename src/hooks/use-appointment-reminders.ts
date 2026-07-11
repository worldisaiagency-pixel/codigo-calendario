"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { minToLabel, parseDateKey } from "@/lib/time";
import { REMINDER_LEAD_MIN, showReminderNotification } from "@/lib/notifications";

const MAX_SCHEDULE_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

/** Fires a local notification 10 minutes before each confirmed appointment,
 * for as long as this tab stays open. Reschedules whenever the appointment
 * list changes (new booking, cancellation, or a sync update from another
 * device). setTimeout can't survive the app being fully closed — that needs
 * a backend to send a real push — but this covers the common case of the
 * agenda staying open on the counter through the day. */
export function useAppointmentReminders(enabled: boolean) {
  const appointments = useAppStore((s) => s.appointments);
  const dogs = useAppStore((s) => s.dogs);
  const owners = useAppStore((s) => s.owners);

  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const scheduled = timers.current;
    scheduled.forEach((t) => clearTimeout(t));
    scheduled.clear();
    if (!enabled) return;

    const now = Date.now();
    for (const a of appointments) {
      if (a.status !== "confirmed") continue;
      const notifyAt = parseDateKey(a.date);
      notifyAt.setHours(0, a.startMin - REMINDER_LEAD_MIN, 0, 0);
      const delay = notifyAt.getTime() - now;
      if (delay <= 0 || delay > MAX_SCHEDULE_AHEAD_MS) continue;

      const dog = dogs.find((d) => d.id === a.dogId);
      const owner = owners.find((o) => o.id === a.ownerId);
      if (!dog || !owner) continue;

      const timer = setTimeout(() => {
        showReminderNotification({
          dogName: dog.name,
          ownerName: owner.name,
          timeLabel: minToLabel(a.startMin),
          service: a.service,
        });
      }, delay);
      scheduled.set(a.id, timer);
    }

    return () => {
      scheduled.forEach((t) => clearTimeout(t));
      scheduled.clear();
    };
  }, [appointments, dogs, owners, enabled]);
}
