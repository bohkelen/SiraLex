/**
 * LP1I3 — Learning backup restore preview and atomic policies.
 *
 * Accepts only WeakMap-provenanced verified packages from parseLearningBackupJson.
 * No UI, file I/O, download, host invalidation, or dictionary mutation.
 */

import {
  STORE_BUNDLES_REGISTRY,
  STORE_LEARNING_RECORDS,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import {
  LEARNING_BACKUP_PACKAGE_SCHEMA,
  isVerifiedLearningBackupPackage,
  learningBackupRecordKey,
  type LearningBackupBundleCompatibility,
  type LearningBackupPackageV1,
  type LearningBackupRestorePolicy,
  type LearningBackupRestorePreview,
  type VerifiedLearningBackupPackage,
} from "./learning_backup_package";
import {
  validateLearningRecordForWrite,
  type LearningRecordV1,
} from "./learning_record_types";
import { hasConsistentReviewFields } from "./review_queue";

export type LearningBackupRestoreErrorCode =
  | "unverified_package"
  | "invalid_local_record"
  | "duplicate_local_identity"
  | "database_read_failed"
  | "database_unavailable"
  | "transaction_failed"
  | "add_missing_unavailable";

export type LearningBackupRestorePreviewResult =
  | {
      ok: true;
      preview: LearningBackupRestorePreview;
    }
  | {
      ok: false;
      code:
        | "unverified_package"
        | "database_read_failed"
        | "invalid_local_record"
        | "duplicate_local_identity";
      invalidRecordCount?: number;
    };

export type LearningBackupRestoreCommitResult =
  | {
      ok: true;
      policy: "add_missing";
      added_count: number;
      skipped_existing_count: number;
      unchanged_count: number;
    }
  | {
      ok: true;
      policy: "replace_all";
      previous_count: number;
      restored_count: number;
    }
  | {
      ok: false;
      code: LearningBackupRestoreErrorCode;
      invalidRecordCount?: number;
    };

export type LearningBackupRestoreTxHooks = {
  /** Invoked after `queued` add requests have been issued; may throw to force abort. */
  afterAddsQueued?: (queued: number) => void;
  /** Invoked after clear() has been issued; may throw to force abort. */
  afterClearQueued?: () => void;
};

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error ?? new Error("transaction_failed")));
    tx.addEventListener("abort", () => reject(tx.error ?? new Error("transaction_aborted")));
  });
}

