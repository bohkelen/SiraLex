/**
 * LP1I2 — Deterministic Learning backup export pipeline.
 *
 * Reads one Learning Record snapshot, builds a self-validated package artifact.
 * No browser download, no restore, no UI, no dictionary/query-log export.
 */

import { STORE_LEARNING_RECORDS } from "../idb/siralex_db";
import {
  LEARNING_BACKUP_MAX_BYTES,
  LEARNING_BACKUP_PACKAGE_SCHEMA,
  LearningBackupBuildError,
  buildLearningBackupFilename,
  buildLearningBackupPackage,
  getUtf8ByteLength,
  learningBackupRecordKey,
  parseLearningBackupJson,
  serializeLearningBackupPackage,
  type LearningBackupPackageV1,
  type ParseLearningBackupResult,
} from "./learning_backup_package";
import { listAllLearningRecords } from "./learning_record_store";
import {
  isValidIsoTimestamp,
  validateLearningRecordForWrite,
  type LearningRecordV1,
} from "./learning_record_types";
import { hasConsistentReviewFields } from "./review_queue";

export type LearningBackupExportArtifact = {
  filename: string;
  mediaType: "application/json";
  text: string;
  byteLength: number;
  recordCount: number;
  bundleCount: number;
  exportedAt: string;
};

export type LearningBackupExportErrorCode =
  | "no_learning_records"
  | "invalid_local_record"
  | "duplicate_learning_identity"
  | "generated_package_invalid"
  | "generated_package_too_large"
  | "database_unavailable"
  | "database_read_failed";

export type CreateLearningBackupExportResult =
  | {
      ok: true;
      artifact: LearningBackupExportArtifact;
    }
  | {
      ok: false;
      code: LearningBackupExportErrorCode;
      invalidRecordCount?: number;
    };

export type BuildLearningBackupExportArtifactOptions = {
  exportedAt: string;
  appVersion?: string;
  /** Production default: LEARNING_BACKUP_MAX_BYTES. Narrow seam for size tests. */
  maxBytes?: number;
  serialize?: (pkg: LearningBackupPackageV1) => string;
  parse?: (
    jsonText: string,
    options?: { byteLength?: number },
  ) => ParseLearningBackupResult;
};

function fail(
  code: LearningBackupExportErrorCode,
  invalidRecordCount?: number,
): CreateLearningBackupExportResult {
  return invalidRecordCount !== undefined
    ? { ok: false, code, invalidRecordCount }
    : { ok: false, code };
}

function sortedIdentityKeys(records: readonly LearningRecordV1[]): string[] {
  return records
    .map((r) => learningBackupRecordKey(r.bundle_id, r.ir_id))
    .slice()
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function sortedBundleIds(pkg: LearningBackupPackageV1): string[] {
  return pkg.bundle_summaries
    .map((s) => s.bundle_id)
    .slice()
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function mapBuildError(err: LearningBackupBuildError): CreateLearningBackupExportResult {
  switch (err.code) {
    case "empty_records":
      return fail("no_learning_records");
    case "duplicate_identity":
      return fail("duplicate_learning_identity");
    case "invalid_record":
    case "inconsistent_review_fields":
      return fail("invalid_local_record", 1);
    case "invalid_exported_at":
    case "invalid_app_version":
      return fail("generated_package_invalid");
    default:
      return fail("generated_package_invalid");
  }
}

/**
 * Pre-scan local rows for structural / review / duplicate failures without repair.
 * Returns validated LearningRecordV1[] or a typed export failure.
 */
function analyzeLocalRecords(
  rows: readonly unknown[],
): CreateLearningBackupExportResult | LearningRecordV1[] {
  if (rows.length === 0) {
    return fail("no_learning_records");
  }

  let invalidRecordCount = 0;
  const validated: LearningRecordV1[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      validateLearningRecordForWrite(row, `local_records[${i}]`);
    } catch {
      invalidRecordCount += 1;
      continue;
    }
    const record = row as LearningRecordV1;
    if (!hasConsistentReviewFields(record)) {
      invalidRecordCount += 1;
      continue;
    }
    const key = learningBackupRecordKey(record.bundle_id, record.ir_id);
    if (seen.has(key)) {
      return fail("duplicate_learning_identity");
    }
    seen.set(key, i);
    validated.push(record);
  }

  if (invalidRecordCount > 0) {
    return fail("invalid_local_record", invalidRecordCount);
  }

  return validated;
}

function identitiesMatch(a: LearningBackupPackageV1, b: LearningBackupPackageV1): boolean {
  if (a.record_count !== b.record_count) return false;
  if (a.package_schema !== b.package_schema) return false;
  const keysA = sortedIdentityKeys(a.records);
  const keysB = sortedIdentityKeys(b.records);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) {
    if (keysA[i] !== keysB[i]) return false;
  }
  const bundlesA = sortedBundleIds(a);
  const bundlesB = sortedBundleIds(b);
  if (bundlesA.length !== bundlesB.length) return false;
  for (let i = 0; i < bundlesA.length; i += 1) {
    if (bundlesA[i] !== bundlesB[i]) return false;
  }
  return true;
}

