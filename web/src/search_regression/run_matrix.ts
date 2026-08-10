import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import type { SearchDirection } from "../bundle_labels";
import { deleteSiralexDb, openSiralexDb } from "../idb/siralex_db";
import { importSearchIndexJsonl } from "../import/import_search_index";
import { searchQuery, type SearchResult } from "../search/search_query";
import {
  loadMatrixJsonl,
  loadMatrixManifest,
  type MatrixManifest,
  type SearchRegressionCase,
} from "./matrix_loader";

export const RUN_SCHEMA_VERSION = "search_regression_runtime_run_v1";

export class RuntimeBundleMetadataError extends Error {
  override name = "RuntimeBundleMetadataError";
}

export class RuntimeSearchIndexChecksumError extends Error {
  override name = "RuntimeSearchIndexChecksumError";
}

export type CaseReplayResult = {
  case_id: string;
  query: string;
  query_unicode_form: string;
  direction: SearchDirection;
  actual_result_status: "miss" | "hit_single" | "hit_multi";
  actual_result_count: number;
  actual_ir_ids: string[];
  actual_matched_key_type: string;
  actual_matched_key: string | null;
  actual_deep_ladder: boolean;
  expected_match: boolean;
  mismatches: string[];
};

export type RegressionRunResult = {
  schema_version: string;
  bundle_id: string;
  catalog_version: string;
  norm_version: string;
  search_index_sha256: string;
  matrix_case_count: number;
  passed_case_count: number;
  failed_case_count: number;
  cases: CaseReplayResult[];
};

export type RunMatrixOptions = {
  matrixPath: string;
  manifestPath: string;
  bundleDir: string;
  catalogPath?: string;
};

const PARITY_CASE_FIELDS = [
  "case_id",
  "query",
  "query_unicode_form",
  "direction",
  "actual_result_status",
  "actual_result_count",
  "actual_ir_ids",
  "actual_matched_key_type",
  "actual_matched_key",
  "actual_deep_ladder",
  "expected_match",
  "mismatches",
] as const;

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (value !== null && typeof value === "object") {
    const sorted = Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (value as Record<string, unknown>)[key];
        return acc;
      }, {});
    return JSON.stringify(sorted);
  }
  return JSON.stringify(value);
}

export function resultStatusFromCount(resultCount: number): CaseReplayResult["actual_result_status"] {
  if (resultCount === 0) {
    return "miss";
  }
  if (resultCount === 1) {
    return "hit_single";
  }
  return "hit_multi";
}

export function deriveDeepLadder(matchedKeyType: string): boolean {
  return matchedKeyType === "punct_stripped" || matchedKeyType === "nospace";
}

export function adaptSearchResult(
  matrixCase: SearchRegressionCase,
  searchResult: SearchResult,
): Omit<CaseReplayResult, "expected_match" | "mismatches"> {
  const actualResultCount = searchResult.ir_ids.length;
  const actualMatchedKeyType = searchResult.matched_key_type ?? "none";

  return {
    case_id: matrixCase.case_id,
    query: matrixCase.query,
    query_unicode_form: matrixCase.query_unicode_form,
    direction: matrixCase.direction,
    actual_result_status: resultStatusFromCount(actualResultCount),
    actual_result_count: actualResultCount,
    actual_ir_ids: [...searchResult.ir_ids],
    actual_matched_key_type: actualMatchedKeyType,
    actual_matched_key: searchResult.matched_key,
    actual_deep_ladder: deriveDeepLadder(actualMatchedKeyType),
  };
}

