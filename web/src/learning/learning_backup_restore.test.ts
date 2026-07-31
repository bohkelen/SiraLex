/**
 * LP1I3 — Restore preview and atomic policy tests.
 */

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_BUNDLES_REGISTRY,
  STORE_LEARNING_RECORDS,
  STORE_META,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { appendQueryLog } from "../query_logging/query_log_store";
import {
  buildLearningBackupPackage,
  isVerifiedLearningBackupPackage,
  parseLearningBackupJson,
  serializeLearningBackupPackage,
  type VerifiedLearningBackupPackage,
} from "./learning_backup_package";
import {
  analyzeLearningBackupRestore,
  areLearningRecordsEqual,
  commitLearningBackupRestore,
  restoreLearningBackupAddMissing,
  restoreLearningBackupReplaceAll,
} from "./learning_backup_restore";
import { listAllLearningRecords, saveLearningRecord } from "./learning_record_store";
import {
  LEARNING_RECORD_SCHEMA_VERSION,
  type LearningRecordV1,
  type SaveLearningRecordInput,
} from "./learning_record_types";

const HASH_A = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HASH_C = "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const TS = "2026-07-01T10:00:00.000Z";
const TS_REVIEW = "2026-07-02T12:00:00.000Z";
const EXPORTED_AT = "2026-07-30T22:30:00.000Z";
const BUNDLE_A = "bundle_a";
const BUNDLE_B = "bundle_b";

function makeRecord(overrides: Partial<LearningRecordV1> = {}): LearningRecordV1 {
  return {
    schema_version: LEARNING_RECORD_SCHEMA_VERSION,
    bundle_id: BUNDLE_A,
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH_A,
    storage_scope_id: `${BUNDLE_A}::${HASH_A}`,
    status: "still_learning",
    created_at: TS,
    display_cache: { headword_latin: "kùn" },
    last_reviewed: null,
    review_count: 0,
    ...overrides,
  };
}

function makeActiveMeta(overrides: Partial<ActiveBundleMeta> = {}): ActiveBundleMeta {
  return {
    bundle_id: BUNDLE_A,
    storage_scope_id: `${BUNDLE_A}::${HASH_A}`,
    expected_content_sha256: HASH_A,
    manifest_schema_version: "bundle_manifest_v1",
    record_schema_id: "normalized_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "REPLACE_ALL",
    reconciliation_action: "REPLACE_ALL",
    imported_at_iso: "2026-07-29T00:00:00.000Z",
    ...overrides,
  };
}

function makeSaveInput(overrides: Partial<SaveLearningRecordInput> = {}): SaveLearningRecordInput {
  return {
    bundle_id: BUNDLE_A,
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH_A,
    storage_scope_id: `${BUNDLE_A}::${HASH_A}`,
    display_cache: { headword_latin: "kùn" },
    ...overrides,
  };
}

function verifyPackage(records: LearningRecordV1[]): VerifiedLearningBackupPackage {
  const built = buildLearningBackupPackage(records, { exportedAt: EXPORTED_AT, appVersion: "t" });
  const parsed = parseLearningBackupJson(serializeLearningBackupPackage(built));
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error("expected verified package");
  return parsed.verified;
}

async function putRawLearning(db: IDBDatabase, record: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_LEARNING_RECORDS, "readwrite");
    tx.objectStore(STORE_LEARNING_RECORDS).put(record);
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function countStore(db: IDBDatabase, storeName: string): Promise<number> {
  const tx = db.transaction(storeName, "readonly");
  return await new Promise((resolve, reject) => {
    const req = tx.objectStore(storeName).count();
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

async function snapshotStores(db: IDBDatabase) {
  return {
    learning: await countStore(db, STORE_LEARNING_RECORDS),
    records: await countStore(db, STORE_RECORDS),
    search: await countStore(db, STORE_SEARCH_INDEX),
    bundles: await countStore(db, STORE_BUNDLES_REGISTRY),
    queryLogs: await countStore(db, STORE_QUERY_LOGS),
  };
}

async function listLearningSorted(db: IDBDatabase): Promise<LearningRecordV1[]> {
  const rows = await listAllLearningRecords(db);
  return [...rows].sort((a, b) =>
    a.bundle_id === b.bundle_id
      ? a.ir_id < b.ir_id
        ? -1
        : a.ir_id > b.ir_id
          ? 1
          : 0
      : a.bundle_id < b.bundle_id
        ? -1
        : 1,
  );
}

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // fine if missing
  }
});

