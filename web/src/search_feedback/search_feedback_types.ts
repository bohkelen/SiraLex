/**
 * CF2I1 — Search failure feedback draft types and generic text helpers.
 *
 * A CF2 record is evidence that a user need was not satisfied by a specific
 * search against a specific dictionary version. It is not evidence that the
 * requested lexical object should exist.
 *
 * Schema versioning (ML1C2A):
 * - V1 is frozen: no input_lang/output_lang.
 * - V2 requires input_lang + output_lang (LookupMode pair).
 *
 * Pure module: no IndexedDB, clock, DOM, network, i18n, search, or corpus mutation.
 * Does not import CF1 correction record types.
 */

export const SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1 =
  "search_failure_feedback_draft_v1" as const;
export const SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2 =
  "search_failure_feedback_draft_v2" as const;

/**
 * @deprecated Historical alias for V1 identity at call sites that predate V2.
 * Prefer SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1 or _V2 explicitly.
 */
export const SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION =
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1;

export const SEARCH_FEEDBACK_QUERY_RAW_MAX_CHARS = 1_000;
export const SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS = 2_000;
export const SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS = 2_000;

export const SEARCH_FEEDBACK_ID_MAX_CHARS = 200;
export const SEARCH_FEEDBACK_BUNDLE_ID_MAX_CHARS = 500;
export const SEARCH_FEEDBACK_STORAGE_SCOPE_ID_MAX_CHARS = 1_000;
export const SEARCH_FEEDBACK_CONTENT_SHA256_MAX_CHARS = 200;
export const SEARCH_FEEDBACK_IR_ID_MAX_CHARS = 500;

export const SEARCH_FEEDBACK_MATCHED_IR_IDS_MAX = 25;

export const SEARCH_FEEDBACK_MAX_VALIDATION_ERRORS = 100;

export type SearchFeedbackResultState = "no_result" | "results_not_useful";

export const SEARCH_FEEDBACK_RESULT_STATES = [
  "no_result",
  "results_not_useful",
] as const satisfies readonly SearchFeedbackResultState[];

const SEARCH_FEEDBACK_RESULT_STATE_SET: ReadonlySet<string> = new Set(
  SEARCH_FEEDBACK_RESULT_STATES,
);

export function isSearchFeedbackResultState(
  value: unknown,
): value is SearchFeedbackResultState {
  return typeof value === "string" && SEARCH_FEEDBACK_RESULT_STATE_SET.has(value);
}

export type SearchFeedbackDirection = "source_to_target" | "target_to_source";

/** Lookup language codes for CF2 provenance (ML1C2). */
export type SearchFeedbackLookupLanguage = "fr" | "en" | "mnk";

const SEARCH_FEEDBACK_DIRECTIONS = new Set<SearchFeedbackDirection>([
  "source_to_target",
  "target_to_source",
]);

const SEARCH_FEEDBACK_LOOKUP_LANGUAGES = new Set<SearchFeedbackLookupLanguage>([
  "fr",
  "en",
  "mnk",
]);

export function isSearchFeedbackDirection(
  value: unknown,
): value is SearchFeedbackDirection {
  return typeof value === "string" && SEARCH_FEEDBACK_DIRECTIONS.has(value as SearchFeedbackDirection);
}

export function isSearchFeedbackLookupLanguage(
  value: unknown,
): value is SearchFeedbackLookupLanguage {
  return (
    typeof value === "string" &&
    SEARCH_FEEDBACK_LOOKUP_LANGUAGES.has(value as SearchFeedbackLookupLanguage)
  );
}

/**
 * Frozen V1 local search-failure feedback draft (CF2).
 * No language provenance fields — historical FR↔MNK-only shape.
 */
export type SearchFeedbackDraftV1 = {
  schema_version: typeof SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1;
  feedback_id: string;
  bundle_id: string;
  content_sha256: string;
  storage_scope_id: string;
  query_raw: string;
  search_direction: SearchFeedbackDirection;
  result_state: SearchFeedbackResultState;
  result_count: number;
  matched_ir_ids?: string[];
  requested_meaning?: string;
  user_description?: string;
  created_at: string;
  updated_at: string;
  status: "draft";
};

/**
 * V2 local search-failure feedback draft (CF2).
 * Requires explicit LookupMode pair as input_lang + output_lang.
 */
export type SearchFeedbackDraftV2 = {
  schema_version: typeof SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2;
  feedback_id: string;
  bundle_id: string;
  content_sha256: string;
  storage_scope_id: string;
  query_raw: string;
  search_direction: SearchFeedbackDirection;
  input_lang: SearchFeedbackLookupLanguage;
  output_lang: SearchFeedbackLookupLanguage;
  result_state: SearchFeedbackResultState;
  result_count: number;
  matched_ir_ids?: string[];
  requested_meaning?: string;
  user_description?: string;
  created_at: string;
  updated_at: string;
  status: "draft";
};

export type SearchFeedbackDraft = SearchFeedbackDraftV1 | SearchFeedbackDraftV2;

