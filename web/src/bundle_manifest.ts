export type BundleManifestV1FileEntry = {
  path: string;
  byte_length: number;
  sha256: string;
};

export type BundleManifestLanguages = {
  source_lang?: string;
  target_lang?: string;
};

export type BundleManifestLanguageLabels = {
  source?: string;
  target?: string;
};

export type BundleManifestScripts = {
  target_supported?: string[];
};

export type BundleManifestV1 = {
  manifest_schema_version: string;
  bundle_id: string;
  bundle_type: string;
  bundle_format: string;
  compression: string;
  record_schema_id: string;
  record_schema_version: string;
  rule_versions: {
    normalization: string;
    [k: string]: unknown;
  };
  sources: {
    included: string[];
    excluded: unknown[];
  };
  reconciliation_action: string;
  update_mode: string;
  files: BundleManifestV1FileEntry[];
  content_sha256: string;
  languages?: BundleManifestLanguages;
  language_labels?: BundleManifestLanguageLabels;
  scripts?: BundleManifestScripts;
  build?: unknown;
};

export type BundleManifestValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  manifest?: BundleManifestV1;
};

// Expectations must match the manifest emitted by api/bundle_builder/build_bundle.py
export const EXPECTED_MANIFEST = {
  manifest_schema_version: "bundle_manifest_v1",
  compression: "none",
  record_schema_id: "normalized_v1",
  record_schema_version: "1",
  rule_versions: {
    normalization: "norm_v1",
  },
  reconciliation_action: "REPLACE_ALL",
  update_mode: "REPLACE_ALL",
} as const;

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function getArray(obj: Record<string, unknown>, key: string): unknown[] | undefined {
  const v = obj[key];
  return Array.isArray(v) ? v : undefined;
}

