import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { deleteSiralexDb, openSiralexDb, STORE_SEARCH_INDEX } from "../idb/siralex_db";
import { LookupCapabilityError } from "./lookup_mode";
import { searchQuery, searchQueryForLookupMode } from "./search_query";

const BUNDLE_SCOPE = "bundle-test-scope";

const ENGLISH_CAPABLE = {
  lookup_languages: ["fr", "en", "mnk"],
  search_key_families: ["src", "en", "tgt"],
};

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

describe("searchQueryForLookupMode multilingual ladder", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine
    }
  });

  async function seedHouseBundle(db: IDBDatabase): Promise<void> {
    await putSearchIndexEntry(db, "src_casefold", "maison", ["rec-house"]);
    await putSearchIndexEntry(db, "en_casefold", "house", ["rec-house"]);
    // Store NFC-composed Maninka key (same form computeSearchKeys emits).
    await putSearchIndexEntry(db, "tgt_casefold", "bón", ["rec-house"]);
  }

  it("resolves FR/EN/MNK lookup pairs against the correct key families", async () => {
    const db = await openSiralexDb();
    try {
      await seedHouseBundle(db);

      expect(
        (
          await searchQueryForLookupMode(
            db,
            BUNDLE_SCOPE,
            { from: "fr", to: "mnk" },
            "maison",
            true,
            ENGLISH_CAPABLE,
          )
        ).ir_ids,
      ).toEqual(["rec-house"]);

      expect(
        (
          await searchQueryForLookupMode(
            db,
            BUNDLE_SCOPE,
            { from: "en", to: "mnk" },
            "house",
            true,
            ENGLISH_CAPABLE,
          )
        ).ir_ids,
      ).toEqual(["rec-house"]);

      expect(
        (
          await searchQueryForLookupMode(
            db,
            BUNDLE_SCOPE,
            { from: "mnk", to: "fr" },
            "bón",
            true,
            ENGLISH_CAPABLE,
          )
        ).ir_ids,
      ).toEqual(["rec-house"]);

      expect(
        (
          await searchQueryForLookupMode(
            db,
            BUNDLE_SCOPE,
            { from: "mnk", to: "en" },
            "bón",
            true,
            ENGLISH_CAPABLE,
          )
        ).ir_ids,
      ).toEqual(["rec-house"]);
    } finally {
      db.close();
    }
  });

  it("isolates directions so cross-family queries miss", async () => {
    const db = await openSiralexDb();
    try {
      await seedHouseBundle(db);

      expect(
        (
          await searchQueryForLookupMode(
            db,
            BUNDLE_SCOPE,
            { from: "fr", to: "mnk" },
            "house",
            true,
            ENGLISH_CAPABLE,
          )
        ).ir_ids,
      ).toEqual([]);

      expect(
        (
          await searchQueryForLookupMode(
            db,
            BUNDLE_SCOPE,
            { from: "en", to: "mnk" },
            "maison",
            true,
            ENGLISH_CAPABLE,
          )
        ).ir_ids,
      ).toEqual([]);

      expect(
        (
          await searchQueryForLookupMode(
            db,
            BUNDLE_SCOPE,
            { from: "mnk", to: "fr" },
            "house",
            true,
            ENGLISH_CAPABLE,
          )
        ).ir_ids,
      ).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("legacy searchQuery source_to_target remains FR→MNK (src_*)", async () => {
    const db = await openSiralexDb();
    try {
      await seedHouseBundle(db);
      expect(
        (await searchQuery(db, BUNDLE_SCOPE, "source_to_target", "maison", true)).ir_ids,
      ).toEqual(["rec-house"]);
      expect(
        (await searchQuery(db, BUNDLE_SCOPE, "source_to_target", "house", true)).ir_ids,
      ).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("legacy searchQuery target_to_source remains MNK→FR (tgt_*)", async () => {
    const db = await openSiralexDb();
    try {
      await seedHouseBundle(db);
      expect(
        (await searchQuery(db, BUNDLE_SCOPE, "target_to_source", "bón", true)).ir_ids,
      ).toEqual(["rec-house"]);
    } finally {
      db.close();
    }
  });

  it("fail-closes English lookup on legacy bundles without en capability", async () => {
    const db = await openSiralexDb();
    try {
      await seedHouseBundle(db);
      await expect(
        searchQueryForLookupMode(
          db,
          BUNDLE_SCOPE,
          { from: "en", to: "mnk" },
          "house",
          true,
          {},
        ),
      ).rejects.toBeInstanceOf(LookupCapabilityError);

      await expect(
        searchQueryForLookupMode(
          db,
          BUNDLE_SCOPE,
          { from: "en", to: "mnk" },
          "house",
          true,
          { lookup_languages: ["en"] },
        ),
      ).rejects.toBeInstanceOf(LookupCapabilityError);
    } finally {
      db.close();
    }
  });

  it("permits English lookup when both capability fields advertise en", async () => {
    const db = await openSiralexDb();
    try {
      await seedHouseBundle(db);
      const result = await searchQueryForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "en", to: "mnk" },
        "house",
        true,
        ENGLISH_CAPABLE,
      );
      expect(result.ir_ids).toEqual(["rec-house"]);
      expect(result.matched_key_type).toBe("casefold");
    } finally {
      db.close();
    }
  });

  it("fail-closes English lookup on undirected indexes even with en capability meta", async () => {
    const db = await openSiralexDb();
    try {
      await putSearchIndexEntry(db, "casefold", "maison", ["rec-house"]);
      await putSearchIndexEntry(db, "casefold", "house", ["rec-house"]);
      await putSearchIndexEntry(db, "casefold", "bón", ["rec-house"]);

      await expect(
        searchQueryForLookupMode(
          db,
          BUNDLE_SCOPE,
          { from: "en", to: "mnk" },
          "house",
          false,
          ENGLISH_CAPABLE,
        ),
      ).rejects.toMatchObject({ code: "english_lookup_unsupported" });

      await expect(
        searchQueryForLookupMode(
          db,
          BUNDLE_SCOPE,
          { from: "mnk", to: "en" },
          "bón",
          false,
          ENGLISH_CAPABLE,
        ),
      ).rejects.toBeInstanceOf(LookupCapabilityError);

      // Undirected FR↔MNK still works via LookupMode and legacy searchQuery.
      expect(
        (
          await searchQueryForLookupMode(
            db,
            BUNDLE_SCOPE,
            { from: "fr", to: "mnk" },
            "maison",
            false,
            ENGLISH_CAPABLE,
          )
        ).ir_ids,
      ).toEqual(["rec-house"]);
      expect(
        (await searchQuery(db, BUNDLE_SCOPE, "source_to_target", "maison", false)).ir_ids,
      ).toEqual(["rec-house"]);
      expect(
        (await searchQuery(db, BUNDLE_SCOPE, "target_to_source", "bón", false)).ir_ids,
      ).toEqual(["rec-house"]);
    } finally {
      db.close();
    }
  });
});

describe("searchQueryForLookupMode hyphen/space expansion", () => {
  const CAPABLE = ENGLISH_CAPABLE;

  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine
    }
  });

  async function seedExpansionIndex(db: IDBDatabase): Promise<void> {
    await putSearchIndexEntry(db, "src_casefold", "grand-pere", ["fr-grand"]);
    await putSearchIndexEntry(db, "src_casefold", "grand pere", ["fr-grand-spaced"]);
    await putSearchIndexEntry(db, "src_casefold", "enfant", ["fr-enfant"]);
    await putSearchIndexEntry(db, "src_casefold", "enfance", ["fr-enfance"]);
    await putSearchIndexEntry(db, "en_casefold", "pick up", ["en-pickup"]);
    await putSearchIndexEntry(db, "en_casefold", "right hand", ["en-right"]);
    await putSearchIndexEntry(db, "en_casefold", "house", ["en-house"]);
    await putSearchIndexEntry(db, "tgt_casefold", "duba-duba", ["mnk-duba"]);
    await putSearchIndexEntry(db, "tgt_casefold", "bolo", ["mnk-bolo"]);
    await putSearchIndexEntry(db, "ru_casefold", "grand-pere", ["ru-should-never"]);
    await putSearchIndexEntry(db, "tgt_casefold", "ߓߟߏ", ["nko-only"]);
  }

  it("keeps an original exact hit and does not retry variants", async () => {
    const db = await openSiralexDb();
    try {
      await seedExpansionIndex(db);
      const result = await searchQueryForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "fr", to: "mnk" },
        "grand pere",
        true,
        CAPABLE,
      );
      expect(result.ir_ids).toEqual(["fr-grand-spaced"]);
      expect(result.separator_variant_query ?? null).toBeNull();
      expect(result.matched_key).toBe("grand pere");
    } finally {
      db.close();
    }
  });

  it("retries FR hyphen/space variants after an exact miss", async () => {
    const db = await openSiralexDb();
    try {
      await putSearchIndexEntry(db, "src_casefold", "grand-pere", ["fr-grand"]);
      const result = await searchQueryForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "fr", to: "mnk" },
        "grand pere",
        true,
        CAPABLE,
      );
      expect(result.ir_ids).toEqual(["fr-grand"]);
      expect(result.separator_variant_query).toBe("grand-pere");
      expect(result.matched_key).toBe("grand-pere");
    } finally {
      db.close();
    }
  });

  it("retries EN hyphen/space variants after an exact miss", async () => {
    const db = await openSiralexDb();
    try {
      await seedExpansionIndex(db);
      const pick = await searchQueryForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "en", to: "mnk" },
        "pick-up",
        true,
        CAPABLE,
      );
      expect(pick.ir_ids).toEqual(["en-pickup"]);
      expect(pick.separator_variant_query).toBe("pick up");

      const right = await searchQueryForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "en", to: "mnk" },
        "right-hand",
        true,
        CAPABLE,
      );
      expect(right.ir_ids).toEqual(["en-right"]);
      expect(right.separator_variant_query).toBe("right hand");
    } finally {
      db.close();
    }
  });

  it("does not expand MNK source queries", async () => {
    const db = await openSiralexDb();
    try {
      await seedExpansionIndex(db);
      for (const mode of [
        { from: "mnk" as const, to: "fr" as const },
        { from: "mnk" as const, to: "en" as const },
      ]) {
        const result = await searchQueryForLookupMode(
          db,
          BUNDLE_SCOPE,
          mode,
          "duba duba",
          true,
          CAPABLE,
        );
        expect(result.ir_ids).toEqual([]);
        expect(result.separator_variant_query ?? null).toBeNull();
      }
    } finally {
      db.close();
    }
  });

  it("does not return Russian keys or synthesize N’Ko from Latin", async () => {
    const db = await openSiralexDb();
    try {
      await putSearchIndexEntry(db, "src_casefold", "grand-pere", ["fr-grand"]);
      await putSearchIndexEntry(db, "ru_casefold", "grand-pere", ["ru-should-never"]);
      const result = await searchQueryForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "fr", to: "mnk" },
        "grand pere",
        true,
        CAPABLE,
      );
      expect(result.ir_ids).toEqual(["fr-grand"]);
      expect(result.ir_ids).not.toContain("ru-should-never");
      expect(JSON.stringify(result)).not.toContain("ru-should-never");
      expect(JSON.stringify(result)).not.toMatch(/\u07c0|\u07cf|\u07d3/);
    } finally {
      db.close();
    }
  });

  it("does not expand via the legacy searchQuery adapter", async () => {
    const db = await openSiralexDb();
    try {
      await putSearchIndexEntry(db, "src_casefold", "grand-pere", ["fr-grand"]);
      const result = await searchQuery(db, BUNDLE_SCOPE, "source_to_target", "grand pere", true);
      expect(result.ir_ids).toEqual([]);
      expect(result.separator_variant_query ?? null).toBeNull();
    } finally {
      db.close();
    }
  });
});