function compareAscii(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
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

/** Exact supported-field clone for IndexedDB writes (no field rewriting). */
export function cloneLearningRecordExact(record: LearningRecordV1): LearningRecordV1 {
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

/** Exact supported-field equality for diagnostics only. */
export function areLearningRecordsEqual(a: LearningRecordV1, b: LearningRecordV1): boolean {
  if (a.schema_version !== b.schema_version) return false;
  if (a.bundle_id !== b.bundle_id) return false;
  if (a.ir_id !== b.ir_id) return false;
  if (a.ir_kind !== b.ir_kind) return false;
  if (a.content_sha256 !== b.content_sha256) return false;
  if (a.storage_scope_id !== b.storage_scope_id) return false;
  if (a.status !== b.status) return false;
  if (a.created_at !== b.created_at) return false;
  if (a.last_reviewed !== b.last_reviewed) return false;
  if (a.review_count !== b.review_count) return false;
  if (a.display_cache.headword_latin !== b.display_cache.headword_latin) return false;
  if (a.display_cache.headword_nko !== b.display_cache.headword_nko) return false;
  if (a.display_cache.gloss_short !== b.display_cache.gloss_short) return false;
  return true;
}

type LocalAnalysis =
  | {
      ok: true;
      records: LearningRecordV1[];
      byKey: Map<string, LearningRecordV1>;
    }
  | {
      ok: false;
      code: "invalid_local_record" | "duplicate_local_identity";
      invalidRecordCount?: number;
    };

function analyzeLocalRows(rows: readonly unknown[]): LocalAnalysis {
  let invalidRecordCount = 0;
  const records: LearningRecordV1[] = [];
  const byKey = new Map<string, LearningRecordV1>();

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
    if (byKey.has(key)) {
      return { ok: false, code: "duplicate_local_identity" };
    }
    byKey.set(key, record);
    records.push(record);
  }

  if (invalidRecordCount > 0) {
    return { ok: false, code: "invalid_local_record", invalidRecordCount };
  }
  return { ok: true, records, byKey };
}

function classifyBundleCompatibility(
  summaries: LearningBackupPackageV1["bundle_summaries"],
  installed: readonly ActiveBundleMeta[],
): LearningBackupBundleCompatibility[] {
  const installedById = new Map<string, ActiveBundleMeta>();
  for (const meta of installed) {
    installedById.set(meta.bundle_id, meta);
  }

  const rows: LearningBackupBundleCompatibility[] = summaries.map((summary) => {
    const meta = installedById.get(summary.bundle_id);
    if (!meta) {
      return {
        bundle_id: summary.bundle_id,
        record_count: summary.record_count,
        state: "not_installed",
      };
    }
    const expected = meta.expected_content_sha256;
    if (
      typeof expected === "string" &&
      expected.length > 0 &&
      summary.content_sha256_values.includes(expected)
    ) {
      return {
        bundle_id: summary.bundle_id,
        record_count: summary.record_count,
        state: "installed_matching",
      };
    }
    return {
      bundle_id: summary.bundle_id,
      record_count: summary.record_count,
      state: "installed_hash_mismatch",
    };
  });

  rows.sort((a, b) => compareAscii(a.bundle_id, b.bundle_id));
  return rows;
}

async function readPreviewSnapshot(db: IDBDatabase): Promise<{
  learningRows: unknown[];
  installed: ActiveBundleMeta[];
}> {
  const tx = db.transaction([STORE_LEARNING_RECORDS, STORE_BUNDLES_REGISTRY], "readonly");
  const learningRows = (await reqToPromise(
    tx.objectStore(STORE_LEARNING_RECORDS).getAll(),
  )) as unknown[];
  const installed = (await reqToPromise(
    tx.objectStore(STORE_BUNDLES_REGISTRY).getAll(),
  )) as ActiveBundleMeta[];
  await txDone(tx);
  return { learningRows, installed };
}

function buildPreviewFromSnapshots(
  verified: VerifiedLearningBackupPackage,
  learningRows: readonly unknown[],
  installed: readonly ActiveBundleMeta[],
): LearningBackupRestorePreviewResult {
  const pkg = verified.package;
  const local = analyzeLocalRows(learningRows);

  if (local.ok === false && local.code === "duplicate_local_identity") {
    return { ok: false, code: "duplicate_local_identity" };
  }

  const currentLocalCount = learningRows.length;
  const bundleCompatibility = classifyBundleCompatibility(pkg.bundle_summaries, installed);

  if (local.ok === false) {
    const invalidCount = local.invalidRecordCount ?? 1;
    return {
      ok: true,
      preview: {
        package_schema: LEARNING_BACKUP_PACKAGE_SCHEMA,
        exported_at: pkg.exported_at,
        record_count: pkg.record_count,
        current_local_record_count: currentLocalCount,
        local_validation: { state: "invalid", invalid_record_count: invalidCount },
        bundle_compatibility: bundleCompatibility,
        add_missing: { state: "unavailable", reason: "invalid_local_records" },
        replace_all: {
          previous_count: currentLocalCount,
          restored_count: pkg.record_count,
        },
      },
    };
  }

  let addCount = 0;
  let skippedExistingCount = 0;
  for (const record of pkg.records) {
    const key = learningBackupRecordKey(record.bundle_id, record.ir_id);
    if (local.byKey.has(key)) {
      skippedExistingCount += 1;
    } else {
      addCount += 1;
    }
  }

  return {
    ok: true,
    preview: {
      package_schema: LEARNING_BACKUP_PACKAGE_SCHEMA,
      exported_at: pkg.exported_at,
      record_count: pkg.record_count,
      current_local_record_count: local.records.length,
      local_validation: { state: "valid" },
      bundle_compatibility: bundleCompatibility,
      add_missing: {
        state: "available",
        add_count: addCount,
        skipped_existing_count: skippedExistingCount,
      },
      replace_all: {
        previous_count: local.records.length,
        restored_count: pkg.record_count,
      },
    },
  };
}

/**
 * Preview restore impact. No writes.
 * Invalid local rows make Add missing unavailable but still produce a preview
 * so Replace all recovery remains visible.
 */
export async function analyzeLearningBackupRestore(
  db: IDBDatabase,
  verified: unknown,
): Promise<LearningBackupRestorePreviewResult> {
  if (!isVerifiedLearningBackupPackage(verified)) {
    return { ok: false, code: "unverified_package" };
  }

  let snapshot: { learningRows: unknown[]; installed: ActiveBundleMeta[] };
  try {
    snapshot = await readPreviewSnapshot(db);
  } catch {
    return { ok: false, code: "database_read_failed" };
  }

  return buildPreviewFromSnapshots(verified, snapshot.learningRows, snapshot.installed);
}

/**
 * Add missing: insert only absent identities in one learning_records readwrite transaction.
 * Blocks when local Learning state is invalid. Never overwrites existing identities.
 */
export async function restoreLearningBackupAddMissing(
  db: IDBDatabase,
  verified: unknown,
  hooks?: LearningBackupRestoreTxHooks,
): Promise<LearningBackupRestoreCommitResult> {
  if (!isVerifiedLearningBackupPackage(verified)) {
    return { ok: false, code: "unverified_package" };
  }

  const pkg = verified.package;
  const tx = db.transaction(STORE_LEARNING_RECORDS, "readwrite");
  const store = tx.objectStore(STORE_LEARNING_RECORDS);

  try {
    const existingRows = (await reqToPromise(store.getAll())) as unknown[];
    const local = analyzeLocalRows(existingRows);
    if (local.ok === false) {
      tx.abort();
      if (local.code === "duplicate_local_identity") {
        return { ok: false, code: "duplicate_local_identity" };
      }
      return {
        ok: false,
        code: "invalid_local_record",
        invalidRecordCount: local.invalidRecordCount,
      };
    }

    let addedCount = 0;
    let skippedExistingCount = 0;
    const unchangedCount = local.records.length;

    for (const record of pkg.records) {
      const key: [string, string] = [record.bundle_id, record.ir_id];
      const existing = await reqToPromise(store.get(key));
      if (existing != null) {
        skippedExistingCount += 1;
        continue;
      }

      let inserted = false;
      await new Promise<void>((resolve, reject) => {
        const req = store.add(cloneLearningRecordExact(record));
        req.addEventListener("success", () => {
          inserted = true;
          resolve();
        });
        req.addEventListener("error", (event) => {
          if (req.error?.name === "ConstraintError") {
            event.preventDefault();
            event.stopPropagation();
            resolve();
            return;
          }
          reject(req.error);
        });
      });

      if (inserted) {
        addedCount += 1;
        if (hooks?.afterAddsQueued) {
          hooks.afterAddsQueued(addedCount);
        }
      } else {
        skippedExistingCount += 1;
      }
    }

    await txDone(tx);
    return {
      ok: true,
      policy: "add_missing",
      added_count: addedCount,
      skipped_existing_count: skippedExistingCount,
      unchanged_count: unchangedCount,
    };
  } catch {
    try {
      tx.abort();
    } catch {
      // already aborted/completed
    }
    return { ok: false, code: "transaction_failed" };
  }
}

/**
 * Replace all: clear learning_records then insert every backup record in one transaction.
 * Allowed even when local rows are invalid (recovery). Final set equals backup field set.
 */
export async function restoreLearningBackupReplaceAll(
  db: IDBDatabase,
  verified: unknown,
  hooks?: LearningBackupRestoreTxHooks,
): Promise<LearningBackupRestoreCommitResult> {
  if (!isVerifiedLearningBackupPackage(verified)) {
    return { ok: false, code: "unverified_package" };
  }

  const pkg = verified.package;
  const tx = db.transaction(STORE_LEARNING_RECORDS, "readwrite");
  const store = tx.objectStore(STORE_LEARNING_RECORDS);

  try {
    const previousCount = await reqToPromise(store.count());
    store.clear();
    if (hooks?.afterClearQueued) {
      hooks.afterClearQueued();
    }

    let restoredCount = 0;
    for (const record of pkg.records) {
      await reqToPromise(store.add(cloneLearningRecordExact(record)));
      restoredCount += 1;
      if (hooks?.afterAddsQueued) {
        hooks.afterAddsQueued(restoredCount);
      }
    }

    await txDone(tx);
    return {
      ok: true,
      policy: "replace_all",
      previous_count: previousCount,
      restored_count: restoredCount,
    };
  } catch {
    try {
      tx.abort();
    } catch {
      // already aborted/completed
    }
    return { ok: false, code: "transaction_failed" };
  }
}

/**
 * Caller-owned `openDb` adapter. Does not close the database.
 */
export async function commitLearningBackupRestore(deps: {
  openDb: () => Promise<IDBDatabase>;
  verified: unknown;
  policy: LearningBackupRestorePolicy;
  hooks?: LearningBackupRestoreTxHooks;
}): Promise<LearningBackupRestoreCommitResult> {
  let db: IDBDatabase;
  try {
    db = await deps.openDb();
  } catch {
    return { ok: false, code: "database_unavailable" };
  }

  if (deps.policy === "add_missing") {
    return restoreLearningBackupAddMissing(db, deps.verified, deps.hooks);
  }
  return restoreLearningBackupReplaceAll(db, deps.verified, deps.hooks);
}

export { LEARNING_BACKUP_PACKAGE_SCHEMA };
