"use client";

import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { durationLabel, minToLabel } from "@/lib/time";
import { minutesToPx } from "@/lib/scale";
import type { RailBlock } from "@/lib/types";

type BlockedBlock = Extract<RailBlock, { kind: "blocked" }>;

/** A spontaneous schedule-override block (see business-menu-sheet) — occupies
 * rail space like an appointment but isn't tappable here; it's managed from
 * the business menu's "horario temporal" list. */
export function BlockedSlotBlock({ block }: { block: BlockedBlock }) {
  const heightPx = minutesToPx(block.durationMin);
  const tiny = heightPx < 44;
  const large = heightPx >= 90;

  return (
    <div
      style={{ height: heightPx }}
      className={cn(
        "relative w-full rounded-2xl bg-slot-alert-tint",
        "flex items-center gap-2.5 px-4"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-slot-alert/12 text-slot-alert shrink-0",
          tiny ? "size-5" : "size-7"
        )}
      >
        <Ban className={tiny ? "size-3" : "size-4"} strokeWidth={2.25} />
      </span>
      {!tiny && (
        <div className="min-w-0 text-left">
          <div className="text-[13.5px] font-medium text-slot-alert leading-tight">
            {block.note || "Bloqueado"}
          </div>
          {large && (
            <div className="tabular text-[12px] text-slot-alert/70 leading-tight">
              {minToLabel(block.startMin)}-{minToLabel(block.startMin + block.durationMin)} ·{" "}
              {durationLabel(block.durationMin)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
