import type { Business } from "./types";

/** Everything the rest of the app knows about where business config comes
 * from. Swapping Google Sheets for Supabase/Firebase/Postgres later means
 * writing one new implementation of this interface and changing the export
 * in `index.ts` — nothing else references the backend directly. */
export interface DataProvider {
  listBusinesses(): Promise<Business[]>;
}
