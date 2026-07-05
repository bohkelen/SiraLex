# Phase 7N2A4B-R1A Variant Guard Report

**Status:** validation-only hardening complete  
**Scope:** same-record reviewed-target-variant duplication paths only

---

## Guard changes

| Guard | Prior behavior | New behavior | Test result |
| ----- | -------------- | ------------ | ----------- |
| A — own `headword_latin` collision | Rejected only when form matched `anchor_names`; own canonical headword with empty or non-matching anchors could pass | `validate_reviewed_variant()` rejects when NFC(`reviewed.form`) equals NFC(`fields_raw.headword_latin`) with error `duplicates canonical headword_latin` | **PASS** — empty anchors and omitted-headword anchor cases |
| B — duplicate reviewed forms (same record) | Duplicate `reviewed_target_variants[].form` entries could pass because per-item validation did not compare within-record list | `parse_reviewed_target_variants()` rejects duplicate NFC keys within one record with error `contains duplicate form` | **PASS** — exact and NFC-equivalent duplicates |
| Same-record `anchor_names` duplicate | Fail-closed | Unchanged | **PASS** — existing test |
| Cross-record attested Latin collision | Fail-closed | Unchanged | **PASS** — existing test |
| Cross-record reviewed-form collision | Fail-closed | Unchanged | **PASS** — existing test |
| Frozen N'Ko homograph registration | Non-aborting index; per-record N'Ko in variants | Unchanged | **PASS** — existing test |
| Single reviewed-variant happy path | Valid merge into `variant_forms` / `search_keys` | Unchanged | **PASS** — existing test |
| Rows without `reviewed_target_variants` | Unchanged normalization | Unchanged | **PASS** — existing test |

---

## Guard logic added

### Guard A — `LexiconVariantRegistry.validate_reviewed_variant()`

Before anchor and cross-record checks, compare NFC(`variant.form`) to NFC(`fields_raw.headword_latin`). Raise `LexicalReviewValidationError` when equal:

```text
reviewed_target_variants.form duplicates canonical headword_latin on <ir_id>
```

### Guard B — `parse_reviewed_target_variants()`

After parsing all items, track seen NFC keys per record. Raise on second occurrence:

```text
reviewed_target_variants contains duplicate form on <ir_id>
```

---

## Tests

```bash
git diff --check
# (clean)

PYTHONPATH=api:shared pytest api/normalizer/tests/test_lexical_review.py -q
# 17 passed

PYTHONPATH=api:shared pytest api/normalizer/tests/ -q
# 95 passed

PYTHONPATH=api:shared pytest api/ir_parser/tests/test_golden_fixtures.py -q
# 25 passed

PYTHONPATH=api:shared pytest api/source_aliases/tests/ -q
# 22 passed
```

New inline-fixture tests:

- `test_reviewed_variant_equal_to_own_headword_fails_with_empty_anchor_names`
- `test_reviewed_variant_equal_to_own_headword_fails_when_anchor_omits_headword`
- `test_duplicate_reviewed_variants_on_same_record_fail`
- `test_nfc_equivalent_duplicate_reviewed_variants_on_same_record_fail`

---

## Explicit scope boundaries

```text
This patch does not alter frozen source-attested homograph handling.

This patch does not accept the owner lexical records.

This patch only closes same-record reviewed-target-variant duplication paths.
```

---

## Files changed

| File | Action |
| --- | --- |
| `shared/ir/lexical_review.py` | Guard A in `validate_reviewed_variant`; Guard B in `parse_reviewed_target_variants` |
| `api/normalizer/tests/test_lexical_review.py` | Four new guard tests + `reviewed_variant_holder_ir` helper |
| `docs/reports/phase7n2a4b_r1a_variant_guard_report.md` | this report |

**Not changed:** owner lexical IR, provenance, `.gitignore`, normalized/enriched data, aliases, supplements, indexes, bundles, packages, runtime, catalog, release documents. No normalization or generation commands were run.

Phase 7N2A4B-R1A closes same-record reviewed-target-variant duplication paths without changing frozen homograph handling or accepting owner lexical records.
