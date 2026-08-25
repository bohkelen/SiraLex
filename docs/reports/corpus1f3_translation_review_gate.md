# CORPUS1F3 — Translation-Subject Human Review Gate

## Decision

**CORPUS1F3_TRANSLATION_REVIEW_GATE_READY**

## CORPUS1F2 commit / base

```text
54ca558f6b8cc80fcdc7cb0b34ad880ca562c065
```

Subject: `Add governed corpus review persistence`

## Why translation review is now justified

The pilot already has:

- 24 accepted human transcript reviews
- 48 imported English/French translation annotations used as **context** during
  transcript review

Translations were never themselves review subjects. CORPUS1F3 makes
Maninka→translation judgment explicit and independent:

```text
accepted transcript ≠ accepted translation
accepted English ≠ accepted French
translation review ≠ dictionary / rights / publication
```

No AI linguistic review is performed in this gate.

## v2 backward compatibility

PASS.

Historical worksheets with
`worksheet_schema = corpus_annotation_review_worksheet_v2` remain accepted via
explicit schema dispatch (column set + context reconstruction).

The completed pilot transcript worksheet dry-runs with 24 preview rows / 0
errors under v2 rules. New exports use v3 only.

## v3 worksheet schema

```text
corpus_annotation_review_worksheet_v3
```

Adds read-only:

- `source_transcript`
- `source_transcript_annotation_ids`

Preserves v2 related-translation + `artifact_storage_ref` columns.

Unknown schemas fail closed. v2 is never silently reinterpreted as v3.

## Translation-subject context model

| Subject | Primary context | Secondary context |
|---------|-----------------|-------------------|
| `transcript_*` | (self content) | all current same-segment EN/FR translation leaves |
| `translation` | derivation parent Maninka transcript(s) | all **other** current same-segment translation leaves, grouped by language |

## Derivation-based source transcript projection

Source parents come from `derived_from_annotation_ids` filtered to
`transcript_raw` / `transcript_normalized`.

Multiple parents are listed deterministically by annotation_id (no newest-wins).

For the SLR106 pilot, each of the 48 translation rows resolves to its
transcript_raw parent.

## Sibling translation context

Normative model: project **all other** current same-segment translation leaves
as contextual evidence, grouped by language. The subject annotation is always
excluded. Same-language competing leaves remain visible; multiple leaves are
joined deterministically (no newest-wins).

No sibling is automatically preferred or accepted. Sibling agreement is never
an acceptance rule.

**SLR106 pilot property (not a schema rule):** this dataset has exactly one EN
and one FR leaf per segment, so each English subject currently shows its French
sibling and each French subject shows its English sibling.

## Audio context

`artifact_storage_ref` remains projected when segment/artifact tables are
supplied. No audio bytes are embedded in CSV.

## Context-integrity behavior

All read-only v3 context columns participate in dry-run reconstruction.
Editing source transcript, source IDs, sibling translations, artifact locator,
or other protected context fails with
`FAIL STALE OR MODIFIED WORKSHEET CONTEXT`.

## 48-row real pilot export

Local path (gitignored):

```text
data/corpus1f/outputs/translation_review_worksheet.csv
```

| Metric | Value |
|--------|-------|
| worksheet_schema | v3 |
| subject rows | 48 |
| English | 24 |
| French | 24 |
| review fields | blank |
| source transcript context | present on all 48 |
| artifact_storage_ref | present on all 48 |

## Unedited dry-run

```text
rows_read = 48
rows_skipped_unreviewed = 48
preview_row_count = 0
error_count = 0
```

## Human-review boundary

Reviewers must answer, per translation annotation:

- EN: Does this English text accurately represent the referenced Maninka meaning?
- FR: Does this French text accurately represent the referenced Maninka meaning?

Evidence may include Maninka transcript, audio, and sibling translation.
The decision subject remains **one** translation annotation.

Existing issue codes are reused (`translation_uncertain`, `meaning_uncertain`,
`language_identity_uncertain`, `unknown_word`, `needs_second_reviewer`,
`other`).

## Existing transcript review preservation

| Asset | Status |
|-------|--------|
| 24 transcript annotations | UNCHANGED |
| 48 translation annotations | UNCHANGED |
| 24 persisted transcript reviews | UNCHANGED |
| completed transcript worksheet | UNCHANGED |
| review registry | UNCHANGED |
| translation reviews | **0 — HUMAN REVIEW REQUIRED** |

## Files added

- `api/corpus_reviews/tests/test_translation_review_worksheet_v3.py`
- `docs/reports/corpus1f3_translation_review_gate.md`

## Files modified

- `api/corpus_reviews/export_review_worksheet.py`
- `api/corpus_reviews/dry_run_import_reviews.py`
- `shared/specs/corpus-annotation-reviews-v1.md`

## Local / gitignored files

- `data/corpus1f/outputs/translation_review_worksheet.csv`
- `data/corpus1f/outputs/translation_review_gate_dry_run.json`

## Tests

Full corpus suite: **205 passed**

Covered: historical v2 accept/fail, valid v3 transcript/translation rows,
derivation parents (incl. multi-parent deterministic order), sibling context
including same-language competing leaves, edited source/sibling context
failures, unsupported schema, exporter subject identity without decision
inheritance, and 48-row pilot unedited dry-run.

## git diff --check

**PASS**

## Working tree

CORPUS1F3 changes left **uncommitted** for review.
`web/scripts/` remains untouched / unrelated.
## Next gate

**COMPLETED HUMAN TRANSLATION REVIEW WORKSHEET**
