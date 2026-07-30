/**
 * LS3I1 — Saved Vocabulary Progress derivation (pure).
 */

import { describe, expect, it } from "vitest";

import { LEARNING_RECORD_SCHEMA_VERSION } from "./learning_record_types";
import type { LearningRecordV1 } from "./learning_record_types";
import {
  hasConsistentReviewFields,
  isResolvedLexiconReviewEligible,
} from "./review_queue";
import {
  deriveSavedVocabularyProgress,
  isSavedVocabularyRowReviewable,
} from "./saved_vocabulary_progress";
import type { SavedVocabularyRowVm } from "./saved_vocabulary_session";
import type { EnrichedRecord } from "../types/records";

const BUNDLE = "bundle_progress";
const HASH = "sha256:progressaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SCOPE = `${BUNDLE}::${HASH}`;
const TS = "2026-07-29T12:00:00.000Z";
const TS_REVIEW = "2026-07-29T18:00:00.000Z";

function learningRecord(overrides: Partial<LearningRecordV1> = {}): LearningRecordV1 {
  return {
    schema_version: LEARNING_RECORD_SCHEMA_VERSION,
    bundle_id: BUNDLE,
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: SCOPE,
    status: "still_learning",
    created_at: TS,
    display_cache: { headword_latin: "kùn" },
    last_reviewed: null,
    review_count: 0,
    ...overrides,
  };
}

function lexicon(irId: string, headword = irId): EnrichedRecord {
  return {
    ir_id: irId,
    ir_kind: "lexicon_entry",
    source_id: "s",
    norm_version: "norm_v3",
    preferred_form: headword,
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: headword,
      senses: [{ gloss_fr: `gloss-${headword}` }],
    },
  };
}

function resolved(
  irId: string,
  review: SavedVocabularyRowVm["reviewStatus"],
  lrOverrides: Partial<LearningRecordV1> = {},
  live: EnrichedRecord = lexicon(irId),
): SavedVocabularyRowVm {
  const learningRecordRow = learningRecord({ ir_id: irId, ...lrOverrides });
  return Object.freeze({
    state: "resolved",
    bundle_id: BUNDLE,
    ir_id: irId,
    learningRecord: Object.freeze(learningRecordRow),
    liveEntry: live,
    primaryText: irId,
    reviewStatus: review,
  }) as SavedVocabularyRowVm;
}

function unresolved(
  irId: string,
  review: SavedVocabularyRowVm["reviewStatus"],
  lrOverrides: Partial<LearningRecordV1> = {},
): SavedVocabularyRowVm {
  const learningRecordRow = learningRecord({ ir_id: irId, ...lrOverrides });
  return Object.freeze({
    state: "unresolved",
    bundle_id: BUNDLE,
    ir_id: irId,
    learningRecord: Object.freeze(learningRecordRow),
    primaryText: irId,
    reason: "entry_missing",
    reviewStatus: review,
  }) as SavedVocabularyRowVm;
}

const neverReviewed = {
  state: "not_reviewed" as const,
  labelKey: "review.notReviewed" as const,
};

function stillLearningStatus(at = TS_REVIEW) {
  return {
    state: "still_learning" as const,
    labelKey: "review.stillLearning" as const,
    last_reviewed: at,
  };
}

function rememberedStatus(at = TS_REVIEW) {
  return {
    state: "remembered" as const,
    labelKey: "review.remembered" as const,
    last_reviewed: at,
  };
}

function assertStatusInvariant(
  progress: ReturnType<typeof deriveSavedVocabularyProgress>["progress"],
  unknown: number,
): void {
  expect(
    progress.not_reviewed + progress.still_learning + progress.remembered + unknown,
  ).toBe(progress.total_saved);
  expect(progress.reviewable).toBeLessThanOrEqual(progress.total_saved - progress.unavailable);
}

