/**
 * Phase 2.0.3b — Query execution (retrieval correctness).
 *
 * Single entry point: searchQuery(db, activeBundleId, direction, query) →
 * ordered ir_id[].
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

import { STORE_SEARCH_INDEX } from "../idb/siralex_db";
import { computeSearchKeys, normalizeNfc, type SearchKeys } from "../norm/norm_v1";
import type { SearchDirection } from "../bundle_labels";

const KEY_TYPE_ORDER: (keyof SearchKeys)[] = [
  "casefold",
  "diacritics_insensitive",
  "punct_stripped",
  "nospace",
];

const EMPTY_SEARCH_KEYS: SearchKeys = {
  casefold: [],
  diacritics_insensitive: [],
  punct_stripped: [],
  nospace: [],
};

function toDirectionalKeyType(direction: SearchDirection, keyType: keyof SearchKeys): string {
  return `${direction === "source_to_target" ? "src" : "tgt"}_${keyType}`;
}

export type SearchResult = {
  ir_ids: string[];
  matched_key_type: keyof SearchKeys | null;
  matched_key: string | null;
  query_normalized_keys: SearchKeys;
  last_tried_normalized_key: string | null;
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
 * The search path is selected by a bundle-level capability flag:
 * - directional bundle -> directional key families only (src_* / tgt_*)
 * - legacy bundle -> undirected key families only
 * No mixed fallback is allowed.
 *
 * @returns Ordered ir_id list from the first matching level, or empty if
 *          no level matches. The result preserves the stored ir_ids[] order.
 */
export async function searchQuery(
  db: IDBDatabase,
  activeBundleId: string,
  direction: SearchDirection,
  query: string,
  searchIndexDirectional: boolean,
): Promise<SearchResult> {
  const trimmed = query.trim();
  if (activeBundleId.trim() === "" || trimmed === "") {
    return {
      ir_ids: [],
      matched_key_type: null,
      matched_key: null,
      query_normalized_keys: EMPTY_SEARCH_KEYS,
      last_tried_normalized_key: null,
    };
  }

  const keys = computeSearchKeys([normalizeNfc(trimmed)]);

  const tx = db.transaction(STORE_SEARCH_INDEX, "readonly");
  const store = tx.objectStore(STORE_SEARCH_INDEX);

  let lastTriedNormalizedKey: string | null = null;

  // Exactly one ladder is used, selected by bundle contract.
  for (const keyType of KEY_TYPE_ORDER) {
    const normalizedKeys = keys[keyType];
    if (normalizedKeys.length === 0) continue;
    const storageKeyType = searchIndexDirectional ? toDirectionalKeyType(direction, keyType) : keyType;

    for (const normalizedKey of normalizedKeys) {
      lastTriedNormalizedKey = normalizedKey;
      const entry = await idbGet<{ ir_ids: string[] }>(store, [activeBundleId, storageKeyType, normalizedKey]);
      if (entry && Array.isArray(entry.ir_ids) && entry.ir_ids.length > 0) {
        return {
          ir_ids: entry.ir_ids,
          matched_key_type: keyType,
          matched_key: normalizedKey,
          query_normalized_keys: keys,
          last_tried_normalized_key: normalizedKey,
        };
      }
    }
  }

  return {
    ir_ids: [],
    matched_key_type: null,
    matched_key: null,
    query_normalized_keys: keys,
    last_tried_normalized_key: lastTriedNormalizedKey,
  };
}
