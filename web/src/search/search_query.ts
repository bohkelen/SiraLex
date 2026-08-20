/**
 * Phase 2.0.3b — Query execution (retrieval correctness).
 *
 * Single entry point (legacy): searchQuery(db, activeBundleId, direction, query) →
 * ordered ir_id[].
 *
 * Preferred multilingual API: searchQueryForLookupMode(...).
 *
 * Uses computeSearchKeys from norm_v1.ts (the same normalization path as the
 * import pipeline) to derive 4 search keys from the raw query string.
 * Walks the "exactness ladder" (casefold → diacritics_insensitive →
 * punct_stripped → nospace), stopping at the first level that yields a
 * non-empty ir_ids[] from the search_index store.
 *
 * Exact retrieval does not prefix-match, fuzzy-match, merge ladder rungs, or
 * re-rank postings. After an exact miss, LookupMode may retry bounded
 * orthographic surfaces (French œ→oe, then FR/EN hyphen↔space) from
 * search_query_variants.ts. Prefix *suggestions* after that miss live in
 * search_suggestions.ts and never merge into ir_ids[].
 * FR→MNK source_term promotion (SQ1D1) runs after record resolve in
 * search_result_ranking.ts; this module still returns stored ir_ids[] order.
 */

import { STORE_SEARCH_INDEX } from "../idb/siralex_db";
import { computeSearchKeys, normalizeNfc, type SearchKeys } from "../norm/norm_v1";
import type { SearchDirection } from "../bundle_labels";
import {
  LookupCapabilityError,
  assertBundleSupportsLookupMode,
  assertValidLookupMode,
  indexFamilyForLookupInput,
  lookupModeFromLegacySearchDirection,
  type LookupCapabilityMeta,
  type LookupMode,
} from "./lookup_mode";
import { safeQueryVariants } from "./search_query_variants";

export const SEARCH_LADDER_KEY_TYPES: readonly (keyof SearchKeys)[] = [
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

function toLookupKeyType(mode: LookupMode, keyType: keyof SearchKeys): string {
  return `${indexFamilyForLookupInput(mode.from)}_${keyType}`;
}

export type SearchResult = {
  ir_ids: string[];
  matched_key_type: keyof SearchKeys | null;
  matched_key: string | null;
  query_normalized_keys: SearchKeys;
  last_tried_normalized_key: string | null;
  /** Orthographic variant surface that produced a hit (hyphen/space or œ→oe). */
  separator_variant_query?: string | null;
};

function idbGet<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.addEventListener("success", () => resolve(req.result as T | undefined));
    req.addEventListener("error", () => reject(req.error));
  });
}

async function runExactnessLadder(args: {
  db: IDBDatabase;
  activeBundleId: string;
  query: string;
  resolveStorageKeyType: (keyType: keyof SearchKeys) => string;
}): Promise<SearchResult> {
  const trimmed = args.query.trim();
  if (args.activeBundleId.trim() === "" || trimmed === "") {
    return {
      ir_ids: [],
      matched_key_type: null,
      matched_key: null,
      query_normalized_keys: EMPTY_SEARCH_KEYS,
      last_tried_normalized_key: null,
      separator_variant_query: null,
    };
  }

  const keys = computeSearchKeys([normalizeNfc(trimmed)]);

  const tx = args.db.transaction(STORE_SEARCH_INDEX, "readonly");
  const store = tx.objectStore(STORE_SEARCH_INDEX);

  let lastTriedNormalizedKey: string | null = null;

  for (const keyType of SEARCH_LADDER_KEY_TYPES) {
    const normalizedKeys = keys[keyType];
    if (normalizedKeys.length === 0) continue;
    const storageKeyType = args.resolveStorageKeyType(keyType);

    for (const normalizedKey of normalizedKeys) {
      lastTriedNormalizedKey = normalizedKey;
      const entry = await idbGet<{ ir_ids: string[] }>(store, [
        args.activeBundleId,
        storageKeyType,
        normalizedKey,
      ]);
      if (entry && Array.isArray(entry.ir_ids) && entry.ir_ids.length > 0) {
        return {
          ir_ids: entry.ir_ids,
          matched_key_type: keyType,
          matched_key: normalizedKey,
          query_normalized_keys: keys,
          last_tried_normalized_key: normalizedKey,
          separator_variant_query: null,
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
    separator_variant_query: null,
  };
}

/**
 * Preferred multilingual search API.
 *
 * Capability: English endpoints require installed metadata advertising both
 * lookup_languages includes "en" and search_key_families includes "en".
 * Fail closed — never silently search src_* for English.
 */
export async function searchQueryForLookupMode(
  db: IDBDatabase,
  storageScopeId: string,
  lookupMode: LookupMode,
  query: string,
  searchIndexDirectional: boolean,
  capabilityMeta: LookupCapabilityMeta = {},
): Promise<SearchResult> {
  assertValidLookupMode(lookupMode);
  assertBundleSupportsLookupMode(capabilityMeta, lookupMode);
  if (
    (lookupMode.from === "en" || lookupMode.to === "en") &&
    searchIndexDirectional !== true
  ) {
    throw new LookupCapabilityError(
      "english_lookup_unsupported",
      "English lookup requires a directional search index",
    );
  }

  const resolveStorageKeyType = (keyType: keyof SearchKeys) => {
    if (!searchIndexDirectional) {
      // Legacy undirected indexes: FR↔MNK only (EN already rejected above).
      return keyType;
    }
    return toLookupKeyType(lookupMode, keyType);
  };

  const original = await runExactnessLadder({
    db,
    activeBundleId: storageScopeId,
    query,
    resolveStorageKeyType,
  });

  if (original.ir_ids.length > 0) {
    return original;
  }

  for (const variantQuery of safeQueryVariants(query, lookupMode)) {
    const expanded = await runExactnessLadder({
      db,
      activeBundleId: storageScopeId,
      query: variantQuery,
      resolveStorageKeyType,
    });
    if (expanded.ir_ids.length > 0) {
      return {
        ...expanded,
        separator_variant_query: variantQuery,
      };
    }
  }

  return original;
}

/**
 * Search the IndexedDB search_index store using the exactness ladder.
 *
 * Legacy adapter: source_to_target ⇒ FR→MNK; target_to_source ⇒ MNK→FR.
 * Never silently reinterpret source_to_target as English.
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
  // Preserve exact legacy family selection for FR↔MNK callers/tests.
  return runExactnessLadder({
    db,
    activeBundleId,
    query,
    resolveStorageKeyType: (keyType) =>
      searchIndexDirectional ? toDirectionalKeyType(direction, keyType) : keyType,
  });
}

/** Test/harness helper: run legacy SearchDirection via LookupMode adapter. */
export async function searchQueryViaLegacyAdapter(
  db: IDBDatabase,
  storageScopeId: string,
  direction: SearchDirection,
  query: string,
  searchIndexDirectional: boolean,
  capabilityMeta: LookupCapabilityMeta = {},
): Promise<SearchResult> {
  return searchQueryForLookupMode(
    db,
    storageScopeId,
    lookupModeFromLegacySearchDirection(direction),
    query,
    searchIndexDirectional,
    capabilityMeta,
  );
}
