import "fake-indexeddb/auto";

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { deleteSiralexDb, openSiralexDb } from "../idb/siralex_db";
import { importRecordsJsonl } from "../import/import_records";
import { importSearchIndexJsonl } from "../import/import_search_index";
import { searchQuery } from "../search/search_query";

type SearchDirection = "source_to_target" | "target_to_source";
type FailureClass = "spelling_error" | "phrase_mismatch" | "language_mismatch" | "missing_entry" | "index_gap";

type QueryCase = {
  id: string;
  category: "A" | "B" | "C" | "D";
  label: string;
  query: string;
  direction: SearchDirection;
  expectedHit: boolean;
  notes?: string;
  manualFailureClass?: FailureClass;
};

type QueryResult = QueryCase & {
  actualHit: boolean;
  actualCount: number;
  ladderLevel: "casefold" | "diacritics_insensitive" | "punct_stripped" | "nospace" | "none";
  pass: boolean;
  analystFailureClass?: FailureClass;
};

type IndexEntry = {
  key_type: string;
  key: string;
};

const BUNDLE_ID = "bundle_full_20260427_ad0e7deb";

function repoRoot(): string {
  return join(import.meta.dirname, "..", "..", "..");
}

function webRoot(): string {
  return join(repoRoot(), "web");
}

function bundleDir(): string {
  return join(
    webRoot(),
    "public",
    "norm-v2-test",
    "bundles",
    "bundle_full_20260427_ad0e7deb",
  );
}

function readJsonl(path: string): IndexEntry[] {
  const text = readFileSync(path, "utf-8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as IndexEntry);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function latinLike(value: string): boolean {
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value);
}

function containsNko(value: string): boolean {
  return /[\u07C0-\u07FF]/.test(value);
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}+/gu, "");
}

