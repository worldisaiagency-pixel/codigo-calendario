// Shared by save-profile.ts and create-appointment.ts — not a Netlify
// Function itself (lives in a subfolder, not directly under
// netlify/functions/), just the common "attach the token server-side and
// forward to the Apps Script Web App" logic so it isn't duplicated.
export interface AppsScriptResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

/** Forwards `payload` (plus the shared secret) to the Apps Script Web App
 * configured via SHEET_WRITE_URL/SHEET_WRITE_TOKEN. The token never reaches
 * whoever called the Netlify Function that calls this. */
export async function postToAppsScript(payload: Record<string, unknown>): Promise<AppsScriptResult> {
  const appsScriptUrl = process.env.SHEET_WRITE_URL;
  const token = process.env.SHEET_WRITE_TOKEN;
  if (!appsScriptUrl || !token) {
    return { ok: false, status: 500, body: { ok: false, error: "Not configured" } };
  }

  const upstream = await fetch(appsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, token }),
  });

  const text = await upstream.text();
  // Apps Script Web Apps always answer with HTTP 200 via ContentService,
  // even when the handler itself reports failure in the JSON body — so
  // upstream.ok alone can't tell success from failure. Parse the body and
  // use its own `ok` field to decide.
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 502, body: { ok: false, error: "invalid upstream response" } };
  }

  const succeeded = upstream.ok && parsed.ok === true;
  return { ok: succeeded, status: succeeded ? 200 : 502, body: parsed };
}