export function isSearchFeedbackDraftV1(
  value: SearchFeedbackDraft,
): value is SearchFeedbackDraftV1 {
  return value.schema_version === SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1;
}

export function isSearchFeedbackDraftV2(
  value: SearchFeedbackDraft,
): value is SearchFeedbackDraftV2 {
  return value.schema_version === SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2;
}

/**
 * Count Unicode code points (not UTF-16 code units, not grapheme clusters).
 */
export function countUnicodeCharacters(value: string): number {
  return Array.from(value).length;
}

/**
 * Control-character policy (same family as CF1 text policy, local copy):
 * - allow ordinary Unicode, N’Ko, combining marks, bidirectional text;
 * - allow `\n` (U+000A), `\r` (U+000D), `\t` (U+0009);
 * - reject other C0 controls U+0000–U+001F;
 * - reject DEL U+007F;
 * - reject isolated surrogate code units U+D800–U+DFFF.
 * Does not transliterate or NFC-normalize linguistic text.
 */
export function hasDisallowedControlCharacters(value: string): boolean {
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) continue;
    if (cp <= 0x1f || cp === 0x7f) return true;
    if (cp >= 0xd800 && cp <= 0xdfff) return true;
  }
  return false;
}

/**
 * Canonical UTC ISO-8601 ending in `Z`, parseable and round-trippable by instant.
 */
export function isValidSearchFeedbackIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.trim() === "" || value !== value.trim()) return false;
  if (!value.endsWith("Z")) return false;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return false;
  const parsed = new Date(ms);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.parse(parsed.toISOString()) === ms;
}

/**
 * Canonical content-hash shape:
 * `sha256:` + exactly 64 lowercase hexadecimal characters.
 * Uppercase digests are rejected (no silent normalization).
 */
export function isValidCanonicalContentSha256(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.trim() === "" || value !== value.trim()) return false;
  if (countUnicodeCharacters(value) > SEARCH_FEEDBACK_CONTENT_SHA256_MAX_CHARS) {
    return false;
  }
  return /^sha256:[0-9a-f]{64}$/.test(value);
}

export function cloneSearchFeedbackDraftV1(
  draft: SearchFeedbackDraftV1,
): SearchFeedbackDraftV1 {
  const out: SearchFeedbackDraftV1 = {
    schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1,
    feedback_id: draft.feedback_id,
    bundle_id: draft.bundle_id,
    content_sha256: draft.content_sha256,
    storage_scope_id: draft.storage_scope_id,
    query_raw: draft.query_raw,
    search_direction: draft.search_direction,
    result_state: draft.result_state,
    result_count: draft.result_count,
    created_at: draft.created_at,
    updated_at: draft.updated_at,
    status: "draft",
  };
  if (draft.matched_ir_ids !== undefined) {
    out.matched_ir_ids = [...draft.matched_ir_ids];
  }
  if (draft.requested_meaning !== undefined) {
    out.requested_meaning = draft.requested_meaning;
  }
  if (draft.user_description !== undefined) {
    out.user_description = draft.user_description;
  }
  return out;
}

export function cloneSearchFeedbackDraftV2(
  draft: SearchFeedbackDraftV2,
): SearchFeedbackDraftV2 {
  const out: SearchFeedbackDraftV2 = {
    schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2,
    feedback_id: draft.feedback_id,
    bundle_id: draft.bundle_id,
    content_sha256: draft.content_sha256,
    storage_scope_id: draft.storage_scope_id,
    query_raw: draft.query_raw,
    search_direction: draft.search_direction,
    input_lang: draft.input_lang,
    output_lang: draft.output_lang,
    result_state: draft.result_state,
    result_count: draft.result_count,
    created_at: draft.created_at,
    updated_at: draft.updated_at,
    status: "draft",
  };
  if (draft.matched_ir_ids !== undefined) {
    out.matched_ir_ids = [...draft.matched_ir_ids];
  }
  if (draft.requested_meaning !== undefined) {
    out.requested_meaning = draft.requested_meaning;
  }
  if (draft.user_description !== undefined) {
    out.user_description = draft.user_description;
  }
  return out;
}

export function cloneSearchFeedbackDraft(
  draft: SearchFeedbackDraft,
): SearchFeedbackDraft {
  if (isSearchFeedbackDraftV2(draft)) {
    return cloneSearchFeedbackDraftV2(draft);
  }
  return cloneSearchFeedbackDraftV1(draft);
}

function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Export ordering (CF2D0): bundle_id → created_at → feedback_id.
 * Code-point comparison only — never localeCompare.
 */
export function compareSearchFeedbackDraftsForExport(
  a: SearchFeedbackDraft,
  b: SearchFeedbackDraft,
): number {
  const byBundle = compareCodePoints(a.bundle_id, b.bundle_id);
  if (byBundle !== 0) return byBundle;
  const byCreated = compareCodePoints(a.created_at, b.created_at);
  if (byCreated !== 0) return byCreated;
  return compareCodePoints(a.feedback_id, b.feedback_id);
}
