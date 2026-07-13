"use client";

import { cn } from "@/lib/utils";
import { minToLabel } from "@/lib/time";

export function TimeGridPicker({
  baseMin,
  options,
  selected,
  onSelect,
  trailing,
}: {
  baseMin: number;
  options: number[];
  selected: number;
  onSelect: (offset: number) => void;
  /** Optional extra cell appended after the generated options — same grid,
   * same button style, for a caller-provided action (e.g. a custom-time
   * toggle). Omit to leave this component's own behavior untouched. */
  trailing?: { label: string; active: boolean; onClick: () => void };
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
      {trailing && (
        <button
          type="button"
          onClick={trailing.onClick}
          className={cn(
            "tabular h-11 rounded-xl text-[14px] font-medium transition-colors duration-150 active:scale-[0.96]",
            trailing.active
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground/80 active:bg-accent"
          )}
        >
          {trailing.label}
        </button>
      )}
    </div>
  );
}
