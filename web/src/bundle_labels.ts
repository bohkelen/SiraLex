import type { BundleManifestV1 } from "./bundle_manifest";
import type { BundleLanguageMeta } from "./idb/siralex_db";

export type SearchDirection = "source_to_target" | "target_to_source";

function normalizeCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const trimmed = code.trim();
  return trimmed === "" ? undefined : trimmed.toUpperCase();
}

function titleCaseLanguageName(value: string, locale: string): string {
  if (value === "") return value;
  return `${value.slice(0, 1).toLocaleUpperCase(locale)}${value.slice(1)}`;
}

/**
 * Product UI names for language codes used in SiraLex surfaces.
 * Preferred over Intl.DisplayNames so platforms that map mnk→Mandingue/Mandingo
 * cannot diverge from the catalog product name "Maninka", while still giving
 * stable Français/French for fr.
 */
const UI_LANGUAGE_NAME_FALLBACKS: Record<string, Record<string, string>> = {
  en: { en: "English", fr: "French", mnk: "Maninka" },
  fr: { en: "Anglais", fr: "Français", mnk: "Maninka" },
};

function getLocaleLanguageName(code: string | undefined, locale: string | undefined): string | undefined {
  if (!code || !locale) return undefined;
  const normalizedCode = code.trim().toLowerCase();
  if (normalizedCode === "") return undefined;
  const localeBase = locale.trim().toLowerCase().split("-")[0] ?? "";

  const productName = UI_LANGUAGE_NAME_FALLBACKS[localeBase]?.[normalizedCode];
  if (productName) return productName;

  if (typeof Intl.DisplayNames === "function") {
    try {
      const name = new Intl.DisplayNames([locale], { type: "language" }).of(normalizedCode);
      if (name && name.trim().toLowerCase() !== normalizedCode) {
        return titleCaseLanguageName(name.trim(), locale);
      }
    } catch {
      // No product name and Intl unavailable/unhelpful.
    }
  }

  return undefined;
}

export function buildLanguageMetaFromManifest(manifest: BundleManifestV1): BundleLanguageMeta | undefined {
  const meta: BundleLanguageMeta = {
    source_lang: manifest.languages?.source_lang,
    target_lang: manifest.languages?.target_lang,
    source_label: manifest.language_labels?.source,
    target_label: manifest.language_labels?.target,
    target_scripts: manifest.scripts?.target_supported,
  };

  return Object.values(meta).some((value) => value !== undefined) ? meta : undefined;
}

export function getSourceLabel(
  meta?: BundleLanguageMeta,
  fallbackLabel = "Source",
  displayLocale?: string,
): string {
  return (
    getLocaleLanguageName(meta?.source_lang, displayLocale) ??
    meta?.source_label ??
    normalizeCode(meta?.source_lang) ??
    fallbackLabel
  );
}

export function getTargetLabel(
  meta?: BundleLanguageMeta,
  fallbackLabel = "Target",
  displayLocale?: string,
): string {
  return (
    getLocaleLanguageName(meta?.target_lang, displayLocale) ??
    meta?.target_label ??
    normalizeCode(meta?.target_lang) ??
    fallbackLabel
  );
}

export function getBundleDisplayName(
  bundleId: string,
  meta?: BundleLanguageMeta,
  sourceFallbackLabel = "Source",
  targetFallbackLabel = "Target",
  displayLocale?: string,
): string {
  const source = getSourceLabel(meta, sourceFallbackLabel, displayLocale);
  const target = getTargetLabel(meta, targetFallbackLabel, displayLocale);
  if (source === sourceFallbackLabel && target === targetFallbackLabel) {
    return bundleId;
  }
  return `${source} ↔ ${target}`;
}

/**
 * Localize a stored catalog display_name for the active UI locale.
 * Needed when installed bundles were saved with English catalog names and no language_meta
 * (featured manifests historically omit languages).
 *
 * Uses the same UI language-name table as getSourceLabel (English token → locale token).
 */
export function localizeStoredBundleDisplayName(
  displayName: string,
  displayLocale: string | undefined,
): string {
  const localeBase = displayLocale?.trim().toLowerCase().split("-")[0] ?? "";
  if (!localeBase || localeBase === "en") return displayName;
  const localizedNames = UI_LANGUAGE_NAME_FALLBACKS[localeBase];
  const englishNames = UI_LANGUAGE_NAME_FALLBACKS.en;
  if (!localizedNames || !englishNames) return displayName;

  const pairParts = displayName.split(" ↔ ");
  const sourcePart = pairParts[0];
  if (!sourcePart || pairParts.length < 2) return displayName;

  const localizeToken = (token: string): string => {
    for (const [code, englishName] of Object.entries(englishNames)) {
      if (token === englishName && localizedNames[code]) {
        return localizedNames[code];
      }
    }
    return token;
  };

  return [localizeToken(sourcePart), ...pairParts.slice(1).map(localizeToken)].join(" ↔ ");
}

export function getSearchDirectionText(
  direction: SearchDirection,
  meta?: BundleLanguageMeta,
  sourceFallbackLabel = "Source",
  targetFallbackLabel = "Target",
  displayLocale?: string,
): string {
  const source = getSourceLabel(meta, sourceFallbackLabel, displayLocale);
  const target = getTargetLabel(meta, targetFallbackLabel, displayLocale);
  return direction === "source_to_target" ? `${source} → ${target}` : `${target} → ${source}`;
}

export function getSearchPlaceholder(
  direction: SearchDirection,
  meta?: BundleLanguageMeta,
  sourceFallbackLabel = "Source",
  targetFallbackLabel = "Target",
  formatLabelWord: (label: string) => string = (label) => `Type a ${label} word…`,
  displayLocale?: string,
): string {
  const source = getSourceLabel(meta, sourceFallbackLabel, displayLocale);
  const target = getTargetLabel(meta, targetFallbackLabel, displayLocale);
  return direction === "source_to_target" ? formatLabelWord(source) : formatLabelWord(target);
}

export function getTargetEntriesLabel(
  meta?: BundleLanguageMeta,
  targetFallbackLabel = "Target",
  formatEntriesLabel: (label: string) => string = (label) => `${label} entries:`,
  displayLocale?: string,
): string {
  return formatEntriesLabel(getTargetLabel(meta, targetFallbackLabel, displayLocale));
}
