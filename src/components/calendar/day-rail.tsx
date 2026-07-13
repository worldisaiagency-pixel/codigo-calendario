"use client";

import { useEffect, useMemo, useRef } from "react";
import { AppointmentBlock } from "./appointment-block";
import { FreeSlotBlock } from "./free-slot-block";
import { BlockedSlotBlock } from "./blocked-slot-block";
import { NowLine } from "./now-line";
import { nowMinutes } from "@/lib/time";
import { minuteOffsetInRail, railLayout } from "@/lib/scale";
import type { RailBlock } from "@/lib/types";
import type { DaySchedule } from "@/lib/data";

export function DayRail({
  blocks,
  schedule,
  isToday,
  onFreeTap,
  onApptTap,
}: {
  blocks: RailBlock[];
  schedule: DaySchedule | null;
  isToday: boolean;
  onFreeTap: (block: Extract<RailBlock, { kind: "free" }>, preferredStartMin?: number) => void;
  onApptTap: (block: Extract<RailBlock, { kind: "busy" }>) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drop the non-interactive "closed" filler blocks buildRail pads the full
  // day with — the rail only needs to render the business's effective
  // working range (already resolved into `blocks` upstream via
  // resolveDay/buildRail), so this is purely a render-layer trim, same
  // pattern week-view.tsx already uses for its per-day summary bar.
  const visibleBlocks = useMemo(() => blocks.filter((b) => b.kind !== "closed"), [blocks]);

  const { tops, totalHeight } = useMemo(() => railLayout(visibleBlocks), [visibleBlocks]);

  const hourMarks = useMemo(() => {
    const marks: { label: string; top: number }[] = [];
    if (!schedule || visibleBlocks.length === 0) return marks;
    const start = visibleBlocks[0].startMin;
    const last = visibleBlocks[visibleBlocks.length - 1];
    const end = last.startMin + last.durationMin;
    for (let m = Math.ceil(start / 60) * 60; m <= end; m += 60) {
      const top = minuteOffsetInRail(visibleBlocks, tops, m);
      if (top !== null) {
        marks.push({ label: String(Math.floor(m / 60)).padStart(2, "0"), top });
      }
    }
    return marks;
  }, [visibleBlocks, tops, schedule]);

  const now = nowMinutes();
  const nowTop = isToday ? minuteOffsetInRail(visibleBlocks, tops, now) : null;

  useEffect(() => {
    if (!isToday || nowTop === null || !scrollRef.current) return;
    const target = Math.max(nowTop - 160, 0);
    scrollRef.current.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday]);

  if (visibleBlocks.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-[15px] font-medium text-foreground">
          Día sin huecos que mostrar
        </p>
        <p className="text-[13px] text-muted-foreground max-w-[26ch]">
          Fuera del horario de trabajo, o completamente libre.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar px-4 pb-28"
    >
      <div className="relative flex" style={{ height: totalHeight }}>
        <div className="relative w-8 shrink-0 select-none">
          {hourMarks.map((mark) => (
            <span
              key={mark.label}
              style={{ top: mark.top }}
              className="tabular absolute -translate-y-1/2 text-[11px] text-muted-foreground/45"
            >
              {mark.label}
            </span>
          ))}
        </div>

        <div className="relative flex-1 flex flex-col gap-1.5">
          {visibleBlocks.map((block, i) => {
            if (block.kind === "busy") {
              return (
                <AppointmentBlock
                  key={block.appointment.id}
                  block={block}
                  onTap={() => onApptTap(block)}
                />
              );
            }
            if (block.kind === "blocked") {
              return <BlockedSlotBlock key={`blocked-${i}-${block.startMin}`} block={block} />;
            }
            return (
              <FreeSlotBlock
                key={`free-${i}-${block.startMin}`}
                block={block}
                onTap={(preferredStartMin) => onFreeTap(block, preferredStartMin)}
              />
            );
          })}

          {isToday && nowTop !== null && <NowLine top={nowTop} />}
        </div>
      </div>
    </div>
  );
}
