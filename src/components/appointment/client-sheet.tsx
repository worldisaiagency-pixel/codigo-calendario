"use client";

import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useAppStore } from "@/lib/store";
import { ClientDetailBody, type ClientContext } from "./client-detail-body";
import { NotifyClientsSheet, type NotifyRecipient } from "@/components/business/notify-clients-sheet";

/** Two steps in the same Drawer — "detail" then "notify" — mirroring
 * schedule-override-sheet.tsx's own step swap instead of opening a second,
 * stacked Drawer once the appointment is cancelled. */
type Step = "detail" | "notify";

export function ClientSheet({
  context,
  onOpenChange,
}: {
  context: ClientContext | null;
  onOpenChange: (open: boolean) => void;
}) {
  const business = useAppStore((s) => s.business);
  const open = context !== null;

  const [step, setStep] = useState<Step>("detail");
  const [cancelledRecipient, setCancelledRecipient] = useState<NotifyRecipient | null>(null);

  // Reset back to "detail" whenever a different client is opened (or this
  // one is reopened) — adjusting state during render keeps this synchronous.
  const [lastContext, setLastContext] = useState<ClientContext | null>(null);
  if (context !== lastContext) {
    setLastContext(context);
    if (context) {
      setStep("detail");
      setCancelledRecipient(null);
    }
  }

  function handleCancelled(recipient: NotifyRecipient) {
    setCancelledRecipient(recipient);
    setStep("notify");
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="sm:max-w-md sm:mx-auto">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Ficha del cliente</DrawerTitle>
        </DrawerHeader>
        {step === "detail" && context && (
          <div
            className="px-5 pt-1 overflow-y-auto overscroll-contain"
            style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}
          >
            <ClientDetailBody context={context} onCancelled={handleCancelled} />
          </div>
        )}
        {step === "notify" && cancelledRecipient && business && (
          <NotifyClientsSheet
            type="appointmentCancelled"
            business={business}
            recipients={[cancelledRecipient]}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}
