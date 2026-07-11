/** Shaped to match supabase-js's RealtimePostgresChangesPayload so a table
 * built on `createLocalTable` can be swapped for a real Supabase Realtime
 * channel later without touching any calling code. */
export interface RealtimeChangePayload<T> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | null;
  old: T | null;
}

export interface RealtimeTable<T extends { id: string }> {
  list(): T[];
  insert(row: T): void;
  update(id: string, patch: Partial<T>): void;
  remove(id: string): void;
  subscribe(onChange: (payload: RealtimeChangePayload<T>) => void): () => void;
}
