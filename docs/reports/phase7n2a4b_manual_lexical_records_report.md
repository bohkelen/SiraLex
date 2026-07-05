# Phase 7N2A4B Manual Lexical Records Report

**Status:** implementation complete  
**Slice:** Phase 7N2A4B — Approved Canonical Health-Institution Lexical Records  
**Schema basis:** commit `ff269c1dcae534ec45daeee3efcc8c658441e421`

This slice inserted only the two owner-approved canonical Maninka health-institution lexical records with traceable owner-review provenance. No French retrieval mappings, aliases, target variants, bundles, packages, catalog entries, runtime behavior, or release changes were made.

---

## Inserted record identities

| Candidate | source_record_id | ir_id | Canonical NFC form | Provenance source | Review-sheet reference | Normalized form verified | Enriched form verified |
| --------- | ---------------- | ----- | ------------------ | ----------------- | ---------------------- | ------------------------ | ---------------------- |
| `ndándayoro` | `7n2a_ndandayoro_v1` | `a9c7d82decee9191` | `ndándayoro` | `src_siralex_lexical_review` | `docs/reviews/phase7n2a_ndandayoro_lexical_review.md` | yes | yes |
| `ndándadiya` | `7n2a_ndandadiya_v1` | `fefe9b063e05ed11` | `ndándadiya` | `src_siralex_lexical_review` | `docs/reviews/phase7n2a_ndandadiya_lexical_review.md` | yes | yes |

Both forms were mechanically verified as NFC before insertion (`normalize_nfc(form) == form`).

`ir_id` values were computed with `compute_ir_id(source_id, url_canonical, source_record_id, parser_version)` and were not hand-invented.

---

## Preconditions (7N2A4A schema support)

Verified present and valid under commit `ff269c1`:

| Requirement | Location / evidence |
| --- | --- |
| `src_siralex_lexical_review` | `shared/sources/siralex_lexical_review.yaml` |
| `siralex_owner_lexical_v1` | `shared/ir/lexical_review.py`, IR `parser_version` |
| `owner_approved_lexical_addition` | `shared/ir/lexical_review.py`, `shared/specs/provenance.md` |
| `review_reference` evidence profile | `shared/ir/lexical_review.py`, `shared/specs/lossless-capture-and-ir.md` |

---

## Provenance profile (implementation-time)

| Field | Value (both records unless noted) |
| --- | --- |
| Source name | `SiraLex owner-reviewed lexical addition` |
| Internal canonical locator | `siralex://lexical-review/7n2a/ndandayoro` / `siralex://lexical-review/7n2a/ndandadiya` |
| Stable source record ID | `7n2a_ndandayoro_v1` / `7n2a_ndandadiya_v1` |
| `retrieved_at` | `2026-07-05T01:19:00Z` |
| `license_notes` | Owner-approved SiraLex project lexical addition; not derived from Mali-Pense. |
| Record pointer kind | `source_record_id` |
| Derivation kind | `owner_approved_lexical_addition` |
| Review reference | `approval_status: owner linguistic approval recorded`; `reviewer_role: project owner / native-speaker linguistic authority` |

No Mali-Pense URL, anchor ID, snapshot ID, or page reference was created.

---

## Semantic content inserted

Both records use only the owner-approved scope:

- French primary gloss: `établissement de santé`
- Definition / usage note (via `gloss_en`): `A location where health-related care or services are received.`

Approved French retrieval labels (`hôpital`, `clinique`, `centre de santé`) are documented for later source-index work only. They were **not** mapped in this slice.

Relationship policy: both forms are separate approved canonical health-institution records. Their exact linguistic relationship remains unclassified. They are not represented as synonyms, interchangeable spellings, dialectal variants, broader/narrower forms, or duplicate records.

### Optional fields omitted

Omitted per instruction (no approved value / no fabrication):

- `headword_nko_provided`
- `part of speech` / `pos_hint` / `ps_raw`
- dialect or geographic scope
- etymology / `literal_meaning_raw`
- `corpus_count`
- ASCII transliteration variants in `anchor_names`
- `reviewed_target_variants`
- French retrieval mappings
- standalone `yoro` or `diya` records

---

## Pipeline commands and results

### 1. Manual lexical-review validation

Owner IR file validated by focused tests and `validate_lexicon_entry_evidence()` during normalization.

### 2. Normalization

**Attempted full authorized input command:**

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --input data/ir/siralex_owner_lexical_v1.jsonl \
  --output data/normalized/malipense_normalized_norm_v3.jsonl \
  -v
```

**Result:** failed during `LexiconVariantRegistry` pre-registration with a pre-existing Mali-Pense N'Ko duplicate (`ߘߊ` shared across multiple lexicon entries). This is a known interaction from `ff269c1` variant-registry registration against the frozen Mali-Pense lexicon; it is outside 7N2A4B allowed code changes.

**Owner-only normalization (successful):**

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/phase7n2a4b_owner_normalized.jsonl \
  -v
```

