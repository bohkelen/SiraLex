# CORPUS1F12A — Malidaba Review Worksheet Classification Evidence

## 1. Decision

**CORPUS1F12A_HUMAN_WORKSHEET_OBSERVABILITY_READY**

Human decisions: **0 — HUMAN REVIEW REQUIRED**

## 2. Base commit

`cea6dd52644ea453fbaeacde23b64a4940e763d9` — *Add Malidaba delta review triage* (CORPUS1F12)

## 3. Why this hardening was needed

Batch 001 classified all 100 rows as `BASE_LEXICAL`, but the v1 worksheet exposed
no source-visible PS evidence. The human reviewer could not independently verify
why each record entered the base-lexical review queue.

## 4. Why `pos` was empty (0 / 100)

Three separate layers:

| Layer | PS source | Result |
|-------|-----------|--------|
| **Classifier** | First `lxP2 span.PS` from frozen crawl HTML | Populated for ~all lexicon entries |
| **Parser IR** | `fields_raw.ps_raw` from **header strip only** (`_find_in_header_strip`) | Empty for nested May 2026 layout |
| **Worksheet v1 `pos`** | Mapped to `fields_raw.ps_raw` / `pos_hint` | **0 / 100** blank |

May 2026 Malidaba HTML nests `lxP2` (with `span.PS`) inside `p.lxP`. The parser
deliberately excludes nested lxP2 from header-strip extraction to avoid field bleed.
PS therefore lives in sense blocks at source, but entry-level IR `ps_raw` is
legitimately absent. The classifier reads crawl HTML independently — not a bug in
classification, but an observability gap in the worksheet projection.

## 5. Canonical `pos` semantics

`pos` remains the **normalized/parser entry-level POS hint** (`pos_hint` or
entry-level `ps_raw`). It is **not** the same as source-visible PS text.

Do **not** populate `pos` with `source_ps_raw`. The new v2 fields exist precisely
to keep these distinct.

## 6. Worksheet schema v2

`malidaba_delta_review_worksheet_v2`

New read-only columns:

| Column | Meaning |
|--------|---------|
| `source_ps_raw` | Exact `lxP2 span.PS` text used by classifier |
| `source_classification_rule_id` | `malipense_source_section_ps_v2` |
| `source_classification_evidence` | Deterministic rule token (e.g. `ordinary_pos:n`) |

Stale-context protection extended to all three fields.

## 7. Batch 001 regeneration

| Check | Result |
|-------|--------|
| Same subject set as F12 selection | **YES** |
| Same ordering | **YES** |
| Rows | 100 |
| Queue membership changed | **NO** |
| Classification algorithm changed | **NO** |

Regenerated locally:

`data/malidaba_delta/current/review/malidaba_new_headword_review_batch_001.csv`

## 8. Human readability (100 / 100)

| Field | Non-empty |
|-------|----------:|
| `source_ps_raw` | 100 / 100 |
| `source_classification_evidence` | 100 / 100 |
| `ordinary_pos:*` evidence | 100 / 100 |
| `headword_latin` | 100 / 100 |
| `headword_nko` | 100 / 100 |
| `pos` (normalized) | 0 / 100 (expected) |
| FR gloss context | 55 / 100 |
| EN gloss context | 99 / 100 |
| RU gloss context | 99 / 100 |
| Review fields | 0 filled (expected) |

## 9. Unedited dry-run

```
rows_read = 100
rows_skipped_unreviewed = 100
preview_row_count = 0
error_count = 0
worksheet_schema = malidaba_delta_review_worksheet_v2
```

## 10. Tests

`api/ir_parser/tests/` + `api/malipense_version_delta/tests/` → **110 passed**

New coverage: evidence export, normalized-vs-raw distinction, batch evidence
validation, stale protection on new fields, v2 dry-run, subject-set preservation.

## 11. Non-mutation

| Check | Result |
|-------|--------|
| Frozen F11 hashes | PASS |
| Canonical IR | NONE |
| Queue membership | NONE |
| Classification algorithm | NONE |
| Bundle/search/catalog | NONE |
| Review persistence | NONE |
| `web/scripts/` | UNTOUCHED |

## 12. Next gate

**HUMAN REVIEW OF MALIDABA NEW-HEADWORD BATCH 001** (v2 worksheet)

Human question unchanged: does this row accurately represent a genuine current
Malidaba source record absent from the SiraLex baseline?

`confirmed_source_delta` = source delta confirmed only — not publication approval.
