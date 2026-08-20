import { describe, expect, it } from "vitest";
import type { AcceptedAliasPreviewRow } from "./reviewed_alias_import";
import { SOURCE_ALIAS_TABLE_SCHEMA } from "./reviewed_alias_import";
import {
  buildGovernedAliasAppend,
  splitSourceAliasJsonlRawLines,
} from "./governed_alias_append";

const IR_MAIN = "e79067fd41b59e85";
const IR_OTHER = "aaaaaaaaaaaaaaaa";
const BUNDLE = "bundle_fixture";

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

function existingJsonl(lines: string[] = [existingLine()]): string {
  return `${lines.join("\n")}\n`;
}

function candidate(partial: Partial<AcceptedAliasPreviewRow> = {}): AcceptedAliasPreviewRow {
  return {
    schema_version: SOURCE_ALIAS_TABLE_SCHEMA,
    alias_table_version: "al1d4-test",
    alias_id: "src_alias_al1d4_mains",
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
    ...partial,
  };
}

function snapshots() {
  return {
    known_ir_ids: [IR_MAIN, IR_OTHER],
    index_rows: [
      { key_type: "src_casefold", key: "main", ir_ids: [IR_MAIN] },
      { key_type: "src_casefold", key: "oeil", ir_ids: [IR_OTHER] },
    ],
  };
}

function options() {
  return {
    expected_bundle_id: BUNDLE,
    source_label: "al1d2_package_fixture",
    reviewed_by: "local_reviewer",
    reviewed_at: "2026-08-20T15:00:00.000Z",
  };
}

