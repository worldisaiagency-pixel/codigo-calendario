"use client";

import { useRef } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  addDays,
  addMonths,
  formatDayHeading,
  isSameDay,
  monthName,
  weekDays,
} from "@/lib/time";
import type { ViewMode } from "@/lib/types";

const VIEW_LABELS: Record<ViewMode, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
};

function relativeLabel(date: Date): string | null {
  const today = new Date();
  const diffDays = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "mañana";
  if (diffDays === -1) return "ayer";
  return null;
}

export function DayNav({
  date,
  onChange,
  viewMode,
  onViewModeChange,
}: {
  date: Date;
  onChange: (d: Date) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}) {
  const { weekday, day, month } = formatDayHeading(date);
  const isToday = isSameDay(date, new Date());
  const relative = viewMode === "day" ? relativeLabel(date) : null;

  const weekRange = weekDays(date);
  const weekStart = weekRange[0];
  const weekEnd = weekRange[6];
  const weekSpansMonths = weekStart.getMonth() !== weekEnd.getMonth();

  const touchX = useRef<number | null>(null);

  function step(dir: 1 | -1): Date {
    if (viewMode === "week") return addDays(date, 7 * dir);
    if (viewMode === "month") return addMonths(date, dir);
    return addDays(date, dir);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 56 && viewMode === "day") {
      onChange(step(dx > 0 ? -1 : 1));
    }
    touchX.current = null;
  }

  return (
    <div
      className="flex items-center justify-between px-2 pt-2 pb-1"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        aria-label="Anterior"
        onClick={() => onChange(step(-1))}
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 active:bg-accent shrink-0"
      >
        <ChevronLeft className="size-5" strokeWidth={2} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex-1 flex flex-col items-center gap-0.5 px-2 py-0.5 rounded-xl transition-opacity duration-150 active:opacity-50"
          >
            <div className="flex items-baseline gap-2">
              {viewMode === "day" && (
                <>
                  <span className="flex items-baseline gap-1.5">
                    <span className="capitalize text-[22px] font-semibold leading-none tracking-tight">
                      {weekday}
                    </span>
                    <span className="tabular text-[22px] font-semibold leading-none text-muted-foreground">
                      {day}
                    </span>
                  </span>
                  <span className="capitalize text-[13px] text-muted-foreground">
                    {month}
                  </span>
                </>
              )}
              {viewMode === "week" && (
                <>
                  <span className="tabular text-[22px] font-semibold leading-none tracking-tight">
                    {weekStart.getDate()} – {weekEnd.getDate()}
                  </span>
                  <span className="capitalize text-[13px] text-muted-foreground">
                    {weekSpansMonths
                      ? `${monthName(weekStart)} – ${monthName(weekEnd)}`
                      : monthName(weekStart)}
                  </span>
                </>
              )}
              {viewMode === "month" && (
                <>
                  <span className="capitalize text-[22px] font-semibold leading-none tracking-tight">
                    {month}
                  </span>
                  <span className="tabular text-[13px] text-muted-foreground">
                    {date.getFullYear()}
                  </span>
                </>
              )}
            </div>
            <span
              className={cn(
                "mt-0.5 text-[11px] font-medium capitalize transition-colors",
                isToday ? "text-slot-free" : "text-muted-foreground"
              )}
            >
              {relative ?? VIEW_LABELS[viewMode]}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48 rounded-2xl p-1.5">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
            <DropdownMenuItem
              key={v}
              onSelect={() => onViewModeChange(v)}
              className="justify-between rounded-xl px-3 py-2.5 text-[15px]"
            >
              {VIEW_LABELS[v]}
              {viewMode === v && <Check className="size-4 text-slot-free" strokeWidth={2.25} />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuItem
            onSelect={() => onChange(new Date())}
            className="rounded-xl px-3 py-2.5 text-[15px]"
          >
            Ir a hoy
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        aria-label="Siguiente"
        onClick={() => onChange(step(1))}
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 active:bg-accent shrink-0"
      >
        <ChevronRight className="size-5" strokeWidth={2} />
      </button>
    </div>
  );
}
