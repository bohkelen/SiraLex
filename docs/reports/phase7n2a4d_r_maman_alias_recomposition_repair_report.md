# Phase 7N2A4D-R — Maman Alias Canonical Recomposition Repair

## Scope

This slice repairs source-alias validation/application semantics so the approved
`maman` alias remains valid during canonical recomposition without mutating
canonical `mère` postings.

The repair allows the approved maman alias to remain narrower than the full
canonical mère source posting without mutating mère or importing vocative and
respectful mother senses.

## Root cause of the 4F2 failure

`api/source_aliases/validate_alias_table.py` treated `resolved_ir_ids` as a
strict stale-check mirror of full canonical-source-term recomputation for all
candidate types.

For `src_alias_phase7n2a_0001`:

- declared: `["e5164efcdf5e6ca4"]`
- recomputed from canonical `["mère"]`: `["d540716db9321a83", "e5164efcdf5e6ca4", "0f517a71c373f51d"]`

The validator raised `resolved_ir_ids mismatch`, blocking both validation and
application during canonical recomposition.

## Schema/implementation decision

Narrow, durable decision:

- Keep `source_alias_table_v1` unchanged.
- Keep ordinary alias behavior unchanged.
- For `candidate_type == french_common_form_alias`, allow explicitly declared
  narrow postings with fail-closed constraints:
  - `resolved_ir_ids` remains mandatory and authoritative.
  - `evidence_ir_ids` must exactly equal `resolved_ir_ids`.
  - each declared id must exist in canonical recomputed postings.
  - declared order must preserve canonical posting order.
  - any id outside canonical recomputed postings fails closed.

Implementation:

- Added `resolve_declared_alias_postings()` in
  `api/source_aliases/validate_alias_table.py`.
- Validator now uses that function for approved-row checks.
- Applier now reuses the same function to ensure validation/apply parity.

## Exact files changed

- `api/source_aliases/validate_alias_table.py`
- `api/source_aliases/apply_aliases_to_search_index.py`
- `api/source_aliases/tests/test_source_aliases.py`
- `shared/specs/source-alias-table-v1.md`
- `docs/reports/phase7n2a4d_r_maman_alias_recomposition_repair_report.md`

## Before/after behavior for maman

Before:

- `validate_alias_table` failed for `maman` against canonical recomposed base
  index because full canonical `mère` posting did not equal declared
  `resolved_ir_ids`.

After:

- `validate_alias_table` passes for tracked alias table against canonical
  recomposed base index.
- `apply_aliases_to_search_index` writes `maman` posting as declared:
  `["e5164efcdf5e6ca4"]`.

## Proof mère remains unchanged

Temporary validation workspace: `/tmp/phase7n2a4d_r/`

Observed from base index and alias-applied index:

- `src_casefold:mère` before apply:
  `["d540716db9321a83", "e5164efcdf5e6ca4", "0f517a71c373f51d"]`
- `src_casefold:mère` after apply:
  `["d540716db9321a83", "e5164efcdf5e6ca4", "0f517a71c373f51d"]`
- unchanged: `true`

Observed `maman` after apply:

- `src_casefold:maman`: `["e5164efcdf5e6ca4"]`
- excludes `0f517a71c373f51d`: true
- excludes `d540716db9321a83`: true

## Fail-closed tests added/updated

In `api/source_aliases/tests/test_source_aliases.py`:

- `test_french_common_form_alias_validates`
- `test_maman_routes_exactly_to_generic_mere_posting`
- `test_maman_application_preserves_canonical_mere_posting_unchanged`
- `test_french_common_form_alias_custom_resolved_ids_mismatch_rejected`
- `test_narrow_common_form_alias_declared_ids_must_be_canonical_subset`
- `test_narrow_common_form_alias_declared_ids_must_preserve_canonical_order`
- `test_narrow_common_form_alias_evidence_ids_must_be_tied_to_canonical_source`

Existing ordinary full-posting alias tests remain green and unchanged in
meaning.

## Temporary validation commands/results (/tmp only)

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --input data/ir/siralex_owner_lexical_v1.jsonl \
  --target-variant-overlay shared/target_variants/reviewed_target_variants_v1.jsonl \
  --output /tmp/phase7n2a4d_r/normalized.jsonl -v

PYTHONPATH=api:shared python3 -m enrichment.cli \
  --normalized /tmp/phase7n2a4d_r/normalized.jsonl \
  --ir data/ir/malipense_lexicon_v3.jsonl \
  --ir data/ir/malipense_index_v1.jsonl \
  --ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/phase7n2a4d_r/records_enriched.jsonl -v

PYTHONPATH=api:shared python3 -m search_index.cli \
  --input /tmp/phase7n2a4d_r/records_enriched.jsonl \
  --output /tmp/phase7n2a4d_r/search_index_base.jsonl --verbose

PYTHONPATH=api:shared python3 -m source_aliases.validate_alias_table \
  --aliases shared/aliases/source_aliases_v1.jsonl \
  --records /tmp/phase7n2a4d_r/records_enriched.jsonl \
  --search-index /tmp/phase7n2a4d_r/search_index_base.jsonl \
  --output-report /tmp/phase7n2a4d_r/source_alias_validate_report.json

PYTHONPATH=api:shared python3 -m source_aliases.apply_aliases_to_search_index \
  --aliases shared/aliases/source_aliases_v1.jsonl \
  --records /tmp/phase7n2a4d_r/records_enriched.jsonl \
  --search-index /tmp/phase7n2a4d_r/search_index_base.jsonl \
  --output-search-index /tmp/phase7n2a4d_r/search_index_alias.jsonl \
  --output-report /tmp/phase7n2a4d_r/source_alias_apply_report.json
```

Results:

- alias validation: passed
- alias application: passed
- `maman` posting: `["e5164efcdf5e6ca4"]`
- canonical `mère` posting: unchanged

## Test commands and results

```bash
pytest api/source_aliases/tests/test_source_aliases.py -q
```

- `30 passed`

## Negative-scope confirmation

- No candidate recomposition continuation in this slice.
- No candidate bundle/package/catalog publication.
- No runtime/frontend/device artifact changes.
- No modifications to:
  - `data/ir/`
  - `shared/search_regression/`
  - `api/normalizer/`
  - `api/enrichment/`
  - `api/source_index_supplements/`
  - `web/`

