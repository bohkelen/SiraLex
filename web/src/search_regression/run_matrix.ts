import { readFileSync } from "node:fs";
import { join } from "node:path";

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
      search_index_sha256: manifest.search_index_sha256,
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
