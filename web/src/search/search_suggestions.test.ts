import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { deleteSiralexDb, openSiralexDb, STORE_SEARCH_INDEX } from "../idb/siralex_db";
import { LookupCapabilityError } from "./lookup_mode";
import { searchQueryForLookupMode } from "./search_query";
import {
  lookupPrefixSuggestionsForLookupMode,
  rankPrefixSuggestionKeys,
  SEARCH_SUGGESTION_MAX_VISIBLE,
  shouldOfferPrefixSuggestions,
} from "./search_suggestions";

const BUNDLE_SCOPE = "bundle-sq1b-scope";

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

async function seedSq1bIndex(db: IDBDatabase): Promise<void> {
  const rows: Array<[string, string, string[]]> = [
    ["src_casefold", "enfant", ["fr-enfant"]],
    ["src_casefold", "enfance", ["fr-enfance"]],
    ["src_casefold", "enfant beni", ["fr-enfant-beni"]],
    ["src_casefold", "maison", ["fr-maison"]],
    ["en_casefold", "house", ["en-house"]],
    ["en_casefold", "hour", ["en-hour"]],
    ["en_casefold", "household work", ["en-household"]],
    ["en_casefold", "come", ["en-come"]],
    ["en_casefold", "come back", ["en-come-back"]],
    ["en_casefold", "comb", ["en-comb"]],
    ["tgt_casefold", "bolo", ["mnk-bolo"]],
    ["tgt_casefold", "bolokala", ["mnk-bolokala"]],
    ["tgt_casefold", "bon", ["mnk-bon"]],
    ["ru_casefold", "hou", ["ru-should-never"]],
    ["ru_casefold", "house", ["ru-should-never"]],
  ];
  for (const [keyType, key, irIds] of rows) {
    await putSearchIndexEntry(db, keyType, key, irIds);
  }
}

describe("rankPrefixSuggestionKeys", () => {
  it("orders exact equality, then shorter, then lexical", () => {
    expect(
      rankPrefixSuggestionKeys(["catalog", "catch", "cat", "category", "catalog"], "cat"),
    ).toEqual(["cat", "catch", "catalog", "category"]);
  });

  it("enforces the visible suggestion cap", () => {
    const candidates = Array.from({ length: 12 }, (_, i) => `com${String.fromCharCode(97 + i)}`);
    const ranked = rankPrefixSuggestionKeys(candidates, "com");
    expect(ranked).toHaveLength(SEARCH_SUGGESTION_MAX_VISIBLE);
    expect(ranked).toEqual(["coma", "comb", "comc", "comd", "come", "comf", "comg", "comh"]);
  });

  it("drops keys that do not share the prefix", () => {
    expect(rankPrefixSuggestionKeys(["house", "mouse"], "hou")).toEqual(["house"]);
  });
});

describe("shouldOfferPrefixSuggestions", () => {
  it("rejects empty and 1–2 character keys", () => {
    expect(shouldOfferPrefixSuggestions("")).toBe(false);
    expect(shouldOfferPrefixSuggestions("h")).toBe(false);
    expect(shouldOfferPrefixSuggestions("ho")).toBe(false);
  });

  it("allows 3+ normalized characters", () => {
    expect(shouldOfferPrefixSuggestions("hou")).toBe(true);
    expect(shouldOfferPrefixSuggestions("enf")).toBe(true);
  });
});