export function compareCase(
  matrixCase: SearchRegressionCase,
  actual: Omit<CaseReplayResult, "expected_match" | "mismatches">,
): CaseReplayResult {
  const mismatches: string[] = [];
  const expectedFields: Array<[string, unknown, unknown]> = [
    ["actual_result_status", matrixCase.expected_result_status, actual.actual_result_status],
    ["actual_result_count", matrixCase.expected_result_count, actual.actual_result_count],
    ["actual_ir_ids", matrixCase.expected_ir_ids, actual.actual_ir_ids],
    [
      "actual_matched_key_type",
      matrixCase.expected_matched_key_type,
      actual.actual_matched_key_type,
    ],
    ["actual_matched_key", matrixCase.expected_matched_key, actual.actual_matched_key],
    ["actual_deep_ladder", matrixCase.expected_deep_ladder, actual.actual_deep_ladder],
  ];

  for (const [fieldName, expected, observed] of expectedFields) {
    const expectedJson = JSON.stringify(expected);
    const observedJson = JSON.stringify(observed);
    if (expectedJson !== observedJson) {
      mismatches.push(
        `${fieldName}: expected ${formatValue(expected)}, got ${formatValue(observed)}`,
      );
    }
  }

  return {
    ...actual,
    expected_match: mismatches.length === 0,
    mismatches,
  };
}

export function pickParityFields(caseResult: CaseReplayResult): Record<string, unknown> {
  return Object.fromEntries(PARITY_CASE_FIELDS.map((field) => [field, caseResult[field]]));
}

