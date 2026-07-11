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
    if (action === "createAppointment") return handleCreateAppointment(body);
    if (action === "updateAppointment") return handleUpdateAppointment(body);
    if (action === "deleteAppointment") return handleDeleteAppointment(body);
    if (action === "reformatSeparators") {
      applySeparatorBorders(sheet);
      return jsonResponse({ ok: true });
    }
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
  applySeparatorBorders(sheet);
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
  applySeparatorBorders(sheet);
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
  applySeparatorBorders(sheet);
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
  applySeparatorBorders(sheet);
  return jsonResponse({ ok: true });
}

// --- Appointments (shared booking queue: app <-> public website) -----------
//
// Lives on its own "Reservas" tab (created on first use), separate from the
// NEGOCIO/USUARIO identity blocks above — one row per appointment, not the
// label/value block format. Every cell in a written row is forced to Plain
// text ("@") BEFORE the value is set, so Sheets never silently reinterprets
// FECHA ("2026-07-15") as a real Date and reformats it on CSV export.

const RESERVAS_SHEET_NAME = "Reservas";
// EMAIL/NOTAS are appended at the end (not inserted between existing
// columns) so every index-based read already in place (reservas-sync.ts,
// handleUpdateAppointment below) keeps working unchanged.
const RESERVAS_HEADERS = [
  "ID", "NEGOCIO", "USUARIO", "FECHA", "INICIO_MIN", "DURACION_MIN",
  "SERVICIO", "CLIENTE", "TELEFONO", "PERRO", "RAZA", "ESTADO", "ORIGEN",
  "EMAIL", "NOTAS",
];

function getOrCreateReservasSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(RESERVAS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(RESERVAS_SHEET_NAME);
    sheet.appendRow(RESERVAS_HEADERS);
    return sheet;
  }
  // Migration: a sheet created before EMAIL/NOTAS existed only has the
  // first 13 header cells — fill in the rest so the columns are labeled.
  if (sheet.getLastColumn() < RESERVAS_HEADERS.length) {
    sheet
      .getRange(1, sheet.getLastColumn() + 1, 1, RESERVAS_HEADERS.length - sheet.getLastColumn())
      .setValues([RESERVAS_HEADERS.slice(sheet.getLastColumn())]);
  }
  return sheet;
}

// Minutes-since-midnight ranges [aStart,aEnd) and [bStart,bEnd) overlap.
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Re-reads the sheet fresh (called while holding the script lock, so this
// reflects any write that just committed from a concurrent request) and
// looks for any existing appointment for the same negocio+usuario+fecha
// whose time range overlaps the requested one.
function findConflictingAppointment(sheet, negocio, usuario, fecha, inicioMin, duracionMin) {
  const data = sheet.getDataRange().getValues();
  const requestedEnd = inicioMin + duracionMin;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[1]).trim() !== negocio) continue;
    if (String(row[2]).trim() !== usuario) continue;
    if (String(row[3]).trim() !== fecha) continue;
    const existingStart = Number(row[4]) || 0;
    const existingEnd = existingStart + (Number(row[5]) || 0);
    if (rangesOverlap(inicioMin, requestedEnd, existingStart, existingEnd)) {
      return row[0];
    }
  }
  return null;
}

