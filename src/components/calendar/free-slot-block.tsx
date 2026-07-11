"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { durationLabel, minToLabel } from "@/lib/time";
import { minutesToPx, PX_PER_MIN } from "@/lib/scale";
import type { RailBlock } from "@/lib/types";

type FreeBlock = Extract<RailBlock, { kind: "free" }>;

// Booking still snaps to a 30-min grid (matches the picker inside the
// sheet), but the block itself renders as a single, uninterrupted shape —
// tapping anywhere in it books the exact time under your finger.
const TAP_STEP = 30;
const MIN_DURATION = 30;

export function FreeSlotBlock({
  block,
  onTap,
}: {
  block: FreeBlock;
  onTap: (preferredStartMin?: number) => void;
}) {
  const heightPx = minutesToPx(block.durationMin);
  const large = heightPx >= 90;
  const tiny = heightPx < 44;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetMin = (e.clientY - rect.top) / PX_PER_MIN;
    const maxOffset = Math.max(0, block.durationMin - MIN_DURATION);
    const snapped = Math.min(
      Math.max(Math.round(offsetMin / TAP_STEP) * TAP_STEP, 0),
      maxOffset
    );
    onTap(block.startMin + snapped);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{ height: heightPx }}
      className={cn(
        "group relative w-full rounded-2xl transition-transform duration-150 ease-out active:scale-[0.98]",
        "bg-slot-free-tint active:bg-slot-free/[0.14]",
        "flex items-center justify-between px-4"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-slot-free/12 text-slot-free shrink-0 transition-transform group-active:scale-90",
            tiny ? "size-5" : "size-7"
          )}
        >
          <Plus className={tiny ? "size-3" : "size-4"} strokeWidth={2.25} />
        </span>
        {!tiny && (
          <div className="min-w-0 text-left">
            <div className="text-[13.5px] font-medium text-slot-free leading-tight">
              Hueco libre
            </div>
            {large && (
              <div className="tabular text-[12px] text-slot-free/70 leading-tight">
                {minToLabel(block.startMin)}-{minToLabel(block.startMin + block.durationMin)} ·{" "}
                {durationLabel(block.durationMin)}
              </div>
            )}
          </div>
        )}
      </div>
      {!large && !tiny && (
        <span className="tabular text-[12px] text-slot-free/70 shrink-0">
          {durationLabel(block.durationMin)}
        </span>
      )}
    </button>
  );
}
