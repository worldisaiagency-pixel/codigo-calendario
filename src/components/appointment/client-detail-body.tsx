"use client";

import { useState } from "react";
import { AlertTriangle, Loader2Icon, MessageCircle, Phone, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { durationLabel, isAppointmentCompleted, minToLabel } from "@/lib/time";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { applyWhatsAppTemplate, resolveWhatsAppTemplate } from "@/lib/whatsapp-template";
import type { NotifyRecipient } from "@/components/business/notify-clients-sheet";
import type { Appointment, Dog, Owner } from "@/lib/types";
import { toast } from "sonner";

// Real completed visits for this dog, most recent first — replaces the old
// prototype fixture (mock-data.ts) which always returned "1"/"—" for every
// real dog since it only knew about its own hardcoded ids.
function doneHistoryForDog(appointments: Appointment[], dogId: string): Appointment[] {
  return appointments
    .filter((a) => a.dogId === dogId && a.status === "done")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function cadenceLabel(history: Appointment[]): string {
  if (history.length < 2) return "—";
  const d0 = new Date(history[0].date).getTime();
  const d1 = new Date(history[1].date).getTime();
  const weeks = Math.round((d0 - d1) / (7 * 24 * 60 * 60 * 1000));
  return `${weeks} sem`;
}

export interface ClientContext {
  appointment: Appointment | null;
  dog: Dog;
  owner: Owner;
}

/** Cancellation (confirm → loading → hand off to the caller's own notify
 * step) lives here, once, since both client-sheet.tsx (mobile) and
 * desktop-side-panel.tsx render this same body — the confirm dialog is a
 * Dialog (not a Drawer), so it layers safely over either container without
 * ever nesting two Drawers. Reuses removeAppointment's own
 * await-then-rollback result, exactly like the reschedule flow's
 * "confirming" pattern (see schedule-override-sheet.tsx). */
export function ClientDetailBody({
  context,
  onCancelled,
}: {
  context: ClientContext;
  /** Called once removeAppointment actually succeeds, with everything the
   * caller needs to open its own NotifyClientsSheet next — the caller
   * decides how (swap its own Drawer step, or open a floating one), since
   * that differs between the mobile sheet and the desktop side panel. */
  onCancelled: (recipient: NotifyRecipient) => void;
}) {
  const removeAppointment = useAppStore((s) => s.removeAppointment);
  const business = useAppStore((s) => s.business);
  const allAppointments = useAppStore((s) => s.appointments);
  const dogAppointments = allAppointments.filter((a) => a.dogId === context.dog.id);
  const entries = doneHistoryForDog(allAppointments, context.dog.id);
  const initial = context.dog.name.charAt(0).toUpperCase();

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Derived purely from the clock, same as the calendar rail's own
  // "completada" chip (see appointment-block.tsx) — no separate status.
  const completed = Boolean(
    context.appointment &&
      isAppointmentCompleted(
        context.appointment.date,
        context.appointment.startMin,
        context.appointment.durationMin
      )
  );

  function handleRequestReview() {
    if (!business || !context.appointment || !context.owner.phone) return;
    const template = resolveWhatsAppTemplate(business.whatsappTemplates, "appointmentReview");
    const message = applyWhatsAppTemplate(template, {
      clientName: context.owner.name,
      dogName: context.dog.name,
      service: context.appointment.service,
      phone: context.owner.phone,
      businessName: business.name,
      date: context.appointment.date,
      startMin: context.appointment.startMin,
      reviewLink: business.reviewLink ?? "",
    });
    window.open(buildWhatsAppLink(context.owner.phone, message), "_blank");
  }

  async function handleConfirmCancel() {
    if (!context.appointment || cancelling) return;
    setCancelling(true);
    const result = await removeAppointment(context.appointment.id);
    setCancelling(false);
    if (!result.ok) {
      toast.error("No se pudo cancelar la cita", {
        description: "Revisa tu conexión e inténtalo de nuevo",
      });
      return;
    }
    setConfirmingCancel(false);
    onCancelled({ appointment: context.appointment, dog: context.dog, owner: context.owner });
  }

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
        <Stat n={String(dogAppointments.length)} l="Visitas" />
        <Stat n={durationLabel(context.dog.avgDurationMin)} l="Dura" />
        <Stat n={cadenceLabel(entries)} l="Cadencia" />
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

      {completed && (
        <button
          type="button"
          onClick={handleRequestReview}
          disabled={!context.owner.phone}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl text-[13.5px] font-medium text-slot-free bg-slot-free/12 transition-transform duration-150 active:scale-[0.98] active:opacity-80 disabled:opacity-40 mb-2"
        >
          <MessageCircle className="size-4" strokeWidth={2} />
          Pedir reseña por WhatsApp
        </button>
      )}

      {context.appointment && (
        <button
          type="button"
          onClick={() => setConfirmingCancel(true)}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl text-[13.5px] font-medium text-slot-alert bg-slot-alert-tint transition-transform duration-150 active:scale-[0.98] active:opacity-80"
        >
          <Trash2 className="size-4" strokeWidth={2} />
          Cancelar cita
        </button>
      )}

      <Dialog
        open={confirmingCancel}
        onOpenChange={(next) => {
          if (cancelling) return;
          setConfirmingCancel(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar esta cita?</DialogTitle>
            <DialogDescription>
              Se cancelará la cita de {context.dog.name}. Podrás avisar al cliente por WhatsApp
              justo después.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={cancelling} onClick={() => setConfirmingCancel(false)}>
              Volver
            </Button>
            <Button variant="destructive" disabled={cancelling} onClick={handleConfirmCancel}>
              {cancelling && <Loader2Icon className="size-4 animate-spin" />}
              {cancelling ? "Cancelando cita…" : "Confirmar cancelación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
