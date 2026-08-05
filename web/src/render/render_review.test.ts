// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import type { LearningRecordV1 } from "../learning/learning_record_types";
import { LEARNING_RECORD_SCHEMA_VERSION } from "../learning/learning_record_types";
import type { ReviewQueueItem } from "../learning/review_queue";
import type { ReviewSessionModel } from "../learning/review_session";
import type { EnrichedRecord } from "../types/records";
import { renderReview, shouldMoveReviewFocus } from "./render_review";

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
    display_cache: { headword_latin: "CACHE-ONLY", gloss_short: "cache-gloss-secret" },
    last_reviewed: null,
    review_count: 0,
    ...overrides,
  };
}

function makeLiveEntry(overrides: Partial<EnrichedRecord> = {}): EnrichedRecord {
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
      pos_hint: "n.",
      senses: [
        {
          gloss_fr: "tête",
          gloss_en: "head",
          examples: [
            {
              text_latin: "a kùn",
              text_nko_provided: "ߊ ߞߎ߲",
              trans_fr: "sa tête",
            },
          ],
        },
      ],
      variants_raw: ["kun"],
    },
    ...overrides,
  };
}

function reviewingItem(liveEntry = makeLiveEntry()): ReviewQueueItem {
  return {
    identity: { bundle_id: "bundle-a", ir_id: "lex-1" },
    learningRecord: makeLearningRecord(),
    liveEntry,
  };
}

function reviewing(
  overrides: Partial<Extract<ReviewSessionModel, { surface: "reviewing" }>> = {},
): Extract<ReviewSessionModel, { surface: "reviewing" }> {
  return {
    surface: "reviewing",
    item: reviewingItem(),
    position: 1,
    total: 5,
    revealed: false,
    busy: false,
    completed_count: 0,
    unresolved_at_start_count: 0,
    ...overrides,
  };
}

function callbacks() {
  return {
    onReveal: vi.fn(),
    onReflect: vi.fn(),
    onBack: vi.fn(),
    onReviewAgain: vi.fn(),
  };
}

