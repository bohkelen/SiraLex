# CORPUS1F15 — Malidaba SOURCE_REFRESH_ACCEPTANCE Dry-Run Gate

## 1. Decision

**CORPUS1F15_MALIDABA_SOURCE_REFRESH_ACCEPTANCE_READY**

Overall source-refresh status:

**SOURCE_REFRESH_BLOCKED_REFERENCE_INTEGRITY**

The dry-run acceptance evaluator is implemented and ran against frozen F11/F13
inputs. Engineering gates G1–G6 and G10 PASS. Canonical refresh remains blocked
by downstream `ir_id` reference integrity (G7), with reinforcing G8 regression
and G9 destructive-change blockers. No apply was performed.

## 2. Base commit

`ffaa6499c63c9b3af3b5af199c14537d04ca4d88` — *Define Malidaba source and product boundary* (CORPUS1F14)

## 3. Frozen inputs

| Artifact | SHA-256 |
|----------|---------|
| Baseline canonical IR | `97529fc9bb69d9eb3a3ce40ffa30cc6a1b881f7f2b5edb2709ae7ed3db4dafe1` |
| Current corrected IR | `fb8e97b0a8e1b82b5fc7874d7af010063112799cc116dd458ae0c48e56778221` |
| Trusted delta | `6dd2092078ba99c512b1e7b376e68599dd7e3faa1e7f1b8cccd1fe20335abeba` |
| Review registry | `6ada0ee6381379ae1f260c9317e6c6ca4233d76b1dcbc0e198ade21dc8e46104` |

Hash mismatch blocks the run. No re-crawl.

## 4. Acceptance gate model

Dry-run evaluator: `malipense_version_delta.source_refresh`

Gates G1–G10 each return `PASS` / `BLOCK` / `NOT_APPLICABLE` with evidence.
Overall engineering readiness is derived only from gate statuses — never from
prose. Publication and product candidacy remain explicitly false even if
engineering were ready.

CLI: `siralex-malipense-source-refresh-acceptance`

## 5. G1 SOURCE_CAPTURE_VALID — PASS

Official Mali-pense lexicon origin, isolated May 2026 crawl, 27 letter pages,
capture receipt present, offline ZIP documented as non-authority, frozen
current IR SHA matches.

## 6. G2 PARSER_COMPATIBILITY_PASS — PASS

Nested `lxP2` support observed on 27/27 current lexicon pages; parser
compatibility assessment PASS; current sense coverage healthy.

## 7. G3 BASELINE_REGRESSION_PASS — PASS

Historical baseline reparse (F11 cache) vs canonical IR: 8823 rows, 8776 with
senses, **0** semantic projection diffs.

## 8. G4 CURRENT_STRUCTURAL_COVERAGE_PASS — PASS

| Metric | Value |
|--------|------:|
| Current rows | 11694 |
| Structurally expected sense entries | 10124 |
| Parsed with senses | 10124 |
| Unexpected no-sense | 0 |
| Parsed without senses (no structural gloss) | 1570 |

## 9. G5 DELTA_DETERMINISTIC — PASS

Dual in-memory compare identical; recomputed delta bytes match frozen trusted
delta SHA `6dd20920…5abeba`.

## 10. G6 DELTA_REVIEW_EVIDENCE_SUFFICIENT — PASS

| Metric | Value |
|--------|------:|
| Registry rows | 100 |
| Current leaves | 100 |
| `confirmed_source_delta` leaves | 100 |
| Reviewer | Reviewer_001 |
| Batch 001 unique headwords | 100 |
| Batch 001 unique pages | 24 |

Uses F14 decision `BATCH001_SUFFICIENT_FOR_SOURCE_FIDELITY_GATE`. Remaining 636
eligible rows are **not** required for this gate.

## 11. G7 DOWNSTREAM_REFERENCE_INTEGRITY — BLOCK

Audited tracked/runtime identity references:

- source aliases
- source-index supplements
- reviewed target variants
- phrase review artifacts
- search regression matrices

Identifiers are overwhelmingly **`ir_id`**-bound (not stable `source_record_id`).
Because Malidaba renumbers anchors across editions, baseline `ir_id` values
generally do not survive a raw IR replacement.

Local manifest (gitignored):

`data/malidaba_delta/current/source_refresh/downstream_reference_integrity.jsonl`

## 12. Reference-integrity findings

| Status | Count |
|--------|------:|
| still_resolves | 0 |
| requires_remap | 23 |
| ambiguous | 14 |
| broken | 0 |
| not_identity_bound | 132 |
| **total references** | **169** |

Remap allowed only via F11 confident identity (`STRONG` /
`EXACT_CONTENT_SUPPORTED` / unique `PROVISIONAL`). No auto-remap performed.
Ambiguous references are not force-matched.

**G7 BLOCKS** canonical refresh until remaps are explicitly governed.

## 13. G8 ISOLATED_BUILD_REGRESSION — BLOCK

Isolated candidate build under:

`data/malidaba_delta/current/source_refresh/build/`

Pipeline used real normalizer → enrich → search-index → alias apply → bundle
builder. Outputs stayed out of `web/public/`, canonical `data/bundles/`, and
canonical search_index paths.

## 14. Candidate-vs-canonical build summary

| Surface | Canonical | Candidate |
|---------|----------:|----------:|
| Dictionary rows (enriched/pipeline) | 19326 | 22198 |
| Search index postings | 112265 | 174600 |
| Lexicon IR rows | 8823 | 11694 |

Count growth is expected (newer Malidaba edition) and not automatic failure.

Search regression replay against candidate index:

| Result | Count |
|--------|------:|
| pass | 16 |
| fail | 14 |

