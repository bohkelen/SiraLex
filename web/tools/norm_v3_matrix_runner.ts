/**
 * One-off validation: three-bundle query matrix (norm_v1 featured, norm_v2, norm_v3).
 * Run: cd web && npx vitest run -c vitest.tools.config.ts
 */
import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { deleteSiralexDb, openSiralexDb } from "../src/idb/siralex_db";
import { importRecordsJsonl } from "../src/import/import_records";
import { importSearchIndexJsonl } from "../src/import/import_search_index";
import { searchQuery } from "../src/search/search_query";

type SearchDirection = "source_to_target" | "target_to_source";

type QueryCase = {
  id: string;
  category: "A" | "B" | "C" | "D";
  label: string;
  query: string;
  direction: SearchDirection;
};

type IndexEntry = { key_type: string; key: string };

type BundleRow = {
  hit: boolean;
  ladder: string;
  count: number;
  ir_ids_ordered: string[];
  ir_ids_sorted: string[];
};

const webRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const BUNDLES = [
  {
    key: "norm_v1_featured",
    bundleId: "bundle_full_20260418_1dc526df",
    dir: join(webRoot, "public", "bundle_full_20260418_1dc526df"),
  },
  {
    key: "norm_v2_controlled",
    bundleId: "bundle_full_20260427_ad0e7deb",
    dir: join(webRoot, "public", "norm-v2-test", "bundles", "bundle_full_20260427_ad0e7deb"),
  },
  {
    key: "norm_v3_featured",
    bundleId: "bundle_full_20260518_15605571",
    dir: join(webRoot, "public", "bundle_full_20260518_15605571"),
  },
] as const;

function readJsonl(path: string): IndexEntry[] {
  const text = readFileSync(path, "utf-8");
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .map((l) => JSON.parse(l) as IndexEntry);
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

  for (const query of srcTerms.slice(0, 15)) {
    add({ category: "A", label: "known_source_hit", query, direction: "source_to_target" });
  }
  for (const query of srcMulti.slice(0, 10)) {
    add({ category: "A", label: "known_source_phrase_hit", query, direction: "source_to_target" });
  }
  for (const query of srcPunct.slice(0, 5)) {
    add({ category: "A", label: "known_source_punct_hit", query, direction: "source_to_target" });
  }
  for (const query of tgtNko.slice(0, 10)) {
    add({ category: "A", label: "known_target_nko_hit", query, direction: "target_to_source" });
  }
  for (const query of tgtLatin.slice(0, 10)) {
    add({ category: "A", label: "known_target_latin_hit", query, direction: "target_to_source" });
  }

  for (const query of srcTerms.slice(15, 25)) {
    add({ category: "B", label: "directional_src_expected_hit", query, direction: "source_to_target" });
    add({ category: "B", label: "directional_src_expected_miss", query, direction: "target_to_source" });
  }
  for (const query of tgtNko.slice(10, 15).concat(tgtLatin.slice(10, 15))) {
    add({ category: "B", label: "directional_tgt_expected_hit", query, direction: "target_to_source" });
    add({ category: "B", label: "directional_tgt_expected_miss", query, direction: "source_to_target" });
  }

  for (const query of srcTerms.slice(25, 35)) {
    add({
      category: "C",
      label: "normalization_case_variant",
      query: query.toUpperCase(),
      direction: "source_to_target",
    });
  }
  for (const query of srcPunct.slice(5, 13)) {
    const variant = stripPunctuation(query);
    if (variant.length === 0) continue;
    add({ category: "C", label: "normalization_punct_variant", query: variant, direction: "source_to_target" });
  }
  for (const query of srcDiacritic.slice(0, 8)) {
    const variant = stripDiacritics(query);
    if (variant === query) continue;
    add({
      category: "C",
      label: "normalization_diacritic_variant",
      query: variant,
      direction: "source_to_target",
    });
  }
  for (const query of srcMulti.slice(10, 18)) {
    const variant = removeSpaces(query);
    if (variant === query) continue;
    add({ category: "C", label: "normalization_nospace_variant", query: variant, direction: "source_to_target" });
  }

  for (const base of srcTerms.slice(0, 8)) {
    add({
      category: "D",
      label: "failure_spelling_probe",
      query: mutateMisspelling(base),
      direction: "source_to_target",
    });
  }
  for (const base of srcMulti.slice(18, 24)) {
    const partial = base.split(/\s+/).slice(0, 2).join(" ");
    add({ category: "D", label: "failure_partial_phrase_probe", query: partial, direction: "source_to_target" });
  }
  for (const base of srcTerms.slice(8, 14)) {
    add({ category: "D", label: "failure_inflection_probe", query: `${base}s`, direction: "source_to_target" });
  }
  for (const query of ["hello", "thank you", "good morning", "work hard", "dictionary", "lesson"]) {
    add({ category: "D", label: "failure_language_mismatch_probe", query, direction: "source_to_target" });
  }
  for (const query of ["zzqv", "qzmx", "nonexistent terme", "abracadabra lexique", "no such headword", "xyz987"]) {
    add({ category: "D", label: "failure_missing_entry_probe", query, direction: "source_to_target" });
  }

  return cases;
}

