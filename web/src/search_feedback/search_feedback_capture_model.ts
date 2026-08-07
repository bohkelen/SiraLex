/**
 * CF2I3 — Search failure capture model (pure).
 *
 * Builds frozen capture context, optional-field canonicalization, field
 * validation/counters, and view models. No IndexedDB, DOM, or search execution.
 *
 * Reports what the user experienced (no_result / results_not_useful), never why.
 */

import {
  SEARCH_FEEDBACK_MATCHED_IR_IDS_MAX,
  SEARCH_FEEDBACK_QUERY_RAW_MAX_CHARS,
  SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
  SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
  countUnicodeCharacters,
  hasDisallowedControlCharacters,
  isValidCanonicalContentSha256,
  type SearchFeedbackDirection,
  type SearchFeedbackLookupLanguage,
  type SearchFeedbackResultState,
} from "./search_feedback_types";
import type { CreateSearchFeedbackDraftInput } from "./search_feedback_store";
import {
  isValidLookupMode,
  lookupModeFromLegacySearchDirection,
  lookupModeToLanguagePair,
  toLegacySearchDirection,
  type LookupMode,
} from "../search/lookup_mode";

/**
 * Settled search evidence from the runtime (main/search host).
 * `generation` is controller/runtime only — never persisted on drafts.
 *
 * New captures must carry explicit LookupMode provenance (`input_lang` /
 * `output_lang`). When omitted on a snapshot (tests), context falls back to
 * the legacy FR↔MNK adapter from `search_direction` only for building
 * create-input — production Search always supplies the pair from the executed
 * LookupMode.
 */
export type ExecutedSearchSnapshot = {
  generation: number;
  query_raw: string;
  search_direction: SearchFeedbackDirection;
  /** Explicit lookup pair; required for truthful multilingual provenance. */
  input_lang?: SearchFeedbackLookupLanguage;
  output_lang?: SearchFeedbackLookupLanguage;
  result_state: SearchFeedbackResultState;
  result_count: number;
  matched_ir_ids?: string[];
  bundle_id: string;
  content_sha256: string;
  storage_scope_id: string;
};

/** Frozen form-binding context at open time. */
export type SearchFeedbackCaptureContext = {
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
  /** Runtime-only; not persisted. */
  search_generation: number;
};

export type SearchFeedbackCaptureFields = {
  requested_meaning: string;
  user_description: string;
};

export type SearchFeedbackCaptureFieldErrors = {
  requested_meaning?: "too_long" | "invalid_chars";
  user_description?: "too_long" | "invalid_chars";
};

export type SearchFeedbackCaptureErrorCode =
  | "search_context_changed"
  | "invalid_fields"
  | "invalid_timestamp"
  | "id_generation_failed"
  | "feedback_id_conflict"
  | "database_write_failed"
  | "invalid_input";

export type SearchFeedbackCaptureViewModel = {
  state: "ready" | "saving" | "saved" | "invalid" | "stale_context" | "error";
  context: SearchFeedbackCaptureContext;
  fields: SearchFeedbackCaptureFields;
  errors: SearchFeedbackCaptureFieldErrors;
  errorCode?: SearchFeedbackCaptureErrorCode;
  requestedMeaningCount: number;
  userDescriptionCount: number;
  feedback_id?: string;
};

/**
 * Capture derivation: unique `ir_id`s in deterministic display/search order,
 * capped at 25. Deduplication is evidence construction, not persisted repair —
 * the same entry may appear through multiple match paths before resolution.
 */
export function deriveMatchedIrIdsFromRecords(
  records: ReadonlyArray<{ ir_id: string }>,
): string[] | undefined {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const id = record.ir_id;
    if (typeof id !== "string" || id.trim() === "" || id !== id.trim()) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= SEARCH_FEEDBACK_MATCHED_IR_IDS_MAX) break;
  }
  return out.length > 0 ? out : undefined;
}

export function canOfferSearchFeedbackCapture(
  snapshot: ExecutedSearchSnapshot | undefined,
): boolean {
  if (!snapshot) return false;
  if (snapshot.query_raw.trim() === "") return false;
  if (!snapshot.bundle_id.trim() || !snapshot.storage_scope_id.trim()) return false;
  if (!isValidCanonicalContentSha256(snapshot.content_sha256)) return false;
  if (snapshot.result_state === "no_result") {
    return snapshot.result_count === 0 && snapshot.matched_ir_ids === undefined;
  }
  return snapshot.result_count >= 1;
}