**Result:** `IR units read: 2`, `Lexicon entries normalized: 2`, `Errors: 0`.

The two owner-normalized rows were merged into `data/normalized/malipense_normalized_norm_v3.jsonl` (total records: `19326`). Projections verified:

- `preferred_form` equals approved canonical form
- `variant_forms` contains canonical form only
- target-side `search_keys` generated from canonical form
- `source_id: src_siralex_lexical_review` preserved

### 3. Enrichment

```bash
PYTHONPATH=api:shared python3 -m enrichment.cli \
  --normalized data/normalized/malipense_normalized_norm_v3.jsonl \
  --ir data/ir/malipense_lexicon_v3.jsonl \
  --ir data/ir/malipense_index_v1.jsonl \
  --ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output data/enriched/malipense_enriched_norm_v3.jsonl \
  -v
```

**Result:** `IR records loaded: 19326`, `Enriched with display: 19326`, `Missing display (no IR): 0`, `Parse errors: 0`.

### 4. Display-only enrichment gate

```bash
PYTHONPATH=api:shared python3 -m enrichment.validate_enrichment_display_only \
  --baseline data/normalized/malipense_normalized_norm_v3.jsonl \
  --enriched data/enriched/malipense_enriched_norm_v3.jsonl \
  -v
```

**Result:** `Display-only enrichment gate PASSED (19326 records by ir_id).`

### 5. Search index / bundle / package

Not built in this slice (per authorization).

---

## Test commands and results

```bash
PYTHONPATH=api:shared pytest api/ir_parser/tests/test_golden_fixtures.py -q
# 25 passed

PYTHONPATH=api:shared pytest api/normalizer/tests/ -q
# 91 passed

PYTHONPATH=api:shared pytest api/source_aliases/tests/ -q
# 22 passed
```

Focused additions in `api/normalizer/tests/test_lexical_review.py`:

- `test_owner_lexical_ir_file_records_validate_and_have_distinct_ir_ids`
- `test_owner_lexical_ir_ids_match_deterministic_repository_method`
- `test_owner_lexical_records_normalize_to_approved_canonical_forms`

---

## Negative guards

| Guard | Confirmation |
| --- | --- |
| 1. No standalone `yoro` record added | Only `ndándayoro` and `ndándadiya` exist in `data/ir/siralex_owner_lexical_v1.jsonl`; no standalone `yoro` row |
| 2. No standalone `diya` record added or changed | No `diya` entry added; existing Mali-Pense `diya` lexicon rows untouched |
| 3. `place → diya` behavior not modified | Index mapping `96b72ff71179d689` unchanged; still lists `díya` among `place` targets |
| 4. No French source-index mapping added | No changes to `shared/source_index_supplements/source_index_supplements_v1.jsonl`; no mappings for `hôpital`, `clinique`, `centre de santé`, `place`, or `location` |
| 5. No source alias added | `shared/aliases/source_aliases_v1.jsonl` unchanged |
| 6. No target variant added | No `reviewed_target_variants` on any record |
| 7. No Mali-Pense lexicon IR changes | `data/ir/malipense_lexicon_v3.jsonl` and `data/ir/malipense_index_v1.jsonl` unchanged |
| 8. Two separate `ir_id`s | `a9c7d82decee9191` and `fefe9b063e05ed11` are distinct |

Additional confirmations:

- No French source mappings exist yet for the approved health labels.
- No standalone `yoro` artifact exists in IR, aliases, supplements, or normalized/enriched projections.
- `place → diya` remains untouched; `yoro` remains unresolved and unindexed.

---

## Files changed

| File | Action |
| --- | --- |
| `data/ir/siralex_owner_lexical_v1.jsonl` | created (2 `lexicon_entry` rows) |
| `data/normalized/malipense_normalized_norm_v3.jsonl` | updated (+2 normalized rows) |
| `data/enriched/malipense_enriched_norm_v3.jsonl` | regenerated (19326 rows, display gate passed) |
| `api/normalizer/tests/test_lexical_review.py` | extended (+3 focused tests) |
| `docs/reports/phase7n2a4b_manual_lexical_records_report.md` | created (this report) |

Repository note: `data/` is listed in `.gitignore` as local pipeline artifacts. Committed git changes for this slice are the focused tests and this report; data artifacts are present on disk for downstream pipeline use.

---

## Authorization boundary

Unchanged by design:

- French retrieval mappings (`hôpital`, `clinique`, `centre de santé`)
- source aliases and target variants
- search runtime
- bundles, packages, catalog files
- release documents

Phase 7N2A4B added only the two approved manual lexical records with traceable owner-review provenance. French retrieval mappings, aliases, target variants, bundles, and user-visible search behavior remain unchanged.
