import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  STORE_BUNDLES_REGISTRY,
  STORE_LEARNING_RECORDS,
  STORE_META,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
  deleteSiralexDb,
  getActiveBundleMeta,
  openSiralexDb,
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { appendQueryLog } from "../query_logging/query_log_store";
import {
  getLearningRecord,
  reflectOnLearningRecord,
  saveLearningRecord,
} from "./learning_record_store";
import {
  LEARNING_RECORD_SCHEMA_VERSION,
  LearningRecordNotFoundError,
  type LearningRecordV1,
  type LearningReflectionOutcome,
  type SaveLearningRecordInput,
} from "./learning_record_types";

const BUNDLE = "bundle_ls2i1";
const SCOPE = `${BUNDLE}::sha256:reflect`;
const HASH = "sha256:reflect";
const TS1 = "2026-07-29T20:00:00.000Z";
const TS2 = "2026-07-29T21:00:00.000Z";
const TS3 = "2026-07-29T22:00:00.000Z";

function makeMeta(): ActiveBundleMeta {
  return {
    bundle_id: BUNDLE,
    storage_scope_id: SCOPE,
    expected_content_sha256: HASH,
    manifest_schema_version: "bundle_manifest_v1",
    record_schema_id: "normalized_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "REPLACE_ALL",
    reconciliation_action: "REPLACE_ALL",
    imported_at_iso: "2026-07-29T00:00:00.000Z",
  };
}

function makeSaveInput(overrides: Partial<SaveLearningRecordInput> = {}): SaveLearningRecordInput {
  return {
    bundle_id: BUNDLE,
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: SCOPE,
    display_cache: {
      headword_latin: "bólo",
      headword_nko: "ߓߟߏ",
      gloss_short: "main",
    },
    ...overrides,
  };
}

function immutableSlice(record: LearningRecordV1) {
  return {
    schema_version: record.schema_version,
    bundle_id: record.bundle_id,
    ir_id: record.ir_id,
    ir_kind: record.ir_kind,
    content_sha256: record.content_sha256,
    storage_scope_id: record.storage_scope_id,
    created_at: record.created_at,
    display_cache: structuredClone(record.display_cache),
  };
}

