import { parseCsv } from "./csv";
import { SHEET_ID } from "./config";
import type { ScheduleOverride, ScheduleOverrideKind } from "./types";

// Read by sheet name, same reasoning as reservas-sync.ts — works the
// moment the "Overrides" tab exists, no gid needed.
const OVERRIDES_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Overrides`;

interface RemoteOverride extends ScheduleOverride {
  negocio: string;
  usuario: string;
}

function toOverride(cols: string[]): RemoteOverride | null {
  const [id, negocio, usuario, date, kind, openMin, closeMin, blockStart, blockEnd, note] = cols;
  if (!id?.trim() || !negocio?.trim() || !usuario?.trim() || !date?.trim()) return null;
  const validKind = kind?.trim() as ScheduleOverrideKind;
  if (validKind !== "closed" && validKind !== "hours" && validKind !== "block") return null;

  const toNum = (v: string | undefined) => (v?.trim() ? parseInt(v, 10) : undefined);
  return {
    id: id.trim(),
    negocio: negocio.trim(),
    usuario: usuario.trim(),
    date: date.trim(),
    kind: validKind,
    open: toNum(openMin),
    close: toNum(closeMin),
    blockStart: toNum(blockStart),
    blockEnd: toNum(blockEnd),
    note: note?.trim() || undefined,
  };
}

/** Every pending schedule override for one business. Returns [] on any
 * failure (including the "Overrides" tab not existing yet) — best-effort
 * sync, not a hard dependency, same contract as fetchReservas. */
export async function fetchOverrides(negocio: string, usuario: string): Promise<ScheduleOverride[]> {
  try {
    const res = await fetch(OVERRIDES_CSV_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const text = await res.text();
    const rows = parseCsv(text).slice(1);
    return rows
      .map(toOverride)
      .filter((r): r is RemoteOverride => r !== null)
      .filter((r) => r.negocio === negocio && r.usuario === usuario)
      .map(({ negocio: _n, usuario: _u, ...override }) => override);
  } catch {
    return [];
  }
}
