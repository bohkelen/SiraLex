# Phase 7N2A4B-R2B Acceptance Report

**Status:** Phase 7N2A4B reproducible and accepted  
**Precondition commits:** `ff269c1`, `a5d89f8`, `ca0fb86`, `8b95c23`  
**Superseded historical evidence:** commit `ce055dc` remains superseded local-attempt documentation only

---

## Accepted record identities

| Candidate | source_record_id | ir_id | Canonical NFC form | Review-sheet reference | Provenance complete | Normalized verified | Enriched verified |
| --------- | ---------------- | ----- | ------------------ | ---------------------- | ------------------- | ------------------- | ----------------- |
| `ndándayoro` | `7n2a_ndandayoro_v1` | `a9c7d82decee9191` | `ndándayoro` | `docs/reviews/phase7n2a_ndandayoro_lexical_review.md` | yes | yes | yes |
| `ndándadiya` | `7n2a_ndandadiya_v1` | `fefe9b063e05ed11` | `ndándadiya` | `docs/reviews/phase7n2a_ndandadiya_lexical_review.md` | yes | yes | yes |

Both `ir_id` values were computed with `compute_ir_id(source_id, url_canonical, source_record_id, parser_version)` and match the prior local verification targets.

---

## `.gitignore` exception

**Before:** blanket `data/` ignored all paths under `data/`, including `data/ir/siralex_owner_lexical_v1.jsonl`.

**After (exact lines):**

```gitignore
# Snapshot / pipeline data (do not commit)
data/*
!data/ir/
data/ir/*
!data/ir/siralex_owner_lexical_v1.jsonl
```

### Source-control verification

| Path | Result |
| ---- | ------ |
| `git check-ignore -q data/ir/siralex_owner_lexical_v1.jsonl` | exit `1` — not ignored |
| `git check-ignore -v data/ir/malipense_lexicon_v3.jsonl` | ignored by `data/ir/*` |
| `data/normalized/` | ignored by `data/*` |
| `data/enriched/` | ignored by `data/*` |
| `data/local_evidence/` | ignored by `data/*` |
| `git ls-files --error-unmatch data/ir/siralex_owner_lexical_v1.jsonl` | succeeds after staging |

---

## Semantic content inserted

Both records carry:

- French primary gloss: `établissement de santé`
- Usage note: `Lieu où des soins ou services de santé sont reçus.`
- Approved later retrieval labels (documented only; not mapped): `hôpital`, `clinique`, `centre de santé`

Omitted per scope: part of speech, dialect/geographic scope, etymology, French source mappings, `reviewed_target_variants`, standalone `yoro`/`diya`, and any synonym/variant relationship between the two candidates.

---

## Provenance and derivation

| Field | Value (both records unless noted) |
| ----- | --------------------------------- |
| `provenance.source.id` | `src_siralex_lexical_review` |
| `provenance.source.name` | `SiraLex owner-reviewed lexical addition` |
| `provenance.source.url` | `null` |
| `provenance.source.retrieved_at` | `2026-07-05T14:04:34Z` |
| `provenance.source.license_notes` | Project lexical-review addition approved by the project owner; not derived from Mali-Pense. |
| `provenance.source.record_pointer` | `kind=source_record_id`; matches `record_locator` |
| `derivation.kind` | `owner_approved_lexical_addition` |
| `derivation.rule_versions.normalization` | `norm_v3` |

`validate_lexicon_entry_evidence()` and `validate_manual_lexical_review_provenance()` pass for both committed rows.

---

## Pipeline commands

### 1. Fresh frozen baseline

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --output /tmp/siralex_norm_7n2a4b_r2b_frozen.jsonl \
  -v
```

Result: IR units read `19324`, errors `0`.

### 2. Full combined normalization

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --input data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/siralex_norm_7n2a4b_r2b_combined.jsonl \
  -v
```

Result: IR units read `19326`, lexicon entries normalized `8825`, errors `0`.

### 3. Full combined enrichment

