/**
 * Google Apps Script — write bridge for the business-config sheet.
 *
 * SETUP (one-time, done by the sheet owner from inside Google Sheets):
 *   1. Open the spreadsheet -> Extensions -> Apps Script.
 *   2. Delete any placeholder code and paste this entire file in.
 *   3. Replace SHARED_TOKEN below with the exact value of SHEET_WRITE_TOKEN
 *      in your local .env.local (NOT committed to git — this is a secret;
 *      never paste the real token into a file that gets committed).
 *   4. If your data isn't on the first tab, set SHEET_NAME to its exact name.
 *   5. Deploy -> New deployment -> type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   6. Authorize when prompted (it's your own script touching your own sheet).
 *   7. Copy the resulting Web app URL and set it as SHEET_WRITE_URL in
 *      .env.local (local dev) and as a Netlify environment variable
 *      (production) — see README/CONTRIBUTING for how to set Netlify env vars.
 *
 * The app never talks to this script directly: a Netlify Function holds the
 * token and URL server-side and forwards requests here (see
 * netlify/functions/save-profile.ts). This script only trusts requests that
 * include the correct token.
 */

const SHARED_TOKEN = "REPLACE_WITH_SHEET_WRITE_TOKEN_FROM_ENV_LOCAL";
const SHEET_NAME = ""; // leave blank to use the first sheet/tab

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== SHARED_TOKEN) {
      return jsonResponse({ ok: false, error: "unauthorized" });
    }

    const negocio = String(body.negocio || "").trim();
    const usuario = String(body.usuario || "").trim();
    if (!negocio || !usuario) {
      return jsonResponse({ ok: false, error: "missing negocio/usuario" });
    }

    const sheet = SHEET_NAME
      ? SpreadsheetApp.getActive().getSheetByName(SHEET_NAME)
      : SpreadsheetApp.getActive().getSheets()[0];

    const data = sheet.getDataRange().getValues();
    const block = findBlock(data, negocio, usuario);
    if (!block) {
      return jsonResponse({ ok: false, error: "business not found in sheet" });
    }

    const newRows = buildBlockRows(
      negocio,
      usuario,
      body.serviciosLines || [],
      body.horarios || "",
      body.vacacionesLines || []
    );

    // Replace the whole block (NEGOCIO..end) with the freshly-built rows —
    // simplest way to handle the row count changing (e.g. a service added).
    sheet.deleteRows(block.startRow, block.numRows);
    sheet.insertRowsBefore(block.startRow, newRows.length);
    sheet.getRange(block.startRow, 1, newRows.length, 2).setValues(newRows);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// Finds the 1-indexed sheet row range [startRow, numRows] for the
// NEGOCIO/USUARIO block matching the given values.
function findBlock(data, negocio, usuario) {
  let startIdx = -1;
  let endIdx = data.length; // exclusive, 0-indexed into `data`

  for (let i = 0; i < data.length; i++) {
    const label = String(data[i][0] || "").trim().toUpperCase();
    if (label !== "NEGOCIO") continue;

    if (startIdx !== -1) {
      endIdx = i;
      break;
    }

    const negocioVal = String(data[i][1] || "").trim();
    let usuarioVal = null;
    for (let j = i + 1; j < data.length; j++) {
      const l = String(data[j][0] || "").trim().toUpperCase();
      if (l === "NEGOCIO") break;
      if (l === "USUARIO") {
        usuarioVal = String(data[j][1] || "").trim();
        break;
      }
    }

    if (negocioVal === negocio && usuarioVal === usuario) {
      startIdx = i;
    }
  }

  if (startIdx === -1) return null;
  return { startRow: startIdx + 1, numRows: endIdx - startIdx };
}

function buildBlockRows(negocio, usuario, serviciosLines, horarios, vacacionesLines) {
  const rows = [];
  rows.push(["NEGOCIO", negocio]);
  rows.push(["USUARIO", usuario]);

  if (serviciosLines.length === 0) {
    rows.push(["SERVICIOS", ""]);
  } else {
    serviciosLines.forEach((line, i) => rows.push([i === 0 ? "SERVICIOS" : "", line]));
  }

  rows.push(["HORARIOS", horarios]);

  if (vacacionesLines.length === 0) {
    rows.push(["VACACIONES", ""]);
  } else {
    vacacionesLines.forEach((line, i) => rows.push([i === 0 ? "VACACIONES" : "", line]));
  }

  return rows;
}
