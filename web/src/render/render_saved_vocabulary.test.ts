// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import type { LearningRecordV1 } from "../learning/learning_record_types";
import { LEARNING_RECORD_SCHEMA_VERSION } from "../learning/learning_record_types";
import type { SavedVocabularyModel, SavedVocabularyRowVm } from "../learning/saved_vocabulary_session";
import { rowKey } from "../learning/saved_vocabulary_session";
import type { EnrichedRecord } from "../types/records";
import { renderSavedVocabulary } from "./render_saved_vocabulary";

function makeLearningRecord(overrides: Partial<LearningRecordV1> = {}): LearningRecordV1 {
  return {
    schema_version: LEARNING_RECORD_SCHEMA_VERSION,
    bundle_id: "bundle-a",
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: "sha256:a",
    storage_scope_id: "bundle-a::sha256:a",
    status: "still_learning",
    created_at: "2026-07-29T12:00:00.000Z",
    display_cache: { headword_latin: "kùn", gloss_short: "tête" },
    last_reviewed: null,
    review_count: 0,
    ...overrides,
  };
}

function makeLiveEntry(): EnrichedRecord {
  return {
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    source_id: "s",
    norm_version: "norm_v3",
    preferred_form: "kùn",
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: "kùn",
      headword_nko_provided: "ߞߎ߲",
      senses: [{ gloss_fr: "tête" }],
    },
  };
}

function resolvedRow(overrides: Partial<SavedVocabularyRowVm & { state: "resolved" }> = {}): SavedVocabularyRowVm {
  const liveEntry = makeLiveEntry();
  return {
    state: "resolved",
    bundle_id: "bundle-a",
    ir_id: "lex-1",
    learningRecord: makeLearningRecord(),
    liveEntry,
    primaryText: "kùn",
    nkoText: "ߞߎ߲",
    secondaryText: "tête",
    ...overrides,
  };
}

function unresolvedRow(): SavedVocabularyRowVm {
  return {
    state: "unresolved",
    bundle_id: "bundle-a",
    ir_id: "lex-missing",
    learningRecord: makeLearningRecord({ ir_id: "lex-missing" }),
    primaryText: "ghost",
    secondaryText: "cache",
    reason: "entry_missing",
  };
}

describe("LS1I3 Saved Vocabulary renderer", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("renders loading, empty, unavailable, and error states", () => {
    for (const surface of ["loading", "empty", "unavailable", "error"] as const) {
      const { root } = renderSavedVocabulary({ surface }, {
        onBack: () => undefined,
        onOpen: () => undefined,
        onRemove: () => undefined,
      });
      expect(root.querySelector("#saved-vocab-heading")?.textContent).toBe("Saved vocabulary");
      expect(root.querySelector(".saved-vocab-back")).not.toBeNull();
      expect(root.querySelector(".saved-vocab-list")).toBeNull();
    }
  });

  it("renders populated resolved and unresolved rows", () => {
    const model: SavedVocabularyModel = {
      surface: "populated",
      rows: [resolvedRow(), unresolvedRow()],
      rowErrors: {},
    };
    const { root } = renderSavedVocabulary(model, {
      onBack: () => undefined,
      onOpen: () => undefined,
      onRemove: () => undefined,
    });
    const list = root.querySelector(".saved-vocab-list");
    expect(list?.tagName).toBe("UL");
    expect(list?.children.length).toBe(2);
    expect(root.textContent).toContain("Unavailable in this dictionary");
    expect(root.querySelectorAll(".saved-vocab-open").length).toBe(1);
    expect(root.querySelectorAll(".saved-vocab-remove").length).toBe(2);
  });

  it("invokes Open only for resolved rows and Remove for both", () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    const model: SavedVocabularyModel = {
      surface: "populated",
      rows: [resolvedRow(), unresolvedRow()],
      rowErrors: {},
    };
    const { root } = renderSavedVocabulary(model, {
      onBack: () => undefined,
      onOpen,
      onRemove,
    });
    root.querySelector<HTMLButtonElement>(".saved-vocab-open")!.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
    root.querySelectorAll<HTMLButtonElement>(".saved-vocab-remove").forEach((btn) => btn.click());
    expect(onRemove).toHaveBeenCalledTimes(2);
  });

  it("disables row actions while removing and shows row error", () => {
    const key = rowKey("bundle-a", "lex-1");
    const model: SavedVocabularyModel = {
      surface: "removing",
      rows: [resolvedRow()],
      removingKey: key,
      rowErrors: {},
    };
    const { root } = renderSavedVocabulary(model, {
      onBack: () => undefined,
      onOpen: () => undefined,
      onRemove: () => undefined,
    });
    expect(root.querySelector<HTMLButtonElement>(".saved-vocab-open")!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>(".saved-vocab-remove")!.disabled).toBe(true);
    expect(root.querySelector("[aria-busy='true']")).not.toBeNull();

    const errored: SavedVocabularyModel = {
      surface: "populated",
      rows: [resolvedRow()],
      rowErrors: { [key]: "remove_failed" },
    };
    const view = renderSavedVocabulary(errored, {
      onBack: () => undefined,
      onOpen: () => undefined,
      onRemove: () => undefined,
    });
    expect(view.root.querySelector(".saved-vocab-row-error")?.textContent).toContain("Couldn't remove");
  });

  it("fires Back callback", () => {
    const onBack = vi.fn();
    const { root } = renderSavedVocabulary({ surface: "empty" }, {
      onBack,
      onOpen: () => undefined,
      onRemove: () => undefined,
    });
    root.querySelector<HTMLButtonElement>(".saved-vocab-back")!.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
