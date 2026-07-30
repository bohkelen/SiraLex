// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import type { LearningRecordV1 } from "../learning/learning_record_types";
import { LEARNING_RECORD_SCHEMA_VERSION } from "../learning/learning_record_types";
import type {
  SavedVocabularyModel,
  SavedVocabularyReviewStatus,
  SavedVocabularyRowVm,
} from "../learning/saved_vocabulary_session";
import { rowKey } from "../learning/saved_vocabulary_session";
import { deriveSavedVocabularyProgress } from "../learning/saved_vocabulary_progress";
import type { EnrichedRecord } from "../types/records";
import { formatReviewTimestamp, renderSavedVocabulary } from "./render_saved_vocabulary";

function withProgress(
  model: Omit<
    Extract<SavedVocabularyModel, { surface: "populated" | "removing" }>,
    "progress"
  >,
): SavedVocabularyModel {
  return {
    ...model,
    progress: deriveSavedVocabularyProgress(model.rows).progress,
  };
}

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

function reviewStatus(
  overrides: SavedVocabularyReviewStatus = { state: "not_reviewed", labelKey: "review.notReviewed" },
): SavedVocabularyReviewStatus {
  return overrides;
}

function resolvedRow(
  overrides: Partial<SavedVocabularyRowVm & { state: "resolved" }> = {},
): SavedVocabularyRowVm {
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
    reviewStatus: reviewStatus(),
    ...overrides,
  };
}

function unresolvedRow(
  overrides: Partial<SavedVocabularyRowVm & { state: "unresolved" }> = {},
): SavedVocabularyRowVm {
  return {
    state: "unresolved",
    bundle_id: "bundle-a",
    ir_id: "lex-missing",
    learningRecord: makeLearningRecord({ ir_id: "lex-missing" }),
    primaryText: "ghost",
    secondaryText: "cache",
    reason: "entry_missing",
    reviewStatus: reviewStatus(),
    ...overrides,
  };
}

function callbacks(extra: Partial<Parameters<typeof renderSavedVocabulary>[1]> = {}) {
  return {
    onBack: vi.fn(),
    onOpen: vi.fn(),
    onRemove: vi.fn(),
    onStartReview: vi.fn(),
    ...extra,
  };
}

