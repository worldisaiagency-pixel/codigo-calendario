"use client";

import { useState } from "react";
import { Check, Copy, Loader2Icon } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createBusinessInSheet } from "@/lib/data";
import { bookingUrl, bookingEmbedSnippet } from "@/lib/booking-link";
import { toast } from "sonner";

export function BusinessCreateSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [negocio, setNegocio] = useState("");
  const [usuario, setUsuario] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ name: string; username: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNegocio("");
      setUsuario("");
      setWebsiteUrl("");
      setCreated(null);
    }
  }

  const canSave = negocio.trim().length > 0 && usuario.trim().length > 0;

  async function handleCreate() {
    if (!canSave || saving) return;
    setSaving(true);
    const name = negocio.trim();
    const username = usuario.trim();
    const ok = await createBusinessInSheet({
      negocio: name,
      usuario: username,
      websiteUrl: websiteUrl.trim(),
    });
    setSaving(false);
    if (ok) {
      onCreated();
      setCreated({ name, username });
    } else {
      toast.error("No se pudo crear", {
        description: "Revisa tu conexión, o puede que ya exista ese negocio/usuario",
      });
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(bookingUrl(created));
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      // Clipboard permission denied/unavailable.
    }
  }

  async function copySnippet() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(bookingEmbedSnippet(created));
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 1500);
    } catch {
      // Clipboard permission denied/unavailable.
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
            <DrawerTitle className="text-[20px] font-semibold tracking-tight">
              {created ? "Negocio creado" : "Añadir negocio"}
            </DrawerTitle>
            <p className="text-[13px] text-muted-foreground mt-1">
              {created
                ? "Enlace y código de reserva listos para esta web"
                : "El negocio configurará sus propios servicios y horarios al iniciar sesión"}
            </p>
          </div>
        </DrawerHeader>

        {created ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
              <div className="rounded-2xl bg-secondary overflow-hidden divide-y divide-border/60">
                <button
                  type="button"
                  onClick={copyLink}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-accent transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">Enlace de reserva</div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      {bookingUrl(created)}
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
            <div
              className="shrink-0 px-4 pt-3 border-t border-border/60 bg-popover"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full rounded-2xl text-[16px] font-semibold bg-primary text-primary-foreground transition-all duration-150 active:scale-[0.985]"
                style={{ height: 52 }}
              >
                Listo
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
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
            </div>

            <div
              className="shrink-0 px-4 pt-3 border-t border-border/60 bg-popover"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              <button
                type="button"
                onClick={handleCreate}
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
                {saving ? "Creando…" : "Crear negocio"}
              </button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
