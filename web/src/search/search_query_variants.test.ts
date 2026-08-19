import { describe, expect, it } from "vitest";

import {
  HYPHEN_SPACE_EXPANSION_MAX_VARIANTS,
  hyphenSpaceExpansionAllowed,
  hyphenSpaceExpansionQueries,
} from "./search_query_variants";

describe("hyphenSpaceExpansionQueries", () => {
  it("maps spaced French/English compounds to hyphenated variants", () => {
    expect(hyphenSpaceExpansionQueries("grand pere")).toEqual(["grand-pere"]);
    expect(hyphenSpaceExpansionQueries("right hand")).toEqual(["right-hand"]);
  });

  it("maps hyphenated compounds to spaced variants", () => {
    expect(hyphenSpaceExpansionQueries("right-hand")).toEqual(["right hand"]);
    expect(hyphenSpaceExpansionQueries("pick-up")).toEqual(["pick up"]);
  });

  it("collapses repeated spaces before generating a variant", () => {
    expect(hyphenSpaceExpansionQueries("grand   pere")).toEqual(["grand-pere"]);
    expect(hyphenSpaceExpansionQueries("  right   hand  ")).toEqual(["right-hand"]);
  });

  it("bounds mixed hyphen/space queries to at most two variants", () => {
    const variants = hyphenSpaceExpansionQueries("grand-pere extra");
    expect(variants).toEqual(["grand-pere-extra", "grand pere extra"]);
    expect(variants.length).toBeLessThanOrEqual(HYPHEN_SPACE_EXPANSION_MAX_VARIANTS);
  });

  it("returns no variants without ASCII space or hyphen", () => {
    expect(hyphenSpaceExpansionQueries("maison")).toEqual([]);
    expect(hyphenSpaceExpansionQueries("house")).toEqual([]);
    expect(hyphenSpaceExpansionQueries("")).toEqual([]);
    expect(hyphenSpaceExpansionQueries("   ")).toEqual([]);
  });

  it("does not treat en dashes, slashes, or apostrophes as hyphen/space", () => {
    expect(hyphenSpaceExpansionQueries("right–hand")).toEqual([]);
    expect(hyphenSpaceExpansionQueries("quelqu'un")).toEqual([]);
    expect(hyphenSpaceExpansionQueries("sth / smb.")).toEqual(["sth-/-smb."]);
  });

  it("dedupes variants that share the original casefold key", () => {
    expect(hyphenSpaceExpansionQueries("grand-pere")).toEqual(["grand pere"]);
    expect(hyphenSpaceExpansionQueries("grand-pere")).not.toContain("grand-pere");
  });
});

describe("hyphenSpaceExpansionAllowed", () => {
  it("allows FR and EN source lookup only", () => {
    expect(hyphenSpaceExpansionAllowed({ from: "fr", to: "mnk" })).toBe(true);
    expect(hyphenSpaceExpansionAllowed({ from: "en", to: "mnk" })).toBe(true);
    expect(hyphenSpaceExpansionAllowed({ from: "mnk", to: "fr" })).toBe(false);
    expect(hyphenSpaceExpansionAllowed({ from: "mnk", to: "en" })).toBe(false);
  });
});
