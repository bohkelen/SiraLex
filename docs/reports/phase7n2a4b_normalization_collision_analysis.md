# Phase 7N2A4B Normalization Collision Analysis

**Status:** proposed fix design only (Phase 7N2A4B-R Part C)  
**Scope:** read-only investigation — **no code or data changes in this task**

---

## Problem statement

Full combined-input normalization:

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --input data/ir/siralex_owner_lexical_v1.jsonl \
  --output data/normalized/malipense_normalized_norm_v3.jsonl
```

fails during the **pre-normalization** `LexiconVariantRegistry.register_source_attested()` pass introduced in commit `ff269c1dcae534ec45daeee3efcc8c658441e421`.

Observed error (first failure):

```text
duplicate lexical form 'ߘߊ' conflicts with record 964909ef6912ff64
```

`process_ir_files()` logs the warning, increments `errors`, and **returns before writing any normalized output**.

---

## Investigation answers

### 1. What two frozen records/forms collide?

| Role | Line | `ir_id` | `headword_latin` | `headword_nko_provided` | `anchor_names` |
| --- | --- | --- | --- | --- | --- |
| First registered (owner) | 1 | `964909ef6912ff64` | `-da` | `ߘߊ` | `["-da"]` |
| Collision on register | 2 | `d426e49d1e2ab3d9` | `dá` | `ߘߊ` | `["dá", "da"]` |

**Colliding form:** N'Ko `ߘߊ` (U+07D8 U+07CA), NFC-normalized key identical for both records.

### 2. Which normalized key and variant class causes the collision?

| Property | Value |
| --- | --- |
| Registry key function | `_nfc_key(form)` → `normalize_nfc(form.strip())` |
| Colliding key | NFC of `ߘߊ` |
| Variant class | **Source-attested N'Ko** via `fields_raw.headword_nko_provided` included in `LexiconVariantRegistry.source_attested_forms()` |
| Registration path | `register_source_attested()` during full-corpus pre-scan in `process_ir_files()` |

Latin headwords (`-da` vs `dá`) and Latin anchors do not collide on this step; the failure is strictly the shared N'Ko provided headword.

### 3. Did `ff269c1` introduce a new invariant that previously valid frozen input cannot satisfy?

**Yes.**

| Before `ff269c1` | After `ff269c1` |
| --- | --- |
| No `LexiconVariantRegistry` global pre-scan | Pre-scan registers **all** source-attested forms (Latin headword, Latin anchors, **N'Ko headword**) into one global `form → ir_id` map |
| Full lexicon normalized without cross-record form uniqueness | First cross-record duplicate form aborts entire pipeline |

Frozen `malipense_lexicon_v3.jsonl` was normalized to `malipense_normalized_norm_v3.jsonl` under rules that did not enforce global N'Ko uniqueness. The corpus contains **1,408 duplicate `headword_nko_provided` keys** across **6,782** N'Ko-bearing entries (including **5** entries sharing `ߘߊ`).

### 4. Collision classification

| Hypothesis | Verdict |
| --- | --- |
| Same canonical record represented twice | **No** — distinct `ir_id`, `source_record_id`, evidence blocks, and Latin headwords |
| Legitimate distinct records | **Yes** — separate Mali-Pense entries (`e2203` `-da` vs `e2204` `dá`) with distinct senses |
| N'Ko-specific normalization equivalence | **Yes** — registry treats identical N'Ko provided forms as one global target key |
| Genuine frozen data defect | **No** — homograph/polysemy with shared N'Ko rendering is expected in source dictionary encoding |

### 5. Narrowest correction restoring full normalization without weakening reviewed-target-variant protection

**Design principle:** separate **variant classes** with different collision policies.

| Variant class | Source | Global cross-record uniqueness | Rationale |
| --- | --- | --- | --- |
| Latin source-attested | `headword_latin`, `record_locator.anchor_names` | **Fail-closed** (keep) | Prevents reviewed / authored Latin target collisions across records |
| N'Ko source-attested | `headword_nko_provided` | **Do not register globally** | Frozen corpus legitimately reuses N'Ko forms across distinct Latin entries |
| Reviewed target variant | `reviewed_target_variants[].form` | **Fail-closed against Latin global map + per-record anchors** (keep) | 7N2A `móbaa`-style protection unchanged |

#### Proposed code change (single locus)

**File:** `shared/ir/lexical_review.py`  
**Method:** `LexiconVariantRegistry.source_attested_forms()`

Remove `headword_nko_provided` from forms fed into `register_source_attested()` / global `_register_form()`.

```python
# Proposed: return Latin attested forms only for global registry
def source_attested_forms(self, ir_unit: dict[str, Any]) -> list[str]:
    ...
    # omit headword_nko_provided from global registry list
```

**Do not change:** `normalize_lexicon_entry()` behavior that appends `headword_nko_provided` to `variant_forms` and `search_keys` — frozen per-record normalization output stays the same.

**Do not change:** `validate_reviewed_variant()` fail-closed logic against global Latin map and same-record `anchor_names`.

#### Why this is narrow enough

- Fixes first failure at line 2 and all 1,408 N'Ko duplicate classes without touching Mali-Pense IR.
- Preserves the **purpose** of `ff269c1`: block `reviewed_target_variants` from introducing Latin target keys that collide with another record's attested Latin forms.
- Does **not** globally weaken duplicate detection for newly authored reviewed variants.
- Does **not** rewrite existing frozen source-attested variants.

#### Explicit non-solutions (rejected)

| Approach | Rejection reason |
| --- | --- |
| Deduplicate / merge Mali-Pense rows | Forbidden — frozen data must not change |
| Warn-and-continue on all duplicates | Would weaken reviewed-target protection if applied broadly |
| Remove `LexiconVariantRegistry` entirely | Removes 7N2A reviewed-variant fail-closed guarantees |
| Register N'Ko with composite key `(script, form)` but still global | Still fails on identical N'Ko across records |
| Skip pre-scan; validate only at reviewed-variant merge time | Allows undetected Latin cross-record duplicates until merge |

---

## Verification plan (future implementation slice)

After applying the proposed fix:

1. Full 3-file normalization completes with `errors: 0`.
2. Output record count = prior baseline + 2 owner lexical rows (expected 19,326 if Mali-Pense/index counts unchanged).
3. Existing `api/normalizer/tests/test_lexical_review.py` reviewed-variant collision tests still pass.
4. Add regression test: frozen lexicon first two entries register without abort (N'Ko duplicate tolerated).
5. Add regression test: reviewed Latin variant still fails when colliding with another record's Latin anchor.

---

## Relationship to 7N2A4B acceptance

Owner lexical records (`ndándayoro`, `ndándadiya`) are not themselves the collision source. They normalize successfully in isolation. **7N2A4B cannot be accepted until:**

1. Registry repair lands (this design), and  
2. Full combined-input normalization succeeds reproducibly, and  
3. Authoritative owner IR is tracked in Git with complete provenance.

---

## Confirmation

This document is design-only. No normalizer code, frozen Mali-Pense data, aliases, indexes, bundles, packages, runtime, or release artifacts were modified.