export function resolveCatalogVersion(catalogPath: string | undefined, bundleId: string): string | null {
  if (!catalogPath) {
    return null;
  }
  try {
    const payload = JSON.parse(readFileSync(catalogPath, "utf-8")) as {
      bundles?: Array<{ bundle_id?: unknown; version?: unknown }>;
    };
    if (!Array.isArray(payload.bundles)) {
      return null;
    }
    for (const bundle of payload.bundles) {
      if (bundle?.bundle_id !== bundleId) {
        continue;
      }
      if (typeof bundle.version === "string" && bundle.version.trim() !== "") {
        return bundle.version.trim();
      }
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

export function sha256File(path: string): string {
  const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
  return `sha256:${digest}`;
}

/**
 * Accept either legacy dir name == logical bundle_id, or ML1C1A versioned
 * physical artifact directory `{bundle_id}__{content_sha256_prefix8}`.
 */
export function isAcceptableBundleArtifactDirName(
  dirBasename: string,
  bundleId: string,
  contentSha256?: string,
): boolean {
  if (dirBasename === bundleId) return true;
  const prefix = `${bundleId}__`;
  if (!dirBasename.startsWith(prefix)) return false;
  const hashPrefix = dirBasename.slice(prefix.length);
  if (!/^[0-9a-f]{8}$/i.test(hashPrefix)) return false;
  if (typeof contentSha256 === "string" && contentSha256.trim() !== "") {
    const hex = contentSha256.replace(/^sha256:/i, "").toLowerCase();
    if (!hex.startsWith(hashPrefix.toLowerCase())) return false;
  }
  return true;
}

export function verifyRuntimeFixtureIdentity(
  bundleDir: string,
  manifest: MatrixManifest,
): string {
  const bundleBasename = basename(bundleDir);
  const bundleManifestPath = join(bundleDir, "bundle.manifest.json");
  if (!existsSync(bundleManifestPath)) {
    throw new RuntimeBundleMetadataError("bundle.manifest.json is missing");
  }

  const searchIndexPath = join(bundleDir, "search_index.jsonl");
  if (!existsSync(searchIndexPath)) {
    throw new RuntimeBundleMetadataError("search_index.jsonl is missing");
  }

  let bundleManifest: Record<string, unknown>;
  try {
    bundleManifest = JSON.parse(readFileSync(bundleManifestPath, "utf-8")) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RuntimeBundleMetadataError(`bundle.manifest.json is invalid: ${message}`);
  }

  const manifestBundleId =
    typeof bundleManifest.bundle_id === "string" ? bundleManifest.bundle_id : undefined;
  if (manifestBundleId !== manifest.bundle_id) {
    throw new RuntimeBundleMetadataError(
      "bundle.manifest.json bundle_id must match matrix manifest bundle_id: " +
        `expected ${JSON.stringify(manifest.bundle_id)}, got ${JSON.stringify(manifestBundleId)}`,
    );
  }

  const contentSha =
    typeof bundleManifest.content_sha256 === "string"
      ? bundleManifest.content_sha256
      : undefined;
  if (!isAcceptableBundleArtifactDirName(bundleBasename, manifest.bundle_id, contentSha)) {
    throw new RuntimeBundleMetadataError(
      "bundle directory basename must match manifest.bundle_id " +
        "or versioned artifact `{bundle_id}__{content_sha256_prefix8}`: " +
        `expected ${JSON.stringify(manifest.bundle_id)}, got ${JSON.stringify(bundleBasename)}`,
    );
  }

  const ruleVersions = bundleManifest.rule_versions;
  if (typeof ruleVersions === "object" && ruleVersions !== null) {
    const normalization = (ruleVersions as Record<string, unknown>).normalization;
    if (typeof normalization === "string" && normalization !== manifest.norm_version) {
      throw new RuntimeBundleMetadataError(
        "bundle manifest norm version must match matrix manifest norm_version: " +
          `expected ${JSON.stringify(manifest.norm_version)}, got ${JSON.stringify(normalization)}`,
      );
    }
  }

  const verifiedChecksum = sha256File(searchIndexPath);
  if (verifiedChecksum !== manifest.search_index_sha256) {
    throw new RuntimeSearchIndexChecksumError(
      "search_index.jsonl checksum mismatch: " +
        `expected ${JSON.stringify(manifest.search_index_sha256)}, got ${JSON.stringify(verifiedChecksum)}`,
    );
  }

  return verifiedChecksum;
}

export async function populateSearchIndexFromBundle(
  db: IDBDatabase,
  bundleDir: string,
  bundleId: string,
): Promise<void> {
  const indexPath = join(bundleDir, "search_index.jsonl");
  const indexText = readFileSync(indexPath, "utf-8");
  await importSearchIndexJsonl(db, new Blob([indexText], { type: "application/json" }), {
    bundleId,
    batchSize: 500,
  });
}

export async function replayCase(
  db: IDBDatabase,
  bundleId: string,
  matrixCase: SearchRegressionCase,
  searchIndexDirectional = true,
): Promise<CaseReplayResult> {
  const searchResult = await searchQuery(
    db,
    bundleId,
    matrixCase.direction,
    matrixCase.query,
    searchIndexDirectional,
  );
  const actual = adaptSearchResult(matrixCase, searchResult);
  return compareCase(matrixCase, actual);
}

export async function runMatrixRegression(options: RunMatrixOptions): Promise<RegressionRunResult> {
  const cases = loadMatrixJsonl(options.matrixPath);
  const manifest = loadMatrixManifest(options.manifestPath);
  const verifiedChecksum = verifyRuntimeFixtureIdentity(options.bundleDir, manifest);

  await deleteSiralexDb().catch(() => undefined);
  const db = await openSiralexDb();
  try {
    await populateSearchIndexFromBundle(db, options.bundleDir, manifest.bundle_id);

    const caseResults: CaseReplayResult[] = [];
    for (const matrixCase of cases) {
      caseResults.push(await replayCase(db, manifest.bundle_id, matrixCase));
    }

    const passedCaseCount = caseResults.filter((entry) => entry.expected_match).length;
    const catalogVersion =
      resolveCatalogVersion(options.catalogPath, manifest.bundle_id) ?? manifest.catalog_version;

    return {
      schema_version: RUN_SCHEMA_VERSION,
      bundle_id: manifest.bundle_id,
      catalog_version: catalogVersion,
      norm_version: manifest.norm_version,
      search_index_sha256: verifiedChecksum,
      matrix_case_count: caseResults.length,
      passed_case_count: passedCaseCount,
      failed_case_count: caseResults.length - passedCaseCount,
      cases: caseResults,
    };
  } finally {
    db.close();
    await deleteSiralexDb().catch(() => undefined);
  }
}

export type { MatrixManifest, SearchRegressionCase };
