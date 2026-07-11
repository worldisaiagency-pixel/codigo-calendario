"use client";

import { CalendarClock, LogOut, Trash2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { formatDayHeading, minToLabel, parseDateKey } from "@/lib/time";
import type { Business, ScheduleOverride } from "@/lib/data";

function describeOverride(o: ScheduleOverride): string {
  if (o.kind === "closed") return "Cerrado todo el día";
  if (o.kind === "hours" && o.open != null && o.close != null) {
    return `Horario ${minToLabel(o.open)}–${minToLabel(o.close)}`;
  }
  if (o.kind === "block" && o.blockStart != null && o.blockEnd != null) {
    return `Bloqueado ${minToLabel(o.blockStart)}–${minToLabel(o.blockEnd)}`;
  }
  return "Horario modificado";
}

export function BusinessMenuSheet({
  open,
  onOpenChange,
  business,
  scheduleOverrides,
  onOpenScheduleEditor,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business: Business;
  scheduleOverrides: ScheduleOverride[];
  onOpenScheduleEditor: () => void;
  onLogout: () => void;
}) {
  const removeScheduleOverride = useAppStore((s) => s.removeScheduleOverride);

  const upcoming = [...scheduleOverrides].sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col sm:max-w-md sm:mx-auto overflow-hidden">
        <DrawerHeader className="safe-top text-left pb-3 shrink-0">
          <div className="pt-5">
            <DrawerTitle className="text-[20px] font-semibold tracking-tight truncate">
              {business.name}
            </DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="px-4 pb-4 flex flex-col gap-6">
          <div className="rounded-2xl bg-secondary overflow-hidden divide-y divide-border/60">
            <button
              type="button"
              onClick={onOpenScheduleEditor}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-accent transition-colors"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-slot-next-tint text-slot-next shrink-0">
                <CalendarClock className="size-[17px]" strokeWidth={2} />
              </span>
              <span className="text-[15px] font-medium">Modificar horario temporalmente</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-accent transition-colors"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
                <LogOut className="size-[17px]" strokeWidth={2} />
              </span>
              <span className="text-[15px] font-medium">Cerrar sesión</span>
            </button>
          </div>

          {upcoming.length > 0 && (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
                Horario temporal activo
              </div>
              <div className="flex flex-col gap-2">
                {upcoming.map((o) => {
                  const { weekday, day, month } = formatDayHeading(parseDateKey(o.date));
                  return (
                    <div
                      key={o.id}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium capitalize truncate">
                          {weekday} {day} {month}
                        </div>
                        <div className="text-[12.5px] text-muted-foreground truncate">
                          {describeOverride(o)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeScheduleOverride(o.id)}
                        aria-label="Quitar este cambio de horario"
                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground shrink-0 active:bg-accent transition-colors"
                      >
                        <Trash2 className="size-[16px]" strokeWidth={2} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
