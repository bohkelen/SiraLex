# Phase 7N2A3 Schema and Artifact-Design Authorization

**Status:** design and authorization document only  
**Basis:** `docs/reports/phase7n2a_implementation_readiness_audit.md`  
**Commit basis:** `4ca8720` (ndándayoro spelling correction)  
**Implementation authorization:** not authorized by this document

This document resolves the three technical representation gaps identified by the 7N2A2 readiness audit and corrects the health-index mapping policy for approved French retrieval labels. It authorizes bounded future schema and artifact designs only. It does not authorize dictionary source-data mutation, alias rows, supplement rows, validator implementation, generator implementation, index rebuild, bundle generation, or runtime change.

---

## Authorization Boundary

This document authorizes **design decisions and future slice boundaries** only.

It does **not** authorize edits to:

```text
data/ir/
data/normalized/
data/enriched/
shared/aliases/source_aliases_v1.jsonl
shared/source_index_supplements/source_index_supplements_v1.jsonl
search runtime
generated indexes
bundles
packages
catalog files
release-status files
```

---

## Decision 1 — Manual Canonical Lexical-Record Provenance

### Problem

`ndándayoro` and `ndándadiya` are owner-approved canonical Maninka lexical candidates with no Mali-Pense page evidence. They must not be represented as scraped Mali-Pense records.

### Design decision

**Approved design:** introduce a narrowly scoped **project lexical-review source** and **manual owner-approved lexical IR profile**. This is not a blocker; it requires the smallest schema/spec extensions listed below before 7N2A4B.

### Required future classification

```text
record origin: manually approved project lexical addition
derivation kind: owner_approved_lexical_addition
evidence: owner review-sheet reference plus implementation-time evidence object
```

`owner_approved_lexical_addition` is the explicit repository-approved manual derivation value for new lexical content. It is distinct from `manual_override`, which in `shared/specs/provenance.md` applies to corrections against existing immutable evidence.

### Minimum compliant representation

| Field | Future requirement | Design rule |
| --- | --- | --- |
| `source_id` | New registry source, not `src_malipense` | Register `src_siralex_lexical_review` in Source Registry and `shared/sources/` |
| `source_record_id` | Stable project record id per candidate | Pattern: `7n2a_<candidate_slug>_v1`; exact value chosen at implementation time from owner-approved NFC form |
| `url_canonical` | Internal canonical locator, not a public Mali-Pense URL | Pattern: `siralex://lexical-review/7n2a/<candidate_slug>` |
| `parser_version` | Separate parser identity for manual additions | `siralex_owner_lexical_v1` |
| `ir_id` | Deterministic from locator components | `compute_ir_id(source_id, url_canonical, source_record_id, parser_version)` |
| `record_locator.kind` | `source_record_id` | Uses project `source_record_id`; must not reuse Mali-Pense `e####` ids |
| `record_locator.url_canonical` | Same internal URI as above | Must not point at `https://www.mali-pense.net/...` unless the content actually came from that page |
| `record_locator.anchor_names` | Owner-approved headword variants only | Contains the approved canonical Maninka form and audited spelling variants; not Mali-Pense crawl output |
| `evidence[]` | Review-sheet anchored evidence object | See below |
| `provenance.source.id` | `src_siralex_lexical_review` | Copied into normalized/enriched provenance projection at implementation time |
| `provenance.source.name` | Human-readable project lexical-review source name | Example class: `SiraLex owner-reviewed lexical addition` |
| `provenance.source.url` | Repository documentation URL or `null` | Must not fabricate a Mali-Pense page URL |
| `provenance.source.retrieved_at` | Implementation-time ISO timestamp | Required; chosen when record is inserted |
| `provenance.source.license_notes` | Project lexical-review license posture | Required free-text note; may reference owner approval and non-Mali-Pense origin |
| `provenance.source.record_pointer.kind` | `source_record_id` | Points to project record identity, not Mali-Pense anchor |
| `provenance.source.record_pointer.source_record_id` | Same as IR `source_record_id` | Stable across rebuilds |
| `provenance.source.record_pointer.url_canonical` | Same internal URI | No fabricated public URL |
| `provenance.source.record_pointer.snapshot_id` | Absent | Do not invent snapshot ids |
| `derivation.kind` | `owner_approved_lexical_addition` | New approved derivation enum value |
| `derivation.rule_versions.normalization` | Active ruleset, e.g. `norm_v3` | Required on derived records |

