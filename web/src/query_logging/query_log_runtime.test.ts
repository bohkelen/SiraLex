import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteSiralexDb, openSiralexDb, setCachedBundleCatalog } from "../idb/siralex_db";
import type { SearchResult } from "../search/search_query";
import { recordQueryLoggingConsent } from "./query_log_consent";
import { isQueryLogEventV2 } from "./query_log_derive";
import { countQueryLogs, listQueryLogs } from "./query_log_store";
import {
  QUERY_LOG_CONSENT_VERSION,
  QUERY_LOG_EVENT_V2,
  QUERY_LOG_TOP_IR_IDS_LIMIT,
} from "./query_log_types";
import {
  appendSearchQueryLogIfEnabled,
  getQueryLoggingEnabled,
  setQueryLoggingEnabled,
} from "./query_log_runtime";

type MemoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
};

function createMemoryStorage(): MemoryStorage {
  const map = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key) ?? null : null;
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    clear(): void {
      map.clear();
    },
  };
}

function enableLoggingWithConsent(storage: MemoryStorage): void {
  storage.setItem("siralex.query_logging.enabled", "true");
  vi.stubGlobal("localStorage", storage);
  recordQueryLoggingConsent(() => new Date("2026-06-18T12:00:00.000Z"));
}

function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    ir_ids: ["rec-1"],
    matched_key_type: "casefold",
    matched_key: "bonjour",
    query_normalized_keys: {
      casefold: ["bonjour"],
      diacritics_insensitive: ["bonjour"],
      punct_stripped: ["bonjour"],
      nospace: ["bonjour"],
    },
    last_tried_normalized_key: "bonjour",
    ...overrides,
  };
}

