# Phase 7N2G4L2 — Review Remaining Usage Evidence

## Decision

```text
USAGE_ROUND2_ACTIONABLE_ISSUE_SELECTED
```

Review/reporting only. No runtime, catalog, bundles, source data, matrices,
tests, packages, or review artifacts were changed. Son / `prix`, `fièvre`, and
`poulet` were not reopened. No lexical additions were proposed. Closed phrase
guidance was not reopened (no new post-J5 product gap found).

## 1. Plan / inputs

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2g4l1_usage_round2_plan.md` | L1 areas A1/A2 (+ A5 novelty check) |
| `docs/reports/phase7n2e4j1_usage_evidence_review_report.md` | Round-1 F2/F3 context |
| `data/local_evidence/human_usage_automation/candidate_rebuild_structured_usability_evidence_corrected_20260702.jsonl` | Canonical 68 rows |
| Matching `.md` + `usage_2026-07-02T22-26-48-625Z/` | Compact table / source run |

Evidence remains `structured_usability` with `can_influence_demand: false`.

## 2. Findings

### Finding R2-1 — English / mixed-language copy confusion

| Field | Value |
| --- | --- |
| `finding_id` | `7n2g_r2_english_mixed_language_copy` |
| `evidence_source` | `what does kun mean` → miss + phrase-style meta; `how do you say thank you` → automation error with last meta already phrase-miss guidance |
| `symptom` | English / mixed prompts do not yield lemma hits; users may expect translation-style answers |
| `category` | `language_mismatch` / `product_copy_onboarding` |
| `actionability` | Weak as a distinct post-J5 product fix: multiword English already hits the shipped phrase-miss empty-state path; adding English-specific translation copy would expand product scope |
| `dependency` | Product-copy decision; must not become English sentence translation |
| `risk` | Medium (scope creep into language features) |
| `recommended_status` | `defer` |
| `reason` | Existing shipped “one word at a time” guidance already covers multiword English misses. No distinct new product gap beyond closed 7N2E. |

### Finding R2-2 — Harness settle timeout on already-shown phrase miss

| Field | Value |
| --- | --- |
| `finding_id` | `7n2g_r2_harness_settle_timeout` |
| `evidence_source` | `how do you say thank you`: `status=error`; meta includes `Search metadata did not settle … within 15000ms. Last meta: No exact result for this expression. Try one word at a time.` |
| `symptom` | Playwright harness times out even though phrase-miss guidance text was already visible |
| `category` | evidence quality / test harness |
| `actionability` | High — smallest non-lexical engineering fix. Root cause readable in current harness: `waitForSettledSearchMeta` settles only if meta changes **or** meta includes the query string. Phrase-miss copy (old and new J3 short copy) does **not** include the query; consecutive phrase misses can leave `latest === previousSearchMetaText`, causing false timeouts. |
| `dependency` | `web/e2e/human_usage/usage_harness.spec.ts` settle logic only |
| `risk` | Low (evidence capture correctness; no search/index/catalog change) |
| `recommended_status` | **recommend_next** |
| `reason` | Confirmed evidence-quality defect with a clear, bounded harness fix path; preferred over A1 per L1 selection rule (smaller/safer). Still valid after J3 copy change because new phrase copy also omits the query. |

### Finding R2-3 — Novelty check for other product-only UX

| Field | Value |
| --- | --- |
| `finding_id` | `7n2g_r2_no_novel_product_ux` |
| `evidence_source` | Residual onboarding-like phrase rows (`je veux apprendre le maninka`, `qu'est-ce que cela veut dire`, other `phrase_mismatch` rows) |
| `symptom` | Phrase/onboarding expectation mismatch already addressed by shipped primary phrase guidance |
| `category` | product UX |
| `actionability` | None distinct from closed J5 workstream |
| `dependency` | — |
| `risk` | Medium if used to reopen phrase-guidance scope |
| `recommended_status` | `defer` |
| `reason` | No new post-J5 product-only issue found in existing evidence beyond shipped “Try searching one word at a time.” |

### Explicitly out of round-2 selection (unchanged)

| Finding | Status |
| --- | --- |
| `Kùn` interpretability | `not_actionable` |
| Storage/import observation | `monitor_only` |
| Son/`prix`, `fièvre`, `poulet` lexical reopen | `blocked` |

## 3. Recommended issue (exactly one)

```text
RECOMMENDED_ISSUE:
7n2g_r2_harness_settle_timeout

CATEGORY:
evidence quality / test harness

MINIMAL_FIX_DIRECTION:
Update waitForSettledSearchMeta (or equivalent) so already-visible phrase-miss /
no-result guidance counts as settled even when the meta text does not include
the query and may match the previous phrase-miss meta.

EVIDENCE_BASIS:
how do you say thank you errored on settle timeout while Last meta already
showed phrase-miss guidance; settle predicate requires text change or query
substring, which fails for consecutive identical phrase-miss messages.
```

## 4. Deferred / monitor-only / not-actionable summary

| Finding | Status |
| --- | --- |
| R2-1 English / mixed-language copy | `defer` |
| R2-3 other product UX novelty | `defer` |
| `Kùn` interpretability | `not_actionable` |
| Storage/import | `monitor_only` |
| Lexical residuals | `blocked` |

## 5. Decision

```text
USAGE_ROUND2_ACTIONABLE_ISSUE_SELECTED
```

## 6. Next slice definition

**Phase 7N2G4L3 — Draft Minimal Fix for Selected Round 2 Issue**

Purpose: draft the minimal harness settle-timeout fix for
`7n2g_r2_harness_settle_timeout` without changing product search behavior,
catalog, bundles, or source data.

## 7. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

L2 created only this report. No edits to env, catalog, bundles, `web/src/`,
aliases, supplements, matrices, `data/` sources, `api/`, packages, or release
documents.
