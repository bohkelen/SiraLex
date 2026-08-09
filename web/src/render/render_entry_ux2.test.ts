// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import type { EnrichedRecord } from "../types/records";
import { renderEntryDetail, showTargetEntryUnavailable } from "./render_entry";

const FULL_LEXICON: EnrichedRecord = {
  ir_id: "record-full",
  ir_kind: "lexicon_entry",
  source_id: "src-test",
  norm_version: "norm-test",
  preferred_form: "bólo",
  variant_forms: ["bólo"],
  search_keys: {},
  display: {
    headword_latin: "bólo",
    headword_nko_provided: "ߓߏߟߏ",
    ps_raw: "n.",
    variants_raw: ["bolo"],
    synonyms_raw: ["tɛ́ge"],
    etymology_raw: "from older root",
    literal_meaning_raw: "hand thing",
    corpus_count: 12,
    senses: [
      {
        sense_num: 1,
        gloss_fr: "main",
        gloss_en: "hand",
        gloss_ru: "рука",
        usage_note: "common",
        synonyms_raw: ["tége"],
        examples: [
          {
            text_latin: "a kùn",
            text_nko_provided: "ߊ ߞߎ߲",
            trans_fr: "sa tête",
            trans_en: "his head",
            source_attribution: "corpus note",
          },
        ],
        sub_entries: [
          {
            text: "bólo fɛ́",
            nko: "ߓߏߟߏ ߝߍ",
            gloss_fr: "près de la main",
            gloss_en: "near the hand",
          },
        ],
      },
      {
        sense_num: 2,
        gloss_fr: "bras",
        gloss_en: "arm",
      },
    ],
  },
};

const MINIMAL_LEXICON: EnrichedRecord = {
  ir_id: "record-min",
  ir_kind: "lexicon_entry",
  source_id: "src-test",
  norm_version: "norm-test",
  preferred_form: "kun",
  variant_forms: [],
  search_keys: {},
  display: {
    headword_latin: "kun",
  },
};

const MIXED_LEXICON: EnrichedRecord = {
  ir_id: "record-mixed",
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
      { lexicon_url: "../lexicon/b.htm", anchor: "e1", display_text: "bólo" },
      { lexicon_url: "../lexicon/b.htm", anchor: "e2", display_text: "bólofɛdɛ" },
      { lexicon_url: "../lexicon/b.htm", anchor: "e3", display_text: "kɔ̀ɲɛ" },
    ],
  },
};

