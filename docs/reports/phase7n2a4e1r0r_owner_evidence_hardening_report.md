# Phase 7N2A4E1-R0R Owner Evidence Hardening Report

## Scope

This slice hardens owner-reviewed evidence precedence and merge provenance
reporting.

- Production supplement table is unchanged.
- No production health mapping was added, removed, or altered.
- No data/IR, bundles, packages, runtime code, catalog, or release artifacts
  changed.

## Behavior hardening summary

| Concern | Prior behavior | Corrected behavior | Test result |
| --- | --- | --- | --- |
| Owner target pointer precedence | Owner targets could be resolved from matching `index_mapping` evidence before owner locator resolution. | Owner targets (`src_siralex_lexical_review`) resolve through validated owner lexical locator first; competing matching `index_mapping` evidence cannot override. | pass |
| Source-attested non-owner path | Source-attested path for non-owner targets worked. | Unchanged; non-owner targets still require source-attested `index_mapping` target entries. | pass |
| Merge owner provenance | Generation report had owner metadata, merge report did not guarantee propagation. | Merge report includes `owner_lexical_input` and `owner_reviewed_target_ids` when owner-reviewed targets are applied/verified. | pass |
| Missing/invalid owner input | Missing/invalid owner path failed in adapter flow. | Unchanged fail-closed behavior retained and verified. | pass |

## Deterministic resolution order implemented

Resolution now follows this strict order:

1. If target record `source_id == src_siralex_lexical_review`:
   - resolve via validated owner adapter only;
   - require explicit `--owner-lexical-ir`;
   - fail closed on any owner-validation mismatch;
   - do not fall back to source-attested `index_mapping` pointer lookup.
2. Otherwise (non-owner target):
   - use existing source-attested `index_mapping` evidence path;
   - fail closed when no attested target entry exists.

## Pointer-precedence proof with competing matching index-mapping entry

A temporary owner-reviewed supplement row was validated/generated/merged with:

- owner targets:
  - `a9c7d82decee9191` (`ndándayoro`)
  - `fefe9b063e05ed11` (`ndándadiya`)
- a deliberately competing `index_mapping` evidence record containing matching
  `display_text` values but fake Mali-Pense-like pointers.

Observed generated target entries (authoritative owner pointers):

- `{"lexicon_url":"siralex://lexical-review/7n2a/ndandayoro","anchor":"7n2a_ndandayoro_v1","display_text":"ndándayoro"}`
- `{"lexicon_url":"siralex://lexical-review/7n2a/ndandadiya","anchor":"7n2a_ndandadiya_v1","display_text":"ndándadiya"}`

Competing fake pointers were not emitted.

## Merge provenance now propagated

When owner-reviewed targets were applied, merge report included:

- `owner_lexical_input`:
  - `path`: `/tmp/phase7n2a4e1r0r/owner_ir.jsonl`
  - `sha256`: `4e5fafe97878713e7cc534727b1ba6ba811ddb8afa87fd1b5c452d8b23d0405a`
  - `row_count`: `2`
- `owner_reviewed_target_ids`:
  - `["a9c7d82decee9191","fefe9b063e05ed11"]`

For a non-owner source-attested run (no owner adapter used), report omitted:

- `owner_lexical_input`
- `owner_reviewed_target_ids`

## Temporary validation commands (synthetic fixtures only)

```bash
# Non-owner source-attested generation unchanged
PYTHONPATH=api:shared python3 -m source_index_supplements.generate_supplement_records \
  --supplements /tmp/phase7n2a4e1r0r/supp_non_owner.jsonl \
  --records /tmp/phase7n2a4e1r0r/records_non_owner.jsonl \
  --search-index /tmp/phase7n2a4e1r0r/search_non_owner.jsonl \
  --output-records /tmp/phase7n2a4e1r0r/out_non_owner_records.jsonl \
  --output-report /tmp/phase7n2a4e1r0r/out_non_owner_report.json

# Owner-priority generation with competing matching index_mapping evidence
PYTHONPATH=api:shared python3 -m source_index_supplements.generate_supplement_records \
  --supplements /tmp/phase7n2a4e1r0r/supp_owner.jsonl \
  --records /tmp/phase7n2a4e1r0r/records_owner.jsonl \
  --search-index /tmp/phase7n2a4e1r0r/search_owner.jsonl \
  --owner-lexical-ir /tmp/phase7n2a4e1r0r/owner_ir.jsonl \
  --output-records /tmp/phase7n2a4e1r0r/out_owner_records.jsonl \
  --output-report /tmp/phase7n2a4e1r0r/out_owner_report.json

# Owner-priority merge with owner provenance in final merge report
PYTHONPATH=api:shared python3 -m source_index_supplements.merge_supplements_into_search_index \
  --supplements /tmp/phase7n2a4e1r0r/supp_owner.jsonl \
  --records /tmp/phase7n2a4e1r0r/records_owner.jsonl \
  --baseline-search-index /tmp/phase7n2a4e1r0r/search_owner.jsonl \
  --baseline-bundle-dir /tmp/phase7n2a4e1r0r/bundle \
  --owner-lexical-ir /tmp/phase7n2a4e1r0r/owner_ir.jsonl \
  --output-search-index /tmp/phase7n2a4e1r0r/out_owner_merged_index.jsonl \
  --output-report /tmp/phase7n2a4e1r0r/out_owner_merge_report.json
```

## Required explicit statement

Owner-reviewed targets now resolve through validated owner lexical locators
before any source-attested evidence lookup.

Merge reports carry owner-input provenance and applied owner target IDs whenever
the owner-reviewed adapter is used.

No production supplement row changed in this slice.
