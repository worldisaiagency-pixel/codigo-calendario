"use client";

import { cn } from "@/lib/utils";
import { buildRail } from "@/lib/rail";
import { formatDayHeading, isSameDay, toDateKey, weekDays } from "@/lib/time";
import { resolveDay } from "@/lib/data";
import type { Business, ScheduleOverride } from "@/lib/data";
import type { Appointment, Dog, Owner } from "@/lib/types";

export function WeekView({
  date,
  business,
  scheduleOverrides,
  appointments,
  dogById,
  ownerById,
  onSelectDay,
}: {
  date: Date;
  business: Business;
  scheduleOverrides: ScheduleOverride[];
  appointments: Appointment[];
  dogById: Map<string, Dog>;
  ownerById: Map<string, Owner>;
  onSelectDay: (d: Date) => void;
}) {
  const days = weekDays(date);
  const today = new Date();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar px-4 pb-10 pt-1">
      <div className="flex flex-col gap-2">
        {days.map((d) => {
          const dateKey = toDateKey(d);
          const isToday = isSameDay(d, today);
          const { schedule, blocks: manualBlocks } = resolveDay(business, scheduleOverrides, d);
          const dayAppts = appointments.filter((a) => a.date === dateKey);
          const blocks = schedule
            ? buildRail({
                dateKey,
                isToday,
                appointments,
                dogById,
                ownerById,
                schedule,
                manualBlocks,
              })
            : [];
          const totalMin = schedule ? schedule.close - schedule.open : 0;
          const largestFree = blocks
            .filter((b) => b.kind === "free")
            .reduce((max, b) => Math.max(max, b.durationMin), 0);
          const { weekday, day, month } = formatDayHeading(d);

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDay(d)}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-transform duration-150 active:scale-[0.98]",
                isToday ? "bg-slot-next-tint active:brightness-95" : "bg-card shadow-[var(--shadow)] active:bg-accent/60"
              )}
            >
              <div className="w-12 shrink-0 text-center">
                <div className="capitalize text-[11px] text-muted-foreground leading-none">
                  {weekday.slice(0, 3)}
                </div>
                <div
                  className={cn(
                    "tabular text-[19px] font-semibold leading-tight mt-0.5",
                    isToday && "text-slot-next"
                  )}
                >
                  {day}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-slot-free-tint mb-1.5">
                  {schedule &&
                    blocks
                      .filter((b) => b.kind !== "closed")
                      .map((b, i) => (
                      <div
                        key={i}
                        style={{ width: `${(b.durationMin / totalMin) * 100}%` }}
                        className={cn(
                          "h-full",
                          b.kind === "busy" && "bg-slot-busy/30",
                          b.kind === "blocked" && "bg-slot-alert/25",
                          b.kind === "free" && "bg-transparent"
                        )}
                      />
                    ))}
                </div>
                <div className="text-[12.5px] text-muted-foreground truncate">
                  {!schedule
                    ? `Cerrado · ${month}`
                    : dayAppts.length === 0
                      ? `Día libre · ${month}`
                      : `${dayAppts.length} ${dayAppts.length === 1 ? "cita" : "citas"} · hueco mayor ${
                          largestFree >= 60
                            ? `${Math.floor(largestFree / 60)}h`
                            : `${largestFree}min`
                        }`}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
