# CORPUS1F12 — Malidaba Delta Triage + Human Review Pilot

## 1. Decision

**CORPUS1F12_HUMAN_REVIEW_GATE_READY**

Human decisions recorded: **0 — HUMAN REVIEW REQUIRED**

## 2. Base commit

`6a6a8fc554b75692365bacc8a20f90b9e1dd4ee0` — *Restore Malidaba parser compatibility* (CORPUS1F11)

## 3. Frozen F11 input hashes

| Input | SHA-256 |
|-------|---------|
| Baseline canonical IR | `97529fc9bb69d9eb3a3ce40ffa30cc6a1b881f7f2b5edb2709ae7ed3db4dafe1` |
| Current corrected IR | `fb8e97b0a8e1b82b5fc7874d7af010063112799cc116dd458ae0c48e56778221` |
| Trusted delta JSONL | `6dd2092078ba99c512b1e7b376e68599dd7e3faa1e7f1b8cccd1fe20335abeba` |

Frozen-input verification runs before triage or dry-run. Hash mismatch → **BLOCK**
(`FrozenInputMismatchError`).

## 4. Why triage precedes bulk human review

A source-version delta is not automatically lexical growth. Of 2,797 new-headword
records, explicit source PS metadata shows that **2,055** carry onomastic/addon
markers (toponyms, clan names, personal names). An additional **2** lack sufficient
PS evidence and must remain unknown rather than contaminating the base-lexical review
queue.

Without source-record classification, a human would review thousands of mixed records
before discovering how much apparent headword growth is names/places versus dictionary
lexemes. Ambiguous identity (4,234 rows) remains quarantined.

## 5. Source-record classification method

Rule ID: `malipense_source_section_ps_v2`

The field remains `source_section_class` for worksheet compatibility, but the
classification is a **source-record classification** derived from `lxP2 span.PS`
metadata. It does **not** assert that Malidaba physically stores records in separate
HTML sections — all entries appear on letter pages in the captured crawl.

Classification rules (evidence-sensitive; positive BASE_LEXICAL required):

| Condition | Class |
|-----------|-------|
| `n prop TOP` | TOPONYM |
| `n prop NOM M` / `NOM F` | PERSON_NAME |
| `n prop NOM CL` | OTHER_ADDON |
| Non-empty PS with observed ordinary POS first token (`n`, `v`, `adj`, `adv`, `intj`, …) | BASE_LEXICAL |
| Missing / empty / unavailable PS | **UNKNOWN_SOURCE_SECTION** |
| `n prop …` without supported subtype | **UNKNOWN_SOURCE_SECTION** |
| Other non-empty PS not interpretable under explicit rules | **UNKNOWN_SOURCE_SECTION** |

Word-boundary guard: `n prophète` is **not** treated as onomastic (ordinary `n` POS).

**SURNAME** is not emitted — no explicit source marker was found.

## 6. Classification confidence / limitations

**PARTIAL**

- Strong for explicit `n prop TOP` / `NOM CL|M|F` markers.
- Strong for BASE_LEXICAL when PS first token matches observed Malidaba POS conventions
  (23 tokens from May 2026 crawl).
- Cannot split surname vs given name beyond source labels.
- Missing/empty PS → UNKNOWN (not permissive BASE_LEXICAL downgrade).
- Classification reads crawl HTML only; does not alter lexical parsing.

**Key invariant:** absence of an onomastic marker ≠ positive lexical classification.

## 7. Queue definitions

| Queue | Delta criterion | Notes |
|-------|-----------------|-------|
| **A** `NEW_HEADWORD_EVIDENCE` | `NEW_IN_CURRENT_SOURCE` AND headword absent from baseline | Primary human-review target |
| **B** `NEW_RECORD_EXISTING_HEADWORD` | `NEW_IN_CURRENT_SOURCE` BUT headword exists in baseline | Possible homonym / restructuring |
| **C** `CHANGED_MATCHED_RECORD` | `CHANGED_EXISTING_RECORD` | Retains identity confidence + change subtypes |
| **D** `MISSING_SOURCE_EVIDENCE` | `MISSING_FROM_CURRENT_SOURCE` | Never labeled “deleted” |
| **E** `IDENTITY_AMBIGUOUS` | `IDENTITY_AMBIGUOUS` | Quarantined |

Review subject: **one current Malidaba source record** (`review_subject_id` = current
`ir_id`). Headword grouping is presentation-only.

## 8. Queue counts

| Queue | Records |
|-------|--------:|
| A — NEW_HEADWORD_EVIDENCE | 2,797 |
| B — NEW_RECORD_EXISTING_HEADWORD | 2 |
| C — CHANGED_MATCHED_RECORD | 4,320 |
| D — MISSING_SOURCE_EVIDENCE | 42 |
| E — IDENTITY_AMBIGUOUS (quarantined) | 4,234 |

## 9. NEW_HEADWORD source-section breakdown

| Class | Records |
|-------|--------:|
| BASE_LEXICAL | 740 |
| TOPONYM | 1,539 |
| OTHER_ADDON | 513 |
| PERSON_NAME | 3 |
| UNKNOWN_SOURCE_SECTION | 2 |
| **Total** | **2,797** |

