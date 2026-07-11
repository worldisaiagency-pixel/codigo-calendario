"use client";

import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { updateBusinessIdentity, deleteBusinessFromSheet } from "@/lib/data";
import type { Business } from "@/lib/data";
import { toast } from "sonner";

export function BusinessEditSheet({
  business,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  business: Business | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const open = business !== null;

  const [negocio, setNegocio] = useState("");
  const [usuario, setUsuario] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Reset every time a (different) business is opened for editing —
  // adjusting state during render keeps this synchronous. Both sides must
  // be the same type (string | null) or this never converges: business?.id
  // is `undefined` (not `null`) when business is null, and `undefined !==
  // null` is always true, which caused an infinite render loop here before.
  const currentId = business?.id ?? null;
  const [lastId, setLastId] = useState<string | null>(null);
  if (currentId !== lastId) {
    setLastId(currentId);
    if (business) {
      setNegocio(business.name);
      setUsuario(business.username);
      setWebsiteUrl(business.websiteUrl);
      setConfirmingDelete(false);
    }
  }

  const canSave = negocio.trim().length > 0 && usuario.trim().length > 0;

  async function handleSave() {
    if (!business || !canSave) return;
    setSaving(true);
    const ok = await updateBusinessIdentity({
      oldNegocio: business.name,
      oldUsuario: business.username,
      negocio: negocio.trim(),
      usuario: usuario.trim(),
      websiteUrl: websiteUrl.trim(),
    });
    setSaving(false);
    if (ok) {
      toast.success("Negocio actualizado");
      onSaved();
      onOpenChange(false);
    } else {
      toast.error("No se pudo guardar en la hoja", {
        description: "Revisa tu conexión e inténtalo de nuevo",
      });
    }
  }

  async function handleDelete() {
    if (!business) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setSaving(true);
    const ok = await deleteBusinessFromSheet({
      negocio: business.name,
      usuario: business.username,
    });
    setSaving(false);
    if (ok) {
      toast.success("Negocio eliminado");
      onDeleted();
      onOpenChange(false);
    } else {
      toast.error("No se pudo eliminar", {
        description: "Revisa tu conexión e inténtalo de nuevo",
      });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col sm:max-w-md sm:mx-auto overflow-hidden">
        <DrawerHeader className="safe-top text-left pb-3 shrink-0">
          <div className="pt-5">
            <DrawerTitle className="text-[20px] font-semibold tracking-tight truncate">
              Editar negocio
            </DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-4">
          <div className="rounded-2xl bg-secondary overflow-hidden divide-y divide-border/60">
            <Input
              value={negocio}
              onChange={(e) => setNegocio(e.target.value)}
              placeholder="Negocio"
              className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
              autoComplete="off"
            />
            <Input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Usuario"
              className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
              autoComplete="off"
            />
            <Input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="Link de la página web"
              className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
              autoComplete="off"
              inputMode="url"
            />
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className={cn(
              "w-full rounded-2xl py-3 text-[14px] font-medium transition-colors duration-150 active:scale-[0.98]",
              confirmingDelete
                ? "bg-destructive text-white"
                : "bg-slot-alert-tint text-slot-alert"
            )}
          >
            {confirmingDelete ? "¿Seguro? Toca de nuevo para eliminar" : "Eliminar negocio"}
          </button>
        </div>

        <div
          className="shrink-0 px-4 pt-3 border-t border-border/60 bg-popover"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className={cn(
              "w-full rounded-2xl text-[16px] font-semibold transition-all duration-150 active:scale-[0.985]",
              canSave
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground",
              saving && "opacity-60"
            )}
            style={{ height: 52 }}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
