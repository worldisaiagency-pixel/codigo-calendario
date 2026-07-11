// Server-side proxy for reading one business's rows from the "Reservas"
// tab — same reasoning as list-businesses.ts. Requires negocio+usuario so
// a caller still has to already know a specific tenant to get anything
// back (this doesn't make the Sheet private — it's still link-shared —
// but it stops a client bundle from ever revealing the raw Sheet ID/URL,
// and stops "fetch the CSV and get every business's appointments in one
// request" from being a one-line devtools exercise).
import { fetchReservas } from "../../src/lib/data/reservas-sync";

const handler = async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const negocio = url.searchParams.get("negocio")?.trim();
  const usuario = url.searchParams.get("usuario")?.trim();
  if (!negocio || !usuario) {
    return new Response(JSON.stringify({ ok: false, error: "missing negocio/usuario" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reservas = await fetchReservas(negocio, usuario);
  return new Response(JSON.stringify({ ok: true, reservas }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export default handler;
