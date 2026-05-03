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

function toDirectionalKeyType(direction: SearchDirection, keyType: keyof SearchKeys): string {
  return `${direction === "source_to_target" ? "src" : "tgt"}_${keyType}`;
}

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
 * Phase 4.2.5: Prefer directional key types (src_* / tgt_*) so that the
 * selected search direction only hits keys for that side. For bundles built
 * before directional indexing (legacy bundles with undirected key_type like
 * "casefold"), falls back to the undirected ladder so search still works.
 *
 * Future improvement (recommended): Use a bundle-level capability flag
 * (e.g. manifest "search_index_directional": true) so that:
 * - Directional bundle → NEVER fallback; use only the directional ladder.
 * - Legacy bundle → ALWAYS use the legacy (undirected) ladder only.
 * This avoids hybrid "try directional then fallback" logic, which can cause
 * subtle ranking distortions (e.g. weak directional match vs strong legacy
 * match producing confusing result order).
 *
 * @returns Ordered ir_id list from the first matching level, or empty if
 *          no level matches. The result preserves the stored ir_ids[] order.
 */
export async function searchQuery(
  db: IDBDatabase,
  activeBundleId: string,
  direction: SearchDirection,
  query: string,
): Promise<SearchResult> {
  const trimmed = query.trim();
  if (activeBundleId.trim() === "" || trimmed === "") {
    return { ir_ids: [], matched_key_type: null, matched_key: null };
  }

  const keys = computeSearchKeys([normalizeNfc(trimmed)]);

  const tx = db.transaction(STORE_SEARCH_INDEX, "readonly");
  const store = tx.objectStore(STORE_SEARCH_INDEX);

  // 1) Directional ladder (bundles built with Phase 4.2.5+ index)
  for (const keyType of KEY_TYPE_ORDER) {
    const normalizedKeys = keys[keyType];
    if (normalizedKeys.length === 0) continue;
    const directionalKeyType = toDirectionalKeyType(direction, keyType);

    for (const normalizedKey of normalizedKeys) {
      const entry = await idbGet<{ ir_ids: string[] }>(store, [activeBundleId, directionalKeyType, normalizedKey]);
      if (entry && Array.isArray(entry.ir_ids) && entry.ir_ids.length > 0) {
        return {
          ir_ids: entry.ir_ids,
          matched_key_type: keyType,
          matched_key: normalizedKey,
        };
      }
    }
  }

  // 2) Legacy fallback: undirected key types (bundles built before Phase 4.2.5)
  for (const keyType of KEY_TYPE_ORDER) {
    const normalizedKeys = keys[keyType];
    if (normalizedKeys.length === 0) continue;

    for (const normalizedKey of normalizedKeys) {
      const entry = await idbGet<{ ir_ids: string[] }>(store, [activeBundleId, keyType, normalizedKey]);
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
