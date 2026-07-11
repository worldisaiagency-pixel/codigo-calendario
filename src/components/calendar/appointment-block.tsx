"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { minToLabel, relativeTimeUntil } from "@/lib/time";
import { minutesToPx } from "@/lib/scale";
import type { RailBlock } from "@/lib/types";

type BusyBlock = Extract<RailBlock, { kind: "busy" }>;

export function AppointmentBlock({
  block,
  onTap,
}: {
  block: BusyBlock;
  onTap: () => void;
}) {
  const heightPx = minutesToPx(block.durationMin);
  const compact = heightPx < 64;
  const hasAlert = Boolean(block.dog.behaviorNote);

  return (
    <button
      type="button"
      onClick={onTap}
      style={{ height: heightPx }}
      className={cn(
        "group relative w-full text-left rounded-2xl px-4 transition-transform duration-150 ease-out active:scale-[0.98]",
        "flex flex-col justify-center gap-0.5 overflow-hidden",
        block.isNext
          ? "bg-slot-next-tint active:brightness-95"
          : "bg-card shadow-[var(--shadow)] active:bg-accent/60"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 h-[60%] w-[3px] rounded-full",
          block.isNext ? "bg-slot-next" : "bg-slot-busy/25"
        )}
      />
      <div className="pl-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {block.isNext && !compact && (
            <div className="text-[11px] font-medium text-slot-next tabular mb-0.5">
              siguiente · {relativeTimeUntil(block.startMin)}
            </div>
          )}
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="tabular text-[13px] text-muted-foreground shrink-0">
              {minToLabel(block.startMin)}
            </span>
            <span className="font-semibold text-[15px] truncate">
              {block.dog.name}
            </span>
            <span className="text-[13px] text-muted-foreground truncate">
              {block.dog.breed}
            </span>
          </div>
          {!compact && (
            <div className="pl-[52px] text-[13px] text-muted-foreground truncate">
              {block.appointment.service}
            </div>
          )}
        </div>
        {hasAlert && (
          <AlertTriangle
            className="size-4 text-slot-alert shrink-0 mt-0.5"
            strokeWidth={2}
          />
        )}
      </div>
    </button>
  );
}
