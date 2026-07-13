"use client";

import { Loader2Icon } from "lucide-react";
import { DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { formatDayHeading, minToLabel, parseDateKey } from "@/lib/time";
import type { ScheduleOverride } from "@/lib/data";
import type { ScheduleChangePlan } from "@/lib/rebooking";

function describePending(o: ScheduleOverride): string {
  if (o.kind === "closed") return "Cerrado todo el día";
  if (o.kind === "hours" && o.open != null && o.close != null) {
    return `Horario ${minToLabel(o.open)}–${minToLabel(o.close)}`;
  }
  if (o.kind === "block" && o.blockStart != null && o.blockEnd != null) {
    return `Bloqueado ${minToLabel(o.blockStart)} – ${minToLabel(o.blockEnd)}`;
  }
  return "";
}

/** Content-only — rendered inside the parent ScheduleOverrideSheet's own
 * Drawer as a second "step", not a standalone sheet. */
export function ScheduleChangeSummary({
  pendingOverrides,
  plan,
  confirming,
  onConfirm,
  onBack,
}: {
  pendingOverrides: ScheduleOverride[];
  plan: ScheduleChangePlan;
  confirming: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <DrawerHeader className="safe-top text-left pb-3 shrink-0">
        <div className="pt-5">
          <DrawerTitle className="text-[20px] font-semibold tracking-tight">
            Resumen de cambios
          </DrawerTitle>
          <p className="text-[13px] text-muted-foreground mt-1">Revisa antes de aplicar</p>
        </div>
      </DrawerHeader>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-6">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
            Se bloqueará
          </div>
          <div className="flex flex-col gap-2">
            {pendingOverrides.map((o) => {
              const { weekday, day, month } = formatDayHeading(parseDateKey(o.date));
              return (
                <div key={o.date} className="rounded-2xl bg-secondary px-4 py-3">
                  <div className="text-[13.5px] font-medium capitalize">
                    {weekday} {day} {month}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">{describePending(o)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {plan.moves.length > 0 && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Se moverán automáticamente
            </div>
            <div className="flex flex-col gap-2">
              {plan.moves.map((m) => {
                const to = formatDayHeading(parseDateKey(m.toDate));
                return (
                  <div
                    key={m.appointment.id}
                    className="flex items-center gap-3 rounded-2xl bg-slot-free-tint px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-slot-free truncate">
                        {m.dog.name}
                      </div>
                      <div className="text-[12.5px] text-slot-free/70 truncate capitalize">
                        {to.weekday} {to.day} · {minToLabel(m.toStartMin)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {plan.unresolved.length > 0 && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slot-alert mb-2 px-1">
              No se ha podido recolocar
            </div>
            <div className="flex flex-col gap-2">
              {plan.unresolved.map((u) => (
                <div key={u.appointment.id} className="rounded-2xl bg-slot-alert-tint px-4 py-3">
                  <div className="text-[13.5px] font-medium text-slot-alert">{u.dog.name}</div>
                  <div className="text-[12.5px] text-slot-alert/70">
                    {u.owner.name} · llámala para reprogramar
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        className="shrink-0 px-4 pt-3 border-t border-border/60 bg-popover flex gap-2"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={confirming}
          className="flex-1 rounded-2xl text-[15px] font-medium bg-secondary text-foreground/80 transition-all duration-150 active:scale-[0.985] disabled:opacity-50"
          style={{ height: 52 }}
        >
          Volver
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold bg-primary text-primary-foreground transition-all duration-150 active:scale-[0.985]",
            confirming && "opacity-80"
          )}
          style={{ height: 52 }}
        >
          {confirming && <Loader2Icon className="size-4 animate-spin" />}
          {confirming ? "Reprogramando citas…" : "Confirmar cambios"}
        </button>
      </div>
      {confirming && (
        <p className="shrink-0 px-4 pb-3 text-center text-[12px] text-muted-foreground bg-popover">
          Esto puede tardar unos segundos.
        </p>
      )}
    </>
  );
}
