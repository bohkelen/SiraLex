import { describe, expect, it } from "vitest";

import {
  assertBundleSupportsLookupMode,
  bundleSupportsEnglishLookup,
  bundleSupportsLookupMode,
  DEFAULT_LOOKUP_MODE,
  glossFallbackChain,
  indexFamilyForLookupInput,
  isValidLookupMode,
  LookupCapabilityError,
  lookupModeFromLegacySearchDirection,
  preferredGlossLanguage,
  resolveLookupModeFromFeedbackFields,
  resolveSupportedLookupMode,
  swapLookupMode,
  toLegacySearchDirection,
} from "./lookup_mode";

describe("LookupMode validation", () => {
  it("accepts only the four valid pairs", () => {
    expect(isValidLookupMode({ from: "fr", to: "mnk" })).toBe(true);
    expect(isValidLookupMode({ from: "en", to: "mnk" })).toBe(true);
    expect(isValidLookupMode({ from: "mnk", to: "fr" })).toBe(true);
    expect(isValidLookupMode({ from: "mnk", to: "en" })).toBe(true);
  });

  it("rejects invalid pairs", () => {
    expect(isValidLookupMode({ from: "fr", to: "en" })).toBe(false);
    expect(isValidLookupMode({ from: "en", to: "fr" })).toBe(false);
    expect(isValidLookupMode({ from: "fr", to: "fr" })).toBe(false);
    expect(isValidLookupMode({ from: "en", to: "en" })).toBe(false);
    expect(isValidLookupMode({ from: "mnk", to: "mnk" })).toBe(false);
  });
});

describe("key-family mapping", () => {
  it("maps fr→src, en→en, mnk→tgt", () => {
    expect(indexFamilyForLookupInput("fr")).toBe("src");
    expect(indexFamilyForLookupInput("en")).toBe("en");
    expect(indexFamilyForLookupInput("mnk")).toBe("tgt");
  });
});

describe("legacy adapter", () => {
  it("maps source_to_target to FR→MNK only", () => {
    expect(lookupModeFromLegacySearchDirection("source_to_target")).toEqual({
      from: "fr",
      to: "mnk",
    });
  });

  it("maps target_to_source to MNK→FR only", () => {
    expect(lookupModeFromLegacySearchDirection("target_to_source")).toEqual({
      from: "mnk",
      to: "fr",
    });
  });

  it("round-trips legacy mirrors", () => {
    expect(toLegacySearchDirection({ from: "fr", to: "mnk" })).toBe("source_to_target");
    expect(toLegacySearchDirection({ from: "en", to: "mnk" })).toBe("source_to_target");
    expect(toLegacySearchDirection({ from: "mnk", to: "fr" })).toBe("target_to_source");
    expect(toLegacySearchDirection({ from: "mnk", to: "en" })).toBe("target_to_source");
  });
});

describe("swapLookupMode", () => {
  it("swaps FR↔MNK and EN↔MNK", () => {
    expect(swapLookupMode({ from: "fr", to: "mnk" })).toEqual({ from: "mnk", to: "fr" });
    expect(swapLookupMode({ from: "mnk", to: "fr" })).toEqual({ from: "fr", to: "mnk" });
    expect(swapLookupMode({ from: "en", to: "mnk" })).toEqual({ from: "mnk", to: "en" });
    expect(swapLookupMode({ from: "mnk", to: "en" })).toEqual({ from: "en", to: "mnk" });
  });

  it("fail-closes invalid modes", () => {
    expect(() => swapLookupMode({ from: "fr", to: "en" } as never)).toThrow(
      LookupCapabilityError,
    );
  });
});

describe("resolveSupportedLookupMode", () => {
  const enCapable = {
    lookup_languages: ["fr", "en", "mnk"],
    search_key_families: ["src", "en", "tgt"],
  };

  it("preserves supported requested modes", () => {
    expect(resolveSupportedLookupMode(enCapable, { from: "en", to: "mnk" })).toEqual({
      from: "en",
      to: "mnk",
    });
    expect(resolveSupportedLookupMode({}, { from: "fr", to: "mnk" })).toEqual({
      from: "fr",
      to: "mnk",
    });
  });

  it("falls back to FR→MNK when EN is unsupported (never to MNK→FR)", () => {
    expect(resolveSupportedLookupMode({}, { from: "en", to: "mnk" })).toEqual(
      DEFAULT_LOOKUP_MODE,
    );
    expect(resolveSupportedLookupMode({}, { from: "mnk", to: "en" })).toEqual(
      DEFAULT_LOOKUP_MODE,
    );
  });
});

describe("preferred gloss language", () => {
  it("follows LookupMode.to for MNK→FR/EN", () => {
    expect(preferredGlossLanguage({ from: "mnk", to: "fr" })).toBe("fr");
    expect(preferredGlossLanguage({ from: "mnk", to: "en" })).toBe("en");
  });

  it("prefers EN for EN→MNK and FR for FR→MNK", () => {
    expect(preferredGlossLanguage({ from: "en", to: "mnk" })).toBe("en");
    expect(preferredGlossLanguage({ from: "fr", to: "mnk" })).toBe("fr");
  });

  it("never includes Russian in the fallback chain", () => {
    expect(glossFallbackChain("en")).toEqual(["en", "fr"]);
    expect(glossFallbackChain("fr")).toEqual(["fr", "en"]);
  });
});

describe("English capability gating", () => {
  it("requires both lookup_languages and search_key_families to include en", () => {
    expect(bundleSupportsEnglishLookup({})).toBe(false);
    expect(bundleSupportsEnglishLookup({ lookup_languages: ["en"] })).toBe(false);
    expect(bundleSupportsEnglishLookup({ search_key_families: ["en"] })).toBe(false);
    expect(
      bundleSupportsEnglishLookup({
        lookup_languages: ["en", "fr", "mnk"],
        search_key_families: ["en", "src", "tgt"],
      }),
    ).toBe(true);
  });

  it("allows FR↔MNK without English capability", () => {
    expect(bundleSupportsLookupMode({}, { from: "fr", to: "mnk" })).toBe(true);
    expect(bundleSupportsLookupMode({}, { from: "mnk", to: "fr" })).toBe(true);
    expect(bundleSupportsLookupMode({}, { from: "en", to: "mnk" })).toBe(false);
  });

  it("fail-closes English lookup on unsupported bundles", () => {
    expect(() =>
      assertBundleSupportsLookupMode({}, { from: "en", to: "mnk" }),
    ).toThrow(LookupCapabilityError);
  });
});

describe("CF2 legacy interpretation helper", () => {
  it("interprets missing pair + source_to_target as FR→MNK", () => {
    expect(
      resolveLookupModeFromFeedbackFields({ search_direction: "source_to_target" }),
    ).toEqual({ from: "fr", to: "mnk" });
  });

  it("interprets missing pair + target_to_source as MNK→FR", () => {
    expect(
      resolveLookupModeFromFeedbackFields({ search_direction: "target_to_source" }),
    ).toEqual({ from: "mnk", to: "fr" });
  });

  it("resolves explicit EN→MNK and MNK→EN pairs", () => {
    expect(
      resolveLookupModeFromFeedbackFields({
        search_direction: "source_to_target",
        input_lang: "en",
        output_lang: "mnk",
      }),
    ).toEqual({ from: "en", to: "mnk" });
    expect(
      resolveLookupModeFromFeedbackFields({
        search_direction: "target_to_source",
        input_lang: "mnk",
        output_lang: "en",
      }),
    ).toEqual({ from: "mnk", to: "en" });
  });
});
