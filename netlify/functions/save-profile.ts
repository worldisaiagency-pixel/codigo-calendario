// Forwards a profile/appointment write to the Google Apps Script Web App
// that has write access to the Sheet. The shared secret (SHEET_WRITE_TOKEN)
// never reaches the browser — only this server-side function knows it, same
// pattern as the VAPID private key in push-subscribe.ts.
//
// This is only ever called from this app's own pages (the business's own
// profile editor, the admin panel, /reservar) — every one of those is
// same-origin, so no CORS headers are needed here at all. External
// third-party sites creating appointments go through create-appointment.ts
// instead, which has its own purpose-built, narrower contract.
//
// SECURITY NOTE (known, accepted limitation — see admin.ts): CORS only
// stops a BROWSER from reading a cross-origin response; it does nothing
// against a direct server-to-server or curl call that already knows this
// URL. The ALLOWED_ACTIONS allowlist below is defense in depth against
// unexpected/typo'd actions, not real caller authentication — anyone who
// discovers this Netlify Function's URL and an action name can still
// invoke it, same trust model as the admin PIN. Closing that fully would
// need real per-caller auth, which this app doesn't have.
import { postToAppsScript } from "./lib/apps-script-bridge";

const ALLOWED_ACTIONS = new Set([
  "saveProfile",
  "updateIdentity",
  "createBusiness",
  "deleteBusiness",
  "createAppointment",
  "updateAppointment",
  "deleteAppointment",
  "createOverride",
  "deleteOverride",
  "reformatSeparators",
]);

const handler = async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (typeof body.action !== "string" || !ALLOWED_ACTIONS.has(body.action)) {
    return new Response(JSON.stringify({ ok: false, error: "unknown action" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await postToAppsScript(body);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
};

export default handler;