### Required `evidence[]` shape for manual lexical records

Smallest safe extension to lossless IR evidence:

```json
{
  "source_id": "src_siralex_lexical_review",
  "review_reference": {
    "document_path": "docs/reviews/phase7n2a_ndandayoro_lexical_review.md",
    "approval_status": "owner linguistic approval recorded",
    "reviewer_role": "project owner / native-speaker linguistic authority"
  },
  "text_quote": "<owner-approved candidate form at implementation time>"
}
```

Rules:

- `review_reference.document_path` must point to the matching Phase 7N2A review sheet.
- `text_quote` must equal the approved candidate form once NFC/tone normalization is complete.
- No `snapshot_id` is required for this evidence class.
- Evidence must not claim Mali-Pense page extraction.

### Future metadata fields for `ndándayoro` and `ndándadiya`

Do not invent values now. Implementation must supply:

```text
owner-approved NFC headword_latin
record_locator.anchor_names[]
fields_raw.senses[] with approved French health-institution glosses
fields_raw.literal_meaning_raw or usage note, if used
part of speech, if used
provenance.source.retrieved_at
provenance.source.license_notes
reviewer and reviewed_at cross-reference
stable source_record_id per candidate
deterministic ir_id from approved locator components
```

### Smallest required schema/spec extensions (7N2A4A)

| Artifact | Extension |
| --- | --- |
| `shared/specs/source-registry.md` | Document `src_siralex_lexical_review` contract |
| `shared/sources/siralex_lexical_review.yaml` | New source registry entry |
| `shared/specs/provenance.md` | Add `owner_approved_lexical_addition` to `derivation.kind` enum |
| `shared/specs/lossless-capture-and-ir.md` | Add manual lexical-review evidence profile with `review_reference` |
| `data/ir/siralex_owner_lexical_v1.jsonl` | New IR file for project lexical additions; normalized alongside Mali-Pense IR |

Rationale for separate IR file: keeps frozen Mali-Pense lexicon semantics intact while allowing deterministic mixed-source normalization input.

### Principles preserved

```text
Manual owner-approved content is identifiable via source_id and derivation.kind.
No Mali-Pense locator is reused without Mali-Pense evidence.
ir_id generation remains deterministic from stable locator components.
Review-sheet reference is mandatory in evidence.
Repository provenance minimum fields are required.
No fabricated public Mali-Pense URLs are used.
```

---

## Decision 2 — `móbaa` Target-Side Variant Architecture

### Proposed approach audited

```text
Add móbaa to record_locator.anchor_names on canonical record c5f78c8ac66eac6b.
```

### Contract audit

`record_locator.anchor_names` is populated by the Mali-Pense parser from source HTML anchors and is the normalization source for `variant_forms` (`api/normalizer/normalize.py`). It is a **source-location / source-attested spelling variant** field, not an editorial target-variant field.

`fields_raw.variants_raw` exists but is **not** consumed by the normalizer for search keys. Therefore pattern **A** is rejected.

Pattern **C** (dedicated target-alias artifact) is viable but broader than required for one bounded 7N2A variant.

### Chosen pattern

**B. Add a narrowly scoped explicit IR field for reviewed target variants**

### Approved field design

Add to existing Mali-Pense lexicon IR row `c5f78c8ac66eac6b` only:

```json
"reviewed_target_variants": [
  {
    "form": "<owner-approved NFC móbaa at implementation time>",
    "review_document": "docs/PHASE_7K1_STRUCTURED_USABILITY_TRIAGE.md",
    "reviewer": "<implementation-time reviewer id>",
    "reviewed_at": "<ISO date>",
    "rationale": "Owner-approved target-side variant of móyibaa; same lexical concept; no separate record."
  }
]
```

Field placement: top-level on the `lexicon_entry` IR unit, sibling to `fields_raw` and `record_locator`.

### Future files that would change

| File | Change |
| --- | --- |
| `shared/specs/lossless-capture-and-ir.md` | Define `reviewed_target_variants[]` contract |
| `shared/ir/models.py` | Model support for reviewed target variants |
| `data/ir/malipense_lexicon_v3.jsonl` | Add `reviewed_target_variants` to row `c5f78c8ac66eac6b` only |
| `api/normalizer/normalize.py` | Merge approved `reviewed_target_variants[].form` into `variant_forms` after source `anchor_names` |
| `api/normalizer/tests/test_norm_v3.py` | Variant-merge regression |
| `api/ir_parser/tests/test_golden_fixtures.py` | Locator-integrity guard: `record_locator.anchor_names` unchanged for scraped rows |

### Normalization / index effect

- `preferred_form` remains `móyibaa`
- `variant_forms` becomes source `anchor_names` plus reviewed `móbaa`
- `search_keys` and `tgt_*` index keys are generated for `móbaa`
- All keys resolve to the same `ir_id` `c5f78c8ac66eac6b`

### Provenance / reviewer metadata

Stored inside each `reviewed_target_variants[]` item. Must not be placed in `record_locator`.

### Duplicate-prevention rule

- `reviewed_target_variants[].form` must not equal an existing `record_locator.anchor_names` entry under NFC comparison.
- `reviewed_target_variants[].form` must not be assigned to a different `ir_id`.
- Normalizer/test gate fails closed if `móbaa` would create a second lexicon row or alter `preferred_form`.

### Required regression cases

```text
phase7n2a_mobaa_variant_to_moyibaa
phase7n2a_moyibaa_existing_guard
```

### Source locator integrity preserved

`record_locator` and Mali-Pense `evidence[]` remain untouched. Editorial variant is carried in `reviewed_target_variants`, merged only at normalization time for search/index purposes.

### Approved semantic invariant

```text
móbaa → same canonical lexical concept as móyibaa
canonical concept: c5f78c8ac66eac6b
no duplicate lexical record
no global contraction, deletion, vowel folding, or tone folding
```

---

## Decision 3 — `maman` Alias Candidate Type

### Smallest approved extension

Add one new candidate type:

```text
candidate_type: french_common_form_alias
```

### Semantics

A reviewed informal or common French form that routes to an existing canonical French source term already present in the base source index. It copies the canonical term’s deterministic posting list exactly. It does not create new index mappings and does not perform ranking redesign.

### Files requiring update in 7N2A4D

| File | Update |
| --- | --- |
| `shared/specs/source-alias-table-v1.md` | Add `french_common_form_alias` to allowed candidate types and document bounded semantics |
| `api/source_aliases/validate_alias_table.py` | Add `french_common_form_alias` to `ALLOWED_CANDIDATE_TYPES` |
| `api/source_aliases/tests/test_source_aliases.py` | Add validation/applications tests for the new type |

### Schema version

`schema_version: source_alias_table_v1` remains valid. No schema version bump required.

### Existing alias rows

All existing approved alias rows remain unaffected. The validator change is additive only.

### Intended future alias row (not authored now)

```text
alias_source_term: maman
canonical_source_terms: ["mère"]
resolved_ir_ids: [<posting of index_mapping e5164efcdf5e6ca4 only>]
candidate_type: french_common_form_alias
```

Bounded exclusions:

```text
must not include 0f517a71c373f51d
must not include d540716db9321a83
no global ranking redesign
```

