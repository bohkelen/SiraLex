# corpus_annotation_reviews_v1

Versioned contract for **human/reviewer judgments** about corpus annotations.

Reviews are separate immutable evidence records. They do **not** mutate
annotations, create dictionary candidates, authorize publication, or resolve
rights.

Expected future production path (deferred; not created by CORPUS1E/CORPUS1F2):

```text
shared/corpus/corpus_annotation_reviews_v1.jsonl
```

**History:**

- CORPUS1E introduced the versioned review contract, validator, worksheet export,
  and dry-run import (synthetic fixtures only).
- CORPUS1F2 later added governed **pilot-local** persistence via
  `siralex-write-corpus-reviews` for real completed human worksheets whose
  annotations live under gitignored local pilot data.

CORPUS1F2 does **not** create a tracked production review registry.

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

Every **new** exported row MUST include:

```text
worksheet_schema = corpus_annotation_review_worksheet_v3
```

Dry-run / writer MUST continue accepting historical worksheets with:

```text
worksheet_schema = corpus_annotation_review_worksheet_v2
```

Schema dispatch is explicit and fail-closed:

- `v2` → validate with v2 columns/context semantics
- `v3` → validate with v3 columns/context semantics
- unknown / mixed unsupported reinterpretation → reject

Do **not** silently reinterpret a v2 worksheet as v3.

### v2 context (historical)

v2 adds **read-only review context** for related same-segment translation
leaves and optional audio locator:

| Column | Semantics |
|--------|-----------|
| `artifact_storage_ref` | Local/storage pointer when segments+artifacts are supplied |
| `related_translation_english` | Joined content of current English translation leaves |
| `related_translation_english_annotation_ids` | Matching `cann_…` ids (`;`-joined) |
| `related_translation_french` | Joined content of current French translation leaves |
| `related_translation_french_annotation_ids` | Matching `cann_…` ids (`;`-joined) |

### v3 context (current export)

v3 preserves v2 columns and adds derivation-based source transcript context for
**translation subjects**:

| Column | Semantics |
|--------|-----------|
| `source_transcript` | Joined content of transcript parents from `derived_from_annotation_ids` |
| `source_transcript_annotation_ids` | Matching parent `cann_…` ids (`;`-joined, deterministic) |

For `transcript_*` subjects, source transcript columns are empty; related
English/French translation leaves remain contextual evidence as in v2.

For `translation` subjects:

- source transcript comes from derivation parents (`transcript_raw` /
  `transcript_normalized`), not “newest same-segment transcript wins”
- related English/French columns project **all other** current same-segment
  translation leaves as contextual evidence, grouped by content language
  (subject annotation excluded)
- same-language competing leaves remain visible; multiple leaves remain
  visible and are ordered deterministically by `annotation_id` (no newest-wins)
- sibling agreement is never an automatic acceptance rule; no sibling is
  preferred or accepted automatically

Pilot note (SLR106): the current dataset has exactly one English and one
French translation leaf per segment, so each English subject row currently
shows its French sibling (and vice versa). That is a property of this pilot,
not a universal schema rule.
Translation review questions (human):

- EN subject: Does this English text accurately represent the meaning of the
  referenced Maninka expression?
- FR subject: Does this French text accurately represent the meaning of the
  referenced Maninka expression?

Authority boundaries remain:

```text
accepted transcript ≠ accepted translation
accepted English translation ≠ accepted French translation
translation review ≠ dictionary promotion
translation review ≠ rights clearance
translation review ≠ publication approval
```

Reuse existing issue codes (`translation_uncertain`, `meaning_uncertain`,
`language_identity_uncertain`, `unknown_word`, `needs_second_reviewer`,
`other`) unless a concrete gap appears.

Storage model remains separate versioned annotations (`transcript_raw` vs
`translation`). The worksheet **displays** related context beside the
reviewed subject; it does **not** store `transcript.translation=…`.

Dry-run MUST reject missing/wrong/unsupported `worksheet_schema` and unknown
unexpected CSV columns. All read-only context columns (including v3 source /
sibling fields) participate in deterministic reconstruction; edits fail with
`FAIL STALE OR MODIFIED WORKSHEET CONTEXT`.

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

## Persistence lifecycle (pilot)

```text
completed worksheet
→ canonical dry-run conversion + full review-table validation
→ explicit --apply
→ local immutable corpus_annotation_reviews_v1 registry
```

CLI: `siralex-write-corpus-reviews`

Default invocation validates and reports intended changes and **does not write**.
Persistence requires explicit `--apply`.

### Local vs tracked registry

For CORPUS1F pilot data that exists only under gitignored `data/corpus1f/`,
persisted reviews MUST remain local (e.g.
`data/corpus1f/tables/corpus_annotation_reviews_v1.jsonl`).

A tracked production path such as
`shared/corpus/corpus_annotation_reviews_v1.jsonl` remains **deferred** until
reviews would reference tracked annotation authority rather than local-only
pilot IDs.

### Idempotence and conflicts

- Candidate `review_id` **not present** in the existing registry → append
- Candidate `review_id` present with identical canonical row → no-op / already present
- Candidate `review_id` present with differing content → **FAIL CONFLICT** (no overwrite)

`review_id` remains required on every canonical review record.

Changed human judgments require a new review record (and later
`supersedes_review_id` workflow). Worksheet review-supersession UX is not part
of the initial writer.

### Atomicity and post-write verification

Writes use a temporary sibling file + fsync, then **validate that temporary
file from disk** with the canonical review validator and annotation chain before
`os.replace`. A best-effort parent-directory fsync may follow replace.
Any failure yields non-zero exit and must not report success.

### Write receipt

Optional `--receipt` JSON records operational provenance (row counts, hashes,
reviewer IDs). Receipts are not linguistic authority.

## Review supersession vs worksheet workflow

```text
review supersession = contract/validator capability
worksheet supersession workflow = deferred
governed persistence = local immutable append/idempotent apply
```

Do not require worksheet fields for `supersedes_review_id` in the initial
writer. Preview JSONL is diagnostic only and is never the write authority.