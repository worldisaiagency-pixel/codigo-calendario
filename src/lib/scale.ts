import type { RailBlock } from "./types";

export const PX_PER_MIN = 1.55;
export const RAIL_GAP_PX = 6;

export function minutesToPx(min: number): number {
  return min * PX_PER_MIN;
}

/** Cumulative pixel top for a given block index, and total rail height, accounting for gaps between blocks. */
export function railLayout(blocks: RailBlock[]) {
  const tops: number[] = [];
  let cursor = 0;
  blocks.forEach((block, i) => {
    tops.push(cursor);
    cursor += minutesToPx(block.durationMin);
    if (i < blocks.length - 1) cursor += RAIL_GAP_PX;
  });
  return { tops, totalHeight: cursor };
}

/** Pixel offset for an absolute minute-of-day value, interpolating within/across blocks + gaps. */
export function minuteOffsetInRail(
  blocks: RailBlock[],
  tops: number[],
  minute: number
): number | null {
  let cursorMin = blocks.length ? blocks[0].startMin : 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    cursorMin = block.startMin;
    const blockEndMin = cursorMin + block.durationMin;
    if (minute >= cursorMin && minute <= blockEndMin) {
      const ratio = (minute - cursorMin) / block.durationMin;
      return tops[i] + ratio * minutesToPx(block.durationMin);
    }
  }
  return null;
}
