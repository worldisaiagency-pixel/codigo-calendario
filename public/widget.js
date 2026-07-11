/**
 * Agenda booking widget — dropped into a business's own website via:
 *   <script src="https://<this-app-domain>/widget.js"
 *           data-negocio="Solycann" data-usuario="Solycann" defer></script>
 *
 * Adds a floating "Reservar cita" button that links to that business's
 * public booking page (/reservar?negocio=...&usuario=...). Any element on
 * the host page can also be wired to the same link by giving it
 * data-agenda-booking instead of (or in addition to) the floating button —
 * e.g. an existing "Reservar cita" button already on the page.
 *
 * Plain vanilla JS, no dependencies, no build step: this file is served
 * as-is (see /public in the Next.js app) and runs directly in the host
 * site's page, which we don't control and can't assume anything about.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;

  var negocio = script.getAttribute("data-negocio") || "";
  var usuario = script.getAttribute("data-usuario") || "";
  if (!negocio || !usuario) return;

  var origin;
  try {
    origin = new URL(script.src).origin;
  } catch {
    return;
  }

  var url =
    origin +
    "/reservar?" +
    new URLSearchParams({ negocio: negocio, usuario: usuario }).toString();

  function goToBooking(e) {
    e.preventDefault();
    window.location.href = url;
  }

  var existingTriggers = document.querySelectorAll("[data-agenda-booking]");
  existingTriggers.forEach(function (el) {
    el.addEventListener("click", goToBooking);
  });

  // Only add the floating button if the page didn't wire its own trigger —
  // avoids showing a redundant second "Reservar cita" button on sites that
  // already have one.
  if (existingTriggers.length > 0) return;

  var btn = document.createElement("a");
  btn.href = url;
  btn.textContent = "Reservar cita";
  btn.setAttribute("rel", "noopener");
  btn.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:2147483647",
    "background:#111",
    "color:#fff",
    "padding:14px 22px",
    "border-radius:999px",
    "font:600 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "text-decoration:none",
    "box-shadow:0 4px 16px rgba(0,0,0,.25)",
  ].join(";");
  document.body.appendChild(btn);
})();
