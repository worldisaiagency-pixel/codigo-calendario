"use client";

import { AlertTriangle, Phone, Trash2 } from "lucide-react";
import { durationLabel, minToLabel } from "@/lib/time";
import { cadenceLabel, historyForDog, visitsCount } from "@/lib/mock-data";
import type { Appointment, Dog, Owner } from "@/lib/types";

export interface ClientContext {
  appointment: Appointment | null;
  dog: Dog;
  owner: Owner;
}

export function ClientDetailBody({
  context,
  onCancel,
}: {
  context: ClientContext;
  onCancel: () => void;
}) {
  const entries = historyForDog(context.dog.id);
  const initial = context.dog.name.charAt(0).toUpperCase();

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <span className="flex size-12 items-center justify-center rounded-full bg-slot-next-tint text-slot-next text-[19px] font-semibold shrink-0">
          {initial}
        </span>
        <div className="min-w-0">
          <div className="text-[18px] font-semibold leading-tight truncate">
            {context.dog.name}
          </div>
          <div className="text-[13px] text-muted-foreground truncate">
            {context.dog.breed} · {context.owner.name}
          </div>
        </div>
        {context.owner.phone && (
          <a
            href={`tel:${context.owner.phone.replace(/\s/g, "")}`}
            aria-label="Llamar"
            className="ml-auto flex size-10 items-center justify-center rounded-full bg-secondary text-foreground/70 transition-transform duration-150 active:scale-90 active:bg-accent shrink-0"
          >
            <Phone className="size-[17px]" strokeWidth={2} />
          </a>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat n={String(visitsCount(context.dog.id))} l="Visitas" />
        <Stat n={durationLabel(context.dog.avgDurationMin)} l="Dura" />
        <Stat n={cadenceLabel(context.dog.id)} l="Cadencia" />
      </div>

      {context.dog.behaviorNote && (
        <div className="flex items-start gap-2 rounded-2xl bg-slot-alert-tint px-3.5 py-3 mb-4">
          <AlertTriangle className="size-4 text-slot-alert shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-[13px] text-slot-alert leading-snug">
            {context.dog.behaviorNote}
          </p>
        </div>
      )}

      {context.appointment ? (
        <div className="rounded-2xl bg-secondary px-3.5 py-3 mb-5">
          <div className="flex items-center justify-between text-[13.5px]">
            <span className="text-muted-foreground">Cita seleccionada</span>
            <span className="tabular font-medium">
              {minToLabel(context.appointment.startMin)} ·{" "}
              {durationLabel(context.appointment.durationMin)}
            </span>
          </div>
          <div className="text-[13.5px] mt-0.5">{context.appointment.service}</div>
        </div>
      ) : (
        <div className="rounded-2xl bg-secondary px-3.5 py-3 mb-5 text-[13.5px] text-muted-foreground">
          Sin cita programada
        </div>
      )}

      {entries.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
            Historial reciente
          </div>
          <div className="flex flex-col">
            {entries.slice(0, 4).map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between py-2.5 border-b border-border last:border-0 text-[13.5px]"
              >
                <span className="text-muted-foreground">
                  {new Date(h.date).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {h.service}
                </span>
                <span className="tabular text-muted-foreground">
                  {durationLabel(h.durationMin)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {context.appointment && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl text-[13.5px] font-medium text-slot-alert bg-slot-alert-tint transition-transform duration-150 active:scale-[0.98] active:opacity-80"
        >
          <Trash2 className="size-4" strokeWidth={2} />
          Cancelar cita
        </button>
      )}
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-2xl bg-secondary py-2.5 text-center">
      <div className="tabular text-[15px] font-semibold leading-tight">{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
        {l}
      </div>
    </div>
  );
}