---

## Decision 4 — Health-Institution Source-Index Mapping

### Policy correction

The readiness audit treated additive `hôpital` mapping as optional. **7N2A3 corrects that policy.**

Owner approval requires both `ndándayoro` and `ndándadiya` to support:

```text
hôpital
clinique
centre de santé
```

Therefore:

```text
hôpital → additive_source_mapping after both canonical records exist
clinique → new_source_mapping after both canonical records exist
centre de santé → new_source_mapping after both canonical records exist
hôpital → dándaso must remain present
place → diya must remain unchanged
```

### Mandatory future mapping matrix

| French source term | Supplement mode | Required targets | Existing target preserved? | Explicit false-positive guard |
| --- | --- | --- | --- | --- |
| `hôpital` | `additive_source_mapping` | `ndándayoro` lexicon `ir_id` and `ndándadiya` lexicon `ir_id`, in approved order, **plus** existing `dándaso` (`71e323e2dafa590f`) | **Yes** — base index row `61843e6630c1fbae → 71e323e2dafa590f` must remain | `phase7n2a_hopital_existing_dandaso_guard` |
| `clinique` | `new_source_mapping` | `ndándayoro` and `ndándadiya` lexicon `ir_id`s | N/A — term absent today | `phase7n2a_clinique_reviewed_health_term` |
| `centre de santé` | `new_source_mapping` | `ndándayoro` and `ndándadiya` lexicon `ir_id`s | N/A — term absent today | `phase7n2a_centre_de_sante_reviewed_health_term` |
| `place` | **no 7N2A mapping permitted** | none | **Yes** — existing `place` posting `96b72ff71179d689` including `díya` (`de6fb406453616e3`) | `phase7n2a_place_location_false_positive` |
| `location` | **no 7N2A mapping permitted** | none | **Yes** — no new French source-index row; no broad location expansion | `phase7n2a_place_location_false_positive` |

### Standalone `yoro`

```text
no lexical record
no target alias
no source alias
no source-index mapping
```

---

## Required Technical Decision Table

| Concern | Current state | Decision | Future artifact(s) | Implementation blocker removed? | Remaining guard |
| --- | --- | --- | --- | --- | --- |
| manual provenance | No safe non-Mali-Pense lexical profile | Approve `src_siralex_lexical_review` + `owner_approved_lexical_addition` + `review_reference` evidence | `shared/sources/siralex_lexical_review.yaml`, `data/ir/siralex_owner_lexical_v1.jsonl`, spec extensions | **Yes**, after 7N2A4A | NFC/tone/POS/provenance fields still required at insertion time |
| `ndándayoro` | Absent from source data | Manual lexical addition under project lexical-review source | `data/ir/siralex_owner_lexical_v1.jsonl` | **Yes**, after 7N2A4A + 7N2A4B | No `place` / `location` mapping; standalone `yoro` forbidden |
| `ndándadiya` | Absent from source data | Manual lexical addition under project lexical-review source | `data/ir/siralex_owner_lexical_v1.jsonl` | **Yes**, after 7N2A4A + 7N2A4B | Same guards as `ndándayoro` |
| `móbaa` | Absent; `anchor_names` edit invalid | Pattern **B**: `reviewed_target_variants[]` on `c5f78c8ac66eac6b` | IR edit + normalizer extension | **Yes**, after 7N2A4A + 7N2A4C | No duplicate record; no global folding rules |
| `maman` | No `french_common_form_alias` type | Add `french_common_form_alias` to source-alias v1 | `shared/aliases/source_aliases_v1.jsonl` row in 7N2A4D | **Yes**, after 7N2A4D spec/validator update | Copies only `e5164efcdf5e6ca4`; no vocative/respectful rows |
| `hôpital` additive mapping | Readiness doc called it optional | **Mandatory** `additive_source_mapping` to both approved compounds while preserving `dándaso` | `shared/source_index_supplements/source_index_supplements_v1.jsonl` | **Yes**, after 7N2A4B + 7N2A4E | `phase7n2a_hopital_existing_dandaso_guard` |
| `clinique` mapping | Blocked pending lexical targets | **Mandatory** `new_source_mapping` to both approved compounds | supplement row in 7N2A4E | **Yes**, after 7N2A4B + 7N2A4E | No broad place labels |
| `centre de santé` mapping | Blocked pending lexical targets | **Mandatory** `new_source_mapping` to both approved compounds | supplement row in 7N2A4E | **Yes**, after 7N2A4B + 7N2A4E | Multi-word only for this approved health path |
| `place → diya` guard | Existing base index path | **No 7N2A change** | none | N/A | `phase7n2a_place_location_false_positive` |
| `yoro` unresolved guard | Unresolved standalone component | **No artifact of any kind** | none | N/A | Must not index under `place`, `location`, or any 7N2A path |

---

## Future Implementation Slices

No slice authorizes work from another slice without explicit dependency completion.

### 7N2A4A — Provenance/schema support

| Item | Content |
| --- | --- |
| **Preconditions** | 7N2A3 design authorization recorded |
| **Allowed files** | `shared/specs/provenance.md`, `shared/specs/lossless-capture-and-ir.md`, `shared/specs/source-registry.md`, `shared/sources/siralex_lexical_review.yaml`, `shared/ir/models.py`, `api/normalizer/normalize.py`, related tests/docs listed in decisions 1–3 |
| **Forbidden files** | `data/ir/*` lexical rows, alias rows, supplement rows, bundles, runtime |
| **Tests** | Spec/unit tests for new derivation enum, `review_reference` evidence parsing, `reviewed_target_variants` merge rules, `french_common_form_alias` validator allowance |
| **Exit criteria** | Specs merged; validator/normalizer support landed; no lexical rows or search artifacts changed |

### 7N2A4B — Canonical lexical records

| Item | Content |
| --- | --- |
| **Preconditions** | 7N2A4A complete; review sheets complete pending NFC/tone/POS/provenance fields; separate maintainer insertion authorization |
| **Allowed files** | `data/ir/siralex_owner_lexical_v1.jsonl`, normalization/enrichment outputs derived from approved insertion |
| **Forbidden files** | Mali-Pense locator forgery, alias/supplement tables, bundles, runtime |
| **Tests** | IR validation, normalization golden checks, enrichment display-only gate |
| **Exit criteria** | `ndándayoro` and `ndándadiya` normalize and enrich deterministically with manual provenance intact |

### 7N2A4C — Target variant support for `móbaa`

| Item | Content |
| --- | --- |
| **Preconditions** | 7N2A4A complete; exact NFC `móbaa` approved |
| **Allowed files** | `data/ir/malipense_lexicon_v3.jsonl` row `c5f78c8ac66eac6b` only, normalizer outputs |
| **Forbidden files** | New lexicon row for `móbaa`, global folding rules, alias/supplement tables, runtime |
| **Tests** | `test_norm_v3.py`, `phase7n2a_mobaa_variant_to_moyibaa`, `phase7n2a_moyibaa_existing_guard` |
| **Exit criteria** | `móbaa` resolves to `c5f78c8ac66eac6b`; `móyibaa` unchanged |

### 7N2A4D — `maman` source alias support

| Item | Content |
| --- | --- |
| **Preconditions** | 7N2A4A `french_common_form_alias` support complete |
| **Allowed files** | `shared/aliases/source_aliases_v1.jsonl` (one bounded row), alias validator/applier outputs |
| **Forbidden files** | `records.jsonl` mutation, ranking/runtime changes, supplement rows |
| **Tests** | `api/source_aliases/tests/test_source_aliases.py`, `phase7n2a_maman_generic_mother_primary`, `phase7n2a_mere_generic_mother_rank_guard` |
| **Exit criteria** | `maman` copies only `e5164efcdf5e6ca4`; vocative/respectful rows excluded |

