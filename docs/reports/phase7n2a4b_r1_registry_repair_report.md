# Phase 7N2A4B-R1 Registry Repair Report

**Status:** normalizer/schema-support repair complete  
**Regression source:** `ff269c1dcae534ec45daeee3efcc8c658441e421`  
**Scope:** `LexiconVariantRegistry` collision handling only — no owner-record acceptance

---

## Registry behavior changed

| Area | Before (`ff269c1`) | After (7N2A4B-R1) |
| --- | --- | --- |
| `source_attested_forms()` | Included `headword_latin`, `anchor_names`, and `headword_nko_provided` | Includes **Latin only** (`headword_latin`, `anchor_names`); **excludes N'Ko** |
| `register_source_attested()` | Single-owner map; **aborted** on any cross-record duplicate form | **Indexes** Latin attested forms into `_attested_form_to_ir_ids` multimap without aborting on frozen homographs |
| `validate_reviewed_variant()` | Checked single-owner `_form_to_ir_id` | **Fail-closed** against other records' attested Latin forms (multimap) and other records' reviewed forms (`_reviewed_form_to_ir_id`) |
| `register_reviewed_form()` | Used shared single-owner `_register_form` | **Fail-closed** single-owner map for reviewed forms only |
| Per-record N'Ko normalization | Unchanged (`normalize_lexicon_entry` still appends `headword_nko_provided` to `variant_forms` / `search_keys`) | Unchanged |

**File modified:** `shared/ir/lexical_review.py`

**Follow-on discovery:** After N'Ko exclusion, the first Latin homograph collision appeared at lexicon line 3 (`dá` on `ebed285ff74ad84d` vs `d426e49d1e2ab3d9`). The frozen corpus contains **1,458** cross-record Latin form overlaps. Indexing Latin attested forms without aborting is required to restore full frozen normalization while preserving fail-closed reviewed-target-variant checks.

---

## Results summary

| Area | Result |
| --- | --- |
| Exact registry behavior changed | N'Ko removed from global registry; Latin attested forms indexed in multimap; reviewed variants remain fail-closed |
| N'Ko collision test | **PASS** — `964909ef6912ff64` (`-da`) and `d426e49d1e2ab3d9` (`dá`) register without abort |
| Latin collision guard | **PASS** — reviewed variant `bá` on second record fails against first record's attested Latin |
| Reviewed variant collision guard | **PASS** — same-record anchor duplicate and cross-record Latin conflicts still fail |
| Frozen baseline normalization | **PASS** — 19,324 units, 0 errors |
| Combined-input normalization | **PASS** — 19,326 units (+2 local owner rows), 0 errors |
| Frozen output stability | **PASS** — 19,324 frozen `ir_id`s match baseline on `preferred_form`, `variant_forms`, `search_keys`; 0 substantive drift |
| Owner-record acceptance status | **NOT ACCEPTED** — see below |

---

## Tests

```bash
PYTHONPATH=api:shared pytest api/normalizer/tests/test_lexical_review.py -q
# 13 passed

PYTHONPATH=api:shared pytest api/normalizer/tests/ -q
# 91 passed

PYTHONPATH=api:shared pytest api/ir_parser/tests/test_golden_fixtures.py -q
# 25 passed

PYTHONPATH=api:shared pytest api/source_aliases/tests/ -q
# 22 passed
```

New/updated durable tests (inline fixtures only; no ignored `data/ir/siralex_owner_lexical_v1.jsonl`):

- `test_shared_nko_homographs_register_without_global_collision`
- `test_nko_headword_remains_in_per_record_variant_forms_and_search_keys`
- `test_duplicate_latin_attested_forms_block_reviewed_variants_across_records`
- Existing reviewed-target-variant happy-path and collision tests retained

Removed from this file: three tests that loaded ignored owner lexical IR from disk (from prior incomplete 4B commit).

---

## Local normalization verification

### Frozen baseline

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --output /tmp/siralex_norm_7n2a4b_r1_frozen.jsonl \
  -v
```

| Metric | Value |
| --- | --- |
| IR units read | 19,324 |
| Lexicon entries normalized | 8,823 |
| Index mappings normalized | 10,501 |
| Errors | 0 |

### Combined-input mechanical check

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --input data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/siralex_norm_7n2a4b_r1_combined.jsonl \
  -v
```

| Metric | Value |
| --- | --- |
| IR units read | 19,326 |
| Lexicon entries normalized | 8,825 |
| Index mappings normalized | 10,501 |
| Errors | 0 |

This run uses the existing local owner IR file only as a temporary third input. It proves the N'Ko registry collision no longer blocks normalization. It does **not** validate owner-record provenance, source-control status, or 7N2A4B acceptance.

---

## Frozen output stability

Compared `/tmp/siralex_norm_7n2a4b_r1_frozen.jsonl` against `data/normalized/malipense_normalized_norm_v3.jsonl`, excluding two local owner `ir_id`s present in the prior baseline from incomplete 4B work (`a9c7d82decee9191`, `fefe9b063e05ed11`).

| Check | Result |
| --- | --- |
| Frozen `ir_id` set equality | 19,324 = 19,324 |
| `preferred_form` drift | 0 |
| `variant_forms` drift | 0 |
| `search_keys` drift | 0 |
| N'Ko on collision owners | `ߘߊ` present on `964909ef6912ff64` and `d426e49d1e2ab3d9` |

---

## Owner-record acceptance status

```text
The repair does not make Phase 7N2A4B accepted.

The owner lexical IR remains untracked and incomplete with respect to required
machine-readable provenance.

The combined-input run proves only that the N'Ko registry collision no longer
blocks normalization.
```

---

## Files changed

| File | Action |
| --- | --- |
| `shared/ir/lexical_review.py` | registry repair |
| `api/normalizer/tests/test_lexical_review.py` | durable collision tests; removed ignored-path owner tests |
| `docs/reports/phase7n2a4b_r1_registry_repair_report.md` | this report |

**Not changed:** frozen Mali-Pense IR, owner IR content, `.gitignore`, normalized/enriched authoritative paths, aliases, indexes, bundles, packages, runtime, catalog, release documents.

Phase 7N2A4B-R1 repaired frozen N'Ko collision handling without weakening reviewed target-variant protection. Owner lexical records remain unaccepted until source control and machine-readable provenance are completed.
