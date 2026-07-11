// Forwards a profile save to the Google Apps Script Web App that has write
// access to the Sheet. The shared secret (SHEET_WRITE_TOKEN) never reaches
// the browser — only this server-side function knows it, same pattern as
// the VAPID private key in push-subscribe.ts.
const handler = async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const appsScriptUrl = process.env.SHEET_WRITE_URL;
  const token = process.env.SHEET_WRITE_TOKEN;
  if (!appsScriptUrl || !token) {
    return new Response(JSON.stringify({ ok: false, error: "Not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const upstream = await fetch(appsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, token }),
  });

  const text = await upstream.text();
  // Apps Script Web Apps always answer with HTTP 200 via ContentService, even
  // when the handler itself reports failure in the JSON body — so upstream.ok
  // alone can't tell success from failure. Parse the body and use its own
  // `ok` field to decide the status we hand back to the client.
  let succeeded = upstream.ok;
  try {
    const parsed = JSON.parse(text);
    succeeded = upstream.ok && parsed.ok === true;
  } catch {
    succeeded = false;
  }

  return new Response(text, {
    status: succeeded ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
};

export default handler;
