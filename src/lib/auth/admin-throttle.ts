/** Best-effort client-side brute-force throttle for the admin PIN (see
 * admin.ts) — keyed in localStorage, so it only slows down someone
 * repeatedly guessing the usuario value through the actual login form. It
 * does nothing against someone reading the hardcoded value out of the
 * bundle or clearing their storage; it's a deterrent, not real security. */

const STORAGE_KEY = "admin-login-throttle";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

interface ThrottleState {
  count: number;
  lockedUntil: number | null;
}

function read(): ThrottleState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, lockedUntil: null };
    const parsed = JSON.parse(raw);
    return {
      count: typeof parsed.count === "number" ? parsed.count : 0,
      lockedUntil: typeof parsed.lockedUntil === "number" ? parsed.lockedUntil : null,
    };
  } catch {
    return { count: 0, lockedUntil: null };
  }
}

function write(state: ThrottleState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable — throttle just won't persist across reloads.
  }
}

/** Call before checking credentials. If locked, don't even evaluate the
 * password — that's what actually stops rapid-fire guessing. */
export function checkAdminThrottle(): { locked: boolean; retryAfterSec: number } {
  const state = read();
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    return { locked: true, retryAfterSec: Math.ceil((state.lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false, retryAfterSec: 0 };
}

/** Call after every admin-login attempt (whether or not it was a match).
 * A success clears the counter; a failure counts toward the lockout. */
export function recordAdminAttempt(success: boolean) {
  if (success) {
    write({ count: 0, lockedUntil: null });
    return;
  }
  const state = read();
  const count = state.count + 1;
  write(
    count >= MAX_ATTEMPTS
      ? { count: 0, lockedUntil: Date.now() + LOCKOUT_MS }
      : { count, lockedUntil: null }
  );
}
