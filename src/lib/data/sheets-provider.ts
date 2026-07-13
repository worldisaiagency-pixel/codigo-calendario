import { parseCsv } from "./csv";
import { SHEET_GID, SHEET_ID } from "./config";
import { WEEKDAYS } from "./types";
import type {
  Business,
  BusinessService,
  DaySchedule,
  VacationRange,
  Weekday,
} from "./types";
import type { DataProvider } from "./provider";
import type { WhatsAppTemplateMap } from "../whatsapp-template";

/** Parses the WHATSAPP_TEMPLATE cell — a JSON-encoded { type: text } map
 * since the multi-template feature, but businesses that customized their
 * (then-only) template before that still have the raw prose text sitting in
 * that same cell. JSON.parse throws on that legacy text, so the catch
 * treats the whole cell as the old single "appointmentChanged" template —
 * exactly what it always meant before this feature existed. */
function parseWhatsAppTemplatesCell(raw: string): WhatsAppTemplateMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as WhatsAppTemplateMap;
    }
  } catch {
    // Not JSON — legacy single-template format, handled below.
  }
  return { appointmentChanged: raw };
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function slug(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Business blocks are stacked vertically in columns A (label) / B (value).
// A block starts at a NEGOCIO row and runs until the next one. A row with a
// blank label continues the previous field's value list — that's how
// multi-line fields (several services, several vacation ranges) get entered.
function groupBlocks(rows: string[][]): Map<string, string[]>[] {
  const blocks: Map<string, string[]>[] = [];
  let current: Map<string, string[]> | null = null;
  let lastLabel: string | null = null;

  for (const row of rows) {
    const label = (row[0] ?? "").trim().toUpperCase();
    const value = (row[1] ?? "").trim();

    if (label === "NEGOCIO") {
      current = new Map();
      blocks.push(current);
      lastLabel = label;
      if (value) current.set(label, [value]);
      continue;
    }

    if (!current) continue; // rows before the first NEGOCIO are ignored

    if (label) {
      lastLabel = label;
      const arr = current.get(label) ?? [];
      if (value) arr.push(value);
      current.set(label, arr);
    } else if (lastLabel && value) {
      const arr = current.get(lastLabel) ?? [];
      arr.push(value);
      current.set(lastLabel, arr);
    }
  }

  return blocks;
}

function parseDurationToken(token: string): number | null {
  const hMatch = token.match(/(\d+(?:[.,]\d+)?)\s*h/i);
  const minMatch = token.match(/(\d+)\s*m(?:in)?/i);
  let total = 0;
  let matched = false;
  if (hMatch) {
    total += parseFloat(hMatch[1].replace(",", ".")) * 60;
    matched = true;
  }
  if (minMatch) {
    total += parseInt(minMatch[1], 10);
    matched = true;
  }
  return matched ? Math.round(total) : null;
}

function parseServiceLine(line: string): BusinessService | null {
  const parts = line
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const name = parts[0];
  const durationPart = parts.find((p) => /\d/.test(p) && /(min|h)\b/i.test(p));
  const pricePart = parts.find((p) => p !== name && p !== durationPart);
  const durationMin = durationPart ? parseDurationToken(durationPart) : null;
  if (!name || durationMin == null) return null;

  return { name, priceLabel: pricePart ?? "", durationMin };
}

function emptyHours(): Record<Weekday, DaySchedule | null> {
  return {
    lunes: null,
    martes: null,
    miercoles: null,
    jueves: null,
    viernes: null,
    sabado: null,
    domingo: null,
  };
}

function parseHours(raw: string): Record<Weekday, DaySchedule | null> {
  const hours = emptyHours();
  if (!raw.trim()) return hours;

  const segments = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    const normalized = stripAccents(seg).toLowerCase();

    let days: Weekday[] = [];
    let rest = normalized;

    const rangeMatch = normalized.match(/^([a-z]+)\s+a\s+([a-z]+)\s+(.*)$/);
    if (rangeMatch) {
      const start = WEEKDAYS.indexOf(rangeMatch[1] as Weekday);
      const end = WEEKDAYS.indexOf(rangeMatch[2] as Weekday);
      if (start !== -1 && end !== -1 && start <= end) {
        days = WEEKDAYS.slice(start, end + 1);
        rest = rangeMatch[3];
      }
    }

    if (days.length === 0) {
      const singleMatch = normalized.match(/^([a-z]+)\s+(.*)$/);
      const day = singleMatch?.[1] as Weekday | undefined;
      if (day && WEEKDAYS.includes(day)) {
        days = [day];
        rest = singleMatch![2];
      }
    }

    if (days.length === 0) continue;

    if (/cerrado/.test(rest)) {
      for (const d of days) hours[d] = null;
      continue;
    }

    const timeMatch = rest.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!timeMatch) continue;
    const open = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
    const close = parseInt(timeMatch[3], 10) * 60 + parseInt(timeMatch[4], 10);
    for (const d of days) hours[d] = { open, close };
  }

  return hours;
}

function parseVacationLine(line: string): VacationRange[] {
  const matches = [...line.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
  if (matches.length === 0) return [];
  const toIso = (m: RegExpMatchArray) => `${m[3]}-${m[2]}-${m[1]}`;
  const start = toIso(matches[0]);
  const end = matches[1] ? toIso(matches[1]) : start;
  return [{ start, end }];
}

function toBusiness(block: Map<string, string[]>): Business | null {
  const negocio = block.get("NEGOCIO")?.[0]?.trim();
  const usuario = block.get("USUARIO")?.[0]?.trim();
  if (!negocio || !usuario) return null;

  const services = (block.get("SERVICIOS") ?? [])
    .map(parseServiceLine)
    .filter((s): s is BusinessService => s !== null);

  const hours = parseHours((block.get("HORARIOS") ?? []).join(", "));
  const vacations = (block.get("VACACIONES") ?? []).flatMap(parseVacationLine);
  const websiteUrl = (block.get("WEB") ?? [])[0]?.trim() ?? "";
  // Single cell (Sheets cells support embedded newlines natively, and
  // parseCsv already preserves them inside a quoted field) holding every
  // template type as one JSON object — see parseWhatsAppTemplatesCell.
  const whatsappTemplates = parseWhatsAppTemplatesCell(
    (block.get("WHATSAPP_TEMPLATE") ?? [])[0]?.trim() ?? ""
  );
  const reviewLink = (block.get("REVIEW_LINK") ?? [])[0]?.trim() ?? "";

  return {
    id: slug(`${negocio}__${usuario}`),
    name: negocio,
    username: usuario,
    websiteUrl,
    services,
    hours,
    vacations,
    whatsappTemplates,
    reviewLink,
  };
}

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

export const sheetsProvider: DataProvider = {
  async listBusinesses(): Promise<Business[]> {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`No se pudo leer la hoja de negocios (${res.status})`);
    }
    const text = await res.text();
    const rows = parseCsv(text);
    const blocks = groupBlocks(rows);
    return blocks.map(toBusiness).filter((b): b is Business => b !== null);
  },
};
