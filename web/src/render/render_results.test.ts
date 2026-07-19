// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from "vitest";

import { setCurrentLocale } from "../i18n";
import type { EnrichedRecord } from "../types/records";
import { renderEntryDetail } from "./render_entry";
import {
  getNoResultMessage,
  renderResultsList,
  type ResultDisplayContext,
} from "./render_results";

const INDEX_RECORD: EnrichedRecord = {
  ir_id: "record-main",
  ir_kind: "index_mapping",
  source_id: "src-test",
  norm_version: "norm-test",
  preferred_form: "main",
  variant_forms: ["main"],
  search_keys: {},
  display: {
    source_term: "main",
    source_lang: "fr",
    target_entries: [
      { lexicon_url: "../lexicon/b.htm", anchor: "e1", display_text: "bólo" },
      { lexicon_url: "../lexicon/b.htm", anchor: "e2", display_text: "bólofɛdɛ" },
      { lexicon_url: "../lexicon/b.htm", anchor: "e3", display_text: "kɔ̀ɲɛ" },
      { lexicon_url: "../lexicon/b.htm", anchor: "e4", display_text: "tínsan" },
      { lexicon_url: "../lexicon/b.htm", anchor: "e5", display_text: "tínsɔn" },
    ],
  },
};

const LEXICON_RECORD: EnrichedRecord = {
  ir_id: "record-kun",
  ir_kind: "lexicon_entry",
  source_id: "src-test",
  norm_version: "norm-test",
  preferred_form: "Kun",
  variant_forms: ["Kun"],
  search_keys: {},
  display: {
    headword_latin: "Kun",
    ps_raw: "v",
    senses: [{ gloss_fr: "fermer la bouche" }],
  },
};

function makeContext(
  record: EnrichedRecord,
  overrides: Partial<ResultDisplayContext> = {},
): ResultDisplayContext {
  return {
    rawQuery: "main",
    searchDirection: "source_to_target",
    matched_key_type: "casefold",
    matched_key: "main",
    sourceLabel: "Français",
    targetLabel: "Maninka",
    record,
    ...overrides,
  };
}

describe("Phase 7G result rendering", () => {
  beforeEach(() => {
    setCurrentLocale("fr");
  });

  it("renders compact labels for an exact source match", () => {
    const list = renderResultsList([makeContext(INDEX_RECORD)], () => undefined);

    expect(list).not.toBeNull();
    expect(list?.textContent).toContain("Direction :Français → Maninka");
    expect(list?.textContent).toContain("Entrée trouvée :main");
    expect(list?.textContent).toContain("Traductions possibles :bólo, bólofɛdɛ");
    expect(list?.textContent).toContain("+ 1 autres");
    expect(list?.querySelector(".result-query-hint")).toBeNull();
  });

  it("shows neutral query-diff copy for a plural alias-style match", () => {
    const list = renderResultsList(
      [makeContext(INDEX_RECORD, { rawQuery: "mains", matched_key: "mains" })],
      () => undefined,
    );

    expect(list?.querySelector(".result-query-hint")?.textContent).toBe(
      "Résultat trouvé pour « mains ».",
    );
    expect(list?.textContent).toContain("Même entrée que « main ».");
    expect(list?.textContent).not.toContain("Alias validé");
    expect(list?.textContent).not.toContain("Supplément validé");
  });

  it("uses neutral query-diff copy for a supplement-style match", () => {
    const sourceRecord: EnrichedRecord = {
      ...INDEX_RECORD,
      ir_id: "record-poil",
      preferred_form: "poil",
      display: {
        ...INDEX_RECORD.display!,
        source_term: "poil",
        target_entries: [{ lexicon_url: "../lexicon/p.htm", anchor: "e9", display_text: "sí" }],
      },
    };

    const list = renderResultsList(
      [makeContext(sourceRecord, { rawQuery: "poils", matched_key: "poils" })],
      () => undefined,
    );

    expect(list?.querySelector(".result-query-hint")?.textContent).toBe(
      "Résultat trouvé pour « poils ».",
    );
    expect(list?.textContent).toContain("Entrée source : « poil ».");
    expect(list?.textContent).not.toContain("source-index supplement");
    expect(list?.textContent).not.toContain("Provenance revue");
  });

  it("renders target-side direction and meaning labels clearly", () => {
    const list = renderResultsList(
      [
        makeContext(LEXICON_RECORD, {
          rawQuery: "Kun",
          searchDirection: "target_to_source",
          sourceLabel: "Français",
          targetLabel: "Maninka",
          matched_key: "kun",
        }),
      ],
      () => undefined,
    );

    expect(list?.textContent).toContain("Direction :Maninka → Français");
    expect(list?.textContent).toContain("Entrée trouvée :Kun");
    expect(list?.textContent).toContain("Sens possible :fermer la bouche");
  });

  it("keeps internal match metadata out of result cards", () => {
    const list = renderResultsList(
      [makeContext(INDEX_RECORD, { rawQuery: "mains", matched_key: "mains" })],
      () => undefined,
    );

    expect(list?.textContent).not.toContain("matched_key");
    expect(list?.textContent).not.toContain("casefold");
    expect(list?.textContent).not.toContain("ir_id");
    expect(list?.textContent).not.toContain("source index");
  });

  it("returns improved empty-state copy", () => {
    expect(getNoResultMessage("inconnu")).toBe(
      "Aucun résultat pour « inconnu ». Essayez une autre orthographe ou une autre forme.",
    );
  });

  it("returns phrase-miss copy for multi-word no-result queries", () => {
    expect(getNoResultMessage("ferme la bouche")).toBe(
      "Essayez de chercher un mot à la fois.",
    );
  });
});

