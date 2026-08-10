/**
 * CF1I1 — Correction draft model and strict validation.
 *
 * Correction drafts are non-authoritative local user evidence.
 * They are not dictionary authority, Learning Records, query logs,
 * correction_record_v1 rows, correctionsets, or RFC 6902 patch inputs.
 *
 * Pure module: no IndexedDB, clock, DOM, network, i18n, or corpus mutation.
 */

export const CORRECTION_DRAFT_SCHEMA_VERSION = "correction_draft_v1" as const;

export const CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS = 2_000;
export const CORRECTION_PROPOSED_VALUE_MAX_CHARS = 2_000;
export const CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS = 120;
export const CORRECTION_SNAPSHOT_FIELD_MAX_CHARS = 500;

export const CORRECTION_MAX_VALIDATION_ERRORS = 100;

export const CORRECTION_DRAFT_ID_MAX_CHARS = 200;
export const CORRECTION_BUNDLE_ID_MAX_CHARS = 500;
export const CORRECTION_IR_ID_MAX_CHARS = 500;
export const CORRECTION_STORAGE_SCOPE_ID_MAX_CHARS = 1_000;
export const CORRECTION_CONTENT_SHA256_MAX_CHARS = 200;

/**
 * Issue taxonomy — language-neutral stored values only.
 * Localized labels belong in i18n (later slices), not in drafts.
 */
export type CorrectionIssueType =
  | "spelling"
  | "translation_or_gloss"
  | "part_of_speech"
  | "nko"
  | "example"
  | "usage_or_context"
  | "missing_information"
  | "duplicate_or_wrong_sense"
  | "other";

export const CORRECTION_ISSUE_TYPES = [
  "spelling",
  "translation_or_gloss",
  "part_of_speech",
  "nko",
  "example",
  "usage_or_context",
  "missing_information",
  "duplicate_or_wrong_sense",
  "other",
] as const satisfies readonly CorrectionIssueType[];

const CORRECTION_ISSUE_TYPE_SET: ReadonlySet<string> = new Set(CORRECTION_ISSUE_TYPES);

export function isCorrectionIssueType(value: unknown): value is CorrectionIssueType {
  return typeof value === "string" && CORRECTION_ISSUE_TYPE_SET.has(value);
}

export type CorrectionMode = "problem_report" | "proposed_correction";

const CORRECTION_MODES = new Set<CorrectionMode>(["problem_report", "proposed_correction"]);

export function isCorrectionMode(value: unknown): value is CorrectionMode {
  return typeof value === "string" && CORRECTION_MODES.has(value as CorrectionMode);
}

/**
 * Target locator for the challenged entry region.
 *
 * Indices are used because SenseRaw/ExampleRaw have no durable sub-IDs.
 * Do not treat sense_num as identity.
 *
 * Russian boundary (RL1):
 * - `"ru"` remains schema-valid for historical drafts and export provenance.
 * - Ordinary consumer Suggest Correction must not offer new RU translation
 *   targets (see `buildCorrectionTargetOptions` / `isConsumerCreatableCorrectionTarget`).
 * - CF1 does not add Russian UI locale, Search language, or product-language support.
 * - Live lexicon may still contain Russian source gloss material.
 */
export type CorrectionTarget =
  | { type: "entry" }
  | { type: "headword" }
  | { type: "part_of_speech" }
  | { type: "nko" }
  | { type: "sense"; sense_index: number }
  | {
      type: "translation";
      sense_index: number;
      gloss_lang: "fr" | "en" | "ru";
    }
  | { type: "example"; sense_index: number; example_index: number }
  | { type: "usage_note"; sense_index: number }
  | { type: "other_field"; field_label: string };

export type CorrectionDisplaySnapshot = {
  headword_latin: string;
  headword_nko?: string;
  part_of_speech?: string;
  selected_text?: string;
  selected_gloss?: string;
  selected_example?: string;
  target_language_form?: string;
  source_language_text?: string;
};

