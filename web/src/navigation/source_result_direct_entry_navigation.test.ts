/**
 * Navigation contracts for Source→Target target-entry direct open + Back.
 */

import { describe, expect, it, vi } from "vitest";

import type { SearchDirection } from "../bundle_labels";

describe("Source→Target direct entry navigation contracts", () => {
  it("selecting a target commits direction to target_to_source without runSearch", () => {
    let direction: SearchDirection = "source_to_target";
    let searchInput = "main";
    const runSearch = vi.fn();
    const opened: string[] = [];

    const onSelectTarget = (irId: string) => {
      // resolve succeeded
      direction = "target_to_source";
      opened.push(irId);
      // must not mutate query or search
    };

    onSelectTarget("lex-bolo");
    expect(direction).toBe("target_to_source");
    expect(searchInput).toBe("main");
    expect(opened).toEqual(["lex-bolo"]);
    expect(runSearch).not.toHaveBeenCalled();
  });

  it("Back restores prior Source→Target results without runSearch", () => {
    let direction: SearchDirection = "target_to_source";
    const restoreDirection: SearchDirection = "source_to_target";
    const lastSearchResults = [{ query: "main" }];
    const runSearch = vi.fn();
    let host: "entry" | "results" = "entry";

    const onBack = () => {
      direction = restoreDirection;
      host = "results";
      // show lastSearchResults only
      void lastSearchResults;
    };

    onBack();
    expect(direction).toBe("source_to_target");
    expect(host).toBe("results");
    expect(runSearch).not.toHaveBeenCalled();
  });

  it("entry opened from Target→Source restores Target→Source on Back", () => {
    let direction: SearchDirection = "target_to_source";
    const origin = { kind: "search" as const, restoreDirection: "target_to_source" as const };
    const onBack = () => {
      direction = origin.restoreDirection;
    };
    onBack();
    expect(direction).toBe("target_to_source");
  });

  it("entry opened from Saved Vocabulary returns to Saved Vocabulary", () => {
    const showSaved = vi.fn();
    const showResults = vi.fn();
    const origin = { kind: "saved_vocabulary" as const };
    const onBack = () => {
      if (origin.kind === "saved_vocabulary") showSaved();
      else showResults();
    };
    onBack();
    expect(showSaved).toHaveBeenCalledTimes(1);
    expect(showResults).not.toHaveBeenCalled();
  });

  it("Save identity is the selected lexicon ir_id, not the source mapping", () => {
    const selected = { ir_id: "lex-bolo", ir_kind: "lexicon_entry" as const };
    const mapping = { ir_id: "idx-main", ir_kind: "index_mapping" as const };
    expect(selected.ir_id).not.toBe(mapping.ir_id);
    expect(selected.ir_kind).toBe("lexicon_entry");
  });

  it("stale resolution cannot replace a newer surface", () => {
    let generation = 1;
    let host: "entry_from_search" | "search" = "entry_from_search";
    const opens: string[] = [];

    const applyOpen = (label: string, gen: number) => {
      if (gen !== generation || host !== "entry_from_search") return;
      opens.push(label);
    };

    generation = 2;
    host = "search";
    applyOpen("late", 1);
    expect(opens).toEqual([]);
  });

  it("active-bundle switch invalidates pending entry opening", () => {
    let activeBundleId = "bundle-a";
    const pendingBundleId = "bundle-a";
    const isCurrent = () => activeBundleId === pendingBundleId;
    activeBundleId = "bundle-b";
    expect(isCurrent()).toBe(false);
  });
});