/**
 * Pure artifact builder: no IndexedDB, clock, DOM, Blob, download, or mutation.
 */
export function buildLearningBackupExportArtifact(
  records: readonly unknown[],
  options: BuildLearningBackupExportArtifactOptions,
): CreateLearningBackupExportResult {
  const { exportedAt, appVersion } = options;
  const maxBytes = options.maxBytes ?? LEARNING_BACKUP_MAX_BYTES;
  const serialize = options.serialize ?? serializeLearningBackupPackage;
  const parse = options.parse ?? parseLearningBackupJson;

  if (!isValidIsoTimestamp(exportedAt)) {
    return fail("generated_package_invalid");
  }

  const analyzed = analyzeLocalRecords(records);
  if (!Array.isArray(analyzed)) {
    return analyzed;
  }

  let pkg: LearningBackupPackageV1;
  try {
    pkg = buildLearningBackupPackage(analyzed, { exportedAt, appVersion });
  } catch (err) {
    if (err instanceof LearningBackupBuildError) {
      return mapBuildError(err);
    }
    return fail("generated_package_invalid");
  }

  let text: string;
  let filename: string;
  try {
    text = serialize(pkg);
    filename = buildLearningBackupFilename(exportedAt);
  } catch {
    return fail("generated_package_invalid");
  }

  const byteLength = getUtf8ByteLength(text);
  if (byteLength > maxBytes) {
    return fail("generated_package_too_large");
  }

  const parsed = parse(text, { byteLength });
  if (!parsed.ok) {
    return fail("generated_package_invalid");
  }
  if (parsed.package.record_count !== pkg.record_count) {
    return fail("generated_package_invalid");
  }
  if (!identitiesMatch(pkg, parsed.package)) {
    return fail("generated_package_invalid");
  }

  return {
    ok: true,
    artifact: {
      filename,
      mediaType: "application/json",
      text,
      byteLength,
      recordCount: pkg.record_count,
      bundleCount: pkg.bundle_summaries.length,
      exportedAt,
    },
  };
}

/**
 * One readonly `learning_records` transaction; all bundles; no active-bundle filter.
 * Caller owns the database connection.
 */
export async function readAllLearningRecordsForBackup(db: IDBDatabase): Promise<unknown[]> {
  return listAllLearningRecords(db);
}

export type CreateLearningBackupExportDeps = {
  openDb: () => Promise<IDBDatabase>;
  /** Called exactly once. Must return a valid ISO-8601 timestamp. */
  now: () => string;
  appVersion?: string;
  /** Optional pure-builder seams for focused fault injection in tests. */
  maxBytes?: number;
  serialize?: BuildLearningBackupExportArtifactOptions["serialize"];
  parse?: BuildLearningBackupExportArtifactOptions["parse"];
  readAll?: (db: IDBDatabase) => Promise<unknown[]>;
};

/**
 * Application export pipeline.
 *
 * Ownership: `openDb` returns a caller-owned connection. This function does not
 * close the database (matches repository session/store conventions).
 *
 * Snapshot: the backup contains the complete Learning Record set observed by
 * one readonly IndexedDB transaction inside {@link readAllLearningRecordsForBackup}.
 * Package construction happens after that transaction completes.
 */
export async function createLearningBackupExport(
  deps: CreateLearningBackupExportDeps,
): Promise<CreateLearningBackupExportResult> {
  const exportedAt = deps.now();
  if (!isValidIsoTimestamp(exportedAt)) {
    return fail("generated_package_invalid");
  }

  let db: IDBDatabase;
  try {
    db = await deps.openDb();
  } catch {
    return fail("database_unavailable");
  }

  const readAll = deps.readAll ?? readAllLearningRecordsForBackup;
  let rows: unknown[];
  try {
    rows = await readAll(db);
  } catch {
    return fail("database_read_failed");
  }

  return buildLearningBackupExportArtifact(rows, {
    exportedAt,
    appVersion: deps.appVersion,
    maxBytes: deps.maxBytes,
    serialize: deps.serialize,
    parse: deps.parse,
  });
}

/** Store name touched by Learning backup export reads (documentation / tests). */
export const LEARNING_BACKUP_EXPORT_STORE = STORE_LEARNING_RECORDS;

export { LEARNING_BACKUP_PACKAGE_SCHEMA };