```bash
PYTHONPATH=api:shared python3 -m enrichment.cli \
  --normalized /tmp/siralex_norm_7n2a4b_r2b_combined.jsonl \
  --ir data/ir/malipense_lexicon_v3.jsonl \
  --ir data/ir/malipense_index_v1.jsonl \
  --ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/siralex_enriched_7n2a4b_r2b_combined.jsonl \
  -v

PYTHONPATH=api:shared python3 -m enrichment.validate_enrichment_display_only \
  --baseline /tmp/siralex_norm_7n2a4b_r2b_combined.jsonl \
  --enriched /tmp/siralex_enriched_7n2a4b_r2b_combined.jsonl -v
```

Result: enriched `19326`, missing display `0`, display-only gate **PASSED**.

---

## Frozen-versus-combined comparison

Fresh frozen enriched baseline was generated from `/tmp/siralex_norm_7n2a4b_r2b_frozen.jsonl` for display comparison. No authoritative `data/normalized/` or `data/enriched/` paths were used as baseline.

| Check | Result |
| ----- | ------ |
| Frozen record count | `19,324` |
| Combined record count | `19,326` |
| Added manual `ir_id`s | `a9c7d82decee9191`, `fefe9b063e05ed11` |
| Frozen `ir_id` set unchanged | yes |
| Frozen `preferred_form` drift | `0` |
| Frozen `variant_forms` drift | `0` |
| Frozen `search_keys` drift | `0` |
| Frozen provenance/derivation additions | `0` |
| Frozen enriched `display` drift | `0` |
| Manual provenance/derivation preserved through normalization | yes (exact match to IR) |
| Manual provenance/derivation preserved through enrichment | yes (exact match to IR) |
| Manual records distinct `ir_id`s | yes |
| Manual canonical NFC forms | `ndándayoro`, `ndándadiya` |

---

## Test results

```bash
pytest api/ir_parser/tests/test_golden_fixtures.py -q   # 25 passed
pytest api/normalizer/tests/ -q                           # 106 passed
pytest api/enrichment/tests/ -q                           # 32 passed
pytest api/source_aliases/tests/ -q                       # 22 passed
git diff --check                                          # clean
```

Added: `test_tracked_owner_lexical_ir_records_validate_and_have_distinct_ir_ids` in `api/normalizer/tests/test_lexical_review.py`.

---

## Negative-scope checks

| Check | Result |
| ----- | ------ |
| 1. No source alias row for `maman` | pass — none in `shared/aliases/` |
| 2. No `reviewed_target_variants` entry for `móbaa` | pass — none in tracked owner IR |
| 3. No source-index supplement for `hôpital`, `clinique`, or `centre de santé` | pass — none in `shared/source_index_supplements/` |
| 4. No standalone `yoro` record | pass — only compound forms `ndándayoro` / `ndándadiya` |
| 5. No `place` or `location` mapping added | pass |
| 6. No Mali-Pense IR row changes | pass — `malipense_lexicon_v3.jsonl` and `malipense_index_v1.jsonl` untouched |
| 7. No bundle, package, catalog, runtime, or release artifact changes | pass |

`móbaa`, `maman`, and French health retrieval mappings remain absent from authoritative tracked data.

---

## Files committed

| File | Role |
| ---- | ---- |
| `.gitignore` | narrow exception for owner lexical IR |
| `data/ir/siralex_owner_lexical_v1.jsonl` | two authoritative owner-approved lexical rows |
| `docs/reports/phase7n2a4b_r2b_acceptance_report.md` | acceptance evidence |
| `api/normalizer/tests/test_lexical_review.py` | tracked-source validation test |

No generated normalized or enriched outputs were committed.

Commit `ce055dc` remains superseded historical evidence of the failed pre-recovery attempt.

Phase 7N2A4B is now reproducible and accepted. `ndándayoro` and `ndándadiya` are tracked owner-approved lexical records with complete provenance and successful full-pipeline validation. Retrieval mappings and user-visible search behavior remain unchanged.
