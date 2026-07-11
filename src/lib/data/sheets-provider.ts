import { parseCsv } from "./csv";
import { SHEET_GID, SHEET_ID } from "./config";
import type { Business } from "./types";
import type { DataProvider } from "./provider";

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
// A block starts at a NEGOCIO row and runs until the next one. Only NEGOCIO
// and USUARIO are read — everything else a legacy sheet might still have
// (SERVICIOS/HORARIOS/VACACIONES) is ignored: that config now lives in each
// business's in-app profile instead (see profile-store.ts).
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

function toBusiness(block: Map<string, string[]>): Business | null {
  const negocio = block.get("NEGOCIO")?.[0]?.trim();
  const usuario = block.get("USUARIO")?.[0]?.trim();
  if (!negocio || !usuario) return null;

  return {
    id: slug(`${negocio}__${usuario}`),
    name: negocio,
    username: usuario,
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
