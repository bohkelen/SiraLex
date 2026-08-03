/**
 * PV1A — resolve repository candidate identity and reconcile with deployed production.
 *
 * Featured selection is env-driven (`web/.env.production` → `VITE_FEATURED_BUNDLE_ID`),
 * not a catalog `featured` field.
 */

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AlignmentStatus } from "./evidence";

export const AMENDED_FLOOR_COMMIT = "56cb76e3b5c90dd01f0dc70128561e77c693fca5";

export const DEFAULT_PRODUCTION_URL = "https://loquacious-piroshki-be432c.netlify.app";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(webRoot, "..");

export type CatalogBundleEntry = {
  bundle_id: string;
  name: string;
  version: string;
  size_bytes: number;
  url_base: string;
  content_sha256: string;
  languages?: { source_lang: string; target_lang: string };
  language_labels?: { source: string; target: string };
};

export type BundleManifest = {
  bundle_id: string;
  content_sha256: string;
  rule_versions?: { normalization?: string };
  build?: { git_commit?: string; record_counts?: Record<string, number> };
  languages?: { source_lang: string; target_lang: string };
  scripts?: { target_supported?: string[] };
};

export type RepositoryCandidateIdentity = {
  git_head: string;
  git_head_short: string;
  app_package_version: string;
  featured_bundle_id: string;
  featured_catalog_version: string;
  content_sha256: string;
  normalization_ruleset: string | undefined;
  catalog_schema_version: string;
  manifest_bundle_id: string;
  manifest_content_sha256: string;
  manifest_git_commit: string | undefined;
  storage_scope_id_pattern: string;
  catalog_path: string;
  env_production_path: string;
  production_url_default: string;
};

export type DeployedCandidateIdentity = {
  production_url: string;
  root_http_status: number;
  catalog_http_status: number;
  catalog_schema_version: string | undefined;
  catalog_bundle_ids: string[];
  catalog_featured_match: CatalogBundleEntry | undefined;
  /** First catalog entry when env featured id is absent from deployed catalog. */
  catalog_primary_bundle: CatalogBundleEntry | undefined;
  featured_manifest_http_status: number;
  featured_manifest: BundleManifest | undefined;
  primary_manifest_http_status: number;
  primary_manifest: BundleManifest | undefined;
  shell_html_title: string | undefined;
  shell_js_asset: string | undefined;
  shell_js_http_status: number | undefined;
  shell_js_bytes: number | undefined;
  shell_markers: {
    featured_bundle_id: boolean;
    open_manage_corrections: boolean;
    open_manage_search_feedback: boolean;
    open_saved_vocabulary: boolean;
    search_feedback_report: boolean;
    correction_manage_description: boolean;
    app_version_0_0_0: boolean;
  };
  webmanifest_http_status: number;
  build_identity_note: string;
};

export type IdentityReconciliation = {
  repository: RepositoryCandidateIdentity;
  deployed: DeployedCandidateIdentity;
  alignment_status: AlignmentStatus;
  alignment_notes: string[];
  catalog_hash_reconciled: boolean;
  bundle_id_reconciled: boolean;
  amended_runtime_markers_present: boolean;
};

