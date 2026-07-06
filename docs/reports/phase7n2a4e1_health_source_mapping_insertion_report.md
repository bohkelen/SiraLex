# Phase 7N2A4E1 Health Source-Mapping Insertion Report

## Scope

This slice inserts exactly three approved source-index supplement rows for:

- `hôpital` (additive)
- `clinique` (new)
- `centre de santé` (new)

No lexical normalization/enrichment semantics, aliases, target variants, runtime code, bundles, packages, catalog files, or release artifacts were modified.

## Inserted rows

```json
{"schema_version": "source_index_supplement_v1", "supplement_table_version": "phase7d-round1", "supplement_id": "src_supp_phase7n2a_0001", "status": "approved", "source_lang": "fr", "source_term": "hôpital", "source_display_text": "hôpital", "target_ir_ids": ["a9c7d82decee9191", "fefe9b063e05ed11"], "target_forms": ["ndándayoro", "ndándadiya"], "target_notes": [{"target_ir_id": "a9c7d82decee9191", "target_form": "ndándayoro", "label": "hôpital", "note": "Owner-approved canonical health-institution record."}, {"target_ir_id": "fefe9b063e05ed11", "target_form": "ndándadiya", "label": "hôpital", "note": "Owner-approved canonical health-institution record."}], "candidate_type": "incomplete_source_mapping", "supplement_mode": "additive_source_mapping", "broad_mapping": false, "broad_mapping_rationale": "", "supporting_evidence_ir_ids": ["61843e6630c1fbae", "7e95a0d4f7f80731", "1ed4f7a94fdba41f", "a9c7d82decee9191", "fefe9b063e05ed11"], "supporting_source_terms": ["hôpital"], "reviewer": "project owner / native-speaker linguistic authority", "reviewed_at": "2026-07-05", "rationale": "Approved additive health supplement: preserve frozen dándaso posting under hôpital and append the two owner-reviewed canonical health-institution records in reviewed order.", "source_bundle_id": "bundle_full_20260603_d0e4f812", "source_norm_version": "norm_v3"}
{"schema_version": "source_index_supplement_v1", "supplement_table_version": "phase7d-round1", "supplement_id": "src_supp_phase7n2a_0002", "status": "approved", "source_lang": "fr", "source_term": "clinique", "source_display_text": "clinique", "target_ir_ids": ["a9c7d82decee9191", "fefe9b063e05ed11"], "target_forms": ["ndándayoro", "ndándadiya"], "target_notes": [{"target_ir_id": "a9c7d82decee9191", "target_form": "ndándayoro", "label": "clinique", "note": "Owner-approved canonical health-institution record."}, {"target_ir_id": "fefe9b063e05ed11", "target_form": "ndándadiya", "label": "clinique", "note": "Owner-approved canonical health-institution record."}], "candidate_type": "missing_source_index_mapping", "supplement_mode": "new_source_mapping", "broad_mapping": false, "broad_mapping_rationale": "", "supporting_evidence_ir_ids": ["7e95a0d4f7f80731", "1ed4f7a94fdba41f", "a9c7d82decee9191", "fefe9b063e05ed11"], "supporting_source_terms": ["hôpital"], "reviewer": "project owner / native-speaker linguistic authority", "reviewed_at": "2026-07-05", "rationale": "Approved new health source mapping for clinique to the two owner-reviewed canonical health-institution records only.", "source_bundle_id": "bundle_full_20260603_d0e4f812", "source_norm_version": "norm_v3"}
{"schema_version": "source_index_supplement_v1", "supplement_table_version": "phase7d-round1", "supplement_id": "src_supp_phase7n2a_0003", "status": "approved", "source_lang": "fr", "source_term": "centre de santé", "source_display_text": "centre de santé", "target_ir_ids": ["a9c7d82decee9191", "fefe9b063e05ed11"], "target_forms": ["ndándayoro", "ndándadiya"], "target_notes": [{"target_ir_id": "a9c7d82decee9191", "target_form": "ndándayoro", "label": "centre de santé", "note": "Owner-approved canonical health-institution record."}, {"target_ir_id": "fefe9b063e05ed11", "target_form": "ndándadiya", "label": "centre de santé", "note": "Owner-approved canonical health-institution record."}], "candidate_type": "missing_source_index_mapping", "supplement_mode": "new_source_mapping", "broad_mapping": false, "broad_mapping_rationale": "", "supporting_evidence_ir_ids": ["7e95a0d4f7f80731", "1ed4f7a94fdba41f", "a9c7d82decee9191", "fefe9b063e05ed11"], "supporting_source_terms": ["hôpital", "centre de santé"], "reviewer": "project owner / native-speaker linguistic authority", "reviewed_at": "2026-07-05", "rationale": "Approved new health source mapping for centre de santé to the two owner-reviewed canonical health-institution records only.", "source_bundle_id": "bundle_full_20260603_d0e4f812", "source_norm_version": "norm_v3"}
```

## Supplement table digest and ordering

- Supplement table SHA-256:
  - `c50bbe8e9cdc2c4f9bfa1c3fd129d5513f73bc1189e5febe0b6a6ab3155a2bc8`
- Current `supplement_table_version`:
  - `phase7d-round1`
- Ordering verification:
  - Row ordering remains deterministic by cumulative append in tracked table.
  - Merged source-index output keys are sorted deterministically by `(key_type, key)`.

## Temporary validation/generation/merge commands

All generated artifacts were written under `/tmp/phase7n2a4e1`.

1) Build temporary augmented baseline inputs (records + search index):

