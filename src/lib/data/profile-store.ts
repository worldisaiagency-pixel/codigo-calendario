"use client";

import { emptyProfile } from "./types";
import type { BusinessProfile } from "./types";

const PREFIX = "peluqueria:profile:";

/** Per-business, per-device profile storage. Not synced across
 * devices/browsers — same tradeoff as appointments/dogs/owners, which are
 * also plain localStorage today (see realtime/local-table.ts). */
export function loadProfile(businessId: string): BusinessProfile {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const raw = window.localStorage.getItem(PREFIX + businessId);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw);
    return { ...emptyProfile(), ...parsed };
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(businessId: string, profile: BusinessProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFIX + businessId, JSON.stringify(profile));
}
