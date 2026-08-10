// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveSavedPresentationPreferredGlossLanguage } from "./saved_presentation_gloss_preference";

describe("resolveSavedPresentationPreferredGlossLanguage", () => {
  const enCapable = {
    lookup_languages: ["fr", "en", "mnk"],
    search_key_families: ["src", "en", "tgt"],
  };
  const frOnly = {
    lookup_languages: ["fr", "mnk"],
    search_key_families: ["src", "tgt"],
  };

  it("uses EN when stored en and bundle is EN-capable", () => {
    expect(resolveSavedPresentationPreferredGlossLanguage(enCapable, "en")).toBe("en");
  });

  it("clamps to FR when stored en but bundle lacks EN", () => {
    expect(resolveSavedPresentationPreferredGlossLanguage(frOnly, "en")).toBe("fr");
  });

  it("uses FR when stored fr", () => {
    expect(resolveSavedPresentationPreferredGlossLanguage(enCapable, "fr")).toBe("fr");
  });
});
