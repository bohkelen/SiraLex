# Phase 7N2A4D maman Source Alias Report

## Scope

This slice adds one tracked source-side alias row:

- `alias_source_term`: `maman`
- `canonical_source_terms`: `["mère"]`
- `candidate_type`: `french_common_form_alias`

No lexical record, target variant, source-index supplement, normalizer/enrichment logic, or runtime artifact was changed.

## Verification matrix

| Check | Required result | Actual result |
| ------------------------ | -------------------------- | ------------- |
| Alias source term | `maman` | `maman` |
| Canonical source term | `mère` | `mère` |
| Candidate type | `french_common_form_alias` | `french_common_form_alias` |
| Generic posting identity | `e5164efcdf5e6ca4` | `e5164efcdf5e6ca4` |
| Vocative exclusion | `0f517a71c373f51d` absent | absent |
| Respectful exclusion | `d540716db9321a83` absent | absent |
| Posting order | exact canonical copy | exact canonical copy |
| Existing `mère` behavior | unchanged | unchanged |

## Exact alias row added

```json
{"schema_version":"source_alias_table_v1","alias_table_version":"phase7a-round1","alias_id":"src_alias_phase7n2a_0001","status":"approved","direction":"source_to_target","alias_source_term":"maman","canonical_source_terms":["mère"],"resolved_ir_ids":["e5164efcdf5e6ca4"],"candidate_type":"french_common_form_alias","evidence_ir_ids":["e5164efcdf5e6ca4"],"rationale":"Phase 7N2A review approved common-form French alias 'maman' to copy only the generic mère posting without importing vocative/respectful mother senses.","reviewer":"project owner / native-speaker linguistic authority","reviewed_at":"2026-07-05","source_bundle_id":"bundle_full_20260313_1dc526df","source_norm_version":"norm_v3"}
```

## Read-only local validation (provisioned source data)

Validation tooling was run against local provisioned bundle data:

- records: `data/bundles/bundle_full_20260313_1dc526df/records.jsonl`
- search index: `data/bundles/bundle_full_20260313_1dc526df/search_index.jsonl`

Results:

- canonical `mère` posting resolved to `["e5164efcdf5e6ca4"]`
- applied `maman` alias posting resolved to `["e5164efcdf5e6ca4"]`
- posting order identical (`same_order == true`)
- excluded ids absent from `maman`:
  - `0f517a71c373f51d`
  - `d540716db9321a83`

## Alias table metadata

- source alias table version: `phase7a-round1`
- alias table SHA-256 after insertion: `416f7e747e1f2e13e6a1a938d8ea64be809b3d5299a7e75bc8a27ebd473b20e3`
- deterministic ordering validation: alias ids are sorted; new row appended in-order (`alias_ids_sorted == true`)

## Test commands and results

```bash
pytest api/source_aliases/tests/ -q
pytest api/normalizer/tests/ -q
pytest api/ir_parser/tests/test_golden_fixtures.py -q
pytest api/target_variants/tests/ -q
git diff --check
```

Observed:

- `api/source_aliases/tests/`: 27 passed
- `api/normalizer/tests/`: 106 passed
- `api/ir_parser/tests/test_golden_fixtures.py`: 25 passed
- `api/target_variants/tests/`: 30 passed
- `git diff --check`: clean

## Negative-scope confirmation

- no target variant changes
- no lexical record insertions
- no health source-index supplement changes (`hôpital`/`clinique`/`centre de santé`)
- no generated index/bundle/package/catalog/release/runtime changes
- frozen Mali-Pense IR unchanged

maman is a French common-form source alias for the existing generic mère posting.
It does not merge or reinterpret vocative and respectful mother senses.
