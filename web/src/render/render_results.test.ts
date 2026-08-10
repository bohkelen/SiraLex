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

const LEXICON_MINIMAL: EnrichedRecord = {
  ir_id: "record-minimal",
  ir_kind: "lexicon_entry",
  source_id: "src-test",
  norm_version: "norm-test",
  preferred_form: "bólo",
  variant_forms: ["bólo"],
  search_keys: {},
  display: {
    headword_latin: "bólo",
    senses: [],
  },
};

function makeContext(
  record: EnrichedRecord,
  overrides: Partial<ResultDisplayContext> = {},
): ResultDisplayContext {
  return {
    rawQuery: "main",
    lookupMode: { from: "fr", to: "mnk" },
    searchDirection: "source_to_target",
    matched_key_type: "casefold",
    matched_key: "main",
    sourceLabel: "Français",
    targetLabel: "Maninka",
    record,
    ...overrides,
  };
}

describe("UX2I3 result presentation", () => {
  beforeEach(() => {
    setCurrentLocale("fr");
  });

  it("renders lexicon_entry headword as primary lexical content with POS and gloss when available", () => {
    const list = renderResultsList(
      [
        makeContext(LEXICON_RECORD, {
          rawQuery: "Kun",
          searchDirection: "target_to_source",
          matched_key: "kun",
        }),
      ],
      () => undefined,
    );

    expect(list?.querySelector(".ux2-result-row-lexicon")).not.toBeNull();
    expect(list?.querySelector(".ux2-result-headword")?.textContent).toBe("Kun");
    expect(list?.querySelector(".ux2-result-pos")?.textContent).toBe("v");
    expect(list?.querySelector(".ux2-result-gloss")?.textContent).toBe("fermer la bouche");
    expect(list?.textContent).not.toContain("Direction :");
    expect(list?.textContent).not.toContain("Sens possible :");
    expect(list?.textContent).not.toContain("best");
    expect(list?.querySelector(".ux2-result-rank")).toBeNull();
  });

  it("shows localized unavailable copy when no FR/EN gloss exists", () => {
    const list = renderResultsList(
      [makeContext(LEXICON_MINIMAL, { rawQuery: "bólo", matched_key: "bolo" })],
      () => undefined,
    );

    expect(list?.querySelector(".ux2-result-headword")?.textContent).toBe("bólo");
    expect(list?.querySelector(".ux2-result-pos")).toBeNull();
    const gloss = list?.querySelector('[data-testid="result-gloss"]');
    expect(gloss?.getAttribute("data-gloss-unavailable")).toBe("true");
    expect(gloss?.textContent).toMatch(/pas de traduction|no translation/i);
  });

  it("does not mislabel index_mapping as lexicon_entry", () => {
    const list = renderResultsList([makeContext(INDEX_RECORD)], () => undefined);

    expect(list?.querySelector(".ux2-result-row-mapping")).not.toBeNull();
    expect(list?.querySelector(".ux2-result-row-lexicon")).toBeNull();
    expect(list?.querySelector(".ux2-result-headword")).toBeNull();
    expect(list?.querySelector(".ux2-result-source")?.textContent).toBe("main");
    expect(list?.querySelector(".ux2-result-targets")?.textContent).toContain("bólo · bólofɛdɛ");
    expect(list?.querySelector(".ux2-result-pos")).toBeNull();
  });

  it("preserves result order and adds no best-match decoration", () => {
    const list = renderResultsList(
      [makeContext(INDEX_RECORD), makeContext(LEXICON_RECORD, { rawQuery: "Kun" })],
      () => undefined,
    );
    const rows = list?.querySelectorAll(".ux2-result-row");
    expect(rows?.length).toBe(2);
    expect(rows?.[0]?.classList.contains("ux2-result-row-mapping")).toBe(true);
    expect(rows?.[1]?.classList.contains("ux2-result-row-lexicon")).toBe(true);
    expect(list?.textContent).not.toMatch(/best match|meilleur|recommended|preferr/i);
    expect(list?.querySelector("[data-rank], .ux2-result-rank-bar")).toBeNull();
  });

  it("keeps neutral query hint and Why-this-result semantics", () => {
    const list = renderResultsList(
      [makeContext(INDEX_RECORD, { rawQuery: "mains", matched_key: "mains" })],
      () => undefined,
    );

    expect(list?.querySelector(".result-query-hint")?.textContent).toBe(
      "Résultat trouvé pour « mains ».",
    );
    expect(list?.querySelector(".result-why summary")?.textContent).toBe("Pourquoi ce résultat ?");
    expect(list?.textContent).toContain("Même entrée que « main ».");
    expect(list?.textContent).not.toContain("Alias validé");
    expect(list?.textContent).not.toContain("Supplément validé");
  });

  it("keeps internal match metadata out of ordinary result summary", () => {
    const list = renderResultsList(
      [makeContext(INDEX_RECORD, { rawQuery: "mains", matched_key: "mains" })],
      () => undefined,
    );

    expect(list?.textContent).not.toContain("matched_key");
    expect(list?.textContent).not.toContain("casefold");
    expect(list?.textContent).not.toContain("ir_id");
    expect(list?.textContent).not.toContain("record-main");
    expect(list?.textContent).not.toContain("source index");
  });
});