Unique descriptive headwords in Queue A: **2,754**

Only **740** records have positive ordinary-POS evidence for base lexical classification.
**736** of those also have parsed senses and form the Batch 001 eligible pool.

## 10. Reviewability descriptors

Per current-side record (triage metadata only; no quality score):

`has_sense`, `sense_count`, `has_fr_gloss`, `has_en_gloss`, `has_ru_gloss`,
`has_nko_headword`, `variant_count`, `example_count`, `idiom_or_subentry_count`,
`parse_warning_count`

## 11. Batch 001 selection algorithm

ID: `malidaba_new_headword_batch_v1_round_robin`

1. Eligible: Queue A + `source_section_class = BASE_LEXICAL` + `has_sense = true`.
   **UNKNOWN and onomastic classes excluded** — no quota-fill fallback.
2. Group by `url_canonical` (letter page).
3. Sort pages and within-page records deterministically.
4. Round-robin across pages; prefer one record per unique headword before homonym repeats.
5. Target: 100 records.

## 12. Batch 001 count

| Metric | Value |
|--------|------:|
| Target | 100 |
| Eligible pool | 736 |
| Actual | 100 |
| Unique headwords in batch | 100 |
| Homonym duplicate rows | 0 |

## 13. Batch 001 source-page distribution

24 letter pages represented:

| Page | Count | Page | Count |
|------|------:|------|------:|
| a.htm | 2 | n.htm | 5 |
| b.htm | 5 | o.htm | 2 |
| c.htm | 5 | p.htm | 5 |
| d.htm | 5 | r.htm | 4 |
| e.htm | 1 | s.htm | 5 |
| f.htm | 5 | t.htm | 5 |
| g.htm | 5 | w.htm | 5 |
| h.htm | 5 | y.htm | 5 |
| i.htm | 5 | ɔ.htm | 1 |
| j.htm | 5 | ɛ.htm | 1 |
| k.htm | 5 | ɲ.htm | 4 |
| l.htm | 5 | | |
| m.htm | 5 | | |

No pure alphabetical front-loading.

## 14. Worksheet schema

`malidaba_delta_review_worksheet_v1`

Read-only context includes frozen hashes, review subject identity, PS-derived
`source_section_class`, gloss summaries, fingerprint, and headword group fields.

Editable review columns (blank in Batch 001): `review_decision`, `reviewer_id`,
`reviewed_at`, `review_method`, `issue_codes`, `review_notes`.

## 15. Human decision semantics

Question reviewed:

> Does this candidate accurately represent a genuine **current** Malidaba source record
> absent from the SiraLex baseline under the stated comparison rule?

| Decision | Meaning |
|----------|---------|
| `confirmed_source_delta` | Source delta confirmed (NOT publication/commercial approval) |
| `reject_delta_extraction` | Parser/extraction error |
| `needs_more_evidence` | Insufficient evidence |

## 16. Stale-context protection

`current_record_fingerprint_sha256` covers identity + semantic projection. Dry-run
reconstructs expected context from frozen F11 inputs. Protected-context edits → fail closed.

## 17. Unedited dry-run (regenerated Batch 001)

```
rows_read = 100
rows_skipped_unreviewed = 100
preview_row_count = 0
error_count = 0
```

No persistence. No AI/default decisions.

## 18. Rights boundary

Malidaba content is CC BY-NC-SA 4.0. Review manifests and Batch 001 worksheet remain
**local / gitignored** under `data/malidaba_delta/current/review/`.

## 19. Local artifact paths

```
data/malidaba_delta/current/review/
  new_headword_evidence.jsonl
  new_record_existing_headword.jsonl
  changed_matched_records.jsonl
  missing_source_evidence.jsonl
  identity_ambiguous.jsonl
  triage_summary.json
  triage_receipt.json
  malidaba_new_headword_review_batch_001.csv   ← active human worksheet
```

CLI: `siralex-malipense-delta-review triage|dry-run`

## 20. Non-mutation

| Check | Result |
|-------|--------|
| Frozen input hashes | PASS |
| Canonical IR SHA | unchanged |
| Canonical snapshots | untouched |
| Bundles / search / catalog | none |
| Review persistence | not implemented |
| Promotion | none |
| Non-mutation | **PASS** |

## 21. Tests

`api/ir_parser/tests/` + `api/malipense_version_delta/tests/` → **100 passed**

Includes hardened classifier cases: missing/empty PS → UNKNOWN, unknown `n prop` forms,
explicit ordinary POS → BASE_LEXICAL, false-positive guard, batch eligibility without
UNKNOWN quota-fill, dry-run stale protection.

## 22. git diff --check

**PASS**

## 23. Working tree

CORPUS1F12 committed after hardening pass.

Pre-existing unrelated: `?? web/scripts/` (**untouched**)

## 24. Recommended next gate

**COMPLETED MALIDABA NEW-HEADWORD REVIEW BATCH 001**

Human reviewer fills the regenerated worksheet locally. Persistence deferred until
after human review warrants it.
