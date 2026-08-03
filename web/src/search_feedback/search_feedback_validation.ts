/**
 * CF2I1 — Strict search-feedback draft validation.
 *
 * Observed failure state only. No missing-entry truth, diagnosis, query-log
 * linkage, Learning fields, or CF1 correction semantics.
 *
 * Pure module: no IndexedDB, clock, DOM, network, or search execution.
 */

import {
  SEARCH_FEEDBACK_BUNDLE_ID_MAX_CHARS,
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
  SEARCH_FEEDBACK_ID_MAX_CHARS,
  SEARCH_FEEDBACK_IR_ID_MAX_CHARS,
  SEARCH_FEEDBACK_MATCHED_IR_IDS_MAX,
  SEARCH_FEEDBACK_MAX_VALIDATION_ERRORS,
  SEARCH_FEEDBACK_QUERY_RAW_MAX_CHARS,
  SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
  SEARCH_FEEDBACK_STORAGE_SCOPE_ID_MAX_CHARS,
  SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
  cloneSearchFeedbackDraft,
  countUnicodeCharacters,
  hasDisallowedControlCharacters,
  isSearchFeedbackDirection,
  isSearchFeedbackResultState,
  isValidCanonicalContentSha256,
  isValidSearchFeedbackIsoTimestamp,
  type SearchFeedbackDraftV1,
  type SearchFeedbackDirection,
  type SearchFeedbackResultState,
} from "./search_feedback_types";

export type SearchFeedbackValidationErrorCode =
  | "invalid_top_level"
  | "unsupported_schema"
  | "unknown_field"
  | "invalid_identity"
  | "invalid_provenance"
  | "invalid_query"
  | "invalid_direction"
  | "invalid_result_state"
  | "invalid_result_count"
  | "invalid_matched_ir_ids"
  | "invalid_requested_meaning"
  | "invalid_user_description"
  | "invalid_timestamp"
  | "timestamp_order"
  | "error_limit_reached";

export type SearchFeedbackValidationError = {
  code: SearchFeedbackValidationErrorCode;
  path?: string;
};

export type ValidateSearchFeedbackDraftResult =
  | {
      ok: true;
      value: SearchFeedbackDraftV1;
    }
  | {
      ok: false;
      errors: SearchFeedbackValidationError[];
      truncated: boolean;
    };

