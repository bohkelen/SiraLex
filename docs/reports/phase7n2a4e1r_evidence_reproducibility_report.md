# Phase 7N2A4E1-R Durable Health Supplement Evidence Reproducibility Report

## Scope

Phase 7N2A4E1-R repairs only the three approved health supplement rows so their
evidence is durable and reproducible from:

- tracked supplement table;
- tracked owner lexical IR;
- provisioned baseline bundle inputs.

No implementation code was changed in this slice.

## Evidence Repair Matrix

| Source term | Prior non-authoritative evidence IDs | Final authoritative evidence IDs | Supporting source terms | Validation result |
| ----------- | ------------------------------------ | -------------------------------- | ----------------------- | ----------------- |
| `hôpital` | `["7e95a0d4f7f80731","1ed4f7a94fdba41f"]` | `["61843e6630c1fbae","a9c7d82decee9191","fefe9b063e05ed11"]` | `["hôpital"]` | pass |
| `clinique` | `["7e95a0d4f7f80731","1ed4f7a94fdba41f"]` | `["a9c7d82decee9191","fefe9b063e05ed11"]` | `["clinique"]` | pass |
| `centre de santé` | `["7e95a0d4f7f80731","1ed4f7a94fdba41f"]` | `["a9c7d82decee9191","fefe9b063e05ed11"]` | `["centre de santé"]` | pass |

## Exact Corrected Rows

```json
{"schema_version": "source_index_supplement_v1", "supplement_table_version": "phase7d-round1", "supplement_id": "src_supp_phase7n2a_0001", "status": "approved", "source_lang": "fr", "source_term": "hôpital", "source_display_text": "hôpital", "target_ir_ids": ["a9c7d82decee9191", "fefe9b063e05ed11"], "target_forms": ["ndándayoro", "ndándadiya"], "target_notes": [{"target_ir_id": "a9c7d82decee9191", "target_form": "ndándayoro", "label": "hôpital", "note": "Owner-approved canonical health-institution record."}, {"target_ir_id": "fefe9b063e05ed11", "target_form": "ndándadiya", "label": "hôpital", "note": "Owner-approved canonical health-institution record."}], "candidate_type": "incomplete_source_mapping", "supplement_mode": "additive_source_mapping", "broad_mapping": false, "broad_mapping_rationale": "", "supporting_evidence_ir_ids": ["61843e6630c1fbae", "a9c7d82decee9191", "fefe9b063e05ed11"], "supporting_source_terms": ["hôpital"], "reviewer": "project owner / native-speaker linguistic authority", "reviewed_at": "2026-07-05", "rationale": "Approved additive health supplement: preserve frozen dándaso posting under hôpital and append the two owner-reviewed canonical health-institution records in reviewed order.", "source_bundle_id": "bundle_full_20260603_d0e4f812", "source_norm_version": "norm_v3"}
{"schema_version": "source_index_supplement_v1", "supplement_table_version": "phase7d-round1", "supplement_id": "src_supp_phase7n2a_0002", "status": "approved", "source_lang": "fr", "source_term": "clinique", "source_display_text": "clinique", "target_ir_ids": ["a9c7d82decee9191", "fefe9b063e05ed11"], "target_forms": ["ndándayoro", "ndándadiya"], "target_notes": [{"target_ir_id": "a9c7d82decee9191", "target_form": "ndándayoro", "label": "clinique", "note": "Owner-approved canonical health-institution record."}, {"target_ir_id": "fefe9b063e05ed11", "target_form": "ndándadiya", "label": "clinique", "note": "Owner-approved canonical health-institution record."}], "candidate_type": "missing_source_index_mapping", "supplement_mode": "new_source_mapping", "broad_mapping": false, "broad_mapping_rationale": "", "supporting_evidence_ir_ids": ["a9c7d82decee9191", "fefe9b063e05ed11"], "supporting_source_terms": ["clinique"], "reviewer": "project owner / native-speaker linguistic authority", "reviewed_at": "2026-07-05", "rationale": "Approved new health source mapping for clinique to the two owner-reviewed canonical health-institution records only.", "source_bundle_id": "bundle_full_20260603_d0e4f812", "source_norm_version": "norm_v3"}
{"schema_version": "source_index_supplement_v1", "supplement_table_version": "phase7d-round1", "supplement_id": "src_supp_phase7n2a_0003", "status": "approved", "source_lang": "fr", "source_term": "centre de santé", "source_display_text": "centre de santé", "target_ir_ids": ["a9c7d82decee9191", "fefe9b063e05ed11"], "target_forms": ["ndándayoro", "ndándadiya"], "target_notes": [{"target_ir_id": "a9c7d82decee9191", "target_form": "ndándayoro", "label": "centre de santé", "note": "Owner-approved canonical health-institution record."}, {"target_ir_id": "fefe9b063e05ed11", "target_form": "ndándadiya", "label": "centre de santé", "note": "Owner-approved canonical health-institution record."}], "candidate_type": "missing_source_index_mapping", "supplement_mode": "new_source_mapping", "broad_mapping": false, "broad_mapping_rationale": "", "supporting_evidence_ir_ids": ["a9c7d82decee9191", "fefe9b063e05ed11"], "supporting_source_terms": ["centre de santé"], "reviewer": "project owner / native-speaker linguistic authority", "reviewed_at": "2026-07-05", "rationale": "Approved new health source mapping for centre de santé to the two owner-reviewed canonical health-institution records only.", "source_bundle_id": "bundle_full_20260603_d0e4f812", "source_norm_version": "norm_v3"}
```