describe("LS2I3 / UX2I5B Review renderer", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("renders loading", () => {
    const { root } = renderReview({ surface: "loading" }, callbacks());
    expect(root.querySelector("#review-heading")?.textContent).toBe("Review");
    expect(root.querySelector(".review-status")?.textContent).toBe("Loading review…");
    expect(root.querySelector(".review-status")?.getAttribute("role")).toBe("status");
    expect(root.querySelector(".review-reveal")).toBeNull();
    expect(root.querySelector(".review-card")).toBeNull();
  });

  it("renders unavailable", () => {
    const cb = callbacks();
    const { root } = renderReview({ surface: "unavailable", reason: "no_active_bundle" }, cb);
    expect(root.textContent).toContain("Add a dictionary");
    expect(root.querySelector(".review-card")).toBeNull();
    root.querySelector<HTMLButtonElement>(".review-back")!.click();
    expect(cb.onBack).toHaveBeenCalledTimes(1);
  });

  it("renders empty no saved records without fabricated metrics", () => {
    const { root } = renderReview(
      { surface: "empty", reason: "no_saved_records", unresolved_count: 0 },
      callbacks(),
    );
    expect(root.textContent).toContain("Nothing to review yet.");
    expect(root.textContent).toContain("Save words first");
    expect(root.querySelector(".review-card")).toBeNull();
    expect(root.textContent).not.toMatch(/%|mastery|score|streak/i);
  });

  it("renders empty no resolved records with unresolved count", () => {
    const { root } = renderReview(
      { surface: "empty", reason: "no_resolved_records", unresolved_count: 3 },
      callbacks(),
    );
    expect(root.textContent).toContain("No saved entries are currently available for review.");
    expect(root.textContent).toContain("3 unavailable");
    expect(root.querySelector(".review-card")).toBeNull();
  });

  it("renders load error", () => {
    const { root } = renderReview({ surface: "error", reason: "load_failed" }, callbacks());
    expect(root.querySelector("[role='alert']")?.textContent).toBe("Couldn't load review.");
  });

  it("renders reviewing before Reveal without meaning or reflection", () => {
    const { root } = renderReview(reviewing(), callbacks());
    expect(root.querySelector(".review-position")?.textContent).toBe("1 of 5");
    expect(root.querySelector("#review-headword")?.textContent).toBe("kùn");
    expect(root.querySelector(".review-nko")?.textContent).toBe("ߞߎ߲");
    expect(root.querySelector(".review-nko")?.getAttribute("lang")).toBe("nqo");
    expect(root.querySelector(".review-nko")?.getAttribute("dir")).toBe("rtl");
    expect(root.querySelector(".review-nko")?.classList.contains("ux2-text-nko")).toBe(true);
    expect(root.querySelector(".review-pos")?.textContent).toBe("n.");
    expect(root.querySelector(".review-prompt")?.textContent).toContain("Recall the meaning");
    expect(root.querySelector(".review-reveal")).not.toBeNull();
    expect(root.querySelector(".review-still-learning")).toBeNull();
    expect(root.querySelector(".review-remembered")).toBeNull();
    expect(root.querySelector(".review-revealed")).toBeNull();
    expect(root.textContent).not.toContain("tête");
    expect(root.textContent).not.toContain("head");
    expect(root.textContent).not.toContain("a kùn");
    expect(root.textContent).not.toContain("cache-gloss-secret");
    expect(root.textContent).not.toContain("CACHE-ONLY");
  });

  it("never renders Learning Record display_cache before or after Reveal", () => {
    const hidden = renderReview(reviewing(), callbacks());
    expect(hidden.root.textContent).not.toContain("CACHE-ONLY");
    expect(hidden.root.textContent).not.toContain("cache-gloss-secret");
    expect(hidden.root.querySelector("#review-headword")?.textContent).toBe("kùn");

    const shown = renderReview(reviewing({ revealed: true }), callbacks());
    expect(shown.root.textContent).not.toContain("CACHE-ONLY");
    expect(shown.root.textContent).not.toContain("cache-gloss-secret");
    expect(shown.root.querySelector("#review-headword")?.textContent).toBe("kùn");
  });

  it("renders reviewing after Reveal with live support and conversational reflection labels", () => {
    const { root } = renderReview(reviewing({ revealed: true }), callbacks());
    expect(root.querySelector(".review-reveal")).toBeNull();
    expect(root.querySelector("#review-meaning-heading")?.textContent).toBe("Meaning");
    expect(root.textContent).toContain("tête");
    expect(root.textContent).toContain("head");
    expect(root.textContent).toContain("a kùn");
    expect(root.querySelector(".review-example-nko")?.getAttribute("lang")).toBe("nqo");
    expect(root.querySelector(".review-example-nko")?.getAttribute("dir")).toBe("rtl");
    expect(root.querySelector(".ux2-review-reflection-prompt")?.textContent).toBe(
      "How did that feel?",
    );
    expect(root.querySelector(".review-still-learning")?.textContent).toBe("Not yet");
    expect(root.querySelector(".review-remembered")?.textContent).toBe("Got it");
    expect(root.textContent).not.toMatch(/incorrect|correct|mastered|score|%/i);
    expect(root.textContent).not.toContain("cache-gloss-secret");
  });

  it("omits N’Ko shells when absent", () => {
    const sparse: EnrichedRecord = {
      ir_id: "lex-2",
      ir_kind: "lexicon_entry",
      source_id: "s",
      norm_version: "norm_v3",
      preferred_form: "ba",
      variant_forms: [],
      search_keys: {},
      display: {
        headword_latin: "ba",
        senses: [{ gloss_fr: "go", examples: [{ text_latin: "a ba" }] }],
      },
    };
    const { root } = renderReview(
      reviewing({ item: reviewingItem(sparse), revealed: true }),
      callbacks(),
    );
    expect(root.querySelector("#review-headword")?.textContent).toBe("ba");
    expect(root.querySelector(".review-nko")).toBeNull();
    expect(root.querySelector(".review-example-nko")).toBeNull();
  });

  it("renders reflection failure while keeping revealed card", () => {
    const { root } = renderReview(
      reviewing({ revealed: true, error: "reflection_failed" }),
      callbacks(),
    );
    const err = root.querySelector("#review-card-error");
    expect(err?.getAttribute("role")).toBe("alert");
    expect(err?.textContent).toBe("Could not save your review. Try again.");
    expect(root.querySelector(".review-still-learning")).not.toBeNull();
    expect(root.querySelector(".review-remembered")).not.toBeNull();
    expect(root.querySelector("#review-meaning-heading")).not.toBeNull();
    expect(root.querySelector(".review-still-learning")?.getAttribute("aria-describedby")).toBe(
      "review-card-error",
    );
  });

  it("renders busy reviewing with aria-busy and disabled actions", () => {
    const cb = callbacks();
    const { root } = renderReview(reviewing({ revealed: true, busy: true }), cb);
    expect(root.querySelector(".review-card")?.getAttribute("aria-busy")).toBe("true");
    expect(root.querySelector(".review-busy-status")?.textContent).toBe("Saving review…");
    const still = root.querySelector<HTMLButtonElement>(".review-still-learning")!;
    const rem = root.querySelector<HTMLButtonElement>(".review-remembered")!;
    expect(still.disabled).toBe(true);
    expect(rem.disabled).toBe(true);
    still.click();
    rem.click();
    expect(cb.onReflect).not.toHaveBeenCalled();
  });

  it("renders complete with counts and review-again without mastery signals", () => {
    const cb = callbacks();
    const { root } = renderReview(
      {
        surface: "complete",
        reviewed_count: 4,
        still_learning_count: 2,
        remembered_count: 2,
        skipped_count: 1,
        unresolved_at_start_count: 3,
      },
      cb,
    );
    expect(root.querySelector("#review-complete-heading")?.textContent).toBe("Review complete");
    expect(root.textContent).toContain("Reviewed: 4");
    expect(root.textContent).toContain("Still learning: 2");
    expect(root.textContent).toContain("Remembered: 2");
    expect(root.textContent).toContain("Skipped: 1");
    expect(root.textContent).toContain("Unavailable: 3");
    expect(root.textContent).not.toMatch(/%|mastery|score|streak|perfect|accuracy/i);
    root.querySelector<HTMLButtonElement>(".review-again")!.click();
    expect(cb.onReviewAgain).toHaveBeenCalledTimes(1);
  });

  it("hides skipped and unavailable counts when zero", () => {
    const { root } = renderReview(
      {
        surface: "complete",
        reviewed_count: 1,
        still_learning_count: 1,
        remembered_count: 0,
        skipped_count: 0,
        unresolved_at_start_count: 0,
      },
      callbacks(),
    );
    expect(root.textContent).not.toContain("Skipped:");
    expect(root.textContent).not.toContain("Unavailable:");
  });

  it("maps Not yet → still_learning and Got it → remembered exactly", () => {
    const cb = callbacks();
    const hidden = renderReview(reviewing(), cb);
    hidden.root.querySelector<HTMLButtonElement>(".review-reveal")!.click();
    expect(cb.onReveal).toHaveBeenCalledTimes(1);

    const shown = renderReview(reviewing({ revealed: true }), cb);
    shown.root.querySelector<HTMLButtonElement>(".review-still-learning")!.click();
    shown.root.querySelector<HTMLButtonElement>(".review-remembered")!.click();
    expect(cb.onReflect).toHaveBeenNthCalledWith(1, "still_learning");
    expect(cb.onReflect).toHaveBeenNthCalledWith(2, "remembered");
  });

  it("uses heading and button semantics with distinct reflection names", () => {
    const { root } = renderReview(reviewing({ revealed: true }), callbacks());
    expect(root.querySelector("h2#review-heading")).not.toBeNull();
    expect(root.querySelector("article.review-card")).not.toBeNull();
    const still = root.querySelector<HTMLButtonElement>(".review-still-learning")!;
    const rem = root.querySelector<HTMLButtonElement>(".review-remembered")!;
    expect(still.tagName).toBe("BUTTON");
    expect(rem.tagName).toBe("BUTTON");
    expect(still.textContent).toBe("Not yet");
    expect(rem.textContent).toBe("Got it");
    expect(still.textContent).not.toBe(rem.textContent);
  });

  it("shouldMoveReviewFocus skips busy-only updates", () => {
    const a = reviewing({ revealed: true, busy: false });
    const b = reviewing({ revealed: true, busy: true });
    expect(shouldMoveReviewFocus(a, b)).toBe(false);
    expect(shouldMoveReviewFocus(a, reviewing({ revealed: true, position: 2 }))).toBe(true);
    expect(shouldMoveReviewFocus(reviewing(), reviewing({ revealed: true }))).toBe(true);
  });

  it("localizes conversational reflection labels and failure copy in French", () => {
    setCurrentLocale("fr");
    const revealed = renderReview(reviewing({ revealed: true }), callbacks());
    expect(revealed.root.querySelector(".review-still-learning")?.textContent).toBe("Pas encore");
    expect(revealed.root.querySelector(".review-remembered")?.textContent).toBe("Je l’ai");
    expect(revealed.root.querySelector(".ux2-review-reflection-prompt")?.textContent).toContain(
      "Comment",
    );

    const failed = renderReview(
      reviewing({ revealed: true, error: "reflection_failed" }),
      callbacks(),
    );
    expect(failed.root.querySelector("#review-card-error")?.textContent).toBe(
      "Impossible d’enregistrer votre révision. Réessayez.",
    );
  });
});
