# Phase 7N2I4N1 — Draft Featured Usage Evidence Review Plan

## Decision

```text
FEATURED_USAGE_EVIDENCE_REVIEW_PLAN_READY
```

Planning only. No runtime, catalog, bundles, source data, matrices, tests,
packages, or review artifacts were changed. Usage rows are not demand evidence
and not lexical validation. Son/`prix`, `fièvre`, and `poulet` were not
reopened. No lexical additions were proposed.

## 1. Inputs

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2i4n0_next_practical_workstream_report.md` | Selected 7N2I featured usage evidence review |
| `docs/reports/phase7n2h4m4_featured_usage_harness_closure_report.md` | Featured harness mode closed; usability-only residual |
| `data/local_evidence/human_usage_automation/` | Local structured usability run artifacts |

## 2. Review objective

Inspect **featured-bundle** harness output for **non-lexical product/usability**
issues only. Goal of N2: select at most one actionable product/usability issue
(or explicitly none), without inventing demand claims or lexical work.

## 3. Primary evidence sources (featured)

Prefer the latest featured 7N2B runs (notes include
`bundle_full_20260710_337619ff` / hit+miss mix). Confirmed local candidates:

| Run id | Bundle | Observed mix (approx.) | Role |
| --- | --- | --- | --- |
| `usage_2026-07-17T23-49-49-008Z` | featured 7N2B | 43 hit_single / 11 hit_multi / 14 miss | **Primary** (M3 verify) |
| `usage_2026-07-17T23-35-12-183Z` | featured 7N2B | 43 / 11 / 14 | Secondary (M2 implement) |

Per-run files to read:

- `structured_usability_evidence.md` — compact table
- `structured_usability_evidence.jsonl` — row fields (`task_layer`, `search_direction`, `observed_result`, `issue_class`, notes)
- `run_summary.json` — must show `session_type: structured_usability`, `can_influence_demand: false`

Debug all-miss runs (`test_directional_bundle`) are **out of primary review**
except as harness/quality contrast if needed.

## 4. Review categories

| category_id | evidence_source | what_to_check | actionable_threshold | out_of_scope_boundary | risk |
| --- | --- | --- | --- | --- | --- |
| A — empty-state clarity | Featured miss rows; `search_meta_text` / issue class on zero-result tasks | Miss copy still clear after phrase guidance; multiword vs single-word empty states | Recurring product-copy friction on miss (same pattern ≥2 personas or ≥3 rows) that is **not** “missing dictionary entry” | Do not propose new lemmas; ignore Son/`prix`/`fièvre`/`poulet` as lexical gaps | Treating miss = content gap |
| B — direction confusion | Rows with `search_direction` flips / wrong-direction tasks | Users (scripted) see confusing results when direction mismatches intention | Clear UX friction where direction state or labeling likely caused wrong expectation, independent of lemma coverage | No lexicon or alias changes to “fix” direction misses | Misreading coverage miss as direction bug |
| C — offline/reopen behavior | Rows with `offline_reopen_checked: true` / `task_layer: offline_check` | Dictionary still usable after offline reopen; no false empty install state | Offline reopen fails, loses dictionary, or blocks search in a reproducible harness way | No storage-schema redesign from one observation alone | Overfitting to harness timing |
| D — result-display usability | `hit_single` / `hit_multi` rows; meta/result presentation notes | Hit/multihit display confusing, truncated, or hard to scan in recorded meta/impact fields | Recurring display friction on hits (not “wrong Maninka sense”) across personas | No sense-ranking / lexical sense edits; no demand ranking from hit counts | Semantic “wrong sense” treated as UI bug |
| E — harness/evidence quality | Featured vs debug run notes; errors; settle/timeouts; `can_influence_demand` | Rows complete; no harness errors; evidence boundary intact; settle stable on featured hits/misses | Harness false failures, missing fields, or boundary violations that would mislead product review | Do not expand cohort/personas unless quality blocks review | “Fix harness” becomes unbounded rewrite |
| F — English/mixed-language copy | Only if strongly evidenced in featured rows / meta text | UI language mix or EN copy that confuses dictionary ≠ sentence translation | Strong, repeated copy confusion in evidence **beyond** already-shipped phrase guidance | No language-pack expansion; no sentence translation feature | Reopening deferred EN copy without strong signal |

## 5. N2 review method (plan only)

1. Open primary featured run summary + markdown table.
2. Confirm `can_influence_demand: false` on all rows reviewed.
3. Walk categories A–E; open F only if evidence is strong.
4. Tag each candidate issue as `product_usability` | `harness_quality` | `not_actionable` | `lexical_blocked`.
5. Select **at most one** actionable issue for a later fix track, or record `none`.
6. Explicitly list ignored lexical misses (including Son/`prix`, `fièvre`, `poulet`).

## 6. Explicit out-of-scope boundaries

| Boundary | Rule |
| --- | --- |
| Demand | Rows must not influence demand ranking (`can_influence_demand: false`) |
| Lexical validation | Miss/hit counts are not orthography or sense authority |
| Lexical additions | No proposed new entries/aliases/targets |
| Blocked terms | Do not reopen Son/`prix`, `fièvre`, `poulet` |
| Implementation | N1/N2 are review/report only unless a later slice authorizes a product fix |
| Catalog / bundles / runtime | Not edited in this review workstream’s plan/review slices |

## 7. Decision

```text
FEATURED_USAGE_EVIDENCE_REVIEW_PLAN_READY
```

## 8. Next slice

**Phase 7N2I4N2 — Review Featured Usage Evidence**

Purpose: execute this plan against the primary featured run(s), classify findings
by category, and select at most one non-lexical actionable issue (or none).

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

N1 created only this plan report. No runtime, catalog, bundles, source data,
matrices, tests, packages, or review artifacts were edited.