describe("LS3I1 deriveSavedVocabularyProgress", () => {
  it("empty rows → hidden action and none cue", () => {
    const { progress, diagnostics } = deriveSavedVocabularyProgress([]);
    expect(progress).toEqual({
      total_saved: 0,
      not_reviewed: 0,
      still_learning: 0,
      remembered: 0,
      unavailable: 0,
      reviewable: 0,
      reviewAction: { state: "hidden", reason: "empty_collection" },
      returnCue: "none",
      showUnavailable: false,
    });
    expect(diagnostics.unknown_state_count).toBe(0);
    expect("unknown_state_count" in progress).toBe(false);
  });

  it("one resolved never-reviewed row → Start + review_new", () => {
    const rows = [resolved("a", neverReviewed)];
    const { progress, diagnostics } = deriveSavedVocabularyProgress(rows);
    expect(progress.total_saved).toBe(1);
    expect(progress.not_reviewed).toBe(1);
    expect(progress.still_learning).toBe(0);
    expect(progress.remembered).toBe(0);
    expect(progress.unavailable).toBe(0);
    expect(progress.reviewable).toBe(1);
    expect(progress.reviewAction).toEqual({ state: "enabled", label: "start" });
    expect(progress.returnCue).toBe("review_new");
    expect(progress.showUnavailable).toBe(false);
    assertStatusInvariant(progress, diagnostics.unknown_state_count);
  });

  it("one unresolved never-reviewed row → disabled + unavailable", () => {
    const { progress, diagnostics } = deriveSavedVocabularyProgress([
      unresolved("a", neverReviewed),
    ]);
    expect(progress.not_reviewed).toBe(1);
    expect(progress.unavailable).toBe(1);
    expect(progress.reviewable).toBe(0);
    expect(progress.reviewAction).toEqual({
      state: "disabled",
      reason: "no_reviewable_entries",
    });
    expect(progress.returnCue).toBe("none");
    expect(progress.showUnavailable).toBe(true);
    assertStatusInvariant(progress, diagnostics.unknown_state_count);
  });

  it("resolved and unresolved Still learning count orthogonally", () => {
    const lr = {
      review_count: 1,
      last_reviewed: TS_REVIEW,
      status: "still_learning" as const,
    };
    const { progress, diagnostics } = deriveSavedVocabularyProgress([
      resolved("a", stillLearningStatus(), lr),
      unresolved("b", stillLearningStatus(), lr),
    ]);
    expect(progress.still_learning).toBe(2);
    expect(progress.unavailable).toBe(1);
    expect(progress.reviewable).toBe(1);
    expect(progress.reviewAction).toEqual({ state: "enabled", label: "continue" });
    expect(progress.returnCue).toBe("review_still_learning");
    assertStatusInvariant(progress, diagnostics.unknown_state_count);
  });

  it("resolved and unresolved Remembered count orthogonally", () => {
    const lr = {
      review_count: 1,
      last_reviewed: TS_REVIEW,
      status: "remembered" as const,
    };
    const { progress, diagnostics } = deriveSavedVocabularyProgress([
      resolved("a", rememberedStatus(), lr),
      unresolved("b", rememberedStatus(), lr),
    ]);
    expect(progress.remembered).toBe(2);
    expect(progress.unavailable).toBe(1);
    expect(progress.reviewable).toBe(1);
    expect(progress.reviewAction).toEqual({ state: "enabled", label: "continue" });
    expect(progress.returnCue).toBe("review_again");
    assertStatusInvariant(progress, diagnostics.unknown_state_count);
  });

  it("mixed statuses with unavailable overlap do not form a partition of total_saved", () => {
    const { progress, diagnostics } = deriveSavedVocabularyProgress([
      resolved("a", neverReviewed),
      unresolved("b", stillLearningStatus(), {
        review_count: 1,
        last_reviewed: TS_REVIEW,
        status: "still_learning",
      }),
      unresolved("c", rememberedStatus(), {
        review_count: 1,
        last_reviewed: TS_REVIEW,
        status: "remembered",
      }),
    ]);
    expect(progress.total_saved).toBe(3);
    expect(progress.not_reviewed).toBe(1);
    expect(progress.still_learning).toBe(1);
    expect(progress.remembered).toBe(1);
    expect(progress.unavailable).toBe(2);
    expect(
      progress.not_reviewed + progress.still_learning + progress.remembered + progress.unavailable,
    ).not.toBe(progress.total_saved);
    expect(progress.reviewAction).toEqual({ state: "enabled", label: "continue" });
    expect(progress.returnCue).toBe("review_new");
    assertStatusInvariant(progress, diagnostics.unknown_state_count);
  });

  it("action states: empty, unresolved-only, inconsistent, Start, Continue mixes", () => {
    expect(deriveSavedVocabularyProgress([]).progress.reviewAction.state).toBe("hidden");

    expect(
      deriveSavedVocabularyProgress([unresolved("u", neverReviewed)]).progress.reviewAction,
    ).toEqual({ state: "disabled", reason: "no_reviewable_entries" });

    const inconsistent = resolved(
      "bad",
      { state: "unknown" },
      { review_count: 0, last_reviewed: TS_REVIEW },
    );
    expect(hasConsistentReviewFields(inconsistent.learningRecord)).toBe(false);
    expect(deriveSavedVocabularyProgress([inconsistent]).progress.reviewAction).toEqual({
      state: "disabled",
      reason: "no_reviewable_entries",
    });

    expect(
      deriveSavedVocabularyProgress([resolved("n", neverReviewed)]).progress.reviewAction,
    ).toEqual({ state: "enabled", label: "start" });

    expect(
      deriveSavedVocabularyProgress([
        resolved("s", stillLearningStatus(), {
          review_count: 1,
          last_reviewed: TS_REVIEW,
          status: "still_learning",
        }),
      ]).progress.reviewAction,
    ).toEqual({ state: "enabled", label: "continue" });

    expect(
      deriveSavedVocabularyProgress([
        resolved("r", rememberedStatus(), {
          review_count: 1,
          last_reviewed: TS_REVIEW,
          status: "remembered",
        }),
      ]).progress.reviewAction,
    ).toEqual({ state: "enabled", label: "continue" });

    expect(
      deriveSavedVocabularyProgress([
        resolved("n", neverReviewed),
        resolved("s", stillLearningStatus(), {
          review_count: 1,
          last_reviewed: TS_REVIEW,
          status: "still_learning",
        }),
      ]).progress.reviewAction,
    ).toEqual({ state: "enabled", label: "continue" });

    // Prior reviewed buckets exist even when those rows are unavailable.
    const case8 = deriveSavedVocabularyProgress([
      unresolved("old", rememberedStatus(), {
        review_count: 2,
        last_reviewed: TS_REVIEW,
        status: "remembered",
      }),
      resolved("new", neverReviewed),
    ]).progress;
    expect(case8.remembered).toBe(1);
    expect(case8.not_reviewed).toBe(1);
    expect(case8.reviewable).toBe(1);
    expect(case8.reviewAction).toEqual({ state: "enabled", label: "continue" });
    expect(case8.returnCue).toBe("review_new");
  });

  it("return-cue hierarchy follows queue groups, not unavailable", () => {
    expect(deriveSavedVocabularyProgress([unresolved("u", neverReviewed)]).progress.returnCue).toBe(
      "none",
    );

    expect(
      deriveSavedVocabularyProgress([
        resolved("n", neverReviewed),
        resolved("s", stillLearningStatus(), {
          review_count: 1,
          last_reviewed: TS_REVIEW,
          status: "still_learning",
        }),
      ]).progress.returnCue,
    ).toBe("review_new");

    expect(
      deriveSavedVocabularyProgress([
        resolved("s", stillLearningStatus(), {
          review_count: 1,
          last_reviewed: TS_REVIEW,
          status: "still_learning",
        }),
      ]).progress.returnCue,
    ).toBe("review_still_learning");

    expect(
      deriveSavedVocabularyProgress([
        resolved("r", rememberedStatus(), {
          review_count: 1,
          last_reviewed: TS_REVIEW,
          status: "remembered",
        }),
      ]).progress.returnCue,
    ).toBe("review_again");

    expect(
      deriveSavedVocabularyProgress([
        resolved("bad", { state: "unknown" }, { review_count: 1, last_reviewed: null }),
      ]).progress.returnCue,
    ).toBe("none");
  });

  it("reviewability matches LS2 eligibility helper", () => {
    const ok = resolved("ok", neverReviewed);
    expect(isSavedVocabularyRowReviewable(ok)).toBe(true);
    expect(isResolvedLexiconReviewEligible(ok.learningRecord, ok.state === "resolved" ? ok.liveEntry : lexicon("x"))).toBe(
      true,
    );

    expect(isSavedVocabularyRowReviewable(unresolved("u", neverReviewed))).toBe(false);

    const inconsistent = resolved(
      "bad",
      { state: "unknown" },
      { review_count: 2, last_reviewed: null },
    );
    expect(isSavedVocabularyRowReviewable(inconsistent)).toBe(false);

    const mapping = resolved("m", neverReviewed, {}, {
      ir_id: "m",
      ir_kind: "index_mapping",
      source_id: "s",
      norm_version: "norm_v3",
      preferred_form: "m",
      variant_forms: [],
      search_keys: {},
      display: { source_term: "man", source_lang: "en" },
    });
    expect(isSavedVocabularyRowReviewable(mapping)).toBe(false);

    const mismatch = resolved("id", neverReviewed, { ir_id: "id" }, lexicon("other"));
    expect(isSavedVocabularyRowReviewable(mismatch)).toBe(false);

    const noDisplay = resolved("nd", neverReviewed, {}, {
      ir_id: "nd",
      ir_kind: "lexicon_entry",
      source_id: "s",
      norm_version: "norm_v3",
      preferred_form: "nd",
      variant_forms: [],
      search_keys: {},
    });
    expect(isSavedVocabularyRowReviewable(noDisplay)).toBe(false);
  });

  it("diagnostics stay internal; derivation is pure and deterministic", () => {
    const rows = Object.freeze([
      resolved("a", neverReviewed),
      resolved("bad", { state: "unknown" }, { review_count: 0, last_reviewed: TS_REVIEW }),
      unresolved("u", stillLearningStatus(), {
        review_count: 1,
        last_reviewed: TS_REVIEW,
        status: "still_learning",
      }),
    ]);
    const snapshot = JSON.stringify(rows);
    const first = deriveSavedVocabularyProgress(rows);
    const second = deriveSavedVocabularyProgress(rows);
    expect(first).toEqual(second);
    expect(JSON.stringify(rows)).toBe(snapshot);
    expect(first.diagnostics.unknown_state_count).toBe(1);
    expect(first.progress).not.toHaveProperty("unknown_state_count");
    assertStatusInvariant(first.progress, first.diagnostics.unknown_state_count);
    expect(first.progress.showUnavailable).toBe(true);
  });
});
