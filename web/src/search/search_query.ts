/**
 * Phase 2.0.3b — Query execution (retrieval correctness).
 *
 * Single entry point: searchQuery(db, query) → ordered ir_id[].
 *
 * Uses computeSearchKeys from norm_v1.ts (the same normalization path as the
 * import pipeline) to derive 4 search keys from the raw query string.
 * Walks the "exactness ladder" (casefold → diacritics_insensitive →
 * punct_stripped → nospace), stopping at the first level that yields a
 * non-empty ir_ids[] from the search_index store.
 *
 * No prefix search, no suggestions, no fuzzy matching, no merging across
 * levels, no client-side re-ranking.
 */

import { STORE_SEARCH_INDEX } from "../idb/nkokan_db";
import { computeSearchKeys, type SearchKeys } from "../norm/norm_v1";

const KEY_TYPE_ORDER: (keyof SearchKeys)[] = [
  "casefold",
  "diacritics_insensitive",
  "punct_stripped",
  "nospace",
];

export type SearchResult = {
  ir_ids: string[];
  matched_key_type: keyof SearchKeys | null;
  matched_key: string | null;
};

function idbGet<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.addEventListener("success", () => resolve(req.result as T | undefined));
    req.addEventListener("error", () => reject(req.error));
  });
}

/**
 * Search the IndexedDB search_index store using the exactness ladder.
 *
 * @returns Ordered ir_id list from the first matching level, or empty if
 *          no level matches. The result preserves the stored ir_ids[] order.
 */
export async function searchQuery(db: IDBDatabase, query: string): Promise<SearchResult> {
  const trimmed = query.trim();
  if (trimmed === "") {
    return { ir_ids: [], matched_key_type: null, matched_key: null };
  }

  const keys = computeSearchKeys([trimmed]);

  const tx = db.transaction(STORE_SEARCH_INDEX, "readonly");
  const store = tx.objectStore(STORE_SEARCH_INDEX);

  for (const keyType of KEY_TYPE_ORDER) {
    const normalizedKeys = keys[keyType];
    if (normalizedKeys.length === 0) continue;

    for (const normalizedKey of normalizedKeys) {
      const entry = await idbGet<{ ir_ids: string[] }>(store, [keyType, normalizedKey]);
      if (entry && Array.isArray(entry.ir_ids) && entry.ir_ids.length > 0) {
        return {
          ir_ids: entry.ir_ids,
          matched_key_type: keyType,
          matched_key: normalizedKey,
        };
      }
    }
  }

  return { ir_ids: [], matched_key_type: null, matched_key: null };
}