## Supplement Table Digest

- `shared/source_index_supplements/source_index_supplements_v1.jsonl`
- SHA-256: `b8d2fae4e1766114563951c4b284f539678d33589a4abdf5988b09be8be8c949`

## Durable Input Assembly and Counts

Temporary work directory:

- `/tmp/phase7n2a4e1r`

Durable assembly method:

- baseline records: `web/public/bundle_full_20260606_6b8b401a/records.jsonl`
- owner enriched records: `/tmp/phase7n2a4e1r/owner_enriched.jsonl`
- combined output: `/tmp/phase7n2a4e1r/records_augmented.jsonl`

Measured counts:

- baseline record count: `19328`
- owner enriched record count: `2`
- combined record count: `19330`
- duplicate `ir_id` count: `0`

## Exact Commands

### Step 1 — Owner normalized output

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/phase7n2a4e1r/owner_normalized.jsonl \
  -v
```

### Step 2 — Owner enriched output

```bash
PYTHONPATH=api:shared python3 -m enrichment.cli \
  --normalized /tmp/phase7n2a4e1r/owner_normalized.jsonl \
  --ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/phase7n2a4e1r/owner_enriched.jsonl \
  -v
```

### Step 3 — Durable augmented records assembly

```bash
python3 - <<'PY'
import json
from pathlib import Path

base_path = Path('web/public/bundle_full_20260606_6b8b401a/records.jsonl')
owner_path = Path('/tmp/phase7n2a4e1r/owner_enriched.jsonl')
out_path = Path('/tmp/phase7n2a4e1r/records_augmented.jsonl')

def read_jsonl(path):
    rows = []
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows

base_rows = read_jsonl(base_path)
owner_rows = read_jsonl(owner_path)
combined = [*base_rows, *owner_rows]
seen = set()
duplicate_count = 0
for row in combined:
    ir_id = row.get('ir_id')
    if isinstance(ir_id, str):
        if ir_id in seen:
            duplicate_count += 1
        seen.add(ir_id)

print('baseline_record_count', len(base_rows))
print('owner_enriched_record_count', len(owner_rows))
print('combined_record_count', len(combined))
print('duplicate_ir_id_count', duplicate_count)

if duplicate_count != 0:
    raise SystemExit('Duplicate ir_id detected in augmented records assembly')

with out_path.open('w', encoding='utf-8') as handle:
    for row in combined:
        handle.write(json.dumps(row, ensure_ascii=False) + '\n')
PY
```

### Step 4 — Validate, generate, merge

```bash
PYTHONPATH=api:shared python3 -m source_index_supplements.validate_supplements \
  --supplements shared/source_index_supplements/source_index_supplements_v1.jsonl \
  --records /tmp/phase7n2a4e1r/records_augmented.jsonl \
  --search-index web/public/bundle_full_20260606_6b8b401a/search_index.jsonl \
  --owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl \
  --defer-index-conflicts \
  --output-report /tmp/phase7n2a4e1r/validate_report.json

PYTHONPATH=api:shared python3 -m source_index_supplements.generate_supplement_records \
  --supplements shared/source_index_supplements/source_index_supplements_v1.jsonl \
  --records /tmp/phase7n2a4e1r/records_augmented.jsonl \
  --search-index web/public/bundle_full_20260606_6b8b401a/search_index.jsonl \
  --owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output-records /tmp/phase7n2a4e1r/records_with_supplements.jsonl \
  --output-report /tmp/phase7n2a4e1r/generate_report.json

