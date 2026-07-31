/**
 * LP1I1 — Learning backup package model, parser, and pure helpers.
 *
 * No IndexedDB, no export download, no restore writes, no UI.
 */

import {
  isValidIsoTimestamp,
  validateLearningRecordForWrite,
  type LearningRecordV1,
} from "./learning_record_types";
import { hasConsistentReviewFields } from "./review_queue";

export const LEARNING_BACKUP_PACKAGE_SCHEMA = "siralex_learning_backup_v1" as const;

export const LEARNING_BACKUP_MAX_BYTES = 25 * 1024 * 1024;

export const LEARNING_BACKUP_FILE_SUFFIX = ".siralex-learning-backup.json";

export const LEARNING_BACKUP_MAX_VALIDATION_ERRORS = 100;

export type LearningBackupBundleSummaryV1 = {
  bundle_id: string;
  record_count: number;
  content_sha256_values: string[];
};

export type LearningBackupPackageV1 = {
  package_schema: typeof LEARNING_BACKUP_PACKAGE_SCHEMA;
  exported_at: string;
  app_version?: string;
  record_count: number;
  bundle_summaries: LearningBackupBundleSummaryV1[];
  records: LearningRecordV1[];
};

export type LearningBackupValidationErrorCode =
  | "file_too_large"
  | "invalid_utf8"
  | "invalid_json"
  | "invalid_top_level"
  | "unsupported_package_schema"
  | "invalid_package_field"
  | "invalid_exported_at"
  | "record_count_mismatch"
  | "invalid_bundle_summary"
  | "bundle_summary_mismatch"
  | "invalid_learning_record"
  | "inconsistent_review_fields"
  | "duplicate_learning_identity"
  | "error_limit_reached";

export type LearningBackupValidationError = {
  code: LearningBackupValidationErrorCode;
  path?: string;
  record_index?: number;
};

export type ParseLearningBackupResult =
  | {
      ok: true;
      package: LearningBackupPackageV1;
    }
  | {
      ok: false;
      errors: LearningBackupValidationError[];
      truncated?: boolean;
    };

export type LearningBackupRestorePolicy = "add_missing" | "replace_all";

export type LearningBackupBundleCompatibility =
  | {
      bundle_id: string;
      record_count: number;
      state: "installed_matching";
    }
  | {
      bundle_id: string;
      record_count: number;
      state: "installed_hash_mismatch";
    }
  | {
      bundle_id: string;
      record_count: number;
      state: "not_installed";
    };

export type LearningBackupRestorePreview = {
  package_schema: typeof LEARNING_BACKUP_PACKAGE_SCHEMA;
  exported_at: string;
  record_count: number;
  current_local_record_count: number;
  bundle_compatibility: LearningBackupBundleCompatibility[];
  add_missing: {
    add_count: number;
    skipped_existing_count: number;
  };
  replace_all: {
    previous_count: number;
    restored_count: number;
  };
};

const PACKAGE_TOP_LEVEL_KEYS = new Set([
  "package_schema",
  "exported_at",
  "app_version",
  "record_count",
  "bundle_summaries",
  "records",
]);

