import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  LEARNING_RECORD_INDEX_BY_BUNDLE_ID,
  SIRALEX_DB_NAME,
  SIRALEX_DB_VERSION,
  STORE_BUNDLES_REGISTRY,
  STORE_LEARNING_RECORDS,
  STORE_META,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
  deleteBundleData,
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { appendQueryLog } from "../query_logging/query_log_store";
import type { EnrichedRecord } from "../types/records";
import { buildDisplayCache, GLOSS_SHORT_MAX_CHARS } from "./build_display_cache";
import { resolveLearningRecordForUi } from "./learning_record_resolve";
import {
  getLearningRecord,
  isLearningRecordSaved,
  listLearningRecordsByBundle,
  removeLearningRecord,
  saveLearningRecord,
} from "./learning_record_store";
import type { SaveLearningRecordInput } from "./learning_record_types";
import { LEARNING_RECORD_SCHEMA_VERSION, validateSaveLearningRecordInput } from "./learning_record_types";

const BUNDLE_A = "bundle_learning_a";
const BUNDLE_B = "bundle_learning_b";
const SCOPE_A = `${BUNDLE_A}::sha256:aaa`;
const SCOPE_A2 = `${BUNDLE_A}::sha256:bbb`;
const HASH_A = "sha256:aaa";
const HASH_A2 = "sha256:bbb";

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

function makeLexiconEntry(overrides: Partial<EnrichedRecord> = {}): EnrichedRecord {
  return {
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    source_id: "src-1",
    norm_version: "norm_v3",
    preferred_form: "kùn",
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: "kùn",
      headword_nko_provided: "ߞߎ߲",
      senses: [{ sense_num: 1, gloss_fr: "tête", gloss_en: "head" }],
    },
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
    display_cache: {
      headword_latin: "kùn",
      headword_nko: "ߞߎ߲",
      gloss_short: "tête",
    },
    ...overrides,
  };
}

