import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SOURCE_ALIAS_TABLE_SCHEMA } from "./reviewed_alias_import";
import {
  GOVERNED_ALIAS_APPEND_DRY_RUN_AUTHORITY_WARNING,
  GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES,
  assertSafeDryRunOutputPaths,
  parseAcceptedCandidatesJsonl,
  runGovernedAliasAppendCliDryRun,
} from "./governed_alias_append_cli_dry_run";

const IR_MAIN = "e79067fd41b59e85";
const IR_OTHER = "aaaaaaaaaaaaaaaa";
const BUNDLE = "bundle_fixture";
const FIXED_TS = "2026-08-20T15:00:00.000Z";

function existingLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schema_version: SOURCE_ALIAS_TABLE_SCHEMA,
    alias_table_version: "phase7a-round1",
    alias_id: "src_alias_existing_0001",
    status: "approved",
    direction: "source_to_target",
    alias_source_term: "Yeux",
    canonical_source_terms: ["oeil"],
    resolved_ir_ids: [IR_OTHER],
    candidate_type: "french_plural_singular_alias",
    evidence_ir_ids: [IR_OTHER],
    rationale: "existing row",
    reviewer: "tester",
    reviewed_at: "2026-06-02",
    source_bundle_id: BUNDLE,
    source_norm_version: "norm_v3",
    ...overrides,
  });
}

function candidateLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schema_version: SOURCE_ALIAS_TABLE_SCHEMA,
    alias_table_version: "al1d5-test",
    alias_id: "src_alias_al1d5_mains",
    status: "candidate",
    direction: "source_to_target",
    alias_source_term: "mains",
    canonical_source_terms: ["main"],
    resolved_ir_ids: [IR_MAIN],
    candidate_type: "french_plural_singular_alias",
    evidence_ir_ids: [IR_MAIN],
    rationale: "preview rationale",
    source_bundle_id: BUNDLE,
    source_norm_version: "norm_v3",
    provenance_source: "worksheet_manual",
    ...overrides,
  });
}

function nodeFs() {
  const fsPromises = {
    readFile: async (p: string, encoding: "utf8") =>
      readFileSync(p, encoding),
    writeFile: async (p: string, data: string) => {
      writeFileSync(p, data, "utf8");
    },
    mkdir: async (p: string, options: { recursive: boolean }) => {
      mkdirSync(p, options);
    },
  };
  return fsPromises;
}

function setupFixture(opts?: {
  accepted?: string;
  source?: string;
  primary?: string;
  irIds?: string;
}) {
  const root = mkdtempSync(join(tmpdir(), "al1d5-"));
  const sourcePath = join(root, "source_aliases_v1.jsonl");
  const acceptedPath = join(root, "accepted_aliases_preview.jsonl");
  const primaryPath = join(root, "primary_keys.jsonl");
  const irPath = join(root, "dictionary_ir_ids.jsonl");
  const outDir = join(root, "out");
  const runtimeProbe = join(root, "search_index.jsonl");

  const source =
    opts?.source ?? `${existingLine()}\n`;
  const accepted =
    opts?.accepted ?? `${candidateLine()}\n`;
  const primary =
    opts?.primary ??
    `${JSON.stringify({ key_type: "src_casefold", key: "main", ir_ids: [IR_MAIN] })}\n` +
      `${JSON.stringify({ key_type: "src_casefold", key: "oeil", ir_ids: [IR_OTHER] })}\n`;
  const irIds =
    opts?.irIds ??
    `${JSON.stringify({ ir_id: IR_MAIN })}\n${JSON.stringify({ ir_id: IR_OTHER })}\n`;

  writeFileSync(sourcePath, source, "utf8");
  writeFileSync(acceptedPath, accepted, "utf8");
  writeFileSync(primaryPath, primary, "utf8");
  writeFileSync(irPath, irIds, "utf8");
  writeFileSync(runtimeProbe, '{"untouched":true}\n', "utf8");

  return {
    root,
    sourcePath,
    acceptedPath,
    primaryPath,
    irPath,
    outDir,
    runtimeProbe,
    sourceBefore: source,
    runtimeBefore: readFileSync(runtimeProbe, "utf8"),
  };
}

