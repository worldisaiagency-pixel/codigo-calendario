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
    if (action === "createAppointment") return handleCreateAppointment(sheet, body);
    if (action === "updateAppointment") return handleUpdateAppointment(sheet, body);
    if (action === "deleteAppointment") return handleDeleteAppointment(body);
    if (action === "createOverride") return handleCreateOverride(body);
    if (action === "deleteOverride") return handleDeleteOverride(body);
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
// whose time range overlaps the requested one. `excludeId` lets a
// reschedule check against every OTHER appointment without flagging
// itself as a conflict.
function findConflictingAppointment(sheet, negocio, usuario, fecha, inicioMin, duracionMin, excludeId) {
  const data = sheet.getDataRange().getValues();
  const requestedEnd = inicioMin + duracionMin;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (excludeId && String(row[0]).trim() === excludeId) continue;
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
// just wrote) before deciding, not against a stale snapshot. All business
// rules (hours, vacations, overrides, overlaps, service duration) are
// decided by validateAppointment — see that function for why.
function handleCreateAppointment(identitySheet, body) {
  const id = String(body.id || Utilities.getUuid()).trim();
  const negocio = String(body.negocio || "").trim();
  const usuario = String(body.usuario || "").trim();
  const fecha = String(body.fecha || "").trim();
  const inicioMin = Number(body.inicioMin) || 0;
  const duracionMin = Number(body.duracionMin) || 0;
  const servicio = String(body.servicio || "").trim();
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
    const validation = validateAppointment(identitySheet, negocio, usuario, fecha, inicioMin, duracionMin, servicio, null);
    if (!validation.ok) {
      return jsonResponse({ ok: false, error: validation.error });
    }

    const sheet = getOrCreateReservasSheet();
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
//
// Holds the same script-wide lock as handleCreateAppointment. Re-validates
// through validateAppointment — the same authority handleCreateAppointment
// uses — whenever the move actually changes date/time/duration/service;
// pure status-only patches (e.g. marking "done") skip it since they can't
// possibly create a new conflict or land outside business hours.
function handleUpdateAppointment(identitySheet, body) {
  const id = String(body.id || "").trim();
  if (!id) return jsonResponse({ ok: false, error: "missing id" });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return jsonResponse({ ok: false, error: "busy, try again" });
  }

  try {
    const sheet = getOrCreateReservasSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() !== id) continue;
      const row = i + 1;
      const negocio = String(data[i][1]).trim();
      const usuario = String(data[i][2]).trim();

      const nextFecha = body.fecha != null ? String(body.fecha) : String(data[i][3]).trim();
      const nextInicio = body.inicioMin != null ? Number(body.inicioMin) : Number(data[i][4]) || 0;
      const nextDuracion = body.duracionMin != null ? Number(body.duracionMin) : Number(data[i][5]) || 0;
      const nextServicio = body.servicio != null ? String(body.servicio) : String(data[i][6]).trim();

      const needsValidation =
        body.fecha != null || body.inicioMin != null || body.duracionMin != null || body.servicio != null;
      if (needsValidation) {
        const validation = validateAppointment(identitySheet, negocio, usuario, nextFecha, nextInicio, nextDuracion, nextServicio, id);
        if (!validation.ok) {
          return jsonResponse({ ok: false, error: validation.error });
        }
      }

      if (body.fecha != null) {
        sheet.getRange(row, 4).setNumberFormat("@").setValue(nextFecha);
      }
      if (body.inicioMin != null) {
        sheet.getRange(row, 5).setNumberFormat("@").setValue(String(nextInicio));
      }
      if (body.duracionMin != null) {
        sheet.getRange(row, 6).setNumberFormat("@").setValue(String(nextDuracion));
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
  } finally {
    lock.releaseLock();
  }
}

// Holds the lock too — mostly so a delete can never interleave with a
// concurrent create/update reading a half-modified sheet mid-shift.
function handleDeleteAppointment(body) {
  const id = String(body.id || "").trim();
  if (!id) return jsonResponse({ ok: false, error: "missing id" });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return jsonResponse({ ok: false, error: "busy, try again" });
  }

  try {
    const sheet = getOrCreateReservasSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === id) {
        sheet.deleteRow(i + 1);
        return jsonResponse({ ok: true });
      }
    }
    return jsonResponse({ ok: false, error: "appointment not found" });
  } finally {
    lock.releaseLock();
  }
}

// --- Schedule overrides (spontaneous closures/hour changes/blocks) --------
//
// Own tab, same reasoning as Reservas: previously these only lived in each
// business's localStorage, so neither the public booking page nor any
// external site ever knew about a same-day closure/urgency. Now they're
// written here too, and read the same public-CSV way as everything else.

const OVERRIDES_SHEET_NAME = "Overrides";
const OVERRIDES_HEADERS = [
  "ID", "NEGOCIO", "USUARIO", "FECHA", "KIND",
  "OPEN_MIN", "CLOSE_MIN", "BLOCK_START", "BLOCK_END", "NOTE",
];

function getOrCreateOverridesSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(OVERRIDES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(OVERRIDES_SHEET_NAME);
    sheet.appendRow(OVERRIDES_HEADERS);
  }
  return sheet;
}

function handleCreateOverride(body) {
  const id = String(body.id || Utilities.getUuid()).trim();
  const negocio = String(body.negocio || "").trim();
  const usuario = String(body.usuario || "").trim();
  const fecha = String(body.fecha || "").trim();
  const kind = String(body.kind || "").trim();
  if (!id || !negocio || !usuario || !fecha || !kind) {
    return jsonResponse({ ok: false, error: "missing fields" });
  }

  const sheet = getOrCreateOverridesSheet();
  const row = sheet.getLastRow() + 1;
  const range = sheet.getRange(row, 1, 1, OVERRIDES_HEADERS.length);
  range.setNumberFormat("@");
  range.setValues([[
    id,
    negocio,
    usuario,
    fecha,
    kind,
    body.openMin != null ? String(Number(body.openMin)) : "",
    body.closeMin != null ? String(Number(body.closeMin)) : "",
    body.blockStart != null ? String(Number(body.blockStart)) : "",
    body.blockEnd != null ? String(Number(body.blockEnd)) : "",
    String(body.note || ""),
  ]]);
  return jsonResponse({ ok: true, id: id });
}

function handleDeleteOverride(body) {
  const id = String(body.id || "").trim();
  if (!id) return jsonResponse({ ok: false, error: "missing id" });

  const sheet = getOrCreateOverridesSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === id) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ ok: true });
    }
  }
  return jsonResponse({ ok: false, error: "override not found" });
}

// --- Centralized appointment validation ---------------------------------
//
// validateAppointment is the single authority on whether a given
// (negocio, usuario, fecha, inicioMin, duracionMin, servicio) can be
// written to the Reservas sheet. Both handleCreateAppointment and
// handleUpdateAppointment call this — under the same LockService lock
// they already hold — instead of each re-implementing their own subset of
// the rules. Any new business rule (cleanup buffer, daily appointment cap,
// etc.) belongs inside this one function, not scattered across handlers.
//
// The parsing helpers below (stripAccents/parseHoursGAS/parseVacationLineGAS/
// parseServiceLineGAS) mirror src/lib/data/sheets-provider.ts's
// parseHours/parseVacationLine/parseServiceLine byte-for-byte in intent —
// Apps Script can't import that TS module, so this is a hand-kept port.
// If the Sheet's HORARIOS/VACACIONES/SERVICIOS text format ever changes on
// the client side, this must be updated to match.

const APPT_WEEKDAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

const DIACRITIC_RANGE_START = 0x0300;
const DIACRITIC_RANGE_END = 0x036f;

function stripAccents(s) {
  const normalized = s.normalize("NFD");
  let out = "";
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code >= DIACRITIC_RANGE_START && code <= DIACRITIC_RANGE_END) continue;
    out += normalized[i];
  }
  return out;
}

function weekdayFromDateGAS(date) {
  const index = (date.getDay() + 6) % 7;
  return APPT_WEEKDAYS[index];
}

function parseDurationTokenGAS(token) {
  const hMatch = token.match(/(\d+(?:[.,]\d+)?)\s*h/i);
  const minMatch = token.match(/(\d+)\s*m(?:in)?/i);
  let total = 0;
  let matched = false;
  if (hMatch) {
    total += parseFloat(hMatch[1].replace(",", ".")) * 60;
    matched = true;
  }
  if (minMatch) {
    total += parseInt(minMatch[1], 10);
    matched = true;
  }
  return matched ? Math.round(total) : null;
}

function parseServiceLineGAS(line) {
  const parts = line
    .split("·")
    .map(function (p) { return p.trim(); })
    .filter(function (p) { return p; });
  if (parts.length === 0) return null;

  const name = parts[0];
  let durationPart = null;
  for (let i = 0; i < parts.length; i++) {
    if (/\d/.test(parts[i]) && /(min|h)\b/i.test(parts[i])) {
      durationPart = parts[i];
      break;
    }
  }
  let pricePart = "";
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== name && parts[i] !== durationPart) {
      pricePart = parts[i];
      break;
    }
  }
  const durationMin = durationPart ? parseDurationTokenGAS(durationPart) : null;
  if (!name || durationMin == null) return null;

  return { name: name, priceLabel: pricePart, durationMin: durationMin };
}

