// Server-side proxy for reading the identity Sheet — moves the raw
// Google Sheets fetch (and the SHEET_ID/gid it needs) off the client
// bundle entirely. Before this existed, every client component that
// needed the business list imported sheets-provider.ts directly, which
// meant SHEET_ID shipped in the browser JS and anyone could construct the
// same public CSV URL themselves and pull every business's config in one
// request. This function still reads the same public CSV (the Sheet
// itself is still link-shared, that part isn't solved by this alone), but
// the ID/URL construction now lives only in server-side code — nothing a
// browser's network tab or bundle reveals it anymore.
import { sheetsProvider } from "../../src/lib/data/sheets-provider";

const handler = async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const businesses = await sheetsProvider.listBusinesses();
    return new Response(JSON.stringify({ ok: true, businesses }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "sheet_unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export default handler;
