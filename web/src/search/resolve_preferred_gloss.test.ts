// @vitest-environment node

import { describe, expect, it } from "vitest";

import { preferredGlossLanguage } from "./lookup_mode";
import { resolvePreferredGloss } from "./resolve_preferred_gloss";

describe("resolvePreferredGloss", () => {
  const bilingual = { glossFr: "maison", glossEn: "house" };
  const frOnly = { glossFr: "maison", glossEn: "" };
  const enOnly = { glossFr: "  ", glossEn: "house" };
  const withRu = { glossFr: "maison", glossEn: "house", glossRu: "дом" };
  const ruOnly = { glossFr: "", glossEn: undefined, glossRu: "дом" };

  it("preferred EN → EN then FR; never RU", () => {
    expect(resolvePreferredGloss({ ...bilingual, preferred: "en" })).toEqual({
      text: "house",
      language: "en",
      usedFallback: false,
    });
    expect(resolvePreferredGloss({ ...frOnly, preferred: "en" })).toEqual({
      text: "maison",
      language: "fr",
      usedFallback: true,
    });
    expect(resolvePreferredGloss({ ...enOnly, preferred: "en" })).toEqual({
      text: "house",
      language: "en",
      usedFallback: false,
    });
    expect(resolvePreferredGloss({ glossFr: withRu.glossFr, glossEn: withRu.glossEn, preferred: "en" })).toEqual({
      text: "house",
      language: "en",
      usedFallback: false,
    });
    expect(resolvePreferredGloss({ glossFr: ruOnly.glossFr, glossEn: ruOnly.glossEn, preferred: "en" })).toEqual({
      usedFallback: false,
    });
  });

  it("preferred FR → FR then EN; never RU", () => {
    expect(resolvePreferredGloss({ ...bilingual, preferred: "fr" })).toEqual({
      text: "maison",
      language: "fr",
      usedFallback: false,
    });
    expect(resolvePreferredGloss({ ...frOnly, preferred: "fr" })).toEqual({
      text: "maison",
      language: "fr",
      usedFallback: false,
    });
    expect(resolvePreferredGloss({ ...enOnly, preferred: "fr" })).toEqual({
      text: "house",
      language: "en",
      usedFallback: true,
    });
    expect(resolvePreferredGloss({ glossFr: withRu.glossFr, glossEn: withRu.glossEn, preferred: "fr" })).toEqual({
      text: "maison",
      language: "fr",
      usedFallback: false,
    });
    expect(resolvePreferredGloss({ glossFr: ruOnly.glossFr, glossEn: ruOnly.glossEn, preferred: "fr" })).toEqual({
      usedFallback: false,
    });
  });

  it("trims empty strings as unavailable", () => {
    expect(
      resolvePreferredGloss({ glossFr: "  ", glossEn: "\t", preferred: "en" }),
    ).toEqual({ usedFallback: false });
  });

  it("LookupMode preference maps to resolver preference", () => {
    expect(preferredGlossLanguage({ from: "en", to: "mnk" })).toBe("en");
    expect(preferredGlossLanguage({ from: "mnk", to: "en" })).toBe("en");
    expect(preferredGlossLanguage({ from: "fr", to: "mnk" })).toBe("fr");
    expect(preferredGlossLanguage({ from: "mnk", to: "fr" })).toBe("fr");
  });
});
