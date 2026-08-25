# CORPUS1F13 — Malidaba Batch 001 Review Persistence

## 1. Decision

**CORPUS1F13_MALIDABA_BATCH001_REVIEWS_PERSISTED**

## 2. Base commit

`e5fb64fb893dfe964096e1dc829d0f6944050aa5` — *Expose Malidaba review classification evidence* (CORPUS1F12A)

## 3. Human judgment supplied

The human reviewer manually inspected all 100 Batch 001 rows and explicitly
stated that **ALL 100 ROWS LOOK GOOD**.

That judgment is encoded narrowly as:

`review_decision = confirmed_source_delta` × 100

## 4. Why mechanical encoding is not AI review

Cursor/AI did **not** evaluate Malidaba linguistic content. It only:

1. verified frozen F11/F12 context
2. mechanically wrote the human-supplied decision onto blank review fields
3. ran governed dry-run + persistence

Reviewer provenance remains `Reviewer_001` / `manual_review`.

## 5. Frozen input verification

| Input | SHA-256 | Status |
|-------|---------|--------|
| Baseline IR | `97529fc9bb69d9eb3a3ce40ffa30cc6a1b881f7f2b5edb2709ae7ed3db4dafe1` | PASS |
| Current IR | `fb8e97b0a8e1b82b5fc7874d7af010063112799cc116dd458ae0c48e56778221` | PASS |
| Trusted delta | `6dd2092078ba99c512b1e7b376e68599dd7e3faa1e7f1b8cccd1fe20335abeba` | PASS |

## 6. Worksheet identity

| Field | Value |
|-------|-------|
| Path | `data/malidaba_delta/current/review/malidaba_new_headword_review_batch_001.csv` |
| Schema | `malidaba_delta_review_worksheet_v2` |
| Rows | 100 |
| Unique `review_subject_id` | 100 |
| Unique fingerprints | 100 |
| `source_section_class = BASE_LEXICAL` | 100 |
| Non-empty `source_ps_raw` | 100 |
| Non-empty classification evidence | 100 |
| Worksheet SHA-256 (completed) | `9effd0e7db0b0a9673aa7ec982a1a8c21ffc78681f7779faf4ea6d0f70dd9fb8` |

Blank dry-run (before encoding):

```
rows_read = 100
rows_skipped_unreviewed = 100
preview_row_count = 0
error_count = 0
```

## 7. Completed worksheet counts

| Field | Value |
|-------|-------|
| `confirmed_source_delta` | 100 |
| `reject_delta_extraction` | 0 |
| `needs_more_evidence` | 0 |
| `issue_codes` | empty (not invented) |
| `review_notes` | empty (not invented) |

## 8. Dry-run result (completed)

```
rows_read = 100
rows_skipped_unreviewed = 0
preview_row_count = 100
error_count = 0
decision_counts.confirmed_source_delta = 100
```

## 9. Review persistence contract

Schema: `malidaba_delta_reviews_v1`

Subject ontology: **one Malidaba version-delta source record**
(`review_subject_id` = current IR id). Distinct from corpus annotation reviews.

Registry (local/gitignored):

`data/malidaba_delta/current/review/malidaba_delta_reviews_v1.jsonl`

Each row stores: `review_id`, `review_subject_id`, `batch_id`, `delta_sha256`,
`current_ir_sha256`, `current_record_fingerprint_sha256`, `review_decision`,
`reviewer_id`, `reviewed_at`, `review_method`, `issue_codes`, `review_notes`,
and optional `supersedes_review_id` (same-reviewer revision only).

Review IDs are deterministic (`mdrv_<subject>_<digest12>`). Initial reviews
without `supersedes_review_id` keep the F13 first-apply identity payload.
Explicit revisions include `supersedes_review_id` in the identity digest.

Writer: `siralex-write-malipense-delta-reviews` / CLI
`siralex-malipense-delta-review write-reviews`

Safety pattern (CORPUS1F2-aligned):

dry-run → candidate validate → merge → validate merged → temp sibling → fsync →
exact temp-byte check → on-disk validate → `os.replace` → directory fsync →
post-write validate.

Default is validate-only; persistence requires `--apply`.

## 10. First apply result

| Metric | Value |
|--------|------:|
| rows_before | 0 |
| candidate_rows | 100 |
| new_rows_written | 100 |
| already_present_identical | 0 |
| rows_after | 100 |

## 11. Idempotence result

Second identical `--apply`:

| Metric | Value |
|--------|------:|
| new_rows_written | 0 |
| already_present_identical | 100 |
| rows_after | 100 |
| registry SHA unchanged | yes |