// Created by either the business's own app or the public booking page
// (see src/app/reservar, or a business's own site calling
// create-appointment.ts directly). The caller always sends its own `id`
// (a UUID) so retries/re-syncs stay idempotent instead of appending
// duplicates.
//
// Holds Google's script-wide lock for the whole check-then-write so two
// near-simultaneous bookings for the same slot can't both succeed — the
// second one re-reads the sheet (now including whatever the first one
// just wrote) before deciding, not against a stale snapshot.
function handleCreateAppointment(body) {
  const id = String(body.id || Utilities.getUuid()).trim();
  const negocio = String(body.negocio || "").trim();
  const usuario = String(body.usuario || "").trim();
  const fecha = String(body.fecha || "").trim();
  const inicioMin = Number(body.inicioMin) || 0;
  const duracionMin = Number(body.duracionMin) || 0;
  if (!id || !negocio || !usuario || !fecha || !duracionMin) {
    return jsonResponse({ ok: false, error: "missing fields" });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return jsonResponse({ ok: false, error: "busy, try again" });
  }

  try {
    const sheet = getOrCreateReservasSheet();
    const conflict = findConflictingAppointment(sheet, negocio, usuario, fecha, inicioMin, duracionMin);
    if (conflict) {
      return jsonResponse({ ok: false, error: "slot_taken" });
    }

    const row = sheet.getLastRow() + 1;
    const range = sheet.getRange(row, 1, 1, RESERVAS_HEADERS.length);
    range.setNumberFormat("@");
    range.setValues([[
      id,
      negocio,
      usuario,
      fecha,
      String(inicioMin),
      String(duracionMin),
      String(body.servicio || ""),
      String(body.cliente || ""),
      String(body.telefono || ""),
      String(body.perro || ""),
      String(body.raza || ""),
      String(body.estado || "confirmed"),
      String(body.origen || "app"),
      String(body.email || ""),
      String(body.notas || ""),
    ]]);
    return jsonResponse({ ok: true, id: id });
  } finally {
    lock.releaseLock();
  }
}

// Used when the business reschedules an appointment from the app (e.g. the
// auto-rebooking flow). Only touches the fields the caller actually sends.
function handleUpdateAppointment(body) {
  const id = String(body.id || "").trim();
  if (!id) return jsonResponse({ ok: false, error: "missing id" });

  const sheet = getOrCreateReservasSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() !== id) continue;
    const row = i + 1;
    if (body.fecha != null) {
      const cell = sheet.getRange(row, 4);
      cell.setNumberFormat("@").setValue(String(body.fecha));
    }
    if (body.inicioMin != null) {
      const cell = sheet.getRange(row, 5);
      cell.setNumberFormat("@").setValue(String(Number(body.inicioMin)));
    }
    if (body.duracionMin != null) {
      const cell = sheet.getRange(row, 6);
      cell.setNumberFormat("@").setValue(String(Number(body.duracionMin)));
    }
    if (body.servicio != null) {
      sheet.getRange(row, 7).setValue(String(body.servicio));
    }
    if (body.estado != null) {
      sheet.getRange(row, 12).setValue(String(body.estado));
    }
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ ok: false, error: "appointment not found" });
}

function handleDeleteAppointment(body) {
  const id = String(body.id || "").trim();
  if (!id) return jsonResponse({ ok: false, error: "missing id" });

  const sheet = getOrCreateReservasSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === id) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ ok: true });
    }
  }
  return jsonResponse({ ok: false, error: "appointment not found" });
}

// --- Helpers -----------------------------------------------------------

// Draws a yellow underline under the last row of every NEGOCIO/USUARIO
// block, so it's visually obvious where one business's rows end and the
// next begins. Recomputed from scratch after any structural change
// (create/delete/rename a business, or a profile save that adds/removes
// SERVICIOS/VACACIONES lines) since block lengths shift.
const SEPARATOR_COLOR = "#FFD600";
const SEPARATOR_COLS = 9; // A:I — matches the sheet's visible columns

function applySeparatorBorders(sheet) {
  const data = sheet.getDataRange().getValues();
  const blockStartRows = [];
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || "").trim().toUpperCase() === "NEGOCIO") {
      blockStartRows.push(i + 1); // 1-indexed sheet row
    }
  }

  for (let b = 0; b < blockStartRows.length; b++) {
    const start = blockStartRows[b];
    const end = b + 1 < blockStartRows.length ? blockStartRows[b + 1] - 1 : sheet.getLastRow();
    sheet
      .getRange(end, 1, 1, SEPARATOR_COLS)
      .setBorder(null, null, true, null, null, null, SEPARATOR_COLOR, SpreadsheetApp.BorderStyle.SOLID_THICK);
  }
}

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
