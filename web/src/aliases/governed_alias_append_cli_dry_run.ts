/**
 * AL1D5 — Governed alias append CLI dry-run orchestration.
 *
 * Reads source aliases + AL1D2 accepted preview + snapshot files, calls AL1D4,
 * and writes dry-run artifacts to an output directory only.
 *
 * Never mutates source_aliases_v1.jsonl, never approves/applies/publishes.
 */

import { resolve as pathResolve, dirname, basename, join, isAbsolute } from "node:path";

import {
  buildGovernedAliasAppend,
  type GovernedAliasAppendResult,
  type GovernedAliasAppendSkip,
} from "./governed_alias_append";
import {
  SOURCE_ALIAS_TABLE_SCHEMA,
  type AcceptedAliasPreviewRow,
  type ReviewedAliasIndexRow,
  type SourceAliasCandidateType,
} from "./reviewed_alias_import";

export const GOVERNED_ALIAS_APPEND_CLI_DRY_RUN_SCHEMA =
  "governed_alias_append_cli_dry_run_v1" as const;

export const GOVERNED_ALIAS_APPEND_DRY_RUN_AUTHORITY_WARNING =
  "Dry-run only. No reviewed alias source file was modified. Preview rows remain candidates and are not searchable until validated, written through a governed write, built into a bundle, and published.";

export const GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES = {
  append_manifest_json: "append_manifest.json",
  append_summary_md: "append_summary.md",
  append_preview_source_aliases_v1_jsonl: "append_preview_source_aliases_v1.jsonl",
  append_rejected_rows_jsonl: "append_rejected_rows.jsonl",
  append_skipped_rows_jsonl: "append_skipped_rows.jsonl",
} as const;

const FORBIDDEN_OUTPUT_BASENAME = "source_aliases_v1.jsonl";

const ALLOWED_CANDIDATE_TYPES = new Set<SourceAliasCandidateType>([
  "french_plural_singular_alias",
  "french_gender_alias",
  "hyphenation_or_compound_alias",
  "french_common_form_alias",
]);

export type GovernedAliasAppendDryRunFs = {
  readFile(path: string, encoding: "utf8"): string | Promise<string>;
  writeFile(path: string, data: string, encoding: "utf8"): void | Promise<void>;
  mkdir(path: string, options: { recursive: boolean }): void | Promise<void>;
  realpath?(path: string): string | Promise<string>;
};

export type GovernedAliasAppendDryRunCliArgs = {
  sourceAliasesPath: string;
  acceptedCandidatesPath: string;
  outDir: string;
  expectedBundleId: string;
  sourceLabel: string;
  primaryKeysPath: string;
  dictionaryIrIdsPath: string;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Manifest/summary timestamp only; not required by AL1D4 when reviewedAt is set. */
  generatedAt?: string;
};

export type GovernedAliasAppendDryRunManifest = {
  schema_version: typeof GOVERNED_ALIAS_APPEND_CLI_DRY_RUN_SCHEMA;
  generated_at: string;
  source_aliases_path: string;
  accepted_candidates_path: string;
  expected_bundle_id: string;
  primary_keys_path: string;
  dictionary_ir_ids_path: string;
  source_label: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  writes_performed: false;
  ok: boolean;
  appended_count: number;
  skipped_count: number;
  rejected_count: number;
  error_count: number;
  filenames: typeof GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES;
  authority_warning: typeof GOVERNED_ALIAS_APPEND_DRY_RUN_AUTHORITY_WARNING;
};

export type GovernedAliasAppendDryRunCliResult = {
  ok: boolean;
  writes_performed: false;
  out_dir: string;
  written_files: string[];
  manifest: GovernedAliasAppendDryRunManifest;
  append_result: GovernedAliasAppendResult | null;
  errors: Array<{ code: string; detail: string }>;
};

function asPromise<T>(value: T | Promise<T>): Promise<T> {
  return Promise.resolve(value);
}

function resolvePath(p: string): string {
  return pathResolve(isAbsolute(p) ? p : pathResolve(process.cwd(), p));
}

