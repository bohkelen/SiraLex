/**
 * ML1C2 — Multilingual lookup mode (ML1B contract).
 *
 * Valid consumer pairs all include Maninka as one endpoint:
 *   fr→mnk, en→mnk, mnk→fr, mnk→en
 *
 * Key families: fr→src_*, en→en_*, mnk→tgt_*
 * Preferred gloss language follows LookupMode.to (never Russian).
 *
 * Pure module: no IndexedDB, DOM, or search execution.
 */

import type { SearchDirection } from "../bundle_labels";

export type LookupLanguage = "fr" | "en" | "mnk";

export type LookupMode = {
  from: LookupLanguage;
  to: LookupLanguage;
};

export type LookupKeyFamily = "src" | "en" | "tgt";

export type PreferredGlossLanguage = "fr" | "en";

/** Installed/active metadata needed for English capability gating. */
export type LookupCapabilityMeta = {
  lookup_languages?: readonly string[];
  search_key_families?: readonly string[];
};

export type LookupCapabilityErrorCode =
  | "invalid_lookup_mode"
  | "english_lookup_unsupported";

export class LookupCapabilityError extends Error {
  readonly code: LookupCapabilityErrorCode;

  constructor(code: LookupCapabilityErrorCode, message?: string) {
    super(message ?? code);
    this.name = "LookupCapabilityError";
    this.code = code;
  }
}

const LOOKUP_LANGUAGES = new Set<LookupLanguage>(["fr", "en", "mnk"]);

const VALID_LOOKUP_PAIRS: ReadonlyArray<Readonly<LookupMode>> = [
  { from: "fr", to: "mnk" },
  { from: "en", to: "mnk" },
  { from: "mnk", to: "fr" },
  { from: "mnk", to: "en" },
];

function pairKey(mode: LookupMode): string {
  return `${mode.from}->${mode.to}`;
}

const VALID_PAIR_KEYS = new Set(VALID_LOOKUP_PAIRS.map(pairKey));

export function isLookupLanguage(value: unknown): value is LookupLanguage {
  return typeof value === "string" && LOOKUP_LANGUAGES.has(value as LookupLanguage);
}

export function isValidLookupMode(mode: unknown): mode is LookupMode {
  if (typeof mode !== "object" || mode === null || Array.isArray(mode)) return false;
  const candidate = mode as { from?: unknown; to?: unknown };
  if (!isLookupLanguage(candidate.from) || !isLookupLanguage(candidate.to)) return false;
  return VALID_PAIR_KEYS.has(pairKey({ from: candidate.from, to: candidate.to }));
}

export function assertValidLookupMode(mode: unknown): asserts mode is LookupMode {
  if (!isValidLookupMode(mode)) {
    throw new LookupCapabilityError("invalid_lookup_mode", "Invalid LookupMode pair");
  }
}

/**
 * Index key-family prefix for the query language (LookupMode.from).
 * tgt_* resolves Maninka entries regardless of preferred gloss (to).
 */
export function indexFamilyForLookupInput(from: LookupLanguage): LookupKeyFamily {
  if (from === "fr") return "src";
  if (from === "en") return "en";
  return "tgt";
}

export function toLegacySearchDirection(mode: LookupMode): SearchDirection {
  assertValidLookupMode(mode);
  return mode.from === "mnk" ? "target_to_source" : "source_to_target";
}

/**
 * Reverse LookupMode endpoints (ML1D swap).
 * fr↔mnk and en↔mnk only — never invents an invalid pair.
 */
export function swapLookupMode(mode: LookupMode): LookupMode {
  assertValidLookupMode(mode);
  const swapped = { from: mode.to, to: mode.from };
  assertValidLookupMode(swapped);
  return swapped;
}

/**
 * Legacy SearchDirection adapter. Never silently maps source_to_target to English.
 */
export function lookupModeFromLegacySearchDirection(
  direction: SearchDirection,
): LookupMode {
  if (direction === "source_to_target") {
    return { from: "fr", to: "mnk" };
  }
  return { from: "mnk", to: "fr" };
}

/** Deterministic FR→MNK default for consumer Search. */
export const DEFAULT_LOOKUP_MODE: LookupMode = { from: "fr", to: "mnk" };

/** Non-Maninka endpoint of a valid LookupMode (FR or EN). */
export function partnerLookupLanguage(mode: LookupMode): PreferredGlossLanguage {
  assertValidLookupMode(mode);
  if (mode.from === "mnk") {
    return mode.to === "en" ? "en" : "fr";
  }
  return mode.from === "en" ? "en" : "fr";
}

/**
 * Change the FR/EN partner while preserving orientation (MNK side stays put).
 * Does not invoke swap.
 */