Failures are dominated by unresolved baseline `ir_id` / alias / supplement
contracts — consistent with G7.

Candidate hashes:

- normalized: `3e8205a844adafb253884e5929deb4c515a057446e742d22f2820f478786ebef`
- search index: `674da277021da38558bb5fa386574059ec10d8fa53530c9aeb56bfb36dc53d10`
- bundle content: `sha256:5d7016ff3a104700bcf773d4d35cb5304b6dc315b45ce2197235a661e72ca9d7`

## 15. G9 NO_UNREVIEWED_DESTRUCTIVE_CHANGE — BLOCK

Missing baseline evidence rows: **42** (not deletions; not auto-applied).

## 16. Missing-record disposition

| Disposition | Count |
|-------------|------:|
| current_equivalent_resolved | 0 |
| not_product_visible | 0 |
| destructive_requires_review | 37 |
| ambiguous | 5 |

Manifest:

`data/malidaba_delta/current/source_refresh/destructive_change_disposition.jsonl`

G9 PASS would require every missing baseline record to be
`CURRENT_EQUIVALENT_RESOLVED` or `NOT_PRODUCT_VISIBLE`. That bar is not met.

## 17. Why generic ambiguous delta identity is not automatically blocking

There are **4234** `IDENTITY_AMBIGUOUS` delta rows. That number alone does
**not** fail SOURCE_REFRESH_ACCEPTANCE.

Reason: delta pairing ambiguity ≠ invalid current-source record. Ambiguity
blocks only where it affects downstream identity references, destructive-change
analysis, or explicit cross-version assertions (see G7/G9).

## 18. G10 RIGHTS_POSTURE_RECORDED — PASS

Claimed license: **CC BY-NC-SA 4.0**

| Distribution | Posture |
|--------------|---------|
| Internal source maintenance | `allowed` |
| Noncommercial distribution | `requires_rights_review` |
| Commercial distribution | `blocked` |

Engineering PASS must not flip commercial to `allowed`. This gate records and
enforces separation; it does not grant rights.

## 19. Engineering readiness

**Not ready for canonical apply.**

G1–G6 fidelity evidence is sufficient to trust the newer capture/parser/delta
story. G7/G8/G9 show that *replacing* canonical `src_malipense` would break
published `ir_id` contracts and remove product-visible baseline knowledge
without reviewed disposition.

## 20. Distribution-rights outcomes

Independent of engineering:

- Internal maintenance: allowed (subject to later apply gates)
- Noncommercial distribution: requires_rights_review
- Commercial distribution: blocked
- Publication authorized: **false**
- Product candidates authorized: **false**

## 21. Blocking reasons

1. G7: `requires_remap=23`, `ambiguous=14` downstream identity references
2. G8: `search_regression_failures=14` on isolated candidate
3. G9: `destructive_requires_review=37`, `ambiguous=5` missing baseline records

Primary overall status follows G7:
`SOURCE_REFRESH_BLOCKED_REFERENCE_INTEGRITY`

## 22. Local acceptance artifacts

Under `data/malidaba_delta/current/source_refresh/` (gitignored):

- `source_refresh_acceptance.json`
- `downstream_reference_integrity.jsonl`
- `destructive_change_disposition.jsonl`
- `build/` (isolated candidate normalize/enrich/index/bundle)

Acceptance artifact SHA-256:

`d48d7ee1382f337bc9b628fb7d98858a8e0780a8aad84ba00ebfc053faa29d1e`

## 23. Tests

Synthetic coverage in
`api/malipense_version_delta/tests/test_source_refresh_acceptance.py`:

- frozen hash mismatch blocks
- stable / remap / ambiguous / broken reference classification
- G7 blocks on requires_remap
- destructive not-visible vs product-visible vs ambiguous
- generic ambiguity does not alone fail G9
- rights remain distribution-specific; commercial not allowed by engineering
- deterministic acceptance serialization (no `generated_at`)
- isolated build failure blocks
- no canonical writes from acceptance path

Full relevant suite: **161 passed**

## 24. Non-mutation

| Target | Result |
|--------|--------|
| Canonical Malidaba snapshots | NONE |
| `data/ir/malipense_lexicon_v3.jsonl` | UNCHANGED (`97529fc9…`) |
| Review registry | UNCHANGED (`6ada0ee6…`) |
| Aliases / supplements / variants / owner lexical | NONE |
| `web/public` / catalogs | NONE |
| Product candidates / Batch 002 | NONE |
| `web/scripts/` | UNTOUCHED |

## 25. git diff --check

PASS

## 26. Working tree

Tracked (uncommitted for ChatGPT review):

- `api/malipense_version_delta/source_refresh/**`
- `api/malipense_version_delta/tests/test_source_refresh_acceptance.py`
- `api/pyproject.toml`
- `docs/reports/corpus1f15_malidaba_source_refresh_acceptance.md`

Local/gitignored acceptance outputs under `data/malidaba_delta/current/source_refresh/`

Also present locally: `?? web/scripts/` (untouched)

## 27. Recommended next gate

**CORPUS1F16 — Governed downstream `ir_id` remap + missing-record disposition
(planning/dry-run only)**

Precise blocker resolution (do not apply source refresh yet):

1. Emit deterministic remap proposals for the 23 `REQUIRES_REMAP` references
2. Quarantine/resolve the 14 ambiguous downstream references without fuzzy match
3. Human disposition for 42 missing baseline records (retain / equivalent /
   accept loss) before any destructive apply
4. Re-run this SOURCE_REFRESH_ACCEPTANCE dry-run until G7–G9 PASS
5. Only then design a guarded canonical apply slice (still rights-gated for
   distribution)
