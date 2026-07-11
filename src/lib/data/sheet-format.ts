import { WEEKDAYS } from "./types";
import type { BusinessService, DaySchedule, VacationRange, Weekday } from "./types";
import { durationLabel, minToLabel } from "../time";

const WEEKDAY_LABELS: Record<Weekday, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

/** "Nombre · Precio · Duración" — mirrors sheets-provider.ts's parseServiceLine. */
export function formatServiceLine(s: BusinessService): string {
  const parts = [s.name.trim()];
  if (s.priceLabel.trim()) parts.push(s.priceLabel.trim());
  parts.push(durationLabel(s.durationMin));
  return parts.join(" · ");
}

function sameSchedule(a: DaySchedule | null, b: DaySchedule | null): boolean {
  if (a === null && b === null) return true;
  if (!a || !b) return false;
  return a.open === b.open && a.close === b.close;
}

/** "Lunes a Viernes 9:00-19:00, Sábado 10:00-14:00, Domingo cerrado" —
 * mirrors sheets-provider.ts's parseHours, collapsing consecutive days that
 * share the same schedule into one range. */
export function formatHoursCompact(hours: Record<Weekday, DaySchedule | null>): string {
  const segments: string[] = [];
  let i = 0;
  while (i < WEEKDAYS.length) {
    const schedule = hours[WEEKDAYS[i]];
    let j = i;
    while (j + 1 < WEEKDAYS.length && sameSchedule(hours[WEEKDAYS[j + 1]], schedule)) j++;

    const startLabel = WEEKDAY_LABELS[WEEKDAYS[i]];
    const endLabel = WEEKDAY_LABELS[WEEKDAYS[j]];
    const range = i === j ? startLabel : `${startLabel} a ${endLabel}`;

    segments.push(
      schedule ? `${range} ${minToLabel(schedule.open)}-${minToLabel(schedule.close)}` : `${range} cerrado`
    );
    i = j + 1;
  }
  return segments.join(", ");
}

/** "dd/mm/yyyy - dd/mm/yyyy" — mirrors sheets-provider.ts's parseVacationLine. */
export function formatVacationLine(v: VacationRange): string {
  const toDmy = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  return `${toDmy(v.start)} - ${toDmy(v.end)}`;
}