export function withPartnerLookupLanguage(
  mode: LookupMode,
  partner: PreferredGlossLanguage,
): LookupMode {
  assertValidLookupMode(mode);
  if (mode.from === "mnk") {
    return { from: "mnk", to: partner };
  }
  return { from: partner, to: "mnk" };
}

/**
 * ML1D2 startup / bundle-change restore: preference + forward orientation → MNK.
 * Does not restore swap orientation from storage.
 */
export function restoreForwardLookupModeFromPreference(
  preference: PreferredGlossLanguage,
  meta: LookupCapabilityMeta,
): LookupMode {
  const partner = preference === "en" ? "en" : "fr";
  const requested: LookupMode = { from: partner, to: "mnk" };
  return resolveSupportedLookupMode(meta, requested);
}

/**
 * When the active bundle cannot support `requested`, fall back to FR→MNK.
 * Never silently remaps EN→MNK to MNK→FR or another unrelated pair.
 */
export function resolveSupportedLookupMode(
  meta: LookupCapabilityMeta,
  requested: LookupMode,
): LookupMode {
  if (!isValidLookupMode(requested)) {
    return { ...DEFAULT_LOOKUP_MODE };
  }
  if (bundleSupportsLookupMode(meta, requested)) {
    return { from: requested.from, to: requested.to };
  }
  return { ...DEFAULT_LOOKUP_MODE };
}

/**
 * Preferred consumer gloss language for ML1D / entry display.
 * Fallback chain is preferred → FR|EN alternate → unavailable.
 * Russian is never a fallback.
 */
export function preferredGlossLanguage(mode: LookupMode): PreferredGlossLanguage {
  assertValidLookupMode(mode);
  if (mode.to === "fr" || mode.to === "en") return mode.to;
  // fr|en → mnk: lexical target is Maninka; preferred gloss for bilingual display
  // still follows the query language’s partner as FR for legacy FR→MNK, EN for EN→MNK.
  return mode.from === "en" ? "en" : "fr";
}

export function glossFallbackChain(
  preferred: PreferredGlossLanguage,
): readonly PreferredGlossLanguage[] {
  return preferred === "en" ? (["en", "fr"] as const) : (["fr", "en"] as const);
}

export function bundleSupportsEnglishLookup(meta: LookupCapabilityMeta): boolean {
  const languages = meta.lookup_languages ?? [];
  const families = meta.search_key_families ?? [];
  return languages.includes("en") && families.includes("en");
}

/**
 * English endpoints require both lookup_languages and search_key_families to
 * advertise "en". FR↔MNK pairs remain available without English capability.
 */
export function bundleSupportsLookupMode(
  meta: LookupCapabilityMeta,
  mode: LookupMode,
): boolean {
  if (!isValidLookupMode(mode)) return false;
  if (mode.from === "en" || mode.to === "en") {
    return bundleSupportsEnglishLookup(meta);
  }
  return true;
}

export function assertBundleSupportsLookupMode(
  meta: LookupCapabilityMeta,
  mode: LookupMode,
): void {
  assertValidLookupMode(mode);
  if (!bundleSupportsLookupMode(meta, mode)) {
    throw new LookupCapabilityError(
      "english_lookup_unsupported",
      "English lookup requires lookup_languages and search_key_families to include en",
    );
  }
}

/** CF2 / capture provenance pair derived from a LookupMode. */
export function lookupModeToLanguagePair(mode: LookupMode): {
  input_lang: LookupLanguage;
  output_lang: LookupLanguage;
} {
  assertValidLookupMode(mode);
  return { input_lang: mode.from, output_lang: mode.to };
}

/**
 * Resolve LookupMode from CF2 draft fields.
 * Missing pair + legacy search_direction → FR→MNK or MNK→FR (V1 only).
 */
export function resolveLookupModeFromFeedbackFields(fields: {
  search_direction: SearchDirection;
  input_lang?: unknown;
  output_lang?: unknown;
}): LookupMode {
  const hasInput = fields.input_lang !== undefined;
  const hasOutput = fields.output_lang !== undefined;
  if (hasInput || hasOutput) {
    if (!hasInput || !hasOutput) {
      throw new LookupCapabilityError(
        "invalid_lookup_mode",
        "input_lang and output_lang must both be present or both absent",
      );
    }
    const mode = { from: fields.input_lang, to: fields.output_lang };
    assertValidLookupMode(mode);
    if (toLegacySearchDirection(mode) !== fields.search_direction) {
      throw new LookupCapabilityError(
        "invalid_lookup_mode",
        "LookupMode pair does not match search_direction",
      );
    }
    return mode;
  }
  return lookupModeFromLegacySearchDirection(fields.search_direction);
}
