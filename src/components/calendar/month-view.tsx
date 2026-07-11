"use client";

import { cn } from "@/lib/utils";
import { isSameDay, monthGridDays, toDateKey } from "@/lib/time";
import type { Appointment } from "@/lib/types";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export function MonthView({
  date,
  appointments,
  onSelectDay,
}: {
  date: Date;
  appointments: Appointment[];
  onSelectDay: (d: Date) => void;
}) {
  const days = monthGridDays(date);
  const today = new Date();
  const currentMonth = date.getMonth();

  const countsByDate = new Map<string, number>();
  for (const a of appointments) {
    countsByDate.set(a.date, (countsByDate.get(a.date) ?? 0) + 1);
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar px-4 pb-10 pt-1">
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAY_LABELS.map((l) => (
          <div
            key={l}
            className="text-center text-[11px] font-medium text-muted-foreground py-1"
          >
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const dateKey = toDateKey(d);
          const inMonth = d.getMonth() === currentMonth;
          const isToday = isSameDay(d, today);
          const count = countsByDate.get(dateKey) ?? 0;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDay(d)}
              className="flex flex-col items-center justify-start gap-1 py-1.5 rounded-xl transition-transform duration-150 active:scale-90 active:bg-accent"
            >
              <span
                className={cn(
                  "tabular flex size-8 items-center justify-center rounded-full text-[14px]",
                  isToday
                    ? "bg-slot-next text-primary-foreground font-semibold"
                    : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground/40"
                )}
              >
                {d.getDate()}
              </span>
              <span className="flex gap-0.5 h-1.5">
                {count > 0 &&
                  Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "size-1.5 rounded-full",
                        isToday ? "bg-slot-next" : "bg-slot-free"
                      )}
                    />
                  ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