describe("lookupPrefixSuggestionsForLookupMode", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine
    }
  });

  it("returns no suggestions for empty, 1-char, and 2-char queries", async () => {
    const db = await openSiralexDb();
    try {
      await seedSq1bIndex(db);
      for (const query of ["", " ", "h", "ho", "en", "bo"]) {
        const result = await lookupPrefixSuggestionsForLookupMode(
          db,
          BUNDLE_SCOPE,
          { from: "en", to: "mnk" },
          query,
          true,
          ENGLISH_CAPABLE,
        );
        expect(result.suggestions).toEqual([]);
      }
    } finally {
      db.close();
    }
  });

  it("suggests English completions for hou and com without French leakage", async () => {
    const db = await openSiralexDb();
    try {
      await seedSq1bIndex(db);
      const hou = await lookupPrefixSuggestionsForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "en", to: "mnk" },
        "hou",
        true,
        ENGLISH_CAPABLE,
      );
      expect(hou.suggestions.map((row) => row.key)).toEqual(["hour", "house", "household work"]);

      const com = await lookupPrefixSuggestionsForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "en", to: "mnk" },
        "com",
        true,
        ENGLISH_CAPABLE,
      );
      expect(com.suggestions.map((row) => row.key)).toEqual(["comb", "come", "come back"]);

      const frHou = await lookupPrefixSuggestionsForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "fr", to: "mnk" },
        "hou",
        true,
        ENGLISH_CAPABLE,
      );
      expect(frHou.suggestions.map((row) => row.key)).not.toContain("house");
      expect(frHou.suggestions).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("suggests French completions for enf without English leakage", async () => {
    const db = await openSiralexDb();
    try {
      await seedSq1bIndex(db);
      const enf = await lookupPrefixSuggestionsForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "fr", to: "mnk" },
        "enf",
        true,
        ENGLISH_CAPABLE,
      );
      expect(enf.suggestions.map((row) => row.key)).toEqual([
        "enfant",
        "enfance",
        "enfant beni",
      ]);

      const enEnf = await lookupPrefixSuggestionsForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "en", to: "mnk" },
        "enf",
        true,
        ENGLISH_CAPABLE,
      );
      expect(enEnf.suggestions.map((row) => row.key)).not.toContain("enfant");
      expect(enEnf.suggestions).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("suggests Maninka tgt keys for MNK→FR and MNK→EN without FR/EN gloss keys", async () => {
    const db = await openSiralexDb();
    try {
      await seedSq1bIndex(db);
      for (const mode of [
        { from: "mnk" as const, to: "fr" as const },
        { from: "mnk" as const, to: "en" as const },
      ]) {
        const result = await lookupPrefixSuggestionsForLookupMode(
          db,
          BUNDLE_SCOPE,
          mode,
          "bol",
          true,
          ENGLISH_CAPABLE,
        );
        expect(result.suggestions.map((row) => row.key)).toEqual(["bolo", "bolokala"]);
        expect(result.suggestions.map((row) => row.key)).not.toContain("house");
        expect(result.suggestions.map((row) => row.key)).not.toContain("enfant");
      }
    } finally {
      db.close();
    }
  });

  it("never returns Russian keys", async () => {
    const db = await openSiralexDb();
    try {
      await seedSq1bIndex(db);
      const hou = await lookupPrefixSuggestionsForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "en", to: "mnk" },
        "hou",
        true,
        ENGLISH_CAPABLE,
      );
      expect(JSON.stringify(hou)).not.toContain("ru-should-never");
      expect(hou.suggestions.map((row) => row.key)).toEqual(["hour", "house", "household work"]);
    } finally {
      db.close();
    }
  });

  it("does not synthesize N’Ko suggestions from Latin prefixes", async () => {
    const db = await openSiralexDb();
    try {
      await putSearchIndexEntry(db, "tgt_casefold", "ߓߟߏ", ["nko-only"]);
      await putSearchIndexEntry(db, "tgt_casefold", "bolo", ["latin-bolo"]);
      const result = await lookupPrefixSuggestionsForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "mnk", to: "fr" },
        "bol",
        true,
        ENGLISH_CAPABLE,
      );
      expect(result.suggestions.map((row) => row.key)).toEqual(["bolo"]);
      expect(result.suggestions.some((row) => /\u07c0|\u07cf|\u07d3/.test(row.key))).toBe(false);
    } finally {
      db.close();
    }
  });

  it("fail-closes English prefix lookup without capability", async () => {
    const db = await openSiralexDb();
    try {
      await seedSq1bIndex(db);
      await expect(
        lookupPrefixSuggestionsForLookupMode(
          db,
          BUNDLE_SCOPE,
          { from: "en", to: "mnk" },
          "hou",
          true,
          {},
        ),
      ).rejects.toBeInstanceOf(LookupCapabilityError);
    } finally {
      db.close();
    }
  });

  it("leaves exact search postings unchanged when the complete key exists", async () => {
    const db = await openSiralexDb();
    try {
      await seedSq1bIndex(db);
      const exact = await searchQueryForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "en", to: "mnk" },
        "house",
        true,
        ENGLISH_CAPABLE,
      );
      expect(exact.ir_ids).toEqual(["en-house"]);
      expect(exact.matched_key).toBe("house");

      const prefix = await lookupPrefixSuggestionsForLookupMode(
        db,
        BUNDLE_SCOPE,
        { from: "en", to: "mnk" },
        "house",
        true,
        ENGLISH_CAPABLE,
      );
      // Prefix lookup may list the exact key among completions; it must not
      // replace or reorder exact ir_ids[] used by searchQueryForLookupMode.
      expect(exact.ir_ids).toEqual(["en-house"]);
      expect(prefix.suggestions[0]?.key).toBe("house");
    } finally {
      db.close();
    }
  });
});