const SUMMARY_KEYS = new Set(["bundle_id", "record_count", "content_sha256_values"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function compareAscii(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function learningBackupRecordKey(bundleId: string, irId: string): string {
  return `${bundleId}\0${irId}`;
}

export function compareLearningBackupRecords(a: LearningRecordV1, b: LearningRecordV1): number {
  const byBundle = compareAscii(a.bundle_id, b.bundle_id);
  if (byBundle !== 0) return byBundle;
  return compareAscii(a.ir_id, b.ir_id);
}

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function deriveLearningBackupBundleSummaries(
  records: readonly LearningRecordV1[],
): LearningBackupBundleSummaryV1[] {
  const byBundle = new Map<string, { count: number; hashes: Set<string> }>();
  for (const record of records) {
    let group = byBundle.get(record.bundle_id);
    if (!group) {
      group = { count: 0, hashes: new Set() };
      byBundle.set(record.bundle_id, group);
    }
    group.count += 1;
    group.hashes.add(record.content_sha256);
  }

  const summaries: LearningBackupBundleSummaryV1[] = [];
  for (const bundleId of [...byBundle.keys()].sort(compareAscii)) {
    const group = byBundle.get(bundleId)!;
    summaries.push({
      bundle_id: bundleId,
      record_count: group.count,
      content_sha256_values: [...group.hashes].sort(compareAscii),
    });
  }
  return summaries;
}

function canonicalizeSummaries(
  summaries: readonly LearningBackupBundleSummaryV1[],
): LearningBackupBundleSummaryV1[] {
  return [...summaries]
    .map((s) => ({
      bundle_id: s.bundle_id,
      record_count: s.record_count,
      content_sha256_values: [...s.content_sha256_values].sort(compareAscii),
    }))
    .sort((a, b) => compareAscii(a.bundle_id, b.bundle_id));
}

function summariesEqual(
  a: readonly LearningBackupBundleSummaryV1[],
  b: readonly LearningBackupBundleSummaryV1[],
): boolean {
  const ca = canonicalizeSummaries(a);
  const cb = canonicalizeSummaries(b);
  if (ca.length !== cb.length) return false;
  for (let i = 0; i < ca.length; i += 1) {
    const left = ca[i]!;
    const right = cb[i]!;
    if (left.bundle_id !== right.bundle_id) return false;
    if (left.record_count !== right.record_count) return false;
    if (left.content_sha256_values.length !== right.content_sha256_values.length) return false;
    for (let h = 0; h < left.content_sha256_values.length; h += 1) {
      if (left.content_sha256_values[h] !== right.content_sha256_values[h]) return false;
    }
  }
  return true;
}

function cloneDisplayCache(
  cache: LearningRecordV1["display_cache"],
): LearningRecordV1["display_cache"] {
  const out: LearningRecordV1["display_cache"] = {
    headword_latin: cache.headword_latin,
  };
  if (cache.headword_nko !== undefined) out.headword_nko = cache.headword_nko;
  if (cache.gloss_short !== undefined) out.gloss_short = cache.gloss_short;
  return out;
}

function cloneLearningRecord(record: LearningRecordV1): LearningRecordV1 {
  return {
    schema_version: record.schema_version,
    bundle_id: record.bundle_id,
    ir_id: record.ir_id,
    ir_kind: record.ir_kind,
    content_sha256: record.content_sha256,
    storage_scope_id: record.storage_scope_id,
    status: record.status,
    created_at: record.created_at,
    display_cache: cloneDisplayCache(record.display_cache),
    last_reviewed: record.last_reviewed,
    review_count: record.review_count,
  };
}

type ErrorCollector = {
  errors: LearningBackupValidationError[];
  truncated: boolean;
};

function pushError(collector: ErrorCollector, error: LearningBackupValidationError): boolean {
  if (collector.errors.length >= LEARNING_BACKUP_MAX_VALIDATION_ERRORS) {
    if (!collector.truncated) {
      collector.truncated = true;
      collector.errors.push({ code: "error_limit_reached" });
    }
    return false;
  }
  collector.errors.push(error);
  return collector.errors.length < LEARNING_BACKUP_MAX_VALIDATION_ERRORS;
}

function fail(collector: ErrorCollector): ParseLearningBackupResult {
  return {
    ok: false,
    errors: collector.errors,
    ...(collector.truncated ? { truncated: true } : {}),
  };
}

function validateSummaryItem(
  value: unknown,
  path: string,
  collector: ErrorCollector,
): LearningBackupBundleSummaryV1 | undefined {
  if (!isPlainObject(value)) {
    pushError(collector, { code: "invalid_bundle_summary", path });
    return undefined;
  }
  for (const key of Object.keys(value)) {
    if (!SUMMARY_KEYS.has(key)) {
      pushError(collector, { code: "invalid_bundle_summary", path: `${path}.${key}` });
      return undefined;
    }
  }
  if (!isNonEmptyString(value.bundle_id)) {
    pushError(collector, { code: "invalid_bundle_summary", path: `${path}.bundle_id` });
    return undefined;
  }
  if (
    typeof value.record_count !== "number" ||
    !Number.isInteger(value.record_count) ||
    !Number.isSafeInteger(value.record_count) ||
    value.record_count < 0
  ) {
    pushError(collector, { code: "invalid_bundle_summary", path: `${path}.record_count` });
    return undefined;
  }
  if (!Array.isArray(value.content_sha256_values)) {
    pushError(collector, {
      code: "invalid_bundle_summary",
      path: `${path}.content_sha256_values`,
    });
    return undefined;
  }
  const hashes: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < value.content_sha256_values.length; i += 1) {
    const hash = value.content_sha256_values[i];
    if (!isNonEmptyString(hash)) {
      pushError(collector, {
        code: "invalid_bundle_summary",
        path: `${path}.content_sha256_values[${i}]`,
      });
      return undefined;
    }
    if (seen.has(hash)) {
      pushError(collector, {
        code: "invalid_bundle_summary",
        path: `${path}.content_sha256_values[${i}]`,
      });
      return undefined;
    }
    seen.add(hash);
    hashes.push(hash);
  }
  return {
    bundle_id: value.bundle_id,
    record_count: value.record_count,
    content_sha256_values: hashes,
  };
}

function validateRecordAt(
  value: unknown,
  index: number,
  collector: ErrorCollector,
  seenKeys: Map<string, number>,
): LearningRecordV1 | undefined {
  const path = `records[${index}]`;
  try {
    validateLearningRecordForWrite(value, path);
  } catch {
    pushError(collector, {
      code: "invalid_learning_record",
      path,
      record_index: index,
    });
    return undefined;
  }
  const record = value as LearningRecordV1;
  if (!hasConsistentReviewFields(record)) {
    pushError(collector, {
      code: "inconsistent_review_fields",
      path,
      record_index: index,
    });
    return undefined;
  }
  const key = learningBackupRecordKey(record.bundle_id, record.ir_id);
  const prior = seenKeys.get(key);
  if (prior !== undefined) {
    pushError(collector, {
      code: "duplicate_learning_identity",
      path,
      record_index: index,
    });
    return undefined;
  }
  seenKeys.set(key, index);
  return cloneLearningRecord(record);
}

/**
 * Parse and strictly validate a Learning backup JSON string.
 * Preserves validated input record order. Does not mutate inputs.
 */
export function parseLearningBackupJson(
  jsonText: string,
  options?: {
    byteLength?: number;
  },
): ParseLearningBackupResult {
  const collector: ErrorCollector = { errors: [], truncated: false };
  const byteLength =
    typeof options?.byteLength === "number" ? options.byteLength : getUtf8ByteLength(jsonText);

  if (
    typeof byteLength !== "number" ||
    !Number.isFinite(byteLength) ||
    byteLength < 0 ||
    byteLength > LEARNING_BACKUP_MAX_BYTES
  ) {
    pushError(collector, { code: "file_too_large" });
    return fail(collector);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
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

  if (parsed.package_schema !== LEARNING_BACKUP_PACKAGE_SCHEMA) {
    pushError(collector, {
      code:
        typeof parsed.package_schema === "string"
          ? "unsupported_package_schema"
          : "invalid_package_field",
      path: "package_schema",
    });
    return fail(collector);
  }

  if (!isValidIsoTimestamp(parsed.exported_at)) {
    pushError(collector, {
      code: "invalid_exported_at",
      path: "exported_at",
    });
    return fail(collector);
  }

  let appVersion: string | undefined;
  if (parsed.app_version !== undefined) {
    if (!isNonEmptyString(parsed.app_version)) {
      pushError(collector, { code: "invalid_package_field", path: "app_version" });
      return fail(collector);
    }
    appVersion = parsed.app_version;
  }

  if (
    typeof parsed.record_count !== "number" ||
    !Number.isInteger(parsed.record_count) ||
    !Number.isSafeInteger(parsed.record_count) ||
    parsed.record_count < 0
  ) {
    pushError(collector, { code: "invalid_package_field", path: "record_count" });
    return fail(collector);
  }

  if (!Array.isArray(parsed.bundle_summaries)) {
    pushError(collector, { code: "invalid_package_field", path: "bundle_summaries" });
    return fail(collector);
  }
  if (!Array.isArray(parsed.records)) {
    pushError(collector, { code: "invalid_package_field", path: "records" });
    return fail(collector);
  }

  if (parsed.record_count === 0 || parsed.records.length === 0) {
    pushError(collector, { code: "invalid_package_field", path: "record_count" });
    return fail(collector);
  }

  if (parsed.record_count !== parsed.records.length) {
    pushError(collector, { code: "record_count_mismatch", path: "record_count" });
    return fail(collector);
  }

  const summaries: LearningBackupBundleSummaryV1[] = [];
  const summaryBundleIds = new Set<string>();
  for (let i = 0; i < parsed.bundle_summaries.length; i += 1) {
    const summary = validateSummaryItem(
      parsed.bundle_summaries[i],
      `bundle_summaries[${i}]`,
      collector,
    );
    if (!summary) {
      if (collector.truncated) return fail(collector);
      continue;
    }
    if (summaryBundleIds.has(summary.bundle_id)) {
      pushError(collector, {
        code: "invalid_bundle_summary",
        path: `bundle_summaries[${i}].bundle_id`,
      });
      continue;
    }
    summaryBundleIds.add(summary.bundle_id);
    summaries.push(summary);
  }

  const records: LearningRecordV1[] = [];
  const seenKeys = new Map<string, number>();
  for (let i = 0; i < parsed.records.length; i += 1) {
    const record = validateRecordAt(parsed.records[i], i, collector, seenKeys);
    if (record) records.push(record);
    if (collector.truncated) return fail(collector);
  }

  if (collector.errors.length > 0) return fail(collector);

  const derived = deriveLearningBackupBundleSummaries(records);
  if (!summariesEqual(summaries, derived)) {
    pushError(collector, { code: "bundle_summary_mismatch", path: "bundle_summaries" });
    return fail(collector);
  }

  const pkg: LearningBackupPackageV1 = {
    package_schema: LEARNING_BACKUP_PACKAGE_SCHEMA,
    exported_at: parsed.exported_at,
    ...(appVersion !== undefined ? { app_version: appVersion } : {}),
    record_count: records.length,
    // Preserve validated input summary order; contents already verified.
    bundle_summaries: summaries.map((s) => ({
      bundle_id: s.bundle_id,
      record_count: s.record_count,
      content_sha256_values: [...s.content_sha256_values],
    })),
    // Preserve validated input record order.
    records,
  };

  return { ok: true, package: pkg };
}

export type LearningBackupBuildErrorCode =
  | "empty_records"
  | "invalid_record"
  | "inconsistent_review_fields"
  | "duplicate_identity"
  | "invalid_exported_at"
  | "invalid_app_version";

/**
 * Typed failure from {@link buildLearningBackupPackage}.
 * Messages are structural; they must not include vocabulary content.
 */
export class LearningBackupBuildError extends Error {
  readonly code: LearningBackupBuildErrorCode;
  readonly recordIndex?: number;

  constructor(code: LearningBackupBuildErrorCode, message: string, recordIndex?: number) {
    super(message);
    this.name = "LearningBackupBuildError";
    this.code = code;
    if (recordIndex !== undefined) {
      this.recordIndex = recordIndex;
    }
  }
}

/**
 * Build a validated, canonically ordered Learning backup package.
 * Caller supplies `exportedAt`. Does not access the clock or IndexedDB.
 */
export function buildLearningBackupPackage(
  records: readonly LearningRecordV1[],
  options: {
    exportedAt: string;
    appVersion?: string;
  },
): LearningBackupPackageV1 {
  if (!Array.isArray(records) || records.length === 0) {
    throw new LearningBackupBuildError(
      "empty_records",
      "buildLearningBackupPackage: records must be a non-empty array",
    );
  }
  if (!isValidIsoTimestamp(options.exportedAt)) {
    throw new LearningBackupBuildError(
      "invalid_exported_at",
      "buildLearningBackupPackage: exportedAt must be a valid ISO-8601 timestamp",
    );
  }
  if (options.appVersion !== undefined && !isNonEmptyString(options.appVersion)) {
    throw new LearningBackupBuildError(
      "invalid_app_version",
      "buildLearningBackupPackage: appVersion must be a non-empty string when present",
    );
  }

  const cloned: LearningRecordV1[] = [];
  const seen = new Map<string, number>();
  for (let i = 0; i < records.length; i += 1) {
    const input = records[i];
    try {
      validateLearningRecordForWrite(input, `records[${i}]`);
    } catch {
      throw new LearningBackupBuildError(
        "invalid_record",
        `records[${i}]: invalid learning record`,
        i,
      );
    }
    if (!hasConsistentReviewFields(input)) {
      throw new LearningBackupBuildError(
        "inconsistent_review_fields",
        `records[${i}]: inconsistent review fields`,
        i,
      );
    }
    const key = learningBackupRecordKey(input.bundle_id, input.ir_id);
    if (seen.has(key)) {
      throw new LearningBackupBuildError(
        "duplicate_identity",
        `records[${i}]: duplicate learning identity`,
        i,
      );
    }
    seen.set(key, i);
    cloned.push(cloneLearningRecord(input));
  }

  cloned.sort(compareLearningBackupRecords);
  const summaries = deriveLearningBackupBundleSummaries(cloned);

  return {
    package_schema: LEARNING_BACKUP_PACKAGE_SCHEMA,
    exported_at: options.exportedAt,
    ...(options.appVersion !== undefined ? { app_version: options.appVersion } : {}),
    record_count: cloned.length,
    bundle_summaries: summaries,
    records: cloned,
  };
}

function serializeDisplayCache(
  cache: LearningRecordV1["display_cache"],
  indent: string,
  level: number,
): string {
  const pad = indent.repeat(level);
  const pad1 = indent.repeat(level + 1);
  const fields: string[] = [
    `${pad1}"headword_latin": ${JSON.stringify(cache.headword_latin)}`,
  ];
  if (cache.headword_nko !== undefined) {
    fields.push(`${pad1}"headword_nko": ${JSON.stringify(cache.headword_nko)}`);
  }
  if (cache.gloss_short !== undefined) {
    fields.push(`${pad1}"gloss_short": ${JSON.stringify(cache.gloss_short)}`);
  }
  return `{\n${fields.join(",\n")}\n${pad}}`;
}

function serializeLearningRecord(record: LearningRecordV1, indent: string, level: number): string {
  const pad = indent.repeat(level);
  const pad1 = indent.repeat(level + 1);
  const fields = [
    `${pad1}"schema_version": ${JSON.stringify(record.schema_version)}`,
    `${pad1}"bundle_id": ${JSON.stringify(record.bundle_id)}`,
    `${pad1}"ir_id": ${JSON.stringify(record.ir_id)}`,
    `${pad1}"ir_kind": ${JSON.stringify(record.ir_kind)}`,
    `${pad1}"content_sha256": ${JSON.stringify(record.content_sha256)}`,
    `${pad1}"storage_scope_id": ${JSON.stringify(record.storage_scope_id)}`,
    `${pad1}"status": ${JSON.stringify(record.status)}`,
    `${pad1}"created_at": ${JSON.stringify(record.created_at)}`,
    `${pad1}"display_cache": ${serializeDisplayCache(record.display_cache, indent, level + 1)}`,
    `${pad1}"last_reviewed": ${JSON.stringify(record.last_reviewed)}`,
    `${pad1}"review_count": ${record.review_count}`,
  ];
  return `{\n${fields.join(",\n")}\n${pad}}`;
}

function serializeSummary(
  summary: LearningBackupBundleSummaryV1,
  indent: string,
  level: number,
): string {
  const pad = indent.repeat(level);
  const pad1 = indent.repeat(level + 1);
  const pad2 = indent.repeat(level + 2);
  const hashes =
    summary.content_sha256_values.length === 0
      ? "[]"
      : `[\n${summary.content_sha256_values
          .map((h) => `${pad2}${JSON.stringify(h)}`)
          .join(",\n")}\n${pad1}]`;
  return `{\n${pad1}"bundle_id": ${JSON.stringify(summary.bundle_id)},\n${pad1}"record_count": ${summary.record_count},\n${pad1}"content_sha256_values": ${hashes}\n${pad}}`;
}

/**
 * Deterministic package serialization: stable field order, two-space indent, EOF newline.
 */
export function serializeLearningBackupPackage(pkg: LearningBackupPackageV1): string {
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
  parts.push(`${indent}"record_count": ${pkg.record_count}`);

  const summariesJson =
    pkg.bundle_summaries.length === 0
      ? "[]"
      : `[\n${pkg.bundle_summaries
          .map((s) => indentLines(serializeSummary(s, indent, 0), 2))
          .join(",\n")}\n${indent}]`;
  parts.push(`${indent}"bundle_summaries": ${summariesJson}`);

  const recordsJson =
    pkg.records.length === 0
      ? "[]"
      : `[\n${pkg.records
          .map((r) => indentLines(serializeLearningRecord(r, indent, 0), 2))
          .join(",\n")}\n${indent}]`;
  parts.push(`${indent}"records": ${recordsJson}`);

  return `{\n${parts.join(",\n")}\n}\n`;
}

/**
 * UTC filename without vocabulary or device metadata.
 * Format: siralex-learning-backup-YYYY-MM-DDTHH-mm-ssZ.json
 */
export function buildLearningBackupFilename(exportedAt: string): string {
  if (!isValidIsoTimestamp(exportedAt)) {
    throw new Error("buildLearningBackupFilename: exportedAt must be a valid ISO-8601 timestamp");
  }
  const d = new Date(Date.parse(exportedAt));
  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `siralex-learning-backup-${yyyy}-${mm}-${dd}T${hh}-${mi}-${ss}Z.json`;
}
