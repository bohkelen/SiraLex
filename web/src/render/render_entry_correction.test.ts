// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import type { EnrichedRecord } from "../types/records";
import { renderEntryDetail } from "./render_entry";

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
    headword_nko_provided: "ߞߎ߲",
    ps_raw: "v",
    senses: [{ gloss_fr: "fermer la bouche" }],
    corpus_count: 3,
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
    target_entries: [{ lexicon_url: "../lexicon/b.htm", anchor: "e1", display_text: "bólo" }],
  },
};

describe("CF1I3 entry Suggest a correction affordance", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("shows Suggest after lexical content and before meta on lexicon entries", () => {
    const onSuggest = vi.fn();
    const { root } = renderEntryDetail(LEXICON_RECORD, {
      onBack: () => undefined,
      onSuggestCorrection: onSuggest,
    });
    const suggest = root.querySelector<HTMLButtonElement>("#entry-suggest-correction");
    expect(suggest).not.toBeNull();
    expect(suggest!.textContent).toBe("Suggest a correction");

    const senses = root.querySelector(".entry-senses");
    const actions = root.querySelector(".entry-correction-actions");
    const meta = root.querySelector(".entry-meta");
    expect(senses).not.toBeNull();
    expect(actions).not.toBeNull();
    expect(meta).not.toBeNull();
    expect(
      senses!.compareDocumentPosition(actions!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      actions!.compareDocumentPosition(meta!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    suggest!.click();
    expect(onSuggest).toHaveBeenCalledTimes(1);
  });

  it("does not show Suggest on index_mapping detail", () => {
    const { root } = renderEntryDetail(INDEX_RECORD, {
      onBack: () => undefined,
      onSuggestCorrection: () => undefined,
    });
    expect(root.querySelector("#entry-suggest-correction")).toBeNull();
  });

  it("shows French Suggest label", () => {
    setCurrentLocale("fr");
    const { root } = renderEntryDetail(LEXICON_RECORD, {
      onBack: () => undefined,
      onSuggestCorrection: () => undefined,
    });
    expect(root.querySelector("#entry-suggest-correction")?.textContent).toBe(
      "Suggérer une correction",
    );
  });
});