export type CorrectionDraftV1 = {
  schema_version: typeof CORRECTION_DRAFT_SCHEMA_VERSION;
  draft_id: string;
  bundle_id: string;
  ir_id: string;
  ir_kind: "lexicon_entry";
  content_sha256: string;
  storage_scope_id: string;
  issue_type: CorrectionIssueType;
  mode: CorrectionMode;
  target: CorrectionTarget;
  display_snapshot: CorrectionDisplaySnapshot;
  problem_description: string;
  proposed_value?: string;
  created_at: string;
  updated_at: string;
  status: "draft";
};

export type CorrectionDraftValidationErrorCode =
  | "invalid_top_level"
  | "unsupported_schema"
  | "unknown_field"
  | "invalid_identity"
  | "invalid_provenance"
  | "invalid_issue_type"
  | "invalid_mode"
  | "invalid_target"
  | "invalid_snapshot"
  | "invalid_problem_description"
  | "invalid_proposed_value"
  | "invalid_timestamp"
  | "timestamp_order";

export type CorrectionDraftValidationError = {
  code: CorrectionDraftValidationErrorCode;
  path?: string;
};

export type ParseCorrectionDraftResult =
  | {
      ok: true;
      draft: CorrectionDraftV1;
    }
  | {
      ok: false;
      errors: CorrectionDraftValidationError[];
      truncated?: boolean;
    };

const DRAFT_TOP_LEVEL_KEYS = new Set([
  "schema_version",
  "draft_id",
  "bundle_id",
  "ir_id",
  "ir_kind",
  "content_sha256",
  "storage_scope_id",
  "issue_type",
  "mode",
  "target",
  "display_snapshot",
  "problem_description",
  "proposed_value",
  "created_at",
  "updated_at",
  "status",
]);

const SNAPSHOT_KEYS = new Set([
  "headword_latin",
  "headword_nko",
  "part_of_speech",
  "selected_text",
  "selected_gloss",
  "selected_example",
  "target_language_form",
  "source_language_text",
]);

const GLOSS_LANGS = new Set(["fr", "en", "ru"]);

const TARGET_KEYS_BY_TYPE: Readonly<Record<string, ReadonlySet<string>>> = {
  entry: new Set(["type"]),
  headword: new Set(["type"]),
  part_of_speech: new Set(["type"]),
  nko: new Set(["type"]),
  sense: new Set(["type", "sense_index"]),
  translation: new Set(["type", "sense_index", "gloss_lang"]),
  example: new Set(["type", "sense_index", "example_index"]),
  usage_note: new Set(["type", "sense_index"]),
  other_field: new Set(["type", "field_label"]),
};

/**
 * Count Unicode code points (not UTF-16 code units, not grapheme clusters).
 * MVP character limits use this helper consistently.
 */
export function countUnicodeCharacters(value: string): number {
  return Array.from(value).length;
}

/**
 * Control-character policy:
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Canonical UTC ISO-8601 ending in `Z`, parseable and round-trippable by instant.
 * Rejects locale-formatted and offset-form timestamps for CF1 drafts/packages.
 */
export function isValidCorrectionIsoTimestamp(value: unknown): value is string {
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
 * Canonical content-hash shape for correction provenance:
 * `sha256:` + exactly 64 lowercase hexadecimal characters.
 * Uppercase digests are rejected (no silent normalization).
 * Installation is not resolved here.
 */
export function isValidCanonicalContentSha256(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.trim() === "" || value !== value.trim()) return false;
  if (countUnicodeCharacters(value) > CORRECTION_CONTENT_SHA256_MAX_CHARS) return false;
  return /^sha256:[0-9a-f]{64}$/.test(value);
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
  errors: CorrectionDraftValidationError[];
  truncated: boolean;
};

