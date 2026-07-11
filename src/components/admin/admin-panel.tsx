"use client";

import { useEffect, useState } from "react";
import { ChevronRight, LogOut, Plus } from "lucide-react";
import { dataProvider } from "@/lib/data";
import type { Business } from "@/lib/data";
import { BusinessEditSheet } from "./business-edit-sheet";
import { BusinessCreateSheet } from "./business-create-sheet";

export function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Business | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    try {
      const list = await dataProvider.listBusinesses();
      setBusinesses(list);
      setError(null);
    } catch {
      setError("No se pudo conectar con la hoja de negocios");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount, same shape as use-auth.ts's restore()
    refresh();
  }, []);

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <header className="safe-top flex items-center gap-1 px-2 pt-4 pb-3">
        <button
          type="button"
          onClick={onLogout}
          aria-label="Cerrar sesión"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 active:bg-accent"
        >
          <LogOut className="size-[22px]" strokeWidth={2} />
        </button>
        <span className="flex-1 min-w-0 text-center text-[18px] font-semibold tracking-tight">
          Negocios
        </span>
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Añadir negocio"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 active:bg-accent"
        >
          <Plus className="size-[24px]" strokeWidth={2} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 flex flex-col gap-2">
        {error && <p className="px-1 text-[13.5px] text-destructive">{error}</p>}
        {businesses === null && !error && (
          <p className="px-1 text-[13.5px] text-muted-foreground">Cargando…</p>
        )}
        {businesses?.length === 0 && (
          <p className="px-1 text-[13.5px] text-muted-foreground">
            No hay negocios todavía — añade el primero con el botón +.
          </p>
        )}
        {businesses?.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setEditing(b)}
            className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3.5 text-left transition-colors duration-150 active:bg-accent"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium truncate">{b.name}</div>
              <div className="text-[12.5px] text-muted-foreground truncate">
                {b.username}
                {b.websiteUrl ? ` · ${b.websiteUrl}` : ""}
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          </button>
        ))}
      </div>

      <BusinessEditSheet
        business={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={refresh}
        onDeleted={refresh}
      />

      <BusinessCreateSheet open={creating} onOpenChange={setCreating} onCreated={refresh} />
    </div>
  );
}
