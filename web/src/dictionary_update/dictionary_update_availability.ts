/**
 * DU1 — Pure update-availability helpers for the consumer dictionary update UX.
 *
 * Detection rule (canonical):
 * same logical bundle_id AND installed content_sha256 != catalog content_sha256.
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
 * True when the active installed dictionary is the featured/catalog logical id
 * and a newer catalog content hash is available.
 */
export function isActiveFeaturedUpdateAvailable(args: {
  active?: InstalledBundleIdentity;
  featuredEntry?: BundleCatalogEntryV1;
}): boolean {
  const { active, featuredEntry } = args;
  if (!active || !featuredEntry) return false;
  if (active.bundle_id !== featuredEntry.bundle_id) return false;
  return isDictionaryUpdateAvailable(featuredEntry, active);
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
