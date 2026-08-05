// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import type { LearningSaveControlState } from "../learning/entry_learning_session";
import type { EnrichedRecord } from "../types/records";
import { applyLearningSaveControlState, renderEntryDetail } from "./render_entry";

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

function getSaveButton(root: HTMLElement): HTMLButtonElement {
  const btn = root.querySelector<HTMLButtonElement>("#entry-learning-save");
  expect(btn).not.toBeNull();
  return btn!;
}

function getErrorEl(root: HTMLElement): HTMLElement {
  const el = root.querySelector<HTMLElement>("#entry-learning-error");
  expect(el).not.toBeNull();
  return el!;
}

describe("LS1I2 entry Save affordance rendering", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("shows Learning control on lexicon entries", () => {
    const { root } = renderEntryDetail(LEXICON_RECORD, {
      onBack: () => undefined,
      learning: {
        initialState: "not_saved",
        onSave: () => undefined,
        onUnsave: () => undefined,
      },
    });
    expect(root.querySelector(".entry-learning-save")).not.toBeNull();
    expect(getSaveButton(root).querySelector(".entry-learning-save-label")?.textContent).toBe(
      "Save",
    );
    expect(getSaveButton(root).querySelector(".entry-learning-save-icon")).not.toBeNull();
  });

  it("does not show Learning control on index mappings", () => {
    const { root, setLearningSaveState } = renderEntryDetail(INDEX_RECORD, {
      onBack: () => undefined,
      learning: {
        initialState: "not_saved",
        onSave: () => undefined,
        onUnsave: () => undefined,
      },
    });
    expect(root.querySelector(".entry-learning-save")).toBeNull();
    expect(setLearningSaveState).toBeUndefined();
  });

  it("renders loading, not_saved, saved, saving, removing, and error states", () => {
    const { root, setLearningSaveState } = renderEntryDetail(LEXICON_RECORD, {
      onBack: () => undefined,
      learning: {
        initialState: "loading",
        onSave: () => undefined,
        onUnsave: () => undefined,
      },
    });
    const btn = getSaveButton(root);
    const label = () => btn.querySelector(".entry-learning-save-label")?.textContent;
    const err = getErrorEl(root);
    expect(label()).toBe("Checking saved status…");
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.getAttribute("aria-pressed")).toBe("false");

    setLearningSaveState!("not_saved");
    expect(label()).toBe("Save");
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute("aria-pressed")).toBe("false");

    setLearningSaveState!("saved");
    expect(label()).toBe("Saved");
    expect(btn.getAttribute("aria-pressed")).toBe("true");

    setLearningSaveState!("saving");
    expect(label()).toBe("Saving…");
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-pressed")).toBe("false");

    setLearningSaveState!("removing");
    expect(label()).toBe("Removing…");
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-pressed")).toBe("true");

    setLearningSaveState!("error_not_saved");
    expect(label()).toBe("Save");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain("Couldn't save");
    expect(btn.getAttribute("aria-describedby")).toBe(err.id);

    setLearningSaveState!("error_saved");
    expect(label()).toBe("Saved");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(err.textContent).toContain("Couldn't remove");
  });

  it("invokes Save/Unsave callbacks and suppresses clicks while busy", () => {
    const onSave = vi.fn();
    const onUnsave = vi.fn();
    const { root, setLearningSaveState } = renderEntryDetail(LEXICON_RECORD, {
      onBack: () => undefined,
      learning: { initialState: "not_saved", onSave, onUnsave },
    });
    const btn = getSaveButton(root);

    btn.click();
    expect(onSave).toHaveBeenCalledTimes(1);

    setLearningSaveState!("saving");
    btn.click();
    expect(onSave).toHaveBeenCalledTimes(1);

    setLearningSaveState!("saved");
    btn.click();
    expect(onUnsave).toHaveBeenCalledTimes(1);

    setLearningSaveState!("removing");
    btn.click();
    expect(onUnsave).toHaveBeenCalledTimes(1);
  });

  it("exposes accessibility attributes on the Save button", () => {
    const button = document.createElement("button");
    const errorEl = document.createElement("div");
    errorEl.id = "err";
    button.setAttribute("aria-describedby", errorEl.id);

    const states: LearningSaveControlState[] = ["loading", "saving", "removing", "not_saved", "saved"];
    for (const state of states) {
      applyLearningSaveControlState(button, errorEl, state);
      if (state === "loading" || state === "saving" || state === "removing") {
        expect(button.disabled).toBe(true);
        expect(button.getAttribute("aria-busy")).toBe("true");
      } else {
        expect(button.disabled).toBe(false);
        expect(button.getAttribute("aria-busy")).toBe("false");
      }
    }
  });

  it("hides control when unavailable", () => {
    const { root, setLearningSaveState } = renderEntryDetail(LEXICON_RECORD, {
      onBack: () => undefined,
      learning: {
        initialState: "unavailable",
        onSave: () => undefined,
        onUnsave: () => undefined,
      },
    });
    expect(getSaveButton(root).hidden).toBe(true);
    setLearningSaveState!("not_saved");
    expect(getSaveButton(root).hidden).toBe(false);
  });
});
