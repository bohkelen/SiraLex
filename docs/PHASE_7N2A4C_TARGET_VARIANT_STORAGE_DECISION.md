# Phase 7N2A4C Target-Variant Storage Decision

**Status:** design decision — read-only architecture slice 7N2A4C0  
**Supersedes (storage only):** 7N2A3 Decision 2 artifact path for `reviewed_target_variants[]` inline in `data/ir/malipense_lexicon_v3.jsonl`  
**Preserves (semantic):** 7N2A3 Decision 2 normalization behavior and duplicate-prevention invariants

---

## Problem statement

Phase 7N2A3 correctly chose **Pattern B** — an explicit `reviewed_target_variants[]` field merged at normalization time — for owner-approved target-side spelling variants such as `móbaa` on canonical record `c5f78c8ac66eac6b` (`móyibaa`).

The accompanying storage decision — edit row `c5f78c8ac66eac6b` inside `data/ir/malipense_lexicon_v3.jsonl` — is no longer valid:

```text
data/ir/malipense_lexicon_v3.jsonl is ignored by .gitignore (data/ir/*)
```

Unlike `data/ir/siralex_owner_lexical_v1.jsonl` (narrow Git exception for project-authored lexical additions), frozen Mali-Pense IR is intentionally outside Git under `docs/DATASET.md` immutability policy. Any editorial variant stored only inside that ignored file is not reproducible from source control.

The semantic invariant remains:

```text
móbaa → same canonical lexical concept as móyibaa
→ canonical ir_id c5f78c8ac66eac6b
→ no duplicate lexical record
→ no global contraction, deletion, tone folding, or vowel folding
```

This document selects a tracked overlay artifact and defines how the existing normalizer integration (`shared/ir/lexical_review.py`, `api/normalizer/normalize.py`) will consume it without mutating frozen Mali-Pense IR.

---

## Design comparison

| Option | Source-control reproducible? | Preserves frozen IR? | Normalizer complexity | Rejected or selected |
| ------ | ---------------------------: | -------------------: | --------------------: | -------------------- |
| Inline `reviewed_target_variants[]` in ignored Mali-Pense IR | no — requires unversioned local edit to ignored snapshot | no — mutates frozen capture artifact in place | low — already implemented for inline field | **rejected** |
| Dedicated tracked target-variant overlay | yes — versioned JSONL under `shared/` | yes — frozen IR untouched | moderate — load overlay + attach at normalize time | **selected** |
| Dedicated manual duplicate lexical record | yes | yes | low per row | **rejected** — violates no-duplicate-record invariant |
| Reuse source alias or source-index supplement artifacts | yes | yes | high — wrong semantic layer (French source→target routing, not Maninka target-side variant) | **rejected** |

### Why direct mutation of `data/ir/malipense_lexicon_v3.jsonl` is rejected

1. **Dataset policy:** `docs/DATASET.md` states frozen lexicon IR will never be modified in place; corrections ship as separate versioned artifacts.
2. **Git policy:** `.gitignore` ignores `data/ir/*` except `siralex_owner_lexical_v1.jsonl`; Mali-Pense lexicon IR cannot be tracked without reversing the dataset boundary.
3. **Evidence integrity:** `record_locator`, `evidence[]`, and Mali-Pense locators must remain scrape-faithful; target-side editorial variants are not source-attested anchor data.
4. **Reproducibility:** Phase 7N2A4B-R2B established that project-authored authority must be Git-tracked; inline edits to provisioned local snapshots fail that bar.

---

## Selected artifact

**Path:** `shared/target_variants/reviewed_target_variants_v1.jsonl`

**Rationale:**

- Mirrors established tracked editorial tables: `shared/aliases/source_aliases_v1.jsonl`, `shared/source_index_supplements/source_index_supplements_v1.jsonl`.
- Lives under `shared/` (always tracked; not subject to `data/` ignore rules).
- Separates target-side Maninka editorial variants from French source-alias and source-index supplement semantics.
- Reuses existing `ReviewedTargetVariant` validation and `LexiconVariantRegistry` collision rules already implemented in `shared/ir/lexical_review.py` and exercised by `api/normalizer/normalize.py`.

Initial file may be empty (header comment only) or absent until 7N2A4C2 insertion; 7N2A4C1 creates the schema, validator, and loader.

---

## Overlay schema

One JSON object per line. Field names align with existing inline `reviewed_target_variants[]` items plus table metadata patterned on alias/supplement tables.

### Required fields (every row)

