# Phase 7N2A4E1-R0 Owner-Reviewed Target Evidence Adapter

## Scope

This slice adds an explicit owner-reviewed lexical evidence adapter for
source-index supplement generation.

- No production supplement row changed.
- No runtime search artifact, bundle, or package changed.
- Existing source-attested index-mapping evidence behavior remains intact.

## Evidence path model

| Evidence path | Existing behavior | New behavior | Boundary |
| --- | --- | --- | --- |
| Source-attested index mapping | unchanged | unchanged | all existing source-derived targets |
| Owner-reviewed lexical record | unavailable | explicit validated adapter | `src_siralex_lexical_review` only |

## Explicit owner-evidence contract implemented

The owner-reviewed path is accepted only when all are true:

1. `--owner-lexical-ir PATH` is supplied explicitly.
2. Target `ir_id` exists exactly once in that owner lexical file.
3. Owner row has `ir_kind == lexicon_entry` and
   `source_id == src_siralex_lexical_review`.
4. Owner row passes `validate_lexicon_entry_evidence()` and
   `validate_manual_lexical_review_provenance()`.
5. Target `ir_id` appears in both `target_ir_ids` and
   `supporting_evidence_ir_ids`.
6. NFC(`target_form`) equals NFC(owner `fields_raw.headword_latin`).
7. Owner row has `record_locator.kind == source_record_id` with non-empty
   `url_canonical` and `source_record_id`.
8. Non-owner lexical sources cannot use this path.

## Generated target-entry pointer fields

For valid owner-reviewed targets, generated `target_entries` are built from
validated owner rows:

- `lexicon_url`: `record_locator.url_canonical`
- `anchor`: `record_locator.source_record_id`
- `display_text`: `fields_raw.headword_latin`

Verified output for the approved owner health targets:

- `ndándayoro` -> `siralex://lexical-review/7n2a/ndandayoro` /
  `7n2a_ndandayoro_v1`
- `ndándadiya` -> `siralex://lexical-review/7n2a/ndandadiya` /
  `7n2a_ndandadiya_v1`

## Fail-closed checks implemented and tested

- Missing `--owner-lexical-ir` when owner evidence is needed: fail.
- Invalid owner lexical provenance: fail.
- Owner headword/target form NFC mismatch: fail.
- Target `ir_id` missing from `supporting_evidence_ir_ids`: fail.
- `src_malipense` lexicon target cannot use owner adapter: fail.
- Other non-owner lexical source cannot use owner adapter: fail.

## Temporary validation run (no synthetic index_mapping evidence)

Durable input set used:

- baseline bundle: `web/public/bundle_full_20260606_6b8b401a`
- owner lexical IR: `data/ir/siralex_owner_lexical_v1.jsonl`
- temporary supplement row under `/tmp/phase7n2a4e1r0/supplements_temp.jsonl`
  with:
  - `target_ir_ids`: `["a9c7d82decee9191", "fefe9b063e05ed11"]`
  - `supporting_evidence_ir_ids`: `["a9c7d82decee9191", "fefe9b063e05ed11"]`

No synthetic index-mapping evidence record was created.

Commands executed:

```bash
PYTHONPATH=api:shared python3 -m source_index_supplements.validate_supplements \
  --supplements /tmp/phase7n2a4e1r0/supplements_temp.jsonl \
  --records /tmp/phase7n2a4e1r0/records_augmented.jsonl \
  --search-index /tmp/phase7n2a4e1r0/search_index_base.jsonl \
  --owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl \
  --defer-index-conflicts \
  --output-report /tmp/phase7n2a4e1r0/validate_report.json

PYTHONPATH=api:shared python3 -m source_index_supplements.generate_supplement_records \
  --supplements /tmp/phase7n2a4e1r0/supplements_temp.jsonl \
  --records /tmp/phase7n2a4e1r0/records_augmented.jsonl \
  --search-index /tmp/phase7n2a4e1r0/search_index_base.jsonl \
  --owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output-records /tmp/phase7n2a4e1r0/records_generated.jsonl \
  --output-report /tmp/phase7n2a4e1r0/generate_report.json

PYTHONPATH=api:shared python3 -m source_index_supplements.merge_supplements_into_search_index \
  --supplements /tmp/phase7n2a4e1r0/supplements_temp.jsonl \
  --records /tmp/phase7n2a4e1r0/records_augmented.jsonl \
  --baseline-search-index /tmp/phase7n2a4e1r0/search_index_base.jsonl \
  --baseline-bundle-dir web/public/bundle_full_20260606_6b8b401a \
  --owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output-search-index /tmp/phase7n2a4e1r0/search_index_merged.jsonl \
  --output-report /tmp/phase7n2a4e1r0/merge_report.json
```

Observed command results:

- validation: passed
- generation: passed
- merge: passed (`added_key_count=4`, `changed_key_count=0`)

Recorded owner lexical metadata in reports:

- path: `data/ir/siralex_owner_lexical_v1.jsonl`
- SHA-256: `c4c432aa09ee84c47c8e3252a1c72d3a311d0b6805ee6a006ba80d519eac4c58`
- row count: `2`
- owner-reviewed target IDs applied:
  `["a9c7d82decee9191","fefe9b063e05ed11"]`

## Boundary verification from temporary merge output

- `clinique` posting after merge:
  - generated source posting id: `["ff59f8054d83fcff"]`
  - generated target entries point to owner locators for `ndándayoro`,
    `ndándadiya` only.
- `hôpital` posting remains baseline in temporary run:
  - `["61843e6630c1fbae"]`
- `place` posting remains:
  - `["96b72ff71179d689"]`
- `place` resolved targets still include:
  - `de6fb406453616e3` (`díya`)
- `place` resolved targets exclude:
  - `a9c7d82decee9191`
  - `fefe9b063e05ed11`
- `location` source key: absent
- `yoro` source key: absent

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

Result summary (after implementation):

- `api/source_index_supplements/tests/`: pass
- `api/source_aliases/tests/`: pass
- `api/target_variants/tests/`: pass
- `api/normalizer/tests/`: pass
- `api/enrichment/tests/`: pass
- `api/ir_parser/tests/test_golden_fixtures.py`: pass

## Explicit statement

The owner-reviewed evidence adapter does not create source-attested evidence.

It converts validated project-owned lexical provenance and its real locator into
a generated target-entry pointer only for explicitly approved owner lexical
targets.

No production supplement row changed in this slice.
