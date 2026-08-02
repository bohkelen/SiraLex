/**
 * CF1I2 — Local correction draft store tests.
 */

import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SIRALEX_DB_NAME,
  SIRALEX_DB_VERSION,
  STORE_BUNDLES_REGISTRY,
  STORE_CORRECTION_DRAFTS,
  STORE_LEARNING_RECORDS,
  STORE_META,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
  deleteBundleData,
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { LEARNING_RECORD_SCHEMA_VERSION, type LearningRecordV1 } from "../learning/learning_record_types";
import { saveLearningRecord } from "../learning/learning_record_store";
import {
  CORRECTION_DRAFT_SCHEMA_VERSION,
  validateCorrectionDraftForWrite,
  type CorrectionDraftV1,
} from "./correction_draft_types";
import {
  CorrectionDraftStoreError,
  compareCorrectionDraftsForManagement,
  countCorrectionDrafts,
  createCorrectionDraft,
  deleteCorrectionDraft,
  getCorrectionDraft,
  listCorrectionDrafts,
  updateCorrectionDraft,
  type CreateCorrectionDraftInput,
} from "./correction_draft_store";

const HASH_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TS_1 = "2026-07-31T18:00:00.000Z";
const TS_2 = "2026-07-31T19:00:00.000Z";
const TS_3 = "2026-07-31T20:00:00.000Z";
const BUNDLE_A = "bundle_a";
const SCOPE_A = `${BUNDLE_A}::${HASH_A}`;

function makeInput(
  overrides: Partial<CreateCorrectionDraftInput> = {},
): CreateCorrectionDraftInput {
  return {
    bundle_id: BUNDLE_A,
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH_A,
    storage_scope_id: SCOPE_A,
    issue_type: "spelling",
    mode: "problem_report",
    target: { type: "headword" },
    display_snapshot: { headword_latin: "kùn", headword_nko: "ߞߎ߲" },
    problem_description: "Spelling looks off.",
    ...overrides,
  };
}

function makeActiveMeta(overrides: Partial<ActiveBundleMeta> = {}): ActiveBundleMeta {
  return {
    bundle_id: BUNDLE_A,
    storage_scope_id: SCOPE_A,
    manifest_schema_version: "1",
    record_schema_id: "enriched_record_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "replace",
    reconciliation_action: "none",
    expected_content_sha256: HASH_A,
    imported_at_iso: TS_1,
    ...overrides,
  };
}

