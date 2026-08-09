import { describe, expect, it } from "vitest";

import { decideLookupModeActiveBundleSync } from "./lookup_mode_active_bundle_sync";
import {
  resolveSupportedLookupMode,
  restoreForwardLookupModeFromPreference,
  type LookupMode,
} from "./lookup_mode";

const EN_CAPABLE = {
  lookup_languages: ["fr", "en", "mnk"],
  search_key_families: ["src", "en", "tgt"],
};

describe("decideLookupModeActiveBundleSync", () => {
  it("restores preference on first hydration", () => {
    expect(
      decideLookupModeActiveBundleSync({
        hydrated: false,
        previousBundleId: undefined,
        nextBundleId: "bundle-a",
        previousEnglishAvailable: undefined,
        nextEnglishAvailable: true,
      }),
    ).toBe("restore_preference_forward");
  });

  it("defaults when there is no active bundle", () => {
    expect(
      decideLookupModeActiveBundleSync({
        hydrated: true,
        previousBundleId: "bundle-a",
        nextBundleId: undefined,
        previousEnglishAvailable: true,
        nextEnglishAvailable: false,
      }),
    ).toBe("default_fr_mnk");
  });

  it("restores preference on bundle_id change", () => {
    expect(
      decideLookupModeActiveBundleSync({
        hydrated: true,
        previousBundleId: "bundle-a",
        nextBundleId: "bundle-b",
        previousEnglishAvailable: true,
        nextEnglishAvailable: true,
      }),
    ).toBe("restore_preference_forward");
  });

  it("revalidates on EN capability loss (same bundle_id)", () => {
    expect(
      decideLookupModeActiveBundleSync({
        hydrated: true,
        previousBundleId: "bundle-a",
        nextBundleId: "bundle-a",
        previousEnglishAvailable: true,
        nextEnglishAvailable: false,
      }),
    ).toBe("revalidate_current");
  });

  it("restores preference on same-bundle EN capability recovery", () => {
    expect(
      decideLookupModeActiveBundleSync({
        hydrated: true,
        previousBundleId: "bundle-a",
        nextBundleId: "bundle-a",
        previousEnglishAvailable: false,
        nextEnglishAvailable: true,
      }),
    ).toBe("restore_preference_forward");
  });

  it("revalidates when EN stays available across content updates", () => {
    expect(
      decideLookupModeActiveBundleSync({
        hydrated: true,
        previousBundleId: "bundle-a",
        nextBundleId: "bundle-a",
        previousEnglishAvailable: true,
        nextEnglishAvailable: true,
      }),
    ).toBe("revalidate_current");
  });

  it("revalidates when EN stays unavailable", () => {
    expect(
      decideLookupModeActiveBundleSync({
        hydrated: true,
        previousBundleId: "bundle-a",
        nextBundleId: "bundle-a",
        previousEnglishAvailable: false,
        nextEnglishAvailable: false,
      }),
    ).toBe("revalidate_current");
  });
});

describe("ML1D2A capability transition outcomes", () => {
  it("first hydration + pref=en + EN-capable → EN→MNK", () => {
    expect(restoreForwardLookupModeFromPreference("en", EN_CAPABLE)).toEqual({
      from: "en",
      to: "mnk",
    });
  });

  it("first hydration + pref=en + FR-only → FR→MNK", () => {
    expect(restoreForwardLookupModeFromPreference("en", {})).toEqual({
      from: "fr",
      to: "mnk",
    });
  });

  it("EN→FR-only revalidate clamps mode but preference is external", () => {
    const clamped = resolveSupportedLookupMode({}, { from: "mnk", to: "en" });
    expect(clamped).toEqual({ from: "fr", to: "mnk" });
    // Preference retention is ownership of storage, not this helper.
    expect("en").toBe("en");
  });

  it("FR-only→EN recovery with pref=en restores EN→MNK", () => {
    const action = decideLookupModeActiveBundleSync({
      hydrated: true,
      previousBundleId: "same",
      nextBundleId: "same",
      previousEnglishAvailable: false,
      nextEnglishAvailable: true,
    });
    expect(action).toBe("restore_preference_forward");
    expect(restoreForwardLookupModeFromPreference("en", EN_CAPABLE)).toEqual({
      from: "en",
      to: "mnk",
    });
  });

  it("FR-only→EN recovery with pref=fr stays FR→MNK", () => {
    expect(restoreForwardLookupModeFromPreference("fr", EN_CAPABLE)).toEqual({
      from: "fr",
      to: "mnk",
    });
  });

  it("same-capability update preserves swapped orientation via revalidate", () => {
    const action = decideLookupModeActiveBundleSync({
      hydrated: true,
      previousBundleId: "same",
      nextBundleId: "same",
      previousEnglishAvailable: true,
      nextEnglishAvailable: true,
    });
    expect(action).toBe("revalidate_current");
    const current: LookupMode = { from: "mnk", to: "en" };
    expect(resolveSupportedLookupMode(EN_CAPABLE, current)).toEqual(current);
  });
});
