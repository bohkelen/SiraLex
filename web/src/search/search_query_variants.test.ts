import { describe, expect, it } from "vitest";

import { computeSearchKeys, normalizeNfc } from "../norm/norm_v1";
import {
  HYPHEN_SPACE_EXPANSION_MAX_VARIANTS,
  SAFE_QUERY_VARIANT_MAX,
  frenchLigatureExpansionAllowed,
  frenchLigatureExpansionQueries,
  hyphenSpaceExpansionAllowed,
  hyphenSpaceExpansionQueries,
  safeQueryVariants,
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

describe("frenchLigatureExpansionQueries", () => {
  it("maps œ to oe", () => {
    expect(frenchLigatureExpansionQueries("sœur")).toEqual(["soeur"]);
    expect(frenchLigatureExpansionQueries("cœur")).toEqual(["coeur"]);
    expect(frenchLigatureExpansionQueries("œuf")).toEqual(["oeuf"]);
  });

  it("maps ŒUF to a surface whose casefold key is oeuf", () => {
    const variants = frenchLigatureExpansionQueries("ŒUF");
    expect(variants).toHaveLength(1);
    expect(computeSearchKeys([normalizeNfc(variants[0]!)]).casefold).toEqual(["oeuf"]);
  });

  it("returns no variant for soeur or queries without œ/Œ", () => {
    expect(frenchLigatureExpansionQueries("soeur")).toEqual([]);
    expect(frenchLigatureExpansionQueries("maison")).toEqual([]);
    expect(frenchLigatureExpansionQueries("")).toEqual([]);
  });

  it("does not handle æ or Maninka ɔ/ɛ", () => {
    expect(frenchLigatureExpansionQueries("æther")).toEqual([]);
    expect(frenchLigatureExpansionQueries("dɔ́bɛ̀n")).toEqual([]);
    expect(frenchLigatureExpansionQueries("dobɛn")).toEqual([]);
  });
});

describe("frenchLigatureExpansionAllowed", () => {
  it("allows FR source lookup only", () => {
    expect(frenchLigatureExpansionAllowed({ from: "fr", to: "mnk" })).toBe(true);
    expect(frenchLigatureExpansionAllowed({ from: "en", to: "mnk" })).toBe(false);
    expect(frenchLigatureExpansionAllowed({ from: "mnk", to: "fr" })).toBe(false);
    expect(frenchLigatureExpansionAllowed({ from: "mnk", to: "en" })).toBe(false);
  });
});

describe("safeQueryVariants", () => {
  it("orders ligature before hyphen/space and stays within the cap", () => {
    const variants = safeQueryVariants("sœur extra", { from: "fr", to: "mnk" });
    expect(variants[0]).toBe("soeur extra");
    expect(variants).toContain("sœur-extra");
    expect(variants).not.toContain("soeur-extra");
    expect(variants.length).toBeLessThanOrEqual(SAFE_QUERY_VARIANT_MAX);
  });

  it("does not emit ligature variants for EN or MNK", () => {
    expect(safeQueryVariants("sœur", { from: "en", to: "mnk" })).toEqual([]);
    expect(safeQueryVariants("sœur", { from: "mnk", to: "fr" })).toEqual([]);
  });

  it("still emits hyphen/space variants for EN", () => {
    expect(safeQueryVariants("pick-up", { from: "en", to: "mnk" })).toEqual(["pick up"]);
  });
});
