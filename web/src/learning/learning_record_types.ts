/**
 * LS1 Learning Record types and write validation.
 *
 * Personal overlay on dictionary entries — not lexical authority.
 */

export const LEARNING_RECORD_SCHEMA_VERSION = "learning_record_v1" as const;

export type LearningRecordStatus = "still_learning" | "remembered";

/** LS2 reflection outcomes — identical to status values; not widened. */
export type LearningReflectionOutcome = LearningRecordStatus;

export type LearningRecordDisplayCache = {
  headword_latin: string;
  headword_nko?: string;
  gloss_short?: string;
};

export type LearningRecordV1 = {
  schema_version: typeof LEARNING_RECORD_SCHEMA_VERSION;
  bundle_id: string;
  ir_id: string;
  ir_kind: "lexicon_entry";
  content_sha256: string;
  storage_scope_id: string;
  status: LearningRecordStatus;
  created_at: string;
  display_cache: LearningRecordDisplayCache;
  last_reviewed: string | null;
  review_count: number;
};

/** Caller-supplied fields for first Save. Store fills schema/defaults. */
export type SaveLearningRecordInput = {
  bundle_id: string;
  ir_id: string;
  ir_kind: "lexicon_entry";
  content_sha256: string;
  storage_scope_id: string;
  display_cache: LearningRecordDisplayCache;
};

export type LearningRecordUnresolvedReason =
  | "no_active_bundle"
  | "bundle_mismatch"
  | "entry_missing"
  | "not_lexicon_entry";

export class LearningRecordNotFoundError extends Error {
  readonly name = "LearningRecordNotFoundError";

  constructor(bundleId: string, irId: string) {
    super(`Learning Record not found: (${bundleId}, ${irId})`);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isValidStatus(value: unknown): value is LearningRecordStatus {
  return value === "still_learning" || value === "remembered";
}

export function isLearningReflectionOutcome(
  value: unknown,
): value is LearningReflectionOutcome {
  return isValidStatus(value);
}

/**
 * Accept ISO-8601 timestamps that parse as a real Date and round-trip by instant.
 * Rejects empty/whitespace, prose ("yesterday"), and invalid calendar strings.
 * No external date library.
 */
export function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.trim() === "" || value !== value.trim()) return false;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return false;
  const parsed = new Date(ms);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.parse(parsed.toISOString()) === ms;
}

function assertDisplayCache(cache: unknown, label: string): asserts cache is LearningRecordDisplayCache {
  if (typeof cache !== "object" || cache === null) {
    throw new Error(`${label}: display_cache must be an object`);
  }
  const c = cache as Record<string, unknown>;
  if (!isNonEmptyString(c.headword_latin)) {
    throw new Error(`${label}: display_cache.headword_latin must be a non-empty string`);
  }
  if (c.headword_nko !== undefined && typeof c.headword_nko !== "string") {
    throw new Error(`${label}: display_cache.headword_nko must be a string when present`);
  }
  if (c.gloss_short !== undefined && typeof c.gloss_short !== "string") {
    throw new Error(`${label}: display_cache.gloss_short must be a string when present`);
  }
}

/**
 * Validate a complete Learning Record before persist.
 * Throws; callers must not write on failure.
 */
export function validateLearningRecordForWrite(record: unknown, label = "learning_record"): asserts record is LearningRecordV1 {
  if (typeof record !== "object" || record === null) {
    throw new Error(`${label}: must be an object`);
  }
  const r = record as Record<string, unknown>;

  if (r.schema_version !== LEARNING_RECORD_SCHEMA_VERSION) {
    throw new Error(`${label}: schema_version must be "${LEARNING_RECORD_SCHEMA_VERSION}"`);
  }
  if (!isNonEmptyString(r.bundle_id)) {
    throw new Error(`${label}: bundle_id must be a non-empty string`);
  }
  if (!isNonEmptyString(r.ir_id)) {
    throw new Error(`${label}: ir_id must be a non-empty string`);
  }
  if (r.ir_kind !== "lexicon_entry") {
    throw new Error(`${label}: ir_kind must be "lexicon_entry"`);
  }
  if (!isNonEmptyString(r.content_sha256)) {
    throw new Error(`${label}: content_sha256 must be a non-empty string`);
  }
  if (!isNonEmptyString(r.storage_scope_id)) {
    throw new Error(`${label}: storage_scope_id must be a non-empty string`);
  }
  if (!isValidStatus(r.status)) {
    throw new Error(`${label}: status must be "still_learning" or "remembered"`);
  }
  if (!isValidIsoTimestamp(r.created_at)) {
    throw new Error(`${label}: created_at must be a valid ISO-8601 timestamp`);
  }
  assertDisplayCache(r.display_cache, label);

  if (r.last_reviewed !== null && !isValidIsoTimestamp(r.last_reviewed)) {
    throw new Error(`${label}: last_reviewed must be null or a valid ISO-8601 timestamp`);
  }
  if (typeof r.review_count !== "number" || !Number.isInteger(r.review_count) || r.review_count < 0) {
    throw new Error(`${label}: review_count must be a non-negative integer`);
  }
  if (!Number.isSafeInteger(r.review_count)) {
    throw new Error(`${label}: review_count must be a safe integer`);
  }
}

/**
 * Validate Save input before constructing a Learning Record.
 */
export function validateSaveLearningRecordInput(
  input: unknown,
  label = "saveLearningRecord",
): asserts input is SaveLearningRecordInput {
  if (typeof input !== "object" || input === null) {
    throw new Error(`${label}: input must be an object`);
  }
  const r = input as Record<string, unknown>;
  if (!isNonEmptyString(r.bundle_id)) {
    throw new Error(`${label}: bundle_id must be a non-empty string`);
  }
  if (!isNonEmptyString(r.ir_id)) {
    throw new Error(`${label}: ir_id must be a non-empty string`);
  }
  if (r.ir_kind !== "lexicon_entry") {
    throw new Error(`${label}: ir_kind must be "lexicon_entry"`);
  }
  if (!isNonEmptyString(r.content_sha256)) {
    throw new Error(`${label}: content_sha256 must be a non-empty string`);
  }
  if (!isNonEmptyString(r.storage_scope_id)) {
    throw new Error(`${label}: storage_scope_id must be a non-empty string`);
  }
  assertDisplayCache(r.display_cache, label);
}
