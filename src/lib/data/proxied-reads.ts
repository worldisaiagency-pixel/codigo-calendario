// Client-safe reads — call this app's own Netlify Functions instead of
// fetching Google's CSV export directly, so the browser bundle never
// needs to know SHEET_ID/SHEET_GID at all (see list-businesses.ts and
// list-reservas.ts for why). sheets-provider.ts / reservas-sync.ts /
// config.ts stay as the server-side implementation those functions call
// into — nothing client-side should import them directly anymore.
import type { Business, ScheduleOverride } from "./types";
import type { PendingReserva } from "./reservas-sync";
import type { DataProvider } from "./provider";

export const proxiedDataProvider: DataProvider = {
  async listBusinesses(): Promise<Business[]> {
    const res = await fetch("/.netlify/functions/list-businesses", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`No se pudo leer la hoja de negocios (${res.status})`);
    }
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || "No se pudo leer la hoja de negocios");
    }
    return data.businesses as Business[];
  },
};

export async function fetchReservasProxied(negocio: string, usuario: string): Promise<PendingReserva[]> {
  try {
    const params = new URLSearchParams({ negocio, usuario });
    const res = await fetch(`/.netlify/functions/list-reservas?${params}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.ok) return [];
    return data.reservas as PendingReserva[];
  } catch {
    return [];
  }
}

export async function fetchOverridesProxied(negocio: string, usuario: string): Promise<ScheduleOverride[]> {
  try {
    const params = new URLSearchParams({ negocio, usuario });
    const res = await fetch(`/.netlify/functions/list-overrides?${params}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.ok) return [];
    return data.overrides as ScheduleOverride[];
  } catch {
    return [];
  }
}
