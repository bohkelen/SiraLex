// @vitest-environment node

import { describe, expect, it } from "vitest";

import { preferredGlossLanguage } from "../search/lookup_mode";
import {
  bindTargetNavToSearchOrigin,
  targetNavPreferredGlossLanguage,
} from "./target_nav_lookup_mode";

describe("ML1D3A bindTargetNavToSearchOrigin", () => {
  it("keeps EN→MNK origin when live picker later switched to FR→MNK", () => {
    const origin = { from: "en" as const, to: "mnk" as const };
    const live = { from: "fr" as const, to: "mnk" as const };
    const bound = bindTargetNavToSearchOrigin(origin, live);

    expect(bound.restoreLookupMode).toEqual(origin);
    expect(bound.chromeLookupMode).toEqual({ from: "mnk", to: "en" });
    expect(targetNavPreferredGlossLanguage(origin, live)).toBe("en");
    expect(preferredGlossLanguage(bound.restoreLookupMode)).toBe("en");
    // Live mode must not leak into the binding.
    expect(bound.restoreLookupMode).not.toEqual(live);
  });

  it("keeps FR→MNK origin when live picker later switched to EN→MNK", () => {
    const origin = { from: "fr" as const, to: "mnk" as const };
    const live = { from: "en" as const, to: "mnk" as const };
    const bound = bindTargetNavToSearchOrigin(origin, live);

    expect(bound.restoreLookupMode).toEqual(origin);
    expect(bound.chromeLookupMode).toEqual({ from: "mnk", to: "fr" });
    expect(targetNavPreferredGlossLanguage(origin, live)).toBe("fr");
  });

  it("MNK→EN origin yields EN chrome partner and EN preferred gloss", () => {
    const origin = { from: "mnk" as const, to: "en" as const };
    const bound = bindTargetNavToSearchOrigin(origin, { from: "fr", to: "mnk" });
    expect(bound.chromeLookupMode).toEqual({ from: "mnk", to: "en" });
    expect(preferredGlossLanguage(bound.restoreLookupMode)).toBe("en");
  });
});