async function countStore(db: IDBDatabase, storeName: string): Promise<number> {
  const tx = db.transaction(storeName, "readonly");
  return await new Promise((resolve, reject) => {
    const req = tx.objectStore(storeName).count();
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

async function putRawLearningRecord(db: IDBDatabase, record: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_LEARNING_RECORDS, "readwrite");
    tx.objectStore(STORE_LEARNING_RECORDS).put(record);
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function putDictionaryStub(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDS, STORE_SEARCH_INDEX], "readwrite");
    tx.objectStore(STORE_RECORDS).put({
      bundle_id: SCOPE,
      ir_id: "dict-1",
      ir_kind: "lexicon_entry",
      source_id: "s",
      norm_version: "norm_v3",
      preferred_form: "x",
      variant_forms: [],
      search_keys: {},
      display: { headword_latin: "x" },
    });
    tx.objectStore(STORE_SEARCH_INDEX).put({
      bundle_id: SCOPE,
      key_type: "casefold",
      key: "x",
      ir_ids: ["dict-1"],
    });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

describe("LS2I1 reflectOnLearningRecord", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // ignore
    }
  });

  const transitions: Array<{
    name: string;
    seed: Partial<LearningRecordV1>;
    outcome: LearningReflectionOutcome;
    reviewedAt: string;
    expectedCount: number;
  }> = [
    {
      name: "never-reviewed still_learning → still_learning",
      seed: { status: "still_learning", last_reviewed: null, review_count: 0 },
      outcome: "still_learning",
      reviewedAt: TS1,
      expectedCount: 1,
    },
    {
      name: "never-reviewed still_learning → remembered",
      seed: { status: "still_learning", last_reviewed: null, review_count: 0 },
      outcome: "remembered",
      reviewedAt: TS1,
      expectedCount: 1,
    },
    {
      name: "reviewed still_learning → still_learning",
      seed: { status: "still_learning", last_reviewed: TS1, review_count: 1 },
      outcome: "still_learning",
      reviewedAt: TS2,
      expectedCount: 2,
    },
    {
      name: "reviewed still_learning → remembered",
      seed: { status: "still_learning", last_reviewed: TS1, review_count: 1 },
      outcome: "remembered",
      reviewedAt: TS2,
      expectedCount: 2,
    },
    {
      name: "reviewed remembered → remembered",
      seed: { status: "remembered", last_reviewed: TS1, review_count: 2 },
      outcome: "remembered",
      reviewedAt: TS2,
      expectedCount: 3,
    },
    {
      name: "reviewed remembered → still_learning",
      seed: { status: "remembered", last_reviewed: TS1, review_count: 2 },
      outcome: "still_learning",
      reviewedAt: TS2,
      expectedCount: 3,
    },
  ];

  for (const caseRow of transitions) {
    it(caseRow.name, async () => {
      const db = await openSiralexDb();
      const saved = await saveLearningRecord(db, makeSaveInput());
      const seeded: LearningRecordV1 = {
        ...saved,
        ...caseRow.seed,
        schema_version: LEARNING_RECORD_SCHEMA_VERSION,
      };
      await putRawLearningRecord(db, seeded);
      const before = (await getLearningRecord(db, BUNDLE, "lex-1"))!;
      const beforeImmutable = immutableSlice(before);

      const updated = await reflectOnLearningRecord(
        db,
        BUNDLE,
        "lex-1",
        caseRow.outcome,
        caseRow.reviewedAt,
      );

      expect(updated.status).toBe(caseRow.outcome);
      expect(updated.last_reviewed).toBe(caseRow.reviewedAt);
      expect(updated.review_count).toBe(caseRow.expectedCount);
      expect(immutableSlice(updated)).toEqual(beforeImmutable);

      const reread = await getLearningRecord(db, BUNDLE, "lex-1");
      expect(reread).toEqual(updated);
      db.close();
    });
  }

  it("persists across DB reopen", async () => {
    let db = await openSiralexDb();
    await saveLearningRecord(db, makeSaveInput());
    await reflectOnLearningRecord(db, BUNDLE, "lex-1", "remembered", TS1);
    db.close();

    db = await openSiralexDb();
    const again = await getLearningRecord(db, BUNDLE, "lex-1");
    expect(again?.status).toBe("remembered");
    expect(again?.last_reviewed).toBe(TS1);
    expect(again?.review_count).toBe(1);
    db.close();
  });

  it("concurrent successful reflections both increment", async () => {
    const db = await openSiralexDb();
    const saved = await saveLearningRecord(db, makeSaveInput());
    await putRawLearningRecord(db, {
      ...saved,
      status: "still_learning",
      last_reviewed: TS1,
      review_count: 2,
    });

    const [a, b] = await Promise.all([
      reflectOnLearningRecord(db, BUNDLE, "lex-1", "still_learning", TS2),
      reflectOnLearningRecord(db, BUNDLE, "lex-1", "remembered", TS3),
    ]);

    expect(a.review_count + b.review_count).toBeGreaterThanOrEqual(3 + 4);
    const final = (await getLearningRecord(db, BUNDLE, "lex-1"))!;
    expect(final.review_count).toBe(4);
    expect(["still_learning", "remembered"]).toContain(final.status);
    expect([TS2, TS3]).toContain(final.last_reviewed);
    db.close();
  });

  it("each API call increments once (no silent merge)", async () => {
    const db = await openSiralexDb();
    await saveLearningRecord(db, makeSaveInput());
    await reflectOnLearningRecord(db, BUNDLE, "lex-1", "still_learning", TS1);
    await reflectOnLearningRecord(db, BUNDLE, "lex-1", "still_learning", TS2);
    const row = await getLearningRecord(db, BUNDLE, "lex-1");
    expect(row?.review_count).toBe(2);
    db.close();
  });

  it("throws LearningRecordNotFoundError and does not create", async () => {
    const db = await openSiralexDb();
    await expect(
      reflectOnLearningRecord(db, BUNDLE, "missing", "remembered", TS1),
    ).rejects.toBeInstanceOf(LearningRecordNotFoundError);

    expect(await getLearningRecord(db, BUNDLE, "missing")).toBeUndefined();
    expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(0);
    db.close();
  });

  it("rejects invalid outcome / timestamp / empty identity without mutation", async () => {
    const db = await openSiralexDb();
    const saved = await saveLearningRecord(db, makeSaveInput());

    await expect(
      reflectOnLearningRecord(db, BUNDLE, "lex-1", "mastered" as LearningReflectionOutcome, TS1),
    ).rejects.toThrow(/outcome/);
    await expect(
      reflectOnLearningRecord(db, BUNDLE, "lex-1", "remembered", "yesterday"),
    ).rejects.toThrow(/reviewedAt|ISO/);
    await expect(
      reflectOnLearningRecord(db, "  ", "lex-1", "remembered", TS1),
    ).rejects.toThrow(/bundleId/);
    await expect(
      reflectOnLearningRecord(db, BUNDLE, "", "remembered", TS1),
    ).rejects.toThrow(/irId/);

    expect(await getLearningRecord(db, BUNDLE, "lex-1")).toEqual(saved);
    db.close();
  });

  it("rejects malformed stored record / bad counts without mutation", async () => {
    const db = await openSiralexDb();
    const saved = await saveLearningRecord(db, makeSaveInput());

    await putRawLearningRecord(db, { ...saved, review_count: -1 });
    await expect(
      reflectOnLearningRecord(db, BUNDLE, "lex-1", "remembered", TS1),
    ).rejects.toThrow(/review_count/);
    expect((await getLearningRecord(db, BUNDLE, "lex-1"))!.review_count).toBe(-1);

    await putRawLearningRecord(db, { ...saved, review_count: 1.5 });
    await expect(
      reflectOnLearningRecord(db, BUNDLE, "lex-1", "remembered", TS1),
    ).rejects.toThrow(/review_count/);
    expect((await getLearningRecord(db, BUNDLE, "lex-1"))!.review_count).toBe(1.5);

    await putRawLearningRecord(db, { ...saved, review_count: Number.MAX_SAFE_INTEGER + 1 });
    await expect(
      reflectOnLearningRecord(db, BUNDLE, "lex-1", "remembered", TS1),
    ).rejects.toThrow(/review_count|safe/);
    expect((await getLearningRecord(db, BUNDLE, "lex-1"))!.review_count).toBe(
      Number.MAX_SAFE_INTEGER + 1,
    );

    await putRawLearningRecord(db, { ...saved, review_count: Number.MAX_SAFE_INTEGER });
    await expect(
      reflectOnLearningRecord(db, BUNDLE, "lex-1", "remembered", TS1),
    ).rejects.toThrow(/increment|safe/);
    expect((await getLearningRecord(db, BUNDLE, "lex-1"))!.review_count).toBe(
      Number.MAX_SAFE_INTEGER,
    );

    await putRawLearningRecord(db, { ...saved, created_at: "not-a-date" });
    await expect(
      reflectOnLearningRecord(db, BUNDLE, "lex-1", "remembered", TS1),
    ).rejects.toThrow(/created_at/);
    expect((await getLearningRecord(db, BUNDLE, "lex-1"))!.created_at).toBe("not-a-date");
    db.close();
  });

  it("does not mutate dictionary, search, registry, query logs, or active meta", async () => {
    const db = await openSiralexDb();
    await setActiveBundleMeta(db, makeMeta());
    await putDictionaryStub(db);
    await appendQueryLog(db, {
      query_raw: "main",
      query_normalized_keys: {
        casefold: ["main"],
        diacritics_insensitive: ["main"],
        punct_stripped: ["main"],
        nospace: ["main"],
      },
      direction: "source_to_target",
      ladder_level_hit: "casefold",
      ir_ids_count: 1,
      bundle_id: BUNDLE,
      storage_scope_id: SCOPE,
      norm_version: "norm_v3",
      app_version: "dev-test",
      timestamp_iso: TS1,
      logging_enabled: true,
    });
    await saveLearningRecord(db, makeSaveInput());

    const before = {
      records: await countStore(db, STORE_RECORDS),
      search: await countStore(db, STORE_SEARCH_INDEX),
      registry: await countStore(db, STORE_BUNDLES_REGISTRY),
      logs: await countStore(db, STORE_QUERY_LOGS),
      meta: await getActiveBundleMeta(db),
    };

    await reflectOnLearningRecord(db, BUNDLE, "lex-1", "remembered", TS2);

    expect(await countStore(db, STORE_RECORDS)).toBe(before.records);
    expect(await countStore(db, STORE_SEARCH_INDEX)).toBe(before.search);
    expect(await countStore(db, STORE_BUNDLES_REGISTRY)).toBe(before.registry);
    expect(await countStore(db, STORE_QUERY_LOGS)).toBe(before.logs);
    expect(await getActiveBundleMeta(db)).toEqual(before.meta);
    expect(await countStore(db, STORE_META)).toBeGreaterThan(0);
    db.close();
  });

  it("works without active bundle (identity-only personal update)", async () => {
    const db = await openSiralexDb();
    await saveLearningRecord(db, makeSaveInput());
    expect(await getActiveBundleMeta(db)).toBeUndefined();

    const updated = await reflectOnLearningRecord(db, BUNDLE, "lex-1", "remembered", TS1);
    expect(updated.status).toBe("remembered");
    expect(updated.review_count).toBe(1);
    db.close();
  });
});
