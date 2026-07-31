/**
 * LP1I2 — Deterministic Learning backup export tests.
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
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { appendQueryLog } from "../query_logging/query_log_store";
import {
  LEARNING_BACKUP_MAX_BYTES,
  LEARNING_BACKUP_PACKAGE_SCHEMA,
  LearningBackupBuildError,
  buildLearningBackupPackage,
  getUtf8ByteLength,
  parseLearningBackupJson,
  serializeLearningBackupPackage,
} from "./learning_backup_package";
import {
  buildLearningBackupExportArtifact,
  createLearningBackupExport,
  readAllLearningRecordsForBackup,
} from "./learning_backup_export";
import { listAllLearningRecords, saveLearningRecord } from "./learning_record_store";
import {
  LEARNING_RECORD_SCHEMA_VERSION,
  type LearningRecordV1,
  type SaveLearningRecordInput,
} from "./learning_record_types";

const HASH_A = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TS = "2026-07-01T10:00:00.000Z";
const TS_REVIEW = "2026-07-02T12:00:00.000Z";
const EXPORTED_AT = "2026-07-30T22:30:00.123Z";
const EXPORTED_AT_CANON = "2026-07-30T22:30:00.000Z";
const BUNDLE_A = "bundle_a";
const BUNDLE_B = "bundle_b";
const SCOPE_A = `${BUNDLE_A}::${HASH_A}`;

function makeRecord(overrides: Partial<LearningRecordV1> = {}): LearningRecordV1 {
  return {
    schema_version: LEARNING_RECORD_SCHEMA_VERSION,
    bundle_id: BUNDLE_A,
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH_A,
    storage_scope_id: SCOPE_A,
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
    storage_scope_id: SCOPE_A,
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
    storage_scope_id: SCOPE_A,
    display_cache: { headword_latin: "kùn" },
    ...overrides,
  };
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

async function listLearningRaw(db: IDBDatabase): Promise<unknown[]> {
  const tx = db.transaction(STORE_LEARNING_RECORDS, "readonly");
  return await new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_LEARNING_RECORDS).getAll();
    req.addEventListener("success", () => resolve(req.result as unknown[]));
    req.addEventListener("error", () => reject(req.error));
  });
}

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // fine if missing or blocked briefly in fake-indexeddb
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

describe("LearningBackupBuildError (LP1I1 typed builder)", () => {
  it("throws typed codes for empty, duplicate, and invalid exportedAt", () => {
    try {
      buildLearningBackupPackage([], { exportedAt: EXPORTED_AT_CANON });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(LearningBackupBuildError);
      expect((err as LearningBackupBuildError).code).toBe("empty_records");
    }

    try {
      buildLearningBackupPackage([makeRecord(), makeRecord()], { exportedAt: EXPORTED_AT_CANON });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(LearningBackupBuildError);
      expect((err as LearningBackupBuildError).code).toBe("duplicate_identity");
    }

    try {
      buildLearningBackupPackage([makeRecord()], { exportedAt: "not-a-timestamp" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(LearningBackupBuildError);
      expect((err as LearningBackupBuildError).code).toBe("invalid_exported_at");
    }
  });
});

describe("pure artifact generation", () => {
  it("exports one and many records across bundles with reviewed/never-reviewed and unresolved", () => {
    const never = makeRecord({ ir_id: "n1" });
    const reviewed = makeRecord({
      ir_id: "r1",
      status: "remembered",
      review_count: 2,
      last_reviewed: TS_REVIEW,
    });
    const unresolved = makeRecord({
      bundle_id: BUNDLE_B,
      ir_id: "orphan",
      content_sha256: HASH_B,
      storage_scope_id: `${BUNDLE_B}::${HASH_B}`,
      display_cache: { headword_latin: "orphan-head" },
    });

    const result = buildLearningBackupExportArtifact([reviewed, never, unresolved], {
      exportedAt: EXPORTED_AT_CANON,
      appVersion: "1.0.0",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.artifact.recordCount).toBe(3);
    expect(result.artifact.bundleCount).toBe(2);
    expect(result.artifact.mediaType).toBe("application/json");
    expect(result.artifact.exportedAt).toBe(EXPORTED_AT_CANON);
    expect(result.artifact.filename).toBe("siralex-learning-backup-2026-07-30T22-30-00Z.json");
    expect(result.artifact.text.endsWith("\n")).toBe(true);
    expect(result.artifact.byteLength).toBe(getUtf8ByteLength(result.artifact.text));
    expect(parseLearningBackupJson(result.artifact.text, { byteLength: result.artifact.byteLength }).ok).toBe(
      true,
    );
    expect(result.artifact.filename).not.toContain("kùn");
    expect(result.artifact.filename).not.toContain(BUNDLE_A);
  });

  it("input order does not affect artifact text; identical inputs are deterministic", () => {
    const a = makeRecord({ ir_id: "a", bundle_id: "b2" });
    const b = makeRecord({ ir_id: "b", bundle_id: "b1" });
    const opts = { exportedAt: EXPORTED_AT_CANON, appVersion: "t" as const };

    const forward = buildLearningBackupExportArtifact([a, b], opts);
    const reverse = buildLearningBackupExportArtifact([b, a], opts);
    expect(forward.ok && reverse.ok).toBe(true);
    if (!forward.ok || !reverse.ok) return;
    expect(forward.artifact.text).toBe(reverse.artifact.text);
    expect(forward.artifact.byteLength).toBe(reverse.artifact.byteLength);

    const again = buildLearningBackupExportArtifact([a, b], opts);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.artifact.text).toBe(forward.artifact.text);
  });

  it("does not mutate input records", () => {
    const record = makeRecord({ ir_id: "immutable" });
    const snapshot = structuredClone(record);
    const result = buildLearningBackupExportArtifact([record], { exportedAt: EXPORTED_AT_CANON });
    expect(result.ok).toBe(true);
    expect(record).toEqual(snapshot);
  });

  it("counts UTF-8 bytes for non-ASCII display cache", () => {
    const record = makeRecord({
      display_cache: { headword_latin: "dàa", headword_nko: "ߘߊ߫", gloss_short: "ouverture" },
    });
    const result = buildLearningBackupExportArtifact([record], { exportedAt: EXPORTED_AT_CANON });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.byteLength).toBe(new TextEncoder().encode(result.artifact.text).byteLength);
    expect(result.artifact.byteLength).toBeGreaterThan(result.artifact.text.length);
  });
});

describe("timestamp handling", () => {
  it("calls now() exactly once and uses the same timestamp everywhere", async () => {
    await withDb(async (db) => {
      await saveLearningRecord(db, makeSaveInput());
      const now = vi.fn(() => EXPORTED_AT);
      const result = await createLearningBackupExport({
        openDb: async () => db,
        now,
        appVersion: "1.2.3",
      });
      expect(now).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.artifact.exportedAt).toBe(EXPORTED_AT);
      expect(result.artifact.filename).toBe("siralex-learning-backup-2026-07-30T22-30-00Z.json");
      const parsed = parseLearningBackupJson(result.artifact.text);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.package.exported_at).toBe(EXPORTED_AT);
    });
  });

  it("rejects invalid injected timestamp without opening a builder package", () => {
    const result = buildLearningBackupExportArtifact([makeRecord()], {
      exportedAt: "tomorrow",
    });
    expect(result).toEqual({ ok: false, code: "generated_package_invalid" });
  });

  it("pure builder source does not call Date.now or new Date", () => {
    const source = buildLearningBackupExportArtifact.toString();
    expect(source.includes("Date.now")).toBe(false);
    expect(source.includes("new Date")).toBe(false);
  });
});

describe("self-validation and size", () => {
  it("rejects corrupted serialization", () => {
    const result = buildLearningBackupExportArtifact([makeRecord()], {
      exportedAt: EXPORTED_AT_CANON,
      serialize: () => "{ not-json",
    });
    expect(result).toEqual({ ok: false, code: "generated_package_invalid" });
  });

  it("rejects forced record-count mismatch from parser", () => {
    const result = buildLearningBackupExportArtifact([makeRecord()], {
      exportedAt: EXPORTED_AT_CANON,
      parse: (text, options) => {
        const parsed = parseLearningBackupJson(text, options);
        if (!parsed.ok) return parsed;
        return {
          ok: true,
          package: { ...parsed.package, record_count: parsed.package.record_count + 1 },
        };
      },
    });
    expect(result).toEqual({ ok: false, code: "generated_package_invalid" });
  });

  it("accepts output at exact maxBytes seam and rejects above", () => {
    const record = makeRecord();
    const baseline = buildLearningBackupExportArtifact([record], { exportedAt: EXPORTED_AT_CANON });
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    const atLimit = buildLearningBackupExportArtifact([record], {
      exportedAt: EXPORTED_AT_CANON,
      maxBytes: baseline.artifact.byteLength,
    });
    expect(atLimit.ok).toBe(true);

    const over = buildLearningBackupExportArtifact([record], {
      exportedAt: EXPORTED_AT_CANON,
      maxBytes: baseline.artifact.byteLength - 1,
    });
    expect(over).toEqual({ ok: false, code: "generated_package_too_large" });
  });

  it("passes actual byte length into the self-validator", () => {
    const parse = vi.fn(parseLearningBackupJson);
    const result = buildLearningBackupExportArtifact([makeRecord()], {
      exportedAt: EXPORTED_AT_CANON,
      parse,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(parse).toHaveBeenCalledWith(result.artifact.text, {
      byteLength: result.artifact.byteLength,
    });
  });

  it("production max remains 25 MiB", () => {
    expect(LEARNING_BACKUP_MAX_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe("invalid local state", () => {
  it("blocks structurally invalid and review-inconsistent rows without emitting artifacts", () => {
    const invalid = { ...makeRecord({ ir_id: "bad" }), schema_version: "learning_record_v0" };
    const inconsistent = makeRecord({
      ir_id: "inc",
      review_count: 0,
      last_reviewed: TS_REVIEW,
    });
    const good = makeRecord({ ir_id: "good" });

    const structural = buildLearningBackupExportArtifact([good, invalid], {
      exportedAt: EXPORTED_AT_CANON,
    });
    expect(structural.ok).toBe(false);
    if (structural.ok) return;
    expect(structural.code).toBe("invalid_local_record");
    expect(structural.invalidRecordCount).toBe(1);
    expect(JSON.stringify(structural)).not.toContain("kùn");

    const review = buildLearningBackupExportArtifact([good, inconsistent], {
      exportedAt: EXPORTED_AT_CANON,
    });
    expect(review.ok).toBe(false);
    if (review.ok) return;
    expect(review.code).toBe("invalid_local_record");
  });

  it("blocks duplicate identities even when otherwise valid", () => {
    const a = makeRecord({ ir_id: "dup", content_sha256: HASH_A });
    const b = makeRecord({ ir_id: "dup", content_sha256: HASH_B });
    const result = buildLearningBackupExportArtifact([a, b], { exportedAt: EXPORTED_AT_CANON });
    expect(result).toEqual({ ok: false, code: "duplicate_learning_identity" });
  });

  it("rejects empty input without constructing a package", () => {
    expect(buildLearningBackupExportArtifact([], { exportedAt: EXPORTED_AT_CANON })).toEqual({
      ok: false,
      code: "no_learning_records",
    });
  });
});

describe("database adapter", () => {
  it("reads all bundles, ignores active bundle, exports inactive-bundle records", async () => {
    await withDb(async (db) => {
      await setActiveBundleMeta(db, makeActiveMeta({ bundle_id: BUNDLE_A }));
      await saveLearningRecord(db, makeSaveInput({ ir_id: "active-only" }));
      await putRawLearning(
        db,
        makeRecord({
          bundle_id: BUNDLE_B,
          ir_id: "inactive",
          content_sha256: HASH_B,
          storage_scope_id: `${BUNDLE_B}::${HASH_B}`,
        }),
      );

      const rows = await readAllLearningRecordsForBackup(db);
      expect(rows).toHaveLength(2);

      const listed = await listAllLearningRecords(db);
      expect(listed).toHaveLength(2);

      const result = await createLearningBackupExport({
        openDb: async () => db,
        now: () => EXPORTED_AT_CANON,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.artifact.recordCount).toBe(2);
      expect(result.artifact.bundleCount).toBe(2);
      const parsed = parseLearningBackupJson(result.artifact.text);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.package.records.map((r) => r.ir_id).sort()).toEqual(["active-only", "inactive"]);
    });
  });

  it("returns no_learning_records for empty store", async () => {
    await withDb(async (db) => {
      const result = await createLearningBackupExport({
        openDb: async () => db,
        now: () => EXPORTED_AT_CANON,
      });
      expect(result).toEqual({ ok: false, code: "no_learning_records" });
    });
  });

  it("does not close caller-owned database", async () => {
    await withDb(async (db) => {
      await saveLearningRecord(db, makeSaveInput());
      const close = vi.spyOn(db, "close");
      const result = await createLearningBackupExport({
        openDb: async () => db,
        now: () => EXPORTED_AT_CANON,
      });
      expect(result.ok).toBe(true);
      expect(close).not.toHaveBeenCalled();
      expect(await listAllLearningRecords(db)).toHaveLength(1);
      close.mockRestore();
    });
  });

  it("maps open and read failures", async () => {
    const unavailable = await createLearningBackupExport({
      openDb: async () => {
        throw new Error("open failed");
      },
      now: () => EXPORTED_AT_CANON,
    });
    expect(unavailable).toEqual({ ok: false, code: "database_unavailable" });

    await withDb(async (db) => {
      const readFailed = await createLearningBackupExport({
        openDb: async () => db,
        now: () => EXPORTED_AT_CANON,
        readAll: async () => {
          throw new Error("read failed");
        },
      });
      expect(readFailed).toEqual({ ok: false, code: "database_read_failed" });
    });
  });

  it("blocks export when IndexedDB contains invalid Learning rows", async () => {
    await withDb(async (db) => {
      await putRawLearning(db, {
        ...makeRecord({ ir_id: "corrupt" }),
        schema_version: "learning_record_v0",
      });
      const result = await createLearningBackupExport({
        openDb: async () => db,
        now: () => EXPORTED_AT_CANON,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("invalid_local_record");
      expect(JSON.stringify(result)).not.toContain("kùn");
    });
  });
});

describe("isolation and snapshot", () => {
  it("does not mutate stores, query logs, or active bundle; no second learning read by default", async () => {
    await withDb(async (db) => {
      await setActiveBundleMeta(db, makeActiveMeta());
      await saveLearningRecord(db, makeSaveInput({ ir_id: "keep" }));
      await appendQueryLog(db, {
        query_raw: "test",
        query_normalized_keys: {
          casefold: ["test"],
          diacritics_insensitive: ["test"],
          punct_stripped: ["test"],
          nospace: ["test"],
        },
        direction: "source_to_target",
        ladder_level_hit: "none",
        ir_ids_count: 0,
        bundle_id: BUNDLE_A,
        storage_scope_id: SCOPE_A,
        app_version: "t",
        norm_version: "norm_v3",
        timestamp_iso: "2026-07-30T00:00:00.000Z",
        logging_enabled: true,
      });

      const before = await snapshotStores(db);
      const learningBefore = JSON.stringify(await listLearningRaw(db));
      const activeBefore = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(STORE_META, "readonly");
        const req = tx.objectStore(STORE_META).get("active_bundle");
        req.addEventListener("success", () => resolve(req.result));
        req.addEventListener("error", () => reject(req.error));
      });

      const readAll = vi.fn(readAllLearningRecordsForBackup);
      const result = await createLearningBackupExport({
        openDb: async () => db,
        now: () => EXPORTED_AT_CANON,
        readAll,
      });
      expect(result.ok).toBe(true);
      expect(readAll).toHaveBeenCalledTimes(1);

      const after = await snapshotStores(db);
      expect(after).toEqual(before);
      expect(JSON.stringify(await listLearningRaw(db))).toBe(learningBefore);
      const activeAfter = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(STORE_META, "readonly");
        const req = tx.objectStore(STORE_META).get("active_bundle");
        req.addEventListener("success", () => resolve(req.result));
        req.addEventListener("error", () => reject(req.error));
      });
      expect(activeAfter).toEqual(activeBefore);
    });
  });

  it("artifact reflects the read snapshot, not later writes", async () => {
    await withDb(async (db) => {
      await saveLearningRecord(db, makeSaveInput({ ir_id: "before" }));

      let resolveRead!: (rows: unknown[]) => void;
      const delayedRead = new Promise<unknown[]>((resolve) => {
        resolveRead = resolve;
      });

      const exportPromise = createLearningBackupExport({
        openDb: async () => db,
        now: () => EXPORTED_AT_CANON,
        readAll: async () => delayedRead,
      });

      // Commit another record after the export read has begun but before it resolves.
      await saveLearningRecord(db, makeSaveInput({ ir_id: "after" }));
      resolveRead([makeRecord({ ir_id: "before" })]);

      const result = await exportPromise;
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.artifact.recordCount).toBe(1);
      const parsed = parseLearningBackupJson(result.artifact.text);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.package.records.map((r) => r.ir_id)).toEqual(["before"]);
      // Store itself still has both — export did not mutate and did not re-read.
      expect(await listAllLearningRecords(db)).toHaveLength(2);
    });
  });
});

describe("package schema constant", () => {
  it("exports the LP1 package schema", () => {
    expect(LEARNING_BACKUP_PACKAGE_SCHEMA).toBe("siralex_learning_backup_v1");
  });
});
