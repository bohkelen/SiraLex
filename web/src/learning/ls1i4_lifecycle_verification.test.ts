import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  STORE_BUNDLES_REGISTRY,
  STORE_LEARNING_RECORDS,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
  deleteBundleData,
  deleteSiralexDb,
  getActiveBundleId,
  openSiralexDb,
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { appendQueryLog } from "../query_logging/query_log_store";
import { buildDisplayCache } from "./build_display_cache";
import { createEntryLearningSession } from "./entry_learning_session";
import { resolveLearningRecordForUi } from "./learning_record_resolve";
import {
  getLearningRecord,
  isLearningRecordSaved,
  listLearningRecordsByBundle,
  removeLearningRecord,
  saveLearningRecord,
} from "./learning_record_store";
import {
  buildSavedVocabularyRowVm,
  createSavedVocabularySession,
  type SavedVocabularyModel,
} from "./saved_vocabulary_session";
import type { EnrichedRecord } from "../types/records";

const BUNDLE_A = "bundle_ls1i4_a";
const BUNDLE_B = "bundle_ls1i4_b";
const HASH_1 = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
const HASH_2 = "sha256:2222222222222222222222222222222222222222222222222222222222222222";
const SCOPE_1 = `${BUNDLE_A}::${HASH_1}`;
const SCOPE_2 = `${BUNDLE_A}::${HASH_2}`;
const SCOPE_B = `${BUNDLE_B}::${HASH_1}`;

