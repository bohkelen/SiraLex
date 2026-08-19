/**
 * SQ1C1 — ASCII hyphen ↔ space query variants after an exact miss.
 *
 * This is still exact-key search on a bounded orthographic variant.
 * It is not fuzzy, typo, or morphological matching.
 */

import { computeSearchKeys, normalizeNfc, normalizeWhitespace } from "../norm/norm_v1";
import type { LookupMode } from "./lookup_mode";

export const HYPHEN_SPACE_EXPANSION_MAX_VARIANTS = 2;

const ASCII_HYPHEN = "-";
const ASCII_SPACE = " ";

export function hyphenSpaceExpansionAllowed(mode: LookupMode): boolean {
  return mode.from === "fr" || mode.from === "en";
}

function casefoldKey(query: string): string | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  const key = computeSearchKeys([normalizeNfc(trimmed)]).casefold[0];
  return typeof key === "string" && key !== "" ? key : null;
}

/**
 * At most two ASCII hyphen/space surface variants, deduped by casefold key.
 * Does not include the original query.
 */
export function hyphenSpaceExpansionQueries(query: string): string[] {
  const collapsed = normalizeWhitespace(normalizeNfc(query));
  if (collapsed === "") return [];

  const candidates: string[] = [];
  if (collapsed.includes(ASCII_SPACE)) {
    candidates.push(collapsed.split(ASCII_SPACE).join(ASCII_HYPHEN));
  }
  if (collapsed.includes(ASCII_HYPHEN)) {
    candidates.push(collapsed.split(ASCII_HYPHEN).join(ASCII_SPACE));
  }

  const seen = new Set<string>();
  const originalKey = casefoldKey(query);
  if (originalKey) seen.add(originalKey);

  const variants: string[] = [];
  for (const candidate of candidates) {
    const key = casefoldKey(candidate);
    if (key === null || seen.has(key)) continue;
    seen.add(key);
    variants.push(candidate);
    if (variants.length >= HYPHEN_SPACE_EXPANSION_MAX_VARIANTS) break;
  }
  return variants;
}
