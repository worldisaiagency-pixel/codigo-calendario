/** The public booking page's URL for one business — the same shape
 * negocio/usuario login uses, just read by /reservar instead. Built from
 * window.location.origin so this is correct in local dev and production
 * without hardcoding a domain. */
export function bookingUrl(business: { name: string; username: string }): string {
  const params = new URLSearchParams({ negocio: business.name, usuario: business.username });
  return `${window.location.origin}/reservar?${params.toString()}`;
}

/** A one-line <script> tag the business pastes into their own site (once)
 * to get a floating "Reservar cita" button wired to their booking page —
 * see public/widget.js. Avoids hand-editing that site's own code, which
 * isn't always possible (e.g. a compiled/minified static export with no
 * accessible source). */
export function bookingEmbedSnippet(business: { name: string; username: string }): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<script src="${window.location.origin}/widget.js" data-negocio="${escape(
    business.name
  )}" data-usuario="${escape(business.username)}" defer></script>`;
}