function normalizeJsonl(text: string): string[] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function parseAcceptedCandidatesJsonl(text: string): {
  ok: true;
  rows: AcceptedAliasPreviewRow[];
} | {
  ok: false;
  detail: string;
} {
  const lines = normalizeJsonl(text);
  const rows: AcceptedAliasPreviewRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return { ok: false, detail: `Malformed JSON on line ${i + 1}` };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, detail: `Line ${i + 1} is not a JSON object` };
    }
    const row = parsed as Record<string, unknown>;
    if (row.schema_version !== SOURCE_ALIAS_TABLE_SCHEMA) {
      return {
        ok: false,
        detail: `Line ${i + 1}: expected schema_version ${SOURCE_ALIAS_TABLE_SCHEMA}`,
      };
    }
    if (row.status !== "candidate") {
      return {
        ok: false,
        detail: `Line ${i + 1}: accepted preview status must be candidate`,
      };
    }
    if (row.direction !== "source_to_target") {
      return { ok: false, detail: `Line ${i + 1}: direction must be source_to_target` };
    }
    if (typeof row.alias_table_version !== "string" || !row.alias_table_version.trim()) {
      return { ok: false, detail: `Line ${i + 1}: alias_table_version required` };
    }
    if (typeof row.alias_id !== "string" || !row.alias_id.trim()) {
      return { ok: false, detail: `Line ${i + 1}: alias_id required` };
    }
    if (typeof row.alias_source_term !== "string" || !row.alias_source_term.trim()) {
      return { ok: false, detail: `Line ${i + 1}: alias_source_term required` };
    }
    if (!isStringArray(row.canonical_source_terms) || row.canonical_source_terms.length === 0) {
      return { ok: false, detail: `Line ${i + 1}: canonical_source_terms required` };
    }
    if (!isStringArray(row.resolved_ir_ids) || row.resolved_ir_ids.length === 0) {
      return { ok: false, detail: `Line ${i + 1}: resolved_ir_ids required` };
    }
    if (!isStringArray(row.evidence_ir_ids)) {
      return { ok: false, detail: `Line ${i + 1}: evidence_ir_ids must be string[]` };
    }
    if (
      typeof row.candidate_type !== "string" ||
      !ALLOWED_CANDIDATE_TYPES.has(row.candidate_type as SourceAliasCandidateType)
    ) {
      return { ok: false, detail: `Line ${i + 1}: invalid candidate_type` };
    }
    if (typeof row.rationale !== "string") {
      return { ok: false, detail: `Line ${i + 1}: rationale required` };
    }
    if (typeof row.source_bundle_id !== "string" || !row.source_bundle_id.trim()) {
      return { ok: false, detail: `Line ${i + 1}: source_bundle_id required` };
    }
    if (typeof row.source_norm_version !== "string" || !row.source_norm_version.trim()) {
      return { ok: false, detail: `Line ${i + 1}: source_norm_version required` };
    }
    rows.push({
      schema_version: SOURCE_ALIAS_TABLE_SCHEMA,
      alias_table_version: row.alias_table_version,
      alias_id: row.alias_id,
      status: "candidate",
      direction: "source_to_target",
      alias_source_term: row.alias_source_term,
      canonical_source_terms: [...row.canonical_source_terms],
      resolved_ir_ids: [...row.resolved_ir_ids],
      candidate_type: row.candidate_type as SourceAliasCandidateType,
      evidence_ir_ids: [...row.evidence_ir_ids],
      rationale: row.rationale,
      source_bundle_id: row.source_bundle_id,
      source_norm_version: row.source_norm_version,
      provenance_source: "worksheet_manual",
    });
  }
  return { ok: true, rows };
}

export function parseDictionaryIrIdsSnapshot(text: string): {
  ok: true;
  ir_ids: string[];
} | {
  ok: false;
  detail: string;
} {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (trimmed === "") {
    return { ok: true, ir_ids: [] };
  }
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!isStringArray(parsed)) {
        return { ok: false, detail: "dictionary-ir-ids JSON array must contain only strings" };
      }
      return { ok: true, ir_ids: [...parsed] };
    } catch {
      return { ok: false, detail: "dictionary-ir-ids JSON array is malformed" };
    }
  }
  const irIds: string[] = [];
  const lines = normalizeJsonl(text);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("{")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return { ok: false, detail: `dictionary-ir-ids malformed JSON on line ${i + 1}` };
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, detail: `dictionary-ir-ids line ${i + 1} is not an object` };
      }
      const obj = parsed as Record<string, unknown>;
      const id = obj.ir_id;
      if (typeof id !== "string" || !id.trim()) {
        return {
          ok: false,
          detail: `dictionary-ir-ids line ${i + 1} missing string ir_id`,
        };
      }
      irIds.push(id);
      continue;
    }
    const bare = line.trim();
    if (!bare) continue;
    irIds.push(bare);
  }
  return { ok: true, ir_ids: irIds };
}

