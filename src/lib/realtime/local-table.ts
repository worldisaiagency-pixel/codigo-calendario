import type { RealtimeChangePayload, RealtimeTable } from "./types";

/** Same-origin, cross-tab "realtime" using BroadcastChannel + localStorage —
 * a stand-in for Supabase Realtime's postgres_changes. Every table here will
 * later become `supabase.channel(name).on('postgres_changes', {event:'*',
 * schema:'public', table:name}, applyPayload).subscribe()`, with insert/
 * update/remove becoming the matching supabase-js `.from(name)` calls. */
export function createLocalTable<T extends { id: string }>(
  tableName: string,
  seed: T[]
): RealtimeTable<T> {
  const storageKey = `peluqueria:${tableName}`;
  const listeners = new Set<(payload: RealtimeChangePayload<T>) => void>();
  let rows: T[] = seed;
  let channel: BroadcastChannel | null = null;

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) rows = JSON.parse(raw) as T[];
    } catch {
      // corrupted storage — fall back to seed
    }
    channel = new BroadcastChannel(storageKey);
    channel.onmessage = (event: MessageEvent<RealtimeChangePayload<T>>) => {
      applyPayload(event.data, { persist: true, broadcast: false });
    };
  }

  function applyPayload(
    payload: RealtimeChangePayload<T>,
    opts: { persist: boolean; broadcast: boolean }
  ) {
    if (payload.eventType === "INSERT" && payload.new) {
      if (!rows.some((r) => r.id === payload.new!.id)) {
        rows = [...rows, payload.new];
      }
    } else if (payload.eventType === "UPDATE" && payload.new) {
      rows = rows.map((r) => (r.id === payload.new!.id ? payload.new! : r));
    } else if (payload.eventType === "DELETE" && payload.old) {
      rows = rows.filter((r) => r.id !== payload.old!.id);
    }

    if (opts.persist && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(rows));
    }
    if (opts.broadcast) channel?.postMessage(payload);
    for (const listener of listeners) listener(payload);
  }

  return {
    list: () => rows,
    insert: (row) =>
      applyPayload({ eventType: "INSERT", new: row, old: null }, { persist: true, broadcast: true }),
    update: (id, patch) => {
      const existing = rows.find((r) => r.id === id);
      if (!existing) return;
      applyPayload(
        { eventType: "UPDATE", new: { ...existing, ...patch }, old: existing },
        { persist: true, broadcast: true }
      );
    },
    remove: (id) => {
      const existing = rows.find((r) => r.id === id);
      if (!existing) return;
      applyPayload(
        { eventType: "DELETE", new: null, old: existing },
        { persist: true, broadcast: true }
      );
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
