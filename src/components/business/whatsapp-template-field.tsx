"use client";

import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import {
  applyWhatsAppTemplate,
  buildWhatsAppPreviewData,
  type WhatsAppTemplateDefinition,
} from "@/lib/whatsapp-template";

/** One editable template block inside ProfileSheet's "Plantillas de
 * WhatsApp" section — title, textarea, restore-default button and a live
 * preview. Rendered once per WHATSAPP_TEMPLATE_DEFINITIONS entry, so a
 * future template type needs no new component, just a new definition.
 * Contains no substitution logic of its own: the preview calls
 * applyWhatsAppTemplate, the exact same function the real WhatsApp message
 * uses (see notify-clients-sheet.tsx), so they can never drift apart. */
export function WhatsAppTemplateField({
  definition,
  value,
  onChange,
  businessName,
  reviewLink,
}: {
  definition: WhatsAppTemplateDefinition;
  value: string;
  onChange: (value: string) => void;
  businessName: string;
  reviewLink?: string;
}) {
  const preview = useMemo(
    () => applyWhatsAppTemplate(value, buildWhatsAppPreviewData(businessName, reviewLink)),
    [value, businessName, reviewLink]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-[13.5px] font-medium flex items-center gap-1.5">
          <span>{definition.emoji}</span>
          {definition.label}
        </div>
        <button
          type="button"
          onClick={() => onChange(definition.defaultTemplate)}
          className="flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground active:text-foreground transition-colors"
        >
          <RotateCcw className="size-3" strokeWidth={2} />
          Restaurar plantilla por defecto
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={definition.defaultTemplate}
        rows={8}
        className="w-full rounded-2xl bg-secondary px-4 py-3 text-[14px] leading-relaxed resize-y"
      />
      <div className="mt-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5 px-1">
          Vista previa
        </div>
        <div className="rounded-2xl bg-secondary/60 px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap break-words">
          {preview}
        </div>
      </div>
    </div>
  );
}
