import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { deleteSiralexDb, openSiralexDb, STORE_SEARCH_INDEX } from "../idb/siralex_db";
import { searchQuery } from "./search_query";

const BUNDLE_SCOPE = "bundle-test-scope";

async function putSearchIndexEntry(
  db: IDBDatabase,
  keyType: string,
  key: string,
  irIds: string[],
): Promise<void> {
  const tx = db.transaction(STORE_SEARCH_INDEX, "readwrite");
  tx.objectStore(STORE_SEARCH_INDEX).put({
    bundle_id: BUNDLE_SCOPE,
    key_type: keyType,
    key,
    ir_ids: irIds,
  });
  await new Promise<void>((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

describe("searchQuery metadata", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine if db does not exist yet
    }
  });

  it("includes query_normalized_keys and last_tried_normalized_key on hit", async () => {
    const db = await openSiralexDb();
    try {
      await putSearchIndexEntry(db, "src_casefold", "bonjour", ["rec-1"]);

      const result = await searchQuery(db, BUNDLE_SCOPE, "source_to_target", "bonjour", true);

      expect(result.ir_ids).toEqual(["rec-1"]);
      expect(result.matched_key_type).toBe("casefold");
      expect(result.matched_key).toBe("bonjour");
      expect(result.query_normalized_keys.casefold).toContain("bonjour");
      expect(result.last_tried_normalized_key).toBe("bonjour");
    } finally {
      db.close();
    }
  });

  it("includes query_normalized_keys and last_tried_normalized_key on miss", async () => {
    const db = await openSiralexDb();
    try {
      const result = await searchQuery(db, BUNDLE_SCOPE, "source_to_target", "missing-term", true);

      expect(result.ir_ids).toEqual([]);
      expect(result.matched_key_type).toBeNull();
      expect(result.matched_key).toBeNull();
      expect(result.query_normalized_keys.casefold.length).toBeGreaterThan(0);
      expect(result.last_tried_normalized_key).toBeTruthy();
    } finally {
      db.close();
    }
  });

  it("returns empty metadata for blank query without changing hit behavior semantics", async () => {
    const db = await openSiralexDb();
    try {
      await putSearchIndexEntry(db, "src_casefold", "bonjour", ["rec-1"]);

      const result = await searchQuery(db, BUNDLE_SCOPE, "source_to_target", "   ", true);

      expect(result.ir_ids).toEqual([]);
      expect(result.query_normalized_keys).toEqual({
        casefold: [],
        diacritics_insensitive: [],
        punct_stripped: [],
        nospace: [],
      });
      expect(result.last_tried_normalized_key).toBeNull();
    } finally {
      db.close();
    }
  });
});
