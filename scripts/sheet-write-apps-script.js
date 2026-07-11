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
 * UPDATING (after editing this file for a new feature): Deploy -> Manage
 * deployments -> pencil/edit icon on the existing deployment -> Version:
 * "New version" -> Deploy. This keeps the same Web app URL, so nothing else
 * needs to change.
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

    const sheet = SHEET_NAME
      ? SpreadsheetApp.getActive().getSheetByName(SHEET_NAME)
      : SpreadsheetApp.getActive().getSheets()[0];

    const action = body.action || "saveProfile";
    if (action === "saveProfile") return handleSaveProfile(sheet, body);
    if (action === "updateIdentity") return handleUpdateIdentity(sheet, body);
    if (action === "createBusiness") return handleCreateBusiness(sheet, body);
    if (action === "deleteBusiness") return handleDeleteBusiness(sheet, body);
    return jsonResponse({ ok: false, error: "unknown action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// --- Actions ---------------------------------------------------------------

// The business owner's own save: replaces SERVICIOS/HORARIOS/VACACIONES,
// preserves NEGOCIO/USUARIO/WEB exactly as they were in the sheet.
function handleSaveProfile(sheet, body) {
  const negocio = String(body.negocio || "").trim();
  const usuario = String(body.usuario || "").trim();
  if (!negocio || !usuario) {
    return jsonResponse({ ok: false, error: "missing negocio/usuario" });
  }

  const data = sheet.getDataRange().getValues();
  const block = findBlock(data, negocio, usuario);
  if (!block) {
    return jsonResponse({ ok: false, error: "business not found in sheet" });
  }

  const rows = buildBlockRows({
    negocio,
    usuario,
    web: block.web,
    serviciosLines: body.serviciosLines || [],
    horarios: body.horarios || "",
    vacacionesLines: body.vacacionesLines || [],
  });

  replaceBlock(sheet, block, rows);
  return jsonResponse({ ok: true });
}

// Admin-only: renames a business and/or changes its website link. Preserves
// SERVICIOS/HORARIOS/VACACIONES verbatim — this action never touches them.
function handleUpdateIdentity(sheet, body) {
  const oldNegocio = String(body.oldNegocio || "").trim();
  const oldUsuario = String(body.oldUsuario || "").trim();
  const negocio = String(body.negocio || "").trim();
  const usuario = String(body.usuario || "").trim();
  const web = String(body.web || "").trim();
  if (!oldNegocio || !oldUsuario || !negocio || !usuario) {
    return jsonResponse({ ok: false, error: "missing fields" });
  }

  const data = sheet.getDataRange().getValues();
  const block = findBlock(data, oldNegocio, oldUsuario);
  if (!block) {
    return jsonResponse({ ok: false, error: "business not found in sheet" });
  }

  const rawBlockRows = data.slice(block.startRow - 1, block.startRow - 1 + block.numRows);
  const preserved = extractPreservedLines(rawBlockRows);

  const rows = buildBlockRows({
    negocio,
    usuario,
    web,
    serviciosLinesRaw: preserved.servicios,
    horarios: preserved.horarios,
    vacacionesLinesRaw: preserved.vacaciones,
  });

  replaceBlock(sheet, block, rows);
  return jsonResponse({ ok: true });
}

// Admin-only: appends a brand-new, unconfigured business block at the end
// of the sheet, ready for that business to log in and self-configure.
function handleCreateBusiness(sheet, body) {
  const negocio = String(body.negocio || "").trim();
  const usuario = String(body.usuario || "").trim();
  const web = String(body.web || "").trim();
  if (!negocio || !usuario) {
    return jsonResponse({ ok: false, error: "missing negocio/usuario" });
  }

  const data = sheet.getDataRange().getValues();
  if (findBlock(data, negocio, usuario)) {
    return jsonResponse({ ok: false, error: "already exists" });
  }

  const rows = buildBlockRows({
    negocio,
    usuario,
    web,
    serviciosLines: [],
    horarios: "",
    vacacionesLines: [],
  });

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, 2).setValues(rows);
  return jsonResponse({ ok: true });
}

// Admin-only: removes a business's entire block from the sheet.
function handleDeleteBusiness(sheet, body) {
  const negocio = String(body.negocio || "").trim();
  const usuario = String(body.usuario || "").trim();
  if (!negocio || !usuario) {
    return jsonResponse({ ok: false, error: "missing negocio/usuario" });
  }

  const data = sheet.getDataRange().getValues();
  const block = findBlock(data, negocio, usuario);
  if (!block) {
    return jsonResponse({ ok: false, error: "business not found in sheet" });
  }

  sheet.deleteRows(block.startRow, block.numRows);
  return jsonResponse({ ok: true });
}

// --- Helpers -----------------------------------------------------------

function replaceBlock(sheet, block, rows) {
  sheet.deleteRows(block.startRow, block.numRows);
  sheet.insertRowsBefore(block.startRow, rows.length);
  sheet.getRange(block.startRow, 1, rows.length, 2).setValues(rows);
}

// Finds the 1-indexed sheet row range [startRow, numRows] for the
// NEGOCIO/USUARIO block matching the given values, plus its current WEB
// value (so saveProfile can preserve it without the caller sending it back).
function findBlock(data, negocio, usuario) {
  let startIdx = -1;
  let endIdx = data.length; // exclusive, 0-indexed into `data`
  let web = "";

  for (let i = 0; i < data.length; i++) {
    const label = String(data[i][0] || "").trim().toUpperCase();
    if (label !== "NEGOCIO") continue;

    if (startIdx !== -1) {
      endIdx = i;
      break;
    }

    const negocioVal = String(data[i][1] || "").trim();
    let usuarioVal = null;
    let webVal = "";
    for (let j = i + 1; j < data.length; j++) {
      const l = String(data[j][0] || "").trim().toUpperCase();
      if (l === "NEGOCIO") break;
      if (l === "USUARIO" && usuarioVal === null) usuarioVal = String(data[j][1] || "").trim();
      if (l === "WEB") webVal = String(data[j][1] || "").trim();
    }

    if (negocioVal === negocio && usuarioVal === usuario) {
      startIdx = i;
      web = webVal;
    }
  }

  if (startIdx === -1) return null;
  return { startRow: startIdx + 1, numRows: endIdx - startIdx, web: web };
}

// Reads back the SERVICIOS/HORARIOS/VACACIONES lines from a block's raw rows
// so an identity-only update can rewrite the block without losing them.
function extractPreservedLines(rawRows) {
  const servicios = [];
  const vacaciones = [];
  let horarios = "";
  let current = null;

  for (const row of rawRows) {
    const label = String(row[0] || "").trim().toUpperCase();
    const value = String(row[1] || "").trim();

    if (label === "NEGOCIO" || label === "USUARIO" || label === "WEB") {
      current = null;
      continue;
    }
    if (label === "SERVICIOS") {
      current = "servicios";
      if (value) servicios.push(value);
      continue;
    }
    if (label === "HORARIOS") {
      current = null;
      horarios = value;
      continue;
    }
    if (label === "VACACIONES") {
      current = "vacaciones";
      if (value) vacaciones.push(value);
      continue;
    }
    if (!label && current === "servicios" && value) servicios.push(value);
    if (!label && current === "vacaciones" && value) vacaciones.push(value);
  }

  return { servicios: servicios, horarios: horarios, vacaciones: vacaciones };
}

// Builds the standard 2-column row block: NEGOCIO/USUARIO/WEB, then
// SERVICIOS (one row per line), HORARIOS, then VACACIONES (one row per
// line). Accepts either freshly-formatted lines (serviciosLines/
// vacacionesLines) or already-existing lines to keep verbatim
// (serviciosLinesRaw/vacacionesLinesRaw), used when only identity changed.
function buildBlockRows(opts) {
  const rows = [];
  rows.push(["NEGOCIO", opts.negocio]);
  rows.push(["USUARIO", opts.usuario]);
  rows.push(["WEB", opts.web || ""]);

  const serviciosLines = opts.serviciosLinesRaw || opts.serviciosLines || [];
  if (serviciosLines.length === 0) {
    rows.push(["SERVICIOS", ""]);
  } else {
    serviciosLines.forEach(function (line, i) {
      rows.push([i === 0 ? "SERVICIOS" : "", line]);
    });
  }

  rows.push(["HORARIOS", opts.horarios || ""]);

  const vacacionesLines = opts.vacacionesLinesRaw || opts.vacacionesLines || [];
  if (vacacionesLines.length === 0) {
    rows.push(["VACACIONES", ""]);
  } else {
    vacacionesLines.forEach(function (line, i) {
      rows.push([i === 0 ? "VACACIONES" : "", line]);
    });
  }

  return rows;
}
