/**
 * PRODUCT2E — Featured dictionary update availability (same-id hash + lineage change).
 *
 * Same-id rule (DU1):
 *   active.bundle_id === featured.bundle_id AND content hashes differ.
 *
 * Featured lineage rule (PRODUCT2E):
 *   active.bundle_id !== featured.bundle_id → update available to the featured bundle.
 */

import {
  compareCatalogEntryToInstalled,
  type BundleCatalogEntryV1,
  type BundleCatalogComparison,
} from "../bundle_catalog";
import type { ActiveBundleMeta } from "../idb/siralex_db";

export type InstalledBundleIdentity = Pick<
  ActiveBundleMeta,
  "bundle_id" | "expected_content_sha256"
>;

export type FeaturedUpdateKind = "same_id_content" | "featured_lineage" | "none";

export function getDictionaryUpdateComparison(
  entry: BundleCatalogEntryV1,
  installed?: InstalledBundleIdentity,
): BundleCatalogComparison {
  return compareCatalogEntryToInstalled(entry, installed);
}

export function isDictionaryUpdateAvailable(
  entry: BundleCatalogEntryV1,
  installed?: InstalledBundleIdentity,
): boolean {
  return getDictionaryUpdateComparison(entry, installed).state === "update_available";
}

/**
 * True when the active installed dictionary should be offered an update to the
 * current featured catalog entry.
 */
export function isActiveFeaturedUpdateAvailable(args: {
  active?: InstalledBundleIdentity;
  featuredEntry?: BundleCatalogEntryV1;
}): boolean {
  return getFeaturedUpdateKind(args) !== "none";
}

export function getFeaturedUpdateKind(args: {
  active?: InstalledBundleIdentity;
  featuredEntry?: BundleCatalogEntryV1;
}): FeaturedUpdateKind {
  const { active, featuredEntry } = args;
  if (!active || !featuredEntry) return "none";
  if (active.bundle_id !== featuredEntry.bundle_id) {
    return "featured_lineage";
  }
  if (isDictionaryUpdateAvailable(featuredEntry, active)) {
    return "same_id_content";
  }
  return "none";
}

/**
 * Reinstall (same catalog hash force-replace) is not supported by the current
 * installer: matching content_sha256 is an intentional skip/activate-only path.
 * DU1 must not clear-first to fake a reinstall.
 */
export const DICTIONARY_REINSTALL_POLICY = {
  supported: false as const,
  reason:
    "Safe same-hash reinstall is not available: installRemoteCatalogBundle / installBundleIntoDb skip when storage_scope_id already matches content_sha256. Clear-first reinstall would be destructive and is out of DU1 scope.",
};
