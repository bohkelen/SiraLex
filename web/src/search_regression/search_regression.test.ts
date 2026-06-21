import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deleteSiralexDb, openSiralexDb, STORE_SEARCH_INDEX } from "../idb/siralex_db";
import {
  findCaseById,
  KUN_NFD_CODE_POINTS,
  loadMatrixJsonl,
  type SearchRegressionCase,
} from "./matrix_loader";
import {
  compareCase,
  adaptSearchResult,
  pickParityFields,
  replayCase,
  runMatrixRegression,
  populateSearchIndexFromBundle,
  type CaseReplayResult,
} from "./run_matrix";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const MATRIX_PATH = join(REPO_ROOT, "shared/search_regression/search_regression_matrix_v1.jsonl");
const MANIFEST_PATH = join(REPO_ROOT, "shared/search_regression/matrix_manifest_v1.json");
const BUNDLE_DIR = join(
  REPO_ROOT,
  "web/public/bundle_full_20260616_phase7j_alias_round2_candidate",
);
const CATALOG_PATH = join(REPO_ROOT, "web/public/catalog.json");
const PYTHON_GOLDEN_PATH = join(
  REPO_ROOT,
  "shared/search_regression/tests/golden_python_replay_v1.json",
);
const RUNTIME_GOLDEN_PATH = join(
  REPO_ROOT,
  "shared/search_regression/tests/golden_runtime_replay_v1.json",
);

const BUNDLE_ID = "bundle_full_20260616_phase7j_alias_round2_candidate";

type GoldenPayload = {
  cases: CaseReplayResult[];
  matrix_case_count: number;
  passed_case_count: number;
  failed_case_count: number;
};

function loadGolden(path: string): GoldenPayload {
  return JSON.parse(readFileSync(path, "utf-8")) as GoldenPayload;
}

function caseById(result: { cases: CaseReplayResult[] }, caseId: string): CaseReplayResult {
  const entry = result.cases.find((item) => item.case_id === caseId);
  if (!entry) {
    throw new Error(`missing case ${caseId}`);
  }
  return entry;
}

function actualSearchFields(caseResult: CaseReplayResult): Record<string, unknown> {
  return {
    actual_result_status: caseResult.actual_result_status,
    actual_result_count: caseResult.actual_result_count,
    actual_ir_ids: caseResult.actual_ir_ids,
    actual_matched_key_type: caseResult.actual_matched_key_type,
    actual_matched_key: caseResult.actual_matched_key,
    actual_deep_ladder: caseResult.actual_deep_ladder,
  };
}

async function assertSearchIndexEmpty(): Promise<void> {
  const db = await openSiralexDb();
  try {
    const tx = db.transaction(STORE_SEARCH_INDEX, "readonly");
    const count = await new Promise<number>((resolve, reject) => {
      const request = tx.objectStore(STORE_SEARCH_INDEX).count();
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
    });
    expect(count).toBe(0);
  } finally {
    db.close();
  }
}