const DRAFT_TOP_LEVEL_KEYS = new Set([
  "schema_version",
  "feedback_id",
  "bundle_id",
  "content_sha256",
  "storage_scope_id",
  "query_raw",
  "search_direction",
  "result_state",
  "result_count",
  "matched_ir_ids",
  "requested_meaning",
  "user_description",
  "created_at",
  "updated_at",
  "status",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isValidBoundedId(value: unknown, maxChars: number): value is string {
  if (!isNonEmptyTrimmedString(value)) return false;
  if (value !== value.trim()) return false;
  const len = countUnicodeCharacters(value);
  return len >= 1 && len <= maxChars;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

type ErrorCollector = {
  errors: SearchFeedbackValidationError[];
  truncated: boolean;
};

/**
 * Bounded accumulation:
 * at most 99 structural errors + final `error_limit_reached` = 100 total.
 */
function pushError(
  collector: ErrorCollector,
  error: SearchFeedbackValidationError,
): boolean {
  if (collector.truncated) {
    return false;
  }
  if (collector.errors.length >= SEARCH_FEEDBACK_MAX_VALIDATION_ERRORS) {
    return false;
  }
  if (collector.errors.length === SEARCH_FEEDBACK_MAX_VALIDATION_ERRORS - 1) {
    collector.errors.push({ code: "error_limit_reached" });
    collector.truncated = true;
    return false;
  }
  collector.errors.push(error);
  return true;
}

function fail(collector: ErrorCollector): ValidateSearchFeedbackDraftResult {
  return {
    ok: false,
    errors: collector.errors,
    truncated: collector.truncated,
  };
}

/**
 * Optional user-evidence fields:
 * - absent → ok
 * - present empty / whitespace-only → reject (canonical form is absence)
 * - present non-empty → preserve exact text; enforce limits/controls
 *
 * Never normalize, translate, tokenize, or turn into search keys.
 */
function validateOptionalUserEvidence(
  value: unknown,
  path: string,
  maxChars: number,
  code: SearchFeedbackValidationErrorCode,
  collector: ErrorCollector,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    pushError(collector, { code, path });
    return undefined;
  }
  if (value.trim() === "") {
    pushError(collector, { code, path });
    return undefined;
  }
  if (countUnicodeCharacters(value) > maxChars) {
    pushError(collector, { code, path });
    return undefined;
  }
  if (hasDisallowedControlCharacters(value)) {
    pushError(collector, { code, path });
    return undefined;
  }
  return value;
}

/**
 * query_raw: required. Trim only to detect emptiness. Preserve exact stored string.
 */
function validateQueryRaw(
  value: unknown,
  collector: ErrorCollector,
): string | undefined {
  if (typeof value !== "string") {
    pushError(collector, { code: "invalid_query", path: "query_raw" });
    return undefined;
  }
  if (value.trim() === "") {
    pushError(collector, { code: "invalid_query", path: "query_raw" });
    return undefined;
  }
  if (countUnicodeCharacters(value) > SEARCH_FEEDBACK_QUERY_RAW_MAX_CHARS) {
    pushError(collector, { code: "invalid_query", path: "query_raw" });
    return undefined;
  }
  if (hasDisallowedControlCharacters(value)) {
    pushError(collector, { code: "invalid_query", path: "query_raw" });
    return undefined;
  }
  return value;
}

function validateMatchedIrIds(
  value: unknown,
  resultState: SearchFeedbackResultState | undefined,
  collector: ErrorCollector,
): string[] | undefined {
  if (resultState === "no_result") {
    if (value !== undefined) {
      pushError(collector, {
        code: "invalid_matched_ir_ids",
        path: "matched_ir_ids",
      });
    }
    return undefined;
  }

  if (value === undefined) return undefined;

  if (!Array.isArray(value)) {
    pushError(collector, {
      code: "invalid_matched_ir_ids",
      path: "matched_ir_ids",
    });
    return undefined;
  }

  if (value.length > SEARCH_FEEDBACK_MATCHED_IR_IDS_MAX) {
    pushError(collector, {
      code: "invalid_matched_ir_ids",
      path: "matched_ir_ids",
    });
    return undefined;
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const path = `matched_ir_ids[${i}]`;
    const id = value[i];
    if (!isValidBoundedId(id, SEARCH_FEEDBACK_IR_ID_MAX_CHARS)) {
      pushError(collector, { code: "invalid_matched_ir_ids", path });
      continue;
    }
    if (seen.has(id)) {
      pushError(collector, { code: "invalid_matched_ir_ids", path });
      continue;
    }
    seen.add(id);
    out.push(id);
  }

  if (collector.errors.some((e) => e.code === "invalid_matched_ir_ids")) {
    return undefined;
  }
  return out;
}

/**
 * Strictly validate a CF2 search-feedback draft.
 * Installation-independent. Does not mutate input. Does not insert timestamps.
 * Does not assert missing-entry truth or linguistic cause.
 */
export function validateSearchFeedbackDraft(
  value: unknown,
): ValidateSearchFeedbackDraftResult {
  const collector: ErrorCollector = { errors: [], truncated: false };

  if (!isPlainObject(value)) {
    pushError(collector, { code: "invalid_top_level" });
    return fail(collector);
  }

  for (const key of Object.keys(value)) {
    if (!DRAFT_TOP_LEVEL_KEYS.has(key)) {
      pushError(collector, { code: "unknown_field", path: key });
    }
  }
  if (collector.errors.length > 0) return fail(collector);

  if (value.schema_version !== SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION) {
    pushError(collector, {
      code:
        typeof value.schema_version === "string"
          ? "unsupported_schema"
          : "invalid_identity",
      path: "schema_version",
    });
  }

  if (!isValidBoundedId(value.feedback_id, SEARCH_FEEDBACK_ID_MAX_CHARS)) {
    pushError(collector, { code: "invalid_identity", path: "feedback_id" });
  }
  if (!isValidBoundedId(value.bundle_id, SEARCH_FEEDBACK_BUNDLE_ID_MAX_CHARS)) {
    pushError(collector, { code: "invalid_identity", path: "bundle_id" });
  }
  if (value.status !== "draft") {
    pushError(collector, { code: "invalid_identity", path: "status" });
  }

  if (!isValidCanonicalContentSha256(value.content_sha256)) {
    pushError(collector, { code: "invalid_provenance", path: "content_sha256" });
  }
  if (
    !isValidBoundedId(
      value.storage_scope_id,
      SEARCH_FEEDBACK_STORAGE_SCOPE_ID_MAX_CHARS,
    )
  ) {
    pushError(collector, {
      code: "invalid_provenance",
      path: "storage_scope_id",
    });
  }

  const queryRaw = validateQueryRaw(value.query_raw, collector);

  if (!isSearchFeedbackDirection(value.search_direction)) {
    pushError(collector, { code: "invalid_direction", path: "search_direction" });
  }

  const resultState = isSearchFeedbackResultState(value.result_state)
    ? value.result_state
    : undefined;
  if (resultState === undefined) {
    pushError(collector, {
      code: "invalid_result_state",
      path: "result_state",
    });
  }

  if (!isSafeNonNegativeInteger(value.result_count)) {
    pushError(collector, {
      code: "invalid_result_count",
      path: "result_count",
    });
  } else if (resultState === "no_result") {
    if (value.result_count !== 0) {
      pushError(collector, {
        code: "invalid_result_count",
        path: "result_count",
      });
    }
  } else if (resultState === "results_not_useful") {
    if (value.result_count < 1) {
      pushError(collector, {
        code: "invalid_result_count",
        path: "result_count",
      });
    }
  }

  const matchedIrIds = validateMatchedIrIds(
    value.matched_ir_ids,
    resultState,
    collector,
  );

  const requestedMeaning = validateOptionalUserEvidence(
    value.requested_meaning,
    "requested_meaning",
    SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
    "invalid_requested_meaning",
    collector,
  );
  const userDescription = validateOptionalUserEvidence(
    value.user_description,
    "user_description",
    SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
    "invalid_user_description",
    collector,
  );

  if (!isValidSearchFeedbackIsoTimestamp(value.created_at)) {
    pushError(collector, { code: "invalid_timestamp", path: "created_at" });
  }
  if (!isValidSearchFeedbackIsoTimestamp(value.updated_at)) {
    pushError(collector, { code: "invalid_timestamp", path: "updated_at" });
  }
  if (
    isValidSearchFeedbackIsoTimestamp(value.created_at) &&
    isValidSearchFeedbackIsoTimestamp(value.updated_at)
  ) {
    const createdMs = Date.parse(value.created_at);
    const updatedMs = Date.parse(value.updated_at);
    if (!(updatedMs >= createdMs)) {
      pushError(collector, { code: "timestamp_order", path: "updated_at" });
    }
  }

  if (collector.errors.length > 0) return fail(collector);

  const draft: SearchFeedbackDraftV1 = {
    schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
    feedback_id: value.feedback_id as string,
    bundle_id: value.bundle_id as string,
    content_sha256: value.content_sha256 as string,
    storage_scope_id: value.storage_scope_id as string,
    query_raw: queryRaw!,
    search_direction: value.search_direction as SearchFeedbackDirection,
    result_state: resultState!,
    result_count: value.result_count as number,
    ...(matchedIrIds !== undefined ? { matched_ir_ids: matchedIrIds } : {}),
    ...(requestedMeaning !== undefined
      ? { requested_meaning: requestedMeaning }
      : {}),
    ...(userDescription !== undefined
      ? { user_description: userDescription }
      : {}),
    created_at: value.created_at as string,
    updated_at: value.updated_at as string,
    status: "draft",
  };

  return { ok: true, value: cloneSearchFeedbackDraft(draft) };
}

/**
 * Asserting write validator for future store writes and package construction.
 */
export function validateSearchFeedbackDraftForWrite(
  value: unknown,
  label = "search_feedback_draft",
): asserts value is SearchFeedbackDraftV1 {
  const parsed = validateSearchFeedbackDraft(value);
  if (!parsed.ok) {
    const first = parsed.errors[0];
    const path = first?.path ? ` at ${first.path}` : "";
    throw new Error(`${label}: ${first?.code ?? "invalid_draft"}${path}`);
  }
}
