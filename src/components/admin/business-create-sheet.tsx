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
import { createBusinessInSheet } from "@/lib/data";
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

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNegocio("");
      setUsuario("");
      setWebsiteUrl("");
    }
  }

  const canSave = negocio.trim().length > 0 && usuario.trim().length > 0;

  async function handleCreate() {
    if (!canSave) return;
    setSaving(true);
    const ok = await createBusinessInSheet({
      negocio: negocio.trim(),
      usuario: usuario.trim(),
      websiteUrl: websiteUrl.trim(),
    });
    setSaving(false);
    if (ok) {
      toast.success("Negocio creado");
      onCreated();
      onOpenChange(false);
    } else {
      toast.error("No se pudo crear", {
        description: "Revisa tu conexión, o puede que ya exista ese negocio/usuario",
      });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col sm:max-w-md sm:mx-auto overflow-hidden">
        <DrawerHeader className="safe-top text-left pb-3 shrink-0">
          <div className="pt-5">
            <DrawerTitle className="text-[20px] font-semibold tracking-tight">
              Añadir negocio
            </DrawerTitle>
            <p className="text-[13px] text-muted-foreground mt-1">
              El negocio configurará sus propios servicios y horarios al iniciar sesión
            </p>
          </div>
        </DrawerHeader>

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
              "w-full rounded-2xl text-[16px] font-semibold transition-all duration-150 active:scale-[0.985]",
              canSave
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground",
              saving && "opacity-60"
            )}
            style={{ height: 52 }}
          >
            {saving ? "Creando…" : "Crear negocio"}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
