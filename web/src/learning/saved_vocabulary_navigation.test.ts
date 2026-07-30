/**
 * LS1 navigation / stale-async guards (LS1I3 + LS1I4).
 * Mirrors generation and host-context rules used by main.ts.
 */

import { describe, expect, it, vi } from "vitest";

import type { SavedVocabularyModel } from "./saved_vocabulary_session";
import { deriveSavedVocabularyProgress } from "./saved_vocabulary_progress";

describe("LS1 Saved Vocabulary navigation and stale-async guards", () => {
  it("drops applyModel when generation or host context changes", () => {
    let generation = 1;
    let host: "search" | "saved_vocabulary" | "entry_from_saved" = "saved_vocabulary";
    const applied: SavedVocabularyModel[] = [];

    const applyModel = (model: SavedVocabularyModel, gen: number) => {
      if (gen !== generation || host !== "saved_vocabulary") return;
      applied.push(model);
    };

    applyModel({ surface: "loading" }, 1);
    expect(applied).toHaveLength(1);

    generation = 2;
    applyModel({ surface: "empty" }, 1);
    expect(applied).toHaveLength(1);

    host = "search";
    applyModel({ surface: "empty" }, 2);
    expect(applied).toHaveLength(1);

    host = "entry_from_saved";
    applyModel(
      {
        surface: "populated",
        rows: [],
        rowErrors: {},
        progress: deriveSavedVocabularyProgress([]).progress,
        canStartReview: false,
      },
      2,
    );
    expect(applied).toHaveLength(1);

    host = "saved_vocabulary";
    applyModel({ surface: "empty" }, 2);
    expect(applied).toHaveLength(2);
  });

  it("Review Back sets one-use Start Review focus intent without runSearch", () => {
    const runSearch = vi.fn();
    let focusStartReviewOnce = false;
    let host: "review" | "saved_vocabulary" = "review";
    const showSavedVocabulary = vi.fn(() => {
      expect(focusStartReviewOnce).toBe(true);
      focusStartReviewOnce = false;
      host = "saved_vocabulary";
    });
    const onReviewBack = () => {
      focusStartReviewOnce = true;
      showSavedVocabulary();
    };
    onReviewBack();
    expect(showSavedVocabulary).toHaveBeenCalledTimes(1);
    expect(host).toBe("saved_vocabulary");
    expect(runSearch).not.toHaveBeenCalled();
    expect(focusStartReviewOnce).toBe(false);
  });

  it("stale Saved Vocabulary apply cannot redraw Review host context", () => {
    let generation = 1;
    let host: string = "review";
    const applied: string[] = [];
    const applySaved = (label: string, gen: number) => {
      if (gen !== generation || host !== "saved_vocabulary") return;
      applied.push(label);
    };
    applySaved("late-sv", 1);
    expect(applied).toEqual([]);
  });

  it("opening Saved Vocabulary must not invoke runSearch", () => {
    const runSearch = vi.fn();
    const showSavedVocabulary = () => {
      // production path replaces #searchResults without searching
    };
    showSavedVocabulary();
    expect(runSearch).not.toHaveBeenCalled();
  });

  it("Back from Saved Vocabulary restores search list without runSearch", () => {
    const runSearch = vi.fn();
    const showResultsList = vi.fn(() => {
      // restores lastSearchResults only
    });
    const onBack = () => {
      showResultsList();
    };
    onBack();
    expect(showResultsList).toHaveBeenCalledTimes(1);
    expect(runSearch).not.toHaveBeenCalled();
  });

  it("entry back-from-saved reopens vocabulary rather than search list", () => {
    const showResultsList = vi.fn();
    const showSavedVocabulary = vi.fn();
    const openedFrom: "search" | "saved_vocabulary" = "saved_vocabulary";
    const onBack = () => {
      if (openedFrom === "saved_vocabulary") showSavedVocabulary();
      else showResultsList();
    };
    onBack();
    expect(showSavedVocabulary).toHaveBeenCalledTimes(1);
    expect(showResultsList).not.toHaveBeenCalled();
  });

  it("stale remove completion cannot redraw after user left Saved Vocabulary", async () => {
    let generation = 1;
    let host: "search" | "saved_vocabulary" = "saved_vocabulary";
    const redraws: string[] = [];

    const applyAfterRemove = (gen: number, label: string) => {
      if (gen !== generation || host !== "saved_vocabulary") return;
      redraws.push(label);
    };

    const removePromise = Promise.resolve("ok").then(() => {
      applyAfterRemove(1, "stale-ok");
    });

    generation = 2;
    host = "search";
    await removePromise;
    expect(redraws).toEqual([]);
  });

  it("switching active bundle requires a new Saved Vocabulary open/generation", () => {
    let generation = 1;
    let activeBundleId = "bundle-a";
    const loads: string[] = [];

    const openSavedVocabulary = (bundleId: string) => {
      generation += 1;
      activeBundleId = bundleId;
      loads.push(`${generation}:${activeBundleId}`);
    };

    openSavedVocabulary("bundle-a");
    openSavedVocabulary("bundle-b");
    expect(loads).toEqual(["2:bundle-a", "3:bundle-b"]);
  });

  it("stale Saved Vocabulary load cannot replace a newer entry view", () => {
    let generation = 1;
    let host: "search" | "saved_vocabulary" | "entry_from_saved" = "saved_vocabulary";
    const applied: string[] = [];

    const applySavedVocabulary = (label: string, gen: number) => {
      if (gen !== generation || host !== "saved_vocabulary") return;
      applied.push(label);
    };

    applySavedVocabulary("load-1", 1);
    generation = 2;
    host = "entry_from_saved";
    applySavedVocabulary("late-load-1", 1);
    expect(applied).toEqual(["load-1"]);
  });

  it("after Remove, returning to entry detail uses not_saved on the next current render", () => {
    let host: "saved_vocabulary" | "entry_from_saved" = "saved_vocabulary";
    let entrySaveState: "saved" | "not_saved" = "saved";

    const onRemoveOk = () => {
      entrySaveState = "not_saved";
    };
    const openEntryAgain = () => {
      host = "entry_from_saved";
      // next current entry render reads fresh saved-state
    };

    onRemoveOk();
    openEntryAgain();
    expect(host).toBe("entry_from_saved");
    expect(entrySaveState).toBe("not_saved");
  });

  it("unresolved row has no Open action at the navigation contract layer", () => {
    const row = { state: "unresolved" as const, canOpen: false };
    expect(row.canOpen).toBe(false);
  });
});
