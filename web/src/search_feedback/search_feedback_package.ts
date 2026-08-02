/**
 * CF2I1 — Search feedback package model, parser, builder, and serialization.
 *
 * SearchFeedbackPackageV1 is unreviewed search-failure evidence for later
 * human triage. It is not:
 * - missing-entry truth
 * - correction_record_v1 / correctionset input
 * - CF1 correction feedback
 * - Phase 1.5 patch data
 * - query-log export
 *
 * Pure module: no IndexedDB, clock, DOM, download, network, i18n, or corpus mutation.
 */

import {
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
  cloneSearchFeedbackDraft,
  compareSearchFeedbackDraftsForExport,
  countUnicodeCharacters,
  isValidSearchFeedbackIsoTimestamp,
  type SearchFeedbackDraftV1,
} from "./search_feedback_types";
import {
  validateSearchFeedbackDraft,
  validateSearchFeedbackDraftForWrite,
} from "./search_feedback_validation";

export const SEARCH_FEEDBACK_PACKAGE_SCHEMA = "siralex_search_feedback_v1" as const;

/** Exact CF2D0 authority label — search failure evidence ≠ missing-entry truth. */
export const SEARCH_FEEDBACK_AUTHORITY_LABEL =
  "unreviewed_search_failure_feedback_must_not_be_treated_as_missing_entry_truth" as const;

/** Dedicated CF2 package size bound (same numeric ceiling as CF1; not a shared constant). */
export const SEARCH_FEEDBACK_MAX_BYTES = 25 * 1024 * 1024;

export const SEARCH_FEEDBACK_PACKAGE_MAX_VALIDATION_ERRORS = 100;

export const SEARCH_FEEDBACK_APP_VERSION_MAX_CHARS = 200;

export type SearchFeedbackPackageV1 = {
  package_schema: typeof SEARCH_FEEDBACK_PACKAGE_SCHEMA;
  exported_at: string;
  app_version?: string;
  authority_label: typeof SEARCH_FEEDBACK_AUTHORITY_LABEL;
  feedback_count: number;
  feedbacks: SearchFeedbackDraftV1[];
};

export type SearchFeedbackPackageValidationErrorCode =
  | "file_too_large"
  | "invalid_json"
  | "invalid_top_level"
  | "unsupported_package_schema"
  | "invalid_package_field"
  | "invalid_exported_at"
  | "invalid_authority_label"
  | "feedback_count_mismatch"
  | "invalid_feedback"
  | "duplicate_feedback_id"
  | "empty_package"
  | "error_limit_reached";

export type SearchFeedbackPackageValidationError = {
  code: SearchFeedbackPackageValidationErrorCode;
  path?: string;
  feedback_index?: number;
};

export type ParseSearchFeedbackPackageResult =
  | {
      ok: true;
      package: SearchFeedbackPackageV1;
    }
  | {
      ok: false;
      errors: SearchFeedbackPackageValidationError[];
      truncated?: boolean;
    };

export type SearchFeedbackBuildErrorCode =
  | "empty_feedbacks"
  | "invalid_feedback"
  | "duplicate_feedback_id"
  | "invalid_exported_at"
  | "invalid_app_version";

/**
 * Typed failure from {@link buildSearchFeedbackPackage}.
 * Messages are structural; they must not include user-authored content.
 */
export class SearchFeedbackBuildError extends Error {
  readonly code: SearchFeedbackBuildErrorCode;
  readonly feedbackIndex?: number;

  constructor(
    code: SearchFeedbackBuildErrorCode,
    message: string,
    feedbackIndex?: number,
  ) {
    super(message);
    this.name = "SearchFeedbackBuildError";
    this.code = code;
    if (feedbackIndex !== undefined) {
      this.feedbackIndex = feedbackIndex;
    }
  }
}

