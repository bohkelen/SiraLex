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

export function getSourceLabel(meta?: BundleLanguageMeta): string {
  return meta?.source_label ?? normalizeCode(meta?.source_lang) ?? "Source";
}

export function getTargetLabel(meta?: BundleLanguageMeta): string {
  return meta?.target_label ?? normalizeCode(meta?.target_lang) ?? "Target";
}

export function getBundleDisplayName(bundleId: string, meta?: BundleLanguageMeta): string {
  const source = getSourceLabel(meta);
  const target = getTargetLabel(meta);
  if (source === "Source" && target === "Target") {
    return bundleId;
  }
  return `${source} ↔ ${target}`;
}

export function getSearchDirectionText(
  direction: SearchDirection,
  meta?: BundleLanguageMeta,
): string {
  const source = getSourceLabel(meta);
  const target = getTargetLabel(meta);
  return direction === "source_to_target" ? `${source} → ${target}` : `${target} → ${source}`;
}

export function getSearchPlaceholder(
  direction: SearchDirection,
  meta?: BundleLanguageMeta,
): string {
  const source = getSourceLabel(meta);
  const target = getTargetLabel(meta);
  return direction === "source_to_target"
    ? `Type a ${source} word…`
    : `Type a ${target} word…`;
}

export function getTargetEntriesLabel(meta?: BundleLanguageMeta): string {
  return `${getTargetLabel(meta)} entries:`;
}
