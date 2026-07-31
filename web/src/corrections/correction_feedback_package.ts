/**
 * CF1I1 — Correction feedback package model, parser, builder, and serialization.
 *
 * CorrectionFeedbackPackageV1 is not:
 * - correction_record_v1
 * - correctionset_v1 / correctionset.manifest.json
 * - RFC 6902 patch input
 * - approved correction data
 *
 * It is an unreviewed handoff package for external human review/conversion.
 * No automatic Phase 1.5 converter lives in CF1I1.
 *
 * Pure module: no IndexedDB, clock, DOM, download, network, i18n, or corpus mutation.
 */

import {
  cloneCorrectionDraft,
  compareCorrectionDraftsForExport,
  isValidCorrectionIsoTimestamp,
  parseCorrectionDraft,
  type CorrectionDraftV1,
  validateCorrectionDraftForWrite,
} from "./correction_draft_types";

export const CORRECTION_FEEDBACK_PACKAGE_SCHEMA =
  "siralex_correction_feedback_v1" as const;

export const CORRECTION_FEEDBACK_AUTHORITY_LABEL =
  "unreviewed_user_suggestions_must_not_be_applied_automatically" as const;

/** Dedicated CF1 package size bound (same numeric ceiling as LP1; not a shared constant). */
export const CORRECTION_FEEDBACK_MAX_BYTES = 25 * 1024 * 1024;

export const CORRECTION_FEEDBACK_MAX_VALIDATION_ERRORS = 100;

export const CORRECTION_FEEDBACK_APP_VERSION_MAX_CHARS = 200;

export type CorrectionFeedbackPackageV1 = {
  package_schema: typeof CORRECTION_FEEDBACK_PACKAGE_SCHEMA;
  exported_at: string;
  app_version?: string;
  authority_label: typeof CORRECTION_FEEDBACK_AUTHORITY_LABEL;
  draft_count: number;
  drafts: CorrectionDraftV1[];
};

export type CorrectionFeedbackPackageValidationErrorCode =
  | "file_too_large"
  | "invalid_json"
  | "invalid_top_level"
  | "unsupported_package_schema"
  | "invalid_package_field"
  | "invalid_exported_at"
  | "invalid_authority_label"
  | "draft_count_mismatch"
  | "invalid_draft"
  | "duplicate_draft_id"
  | "empty_package"
  | "error_limit_reached";

export type CorrectionFeedbackPackageValidationError = {
  code: CorrectionFeedbackPackageValidationErrorCode;
  path?: string;
  draft_index?: number;
};

export type ParseCorrectionFeedbackResult =
  | {
      ok: true;
      package: CorrectionFeedbackPackageV1;
    }
  | {
      ok: false;
      errors: CorrectionFeedbackPackageValidationError[];
      truncated?: boolean;
    };

export type CorrectionFeedbackBuildErrorCode =
  | "empty_drafts"
  | "invalid_draft"
  | "duplicate_draft_id"
  | "invalid_exported_at"
  | "invalid_app_version";

/**
 * Typed failure from {@link buildCorrectionFeedbackPackage}.
 * Messages are structural; they must not include user-authored content.
 */
export class CorrectionFeedbackBuildError extends Error {
  readonly code: CorrectionFeedbackBuildErrorCode;
  readonly draftIndex?: number;

  constructor(
    code: CorrectionFeedbackBuildErrorCode,
    message: string,
    draftIndex?: number,
  ) {
    super(message);
    this.name = "CorrectionFeedbackBuildError";
    this.code = code;
    if (draftIndex !== undefined) {
      this.draftIndex = draftIndex;
    }
  }
}