describe("Phase 7L runtime search regression", () => {
  beforeEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
    await assertSearchIndexEmpty();
  });

  afterEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
    await assertSearchIndexEmpty();
  });

  it("matrix loader preserves kùn as exact NFD code points", () => {
    const cases = loadMatrixJsonl(MATRIX_PATH);
    const kunCase = findCaseById(cases, "sr7l_013_kun_decomposed_unicode");
    expect(kunCase).toBeDefined();
    expect(Array.from(kunCase!.query)).toEqual([...KUN_NFD_CODE_POINTS]);
  });

  it(
    "runtime matrix run executes all 13 cases through searchQuery()",
    async () => {
      const result = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: MANIFEST_PATH,
        bundleDir: BUNDLE_DIR,
        catalogPath: CATALOG_PATH,
      });
      expect(result.matrix_case_count).toBe(13);
      expect(result.cases).toHaveLength(13);
    },
    180_000,
  );

  it(
    "runtime output has 13 passes and zero failures",
    async () => {
      const result = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: MANIFEST_PATH,
        bundleDir: BUNDLE_DIR,
        catalogPath: CATALOG_PATH,
      });
      expect(result.passed_case_count).toBe(13);
      expect(result.failed_case_count).toBe(0);
      expect(result.cases.every((entry) => entry.expected_match)).toBe(true);
    },
    180_000,
  );

  it(
    "runtime result matches grand-parents ordered IDs",
    async () => {
      const result = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: MANIFEST_PATH,
        bundleDir: BUNDLE_DIR,
        catalogPath: CATALOG_PATH,
      });
      const caseResult = caseById(result, "sr7l_003_grand_parents_alias");
      expect(caseResult.actual_ir_ids).toEqual(["1f6d3a5919110b21", "957bd76b41fda053"]);
    },
    180_000,
  );

  it(
    "runtime result matches mère ordered three-ID result",
    async () => {
      const result = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: MANIFEST_PATH,
        bundleDir: BUNDLE_DIR,
        catalogPath: CATALOG_PATH,
      });
      const caseResult = caseById(result, "sr7l_004_mere_multi");
      expect(caseResult.actual_ir_ids).toEqual([
        "0f517a71c373f51d",
        "d540716db9321a83",
        "e5164efcdf5e6ca4",
      ]);
    },
    180_000,
  );

  it(
    "runtime Kùn and NFD kùn have identical actual search-result fields",
    async () => {
      const result = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: MANIFEST_PATH,
        bundleDir: BUNDLE_DIR,
        catalogPath: CATALOG_PATH,
      });
      const nfc = caseById(result, "sr7l_012_kun_accent_ambiguity");
      const nfd = caseById(result, "sr7l_013_kun_decomposed_unicode");
      expect(actualSearchFields(nfc)).toEqual(actualSearchFields(nfd));
    },
    180_000,
  );

  it(
    "runtime poil returns ff499fdee22b2b86, not 43b64456edacdbe0",
    async () => {
      const result = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: MANIFEST_PATH,
        bundleDir: BUNDLE_DIR,
        catalogPath: CATALOG_PATH,
      });
      const caseResult = caseById(result, "sr7l_009_poil_supplement");
      expect(caseResult.actual_ir_ids).toEqual(["ff499fdee22b2b86"]);
      expect(caseResult.actual_ir_ids).not.toContain("43b64456edacdbe0");
    },
    180_000,
  );

  it(
    "runtime zzzz-nohit-test produces clean miss fields",
    async () => {
      const result = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: MANIFEST_PATH,
        bundleDir: BUNDLE_DIR,
        catalogPath: CATALOG_PATH,
      });
      const caseResult = caseById(result, "sr7l_010_zzzz_nohit_probe");
      expect(caseResult.actual_result_status).toBe("miss");
      expect(caseResult.actual_result_count).toBe(0);
      expect(caseResult.actual_ir_ids).toEqual([]);
      expect(caseResult.actual_matched_key_type).toBe("none");
      expect(caseResult.actual_matched_key).toBeNull();
      expect(caseResult.actual_deep_ladder).toBe(false);
    },
    180_000,
  );

  it(
    "runtime ordered per-case output matches Python golden case-for-case on every parity field",
    async () => {
      const runtime = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: MANIFEST_PATH,
        bundleDir: BUNDLE_DIR,
        catalogPath: CATALOG_PATH,
      });
      const pythonGolden = loadGolden(PYTHON_GOLDEN_PATH);

      expect(runtime.cases).toHaveLength(pythonGolden.cases.length);
      for (let index = 0; index < runtime.cases.length; index += 1) {
        expect(pickParityFields(runtime.cases[index]!)).toEqual(
          pickParityFields(pythonGolden.cases[index]!),
        );
      }
    },
    180_000,
  );

  it(
    "runtime golden matches the actual runtime test path output",
    async () => {
      const runtime = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: MANIFEST_PATH,
        bundleDir: BUNDLE_DIR,
        catalogPath: CATALOG_PATH,
      });
      const runtimeGolden = loadGolden(RUNTIME_GOLDEN_PATH);
      expect(runtime.schema_version).toBe("search_regression_runtime_run_v1");
      expect(runtime.matrix_case_count).toBe(runtimeGolden.matrix_case_count);
      expect(runtime.passed_case_count).toBe(runtimeGolden.passed_case_count);
      expect(runtime.failed_case_count).toBe(runtimeGolden.failed_case_count);
      for (let index = 0; index < runtime.cases.length; index += 1) {
        expect(pickParityFields(runtime.cases[index]!)).toEqual(
          pickParityFields(runtimeGolden.cases[index]!),
        );
      }
    },
    180_000,
  );

  it("mutated expected matrix case produces field-level mismatch in runtime adapter", () => {
    const fruit = findCaseById(loadMatrixJsonl(MATRIX_PATH), "sr7l_001_fruit_exact");
    expect(fruit).toBeDefined();

    const actual = adaptSearchResult(fruit!, {
      ir_ids: ["7cdb6070ce427a6d"],
      matched_key_type: "casefold",
      matched_key: "fruit",
      query_normalized_keys: {
        casefold: ["fruit"],
        diacritics_insensitive: ["fruit"],
        punct_stripped: ["fruit"],
        nospace: ["fruit"],
      },
      last_tried_normalized_key: "fruit",
    });

    const mutatedCase: SearchRegressionCase = {
      ...fruit!,
      expected_ir_ids: ["0000000000000000"],
      expected_result_count: 1,
    };
    const compared = compareCase(mutatedCase, actual);
    expect(compared.expected_match).toBe(false);
    expect(compared.mismatches.some((item) => item.startsWith("actual_ir_ids:"))).toBe(true);
  });

  it(
    "runtime database is cleaned before and after matrix execution",
    async () => {
      await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: MANIFEST_PATH,
        bundleDir: BUNDLE_DIR,
        catalogPath: CATALOG_PATH,
      });
      await assertSearchIndexEmpty();
    },
    180_000,
  );

  it(
    "populateSearchIndexFromBundle leaves searchable rows scoped to bundle_id",
    async () => {
      const db = await openSiralexDb();
      try {
        await populateSearchIndexFromBundle(db, BUNDLE_DIR, BUNDLE_ID);
        const tx = db.transaction(STORE_SEARCH_INDEX, "readonly");
        const store = tx.objectStore(STORE_SEARCH_INDEX);
        const entry = await new Promise<{ bundle_id: string; ir_ids: string[] } | undefined>(
          (resolve, reject) => {
            const request = store.get([BUNDLE_ID, "src_casefold", "fruit"]);
            request.addEventListener("success", () =>
              resolve(request.result as { bundle_id: string; ir_ids: string[] } | undefined),
            );
            request.addEventListener("error", () => reject(request.error));
          },
        );
        expect(entry?.bundle_id).toBe(BUNDLE_ID);
        expect(entry?.ir_ids).toEqual(["7cdb6070ce427a6d"]);
      } finally {
        db.close();
      }
    },
    180_000,
  );

  it(
    "replayCase uses searchQuery for a single matrix row",
    async () => {
      const db = await openSiralexDb();
      try {
        await populateSearchIndexFromBundle(db, BUNDLE_DIR, BUNDLE_ID);
        const fruit = findCaseById(loadMatrixJsonl(MATRIX_PATH), "sr7l_001_fruit_exact");
        expect(fruit).toBeDefined();
        const replayed = await replayCase(db, BUNDLE_ID, fruit!);
        expect(replayed.expected_match).toBe(true);
        expect(replayed.actual_ir_ids).toEqual(["7cdb6070ce427a6d"]);
      } finally {
        db.close();
      }
    },
    180_000,
  );
});