describe("AL1D5 governed alias append CLI dry-run", () => {
  it("reads source aliases and accepted candidates; writes manifest/summary/preview on success", async () => {
    const fx = setupFixture();
    const result = await runGovernedAliasAppendCliDryRun({
      cli: {
        sourceAliasesPath: fx.sourcePath,
        acceptedCandidatesPath: fx.acceptedPath,
        outDir: fx.outDir,
        expectedBundleId: BUNDLE,
        sourceLabel: "al1d5_fixture",
        primaryKeysPath: fx.primaryPath,
        dictionaryIrIdsPath: fx.irPath,
        reviewedBy: "local_reviewer",
        reviewedAt: FIXED_TS,
        generatedAt: FIXED_TS,
      },
      fs: nodeFs(),
    });

    expect(result.ok).toBe(true);
    expect(result.writes_performed).toBe(false);
    expect(result.manifest.writes_performed).toBe(false);
    expect(result.manifest.ok).toBe(true);
    expect(result.manifest.appended_count).toBe(1);

    const manifest = JSON.parse(
      readFileSync(
        join(fx.outDir, GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_manifest_json),
        "utf8",
      ),
    );
    expect(manifest.writes_performed).toBe(false);
    expect(manifest.generated_at).toBe(FIXED_TS);

    const summary = readFileSync(
      join(fx.outDir, GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_summary_md),
      "utf8",
    );
    expect(summary).toContain(GOVERNED_ALIAS_APPEND_DRY_RUN_AUTHORITY_WARNING);
    expect(summary).toContain("`source_aliases_v1` was not modified");

    const previewName =
      GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_preview_source_aliases_v1_jsonl;
    expect(previewName).not.toBe("source_aliases_v1.jsonl");
    const preview = readFileSync(join(fx.outDir, previewName), "utf8");
    expect(preview).toContain('"status":"candidate"');
    expect(preview).toContain("mains");
    const appendedOnly = preview.slice(fx.sourceBefore.length);
    expect(appendedOnly).toContain('"status":"candidate"');
    expect(appendedOnly).not.toContain('"status":"approved"');

    expect(readFileSync(fx.sourcePath, "utf8")).toBe(fx.sourceBefore);
    expect(readFileSync(fx.runtimeProbe, "utf8")).toBe(fx.runtimeBefore);
    expect(readdirSync(fx.root).includes("search_index.jsonl")).toBe(true);
  });

  it("exports skipped rows and keeps source unchanged", async () => {
    const fx = setupFixture({
      source: `${existingLine({
        alias_id: "src_alias_existing_mains",
        alias_source_term: "mains",
        canonical_source_terms: ["main"],
        resolved_ir_ids: [IR_MAIN],
        evidence_ir_ids: [IR_MAIN],
      })}\n`,
    });
    const result = await runGovernedAliasAppendCliDryRun({
      cli: {
        sourceAliasesPath: fx.sourcePath,
        acceptedCandidatesPath: fx.acceptedPath,
        outDir: fx.outDir,
        expectedBundleId: BUNDLE,
        sourceLabel: "al1d5_skip",
        primaryKeysPath: fx.primaryPath,
        dictionaryIrIdsPath: fx.irPath,
        reviewedAt: FIXED_TS,
        generatedAt: FIXED_TS,
      },
      fs: nodeFs(),
    });
    expect(result.ok).toBe(true);
    expect(result.manifest.skipped_count).toBe(1);
    const skipped = readFileSync(
      join(fx.outDir, GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_skipped_rows_jsonl),
      "utf8",
    );
    expect(skipped).toContain("exact_duplicate_existing");
    expect(readFileSync(fx.sourcePath, "utf8")).toBe(fx.sourceBefore);
  });

  it("rejected result writes no preview and exports rejected/errors", async () => {
    const fx = setupFixture({
      accepted: `${candidateLine({
        canonical_source_terms: ["missing_canonical"],
      })}\n`,
    });
    const result = await runGovernedAliasAppendCliDryRun({
      cli: {
        sourceAliasesPath: fx.sourcePath,
        acceptedCandidatesPath: fx.acceptedPath,
        outDir: fx.outDir,
        expectedBundleId: BUNDLE,
        sourceLabel: "al1d5_reject",
        primaryKeysPath: fx.primaryPath,
        dictionaryIrIdsPath: fx.irPath,
        reviewedAt: FIXED_TS,
        generatedAt: FIXED_TS,
      },
      fs: nodeFs(),
    });
    expect(result.ok).toBe(false);
    expect(
      readdirSync(fx.outDir).includes(
        GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_preview_source_aliases_v1_jsonl,
      ),
    ).toBe(false);
    const rejected = readFileSync(
      join(fx.outDir, GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_rejected_rows_jsonl),
      "utf8",
    );
    expect(rejected.length).toBeGreaterThan(0);
    expect(readFileSync(fx.sourcePath, "utf8")).toBe(fx.sourceBefore);
  });

  it("refuses output path equal to source path", async () => {
    const fx = setupFixture();
    const result = await runGovernedAliasAppendCliDryRun({
      cli: {
        sourceAliasesPath: fx.sourcePath,
        acceptedCandidatesPath: fx.acceptedPath,
        outDir: fx.sourcePath,
        expectedBundleId: BUNDLE,
        sourceLabel: "al1d5_bad_out",
        primaryKeysPath: fx.primaryPath,
        dictionaryIrIdsPath: fx.irPath,
        generatedAt: FIXED_TS,
      },
      fs: nodeFs(),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "out_dir_equals_source_file")).toBe(
      true,
    );
    expect(readFileSync(fx.sourcePath, "utf8")).toBe(fx.sourceBefore);
  });

  it("refuses dangerous preview filename", () => {
    const safety = assertSafeDryRunOutputPaths({
      sourceAliasesPath: "/tmp/aliases/source_aliases_v1.jsonl",
      acceptedCandidatesPath: "/tmp/aliases/accepted.jsonl",
      outDir: "/tmp/out",
      filenames: {
        append_preview_source_aliases_v1_jsonl: "source_aliases_v1.jsonl",
      },
    });
    expect(safety.ok).toBe(false);
    if (!safety.ok) {
      expect(safety.code).toBe("dangerous_preview_filename");
    }
  });

  it("does not output approved status in preview rows", async () => {
    const fx = setupFixture();
    const result = await runGovernedAliasAppendCliDryRun({
      cli: {
        sourceAliasesPath: fx.sourcePath,
        acceptedCandidatesPath: fx.acceptedPath,
        outDir: fx.outDir,
        expectedBundleId: BUNDLE,
        sourceLabel: "al1d5_candidate_only",
        primaryKeysPath: fx.primaryPath,
        dictionaryIrIdsPath: fx.irPath,
        reviewedAt: FIXED_TS,
        generatedAt: FIXED_TS,
      },
      fs: nodeFs(),
    });
    expect(result.ok).toBe(true);
    if (!result.append_result || !result.append_result.ok) {
      throw new Error("expected success");
    }
    for (const row of result.append_result.appended_rows) {
      expect(row.status).toBe("candidate");
    }
    const preview = readFileSync(
      join(
        fx.outDir,
        GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_preview_source_aliases_v1_jsonl,
      ),
      "utf8",
    );
    const appendedOnly = preview.slice(fx.sourceBefore.length);
    expect(appendedOnly).toContain('"status":"candidate"');
    expect(appendedOnly).not.toContain('"status":"approved"');
  });

  it("is deterministic with fixed timestamp", async () => {
    const fxA = setupFixture();
    const fxB = setupFixture();
    const cli = {
      expectedBundleId: BUNDLE,
      sourceLabel: "al1d5_det",
      reviewedBy: "reviewer",
      reviewedAt: FIXED_TS,
      generatedAt: FIXED_TS,
    } as const;
    const a = await runGovernedAliasAppendCliDryRun({
      cli: {
        ...cli,
        sourceAliasesPath: fxA.sourcePath,
        acceptedCandidatesPath: fxA.acceptedPath,
        outDir: fxA.outDir,
        primaryKeysPath: fxA.primaryPath,
        dictionaryIrIdsPath: fxA.irPath,
      },
      fs: nodeFs(),
    });
    const b = await runGovernedAliasAppendCliDryRun({
      cli: {
        ...cli,
        sourceAliasesPath: fxB.sourcePath,
        acceptedCandidatesPath: fxB.acceptedPath,
        outDir: fxB.outDir,
        primaryKeysPath: fxB.primaryPath,
        dictionaryIrIdsPath: fxB.irPath,
      },
      fs: nodeFs(),
    });
    expect(a.ok && b.ok).toBe(true);
    const previewA = readFileSync(
      join(
        fxA.outDir,
        GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_preview_source_aliases_v1_jsonl,
      ),
      "utf8",
    );
    const previewB = readFileSync(
      join(
        fxB.outDir,
        GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_preview_source_aliases_v1_jsonl,
      ),
      "utf8",
    );
    expect(previewA).toBe(previewB);
    expect(
      readFileSync(
        join(fxA.outDir, GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_manifest_json),
        "utf8",
      ).replaceAll(fxA.root, "ROOT"),
    ).toBe(
      readFileSync(
        join(fxB.outDir, GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_manifest_json),
        "utf8",
      ).replaceAll(fxB.root, "ROOT"),
    );
  });

  it("handles empty accepted candidates", async () => {
    const fx = setupFixture({ accepted: "" });
    const result = await runGovernedAliasAppendCliDryRun({
      cli: {
        sourceAliasesPath: fx.sourcePath,
        acceptedCandidatesPath: fx.acceptedPath,
        outDir: fx.outDir,
        expectedBundleId: BUNDLE,
        sourceLabel: "al1d5_empty",
        primaryKeysPath: fx.primaryPath,
        dictionaryIrIdsPath: fx.irPath,
        reviewedAt: FIXED_TS,
        generatedAt: FIXED_TS,
      },
      fs: nodeFs(),
    });
    expect(result.ok).toBe(true);
    expect(result.manifest.appended_count).toBe(0);
    expect(readFileSync(fx.sourcePath, "utf8")).toBe(fx.sourceBefore);
  });

  it("handles malformed candidates file fail-closed", async () => {
    const fx = setupFixture({ accepted: "{not-json\n" });
    const result = await runGovernedAliasAppendCliDryRun({
      cli: {
        sourceAliasesPath: fx.sourcePath,
        acceptedCandidatesPath: fx.acceptedPath,
        outDir: fx.outDir,
        expectedBundleId: BUNDLE,
        sourceLabel: "al1d5_malformed",
        primaryKeysPath: fx.primaryPath,
        dictionaryIrIdsPath: fx.irPath,
        generatedAt: FIXED_TS,
      },
      fs: nodeFs(),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "accepted_candidates_invalid")).toBe(
      true,
    );
    expect(
      readdirSync(fx.outDir).includes(
        GOVERNED_ALIAS_APPEND_DRY_RUN_FILENAMES.append_preview_source_aliases_v1_jsonl,
      ),
    ).toBe(false);
    expect(readFileSync(fx.sourcePath, "utf8")).toBe(fx.sourceBefore);
  });

  it("parseAcceptedCandidatesJsonl rejects non-candidate status", () => {
    const parsed = parseAcceptedCandidatesJsonl(
      `${candidateLine({ status: "approved" })}\n`,
    );
    expect(parsed.ok).toBe(false);
  });
});
