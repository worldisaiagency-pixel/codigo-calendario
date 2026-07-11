/** Hardcoded admin login — not a Sheet row. Deliberately simple per the
 * owner's request, but worth knowing: this check runs client-side, so these
 * two values are visible to anyone who opens devtools on the deployed app.
 * It keeps casual/accidental access out, not a determined attacker — treat
 * it as a PIN, not real authentication. */
const ADMIN_NEGOCIO = "worldwork";
const ADMIN_USUARIO = "2008";

export function isAdminCredentials(negocio: string, usuario: string): boolean {
  return negocio.trim().toLowerCase() === ADMIN_NEGOCIO && usuario.trim() === ADMIN_USUARIO;
}

/** True as soon as the negocio field alone matches — used to decide whether
 * a failed login should count toward the brute-force throttle, independent
 * of whether the usuario guess was right. */
export function isAdminNegocio(negocio: string): boolean {
  return negocio.trim().toLowerCase() === ADMIN_NEGOCIO;
}
