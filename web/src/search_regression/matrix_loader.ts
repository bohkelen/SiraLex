import { readFileSync } from "node:fs";

export type SearchDirection = "source_to_target" | "target_to_source";

export type SearchRegressionCase = {
  case_id: string;
  query: string;
  query_unicode_form: string;
  direction: SearchDirection;
  expected_result_status: "miss" | "hit_single" | "hit_multi";
  expected_result_count: number;
  expected_ir_ids: string[];
  expected_matched_key_type: string;
  expected_matched_key: string | null;
  expected_deep_ladder: boolean;
};

export type MatrixManifest = {
  schema_version: string;
  matrix_schema_version: string;
  bundle_id: string;
  catalog_version: string;
  norm_version: string;
  search_index_sha256: string;
  bundle_content_sha256: string;
  case_count: number;
  purpose?: string;
};

const REQUIRED_CASE_FIELDS = [
  "case_id",
  "query",
  "query_unicode_form",
  "direction",
  "expected_result_status",
  "expected_result_count",
  "expected_ir_ids",
  "expected_matched_key_type",
  "expected_matched_key",
  "expected_deep_ladder",
] as const;

export class MatrixLoadError extends Error {}

function loadError(lineNumber: number, field: string, message: string): MatrixLoadError {
  return new MatrixLoadError(`line ${lineNumber}: ${field} ${message}`);
}

function requireString(raw: Record<string, unknown>, field: string, lineNumber: number): string {
  const value = raw[field];
  if (typeof value !== "string") {
    throw loadError(lineNumber, field, "must be a string");
  }
  return value;
}

function requireInt(raw: Record<string, unknown>, field: string, lineNumber: number): number {
  const value = raw[field];
  if (typeof value === "boolean" || typeof value !== "number" || !Number.isInteger(value)) {
    throw loadError(lineNumber, field, "must be an integer");
  }
  return value;
}

function requireBool(raw: Record<string, unknown>, field: string, lineNumber: number): boolean {
  const value = raw[field];
  if (typeof value !== "boolean") {
    throw loadError(lineNumber, field, "must be a boolean");
  }
  return value;
}

function requireStringList(raw: Record<string, unknown>, field: string, lineNumber: number): string[] {
  const value = raw[field];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw loadError(lineNumber, field, "must be a string list");
  }
  return [...value];
}

function requireStringOrNull(
  raw: Record<string, unknown>,
  field: string,
  lineNumber: number,
): string | null {
  const value = raw[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw loadError(lineNumber, field, "must be string or null");
  }
  return value;
}

function parseCase(raw: unknown, lineNumber: number): SearchRegressionCase {
  if (typeof raw !== "object" || raw === null) {
    throw new MatrixLoadError(`line ${lineNumber}: expected JSON object`);
  }
  const row = raw as Record<string, unknown>;
  const missing = REQUIRED_CASE_FIELDS.filter((field) => !(field in row));
  if (missing.length > 0) {
    throw new MatrixLoadError(
      `line ${lineNumber}: missing required fields: ${missing.join(", ")}`,
    );
  }

  const direction = requireString(row, "direction", lineNumber);
  if (direction !== "source_to_target" && direction !== "target_to_source") {
    throw loadError(lineNumber, "direction", "must be source_to_target or target_to_source");
  }

  return {
    case_id: requireString(row, "case_id", lineNumber),
    query: requireString(row, "query", lineNumber),
    query_unicode_form: requireString(row, "query_unicode_form", lineNumber),
    direction,
    expected_result_status: requireString(row, "expected_result_status", lineNumber) as
      | "miss"
      | "hit_single"
      | "hit_multi",
    expected_result_count: requireInt(row, "expected_result_count", lineNumber),
    expected_ir_ids: requireStringList(row, "expected_ir_ids", lineNumber),
    expected_matched_key_type: requireString(row, "expected_matched_key_type", lineNumber),
    expected_matched_key: requireStringOrNull(row, "expected_matched_key", lineNumber),
    expected_deep_ladder: requireBool(row, "expected_deep_ladder", lineNumber),
  };
}

export function loadMatrixJsonl(path: string): SearchRegressionCase[] {
  const text = readFileSync(path, "utf-8");
  const cases: SearchRegressionCase[] = [];

  let lineNumber = 0;
  for (const line of text.split(/\r?\n/)) {
    lineNumber += 1;
    if (line === "") {
      continue;
    }
    cases.push(parseCase(JSON.parse(line) as unknown, lineNumber));
  }

  return cases;
}

export function loadMatrixManifest(path: string): MatrixManifest {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  const required = [
    "schema_version",
    "matrix_schema_version",
    "bundle_id",
    "catalog_version",
    "norm_version",
    "search_index_sha256",
    "bundle_content_sha256",
    "case_count",
  ] as const;

  const missing = required.filter((field) => !(field in raw));
  if (missing.length > 0) {
    throw new MatrixLoadError(`manifest missing required fields: ${missing.join(", ")}`);
  }

  return {
    schema_version: String(raw.schema_version),
    matrix_schema_version: String(raw.matrix_schema_version),
    bundle_id: String(raw.bundle_id),
    catalog_version: String(raw.catalog_version),
    norm_version: String(raw.norm_version),
    search_index_sha256: String(raw.search_index_sha256),
    bundle_content_sha256: String(raw.bundle_content_sha256),
    case_count: Number(raw.case_count),
    purpose: typeof raw.purpose === "string" ? raw.purpose : undefined,
  };
}

export const KUN_NFD_CODE_POINTS = ["k", "u", "\u0300", "n"] as const;

export function findCaseById(
  cases: SearchRegressionCase[],
  caseId: string,
): SearchRegressionCase | undefined {
  return cases.find((entry) => entry.case_id === caseId);
}