function runGit(args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

export async function readProductionFeaturedBundleId(): Promise<string> {
  const envPath = path.join(webRoot, ".env.production");
  const text = await readFile(envPath, "utf8");
  for (const line of text.split("\n")) {
    const match = /^VITE_FEATURED_BUNDLE_ID\s*=\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    const value = match[1]?.trim();
    if (!value) throw new Error("VITE_FEATURED_BUNDLE_ID is empty in web/.env.production");
    return value;
  }
  throw new Error("VITE_FEATURED_BUNDLE_ID missing from web/.env.production");
}

export async function resolveRepositoryCandidateIdentity(): Promise<RepositoryCandidateIdentity> {
  const featuredBundleId = await readProductionFeaturedBundleId();
  const catalogPath = path.join(webRoot, "public/catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as {
    catalog_schema_version: string;
    bundles: CatalogBundleEntry[];
  };
  const featured = catalog.bundles.find((b) => b.bundle_id === featuredBundleId);
  if (!featured) {
    throw new Error(`Featured bundle_id ${featuredBundleId} not present in web/public/catalog.json`);
  }

  const manifestPath = path.join(webRoot, "public", featuredBundleId, "bundle.manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as BundleManifest;
  if (manifest.bundle_id !== featured.bundle_id) {
    throw new Error(
      `Manifest bundle_id ${manifest.bundle_id} != catalog featured ${featured.bundle_id}`,
    );
  }
  if (manifest.content_sha256 !== featured.content_sha256) {
    throw new Error(
      `Manifest content_sha256 ${manifest.content_sha256} != catalog ${featured.content_sha256}`,
    );
  }

  const pkg = JSON.parse(await readFile(path.join(webRoot, "package.json"), "utf8")) as {
    version?: string;
  };

  const gitHead = runGit(["rev-parse", "HEAD"]);
  return {
    git_head: gitHead,
    git_head_short: runGit(["rev-parse", "--short", "HEAD"]),
    app_package_version: typeof pkg.version === "string" ? pkg.version : "0.0.0",
    featured_bundle_id: featured.bundle_id,
    featured_catalog_version: featured.version,
    content_sha256: featured.content_sha256,
    normalization_ruleset: manifest.rule_versions?.normalization,
    catalog_schema_version: catalog.catalog_schema_version,
    manifest_bundle_id: manifest.bundle_id,
    manifest_content_sha256: manifest.content_sha256,
    manifest_git_commit: manifest.build?.git_commit,
    storage_scope_id_pattern: `${featured.bundle_id}::${featured.content_sha256}`,
    catalog_path: catalogPath,
    env_production_path: path.join(webRoot, ".env.production"),
    production_url_default: DEFAULT_PRODUCTION_URL,
  };
}

async function fetchText(
  url: string,
): Promise<{ status: number; text: string; finalUrl: string }> {
  const response = await fetch(url, { redirect: "follow" });
  const text = await response.text();
  return { status: response.status, text, finalUrl: response.url };
}

function parseCatalog(text: string): {
  catalog_schema_version?: string;
  bundles: CatalogBundleEntry[];
} {
  const parsed = JSON.parse(text) as {
    catalog_schema_version?: string;
    bundles?: CatalogBundleEntry[];
  };
  return {
    catalog_schema_version: parsed.catalog_schema_version,
    bundles: Array.isArray(parsed.bundles) ? parsed.bundles : [],
  };
}

export async function resolveDeployedCandidateIdentity(options: {
  productionUrl: string;
  repositoryFeaturedBundleId: string;
}): Promise<DeployedCandidateIdentity> {
  const base = options.productionUrl.replace(/\/$/, "");
  const root = await fetchText(`${base}/`);
  const catalog = await fetchText(`${base}/catalog.json`);
  const webmanifest = await fetchText(`${base}/manifest.webmanifest`);

  let catalogBundles: CatalogBundleEntry[] = [];
  let catalogSchema: string | undefined;
  if (catalog.status === 200) {
    const parsed = parseCatalog(catalog.text);
    catalogBundles = parsed.bundles;
    catalogSchema = parsed.catalog_schema_version;
  }

  const featuredMatch = catalogBundles.find((b) => b.bundle_id === options.repositoryFeaturedBundleId);
  const primary = catalogBundles[0];

  const featuredManifestUrl = `${base}/${options.repositoryFeaturedBundleId}/bundle.manifest.json`;
  const featuredManifestFetch = await fetchText(featuredManifestUrl);
  let featuredManifest: BundleManifest | undefined;
  if (featuredManifestFetch.status === 200) {
    featuredManifest = JSON.parse(featuredManifestFetch.text) as BundleManifest;
  }

  let primaryManifest: BundleManifest | undefined;
  let primaryManifestStatus = 0;
  if (primary) {
    const primaryUrl = new URL(primary.url_base.replace(/^\.\//, ""), `${base}/`);
    const mf = await fetchText(new URL("bundle.manifest.json", primaryUrl).toString());
    primaryManifestStatus = mf.status;
    if (mf.status === 200) primaryManifest = JSON.parse(mf.text) as BundleManifest;
  }

  const titleMatch = /<title>(.*?)<\/title>/i.exec(root.text);
  const jsMatch = /src="(\.\/assets\/[^"]+\.js)"/i.exec(root.text);
  const shellJsAsset = jsMatch?.[1];
  let shellJsStatus: number | undefined;
  let shellJsBytes: number | undefined;
  let shellJsText = "";
  if (shellJsAsset) {
    const jsUrl = new URL(shellJsAsset, `${base}/`).toString();
    const js = await fetchText(jsUrl);
    shellJsStatus = js.status;
    shellJsText = js.text;
    shellJsBytes = Buffer.byteLength(js.text, "utf8");
  }

  const markers = {
    featured_bundle_id: shellJsText.includes(options.repositoryFeaturedBundleId),
    open_manage_corrections: shellJsText.includes("openManageCorrections"),
    open_manage_search_feedback: shellJsText.includes("openManageSearchFeedback"),
    open_saved_vocabulary: shellJsText.includes("openSavedVocabulary"),
    search_feedback_report: shellJsText.includes("search-feedback-report"),
    correction_manage_description: shellJsText.includes("correction-manage-description"),
    app_version_0_0_0: shellJsText.includes("0.0.0"),
  };

  const hasStrongBuildId = Boolean(
    featuredManifest?.build?.git_commit || primaryManifest?.build?.git_commit,
  );

  return {
    production_url: base,
    root_http_status: root.status,
    catalog_http_status: catalog.status,
    catalog_schema_version: catalogSchema,
    catalog_bundle_ids: catalogBundles.map((b) => b.bundle_id),
    catalog_featured_match: featuredMatch,
    catalog_primary_bundle: primary,
    featured_manifest_http_status: featuredManifestFetch.status,
    featured_manifest: featuredManifest,
    primary_manifest_http_status: primaryManifestStatus,
    primary_manifest: primaryManifest,
    shell_html_title: titleMatch?.[1],
    shell_js_asset: shellJsAsset,
    shell_js_http_status: shellJsStatus,
    shell_js_bytes: shellJsBytes,
    shell_markers: markers,
    webmanifest_http_status: webmanifest.status,
    build_identity_note: hasStrongBuildId
      ? "Bundle manifest exposes build.git_commit for dictionary content; app shell package version remains 0.0.0 without a deployed git/build stamp."
      : "App shell lacks a strong git/build identity; package version 0.0.0 is insufficient as sole release identity.",
  };
}

export function reconcileIdentities(
  repository: RepositoryCandidateIdentity,
  deployed: DeployedCandidateIdentity,
): IdentityReconciliation {
  const notes: string[] = [];
  const bundleIdReconciled = Boolean(
    deployed.catalog_featured_match &&
      deployed.featured_manifest &&
      deployed.featured_manifest.bundle_id === repository.featured_bundle_id,
  );
  const catalogHashReconciled = Boolean(
    deployed.catalog_featured_match &&
      deployed.featured_manifest &&
      deployed.catalog_featured_match.content_sha256 === repository.content_sha256 &&
      deployed.featured_manifest.content_sha256 === repository.content_sha256,
  );

  const amendedRuntimeMarkersPresent =
    deployed.shell_markers.featured_bundle_id &&
    deployed.shell_markers.open_manage_corrections &&
    deployed.shell_markers.open_manage_search_feedback &&
    deployed.shell_markers.search_feedback_report &&
    deployed.shell_markers.correction_manage_description;

  if (!deployed.catalog_featured_match) {
    notes.push(
      `Deployed catalog does not list repository featured bundle_id ${repository.featured_bundle_id}. Deployed bundles: ${deployed.catalog_bundle_ids.join(", ") || "(none)"}.`,
    );
  }
  if (deployed.featured_manifest_http_status !== 200) {
    notes.push(
      `Repository featured manifest HTTP ${deployed.featured_manifest_http_status} at /${repository.featured_bundle_id}/bundle.manifest.json.`,
    );
  }
  if (!amendedRuntimeMarkersPresent) {
    notes.push(
      "Deployed app shell JS lacks amended-candidate runtime markers (featured bundle id and/or CF1/CF2 management surfaces). CF2I6A renderer stability fix cannot be present in this shell.",
    );
  }
  if (deployed.catalog_primary_bundle) {
    notes.push(
      `Deployed primary catalog entry is ${deployed.catalog_primary_bundle.bundle_id} @ ${deployed.catalog_primary_bundle.version}.`,
    );
  }

  let alignment: AlignmentStatus;
  if (bundleIdReconciled && catalogHashReconciled && amendedRuntimeMarkersPresent) {
    alignment = "ALIGNED";
    notes.push("Repository candidate and deployed production candidate reconcile.");
  } else if (
    deployed.root_http_status === 200 &&
    deployed.catalog_http_status === 200 &&
    (!bundleIdReconciled || !amendedRuntimeMarkersPresent)
  ) {
    alignment = "DEPLOYMENT_BEHIND_REPOSITORY";
    notes.push(
      `Alignment floor for amended release candidate is ${AMENDED_FLOOR_COMMIT} (CF2I6A). Do not treat the older deployment as that candidate.`,
    );
  } else {
    alignment = "DEPLOYMENT_AHEAD_OR_UNKNOWN";
    notes.push("Could not classify deployment relative to repository with confidence.");
  }

  return {
    repository,
    deployed,
    alignment_status: alignment,
    alignment_notes: notes,
    catalog_hash_reconciled: catalogHashReconciled,
    bundle_id_reconciled: bundleIdReconciled,
    amended_runtime_markers_present: amendedRuntimeMarkersPresent,
  };
}

export async function resolveFullIdentity(productionUrl: string): Promise<IdentityReconciliation> {
  const repository = await resolveRepositoryCandidateIdentity();
  const deployed = await resolveDeployedCandidateIdentity({
    productionUrl,
    repositoryFeaturedBundleId: repository.featured_bundle_id,
  });
  return reconcileIdentities(repository, deployed);
}
