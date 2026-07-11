import { formatHoursCompact, formatServiceLine, formatVacationLine } from "./sheet-format";
import type { BusinessProfile } from "./types";

/** Posts to the Netlify Function that forwards to the Apps Script Web App
 * holding write access to the Sheet (the shared secret never reaches the
 * browser — see netlify/functions/save-profile.ts and
 * scripts/sheet-write-apps-script.js). Returns whether it succeeded. */
async function postToSheetBridge(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/.netlify/functions/save-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The business owner's own save — replaces services/hours/vacations,
 * leaves identity (negocio/usuario/web) untouched on the Sheet side. */
export async function saveProfileToSheet(params: {
  negocio: string;
  usuario: string;
  profile: BusinessProfile;
}): Promise<boolean> {
  const { negocio, usuario, profile } = params;
  return postToSheetBridge({
    action: "saveProfile",
    negocio,
    usuario,
    serviciosLines: profile.services.map(formatServiceLine),
    horarios: formatHoursCompact(profile.hours),
    vacacionesLines: profile.vacations.map(formatVacationLine),
  });
}

/** Admin-only: renames a business and/or changes its website link, leaving
 * services/hours/vacations exactly as they were. */
export async function updateBusinessIdentity(params: {
  oldNegocio: string;
  oldUsuario: string;
  negocio: string;
  usuario: string;
  websiteUrl: string;
}): Promise<boolean> {
  return postToSheetBridge({
    action: "updateIdentity",
    oldNegocio: params.oldNegocio,
    oldUsuario: params.oldUsuario,
    negocio: params.negocio,
    usuario: params.usuario,
    web: params.websiteUrl,
  });
}

/** Admin-only: appends a brand-new, unconfigured business block so it can
 * log in and self-configure its own profile. */
export async function createBusinessInSheet(params: {
  negocio: string;
  usuario: string;
  websiteUrl: string;
}): Promise<boolean> {
  return postToSheetBridge({
    action: "createBusiness",
    negocio: params.negocio,
    usuario: params.usuario,
    web: params.websiteUrl,
  });
}

/** Admin-only: removes a business's entire block from the Sheet. */
export async function deleteBusinessFromSheet(params: {
  negocio: string;
  usuario: string;
}): Promise<boolean> {
  return postToSheetBridge({
    action: "deleteBusiness",
    negocio: params.negocio,
    usuario: params.usuario,
  });
}

/** Appends one row to the shared "Reservas" tab — called both by the app's
 * own store (origin "app") and the public booking page (origin "web"), so
 * every appointment, wherever it was made, ends up in the same queue. */
export async function createAppointmentInSheet(params: {
  id: string;
  negocio: string;
  usuario: string;
  date: string;
  startMin: number;
  durationMin: number;
  service: string;
  ownerName: string;
  phone: string;
  dogName: string;
  breed: string;
  status: string;
  origin: "app" | "web";
}): Promise<boolean> {
  return postToSheetBridge({
    action: "createAppointment",
    id: params.id,
    negocio: params.negocio,
    usuario: params.usuario,
    fecha: params.date,
    inicioMin: params.startMin,
    duracionMin: params.durationMin,
    servicio: params.service,
    cliente: params.ownerName,
    telefono: params.phone,
    perro: params.dogName,
    raza: params.breed,
    estado: params.status,
    origen: params.origin,
  });
}

/** Patches only the fields provided (used by the app's reschedule/rebooking
 * flow) — leaves everything else in that Reservas row untouched. */
export async function updateAppointmentInSheet(params: {
  id: string;
  date?: string;
  startMin?: number;
  durationMin?: number;
  service?: string;
  status?: string;
}): Promise<boolean> {
  return postToSheetBridge({
    action: "updateAppointment",
    id: params.id,
    fecha: params.date,
    inicioMin: params.startMin,
    duracionMin: params.durationMin,
    servicio: params.service,
    estado: params.status,
  });
}

export async function deleteAppointmentFromSheet(params: { id: string }): Promise<boolean> {
  return postToSheetBridge({ action: "deleteAppointment", id: params.id });
}