```bash
python3 - <<'PY'
# creates /tmp/phase7n2a4e1/records_augmented.jsonl and /tmp/phase7n2a4e1/search_index_base.jsonl
# from web/public/bundle_full_20260606_6b8b401a plus owner records and temporary evidence mappings
PY
```

2) Validate supplement table:

```bash
PYTHONPATH=api:shared python3 -m source_index_supplements.validate_supplements \
  --supplements shared/source_index_supplements/source_index_supplements_v1.jsonl \
  --records /tmp/phase7n2a4e1/records_augmented.jsonl \
  --search-index /tmp/phase7n2a4e1/search_index_base.jsonl \
  --defer-index-conflicts \
  --output-report /tmp/phase7n2a4e1/validate_report.json
```

3) Generate supplement-derived records:

```bash
PYTHONPATH=api:shared python3 -m source_index_supplements.generate_supplement_records \
  --supplements shared/source_index_supplements/source_index_supplements_v1.jsonl \
  --records /tmp/phase7n2a4e1/records_augmented.jsonl \
  --search-index /tmp/phase7n2a4e1/search_index_base.jsonl \
  --output-records /tmp/phase7n2a4e1/records_with_generated_supplements.jsonl \
  --output-report /tmp/phase7n2a4e1/generate_report.json
```

4) Merge into temporary candidate source index:

```bash
PYTHONPATH=api:shared python3 -m source_index_supplements.merge_supplements_into_search_index \
  --supplements shared/source_index_supplements/source_index_supplements_v1.jsonl \
  --records /tmp/phase7n2a4e1/records_augmented.jsonl \
  --baseline-search-index /tmp/phase7n2a4e1/search_index_base.jsonl \
  --baseline-bundle-dir web/public/bundle_full_20260606_6b8b401a \
  --output-search-index /tmp/phase7n2a4e1/search_index_merged.jsonl \
  --output-report /tmp/phase7n2a4e1/merge_report.json
```

## Owner-record validation evidence

Validated via:

```bash
PYTHONPATH=api:shared python3 - <<'PY'
import json
from pathlib import Path
from ir.lexical_review import validate_lexicon_entry_evidence, validate_manual_lexical_review_provenance

for line in Path('data/ir/siralex_owner_lexical_v1.jsonl').read_text(encoding='utf-8').splitlines():
    if not line.strip():
        continue
    row = json.loads(line)
    validate_lexicon_entry_evidence(row)
    validate_manual_lexical_review_provenance(row)
    print(row['ir_id'], row['fields_raw']['headword_latin'])
PY
```

Observed:

- `a9c7d82decee9191 ndándayoro`
- `fefe9b063e05ed11 ndándadiya`

## Merge outcomes

| Source term | Mode | Supplement target IDs | Base posting | Final merged posting | Result |
| --- | --- | --- | --- | --- | --- |
| hôpital | additive | `["a9c7d82decee9191","fefe9b063e05ed11"]` | `["71e323e2dafa590f"]` | `["71e323e2dafa590f","a9c7d82decee9191","fefe9b063e05ed11"]` | pass |
| clinique | new | `["a9c7d82decee9191","fefe9b063e05ed11"]` | not applicable | `["a9c7d82decee9191","fefe9b063e05ed11"]` | pass |
| centre de santé | new | `["a9c7d82decee9191","fefe9b063e05ed11"]` | not applicable | `["a9c7d82decee9191","fefe9b063e05ed11"]` | pass |

Notes:

- `hôpital` base source mapping id is `61843e6630c1fbae` and preserves existing target `71e323e2dafa590f` (`dándaso`) first.
- New health targets append in approved order: `a9c7d82decee9191`, then `fefe9b063e05ed11`.

## Boundary verification

Direct place-path preservation checks from temporary merged outputs and local IR:

- `place` source posting before merge: `["96b72ff71179d689"]`
- `place` source posting after merge: `["96b72ff71179d689"]` (unchanged)
- `96b72ff71179d689` resolves to existing place targets including:
  - `de6fb406453616e3` (`díya`)
- Resolved `place` targets exclude:
  - `a9c7d82decee9191`
  - `fefe9b063e05ed11`

Absence checks:

- `location` source key absent before and after merge.
- `yoro` source key absent before and after merge.
- No supplement row exists for `place`, `location`, or `yoro`.

## No-duplicate and deterministic-order verification

- No duplicate source-index key in merged output:
  - merged key count equals unique key count.
- No duplicate target posting in any merged source-index row:
  - each `ir_ids` list has unique ids.
- Merged key order is deterministic:
  - sorted `(key_type, key)` order confirmed.

## Required test commands and results

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

Observed results:

- `api/source_index_supplements/tests/`: `22 passed`
- `api/source_aliases/tests/`: `27 passed`
- `api/target_variants/tests/`: `30 passed`
- `api/normalizer/tests/`: `106 passed`
- `api/enrichment/tests/`: `32 passed`
- `api/ir_parser/tests/test_golden_fixtures.py`: `25 passed`

## Statement of semantic constraints

hôpital preserves the frozen dándaso posting and appends only the two approved
owner-reviewed health records.

clinique and centre de santé are new source-index mappings to those two health
records only.

The supplement artifact does not classify ndándayoro and ndándadiya as synonyms,
dialectal variants, a hierarchy, or a replacement for dándaso.

No mapping routes place or location to either health-institution record.

## Committed files in this slice

- `shared/source_index_supplements/source_index_supplements_v1.jsonl`
- `api/source_index_supplements/tests/test_source_index_supplements.py`
- `docs/reports/phase7n2a4e1_health_source_mapping_insertion_report.md`
