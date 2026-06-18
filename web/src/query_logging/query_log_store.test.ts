import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  SIRALEX_DB_NAME,
  STORE_BUNDLES_REGISTRY,
  STORE_META,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
  deleteSiralexDb,
  getActiveBundleMeta,
  metaGet,
  metaSet,
  openSiralexDb,
  setActiveBundleMeta,
  storeHasData,
} from "../idb/siralex_db";
import {
  appendQueryLog,
  appendQueryLogV2,
  clearAllQueryLogs,
  clearQueryLogsForStorageScope,
  countQueryLogs,
  exportQueryLogsJsonl,
  getQueryLogStats,
  listQueryLogs,
  listRecentQueryLogs,
} from "./query_log_store";
import type { AppendQueryLogInput, AppendQueryLogV2Input } from "./query_log_types";
import {
  QUERY_LOG_CONSENT_VERSION,
  QUERY_LOG_EVENT_V2,
  QUERY_LOG_MAX_AGE_MS,
  QUERY_LOG_MAX_ROWS,
  QUERY_LOG_TOP_IR_IDS_LIMIT,
} from "./query_log_types";

function makeAppendInput(overrides: Partial<AppendQueryLogInput> = {}): AppendQueryLogInput {
  return {
    query_raw: "hello",
    query_normalized_keys: {
      casefold: ["hello"],
      diacritics_insensitive: ["hello"],
      punct_stripped: ["hello"],
      nospace: ["hello"],
    },
    direction: "target_to_source",
    ladder_level_hit: "casefold",
    ir_ids_count: 1,
    bundle_id: "bundle_full_test_aaaaaaaa",
    bundle_version: "1.0.0",
    storage_scope_id: "bundle_full_test_aaaaaaaa::sha256:111",
    norm_version: "norm_v2",
    app_version: "dev-test",
    timestamp_iso: "2026-05-06T00:00:00.000Z",
    logging_enabled: true,
    ...overrides,
  };
}

function makeAppendV2Input(overrides: Partial<AppendQueryLogV2Input> = {}): AppendQueryLogV2Input {
  const resultCount = overrides.result_count ?? 1;
  const matchedKeyType = overrides.matched_key_type ?? "casefold";

  return {
    event_id: "evt-test-1",
    timestamp_iso: "2026-06-18T00:00:00.000Z",
    app_version: "dev-test",
    bundle_id: "bundle_full_test_aaaaaaaa",
    storage_scope_id: "bundle_full_test_aaaaaaaa::sha256:111",
    norm_version: "norm_v3",
    query_raw: "bonjour",
    query_normalized_primary: "bonjour",
    query_normalized_keys: {
      casefold: ["bonjour"],
      diacritics_insensitive: ["bonjour"],
      punct_stripped: ["bonjour"],
      nospace: ["bonjour"],
    },
    direction: "source_to_target",
    ui_language: "fr",
    result_count: resultCount,
    top_ir_ids: ["ir-1"],
    matched_key_type: matchedKeyType,
    matched_key: "bonjour",
    latency_ms: 12,
    offline_or_online: true,
    session_bucket_id: "session-test-1",
    logging_enabled: true,
    consent_version: QUERY_LOG_CONSENT_VERSION,
    result_status:
      overrides.result_status ??
      (resultCount === 0 ? "miss" : resultCount === 1 ? "hit_single" : "hit_multi"),
    matched_deep_ladder:
      overrides.matched_deep_ladder ??
      (matchedKeyType === "punct_stripped" || matchedKeyType === "nospace"),
    ...overrides,
  };
}