PYTHONPATH=api:shared python3 -m source_index_supplements.merge_supplements_into_search_index \
  --supplements shared/source_index_supplements/source_index_supplements_v1.jsonl \
  --records /tmp/phase7n2a4e1r/records_augmented.jsonl \
  --baseline-search-index web/public/bundle_full_20260606_6b8b401a/search_index.jsonl \
  --baseline-bundle-dir web/public/bundle_full_20260606_6b8b401a \
  --owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output-search-index /tmp/phase7n2a4e1r/search_index_merged.jsonl \
  --output-report /tmp/phase7n2a4e1r/merge_report.json
```

## Durable Evidence Resolution Proof

All `supporting_evidence_ir_ids` on:

- `src_supp_phase7n2a_0001`
- `src_supp_phase7n2a_0002`
- `src_supp_phase7n2a_0003`

resolve in `/tmp/phase7n2a4e1r/records_augmented.jsonl` with no missing IDs.

Prohibited synthetic IDs are absent from all three rows:

- `7e95a0d4f7f80731`
- `1ed4f7a94fdba41f`

## Owner Target Pointers and Merge Provenance

Generated owner target pointers:

- `ndándayoro`
  - `lexicon_url`: `siralex://lexical-review/7n2a/ndandayoro`
  - `anchor`: `7n2a_ndandayoro_v1`
- `ndándadiya`
  - `lexicon_url`: `siralex://lexical-review/7n2a/ndandadiya`
  - `anchor`: `7n2a_ndandadiya_v1`

Merge report provenance:

- `owner_lexical_input.path`: `data/ir/siralex_owner_lexical_v1.jsonl`
- `owner_lexical_input.sha256`: `c4c432aa09ee84c47c8e3252a1c72d3a311d0b6805ee6a006ba80d519eac4c58`
- `owner_lexical_input.row_count`: `2`
- `owner_reviewed_target_ids`:
  - `a9c7d82decee9191`
  - `fefe9b063e05ed11`

## Final Source Postings and Boundaries

Final target postings:

- `hôpital`: `["71e323e2dafa590f","a9c7d82decee9191","fefe9b063e05ed11"]`
- `clinique`: `["a9c7d82decee9191","fefe9b063e05ed11"]`
- `centre de santé`: `["a9c7d82decee9191","fefe9b063e05ed11"]`

Boundary checks:

- `place` posting remains `["96b72ff71179d689"]`
- `place` includes `de6fb406453616e3` (`díya`)
- `place` excludes `a9c7d82decee9191` and `fefe9b063e05ed11`
- `location` absent
- `yoro` absent

No-duplicate verification:

- no duplicate source-index keys in merged output;
- no duplicate posting IDs in any merged row.

## Durable Test Updates

`api/source_index_supplements/tests/test_source_index_supplements.py` now includes
`test_tracked_health_rows_validate_with_durable_assembly_only`, which:

1. builds owner normalized and enriched inputs from tracked owner IR;
2. assembles baseline + owner enriched records with duplicate `ir_id` guard;
3. validates repaired health-row evidence IDs and source terms;
4. verifies prohibited synthetic IDs are absent;
5. verifies owner target pointers and owner merge provenance;
6. verifies final `hôpital`/`clinique`/`centre de santé` target order;
7. verifies `place → díya` boundary plus `location`/`yoro` absence.

Existing source-attested, owner-priority, replay, ordering, and duplicate tests
remain in place.

## Validation Commands and Results

```bash
git diff --check
pytest api/source_index_supplements/tests/ -q
pytest api/source_aliases/tests/ -q
pytest api/target_variants/tests/ -q
pytest api/normalizer/tests/ -q
pytest api/enrichment/tests/ -q
pytest api/ir_parser/tests/test_golden_fixtures.py -q
git status --short
```

Results:

- `pytest api/source_index_supplements/tests/ -q`: `33 passed`
- `pytest api/source_aliases/tests/ -q`: `27 passed`
- `pytest api/target_variants/tests/ -q`: `30 passed`
- `pytest api/normalizer/tests/ -q`: `106 passed`
- `pytest api/enrichment/tests/ -q`: `32 passed`
- `pytest api/ir_parser/tests/test_golden_fixtures.py -q`: `25 passed`

## Files In Scope

- `shared/source_index_supplements/source_index_supplements_v1.jsonl`
- `api/source_index_supplements/tests/test_source_index_supplements.py`
- `docs/reports/phase7n2a4e1_health_source_mapping_insertion_report.md`
- `docs/reports/phase7n2a4e1r_evidence_reproducibility_report.md`

## Final Statement

The health supplement table no longer depends on synthetic evidence mappings.

All approved health source mappings validate and generate using provisioned
baseline bundle inputs plus the tracked owner lexical IR supplied explicitly.

No production search index, bundle, package, or user-visible runtime artifact
was generated or changed in this slice.