### 7N2A4E — Health-institution source-index supplements

| Item | Content |
| --- | --- |
| **Preconditions** | 7N2A4B complete; both lexicon `ir_id`s known and validated |
| **Allowed files** | `shared/source_index_supplements/source_index_supplements_v1.jsonl`, generated supplement records, merged search index |
| **Forbidden files** | Overwrite of `61843e6630c1fbae`, any `place` / `location` supplement, standalone `yoro` artifacts, runtime |
| **Tests** | `api/source_index_supplements/tests/`, `phase7n2a_hopital_existing_dandaso_guard`, `phase7n2a_clinique_reviewed_health_term`, `phase7n2a_centre_de_sante_reviewed_health_term`, `phase7n2a_ndandayoro_no_place_false_positive`, `phase7n2a_ndandadiya_no_place_false_positive` |
| **Exit criteria** | `hôpital` retains `dándaso` and adds both compounds; `clinique` and `centre de santé` map to both compounds only |

### 7N2A4F — Regression matrix and candidate bundle

| Item | Content |
| --- | --- |
| **Preconditions** | 7N2A4B, 7N2A4C, 7N2A4D, 7N2A4E complete |
| **Allowed files** | `shared/search_regression/search_regression_matrix_v1.jsonl`, candidate bundle under `build/bundles/`, optional package under `build/packages/` |
| **Forbidden files** | Catalog publication, release-status promotion, runtime ranking redesign |
| **Tests** | Phase 7L Python + runtime regression; full relevant alias/supplement suites |
| **Exit criteria** | All 7N2A regression identifiers pass; candidate identity and checksums recorded; human review completed |

### Slice dependency graph

```text
7N2A4A
  ├─> 7N2A4B
  ├─> 7N2A4C
  └─> 7N2A4D
7N2A4B ──> 7N2A4E
7N2A4B + 7N2A4C + 7N2A4D + 7N2A4E ──> 7N2A4F
```

---

## Health Retrieval Ordering Policy (7N2A4E)

This policy applies only after 7N2A4B and 7N2A4E. It does not authorize mapping creation in earlier slices.

```text
Health retrieval ordering is deterministic and does not express semantic
superiority.

hôpital:
1. dándaso
2. ndándadiya
3. ndándayoro

clinique:
1. ndándadiya
2. ndándayoro

centre de santé:
1. ndándadiya
2. ndándayoro
```

---

## Required Future Documentation Patch

Do not modify existing documents in this task. A later documentation-only patch must correct any language that treats additive `hôpital` mapping as optional.

### Corrected policy

```text
hôpital must retain dándaso and add ndándayoro plus ndándadiya after their
canonical records are validly inserted.
```

### Documents to correct later

| Document | Issue to correct |
| --- | --- |
| `docs/reports/phase7n2a_implementation_readiness_audit.md` | Replace “optional additive `hôpital`” language with mandatory `additive_source_mapping` policy |
| `docs/PHASE_7N2A_IMPLEMENTATION_AUTHORIZATION.md` | Replace “if separately approved” / “unless a separately approved additive mapping is authorized later” with mandatory post-lexical additive policy |
| `docs/reports/phase7n2a_source_record_audit.md` | Resolve open question “should `hôpital` use additive_source_mapping only” as **yes, mandatory** after canonical insertion |
| `shared/specs/phase7n2a_common_kinship_aliases_v1.md` | Clarify `phase7n2a_ndandayoro_hopital` expects additive compound coverage, not optional enrichment |

---

## Authorization Boundary (Restated)

This document resolves representation design only. It does not insert lexical records, aliases, supplements, indexes, bundles, or runtime behavior.

Phase 7N2A now has a bounded technical representation plan. Manual lexical provenance, target variants, source aliases, and source-index mappings are separated before implementation. No dictionary or search behavior has changed.
