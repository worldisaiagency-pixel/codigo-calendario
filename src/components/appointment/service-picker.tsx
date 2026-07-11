"use client";

import { cn } from "@/lib/utils";
import { durationLabel } from "@/lib/time";
import type { BusinessService } from "@/lib/data";

export function ServicePicker({
  services,
  selected,
  onSelect,
}: {
  services: BusinessService[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {services.map((s) => (
        <button
          key={s.name}
          type="button"
          onClick={() => onSelect(s.name)}
          className={cn(
            "px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors duration-150 active:scale-[0.96]",
            selected === s.name
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground/80 active:bg-accent"
          )}
        >
          {s.name} · {durationLabel(s.durationMin)}
        </button>
      ))}
    </div>
  );
}
