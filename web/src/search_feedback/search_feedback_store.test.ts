/**
 * CF2I2 — Local search-failure feedback store tests.
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
  STORE_SEARCH_FAILURE_FEEDBACK,
  STORE_SEARCH_INDEX,
  deleteBundleData,
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import {
  CORRECTION_DRAFT_SCHEMA_VERSION,
  type CorrectionDraftV1,
} from "../corrections/correction_draft_types";
import { createCorrectionDraft } from "../corrections/correction_draft_store";
import {
  LEARNING_RECORD_SCHEMA_VERSION,
  type LearningRecordV1,
} from "../learning/learning_record_types";
import { saveLearningRecord } from "../learning/learning_record_store";
import {
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1,
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2,
} from "./search_feedback_types";
import {
  SearchFeedbackStoreError,
  compareSearchFeedbackDraftsForManagement,
  countSearchFeedbackDrafts,
  createSearchFeedbackDraft,
  deleteSearchFeedbackDraft,
  getSearchFeedbackDraft,
  listSearchFeedbackDrafts,
  updateSearchFeedbackDraft,
  type CreateSearchFeedbackDraftInput,
} from "./search_feedback_store";

const HASH_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TS_1 = "2026-08-02T18:00:00.000Z";
const TS_2 = "2026-08-02T19:00:00.000Z";
const TS_3 = "2026-08-02T20:00:00.000Z";
const BUNDLE_A = "bundle_a";
const SCOPE_A = `${BUNDLE_A}::${HASH_A}`;
const SCOPE_B = `${BUNDLE_A}::${HASH_B}`;

function makeInput(
  overrides: Partial<CreateSearchFeedbackDraftInput> = {},
): CreateSearchFeedbackDraftInput {
  const search_direction = overrides.search_direction ?? "target_to_source";
  const defaultLangs =
    search_direction === "source_to_target"
      ? ({ input_lang: "fr", output_lang: "mnk" } as const)
      : ({ input_lang: "mnk", output_lang: "fr" } as const);
  const { search_direction: _sd, input_lang: _il, output_lang: _ol, ...rest } =
    overrides;
  return {
    bundle_id: BUNDLE_A,
    content_sha256: HASH_A,
    storage_scope_id: SCOPE_A,
    query_raw: "kùn",
    result_state: "no_result",
    result_count: 0,
    ...rest,
    search_direction,
    input_lang: overrides.input_lang ?? defaultLangs.input_lang,
    output_lang: overrides.output_lang ?? defaultLangs.output_lang,
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
    STORE_SEARCH_FAILURE_FEEDBACK,
  ];
  const out: Record<string, number> = {};
  for (const name of names) {
    out[name] = await countStore(db, name);
  }
  return out;
}

async function putCorruptFeedback(db: IDBDatabase, feedbackId: string): Promise<void> {
  const tx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readwrite");
  tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK).put({
    feedback_id: feedbackId,
    schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
    query_raw: "",
  });
  await new Promise<void>((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
}

async function openLegacyV5DbWithData(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(SIRALEX_DB_NAME, 5);
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
        queryLogs.createIndex("by_storage_scope_id", "storage_scope_id", {
          unique: false,
        });
      }
      if (!db.objectStoreNames.contains(STORE_LEARNING_RECORDS)) {
        const learning = db.createObjectStore(STORE_LEARNING_RECORDS, {
          keyPath: ["bundle_id", "ir_id"],
        });
        learning.createIndex("by_bundle_id", "bundle_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CORRECTION_DRAFTS)) {
        db.createObjectStore(STORE_CORRECTION_DRAFTS, { keyPath: "draft_id" });
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
          STORE_CORRECTION_DRAFTS,
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
        query_raw: "legacy",
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
        display_cache: { headword_latin: "learn" },
        last_reviewed: null,
        review_count: 0,
      };
      tx.objectStore(STORE_LEARNING_RECORDS).put(learning);
      const correction: CorrectionDraftV1 = {
        schema_version: CORRECTION_DRAFT_SCHEMA_VERSION,
        draft_id: "cf1-legacy-1",
        bundle_id: BUNDLE_A,
        ir_id: "lex-1",
        ir_kind: "lexicon_entry",
        content_sha256: HASH_A,
        storage_scope_id: SCOPE_A,
        issue_type: "spelling",
        mode: "problem_report",
        target: { type: "headword" },
        display_snapshot: { headword_latin: "kùn" },
        problem_description: "legacy CF1 draft",
        created_at: TS_1,
        updated_at: TS_1,
        status: "draft",
      };
      tx.objectStore(STORE_CORRECTION_DRAFTS).put(correction);
      tx.addEventListener("complete", () => {
        db.close();
        resolve();
      });
      tx.addEventListener("error", () => reject(tx.error));
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
  it("fresh v6 database creates search_failure_feedback without indexes", async () => {
    expect(SIRALEX_DB_VERSION).toBe(6);
    const db = await openSiralexDb();
    expect(db.version).toBe(6);
    expect(db.objectStoreNames.contains(STORE_SEARCH_FAILURE_FEEDBACK)).toBe(true);
    expect(db.objectStoreNames.contains(STORE_CORRECTION_DRAFTS)).toBe(true);
    const tx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readonly");
    const store = tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK);
    expect(store.keyPath).toBe("feedback_id");
    expect(store.indexNames.length).toBe(0);
    db.close();
  });

  it("v5 → v6 adds only CF2 store and preserves existing data", async () => {
    await openLegacyV5DbWithData();
    const db = await openSiralexDb();
    expect(db.version).toBe(6);
    expect(db.objectStoreNames.contains(STORE_SEARCH_FAILURE_FEEDBACK)).toBe(true);

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
      const req = idxTx.objectStore(STORE_SEARCH_INDEX).get([
        SCOPE_A,
        "casefold",
        "legacy",
      ]);
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
      const req = learnTx.objectStore(STORE_LEARNING_RECORDS).get([
        BUNDLE_A,
        "lex-learn",
      ]);
      req.addEventListener("success", () => resolve(req.result));
      req.addEventListener("error", () => reject(req.error));
    });
    expect(learn).toBeTruthy();

    const cf1Tx = db.transaction(STORE_CORRECTION_DRAFTS, "readonly");
    const cf1 = await new Promise((resolve, reject) => {
      const req = cf1Tx.objectStore(STORE_CORRECTION_DRAFTS).get("cf1-legacy-1");
      req.addEventListener("success", () => resolve(req.result));
      req.addEventListener("error", () => reject(req.error));
    });
    expect(cf1).toBeTruthy();

    const logTx = db.transaction(STORE_QUERY_LOGS, "readonly");
    const logCount = await new Promise<number>((resolve, reject) => {
      const req = logTx.objectStore(STORE_QUERY_LOGS).count();
      req.addEventListener("success", () => resolve(req.result));
      req.addEventListener("error", () => reject(req.error));
    });
    expect(logCount).toBe(1);

    expect(await countSearchFeedbackDrafts(db)).toBe(0);
    const cf2Tx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readonly");
    expect(cf2Tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK).indexNames.length).toBe(
      0,
    );
    db.close();
  });
});

describe("create", () => {
  it("creates valid no_result and results_not_useful drafts", async () => {
    const db = await openSiralexDb();
    const now = vi.fn(() => TS_1);

    const noResult = await createSearchFeedbackDraft(db, makeInput(), {
      now,
      generateFeedbackId: () => "cf2-no-result-1",
    });
    expect(noResult.ok).toBe(true);
    if (!noResult.ok) return;
    expect(noResult.draft.result_state).toBe("no_result");
    expect(noResult.draft.result_count).toBe(0);
    expect(noResult.draft.matched_ir_ids).toBeUndefined();
    expect(noResult.draft.status).toBe("draft");
    expect(noResult.draft.created_at).toBe(TS_1);
    expect(noResult.draft.updated_at).toBe(TS_1);

    const useful = await createSearchFeedbackDraft(
      db,
      makeInput({
        query_raw: "amour",
        search_direction: "source_to_target",
        result_state: "results_not_useful",
        result_count: 6,
        matched_ir_ids: ["lex-a", "lex-b"],
        requested_meaning: "love",
      }),
      { now, generateFeedbackId: () => "cf2-results-1" },
    );
    expect(useful.ok).toBe(true);
    if (!useful.ok) return;
    expect(useful.draft.matched_ir_ids).toEqual(["lex-a", "lex-b"]);
    expect(useful.draft.requested_meaning).toBe("love");
    db.close();
  });

  it("preserves query-only, Unicode/N’Ko, and exact whitespace", async () => {
    const db = await openSiralexDb();
    const query = "  à l'insu de ߞߎ߲  ";
    const result = await createSearchFeedbackDraft(
      db,
      makeInput({ query_raw: query }),
      {
        now: () => TS_1,
        generateFeedbackId: () => "cf2-unicode-1",
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.query_raw).toBe(query);
    expect(result.draft.requested_meaning).toBeUndefined();
    expect(result.draft.user_description).toBeUndefined();
    db.close();
  });

  it("uses randomUUID, getRandomValues fallback, and fails closed without RNG", async () => {
    const db = await openSiralexDb();

    const uuid = "22222222-2222-4222-8222-222222222222";
    const randomUUID = vi.fn(() => uuid);
    vi.stubGlobal("crypto", { randomUUID, getRandomValues: crypto.getRandomValues });
    const viaUuid = await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
    });
    expect(viaUuid.ok).toBe(true);
    if (!viaUuid.ok) return;
    expect(viaUuid.draft.feedback_id).toBe(uuid);
    expect(randomUUID).toHaveBeenCalled();

    const bytes = new Uint8Array(16);
    bytes.fill(3);
    const getRandomValues = vi.fn((arr: Uint8Array) => {
      arr.set(bytes);
      return arr;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    const viaFallback = await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
    });
    expect(viaFallback.ok).toBe(true);
    if (!viaFallback.ok) return;
    expect(viaFallback.draft.feedback_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(getRandomValues).toHaveBeenCalled();

    vi.stubGlobal("crypto", {});
    const failed = await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
    });
    expect(failed).toEqual({ ok: false, code: "id_generation_failed" });
    db.close();
  });

  it("rejects duplicate IDs, invalid input, invalid timestamp, and aborted writes", async () => {
    const db = await openSiralexDb();
    const id = "dup-id";
    const first = await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => id,
    });
    expect(first.ok).toBe(true);

    const conflict = await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => id,
    });
    expect(conflict).toEqual({ ok: false, code: "feedback_id_conflict" });

    const invalid = await createSearchFeedbackDraft(
      db,
      makeInput({ query_raw: "" }),
      { now: () => TS_1, generateFeedbackId: () => "bad-input" },
    );
    expect(invalid).toEqual({ ok: false, code: "invalid_input" });

    const badTs = await createSearchFeedbackDraft(db, makeInput(), {
      now: () => "yesterday",
      generateFeedbackId: () => "bad-ts",
    });
    expect(badTs).toEqual({ ok: false, code: "invalid_timestamp" });

    const aborted = await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => "abort-me",
      afterWriteQueued: async () => {
        throw new Error("forced-abort");
      },
    });
    expect(aborted.ok).toBe(false);
    if (!aborted.ok) {
      expect(aborted.code).toBe("database_write_failed");
    }
    expect(await getSearchFeedbackDraft(db, "abort-me")).toBeUndefined();

    const created = await createSearchFeedbackDraft(
      db,
      makeInput({
        result_state: "results_not_useful",
        result_count: 2,
        matched_ir_ids: ["lex-1", "lex-2"],
      }),
      { now: () => TS_1, generateFeedbackId: () => "clone-check" },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    created.draft.matched_ir_ids![0] = "mutated";
    const reread = await getSearchFeedbackDraft(db, "clone-check");
    expect(reread?.matched_ir_ids).toEqual(["lex-1", "lex-2"]);
    db.close();
  });
});

describe("get / list / count", () => {
  it("gets existing/missing and validates stored rows", async () => {
    const db = await openSiralexDb();
    await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => "get-1",
    });
    const found = await getSearchFeedbackDraft(db, "get-1");
    expect(found?.feedback_id).toBe("get-1");
    expect(await getSearchFeedbackDraft(db, "missing")).toBeUndefined();

    await putCorruptFeedback(db, "corrupt-1");
    await expect(getSearchFeedbackDraft(db, "corrupt-1")).rejects.toMatchObject({
      code: "invalid_stored_feedback",
    });
    db.close();
  });

  it("lists with management order across bundles and blocks on corrupt rows", async () => {
    const db = await openSiralexDb();
    await createSearchFeedbackDraft(db, makeInput({ query_raw: "a" }), {
      now: () => TS_1,
      generateFeedbackId: () => "id-a",
    });
    await createSearchFeedbackDraft(
      db,
      makeInput({
        bundle_id: "bundle_b",
        storage_scope_id: `bundle_b::${HASH_A}`,
        query_raw: "b",
      }),
      { now: () => TS_2, generateFeedbackId: () => "id-b" },
    );
    await createSearchFeedbackDraft(db, makeInput({ query_raw: "c" }), {
      now: () => TS_3,
      generateFeedbackId: () => "id-c",
    });

    const listed = await listSearchFeedbackDrafts(db);
    expect(listed.map((d) => d.feedback_id)).toEqual(["id-c", "id-b", "id-a"]);
    expect(
      [...listed].sort(compareSearchFeedbackDraftsForManagement).map((d) => d.feedback_id),
    ).toEqual(["id-c", "id-b", "id-a"]);

    await putCorruptFeedback(db, "corrupt-list");
    await expect(listSearchFeedbackDrafts(db)).rejects.toMatchObject({
      code: "invalid_stored_feedback",
    });
    expect(await countSearchFeedbackDrafts(db)).toBe(4);
    db.close();
  });

  it("count is raw and works for empty/non-empty", async () => {
    const db = await openSiralexDb();
    expect(await countSearchFeedbackDrafts(db)).toBe(0);
    await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => "count-1",
    });
    expect(await countSearchFeedbackDrafts(db)).toBe(1);
    db.close();
  });
});

describe("update", () => {
  it("updates user evidence only and clears optionals to absence", async () => {
    const db = await openSiralexDb();
    const created = await createSearchFeedbackDraft(
      db,
      makeInput({
        result_state: "results_not_useful",
        result_count: 3,
        matched_ir_ids: ["lex-1"],
        requested_meaning: "old meaning",
        user_description: "old details",
      }),
      { now: () => TS_1, generateFeedbackId: () => "upd-1" },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateSearchFeedbackDraft(
      db,
      {
        feedback_id: "upd-1",
        expected_updated_at: TS_1,
        requested_meaning: "new meaning ߞߎ߲",
      },
      { now: () => TS_2 },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.draft.requested_meaning).toBe("new meaning ߞߎ߲");
    expect(updated.draft.user_description).toBeUndefined();
    expect(updated.draft.query_raw).toBe("kùn");
    expect(updated.draft.result_state).toBe("results_not_useful");
    expect(updated.draft.result_count).toBe(3);
    expect(updated.draft.matched_ir_ids).toEqual(["lex-1"]);
    expect(updated.draft.bundle_id).toBe(BUNDLE_A);
    expect(updated.draft.content_sha256).toBe(HASH_A);
    expect(updated.draft.storage_scope_id).toBe(SCOPE_A);
    expect(updated.draft.created_at).toBe(TS_1);
    expect(updated.draft.updated_at).toBe(TS_2);
    expect(updated.draft.status).toBe("draft");

    const cleared = await updateSearchFeedbackDraft(
      db,
      {
        feedback_id: "upd-1",
        expected_updated_at: TS_2,
      },
      { now: () => TS_3 },
    );
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.draft.requested_meaning).toBeUndefined();
    expect(cleared.draft.user_description).toBeUndefined();
    db.close();
  });

  it("preserves input_lang/output_lang on V2 update (immutable search provenance)", async () => {
    const db = await openSiralexDb();
    const created = await createSearchFeedbackDraft(
      db,
      makeInput({
        query_raw: "house",
        search_direction: "source_to_target",
        input_lang: "en",
        output_lang: "mnk",
      }),
      { now: () => TS_1, generateFeedbackId: () => "upd-lang-1" },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.draft.schema_version).toBe(SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2);
    expect(
      created.draft.schema_version === SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2
        ? created.draft.input_lang
        : undefined,
    ).toBe("en");
    expect(
      created.draft.schema_version === SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2
        ? created.draft.output_lang
        : undefined,
    ).toBe("mnk");

    const updated = await updateSearchFeedbackDraft(
      db,
      {
        feedback_id: "upd-lang-1",
        expected_updated_at: TS_1,
        requested_meaning: "dwelling",
      },
      { now: () => TS_2 },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.draft.schema_version).toBe(SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2);
    expect(
      updated.draft.schema_version === SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2
        ? updated.draft.input_lang
        : undefined,
    ).toBe("en");
    expect(
      updated.draft.schema_version === SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2
        ? updated.draft.output_lang
        : undefined,
    ).toBe("mnk");
    expect(updated.draft.search_direction).toBe("source_to_target");
    expect(updated.draft.query_raw).toBe("house");
    db.close();
  });

  it("creates V2 drafts and can still list/read manually stored V1 rows", async () => {
    const db = await openSiralexDb();
    const created = await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => "create-v2-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.draft.schema_version).toBe(SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2);

    const v1Row = {
      schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1,
      feedback_id: "legacy-v1-row",
      bundle_id: BUNDLE_A,
      content_sha256: HASH_A,
      storage_scope_id: SCOPE_A,
      query_raw: "maison",
      search_direction: "source_to_target" as const,
      result_state: "no_result" as const,
      result_count: 0,
      created_at: TS_1,
      updated_at: TS_1,
      status: "draft" as const,
    };
    const putTx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readwrite");
    putTx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK).put(v1Row);
    await new Promise<void>((resolve, reject) => {
      putTx.addEventListener("complete", () => resolve());
      putTx.addEventListener("error", () => reject(putTx.error));
    });

    const got = await getSearchFeedbackDraft(db, "legacy-v1-row");
    expect(got?.schema_version).toBe(SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1);
    expect(got && "input_lang" in got).toBe(false);

    const listed = await listSearchFeedbackDrafts(db);
    expect(listed.some((d) => d.feedback_id === "legacy-v1-row")).toBe(true);
    expect(listed.some((d) => d.feedback_id === "create-v2-1")).toBe(true);

    const updatedV1 = await updateSearchFeedbackDraft(
      db,
      {
        feedback_id: "legacy-v1-row",
        expected_updated_at: TS_1,
        requested_meaning: "house",
      },
      { now: () => TS_2 },
    );
    expect(updatedV1.ok).toBe(true);
    if (!updatedV1.ok) return;
    expect(updatedV1.draft.schema_version).toBe(SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1);
    expect("input_lang" in updatedV1.draft).toBe(false);
    expect(updatedV1.draft.requested_meaning).toBe("house");
    db.close();
  });

  it("enforces optimistic concurrency and blocks corrupt/stale/invalid clocks", async () => {
    const db = await openSiralexDb();
    await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => "conc-1",
    });

    const stale = await updateSearchFeedbackDraft(
      db,
      {
        feedback_id: "conc-1",
        expected_updated_at: TS_2,
        requested_meaning: "nope",
      },
      { now: () => TS_3 },
    );
    expect(stale).toEqual({ ok: false, code: "stale_feedback" });

    const sameTs = await updateSearchFeedbackDraft(
      db,
      {
        feedback_id: "conc-1",
        expected_updated_at: TS_1,
        requested_meaning: "x",
      },
      { now: () => TS_1 },
    );
    expect(sameTs).toEqual({ ok: false, code: "invalid_timestamp" });

    const missing = await updateSearchFeedbackDraft(
      db,
      {
        feedback_id: "missing",
        expected_updated_at: TS_1,
      },
      { now: () => TS_2 },
    );
    expect(missing).toEqual({ ok: false, code: "not_found" });

    await putCorruptFeedback(db, "corrupt-upd");
    const corrupt = await updateSearchFeedbackDraft(
      db,
      {
        feedback_id: "corrupt-upd",
        expected_updated_at: TS_1,
        requested_meaning: "x",
      },
      { now: () => TS_2 },
    );
    expect(corrupt).toEqual({ ok: false, code: "invalid_stored_feedback" });

    const badOptional = await updateSearchFeedbackDraft(
      db,
      {
        feedback_id: "conc-1",
        expected_updated_at: TS_1,
        requested_meaning: "",
      },
      { now: () => TS_2 },
    );
    expect(badOptional).toEqual({ ok: false, code: "invalid_input" });

    const aborted = await updateSearchFeedbackDraft(
      db,
      {
        feedback_id: "conc-1",
        expected_updated_at: TS_1,
        requested_meaning: "ok",
      },
      {
        now: () => TS_2,
        afterWriteQueued: async () => {
          throw new Error("forced-abort");
        },
      },
    );
    expect(aborted).toEqual({ ok: false, code: "database_write_failed" });
    const still = await getSearchFeedbackDraft(db, "conc-1");
    expect(still?.updated_at).toBe(TS_1);
    expect(still?.requested_meaning).toBeUndefined();
    db.close();
  });
});

describe("delete", () => {
  it("deletes with optional expected timestamp and blocks stale/corrupt", async () => {
    const db = await openSiralexDb();
    await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => "del-1",
    });

    const stale = await deleteSearchFeedbackDraft(db, "del-1", {
      expectedUpdatedAt: TS_2,
    });
    expect(stale).toEqual({ ok: false, code: "stale_feedback" });

    const deleted = await deleteSearchFeedbackDraft(db, "del-1", {
      expectedUpdatedAt: TS_1,
    });
    expect(deleted).toEqual({ ok: true, deleted: true });
    expect(await getSearchFeedbackDraft(db, "del-1")).toBeUndefined();
    expect(await deleteSearchFeedbackDraft(db, "del-1")).toEqual({
      ok: false,
      code: "not_found",
    });

    await putCorruptFeedback(db, "corrupt-del");
    expect(await deleteSearchFeedbackDraft(db, "corrupt-del")).toEqual({
      ok: false,
      code: "invalid_stored_feedback",
    });
    expect(await countSearchFeedbackDrafts(db)).toBe(1);

    await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => "del-abort",
    });
    const aborted = await deleteSearchFeedbackDraft(
      db,
      "del-abort",
      { expectedUpdatedAt: TS_1 },
      {
        afterDeleteQueued: async () => {
          throw new Error("forced-abort");
        },
      },
    );
    expect(aborted).toEqual({ ok: false, code: "database_write_failed" });
    expect(await getSearchFeedbackDraft(db, "del-abort")).toBeTruthy();
    db.close();
  });
});

describe("lifecycle and isolation", () => {
  it("retains H1 feedback across bundle update and removal", async () => {
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, makeActiveMeta());
    const created = await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => "life-1",
    });
    expect(created.ok).toBe(true);

    await putInstalledBundleMeta(
      db,
      makeActiveMeta({
        storage_scope_id: SCOPE_B,
        expected_content_sha256: HASH_B,
      }),
    );
    const afterUpdate = await getSearchFeedbackDraft(db, "life-1");
    expect(afterUpdate?.content_sha256).toBe(HASH_A);
    expect(afterUpdate?.storage_scope_id).toBe(SCOPE_A);
    expect(afterUpdate?.query_raw).toBe("kùn");

    await deleteBundleData(db, BUNDLE_A);
    const afterRemove = await getSearchFeedbackDraft(db, "life-1");
    expect(afterRemove?.content_sha256).toBe(HASH_A);
    expect(afterRemove?.bundle_id).toBe(BUNDLE_A);
    db.close();
  });

  it("CF2 create/update/delete leave CF1, Learning, query logs, and dictionary unchanged", async () => {
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, makeActiveMeta());
    const tx = db.transaction(
      [STORE_RECORDS, STORE_SEARCH_INDEX, STORE_QUERY_LOGS],
      "readwrite",
    );
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
    tx.objectStore(STORE_QUERY_LOGS).add({
      timestamp_iso: TS_1,
      bundle_id: BUNDLE_A,
      storage_scope_id: SCOPE_A,
      query_raw: "probe",
    });
    await new Promise<void>((resolve, reject) => {
      tx.addEventListener("complete", () => resolve());
      tx.addEventListener("error", () => reject(tx.error));
    });

    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_A,
      storage_scope_id: SCOPE_A,
      display_cache: { headword_latin: "kùn" },
    });
    await createCorrectionDraft(
      db,
      {
        bundle_id: BUNDLE_A,
        ir_id: "lex-1",
        ir_kind: "lexicon_entry",
        content_sha256: HASH_A,
        storage_scope_id: SCOPE_A,
        issue_type: "spelling",
        mode: "problem_report",
        target: { type: "headword" },
        display_snapshot: { headword_latin: "kùn" },
        problem_description: "note",
      },
      { now: () => TS_1, generateDraftId: () => "cf1-iso-1" },
    );

    const before = await snapshotCounts(db);
    const created = await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => "iso-1",
    });
    expect(created.ok).toBe(true);
    const updated = await updateSearchFeedbackDraft(
      db,
      {
        feedback_id: "iso-1",
        expected_updated_at: TS_1,
        user_description: "details",
      },
      { now: () => TS_2 },
    );
    expect(updated.ok).toBe(true);
    const deleted = await deleteSearchFeedbackDraft(db, "iso-1", {
      expectedUpdatedAt: TS_2,
    });
    expect(deleted.ok).toBe(true);
    const after = await snapshotCounts(db);

    for (const key of Object.keys(before)) {
      if (key === STORE_SEARCH_FAILURE_FEEDBACK) {
        expect(after[key]).toBe(0);
        continue;
      }
      expect(after[key]).toBe(before[key]);
    }
    db.close();
  });

  it("full database deletion clears CF2 and reopens at v6", async () => {
    const db = await openSiralexDb();
    await createSearchFeedbackDraft(db, makeInput(), {
      now: () => TS_1,
      generateFeedbackId: () => "wipe-1",
    });
    expect(await countSearchFeedbackDrafts(db)).toBe(1);
    db.close();

    await deleteSiralexDb();
    const reopened = await openSiralexDb();
    expect(reopened.version).toBe(6);
    expect(reopened.objectStoreNames.contains(STORE_SEARCH_FAILURE_FEEDBACK)).toBe(
      true,
    );
    expect(await countSearchFeedbackDrafts(reopened)).toBe(0);
    reopened.close();
  });
});

describe("error class", () => {
  it("exposes SearchFeedbackStoreError", () => {
    const err = new SearchFeedbackStoreError("invalid_feedback_id");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("invalid_feedback_id");
  });
});