function pushError(collector: ErrorCollector, error: CorrectionDraftValidationError): boolean {
  if (collector.errors.length >= CORRECTION_MAX_VALIDATION_ERRORS) {
    if (!collector.truncated) {
      collector.truncated = true;
    }
    return false;
  }
  collector.errors.push(error);
  return collector.errors.length < CORRECTION_MAX_VALIDATION_ERRORS;
}

function validateUserText(
  value: unknown,
  path: string,
  maxChars: number,
  code: CorrectionDraftValidationErrorCode,
  collector: ErrorCollector,
): string | undefined {
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

function validateTarget(
  value: unknown,
  path: string,
  collector: ErrorCollector,
): CorrectionTarget | undefined {
  if (!isPlainObject(value)) {
    pushError(collector, { code: "invalid_target", path });
    return undefined;
  }
  const type = value.type;
  if (typeof type !== "string" || !(type in TARGET_KEYS_BY_TYPE)) {
    pushError(collector, { code: "invalid_target", path: `${path}.type` });
    return undefined;
  }
  const allowed = TARGET_KEYS_BY_TYPE[type]!;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      pushError(collector, { code: "invalid_target", path: `${path}.${key}` });
      return undefined;
    }
  }

  switch (type) {
    case "entry":
    case "headword":
    case "part_of_speech":
    case "nko":
      return { type };
    case "sense": {
      if (!isSafeNonNegativeInteger(value.sense_index)) {
        pushError(collector, { code: "invalid_target", path: `${path}.sense_index` });
        return undefined;
      }
      return { type: "sense", sense_index: value.sense_index };
    }
    case "translation": {
      if (!isSafeNonNegativeInteger(value.sense_index)) {
        pushError(collector, { code: "invalid_target", path: `${path}.sense_index` });
        return undefined;
      }
      if (typeof value.gloss_lang !== "string" || !GLOSS_LANGS.has(value.gloss_lang)) {
        pushError(collector, { code: "invalid_target", path: `${path}.gloss_lang` });
        return undefined;
      }
      return {
        type: "translation",
        sense_index: value.sense_index,
        gloss_lang: value.gloss_lang as "fr" | "en" | "ru",
      };
    }
    case "example": {
      if (!isSafeNonNegativeInteger(value.sense_index)) {
        pushError(collector, { code: "invalid_target", path: `${path}.sense_index` });
        return undefined;
      }
      if (!isSafeNonNegativeInteger(value.example_index)) {
        pushError(collector, { code: "invalid_target", path: `${path}.example_index` });
        return undefined;
      }
      return {
        type: "example",
        sense_index: value.sense_index,
        example_index: value.example_index,
      };
    }
    case "usage_note": {
      if (!isSafeNonNegativeInteger(value.sense_index)) {
        pushError(collector, { code: "invalid_target", path: `${path}.sense_index` });
        return undefined;
      }
      return { type: "usage_note", sense_index: value.sense_index };
    }
    case "other_field": {
      const label = validateUserText(
        value.field_label,
        `${path}.field_label`,
        CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS,
        "invalid_target",
        collector,
      );
      if (label === undefined) return undefined;
      return { type: "other_field", field_label: label };
    }
    default:
      pushError(collector, { code: "invalid_target", path: `${path}.type` });
      return undefined;
  }
}

function validateSnapshot(
  value: unknown,
  path: string,
  collector: ErrorCollector,
): CorrectionDisplaySnapshot | undefined {
  if (!isPlainObject(value)) {
    pushError(collector, { code: "invalid_snapshot", path });
    return undefined;
  }
  for (const key of Object.keys(value)) {
    if (!SNAPSHOT_KEYS.has(key)) {
      pushError(collector, { code: "unknown_field", path: `${path}.${key}` });
      return undefined;
    }
  }

  const headword = validateUserText(
    value.headword_latin,
    `${path}.headword_latin`,
    CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
    "invalid_snapshot",
    collector,
  );
  if (headword === undefined) return undefined;

  const out: CorrectionDisplaySnapshot = { headword_latin: headword };
  const optionalKeys = [
    "headword_nko",
    "part_of_speech",
    "selected_text",
    "selected_gloss",
    "selected_example",
    "target_language_form",
    "source_language_text",
  ] as const;

  for (const key of optionalKeys) {
    if (value[key] === undefined) continue;
    const text = validateUserText(
      value[key],
      `${path}.${key}`,
      CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
      "invalid_snapshot",
      collector,
    );
    if (text === undefined) return undefined;
    out[key] = text;
  }
  return out;
}