async function withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openSiralexDb();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

describe("verified-package boundary", () => {
  it("parser success produces verified input; plain/manual packages are rejected", async () => {
    const verified = verifyPackage([makeRecord()]);
    expect(isVerifiedLearningBackupPackage(verified)).toBe(true);
    expect(isVerifiedLearningBackupPackage({ package: verified.package })).toBe(false);
    expect(isVerifiedLearningBackupPackage(verified.package)).toBe(false);

    await withDb(async (db) => {
      const preview = await analyzeLearningBackupRestore(db, {
        package: verified.package,
      });
      expect(preview).toEqual({ ok: false, code: "unverified_package" });

      const add = await restoreLearningBackupAddMissing(db, {
        package: buildLearningBackupPackage([makeRecord()], { exportedAt: EXPORTED_AT }),
      });
      expect(add).toEqual({ ok: false, code: "unverified_package" });
      expect(await listAllLearningRecords(db)).toHaveLength(0);
    });
  });

  it("verified package is frozen against mutation of commit input", () => {
    const verified = verifyPackage([makeRecord({ ir_id: "frozen" })]);
    expect(Object.isFrozen(verified)).toBe(true);
    expect(Object.isFrozen(verified.package)).toBe(true);
    expect(() => {
      (verified.package as { record_count: number }).record_count = 99;
    }).toThrow();
    expect(verified.package.record_count).toBe(1);
  });

  it("unknown package schema never reaches restore", () => {
    const parsed = parseLearningBackupJson(
      JSON.stringify({
        package_schema: "siralex_learning_backup_v0",
        exported_at: EXPORTED_AT,
        record_count: 1,
        bundle_summaries: [],
        records: [makeRecord()],
      }),
    );
    expect(parsed.ok).toBe(false);
  });
});

describe("preview", () => {
  it("covers empty, absent, existing, local-only, and mixed cases without writes", async () => {
    await withDb(async (db) => {
      const backup = verifyPackage([
        makeRecord({ ir_id: "a" }),
        makeRecord({ ir_id: "b", review_count: 1, last_reviewed: TS_REVIEW }),
      ]);

      const empty = await analyzeLearningBackupRestore(db, backup);
      expect(empty.ok).toBe(true);
      if (!empty.ok) return;
      expect(empty.preview.add_missing).toEqual({
        state: "available",
        add_count: 2,
        skipped_existing_count: 0,
      });
      expect(empty.preview.replace_all).toEqual({ previous_count: 0, restored_count: 2 });

      await putRawLearning(db, makeRecord({ ir_id: "a" }));
      await putRawLearning(
        db,
        makeRecord({
          ir_id: "b",
          status: "remembered",
          review_count: 9,
          last_reviewed: TS_REVIEW,
          display_cache: { headword_latin: "conflict" },
        }),
      );
      await putRawLearning(db, makeRecord({ ir_id: "local-only" }));

      const mixed = await analyzeLearningBackupRestore(db, backup);
      expect(mixed.ok).toBe(true);
      if (!mixed.ok) return;
      expect(mixed.preview.current_local_record_count).toBe(3);
      expect(mixed.preview.add_missing).toEqual({
        state: "available",
        add_count: 0,
        skipped_existing_count: 2,
      });
      expect(mixed.preview.replace_all).toEqual({ previous_count: 3, restored_count: 2 });
      expect(mixed.preview.local_validation).toEqual({ state: "valid" });
      expect(await listAllLearningRecords(db)).toHaveLength(3);
    });
  });

  it("is deterministic and does not mutate package records", async () => {
    await withDb(async (db) => {
      await putInstalledBundleMeta(db, makeActiveMeta({ bundle_id: BUNDLE_B, expected_content_sha256: HASH_B }));
      const verified = verifyPackage([
        makeRecord({ bundle_id: BUNDLE_B, ir_id: "z", content_sha256: HASH_B }),
        makeRecord({ bundle_id: BUNDLE_A, ir_id: "a" }),
      ]);
      const snap = structuredClone(verified.package.records);
      const first = await analyzeLearningBackupRestore(db, verified);
      const second = await analyzeLearningBackupRestore(db, verified);
      expect(first).toEqual(second);
      expect(first.ok && first.preview.bundle_compatibility.map((r) => r.bundle_id)).toEqual([
        BUNDLE_A,
        BUNDLE_B,
      ]);
      expect(verified.package.records).toEqual(snap);
    });
  });

  it("marks Add missing unavailable when local rows are invalid but still previews Replace all", async () => {
    await withDb(async (db) => {
      await putRawLearning(db, {
        ...makeRecord({ ir_id: "bad" }),
        schema_version: "learning_record_v0",
      });
      const verified = verifyPackage([makeRecord({ ir_id: "ok" })]);
      const preview = await analyzeLearningBackupRestore(db, verified);
      expect(preview.ok).toBe(true);
      if (!preview.ok) return;
      expect(preview.preview.local_validation).toEqual({
        state: "invalid",
        invalid_record_count: 1,
      });
      expect(preview.preview.add_missing).toEqual({
        state: "unavailable",
        reason: "invalid_local_records",
      });
      expect(preview.preview.replace_all).toEqual({ previous_count: 1, restored_count: 1 });
      expect(JSON.stringify(preview)).not.toContain("kùn");
    });
  });
});

describe("bundle compatibility", () => {
  it("classifies matching, mismatch, missing, and multi-hash summaries without blocking commit", async () => {
    await withDb(async (db) => {
      await putInstalledBundleMeta(db, makeActiveMeta({ bundle_id: BUNDLE_A, expected_content_sha256: HASH_A }));
      await putInstalledBundleMeta(
        db,
        makeActiveMeta({
          bundle_id: BUNDLE_B,
          expected_content_sha256: HASH_C,
          storage_scope_id: `${BUNDLE_B}::${HASH_C}`,
        }),
      );

      const verified = verifyPackage([
        makeRecord({ bundle_id: BUNDLE_A, ir_id: "a1", content_sha256: HASH_A }),
        makeRecord({ bundle_id: BUNDLE_A, ir_id: "a2", content_sha256: HASH_B }),
        makeRecord({ bundle_id: BUNDLE_B, ir_id: "b1", content_sha256: HASH_B }),
        makeRecord({
          bundle_id: "bundle_missing",
          ir_id: "m1",
          content_sha256: HASH_A,
          storage_scope_id: `bundle_missing::${HASH_A}`,
        }),
      ]);

      const preview = await analyzeLearningBackupRestore(db, verified);
      expect(preview.ok).toBe(true);
      if (!preview.ok) return;
      expect(preview.preview.bundle_compatibility).toEqual([
        { bundle_id: BUNDLE_A, record_count: 2, state: "installed_matching" },
        { bundle_id: BUNDLE_B, record_count: 1, state: "installed_hash_mismatch" },
        { bundle_id: "bundle_missing", record_count: 1, state: "not_installed" },
      ]);

      const replaced = await restoreLearningBackupReplaceAll(db, verified);
      expect(replaced.ok).toBe(true);
      expect(await listAllLearningRecords(db)).toHaveLength(4);
    });
  });
});

describe("add missing", () => {
  it("inserts absent, skips identical/conflicting, retains local-only, preserves exact fields", async () => {
    await withDb(async (db) => {
      const identical = makeRecord({ ir_id: "same" });
      const conflictingLocal = makeRecord({
        ir_id: "conflict",
        review_count: 3,
        last_reviewed: TS_REVIEW,
        status: "remembered",
      });
      const localOnly = makeRecord({ ir_id: "local-only" });
      await putRawLearning(db, identical);
      await putRawLearning(db, conflictingLocal);
      await putRawLearning(db, localOnly);

      const unresolved = makeRecord({
        ir_id: "orphan",
        content_sha256: HASH_B,
        storage_scope_id: `${BUNDLE_A}::${HASH_B}`,
        display_cache: { headword_latin: "orphan", headword_nko: "ߊ" },
      });
      const toAdd = makeRecord({ ir_id: "new" });
      const verified = verifyPackage([
        identical,
        makeRecord({
          ir_id: "conflict",
          review_count: 1,
          last_reviewed: TS_REVIEW,
          status: "still_learning",
        }),
        unresolved,
        toAdd,
      ]);

      const result = await restoreLearningBackupAddMissing(db, verified);
      expect(result).toEqual({
        ok: true,
        policy: "add_missing",
        added_count: 2,
        skipped_existing_count: 2,
        unchanged_count: 3,
      });

      const rows = await listLearningSorted(db);
      expect(rows.map((r) => r.ir_id)).toEqual(["conflict", "local-only", "new", "orphan", "same"]);
      expect(areLearningRecordsEqual(rows.find((r) => r.ir_id === "conflict")!, conflictingLocal)).toBe(
        true,
      );
      expect(areLearningRecordsEqual(rows.find((r) => r.ir_id === "orphan")!, unresolved)).toBe(true);
      expect(areLearningRecordsEqual(rows.find((r) => r.ir_id === "new")!, toAdd)).toBe(true);

      const second = await restoreLearningBackupAddMissing(db, verified);
      expect(second).toEqual({
        ok: true,
        policy: "add_missing",
        added_count: 0,
        skipped_existing_count: 4,
        unchanged_count: 5,
      });
    });
  });

  it("blocks on invalid local state without mutation", async () => {
    await withDb(async (db) => {
      await putRawLearning(db, {
        ...makeRecord({ ir_id: "bad" }),
        review_count: 0,
        last_reviewed: TS_REVIEW,
      });
      const before = await listLearningSorted(db);
      const verified = verifyPackage([makeRecord({ ir_id: "ok" })]);
      const result = await restoreLearningBackupAddMissing(db, verified);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("invalid_local_record");
      expect(await listLearningSorted(db)).toEqual(before);
    });
  });

  it("rolls back when a queued add fails via hook", async () => {
    await withDb(async (db) => {
      await putRawLearning(db, makeRecord({ ir_id: "keep" }));
      const before = JSON.stringify(await listLearningSorted(db));
      const verified = verifyPackage([
        makeRecord({ ir_id: "a" }),
        makeRecord({ ir_id: "b" }),
      ]);
      const result = await restoreLearningBackupAddMissing(db, verified, {
        afterAddsQueued: (n) => {
          if (n >= 1) throw new Error("forced");
        },
      });
      expect(result).toEqual({ ok: false, code: "transaction_failed" });
      expect(JSON.stringify(await listLearningSorted(db))).toBe(before);
    });
  });
});

describe("replace all", () => {
  it("replaces local set exactly, removes local-only, preserves unresolved stamps", async () => {
    await withDb(async (db) => {
      await putRawLearning(db, makeRecord({ ir_id: "old" }));
      await putRawLearning(db, makeRecord({ ir_id: "local-only" }));
      const backupRows = [
        makeRecord({
          ir_id: "old",
          review_count: 2,
          last_reviewed: TS_REVIEW,
          status: "remembered",
        }),
        makeRecord({
          ir_id: "orphan",
          content_sha256: HASH_B,
          storage_scope_id: `${BUNDLE_B}::${HASH_B}`,
          bundle_id: BUNDLE_B,
        }),
      ];
      const verified = verifyPackage(backupRows);
      const result = await restoreLearningBackupReplaceAll(db, verified);
      expect(result).toEqual({
        ok: true,
        policy: "replace_all",
        previous_count: 2,
        restored_count: 2,
      });
      const rows = await listLearningSorted(db);
      expect(rows).toHaveLength(2);
      expect(areLearningRecordsEqual(rows[0]!, backupRows[0]!)).toBe(true);
      expect(areLearningRecordsEqual(rows[1]!, backupRows[1]!)).toBe(true);

      const again = await restoreLearningBackupReplaceAll(db, verified);
      expect(again).toEqual({
        ok: true,
        policy: "replace_all",
        previous_count: 2,
        restored_count: 2,
      });
    });
  });

  it("recovers from invalid local rows", async () => {
    await withDb(async (db) => {
      await putRawLearning(db, {
        ...makeRecord({ ir_id: "corrupt" }),
        schema_version: "learning_record_v0",
      });
      const verified = verifyPackage([makeRecord({ ir_id: "ok" })]);
      const result = await restoreLearningBackupReplaceAll(db, verified);
      expect(result.ok).toBe(true);
      const rows = await listAllLearningRecords(db);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.ir_id).toBe("ok");
    });
  });

  it("rolls back after clear when hook fails", async () => {
    await withDb(async (db) => {
      await putRawLearning(db, makeRecord({ ir_id: "keep" }));
      const before = JSON.stringify(await listLearningSorted(db));
      const verified = verifyPackage([makeRecord({ ir_id: "new" })]);
      const result = await restoreLearningBackupReplaceAll(db, verified, {
        afterClearQueued: () => {
          throw new Error("forced");
        },
      });
      expect(result).toEqual({ ok: false, code: "transaction_failed" });
      expect(JSON.stringify(await listLearningSorted(db))).toBe(before);
    });
  });
});

