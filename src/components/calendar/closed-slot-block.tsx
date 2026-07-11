"use client";

import { minutesToPx } from "@/lib/scale";
import type { RailBlock } from "@/lib/types";

type ClosedBlock = Extract<RailBlock, { kind: "closed" }>;

/** Fills the part of the day outside business hours — just visual context
 * for how the working window sits in the full day, not tappable. */
export function ClosedSlotBlock({ block }: { block: ClosedBlock }) {
  return (
    <div
      style={{ height: minutesToPx(block.durationMin) }}
      className="w-full rounded-2xl bg-muted/40"
    />
  );
}
