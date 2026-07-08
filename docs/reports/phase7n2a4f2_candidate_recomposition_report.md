# Phase 7N2A4F2 — Candidate Recomposition Rerun Report

## Rerun reason

The first 4F2 attempt stopped at source-alias validation because the previous
alias contract could not express the approved narrow maman -> generic mère
posting during canonical recomposition.

Phase 7N2A4D-R repaired the alias contract.

This 4F2 run is a clean recomposition after that repair.

## Commit-independent authoritative input set

- `data/ir/malipense_lexicon_v3.jsonl`
- `data/ir/malipense_index_v1.jsonl`
- `data/ir/siralex_owner_lexical_v1.jsonl`
- `shared/target_variants/reviewed_target_variants_v1.jsonl`
- `shared/aliases/source_aliases_v1.jsonl`
- `shared/source_index_supplements/source_index_supplements_v1.jsonl`
- `shared/search_regression/search_regression_matrix_v1.jsonl`
- `shared/search_regression/matrix_manifest_v1.json`
- `shared/search_regression/search_regression_matrix_7n2a_v1.jsonl`
- `shared/search_regression/matrix_manifest_7n2a_v1.json`

## Workspace and output paths

- Rerun workspace: `/tmp/phase7n2a4f2_rerun/`
- Candidate bundle dir:
  `/tmp/phase7n2a4f2_rerun/bundle_full_20260708_ee2a6ab0`
- Bundle manifest:
  `/tmp/phase7n2a4f2_rerun/bundle_full_20260708_ee2a6ab0/bundle.manifest.json`

## Exact commands run

### Stage 0 preflight tracked-input validation

```bash
PYTHONPATH=api:shared python3 -c "from pathlib import Path; from target_variants.overlay import load_reviewed_target_variant_overlay, validate_overlay_against_ir; import json; ir_paths=[Path('data/ir/malipense_lexicon_v3.jsonl'),Path('data/ir/malipense_index_v1.jsonl'),Path('data/ir/siralex_owner_lexical_v1.jsonl')]; ir_rows=[]; [ir_rows.extend(json.loads(line) for line in p.read_text(encoding='utf-8').splitlines() if line.strip()) for p in ir_paths]; overlay=load_reviewed_target_variant_overlay(Path('shared/target_variants/reviewed_target_variants_v1.jsonl')); validate_overlay_against_ir(overlay, ir_rows); print('OK overlay row_count=', overlay.row_count, 'approved_row_count=', overlay.approved_row_count, 'ir_rows=', len(ir_rows))"

PYTHONPATH=api:shared python3 -m source_aliases.validate_alias_table \
  --aliases shared/aliases/source_aliases_v1.jsonl \
  --records web/public/bundle_full_20260616_phase7j_alias_round2_candidate/records.jsonl \
  --search-index web/public/bundle_full_20260616_phase7j_alias_round2_candidate/search_index.jsonl \
  --output-report /tmp/phase7n2a4f2_rerun/stage0_source_alias_validate_report.json

PYTHONPATH=api:shared python3 -m source_index_supplements.validate_supplements \
  --supplements shared/source_index_supplements/source_index_supplements_v1.jsonl \
  --records /tmp/phase7n2a4d_r/records_enriched.jsonl \
  --search-index /tmp/phase7n2a4d_r/search_index_alias.jsonl \
  --owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl \
  --defer-index-conflicts \
  --output-report /tmp/phase7n2a4f2_rerun/stage0_source_supplement_validate_report.json

PYTHONPATH=api:shared python3 -c "from search_regression.schema import load_matrix_jsonl, load_matrix_manifest; from search_regression.validate_matrix import validate_matrix; m=load_matrix_manifest('shared/search_regression/matrix_manifest_v1.json'); c=load_matrix_jsonl('shared/search_regression/search_regression_matrix_v1.jsonl'); e=validate_matrix(c,m); print('7L matrix rows=', len(c), 'errors=', len(e)); [print(str(x)) for x in e]"
PYTHONPATH=api:shared python3 -c "from search_regression.schema import load_matrix_jsonl, load_matrix_manifest; from search_regression.validate_matrix import validate_matrix; m=load_matrix_manifest('shared/search_regression/matrix_manifest_7n2a_v1.json'); c=load_matrix_jsonl('shared/search_regression/search_regression_matrix_7n2a_v1.jsonl'); e=validate_matrix(c,m); print('7N2A matrix rows=', len(c), 'errors=', len(e)); [print(str(x)) for x in e]"
```

