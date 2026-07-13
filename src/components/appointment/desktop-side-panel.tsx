"use client";

import { useState } from "react";
import { PawPrint } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useAppStore } from "@/lib/store";
import { ClientDetailBody, type ClientContext } from "./client-detail-body";
import { NotifyClientsSheet, type NotifyRecipient } from "@/components/business/notify-clients-sheet";

export function DesktopSidePanel({
  context,
  onCancelled,
}: {
  context: ClientContext | null;
  /** Called once the notify step is dismissed after a cancellation, so the
   * parent can clear its clientContext — otherwise this panel would keep
   * showing the now-defunct appointment underneath, unlike the mobile
   * ClientSheet, which already clears it via its own onOpenChange. */
  onCancelled?: () => void;
}) {
  const business = useAppStore((s) => s.business);
  // The side panel isn't itself a Drawer (it's a persistent layout column),
  // so unlike the mobile ClientSheet it can't just swap its own step — the
  // notify sheet opens as its own small floating Drawer instead, same
  // NotifyClientsSheet, same cancel flow (ClientDetailBody), no duplicated
  // confirm/loading/template logic either way.
  const [cancelledRecipient, setCancelledRecipient] = useState<NotifyRecipient | null>(null);

  return (
    <aside className="hidden lg:flex w-[340px] shrink-0 border-l border-border flex-col">
      <div className="px-5 pt-6 pb-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Panel de cliente
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pb-8 pt-2">
        {context ? (
          <div key={context.dog.id + (context.appointment?.id ?? "")} className="animate-in fade-in-0 duration-200">
            <ClientDetailBody context={context} onCancelled={setCancelledRecipient} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2.5 text-center px-4 animate-in fade-in-0 duration-200">
            <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <PawPrint className="size-[19px]" strokeWidth={1.75} />
            </span>
            <p className="text-[13px] text-muted-foreground max-w-[24ch]">
              Selecciona una cita para ver la ficha del perro
            </p>
          </div>
        )}
      </div>

      <Drawer
        open={cancelledRecipient !== null}
        onOpenChange={(next) => {
          if (next) return;
          setCancelledRecipient(null);
          onCancelled?.();
        }}
      >
        <DrawerContent className="flex flex-col sm:max-w-md sm:mx-auto overflow-hidden">
          {cancelledRecipient && business && (
            <NotifyClientsSheet
              type="appointmentCancelled"
              business={business}
              recipients={[cancelledRecipient]}
              onDone={() => {
                setCancelledRecipient(null);
                onCancelled?.();
              }}
            />
          )}
        </DrawerContent>
      </Drawer>
    </aside>
  );
}
