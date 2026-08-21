# CORPUS1F follow-on — Translation context from pilot friction

## Decision

Observed human-review friction after CORPUS1F:

```text
audio + Maninka transcript present
translation context missing from worksheet
⇒ audio↔form review possible; semantic review unnecessarily hard
```

Corrected without collapsing storage dimensions:

```text
translation = separate corpus_annotations_v1 rows
worksheet = display related translations as read-only context
```

Not implemented: `transcript.translation=…`, promotion, ASR, review writer, CORPUS1G/ELAN.

## Source inspection

Local SLR106 vocab CSVs under `data/corpus1f/` contain:

| File | English | French | Maninka |
|------|---------|--------|---------|
| `vocab_wake_words.csv` | yes | yes | yes |
| `vocab_contact_management.csv` | yes | yes | yes |
| `vocab_digits.csv` | yes | yes | yes |
| `vocab_parents.csv` | yes | yes | yes |
| `vocab_names.csv` | n/a (`Name` only) | n/a | n/a |

Pilot utterances are wake/command/digit/parent ⇒ FR/EN available for all 24.

## Local pilot annotation update (gitignored)

- Kept 24 `transcript_raw` / `creation_method=import` rows
- Added 48 `translation` rows (24 English + 24 French)
- `creation_method=import`, `created_by=slr106_vocab_import`
- `derived_from_annotation_ids` → corresponding Maninka transcript
- Full chain validation: **72 annotations PASS**

## Worksheet schema

Bumped to:

```text
corpus_annotation_review_worksheet_v2
```

New read-only context columns:

- `artifact_storage_ref`
- `related_translation_english`
- `related_translation_english_annotation_ids`
- `related_translation_french`
- `related_translation_french_annotation_ids`

Pilot re-export uses `--annotation-type transcript_raw` so reviewers get **24
Maninka subject rows** with FR/EN beside them (not 72 separate review subjects).

Unedited dry-run: **PASS** (24 skipped / 0 errors).

Previous blank v1 CSV preserved locally as
`data/corpus1f/outputs/review_worksheet_v1_pre_translation_context.csv`.

## Human review note

Any prior listening that checked audio ↔ Maninka orthography remains useful.

The v2 worksheet additionally enables:

```text
Maninka ↔ supplied dataset translation (EN/FR)
```

Those translations are still **dataset-imported glosses**, not reviewed
linguistic truth.

### Review-target semantics (normative for this worksheet)

A review decision on a v2 worksheet row applies to the referenced
`transcript_raw` annotation **only**.

Related English/French columns are read-only contextual evidence.

```text
accepted transcript review
≠ accepted English translation review
≠ accepted French translation review
```

Do not automatically propagate transcript decisions onto translation
annotations. Formal translation validation requires reviewing those
`translation` annotations as independent subjects later.

## Files

Tracked (uncommitted unless requested):

- `api/corpus_reviews/export_review_worksheet.py`
- `api/corpus_reviews/dry_run_import_reviews.py`
- `api/corpus_reviews/tests/test_corpus_reviews.py`
- `shared/specs/corpus-annotation-reviews-v1.md`
- `docs/reports/corpus1f_translation_context_from_pilot_friction.md`

Local only:

- `data/corpus1f/tables/corpus_annotations_v1.jsonl` (now 72 rows)
- `data/corpus1f/outputs/review_worksheet.csv` (v2)

## Tests

181 passed (B+C+D+E).
