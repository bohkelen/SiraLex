// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import type { LearningRecordV1 } from "../learning/learning_record_types";
import { LEARNING_RECORD_SCHEMA_VERSION } from "../learning/learning_record_types";
import type { SavedVocabularyProgressVm } from "../learning/saved_vocabulary_progress";
import { deriveSavedVocabularyProgress } from "../learning/saved_vocabulary_progress";
import type {
  SavedVocabularyModel,
  SavedVocabularyReviewStatus,
  SavedVocabularyRowVm,
} from "../learning/saved_vocabulary_session";
import { rowKey } from "../learning/saved_vocabulary_session";
import type { EnrichedRecord } from "../types/records";
import { formatReviewTimestamp, renderSavedVocabulary } from "./render_saved_vocabulary";

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

function makeLiveEntry(irId = "lex-1"): EnrichedRecord {
  return {
    ir_id: irId,
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
  const irId = overrides.ir_id ?? "lex-1";
  const liveEntry = overrides.liveEntry ?? makeLiveEntry(irId);
  return {
    state: "resolved",
    bundle_id: "bundle-a",
    ir_id: irId,
    learningRecord: makeLearningRecord({ ir_id: irId }),
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

function populatedModel(
  rows: SavedVocabularyRowVm[],
  opts: {
    surface?: "populated" | "removing";
    removingKey?: string;
    rowErrors?: Record<string, string>;
    progress?: Partial<SavedVocabularyProgressVm>;
  } = {},
): SavedVocabularyModel {
  return {
    surface: opts.surface ?? "populated",
    rows,
    ...(opts.removingKey ? { removingKey: opts.removingKey } : {}),
    rowErrors: opts.rowErrors ?? {},
    progress: {
      ...deriveSavedVocabularyProgress(rows).progress,
      ...opts.progress,
    },
  };
}

function callbacks(extra: Partial<Parameters<typeof renderSavedVocabulary>[1]> = {}) {
  return {
    onSearch: vi.fn(),
    onOpen: vi.fn(),
    onRemove: vi.fn(),
    onStartReview: vi.fn(),
    ...extra,
  };
}

describe("LS1I3 / LS2I4 / LS3I2 / UX2I5A Saved Vocabulary renderer", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("renders loading, empty, unavailable, and error without Progress or permanent Back", () => {
    for (const surface of ["loading", "empty", "unavailable", "error"] as const) {
      const { root } = renderSavedVocabulary({ surface }, callbacks());
      expect(root.querySelector("#saved-vocab-heading")?.textContent).toBe("Saved vocabulary");
      expect(root.querySelector(".saved-vocab-back")).toBeNull();
      expect(root.querySelector(".saved-vocab-list")).toBeNull();
      expect(root.querySelector(".saved-vocab-progress")).toBeNull();
      expect(root.querySelector(".saved-vocab-return-cue")).toBeNull();
      expect(root.querySelector("#saved-vocab-start-review")).toBeNull();
    }
  });

  it("omits Start Review on empty and loading; empty offers Search CTA", () => {
    const empty = renderSavedVocabulary({ surface: "empty" }, callbacks());
    expect(empty.startReviewButton).toBeNull();
    expect(empty.root.querySelector(".saved-vocab-progress")).toBeNull();
    expect(empty.root.textContent).toContain("No saved words yet.");
    expect(empty.root.textContent).toContain("Save words from dictionary entries");
    expect(empty.root.querySelector(".ux2-saved-search-cta")?.textContent).toBe(
      "Search for a word →",
    );

    const loading = renderSavedVocabulary({ surface: "loading" }, callbacks());
    expect(loading.startReviewButton).toBeNull();
    expect(loading.root.querySelector(".saved-vocab-progress")).toBeNull();
    expect(loading.root.textContent).toContain("Loading saved vocabulary");
  });

  it("renders Progress summary for populated and removing", () => {
    const populated = renderSavedVocabulary(populatedModel([resolvedRow()]), callbacks());
    expect(populated.root.querySelector(".saved-vocab-progress")).not.toBeNull();
    expect(populated.root.querySelector("#saved-vocab-progress-heading")?.textContent).toBe(
      "Vocabulary overview",
    );

    const removing = renderSavedVocabulary(
      populatedModel([resolvedRow()], {
        surface: "removing",
        removingKey: rowKey("bundle-a", "lex-1"),
      }),
      callbacks(),
    );
    expect(removing.root.querySelector(".saved-vocab-progress")).not.toBeNull();
    expect(removing.startReviewButton?.disabled).toBe(true);
  });

  it("renders required status counts from progress and omits forbidden signals", () => {
    const model = populatedModel(
      [
        resolvedRow({ ir_id: "a" }),
        resolvedRow({
          ir_id: "b",
          learningRecord: makeLearningRecord({
            ir_id: "b",
            review_count: 1,
            last_reviewed: "2026-07-29T18:00:00.000Z",
            status: "still_learning",
          }),
          reviewStatus: {
            state: "still_learning",
            labelKey: "review.stillLearning",
            last_reviewed: "2026-07-29T18:00:00.000Z",
          },
        }),
        resolvedRow({
          ir_id: "c",
          learningRecord: makeLearningRecord({
            ir_id: "c",
            review_count: 1,
            last_reviewed: "2026-07-29T19:00:00.000Z",
            status: "remembered",
          }),
          reviewStatus: {
            state: "remembered",
            labelKey: "review.remembered",
            last_reviewed: "2026-07-29T19:00:00.000Z",
          },
        }),
        unresolvedRow(),
      ],
      {
        progress: {
          total_saved: 4,
          not_reviewed: 2,
          still_learning: 1,
          remembered: 1,
          unavailable: 1,
          reviewable: 3,
          showUnavailable: true,
          reviewAction: { state: "enabled", label: "continue" },
          returnCue: "review_new",
        },
      },
    );
    const { root } = renderSavedVocabulary(model, callbacks());
    expect(root.querySelector('[data-progress-metric="saved"] dd')?.textContent).toBe("4");
    expect(root.querySelector('[data-progress-metric="not_reviewed"] dd')?.textContent).toBe("2");
    expect(root.querySelector('[data-progress-metric="still_learning"] dd')?.textContent).toBe("1");
    expect(root.querySelector('[data-progress-metric="remembered"] dd')?.textContent).toBe("1");
    expect(root.querySelector('[data-progress-metric="unavailable"] dd')?.textContent).toBe("1");
    expect(root.querySelector("#saved-vocab-unavailable-explanation")?.textContent).toContain(
      "not available in the current dictionary",
    );
    expect(root.textContent).not.toMatch(/reviewable/i);
    expect(root.textContent).not.toMatch(/unknown_state/i);
    expect(root.textContent).not.toContain("review_count");
    expect(root.textContent).not.toMatch(/%/);
    expect(root.textContent).not.toMatch(/mastered/i);
    expect(root.textContent).not.toMatch(/mastery/i);
    expect(root.textContent).not.toMatch(/accuracy|success rate|retention|streak|overdue|due\b/i);
    expect(root.querySelector(".saved-vocab-review-count")).toBeNull();
  });

  it("hides unavailable metric and explanation when showUnavailable is false", () => {
    const { root } = renderSavedVocabulary(populatedModel([resolvedRow()]), callbacks());
    expect(root.querySelector('[data-progress-metric="unavailable"]')).toBeNull();
    expect(root.querySelector("#saved-vocab-unavailable-explanation")).toBeNull();
  });

  it("uses Progress Start and Continue labels and invokes onStartReview", () => {
    const startCb = callbacks();
    const start = renderSavedVocabulary(
      populatedModel([resolvedRow()], {
        progress: {
          reviewAction: { state: "enabled", label: "start" },
          returnCue: "review_new",
        },
      }),
      startCb,
    );
    expect(start.startReviewButton?.textContent).toBe("Start review");
    start.startReviewButton!.click();
    expect(startCb.onStartReview).toHaveBeenCalledTimes(1);

    const contCb = callbacks();
    const cont = renderSavedVocabulary(
      populatedModel([resolvedRow()], {
        progress: {
          reviewAction: { state: "enabled", label: "continue" },
          still_learning: 1,
          not_reviewed: 0,
          returnCue: "review_still_learning",
        },
      }),
      contCb,
    );
    expect(cont.startReviewButton?.textContent).toBe("Continue review");
    expect(cont.root.textContent).not.toMatch(/resume/i);
    cont.startReviewButton!.click();
    expect(contCb.onStartReview).toHaveBeenCalledTimes(1);
  });

  it("disables Review for no-reviewable action and omits hidden action", () => {
    const cb = callbacks();
    const disabled = renderSavedVocabulary(
      populatedModel([unresolvedRow()], {
        progress: {
          reviewAction: { state: "disabled", reason: "no_reviewable_entries" },
          returnCue: "none",
          showUnavailable: true,
          unavailable: 1,
          reviewable: 0,
        },
      }),
      cb,
    );
    expect(disabled.startReviewButton?.disabled).toBe(true);
    expect(disabled.root.querySelector("#saved-vocab-start-review-hint")?.textContent).toContain(
      "No saved entries are currently available for review.",
    );
    expect(disabled.startReviewButton?.getAttribute("aria-describedby")).toBe(
      "saved-vocab-start-review-hint",
    );
    disabled.startReviewButton!.click();
    expect(cb.onStartReview).not.toHaveBeenCalled();

    const hidden = renderSavedVocabulary(
      populatedModel([resolvedRow()], {
        progress: {
          reviewAction: { state: "hidden", reason: "empty_collection" },
          returnCue: "none",
        },
      }),
      callbacks(),
    );
    expect(hidden.startReviewButton).toBeNull();
    expect(hidden.root.querySelector("#saved-vocab-start-review")).toBeNull();
  });

  it("renders return cues and omits none", () => {
    for (const [cue, copy] of [
      ["review_new", "Review new saved words"],
      ["review_still_learning", "Review words you are still learning"],
      ["review_again", "Review saved vocabulary again"],
    ] as const) {
      const { root } = renderSavedVocabulary(
        populatedModel([resolvedRow()], { progress: { returnCue: cue } }),
        callbacks(),
      );
      const el = root.querySelector(".saved-vocab-return-cue");
      expect(el?.textContent).toBe(copy);
      expect(el?.tagName).toBe("P");
      expect(el?.getAttribute("role")).toBeNull();
      expect(document.activeElement).not.toBe(el);
    }

    const none = renderSavedVocabulary(
      populatedModel([resolvedRow()], { progress: { returnCue: "none" } }),
      callbacks(),
    );
    expect(none.root.querySelector(".saved-vocab-return-cue")).toBeNull();
  });

  it("uses semantic Progress structure without live regions or progressbars", () => {
    const { root } = renderSavedVocabulary(
      populatedModel([resolvedRow(), unresolvedRow()], {
        progress: {
          showUnavailable: true,
          unavailable: 1,
          reviewAction: { state: "disabled", reason: "no_reviewable_entries" },
        },
      }),
      callbacks(),
    );
    expect(root.querySelectorAll(".saved-vocab-progress").length).toBe(1);
    expect(root.querySelectorAll("dl.saved-vocab-progress-list").length).toBe(1);
    const labels = [...root.querySelectorAll(".saved-vocab-progress-list dt")].map(
      (n) => n.textContent,
    );
    expect(labels).toEqual([
      "Saved",
      "Not reviewed",
      "Still learning",
      "Remembered",
      "Unavailable",
    ]);
    expect(root.querySelector("[aria-live]")).toBeNull();
    expect(root.querySelector('[role="progressbar"]')).toBeNull();
    expect(root.querySelectorAll("#saved-vocab-progress-heading").length).toBe(1);
    expect(root.querySelectorAll("#saved-vocab-unavailable-explanation").length).toBe(1);
    expect(root.querySelectorAll("#saved-vocab-start-review-hint").length).toBe(1);

    const heading = root.querySelector("#saved-vocab-heading");
    const progress = root.querySelector(".saved-vocab-progress");
    const cueOrAction =
      root.querySelector(".saved-vocab-return-cue") ??
      root.querySelector(".saved-vocab-start-review-region");
    const list = root.querySelector(".saved-vocab-list");
    expect(heading!.compareDocumentPosition(progress!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(progress!.compareDocumentPosition(cueOrAction!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cueOrAction!.compareDocumentPosition(list!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("preserves row statuses, Open/Remove, N’Ko semantics, and row order", () => {
    const cb = callbacks();
    const model = populatedModel([
      resolvedRow({
        ir_id: "a",
        primaryText: "alpha",
        reviewStatus: { state: "not_reviewed", labelKey: "review.notReviewed" },
      }),
      resolvedRow({
        ir_id: "b",
        primaryText: "beta",
        learningRecord: makeLearningRecord({
          ir_id: "b",
          review_count: 1,
          last_reviewed: "2026-07-29T18:00:00.000Z",
          status: "still_learning",
        }),
        reviewStatus: {
          state: "still_learning",
          labelKey: "review.stillLearning",
          last_reviewed: "2026-07-29T18:00:00.000Z",
        },
      }),
      unresolvedRow({
        reviewStatus: {
          state: "remembered",
          labelKey: "review.remembered",
          last_reviewed: "2026-07-29T19:00:00.000Z",
        },
      }),
    ]);
    const { root } = renderSavedVocabulary(model, cb);
    const primaries = [...root.querySelectorAll(".saved-vocab-primary")].map((n) => n.textContent);
    expect(primaries).toEqual(["alpha", "beta", "ghost"]);
    expect(root.textContent).toContain("Not reviewed");
    expect(root.textContent).toContain("Still learning");
    expect(root.textContent).toContain("Remembered");
    expect(root.textContent).toContain("Last reviewed:");
    expect(root.querySelectorAll(".saved-vocab-open").length).toBe(2);
    expect(root.querySelector(".ux2-saved-row-unresolved .saved-vocab-open")).toBeNull();
    expect(root.querySelector(".saved-vocab-unresolved")?.textContent).toContain(
      "Unavailable in this dictionary",
    );

    const nko = root.querySelector(".saved-vocab-nko");
    expect(nko?.getAttribute("lang")).toBe("nqo");
    expect(nko?.getAttribute("dir")).toBe("rtl");
    expect(nko?.classList.contains("ux2-text-nko")).toBe(true);

    const openBtn = root.querySelector<HTMLButtonElement>(".saved-vocab-open")!;
    expect(openBtn.tagName).toBe("BUTTON");
    expect(openBtn.getAttribute("aria-label")).toContain("alpha");
    expect(openBtn.querySelector(".saved-vocab-remove")).toBeNull();
    openBtn.click();
    expect(cb.onOpen).toHaveBeenCalledTimes(1);
    root.querySelectorAll<HTMLButtonElement>(".saved-vocab-remove").forEach((btn) => btn.click());
    expect(cb.onRemove).toHaveBeenCalledTimes(3);
  });

  it("disables row actions while removing and shows row error", () => {
    const key = rowKey("bundle-a", "lex-1");
    const model = populatedModel([resolvedRow()], {
      surface: "removing",
      removingKey: key,
    });
    const { root, startReviewButton } = renderSavedVocabulary(model, callbacks());
    expect(startReviewButton?.disabled).toBe(true);
    expect(root.querySelector(".saved-vocab-progress")).not.toBeNull();
    expect(root.querySelector<HTMLButtonElement>(".saved-vocab-open")!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>(".saved-vocab-remove")!.disabled).toBe(true);

    const errored = populatedModel([resolvedRow()], {
      rowErrors: { [key]: "remove_failed" },
    });
    const view = renderSavedVocabulary(errored, callbacks());
    const err = view.root.querySelector(".saved-vocab-row-error");
    expect(err?.textContent).toContain("Couldn't remove");
    expect(
      view.root.querySelector(".saved-vocab-remove")?.getAttribute("aria-describedby"),
    ).toBe(err?.id);
  });

  it("fires Search callback from empty-state CTA, not Back", () => {
    const cb = callbacks();
    const { root } = renderSavedVocabulary({ surface: "empty" }, cb);
    expect(root.querySelector(".saved-vocab-back")).toBeNull();
    root.querySelector<HTMLButtonElement>(".ux2-saved-search-cta")!.click();
    expect(cb.onSearch).toHaveBeenCalledTimes(1);
  });

  it("formats last-reviewed timestamps for EN and FR", () => {
    const iso = "2026-07-29T18:00:00.000Z";
    expect(formatReviewTimestamp(iso, "en")).toMatch(/2026/);
    expect(formatReviewTimestamp(iso, "fr")).toMatch(/2026/);
    expect(formatReviewTimestamp("not-a-date", "en")).toBeUndefined();
  });

  it("renders French Progress and empty-state copy", () => {
    setCurrentLocale("fr");
    const { root, startReviewButton } = renderSavedVocabulary(
      populatedModel([resolvedRow(), unresolvedRow()], {
        progress: {
          showUnavailable: true,
          unavailable: 1,
          reviewAction: { state: "enabled", label: "continue" },
          returnCue: "review_still_learning",
        },
      }),
      callbacks(),
    );
    expect(root.querySelector("#saved-vocab-progress-heading")?.textContent).toBe(
      "Aperçu du vocabulaire",
    );
    expect(root.textContent).toContain("Enregistrés");
    expect(root.textContent).toContain("Pas encore révisés");
    expect(root.textContent).toContain("Encore en apprentissage");
    expect(root.textContent).toContain("Mémorisés");
    expect(root.textContent).toContain("Indisponibles");
    expect(root.textContent).toContain(
      "Ces entrées enregistrées ne sont pas disponibles dans le dictionnaire actuel.",
    );
    expect(root.querySelector(".saved-vocab-return-cue")?.textContent).toBe(
      "Réviser les mots encore en apprentissage",
    );
    expect(startReviewButton?.textContent).toBe("Continuer la révision");

    const startOnly = renderSavedVocabulary(
      populatedModel([resolvedRow()], {
        progress: { reviewAction: { state: "enabled", label: "start" }, returnCue: "review_new" },
      }),
      callbacks(),
    );
    expect(startOnly.startReviewButton?.textContent).toBe("Commencer la révision");
    expect(startOnly.root.querySelector(".saved-vocab-return-cue")?.textContent).toBe(
      "Réviser les nouveaux mots enregistrés",
    );

    const again = renderSavedVocabulary(
      populatedModel([resolvedRow()], {
        progress: { reviewAction: { state: "enabled", label: "continue" }, returnCue: "review_again" },
      }),
      callbacks(),
    );
    expect(again.root.querySelector(".saved-vocab-return-cue")?.textContent).toBe(
      "Réviser à nouveau le vocabulaire enregistré",
    );

    const empty = renderSavedVocabulary({ surface: "empty" }, callbacks());
    expect(empty.root.querySelector(".ux2-saved-search-cta")?.textContent).toBe("Chercher un mot →");
    expect(empty.root.textContent).toContain("Aucun mot enregistré.");
  });
});