async function countStore(db: IDBDatabase, name: string): Promise<number> {
  const tx = db.transaction(name, "readonly");
  const count = await new Promise<number>((resolve, reject) => {
    const req = tx.objectStore(name).count();
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
  await new Promise<void>((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
  return count;
}

async function snapshotCounts(db: IDBDatabase): Promise<Record<string, number>> {
  const names = [
    STORE_META,
    STORE_RECORDS,
    STORE_SEARCH_INDEX,
    STORE_BUNDLES_REGISTRY,
    STORE_QUERY_LOGS,
    STORE_LEARNING_RECORDS,
    STORE_CORRECTION_DRAFTS,
  ];
  const out: Record<string, number> = {};
  for (const name of names) {
    out[name] = await countStore(db, name);
  }
  return out;
}

async function putCorruptDraft(db: IDBDatabase, draftId: string): Promise<void> {
  const tx = db.transaction(STORE_CORRECTION_DRAFTS, "readwrite");
  tx.objectStore(STORE_CORRECTION_DRAFTS).put({
    draft_id: draftId,
    schema_version: CORRECTION_DRAFT_SCHEMA_VERSION,
    // intentionally incomplete / invalid
    problem_description: "",
  });
  await new Promise<void>((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
}

async function openLegacyV4DbWithData(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(SIRALEX_DB_NAME, 4);
    req.addEventListener("upgradeneeded", () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const records = db.createObjectStore(STORE_RECORDS, {
          keyPath: ["bundle_id", "ir_id"],
        });
        records.createIndex("by_bundle_id", "bundle_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SEARCH_INDEX)) {
        const searchIndex = db.createObjectStore(STORE_SEARCH_INDEX, {
          keyPath: ["bundle_id", "key_type", "key"],
        });
        searchIndex.createIndex("by_bundle_id", "bundle_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_BUNDLES_REGISTRY)) {
        db.createObjectStore(STORE_BUNDLES_REGISTRY, { keyPath: "bundle_id" });
      }
      if (!db.objectStoreNames.contains(STORE_QUERY_LOGS)) {
        const queryLogs = db.createObjectStore(STORE_QUERY_LOGS, {
          keyPath: "log_id",
          autoIncrement: true,
        });
        queryLogs.createIndex("by_timestamp_iso", "timestamp_iso", { unique: false });
        queryLogs.createIndex("by_bundle_id", "bundle_id", { unique: false });
        queryLogs.createIndex("by_storage_scope_id", "storage_scope_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_LEARNING_RECORDS)) {
        const learning = db.createObjectStore(STORE_LEARNING_RECORDS, {
          keyPath: ["bundle_id", "ir_id"],
        });
        learning.createIndex("by_bundle_id", "bundle_id", { unique: false });
      }
    });
    req.addEventListener("success", () => {
      const db = req.result;
      const tx = db.transaction(
        [
          STORE_META,
          STORE_RECORDS,
          STORE_SEARCH_INDEX,
          STORE_BUNDLES_REGISTRY,
          STORE_QUERY_LOGS,
          STORE_LEARNING_RECORDS,
        ],
        "readwrite",
      );
      tx.objectStore(STORE_META).put("keep-me", "legacy-meta-key");
      tx.objectStore(STORE_RECORDS).put({
        bundle_id: SCOPE_A,
        ir_id: "legacy-lex",
        ir_kind: "lexicon_entry",
        display: { headword_latin: "legacy" },
      });
      tx.objectStore(STORE_SEARCH_INDEX).put({
        bundle_id: SCOPE_A,
        key_type: "casefold",
        key: "legacy",
        ir_ids: ["legacy-lex"],
      });
      tx.objectStore(STORE_BUNDLES_REGISTRY).put(makeActiveMeta());
      tx.objectStore(STORE_QUERY_LOGS).add({
        timestamp_iso: TS_1,
        bundle_id: BUNDLE_A,
        storage_scope_id: SCOPE_A,
        query_raw: "tête",
      });
      const learning: LearningRecordV1 = {
        schema_version: LEARNING_RECORD_SCHEMA_VERSION,
        bundle_id: BUNDLE_A,
        ir_id: "lex-learn",
        ir_kind: "lexicon_entry",
        content_sha256: HASH_A,
        storage_scope_id: SCOPE_A,
        status: "still_learning",
        created_at: TS_1,
        display_cache: { headword_latin: "kùn" },
        last_reviewed: null,
        review_count: 0,
      };
      tx.objectStore(STORE_LEARNING_RECORDS).put(learning);
      tx.addEventListener("complete", () => {
        db.close();
        resolve();
      });
      tx.addEventListener("error", () => reject(tx.error));
      tx.addEventListener("abort", () => reject(tx.error));
    });
    req.addEventListener("error", () => reject(req.error));
  });
}

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // fine if missing
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("schema upgrade", () => {
  it("fresh v5 database creates correction_drafts without indexes", async () => {
    expect(SIRALEX_DB_VERSION).toBe(5);
    const db = await openSiralexDb();
    expect(db.version).toBe(5);
    expect(db.objectStoreNames.contains(STORE_CORRECTION_DRAFTS)).toBe(true);
    const tx = db.transaction(STORE_CORRECTION_DRAFTS, "readonly");
    const store = tx.objectStore(STORE_CORRECTION_DRAFTS);
    expect(store.keyPath).toBe("draft_id");
    expect(store.indexNames.length).toBe(0);
    db.close();
  });

  it("v4 → v5 creates correction_drafts and preserves existing data", async () => {
    await openLegacyV4DbWithData();
    const db = await openSiralexDb();
    expect(db.version).toBe(5);
    expect(db.objectStoreNames.contains(STORE_CORRECTION_DRAFTS)).toBe(true);
    expect(db.objectStoreNames.contains(STORE_LEARNING_RECORDS)).toBe(true);

    const metaTx = db.transaction(STORE_META, "readonly");
    const metaVal = await new Promise((resolve, reject) => {
      const req = metaTx.objectStore(STORE_META).get("legacy-meta-key");
      req.addEventListener("success", () => resolve(req.result));
      req.addEventListener("error", () => reject(req.error));
    });
    expect(metaVal).toBe("keep-me");

    const recTx = db.transaction(STORE_RECORDS, "readonly");
    const rec = await new Promise((resolve, reject) => {
      const req = recTx.objectStore(STORE_RECORDS).get([SCOPE_A, "legacy-lex"]);
      req.addEventListener("success", () => resolve(req.result));
      req.addEventListener("error", () => reject(req.error));
    });
    expect(rec).toBeTruthy();

    const idxTx = db.transaction(STORE_SEARCH_INDEX, "readonly");
    const idx = await new Promise((resolve, reject) => {
      const req = idxTx.objectStore(STORE_SEARCH_INDEX).get([SCOPE_A, "casefold", "legacy"]);
      req.addEventListener("success", () => resolve(req.result));
      req.addEventListener("error", () => reject(req.error));
    });
    expect(idx).toBeTruthy();

    const regTx = db.transaction(STORE_BUNDLES_REGISTRY, "readonly");
    const reg = await new Promise((resolve, reject) => {
      const req = regTx.objectStore(STORE_BUNDLES_REGISTRY).get(BUNDLE_A);
      req.addEventListener("success", () => resolve(req.result));
      req.addEventListener("error", () => reject(req.error));
    });
    expect(reg).toBeTruthy();

    const learnTx = db.transaction(STORE_LEARNING_RECORDS, "readonly");
    const learn = await new Promise((resolve, reject) => {
      const req = learnTx.objectStore(STORE_LEARNING_RECORDS).get([BUNDLE_A, "lex-learn"]);
      req.addEventListener("success", () => resolve(req.result));
      req.addEventListener("error", () => reject(req.error));
    });
    expect(learn).toBeTruthy();

    const logTx = db.transaction(STORE_QUERY_LOGS, "readonly");
    const logCount = await new Promise<number>((resolve, reject) => {
      const req = logTx.objectStore(STORE_QUERY_LOGS).count();
      req.addEventListener("success", () => resolve(req.result));
      req.addEventListener("error", () => reject(req.error));
    });
    expect(logCount).toBe(1);

    expect(await countCorrectionDrafts(db)).toBe(0);
    db.close();

    const db2 = await openSiralexDb();
    expect(db2.version).toBe(5);
    expect(db2.objectStoreNames.contains(STORE_CORRECTION_DRAFTS)).toBe(true);
    db2.close();
  });
});

describe("create", () => {
  it("creates a valid draft with system fields and exact Unicode", async () => {
    const db = await openSiralexDb();
    const now = vi.fn(() => TS_1);
    const generateDraftId = vi.fn(() => "11111111-1111-4111-8111-111111111111");
    const before = await snapshotCounts(db);

    const result = await createCorrectionDraft(db, makeInput(), { now, generateDraftId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(now).toHaveBeenCalledTimes(1);
    expect(generateDraftId).toHaveBeenCalledTimes(1);
    expect(result.draft.schema_version).toBe(CORRECTION_DRAFT_SCHEMA_VERSION);
    expect(result.draft.draft_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.draft.created_at).toBe(TS_1);
    expect(result.draft.updated_at).toBe(TS_1);
    expect(result.draft.status).toBe("draft");
    expect(result.draft.display_snapshot.headword_nko).toBe("ߞߎ߲");
    expect(result.draft.content_sha256).toBe(HASH_A);
    expect(result.draft.storage_scope_id).toBe(SCOPE_A);

    const fetched = await getCorrectionDraft(db, result.draft.draft_id);
    expect(fetched).toEqual(result.draft);
    expect(fetched).not.toBe(result.draft);

    const after = await snapshotCounts(db);
    expect(after[STORE_CORRECTION_DRAFTS]).toBe(before[STORE_CORRECTION_DRAFTS]! + 1);
    for (const key of Object.keys(before)) {
      if (key === STORE_CORRECTION_DRAFTS) continue;
      expect(after[key]).toBe(before[key]);
    }
    expect(db.version).toBe(5);
    db.close();
  });

  it("rejects invalid input without writing and preserves DB open", async () => {
    const db = await openSiralexDb();
    const before = await countCorrectionDrafts(db);
    const result = await createCorrectionDraft(db, makeInput({ problem_description: "" }), {
      now: () => TS_1,
      generateDraftId: () => "22222222-2222-4222-8222-222222222222",
    });
    expect(result).toEqual({ ok: false, code: "invalid_input" });
    expect(await countCorrectionDrafts(db)).toBe(before);
    expect(db.name).toBe(SIRALEX_DB_NAME);
    db.close();
  });

  it("rejects invalid generated timestamp and ID", async () => {
    const db = await openSiralexDb();
    expect(
      await createCorrectionDraft(db, makeInput(), {
        now: () => "yesterday",
        generateDraftId: () => "33333333-3333-4333-8333-333333333333",
      }),
    ).toEqual({ ok: false, code: "invalid_timestamp" });
    expect(
      await createCorrectionDraft(db, makeInput(), {
        now: () => TS_1,
        generateDraftId: () => "",
      }),
    ).toEqual({ ok: false, code: "invalid_input" });
    db.close();
  });

  it("returns draft_id_conflict on duplicate add", async () => {
    const db = await openSiralexDb();
    const id = "44444444-4444-4444-8444-444444444444";
    const first = await createCorrectionDraft(db, makeInput(), {
      now: () => TS_1,
      generateDraftId: () => id,
    });
    expect(first.ok).toBe(true);
    const second = await createCorrectionDraft(
      db,
      makeInput({ ir_id: "lex-2", problem_description: "Other issue" }),
      { now: () => TS_2, generateDraftId: () => id },
    );
    expect(second).toEqual({ ok: false, code: "draft_id_conflict" });
    expect(await countCorrectionDrafts(db)).toBe(1);
    db.close();
  });

  it("uses crypto.randomUUID when available", async () => {
    const db = await openSiralexDb();
    try {
      const uuid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
      const randomUUID = vi.fn(() => uuid);
      const getRandomValues = vi.fn();
      vi.stubGlobal("crypto", {
        ...globalThis.crypto,
        randomUUID,
        getRandomValues,
      });
      const mathSpy = vi.spyOn(Math, "random");

      const result = await createCorrectionDraft(db, makeInput(), { now: () => TS_1 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.draft.draft_id).toBe(uuid);
      expect(randomUUID).toHaveBeenCalledTimes(1);
      expect(getRandomValues).not.toHaveBeenCalled();
      expect(mathSpy).not.toHaveBeenCalled();
      expect(() => validateCorrectionDraftForWrite(result.draft)).not.toThrow();
    } finally {
      db.close();
    }
  });

  it("uses getRandomValues UUID path when randomUUID is unavailable", async () => {
    const db = await openSiralexDb();
    try {
      const getRandomValues = vi.fn((bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i += 1) {
          bytes[i] = (i * 17 + 3) % 256;
        }
        return bytes;
      });
      vi.stubGlobal("crypto", {
        getRandomValues,
      });
      const mathSpy = vi.spyOn(Math, "random");

      const result = await createCorrectionDraft(db, makeInput(), { now: () => TS_1 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(getRandomValues).toHaveBeenCalledTimes(1);
      expect(mathSpy).not.toHaveBeenCalled();
      expect(result.draft.draft_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(() => validateCorrectionDraftForWrite(result.draft)).not.toThrow();
    } finally {
      db.close();
    }
  });

  it("fails closed with id_generation_failed when no secure API exists", async () => {
    const db = await openSiralexDb();
    try {
      const before = await countCorrectionDrafts(db);
      // Empty crypto: no secure ID APIs. Create must fail before any transaction.
      vi.stubGlobal("crypto", {});
      const mathSpy = vi.spyOn(Math, "random");
      const txSpy = vi.spyOn(db, "transaction");

      const result = await createCorrectionDraft(db, makeInput(), { now: () => TS_1 });
      expect(result).toEqual({ ok: false, code: "id_generation_failed" });
      expect(txSpy).not.toHaveBeenCalled();
      expect(mathSpy).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
      expect(await countCorrectionDrafts(db)).toBe(before);
    } finally {
      db.close();
    }
  });

  it("injected generateDraftId still works when crypto is unavailable", async () => {
    const db = await openSiralexDb();
    try {
      // Hide secure ID APIs but keep the rest of crypto for IndexedDB.
      const base = globalThis.crypto;
      vi.stubGlobal(
        "crypto",
        new Proxy(base, {
          get(target, prop, receiver) {
            if (prop === "randomUUID" || prop === "getRandomValues") return undefined;
            const value = Reflect.get(target, prop, receiver);
            return typeof value === "function" ? value.bind(target) : value;
          },
        }),
      );
      const mathSpy = vi.spyOn(Math, "random");
      const id = "inj00000-0000-4000-8000-000000000001";
      const result = await createCorrectionDraft(db, makeInput(), {
        now: () => TS_1,
        generateDraftId: () => id,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.draft.draft_id).toBe(id);
      expect(mathSpy).not.toHaveBeenCalled();
    } finally {
      db.close();
    }
  });

  it("failed create after write queue leaves no draft", async () => {
    const db = await openSiralexDb();
    const result = await createCorrectionDraft(db, makeInput(), {
      now: () => TS_1,
      generateDraftId: () => "55555555-5555-4555-8555-555555555555",
      afterWriteQueued: async () => {
        throw new Error("forced failure");
      },
    });
    expect(result).toEqual({ ok: false, code: "database_write_failed" });
    expect(await countCorrectionDrafts(db)).toBe(0);
    db.close();
  });
});

describe("get/list/count", () => {
  it("lists across bundles in management order and counts without parsing", async () => {
    const db = await openSiralexDb();
    await createCorrectionDraft(db, makeInput({ ir_id: "lex-1" }), {
      now: () => TS_1,
      generateDraftId: () => "a0000000-0000-4000-8000-000000000001",
    });
    await createCorrectionDraft(
      db,
      makeInput({ bundle_id: "bundle_b", ir_id: "lex-2", storage_scope_id: `bundle_b::${HASH_A}` }),
      {
        now: () => TS_3,
        generateDraftId: () => "c0000000-0000-4000-8000-000000000003",
      },
    );
    await createCorrectionDraft(db, makeInput({ ir_id: "lex-3" }), {
      now: () => TS_2,
      generateDraftId: () => "b0000000-0000-4000-8000-000000000002",
    });

    expect(await countCorrectionDrafts(db)).toBe(3);
    const listed = await listCorrectionDrafts(db);
    expect(listed.map((d) => d.draft_id)).toEqual([
      "c0000000-0000-4000-8000-000000000003",
      "b0000000-0000-4000-8000-000000000002",
      "a0000000-0000-4000-8000-000000000001",
    ]);

    const sorted = [...listed].sort(compareCorrectionDraftsForManagement);
    expect(sorted.map((d) => d.draft_id)).toEqual(listed.map((d) => d.draft_id));

    expect(await getCorrectionDraft(db, "missing-id-0000-4000-8000-000000000099")).toBeUndefined();
    await expect(getCorrectionDraft(db, "")).rejects.toBeInstanceOf(CorrectionDraftStoreError);

    const before = await snapshotCounts(db);
    await listCorrectionDrafts(db);
    await countCorrectionDrafts(db);
    expect(await snapshotCounts(db)).toEqual(before);
    db.close();
  });

  it("blocks get/list on corrupt stored rows", async () => {
    const db = await openSiralexDb();
    await putCorruptDraft(db, "corrupt-0000-4000-8000-000000000001");
    await expect(
      getCorrectionDraft(db, "corrupt-0000-4000-8000-000000000001"),
    ).rejects.toMatchObject({ code: "invalid_stored_draft" });
    await expect(listCorrectionDrafts(db)).rejects.toMatchObject({
      code: "invalid_stored_draft",
    });
    db.close();
  });
});

describe("update", () => {
  it("updates mutable fields, preserves provenance, and advances updated_at", async () => {
    const db = await openSiralexDb();
    const created = await createCorrectionDraft(db, makeInput(), {
      now: () => TS_1,
      generateDraftId: () => "u0000000-0000-4000-8000-000000000001",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const before = await snapshotCounts(db);
    const updated = await updateCorrectionDraft(
      db,
      {
        draft_id: created.draft.draft_id,
        expected_updated_at: created.draft.updated_at,
        issue_type: "example",
        mode: "proposed_correction",
        target: { type: "example", sense_index: 0, example_index: 1 },
        display_snapshot: {
          headword_latin: "kùn",
          selected_example: "an example",
        },
        problem_description: "Example is weak.",
        proposed_value: "better\nexample ߞߎ߲",
      },
      { now: () => TS_2 },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    expect(updated.draft.created_at).toBe(TS_1);
    expect(updated.draft.updated_at).toBe(TS_2);
    expect(updated.draft.content_sha256).toBe(HASH_A);
    expect(updated.draft.storage_scope_id).toBe(SCOPE_A);
    expect(updated.draft.bundle_id).toBe(BUNDLE_A);
    expect(updated.draft.ir_id).toBe("lex-1");
    expect(updated.draft.proposed_value).toBe("better\nexample ߞߎ߲");
    expect(updated.draft.target).toEqual({
      type: "example",
      sense_index: 0,
      example_index: 1,
    });

    const after = await snapshotCounts(db);
    expect(after).toEqual(before);

    const stale = await updateCorrectionDraft(
      db,
      {
        draft_id: created.draft.draft_id,
        expected_updated_at: TS_1,
        issue_type: "other",
        mode: "problem_report",
        target: { type: "entry" },
        display_snapshot: { headword_latin: "kùn" },
        problem_description: "stale attempt",
      },
      { now: () => TS_3 },
    );
    expect(stale).toEqual({ ok: false, code: "stale_draft" });

    const sameClock = await updateCorrectionDraft(
      db,
      {
        draft_id: created.draft.draft_id,
        expected_updated_at: TS_2,
        issue_type: "other",
        mode: "problem_report",
        target: { type: "entry" },
        display_snapshot: { headword_latin: "kùn" },
        problem_description: "same clock",
      },
      { now: () => TS_2 },
    );
    expect(sameClock).toEqual({ ok: false, code: "invalid_timestamp" });

    const removeProposed = await updateCorrectionDraft(
      db,
      {
        draft_id: created.draft.draft_id,
        expected_updated_at: TS_2,
        issue_type: "spelling",
        mode: "problem_report",
        target: { type: "headword" },
        display_snapshot: { headword_latin: "kùn" },
        problem_description: "Still wrong.",
      },
      { now: () => TS_3 },
    );
    expect(removeProposed.ok).toBe(true);
    if (!removeProposed.ok) return;
    expect(removeProposed.draft.proposed_value).toBeUndefined();
    db.close();
  });

  it("blocks corrupt rows and rolls back failed updates", async () => {
    const db = await openSiralexDb();
    await putCorruptDraft(db, "bad00000-0000-4000-8000-000000000001");
    const corruptUpdate = await updateCorrectionDraft(
      db,
      {
        draft_id: "bad00000-0000-4000-8000-000000000001",
        expected_updated_at: TS_1,
        issue_type: "other",
        mode: "problem_report",
        target: { type: "entry" },
        display_snapshot: { headword_latin: "x" },
        problem_description: "attempt",
      },
      { now: () => TS_2 },
    );
    expect(corruptUpdate).toEqual({ ok: false, code: "invalid_stored_draft" });

    const created = await createCorrectionDraft(db, makeInput(), {
      now: () => TS_1,
      generateDraftId: () => "ok000000-0000-4000-8000-000000000001",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const failed = await updateCorrectionDraft(
      db,
      {
        draft_id: created.draft.draft_id,
        expected_updated_at: TS_1,
        issue_type: "nko",
        mode: "problem_report",
        target: { type: "nko" },
        display_snapshot: { headword_latin: "kùn", headword_nko: "ߞߎ߲" },
        problem_description: "N’Ko note",
      },
      {
        now: () => TS_2,
        afterWriteQueued: async () => {
          throw new Error("forced");
        },
      },
    );
    expect(failed).toEqual({ ok: false, code: "database_write_failed" });
    const still = await getCorrectionDraft(db, created.draft.draft_id);
    expect(still?.updated_at).toBe(TS_1);
    expect(still?.issue_type).toBe("spelling");
    db.close();
  });
});

describe("delete", () => {
  it("deletes with stale protection and repeated delete returns not_found", async () => {
    const db = await openSiralexDb();
    const created = await createCorrectionDraft(db, makeInput(), {
      now: () => TS_1,
      generateDraftId: () => "d0000000-0000-4000-8000-000000000001",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const stale = await deleteCorrectionDraft(db, created.draft.draft_id, {
      expectedUpdatedAt: TS_2,
    });
    expect(stale).toEqual({ ok: false, code: "stale_draft" });

    const before = await snapshotCounts(db);
    const deleted = await deleteCorrectionDraft(db, created.draft.draft_id, {
      expectedUpdatedAt: TS_1,
    });
    expect(deleted).toEqual({ ok: true, deleted: true });
    expect(await getCorrectionDraft(db, created.draft.draft_id)).toBeUndefined();
    const after = await snapshotCounts(db);
    expect(after[STORE_CORRECTION_DRAFTS]).toBe(before[STORE_CORRECTION_DRAFTS]! - 1);
    for (const key of Object.keys(before)) {
      if (key === STORE_CORRECTION_DRAFTS) continue;
      expect(after[key]).toBe(before[key]);
    }

    const again = await deleteCorrectionDraft(db, created.draft.draft_id, {
      expectedUpdatedAt: TS_1,
    });
    expect(again).toEqual({ ok: false, code: "not_found" });
    db.close();
  });

  it("blocks delete of corrupt rows and rolls back forced delete failure", async () => {
    const db = await openSiralexDb();
    await putCorruptDraft(db, "bad00000-0000-4000-8000-000000000002");
    expect(
      await deleteCorrectionDraft(db, "bad00000-0000-4000-8000-000000000002", {
        expectedUpdatedAt: TS_1,
      }),
    ).toEqual({ ok: false, code: "invalid_stored_draft" });

    const created = await createCorrectionDraft(db, makeInput(), {
      now: () => TS_1,
      generateDraftId: () => "d1000000-0000-4000-8000-000000000001",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const failed = await deleteCorrectionDraft(
      db,
      created.draft.draft_id,
      { expectedUpdatedAt: TS_1 },
      {
        afterDeleteQueued: async () => {
          throw new Error("forced");
        },
      },
    );
    expect(failed).toEqual({ ok: false, code: "database_write_failed" });
    expect(await getCorrectionDraft(db, created.draft.draft_id)).toBeTruthy();
    db.close();
  });
});

describe("bundle lifecycle and database deletion", () => {
  it("retains drafts across bundle removal and content-hash update", async () => {
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, makeActiveMeta());
    const tx = db.transaction([STORE_RECORDS, STORE_SEARCH_INDEX], "readwrite");
    tx.objectStore(STORE_RECORDS).put({
      bundle_id: SCOPE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      display: { headword_latin: "kùn" },
    });
    tx.objectStore(STORE_SEARCH_INDEX).put({
      bundle_id: SCOPE_A,
      key_type: "casefold",
      key: "kun",
      ir_ids: ["lex-1"],
    });
    await new Promise<void>((resolve, reject) => {
      tx.addEventListener("complete", () => resolve());
      tx.addEventListener("error", () => reject(tx.error));
    });

    const created = await createCorrectionDraft(db, makeInput(), {
      now: () => TS_1,
      generateDraftId: () => "l0000000-0000-4000-8000-000000000001",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await deleteBundleData(db, BUNDLE_A);
    const afterRemoval = await getCorrectionDraft(db, created.draft.draft_id);
    expect(afterRemoval).toEqual(created.draft);
    expect(afterRemoval?.content_sha256).toBe(HASH_A);
    expect(afterRemoval?.storage_scope_id).toBe(SCOPE_A);

    const scopeB = `${BUNDLE_A}::${HASH_B}`;
    await putInstalledBundleMeta(
      db,
      makeActiveMeta({
        storage_scope_id: scopeB,
        expected_content_sha256: HASH_B,
      }),
    );
    const afterUpdate = await getCorrectionDraft(db, created.draft.draft_id);
    expect(afterUpdate?.content_sha256).toBe(HASH_A);
    expect(afterUpdate?.storage_scope_id).toBe(SCOPE_A);
    db.close();
  });

  it("full database deletion clears correction drafts and reopens at v5", async () => {
    const db = await openSiralexDb();
    const created = await createCorrectionDraft(db, makeInput(), {
      now: () => TS_1,
      generateDraftId: () => "z0000000-0000-4000-8000-000000000001",
    });
    expect(created.ok).toBe(true);
    db.close();

    await deleteSiralexDb();
    const reopened = await openSiralexDb();
    expect(reopened.version).toBe(5);
    expect(reopened.objectStoreNames.contains(STORE_CORRECTION_DRAFTS)).toBe(true);
    expect(await countCorrectionDrafts(reopened)).toBe(0);
    reopened.close();
  });

  it("does not mutate Learning or query-log stores", async () => {
    const db = await openSiralexDb();
    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-learn",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_A,
      storage_scope_id: SCOPE_A,
      display_cache: { headword_latin: "kùn" },
    });
    const logTx = db.transaction(STORE_QUERY_LOGS, "readwrite");
    logTx.objectStore(STORE_QUERY_LOGS).add({
      timestamp_iso: TS_1,
      bundle_id: BUNDLE_A,
      storage_scope_id: SCOPE_A,
      query_raw: "tête",
    });
    await new Promise<void>((resolve, reject) => {
      logTx.addEventListener("complete", () => resolve());
      logTx.addEventListener("error", () => reject(logTx.error));
    });

    const before = await snapshotCounts(db);
    await createCorrectionDraft(db, makeInput(), {
      now: () => TS_1,
      generateDraftId: () => "i0000000-0000-4000-8000-000000000001",
    });
    const after = await snapshotCounts(db);
    expect(after[STORE_LEARNING_RECORDS]).toBe(before[STORE_LEARNING_RECORDS]);
    expect(after[STORE_QUERY_LOGS]).toBe(before[STORE_QUERY_LOGS]);
    expect(after[STORE_CORRECTION_DRAFTS]).toBe(before[STORE_CORRECTION_DRAFTS]! + 1);
    db.close();
  });
});