const PACKAGE_TOP_LEVEL_KEYS = new Set([
  "package_schema",
  "exported_at",
  "app_version",
  "authority_label",
  "feedback_count",
  "feedbacks",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function getSearchFeedbackUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

type ErrorCollector = {
  errors: SearchFeedbackPackageValidationError[];
  truncated: boolean;
};

/**
 * Bounded accumulation:
 * at most 99 structural errors + final `error_limit_reached` = 100 total.
 */
function pushError(
  collector: ErrorCollector,
  error: SearchFeedbackPackageValidationError,
): boolean {
  if (collector.truncated) {
    return false;
  }
  if (collector.errors.length >= SEARCH_FEEDBACK_PACKAGE_MAX_VALIDATION_ERRORS) {
    return false;
  }
  if (
    collector.errors.length ===
    SEARCH_FEEDBACK_PACKAGE_MAX_VALIDATION_ERRORS - 1
  ) {
    collector.errors.push({ code: "error_limit_reached" });
    collector.truncated = true;
    return false;
  }
  collector.errors.push(error);
  return true;
}

function fail(collector: ErrorCollector): ParseSearchFeedbackPackageResult {
  return {
    ok: false,
    errors: collector.errors,
    ...(collector.truncated ? { truncated: true } : {}),
  };
}

/**
 * Parse and strictly validate a search-feedback JSON string.
 * Preserves validated input feedback order. Does not mutate inputs.
 * Does not diagnose linguistic cause or convert to Phase 1.5 artifacts.
 */
export function parseSearchFeedbackJson(
  text: string,
  options?: {
    byteLength?: number;
  },
): ParseSearchFeedbackPackageResult {
  const collector: ErrorCollector = { errors: [], truncated: false };
  const byteLength =
    typeof options?.byteLength === "number"
      ? options.byteLength
      : getSearchFeedbackUtf8ByteLength(text);

  if (
    typeof byteLength !== "number" ||
    !Number.isFinite(byteLength) ||
    byteLength < 0 ||
    byteLength > SEARCH_FEEDBACK_MAX_BYTES
  ) {
    pushError(collector, { code: "file_too_large" });
    return fail(collector);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    pushError(collector, { code: "invalid_json" });
    return fail(collector);
  }

  if (!isPlainObject(parsed)) {
    pushError(collector, { code: "invalid_top_level" });
    return fail(collector);
  }

  for (const key of Object.keys(parsed)) {
    if (!PACKAGE_TOP_LEVEL_KEYS.has(key)) {
      pushError(collector, { code: "invalid_package_field", path: key });
    }
  }
  if (collector.errors.length > 0) return fail(collector);

  if (parsed.package_schema !== SEARCH_FEEDBACK_PACKAGE_SCHEMA) {
    pushError(collector, {
      code:
        typeof parsed.package_schema === "string"
          ? "unsupported_package_schema"
          : "invalid_package_field",
      path: "package_schema",
    });
    return fail(collector);
  }

  if (!isValidSearchFeedbackIsoTimestamp(parsed.exported_at)) {
    pushError(collector, { code: "invalid_exported_at", path: "exported_at" });
    return fail(collector);
  }

  let appVersion: string | undefined;
  if (parsed.app_version !== undefined) {
    if (
      !isNonEmptyTrimmedString(parsed.app_version) ||
      parsed.app_version !== parsed.app_version.trim() ||
      countUnicodeCharacters(parsed.app_version) >
        SEARCH_FEEDBACK_APP_VERSION_MAX_CHARS
    ) {
      pushError(collector, {
        code: "invalid_package_field",
        path: "app_version",
      });
      return fail(collector);
    }
    appVersion = parsed.app_version;
  }

  if (parsed.authority_label !== SEARCH_FEEDBACK_AUTHORITY_LABEL) {
    pushError(collector, {
      code: "invalid_authority_label",
      path: "authority_label",
    });
    return fail(collector);
  }

  if (
    typeof parsed.feedback_count !== "number" ||
    !Number.isInteger(parsed.feedback_count) ||
    !Number.isSafeInteger(parsed.feedback_count) ||
    parsed.feedback_count < 0
  ) {
    pushError(collector, {
      code: "invalid_package_field",
      path: "feedback_count",
    });
    return fail(collector);
  }

  if (!Array.isArray(parsed.feedbacks)) {
    pushError(collector, {
      code: "invalid_package_field",
      path: "feedbacks",
    });
    return fail(collector);
  }

  if (parsed.feedback_count === 0 || parsed.feedbacks.length === 0) {
    pushError(collector, { code: "empty_package", path: "feedbacks" });
    return fail(collector);
  }

  if (parsed.feedback_count !== parsed.feedbacks.length) {
    pushError(collector, {
      code: "feedback_count_mismatch",
      path: "feedback_count",
    });
    return fail(collector);
  }

  const feedbacks: SearchFeedbackDraftV1[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < parsed.feedbacks.length; i += 1) {
    const path = `feedbacks[${i}]`;
    const draftResult = validateSearchFeedbackDraft(parsed.feedbacks[i]);
    if (!draftResult.ok) {
      pushError(collector, {
        code: "invalid_feedback",
        path,
        feedback_index: i,
      });
      if (collector.truncated) return fail(collector);
      continue;
    }
    if (seenIds.has(draftResult.value.feedback_id)) {
      pushError(collector, {
        code: "duplicate_feedback_id",
        path: `${path}.feedback_id`,
        feedback_index: i,
      });
      if (collector.truncated) return fail(collector);
      continue;
    }
    seenIds.add(draftResult.value.feedback_id);
    feedbacks.push(draftResult.value);
  }

  if (collector.errors.length > 0) return fail(collector);

  return {
    ok: true,
    package: {
      package_schema: SEARCH_FEEDBACK_PACKAGE_SCHEMA,
      exported_at: parsed.exported_at,
      ...(appVersion !== undefined ? { app_version: appVersion } : {}),
      authority_label: SEARCH_FEEDBACK_AUTHORITY_LABEL,
      feedback_count: feedbacks.length,
      feedbacks,
    },
  };
}

/**
 * Build a validated, canonically ordered search-feedback package.
 * Caller supplies `exportedAt`. Does not access the clock or IndexedDB.
 */
export function buildSearchFeedbackPackage(
  feedbacks: readonly SearchFeedbackDraftV1[],
  options: {
    exportedAt: string;
    appVersion?: string;
  },
): SearchFeedbackPackageV1 {
  if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
    throw new SearchFeedbackBuildError(
      "empty_feedbacks",
      "buildSearchFeedbackPackage: feedbacks must be a non-empty array",
    );
  }
  if (!isValidSearchFeedbackIsoTimestamp(options.exportedAt)) {
    throw new SearchFeedbackBuildError(
      "invalid_exported_at",
      "buildSearchFeedbackPackage: exportedAt must be a valid ISO-8601 UTC timestamp",
    );
  }
  if (options.appVersion !== undefined) {
    if (
      !isNonEmptyTrimmedString(options.appVersion) ||
      options.appVersion !== options.appVersion.trim() ||
      countUnicodeCharacters(options.appVersion) >
        SEARCH_FEEDBACK_APP_VERSION_MAX_CHARS
    ) {
      throw new SearchFeedbackBuildError(
        "invalid_app_version",
        "buildSearchFeedbackPackage: appVersion must be a non-empty bounded string when present",
      );
    }
  }

  const cloned: SearchFeedbackDraftV1[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < feedbacks.length; i += 1) {
    const input = feedbacks[i];
    try {
      validateSearchFeedbackDraftForWrite(input, `feedbacks[${i}]`);
    } catch {
      throw new SearchFeedbackBuildError(
        "invalid_feedback",
        `feedbacks[${i}]: invalid search feedback draft`,
        i,
      );
    }
    if (seen.has(input.feedback_id)) {
      throw new SearchFeedbackBuildError(
        "duplicate_feedback_id",
        `feedbacks[${i}]: duplicate feedback_id`,
        i,
      );
    }
    seen.add(input.feedback_id);
    cloned.push(cloneSearchFeedbackDraft(input));
  }

  cloned.sort(compareSearchFeedbackDraftsForExport);

  return {
    package_schema: SEARCH_FEEDBACK_PACKAGE_SCHEMA,
    exported_at: options.exportedAt,
    ...(options.appVersion !== undefined ? { app_version: options.appVersion } : {}),
    authority_label: SEARCH_FEEDBACK_AUTHORITY_LABEL,
    feedback_count: cloned.length,
    feedbacks: cloned,
  };
}

function serializeDraft(draft: SearchFeedbackDraftV1, indent: string, level: number): string {
  const pad = indent.repeat(level);
  const pad1 = indent.repeat(level + 1);
  const fields = [
    `${pad1}"schema_version": ${JSON.stringify(draft.schema_version)}`,
    `${pad1}"feedback_id": ${JSON.stringify(draft.feedback_id)}`,
    `${pad1}"bundle_id": ${JSON.stringify(draft.bundle_id)}`,
    `${pad1}"content_sha256": ${JSON.stringify(draft.content_sha256)}`,
    `${pad1}"storage_scope_id": ${JSON.stringify(draft.storage_scope_id)}`,
    `${pad1}"query_raw": ${JSON.stringify(draft.query_raw)}`,
    `${pad1}"search_direction": ${JSON.stringify(draft.search_direction)}`,
    `${pad1}"result_state": ${JSON.stringify(draft.result_state)}`,
    `${pad1}"result_count": ${draft.result_count}`,
  ];
  if (draft.matched_ir_ids !== undefined) {
    const ids =
      draft.matched_ir_ids.length === 0
        ? "[]"
        : `[\n${draft.matched_ir_ids
            .map((id) => `${indent.repeat(level + 2)}${JSON.stringify(id)}`)
            .join(",\n")}\n${pad1}]`;
    fields.push(`${pad1}"matched_ir_ids": ${ids}`);
  }
  if (draft.requested_meaning !== undefined) {
    fields.push(
      `${pad1}"requested_meaning": ${JSON.stringify(draft.requested_meaning)}`,
    );
  }
  if (draft.user_description !== undefined) {
    fields.push(
      `${pad1}"user_description": ${JSON.stringify(draft.user_description)}`,
    );
  }
  fields.push(`${pad1}"created_at": ${JSON.stringify(draft.created_at)}`);
  fields.push(`${pad1}"updated_at": ${JSON.stringify(draft.updated_at)}`);
  fields.push(`${pad1}"status": ${JSON.stringify(draft.status)}`);
  return `{\n${fields.join(",\n")}\n${pad}}`;
}

/**
 * Deterministic package serialization:
 * stable field order, two-space indent, EOF newline, exact Unicode.
 */
export function serializeSearchFeedbackPackage(
  pkg: SearchFeedbackPackageV1,
): string {
  const indent = "  ";

  function indentLines(text: string, levels: number): string {
    const pad = indent.repeat(levels);
    return text
      .split("\n")
      .map((line) => (line.length === 0 ? line : `${pad}${line}`))
      .join("\n");
  }

  const parts: string[] = [
    `${indent}"package_schema": ${JSON.stringify(pkg.package_schema)}`,
    `${indent}"exported_at": ${JSON.stringify(pkg.exported_at)}`,
  ];
  if (pkg.app_version !== undefined) {
    parts.push(`${indent}"app_version": ${JSON.stringify(pkg.app_version)}`);
  }
  parts.push(`${indent}"authority_label": ${JSON.stringify(pkg.authority_label)}`);
  parts.push(`${indent}"feedback_count": ${pkg.feedback_count}`);

  const feedbacksJson =
    pkg.feedbacks.length === 0
      ? "[]"
      : `[\n${pkg.feedbacks
          .map((d) => indentLines(serializeDraft(d, indent, 0), 2))
          .join(",\n")}\n${indent}]`;
  parts.push(`${indent}"feedbacks": ${feedbacksJson}`);

  return `{\n${parts.join(",\n")}\n}\n`;
}

/**
 * UTC filename without vocabulary or device metadata.
 * Format: siralex-search-feedback-YYYY-MM-DDTHH-mm-ssZ.json
 */
export function buildSearchFeedbackFilename(exportedAt: string): string {
  if (!isValidSearchFeedbackIsoTimestamp(exportedAt)) {
    throw new Error(
      "buildSearchFeedbackFilename: exportedAt must be a valid ISO-8601 UTC timestamp",
    );
  }
  const d = new Date(Date.parse(exportedAt));
  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `siralex-search-feedback-${yyyy}-${mm}-${dd}T${hh}-${mi}-${ss}Z.json`;
}

// Re-export schema constant used by tests/docs for draft identity cross-checks.
export { SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION };
