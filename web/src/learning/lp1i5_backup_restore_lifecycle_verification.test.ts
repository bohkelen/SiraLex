/**
 * LP1I5 — Backup/restore lifecycle integration verification.
 */

// @vitest-environment jsdom

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  META_ACTIVE_BUNDLE_ID_KEY,
  STORE_BUNDLES_REGISTRY,
  STORE_LEARNING_RECORDS,
  STORE_META,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
  deleteSiralexDb,
  metaGet,
  openSiralexDb,
  putInstalledBundleMeta,
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { appendQueryLog } from "../query_logging/query_log_store";
import {
  LearningBackupBuildError,
  buildLearningBackupPackage,
  parseLearningBackupJson,
  serializeLearningBackupPackage,
  type VerifiedLearningBackupPackage,
} from "./learning_backup_package";
import {
  buildLearningBackupExportArtifact,
  createLearningBackupExport,
} from "./learning_backup_export";
import { decodeLearningBackupUtf8, readLearningBackupFile } from "./learning_backup_file";
import {
  analyzeLearningBackupRestore,
  restoreLearningBackupAddMissing,
  restoreLearningBackupReplaceAll,
} from "./learning_backup_restore";
import { createLearningBackupSurface } from "./learning_backup_surface";
import {
  countAllLearningRecords,
  listAllLearningRecords,
  saveLearningRecord,
} from "./learning_record_store";
import {
  LEARNING_RECORD_SCHEMA_VERSION,
  type LearningRecordV1,
  type SaveLearningRecordInput,
} from "./learning_record_types";

const HASH_A = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HASH_C = "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const BUNDLE_A = "bundle_a";
const BUNDLE_B = "bundle_b";
const TS = "2026-07-01T10:00:00.000Z";
const REVIEWED_TS = "2026-07-02T12:00:00.000Z";
const EXPORTED_AT = "2026-07-30T22:30:00.000Z";

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

function verified(records: LearningRecordV1[]): VerifiedLearningBackupPackage {
  const pkg = buildLearningBackupPackage(records, { exportedAt: EXPORTED_AT, appVersion: "test" });
  const parsed = parseLearningBackupJson(serializeLearningBackupPackage(pkg));
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error("Expected a verified backup package.");
  return parsed.verified;
}

function backupFile(records: LearningRecordV1[], name = "backup.json"): File {
  return new File([serializeLearningBackupPackage(buildLearningBackupPackage(records, { exportedAt: EXPORTED_AT }))], name, {
    type: "application/json",
  });
}

async function withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openSiralexDb();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

async function putRaw(db: IDBDatabase, value: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_LEARNING_RECORDS, "readwrite");
    tx.objectStore(STORE_LEARNING_RECORDS).put(value);
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function clearLearning(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_LEARNING_RECORDS, "readwrite");
    tx.objectStore(STORE_LEARNING_RECORDS).clear();
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function countStore(db: IDBDatabase, store: string): Promise<number> {
  const tx = db.transaction(store, "readonly");
  return await new Promise<number>((resolve, reject) => {
    const request = tx.objectStore(store).count();
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function snapshots(db: IDBDatabase) {
  return {
    learning: await countStore(db, STORE_LEARNING_RECORDS),
    records: await countStore(db, STORE_RECORDS),
    search: await countStore(db, STORE_SEARCH_INDEX),
    bundles: await countStore(db, STORE_BUNDLES_REGISTRY),
    queryLogs: await countStore(db, STORE_QUERY_LOGS),
  };
}

async function sortedLearning(db: IDBDatabase): Promise<LearningRecordV1[]> {
  return (await listAllLearningRecords(db)).sort((a, b) =>
    `${a.bundle_id}\0${a.ir_id}`.localeCompare(`${b.bundle_id}\0${b.ir_id}`),
  );
}

async function appendRequiredQueryLog(db: IDBDatabase): Promise<void> {
  await appendQueryLog(db, {
    query_raw: "kùn",
    query_normalized_keys: {
      casefold: ["kùn"],
      diacritics_insensitive: ["kun"],
      punct_stripped: ["kùn"],
      nospace: ["kùn"],
    },
    direction: "source_to_target",
    ladder_level_hit: "none",
    ir_ids_count: 0,
    bundle_id: BUNDLE_A,
    storage_scope_id: `${BUNDLE_A}::${HASH_A}`,
    app_version: "test",
    norm_version: "norm_v3",
    timestamp_iso: TS,
    logging_enabled: true,
  });
}

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // The database may not exist yet.
  }
});

describe("deterministic export, parse, and restore round trip", () => {
  it("preserves every supported field across multiple bundles and hashes", async () => {
    await withDb(async (db) => {
      const records = [
        makeRecord({ ir_id: "never", status: "still_learning", last_reviewed: null, review_count: 0 }),
        makeRecord({
          ir_id: "remembered",
          status: "remembered",
          review_count: 3,
          last_reviewed: REVIEWED_TS,
          display_cache: { headword_latin: "dàa", headword_nko: "ߘߊ߫", gloss_short: "ouverture" },
        }),
        makeRecord({
          bundle_id: BUNDLE_B,
          ir_id: "unresolved",
          content_sha256: HASH_B,
          storage_scope_id: `${BUNDLE_B}::${HASH_B}`,
          status: "still_learning",
          display_cache: { headword_latin: "ߊlfa", headword_nko: "ߊ" },
        }),
        makeRecord({
          bundle_id: BUNDLE_B,
          ir_id: "second-hash",
          content_sha256: HASH_C,
          storage_scope_id: `${BUNDLE_B}::${HASH_C}`,
        }),
      ];
      for (const record of records) await putRaw(db, record);

      const first = await createLearningBackupExport({ openDb: async () => db, now: () => EXPORTED_AT });
      const second = buildLearningBackupExportArtifact([...records].reverse(), { exportedAt: EXPORTED_AT });
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(first.artifact.text).toBe(second.artifact.text);

      const parsed = parseLearningBackupJson(first.artifact.text, { byteLength: first.artifact.byteLength });
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      await clearLearning(db);
      expect((await restoreLearningBackupReplaceAll(db, parsed.verified)).ok).toBe(true);
      expect(await sortedLearning(db)).toEqual([...records].sort((a, b) =>
        `${a.bundle_id}\0${a.ir_id}`.localeCompare(`${b.bundle_id}\0${b.ir_id}`),
      ));
    });
  });
});

describe("restore policies", () => {
  it("add missing retains conflicting and local-only records, then becomes idempotent", async () => {
    await withDb(async (db) => {
      const conflict = makeRecord({ ir_id: "conflict", status: "remembered", review_count: 5, last_reviewed: REVIEWED_TS });
      await putRaw(db, conflict);
      await putRaw(db, makeRecord({ ir_id: "local-only" }));
      const pkg = verified([
        makeRecord({ ir_id: "conflict", status: "still_learning" }),
        makeRecord({ ir_id: "missing" }),
      ]);

      expect(await restoreLearningBackupAddMissing(db, pkg)).toMatchObject({
        ok: true, added_count: 1, skipped_existing_count: 1,
      });
      expect((await sortedLearning(db)).find((row) => row.ir_id === "conflict")).toEqual(conflict);
      expect((await sortedLearning(db)).map((row) => row.ir_id)).toEqual(["conflict", "local-only", "missing"]);
      expect(await restoreLearningBackupAddMissing(db, pkg)).toMatchObject({
        ok: true, added_count: 0, skipped_existing_count: 2,
      });
    });
  });

  it("replace all leaves exactly the backup set and removes local-only data", async () => {
    await withDb(async (db) => {
      await putRaw(db, makeRecord({ ir_id: "local-only" }));
      const rows = [makeRecord({ ir_id: "backup-a" }), makeRecord({ ir_id: "backup-b", content_sha256: HASH_B, storage_scope_id: `${BUNDLE_A}::${HASH_B}` })];
      const result = await restoreLearningBackupReplaceAll(db, verified(rows));
      expect(result).toMatchObject({ ok: true, previous_count: 1, restored_count: 2 });
      expect(await sortedLearning(db)).toEqual(rows);
    });
  });

  it("marks corrupt local data invalid, disables add, and permits replace recovery", async () => {
    await withDb(async (db) => {
      await putRaw(db, { ...makeRecord({ ir_id: "corrupt" }), schema_version: "learning_record_v0" });
      const pkg = verified([makeRecord({ ir_id: "recovered" })]);
      const preview = await analyzeLearningBackupRestore(db, pkg);
      expect(preview.ok && preview.preview.local_validation).toEqual({ state: "invalid", invalid_record_count: 1 });
      expect(preview.ok && preview.preview.add_missing).toEqual({ state: "unavailable", reason: "invalid_local_records" });
      expect(await restoreLearningBackupAddMissing(db, pkg)).toMatchObject({ ok: false, code: "invalid_local_record" });
      expect(await restoreLearningBackupReplaceAll(db, pkg)).toMatchObject({ ok: true, restored_count: 1 });
      expect((await listAllLearningRecords(db))[0]?.ir_id).toBe("recovered");
    });
  });
});

