// Server-side proxy for the "Overrides" tab — same reasoning as
// list-reservas.ts (keeps SHEET_ID off the client bundle).
import { fetchOverrides } from "../../src/lib/data/overrides-sync";

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

  const overrides = await fetchOverrides(negocio, usuario);
  return new Response(JSON.stringify({ ok: true, overrides }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export default handler;
