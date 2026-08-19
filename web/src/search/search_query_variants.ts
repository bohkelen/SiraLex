/**
 * SQ1C1/SQ1C2 — bounded orthographic query variants after an exact miss.
 *
 * ASCII hyphen ↔ space (FR/EN) and French œ → oe (FR only).
 * Still exact-key search on those surfaces — not fuzzy, typo, or morphology.
 */

import { computeSearchKeys, normalizeNfc, normalizeWhitespace } from "../norm/norm_v1";
import type { LookupMode } from "./lookup_mode";

export const HYPHEN_SPACE_EXPANSION_MAX_VARIANTS = 2;
/** Ligature (≤1) + hyphen/space (≤2). Combinations are not generated. */
export const SAFE_QUERY_VARIANT_MAX = 3;

const ASCII_HYPHEN = "-";
const ASCII_SPACE = " ";
const OE_SMALL = "œ";
const OE_CAPITAL = "Œ";

export function hyphenSpaceExpansionAllowed(mode: LookupMode): boolean {
  return mode.from === "fr" || mode.from === "en";
}

export function frenchLigatureExpansionAllowed(mode: LookupMode): boolean {
  return mode.from === "fr";
}

function casefoldKey(query: string): string | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  const key = computeSearchKeys([normalizeNfc(trimmed)]).casefold[0];
  return typeof key === "string" && key !== "" ? key : null;
}

function pushUniqueVariant(
  variants: string[],
  seen: Set<string>,
  candidate: string,
  max: number,
): void {
  if (variants.length >= max) return;
  const key = casefoldKey(candidate);
  if (key === null || seen.has(key)) return;
  seen.add(key);
  variants.push(candidate);
}

/**
 * At most one French œ/Œ → oe surface. Does not include the original query.
 */
export function frenchLigatureExpansionQueries(query: string): string[] {
  const collapsed = normalizeWhitespace(normalizeNfc(query));
  if (collapsed === "" || (!collapsed.includes(OE_SMALL) && !collapsed.includes(OE_CAPITAL))) {
    return [];
  }
  const expanded = collapsed.replaceAll(OE_SMALL, "oe").replaceAll(OE_CAPITAL, "oe");
  const originalKey = casefoldKey(query);
  const expandedKey = casefoldKey(expanded);
  if (!expandedKey || expandedKey === originalKey) return [];
  return [expanded];
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
    pushUniqueVariant(variants, seen, candidate, HYPHEN_SPACE_EXPANSION_MAX_VARIANTS);
  }
  return variants;
}

/**
 * LookupMode-gated exact-retry surfaces, original first at the caller.
 * Order: French ligature, then hyphen/space. Cap SAFE_QUERY_VARIANT_MAX.
 */
export function safeQueryVariants(query: string, mode: LookupMode): string[] {
  const seen = new Set<string>();
  const originalKey = casefoldKey(query);
  if (originalKey) seen.add(originalKey);

  const variants: string[] = [];
  if (frenchLigatureExpansionAllowed(mode)) {
    for (const candidate of frenchLigatureExpansionQueries(query)) {
      pushUniqueVariant(variants, seen, candidate, SAFE_QUERY_VARIANT_MAX);
    }
  }
  if (hyphenSpaceExpansionAllowed(mode)) {
    for (const candidate of hyphenSpaceExpansionQueries(query)) {
      pushUniqueVariant(variants, seen, candidate, SAFE_QUERY_VARIANT_MAX);
    }
  }
  return variants;
}