function parseHoursGAS(raw) {
  const hours = {};
  for (let i = 0; i < APPT_WEEKDAYS.length; i++) hours[APPT_WEEKDAYS[i]] = null;
  if (!raw || !raw.trim()) return hours;

  const segments = raw
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s; });

  for (const seg of segments) {
    const normalized = stripAccents(seg).toLowerCase();
    let days = [];
    let rest = normalized;

    const rangeMatch = normalized.match(/^([a-z]+)\s+a\s+([a-z]+)\s+(.*)$/);
    if (rangeMatch) {
      const start = APPT_WEEKDAYS.indexOf(rangeMatch[1]);
      const end = APPT_WEEKDAYS.indexOf(rangeMatch[2]);
      if (start !== -1 && end !== -1 && start <= end) {
        days = APPT_WEEKDAYS.slice(start, end + 1);
        rest = rangeMatch[3];
      }
    }

    if (days.length === 0) {
      const singleMatch = normalized.match(/^([a-z]+)\s+(.*)$/);
      const day = singleMatch ? singleMatch[1] : null;
      if (day && APPT_WEEKDAYS.indexOf(day) !== -1) {
        days = [day];
        rest = singleMatch[2];
      }
    }

    if (days.length === 0) continue;

    if (/cerrado/.test(rest)) {
      for (const d of days) hours[d] = null;
      continue;
    }

    const timeMatch = rest.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!timeMatch) continue;
    const open = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
    const close = parseInt(timeMatch[3], 10) * 60 + parseInt(timeMatch[4], 10);
    for (const d of days) hours[d] = { open: open, close: close };
  }

  return hours;
}

function parseVacationLineGAS(line) {
  const matches = line.match(/\d{2}\/\d{2}\/\d{4}/g);
  if (!matches || matches.length === 0) return [];
  function toIso(m) {
    const parts = m.split("/");
    return parts[2] + "-" + parts[1] + "-" + parts[0];
  }
  const start = toIso(matches[0]);
  const end = matches[1] ? toIso(matches[1]) : start;
  return [{ start: start, end: end }];
}

// The authority. Returns { ok: true } or { ok: false, error: "<code>" }.
// Error codes: business_not_found, service_not_found, invalid_duration,
// schedule_blocked, outside_hours, slot_taken.
function validateAppointment(identitySheet, negocio, usuario, fecha, inicioMin, duracionMin, servicio, excludeId) {
  const identityData = identitySheet.getDataRange().getValues();
  const block = findBlock(identityData, negocio, usuario);
  if (!block) {
    return { ok: false, error: "business_not_found" };
  }

  const rawBlockRows = identityData.slice(block.startRow - 1, block.startRow - 1 + block.numRows);
  const preserved = extractPreservedLines(rawBlockRows);

  const services = preserved.servicios
    .map(parseServiceLineGAS)
    .filter(function (s) { return s !== null; });
  const matchedService = services.filter(function (s) {
    return s.name.toLowerCase() === servicio.toLowerCase();
  })[0];
  if (!matchedService) {
    return { ok: false, error: "service_not_found" };
  }
  if (duracionMin !== matchedService.durationMin) {
    return { ok: false, error: "invalid_duration" };
  }

  const hours = parseHoursGAS(preserved.horarios);
  const vacations = preserved.vacaciones.reduce(function (acc, line) {
    return acc.concat(parseVacationLineGAS(line));
  }, []);

  const dateParts = fecha.split("-").map(Number);
  const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const onVacation = vacations.some(function (v) { return fecha >= v.start && fecha <= v.end; });
  let effectiveSchedule = onVacation ? null : hours[weekdayFromDateGAS(dateObj)];

  const requestedEnd = inicioMin + duracionMin;

  // Overrides: "closed"/"hours" replace the day's window, "block" carves
  // out a sub-range — same composition rule as resolveDay() on the client
  // (src/lib/data/schedule-overrides.ts).
  const overridesSheet = getOrCreateOverridesSheet();
  const overrideRows = overridesSheet.getDataRange().getValues();
  const blockedRanges = [];
  for (let i = 1; i < overrideRows.length; i++) {
    const row = overrideRows[i];
    if (String(row[1]).trim() !== negocio) continue;
    if (String(row[2]).trim() !== usuario) continue;
    if (String(row[3]).trim() !== fecha) continue;
    const kind = String(row[4]).trim();
    if (kind === "closed") {
      effectiveSchedule = null;
    } else if (kind === "hours") {
      const openMin = row[5] !== "" ? Number(row[5]) : null;
      const closeMin = row[6] !== "" ? Number(row[6]) : null;
      if (openMin != null && closeMin != null) {
        effectiveSchedule = { open: openMin, close: closeMin };
      }
    } else if (kind === "block") {
      const blockStart = row[7] !== "" ? Number(row[7]) : null;
      const blockEnd = row[8] !== "" ? Number(row[8]) : null;
      if (blockStart != null && blockEnd != null) {
        blockedRanges.push({ start: blockStart, end: blockEnd });
      }
    }
  }

  if (!effectiveSchedule) {
    return { ok: false, error: "schedule_blocked" };
  }
  if (inicioMin < effectiveSchedule.open || requestedEnd > effectiveSchedule.close) {
    return { ok: false, error: "outside_hours" };
  }
  for (const b of blockedRanges) {
    if (rangesOverlap(inicioMin, requestedEnd, b.start, b.end)) {
      return { ok: false, error: "schedule_blocked" };
    }
  }

  const reservasSheet = getOrCreateReservasSheet();
  const conflict = findConflictingAppointment(reservasSheet, negocio, usuario, fecha, inicioMin, duracionMin, excludeId);
  if (conflict) {
    return { ok: false, error: "slot_taken" };
  }

  return { ok: true };
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
