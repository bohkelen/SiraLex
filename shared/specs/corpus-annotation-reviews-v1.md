# corpus_annotation_reviews_v1

Versioned contract for **human/reviewer judgments** about corpus annotations.

Reviews are separate immutable evidence records. They do **not** mutate
annotations, create dictionary candidates, authorize publication, or resolve
rights.

Expected future production path (not created by CORPUS1E):

```text
shared/corpus/corpus_annotation_reviews_v1.jsonl
```

CORPUS1E ships validators, worksheet export, and dry-run import only.
Synthetic fixtures under `shared/corpus/fixtures/`.

## Authority boundary

```text
annotation ≠ accepted evidence
review ≠ dictionary candidate
accepted review ≠ publication approval
evidence strength ≠ review decision
review decision ≠ promotion status
linguistic acceptance ≠ rights authorization
```

Multiple active reviews of the same annotation are valid (disagreement).
No automatic consensus, majority vote, or “latest wins” policy.

## Identity

| Field | Rule |
|-------|------|
| `review_id` | `^crev_[a-z0-9]+(?:_[a-z0-9]+)*$` |
| `annotation_id` | Must match `corpus_annotations_v1` syntax (`cann_…`) |

A review references an annotation; it does not replace it.

## Required fields

| Field | Type | Notes |
|-------|------|-------|
| `schema_version` | string | Exactly `corpus_annotation_reviews_v1` |
| `review_id` | string | Stable review identity |
| `annotation_id` | string | Target annotation |
| `reviewer_id` | string | Non-empty provenance |
| `reviewed_at` | timestamp | Full ISO-8601 **datetime with explicit timezone** (`Z` or `±HH:MM`). Date-only and timezone-naive values are rejected. |
| `review_method` | enum | See below |
| `decision` | enum | See below |

## Decision enum

```text
accepted
rejected
needs_more_evidence
```

`abstained` is **not** used. Absence of a review is “no review yet.”

Do **not** use promotion vocabulary (`published`, `approved_for_dictionary`,
`candidate`, etc.).

## Review method enum

```text
manual_review
trusted_speaker_review
linguistic_review
collaborative_review
other
```

Method labels record provenance. They do **not** certify expertise or
automatically override other reviews.

## Optional fields

| Field | Type | Notes |
|-------|------|-------|
| `evidence_strength` | enum | `unknown` \| `weak` \| `moderate` \| `strong` \| `very_strong` |
| `evidence_refs` | string[] | Opaque refs (e.g. annotation/segment/source ids); no triangulation automation |
| `issue_codes` | string[] | Controlled vocabulary below |
| `review_notes` | string | Free-text; empty string rejected if present |
| `supersedes_review_id` | string | Same-reviewer revision pointer |

## Issue codes

```text
unclear_audio
segment_boundary_problem
speaker_overlap
language_identity_uncertain
orthography_uncertain
unknown_word
translation_uncertain
meaning_uncertain
code_switching
rights_block
needs_second_reviewer
other
```

## Review supersession

Optional `supersedes_review_id`:

- no self-supersession
- superseded review must exist in the same table
- same `annotation_id`
- **same `reviewer_id`** (another reviewer creates an independent review)
- `reviewed_at` ≥ superseded `reviewed_at`
- supersession graph acyclic

Competing independent reviews are **not** supersession.

## Annotation subject fingerprint

Worksheet / import flows use:

```text
annotation_fingerprint_sha256
```

Computed as SHA-256 (hex, lowercase) of the canonical UTF-8 JSON encoding of
the full annotation record with `sort_keys=True` and separators `,` / `:`.

On import, the fingerprint MUST match the referenced annotation or validation
fails with a stale-subject error. Do not silently apply a review to changed
content.

Dry-run import MUST also reconstruct the deterministic expected worksheet
context for each annotation and compare every read-only context column. Any
mismatch fails with `FAIL STALE OR MODIFIED WORKSHEET CONTEXT` (or
`FAIL STALE REVIEW SUBJECT` when the fingerprint itself differs).

## Competing annotation leaves

Because competing same-type annotation supersessions are legal, the
**current annotation set** for review worksheets is **all supersession leaves**,
not the newest `created_at`. Export MUST include every competing leaf and MUST
NOT pick a winner.

## Forbidden fields

Reject promotion / product-truth fields, including:

- `promotion_status`, `dictionary_candidate`, `headword_candidate`
- `alias_candidate`, `publish`, `published`, `bundle_id`
- `search_index_mapping`, `approved`, `accepted` (as review status on the row —
  use `decision` instead)

Do not store review outcomes on `corpus_annotations_v1` rows.

## Validation behavior

- Structure-only validation works on a reviews file alone (ID syntax + enums +
  review-graph rules among reviews present).
- Optional `--annotations` runs **full** annotation validation, then checks
  `annotation_id` references and requires
  `reviewed_at >= annotation.created_at` (timezone-normalized instants).
- Optional `--segments` / `--artifacts` / `--sources` may be supplied with
  `--annotations` for full provenance chain validation (same chaining rules as
  annotation validation).
- File validation and dry-run preview validation MUST share the same canonical
  table validator (`validate_corpus_review_table`).

## Worksheet flow (derived, non-authoritative)

```text
annotations
→ deterministic CSV worksheet export
→ human fills review columns
→ dry-run validate / preview review records
→ (later) governed production write — deferred
```

Every exported row MUST include:

```text
worksheet_schema = corpus_annotation_review_worksheet_v1
```

Dry-run MUST reject missing/wrong/unsupported `worksheet_schema` and unknown
unexpected CSV columns.

Reviewer-editable columns include `evidence_refs` (semicolon-delimited),
parsed into `evidence_refs[]` on preview rows.

If `review_id` is omitted, generate
`crev_<annotation-fragment>_<short-sha256>` from a canonical digest of the
immutable review-creation fields (not including `review_id`).

Dry-run sequence:

```text
worksheet
→ row conversion
→ individual structural checks + context integrity
→ complete preview collection
→ FULL TABLE VALIDATION
→ success
```

`--preview-jsonl` MUST NOT be written unless the entire dry-run passes.

Edited CSV is never the canonical review registry.

## Review supersession vs worksheet workflow

```text
review supersession = contract/validator capability
worksheet supersession workflow = deferred until governed review persistence exists
```

Do not require worksheet fields for `supersedes_review_id` in CORPUS1E.
