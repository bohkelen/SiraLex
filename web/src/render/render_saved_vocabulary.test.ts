// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import type { SavedVocabularyViewModel } from "../learning/saved_vocabulary_session";
import { applySavedVocabularyView, renderSavedVocabularySurface } from "./render_saved_vocabulary";

function populatedVm(overrides: Partial<SavedVocabularyViewModel> = {}): SavedVocabularyViewModel {
  return {
    state: "populated",
    boundBundleId: "bundle",
    boundStorageScopeId: "bundle::sha",
    statusMessage: "none",
    rows: [
      {
        ir_id: "lex-1",
        bundle_id: "bundle",
        storage_scope_id: "bundle::sha",
        headword_latin: "kùn",
        gloss_short: "tête",
        openable: true,
        unresolved: false,
        removing: false,
      },
    ],
    ...overrides,
  };
}

describe("Saved Vocabulary renderer", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("renders accessibility states for loading/empty/error/unavailable", () => {
    for (const state of ["loading", "empty", "error", "unavailable"] as const) {
      const root = renderSavedVocabularySurface(
        {
          state,
          boundBundleId: null,
          boundStorageScopeId: null,
          rows: [],
          statusMessage: "none",
        },
        { onBack: () => undefined, onOpen: () => undefined, onRemove: () => undefined },
      );
      expect(root.getAttribute("aria-busy")).toBe(state === "loading" ? "true" : "false");
      expect(root.querySelector("#saved-vocab-status")?.getAttribute("role")).toBe("status");
      expect(root.querySelector(".saved-vocab-list")).toBeNull();
    }
  });

  it("renders semantic list with keyboard buttons and display-cache text", () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    const root = renderSavedVocabularySurface(populatedVm(), {
      onBack: () => undefined,
      onOpen,
      onRemove,
    });
    const list = root.querySelector("ul.saved-vocab-list");
    expect(list).not.toBeNull();
    expect(list?.getAttribute("aria-label")).toBe("Saved vocabulary");
    expect(root.textContent).toContain("kùn");
    expect(root.textContent).toContain("tête");
    const openBtn = root.querySelector<HTMLButtonElement>(".saved-vocab-open");
    const removeBtn = root.querySelector<HTMLButtonElement>(".saved-vocab-remove");
    expect(openBtn?.type).toBe("button");
    expect(removeBtn?.type).toBe("button");
    openBtn?.click();
    removeBtn?.click();
    expect(onOpen).toHaveBeenCalledWith("lex-1");
    expect(onRemove).toHaveBeenCalledWith("lex-1");
  });

  it("disables actions and sets aria-busy while removing", () => {
    const root = document.createElement("div");
    applySavedVocabularyView(
      root,
      populatedVm({
        state: "removing",
        rows: [
          {
            ir_id: "lex-1",
            bundle_id: "bundle",
            storage_scope_id: "bundle::sha",
            headword_latin: "kùn",
            openable: true,
            unresolved: false,
            removing: true,
          },
        ],
      }),
      { onBack: () => undefined, onOpen: () => undefined, onRemove: () => undefined },
    );
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(root.querySelector<HTMLButtonElement>(".saved-vocab-remove")?.disabled).toBe(true);
    expect(root.querySelector(".saved-vocab-remove")?.getAttribute("aria-busy")).toBe("true");
  });

  it("shows unresolved copy without open control", () => {
    const root = renderSavedVocabularySurface(
      populatedVm({
        rows: [
          {
            ir_id: "lex-missing",
            bundle_id: "bundle",
            storage_scope_id: "bundle::sha",
            headword_latin: "ghost",
            openable: false,
            unresolved: true,
            removing: false,
          },
        ],
      }),
      { onBack: () => undefined, onOpen: () => undefined, onRemove: () => undefined },
    );
    expect(root.textContent).toContain("Unavailable in this dictionary");
    expect(root.querySelector(".saved-vocab-open")).toBeNull();
    expect(root.querySelector(".saved-vocab-remove")).not.toBeNull();
  });
});