/**
 * Parse and strictly validate a correction draft.
 * Installation-independent. Does not mutate input. Does not insert timestamps.
 */
export function parseCorrectionDraft(value: unknown): ParseCorrectionDraftResult {
  const collector: ErrorCollector = { errors: [], truncated: false };

  if (!isPlainObject(value)) {
    pushError(collector, { code: "invalid_top_level" });
    return { ok: false, errors: collector.errors };
  }

  for (const key of Object.keys(value)) {
    if (!DRAFT_TOP_LEVEL_KEYS.has(key)) {
      pushError(collector, { code: "unknown_field", path: key });
    }
  }
  if (collector.errors.length > 0) {
    return {
      ok: false,
      errors: collector.errors,
      ...(collector.truncated ? { truncated: true } : {}),
    };
  }

  if (value.schema_version !== CORRECTION_DRAFT_SCHEMA_VERSION) {
    pushError(collector, {
      code:
        typeof value.schema_version === "string" ? "unsupported_schema" : "invalid_identity",
      path: "schema_version",
    });
  }

  if (!isValidBoundedId(value.draft_id, CORRECTION_DRAFT_ID_MAX_CHARS)) {
    pushError(collector, { code: "invalid_identity", path: "draft_id" });
  }
  if (!isValidBoundedId(value.bundle_id, CORRECTION_BUNDLE_ID_MAX_CHARS)) {
    pushError(collector, { code: "invalid_identity", path: "bundle_id" });
  }
  if (!isValidBoundedId(value.ir_id, CORRECTION_IR_ID_MAX_CHARS)) {
    pushError(collector, { code: "invalid_identity", path: "ir_id" });
  }
  if (value.ir_kind !== "lexicon_entry") {
    pushError(collector, { code: "invalid_identity", path: "ir_kind" });
  }
  if (value.status !== "draft") {
    pushError(collector, { code: "invalid_identity", path: "status" });
  }

  if (!isValidCanonicalContentSha256(value.content_sha256)) {
    pushError(collector, { code: "invalid_provenance", path: "content_sha256" });
  }
  if (!isValidBoundedId(value.storage_scope_id, CORRECTION_STORAGE_SCOPE_ID_MAX_CHARS)) {
    pushError(collector, { code: "invalid_provenance", path: "storage_scope_id" });
  }

  if (!isCorrectionIssueType(value.issue_type)) {
    pushError(collector, { code: "invalid_issue_type", path: "issue_type" });
  }
  if (!isCorrectionMode(value.mode)) {
    pushError(collector, { code: "invalid_mode", path: "mode" });
  }

  const target = validateTarget(value.target, "target", collector);
  const snapshot = validateSnapshot(value.display_snapshot, "display_snapshot", collector);

  const problem = validateUserText(
    value.problem_description,
    "problem_description",
    CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS,
    "invalid_problem_description",
    collector,
  );

  let proposed: string | undefined;
  if (value.mode === "proposed_correction") {
    proposed = validateUserText(
      value.proposed_value,
      "proposed_value",
      CORRECTION_PROPOSED_VALUE_MAX_CHARS,
      "invalid_proposed_value",
      collector,
    );
  } else if (value.proposed_value !== undefined) {
    // When present on problem_report, must be non-empty meaningful text.
    proposed = validateUserText(
      value.proposed_value,
      "proposed_value",
      CORRECTION_PROPOSED_VALUE_MAX_CHARS,
      "invalid_proposed_value",
      collector,
    );
  }

  if (!isValidCorrectionIsoTimestamp(value.created_at)) {
    pushError(collector, { code: "invalid_timestamp", path: "created_at" });
  }
  if (!isValidCorrectionIsoTimestamp(value.updated_at)) {
    pushError(collector, { code: "invalid_timestamp", path: "updated_at" });
  }
  if (
    isValidCorrectionIsoTimestamp(value.created_at) &&
    isValidCorrectionIsoTimestamp(value.updated_at)
  ) {
    const createdMs = Date.parse(value.created_at);
    const updatedMs = Date.parse(value.updated_at);
    if (!(updatedMs >= createdMs)) {
      pushError(collector, { code: "timestamp_order", path: "updated_at" });
    }
  }

  if (collector.errors.length > 0) {
    return {
      ok: false,
      errors: collector.errors,
      ...(collector.truncated ? { truncated: true } : {}),
    };
  }

  // All required pieces validated above.
  const draft: CorrectionDraftV1 = {
    schema_version: CORRECTION_DRAFT_SCHEMA_VERSION,
    draft_id: value.draft_id as string,
    bundle_id: value.bundle_id as string,
    ir_id: value.ir_id as string,
    ir_kind: "lexicon_entry",
    content_sha256: value.content_sha256 as string,
    storage_scope_id: value.storage_scope_id as string,
    issue_type: value.issue_type as CorrectionIssueType,
    mode: value.mode as CorrectionMode,
    target: target!,
    display_snapshot: snapshot!,
    problem_description: problem!,
    ...(proposed !== undefined ? { proposed_value: proposed } : {}),
    created_at: value.created_at as string,
    updated_at: value.updated_at as string,
    status: "draft",
  };

  return { ok: true, draft: cloneCorrectionDraft(draft) };
}