const PACKAGE_TOP_LEVEL_KEYS = new Set([
  "package_schema",
  "exported_at",
  "app_version",
  "authority_label",
  "draft_count",
  "drafts",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function getCorrectionFeedbackUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

type ErrorCollector = {
  errors: CorrectionFeedbackPackageValidationError[];
  truncated: boolean;
};

function pushError(
  collector: ErrorCollector,
  error: CorrectionFeedbackPackageValidationError,
): boolean {
  if (collector.errors.length >= CORRECTION_FEEDBACK_MAX_VALIDATION_ERRORS) {
    if (!collector.truncated) {
      collector.truncated = true;
      collector.errors.push({ code: "error_limit_reached" });
    }
    return false;
  }
  collector.errors.push(error);
  return collector.errors.length < CORRECTION_FEEDBACK_MAX_VALIDATION_ERRORS;
}

function fail(collector: ErrorCollector): ParseCorrectionFeedbackResult {
  return {
    ok: false,
    errors: collector.errors,
    ...(collector.truncated ? { truncated: true } : {}),
  };
}

/**
 * Parse and strictly validate a correction-feedback JSON string.
 * Preserves validated input draft order. Does not mutate inputs.
 * Does not resolve dictionary entries or convert to Phase 1.5 artifacts.
 */
export function parseCorrectionFeedbackJson(
  text: string,
  options?: {
    byteLength?: number;
  },
): ParseCorrectionFeedbackResult {
  const collector: ErrorCollector = { errors: [], truncated: false };
  const byteLength =
    typeof options?.byteLength === "number"
      ? options.byteLength
      : getCorrectionFeedbackUtf8ByteLength(text);

  if (
    typeof byteLength !== "number" ||
    !Number.isFinite(byteLength) ||
    byteLength < 0 ||
    byteLength > CORRECTION_FEEDBACK_MAX_BYTES
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

  if (parsed.package_schema !== CORRECTION_FEEDBACK_PACKAGE_SCHEMA) {
    pushError(collector, {
      code:
        typeof parsed.package_schema === "string"
          ? "unsupported_package_schema"
          : "invalid_package_field",
      path: "package_schema",
    });
    return fail(collector);
  }

  if (!isValidCorrectionIsoTimestamp(parsed.exported_at)) {
    pushError(collector, { code: "invalid_exported_at", path: "exported_at" });
    return fail(collector);
  }

  let appVersion: string | undefined;
  if (parsed.app_version !== undefined) {
    if (
      !isNonEmptyTrimmedString(parsed.app_version) ||
      parsed.app_version !== parsed.app_version.trim() ||
      Array.from(parsed.app_version).length > CORRECTION_FEEDBACK_APP_VERSION_MAX_CHARS
    ) {
      pushError(collector, { code: "invalid_package_field", path: "app_version" });
      return fail(collector);
    }
    appVersion = parsed.app_version;
  }

  if (parsed.authority_label !== CORRECTION_FEEDBACK_AUTHORITY_LABEL) {
    pushError(collector, {
      code: "invalid_authority_label",
      path: "authority_label",
    });
    return fail(collector);
  }

  if (
    typeof parsed.draft_count !== "number" ||
    !Number.isInteger(parsed.draft_count) ||
    !Number.isSafeInteger(parsed.draft_count) ||
    parsed.draft_count < 0
  ) {
    pushError(collector, { code: "invalid_package_field", path: "draft_count" });
    return fail(collector);
  }

  if (!Array.isArray(parsed.drafts)) {
    pushError(collector, { code: "invalid_package_field", path: "drafts" });
    return fail(collector);
  }

  if (parsed.draft_count === 0 || parsed.drafts.length === 0) {
    pushError(collector, { code: "empty_package", path: "drafts" });
    return fail(collector);
  }

  if (parsed.draft_count !== parsed.drafts.length) {
    pushError(collector, { code: "draft_count_mismatch", path: "draft_count" });
    return fail(collector);
  }

  const drafts: CorrectionDraftV1[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < parsed.drafts.length; i += 1) {
    const path = `drafts[${i}]`;
    const draftResult = parseCorrectionDraft(parsed.drafts[i]);
    if (!draftResult.ok) {
      pushError(collector, {
        code: "invalid_draft",
        path,
        draft_index: i,
      });
      if (collector.truncated) return fail(collector);
      continue;
    }
    if (seenIds.has(draftResult.draft.draft_id)) {
      pushError(collector, {
        code: "duplicate_draft_id",
        path: `${path}.draft_id`,
        draft_index: i,
      });
      if (collector.truncated) return fail(collector);
      continue;
    }
    seenIds.add(draftResult.draft.draft_id);
    drafts.push(draftResult.draft);
  }

  if (collector.errors.length > 0) return fail(collector);

  return {
    ok: true,
    package: {
      package_schema: CORRECTION_FEEDBACK_PACKAGE_SCHEMA,
      exported_at: parsed.exported_at,
      ...(appVersion !== undefined ? { app_version: appVersion } : {}),
      authority_label: CORRECTION_FEEDBACK_AUTHORITY_LABEL,
      draft_count: drafts.length,
      drafts,
    },
  };
}

/**
 * Build a validated, canonically ordered correction-feedback package.
 * Caller supplies `exportedAt`. Does not access the clock or IndexedDB.
 */
export function buildCorrectionFeedbackPackage(
  drafts: readonly CorrectionDraftV1[],
  options: {
    exportedAt: string;
    appVersion?: string;
  },
): CorrectionFeedbackPackageV1 {
  if (!Array.isArray(drafts) || drafts.length === 0) {
    throw new CorrectionFeedbackBuildError(
      "empty_drafts",
      "buildCorrectionFeedbackPackage: drafts must be a non-empty array",
    );
  }
  if (!isValidCorrectionIsoTimestamp(options.exportedAt)) {
    throw new CorrectionFeedbackBuildError(
      "invalid_exported_at",
      "buildCorrectionFeedbackPackage: exportedAt must be a valid ISO-8601 UTC timestamp",
    );
  }
  if (options.appVersion !== undefined) {
    if (
      !isNonEmptyTrimmedString(options.appVersion) ||
      options.appVersion !== options.appVersion.trim() ||
      Array.from(options.appVersion).length > CORRECTION_FEEDBACK_APP_VERSION_MAX_CHARS
    ) {
      throw new CorrectionFeedbackBuildError(
        "invalid_app_version",
        "buildCorrectionFeedbackPackage: appVersion must be a non-empty bounded string when present",
      );
    }
  }

  const cloned: CorrectionDraftV1[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < drafts.length; i += 1) {
    const input = drafts[i];
    try {
      validateCorrectionDraftForWrite(input, `drafts[${i}]`);
    } catch {
      throw new CorrectionFeedbackBuildError(
        "invalid_draft",
        `drafts[${i}]: invalid correction draft`,
        i,
      );
    }
    if (seen.has(input.draft_id)) {
      throw new CorrectionFeedbackBuildError(
        "duplicate_draft_id",
        `drafts[${i}]: duplicate draft_id`,
        i,
      );
    }
    seen.add(input.draft_id);
    cloned.push(cloneCorrectionDraft(input));
  }

  cloned.sort(compareCorrectionDraftsForExport);

  return {
    package_schema: CORRECTION_FEEDBACK_PACKAGE_SCHEMA,
    exported_at: options.exportedAt,
    ...(options.appVersion !== undefined ? { app_version: options.appVersion } : {}),
    authority_label: CORRECTION_FEEDBACK_AUTHORITY_LABEL,
    draft_count: cloned.length,
    drafts: cloned,
  };
}

function serializeTarget(target: CorrectionDraftV1["target"], indent: string, level: number): string {
  const pad = indent.repeat(level);
  const pad1 = indent.repeat(level + 1);
  switch (target.type) {
    case "entry":
    case "headword":
    case "part_of_speech":
    case "nko":
      return `{\n${pad1}"type": ${JSON.stringify(target.type)}\n${pad}}`;
    case "sense":
      return `{\n${pad1}"type": "sense",\n${pad1}"sense_index": ${target.sense_index}\n${pad}}`;
    case "translation":
      return `{\n${pad1}"type": "translation",\n${pad1}"sense_index": ${target.sense_index},\n${pad1}"gloss_lang": ${JSON.stringify(target.gloss_lang)}\n${pad}}`;
    case "example":
      return `{\n${pad1}"type": "example",\n${pad1}"sense_index": ${target.sense_index},\n${pad1}"example_index": ${target.example_index}\n${pad}}`;
    case "usage_note":
      return `{\n${pad1}"type": "usage_note",\n${pad1}"sense_index": ${target.sense_index}\n${pad}}`;
    case "other_field":
      return `{\n${pad1}"type": "other_field",\n${pad1}"field_label": ${JSON.stringify(target.field_label)}\n${pad}}`;
  }
}

function serializeSnapshot(
  snapshot: CorrectionDraftV1["display_snapshot"],
  indent: string,
  level: number,
): string {
  const pad = indent.repeat(level);
  const pad1 = indent.repeat(level + 1);
  const fields: string[] = [
    `${pad1}"headword_latin": ${JSON.stringify(snapshot.headword_latin)}`,
  ];
  if (snapshot.headword_nko !== undefined) {
    fields.push(`${pad1}"headword_nko": ${JSON.stringify(snapshot.headword_nko)}`);
  }
  if (snapshot.part_of_speech !== undefined) {
    fields.push(`${pad1}"part_of_speech": ${JSON.stringify(snapshot.part_of_speech)}`);
  }
  if (snapshot.selected_text !== undefined) {
    fields.push(`${pad1}"selected_text": ${JSON.stringify(snapshot.selected_text)}`);
  }
  if (snapshot.selected_gloss !== undefined) {
    fields.push(`${pad1}"selected_gloss": ${JSON.stringify(snapshot.selected_gloss)}`);
  }
  if (snapshot.selected_example !== undefined) {
    fields.push(`${pad1}"selected_example": ${JSON.stringify(snapshot.selected_example)}`);
  }
  if (snapshot.target_language_form !== undefined) {
    fields.push(
      `${pad1}"target_language_form": ${JSON.stringify(snapshot.target_language_form)}`,
    );
  }
  if (snapshot.source_language_text !== undefined) {
    fields.push(
      `${pad1}"source_language_text": ${JSON.stringify(snapshot.source_language_text)}`,
    );
  }
  return `{\n${fields.join(",\n")}\n${pad}}`;
}

function serializeDraft(draft: CorrectionDraftV1, indent: string, level: number): string {
  const pad = indent.repeat(level);
  const pad1 = indent.repeat(level + 1);
  const fields = [
    `${pad1}"schema_version": ${JSON.stringify(draft.schema_version)}`,
    `${pad1}"draft_id": ${JSON.stringify(draft.draft_id)}`,
    `${pad1}"bundle_id": ${JSON.stringify(draft.bundle_id)}`,
    `${pad1}"ir_id": ${JSON.stringify(draft.ir_id)}`,
    `${pad1}"ir_kind": ${JSON.stringify(draft.ir_kind)}`,
    `${pad1}"content_sha256": ${JSON.stringify(draft.content_sha256)}`,
    `${pad1}"storage_scope_id": ${JSON.stringify(draft.storage_scope_id)}`,
    `${pad1}"issue_type": ${JSON.stringify(draft.issue_type)}`,
    `${pad1}"mode": ${JSON.stringify(draft.mode)}`,
    `${pad1}"target": ${serializeTarget(draft.target, indent, level + 1)}`,
    `${pad1}"display_snapshot": ${serializeSnapshot(draft.display_snapshot, indent, level + 1)}`,
    `${pad1}"problem_description": ${JSON.stringify(draft.problem_description)}`,
  ];
  if (draft.proposed_value !== undefined) {
    fields.push(`${pad1}"proposed_value": ${JSON.stringify(draft.proposed_value)}`);
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
export function serializeCorrectionFeedbackPackage(
  pkg: CorrectionFeedbackPackageV1,
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
  parts.push(`${indent}"draft_count": ${pkg.draft_count}`);

  const draftsJson =
    pkg.drafts.length === 0
      ? "[]"
      : `[\n${pkg.drafts
          .map((d) => indentLines(serializeDraft(d, indent, 0), 2))
          .join(",\n")}\n${indent}]`;
  parts.push(`${indent}"drafts": ${draftsJson}`);

  return `{\n${parts.join(",\n")}\n}\n`;
}

/**
 * UTC filename without vocabulary or device metadata.
 * Format: siralex-correction-feedback-YYYY-MM-DDTHH-mm-ssZ.json
 */
export function buildCorrectionFeedbackFilename(exportedAt: string): string {
  if (!isValidCorrectionIsoTimestamp(exportedAt)) {
    throw new Error(
      "buildCorrectionFeedbackFilename: exportedAt must be a valid ISO-8601 UTC timestamp",
    );
  }
  const d = new Date(Date.parse(exportedAt));
  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `siralex-correction-feedback-${yyyy}-${mm}-${dd}T${hh}-${mi}-${ss}Z.json`;
}