describe("invalid inputs and transaction integrity", () => {
  it("does not mutate when export finds corrupt rows or restore receives an unverified package", async () => {
    await withDb(async (db) => {
      const corrupt = { ...makeRecord({ ir_id: "corrupt" }), schema_version: "learning_record_v0" };
      await putRaw(db, corrupt);
      const before = await snapshots(db);
      expect(await createLearningBackupExport({ openDb: async () => db, now: () => EXPORTED_AT })).toMatchObject({
        ok: false, code: "invalid_local_record",
      });
      expect(await restoreLearningBackupReplaceAll(db, { package: verified([makeRecord()]).package })).toEqual({
        ok: false, code: "unverified_package",
      });
      expect(await snapshots(db)).toEqual(before);
    });
  });

  it("rolls back both add and replace transactions when injected hooks fail", async () => {
    await withDb(async (db) => {
      await putRaw(db, makeRecord({ ir_id: "keep" }));
      const before = await sortedLearning(db);
      expect(await restoreLearningBackupAddMissing(db, verified([makeRecord({ ir_id: "add" })]), {
        afterAddsQueued: () => { throw new Error("abort add"); },
      })).toEqual({ ok: false, code: "transaction_failed" });
      expect(await sortedLearning(db)).toEqual(before);

      expect(await restoreLearningBackupReplaceAll(db, verified([makeRecord({ ir_id: "replace" })]), {
        afterClearQueued: () => { throw new Error("abort clear"); },
      })).toEqual({ ok: false, code: "transaction_failed" });
      expect(await sortedLearning(db)).toEqual(before);
    });
  });

  it("surfaces typed builder errors for malformed package construction", () => {
    expect(() => buildLearningBackupPackage([], { exportedAt: EXPORTED_AT })).toThrow(LearningBackupBuildError);
  });
});

describe("bundle compatibility and store isolation", () => {
  it("reports hash mismatch and missing dictionaries without blocking restore or changing active bundle", async () => {
    await withDb(async (db) => {
      await setActiveBundleMeta(db, makeActiveMeta());
      await putInstalledBundleMeta(db, makeActiveMeta({
        bundle_id: BUNDLE_B,
        expected_content_sha256: HASH_C,
        storage_scope_id: `${BUNDLE_B}::${HASH_C}`,
      }));
      const activeBefore = await metaGet<string>(db, META_ACTIVE_BUNDLE_ID_KEY);
      const pkg = verified([
        makeRecord({ bundle_id: BUNDLE_B, ir_id: "mismatch", content_sha256: HASH_B, storage_scope_id: `${BUNDLE_B}::${HASH_B}` }),
        makeRecord({ bundle_id: "not-installed", ir_id: "missing", content_sha256: HASH_C, storage_scope_id: `not-installed::${HASH_C}` }),
      ]);
      const preview = await analyzeLearningBackupRestore(db, pkg);
      expect(preview.ok && preview.preview.bundle_compatibility).toEqual([
        { bundle_id: BUNDLE_B, record_count: 1, state: "installed_hash_mismatch" },
        { bundle_id: "not-installed", record_count: 1, state: "not_installed" },
      ]);
      expect((await restoreLearningBackupReplaceAll(db, pkg)).ok).toBe(true);
      expect(await metaGet<string>(db, META_ACTIVE_BUNDLE_ID_KEY)).toBe(activeBefore);
    });
  });

  it("isolates export and restore from records, search, bundles, meta, and query logs", async () => {
    await withDb(async (db) => {
      await setActiveBundleMeta(db, makeActiveMeta());
      await appendRequiredQueryLog(db);
      await saveLearningRecord(db, makeSaveInput({ ir_id: "seed" }));
      const beforeExport = await snapshots(db);
      const activeBefore = await metaGet<string>(db, META_ACTIVE_BUNDLE_ID_KEY);
      const exported = await createLearningBackupExport({ openDb: async () => db, now: () => EXPORTED_AT });
      expect(exported.ok).toBe(true);
      expect(await snapshots(db)).toEqual(beforeExport);

      const beforeRestore = await snapshots(db);
      expect((await restoreLearningBackupAddMissing(db, verified([makeRecord({ ir_id: "added" })]))).ok).toBe(true);
      const afterRestore = await snapshots(db);
      expect(afterRestore).toEqual({ ...beforeRestore, learning: beforeRestore.learning + 1 });
      expect(afterRestore.queryLogs).toBe(beforeRestore.queryLogs);
      expect(await metaGet<string>(db, META_ACTIVE_BUNDLE_ID_KEY)).toBe(activeBefore);
    });
  });
});

