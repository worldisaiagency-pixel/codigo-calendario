// Public write endpoint for external booking forms (a business's own
// website, calling this directly — no /reservar redirect involved). Takes
// a clean, English-field JSON contract, resolves negocio/usuario + the
// named service against the real Sheet-backed config, and forwards to the
// same Apps Script bridge every other write goes through. Nothing here is
// business-specific: `business`/`user` are read from the request, never
// hardcoded, so the same endpoint serves every tenant.
import { sheetsProvider } from "../../src/lib/data/sheets-provider";
import { fetchReservas } from "../../src/lib/data/reservas-sync";
import { postToAppsScript } from "./lib/apps-script-bridge";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface CreateAppointmentRequest {
  business: string;
  user: string;
  ownerName: string;
  petName: string;
  breed?: string;
  phone: string;
  service: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  email?: string;
  notes?: string;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function parseTimeToMin(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date.trim());
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

const handler = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  let body: Partial<CreateAppointmentRequest>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const business = body.business?.trim();
  const user = body.user?.trim();
  const ownerName = body.ownerName?.trim();
  const petName = body.petName?.trim();
  const phone = body.phone?.trim();
  const service = body.service?.trim();
  const date = body.date?.trim();
  const time = body.time?.trim();
  const breed = body.breed?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const notes = body.notes?.trim() ?? "";

  const missing = ["business", "user", "ownerName", "petName", "phone", "service", "date", "time"].filter(
    (key) => !(body as Record<string, unknown>)[key] || String((body as Record<string, unknown>)[key]).trim() === ""
  );
  if (missing.length > 0) {
    return json({ ok: false, error: "missing_fields", fields: missing }, 400);
  }
  if (!isValidDate(date!)) {
    return json({ ok: false, error: "invalid_date" }, 400);
  }
  const startMin = parseTimeToMin(time!);
  if (startMin === null) {
    return json({ ok: false, error: "invalid_time" }, 400);
  }

  let businesses;
  try {
    businesses = await sheetsProvider.listBusinesses();
  } catch {
    return json({ ok: false, error: "sheet_unavailable" }, 502);
  }

  const matchedBusiness = businesses.find(
    (b) => b.name.trim().toLowerCase() === business!.toLowerCase() && b.username.trim().toLowerCase() === user!.toLowerCase()
  );
  if (!matchedBusiness) {
    return json({ ok: false, error: "business_not_found" }, 404);
  }

  const matchedService = matchedBusiness.services.find((s) => s.name.toLowerCase() === service!.toLowerCase());
  if (!matchedService) {
    return json({ ok: false, error: "service_not_found" }, 404);
  }

  // Fast pre-check: catches the common case (slot already gone) without a
  // round trip to Apps Script. Not the final word — Apps Script re-checks
  // for real, holding a lock, immediately before it writes (see
  // handleCreateAppointment in scripts/sheet-write-apps-script.js), which
  // is what actually rules out two near-simultaneous bookings racing.
  const endMin = startMin + matchedService.durationMin;
  const existing = await fetchReservas(matchedBusiness.name, matchedBusiness.username);
  const clash = existing.some(
    (r) => r.date === date && rangesOverlap(startMin, endMin, r.startMin, r.startMin + r.durationMin)
  );
  if (clash) {
    return json({ ok: false, error: "slot_taken" }, 409);
  }

  const id = crypto.randomUUID();
  const result = await postToAppsScript({
    action: "createAppointment",
    id,
    negocio: matchedBusiness.name,
    usuario: matchedBusiness.username,
    fecha: date,
    inicioMin: startMin,
    duracionMin: matchedService.durationMin,
    servicio: matchedService.name,
    cliente: ownerName,
    telefono: phone,
    perro: petName,
    raza: breed,
    email,
    notas: notes,
    estado: "confirmed",
    origen: "web",
  });

  if (!result.ok) {
    const upstreamError = typeof result.body.error === "string" ? result.body.error : "write_failed";
    const status = upstreamError === "slot_taken" ? 409 : 502;
    return json({ ok: false, error: upstreamError }, status);
  }

  return json({ ok: true, id }, 200);
};

export default handler;
