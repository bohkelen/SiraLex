/**
 * SQ1B — Bounded prefix suggestions after an exact-search miss.
 *
 * Exact retrieval stays in search_query.ts. This module only lists indexed
 * keys in the active LookupMode family whose stored key starts with the
 * query's normalized ladder key.
 *
 * No fuzzy/edit-distance, no morphology, no bag-of-words, no rung merging,
 * no IDB schema change. Prefix range uses the existing compound key
 * [bundle_id, key_type, key].
 */

import { STORE_SEARCH_INDEX } from "../idb/siralex_db";
import { computeSearchKeys, normalizeNfc, type SearchKeys } from "../norm/norm_v1";
import {
  assertBundleSupportsLookupMode,
  assertValidLookupMode,
  indexFamilyForLookupInput,
  type LookupCapabilityMeta,
  type LookupMode,
} from "./lookup_mode";
import { SEARCH_LADDER_KEY_TYPES } from "./search_query";

export const SEARCH_SUGGESTION_MIN_NORMALIZED_LENGTH = 3;
export const SEARCH_SUGGESTION_MAX_VISIBLE = 8;
export const SEARCH_SUGGESTION_MAX_INSPECTED = 64;
/** Inclusive IDB upper-bound suffix; all BMP continuation chars sort at or below this. */
export const SEARCH_SUGGESTION_RANGE_SENTINEL = "\uFFFF";

export type PrefixSuggestion = {
  key: string;
  matched_key_type: keyof SearchKeys;
};

export type PrefixSuggestionResult = {
  suggestions: PrefixSuggestion[];
  matched_key_type: keyof SearchKeys | null;
  inspected: number;
};

const EMPTY_PREFIX_RESULT: PrefixSuggestionResult = {
  suggestions: [],
  matched_key_type: null,
  inspected: 0,
};

export function countNormalizedCharacters(value: string): number {
  return Array.from(value).length;
}

export function shouldOfferPrefixSuggestions(normalizedKey: string): boolean {
  return countNormalizedCharacters(normalizedKey) >= SEARCH_SUGGESTION_MIN_NORMALIZED_LENGTH;
}

function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Suggestion order (SQ1B only):
 * 1. exact normalized-key equality
 * 2. shorter key before longer
 * 3. code-point lexical order
 */
export function rankPrefixSuggestionKeys(
  candidates: readonly string[],
  normalizedQuery: string,
  maxVisible: number = SEARCH_SUGGESTION_MAX_VISIBLE,
): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const key of candidates) {
    if (typeof key !== "string" || key === "" || !key.startsWith(normalizedQuery)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(key);
  }
  unique.sort((a, b) => {
    const aExact = a === normalizedQuery ? 0 : 1;
    const bExact = b === normalizedQuery ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const aLen = countNormalizedCharacters(a);
    const bLen = countNormalizedCharacters(b);
    if (aLen !== bLen) return aLen - bLen;
    return compareCodePoints(a, b);
  });
  return unique.slice(0, maxVisible);
}

function toLookupStorageKeyType(
  mode: LookupMode,
  keyType: keyof SearchKeys,
  searchIndexDirectional: boolean,
): string {
  if (!searchIndexDirectional) {
    return keyType;
  }
  return `${indexFamilyForLookupInput(mode.from)}_${keyType}`;
}

function primaryNormalizedKey(keys: SearchKeys): string | null {
  for (const keyType of SEARCH_LADDER_KEY_TYPES) {
    const value = keys[keyType]?.[0];
    if (typeof value === "string" && value !== "") return value;
  }
  return null;
}

function idbCollectPrefixKeys(
  store: IDBObjectStore,
  bundleId: string,
  storageKeyType: string,
  prefix: string,
  maxInspected: number,
): Promise<string[]> {
  const range = IDBKeyRange.bound(
    [bundleId, storageKeyType, prefix],
    [bundleId, storageKeyType, prefix + SEARCH_SUGGESTION_RANGE_SENTINEL],
  );

  return new Promise((resolve, reject) => {
    const collected: string[] = [];
    const req = store.openCursor(range);
    req.addEventListener("error", () => reject(req.error));
    req.addEventListener("success", () => {
      const cursor = req.result;
      if (!cursor || collected.length >= maxInspected) {
        resolve(collected);
        return;
      }
      const row = cursor.value as { key?: unknown; ir_ids?: unknown };
      const key = typeof row.key === "string" ? row.key : "";
      const irIds = row.ir_ids;
      if (
        key.startsWith(prefix) &&
        Array.isArray(irIds) &&
        irIds.length > 0 &&
        irIds.every((id) => typeof id === "string")
      ) {
        collected.push(key);
      }
      cursor.continue();
    });
  });
}

/**
 * Prefix completions for the active LookupMode family after an exact miss.
 *
 * Walks the same ladder order as exact search and stops at the first rung
 * that yields any prefix candidates. Does not merge rungs or cross families.
 */
export async function lookupPrefixSuggestionsForLookupMode(
  db: IDBDatabase,
  storageScopeId: string,
  lookupMode: LookupMode,
  query: string,
  searchIndexDirectional: boolean,
  capabilityMeta: LookupCapabilityMeta = {},
): Promise<PrefixSuggestionResult> {
  assertValidLookupMode(lookupMode);
  assertBundleSupportsLookupMode(capabilityMeta, lookupMode);

  const trimmed = query.trim();
  if (storageScopeId.trim() === "" || trimmed === "") {
    return EMPTY_PREFIX_RESULT;
  }

  const keys = computeSearchKeys([normalizeNfc(trimmed)]);
  const gateKey = primaryNormalizedKey(keys);
  if (gateKey === null || !shouldOfferPrefixSuggestions(gateKey)) {
    return EMPTY_PREFIX_RESULT;
  }

  const tx = db.transaction(STORE_SEARCH_INDEX, "readonly");
  const store = tx.objectStore(STORE_SEARCH_INDEX);

  for (const keyType of SEARCH_LADDER_KEY_TYPES) {
    const normalizedKeys = keys[keyType];
    if (normalizedKeys.length === 0) continue;
    const storageKeyType = toLookupStorageKeyType(
      lookupMode,
      keyType,
      searchIndexDirectional,
    );

    for (const normalizedKey of normalizedKeys) {
      if (!shouldOfferPrefixSuggestions(normalizedKey)) continue;
      const inspectedKeys = await idbCollectPrefixKeys(
        store,
        storageScopeId,
        storageKeyType,
        normalizedKey,
        SEARCH_SUGGESTION_MAX_INSPECTED,
      );
      const ranked = rankPrefixSuggestionKeys(inspectedKeys, normalizedKey);
      if (ranked.length === 0) continue;
      return {
        suggestions: ranked.map((key) => ({ key, matched_key_type: keyType })),
        matched_key_type: keyType,
        inspected: inspectedKeys.length,
      };
    }
  }

  return EMPTY_PREFIX_RESULT;
}
