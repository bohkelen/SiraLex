# Phase 7N2A4B-R2A Provenance Projection Report

**Status:** manual provenance projection support complete  
**Recovery documentation commit:** `d090965`  
**Scope:** validation and pipeline projection only — no owner record insertion or source control

---

## Concern matrix

| Concern | Validation rule | Normalized projection behavior | Enriched projection behavior | Test result |
| ------- | --------------- | ------------------------------ | ---------------------------- | ----------- |
| `provenance.source.id` | Required; must equal `src_siralex_lexical_review` | Deep-copied verbatim from IR | Copied from normalized unchanged | **PASS** |
| `provenance.source.name` | Required non-empty string | Deep-copied verbatim | Copied unchanged | **PASS** |
| `provenance.source.url` | Required key; string or `null` | Deep-copied verbatim | Copied unchanged | **PASS** |
| `provenance.source.retrieved_at` | Required non-empty ISO timestamp | Deep-copied verbatim | Copied unchanged | **PASS** |
| `provenance.source.license_notes` | Required non-empty string | Deep-copied verbatim | Copied unchanged | **PASS** |
| `provenance.source.record_pointer` | Required; `kind=source_record_id`; must match `record_locator` | Deep-copied verbatim | Copied unchanged | **PASS** |
| `derivation.kind` | Required; must be `owner_approved_lexical_addition` | Deep-copied verbatim | Copied unchanged | **PASS** |
| `derivation.rule_versions.normalization` | Required; must be `norm_v3` | Deep-copied verbatim | Copied unchanged | **PASS** |
| Mali-Pense rows | No manual provenance required | No `provenance` / `derivation` keys emitted | Unchanged except `display` join | **PASS** |
| Enrichment display-only gate | Non-display fields must match baseline normalized | N/A | Provenance/derivation included in non-display equality | **PASS** |

---

## Projection behavior

**Manual provenance:** preserved exactly via `copy.deepcopy()` from IR into normalized output. No field renaming, no synthetic defaults, no registry auto-fill.

**Manual derivation:** preserved exactly via `copy.deepcopy()` from IR into normalized output.

**Enrichment:** `enrich_record()` copies the normalized dict and adds `display` from IR `fields_raw`. Provenance and derivation pass through unchanged.

**Frozen Mali-Pense records:** unaffected. Normalizer emits only the prior normalized schema fields; no `provenance` or `derivation` keys on Mali-Pense or index rows.

---

## Validation added

`validate_manual_lexical_review_provenance()` in `shared/ir/lexical_review.py`, invoked from `validate_lexicon_entry_evidence()` for `src_siralex_lexical_review` lexicon entries.

Fail-closed on:

- missing `provenance` / `provenance.source`
- missing required source fields (`id`, `name`, `url`, `retrieved_at`, `license_notes`, `record_pointer`)
- `provenance.source.id` mismatch
- empty `name`, `retrieved_at`, or `license_notes`
- invalid `url` (non-null non-string)
- missing or mismatched `record_pointer` vs `record_locator`
- `snapshot_id` on `record_pointer`
- missing `derivation` or `derivation.rule_versions`
- wrong `derivation.kind`
- wrong `derivation.rule_versions.normalization`

---

## Remaining mandatory fields for future record insertion

Maintainers must supply at insertion time (no synthetic defaults):

| Field | Notes |
| ----- | ----- |
| `provenance.source.retrieved_at` | Implementation-time ISO-8601 timestamp |
| `provenance.source.license_notes` | Maintainer-approved project-source statement |
| `provenance.source.url` | Repository URL or explicit `null` per source contract |
| `provenance.source.name` | Registry-compatible source name |
| Full `record_pointer` aligned with `record_locator` | Must match `source_record_id` and `url_canonical` |
| `derivation.kind` | `owner_approved_lexical_addition` |
| `derivation.rule_versions.normalization` | Active ruleset (`norm_v3`) |

---

## Tests

```bash
pytest api/ir_parser/tests/test_golden_fixtures.py -q   # 25 passed
pytest api/normalizer/tests/ -q                           # 105 passed
pytest api/enrichment/tests/ -q                           # 32 passed
pytest api/source_aliases/tests/ -q                       # 22 passed
```

New coverage:

- `api/normalizer/tests/test_lexical_review.py` — provenance validation and normalization projection
- `api/enrichment/tests/test_manual_provenance_enrichment.py` — enrichment preservation and display-only gate

All prior R1 and R1A collision/duplicate guards preserved.

---

## Frozen temporary pipeline verification

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --output /tmp/siralex_norm_7n2a4b_r2a_frozen.jsonl \
  -v
# IR units read: 19324, errors: 0

PYTHONPATH=api:shared python3 -m enrichment.cli \
  --normalized /tmp/siralex_norm_7n2a4b_r2a_frozen.jsonl \
  --ir data/ir/malipense_lexicon_v3.jsonl \
  --ir data/ir/malipense_index_v1.jsonl \
  --output /tmp/siralex_enriched_7n2a4b_r2a_frozen.jsonl \
  -v
# Enriched with display: 19324, missing display: 0

PYTHONPATH=api:shared python3 -m enrichment.validate_enrichment_display_only \
  --baseline /tmp/siralex_norm_7n2a4b_r2a_frozen.jsonl \
  --enriched /tmp/siralex_enriched_7n2a4b_r2a_frozen.jsonl -v
# PASSED (19324 records)
```

**Stability vs existing frozen projections** (19,324 Mali-Pense/index rows, excluding two local owner rows in prior baseline):

| Check | Result |
| ----- | ------ |
| Identical frozen `ir_id` set | yes |
| `preferred_form` drift | 0 |
| `variant_forms` drift | 0 |
| `search_keys` drift | 0 |
| New `provenance`/`derivation` on frozen rows | 0 |
| Enriched `display` drift | 0 |

Combined-input normalization with local owner IR was **not** run in this slice.

---

## Scope boundaries

```text
This slice does not track, create, or accept owner lexical records.
```

No changes to:

- `data/ir/siralex_owner_lexical_v1.jsonl`
- `.gitignore`
- `data/normalized/` or `data/enriched/` authoritative paths
- aliases, supplements, indexes, bundles, packages, runtime, catalog, release documents

`ndándayoro`, `ndándadiya`, `móbaa`, `maman`, and French health mappings remain absent from authoritative tracked data.

Phase 7N2A4B-R2A established machine-readable manual provenance support without accepting owner lexical records. Source control and complete record insertion remain separate required gates.