function getOptionalStringObject(
  raw: unknown,
  allowedKeys: string[],
): Record<string, string> | undefined {
  if (!isObject(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const key of allowedKeys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim() !== "") {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function getOptionalStringArrayObject(
  raw: unknown,
  key: string,
): Record<string, string[]> | undefined {
  if (!isObject(raw)) return undefined;
  const values = raw[key];
  if (!Array.isArray(values)) return undefined;
  const filtered = values.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  if (filtered.length === 0) return undefined;
  return { [key]: filtered };
}

function fmtExpected(actual: string | undefined, expected: string): string {
  return `expected '${expected}', got '${actual ?? "undefined"}'`;
}

export function parseAndValidateManifestJson(text: string): BundleManifestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (e) {
    return { ok: false, errors: [`Manifest is not valid JSON: ${String(e)}`], warnings };
  }

  if (!isObject(raw)) {
    return { ok: false, errors: ["Manifest JSON must be an object"], warnings };
  }

  const manifest_schema_version = getString(raw, "manifest_schema_version");
  const bundle_id = getString(raw, "bundle_id");
  const bundle_type = getString(raw, "bundle_type") ?? "unknown";
  const bundle_format = getString(raw, "bundle_format") ?? "unknown";
  const compression = getString(raw, "compression");
  const record_schema_id = getString(raw, "record_schema_id");
  const record_schema_version = getString(raw, "record_schema_version");
  const reconciliation_action = getString(raw, "reconciliation_action");
  const update_mode = getString(raw, "update_mode");
  const content_sha256 = getString(raw, "content_sha256");
  const languages = getOptionalStringObject(raw["languages"], ["source_lang", "target_lang"]) as
    | BundleManifestLanguages
    | undefined;
  const languageLabels = getOptionalStringObject(raw["language_labels"], ["source", "target"]) as
    | BundleManifestLanguageLabels
    | undefined;
  const scripts = getOptionalStringArrayObject(raw["scripts"], "target_supported") as
    | BundleManifestScripts
    | undefined;

  const rule_versions_raw = raw["rule_versions"];
  const rule_versions = isObject(rule_versions_raw) ? rule_versions_raw : undefined;
  const normalization_ruleset =
    rule_versions && typeof rule_versions["normalization"] === "string"
      ? (rule_versions["normalization"] as string)
      : undefined;

  if (!manifest_schema_version) errors.push("Missing/invalid field: manifest_schema_version");
  if (!bundle_id) errors.push("Missing/invalid field: bundle_id");
  if (!compression) errors.push("Missing/invalid field: compression");
  if (!record_schema_id) errors.push("Missing/invalid field: record_schema_id");
  if (!record_schema_version) errors.push("Missing/invalid field: record_schema_version");
  if (!reconciliation_action) errors.push("Missing/invalid field: reconciliation_action");
  if (!update_mode) errors.push("Missing/invalid field: update_mode");
  if (!content_sha256) errors.push("Missing/invalid field: content_sha256");
  if (!normalization_ruleset) errors.push("Missing/invalid field: rule_versions.normalization");

  const files_raw = getArray(raw, "files");
  if (!files_raw) errors.push("Missing/invalid field: files (array)");

  const files: BundleManifestV1FileEntry[] = [];
  if (files_raw) {
    for (const [i, entry] of files_raw.entries()) {
      if (!isObject(entry)) {
        errors.push(`files[${i}] must be an object`);
        continue;
      }
      const path = getString(entry, "path");
      const sha256 = getString(entry, "sha256");
      const byteLen = entry["byte_length"];
      if (!path) errors.push(`files[${i}].path must be a string`);
      if (typeof byteLen !== "number") errors.push(`files[${i}].byte_length must be a number`);
      if (!sha256) errors.push(`files[${i}].sha256 must be a string`);
      if (path && typeof byteLen === "number" && sha256) {
        files.push({ path, byte_length: byteLen, sha256 });
      }
    }
  }

  // Hard gating checks (must be stable + explicit).
  if (manifest_schema_version && manifest_schema_version !== EXPECTED_MANIFEST.manifest_schema_version) {
    errors.push(
      `manifest_schema_version mismatch: ${fmtExpected(
        manifest_schema_version,
        EXPECTED_MANIFEST.manifest_schema_version,
      )}`,
    );
  }
  if (compression && compression !== EXPECTED_MANIFEST.compression) {
    errors.push(`compression mismatch: ${fmtExpected(compression, EXPECTED_MANIFEST.compression)}`);
  }
  if (record_schema_id && record_schema_id !== EXPECTED_MANIFEST.record_schema_id) {
    errors.push(`record_schema_id mismatch: ${fmtExpected(record_schema_id, EXPECTED_MANIFEST.record_schema_id)}`);
  }
  if (record_schema_version && record_schema_version !== EXPECTED_MANIFEST.record_schema_version) {
    errors.push(
      `record_schema_version mismatch: ${fmtExpected(record_schema_version, EXPECTED_MANIFEST.record_schema_version)}`,
    );
  }
  if (normalization_ruleset && normalization_ruleset !== EXPECTED_MANIFEST.rule_versions.normalization) {
    errors.push(
      `rule_versions.normalization mismatch: ${fmtExpected(
        normalization_ruleset,
        EXPECTED_MANIFEST.rule_versions.normalization,
      )}`,
    );
  }
  if (reconciliation_action && reconciliation_action !== EXPECTED_MANIFEST.reconciliation_action) {
    errors.push(
      `reconciliation_action mismatch: ${fmtExpected(
        reconciliation_action,
        EXPECTED_MANIFEST.reconciliation_action,
      )}`,
    );
  }
  if (update_mode && update_mode !== EXPECTED_MANIFEST.update_mode) {
    errors.push(`update_mode mismatch: ${fmtExpected(update_mode, EXPECTED_MANIFEST.update_mode)}`);
  }

  // Presence gating: these payloads are required for Phase 2.0.3.
  const paths = new Set(files.map((f) => f.path));
  for (const required of ["records.jsonl", "search_index.jsonl"]) {
    if (files.length > 0 && !paths.has(required)) {
      errors.push(`Manifest files[] missing required payload: ${required}`);
    }
  }

  const ok = errors.length === 0;
  if (!ok) return { ok, errors, warnings };

  const manifest: BundleManifestV1 = {
    manifest_schema_version: manifest_schema_version!,
    bundle_id: bundle_id!,
    bundle_type,
    bundle_format,
    compression: compression!,
    record_schema_id: record_schema_id!,
    record_schema_version: record_schema_version!,
    rule_versions: {
      ...(rule_versions as Record<string, unknown>),
      normalization: normalization_ruleset!,
    },
    sources: isObject(raw["sources"])
      ? {
          included: Array.isArray((raw["sources"] as Record<string, unknown>)["included"])
            ? (((raw["sources"] as Record<string, unknown>)["included"] as unknown[])?.filter(
                (x) => typeof x === "string",
              ) as string[])
            : [],
          excluded: Array.isArray((raw["sources"] as Record<string, unknown>)["excluded"])
            ? ((raw["sources"] as Record<string, unknown>)["excluded"] as unknown[])
            : [],
        }
      : { included: [], excluded: [] },
    reconciliation_action: reconciliation_action!,
    update_mode: update_mode!,
    files,
    content_sha256: content_sha256!,
    languages,
    language_labels: languageLabels,
    scripts,
    build: raw["build"],
  };

  // Warnings (non-fatal): unexpected extra payloads
  for (const f of files) {
    if (f.path !== "records.jsonl" && f.path !== "search_index.jsonl") {
      warnings.push(`Extra payload in manifest files[]: ${f.path}`);
    }
  }

  return { ok: true, errors, warnings, manifest };
}

export type SelectedBundleFiles = {
  records?: File;
  search_index?: File;
};

export function validateSelectedFilesAgainstManifest(
  manifest: BundleManifestV1,
  selected: SelectedBundleFiles,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const byPath = new Map<string, BundleManifestV1FileEntry>();
  for (const fe of manifest.files) byPath.set(fe.path, fe);

  const required: Array<keyof SelectedBundleFiles> = ["records", "search_index"];
  for (const k of required) {
    const f = selected[k];
    if (!f) {
      errors.push(`Missing required selected file: ${k === "records" ? "records.jsonl" : "search_index.jsonl"}`);
      continue;
    }
    const expectedPath = k === "records" ? "records.jsonl" : "search_index.jsonl";
    const entry = byPath.get(expectedPath);
    if (!entry) {
      // Should already be caught by manifest validation, but keep this defensive.
      errors.push(`Manifest missing file entry for ${expectedPath}`);
      continue;
    }
    if (f.size !== entry.byte_length) {
      errors.push(
        `byte_length mismatch for ${expectedPath}: expected ${entry.byte_length} bytes, got ${f.size} bytes`,
      );
    }
    if (f.name !== expectedPath) {
      warnings.push(`Selected filename for ${expectedPath} is '${f.name}' (ok, but expected '${expectedPath}')`);
    }
  }

  return { errors, warnings };
}

