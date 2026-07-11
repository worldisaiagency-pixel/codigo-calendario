"use client";

import { PawPrint } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ClientDetailBody, type ClientContext } from "./client-detail-body";
import { toast } from "sonner";

export function DesktopSidePanel({ context }: { context: ClientContext | null }) {
  const removeAppointment = useAppStore((s) => s.removeAppointment);

  function handleCancel() {
    if (!context?.appointment) return;
    removeAppointment(context.appointment.id);
    toast(`Cita cancelada · ${context.dog.name}`);
  }

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
            <ClientDetailBody context={context} onCancel={handleCancel} />
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
    </aside>
  );
}