/**
 * Asserting write validator for future store writes and package construction.
 * One source of truth with {@link parseCorrectionDraft}.
 */
export function validateCorrectionDraftForWrite(
  value: unknown,
  label = "correction_draft",
): asserts value is CorrectionDraftV1 {
  const parsed = parseCorrectionDraft(value);
  if (!parsed.ok) {
    const first = parsed.errors[0];
    const path = first?.path ? ` at ${first.path}` : "";
    throw new Error(`${label}: ${first?.code ?? "invalid_draft"}${path}`);
  }
}

export function cloneCorrectionTarget(target: CorrectionTarget): CorrectionTarget {
  switch (target.type) {
    case "entry":
    case "headword":
    case "part_of_speech":
    case "nko":
      return { type: target.type };
    case "sense":
      return { type: "sense", sense_index: target.sense_index };
    case "translation":
      return {
        type: "translation",
        sense_index: target.sense_index,
        gloss_lang: target.gloss_lang,
      };
    case "example":
      return {
        type: "example",
        sense_index: target.sense_index,
        example_index: target.example_index,
      };
    case "usage_note":
      return { type: "usage_note", sense_index: target.sense_index };
    case "other_field":
      return { type: "other_field", field_label: target.field_label };
  }
}

export function cloneCorrectionDisplaySnapshot(
  snapshot: CorrectionDisplaySnapshot,
): CorrectionDisplaySnapshot {
  const out: CorrectionDisplaySnapshot = {
    headword_latin: snapshot.headword_latin,
  };
  if (snapshot.headword_nko !== undefined) out.headword_nko = snapshot.headword_nko;
  if (snapshot.part_of_speech !== undefined) out.part_of_speech = snapshot.part_of_speech;
  if (snapshot.selected_text !== undefined) out.selected_text = snapshot.selected_text;
  if (snapshot.selected_gloss !== undefined) out.selected_gloss = snapshot.selected_gloss;
  if (snapshot.selected_example !== undefined) out.selected_example = snapshot.selected_example;
  if (snapshot.target_language_form !== undefined) {
    out.target_language_form = snapshot.target_language_form;
  }
  if (snapshot.source_language_text !== undefined) {
    out.source_language_text = snapshot.source_language_text;
  }
  return out;
}