export function parsePrimaryKeysSnapshot(text: string): {
  ok: true;
  index_rows: ReviewedAliasIndexRow[];
} | {
  ok: false;
  detail: string;
} {
  const lines = normalizeJsonl(text);
  const index_rows: ReviewedAliasIndexRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return { ok: false, detail: `primary-keys malformed JSON on line ${i + 1}` };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, detail: `primary-keys line ${i + 1} is not an object` };
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.key_type !== "string" || !obj.key_type.trim()) {
      return { ok: false, detail: `primary-keys line ${i + 1} missing key_type` };
    }
    if (typeof obj.key !== "string") {
      return { ok: false, detail: `primary-keys line ${i + 1} missing key` };
    }
    if (!isStringArray(obj.ir_ids)) {
      return { ok: false, detail: `primary-keys line ${i + 1} ir_ids must be string[]` };
    }
    index_rows.push({
      key_type: obj.key_type,
      key: obj.key,
      ir_ids: [...obj.ir_ids],
    });
  }
  return { ok: true, index_rows };
}

export function parseGovernedAliasAppendDryRunArgv(
  argv: readonly string[],
): { ok: true; args: GovernedAliasAppendDryRunCliArgs } | { ok: false; detail: string } {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) {
      return { ok: false, detail: `Unexpected positional argument: ${token}` };
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      return { ok: false, detail: `Missing value for --${key}` };
    }
    flags.set(key, value);
    i += 1;
  }

  const required = [
    "source-aliases",
    "accepted-candidates",
    "out-dir",
    "expected-bundle-id",
    "primary-keys",
    "dictionary-ir-ids",
  ] as const;
  for (const name of required) {
    if (!flags.get(name)?.trim()) {
      return { ok: false, detail: `Missing required flag --${name}` };
    }
  }

  const sourceLabel = flags.get("source-label")?.trim() || "al1d2_accepted_preview";
  const reviewedBy = flags.get("reviewed-by")?.trim();
  const reviewedAt = flags.get("reviewed-at")?.trim();
  const generatedAt = flags.get("generated-at")?.trim();

  return {
    ok: true,
    args: {
      sourceAliasesPath: flags.get("source-aliases")!,
      acceptedCandidatesPath: flags.get("accepted-candidates")!,
      outDir: flags.get("out-dir")!,
      expectedBundleId: flags.get("expected-bundle-id")!,
      sourceLabel,
      primaryKeysPath: flags.get("primary-keys")!,
      dictionaryIrIdsPath: flags.get("dictionary-ir-ids")!,
      ...(reviewedBy ? { reviewedBy } : {}),
      ...(reviewedAt ? { reviewedAt } : {}),
      ...(generatedAt ? { generatedAt } : {}),
    },
  };
}

async function resolveExistingPath(
  fs: GovernedAliasAppendDryRunFs,
  path: string,
): Promise<string> {
  const absolute = resolvePath(path);
  if (fs.realpath) {
    try {
      return resolvePath(await asPromise(fs.realpath(absolute)));
    } catch {
      return absolute;
    }
  }
  return absolute;
}

/**
 * Refuse paths that would overwrite or collide with the real source alias file.
 */
export type GovernedAliasAppendDryRunFilenames = {
  [K in keyof typeof GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES]: string;
};

