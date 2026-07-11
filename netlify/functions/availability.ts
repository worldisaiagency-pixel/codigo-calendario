// Public read endpoint: given a business (negocio+usuario), returns its
// services and a list of currently-available booking slots — so an
// externally-hosted booking form (e.g. a business's own Lovable site) can
// show real availability and never offer a slot that's already taken,
// without reimplementing business-hours/vacation/appointment logic itself.
//
// Wide-open CORS on purpose, same reasoning as save-profile.ts: this is
// meant to be called from arbitrary business-owned domains.
import { sheetsProvider } from "../../src/lib/data/sheets-provider";
import { fetchReservas } from "../../src/lib/data/reservas-sync";
import { findAvailableSlots } from "../../src/lib/availability";
import { addDays } from "../../src/lib/time";
import type { Appointment, Dog, Owner } from "../../src/lib/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

const emptyDogById = new Map<string, Dog>();
const emptyOwnerById = new Map<string, Owner>();

const handler = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const negocio = url.searchParams.get("negocio")?.trim();
  const usuario = url.searchParams.get("usuario")?.trim();
  const serviceParam = url.searchParams.get("service")?.trim();
  const days = Math.min(Number(url.searchParams.get("days")) || 45, 90);

  if (!negocio || !usuario) {
    return json({ ok: false, error: "missing negocio/usuario" }, 400);
  }

  let businesses;
  try {
    businesses = await sheetsProvider.listBusinesses();
  } catch {
    return json({ ok: false, error: "could not read business sheet" }, 502);
  }

  const business = businesses.find(
    (b) =>
      b.name.trim().toLowerCase() === negocio.toLowerCase() &&
      b.username.trim().toLowerCase() === usuario.toLowerCase()
  );
  if (!business) {
    return json({ ok: false, error: "business not found" }, 404);
  }

  const service =
    business.services.find((s) => s.name.toLowerCase() === serviceParam?.toLowerCase()) ??
    business.services[0];
  if (!service) {
    return json({ ok: true, services: [], slots: [] });
  }

  const reservas = await fetchReservas(business.name, business.username);
  const appointments: Appointment[] = reservas.map((r) => ({
    id: r.id,
    dogId: r.id,
    ownerId: r.id,
    date: r.date,
    startMin: r.startMin,
    durationMin: r.durationMin,
    service: r.service,
    status: r.status,
  }));

  // NOTE: "today"/"now" are this server's clock, not the caller's — for a
  // Spain-based business on a server in another timezone, this can shift
  // which slots on the CURRENT day look already-past by a few hours. Doesn't
  // affect correctness of blocking already-booked slots on any date, only
  // the "earliest bookable moment today" cutoff.
  const today = new Date();
  const slots = findAvailableSlots({
    business,
    appointments,
    dogById: emptyDogById,
    ownerById: emptyOwnerById,
    durationMin: service.durationMin,
    rangeStart: today,
    rangeEnd: addDays(today, days),
    limit: 200,
  });

  return json({
    ok: true,
    services: business.services,
    slots: slots.map((s) => ({ date: s.date, startMin: s.slotStartMin, durationMin: service.durationMin })),
  });
};

export default handler;