### Stage 1 normalize

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --input data/ir/siralex_owner_lexical_v1.jsonl \
  --target-variant-overlay shared/target_variants/reviewed_target_variants_v1.jsonl \
  --output /tmp/phase7n2a4f2_rerun/normalized_7n2a.jsonl \
  -v
```

### Stage 2 enrich

```bash
PYTHONPATH=api:shared python3 -m enrichment.cli \
  --normalized /tmp/phase7n2a4f2_rerun/normalized_7n2a.jsonl \
  --ir data/ir/malipense_lexicon_v3.jsonl \
  --ir data/ir/malipense_index_v1.jsonl \
  --ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/phase7n2a4f2_rerun/records_enriched_7n2a.jsonl \
  -v
```

### Stage 3 base search index

```bash
PYTHONPATH=api:shared python3 -m search_index.cli \
  --input /tmp/phase7n2a4f2_rerun/records_enriched_7n2a.jsonl \
  --output /tmp/phase7n2a4f2_rerun/search_index_base_7n2a.jsonl \
  --verbose
```

### Stage 4 alias validate/apply

```bash
PYTHONPATH=api:shared python3 -m source_aliases.validate_alias_table \
  --aliases shared/aliases/source_aliases_v1.jsonl \
  --records /tmp/phase7n2a4f2_rerun/records_enriched_7n2a.jsonl \
  --search-index /tmp/phase7n2a4f2_rerun/search_index_base_7n2a.jsonl \
  --output-report /tmp/phase7n2a4f2_rerun/source_alias_validate_report.json

PYTHONPATH=api:shared python3 -m source_aliases.apply_aliases_to_search_index \
  --aliases shared/aliases/source_aliases_v1.jsonl \
  --records /tmp/phase7n2a4f2_rerun/records_enriched_7n2a.jsonl \
  --search-index /tmp/phase7n2a4f2_rerun/search_index_base_7n2a.jsonl \
  --output-search-index /tmp/phase7n2a4f2_rerun/search_index_alias_7n2a.jsonl \
  --output-report /tmp/phase7n2a4f2_rerun/source_alias_apply_report.json
```

### Stage 5 supplements validate/generate

```bash
PYTHONPATH=api:shared python3 -m source_index_supplements.validate_supplements \
  --supplements shared/source_index_supplements/source_index_supplements_v1.jsonl \
  --records /tmp/phase7n2a4f2_rerun/records_enriched_7n2a.jsonl \
  --search-index /tmp/phase7n2a4f2_rerun/search_index_alias_7n2a.jsonl \
  --owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl \
  --defer-index-conflicts \
  --output-report /tmp/phase7n2a4f2_rerun/source_supplement_validate_report.json

PYTHONPATH=api:shared python3 -m source_index_supplements.generate_supplement_records \
  --supplements shared/source_index_supplements/source_index_supplements_v1.jsonl \
  --records /tmp/phase7n2a4f2_rerun/records_enriched_7n2a.jsonl \
  --search-index /tmp/phase7n2a4f2_rerun/search_index_alias_7n2a.jsonl \
  --owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output-records /tmp/phase7n2a4f2_rerun/records_with_supplements_7n2a.jsonl \
  --output-report /tmp/phase7n2a4f2_rerun/source_supplement_generate_report.json
```

### Stage 6 supplements merge

```bash
PYTHONPATH=api:shared python3 -m source_index_supplements.merge_supplements_into_search_index \
  --supplements shared/source_index_supplements/source_index_supplements_v1.jsonl \
  --records /tmp/phase7n2a4f2_rerun/records_enriched_7n2a.jsonl \
  --baseline-search-index /tmp/phase7n2a4f2_rerun/search_index_alias_7n2a.jsonl \
  --baseline-bundle-dir web/public/bundle_full_20260616_phase7j_alias_round2_candidate \
  --owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output-search-index /tmp/phase7n2a4f2_rerun/search_index_final_7n2a.jsonl \
  --output-report /tmp/phase7n2a4f2_rerun/source_supplement_merge_report.json
