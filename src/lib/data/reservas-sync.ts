import { parseCsv } from "./csv";
import { SHEET_ID } from "./config";

/** A row from the shared "Reservas" tab — the same appointment shape used
 * whether it was booked from the app or the public website. Self-contained
 * (client name/phone/dog inline) rather than referencing dogId/ownerId,
 * since those are per-device local ids with no meaning across devices. */
export interface PendingReserva {
  id: string;
  negocio: string;
  usuario: string;
  date: string;
  startMin: number;
  durationMin: number;
  service: string;
  ownerName: string;
  phone: string;
  dogName: string;
  breed: string;
  status: "confirmed" | "done";
}

// Read by sheet name (not gid) so this works the moment the "Reservas" tab
// exists, without needing to know its gid — gviz/tq resolves `sheet=` to
// whichever tab has that exact name.
const RESERVAS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Reservas`;

function toReserva(cols: string[]): PendingReserva | null {
  const [id, negocio, usuario, date, startMinRaw, durationMinRaw, service, ownerName, phone, dogName, breed, status] = cols;
  if (!id?.trim() || !negocio?.trim() || !usuario?.trim() || !date?.trim()) return null;
  return {
    id: id.trim(),
    negocio: negocio.trim(),
    usuario: usuario.trim(),
    date: date.trim(),
    startMin: parseInt(startMinRaw, 10) || 0,
    durationMin: parseInt(durationMinRaw, 10) || 0,
    service: (service ?? "").trim(),
    ownerName: (ownerName ?? "").trim(),
    phone: (phone ?? "").trim(),
    dogName: (dogName ?? "").trim(),
    breed: (breed ?? "").trim(),
    status: status?.trim() === "done" ? "done" : "confirmed",
  };
}

/** Every pending row for one business. Returns [] on any failure (including
 * the "Reservas" tab not existing yet — nobody has booked anything) rather
 * than throwing, since this is best-effort sync, not a hard dependency. */
export async function fetchReservas(negocio: string, usuario: string): Promise<PendingReserva[]> {
  try {
    const res = await fetch(RESERVAS_CSV_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const text = await res.text();
    const rows = parseCsv(text).slice(1); // header row
    return rows
      .map(toReserva)
      .filter((r): r is PendingReserva => r !== null)
      .filter((r) => r.negocio === negocio && r.usuario === usuario);
  } catch {
    return [];
  }
}
