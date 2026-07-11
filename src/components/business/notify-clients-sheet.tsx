"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { formatDayHeading, minToLabel, parseDateKey } from "@/lib/time";
import type { RebookMove } from "@/lib/rebooking";

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

function messageFor(move: RebookMove): string {
  const to = formatDayHeading(parseDateKey(move.toDate));
  return `Hola! Te escribo porque hemos tenido que mover la cita de ${move.dog.name}. Ahora es el ${to.weekday} ${to.day} a las ${minToLabel(move.toStartMin)}. ¡Gracias por tu comprensión!`;
}

/** Content-only — rendered inside the parent ScheduleOverrideSheet's own
 * Drawer as the final "step", not a standalone sheet. */
export function NotifyClientsSheet({
  moves,
  onDone,
}: {
  moves: RebookMove[];
  onDone: () => void;
}) {
  const [copiedPhones, setCopiedPhones] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  async function copyAllPhones() {
    const phones = moves
      .map((m) => m.owner.phone)
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(phones);
      setCopiedPhones(true);
      setTimeout(() => setCopiedPhones(false), 1500);
    } catch {
      // Clipboard permission denied/unavailable — nothing to recover to,
      // the button simply stays in its normal state.
    }
  }

  async function copyMessage(move: RebookMove) {
    try {
      await navigator.clipboard.writeText(messageFor(move));
      setCopiedMessageId(move.appointment.id);
      setTimeout(() => setCopiedMessageId(null), 1500);
    } catch {
      // Clipboard permission denied/unavailable.
    }
  }

  function openWhatsApp(move: RebookMove) {
    const digits = digitsOnly(move.owner.phone);
    if (!digits) return;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(messageFor(move))}`;
    window.open(url, "_blank");
  }

  return (
    <>
      <DrawerHeader className="safe-top text-left pb-3 shrink-0">
        <div className="pt-5">
          <DrawerTitle className="text-[20px] font-semibold tracking-tight">
            Avisa a estos clientes
          </DrawerTitle>
          <p className="text-[13px] text-muted-foreground mt-1">
            Su cita se ha movido — avísales del cambio
          </p>
        </div>
      </DrawerHeader>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={copyAllPhones}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-[14px] font-medium active:bg-accent transition-colors"
        >
          {copiedPhones ? (
            <Check className="size-4 text-slot-free" />
          ) : (
            <Copy className="size-4" />
          )}
          {copiedPhones ? "Teléfonos copiados" : "Copiar todos los teléfonos"}
        </button>

        <div className="flex flex-col gap-2 mt-1">
          {moves.map((m) => {
            const from = formatDayHeading(parseDateKey(m.fromDate));
            const to = formatDayHeading(parseDateKey(m.toDate));
            return (
              <div
                key={m.appointment.id}
                className="rounded-2xl bg-secondary px-4 py-3 flex flex-col gap-2"
              >
                <div>
                  <div className="text-[14px] font-medium">
                    {m.owner.name} · {m.dog.name}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">
                    {m.owner.phone || "Sin teléfono"}
                  </div>
                  <div className="tabular text-[12.5px] text-muted-foreground mt-0.5">
                    {minToLabel(m.fromStartMin)} ({from.day} {from.month}) →{" "}
                    {minToLabel(m.toStartMin)} ({to.day} {to.month})
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyMessage(m)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-background py-2 text-[12.5px] font-medium active:bg-accent transition-colors"
                  >
                    {copiedMessageId === m.appointment.id ? (
                      <Check className="size-3.5 text-slot-free" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    Mensaje
                  </button>
                  <button
                    type="button"
                    onClick={() => openWhatsApp(m)}
                    disabled={!m.owner.phone}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slot-free/12 text-slot-free py-2 text-[12.5px] font-medium active:bg-slot-free/20 transition-colors disabled:opacity-40"
                  >
                    <MessageCircle className="size-3.5" />
                    WhatsApp
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
