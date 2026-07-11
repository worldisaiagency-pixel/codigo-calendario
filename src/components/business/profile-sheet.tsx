"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { WEEKDAYS, emptyProfile } from "@/lib/data";
import type { BusinessService, DaySchedule, VacationRange, Weekday } from "@/lib/data";
import { toDateKey } from "@/lib/time";

const WEEKDAY_LABELS: Record<Weekday, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function ProfileSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);

  const [services, setServices] = useState<BusinessService[]>([]);
  const [hours, setHours] = useState<Record<Weekday, DaySchedule | null>>(emptyProfile().hours);
  const [vacations, setVacations] = useState<VacationRange[]>([]);
  const [vacStart, setVacStart] = useState("");
  const [vacEnd, setVacEnd] = useState("");

  // Load the current profile into local edit state every time the sheet is
  // (re)opened — adjusting state during render keeps this synchronous.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && profile) {
      setServices(profile.services);
      setHours(profile.hours);
      setVacations(profile.vacations);
      setVacStart("");
      setVacEnd("");
    }
  }

  function addService() {
    setServices((prev) => [...prev, { name: "", priceLabel: "", durationMin: 30 }]);
  }
  function updateService(i: number, patch: Partial<BusinessService>) {
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function removeService(i: number) {
    setServices((prev) => prev.filter((_, idx) => idx !== i));
  }

  function toggleDayClosed(day: Weekday) {
    setHours((prev) => ({
      ...prev,
      [day]: prev[day] ? null : { open: 9 * 60, close: 19 * 60 },
    }));
  }
  function updateDayTime(day: Weekday, key: "open" | "close", time: string) {
    setHours((prev) => {
      const current = prev[day] ?? { open: 9 * 60, close: 19 * 60 };
      return { ...prev, [day]: { ...current, [key]: timeToMin(time) } };
    });
  }

  function addVacation() {
    if (!vacStart || !vacEnd || vacStart > vacEnd) return;
    setVacations((prev) => [...prev, { start: vacStart, end: vacEnd }]);
    setVacStart("");
    setVacEnd("");
  }
  function removeVacation(i: number) {
    setVacations((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    const cleanServices = services.filter((s) => s.name.trim().length > 0);
    updateProfile({ services: cleanServices, hours, vacations });
    onOpenChange(false);
  }

  const todayKey = toDateKey(new Date());

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col sm:max-w-md sm:mx-auto overflow-hidden">
        <DrawerHeader className="safe-top text-left pb-3 shrink-0">
          <div className="pt-5">
            <DrawerTitle className="text-[20px] font-semibold tracking-tight">
              Configurar perfil
            </DrawerTitle>
            <p className="text-[13px] text-muted-foreground mt-1">
              Servicios, horarios y vacaciones de tu negocio
            </p>
          </div>
        </DrawerHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-6">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Servicios
            </div>
            <div className="flex flex-col gap-2">
              {services.map((s, i) => (
                <div key={i} className="rounded-2xl bg-secondary p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={s.name}
                      onChange={(e) => updateService(i, { name: e.target.value })}
                      placeholder="Nombre del servicio"
                      className="h-10 text-[14px] rounded-xl bg-background border-0 px-3 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeService(i)}
                      aria-label="Eliminar servicio"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-accent transition-colors"
                    >
                      <Trash2 className="size-[15px]" strokeWidth={2} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={s.priceLabel}
                      onChange={(e) => updateService(i, { priceLabel: e.target.value })}
                      placeholder="Precio (ej. 25€)"
                      className="h-10 text-[14px] rounded-xl bg-background border-0 px-3 flex-1"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={5}
                        step={5}
                        value={s.durationMin}
                        onChange={(e) => updateService(i, { durationMin: Number(e.target.value) || 0 })}
                        className="tabular h-10 w-16 rounded-xl bg-background px-2 text-[14px] text-center"
                      />
                      <span className="text-[12.5px] text-muted-foreground">min</span>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addService}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-secondary py-2.5 text-[13.5px] font-medium text-foreground/80 active:bg-accent transition-colors"
              >
                <Plus className="size-4" strokeWidth={2} />
                Añadir servicio
              </button>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Horarios
            </div>
            <div className="rounded-2xl bg-secondary overflow-hidden divide-y divide-border/60">
              {WEEKDAYS.map((day) => {
                const schedule = hours[day];
                return (
                  <div key={day} className="flex items-center gap-2 px-4 py-2.5">
                    <span className="text-[13.5px] font-medium w-20 shrink-0">
                      {WEEKDAY_LABELS[day]}
                    </span>
                    {schedule ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="time"
                          value={minToTime(schedule.open)}
                          onChange={(e) => updateDayTime(day, "open", e.target.value)}
                          className="tabular h-9 flex-1 min-w-0 rounded-lg bg-background px-2 text-[13px]"
                        />
                        <span className="text-muted-foreground text-[12px]">–</span>
                        <input
                          type="time"
                          value={minToTime(schedule.close)}
                          onChange={(e) => updateDayTime(day, "close", e.target.value)}
                          className="tabular h-9 flex-1 min-w-0 rounded-lg bg-background px-2 text-[13px]"
                        />
                      </div>
                    ) : (
                      <span className="flex-1 text-[13px] text-muted-foreground">Cerrado</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleDayClosed(day)}
                      className={cn(
                        "shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors duration-150 active:scale-[0.96]",
                        schedule
                          ? "bg-background text-muted-foreground"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {schedule ? "Cerrar" : "Abrir"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Vacaciones
            </div>
            <div className="flex flex-col gap-2">
              {vacations.map((v, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3"
                >
                  <span className="tabular text-[13.5px] font-medium flex-1">
                    {v.start} → {v.end}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeVacation(i)}
                    aria-label="Eliminar periodo de vacaciones"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-accent transition-colors"
                  >
                    <Trash2 className="size-[15px]" strokeWidth={2} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  min={todayKey}
                  value={vacStart}
                  onChange={(e) => setVacStart(e.target.value)}
                  className="tabular h-11 flex-1 min-w-0 rounded-xl bg-secondary px-3 text-[13px]"
                />
                <input
                  type="date"
                  min={vacStart || todayKey}
                  value={vacEnd}
                  onChange={(e) => setVacEnd(e.target.value)}
                  className="tabular h-11 flex-1 min-w-0 rounded-xl bg-secondary px-3 text-[13px]"
                />
                <button
                  type="button"
                  onClick={addVacation}
                  disabled={!vacStart || !vacEnd || vacStart > vacEnd}
                  aria-label="Añadir periodo de vacaciones"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
                >
                  <Plus className="size-[18px]" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          className="shrink-0 px-4 pt-3 border-t border-border/60 bg-popover"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-2xl text-[16px] font-semibold bg-primary text-primary-foreground transition-all duration-150 active:scale-[0.985]"
            style={{ height: 52 }}
          >
            Guardar
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
