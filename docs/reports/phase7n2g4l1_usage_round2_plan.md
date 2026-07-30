# Phase 7N2G4L1 — Draft Usage Evidence Round 2 Plan

## Decision

```text
USAGE_ROUND2_PLAN_READY
```

Planning only. No runtime, catalog, bundles, source data, matrices, tests,
packages, or review artifacts were changed. No implementation was selected.
Son / `prix`, `fièvre`, and `poulet` were not reopened. No lexical additions
were proposed. Closed phrase-guidance scope is not reopened unless L2 finds a
**new** post-J5 issue in existing evidence (none assumed here).

## 1. Baseline

| Field | Value |
| --- | --- |
| L0 decision | `NEXT_PRACTICAL_WORKSTREAM_DEFINED` |
| Selected workstream | `7N2G — Usage evidence round 2 for remaining non-lexical issues` |
| Phrase guidance | `MINIMAL_PHRASE_GUIDANCE_WORKSTREAM_CLOSED` (J5) |
| Evidence corpus | Existing `data/local_evidence/human_usage_automation/` only (corrected 2026-07-02 set; 68 rows) |
| L2 goal | Review remaining non-lexical candidates; pick **at most one** `recommend_next` implementation candidate, or record none |

## 2. Evidence sources for L2

| Path | Use |
| --- | --- |
| `candidate_rebuild_structured_usability_evidence_corrected_20260702.jsonl` | Canonical corrected rows |
| `candidate_rebuild_structured_usability_evidence_corrected_20260702.md` | Compact table |
| `usage_2026-07-02T22-26-48-625Z/` | Source run summary / raw structured rows |
| `docs/reports/phase7n2e4j1_usage_evidence_review_report.md` | Round-1 findings F2–F6 |
| `docs/reports/phase7n2e4j5_phrase_guidance_closure_report.md` | Closed F1; deferred residuals |

Do not invent user behavior. Do not treat scripted rows as demand.

## 3. Candidate area table

| issue_id | evidence_source | category | current_status | actionability | dependency | risk | proposed_L2_handling |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `7n2g_a1_english_mixed_language_copy` (was F2) | `what does kun mean`; `how do you say thank you` | `language_mismatch` / `product_copy_onboarding` | `review_in_L2` | Possible small product-copy clarification only; no English translation feature | Product copy decision | Medium if scoped as language expansion | Re-read rows; decide recommend / defer / not_actionable without implementing |
| `7n2g_a2_harness_settle_timeout` (was F3) | `how do you say thank you` error; last meta already phrase-miss guidance | evidence quality / test harness | `review_in_L2` | Likely smallest engineering fix if still valid after J3 copy change | `web/e2e/human_usage/` settle/miss parsing only | Low | Confirm whether timeout still indicates a harness bug vs stale string expectation; decide recommend / defer |
| `7n2g_a3_kun_interpretability` (was F4) | Multiple `Kùn`/`kùn` `hit_multi` interpretability rows | result interpretability | `not_actionable` | Needs owner semantic disposition before UI ranking/filter changes | Owner linguistic judgment | Medium/high if senses demoted | Record as out of L2 implementation scope; do not select for fix |
| `7n2g_a4_storage_import_observation` (was F6) | Offline reopen rows; no import failure payload | offline / storage observation | `monitor_only` | No concrete failure to fix from this corpus | Real-use observation | Low | Keep monitor-only; do not select for fix |
| `7n2g_a5_other_product_ux_in_evidence` | Any residual product-only UX already present (e.g. onboarding-like phrase rows already covered by shipped guidance) | product UX | `defer` | Only if L2 finds a **distinct** product-only issue not already closed by J5 | Product review | Medium if reopens phrase-guidance scope | Scan for novelty vs shipped “one word at a time” copy; default defer |
| Closed F1 phrase guidance | Shipped EN/FR primary copy | phrase miss guidance | `defer` (closed) | Do not revisit unless evidence shows a **new** post-J5 gap | — | Medium if scope expands | Out of round-2 selection unless novelty proven from existing rows |
| Lexical residuals (Son/`prix`, `fièvre`, `poulet`, historical `bonjour`/`moto`/`maman`) | pending_human_review / setup_ux / missing_entry rows | lexical | `blocked` | Forbidden in 7N2G | Owner validation data | High | Exclude entirely |

## 4. Areas selected for L2 review

L2 **must** review:

1. `7n2g_a1_english_mixed_language_copy`
2. `7n2g_a2_harness_settle_timeout`

L2 may briefly confirm (no implementation expected):

3. `7n2g_a5_other_product_ux_in_evidence` — only to ensure no distinct leftover product-only issue remains after J5

## 5. Areas deferred / blocked / monitor-only / not actionable

| Area | Status |
| --- | --- |
| `Kùn` interpretability | `not_actionable` |
| Storage/import observation | `monitor_only` |
| Closed phrase-guidance follow-up / optional example line | `defer` unless L2 finds a new distinct gap |
| Son/`prix`, `fièvre`, `poulet` (+ other lexical reopen) | `blocked` |

## 6. L2 selection rule (no implementation in L1)

In L2:

- Use existing evidence only.
- Rank A1 vs A2 (and any novel A5) by actionability, risk, and size.
- Pick **at most one** `recommend_next` for a later minimal-fix draft, **or** decide `USAGE_EVIDENCE_ROUND2_NO_ACTIONABLE_ISSUE`.
- Prefer harness evidence-quality (A2) over product English-copy expansion (A1) if both remain equally evidenced and A2 is smaller/safer.
- Do not implement code in L2 (review/report only), matching prior J1 pattern unless a later slice is approved.

## 7. Decision

```text
USAGE_ROUND2_PLAN_READY
```

## 8. Next slice definition

**Phase 7N2G4L2 — Review Remaining Usage Evidence**

Purpose: review the selected round-2 areas against existing evidence and select
at most one actionable non-lexical issue (or none), without implementing fixes
or reopening lexical/phrase-guidance scope without cause.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

L1 created only this report. No edits to env, catalog, bundles, `web/src/`,
aliases, supplements, matrices, `data/` sources, `api/`, packages, or release
documents.