describe("Phase 7G result rendering", () => {
  beforeEach(() => {
    setCurrentLocale("fr");
  });

  it("returns improved empty-state copy", () => {
    expect(getNoResultMessage("inconnu")).toBe(
      "Aucun résultat pour « inconnu ». Essayez une autre orthographe ou un autre mot.",
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
      "Aucun résultat pour « inconnu ». Essayez une autre orthographe ou un autre mot.",
    );
    expect(singleWordMiss).not.toContain("un mot à la fois");
    expect(singleWordMiss).not.toContain("sens de recherche");

    setCurrentLocale("en");
    const enSingleWordMiss = getNoResultMessage("unknownlemma");
    expect(enSingleWordMiss).toBe(
      'No results for "unknownlemma". Try another spelling or another word.',
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
    setCurrentLocale("en");
    expect(typeof getNoResultMessage).toBe("function");
    expect(getNoResultMessage("some multiword miss")).toBe(
      "Try searching one word at a time.",
    );
  });
});

describe("ML1D3 LookupMode-aware result glosses", () => {
  const BILINGUAL: EnrichedRecord = {
    ir_id: "record-house",
    ir_kind: "lexicon_entry",
    source_id: "src-test",
    norm_version: "norm-test",
    preferred_form: "house_mnk",
    variant_forms: ["house_mnk"],
    search_keys: {},
    display: {
      headword_latin: "house_mnk",
      senses: [{ gloss_fr: "maison", gloss_en: "house", gloss_ru: "дом" }],
    },
  };

  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("prefers EN then FR for EN→MNK and never Russian", () => {
    const list = renderResultsList(
      [
        makeContext(BILINGUAL, {
          lookupMode: { from: "en", to: "mnk" },
          rawQuery: "house",
        }),
      ],
      () => undefined,
    );
    const gloss = list?.querySelector('[data-testid="result-gloss"]');
    expect(gloss?.textContent).toBe("house");
    expect(gloss?.getAttribute("data-gloss-lang")).toBe("en");
    expect(list?.textContent).not.toContain("maison");
    expect(list?.textContent).not.toContain("дом");
  });

  it("prefers FR then EN for FR→MNK", () => {
    const list = renderResultsList(
      [
        makeContext(BILINGUAL, {
          lookupMode: { from: "fr", to: "mnk" },
          rawQuery: "maison",
        }),
      ],
      () => undefined,
    );
    const gloss = list?.querySelector('[data-testid="result-gloss"]');
    expect(gloss?.textContent).toBe("maison");
    expect(gloss?.getAttribute("data-gloss-lang")).toBe("fr");
    expect(gloss?.textContent).not.toContain("house");
    expect(list?.textContent).not.toContain("дом");
  });

  it("RL1: RU-only record shows unavailable and never Russian", () => {
    const ruOnly: EnrichedRecord = {
      ...BILINGUAL,
      ir_id: "record-ru-only",
      display: {
        headword_latin: "house_mnk",
        senses: [{ gloss_ru: "дом" }],
      },
    };
    const list = renderResultsList(
      [makeContext(ruOnly, { lookupMode: { from: "en", to: "mnk" }, rawQuery: "x" })],
      () => undefined,
    );
    const gloss = list?.querySelector('[data-testid="result-gloss"]');
    expect(gloss?.getAttribute("data-gloss-unavailable")).toBe("true");
    expect(list?.textContent).not.toContain("дом");
  });

  it("keeps immutable result LookupMode when a different mode is current elsewhere", () => {
    const settled = makeContext(BILINGUAL, {
      lookupMode: { from: "en", to: "mnk" },
      rawQuery: "house",
    });
    // Re-render as if partner switched to FR without a new search.
    const list = renderResultsList([settled], () => undefined);
    expect(list?.querySelector('[data-testid="result-gloss"]')?.textContent).toBe("house");
  });

  it("UI locale does not change gloss selection for a fixed LookupMode", () => {
    setCurrentLocale("fr");
    const list = renderResultsList(
      [makeContext(BILINGUAL, { lookupMode: { from: "en", to: "mnk" } })],
      () => undefined,
    );
    expect(list?.querySelector('[data-testid="result-gloss"]')?.textContent).toBe("house");
  });
});

describe("Phase 7G entry detail cleanup", () => {
  beforeEach(() => {
    setCurrentLocale("fr");
  });

  it("hides ordinary-user internal metadata in detail pages", () => {
    const detail = renderEntryDetail(INDEX_RECORD, { onBack: () => undefined });

    expect(detail.root.textContent).toContain("main");
    expect(detail.root.textContent).toContain("bólo");
    expect(detail.root.textContent).not.toContain("ir_id");
    expect(detail.root.textContent).not.toContain("record-main");
    expect(detail.root.textContent).not.toContain("src-test");
    expect(detail.root.textContent).not.toContain("norm-test");
    expect(detail.root.querySelector(".entry-pos")).toBeNull();
    expect(detail.root.textContent).not.toMatch(/\bfr\b/);
    expect(detail.root.textContent).not.toContain("e1");
  });
});
