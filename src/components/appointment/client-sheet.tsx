"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useAppStore } from "@/lib/store";
import { ClientDetailBody, type ClientContext } from "./client-detail-body";
import { toast } from "sonner";

export function ClientSheet({
  context,
  onOpenChange,
}: {
  context: ClientContext | null;
  onOpenChange: (open: boolean) => void;
}) {
  const removeAppointment = useAppStore((s) => s.removeAppointment);
  const open = context !== null;

  function handleCancel() {
    if (!context?.appointment) return;
    removeAppointment(context.appointment.id);
    toast(`Cita cancelada · ${context.dog.name}`);
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="sm:max-w-md sm:mx-auto">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Ficha del cliente</DrawerTitle>
        </DrawerHeader>
        {context && (
          <div
            className="px-5 pt-1 overflow-y-auto overscroll-contain"
            style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}
          >
            <ClientDetailBody context={context} onCancel={handleCancel} />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