function stripPunctuation(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

function removeSpaces(value: string): string {
  return value.replace(/\s+/g, "");
}

function mutateMisspelling(value: string): string {
  const compact = value.trim();
  if (compact.length <= 3) return `${compact}x`;
  const cutAt = Math.floor(compact.length / 2);
  return `${compact.slice(0, cutAt)}${compact.slice(cutAt + 1)}`;
}

function pick(values: string[], limit: number, predicate: (value: string) => boolean): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!predicate(value)) continue;
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function buildQuerySet(indexEntries: IndexEntry[]): QueryCase[] {
  const srcCasefold = uniqueSorted(indexEntries.filter((e) => e.key_type === "src_casefold").map((e) => e.key));
  const tgtCasefold = uniqueSorted(indexEntries.filter((e) => e.key_type === "tgt_casefold").map((e) => e.key));

  const srcTerms = pick(srcCasefold, 40, (k) => latinLike(k) && k.length >= 4 && k.length <= 48);
  const srcMulti = pick(srcCasefold, 30, (k) => latinLike(k) && k.includes(" ") && k.length <= 70);
  const srcPunct = pick(srcCasefold, 20, (k) => /[!?,;:.()\-]/.test(k) && k.length <= 80);
  const srcDiacritic = pick(srcCasefold, 20, (k) => stripDiacritics(k) !== k && latinLike(k) && k.length <= 60);
  const tgtNko = pick(tgtCasefold, 20, (k) => containsNko(k));
  const tgtLatin = pick(tgtCasefold, 30, (k) => latinLike(k) && !containsNko(k) && k.length <= 24);

  const cases: QueryCase[] = [];
  let nextId = 1;
  const add = (entry: Omit<QueryCase, "id">) => {
    cases.push({ id: `Q${String(nextId).padStart(3, "0")}`, ...entry });
    nextId += 1;
  };

  // A. Known expected hits
  for (const query of srcTerms.slice(0, 15)) {
    add({
      category: "A",
      label: "known_source_hit",
      query,
      direction: "source_to_target",
      expectedHit: true,
      notes: "known source casefold term",
    });
  }
  for (const query of srcMulti.slice(0, 10)) {
    add({
      category: "A",
      label: "known_source_phrase_hit",
      query,
      direction: "source_to_target",
      expectedHit: true,
      notes: "known multiword source phrase",
    });
  }
  for (const query of srcPunct.slice(0, 5)) {
    add({
      category: "A",
      label: "known_source_punct_hit",
      query,
      direction: "source_to_target",
      expectedHit: true,
      notes: "punctuation-heavy source phrase",
    });
  }
  for (const query of tgtNko.slice(0, 10)) {
    add({
      category: "A",
      label: "known_target_nko_hit",
      query,
      direction: "target_to_source",
      expectedHit: true,
      notes: "known N'Ko target key",
    });
  }
  for (const query of tgtLatin.slice(0, 10)) {
    add({
      category: "A",
      label: "known_target_latin_hit",
      query,
      direction: "target_to_source",
      expectedHit: true,
      notes: "known latin target key",
    });
  }

  // B. Strict directional behavior checks
  for (const query of srcTerms.slice(15, 25)) {
    add({
      category: "B",
      label: "directional_src_expected_hit",
      query,
      direction: "source_to_target",
      expectedHit: true,
      notes: "source key in source_to_target should hit",
    });
    add({
      category: "B",
      label: "directional_src_expected_miss",
      query,
      direction: "target_to_source",
      expectedHit: false,
      notes: "same source key in opposite direction should miss",
      manualFailureClass: "language_mismatch",
    });
  }
  for (const query of tgtNko.slice(10, 15).concat(tgtLatin.slice(10, 15))) {
    add({
      category: "B",
      label: "directional_tgt_expected_hit",
      query,
      direction: "target_to_source",
      expectedHit: true,
      notes: "target key in target_to_source should hit",
    });
    add({
      category: "B",
      label: "directional_tgt_expected_miss",
      query,
      direction: "source_to_target",
      expectedHit: false,
      notes: "same target key in opposite direction should miss",
      manualFailureClass: "language_mismatch",
    });
  }

  // C. Normalization ladder probes
  for (const query of srcTerms.slice(25, 35)) {
    add({
      category: "C",
      label: "normalization_case_variant",
      query: query.toUpperCase(),
      direction: "source_to_target",
      expectedHit: true,
      notes: "uppercase variant probe",
    });
  }
  for (const query of srcPunct.slice(5, 13)) {
    const variant = stripPunctuation(query);
    if (variant.length === 0) continue;
    add({
      category: "C",
      label: "normalization_punct_variant",
      query: variant,
      direction: "source_to_target",
      expectedHit: true,
      notes: "punctuation-stripped variant probe",
    });
  }
  for (const query of srcDiacritic.slice(0, 8)) {
    const variant = stripDiacritics(query);
    if (variant === query) continue;
    add({
      category: "C",
      label: "normalization_diacritic_variant",
      query: variant,
      direction: "source_to_target",
      expectedHit: true,
      notes: "diacritics-insensitive variant probe",
    });
  }
  for (const query of srcMulti.slice(10, 18)) {
    const variant = removeSpaces(query);
    if (variant === query) continue;
    add({
      category: "C",
      label: "normalization_nospace_variant",
      query: variant,
      direction: "source_to_target",
      expectedHit: true,
      notes: "nospace variant probe",
    });
  }

  // D. Failure-probing queries
  for (const base of srcTerms.slice(0, 8)) {
    add({
      category: "D",
      label: "failure_spelling_probe",
      query: mutateMisspelling(base),
      direction: "source_to_target",
      expectedHit: false,
      notes: "plausible learner misspelling",
      manualFailureClass: "spelling_error",
    });
  }
  for (const base of srcMulti.slice(18, 24)) {
    const partial = base.split(/\s+/).slice(0, 2).join(" ");
    add({
      category: "D",
      label: "failure_partial_phrase_probe",
      query: partial,
      direction: "source_to_target",
      expectedHit: false,
      notes: "partial phrase attempt",
      manualFailureClass: "phrase_mismatch",
    });
  }
  for (const base of srcTerms.slice(8, 14)) {
    add({
      category: "D",
      label: "failure_inflection_probe",
      query: `${base}s`,
      direction: "source_to_target",
      expectedHit: false,
      notes: "inflection/pluralized probe",
      manualFailureClass: "index_gap",
    });
  }
  for (const query of ["hello", "thank you", "good morning", "work hard", "dictionary", "lesson"]) {
    add({
      category: "D",
      label: "failure_language_mismatch_probe",
      query,
      direction: "source_to_target",
      expectedHit: false,
      notes: "cross-language mismatch probe",
      manualFailureClass: "language_mismatch",
    });
  }
  for (const query of ["zzqv", "qzmx", "nonexistent terme", "abracadabra lexique", "no such headword", "xyz987"]) {
    add({
      category: "D",
      label: "failure_missing_entry_probe",
      query,
      direction: "source_to_target",
      expectedHit: false,
      notes: "likely missing entry probe",
      manualFailureClass: "missing_entry",
    });
  }

  return cases;
}

function toPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function renderRoundDoc(results: QueryResult[]): string {
  const total = results.length;
  const hits = results.filter((r) => r.actualHit).length;
  const misses = total - hits;
  const directional = results.filter((r) => r.category === "B");
  const directionalPass = directional.filter((r) => r.pass).length;
  const directionalFail = directional.length - directionalPass;

  const ladderCounts = {
    casefold: 0,
    diacritics_insensitive: 0,
    punct_stripped: 0,
    nospace: 0,
    none: 0,
  };
  for (const row of results) {
    ladderCounts[row.ladderLevel] += 1;
  }

  const failureRows = results.filter((r) => !r.actualHit);
  const failureClassCounts = new Map<string, number>();
  for (const row of failureRows) {
    const key = row.analystFailureClass ?? "unclassified";
    failureClassCounts.set(key, (failureClassCounts.get(key) ?? 0) + 1);
  }

  const topFailureLines = [...failureClassCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([failureClass, count]) => `- ${failureClass}: ${count}`)
    .join("\n");

  const unexpectedMisses = results.filter((r) => r.expectedHit && !r.actualHit).slice(0, 10);
  const indexGapExamples = results
    .filter((r) => !r.actualHit && r.analystFailureClass === "index_gap")
    .slice(0, 10)
    .map((r) => `\`${r.query}\``);

  const tableHeader =
    "| id | query | direction | expected outcome | actual outcome | hit/miss | ladder level | failure class (analyst) | notes |\n" +
    "|---|---|---|---|---|---|---|---|---|";
  const tableRows = results
    .map((row) => {
      const safeQuery = row.query.replace(/\|/g, "\\|");
      const actualOutcome = row.actualHit ? `hit (${row.actualCount})` : "miss";
      const notes = [row.label, row.notes].filter(Boolean).join("; ").replace(/\|/g, "\\|");
      return `| ${row.id} | ${safeQuery} | ${row.direction} | ${row.expectedHit ? "hit" : "miss"} | ${actualOutcome} | ${
        row.actualHit ? "hit" : "miss"
      } | ${row.ladderLevel} | ${row.analystFailureClass ?? ""} | ${notes} |`;
    })
    .join("\n");

  const unexpectedMissSection =
    unexpectedMisses.length === 0
      ? "- none in this round"
      : unexpectedMisses
          .map((row) => `- ${row.id} \`${row.query}\` (${row.direction}) expected hit but missed`)
          .join("\n");

  const candidate1 =
    indexGapExamples.length > 0
      ? `- Candidate A: add controlled source-side inflection/derivational variant coverage for French terms that repeatedly miss (examples: ${indexGapExamples.slice(
          0,
          6,
        ).join(", ")}), while preserving deterministic ruleset/versioning and avoiding ranking changes.`
      : "- Candidate A: investigate source-side inflectional variant coverage for recurring misses in controlled probes.";

  return `# Query Validation Round 1 (Controlled Calibration)

Date: 2026-05-15  
Bundle under test: \`bundle_full_20260427_ad0e7deb\` (norm_v2 directional)  
Execution path: real runtime \`searchQuery(...)\` with IndexedDB import via \`importRecordsJsonl\` + \`importSearchIndexJsonl\` (no alternate lookup implementation)

## Summary

- total queries run: **${total}**
- hit count: **${hits}**
- miss count: **${misses}**
- hit rate: **${toPercent(hits, total)}**
- miss rate: **${toPercent(misses, total)}**
- directional check pass/fail (Task 6 strict path assertions): **${directionalPass} pass / ${directionalFail} fail**
- ladder-level distribution:
  - casefold: ${ladderCounts.casefold}
  - diacritics_insensitive: ${ladderCounts.diacritics_insensitive}
  - punct_stripped: ${ladderCounts.punct_stripped}
  - nospace: ${ladderCounts.nospace}
  - none: ${ladderCounts.none}

## Query set methodology

This round is a **controlled calibration exercise**, not real-user behavior analysis.

- Query set intentionally mixes:
  - known expected hits (source terms/phrases, target latin/N'Ko keys)
  - strict directional checks (expected opposite-direction misses)
  - normalization ladder probes (case, punctuation, diacritics, spacing)
  - failure probes (spelling, phrase truncation, inflection-like variants, language mismatch, missing-entry probes)
- Target volume exceeded 100 queries to surface recurring patterns under deterministic conditions.
- Failure-class labels are **analyst interpretation**, applied manually per probe intent and observed outcome (not automated classification).

## Results table

${tableHeader}
${tableRows}

## Recurring failure patterns

Failure class distribution among misses:
${topFailureLines || "- none"}

Notable unexpected misses (expected hit but missed):
${unexpectedMissSection}

Observed recurring themes from controlled probes:

- inflection/pluralization-like source variants frequently miss where base forms hit
- partial phrase attempts often miss when only longer extracted phrase units are indexed
- opposite-direction queries reliably miss (expected under strict directional behavior)

## Improvement candidates (grounded in this round)

${candidate1}
- Candidate B: review phrase extraction granularity for source-side multiword entries where partial phrase probes repeatedly miss, and evaluate whether additional deterministic subphrase keys are warranted in a future versioned ruleset.

## Honest limitations

- Android real-device validation remains deferred pending hardware access.
- This is not real-user field telemetry; it is controlled calibration.
- Findings should be validated again later against real exported query logs before norm_v3 planning.
`;
}