export function cloneCorrectionDraft(draft: CorrectionDraftV1): CorrectionDraftV1 {
  return {
    schema_version: draft.schema_version,
    draft_id: draft.draft_id,
    bundle_id: draft.bundle_id,
    ir_id: draft.ir_id,
    ir_kind: draft.ir_kind,
    content_sha256: draft.content_sha256,
    storage_scope_id: draft.storage_scope_id,
    issue_type: draft.issue_type,
    mode: draft.mode,
    target: cloneCorrectionTarget(draft.target),
    display_snapshot: cloneCorrectionDisplaySnapshot(draft.display_snapshot),
    problem_description: draft.problem_description,
    ...(draft.proposed_value !== undefined ? { proposed_value: draft.proposed_value } : {}),
    created_at: draft.created_at,
    updated_at: draft.updated_at,
    status: draft.status,
  };
}

function targetsEqual(a: CorrectionTarget, b: CorrectionTarget): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "entry":
    case "headword":
    case "part_of_speech":
    case "nko":
      return true;
    case "sense":
      return b.type === "sense" && a.sense_index === b.sense_index;
    case "translation":
      return (
        b.type === "translation" &&
        a.sense_index === b.sense_index &&
        a.gloss_lang === b.gloss_lang
      );
    case "example":
      return (
        b.type === "example" &&
        a.sense_index === b.sense_index &&
        a.example_index === b.example_index
      );
    case "usage_note":
      return b.type === "usage_note" && a.sense_index === b.sense_index;
    case "other_field":
      return b.type === "other_field" && a.field_label === b.field_label;
  }
}

function snapshotsEqual(
  a: CorrectionDisplaySnapshot,
  b: CorrectionDisplaySnapshot,
): boolean {
  return (
    a.headword_latin === b.headword_latin &&
    a.headword_nko === b.headword_nko &&
    a.part_of_speech === b.part_of_speech &&
    a.selected_text === b.selected_text &&
    a.selected_gloss === b.selected_gloss &&
    a.selected_example === b.selected_example &&
    a.target_language_form === b.target_language_form &&
    a.source_language_text === b.source_language_text
  );
}

/** Exact supported-field equality for stale-edit detection. */
export function areCorrectionDraftsEqual(a: CorrectionDraftV1, b: CorrectionDraftV1): boolean {
  return (
    a.schema_version === b.schema_version &&
    a.draft_id === b.draft_id &&
    a.bundle_id === b.bundle_id &&
    a.ir_id === b.ir_id &&
    a.ir_kind === b.ir_kind &&
    a.content_sha256 === b.content_sha256 &&
    a.storage_scope_id === b.storage_scope_id &&
    a.issue_type === b.issue_type &&
    a.mode === b.mode &&
    targetsEqual(a.target, b.target) &&
    snapshotsEqual(a.display_snapshot, b.display_snapshot) &&
    a.problem_description === b.problem_description &&
    a.proposed_value === b.proposed_value &&
    a.created_at === b.created_at &&
    a.updated_at === b.updated_at &&
    a.status === b.status
  );
}

function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Export ordering: bundle_id → ir_id → created_at → draft_id.
 * Code-point comparison only — never localeCompare.
 */
export function compareCorrectionDraftsForExport(
  a: CorrectionDraftV1,
  b: CorrectionDraftV1,
): number {
  const byBundle = compareCodePoints(a.bundle_id, b.bundle_id);
  if (byBundle !== 0) return byBundle;
  const byIr = compareCodePoints(a.ir_id, b.ir_id);
  if (byIr !== 0) return byIr;
  const byCreated = compareCodePoints(a.created_at, b.created_at);
  if (byCreated !== 0) return byCreated;
  return compareCodePoints(a.draft_id, b.draft_id);
}
