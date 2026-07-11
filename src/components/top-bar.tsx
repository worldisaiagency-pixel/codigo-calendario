"use client";

import { Bell, BellOff, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function TopBar({
  businessName,
  onOpenBusinessMenu,
  onSearchClick,
  notificationsEnabled,
  onToggleNotifications,
}: {
  businessName: string;
  onOpenBusinessMenu: () => void;
  onSearchClick: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
}) {
  return (
    <header className="safe-top flex items-center gap-1 px-2 pt-4 pb-3">
      <button
        type="button"
        onClick={onToggleNotifications}
        aria-label={
          notificationsEnabled ? "Desactivar recordatorios" : "Activar recordatorios"
        }
        aria-pressed={notificationsEnabled}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 active:bg-accent",
          notificationsEnabled ? "text-slot-free" : "text-muted-foreground"
        )}
      >
        {notificationsEnabled ? (
          <Bell className="size-[23px]" strokeWidth={2} />
        ) : (
          <BellOff className="size-[23px]" strokeWidth={2} />
        )}
      </button>

      <button
        type="button"
        onClick={onOpenBusinessMenu}
        className="flex-1 min-w-0 px-2 py-2 rounded-xl text-center transition-opacity duration-150 active:opacity-50"
      >
        <span className="block truncate text-[18px] font-semibold tracking-tight">
          {businessName}
        </span>
      </button>

      <button
        type="button"
        onClick={onSearchClick}
        aria-label="Buscar cliente o perro"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 active:bg-accent"
      >
        <Search className="size-[24px]" strokeWidth={2} />
      </button>
    </header>
  );
}