describe("LS1I3 / LS2I4 Saved Vocabulary renderer", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("renders loading, empty, unavailable, and error states", () => {
    for (const surface of ["loading", "empty", "unavailable", "error"] as const) {
      const { root } = renderSavedVocabulary({ surface }, callbacks());
      expect(root.querySelector("#saved-vocab-heading")?.textContent).toBe("Saved vocabulary");
      expect(root.querySelector(".saved-vocab-back")).not.toBeNull();
      expect(root.querySelector(".saved-vocab-list")).toBeNull();
    }
  });

  it("omits Start Review on empty and shows it disabled while loading", () => {
    const empty = renderSavedVocabulary({ surface: "empty" }, callbacks());
    expect(empty.startReviewButton).toBeNull();

    const loading = renderSavedVocabulary({ surface: "loading" }, callbacks());
    expect(loading.startReviewButton?.disabled).toBe(true);
  });

  it("enables Start Review with resolved rows and fires once", () => {
    const cb = callbacks();
    const model = withProgress({
      surface: "populated",
      rows: [resolvedRow()],
      rowErrors: {},
      canStartReview: true,
    });
    const { root, startReviewButton } = renderSavedVocabulary(model, cb);
    expect(startReviewButton?.disabled).toBe(false);
    expect(root.querySelector("#saved-vocab-start-review")?.textContent).toBe("Start review");
    startReviewButton!.click();
    startReviewButton!.click();
    expect(cb.onStartReview).toHaveBeenCalledTimes(2);
  });

  it("disables Start Review for unresolved-only rows with explanation", () => {
    const cb = callbacks();
    const model = withProgress({
      surface: "populated",
      rows: [unresolvedRow()],
      rowErrors: {},
      canStartReview: false,
    });
    const { root, startReviewButton } = renderSavedVocabulary(model, cb);
    expect(startReviewButton?.disabled).toBe(true);
    expect(root.querySelector("#saved-vocab-start-review-hint")?.textContent).toContain(
      "No saved entries are currently available for review.",
    );
    expect(startReviewButton?.getAttribute("aria-describedby")).toBe(
      "saved-vocab-start-review-hint",
    );
    startReviewButton!.click();
    expect(cb.onStartReview).not.toHaveBeenCalled();
  });

  it("disables Start Review while removing", () => {
    const key = rowKey("bundle-a", "lex-1");
    const model = withProgress({
      surface: "removing",
      rows: [resolvedRow()],
      removingKey: key,
      rowErrors: {},
      canStartReview: true,
    });
    const { startReviewButton } = renderSavedVocabulary(model, callbacks());
    expect(startReviewButton?.disabled).toBe(true);
  });

  it("renders not-reviewed, still-learning, and remembered statuses", () => {
    const model = withProgress({
      surface: "populated",
      rows: [
        resolvedRow({
          ir_id: "a",
          reviewStatus: { state: "not_reviewed", labelKey: "review.notReviewed" },
        }),
        resolvedRow({
          ir_id: "b",
          reviewStatus: {
            state: "still_learning",
            labelKey: "review.stillLearning",
            last_reviewed: "2026-07-29T18:00:00.000Z",
          },
        }),
        resolvedRow({
          ir_id: "c",
          reviewStatus: {
            state: "remembered",
            labelKey: "review.remembered",
            last_reviewed: "2026-07-29T19:00:00.000Z",
          },
        }),
      ],
      rowErrors: {},
      canStartReview: true,
    });
    const { root } = renderSavedVocabulary(model, callbacks());
    expect(root.textContent).toContain("Not reviewed");
    expect(root.textContent).toContain("Still learning");
    expect(root.textContent).toContain("Remembered");
    expect(root.textContent).toContain("Last reviewed:");
    expect(root.textContent).not.toContain("review_count");
    expect(root.textContent).not.toMatch(/%/);
    expect(root.querySelector(".saved-vocab-review-count")).toBeNull();
  });

  it("hides last-reviewed for not-reviewed and skips unknown safely", () => {
    const model = withProgress({
      surface: "populated",
      rows: [
        resolvedRow({
          reviewStatus: { state: "not_reviewed", labelKey: "review.notReviewed" },
        }),
        resolvedRow({
          ir_id: "x",
          reviewStatus: { state: "unknown" },
        }),
      ],
      rowErrors: {},
      canStartReview: true,
    });
    const { root } = renderSavedVocabulary(model, callbacks());
    expect(root.querySelectorAll(".saved-vocab-last-reviewed").length).toBe(0);
    expect(root.querySelectorAll("[data-review-status]").length).toBe(1);
  });

  it("shows review status on unresolved rows without Open", () => {
    const model = withProgress({
      surface: "populated",
      rows: [
        unresolvedRow({
          reviewStatus: {
            state: "still_learning",
            labelKey: "review.stillLearning",
            last_reviewed: "2026-07-29T18:00:00.000Z",
          },
        }),
      ],
      rowErrors: {},
      canStartReview: false,
    });
    const { root } = renderSavedVocabulary(model, callbacks());
    expect(root.querySelector(".saved-vocab-open")).toBeNull();
    expect(root.textContent).toContain("Still learning");
    expect(root.textContent).toContain("Unavailable in this dictionary");
  });

  it("renders populated resolved and unresolved rows", () => {
    const model = withProgress({
      surface: "populated",
      rows: [resolvedRow(), unresolvedRow()],
      rowErrors: {},
      canStartReview: true,
    });
    const { root } = renderSavedVocabulary(model, callbacks());
    const list = root.querySelector(".saved-vocab-list");
    expect(list?.tagName).toBe("UL");
    expect(list?.children.length).toBe(2);
    expect(root.textContent).toContain("Unavailable in this dictionary");
    expect(root.querySelectorAll(".saved-vocab-open").length).toBe(1);
    expect(root.querySelectorAll(".saved-vocab-remove").length).toBe(2);
  });

  it("invokes Open only for resolved rows and Remove for both", () => {
    const cb = callbacks();
    const model = withProgress({
      surface: "populated",
      rows: [resolvedRow(), unresolvedRow()],
      rowErrors: {},
      canStartReview: true,
    });
    const { root } = renderSavedVocabulary(model, cb);
    root.querySelector<HTMLButtonElement>(".saved-vocab-open")!.click();
    expect(cb.onOpen).toHaveBeenCalledTimes(1);
    root.querySelectorAll<HTMLButtonElement>(".saved-vocab-remove").forEach((btn) => btn.click());
    expect(cb.onRemove).toHaveBeenCalledTimes(2);
  });

  it("disables row actions while removing and shows row error", () => {
    const key = rowKey("bundle-a", "lex-1");
    const model = withProgress({
      surface: "removing",
      rows: [resolvedRow()],
      removingKey: key,
      rowErrors: {},
      canStartReview: true,
    });
    const { root } = renderSavedVocabulary(model, callbacks());
    expect(root.querySelector<HTMLButtonElement>(".saved-vocab-open")!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>(".saved-vocab-remove")!.disabled).toBe(true);
    expect(root.querySelector("[aria-busy='true']")).not.toBeNull();

    const errored = withProgress({
      surface: "populated",
      rows: [resolvedRow()],
      rowErrors: { [key]: "remove_failed" },
      canStartReview: true,
    });
    const view = renderSavedVocabulary(errored, callbacks());
    expect(view.root.querySelector(".saved-vocab-row-error")?.textContent).toContain(
      "Couldn't remove",
    );
  });

  it("fires Back callback", () => {
    const cb = callbacks();
    const { root } = renderSavedVocabulary({ surface: "empty" }, cb);
    root.querySelector<HTMLButtonElement>(".saved-vocab-back")!.click();
    expect(cb.onBack).toHaveBeenCalledTimes(1);
  });

  it("formats last-reviewed timestamps for EN and FR", () => {
    const iso = "2026-07-29T18:00:00.000Z";
    expect(formatReviewTimestamp(iso, "en")).toMatch(/2026/);
    expect(formatReviewTimestamp(iso, "fr")).toMatch(/2026/);
    expect(formatReviewTimestamp("not-a-date", "en")).toBeUndefined();
  });
});