describe("stale preview", () => {
  it("Add missing commit reflects local identity that appeared after preview", async () => {
    await withDb(async (db) => {
      const record = makeRecord({ ir_id: "race" });
      const verified = verifyPackage([record]);
      const preview = await analyzeLearningBackupRestore(db, verified);
      expect(preview.ok && preview.preview.add_missing).toEqual({
        state: "available",
        add_count: 1,
        skipped_existing_count: 0,
      });

      await putRawLearning(
        db,
        makeRecord({
          ir_id: "race",
          review_count: 5,
          last_reviewed: TS_REVIEW,
          status: "remembered",
        }),
      );

      const commit = await restoreLearningBackupAddMissing(db, verified);
      expect(commit).toEqual({
        ok: true,
        policy: "add_missing",
        added_count: 0,
        skipped_existing_count: 1,
        unchanged_count: 1,
      });
      const rows = await listAllLearningRecords(db);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.review_count).toBe(5);
    });
  });

  it("Replace all commit uses actual previous count after local change", async () => {
    await withDb(async (db) => {
      await putRawLearning(db, makeRecord({ ir_id: "one" }));
      const verified = verifyPackage([makeRecord({ ir_id: "restored" })]);
      const preview = await analyzeLearningBackupRestore(db, verified);
      expect(preview.ok && preview.preview.replace_all.previous_count).toBe(1);

      await putRawLearning(db, makeRecord({ ir_id: "two" }));
      const commit = await restoreLearningBackupReplaceAll(db, verified);
      expect(commit).toEqual({
        ok: true,
        policy: "replace_all",
        previous_count: 2,
        restored_count: 1,
      });
      expect((await listAllLearningRecords(db)).map((r) => r.ir_id)).toEqual(["restored"]);
    });
  });
});

describe("isolation and adapter", () => {
  it("touches only learning_records and does not close caller-owned DB", async () => {
    await withDb(async (db) => {
      await setActiveBundleMeta(db, makeActiveMeta());
      await putInstalledBundleMeta(db, makeActiveMeta());
      await appendQueryLog(db, {
        query_raw: "q",
        query_normalized_keys: {
          casefold: ["q"],
          diacritics_insensitive: ["q"],
          punct_stripped: ["q"],
          nospace: ["q"],
        },
        direction: "source_to_target",
        ladder_level_hit: "none",
        ir_ids_count: 0,
        bundle_id: BUNDLE_A,
        storage_scope_id: `${BUNDLE_A}::${HASH_A}`,
        app_version: "t",
        norm_version: "norm_v3",
        timestamp_iso: "2026-07-30T00:00:00.000Z",
        logging_enabled: true,
      });
      await saveLearningRecord(db, makeSaveInput({ ir_id: "seed" }));

      const before = await snapshotStores(db);
      const activeBefore = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(STORE_META, "readonly");
        const req = tx.objectStore(STORE_META).get("active_bundle_id");
        req.addEventListener("success", () => resolve(req.result));
        req.addEventListener("error", () => reject(req.error));
      });

      const verified = verifyPackage([makeRecord({ ir_id: "added" }), makeRecord({ ir_id: "seed" })]);
      const close = vi.spyOn(db, "close");
      const result = await commitLearningBackupRestore({
        openDb: async () => db,
        verified,
        policy: "add_missing",
      });
      expect(result.ok).toBe(true);
      expect(close).not.toHaveBeenCalled();
      close.mockRestore();

      const after = await snapshotStores(db);
      expect(after.records).toBe(before.records);
      expect(after.search).toBe(before.search);
      expect(after.bundles).toBe(before.bundles);
      expect(after.queryLogs).toBe(before.queryLogs);
      expect(after.learning).toBe(before.learning + 1);

      const activeAfter = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(STORE_META, "readonly");
        const req = tx.objectStore(STORE_META).get("active_bundle_id");
        req.addEventListener("success", () => resolve(req.result));
        req.addEventListener("error", () => reject(req.error));
      });
      expect(activeAfter).toEqual(activeBefore);
    });
  });
});

describe("equality helper", () => {
  it("compares supported fields including optional display cache", () => {
    const a = makeRecord({ display_cache: { headword_latin: "a", gloss_short: "g" } });
    const b = makeRecord({ display_cache: { headword_latin: "a", gloss_short: "g" } });
    const c = makeRecord({ display_cache: { headword_latin: "a" } });
    expect(areLearningRecordsEqual(a, b)).toBe(true);
    expect(areLearningRecordsEqual(a, c)).toBe(false);
  });
});