describe("UX2I4 entry presentation", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("renders a full lexicon hierarchy with N’Ko semantics and preserved senses", () => {
    const { root } = renderEntryDetail(FULL_LEXICON, {
      onBack: () => undefined,
      learning: {
        initialState: "not_saved",
        onSave: () => undefined,
        onUnsave: () => undefined,
      },
      onSuggestCorrection: () => undefined,
    });

    const headword = root.querySelector(".entry-headword");
    expect(headword?.tagName).toBe("H2");
    expect(headword?.textContent).toBe("bólo");
    expect(root.querySelector(".entry-pos")?.textContent).toBe("n.");

    const headNko = root.querySelector(".entry-nko");
    expect(headNko?.getAttribute("lang")).toBe("nqo");
    expect(headNko?.getAttribute("dir")).toBe("rtl");
    expect(headNko?.classList.contains("ux2-text-nko")).toBe(true);

    const senses = root.querySelectorAll(".ux2-entry-sense");
    expect(senses.length).toBe(2);
    const glosses = root.querySelectorAll('[data-testid="entry-gloss"]');
    expect(glosses[0]?.textContent).toBe("main");
    expect(glosses[0]?.getAttribute("data-gloss-lang")).toBe("fr");
    expect(glosses[1]?.textContent).toBe("bras");
    expect(root.textContent).not.toContain("рука");
    expect(root.querySelector('[data-testid="entry-example-trans"]')?.textContent).toBe(
      "sa tête",
    );
    expect(root.querySelector('[data-testid="entry-subentry-gloss"]')?.textContent).toBe(
      "près de la main",
    );

    const exampleNko = root.querySelector(".example-nko");
    expect(exampleNko?.getAttribute("lang")).toBe("nqo");
    expect(exampleNko?.getAttribute("dir")).toBe("rtl");

    const subNko = root.querySelector(".subentry-nko");
    expect(subNko?.getAttribute("lang")).toBe("nqo");
    expect(subNko?.getAttribute("dir")).toBe("rtl");

    expect(root.textContent).toContain("Variants");
    expect(root.textContent).toContain("Synonyms");
    expect(root.textContent).toContain("Etymology");
    expect(root.textContent).toContain("Literal meaning");
    expect(root.textContent).toContain("Source information");
    expect(root.querySelector("#entry-learning-save")).not.toBeNull();
    expect(root.querySelector("#entry-suggest-correction")?.textContent).toBe(
      "Suggest correction →",
    );

    const actions = root.querySelector(".ux2-entry-actions");
    const sensesWrap = root.querySelector(".entry-senses");
    expect(actions && sensesWrap).toBeTruthy();
    expect(
      actions!.compareDocumentPosition(sensesWrap!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("ML1D3 prefers English glosses for EN LookupMode and never Russian", () => {
    const { root } = renderEntryDetail(FULL_LEXICON, {
      onBack: () => undefined,
      presentationLookupMode: { from: "en", to: "mnk" },
    });
    const glosses = root.querySelectorAll('[data-testid="entry-gloss"]');
    expect(glosses[0]?.textContent).toBe("hand");
    expect(glosses[0]?.getAttribute("data-gloss-lang")).toBe("en");
    expect(glosses[1]?.textContent).toBe("arm");
    expect(root.querySelectorAll('[data-testid="entry-gloss"]')[0]?.textContent).not.toBe("main");
    expect(root.textContent).not.toContain("рука");
    expect(root.querySelector('[data-testid="entry-example-trans"]')?.textContent).toBe(
      "his head",
    );
  });

  it("ML1D3 French UI labels do not change EN gloss selection", () => {
    setCurrentLocale("fr");
    const { root } = renderEntryDetail(FULL_LEXICON, {
      onBack: () => undefined,
      presentationLookupMode: { from: "mnk", to: "en" },
    });
    expect(root.querySelector('[data-testid="entry-gloss"]')?.textContent).toBe("hand");
    expect(root.textContent).toContain("Exemples");
  });

  it("omits empty optional shells for a minimal Latin-only entry", () => {
    const { root } = renderEntryDetail(MINIMAL_LEXICON, { onBack: () => undefined });
    expect(root.querySelector(".entry-headword")?.textContent).toBe("kun");
    expect(root.querySelector(".entry-nko")).toBeNull();
    expect(root.querySelector(".entry-pos")).toBeNull();
    expect(root.querySelector(".entry-senses")).toBeNull();
    expect(root.querySelector(".entry-example")).toBeNull();
    expect(root.querySelector(".ux2-entry-section")).toBeNull();
    expect(root.textContent).not.toMatch(/Pronunciation|IPA|\/.+\/|N\/A/i);
  });

  it("keeps mixed Latin/POS/gloss hierarchy coherent without N’Ko or examples", () => {
    const { root } = renderEntryDetail(MIXED_LEXICON, { onBack: () => undefined });
    expect(root.querySelector(".entry-headword")?.textContent).toBe("Kun");
    expect(root.querySelector(".entry-pos")?.textContent).toBe("v");
    expect(root.querySelector(".ux2-entry-gloss")?.textContent).toBe("fermer la bouche");
    expect(root.querySelector(".entry-nko")).toBeNull();
    expect(root.querySelector(".entry-example")).toBeNull();
  });

  it("does not synthesize pronunciation for ordinary lexicon entries", () => {
    const { root } = renderEntryDetail(MIXED_LEXICON, { onBack: () => undefined });
    expect(root.textContent).not.toContain("/bó.lo/");
    expect(root.textContent).not.toMatch(/\bIPA\b/);
    expect(root.textContent).not.toMatch(/Pronunciation/i);
  });

  it("uses backLabel when provided", () => {
    const { root } = renderEntryDetail(MIXED_LEXICON, {
      onBack: () => undefined,
      backLabel: "← Back to saved",
    });
    expect(root.querySelector(".entry-back")?.textContent).toBe("← Back to saved");
  });

  it("renders index mapping targets in order without Learning/CF1 or fabricated glosses", () => {
    const opened: string[] = [];
    const { root } = renderEntryDetail(INDEX_RECORD, {
      onBack: () => undefined,
      onOpenTargetEntry: (target) => opened.push(target.display_text),
      onSuggestCorrection: () => undefined,
      learning: {
        initialState: "not_saved",
        onSave: () => undefined,
        onUnsave: () => undefined,
      },
    });

    expect(root.querySelector(".entry-headword")?.textContent).toBe("main");
    const rows = [...root.querySelectorAll("button.target-link .target-text")].map(
      (node) => node.textContent,
    );
    expect(rows).toEqual(["bólo", "bólofɛdɛ", "kɔ̀ɲɛ"]);
    expect(root.querySelector("#entry-learning-save")).toBeNull();
    expect(root.querySelector("#entry-suggest-correction")).toBeNull();
    expect(root.querySelector(".entry-pos")).toBeNull();
    expect(root.querySelector(".ux2-entry-gloss")).toBeNull();

    root.querySelectorAll<HTMLButtonElement>("button.target-link")[1]!.click();
    expect(opened).toEqual(["bólofɛdɛ"]);

    showTargetEntryUnavailable(root);
    expect(root.querySelector<HTMLElement>("#entry-target-status")?.hidden).toBe(false);
  });
});
