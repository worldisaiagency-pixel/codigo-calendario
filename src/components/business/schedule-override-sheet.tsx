"use client";

import { useMemo, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { planScheduleChange, type ScheduleChangePlan } from "@/lib/rebooking";
import { addDays, formatDayHeading, toDateKey } from "@/lib/time";
import type { ScheduleOverride, ScheduleOverrideKind } from "@/lib/data";
import { ScheduleChangeSummary } from "./schedule-change-summary";
import { NotifyClientsSheet } from "./notify-clients-sheet";
import { toast } from "sonner";

type UiChoice = "closed" | "block" | "extend" | "modify";
type Step = "edit" | "summary" | "notify";

const DAYS_AHEAD = 14;

const MODE_OPTIONS: { value: UiChoice; label: string }[] = [
  { value: "closed", label: "Cerrar completamente" },
  { value: "block", label: "Bloquear unas horas" },
  { value: "extend", label: "Ampliar horario" },
  { value: "modify", label: "Modificar horario" },
];

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function ScheduleOverrideSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const business = useAppStore((s) => s.business);
  const scheduleOverrides = useAppStore((s) => s.scheduleOverrides);
  const appointments = useAppStore((s) => s.appointments);
  const dogs = useAppStore((s) => s.dogs);
  const owners = useAppStore((s) => s.owners);
  const addScheduleOverride = useAppStore((s) => s.addScheduleOverride);
  const updateAppointment = useAppStore((s) => s.updateAppointment);

  const dogById = useMemo(() => new Map(dogs.map((d) => [d.id, d])), [dogs]);
  const ownerById = useMemo(() => new Map(owners.map((o) => [o.id, o])), [owners]);

  const [step, setStep] = useState<Step>("edit");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [choice, setChoice] = useState<UiChoice | null>(null);
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("20:00");
  const [plan, setPlan] = useState<ScheduleChangePlan | null>(null);
  const [pendingOverrides, setPendingOverrides] = useState<ScheduleOverride[]>([]);

  // Reset every time the sheet is (re)opened — adjusting state during
  // render keeps this synchronous, no flash of the previous attempt.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep("edit");
      setSelectedDates([]);
      setChoice(null);
      setStartTime("19:00");
      setEndTime("20:00");
      setPlan(null);
      setPendingOverrides([]);
    }
  }

  const dayOptions = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  }, []);

  function toggleDate(key: string) {
    setSelectedDates((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  }

  const needsTimeRange = choice === "block" || choice === "extend" || choice === "modify";
  const canReview =
    Boolean(business) &&
    selectedDates.length > 0 &&
    choice !== null &&
    (!needsTimeRange || startTime < endTime);

  function handleReview() {
    if (!business || !choice) return;
    const kind: ScheduleOverrideKind =
      choice === "closed" ? "closed" : choice === "block" ? "block" : "hours";

    const overrides: ScheduleOverride[] = selectedDates.map((date) => {
      if (kind === "closed") return { id: `pending-${date}`, date, kind };
      if (kind === "block") {
        return {
          id: `pending-${date}`,
          date,
          kind,
          blockStart: timeToMin(startTime),
          blockEnd: timeToMin(endTime),
        };
      }
      return {
        id: `pending-${date}`,
        date,
        kind,
        open: timeToMin(startTime),
        close: timeToMin(endTime),
      };
    });

    const result = planScheduleChange({
      business,
      existingOverrides: scheduleOverrides,
      pendingOverrides: overrides,
      appointments,
      dogById,
      ownerById,
    });

    setPendingOverrides(overrides);
    setPlan(result);
    setStep("summary");
  }

  async function handleConfirm() {
    if (!plan) return;
    for (const o of pendingOverrides) {
      addScheduleOverride({
        date: o.date,
        kind: o.kind,
        open: o.open,
        close: o.close,
        blockStart: o.blockStart,
        blockEnd: o.blockEnd,
      });
    }

    let failedCount = 0;
    for (const move of plan.moves) {
      const result = await updateAppointment(move.appointment.id, {
        date: move.toDate,
        startMin: move.toStartMin,
      });
      if (!result.ok) failedCount++;
    }
    if (failedCount > 0) {
      toast.error(
        failedCount === 1
          ? "Una cita no se pudo reprogramar (el hueco ya no estaba libre) — revísala en el calendario."
          : `${failedCount} citas no se pudieron reprogramar (los huecos ya no estaban libres) — revísalas en el calendario.`
      );
    }

    if (plan.moves.length > 0) {
      setStep("notify");
    } else {
      onOpenChange(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="flex flex-col sm:max-w-md sm:mx-auto overflow-hidden"
      >
        {step === "edit" && (
          <>
            <DrawerHeader className="safe-top text-left pb-3 shrink-0">
              <div className="pt-5">
                <DrawerTitle className="text-[20px] font-semibold tracking-tight">
                  Modificar horario temporalmente
                </DrawerTitle>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Para cambios puntuales — cierres, urgencias, horarios especiales
                </p>
              </div>
            </DrawerHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-6">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
                  Días
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {dayOptions.map((d) => {
                    const key = toDateKey(d);
                    const { weekday, day } = formatDayHeading(d);
                    const selected = selectedDates.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleDate(key)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-0.5 shrink-0 w-14 h-16 rounded-2xl transition-colors duration-150 active:scale-[0.96]",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-foreground/80 active:bg-accent"
                        )}
                      >
                        <span className="text-[10px] font-medium uppercase opacity-70">
                          {weekday.slice(0, 3)}
                        </span>
                        <span className="tabular text-[16px] font-semibold">{day}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
                  Qué quieres hacer
                </div>
                <div className="flex flex-wrap gap-2">
                  {MODE_OPTIONS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setChoice(m.value)}
                      className={cn(
                        "px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors duration-150 active:scale-[0.96]",
                        choice === m.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground/80 active:bg-accent"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {needsTimeRange && (
                <div className="flex gap-3">
                  <label className="flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
                      Desde
                    </div>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="tabular w-full h-12 rounded-2xl bg-secondary px-4 text-[16px]"
                    />
                  </label>
                  <label className="flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
                      Hasta
                    </div>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="tabular w-full h-12 rounded-2xl bg-secondary px-4 text-[16px]"
                    />
                  </label>
                </div>
              )}
            </div>

            <div
              className="shrink-0 px-4 pt-3 border-t border-border/60 bg-popover"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              <button
                type="button"
                disabled={!canReview}
                onClick={handleReview}
                className={cn(
                  "w-full rounded-2xl text-[16px] font-semibold transition-all duration-150 active:scale-[0.985]",
                  canReview
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                )}
                style={{ height: 52 }}
              >
                Ver resumen
              </button>
            </div>
          </>
        )}

        {step === "summary" && plan && (
          <ScheduleChangeSummary
            pendingOverrides={pendingOverrides}
            plan={plan}
            onConfirm={handleConfirm}
            onBack={() => setStep("edit")}
          />
        )}

        {step === "notify" && plan && (
          <NotifyClientsSheet moves={plan.moves} onDone={() => onOpenChange(false)} />
        )}
      </DrawerContent>
    </Drawer>
  );
}
