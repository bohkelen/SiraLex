/**
 * Optional catalog-side / app-side dictionary update summary (PRODUCT2E).
 * Lives outside the immutable six-file release artifact.
 *
 * Locale fields:
 * - `short_summary` / `highlights` / `title` — English (canonical measured copy)
 * - `short_summary_fr` / `highlights_fr` / `title_fr` — French (same facts)
 * Legacy English-only entries remain valid when French fields are absent.
 */

import type { Locale } from "../i18n";

export type DictionaryUpdateSummaryV1 = {
  schema_version?: "dictionary_update_summary_v1";
  title?: string;
  title_fr?: string;
  /** English measured summary (required when update_summary is present). */
  short_summary: string;
  /** French measured summary (same facts as English). */
  short_summary_fr?: string;
  highlights?: string[];
  highlights_fr?: string[];
  /** Approximate download size when known from catalog. */
  size_bytes?: number;
  /** Previous installed identities this note is written for (informational). */
  applies_from_bundle_ids?: string[];
};

export type ResolvedDictionaryUpdateSummary = {
  title?: string;
  short_summary: string;
  highlights?: string[];
  size_bytes?: number;
  /** Which source supplied short_summary (for tests / diagnostics). */
  short_summary_source: "catalog_locale" | "i18n" | "catalog_en_fallback";
};

function trimNonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function normalizeStringList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
    .map((h) => h.trim());
  return list.length > 0 ? list : undefined;
}

/**
 * Accept nested `{ en, fr }` objects or plain English strings for short_summary.
 * Prefer additive `short_summary_fr` when present.
 */
function readLocalizedShort(obj: Record<string, unknown>): {
  en?: string;
  fr?: string;
} {
  const nested = obj.short_summary;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const map = nested as Record<string, unknown>;
    return {
      en: trimNonEmpty(map.en) ?? trimNonEmpty(map["en-US"]),
      fr: trimNonEmpty(map.fr) ?? trimNonEmpty(map["fr-FR"]) ?? trimNonEmpty(obj.short_summary_fr),
    };
  }
  return {
    en: trimNonEmpty(nested),
    fr: trimNonEmpty(obj.short_summary_fr),
  };
}

function readLocalizedTitle(obj: Record<string, unknown>): { en?: string; fr?: string } {
  const nested = obj.title;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const map = nested as Record<string, unknown>;
    return {
      en: trimNonEmpty(map.en),
      fr: trimNonEmpty(map.fr) ?? trimNonEmpty(obj.title_fr),
    };
  }
  return {
    en: trimNonEmpty(nested),
    fr: trimNonEmpty(obj.title_fr),
  };
}

function readLocalizedHighlights(obj: Record<string, unknown>): {
  en?: string[];
  fr?: string[];
} {
  const nested = obj.highlights;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const map = nested as Record<string, unknown>;
    return {
      en: normalizeStringList(map.en),
      fr: normalizeStringList(map.fr) ?? normalizeStringList(obj.highlights_fr),
    };
  }
  return {
    en: normalizeStringList(nested),
    fr: normalizeStringList(obj.highlights_fr),
  };
}

export function normalizeUpdateSummary(raw: unknown): DictionaryUpdateSummaryV1 | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const short = readLocalizedShort(obj);
  if (!short.en) return undefined;
  const title = readLocalizedTitle(obj);
  const highlights = readLocalizedHighlights(obj);
  const size_bytes =
    typeof obj.size_bytes === "number" && Number.isInteger(obj.size_bytes) && obj.size_bytes >= 0
      ? obj.size_bytes
      : undefined;
  const applies_from_bundle_ids = Array.isArray(obj.applies_from_bundle_ids)
    ? obj.applies_from_bundle_ids.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      )
    : undefined;
  return {
    schema_version:
      obj.schema_version === "dictionary_update_summary_v1"
        ? "dictionary_update_summary_v1"
        : undefined,
    title: title.en,
    title_fr: title.fr,
    short_summary: short.en,
    short_summary_fr: short.fr,
    highlights: highlights.en,
    highlights_fr: highlights.fr,
    size_bytes,
    applies_from_bundle_ids:
      applies_from_bundle_ids && applies_from_bundle_ids.length > 0
        ? applies_from_bundle_ids
        : undefined,
  };
}

export type ResolveUpdateSummaryI18n = {
  title: string;
  short_summary: string;
};

/**
 * Resolve catalog update copy for the active UI locale.
 *
 * FR: catalog_fr → i18n → catalog_en (last resort)
 * EN: catalog_en → i18n
 */
export function resolveDictionaryUpdateSummary(
  summary: DictionaryUpdateSummaryV1 | undefined,
  locale: Locale,
  i18n: ResolveUpdateSummaryI18n,
): ResolvedDictionaryUpdateSummary {
  if (locale === "fr") {
    const shortFr = summary?.short_summary_fr?.trim();
    if (shortFr) {
      return {
        title: summary?.title_fr?.trim() || i18n.title,
        short_summary: shortFr,
        highlights: summary?.highlights_fr,
        size_bytes: summary?.size_bytes,
        short_summary_source: "catalog_locale",
      };
    }
    const i18nShort = i18n.short_summary.trim();
    if (i18nShort) {
      return {
        title: i18n.title,
        short_summary: i18nShort,
        highlights: undefined,
        size_bytes: summary?.size_bytes,
        short_summary_source: "i18n",
      };
    }
    return {
      title: summary?.title?.trim() || i18n.title,
      short_summary: summary?.short_summary ?? i18n.short_summary,
      highlights: summary?.highlights,
      size_bytes: summary?.size_bytes,
      short_summary_source: "catalog_en_fallback",
    };
  }

  const shortEn = summary?.short_summary?.trim();
  if (shortEn) {
    return {
      title: summary?.title?.trim() || i18n.title,
      short_summary: shortEn,
      highlights: summary?.highlights,
      size_bytes: summary?.size_bytes,
      short_summary_source: "catalog_locale",
    };
  }
  return {
    title: i18n.title,
    short_summary: i18n.short_summary,
    highlights: undefined,
    size_bytes: summary?.size_bytes,
    short_summary_source: "i18n",
  };
}

export function formatUpdateSizeLabel(
  sizeBytes: number | undefined,
  fmtBytes: (n?: number) => string,
): string | undefined {
  if (sizeBytes === undefined || sizeBytes < 0) return undefined;
  return fmtBytes(sizeBytes);
}
