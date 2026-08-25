/**
 * Verified `.siralex.zip` package handoff into the existing bundle installer.
 *
 * Adapter only — does not re-parse ZIPs, re-hash payloads, or duplicate install logic.
 */

import { projectCreditsFromManifestJson } from "../bundle_credits";
import { openSiralexDb } from "../idb/siralex_db";
import {
  installBundleIntoDb,
  type InstallBundleResult,
} from "../install/bundle_install";
import {
  BundlePackageIntegrityError,
  getInstallEligibleVerifiedPackageSnapshot,
  type VerifiedBundlePackage,
} from "./bundle_package_integrity";

export class BundlePackageInstallError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BundlePackageInstallError";
    this.code = code;
  }
}

export async function installVerifiedBundlePackage(
  verifiedPackage: VerifiedBundlePackage,
): Promise<InstallBundleResult> {
  let snapshot;
  try {
    snapshot = getInstallEligibleVerifiedPackageSnapshot(verifiedPackage);
  } catch (error) {
    if (error instanceof BundlePackageIntegrityError && error.code === "package_not_verified") {
      throw new BundlePackageInstallError("unverified_package", error.message);
    }
    throw error;
  }

  const db = await openSiralexDb();
  try {
    const manifestText = await snapshot.manifestBlob.text();
    const sourceCredits = projectCreditsFromManifestJson(manifestText) ?? undefined;
    return await installBundleIntoDb(
      db,
      snapshot.manifest,
      {
        recordsSource: snapshot.recordsBlob,
        searchIndexSource: snapshot.searchIndexBlob,
      },
      () => undefined,
      undefined,
      { storageBytes: snapshot.storageBytes, sourceCredits },
    );
  } finally {
    db.close();
  }
}