```

### Stage 7 bundle assembly (/tmp only)

```bash
PYTHONPATH=api:shared python3 -m bundle_builder.cli --verbose build \
  --normalized /tmp/phase7n2a4f2_rerun/records_with_supplements_7n2a.jsonl \
  --search-index /tmp/phase7n2a4f2_rerun/search_index_final_7n2a.jsonl \
  --output-dir /tmp/phase7n2a4f2_rerun \
  --bundle-type full
```

### Stage 8 temporary candidate manifests

- `/tmp/phase7n2a4f2_rerun/matrix_manifest_7n2a_candidate.json`
- `/tmp/phase7n2a4f2_rerun/matrix_manifest_7l_candidate.json`

Both set to measured candidate `bundle_id`, `search_index_sha256`,
`bundle_content_sha256`, and `norm_version`.

### Stage 9 replay gates

Initial replay attempts with tracked matrices failed due per-row `bundle_id`
mismatch against candidate bundle identity.

Temporary candidate matrix copies were required and created under `/tmp` only:

- `/tmp/phase7n2a4f2_rerun/search_regression_matrix_7l_candidate.jsonl`
- `/tmp/phase7n2a4f2_rerun/search_regression_matrix_7n2a_candidate.jsonl`

Each row copied from tracked matrix with only `bundle_id` rewritten to candidate
bundle id.

```bash
python3 scripts/run_search_regression.py \
  --matrix /tmp/phase7n2a4f2_rerun/search_regression_matrix_7l_candidate.jsonl \
  --manifest /tmp/phase7n2a4f2_rerun/matrix_manifest_7l_candidate.json \
  --bundle /tmp/phase7n2a4f2_rerun/bundle_full_20260708_ee2a6ab0 \
  --output /tmp/phase7n2a4f2_rerun/7l_replay_report.json

python3 scripts/run_search_regression.py \
  --matrix /tmp/phase7n2a4f2_rerun/search_regression_matrix_7n2a_candidate.jsonl \
  --manifest /tmp/phase7n2a4f2_rerun/matrix_manifest_7n2a_candidate.json \
  --bundle /tmp/phase7n2a4f2_rerun/bundle_full_20260708_ee2a6ab0 \
  --output /tmp/phase7n2a4f2_rerun/7n2a_replay_report.json
```

## Candidate identity, hashes, and counts

- Candidate bundle_id: `bundle_full_20260708_ee2a6ab0`
- Candidate content SHA-256: `sha256:ee2a6ab08404763be31b1faf6383d4d503a02d4ed240b32d3da7acef63477109`
- Candidate records SHA-256: `sha256:9b5ebeb4b0f407c394258a4110d29562aa45718f682093986864be81dd1b8225`
- Candidate search_index SHA-256: `sha256:4f83bb80d77a491e73e62f4ce1f4a985e4a234550fd1e93f12ccca5eead2b93d`
- Bundle manifest path:
  `/tmp/phase7n2a4f2_rerun/bundle_full_20260708_ee2a6ab0/bundle.manifest.json`

Row/key counts:

- normalized rows: `19326`
- enriched rows: `19326`
- records with supplements rows: `19333`
- search index base rows: `112149`
- search index alias rows: `112237`
- search index final rows: `112257`

## Required file SHA-256 values

- `normalized_7n2a.jsonl`: `sha256:e63fd1c3a63bf08798c293434e340fdf7a9471da83c9efc706c50dd8859503a7`
- `records_enriched_7n2a.jsonl`: `sha256:ae980acd52ec7c80e02ee2eb5a0d4eff9d2136e02417ea84556fb22b9c4f37e5`
- `records_with_supplements_7n2a.jsonl`: `sha256:9b5ebeb4b0f407c394258a4110d29562aa45718f682093986864be81dd1b8225`
- `search_index_base_7n2a.jsonl`: `sha256:a3ceffdfd053f08302a16f3d92a9c4cd5ab8e2e8472f5aa932a2b255d1ebde93`
- `search_index_alias_7n2a.jsonl`: `sha256:23c830cfa177298f0b9cf1333fc4c4df79dc6657e002eb50042328cd4daa6d30`
- `search_index_final_7n2a.jsonl`: `sha256:4f83bb80d77a491e73e62f4ce1f4a985e4a234550fd1e93f12ccca5eead2b93d`

## 7N2A delta and boundary proofs

Stage 1/3 proofs:

- normalized includes `a9c7d82decee9191` and `fefe9b063e05ed11`.
- `móbaa` target key resolves to canonical `c5f78c8ac66eac6b`.
- preferred form stays `móyibaa`; no record preferred form `móbaa`; no new IR id
  for `móbaa`.

Stage 4 proofs:

- `maman` posting after alias apply: `["e5164efcdf5e6ca4"]`.
- `maman` excludes `0f517a71c373f51d` and `d540716db9321a83`.
- `mère` unchanged across alias stage:
  - before alias:
    `["d540716db9321a83", "e5164efcdf5e6ca4", "0f517a71c373f51d"]`
  - after alias:
    `["d540716db9321a83", "e5164efcdf5e6ca4", "0f517a71c373f51d"]`

Stage 5 proofs:

- generation report includes owner pointers:
  - `siralex://lexical-review/7n2a/ndandayoro` / `7n2a_ndandayoro_v1`
  - `siralex://lexical-review/7n2a/ndandadiya` / `7n2a_ndandadiya_v1`
