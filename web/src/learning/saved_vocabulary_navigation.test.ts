/**
 * LS1I3 navigation helpers tested in isolation from the full main.ts shell.
 * Mirrors the generation/context guards used by showSavedVocabulary.
 */

import { describe, expect, it, vi } from "vitest";

import type { SavedVocabularyModel } from "../learning/saved_vocabulary_session";

describe("LS1I3 Saved Vocabulary navigation guards", () => {
  it("drops applyModel when generation or host context changes", () => {
    let generation = 1;
    let host: "search" | "saved_vocabulary" = "saved_vocabulary";
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

    host = "saved_vocabulary";
    applyModel({ surface: "empty" }, 2);
    expect(applied).toHaveLength(2);
  });

  it("entry back-from-saved should reopen vocabulary rather than search list", () => {
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
});