async function countStoreRows(db: IDBDatabase, storeName: string): Promise<number> {
  const tx = db.transaction(storeName, "readonly");
  return await new Promise((resolve, reject) => {
    const req = tx.objectStore(storeName).count();
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

async function putDictionaryRecord(
  db: IDBDatabase,
  storageScopeId: string,
  record: EnrichedRecord,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({
      ...record,
      bundle_id: storageScopeId,
    });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function openLegacyV3DbWithData(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(SIRALEX_DB_NAME, 3);
    req.addEventListener("upgradeneeded", () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const records = db.createObjectStore(STORE_RECORDS, { keyPath: ["bundle_id", "ir_id"] });
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
    });
    req.addEventListener("success", () => {
      const db = req.result;
      const tx = db.transaction(
        [STORE_META, STORE_RECORDS, STORE_SEARCH_INDEX, STORE_BUNDLES_REGISTRY],
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

describe("buildDisplayCache", () => {
  it("builds headword, nko, and French gloss preference", () => {
    const cache = buildDisplayCache(makeLexiconEntry());
    expect(cache).toEqual({
      headword_latin: "kùn",
      headword_nko: "ߞߎ߲",
      gloss_short: "tête",
    });
  });

  it("falls back to English gloss when French is absent", () => {
    const cache = buildDisplayCache(
      makeLexiconEntry({
        display: {
          headword_latin: "sen",
          senses: [{ gloss_en: "foot" }],
        },
      }),
    );
    expect(cache.gloss_short).toBe("foot");
    expect(cache.headword_nko).toBeUndefined();
  });

  it("bounds long glosses for list rows", () => {
    const long = "x".repeat(GLOSS_SHORT_MAX_CHARS + 40);
    const cache = buildDisplayCache(
      makeLexiconEntry({
        display: {
          headword_latin: "long",
          senses: [{ gloss_fr: long }],
        },
      }),
    );
    expect(cache.gloss_short!.length).toBeLessThanOrEqual(GLOSS_SHORT_MAX_CHARS);
    expect(cache.gloss_short!.endsWith("…")).toBe(true);
  });

  it("rejects index mappings", () => {
    expect(() =>
      buildDisplayCache({
        ir_id: "map-1",
        ir_kind: "index_mapping",
        source_id: "s",
        norm_version: "norm_v3",
        preferred_form: "tête",
        variant_forms: [],
        search_keys: {},
        display: { source_term: "tête", source_lang: "fr", target_entries: [] },
      }),
    ).toThrow(/lexicon_entry/);
  });
});

describe("Learning Record persistence API", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine if missing
    }
  });

  it("fresh DB is v4 with learning_records store and by_bundle_id index", async () => {
    expect(SIRALEX_DB_VERSION).toBe(4);
    const db = await openSiralexDb();
    expect(db.version).toBe(4);
    expect(db.objectStoreNames.contains(STORE_LEARNING_RECORDS)).toBe(true);
    const tx = db.transaction(STORE_LEARNING_RECORDS, "readonly");
    const store = tx.objectStore(STORE_LEARNING_RECORDS);
    expect(store.keyPath).toEqual(["bundle_id", "ir_id"]);
    expect(store.indexNames.contains(LEARNING_RECORD_INDEX_BY_BUNDLE_ID)).toBe(true);
    db.close();
  });

  it("v3 → v4 upgrade creates learning_records and preserves existing data", async () => {
    await openLegacyV3DbWithData();
    const db = await openSiralexDb();
    expect(db.version).toBe(4);
    expect(db.objectStoreNames.contains(STORE_LEARNING_RECORDS)).toBe(true);

    const metaTx = db.transaction(STORE_META, "readonly");
    const metaVal = await new Promise((resolve, reject) => {
      const req = metaTx.objectStore(STORE_META).get("legacy-meta-key");
      req.addEventListener("success", () => resolve(req.result));
      req.addEventListener("error", () => reject(req.error));
    });
    expect(metaVal).toBe("keep-me");

    expect(await countStoreRows(db, STORE_RECORDS)).toBe(1);
    expect(await countStoreRows(db, STORE_SEARCH_INDEX)).toBe(1);
    expect(await countStoreRows(db, STORE_BUNDLES_REGISTRY)).toBe(1);
    expect(await countStoreRows(db, STORE_LEARNING_RECORDS)).toBe(0);
    db.close();
  });

  it("saves a valid lexicon Learning Record", async () => {
    const db = await openSiralexDb();
    const saved = await saveLearningRecord(db, makeSaveInput());
    expect(saved.schema_version).toBe(LEARNING_RECORD_SCHEMA_VERSION);
    expect(saved.status).toBe("still_learning");
    expect(saved.last_reviewed).toBeNull();
    expect(saved.review_count).toBe(0);
    expect(saved.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await isLearningRecordSaved(db, BUNDLE_A, "lex-1")).toBe(true);
    expect(await getLearningRecord(db, BUNDLE_A, "lex-1")).toEqual(saved);
    db.close();
  });

  it("rejects invalid save inputs without persisting", async () => {
    const db = await openSiralexDb();
    await expect(saveLearningRecord(db, makeSaveInput({ bundle_id: "  " }))).rejects.toThrow(/bundle_id/);
    await expect(saveLearningRecord(db, makeSaveInput({ ir_id: "" }))).rejects.toThrow(/ir_id/);
    await expect(
      saveLearningRecord(db, makeSaveInput({ content_sha256: "" })),
    ).rejects.toThrow(/content_sha256/);
    await expect(
      saveLearningRecord(db, makeSaveInput({ storage_scope_id: "" })),
    ).rejects.toThrow(/storage_scope_id/);
    await expect(
      saveLearningRecord(
        db,
        makeSaveInput({ display_cache: { headword_latin: "" } }),
      ),
    ).rejects.toThrow(/headword_latin/);
    expect(await countStoreRows(db, STORE_LEARNING_RECORDS)).toBe(0);
    db.close();
  });

  it("rejects index_mapping kinds on save input validation", () => {
    expect(() =>
      validateSaveLearningRecordInput({
        ...makeSaveInput(),
        ir_kind: "index_mapping",
      }),
    ).toThrow(/lexicon_entry/);
  });

  it("repeated save is idempotent and preserves original fields", async () => {
    const db = await openSiralexDb();
    const first = await saveLearningRecord(db, makeSaveInput());
    const second = await saveLearningRecord(
      db,
      makeSaveInput({
        content_sha256: HASH_A2,
        storage_scope_id: SCOPE_A2,
        display_cache: { headword_latin: "changed", gloss_short: "other" },
      }),
    );
    expect(second).toEqual(first);
    expect(second.content_sha256).toBe(HASH_A);
    expect(second.display_cache.headword_latin).toBe("kùn");
    expect(second.status).toBe("still_learning");
    expect(second.review_count).toBe(0);
    expect(await countStoreRows(db, STORE_LEARNING_RECORDS)).toBe(1);
    db.close();
  });

  it("lists by logical bundle_id with newest created_at first", async () => {
    const db = await openSiralexDb();
    const older = await saveLearningRecord(db, makeSaveInput({ ir_id: "lex-old" }));
    // Ensure distinct ISO timestamps across creates.
    await new Promise((r) => setTimeout(r, 5));
    const newer = await saveLearningRecord(db, makeSaveInput({ ir_id: "lex-new" }));
    await saveLearningRecord(
      db,
      makeSaveInput({ bundle_id: BUNDLE_B, ir_id: "lex-other", storage_scope_id: `${BUNDLE_B}::sha256:x` }),
    );

    const listed = await listLearningRecordsByBundle(db, BUNDLE_A);
    expect(listed.map((r) => r.ir_id)).toEqual(["lex-new", "lex-old"]);
    expect(listed[0]!.created_at >= listed[1]!.created_at).toBe(true);
    expect(listed.some((r) => r.bundle_id === BUNDLE_B)).toBe(false);
    expect(newer.created_at >= older.created_at).toBe(true);
    db.close();
  });

  it("remove present returns true; remove absent returns false", async () => {
    const db = await openSiralexDb();
    await saveLearningRecord(db, makeSaveInput());
    expect(await removeLearningRecord(db, BUNDLE_A, "lex-1")).toBe(true);
    expect(await isLearningRecordSaved(db, BUNDLE_A, "lex-1")).toBe(false);
    expect(await removeLearningRecord(db, BUNDLE_A, "lex-1")).toBe(false);
    db.close();
  });

  it("save/remove do not change dictionary or query-log row counts", async () => {
    const db = await openSiralexDb();
    await putDictionaryRecord(db, SCOPE_A, makeLexiconEntry());
    await appendQueryLog(db, {
      query_raw: "kùn",
      query_normalized_keys: {
        casefold: ["kun"],
        diacritics_insensitive: ["kun"],
        punct_stripped: ["kun"],
        nospace: ["kun"],
      },
      direction: "target_to_source",
      ladder_level_hit: "casefold",
      ir_ids_count: 1,
      bundle_id: BUNDLE_A,
      bundle_version: "1",
      storage_scope_id: SCOPE_A,
      norm_version: "norm_v3",
      app_version: "dev-test",
      timestamp_iso: "2026-07-29T12:00:00.000Z",
      logging_enabled: true,
    });

    const recordsBefore = await countStoreRows(db, STORE_RECORDS);
    const logsBefore = await countStoreRows(db, STORE_QUERY_LOGS);

    await saveLearningRecord(db, makeSaveInput());
    await removeLearningRecord(db, BUNDLE_A, "lex-1");
    await saveLearningRecord(db, makeSaveInput());

    expect(await countStoreRows(db, STORE_RECORDS)).toBe(recordsBefore);
    expect(await countStoreRows(db, STORE_QUERY_LOGS)).toBe(logsBefore);
    db.close();
  });

  it("deleteBundleData leaves Learning Records intact", async () => {
    const db = await openSiralexDb();
    await setActiveBundleMeta(db, makeActiveMeta());
    await putDictionaryRecord(db, SCOPE_A, makeLexiconEntry());
    await saveLearningRecord(db, makeSaveInput());

    await deleteBundleData(db, BUNDLE_A);

    expect(await countStoreRows(db, STORE_RECORDS)).toBe(0);
    expect(await getLearningRecord(db, BUNDLE_A, "lex-1")).toMatchObject({
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
    });
    db.close();
  });

  it("query-log writes do not alter Learning Records", async () => {
    const db = await openSiralexDb();
    const saved = await saveLearningRecord(db, makeSaveInput());
    await appendQueryLog(db, {
      query_raw: "x",
      query_normalized_keys: {
        casefold: ["x"],
        diacritics_insensitive: ["x"],
        punct_stripped: ["x"],
        nospace: ["x"],
      },
      direction: "source_to_target",
      ladder_level_hit: "none",
      ir_ids_count: 0,
      bundle_id: BUNDLE_A,
      storage_scope_id: SCOPE_A,
      norm_version: "norm_v3",
      app_version: "dev-test",
      timestamp_iso: "2026-07-29T12:01:00.000Z",
      logging_enabled: true,
    });
    expect(await getLearningRecord(db, BUNDLE_A, "lex-1")).toEqual(saved);
    db.close();
  });

  it("resolves successfully against active storage scope", async () => {
    const db = await openSiralexDb();
    const meta = makeActiveMeta();
    await putInstalledBundleMeta(db, meta);
    await putDictionaryRecord(db, SCOPE_A, makeLexiconEntry());
    const saved = await saveLearningRecord(db, makeSaveInput());

    const result = await resolveLearningRecordForUi(db, saved, meta);
    expect(result.state).toBe("resolved");
    if (result.state === "resolved") {
      expect(result.liveEntry.ir_id).toBe("lex-1");
      expect(result.liveEntry.ir_kind).toBe("lexicon_entry");
      expect(result.learningRecord).toEqual(saved);
    }
    db.close();
  });

  it("resolution: no active bundle", async () => {
    const db = await openSiralexDb();
    const saved = await saveLearningRecord(db, makeSaveInput());
    const result = await resolveLearningRecordForUi(db, saved, undefined);
    expect(result).toMatchObject({ state: "unresolved", reason: "no_active_bundle" });
    db.close();
  });

  it("resolution: bundle mismatch", async () => {
    const db = await openSiralexDb();
    const saved = await saveLearningRecord(db, makeSaveInput());
    const result = await resolveLearningRecordForUi(
      db,
      saved,
      makeActiveMeta({ bundle_id: BUNDLE_B, storage_scope_id: `${BUNDLE_B}::sha256:x` }),
    );
    expect(result).toMatchObject({ state: "unresolved", reason: "bundle_mismatch" });
    db.close();
  });

  it("resolution: missing entry is soft orphan (unresolved)", async () => {
    const db = await openSiralexDb();
    const meta = makeActiveMeta();
    const saved = await saveLearningRecord(db, makeSaveInput());
    const result = await resolveLearningRecordForUi(db, saved, meta);
    expect(result).toMatchObject({ state: "unresolved", reason: "entry_missing" });
    expect(await getLearningRecord(db, BUNDLE_A, "lex-1")).toEqual(saved);
    db.close();
  });

  it("resolution: wrong live kind", async () => {
    const db = await openSiralexDb();
    const meta = makeActiveMeta();
    await putDictionaryRecord(db, SCOPE_A, {
      ir_id: "lex-1",
      ir_kind: "index_mapping",
      source_id: "s",
      norm_version: "norm_v3",
      preferred_form: "tête",
      variant_forms: [],
      search_keys: {},
      display: { source_term: "tête", source_lang: "fr" },
    });
    const saved = await saveLearningRecord(db, makeSaveInput());
    const result = await resolveLearningRecordForUi(db, saved, meta);
    expect(result).toMatchObject({ state: "unresolved", reason: "not_lexicon_entry" });
    db.close();
  });

  it("resolution does not refresh stored display cache", async () => {
    const db = await openSiralexDb();
    const meta = makeActiveMeta();
    await putDictionaryRecord(
      db,
      SCOPE_A,
      makeLexiconEntry({
        display: {
          headword_latin: "kùn-updated",
          senses: [{ gloss_fr: "nouveau" }],
        },
      }),
    );
    const saved = await saveLearningRecord(db, makeSaveInput());
    await resolveLearningRecordForUi(db, saved, meta);
    const after = await getLearningRecord(db, BUNDLE_A, "lex-1");
    expect(after?.display_cache.headword_latin).toBe("kùn");
    expect(after?.display_cache.gloss_short).toBe("tête");
    db.close();
  });
});