- `owner_lexical_input` present in generation report.
- `owner_reviewed_target_ids` contains:
  `a9c7d82decee9191`, `fefe9b063e05ed11`.
- synthetic evidence ids absent:
  - `7e95a0d4f7f80731`
  - `1ed4f7a94fdba41f`

Stage 6 final source postings (source-index mapping IDs and resolved target IDs):

- `maman`
  - mapping IDs: `["e5164efcdf5e6ca4"]`
- `móbaa`
  - target lookup IDs: `["c5f78c8ac66eac6b"]`
- `hôpital`
  - mapping IDs: `["61843e6630c1fbae", "ff4ee495ef997adf"]`
  - resolved target IDs: `["71e323e2dafa590f", "a9c7d82decee9191", "fefe9b063e05ed11"]`
- `clinique`
  - mapping IDs: `["ff42659295a657dc"]`
  - resolved target IDs: `["a9c7d82decee9191", "fefe9b063e05ed11"]`
- `centre de santé`
  - mapping IDs: `["ffb73938da1a4576"]`
  - resolved target IDs: `["a9c7d82decee9191", "fefe9b063e05ed11"]`
- `place`
  - mapping IDs: `["96b72ff71179d689"]`
  - resolved target IDs:
    `["d426e49d1e2ab3d9", "0ad25bf55eea0592", "de6fb406453616e3", "149b99f308c0e1f9", "993dcc2443a987eb"]`
  - includes `de6fb406453616e3`
  - excludes health IDs `a9c7d82decee9191`, `fefe9b063e05ed11`
- `location`
  - mapping IDs: `[]` (absent)
- `yoro`
  - mapping IDs: `[]` (absent)

Duplicate safety:

- duplicate index key: none
- duplicate posting IDs in any row: none
- duplicate `ir_id` in enriched rows: none

## Regression replay results

7L replay (`/tmp/phase7n2a4f2_rerun/7l_replay_report.json`):

- matrix cases: `13`
- passed: `10`
- failed: `3`
- failed cases:
  - `sr7l_004_mere_multi` (ordering mismatch)
  - `sr7l_012_kun_accent_ambiguity` (ordering mismatch)
  - `sr7l_013_kun_decomposed_unicode` (ordering mismatch)

7N2A additive replay (`/tmp/phase7n2a4f2_rerun/7n2a_replay_report.json`):

- matrix cases: `8`
- passed: `5`
- failed: `3`
- failed cases:
  - `7n2a_hopital_health_order`
  - `7n2a_clinique_health_only`
  - `7n2a_centre_de_sante_health_only`

The additive failures arise from matrix expectations being expressed as resolved
target lexicon IDs while replay currently compares direct source-index posting
IDs (mapping record IDs).

## Temporary manifest/matrix rewrite status

- Temporary candidate manifests were required: **yes** (`/tmp` only).
- Temporary candidate matrix copies were required: **yes** (`/tmp` only), to
  satisfy per-row `bundle_id == manifest.bundle_id` validation.
- Tracked matrix/manifest artifacts remained unchanged.

## Production/runtime artifact safety

- Candidate bundle was generated under `/tmp` only.
- No `web/public` bundle directory was modified.
- No catalog pointer update was performed.
- No package generation was performed.
- No runtime code path outside this report was changed.

The candidate bundle was generated under /tmp only.

No catalog pointer, production bundle directory, package artifact, or runtime code
was changed.
