# CORPUS1F4 — Translation Review Persistence

## 1. Decision

**CORPUS1F4_TRANSLATION_REVIEWS_PERSISTED**

## 2. Base commit

```text
7385fc5459d99bc8dfb939d9c49b31197fefeb0b
```

## 3. Human worksheet completion status

Path: `data/corpus1f/outputs/translation_review_worksheet.csv`

| Metric | Value |
|--------|------:|
| Rows | 48 |
| Completed (decision + reviewer_id + reviewed_at + review_method) | 48 |
| Incomplete | 0 |

Schema: `corpus_annotation_review_worksheet_v3`  
Subjects: translation only (24 English, 24 French)

## 4. Dry-run result

```text
rows_read = 48
rows_skipped_unreviewed = 0
preview_row_count = 48
error_count = 0
```

Full provenance chain used (annotations + segments + artifacts + sources).

## 5. Translation review decision counts

Human worksheet results (annotation-level; not lexical diversity):

| Decision | Count |
|----------|------:|
| accepted | 48 |
| rejected | 0 |
| needs_more_evidence | 0 |

| Optional field | Count |
|----------------|------:|
| evidence_strength = strong | 48 |
| issue_codes (none) | 48 |

## 6. Reviewer provenance

| Field | Value |
|-------|-------|
| reviewer_ids | `Reviewer_001` |
| review_method | `manual_review` (48) |
| reviewed_at | timezone-aware human timestamps (worksheet) |

## 7. First persistence result

Writer: `siralex-write-corpus-reviews` (`--apply`)

| Metric | Value |
|--------|------:|
| rows_before | 24 |
| candidate_rows | 48 |
| new_rows_written | 48 |
| already_present_identical | 0 |
| rows_after | 72 |

Registry after first apply SHA-256:

```text
a48d7df04783ff220233c15c7c7e565d5756ea40887776334503fcdf55e1d8c0
```

## 8. Idempotence result

Second identical `--apply`:

| Metric | Value |
|--------|------:|
| new_rows_written | 0 |
| already_present_identical | 48 |
| rows_after | 72 |
| registry SHA unchanged | yes |

## 9. Registry composition

| Subject class | Count |
|---------------|------:|
| Transcript-subject reviews | 24 |
| Translation-subject reviews | 48 |
| Translation English | 24 |
| Translation French | 24 |
| **Total reviews** | **72** |

## 10. Annotation-level vs lexical-diversity distinction

```text
48 translation annotation reviews
≠
48 unique lexical facts
```

Descriptive diversity summary (not canonical review fields):

| Summary metric | Count |
|----------------|------:|
| Unique Maninka expressions | 6 |
| Unique Maninka→English mappings | 6 |
| Unique Maninka→French mappings | 6 |
| Unique semantic mappings | 12 |

## 11. 48 annotation reviews vs 12 unique semantic mappings

The registry stores **48** independent translation reviews because each is attached
to a distinct segment/annotation evidence unit (4 speakers × 6 expressions × 2
languages).

Later reporting must keep:

- annotation-level review count = 48
- unique semantic mapping count = 12

## 12. Existing transcript review preservation

The original 24 transcript reviews remain byte-semantically unchanged
(canonical JSON per `review_id` identical before/after merge).

## 13. Non-propagation confirmation

Verified:

- transcript acceptance did not create translation reviews
- English acceptance did not create French acceptance (independent rows)
- French acceptance did not create English acceptance
- repeated semantic mappings did not auto-propagate reviews
- all 48 translation `review_id`s originate from the human worksheet dry-run preview

## 14. Local registry / receipt paths

Gitignored under `data/corpus1f/`:

- `tables/corpus_annotation_reviews_v1.jsonl`
- `outputs/translation_review_persistence_receipt.json`
- `outputs/translation_review_persistence_receipt_idempotent.json`
- `outputs/translation_review_persistence_report.json`

## 15. Tests

Full corpus suite: **205 passed**

The pilot integration test dynamically snapshots the existing local review
registry (bytes + row count) and proves that blank translation worksheet
export/dry-run causes **zero mutation**, regardless of current registry size.
It does **not** hard-code an absolute review count such as 72.

Historical empirical CORPUS1F4 composition (observed at persistence time)
remains:

24 transcript reviews + 48 translation reviews = 72 total reviews.

## 16. git diff --check

PASS (see final return).

## 17. Non-mutation

Unchanged:

- annotations / segments / artifacts / sources
- dictionary / search / aliases / supplements / bundles / catalog
- web runtime / `web/scripts/`

Mutated (local only): review registry + operational receipts.

## 18. Working tree

CORPUS1F4 tracked report left **uncommitted** for review.
Local registry/receipts remain gitignored.

## 19. Recommended next acquisition step

**STOP expanding SLR106 for vocabulary growth.**

Next corpus experiment should optimize for:

```text
distinct natural Maninka lexical/phrase evidence
```

not additional repeated realizations of the existing closed VA vocabulary.

Do not acquire SLR105 in this slice.
