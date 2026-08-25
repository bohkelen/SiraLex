import { describe, expect, it } from "vitest";

import {
  normalizeUpdateSummary,
  resolveDictionaryUpdateSummary,
} from "./dictionary_update_summary";

const EN_SUMMARY =
  "An updated Maninka dictionary is available with refreshed dictionary entries, broader search coverage, and a new offline Credits & Sources section.";
const FR_SUMMARY =
  "Une mise à jour du dictionnaire maninka est disponible, avec des entrées actualisées, une couverture de recherche élargie et une nouvelle section Crédits et sources accessible hors ligne.";

const bilingual = normalizeUpdateSummary({
  schema_version: "dictionary_update_summary_v1",
  title: "Dictionary update available",
  title_fr: "Mise à jour du dictionnaire disponible",
  short_summary: EN_SUMMARY,
  short_summary_fr: FR_SUMMARY,
  highlights: ["Broader searchable coverage"],
  highlights_fr: ["Couverture de recherche élargie"],
})!;

describe("PRODUCT2E-A1 locale-aware update summary", () => {
  it("parses English-only legacy update_summary", () => {
    const legacy = normalizeUpdateSummary({
      short_summary: EN_SUMMARY,
      highlights: ["Offline Credits"],
    });
    expect(legacy?.short_summary).toBe(EN_SUMMARY);
    expect(legacy?.short_summary_fr).toBeUndefined();
    expect(legacy?.highlights).toEqual(["Offline Credits"]);
    expect(legacy?.highlights_fr).toBeUndefined();
  });

  it("parses additive French fields and nested locale maps", () => {
    expect(bilingual.short_summary_fr).toBe(FR_SUMMARY);
    expect(bilingual.highlights_fr?.[0]).toMatch(/Couverture/);

    const nested = normalizeUpdateSummary({
      short_summary: { en: EN_SUMMARY, fr: FR_SUMMARY },
      highlights: { en: ["A"], fr: ["B"] },
    });
    expect(nested?.short_summary).toBe(EN_SUMMARY);
    expect(nested?.short_summary_fr).toBe(FR_SUMMARY);
    expect(nested?.highlights).toEqual(["A"]);
    expect(nested?.highlights_fr).toEqual(["B"]);
  });

  it("resolves en from catalog English", () => {
    const resolved = resolveDictionaryUpdateSummary(bilingual, "en", {
      title: "i18n title",
      short_summary: "i18n en",
    });
    expect(resolved.short_summary).toBe(EN_SUMMARY);
    expect(resolved.highlights).toEqual(["Broader searchable coverage"]);
    expect(resolved.short_summary_source).toBe("catalog_locale");
  });

  it("resolves fr from catalog French before i18n", () => {
    const resolved = resolveDictionaryUpdateSummary(bilingual, "fr", {
      title: "Titre i18n",
      short_summary: "Résumé i18n français",
    });
    expect(resolved.short_summary).toBe(FR_SUMMARY);
    expect(resolved.highlights).toEqual(["Couverture de recherche élargie"]);
    expect(resolved.short_summary_source).toBe("catalog_locale");
    expect(resolved.short_summary).not.toMatch(/updated Maninka dictionary/i);
  });

  it("uses French i18n when French catalog fields are absent (no English override)", () => {
    const enOnly = normalizeUpdateSummary({
      short_summary: EN_SUMMARY,
      highlights: ["English only highlight"],
    });
    const resolved = resolveDictionaryUpdateSummary(enOnly, "fr", {
      title: "Mise à jour du dictionnaire disponible",
      short_summary: FR_SUMMARY,
    });
    expect(resolved.short_summary).toBe(FR_SUMMARY);
    expect(resolved.short_summary_source).toBe("i18n");
    expect(resolved.highlights).toBeUndefined();
  });

  it("falls back to English catalog only when French catalog and i18n are empty", () => {
    const enOnly = normalizeUpdateSummary({ short_summary: EN_SUMMARY });
    const resolved = resolveDictionaryUpdateSummary(enOnly, "fr", {
      title: "Titre",
      short_summary: "",
    });
    expect(resolved.short_summary).toBe(EN_SUMMARY);
    expect(resolved.short_summary_source).toBe("catalog_en_fallback");
  });

  it("falls back to i18n when update_summary is absent", () => {
    const resolved = resolveDictionaryUpdateSummary(undefined, "fr", {
      title: "Titre",
      short_summary: FR_SUMMARY,
    });
    expect(resolved.short_summary).toBe(FR_SUMMARY);
    expect(resolved.short_summary_source).toBe("i18n");
  });
});
