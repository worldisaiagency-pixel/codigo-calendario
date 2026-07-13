"use client";

import { useState } from "react";
import { Check, Copy, Loader2Icon } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { updateBusinessIdentity, deleteBusinessFromSheet } from "@/lib/data";
import type { Business } from "@/lib/data";
import { bookingUrl, bookingEmbedSnippet } from "@/lib/booking-link";
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

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
    if (!business || !canSave || saving) return;
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

  async function copyLink() {
    if (!business) return;
    try {
      await navigator.clipboard.writeText(bookingUrl(business));
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      // Clipboard permission denied/unavailable.
    }
  }

  async function copySnippet() {
    if (!business) return;
    try {
      await navigator.clipboard.writeText(bookingEmbedSnippet(business));
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 1500);
    } catch {
      // Clipboard permission denied/unavailable.
    }
  }

  async function handleDelete() {
    if (!business || saving) return;
    setSaving(true);
    const ok = await deleteBusinessFromSheet({
      negocio: business.name,
      usuario: business.username,
    });
    setSaving(false);
    if (ok) {
      toast.success("Negocio eliminado");
      setConfirmingDelete(false);
      onDeleted();
      onOpenChange(false);
    } else {
      toast.error("No se pudo eliminar", {
        description: "Revisa tu conexión e inténtalo de nuevo",
      });
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
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

          {business && (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
                Reserva online
              </div>
              <div className="rounded-2xl bg-secondary overflow-hidden divide-y divide-border/60">
                <button
                  type="button"
                  onClick={copyLink}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-accent transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">Enlace de reserva</div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      {bookingUrl(business)}
                    </div>
                  </div>
                  {copiedLink ? (
                    <Check className="size-4 shrink-0 text-slot-free" strokeWidth={2.25} />
                  ) : (
                    <Copy className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={copySnippet}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-accent transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">Código para su web</div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      Pégalo una vez en su sitio y aparece un botón conectado
                    </div>
                  </div>
                  {copiedSnippet ? (
                    <Check className="size-4 shrink-0 text-slot-free" strokeWidth={2.25} />
                  ) : (
                    <Copy className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={saving}
            className="w-full rounded-2xl py-3 text-[14px] font-medium transition-colors duration-150 active:scale-[0.98] bg-slot-alert-tint text-slot-alert"
          >
            Eliminar negocio
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
              "w-full flex items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold transition-all duration-150 active:scale-[0.985]",
              canSave
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground",
              saving && "opacity-60"
            )}
            style={{ height: 52 }}
          >
            {saving && <Loader2Icon className="size-4 animate-spin" />}
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </DrawerContent>

      <Dialog
        open={confirmingDelete}
        onOpenChange={(next) => {
          if (saving) return;
          setConfirmingDelete(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar {business?.name}?</DialogTitle>
            <DialogDescription>
              Se eliminará su configuración (servicios, horarios, vacaciones, plantillas) de la
              hoja. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={saving} onClick={handleDelete}>
              {saving && <Loader2Icon className="size-4 animate-spin" />}
              {saving ? "Eliminando…" : "Eliminar negocio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Drawer>
  );
}
