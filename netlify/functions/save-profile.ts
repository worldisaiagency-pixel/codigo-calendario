// Forwards a profile/appointment write to the Google Apps Script Web App
// that has write access to the Sheet. The shared secret (SHEET_WRITE_TOKEN)
// never reaches the browser — only this server-side function knows it, same
// pattern as the VAPID private key in push-subscribe.ts.
//
// CORS is wide open (Access-Control-Allow-Origin: *) on purpose: this is
// called not just from this app's own domain, but from each business's own
// public booking page (e.g. a Lovable-hosted site on a different domain)
// creating appointments directly — same shared secret story either way, the
// token still never reaches any of those browsers.
import { postToAppsScript } from "./lib/apps-script-bridge";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const handler = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
  }

  const result = await postToAppsScript(body);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
};

export default handler;