describe("Phase 7N2E4J3 minimal phrase guidance", () => {
  it("returns FR phrase guidance for phrase-like misses", () => {
    setCurrentLocale("fr");
    expect(getNoResultMessage("comment dit-on école")).toBe(
      "Essayez de chercher un mot à la fois.",
    );
    expect(getNoResultMessage("merci beaucoup")).toBe(
      "Essayez de chercher un mot à la fois.",
    );
  });

  it("returns EN phrase guidance for phrase-like misses", () => {
    setCurrentLocale("en");
    expect(getNoResultMessage("comment dit-on école")).toBe(
      "Try searching one word at a time.",
    );
  });

  it("keeps single-word miss guidance (not phrase guidance)", () => {
    setCurrentLocale("fr");
    const singleWordMiss = getNoResultMessage("inconnu");
    expect(singleWordMiss).toBe(
      "Aucun résultat pour « inconnu ». Essayez une autre orthographe ou une autre forme.",
    );
    expect(singleWordMiss).not.toContain("un mot à la fois");
    expect(singleWordMiss).not.toContain("sens de recherche");

    setCurrentLocale("en");
    const enSingleWordMiss = getNoResultMessage("unknownlemma");
    expect(enSingleWordMiss).toBe(
      'No results for "unknownlemma". Try another spelling or form.',
    );
    expect(enSingleWordMiss).not.toBe("Try searching one word at a time.");
    expect(enSingleWordMiss).not.toContain("search direction");
  });

  it("does not return phrase guidance for empty or whitespace-only queries", () => {
    setCurrentLocale("en");
    expect(getNoResultMessage("")).not.toBe("Try searching one word at a time.");
    expect(getNoResultMessage("   ")).not.toBe("Try searching one word at a time.");
    setCurrentLocale("fr");
    expect(getNoResultMessage("")).not.toBe("Essayez de chercher un mot à la fois.");
    expect(getNoResultMessage("   ")).not.toBe("Essayez de chercher un mot à la fois.");
  });

  it("documents that phrase guidance is miss-path only (hits never call getNoResultMessage)", () => {
    // Search hits render result cards via renderResultsList; getNoResultMessage is only
    // used when ir_ids.length === 0. A phrase-like query that hits therefore never shows
    // phrase guidance. This assertion keeps the miss helper contract explicit.
    setCurrentLocale("en");
    expect(typeof getNoResultMessage).toBe("function");
    expect(getNoResultMessage("some multiword miss")).toBe(
      "Try searching one word at a time.",
    );
  });
});

describe("Phase 7G entry detail cleanup", () => {
  beforeEach(() => {
    setCurrentLocale("fr");
  });

  it("hides ordinary-user internal metadata in detail pages", () => {
    const detail = renderEntryDetail(INDEX_RECORD, { onBack: () => undefined });

    expect(detail.textContent).toContain("main");
    expect(detail.textContent).toContain("bólo");
    expect(detail.textContent).not.toContain("ir_id");
    expect(detail.textContent).not.toContain("record-main");
    expect(detail.textContent).not.toContain("src-test");
    expect(detail.textContent).not.toContain("norm-test");
    expect(detail.querySelector(".entry-pos")).toBeNull();
    expect(detail.textContent).not.toMatch(/\bfr\b/);
    expect(detail.textContent).not.toContain("e1");
  });
});