function makeMeta(
  bundleId: string,
  scope: string,
  hash: string,
  overrides: Partial<ActiveBundleMeta> = {},
): ActiveBundleMeta {
  return {
    bundle_id: bundleId,
    storage_scope_id: scope,
    expected_content_sha256: hash,
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

function makeLexicon(irId: string, headword: string, gloss: string): EnrichedRecord {
  return {
    ir_id: irId,
    ir_kind: "lexicon_entry",
    source_id: "s",
    norm_version: "norm_v3",
    preferred_form: headword,
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: headword,
      senses: [{ gloss_fr: gloss }],
    },
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

async function putRecord(db: IDBDatabase, scope: string, record: EnrichedRecord): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...record, bundle_id: scope });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function putSearchStub(db: IDBDatabase, scope: string, key: string, irId: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SEARCH_INDEX, "readwrite");
    tx.objectStore(STORE_SEARCH_INDEX).put({
      bundle_id: scope,
      key_type: "casefold",
      key,
      ir_ids: [irId],
    });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function snapshotIsolation(db: IDBDatabase) {
  return {
    records: await countStore(db, STORE_RECORDS),
    search: await countStore(db, STORE_SEARCH_INDEX),
    registry: await countStore(db, STORE_BUNDLES_REGISTRY),
    logs: await countStore(db, STORE_QUERY_LOGS),
    learning: await countStore(db, STORE_LEARNING_RECORDS),
  };
}

describe("LS1I4 lifecycle verification", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      await new Promise((r) => setTimeout(r, 20));
      try {
        await deleteSiralexDb();
      } catch {
        // fine if still missing/blocked in fake-indexeddb edge cases
      }
    }
  }, 20_000);

  it("A — Save survives reopen with unchanged personal fields", async () => {
    let db = await openSiralexDb();
    const entry = makeLexicon("lex-1", "kùn", "tête");
    await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
    await putRecord(db, SCOPE_1, entry);
    const saved = await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_1,
      storage_scope_id: SCOPE_1,
      display_cache: buildDisplayCache(entry),
    });
    db.close();

    db = await openSiralexDb();
    const reopened = await getLearningRecord(db, BUNDLE_A, "lex-1");
    expect(reopened).toEqual(saved);
    const resolution = await resolveLearningRecordForUi(
      db,
      reopened!,
      makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
    );
    expect(resolution.state).toBe("resolved");
    db.close();
  });

  it("B — same-bundle update with matching ir_id re-resolves live content without mutating Learning Record", async () => {
    const db = await openSiralexDb();
    const v1 = makeLexicon("lex-1", "old-hw", "old-gloss");
    await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
    await putRecord(db, SCOPE_1, v1);
    const first = await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_1,
      storage_scope_id: SCOPE_1,
      display_cache: buildDisplayCache(v1),
    });

    const v2 = makeLexicon("lex-1", "new-hw", "new-gloss");
    await putRecord(db, SCOPE_2, v2);
    const updatedMeta = makeMeta(BUNDLE_A, SCOPE_2, HASH_2);
    await setActiveBundleMeta(db, updatedMeta);

    const resolution = await resolveLearningRecordForUi(db, first, updatedMeta);
    expect(resolution.state).toBe("resolved");
    if (resolution.state === "resolved") {
      expect(resolution.liveEntry.display).toMatchObject({ headword_latin: "new-hw" });
    }
    const stored = await getLearningRecord(db, BUNDLE_A, "lex-1");
    expect(stored).toEqual(first);
    expect(stored!.content_sha256).toBe(HASH_1);
    expect(stored!.display_cache.headword_latin).toBe("old-hw");
    expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(1);
    db.close();
  });

  it("C — same-bundle update with missing ir_id retains soft orphan", async () => {
    const db = await openSiralexDb();
    const v1 = makeLexicon("lex-gone", "ghost", "cache-gloss");
    await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
    await putRecord(db, SCOPE_1, v1);
    const first = await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-gone",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_1,
      storage_scope_id: SCOPE_1,
      display_cache: buildDisplayCache(v1),
    });

    const updatedMeta = makeMeta(BUNDLE_A, SCOPE_2, HASH_2);
    await setActiveBundleMeta(db, updatedMeta);
    // SCOPE_2 has no lex-gone

    expect(await getLearningRecord(db, BUNDLE_A, "lex-gone")).toEqual(first);
    const resolution = await resolveLearningRecordForUi(db, first, updatedMeta);
    expect(resolution).toMatchObject({ state: "unresolved", reason: "entry_missing" });
    const row = buildSavedVocabularyRowVm(resolution);
    expect(row.state).toBe("unresolved");
    if (row.state === "unresolved") {
      expect(row.primaryText).toBe("ghost");
      expect(row.secondaryText).toBe("cache-gloss");
    }

    const updates: SavedVocabularyModel[] = [];
    const session = createSavedVocabularySession({
      getActiveMeta: () => updatedMeta,
      openDb: async () => db,
      isCurrent: () => true,
      onUpdate: (m) => updates.push(m),
      confirmRemove: () => true,
    });
    await session.load();
    expect(updates.at(-1)?.surface).toBe("populated");
    expect(await session.remove(BUNDLE_A, "lex-gone")).toBe("ok");
    expect(await isLearningRecordSaved(db, BUNDLE_A, "lex-gone")).toBe(false);
    db.close();
  });

  it("D — bundle removal does not cascade-delete Learning Records", async () => {
    const db = await openSiralexDb();
    const entry = makeLexicon("lex-1", "kùn", "tête");
    await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
    await putRecord(db, SCOPE_1, entry);
    await putSearchStub(db, SCOPE_1, "kun", "lex-1");
    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_1,
      storage_scope_id: SCOPE_1,
      display_cache: buildDisplayCache(entry),
    });

    await deleteBundleData(db, BUNDLE_A);
    expect(await countStore(db, STORE_RECORDS)).toBe(0);
    expect(await countStore(db, STORE_SEARCH_INDEX)).toBe(0);
    expect(await getActiveBundleId(db)).toBeUndefined();
    expect(await isLearningRecordSaved(db, BUNDLE_A, "lex-1")).toBe(true);

    const lr = (await getLearningRecord(db, BUNDLE_A, "lex-1"))!;
    expect(await resolveLearningRecordForUi(db, lr, undefined)).toMatchObject({
      state: "unresolved",
      reason: "no_active_bundle",
    });

    const updates: SavedVocabularyModel[] = [];
    const session = createSavedVocabularySession({
      getActiveMeta: () => undefined,
      openDb: async () => db,
      isCurrent: () => true,
      onUpdate: (m) => updates.push(m),
      confirmRemove: () => true,
    });
    await session.load();
    expect(updates.at(-1)?.surface).toBe("unavailable");
    db.close();
  });

  it("E — reinstall same logical bundle re-resolves retained Learning Record without duplicate or cache refresh", async () => {
    const db = await openSiralexDb();
    const entry = makeLexicon("lex-1", "first", "g1");
    await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
    await putRecord(db, SCOPE_1, entry);
    const first = await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_1,
      storage_scope_id: SCOPE_1,
      display_cache: buildDisplayCache(entry),
    });
    await deleteBundleData(db, BUNDLE_A);

    const reinstalled = makeLexicon("lex-1", "second", "g2");
    const meta2 = makeMeta(BUNDLE_A, SCOPE_2, HASH_2);
    await setActiveBundleMeta(db, meta2);
    await putRecord(db, SCOPE_2, reinstalled);

    const resolution = await resolveLearningRecordForUi(db, first, meta2);
    expect(resolution.state).toBe("resolved");
    if (resolution.state === "resolved") {
      expect(resolution.liveEntry.display).toMatchObject({ headword_latin: "second" });
    }
    const again = await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_2,
      storage_scope_id: SCOPE_2,
      display_cache: buildDisplayCache(reinstalled),
    });
    expect(again).toEqual(first);
    expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(1);
    expect(again.display_cache.headword_latin).toBe("first");
    db.close();
  });

  it("F — Saved Vocabulary lists only the active logical bundle", async () => {
    const db = await openSiralexDb();
    const a = makeLexicon("lex-a", "a", "ga");
    const b = makeLexicon("lex-b", "b", "gb");
    await putRecord(db, SCOPE_1, a);
    await putRecord(db, SCOPE_B, b);
    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-a",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_1,
      storage_scope_id: SCOPE_1,
      display_cache: buildDisplayCache(a),
    });
    await saveLearningRecord(db, {
      bundle_id: BUNDLE_B,
      ir_id: "lex-b",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_1,
      storage_scope_id: SCOPE_B,
      display_cache: buildDisplayCache(b),
    });

    let active = makeMeta(BUNDLE_A, SCOPE_1, HASH_1);
    await setActiveBundleMeta(db, active);
    const updatesA: SavedVocabularyModel[] = [];
    const sessionA = createSavedVocabularySession({
      getActiveMeta: () => active,
      openDb: async () => db,
      isCurrent: () => true,
      onUpdate: (m) => updatesA.push(m),
      confirmRemove: () => true,
    });
    await sessionA.load();
    const lastA = updatesA.at(-1)!;
    expect(lastA.surface).toBe("populated");
    if (lastA.surface === "populated") {
      expect(lastA.rows.map((r) => r.ir_id)).toEqual(["lex-a"]);
    }

    active = makeMeta(BUNDLE_B, SCOPE_B, HASH_1);
    await setActiveBundleMeta(db, active);
    const updatesB: SavedVocabularyModel[] = [];
    const sessionB = createSavedVocabularySession({
      getActiveMeta: () => active,
      openDb: async () => db,
      isCurrent: () => true,
      onUpdate: (m) => updatesB.push(m),
      confirmRemove: () => true,
    });
    await sessionB.load();
    const lastB = updatesB.at(-1)!;
    expect(lastB.surface).toBe("populated");
    if (lastB.surface === "populated") {
      expect(lastB.rows.map((r) => r.ir_id)).toEqual(["lex-b"]);
    }
    expect(await listLearningRecordsByBundle(db, BUNDLE_A)).toHaveLength(1);
    expect(await listLearningRecordsByBundle(db, BUNDLE_B)).toHaveLength(1);
    db.close();
  });

  it("isolation — Learning ops do not mutate dictionary/search/registry/query_logs", async () => {
    const db = await openSiralexDb();
    const entry = makeLexicon("lex-1", "kùn", "tête");
    await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
    await putRecord(db, SCOPE_1, entry);
    await putSearchStub(db, SCOPE_1, "kun", "lex-1");
    await appendQueryLog(db, {
      query_raw: "seed",
      query_normalized_keys: {
        casefold: ["seed"],
        diacritics_insensitive: ["seed"],
        punct_stripped: ["seed"],
        nospace: ["seed"],
      },
      direction: "source_to_target",
      ladder_level_hit: "casefold",
      ir_ids_count: 0,
      bundle_id: BUNDLE_A,
      storage_scope_id: SCOPE_1,
      norm_version: "norm_v3",
      app_version: "dev-test",
      timestamp_iso: "2026-07-29T12:00:00.000Z",
      logging_enabled: true,
    });

    const before = await snapshotIsolation(db);
    const input = {
      bundle_id: BUNDLE_A,
      ir_id: "lex-1" as const,
      ir_kind: "lexicon_entry" as const,
      content_sha256: HASH_1,
      storage_scope_id: SCOPE_1,
      display_cache: buildDisplayCache(entry),
    };
    const saved = await saveLearningRecord(db, input);
    await saveLearningRecord(db, {
      ...input,
      content_sha256: HASH_2,
      display_cache: { headword_latin: "changed" },
    });
    expect(await isLearningRecordSaved(db, BUNDLE_A, "lex-1")).toBe(true);
    await resolveLearningRecordForUi(db, saved, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
    const updates: SavedVocabularyModel[] = [];
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
      openDb: async () => db,
      isCurrent: () => true,
      onUpdate: (m) => updates.push(m),
      confirmRemove: () => true,
    });
    await session.load();
    // Learning ops must not change dictionary/search/registry/log counts.
    const mid = await snapshotIsolation(db);
    expect(mid.records).toBe(before.records);
    expect(mid.search).toBe(before.search);
    expect(mid.registry).toBe(before.registry);
    expect(mid.logs).toBe(before.logs);

    await appendQueryLog(db, {
      query_raw: "after",
      query_normalized_keys: {
        casefold: ["after"],
        diacritics_insensitive: ["after"],
        punct_stripped: ["after"],
        nospace: ["after"],
      },
      direction: "source_to_target",
      ladder_level_hit: "none",
      ir_ids_count: 0,
      bundle_id: BUNDLE_A,
      storage_scope_id: SCOPE_1,
      norm_version: "norm_v3",
      app_version: "dev-test",
      timestamp_iso: "2026-07-29T12:01:00.000Z",
      logging_enabled: true,
    });
    expect(await getLearningRecord(db, BUNDLE_A, "lex-1")).toEqual(saved);
    expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(1);
    expect(await countStore(db, STORE_RECORDS)).toBe(before.records);
    expect(await countStore(db, STORE_SEARCH_INDEX)).toBe(before.search);
    db.close();
  });

  it("integrity — full DB delete wipes Learning Records; no cross-bundle resolve", async () => {
    let db = await openSiralexDb();
    const entry = makeLexicon("lex-1", "kùn", "tête");
    await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
    await putRecord(db, SCOPE_1, entry);
    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_1,
      storage_scope_id: SCOPE_1,
      display_cache: buildDisplayCache(entry),
    });
    db.close();
    await new Promise((r) => setTimeout(r, 10));
    await deleteSiralexDb();

    db = await openSiralexDb();
    expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(0);

    const lr = {
      schema_version: "learning_record_v1" as const,
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry" as const,
      content_sha256: HASH_1,
      storage_scope_id: SCOPE_1,
      status: "still_learning" as const,
      created_at: "2026-07-29T12:00:00.000Z",
      display_cache: { headword_latin: "kùn" },
      last_reviewed: null,
      review_count: 0,
    };
    await putRecord(db, SCOPE_B, entry);
    const mismatch = await resolveLearningRecordForUi(db, lr, makeMeta(BUNDLE_B, SCOPE_B, HASH_1));
    expect(mismatch).toMatchObject({ state: "unresolved", reason: "bundle_mismatch" });
    db.close();
  }, 15_000);

  it("failure — entry saved-state lookup failure maps to error without writing", async () => {
    const states: string[] = [];
    const session = createEntryLearningSession({
      record: makeLexicon("lex-1", "kùn", "tête"),
      getActiveMeta: () => makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
      openDb: async () => {
        throw new Error("lookup fail");
      },
      isCurrent: () => true,
      setState: (s) => states.push(s),
    });
    await session.loadInitial();
    expect(states.at(-1)).toBe("error_not_saved");
  });

  it("performance sanity — list load uses one indexed read and resolution does not write Learning Records", async () => {
    const db = await openSiralexDb();
    await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
    for (let i = 0; i < 5; i += 1) {
      const entry = makeLexicon(`lex-${i}`, `hw-${i}`, `g-${i}`);
      await putRecord(db, SCOPE_1, entry);
      await saveLearningRecord(db, {
        bundle_id: BUNDLE_A,
        ir_id: `lex-${i}`,
        ir_kind: "lexicon_entry",
        content_sha256: HASH_1,
        storage_scope_id: SCOPE_1,
        display_cache: buildDisplayCache(entry),
      });
    }
    const before = await countStore(db, STORE_LEARNING_RECORDS);
    const listed = await listLearningRecordsByBundle(db, BUNDLE_A);
    expect(listed).toHaveLength(5);
    const meta = makeMeta(BUNDLE_A, SCOPE_1, HASH_1);
    await Promise.all(listed.map((lr) => resolveLearningRecordForUi(db, lr, meta)));
    expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(before);
    db.close();
  });
});