async function countStoreRows(db: IDBDatabase, storeName: string): Promise<number> {
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return await new Promise((resolve, reject) => {
    const req = store.count();
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

async function openLegacyV2DbWithData(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(SIRALEX_DB_NAME, 2);
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
    });
    req.addEventListener("success", () => {
      const db = req.result;
      const tx = db.transaction(
        [STORE_META, STORE_RECORDS, STORE_SEARCH_INDEX, STORE_BUNDLES_REGISTRY],
        "readwrite",
      );
      tx.objectStore(STORE_META).put("legacy-value", "legacy-key");
      tx.objectStore(STORE_RECORDS).put({
        bundle_id: "legacy-scope",
        ir_id: "rec-1",
        display: { headword_latin: "legacy" },
      });
      tx.objectStore(STORE_SEARCH_INDEX).put({
        bundle_id: "legacy-scope",
        key_type: "casefold",
        key: "legacy",
        ir_ids: ["rec-1"],
      });
      tx.objectStore(STORE_BUNDLES_REGISTRY).put({
        bundle_id: "legacy-bundle",
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v1",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        imported_at_iso: "2026-01-01T00:00:00Z",
      });
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

describe("query log store", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine if db does not exist yet
    }
  });

  it("opens DB version 3 and creates query_logs without removing existing stores", async () => {
    await openLegacyV2DbWithData();

    const db = await openSiralexDb();
    try {
      expect(Array.from(db.objectStoreNames)).toContain(STORE_QUERY_LOGS);
      expect(await metaGet<string>(db, "legacy-key")).toBe("legacy-value");
      expect(await countStoreRows(db, STORE_RECORDS)).toBe(1);
      expect(await countStoreRows(db, STORE_SEARCH_INDEX)).toBe(1);
      expect(await countStoreRows(db, STORE_BUNDLES_REGISTRY)).toBe(1);
      expect(await countStoreRows(db, STORE_QUERY_LOGS)).toBe(0);
    } finally {
      db.close();
    }
  });

  it("appends a single log row and returns generated log_id", async () => {
    const db = await openSiralexDb();
    try {
      const logId = await appendQueryLog(db, makeAppendInput());
      expect(logId).toBe(1);

      const rows = await listQueryLogs(db);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.schema_version).toBe("query_log_event_v1");
      expect(rows[0]?.log_id).toBe(1);
      expect(rows[0]?.query_raw).toBe("hello");
    } finally {
      db.close();
    }
  });

  it("preserves append order across multiple writes", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, makeAppendInput({ query_raw: "first", timestamp_iso: "2026-05-06T00:00:00.000Z" }));
      await appendQueryLog(db, makeAppendInput({ query_raw: "second", timestamp_iso: "2026-05-06T00:00:01.000Z" }));
      await appendQueryLog(db, makeAppendInput({ query_raw: "third", timestamp_iso: "2026-05-06T00:00:02.000Z" }));

      const oldestFirst = await listQueryLogs(db);
      expect(oldestFirst.map((row) => row.query_raw)).toEqual(["first", "second", "third"]);

      const newestFirst = await listQueryLogs(db, { newest_first: true, limit: 2 });
      expect(newestFirst.map((row) => row.query_raw)).toEqual(["third", "second"]);

      const recent = await listRecentQueryLogs(db, { limit: 2 });
      expect(recent.map((row) => row.query_raw)).toEqual(["third", "second"]);

      const recentAll = await listRecentQueryLogs(db, { limit: 10 });
      expect(recentAll.map((row) => row.query_raw)).toEqual(["third", "second", "first"]);
    } finally {
      db.close();
    }
  });

  it("listRecentQueryLogs returns an empty list when there are no logs", async () => {
    const db = await openSiralexDb();
    try {
      expect(await listRecentQueryLogs(db, { limit: 50 })).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("listRecentQueryLogs returns nothing after clearAllQueryLogs", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, makeAppendInput({ query_raw: "gone" }));
      await clearAllQueryLogs(db);
      expect(await listRecentQueryLogs(db, { limit: 50 })).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("stores exact query_normalized_keys payload without mutation", async () => {
    const db = await openSiralexDb();
    try {
      const input = makeAppendInput({
        query_normalized_keys: {
          casefold: ["N'ko", "nko"],
          diacritics_insensitive: ["nko"],
          punct_stripped: ["nko"],
          nospace: ["nko"],
        },
      });
      await appendQueryLog(db, input);

      input.query_normalized_keys.casefold.push("mutated-after-write");

      const rows = await listQueryLogs(db);
      expect(rows[0]?.query_normalized_keys.casefold).toEqual(["N'ko", "nko"]);
    } finally {
      db.close();
    }
  });

  it("exports all logs as JSONL with one object per line and trailing newline", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, makeAppendInput({ query_raw: "one" }));
      await appendQueryLog(db, makeAppendInput({ query_raw: "two", timestamp_iso: "2026-05-06T00:00:01.000Z" }));

      const blob = await exportQueryLogsJsonl(db);
      const text = await blob.text();

      expect(text.endsWith("\n")).toBe(true);
      const lines = text.trimEnd().split("\n");
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0] ?? "{}").query_raw).toBe("one");
      expect(JSON.parse(lines[1] ?? "{}").query_raw).toBe("two");
    } finally {
      db.close();
    }
  });

  it("exports rows in log_id ascending order", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, makeAppendInput({ query_raw: "a", timestamp_iso: "2026-05-06T00:00:02.000Z" }));
      await appendQueryLog(db, makeAppendInput({ query_raw: "b", timestamp_iso: "2026-05-06T00:00:01.000Z" }));

      const blob = await exportQueryLogsJsonl(db);
      const lines = (await blob.text()).trimEnd().split("\n").map((line) => JSON.parse(line));
      expect(lines.map((row) => row.query_raw)).toEqual(["a", "b"]);
      expect(lines.map((row) => row.log_id)).toEqual([1, 2]);
    } finally {
      db.close();
    }
  });

  it("clears all logs without touching other stores", async () => {
    const db = await openSiralexDb();
    try {
      await metaSet(db, "keep-meta", { ok: true });
      await setActiveBundleMeta(db, {
        bundle_id: "bundle_full_keep_aaaaaaaa",
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v2",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        imported_at_iso: "2026-05-06T00:00:00Z",
      });

      const tx = db.transaction([STORE_RECORDS, STORE_SEARCH_INDEX], "readwrite");
      tx.objectStore(STORE_RECORDS).put({
        bundle_id: "bundle_full_keep_aaaaaaaa::sha256:111",
        ir_id: "rec-1",
        display: { headword_latin: "keep" },
      });
      tx.objectStore(STORE_SEARCH_INDEX).put({
        bundle_id: "bundle_full_keep_aaaaaaaa::sha256:111",
        key_type: "casefold",
        key: "keep",
        ir_ids: ["rec-1"],
      });
      await new Promise<void>((resolve, reject) => {
        tx.addEventListener("complete", () => resolve());
        tx.addEventListener("error", () => reject(tx.error));
        tx.addEventListener("abort", () => reject(tx.error));
      });

      await appendQueryLog(db, makeAppendInput());
      await clearAllQueryLogs(db);

      expect(await countQueryLogs(db)).toBe(0);
      expect(await metaGet<{ ok: boolean }>(db, "keep-meta")).toEqual({ ok: true });
      expect(await getActiveBundleMeta(db)).toMatchObject({ bundle_id: "bundle_full_keep_aaaaaaaa" });
      expect(await storeHasData(db, STORE_RECORDS)).toBe(true);
      expect(await storeHasData(db, STORE_SEARCH_INDEX)).toBe(true);
    } finally {
      db.close();
    }
  });

  it("clears logs for one storage scope only", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, makeAppendInput({ query_raw: "scope-a-1", storage_scope_id: "scope-a" }));
      await appendQueryLog(db, makeAppendInput({ query_raw: "scope-a-2", storage_scope_id: "scope-a" }));
      await appendQueryLog(
        db,
        makeAppendInput({
          query_raw: "scope-b-1",
          bundle_id: "bundle-b",
          storage_scope_id: "scope-b",
        }),
      );

      await clearQueryLogsForStorageScope(db, "scope-a");

      const remaining = await listQueryLogs(db);
      expect(remaining.map((row) => row.query_raw)).toEqual(["scope-b-1"]);
    } finally {
      db.close();
    }
  });

  it("supports mixed bundles and scopes in the same store", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, makeAppendInput({ query_raw: "a1", bundle_id: "bundle-a", storage_scope_id: "scope-a" }));
      await appendQueryLog(db, makeAppendInput({ query_raw: "a2", bundle_id: "bundle-a", storage_scope_id: "scope-a2" }));
      await appendQueryLog(db, makeAppendInput({ query_raw: "b1", bundle_id: "bundle-b", storage_scope_id: "scope-b" }));

      expect(await countQueryLogs(db)).toBe(3);
      expect((await listQueryLogs(db, { bundle_id: "bundle-a" })).map((row) => row.query_raw)).toEqual([
        "a1",
        "a2",
      ]);
      expect(
        (await listQueryLogs(db, { bundle_id: "bundle-a", storage_scope_id: "scope-a2" })).map(
          (row) => row.query_raw,
        ),
      ).toEqual(["a2"]);
    } finally {
      db.close();
    }
  });

  it("returns an empty UTF-8 blob when exporting zero rows", async () => {
    const db = await openSiralexDb();
    try {
      const blob = await exportQueryLogsJsonl(db);
      expect(await blob.text()).toBe("");
    } finally {
      db.close();
    }
  });

  it("succeeds when clearing empty stores", async () => {
    const db = await openSiralexDb();
    try {
      await clearAllQueryLogs(db);
      await clearQueryLogsForStorageScope(db, "scope-missing");
      expect(await countQueryLogs(db)).toBe(0);
    } finally {
      db.close();
    }
  });

  it("rejects invalid append input with minimal structural validation", async () => {
    const db = await openSiralexDb();
    try {
      await expect(
        appendQueryLog(
          db,
          makeAppendInput({
            bundle_id: "   ",
          }),
        ),
      ).rejects.toThrow(/bundle_id/);

      await expect(
        appendQueryLog(
          db,
          makeAppendInput({
            ir_ids_count: -1,
          }),
        ),
      ).rejects.toThrow(/ir_ids_count/);

      await expect(
        appendQueryLog(
          db,
          makeAppendInput({
            logging_enabled: true,
            query_normalized_keys: {
              casefold: ["ok"],
              diacritics_insensitive: ["ok"],
              punct_stripped: ["ok"],
              nospace: [123 as unknown as string],
            },
          }),
        ),
      ).rejects.toThrow(/query_normalized_keys\.nospace/);
    } finally {
      db.close();
    }
  });
});

