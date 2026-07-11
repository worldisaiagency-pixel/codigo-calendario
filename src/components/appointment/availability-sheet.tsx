"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import type { Business, ScheduleOverride } from "@/lib/data";
import { findAvailableSlots, type AvailabilitySlot } from "@/lib/availability";
import { ServicePicker } from "./service-picker";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  formatDayHeading,
  minToLabel,
  parseDateKey,
} from "@/lib/time";
import type { Appointment, Dog, Owner } from "@/lib/types";

type Priority = "asap" | "week" | "month";

const PRIORITY_LABELS: Record<Priority, string> = {
  asap: "Cuanto antes",
  week: "Esta semana",
  month: "Este mes",
};

export interface AvailabilityPick {
  date: string;
  blockStartMin: number;
  blockDurationMin: number;
  slotStartMin: number;
  service: string;
}

export function AvailabilitySheet({
  open,
  onOpenChange,
  business,
  scheduleOverrides,
  appointments,
  dogById,
  ownerById,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business: Business;
  scheduleOverrides: ScheduleOverride[];
  appointments: Appointment[];
  dogById: Map<string, Dog>;
  ownerById: Map<string, Owner>;
  onConfirm: (pick: AvailabilityPick) => void;
}) {
  const services = business.services;
  const serviceDurationMin = useMemo(
    () => Object.fromEntries(services.map((s) => [s.name, s.durationMin])),
    [services]
  );
  const [service, setService] = useState<string>("");
  const [priority, setPriority] = useState<Priority | null>(null);
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);

  // Reset the form every time the sheet is (re)opened — adjusting state
  // during render keeps this synchronous, no flash of the previous search.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setService("");
      setPriority(null);
      setSelected(null);
    }
  }

  const results = useMemo(() => {
    if (!service || !priority) return [];
    const durationMin = serviceDurationMin[service];
    const today = new Date();
    const rangeEnd =
      priority === "asap" ? addDays(today, 60) : priority === "week" ? endOfWeek(today) : endOfMonth(today);
    return findAvailableSlots({
      business,
      scheduleOverrides,
      appointments,
      dogById,
      ownerById,
      durationMin,
      rangeStart: today,
      rangeEnd,
      limit: 8,
    });
  }, [business, scheduleOverrides, service, priority, appointments, dogById, ownerById, serviceDurationMin]);

  const canConfirm = Boolean(service && selected);

  function handleConfirm() {
    if (!service || !selected) return;
    onConfirm({
      date: selected.date,
      blockStartMin: selected.blockStartMin,
      blockDurationMin: selected.blockDurationMin,
      slotStartMin: selected.slotStartMin,
      service,
    });
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "flex flex-col sm:max-w-md sm:mx-auto overflow-hidden",
          "data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:h-[100dvh] data-[vaul-drawer-direction=bottom]:max-h-[100dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[20px]"
        )}
      >
        <DrawerHeader className="safe-top text-left pb-3 shrink-0">
          <div className="pt-5">
            <DrawerTitle className="text-[20px] font-semibold tracking-tight">
              Ver disponibilidad
            </DrawerTitle>
            <p className="text-[13px] text-muted-foreground mt-1">
              Elige un servicio y cuándo lo necesitas
            </p>
          </div>
        </DrawerHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-6">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Servicio
            </div>
            <ServicePicker
              services={services}
              selected={service}
              onSelect={(name) => {
                setService(name);
                setSelected(null);
              }}
            />
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
              ¿Para cuándo?
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPriority(p);
                    setSelected(null);
                  }}
                  className={cn(
                    "px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors duration-150 active:scale-[0.96]",
                    priority === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground/80 active:bg-accent"
                  )}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {service && priority && (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
                Disponibilidad
              </div>
              {results.length === 0 ? (
                <p className="px-1 text-[13.5px] text-muted-foreground">
                  No hay huecos disponibles en ese rango.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {results.map((r, i) => {
                    const isSelected =
                      selected?.date === r.date && selected?.slotStartMin === r.slotStartMin;
                    const { weekday, day, month } = formatDayHeading(parseDateKey(r.date));
                    return (
                      <button
                        key={`${r.date}-${r.slotStartMin}`}
                        type="button"
                        onClick={() => setSelected(r)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-150 active:scale-[0.99]",
                          isSelected
                            ? "bg-slot-free-tint border border-slot-free"
                            : "bg-secondary border border-transparent active:bg-accent"
                        )}
                      >
                        <span
                          className={cn(
                            "tabular flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                            isSelected
                              ? "bg-slot-free text-white"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium capitalize truncate">
                            {weekday} {day} {month}
                          </span>
                          <span className="tabular block text-[12.5px] text-muted-foreground">
                            {minToLabel(r.slotStartMin)} –{" "}
                            {minToLabel(r.slotStartMin + serviceDurationMin[service])}
                          </span>
                        </span>
                        {isSelected && (
                          <Check className="size-[18px] text-slot-free shrink-0" strokeWidth={2.25} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {selected && (
          <div
            className="shrink-0 px-4 pt-3 border-t border-border/60 bg-popover"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className="w-full rounded-2xl text-[16px] font-semibold bg-primary text-primary-foreground transition-all duration-150 active:scale-[0.985]"
              style={{ height: 52 }}
            >
              Agendar cita
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