export function assertSafeDryRunOutputPaths(args: {
  sourceAliasesPath: string;
  acceptedCandidatesPath: string;
  outDir: string;
  filenames?: Partial<GovernedAliasAppendDryRunFilenames>;
}): { ok: true } | { ok: false; code: string; detail: string } {
  const filenames: GovernedAliasAppendDryRunFilenames = {
    ...GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES,
    ...args.filenames,
  };
  const sourceAbs = resolvePath(args.sourceAliasesPath);
  const acceptedAbs = resolvePath(args.acceptedCandidatesPath);
  const outAbs = resolvePath(args.outDir);

  if (sourceAbs === acceptedAbs) {
    return {
      ok: false,
      code: "source_equals_accepted",
      detail: "source-aliases and accepted-candidates must be different paths",
    };
  }

  if (sourceAbs === outAbs) {
    return {
      ok: false,
      code: "out_dir_equals_source_file",
      detail: "out-dir must not equal the source-aliases file path",
    };
  }

  for (const name of Object.values(filenames)) {
    if (basename(name) === FORBIDDEN_OUTPUT_BASENAME) {
      return {
        ok: false,
        code: "dangerous_preview_filename",
        detail: `Output filename must not be exactly ${FORBIDDEN_OUTPUT_BASENAME}`,
      };
    }
    const outputPath = resolvePath(join(outAbs, name));
    if (outputPath === sourceAbs) {
      return {
        ok: false,
        code: "output_overwrites_source",
        detail: `Output path would overwrite source aliases: ${outputPath}`,
      };
    }
    if (!outputPath.startsWith(`${outAbs}${outAbs.endsWith("/") ? "" : "/"}`) &&
      outputPath !== outAbs) {
      // join(outAbs, name) should always stay under outAbs for relative names.
      if (basename(name) !== name || name.includes("..")) {
        return {
          ok: false,
          code: "output_escapes_out_dir",
          detail: `Output filename escapes out-dir: ${name}`,
        };
      }
    }
  }

  const previewName = filenames.append_preview_source_aliases_v1_jsonl;
  if (basename(previewName) === FORBIDDEN_OUTPUT_BASENAME) {
    return {
      ok: false,
      code: "dangerous_preview_filename",
      detail: `Preview filename must not be exactly ${FORBIDDEN_OUTPUT_BASENAME}`,
    };
  }

  // Same directory as source is allowed only when preview names are clearly marked.
  // Still refuse if any planned basename equals the real source basename.
  if (dirname(sourceAbs) === outAbs) {
    for (const name of Object.values(filenames)) {
      if (basename(name) === basename(sourceAbs)) {
        return {
          ok: false,
          code: "confused_output_filename",
          detail:
            "out-dir is the source aliases directory and an output basename matches the source file",
        };
      }
    }
  }

  return { ok: true };
}

