"use client";

import { Bell, BellOff, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function TopBar({
  onSearchClick,
  notificationsEnabled,
  onToggleNotifications,
}: {
  onSearchClick: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
}) {
  return (
    <header className="safe-top flex items-center justify-between px-4 pt-3 pb-1">
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold tracking-tight">Agenda</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleNotifications}
          aria-label={
            notificationsEnabled ? "Desactivar recordatorios" : "Activar recordatorios"
          }
          aria-pressed={notificationsEnabled}
          className={cn(
            "flex size-9 items-center justify-center rounded-full transition-colors duration-150 active:bg-accent",
            notificationsEnabled ? "text-slot-free" : "text-muted-foreground"
          )}
        >
          {notificationsEnabled ? (
            <Bell className="size-[18px]" strokeWidth={2} />
          ) : (
            <BellOff className="size-[18px]" strokeWidth={2} />
          )}
        </button>
        <button
          type="button"
          onClick={onSearchClick}
          aria-label="Buscar cliente o perro"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 active:bg-accent"
        >
          <Search className="size-[19px]" strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
