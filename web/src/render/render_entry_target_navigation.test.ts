// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import type { EnrichedRecord, TargetEntry } from "../types/records";
import { renderEntryDetail, showTargetEntryUnavailable } from "./render_entry";

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
      { lexicon_url: "../lexicon/b.htm", anchor: "lex-bolo", display_text: "bólo" },
      { lexicon_url: "../lexicon/b.htm", anchor: "lex-other", display_text: "kɔ̀ɲɛ" },
    ],
  },
};

const LEXICON: EnrichedRecord = {
  ir_id: "lex-bolo",
  ir_kind: "lexicon_entry",
  source_id: "src-test",
  norm_version: "norm-test",
  preferred_form: "bólo",
  variant_forms: [],
  search_keys: {},
  display: {
    headword_latin: "bólo",
    senses: [{ gloss_fr: "main" }],
  },
};

describe("index-mapping target entry navigation rendering", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("target links call onOpenTargetEntry with TargetEntry identity, not display text search", () => {
    const opened: TargetEntry[] = [];
    const { root } = renderEntryDetail(INDEX_RECORD, {
      onBack: () => undefined,
      onOpenTargetEntry: (target) => opened.push(target),
    });

    const buttons = root.querySelectorAll<HTMLButtonElement>("button.target-link");
    expect(buttons.length).toBe(2);
    expect(buttons[0]!.getAttribute("aria-label")).toBe("Open entry: bólo");
    buttons[0]!.click();
    expect(opened).toEqual([
      { lexicon_url: "../lexicon/b.htm", anchor: "lex-bolo", display_text: "bólo" },
    ]);
  });

  it("lexicon entry detail keeps Save affordance for the selected entry", () => {
    const { root } = renderEntryDetail(LEXICON, {
      onBack: () => undefined,
      learning: {
        initialState: "not_saved",
        onSave: () => undefined,
        onUnsave: () => undefined,
      },
    });
    expect(root.querySelector("#entry-learning-save")).not.toBeNull();
    expect(root.querySelector(".entry-headword")?.textContent).toBe("bólo");
  });

  it("showTargetEntryUnavailable reveals status without changing targets", () => {
    const onOpen = vi.fn();
    const { root } = renderEntryDetail(INDEX_RECORD, {
      onBack: () => undefined,
      onOpenTargetEntry: onOpen,
    });
    const status = root.querySelector<HTMLElement>("#entry-target-status");
    expect(status?.hidden).toBe(true);
    showTargetEntryUnavailable(root);
    expect(status?.hidden).toBe(false);
    expect(status?.textContent).toMatch(/unavailable/i);
    expect(root.querySelectorAll("button.target-link").length).toBe(2);
  });
});