describe("query log store v2", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine if db does not exist yet
    }
  });

  it("appends a v2 row with schema_version query_log_event_v2", async () => {
    const db = await openSiralexDb();
    try {
      const logId = await appendQueryLogV2(db, makeAppendV2Input());
      expect(logId).toBe(1);

      const rows = await listQueryLogs(db);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.schema_version).toBe(QUERY_LOG_EVENT_V2);
      expect(rows[0]).toMatchObject({
        event_id: "evt-test-1",
        result_status: "hit_single",
        result_count: 1,
        matched_deep_ladder: false,
        consent_version: QUERY_LOG_CONSENT_VERSION,
        logging_enabled: true,
      });
    } finally {
      db.close();
    }
  });

  it("preserves all required v2 fields on read", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLogV2(
        db,
        makeAppendV2Input({
          event_id: "evt-full",
          catalog_version: "norm-v3-featured",
          bundle_version: "2026.06.18",
          query_normalized_primary: null,
          matched_key: null,
          top_ir_ids: ["ir-a", "ir-b"],
          ui_language: "en",
          offline_or_online: false,
          latency_ms: 99,
        }),
      );

      const row = (await listQueryLogs(db))[0];
      expect(row).toMatchObject({
        schema_version: QUERY_LOG_EVENT_V2,
        event_id: "evt-full",
        catalog_version: "norm-v3-featured",
        bundle_version: "2026.06.18",
        query_normalized_primary: null,
        matched_key: null,
        top_ir_ids: ["ir-a", "ir-b"],
        ui_language: "en",
        offline_or_online: false,
        latency_ms: 99,
      });
    } finally {
      db.close();
    }
  });

  it("rejects invalid v2 result_status", async () => {
    const db = await openSiralexDb();
    try {
      await expect(
        appendQueryLogV2(
          db,
          makeAppendV2Input({
            result_count: 1,
            result_status: "hit_multi",
          }),
        ),
      ).rejects.toThrow(/result_status must equal deriveResultStatus/);
    } finally {
      db.close();
    }
  });

  it("rejects negative result_count", async () => {
    const db = await openSiralexDb();
    try {
      await expect(
        appendQueryLogV2(
          db,
          makeAppendV2Input({
            result_count: -1,
            result_status: "miss",
            top_ir_ids: [],
            matched_key: null,
            matched_key_type: "none",
            matched_deep_ladder: false,
          }),
        ),
      ).rejects.toThrow(/result_count must be an integer >= 0/);
    } finally {
      db.close();
    }
  });

  it("rejects non-integer result_count", async () => {
    const db = await openSiralexDb();
    try {
      await expect(
        appendQueryLogV2(
          db,
          makeAppendV2Input({
            result_count: 1.5 as unknown as number,
          }),
        ),
      ).rejects.toThrow(/result_count must be an integer >= 0/);
    } finally {
      db.close();
    }
  });

  it("rejects negative latency_ms", async () => {
    const db = await openSiralexDb();
    try {
      await expect(
        appendQueryLogV2(
          db,
          makeAppendV2Input({
            latency_ms: -1,
          }),
        ),
      ).rejects.toThrow(/latency_ms must be an integer >= 0/);
    } finally {
      db.close();
    }
  });

  it("rejects top_ir_ids longer than QUERY_LOG_TOP_IR_IDS_LIMIT", async () => {
    const db = await openSiralexDb();
    try {
      await expect(
        appendQueryLogV2(
          db,
          makeAppendV2Input({
            top_ir_ids: ["a", "b", "c", "d", "e", "f"],
          }),
        ),
      ).rejects.toThrow(new RegExp(`at most ${QUERY_LOG_TOP_IR_IDS_LIMIT}`));
    } finally {
      db.close();
    }
  });

  it("enforces matched_deep_ladder consistency", async () => {
    const db = await openSiralexDb();
    try {
      await expect(
        appendQueryLogV2(
          db,
          makeAppendV2Input({
            matched_key_type: "nospace",
            matched_deep_ladder: false,
          }),
        ),
      ).rejects.toThrow(/matched_deep_ladder must equal deriveMatchedDeepLadder/);
    } finally {
      db.close();
    }
  });

  it("exports mixed v1 and v2 rows with distinct schema versions", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, makeAppendInput({ query_raw: "v1-row" }));
      await appendQueryLogV2(db, makeAppendV2Input({ query_raw: "v2-row", event_id: "evt-v2" }));

      const lines = (await (await exportQueryLogsJsonl(db)).text()).trimEnd().split("\n").map((line) => JSON.parse(line));
      expect(lines).toHaveLength(2);
      expect(lines[0]?.schema_version).toBe("query_log_event_v1");
      expect(lines[1]?.schema_version).toBe(QUERY_LOG_EVENT_V2);
      expect(lines[0]?.query_raw).toBe("v1-row");
      expect(lines[1]?.query_raw).toBe("v2-row");
    } finally {
      db.close();
    }
  });

  it("reads mixed v1 and v2 rows without changing stored shapes", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, makeAppendInput({ query_raw: "legacy" }));
      await appendQueryLogV2(db, makeAppendV2Input({ query_raw: "modern", event_id: "evt-modern" }));

      const rows = await listQueryLogs(db);
      expect(rows[0]?.schema_version).toBe("query_log_event_v1");
      expect(rows[1]?.schema_version).toBe(QUERY_LOG_EVENT_V2);
      expect(rows[0]).toHaveProperty("ir_ids_count");
      expect(rows[1]).toHaveProperty("result_count");
    } finally {
      db.close();
    }
  });

  it("listRecentQueryLogs returns mixed v1 and v2 rows as QueryLogEvent[]", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, makeAppendInput({ query_raw: "legacy", timestamp_iso: "2026-06-01T00:00:00.000Z" }));
      await appendQueryLogV2(
        db,
        makeAppendV2Input({ query_raw: "modern", event_id: "evt-modern", timestamp_iso: "2026-06-18T00:00:00.000Z" }),
      );

      const recent = await listRecentQueryLogs(db, { limit: 10 });
      expect(recent.map((row) => row.query_raw)).toEqual(["modern", "legacy"]);
      expect(recent[0]?.schema_version).toBe(QUERY_LOG_EVENT_V2);
      expect(recent[1]?.schema_version).toBe("query_log_event_v1");
    } finally {
      db.close();
    }
  });

  it("evicts the oldest row when the 2001st append exceeds QUERY_LOG_MAX_ROWS", async () => {
    const db = await openSiralexDb();
    try {
      for (let i = 0; i < QUERY_LOG_MAX_ROWS + 1; i += 1) {
        await appendQueryLogV2(
          db,
          makeAppendV2Input({
            query_raw: `q-${i}`,
            event_id: `evt-${i}`,
            timestamp_iso: `2026-06-18T00:00:${String(i % 60).padStart(2, "0")}.000Z`,
          }),
        );
      }

      expect(await countQueryLogs(db)).toBe(QUERY_LOG_MAX_ROWS);
      const rows = await listQueryLogs(db);
      expect(rows[0]?.query_raw).toBe("q-1");
      expect(rows[rows.length - 1]?.query_raw).toBe(`q-${QUERY_LOG_MAX_ROWS}`);
    } finally {
      db.close();
    }
  });

  it("prunes rows older than QUERY_LOG_MAX_AGE_MS on append", async () => {
    const db = await openSiralexDb();
    try {
      const staleIso = new Date(Date.now() - QUERY_LOG_MAX_AGE_MS - 24 * 60 * 60 * 1000).toISOString();
      await appendQueryLogV2(
        db,
        makeAppendV2Input({
          query_raw: "stale",
          event_id: "evt-stale",
          timestamp_iso: staleIso,
        }),
      );
      await appendQueryLogV2(
        db,
        makeAppendV2Input({
          query_raw: "fresh",
          event_id: "evt-fresh",
          timestamp_iso: new Date().toISOString(),
        }),
      );

      const rows = await listQueryLogs(db);
      expect(rows.map((row) => row.query_raw)).toEqual(["fresh"]);
    } finally {
      db.close();
    }
  });

  it("returns count and oldest timestamp from getQueryLogStats", async () => {
    const db = await openSiralexDb();
    try {
      expect(await getQueryLogStats(db)).toEqual({
        count: 0,
        oldest_timestamp_iso: null,
      });

      await appendQueryLogV2(
        db,
        makeAppendV2Input({
          query_raw: "older",
          event_id: "evt-older",
          timestamp_iso: "2026-06-01T00:00:00.000Z",
        }),
      );
      await appendQueryLogV2(
        db,
        makeAppendV2Input({
          query_raw: "newer",
          event_id: "evt-newer",
          timestamp_iso: "2026-06-18T00:00:00.000Z",
        }),
      );

      expect(await getQueryLogStats(db)).toEqual({
        count: 2,
        oldest_timestamp_iso: "2026-06-01T00:00:00.000Z",
      });
    } finally {
      db.close();
    }
  });
});
