"use client";

import { cn } from "@/lib/utils";
import { minToLabel } from "@/lib/time";

export function TimeGridPicker({
  baseMin,
  options,
  selected,
  onSelect,
}: {
  baseMin: number;
  options: number[];
  selected: number;
  onSelect: (offset: number) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onSelect(o)}
          className={cn(
            "tabular h-11 rounded-xl text-[14px] font-medium transition-colors duration-150 active:scale-[0.96]",
            selected === o
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground/80 active:bg-accent"
          )}
        >
          {minToLabel(baseMin + o)}
        </button>
      ))}
    </div>
  );
}