Registry SHA-256:

`6ada0ee6381379ae1f260c9317e6c6ca4233d76b1dcbc0e198ade21dc8e46104`

## 12. Registry composition

| Class | Count |
|-------|------:|
| Persisted reviews | 100 |
| `confirmed_source_delta` | 100 |
| Unique reviewed headwords | 100 |
| BASE_LEXICAL subjects | 100 |

## 13. Reviewer provenance

| Field | Value |
|-------|-------|
| reviewer_id | `Reviewer_001` (project convention) |
| review_method | `manual_review` |
| reviewed_at | `2026-08-22T12:45:00-04:00` (one consistent session timestamp) |

## 14. Review semantics

`confirmed_source_delta` means only:

> the current Malidaba record appears to be a genuine source-version delta
> relative to the frozen SiraLex baseline under F11/F12 comparison rules.

It does **not** mean approved dictionary entry, commercial usability,
independent linguistic verification, publication approval, bundle approval, or
rights clearance.

## 15. 100 confirmed deltas ≠ 100 published SiraLex words

These are **100 HUMAN-CONFIRMED SOURCE DELTAS**.

They are evidence that Malidaba changed. They are **not** automatically 100
approved SiraLex dictionary additions and do not enter product surfaces.

## 16. Rights boundary

Malidaba remains **CC BY-NC-SA 4.0**.

Persisting review evidence does not change rights posture.

## 17. Local registry / receipt paths

```
data/malidaba_delta/current/review/
  malidaba_new_headword_review_batch_001.csv   # completed worksheet
  malidaba_delta_reviews_v1.jsonl              # governed registry
  malidaba_batch001_persistence_receipt.json   # operational receipt
```

## 18. Non-mutation

| Check | Result |
|-------|--------|
| Canonical Malidaba IR | NONE |
| Canonical snapshots | NONE |
| Trusted F11 delta | NONE |
| Bundles / search / catalog | NONE |
| Product promotion | NONE |
| Review persistence location | local/gitignored only |
| Existing 100 registry bytes after supersession hardening | **UNCHANGED** |
| Registry SHA | `6ada0ee6381379ae1f260c9317e6c6ca4233d76b1dcbc0e198ade21dc8e46104` |
| Current-review leaves | 100 (one leaf per reviewer/scope) |
| `web/scripts/` | UNTOUCHED |

## 18a. Immutable review-event model + supersession (hardening)

Reviews are immutable events. A later judgment with a different `review_id` is
not enough to decide whether it revises or competes with an earlier judgment.

Optional same-reviewer revision field: `supersedes_review_id`.

Rules:

- no self-supersession
- target must exist
- same `review_subject_id`, `reviewer_id`, and frozen evidence hashes
- `reviewed_at >=` superseded `reviewed_at`
- supersession graph acyclic
- **one linear history** per `(subject, reviewer, frozen evidence)` → exactly
  one root and exactly one current leaf

Current review leaf ≠ latest timestamp. A leaf is a review not superseded by
another valid review.

Writer fail-closed: if a current leaf already exists for that scope and a new
candidate has a different `review_id` without explicit supersession → reject
silent duplicate (timestamp / notes / decision drift).

Strict allowed-field set: required v1 fields + optional `supersedes_review_id`.
Unknown fields (including promotion vocabulary) are rejected by the validator.

Existing Batch 001 rows do **not** contain `supersedes_review_id` and remain
valid without rewrite. Post-hardening idempotent re-apply:

```
new_rows_written = 0
already_present_identical = 100
rows_after = 100
registry SHA unchanged
```

## 19. Tests

`api/ir_parser/tests/` + `api/malipense_version_delta/tests/` → **144 passed**

Coverage includes: blank skip, completed dry-run, deterministic IDs,
context/fingerprint/decision/reviewer/timezone failures, first apply,
idempotence, review_id conflict, corrupted temp-byte block, deterministic
ordering, unknown/promotion field rejection, same-reviewer silent-duplicate
blocks, explicit supersession, branching/cycle/chronology/scope mismatches,
independent second reviewer, real 100-row registry leaf validation.

## 20. git diff --check

**PASS**

## 21. Working tree

CORPUS1F13 tracked code/tests/report committed after hardening.

Local review registry, completed worksheet, and receipts remain gitignored.

## 22. Recommended next gate

**DESIGN GOVERNED MALIDABA SOURCE-UPDATE / PRODUCT-CANDIDATE BOUNDARY**

Persist confirmed deltas first; only afterward design how (if ever) they may become
product candidates without collapsing source evidence into dictionary truth.