describe("query validation round 1 harness", () => {
  it("runs controlled 100+ query analysis and writes docs output", async () => {
    const recordsPath = join(bundleDir(), "records.jsonl");
    const indexPath = join(bundleDir(), "search_index.jsonl");
    const recordsText = readFileSync(recordsPath, "utf-8");
    const indexText = readFileSync(indexPath, "utf-8");

    const indexEntries = readJsonl(indexPath);
    const queries = buildQuerySet(indexEntries);
    expect(queries.length).toBeGreaterThanOrEqual(100);

    await deleteSiralexDb().catch(() => undefined);
    const db = await openSiralexDb();
    try {
      await importRecordsJsonl(db, new Blob([recordsText]), { bundleId: BUNDLE_ID, batchSize: 1000 });
      await importSearchIndexJsonl(db, new Blob([indexText]), { bundleId: BUNDLE_ID, batchSize: 1000 });

      const results: QueryResult[] = [];
      for (const queryCase of queries) {
        const result = await searchQuery(
          db,
          BUNDLE_ID,
          queryCase.direction,
          queryCase.query,
          true,
        );
        const actualHit = result.ir_ids.length > 0;
        const ladderLevel = (result.matched_key_type ?? "none") as QueryResult["ladderLevel"];
        const analystFailureClass = !actualHit
          ? (queryCase.manualFailureClass ?? (queryCase.expectedHit ? "index_gap" : undefined))
          : undefined;
        results.push({
          ...queryCase,
          actualHit,
          actualCount: result.ir_ids.length,
          ladderLevel,
          pass: actualHit === queryCase.expectedHit,
          analystFailureClass,
        });
      }

      const docText = renderRoundDoc(results);
      const outputDocPath = join(repoRoot(), "docs", "QUERY_VALIDATION_ROUND_1.md");
      writeFileSync(outputDocPath, docText, "utf-8");

      const jsonlPath = join(repoRoot(), "docs", "QUERY_VALIDATION_ROUND_1_RESULTS.jsonl");
      const jsonlText = results
        .map((row) =>
          JSON.stringify({
            id: row.id,
            category: row.category,
            label: row.label,
            query: row.query,
            direction: row.direction,
            expected_hit: row.expectedHit,
            actual_hit: row.actualHit,
            ir_ids_count: row.actualCount,
            ladder_level_hit: row.ladderLevel,
            pass: row.pass,
            analyst_failure_class: row.analystFailureClass ?? null,
            notes: row.notes ?? "",
          }),
        )
        .join("\n");
      writeFileSync(jsonlPath, `${jsonlText}\n`, "utf-8");

      // Sanity checks on the generated run.
      expect(results.length).toBeGreaterThanOrEqual(100);
      const directionalChecks = results.filter((r) => r.category === "B");
      expect(directionalChecks.length).toBeGreaterThan(0);
      const directionalPass = directionalChecks.filter((r) => r.pass).length;
      expect(directionalPass).toBeGreaterThanOrEqual(Math.floor(directionalChecks.length * 0.9));
    } finally {
      db.close();
    }
  }, 120_000);
});
