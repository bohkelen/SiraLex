import { describe, expect, it } from "vitest";

import { computeSearchKeys, normalizeNfc, type SearchKeys } from "../norm/norm_v1";
import type { EnrichedRecord } from "../types/records";
import { partitionFrExactSourceTermHits } from "./search_result_ranking";
import { rankPrefixSuggestionKeys } from "./search_suggestions";
import type { LookupMode } from "./lookup_mode";

const FR_MNK: LookupMode = { from: "fr", to: "mnk" };
const EN_MNK: LookupMode = { from: "en", to: "mnk" };
const MNK_FR: LookupMode = { from: "mnk", to: "fr" };
const MNK_EN: LookupMode = { from: "mnk", to: "en" };

function mapping(irId: string, sourceTerm: string): EnrichedRecord {
  return {
    ir_id: irId,
    ir_kind: "index_mapping",
    source_id: "src_malipense",
    norm_version: "norm_v3",
    preferred_form: sourceTerm,
    variant_forms: [],
    search_keys: {},
    display: { source_term: sourceTerm, source_lang: "fr" },
  };
}

function lexicon(
  irId: string,
  headword: string,
  glossEn?: string,
  glossRu?: string,
): EnrichedRecord {
  return {
    ir_id: irId,
    ir_kind: "lexicon_entry",
    source_id: "src_malipense",
    norm_version: "norm_v3",
    preferred_form: headword,
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: headword,
      headword_nko_provided: "ߓߏ߲",
      senses: [{ gloss_en: glossEn, gloss_ru: glossRu, gloss_fr: "très" }],
    },
  };
}

function ids(records: readonly EnrichedRecord[]): string[] {
  return records.map((row) => row.ir_id);
}

function hitForQuery(
  query: string,
  keyType: keyof SearchKeys = "casefold",
): { matchedKey: string; matchedKeyType: keyof SearchKeys } {
  const key = computeSearchKeys([normalizeNfc(query.trim())])[keyType]?.[0];
  if (!key) throw new Error("expected normalized key");
  return { matchedKey: key, matchedKeyType: keyType };
}