function emitJsonl(rows: readonly unknown[]): string {
  if (rows.length === 0) return "";
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function buildSummaryMarkdown(args: {
  generatedAt: string;
  sourceAliasesPath: string;
  acceptedCandidatesPath: string;
  expectedBundleId: string;
  result: GovernedAliasAppendResult | null;
  cliErrors: Array<{ code: string; detail: string }>;
}): string {
  const lines: string[] = [];
  lines.push("# Governed Alias Append — Dry-Run Summary");
  lines.push("");
  lines.push(`> ${GOVERNED_ALIAS_APPEND_DRY_RUN_AUTHORITY_WARNING}`);
  lines.push("");
  lines.push(`Generated at: \`${args.generatedAt}\``);
  lines.push("");
  lines.push("## Source files");
  lines.push("");
  lines.push(`- source aliases: \`${args.sourceAliasesPath}\``);
  lines.push(`- accepted candidates: \`${args.acceptedCandidatesPath}\``);
  lines.push(`- expected bundle id: \`${args.expectedBundleId}\``);
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  if (args.cliErrors.length > 0) {
    lines.push(`- CLI errors: **${args.cliErrors.length}**`);
    for (const err of args.cliErrors) {
      lines.push(`  - \`${err.code}\`: ${err.detail}`);
    }
    lines.push("");
  }
  if (!args.result) {
    lines.push("- Append transform: not executed");
    lines.push("");
    lines.push("## Next steps");
    lines.push("");
    lines.push("- Fix CLI/input errors and re-run the dry-run.");
    lines.push("");
    lines.push(
      "**Warning:** `source_aliases_v1` was not modified by this dry-run.",
    );
    lines.push("");
    return `${lines.join("\n")}`;
  }

  const result = args.result;
  lines.push(`- ok: **${result.ok ? "true" : "false"}**`);
  lines.push(`- appended (preview): **${result.summary.appended_count}**`);
  lines.push(`- skipped: **${result.summary.skipped_duplicate_count}**`);
  lines.push(`- rejected: **${result.rejected_rows.length}**`);
  lines.push(`- errors: **${result.errors.length}**`);
  lines.push(`- existing rows: **${result.summary.existing_row_count}**`);
  lines.push(`- input candidates: **${result.summary.input_candidate_count}**`);
  lines.push("");

  lines.push("## Accepted / appended candidate preview");
  lines.push("");
  if (result.ok && result.appended_rows.length > 0) {
    for (const row of result.appended_rows) {
      lines.push(
        `- \`${row.alias_source_term}\` → ${row.canonical_source_terms.join(", ")} (\`${row.alias_id}\`, status: candidate)`,
      );
    }
  } else if (result.ok) {
    lines.push("- No new candidate rows would be appended.");
  } else {
    lines.push("- No preview produced (batch rejected).");
  }
  lines.push("");

  lines.push("## Skipped duplicates");
  lines.push("");
  if (result.skipped_rows.length === 0) {
    lines.push("- None");
  } else {
    for (const row of result.skipped_rows) {
      lines.push(`- \`${row.alias_source_term}\`: ${row.reason} — ${row.detail}`);
    }
  }
  lines.push("");

  lines.push("## Rejected rows / errors");
  lines.push("");
  if (result.rejected_rows.length === 0 && result.errors.length === 0) {
    lines.push("- None");
  } else {
    for (const row of result.rejected_rows) {
      lines.push(
        `- rejected \`${row.alias_source_term ?? "(unknown)"}\`: ${row.reason} — ${row.detail}`,
      );
    }
    for (const err of result.errors) {
      lines.push(
        `- error \`${err.code}\`${err.alias_source_term ? ` (${err.alias_source_term})` : ""}: ${err.detail}`,
      );
    }
  }
  lines.push("");

  lines.push("## Next steps");
  lines.push("");
  if (result.ok) {
    lines.push(
      "- Review `append_preview_source_aliases_v1.jsonl` (candidate rows only).",
    );
    lines.push(
      "- A future governed write slice may persist this preview; do not hand-edit the live source file.",
    );
  } else {
    lines.push("- Resolve rejected rows / errors, then re-run the dry-run.");
  }
  lines.push("");
  lines.push(
    "**Warning:** `source_aliases_v1` was not modified by this dry-run.",
  );
  lines.push("");
  return `${lines.join("\n")}`;
}

export async function runGovernedAliasAppendCliDryRun(args: {
  cli: GovernedAliasAppendDryRunCliArgs;
  fs: GovernedAliasAppendDryRunFs;
  /** Optional override used only by tests to exercise dangerous filename refusal. */
  filenames?: Partial<GovernedAliasAppendDryRunFilenames>;
  nowIso?: () => string;
}): Promise<GovernedAliasAppendDryRunCliResult> {
  const filenames: GovernedAliasAppendDryRunFilenames = {
    ...GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES,
    ...args.filenames,
  };
  const written_files: string[] = [];
  const cliErrors: Array<{ code: string; detail: string }> = [];
  const generatedAt =
    args.cli.generatedAt?.trim() ||
    (args.nowIso ? args.nowIso() : new Date().toISOString());

  const sourceAbs = await resolveExistingPath(args.fs, args.cli.sourceAliasesPath);
  const acceptedAbs = await resolveExistingPath(
    args.fs,
    args.cli.acceptedCandidatesPath,
  );
  const outAbs = resolvePath(args.cli.outDir);
  const primaryAbs = await resolveExistingPath(args.fs, args.cli.primaryKeysPath);
  const irAbs = await resolveExistingPath(args.fs, args.cli.dictionaryIrIdsPath);

  const safety = assertSafeDryRunOutputPaths({
    sourceAliasesPath: sourceAbs,
    acceptedCandidatesPath: acceptedAbs,
    outDir: outAbs,
    filenames,
  });
  if (!safety.ok) {
    cliErrors.push({ code: safety.code, detail: safety.detail });
    const manifest: GovernedAliasAppendDryRunManifest = {
      schema_version: GOVERNED_ALIAS_APPEND_CLI_DRY_RUN_SCHEMA,
      generated_at: generatedAt,
      source_aliases_path: sourceAbs,
      accepted_candidates_path: acceptedAbs,
      expected_bundle_id: args.cli.expectedBundleId,
      primary_keys_path: primaryAbs,
      dictionary_ir_ids_path: irAbs,
      source_label: args.cli.sourceLabel,
      reviewed_by: args.cli.reviewedBy?.trim() || null,
      reviewed_at: args.cli.reviewedAt?.trim() || null,
      writes_performed: false,
      ok: false,
      appended_count: 0,
      skipped_count: 0,
      rejected_count: 0,
      error_count: cliErrors.length,
      filenames: GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES,
      authority_warning: GOVERNED_ALIAS_APPEND_DRY_RUN_AUTHORITY_WARNING,
    };
    return {
      ok: false,
      writes_performed: false,
      out_dir: outAbs,
      written_files,
      manifest,
      append_result: null,
      errors: cliErrors,
    };
  }

  await asPromise(args.fs.mkdir(outAbs, { recursive: true }));

  let sourceText: string;
  let acceptedText: string;
  let primaryText: string;
  let irText: string;
  try {
    sourceText = await asPromise(args.fs.readFile(sourceAbs, "utf8"));
    acceptedText = await asPromise(args.fs.readFile(acceptedAbs, "utf8"));
    primaryText = await asPromise(args.fs.readFile(primaryAbs, "utf8"));
    irText = await asPromise(args.fs.readFile(irAbs, "utf8"));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    cliErrors.push({ code: "read_failed", detail });
    const manifest: GovernedAliasAppendDryRunManifest = {
      schema_version: GOVERNED_ALIAS_APPEND_CLI_DRY_RUN_SCHEMA,
      generated_at: generatedAt,
      source_aliases_path: sourceAbs,
      accepted_candidates_path: acceptedAbs,
      expected_bundle_id: args.cli.expectedBundleId,
      primary_keys_path: primaryAbs,
      dictionary_ir_ids_path: irAbs,
      source_label: args.cli.sourceLabel,
      reviewed_by: args.cli.reviewedBy?.trim() || null,
      reviewed_at: args.cli.reviewedAt?.trim() || null,
      writes_performed: false,
      ok: false,
      appended_count: 0,
      skipped_count: 0,
      rejected_count: 0,
      error_count: 1,
      filenames: GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES,
      authority_warning: GOVERNED_ALIAS_APPEND_DRY_RUN_AUTHORITY_WARNING,
    };
    const summaryPath = join(outAbs, filenames.append_summary_md);
    const manifestPath = join(outAbs, filenames.append_manifest_json);
    const summary = buildSummaryMarkdown({
      generatedAt,
      sourceAliasesPath: sourceAbs,
      acceptedCandidatesPath: acceptedAbs,
      expectedBundleId: args.cli.expectedBundleId,
      result: null,
      cliErrors,
    });
    await asPromise(args.fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
    await asPromise(args.fs.writeFile(summaryPath, summary, "utf8"));
    written_files.push(manifestPath, summaryPath);
    return {
      ok: false,
      writes_performed: false,
      out_dir: outAbs,
      written_files,
      manifest,
      append_result: null,
      errors: cliErrors,
    };
  }

  const acceptedParsed = parseAcceptedCandidatesJsonl(acceptedText);
  if (!acceptedParsed.ok) {
    cliErrors.push({ code: "accepted_candidates_invalid", detail: acceptedParsed.detail });
  }
  const primaryParsed = parsePrimaryKeysSnapshot(primaryText);
  if (!primaryParsed.ok) {
    cliErrors.push({ code: "primary_keys_invalid", detail: primaryParsed.detail });
  }
  const irParsed = parseDictionaryIrIdsSnapshot(irText);
  if (!irParsed.ok) {
    cliErrors.push({ code: "dictionary_ir_ids_invalid", detail: irParsed.detail });
  }

  let appendResult: GovernedAliasAppendResult | null = null;
  if (cliErrors.length === 0 && acceptedParsed.ok && primaryParsed.ok && irParsed.ok) {
    appendResult = buildGovernedAliasAppend({
      existing_source_aliases_jsonl: sourceText,
      accepted_candidates: acceptedParsed.rows,
      known_ir_ids: irParsed.ir_ids,
      index_rows: primaryParsed.index_rows,
      options: {
        expected_bundle_id: args.cli.expectedBundleId,
        source_label: args.cli.sourceLabel,
        ...(args.cli.reviewedBy?.trim()
          ? { reviewed_by: args.cli.reviewedBy.trim() }
          : {}),
        ...(args.cli.reviewedAt?.trim()
          ? { reviewed_at: args.cli.reviewedAt.trim() }
          : {}),
      },
    });
  }

  const ok = appendResult?.ok === true && cliErrors.length === 0;
  const skipped: GovernedAliasAppendSkip[] = appendResult?.skipped_rows ?? [];
  const rejected = appendResult?.rejected_rows ?? [];
  const errors = appendResult?.errors ?? [];

  const manifest: GovernedAliasAppendDryRunManifest = {
    schema_version: GOVERNED_ALIAS_APPEND_CLI_DRY_RUN_SCHEMA,
    generated_at: generatedAt,
    source_aliases_path: sourceAbs,
    accepted_candidates_path: acceptedAbs,
    expected_bundle_id: args.cli.expectedBundleId,
    primary_keys_path: primaryAbs,
    dictionary_ir_ids_path: irAbs,
    source_label: args.cli.sourceLabel,
    reviewed_by: args.cli.reviewedBy?.trim() || null,
    reviewed_at: args.cli.reviewedAt?.trim() || null,
    writes_performed: false,
    ok,
    appended_count: appendResult?.summary.appended_count ?? 0,
    skipped_count: skipped.length,
    rejected_count: rejected.length,
    error_count: errors.length + cliErrors.length,
    filenames: GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES,
    authority_warning: GOVERNED_ALIAS_APPEND_DRY_RUN_AUTHORITY_WARNING,
  };

  const summary = buildSummaryMarkdown({
    generatedAt,
    sourceAliasesPath: sourceAbs,
    acceptedCandidatesPath: acceptedAbs,
    expectedBundleId: args.cli.expectedBundleId,
    result: appendResult,
    cliErrors,
  });

  const manifestPath = join(outAbs, filenames.append_manifest_json);
  const summaryPath = join(outAbs, filenames.append_summary_md);
  await asPromise(
    args.fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  );
  await asPromise(args.fs.writeFile(summaryPath, summary, "utf8"));
  written_files.push(manifestPath, summaryPath);

  if (ok && appendResult && appendResult.ok) {
    const previewPath = join(
      outAbs,
      filenames.append_preview_source_aliases_v1_jsonl,
    );
    await asPromise(
      args.fs.writeFile(previewPath, appendResult.updated_source_aliases_jsonl, "utf8"),
    );
    written_files.push(previewPath);
  }

  if (rejected.length > 0 || errors.length > 0) {
    const rejectedPath = join(outAbs, filenames.append_rejected_rows_jsonl);
    const payload = [
      ...rejected.map((row) => ({ kind: "rejected" as const, ...row })),
      ...errors.map((err) => ({ kind: "error" as const, ...err })),
    ];
    await asPromise(args.fs.writeFile(rejectedPath, emitJsonl(payload), "utf8"));
    written_files.push(rejectedPath);
  }

  if (skipped.length > 0) {
    const skippedPath = join(outAbs, filenames.append_skipped_rows_jsonl);
    await asPromise(args.fs.writeFile(skippedPath, emitJsonl(skipped), "utf8"));
    written_files.push(skippedPath);
  }

  return {
    ok,
    writes_performed: false,
    out_dir: outAbs,
    written_files,
    manifest,
    append_result: appendResult,
    errors: cliErrors,
  };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const parsed = parseGovernedAliasAppendDryRunArgv(argv);
  if (!parsed.ok) {
    console.error(`AL1D5 dry-run failed: ${parsed.detail}`);
    console.error(
      "Usage: --source-aliases <path> --accepted-candidates <path> --out-dir <path> --expected-bundle-id <id> --primary-keys <path> --dictionary-ir-ids <path> [--source-label <label>] [--reviewed-by <label>] [--reviewed-at <iso>] [--generated-at <iso>]",
    );
    return 2;
  }

  const fsPromises = await import("node:fs/promises");
  const result = await runGovernedAliasAppendCliDryRun({
    cli: parsed.args,
    fs: {
      readFile: (p, encoding) => fsPromises.readFile(p, encoding),
      writeFile: (p, data, encoding) => fsPromises.writeFile(p, data, { encoding }),
      mkdir: (p, options) => fsPromises.mkdir(p, options).then(() => undefined),
      realpath: (p) => fsPromises.realpath(p),
    },
  });

  console.log(GOVERNED_ALIAS_APPEND_DRY_RUN_AUTHORITY_WARNING);
  console.log(`ok=${result.ok}`);
  console.log(`writes_performed=${result.writes_performed}`);
  console.log(`out_dir=${result.out_dir}`);
  console.log(`appended_count=${result.manifest.appended_count}`);
  console.log(`skipped_count=${result.manifest.skipped_count}`);
  console.log(`rejected_count=${result.manifest.rejected_count}`);
  console.log(`error_count=${result.manifest.error_count}`);
  for (const file of result.written_files) {
    console.log(`wrote=${file}`);
  }
  for (const err of result.errors) {
    console.error(`${err.code}: ${err.detail}`);
  }
  return result.ok ? 0 : 1;
}