describe("AL1D4 pure governed alias append", () => {
  it("appends a candidate after preserving existing raw lines", () => {
    const existing = existingJsonl();
    const result = buildGovernedAliasAppend({
      existing_source_aliases_jsonl: existing,
      accepted_candidates: [candidate()],
      ...snapshots(),
      options: options(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.writes_performed).toBe(false);
    expect(result.appended_rows).toHaveLength(1);
    expect(result.appended_rows[0]?.status).toBe("candidate");
    expect(result.updated_source_aliases_jsonl.startsWith(existing)).toBe(true);
    expect(result.updated_source_aliases_jsonl.endsWith("\n")).toBe(true);
    expect(result.updated_source_aliases_jsonl).toContain('"status":"candidate"');
    expect(result.updated_source_aliases_jsonl).not.toContain("provenance_source");
    expect(result.updated_source_aliases_jsonl).not.toContain('"status":"approved"\n{');
    const appendedOnly = result.updated_source_aliases_jsonl.slice(existing.length);
    expect(appendedOnly).not.toContain('"reviewer"');
    expect(appendedOnly).not.toContain('"reviewed_at"');
    expect(result.report.reviewed_by).toBe("local_reviewer");
    expect(result.report.reviewed_at).toBe("2026-08-20T15:00:00.000Z");

    const again = buildGovernedAliasAppend({
      existing_source_aliases_jsonl: existing,
      accepted_candidates: [candidate()],
      ...snapshots(),
      options: options(),
    });
    expect(again.ok && again.updated_source_aliases_jsonl).toBe(
      result.updated_source_aliases_jsonl,
    );
  });

  it("skips exact duplicate existing and does not fail", () => {
    const existing = existingJsonl([
      existingLine({
        alias_id: "src_alias_existing_mains",
        alias_source_term: "mains",
        canonical_source_terms: ["main"],
        resolved_ir_ids: [IR_MAIN],
        evidence_ir_ids: [IR_MAIN],
      }),
    ]);
    const result = buildGovernedAliasAppend({
      existing_source_aliases_jsonl: existing,
      accepted_candidates: [candidate()],
      ...snapshots(),
      options: options(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appended_rows).toHaveLength(0);
    expect(result.skipped_rows.some((s) => s.reason === "exact_duplicate_existing")).toBe(
      true,
    );
    expect(result.updated_source_aliases_jsonl).toBe(existing);
  });

  it("fails batch on same alias different postings", () => {
    const existing = existingJsonl([
      existingLine({
        alias_id: "src_alias_existing_mains",
        alias_source_term: "mains",
        canonical_source_terms: ["main"],
        resolved_ir_ids: [IR_OTHER],
        evidence_ir_ids: [IR_OTHER],
      }),
    ]);
    const result = buildGovernedAliasAppend({
      existing_source_aliases_jsonl: existing,
      accepted_candidates: [candidate()],
      ...snapshots(),
      options: options(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === "alias_conflict")).toBe(true);
    expect(result).not.toHaveProperty("updated_source_aliases_jsonl");
  });

  it("fails on conflicting duplicates inside input; skips exact input duplicates", () => {
    const conflict = buildGovernedAliasAppend({
      existing_source_aliases_jsonl: existingJsonl(),
      accepted_candidates: [
        candidate(),
        candidate({
          alias_id: "src_alias_al1d4_mains_b",
          resolved_ir_ids: [IR_OTHER],
          evidence_ir_ids: [IR_OTHER],
        }),
      ],
      ...snapshots(),
      options: options(),
    });
    expect(conflict.ok).toBe(false);

    const dupOk = buildGovernedAliasAppend({
      existing_source_aliases_jsonl: existingJsonl(),
      accepted_candidates: [candidate(), candidate({ alias_id: "src_alias_al1d4_mains_dup" })],
      ...snapshots(),
      options: options(),
    });
    expect(dupOk.ok).toBe(true);
    if (!dupOk.ok) return;
    expect(dupOk.appended_rows).toHaveLength(1);
    expect(dupOk.skipped_rows.some((s) => s.reason === "exact_duplicate_input")).toBe(true);
  });

  it("fails on malformed existing JSONL, blank lines, bad candidate, bundle mismatch, langs", () => {
    expect(
      buildGovernedAliasAppend({
        existing_source_aliases_jsonl: "{not json}\n",
        accepted_candidates: [candidate()],
        ...snapshots(),
        options: options(),
      }).ok,
    ).toBe(false);

    expect(
      buildGovernedAliasAppend({
        existing_source_aliases_jsonl: `${existingLine()}\n\n`,
        accepted_candidates: [candidate()],
        ...snapshots(),
        options: options(),
      }).ok,
    ).toBe(false);

    expect(
      buildGovernedAliasAppend({
        existing_source_aliases_jsonl: existingJsonl(),
        accepted_candidates: [candidate({ source_bundle_id: "other_bundle" })],
        ...snapshots(),
        options: options(),
      }).ok,
    ).toBe(false);

    // Force EN by corrupting revalidation path: use decision conversion which sets fr.
    // Instead fail via missing IR / index conflict.
    expect(
      buildGovernedAliasAppend({
        existing_source_aliases_jsonl: existingJsonl(),
        accepted_candidates: [candidate({ resolved_ir_ids: ["missing"], evidence_ir_ids: ["missing"] })],
        ...snapshots(),
        options: options(),
      }).ok,
    ).toBe(false);

    // Primary key conflict: alias term already indexed with different postings
    expect(
      buildGovernedAliasAppend({
        existing_source_aliases_jsonl: existingJsonl(),
        accepted_candidates: [candidate()],
        known_ir_ids: [IR_MAIN, IR_OTHER],
        index_rows: [
          { key_type: "src_casefold", key: "main", ir_ids: [IR_MAIN] },
          { key_type: "src_casefold", key: "oeil", ir_ids: [IR_OTHER] },
          { key_type: "src_casefold", key: "mains", ir_ids: [IR_OTHER] },
        ],
        options: options(),
      }).ok,
    ).toBe(false);
  });

  it("all-or-nothing: one bad candidate prevents all appends", () => {
    const good = candidate();
    const bad = candidate({
      alias_id: "src_alias_al1d4_bad",
      alias_source_term: "bonjours",
      canonical_source_terms: ["bonjour"],
      resolved_ir_ids: [IR_MAIN],
      evidence_ir_ids: [IR_MAIN],
    });
    const result = buildGovernedAliasAppend({
      existing_source_aliases_jsonl: existingJsonl(),
      accepted_candidates: [good, bad],
      ...snapshots(),
      options: options(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.summary.appended_count).toBe(0);
  });

  it("does not mutate inputs and performs no writes", () => {
    const existing = existingJsonl();
    const existingCopy = existing;
    const cand = candidate();
    const snap = structuredClone(cand);
    const result = buildGovernedAliasAppend({
      existing_source_aliases_jsonl: existing,
      accepted_candidates: [cand],
      ...snapshots(),
      options: options(),
    });
    expect(result.writes_performed).toBe(false);
    expect(existing).toBe(existingCopy);
    expect(cand).toEqual(snap);
    expect(splitSourceAliasJsonlRawLines(existing).ok).toBe(true);
  });

  it("rejects Cyrillic/N’Ko alias strings and unresolved EN-like candidates", () => {
    expect(
      buildGovernedAliasAppend({
        existing_source_aliases_jsonl: existingJsonl(),
        accepted_candidates: [
          candidate({
            alias_id: "src_alias_ru",
            alias_source_term: "привет",
            canonical_source_terms: ["main"],
          }),
        ],
        ...snapshots(),
        options: options(),
      }).ok,
    ).toBe(false);

    expect(
      buildGovernedAliasAppend({
        existing_source_aliases_jsonl: existingJsonl(),
        accepted_candidates: [
          candidate({
            alias_id: "src_alias_nko",
            alias_source_term: "ߒߞߏ",
            canonical_source_terms: ["main"],
          }),
        ],
        ...snapshots(),
        options: options(),
      }).ok,
    ).toBe(false);

    expect(
      buildGovernedAliasAppend({
        existing_source_aliases_jsonl: existingJsonl(),
        accepted_candidates: [
          candidate({
            alias_id: "src_alias_houses",
            alias_source_term: "houses",
            canonical_source_terms: ["house"],
            resolved_ir_ids: [IR_MAIN],
            evidence_ir_ids: [IR_MAIN],
          }),
        ],
        ...snapshots(),
        options: options(),
      }).ok,
    ).toBe(false);
  });
});
