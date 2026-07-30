# Phase 7N2J4O1 — Draft Featured Usage Round 3 Plan

## Decision

```text
FEATURED_USAGE_ROUND3_PLAN_READY
```

Planning only. No runtime, catalog, bundles, source data, matrices, tests,
packages, or review artifacts were changed. Son/`prix`, `fièvre`, `poulet`, and
`bonjour` were not reopened as lexical work. Usage rows are not demand evidence
and not lexical validation.

## 1. Inputs

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2j4o0_next_practical_workstream_report.md` | Selected 7N2J round 3 |
| `docs/reports/phase7n2i4n6_single_word_miss_copy_closure_report.md` | New single-word miss copy baseline |
| `docs/reports/phase7n2h4m4_featured_usage_harness_closure_report.md` | Opt-in featured harness mode |
| `docs/LOCAL_USAGE_AUTOMATION.md` | Evidence output layout |
| `web/package.json` | `test:e2e:usage:featured` script |

## 2. Goal

Run **fresh** featured 7N2B usage evidence after the single-word miss copy fix,
then review for non-lexical product/usability confirmation and at most one new
actionable issue (or none). Prior July 17 featured runs are **pre-N4** and must
not be the primary post-copy evidence.

## 3. O2 command

```bash
npm --prefix web run test:e2e:usage:featured
```

This sets:

- `SIRALEX_USAGE_BUNDLE_DIR=public/bundle_full_20260710_337619ff`
- `SIRALEX_USAGE_INSTALL_TIMEOUT_MS=900000`

Expected duration: ~7–10 minutes (install + cohort), similar to prior featured runs.

## 4. Expected evidence directory pattern

```text
data/local_evidence/human_usage_automation/<run_id>/
  run_summary.json
  structured_usability_evidence.jsonl
  structured_usability_evidence.md
```

| Field | Expectation |
| --- | --- |
| `<run_id>` | `usage_<ISO-ish timestamp>` created by the O2 run |
| Bundle notes | Install note references `bundle_full_20260710_337619ff` (not debug) |
| `run_summary.json` | `session_type: structured_usability`; `can_influence_demand: false` |
| Rows | All rows `can_influence_demand: false` |
| Primary review target | Newest featured run from O2 (not older pre-copy runs) |

## 5. Review focus / categories

| category_id | what_to_check | pass signal |
| --- | --- | --- |
| A1 — single-word miss copy | Single-token miss `search_meta_text` | Contains new wording: EN `Try another spelling or form.` / FR equivalent if locale FR; **must not** contain `Check the search direction` / `Vérifiez le sens de recherche` |
| A2 — phrase miss copy | Whitespace / phrase-miss rows | Still `Try searching one word at a time.` (EN) / `Essayez de chercher un mot à la fois.` (FR); unchanged from 7N2E |
| B — featured hits | `hit_single` / `hit_multi` rows | Harness completes with normal result meta; no settle/timeout errors on hits |
| C — offline/reopen | `offline_check` / `offline_reopen_checked` rows | Dictionary remains searchable after reopen (hits or content misses — not install loss) |
| D — harness/evidence quality | Summary + row completeness | Run passes; 68 rows (or cohort-stable count); boundary fields intact; no harness failure |
| E — residual non-lexical | Only if clear new product friction appears | At most one `recommend_next`; else `none` |

Closed baselines (do **not** re-open as new issues unless regressing):

- Phrase guidance (7N2E) — expect still OK
- Single-word direction-overblame copy (7N2I) — expect fixed in A1

## 6. Explicit out-of-scope boundaries

| Boundary | Rule |
| --- | --- |
| Demand | Do not rank or promote demand from rows |
| Lexical validation | Hits/misses are not orthography or sense authority |
| Lexical additions | No proposed lemmas/aliases/targets for Son/`prix`, `fièvre`, `poulet`, `bonjour`, or others |
| Catalog / bundles / runtime | Not edited in O1/O2 |
| English/mixed onboarding | Only if strongly evidenced beyond phrase + single-word baselines |
| Pre-copy evidence as primary | July 17 featured runs are contrast only, not primary post-copy proof |

## 7. Pass / fail criteria (O2)

| Criterion | Pass | Fail |
| --- | --- | --- |
| Featured command completes | Playwright test **1 passed** | Timeout/error/fail |
| Evidence written | New `usage_*` dir with summary + jsonl + md | Missing artifacts |
| Demand boundary | All rows `can_influence_demand: false` | Any true / missing boundary |
| Single-word miss copy | New spelling/form wording on single-word misses | Old direction-blame wording remains |
| Phrase miss copy | Unchanged phrase guidance on multiword misses | Phrase copy regresses |
| Hits / offline | Hits present; offline reopen still usable | Install lost / systematic settle failure |
| Review outcome | At most one non-lexical actionable issue selected, or explicitly none | Lexical reopen or demand claims |

O2 deliverable: a review report with decision

- `FEATURED_USAGE_ROUND3_ACTIONABLE_ISSUE_SELECTED`, or
- `FEATURED_USAGE_ROUND3_NO_ACTIONABLE_ISSUE`

## 8. O2 method (plan only)

1. Run `npm --prefix web run test:e2e:usage:featured`.
2. Identify newest featured `usage_*` directory (bundle note contains `337619ff`).
3. Confirm summary boundary + row count.
4. Sample single-word miss meta for new copy; sample phrase miss meta for unchanged phrase copy.
5. Confirm hit mix and offline reopen usability.
6. Scan residual categories; select at most one new non-lexical issue or none.
7. Explicitly list lexical-blocked terms ignored.

## 9. Decision

```text
FEATURED_USAGE_ROUND3_PLAN_READY
```

## 10. Next slice

**Phase 7N2J4O2 — Run and Review Featured Usage Round 3**

Purpose: execute the featured command, review the new evidence under this plan,
and select at most one non-lexical actionable issue (or none).

## 11. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

O1 created only this plan report. No runtime, catalog, bundles, source data,
matrices, tests, packages, or review artifacts were edited.