describe("lifecycle transitions", () => {
  it("restores records after explicit learning-store deletion", async () => {
    await withDb(async (db) => {
      const rows = [makeRecord({ ir_id: "one" }), makeRecord({ ir_id: "two" })];
      const pkg = verified(rows);
      for (const row of rows) await putRaw(db, row);
      await clearLearning(db);
      expect(await countAllLearningRecords(db)).toBe(0);
      expect((await restoreLearningBackupReplaceAll(db, pkg)).ok).toBe(true);
      expect(await sortedLearning(db)).toEqual(rows);
    });
  });

  it("invalidates an existing preview when bundles change", async () => {
    await withDb(async (db) => {
      const surface = createLearningBackupSurface(
        { openDb: async () => db, now: () => EXPORTED_AT },
        { onModel: () => undefined },
      );
      await surface.selectRestoreFile(backupFile([makeRecord()]));
      expect(surface.getVm().restore.phase).toBe("preview");
      surface.invalidatePreviewForBundleChange();
      expect(surface.getVm().restore).toEqual({ phase: "idle" });
      surface.dispose();
    });
  });

  it("keeps a committed replace durable after its surface is disposed", async () => {
    await withDb(async (db) => {
      await putRaw(db, makeRecord({ ir_id: "old" }));
      let releaseCommit!: () => void;
      const delayed = new Promise<void>((resolve) => { releaseCommit = resolve; });
      const commitRestore = vi.fn(async ({ verified: packageRef }: { verified: VerifiedLearningBackupPackage }) => {
        await delayed;
        return restoreLearningBackupReplaceAll(db, packageRef);
      });
      const surface = createLearningBackupSurface(
        {
          openDb: async () => db,
          now: () => EXPORTED_AT,
          commitRestore: commitRestore as never,
        },
        { onModel: () => undefined },
      );
      await surface.selectRestoreFile(backupFile([makeRecord({ ir_id: "restored" })]));
      surface.selectPolicy("replace_all");
      surface.requestCommit();
      surface.confirmReplaceAll();
      surface.dispose();
      releaseCommit();
      await vi.waitFor(async () => expect((await listAllLearningRecords(db))[0]?.ir_id).toBe("restored"));
      expect(commitRestore).toHaveBeenCalledTimes(1);
    });
  });

  it("coalesces duplicate export starts and duplicate add-missing confirmation", async () => {
    await withDb(async (db) => {
      await saveLearningRecord(db, makeSaveInput());
      let releaseExport!: (result: Awaited<ReturnType<typeof createLearningBackupExport>>) => void;
      const pendingExport = new Promise<Awaited<ReturnType<typeof createLearningBackupExport>>>((resolve) => {
        releaseExport = resolve;
      });
      const createExport = vi.fn(() => pendingExport);
      const download = vi.fn();
      const surface = createLearningBackupSurface(
        { openDb: async () => db, now: () => EXPORTED_AT, createExport: createExport as never, downloadArtifact: download },
        { onModel: () => undefined },
      );
      await vi.waitFor(() => expect(surface.getVm().recordCount).toBe(1));
      const first = surface.startExport();
      const second = surface.startExport();
      expect(createExport).toHaveBeenCalledTimes(1);
      releaseExport(await createLearningBackupExport({ openDb: async () => db, now: () => EXPORTED_AT }));
      await Promise.all([first, second]);
      expect(download).toHaveBeenCalledTimes(1);

      await surface.selectRestoreFile(backupFile([makeRecord({ ir_id: "add-once" })]));
      surface.requestCommit();
      surface.requestCommit();
      await vi.waitFor(() => expect(surface.getVm().restore.phase).toBe("success"));
      expect(await countAllLearningRecords(db)).toBe(2);
      surface.dispose();
    });
  });
});

describe("file adapter verification", () => {
  it("rejects invalid UTF-8, oversized files, and unsupported schemas without verified packages", async () => {
    const invalidUtf8 = new File([new Uint8Array([0xc3, 0x28])], "invalid.json");
    expect(() => decodeLearningBackupUtf8(new Uint8Array([0xc3, 0x28]).buffer)).toThrow(TypeError);
    expect(await readLearningBackupFile(invalidUtf8)).toEqual({ ok: false, code: "invalid_utf8" });

    const oversized = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "large.json");
    expect(await readLearningBackupFile(oversized)).toEqual({ ok: false, code: "file_too_large" });

    const unsupported = new File([
      JSON.stringify({ package_schema: "siralex_learning_backup_v0", exported_at: EXPORTED_AT, record_count: 0, bundle_summaries: [], records: [] }),
    ], "old.json");
    const result = await readLearningBackupFile(unsupported);
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.validationErrors?.map((error) => error.code)).toContain("unsupported_package_schema");
  });
});