describe("partitionFrExactSourceTermHits", () => {
  it("stable-partitions matches ahead of non-matches and keeps relative order", () => {
    const records = [
      mapping("a", "oh, mère!"),
      mapping("b", "mère"),
      mapping("c", "mère"),
      mapping("d", "homonyme de mon père/mère"),
    ];
    const ranked = partitionFrExactSourceTermHits(records, FR_MNK, hitForQuery("mère"));
    expect(ids(ranked)).toEqual(["b", "c", "a", "d"]);
  });

  it("promotes the generic mère mapping in the SQ1D featured order", () => {
    const records = [
      mapping("0f517a71c373f51d", "oh, mère!"),
      mapping("d540716db9321a83", "homonyme de mon père/mère (une formule d'adresse respectueuse à un garçon [une fille], quel que soit son nom)"),
      mapping("e5164efcdf5e6ca4", "mère"),
    ];
    const ranked = partitionFrExactSourceTermHits(records, FR_MNK, hitForQuery("mère"));
    expect(ids(ranked)).toEqual([
      "e5164efcdf5e6ca4",
      "0f517a71c373f51d",
      "d540716db9321a83",
    ]);
  });

  it("applies only to FR → MNK", () => {
    const records = [
      mapping("a", "oh, mère!"),
      mapping("b", "mère"),
    ];
    const hit = hitForQuery("mère");
    expect(ids(partitionFrExactSourceTermHits(records, EN_MNK, hit))).toEqual(["a", "b"]);
    expect(ids(partitionFrExactSourceTermHits(records, MNK_FR, hit))).toEqual(["a", "b"]);
    expect(ids(partitionFrExactSourceTermHits(records, MNK_EN, hit))).toEqual(["a", "b"]);
    expect(ids(partitionFrExactSourceTermHits(records, FR_MNK, hit))).toEqual(["b", "a"]);
  });

  it("does not promote EN lexicon rows by gloss or headword", () => {
    const records = [
      lexicon("lex-far", "pédekele", "very", "о́чень"),
      lexicon("lex-exact", "tɔ́n", "very", "о́чень"),
    ];
    const ranked = partitionFrExactSourceTermHits(records, EN_MNK, {
      matchedKey: "very",
      matchedKeyType: "casefold",
    });
    expect(ids(ranked)).toEqual(["lex-far", "lex-exact"]);
    expect(ranked[0]?.display).toMatchObject({ headword_nko_provided: "ߓߏ߲" });
  });

  it("does not promote MNK lexicon rows by form", () => {
    const records = [
      lexicon("hidden", "bòn"),
      lexicon("house", "bón"),
    ];
    expect(
      ids(
        partitionFrExactSourceTermHits(records, MNK_FR, {
          matchedKey: "bon",
          matchedKeyType: "casefold",
        }),
      ),
    ).toEqual(["hidden", "house"]);
  });

  it("uses the ladder matched key for hyphen/space variant hits", () => {
    const records = [
      mapping("other", "grand-mère"),
      mapping("hit", "grand-père"),
    ];
    const ranked = partitionFrExactSourceTermHits(records, FR_MNK, {
      matchedKey: "grand-pere",
      matchedKeyType: "diacritics_insensitive",
    });
    expect(ids(ranked)).toEqual(["hit", "other"]);
  });

  it("uses the ladder matched key for ligature variant hits", () => {
    const records = [
      mapping("noise", "sœur de lait"),
      mapping("hit", "soeur"),
    ];
    const ranked = partitionFrExactSourceTermHits(records, FR_MNK, {
      matchedKey: "soeur",
      matchedKeyType: "casefold",
    });
    expect(ids(ranked)).toEqual(["hit", "noise"]);
  });

  it("does not merge extra records from a lower ladder rung", () => {
    const returnedExactRung = [mapping("casefold-only", "bon")];
    const ranked = partitionFrExactSourceTermHits(returnedExactRung, FR_MNK, hitForQuery("bon"));
    expect(ids(ranked)).toEqual(["casefold-only"]);
    expect(ranked).toHaveLength(1);
  });

  it("preserves stored order when no source_term matches (moto-style)", () => {
    const records = [
      mapping("b5c9a49f6db2a991", "motocycle"),
      mapping("0a56b8047aeaf117", "motocyclette"),
    ];
    const ranked = partitionFrExactSourceTermHits(records, FR_MNK, hitForQuery("moto"));
    expect(ids(ranked)).toEqual(["b5c9a49f6db2a991", "0a56b8047aeaf117"]);
  });

  it("does not approximate source_term from preferred_form or rendered gloss", () => {
    const records: EnrichedRecord[] = [
      {
        ir_id: "no-display",
        ir_kind: "index_mapping",
        source_id: "src_malipense",
        norm_version: "norm_v3",
        preferred_form: "mère",
        variant_forms: [],
        search_keys: {},
      },
      mapping("vocative", "oh, mère!"),
    ];
    const ranked = partitionFrExactSourceTermHits(records, FR_MNK, hitForQuery("mère"));
    expect(ids(ranked)).toEqual(["no-display", "vocative"]);
  });

  it("does not invent Russian or N’Ko rows", () => {
    const records = [mapping("fr-only", "mère")];
    const ranked = partitionFrExactSourceTermHits(records, FR_MNK, hitForQuery("mère"));
    expect(ranked).toHaveLength(1);
    expect(ids(ranked)).toEqual(["fr-only"]);
    expect(JSON.stringify(ranked)).not.toMatch(/оч|[\u07C0-\u07FF]/);
  });

  it("leaves SQ1B suggestion ranking untouched", () => {
    expect(
      rankPrefixSuggestionKeys(["catalog", "catch", "cat", "category", "catalog"], "cat"),
    ).toEqual(["cat", "catch", "catalog", "category"]);
  });
});
