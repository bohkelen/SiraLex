import { describe, expect, it } from "vitest";

import {
  getBundleDisplayName,
  getSearchDirectionText,
  getSearchPlaceholder,
  getSourceLabel,
  getTargetEntriesLabel,
  getTargetLabel,
} from "./bundle_labels";
import type { BundleLanguageMeta } from "./idb/siralex_db";

const LANGUAGE_META: BundleLanguageMeta = {
  source_lang: "fr",
  target_lang: "mnk",
  source_label: "French",
  target_label: "Maninka",
};

describe("bundle language labels", () => {
  it("localizes French source labels for French UI copy", () => {
    expect(getSourceLabel(LANGUAGE_META, "Source", "fr")).toBe("Français");
    expect(getTargetLabel(LANGUAGE_META, "Cible", "fr")).toBe("Maninka");
    expect(getBundleDisplayName("bundle-id", LANGUAGE_META, "Source", "Cible", "fr")).toBe(
      "Français ↔ Maninka",
    );
    expect(getSearchDirectionText("source_to_target", LANGUAGE_META, "Source", "Cible", "fr")).toBe(
      "Français → Maninka",
    );
    expect(
      getSearchPlaceholder(
        "source_to_target",
        LANGUAGE_META,
        "Source",
        "Cible",
        (label) => `Saisissez un mot en ${label}…`,
        "fr",
      ),
    ).toBe("Saisissez un mot en Français…");
    expect(
      getTargetEntriesLabel(
        LANGUAGE_META,
        "Cible",
        (label) => `Entrées ${label} :`,
        "fr",
      ),
    ).toBe("Entrées Maninka :");
  });

  it("keeps English language labels for English UI copy", () => {
    expect(getBundleDisplayName("bundle-id", LANGUAGE_META, "Source", "Target", "en")).toBe(
      "French ↔ Maninka",
    );
    expect(getSearchDirectionText("source_to_target", LANGUAGE_META, "Source", "Target", "en")).toBe(
      "French → Maninka",
    );
  });

  it("preserves legacy fallback behavior when no display locale is provided", () => {
    expect(getBundleDisplayName("bundle-id", LANGUAGE_META, "Source", "Target")).toBe(
      "French ↔ Maninka",
    );
  });

  it("does not leak English catalog source labels into French UI", () => {
    // Simulate Intl missing a useful name by relying on static fallback for fr/fr.
    expect(getSourceLabel(LANGUAGE_META, "Source", "fr")).toBe("Français");
    expect(getBundleDisplayName("bundle-id", LANGUAGE_META, "Source", "Cible", "fr")).toBe(
      "Français ↔ Maninka",
    );
  });
});
