/**
 * Offline Credits / Sources projection from installed bundle manifest (v2).
 *
 * Source of truth: bundle.manifest.json fields enriched at build time from
 * shared/sources/*.yaml — not hard-coded duplicate prose.
 */

export type BundleSourceCredit = {
  source_id: string;
  source_title?: string;
  source_url?: string;
  attribution?: string;
  claimed_license?: string;
  license_url?: string;
  distribution_posture?: string;
  noncommercial_distribution?: boolean;
  sharealike_required?: boolean;
  commercial_distribution?: boolean;
};

export type BundleCreditsProjection = {
  software_license: string;
  data_license_policy?: string;
  noncommercial_distribution: boolean;
  sharealike_notice?: string;
  sharealike_license?: string;
  sources: BundleSourceCredit[];
};

const DEFAULT_SOFTWARE_LICENSE = "MIT OR Apache-2.0";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function parseSourceEntry(raw: unknown): BundleSourceCredit | null {
  if (!isObject(raw)) return null;
  const source_id = asString(raw.source_id);
  if (!source_id) return null;
  return {
    source_id,
    source_title: asString(raw.source_title),
    source_url: asString(raw.source_url),
    attribution: asString(raw.attribution),
    claimed_license: asString(raw.claimed_license),
    license_url: asString(raw.license_url),
    distribution_posture: asString(raw.distribution_posture),
    noncommercial_distribution: asBool(raw.noncommercial_distribution),
    sharealike_required: asBool(raw.sharealike_required),
    commercial_distribution: asBool(raw.commercial_distribution),
  };
}

/**
 * Project user-facing credits from raw manifest JSON (works offline).
 */
export function projectCreditsFromManifestJson(text: string): BundleCreditsProjection | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  return projectCreditsFromManifest(raw);
}

export function projectCreditsFromManifest(raw: unknown): BundleCreditsProjection | null {
  if (!isObject(raw)) return null;

  const software = isObject(raw.software_license)
    ? asString(raw.software_license.spdx_expression)
    : undefined;

  const distribution = isObject(raw.distribution) ? raw.distribution : {};
  const noncommercial = asBool(distribution.noncommercial_distribution) ?? false;

  const sharealike = isObject(raw.sharealike_notice) ? raw.sharealike_notice : {};
  const sourcesRaw = isObject(raw.sources) ? raw.sources.included : undefined;
  const sources: BundleSourceCredit[] = [];
  if (Array.isArray(sourcesRaw)) {
    for (const entry of sourcesRaw) {
      const parsed = parseSourceEntry(entry);
      if (parsed) sources.push(parsed);
    }
  }

  if (sources.length === 0 && !software) {
    return null;
  }

  return {
    software_license: software ?? DEFAULT_SOFTWARE_LICENSE,
    data_license_policy: asString(raw.data_license_policy),
    noncommercial_distribution: noncommercial,
    sharealike_notice: asString(sharealike.notice),
    sharealike_license: asString(sharealike.license),
    sources: sources.sort((a, b) => a.source_id.localeCompare(b.source_id)),
  };
}

/** Stored on ActiveBundleMeta at install time for offline Credits rendering. */
export type StoredBundleCredits = BundleCreditsProjection;

export function storedCreditsMatchManifest(
  stored: StoredBundleCredits,
  manifestText: string,
): boolean {
  const projected = projectCreditsFromManifestJson(manifestText);
  if (!projected) return false;
  return JSON.stringify(stored) === JSON.stringify(projected);
}