/** Input is NFC-sensitive if user typed non-NFC sequence or literal combining marks. */
function isNfcInputSensitive(query: string): boolean {
  const t = query.trim();
  if (t !== t.normalize("NFC")) return true;
  if (/[\u0300-\u036F]/.test(t)) return true;
  return false;
}

async function runMatrix(): Promise<Record<string, unknown>> {
  const v3IndexPath = join(BUNDLES[2].dir, "search_index.jsonl");
  const queries = buildQuerySet(readJsonl(v3IndexPath));
  console.log(JSON.stringify({ queryCount: queries.length }, null, 0));

  const byBundle: Record<string, Map<string, BundleRow>> = {};
  for (const b of BUNDLES) {
    await deleteSiralexDb().catch(() => undefined);
    const db = await openSiralexDb();
    const recordsText = readFileSync(join(b.dir, "records.jsonl"), "utf-8");
    const indexText = readFileSync(join(b.dir, "search_index.jsonl"), "utf-8");
    await importRecordsJsonl(db, new Blob([recordsText]), { bundleId: b.bundleId, batchSize: 1000 });
    await importSearchIndexJsonl(db, new Blob([indexText]), { bundleId: b.bundleId, batchSize: 1000 });

    const m = new Map<string, BundleRow>();
    for (const qc of queries) {
      const qk = `${qc.id}\t${qc.direction}\t${qc.query}`;
      const result = await searchQuery(db, b.bundleId, qc.direction, qc.query, true);
      const ord = [...result.ir_ids];
      m.set(qk, {
        hit: ord.length > 0,
        ladder: result.matched_key_type ?? "none",
        count: ord.length,
        ir_ids_ordered: ord,
        ir_ids_sorted: [...ord].sort((a, c) => a.localeCompare(c)),
      });
    }
    db.close();
    byBundle[b.key] = m;
  }

  const v2m = byBundle.norm_v2_controlled;
  const v3m = byBundle.norm_v3_featured;
  const v1m = byBundle.norm_v1_featured;

  let strictOrderMismatch = 0;
  let strictFullMismatch = 0;
  const orderMismatchSamples: string[] = [];
  const fullMismatchDetails: string[] = [];
  let nfcBucketOrderIssue = 0;

  for (const qc of queries) {
    const qk = `${qc.id}\t${qc.direction}\t${qc.query}`;
    const r2 = v2m.get(qk)!;
    const r3 = v3m.get(qk)!;
    const nfcSens = isNfcInputSensitive(qc.query);

    if (r2.hit !== r3.hit || r2.ladder !== r3.ladder || r2.count !== r3.count) {
      strictFullMismatch += 1;
      if (fullMismatchDetails.length < 16) {
        fullMismatchDetails.push(
          `${qc.id} ${qc.direction} \`${qc.query}\` nfcInput=${nfcSens} v2 hit=${r2.hit} L=${r2.ladder} n=${r2.count} ids=${r2.ir_ids_ordered.join(",")} | v3 hit=${r3.hit} L=${r3.ladder} n=${r3.count} ids=${r3.ir_ids_ordered.join(",")}`,
        );
      }
      continue;
    }
    const sameSorted =
      r2.ir_ids_sorted.length === r3.ir_ids_sorted.length &&
      r2.ir_ids_sorted.every((v, i) => v === r3.ir_ids_sorted[i]);
    if (!sameSorted) {
      strictFullMismatch += 1;
      if (fullMismatchDetails.length < 16) {
        fullMismatchDetails.push(
          `${qc.id} ${qc.direction} \`${qc.query}\` SORTED_SET_DIFF nfcInput=${nfcSens} v2=[${r2.ir_ids_sorted.join(",")}] v3=[${r3.ir_ids_sorted.join(",")}]`,
        );
      }
      continue;
    }
    const sameOrdered = r2.ir_ids_ordered.length === r3.ir_ids_ordered.length && r2.ir_ids_ordered.every((v, i) => v === r3.ir_ids_ordered[i]);
    if (!sameOrdered) {
      if (nfcSens) nfcBucketOrderIssue += 1;
      else {
        strictOrderMismatch += 1;
        if (orderMismatchSamples.length < 8) {
          orderMismatchSamples.push(
            `${qc.id} ${qc.direction} \`${qc.query}\` v2=[${r2.ir_ids_ordered.join(",")}] v3=[${r3.ir_ids_ordered.join(",")}]`,
          );
        }
      }
    }
  }

  let v1_v3_hitLoss = 0;
  let v1_v3_hitGain = 0;
  let v1_v3_sameHitLadderOrder = 0;
  let v1_v3_sameHitOrderDiff = 0;
  const hitLossSamples: string[] = [];
  const hitGainSamples: string[] = [];
  const orderDiffSamples: string[] = [];

  for (const qc of queries) {
    const qk = `${qc.id}\t${qc.direction}\t${qc.query}`;
    const r1 = v1m.get(qk)!;
    const r3 = v3m.get(qk)!;
    if (r1.hit && !r3.hit) {
      v1_v3_hitLoss += 1;
      if (hitLossSamples.length < 12) hitLossSamples.push(`${qc.id} ${qc.direction} \`${qc.query}\``);
    }
    if (!r1.hit && r3.hit) {
      v1_v3_hitGain += 1;
      if (hitGainSamples.length < 12) hitGainSamples.push(`${qc.id} ${qc.direction} \`${qc.query}\``);
    }
    if (r1.hit && r3.hit) {
      if (r1.ladder === r3.ladder && r1.count === r3.count) {
        const sameOrd =
          r1.ir_ids_ordered.length === r3.ir_ids_ordered.length &&
          r1.ir_ids_ordered.every((v, i) => v === r3.ir_ids_ordered[i]);
        if (sameOrd) v1_v3_sameHitLadderOrder += 1;
        else {
          v1_v3_sameHitOrderDiff += 1;
          if (orderDiffSamples.length < 8) {
            orderDiffSamples.push(
              `${qc.id} \`${qc.query}\` L1=${r1.ladder} L3=${r3.ladder} o1=[${r1.ir_ids_ordered.join(",")}] o3=[${r3.ir_ids_ordered.join(",")}]`,
            );
          }
        }
      }
    }
  }

  // Targeted probes
  const targeted: Record<string, BundleRow> = {};
  const TARGET = [
    ["tête", "source_to_target"],
    ["Kùn", "target_to_source"],
    ["ku\u0300n", "target_to_source"],
    ["pied", "source_to_target"],
    ["Sen", "target_to_source"],
    ["Kun", "target_to_source"],
  ] as const;

  for (const b of BUNDLES) {
    await deleteSiralexDb().catch(() => undefined);
    const db = await openSiralexDb();
    const recordsText = readFileSync(join(b.dir, "records.jsonl"), "utf-8");
    const indexText = readFileSync(join(b.dir, "search_index.jsonl"), "utf-8");
    await importRecordsJsonl(db, new Blob([recordsText]), { bundleId: b.bundleId, batchSize: 1000 });
    await importSearchIndexJsonl(db, new Blob([indexText]), { bundleId: b.bundleId, batchSize: 1000 });
    for (const [q, dir] of TARGET) {
      const label = `${b.key} ${q} ${dir}`;
      const result = await searchQuery(db, b.bundleId, dir as SearchDirection, q, true);
      const ord = [...result.ir_ids];
      targeted[label] = {
        hit: ord.length > 0,
        ladder: result.matched_key_type ?? "none",
        count: ord.length,
        ir_ids_ordered: ord,
        ir_ids_sorted: [...ord].sort((a, c) => a.localeCompare(c)),
      };
    }
    db.close();
  }

  const summary = {
    norm2_vs_norm3: {
      queries: queries.length,
      strictHitLadderCountSetMismatch: strictFullMismatch,
      strictMismatchDetails: fullMismatchDetails,
      strictOrderMismatch_nonNfcInput: strictOrderMismatch,
      nfcInput_orderOnlyMismatch: nfcBucketOrderIssue,
      orderMismatchSamples,
    },
    norm1_vs_norm3: {
      hitLoss_v1_hit_v3_miss: v1_v3_hitLoss,
      hitGain_v1_miss_v3_hit: v1_v3_hitGain,
      bothHit_sameLadderCount_orderedIdentical: v1_v3_sameHitLadderOrder,
      bothHit_orderOrLadderDiffTracked: v1_v3_sameHitOrderDiff,
      hitLossSamples,
      hitGainSamples,
      orderDiffSamples,
    },
    targeted,
  };

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

export { runMatrix };