| Field | Type | Rule |
| ----- | ---- | ---- |
| `schema_version` | string | MUST be `reviewed_target_variant_table_v1` |
| `target_variant_table_version` | string | Table batch id, e.g. `phase7n2a-round1` |
| `variant_id` | string | Stable row id; unique within table; pattern `rtv_<phase>_<seq>` recommended |
| `status` | string | `approved` \| `rejected` \| `pending` |
| `canonical_ir_id` | string | 16-char hex `ir_id` of existing frozen lexicon entry |
| `form` | string | Owner-approved target-side spelling; MUST be NFC |
| `target_script` | string | MUST be `latin` in v1 (N'Ko reviewed variants not accepted) |
| `review_document` | string | Repo-relative path under `docs/` |
| `reviewer` | string | Reviewer identity string |
| `reviewed_at` | string | ISO-8601 date or timestamp |
| `rationale` | string | Non-empty audit rationale |
| `source_norm_version` | string | Norm ruleset this row was validated against, e.g. `norm_v3` |

### Optional fields

| Field | Type | Rule |
| ----- | ---- | ---- |
| `review_reference` | object | Optional structured pointer `{document_path, approval_status, reviewer_role}` when review sheet uses Phase 7N2A profile |
| `supersedes_variant_id` | string | Prior `variant_id` this row replaces |
| `notes` | string | Maintainer notes; not used by normalizer |

### Example future row (illustrative — not inserted in 7N2A4C0)

```json
{
  "schema_version": "reviewed_target_variant_table_v1",
  "target_variant_table_version": "phase7n2a-round1",
  "variant_id": "rtv_phase7n2a_0001",
  "status": "approved",
  "canonical_ir_id": "c5f78c8ac66eac6b",
  "form": "<owner-approved NFC móbaa at 4C2 insertion>",
  "target_script": "latin",
  "review_document": "docs/PHASE_7K1_STRUCTURED_USABILITY_TRIAGE.md",
  "reviewer": "<implementation-time reviewer id>",
  "reviewed_at": "<ISO-8601>",
  "rationale": "Owner-approved target-side variant of móyibaa; same lexical concept; no separate record.",
  "source_norm_version": "norm_v3"
}
```

---

## Validation rules

### NFC validation

- `form` MUST satisfy `normalize_nfc(form) == form` (same `normalize_nfc` as `shared/ir/lexical_review.py`).
- Validator rejects NFC-equivalent duplicates within the overlay file.

### `canonical_ir_id` validation

- MUST match regex `^[0-9a-f]{16}$`.
- MUST NOT reference `src_siralex_lexical_review` owner-addition ids unless a future slice explicitly extends scope (7N2A4C targets frozen Mali-Pense lexicon rows only).
- At normalization time, `canonical_ir_id` MUST exist among loaded `lexicon_entry` IR units with `source_id = src_malipense`. If absent (IR not provisioned locally), normalization **fails closed** with an explicit error naming the orphan overlay row.

### Status and approval rule

- Only rows with `status = approved` are applied.
- `rejected` and `pending` rows are retained for audit (same pattern as `shared/aliases/source_aliases_v1.jsonl`) but produce no normalization effect.

### Source norm-version compatibility

- `source_norm_version` MUST equal the active normalizer ruleset (`norm_v3` today).
- Mismatch fails closed at overlay load/validate time so variant merge behavior cannot drift across ruleset changes without an explicit table update.

### Uniqueness rules

| Scope | Rule |
| ----- | ---- |
| `variant_id` | globally unique within file |
| `form` (NFC key) | at most one **approved** row per NFC `form` across the entire overlay |
| `canonical_ir_id` + `form` (NFC) | at most one **approved** row |
| per canonical record | multiple distinct approved forms allowed (different NFC keys) |

### Duplicate-prevention (normalization-time)

Reuse existing `LexiconVariantRegistry` behavior from `shared/ir/lexical_review.py`:

1. **Guard A:** overlay `form` MUST NOT equal the canonical record's own `fields_raw.headword_latin` (NFC).
2. **Guard B:** overlay `form` MUST NOT equal any entry in that record's `record_locator.anchor_names` (NFC).
3. **Guard C:** overlay `form` MUST NOT match another record's source-attested Latin forms (fail-closed global map).
4. **Guard D:** overlay `form` MUST NOT match another record's already-registered reviewed form.
5. **Guard E:** duplicate `form` on the same `canonical_ir_id` within overlay fails at validate time.

These rules MUST NOT be weakened relative to current inline `reviewed_target_variants[]` tests in `api/normalizer/tests/test_lexical_review.py`.

### Provenance / review traceability

- `review_document`, `reviewer`, `reviewed_at`, and `rationale` are mandatory on every row (approved or rejected).
- Overlay rows MUST NOT claim Mali-Pense `snapshot_id`, page URL, or `record_locator` edits.
- Normalized output does not add a second `ir_id`; traceability remains on the overlay row and review document.

### Deterministic row order

- Approved rows MUST be sorted ascending by: `(canonical_ir_id, variant_id)`.
- CI/validator enforces sort order for stable diffs (same convention as alias tables).

---

## Normalization modes

```text
Raw normalization:
frozen/manual IR inputs only

Composed normalization:
IR inputs + explicit tracked reviewed-target-variant overlay
```

Reviewed target variants are loaded only when the normalizer receives an explicit:

```text
--target-variant-overlay <path>
```

There is no automatic overlay discovery and no implicit default overlay path.

A normalization run without `--target-variant-overlay` is raw-source normalization.
A normalization run with `--target-variant-overlay` is composed normalization and
must record the exact overlay path, row count, and file SHA-256 in its command
report or implementation report.

Why:

```text
Silent local-file discovery would make identical commands produce different
outputs depending on repository state or working directory contents.
```

---

## Normalizer integration (7N2A4C1)

### Load path

Add explicit CLI flag to `api/normalizer/cli.py`:

```text
--target-variant-overlay PATH
```

Rules:

```text
- Absent flag: no overlay is loaded (raw normalization).
- Present flag: file must exist and validate (composed normalization).
- Empty valid overlay: produces the same normalized output as raw normalization.
```

### Apply semantics

During `process_ir_files()` in `api/normalizer/normalize.py`:

```text
1. Load and validate overlay rows (fail closed on schema/duplicate/norm-version errors).
2. Build map: canonical_ir_id → list[ReviewedTargetVariant] for approved rows only.
3. First pass: register source-attested forms from all lexicon_entry IR (unchanged).
4. Second pass: for each lexicon_entry, resolve effective reviewed variants =
     inline ir_unit.reviewed_target_variants[] (if any; deprecated for new edits)
     + overlay variants for ir_unit.ir_id (if any)
5. Merge into variant_forms via existing normalize_lexicon_entry() path.
```

**Invariants preserved:**

| Property | Behavior |
| -------- | -------- |
| `preferred_form` | unchanged — still `fields_raw.headword_latin` |
| `ir_id` | unchanged — still canonical frozen record id |
| `record_locator.anchor_names` | never read from or written to overlay |
| Mali-Pense `evidence[]` | untouched |
| `variant_forms` | source anchors + N'Ko + overlay reviewed forms |
| `search_keys` | derived from merged `variant_forms` only |
| fuzzy matching | none — exact NFC merge only |

### Behavior when referenced canonical IR row is absent

Fail closed during normalization preflight: orphan overlay row referencing `canonical_ir_id` not present in loaded IR inputs produces a hard error and non-zero CLI exit. No silent skip.

### Behavior when row conflicts with frozen attested Latin forms

Fail closed via `LexiconVariantRegistry.validate_reviewed_variant()` — same error family as inline variants (`conflicts with lexical record <ir_id>`).

### Behavior when two overlay rows conflict

- Duplicate NFC `form` in overlay file: rejected at overlay validate time.
- Same `form` claimed by two `canonical_ir_id` values: rejected at overlay validate time if both approved; if one approved, fail at registry validate time when second canonical record is normalized.

---

## Required pipeline invariant

```text
frozen Mali-Pense IR (provisioned locally)
+ tracked reviewed-target-variant overlay (Git)
+ optional owner lexical IR (Git)
→ normalized variant_forms
→ target-side search keys
→ same existing canonical ir_id
```

The overlay MUST NOT:

- modify `record_locator.anchor_names`
- modify Mali-Pense evidence
- modify Mali-Pense source locators
- create a second lexical record
- change `preferred_form`
- weaken reviewed-variant duplicate protections
- introduce any global fuzzy-match rule

---

## Relationship to existing code

| Component | Current role | 7N2A4C1 change |
| --------- | ------------ | -------------- |
| `shared/ir/lexical_review.py` | `ReviewedTargetVariant`, `LexiconVariantRegistry`, inline parse/validate | add overlay row parser/validator; optional deprecate new inline IR edits |
| `shared/ir/models.py` | `IRUnit.reviewed_target_variants` optional field | no schema change required; overlay is external |
| `api/normalizer/normalize.py` | merges inline `reviewed_target_variants[]` | accept overlay-supplied variants at normalize time |
| `api/normalizer/cli.py` | `--input` IR files only | add `--target-variant-overlay` |
| `shared/specs/lossless-capture-and-ir.md` | documents inline field | 7N2A4C1 add overlay as preferred storage; inline retained read-only for backward compat |
| `shared/specs/provenance.md` | owner lexical provenance | no change for target variants |
| `shared/aliases/` | French source-term aliases | not used for Maninka target variants |
| `shared/source_index_supplements/` | French source-index mappings | not used for Maninka target variants |

---

## Future slice — 7N2A4C1 Reviewed Target-Variant Overlay Support

### Allowed files

```text
shared/target_variants/reviewed_target_variants_v1.jsonl   (empty or absent until 4C2)
shared/target_variants/README.md                           (optional table documentation)
shared/ir/lexical_review.py
shared/ir/target_variants.py                               (new, if cleaner than bloating lexical_review.py)
api/normalizer/normalize.py
api/normalizer/cli.py
api/normalizer/tests/test_lexical_review.py
api/normalizer/tests/test_target_variant_overlay.py        (new)
shared/specs/lossless-capture-and-ir.md                    (overlay contract only)
docs/reports/phase7n2a4c1_overlay_support_report.md
```

### Forbidden files

```text
data/ir/malipense_lexicon_v3.jsonl
data/ir/malipense_index_v1.jsonl
data/ir/siralex_owner_lexical_v1.jsonl
data/normalized/
data/enriched/
shared/aliases/source_aliases_v1.jsonl
shared/source_index_supplements/source_index_supplements_v1.jsonl
shared/search_regression/search_regression_matrix_v1.jsonl
search runtime
bundles
packages
catalog files
release documents
```

No `móbaa` row in overlay until 7N2A4C2.

### Schema / validator work

- Implement `load_reviewed_target_variant_overlay()` with fail-closed validation for all rules in this document.
- Enforce deterministic sort order.
- Unit tests with inline fixtures only.

### Normalizer integration work

- Wire overlay map into `process_ir_files()` / `normalize_lexicon_entry()`.
- CLI `--target-variant-overlay` (explicit path only; no default discovery).
- Preserve all existing inline `reviewed_target_variants[]` test behavior.

### Test requirements

1. Valid overlay row validates and merges into `variant_forms` for a fixture canonical record.
2. Missing `canonical_ir_id` in loaded IR fails closed.
3. Overlay `form` equal to own `headword_latin` fails (Guard A).
4. Overlay `form` equal to own `anchor_names` entry fails (Guard B).
5. Overlay `form` conflicting with another record's attested Latin form fails (Guard C).
6. Duplicate NFC `form` in overlay fails.
7. Wrong `source_norm_version` fails.
8. `status != approved` rows are ignored.
9. Frozen Mali-Pense fixture output unchanged when overlay file absent or empty.
10. `preferred_form` and `record_locator` unchanged on target record.
11. All prior R1/R1A/R2A lexical-review tests still pass.

### Exit criteria

- Overlay validator and normalizer integration complete.
- Empty overlay file committed.
- Raw frozen normalization and composed normalization with explicit empty overlay produce identical output.
- No runtime, bundle, package, or search regression changes.

---

## Future slice — 7N2A4C2 móbaa Variant Insertion

### Preconditions

```text
- 7N2A4C1 complete
- exact NFC form of móbaa confirmed by owner at insertion time
- overlay validator passes for the new row
- canonical record c5f78c8ac66eac6b exists in provisioned frozen IR
- full combined normalization succeeds with overlay applied
- no target-key collision exists (LexiconVariantRegistry pass)
```

### Allowed files

```text
shared/target_variants/reviewed_target_variants_v1.jsonl   (add one approved row)
docs/reports/phase7n2a4c2_mobaa_variant_insertion_report.md
api/normalizer/tests/                                      (narrow fixture updates only if needed)
```

### Forbidden files

Same forbidden set as 7N2A4C1, plus:

```text
data/ir/malipense_lexicon_v3.jsonl                         (no inline edit)
search regression matrix                                   (separate authorized slice)
```

### Exit criteria

```text
móbaa resolves to ir_id c5f78c8ac66eac6b in normalized variant_forms / search_keys
móyibaa preferred_form unchanged
no second lexical record created
frozen Mali-Pense rows other than c5f78c8ac66eac6b unchanged
overlay row reproducible from Git
```

---

## Explicit non-goals (7N2A4C0)

- No `móbaa` insertion in this slice.
- No normalizer code changes in this slice.
- No modification to frozen Mali-Pense IR, owner lexical IR, aliases, supplements, indexes, bundles, packages, runtime, catalog, or release documents.

Phase 7N2A4C0 separates target-side editorial variants from ignored frozen source data. The future `móbaa` variant will be reproducible as a tracked overlay, not as an unversioned modification to Mali-Pense IR.
