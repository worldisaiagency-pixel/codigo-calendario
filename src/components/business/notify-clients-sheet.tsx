"use client";

import type { ReactNode } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { formatDayHeading, minToLabel, parseDateKey } from "@/lib/time";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import {
  applyWhatsAppTemplate,
  resolveWhatsAppTemplate,
  type WhatsAppTemplateType,
} from "@/lib/whatsapp-template";
import type { Business } from "@/lib/data";
import type { Appointment, Dog, Owner } from "@/lib/types";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatApptDate(appointment: Appointment): string {
  const { weekday, day, month } = formatDayHeading(parseDateKey(appointment.date));
  return `${capitalize(weekday)} ${day} ${capitalize(month)}`;
}

/** Which WhatsApp template drives this notify step — see
 * src/lib/whatsapp-template.ts for the full registry. This component only
 * ever needs the "something just happened to an appointment" subset of it;
 * reusing WhatsAppTemplateType instead of a parallel union keeps the two in
 * sync automatically. Adding a future type (e.g. "appointmentReminder") is
 * one more entry in this Extract<> and one more NOTIFY_DEFINITIONS entry
 * below — nothing else in this file changes. */
export type NotifyClientsType = Extract<
  WhatsAppTemplateType,
  "appointmentChanged" | "appointmentCancelled" | "appointmentConfirmed"
>;

export interface NotifyRecipient {
  /** For "appointmentChanged" and "appointmentConfirmed" this is the
   * appointment as it now stands (a reschedule's NEW date/startMin — see
   * schedule-override-sheet.tsx's mapping from RebookMove — or a freshly
   * created appointment's own date/startMin); for "appointmentCancelled"
   * it's the cancelled appointment as it was right before removal. Its own
   * `date`/`startMin` are what {fecha}/{hora}/{fecha_hora} resolve to. */
  appointment: Appointment;
  dog: Dog;
  owner: Owner;
}

/** One entry per NotifyClientsType — header copy and each card's own "what
 * happened" summary, all in one place instead of branching inline in the
 * JSX below. A future notification type means one more entry here, not a
 * new conditional. */
const NOTIFY_DEFINITIONS: Record<
  NotifyClientsType,
  { title: string; subtitle: string; renderDetails: (r: NotifyRecipient) => ReactNode }
> = {
  appointmentChanged: {
    title: "Cambios aplicados correctamente",
    subtitle: "Puedes avisar a los clientes afectados mediante WhatsApp.",
    renderDetails: (r) => (
      <>
        <div className="text-[14px] font-medium truncate">{r.owner.name}</div>
        <div className="text-[12.5px] text-muted-foreground truncate">{r.dog.name}</div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mt-2">
          Nueva cita
        </div>
        <div className="tabular text-[13px] font-medium mt-0.5">
          {formatApptDate(r.appointment)}
          <span className="text-muted-foreground font-normal"> · {minToLabel(r.appointment.startMin)}</span>
        </div>
      </>
    ),
  },
  appointmentCancelled: {
    title: "Cita cancelada correctamente",
    subtitle: "Puedes avisar al cliente mediante WhatsApp si lo deseas.",
    renderDetails: (r) => (
      <>
        <div className="text-[14px] font-medium truncate">{r.dog.name}</div>
        <div className="text-[12.5px] text-muted-foreground truncate mt-2">
          Cliente: <span className="text-foreground/80">{r.owner.name}</span>
        </div>
        <div className="text-[12.5px] text-muted-foreground truncate">
          Servicio: <span className="text-foreground/80">{r.appointment.service}</span>
        </div>
        <div className="text-[12px] text-slot-alert mt-1.5">La cita ha sido cancelada.</div>
      </>
    ),
  },
  appointmentConfirmed: {
    title: "Cita creada correctamente",
    subtitle: "Puedes enviar la confirmación al cliente mediante WhatsApp.",
    renderDetails: (r) => (
      <>
        <div className="text-[14px] font-medium truncate">{r.owner.name}</div>
        <div className="text-[12.5px] text-muted-foreground truncate">{r.dog.name}</div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mt-2">
          Cita confirmada
        </div>
        <div className="tabular text-[13px] font-medium mt-0.5">
          {formatApptDate(r.appointment)}
          <span className="text-muted-foreground font-normal"> · {minToLabel(r.appointment.startMin)}</span>
        </div>
      </>
    ),
  },
};

/** Content-only — rendered inside the parent's own Drawer as the final
 * "step" (schedule-override-sheet.tsx for reschedules, client-detail-body.tsx
 * for cancellations, new-appointment-sheet.tsx for new bookings), never a
 * standalone sheet. Opens a wa.me link per client with the message
 * pre-filled from that business's own WhatsApp template for `type`; nothing
 * is ever sent automatically — the business still taps "Send" inside
 * WhatsApp itself. One component, one template infrastructure, one wa.me
 * link builder for every notification type — only NOTIFY_DEFINITIONS above
 * differs by `type`. */
export function NotifyClientsSheet({
  type,
  business,
  recipients,
  onDone,
}: {
  type: NotifyClientsType;
  business: Business;
  recipients: NotifyRecipient[];
  onDone: () => void;
}) {
  function openWhatsApp(recipient: NotifyRecipient) {
    if (!recipient.owner.phone) return;
    const template = resolveWhatsAppTemplate(business.whatsappTemplates, type);
    const message = applyWhatsAppTemplate(template, {
      clientName: recipient.owner.name,
      dogName: recipient.dog.name,
      service: recipient.appointment.service,
      phone: recipient.owner.phone,
      businessName: business.name,
      date: recipient.appointment.date,
      startMin: recipient.appointment.startMin,
    });
    window.open(buildWhatsAppLink(recipient.owner.phone, message), "_blank");
  }

  const def = NOTIFY_DEFINITIONS[type];

  return (
    <>
      <DrawerHeader className="safe-top text-left pb-3 shrink-0">
        <div className="pt-5 flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slot-free-tint text-slot-free">
            <CheckCircle2 className="size-[18px]" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <DrawerTitle className="text-[20px] font-semibold tracking-tight">
              {def.title}
            </DrawerTitle>
            <p className="text-[13px] text-muted-foreground mt-0.5">{def.subtitle}</p>
          </div>
        </div>
      </DrawerHeader>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-2">
        {recipients.map((r) => (
          <div
            key={r.appointment.id}
            className="rounded-2xl bg-secondary px-4 py-3 flex items-center gap-3"
          >
            <div className="min-w-0 flex-1">{def.renderDetails(r)}</div>
            <button
              type="button"
              onClick={() => openWhatsApp(r)}
              disabled={!r.owner.phone}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-slot-free/12 text-slot-free px-3.5 py-2.5 text-[13px] font-medium active:bg-slot-free/20 transition-colors disabled:opacity-40"
            >
              <MessageCircle className="size-[15px]" strokeWidth={2} />
              WhatsApp
            </button>
          </div>
        ))}
      </div>

      <div
        className="shrink-0 px-4 pt-3 border-t border-border/60 bg-popover"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={onDone}
          className="w-full rounded-2xl text-[16px] font-semibold bg-primary text-primary-foreground transition-all duration-150 active:scale-[0.985]"
          style={{ height: 52 }}
        >
          Listo
        </button>
      </div>
    </>
  );
}
