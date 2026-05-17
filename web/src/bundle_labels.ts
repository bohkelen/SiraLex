import type { BundleManifestV1 } from "./bundle_manifest";
import type { BundleLanguageMeta } from "./idb/siralex_db";

export type SearchDirection = "source_to_target" | "target_to_source";

function normalizeCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const trimmed = code.trim();
  return trimmed === "" ? undefined : trimmed.toUpperCase();
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

export function getSourceLabel(meta?: BundleLanguageMeta, fallbackLabel = "Source"): string {
  return meta?.source_label ?? normalizeCode(meta?.source_lang) ?? fallbackLabel;
}

export function getTargetLabel(meta?: BundleLanguageMeta, fallbackLabel = "Target"): string {
  return meta?.target_label ?? normalizeCode(meta?.target_lang) ?? fallbackLabel;
}

export function getBundleDisplayName(
  bundleId: string,
  meta?: BundleLanguageMeta,
  sourceFallbackLabel = "Source",
  targetFallbackLabel = "Target",
): string {
  const source = getSourceLabel(meta, sourceFallbackLabel);
  const target = getTargetLabel(meta, targetFallbackLabel);
  if (source === sourceFallbackLabel && target === targetFallbackLabel) {
    return bundleId;
  }
  return `${source} ↔ ${target}`;
}

export function getSearchDirectionText(
  direction: SearchDirection,
  meta?: BundleLanguageMeta,
  sourceFallbackLabel = "Source",
  targetFallbackLabel = "Target",
): string {
  const source = getSourceLabel(meta, sourceFallbackLabel);
  const target = getTargetLabel(meta, targetFallbackLabel);
  return direction === "source_to_target" ? `${source} → ${target}` : `${target} → ${source}`;
}

export function getSearchPlaceholder(
  direction: SearchDirection,
  meta?: BundleLanguageMeta,
  sourceFallbackLabel = "Source",
  targetFallbackLabel = "Target",
  formatLabelWord: (label: string) => string = (label) => `Type a ${label} word…`,
): string {
  const source = getSourceLabel(meta, sourceFallbackLabel);
  const target = getTargetLabel(meta, targetFallbackLabel);
  return direction === "source_to_target" ? formatLabelWord(source) : formatLabelWord(target);
}

export function getTargetEntriesLabel(
  meta?: BundleLanguageMeta,
  targetFallbackLabel = "Target",
  formatEntriesLabel: (label: string) => string = (label) => `${label} entries:`,
): string {
  return formatEntriesLabel(getTargetLabel(meta, targetFallbackLabel));
}
