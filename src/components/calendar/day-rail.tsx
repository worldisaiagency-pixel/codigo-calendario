"use client";

import { useEffect, useMemo, useRef } from "react";
import { AppointmentBlock } from "./appointment-block";
import { FreeSlotBlock } from "./free-slot-block";
import { NowLine } from "./now-line";
import { DAY_END_MIN, DAY_START_MIN, nowMinutes } from "@/lib/time";
import { minuteOffsetInRail, railLayout } from "@/lib/scale";
import type { RailBlock } from "@/lib/types";

export function DayRail({
  blocks,
  isToday,
  onFreeTap,
  onApptTap,
}: {
  blocks: RailBlock[];
  isToday: boolean;
  onFreeTap: (block: Extract<RailBlock, { kind: "free" }>, preferredStartMin?: number) => void;
  onApptTap: (block: Extract<RailBlock, { kind: "busy" }>) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { tops, totalHeight } = useMemo(() => railLayout(blocks), [blocks]);

  const hourMarks = useMemo(() => {
    const marks: { label: string; top: number }[] = [];
    for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 60) {
      const top = minuteOffsetInRail(blocks, tops, m);
      if (top !== null) {
        marks.push({ label: String(Math.floor(m / 60)).padStart(2, "0"), top });
      }
    }
    return marks;
  }, [blocks, tops]);

  const now = nowMinutes();
  const nowTop = isToday ? minuteOffsetInRail(blocks, tops, now) : null;

  useEffect(() => {
    if (!isToday || nowTop === null || !scrollRef.current) return;
    const target = Math.max(nowTop - 160, 0);
    scrollRef.current.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday]);

  if (blocks.length === 0) {
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
          {blocks.map((block, i) =>
            block.kind === "busy" ? (
              <AppointmentBlock
                key={block.appointment.id}
                block={block}
                onTap={() => onApptTap(block)}
              />
            ) : (
              <FreeSlotBlock
                key={`free-${i}-${block.startMin}`}
                block={block}
                onTap={(preferredStartMin) => onFreeTap(block, preferredStartMin)}
              />
            )
          )}

          {isToday && nowTop !== null && <NowLine top={nowTop} />}
        </div>
      </div>
    </div>
  );
}
