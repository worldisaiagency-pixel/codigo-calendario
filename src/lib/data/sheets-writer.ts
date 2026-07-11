import { formatHoursCompact, formatServiceLine, formatVacationLine } from "./sheet-format";
import type { BusinessProfile } from "./types";

/** Writes a business's profile back to the Sheet via a Netlify Function
 * (which holds the Apps Script URL + shared secret server-side — see
 * netlify/functions/save-profile.ts and the Apps Script under
 * scripts/sheet-write-apps-script.js). Returns whether it succeeded. */
export async function saveProfileToSheet(params: {
  negocio: string;
  usuario: string;
  profile: BusinessProfile;
}): Promise<boolean> {
  const { negocio, usuario, profile } = params;
  try {
    const res = await fetch("/.netlify/functions/save-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        negocio,
        usuario,
        serviciosLines: profile.services.map(formatServiceLine),
        horarios: formatHoursCompact(profile.hours),
        vacacionesLines: profile.vacations.map(formatVacationLine),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