export function buildSearchFeedbackCaptureContext(
  snapshot: ExecutedSearchSnapshot,
): SearchFeedbackCaptureContext | undefined {
  if (!canOfferSearchFeedbackCapture(snapshot)) return undefined;

  let mode: LookupMode;
  if (snapshot.input_lang !== undefined && snapshot.output_lang !== undefined) {
    mode = { from: snapshot.input_lang, to: snapshot.output_lang };
    if (!isValidLookupMode(mode)) return undefined;
    if (toLegacySearchDirection(mode) !== snapshot.search_direction) return undefined;
  } else if (snapshot.input_lang === undefined && snapshot.output_lang === undefined) {
    // Legacy snapshot shape: map binary direction to FR↔MNK only.
    mode = lookupModeFromLegacySearchDirection(snapshot.search_direction);
  } else {
    return undefined;
  }

  const pair = lookupModeToLanguagePair(mode);
  return {
    bundle_id: snapshot.bundle_id,
    content_sha256: snapshot.content_sha256,
    storage_scope_id: snapshot.storage_scope_id,
    query_raw: snapshot.query_raw,
    search_direction: snapshot.search_direction,
    input_lang: pair.input_lang,
    output_lang: pair.output_lang,
    result_state: snapshot.result_state,
    result_count: snapshot.result_count,
    ...(snapshot.matched_ir_ids !== undefined
      ? { matched_ir_ids: [...snapshot.matched_ir_ids] }
      : {}),
    search_generation: snapshot.generation,
  };
}

export function createInitialSearchFeedbackCaptureFields(): SearchFeedbackCaptureFields {
  return {
    requested_meaning: "",
    user_description: "",
  };
}

/**
 * UI blank/whitespace-only optional fields → canonical absence.
 * Non-blank text is preserved exactly (including leading/trailing spaces).
 */
export function canonicalizeOptionalCaptureField(
  value: string,
): string | undefined {
  if (value.trim() === "") return undefined;
  return value;
}

function validateOptionalField(
  value: string,
  maxChars: number,
): "too_long" | "invalid_chars" | undefined {
  if (value.trim() === "") return undefined;
  if (countUnicodeCharacters(value) > maxChars) return "too_long";
  if (hasDisallowedControlCharacters(value)) return "invalid_chars";
  return undefined;
}

export function validateSearchFeedbackCaptureFields(
  fields: SearchFeedbackCaptureFields,
  context: SearchFeedbackCaptureContext,
):
  | { ok: true; input: CreateSearchFeedbackDraftInput }
  | { ok: false; errors: SearchFeedbackCaptureFieldErrors } {
  const errors: SearchFeedbackCaptureFieldErrors = {};
  const meaningErr = validateOptionalField(
    fields.requested_meaning,
    SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
  );
  if (meaningErr) errors.requested_meaning = meaningErr;
  const detailsErr = validateOptionalField(
    fields.user_description,
    SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
  );
  if (detailsErr) errors.user_description = detailsErr;

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  if (countUnicodeCharacters(context.query_raw) > SEARCH_FEEDBACK_QUERY_RAW_MAX_CHARS) {
    return { ok: false, errors: {} };
  }

  const requested_meaning = canonicalizeOptionalCaptureField(
    fields.requested_meaning,
  );
  const user_description = canonicalizeOptionalCaptureField(
    fields.user_description,
  );

  return {
    ok: true,
    input: {
      bundle_id: context.bundle_id,
      content_sha256: context.content_sha256,
      storage_scope_id: context.storage_scope_id,
      query_raw: context.query_raw,
      search_direction: context.search_direction,
      input_lang: context.input_lang,
      output_lang: context.output_lang,
      result_state: context.result_state,
      result_count: context.result_count,
      ...(context.matched_ir_ids !== undefined
        ? { matched_ir_ids: [...context.matched_ir_ids] }
        : {}),
      ...(requested_meaning !== undefined ? { requested_meaning } : {}),
      ...(user_description !== undefined ? { user_description } : {}),
    },
  };
}

export function buildSearchFeedbackCaptureViewModel(args: {
  state: SearchFeedbackCaptureViewModel["state"];
  context: SearchFeedbackCaptureContext;
  fields: SearchFeedbackCaptureFields;
  errors?: SearchFeedbackCaptureFieldErrors;
  errorCode?: SearchFeedbackCaptureErrorCode;
  feedback_id?: string;
}): SearchFeedbackCaptureViewModel {
  return {
    state: args.state,
    context: args.context,
    fields: args.fields,
    errors: args.errors ?? {},
    ...(args.errorCode !== undefined ? { errorCode: args.errorCode } : {}),
    requestedMeaningCount: countUnicodeCharacters(args.fields.requested_meaning),
    userDescriptionCount: countUnicodeCharacters(args.fields.user_description),
    ...(args.feedback_id !== undefined ? { feedback_id: args.feedback_id } : {}),
  };
}

export {
  SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
  SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
};
