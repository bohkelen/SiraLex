/**
 * SQ1D1 — FR→MNK stable partition of already-returned exact-hit records.
 *
 * Promotes index_mapping rows whose display.source_term matches the search
 * ladder key (same computeSearchKeys rung as the hit). Does not retrieve,
 * merge rungs, reorder EN/MNK lists, or touch prefix suggestions.
 *
 * Relative order inside the match and non-match partitions is preserved.
 */

import { computeSearchKeys, normalizeNfc, type SearchKeys } from "../norm/norm_v1";
import { isIndexMappingDisplay, type EnrichedRecord } from "../types/records";
import { isValidLookupMode, type LookupMode } from "./lookup_mode";

export type FrSourceTermRankingHit = {
  matchedKey: string | null;
  matchedKeyType: keyof SearchKeys | null;
};

function isFrToMnk(mode: LookupMode): boolean {
  return mode.from === "fr" && mode.to === "mnk";
}

function sourceTermLadderKey(
  sourceTerm: string,
  keyType: keyof SearchKeys,
): string | null {
  const trimmed = sourceTerm.trim();
  if (trimmed === "") return null;
  const keys = computeSearchKeys([normalizeNfc(trimmed)]);
  const value = keys[keyType]?.[0];
  return typeof value === "string" && value !== "" ? value : null;
}

function isFrSourceTermExactHit(
  record: EnrichedRecord,
  matchedKey: string,
  matchedKeyType: keyof SearchKeys,
): boolean {
  if (!isIndexMappingDisplay(record)) return false;
  const sourceTerm = record.display.source_term;
  if (typeof sourceTerm !== "string") return false;
  const normalized = sourceTermLadderKey(sourceTerm, matchedKeyType);
  return normalized === matchedKey;
}

/**
 * Stable-partition FR→MNK exact/variant hit records by source_term match.
 *
 * Comparison uses `matchedKey` + `matchedKeyType` from the ladder (including
 * SQ1C variant retries). Raw typed text is not used when those are present.
 * Other LookupMode pairs are returned unchanged.
 */
export function partitionFrExactSourceTermHits(
  records: readonly EnrichedRecord[],
  lookupMode: LookupMode,
  hit: FrSourceTermRankingHit,
): EnrichedRecord[] {
  if (!isValidLookupMode(lookupMode) || !isFrToMnk(lookupMode)) {
    return records.slice();
  }
  const matchedKey = hit.matchedKey;
  const matchedKeyType = hit.matchedKeyType;
  if (
    typeof matchedKey !== "string" ||
    matchedKey === "" ||
    matchedKeyType == null
  ) {
    return records.slice();
  }

  const matches: EnrichedRecord[] = [];
  const rest: EnrichedRecord[] = [];
  for (const record of records) {
    if (isFrSourceTermExactHit(record, matchedKey, matchedKeyType)) {
      matches.push(record);
    } else {
      rest.push(record);
    }
  }
  return matches.concat(rest);
}