describe("query log runtime integration", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine if db does not exist yet
    }
    vi.unstubAllGlobals();
  });

  it("defaults to Off when the localStorage flag is absent", () => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    expect(getQueryLoggingEnabled()).toBe(false);
  });

  it('enabling sets the localStorage flag to "true"', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal("localStorage", storage);

    setQueryLoggingEnabled(true);

    expect(storage.getItem("siralex.query_logging.enabled")).toBe("true");
    expect(getQueryLoggingEnabled()).toBe(true);
  });

  it("disabling removes the localStorage flag", () => {
    const storage = createMemoryStorage();
    storage.setItem("siralex.query_logging.enabled", "true");
    vi.stubGlobal("localStorage", storage);

    setQueryLoggingEnabled(false);

    expect(storage.getItem("siralex.query_logging.enabled")).toBeNull();
    expect(getQueryLoggingEnabled()).toBe(false);
  });

  it("fails closed when localStorage access throws", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("storage unavailable");
      },
      setItem() {
        throw new Error("storage unavailable");
      },
      removeItem() {
        throw new Error("storage unavailable");
      },
      clear() {
        throw new Error("storage unavailable");
      },
    });

    expect(getQueryLoggingEnabled()).toBe(false);
    expect(() => setQueryLoggingEnabled(true)).not.toThrow();
    expect(getQueryLoggingEnabled()).toBe(false);
  });

  it("does not append logs when logging is disabled", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    recordQueryLoggingConsent();

    await appendSearchQueryLogIfEnabled({
      queryRaw: "bonjour",
      direction: "source_to_target",
      result: makeSearchResult(),
      activeBundleMeta: {
        bundle_id: "bundle-a",
        version: "1.0.0",
        normalization_ruleset: "norm_v2",
      },
      storageScopeId: "bundle-a::sha256:1",
      uiLanguage: "fr",
      latencyMs: 12,
      timestampIso: "2026-06-18T00:00:00.000Z",
    });

    const db = await openSiralexDb();
    try {
      expect(await countQueryLogs(db)).toBe(0);
    } finally {
      db.close();
    }
  });

  it("does not append logs when consent is missing", async () => {
    const storage = createMemoryStorage();
    storage.setItem("siralex.query_logging.enabled", "true");
    vi.stubGlobal("localStorage", storage);

    await appendSearchQueryLogIfEnabled({
      queryRaw: "bonjour",
      direction: "source_to_target",
      result: makeSearchResult(),
      activeBundleMeta: {
        bundle_id: "bundle-a",
        version: "1.0.0",
        normalization_ruleset: "norm_v2",
      },
      storageScopeId: "bundle-a::sha256:1",
      uiLanguage: "fr",
      latencyMs: 12,
    });

    const db = await openSiralexDb();
    try {
      expect(await countQueryLogs(db)).toBe(0);
    } finally {
      db.close();
    }
  });

  it("does not append logs for empty query text", async () => {
    const storage = createMemoryStorage();
    enableLoggingWithConsent(storage);

    await appendSearchQueryLogIfEnabled({
      queryRaw: "   ",
      direction: "source_to_target",
      result: makeSearchResult({ ir_ids: [] }),
      activeBundleMeta: {
        bundle_id: "bundle-a",
        version: "1.0.0",
        normalization_ruleset: "norm_v2",
      },
      storageScopeId: "bundle-a::sha256:1",
      uiLanguage: "fr",
      latencyMs: 12,
    });

    const db = await openSiralexDb();
    try {
      expect(await countQueryLogs(db)).toBe(0);
    } finally {
      db.close();
    }
  });

  it("writes a v2 row when logging is enabled with valid consent", async () => {
    const storage = createMemoryStorage();
    enableLoggingWithConsent(storage);

    await appendSearchQueryLogIfEnabled({
      queryRaw: "Bon re\u0301veil",
      direction: "source_to_target",
      result: makeSearchResult({
        matched_key: "bon réveil",
        query_normalized_keys: {
          casefold: ["bon réveil"],
          diacritics_insensitive: ["bon reveil"],
          punct_stripped: ["bon reveil"],
          nospace: ["bonreveil"],
        },
        last_tried_normalized_key: "bon réveil",
      }),
      activeBundleMeta: {
        bundle_id: "bundle-full",
        version: "2026.05.07",
        normalization_ruleset: "norm_v2",
      },
      storageScopeId: "bundle-full::sha256:abc",
      uiLanguage: "en",
      latencyMs: 42,
      timestampIso: "2026-06-18T00:00:00.000Z",
    });

    const db = await openSiralexDb();
    try {
      const rows = await listQueryLogs(db);
      expect(rows).toHaveLength(1);
      expect(isQueryLogEventV2(rows[0])).toBe(true);
      expect(rows[0]).toMatchObject({
        schema_version: QUERY_LOG_EVENT_V2,
        query_raw: "Bon re\u0301veil",
        direction: "source_to_target",
        matched_key_type: "casefold",
        matched_key: "bon réveil",
        query_normalized_primary: "bon réveil",
        result_status: "hit_single",
        result_count: 1,
        latency_ms: 42,
        ui_language: "en",
        bundle_id: "bundle-full",
        bundle_version: "2026.05.07",
        storage_scope_id: "bundle-full::sha256:abc",
        norm_version: "norm_v2",
        timestamp_iso: "2026-06-18T00:00:00.000Z",
        consent_version: QUERY_LOG_CONSENT_VERSION,
        logging_enabled: true,
        matched_deep_ladder: false,
      });
      if (isQueryLogEventV2(rows[0])) {
        expect(rows[0].query_normalized_keys.casefold).toEqual(["bon réveil"]);
        expect(rows[0].session_bucket_id.trim()).not.toBe("");
      }
    } finally {
      db.close();
    }
  });

  it("uses SearchResult normalized keys instead of recomputing from query_raw", async () => {
    const storage = createMemoryStorage();
    enableLoggingWithConsent(storage);

    await appendSearchQueryLogIfEnabled({
      queryRaw: "hello",
      direction: "source_to_target",
      result: makeSearchResult({
        query_normalized_keys: {
          casefold: ["shadow-key"],
          diacritics_insensitive: ["shadow-key"],
          punct_stripped: ["shadow-key"],
          nospace: ["shadow-key"],
        },
        matched_key: "shadow-key",
        last_tried_normalized_key: "shadow-key",
      }),
      activeBundleMeta: {
        bundle_id: "bundle-a",
        version: "1.0.0",
        normalization_ruleset: "norm_v2",
      },
      storageScopeId: "bundle-a::sha256:1",
      uiLanguage: "fr",
      latencyMs: 5,
    });

    const db = await openSiralexDb();
    try {
      const row = (await listQueryLogs(db))[0];
      expect(isQueryLogEventV2(row)).toBe(true);
      if (isQueryLogEventV2(row)) {
        expect(row.query_normalized_keys.casefold).toEqual(["shadow-key"]);
      }
    } finally {
      db.close();
    }
  });

  it("caps top_ir_ids at QUERY_LOG_TOP_IR_IDS_LIMIT", async () => {
    const storage = createMemoryStorage();
    enableLoggingWithConsent(storage);

    await appendSearchQueryLogIfEnabled({
      queryRaw: "multi",
      direction: "source_to_target",
      result: makeSearchResult({
        ir_ids: ["ir-1", "ir-2", "ir-3", "ir-4", "ir-5", "ir-6"],
        matched_key_type: "casefold",
        matched_key: "multi",
      }),
      activeBundleMeta: {
        bundle_id: "bundle-a",
        version: "1.0.0",
        normalization_ruleset: "norm_v2",
      },
      storageScopeId: "bundle-a::sha256:1",
      uiLanguage: "fr",
      latencyMs: 8,
    });

    const db = await openSiralexDb();
    try {
      const row = (await listQueryLogs(db))[0];
      expect(isQueryLogEventV2(row)).toBe(true);
      if (isQueryLogEventV2(row)) {
        expect(row.top_ir_ids).toEqual(["ir-1", "ir-2", "ir-3", "ir-4", "ir-5"]);
        expect(row.top_ir_ids.length).toBe(QUERY_LOG_TOP_IR_IDS_LIMIT);
        expect(row.result_status).toBe("hit_multi");
        expect(row.matched_deep_ladder).toBe(false);
      }
    } finally {
      db.close();
    }
  });

  it("records miss metadata with matched_key_type none and last_tried primary key", async () => {
    const storage = createMemoryStorage();
    enableLoggingWithConsent(storage);

    await appendSearchQueryLogIfEnabled({
      queryRaw: "missing",
      direction: "target_to_source",
      result: makeSearchResult({
        ir_ids: [],
        matched_key_type: null,
        matched_key: null,
        last_tried_normalized_key: "missing",
      }),
      activeBundleMeta: {
        bundle_id: "bundle-miss",
        version: "1.0.0",
        normalization_ruleset: "norm_v1",
      },
      storageScopeId: "bundle-miss::sha256:miss",
      uiLanguage: "fr",
      latencyMs: 3,
      timestampIso: "2026-06-18T00:00:01.000Z",
    });

    const db = await openSiralexDb();
    try {
      const row = (await listQueryLogs(db))[0];
      expect(isQueryLogEventV2(row)).toBe(true);
      if (isQueryLogEventV2(row)) {
        expect(row.matched_key_type).toBe("none");
        expect(row.result_status).toBe("miss");
        expect(row.result_count).toBe(0);
        expect(row.query_normalized_primary).toBe("missing");
      }
    } finally {
      db.close();
    }
  });

  it("includes catalog_version when resolver succeeds", async () => {
    const storage = createMemoryStorage();
    enableLoggingWithConsent(storage);

    const db = await openSiralexDb();
    try {
      await setCachedBundleCatalog(db, {
        request_url: "/catalog.json",
        response_url: "/catalog.json",
        fetched_at_iso: "2026-06-18T00:00:00.000Z",
        warnings: [],
        catalog: {
          catalog_schema_version: "bundle_catalog_v1",
          bundles: [
            {
              bundle_id: "bundle-a",
              name: "Bundle A",
              version: "norm-v3-featured",
              size_bytes: 1,
              url_base: "/bundle-a",
              content_sha256: "sha256:abc",
            },
          ],
        },
      });
    } finally {
      db.close();
    }

    await appendSearchQueryLogIfEnabled({
      queryRaw: "bonjour",
      direction: "source_to_target",
      result: makeSearchResult(),
      activeBundleMeta: {
        bundle_id: "bundle-a",
        version: "1.0.0",
        normalization_ruleset: "norm_v2",
      },
      storageScopeId: "bundle-a::sha256:1",
      uiLanguage: "fr",
      latencyMs: 9,
    });

    const readDb = await openSiralexDb();
    try {
      const row = (await listQueryLogs(readDb))[0];
      expect(isQueryLogEventV2(row)).toBe(true);
      if (isQueryLogEventV2(row)) {
        expect(row.catalog_version).toBe("norm-v3-featured");
      }
    } finally {
      readDb.close();
    }
  });

  it("omits catalog_version when resolver cannot find a version", async () => {
    const storage = createMemoryStorage();
    enableLoggingWithConsent(storage);

    await appendSearchQueryLogIfEnabled({
      queryRaw: "bonjour",
      direction: "source_to_target",
      result: makeSearchResult(),
      activeBundleMeta: {
        bundle_id: "bundle-a",
        version: "1.0.0",
        normalization_ruleset: "norm_v2",
      },
      storageScopeId: "bundle-a::sha256:1",
      uiLanguage: "fr",
      latencyMs: 9,
    });

    const db = await openSiralexDb();
    try {
      const row = (await listQueryLogs(db))[0];
      expect(isQueryLogEventV2(row)).toBe(true);
      if (isQueryLogEventV2(row)) {
        expect(row.catalog_version).toBeUndefined();
      }
    } finally {
      db.close();
    }
  });

  it("swallows logging failures so callers are unaffected", async () => {
    const storage = createMemoryStorage();
    enableLoggingWithConsent(storage);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      appendSearchQueryLogIfEnabled({
        queryRaw: "bonjour",
        direction: "source_to_target",
        result: makeSearchResult(),
        activeBundleMeta: {
          bundle_id: "",
          version: "1.0.0",
          normalization_ruleset: "norm_v2",
        },
        storageScopeId: "",
        uiLanguage: "fr",
        latencyMs: 1,
        timestampIso: "2026-06-18T00:00:00.000Z",
      }),
    ).resolves.toBeUndefined();

    const db = await openSiralexDb();
    try {
      expect(await countQueryLogs(db)).toBe(0);
    } finally {
      db.close();
    }

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
