import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteSiralexDb, openSiralexDb } from "../idb/siralex_db";
import { countQueryLogs, listQueryLogs } from "./query_log_store";
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

    await appendSearchQueryLogIfEnabled({
      queryRaw: "bonjour",
      direction: "source_to_target",
      result: { ir_ids: ["rec-1"], matched_key_type: "casefold" },
      activeBundleMeta: {
        bundle_id: "bundle-a",
        version: "1.0.0",
        normalization_ruleset: "norm_v2",
      },
      storageScopeId: "bundle-a::sha256:1",
      timestampIso: "2026-05-07T00:00:00.000Z",
    });

    const db = await openSiralexDb();
    try {
      expect(await countQueryLogs(db)).toBe(0);
    } finally {
      db.close();
    }
  });

  it("appends a real query log when logging is enabled", async () => {
    const storage = createMemoryStorage();
    storage.setItem("siralex.query_logging.enabled", "true");
    vi.stubGlobal("localStorage", storage);

    await appendSearchQueryLogIfEnabled({
      queryRaw: "Bon re\u0301veil",
      direction: "source_to_target",
      result: { ir_ids: ["rec-source"], matched_key_type: "casefold" },
      activeBundleMeta: {
        bundle_id: "bundle-full",
        version: "2026.05.07",
        normalization_ruleset: "norm_v2",
      },
      storageScopeId: "bundle-full::sha256:abc",
      timestampIso: "2026-05-07T00:00:00.000Z",
    });

    const db = await openSiralexDb();
    try {
      const rows = await listQueryLogs(db);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        query_raw: "Bon re\u0301veil",
        direction: "source_to_target",
        ladder_level_hit: "casefold",
        ir_ids_count: 1,
        bundle_id: "bundle-full",
        bundle_version: "2026.05.07",
        storage_scope_id: "bundle-full::sha256:abc",
        norm_version: "norm_v2",
        timestamp_iso: "2026-05-07T00:00:00.000Z",
        logging_enabled: true,
      });
      expect(rows[0]?.query_normalized_keys.casefold).toEqual(["bon réveil"]);
      expect(rows[0]?.query_normalized_keys.diacritics_insensitive).toEqual(["bon reveil"]);
    } finally {
      db.close();
    }
  });

  it("records ladder_level_hit as none for empty results", async () => {
    const storage = createMemoryStorage();
    storage.setItem("siralex.query_logging.enabled", "true");
    vi.stubGlobal("localStorage", storage);

    await appendSearchQueryLogIfEnabled({
      queryRaw: "missing",
      direction: "target_to_source",
      result: { ir_ids: [], matched_key_type: null },
      activeBundleMeta: {
        bundle_id: "bundle-miss",
        version: "1.0.0",
        normalization_ruleset: "norm_v1",
      },
      storageScopeId: "bundle-miss::sha256:miss",
      timestampIso: "2026-05-07T00:00:01.000Z",
    });

    const db = await openSiralexDb();
    try {
      const rows = await listQueryLogs(db);
      expect(rows[0]).toMatchObject({
        ladder_level_hit: "none",
        ir_ids_count: 0,
        direction: "target_to_source",
      });
    } finally {
      db.close();
    }
  });

  it("swallows logging failures so callers are unaffected", async () => {
    const storage = createMemoryStorage();
    storage.setItem("siralex.query_logging.enabled", "true");
    vi.stubGlobal("localStorage", storage);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      appendSearchQueryLogIfEnabled({
        queryRaw: "bonjour",
        direction: "source_to_target",
        result: { ir_ids: ["rec-1"], matched_key_type: "casefold" },
        activeBundleMeta: {
          bundle_id: "",
          version: "1.0.0",
          normalization_ruleset: "norm_v2",
        },
        storageScopeId: "",
        timestampIso: "2026-05-07T00:00:00.000Z",
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

