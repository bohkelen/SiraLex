# Phase 7N2E4J1 — Review Usage Evidence for Actionable Non-Lexical Issues

## Decision

```text
USAGE_EVIDENCE_REVIEW_ACTIONABLE_ISSUE_SELECTED
```

Review/reporting only. No runtime, catalog, bundles, source data, matrices,
tests, or packages were changed. Son / `prix`, `fièvre`, and `poulet` were not
reopened. No lexical additions are proposed.

## 1. Workstream context

| Field | Value |
| --- | --- |
| J0 report | `docs/reports/phase7n2e4j0_next_practical_workstream_report.md` |
| J0 decision | `NEXT_PRACTICAL_WORKSTREAM_DEFINED` |
| Selected workstream | `7N2E — Usage evidence review for actionable non-lexical issues` |
| Constraint | At most one `recommend_next`; non-lexical only |

## 2. Evidence reviewed

| Path | Role |
| --- | --- |
| `data/local_evidence/human_usage_automation/candidate_rebuild_structured_usability_evidence_corrected_20260702.md` | Corrected compact evidence table |
| `data/local_evidence/human_usage_automation/candidate_rebuild_structured_usability_evidence_corrected_20260702.jsonl` | 68 structured rows (canonical corrected set) |
| `data/local_evidence/human_usage_automation/candidate_rebuild_structured_usability_evidence_corrected_20260702.json` | Full corrected JSON mirror |
| `data/local_evidence/human_usage_automation/usage_2026-07-02T22-26-48-625Z/` | Source run (`run_summary.json`, jsonl, md) |
| `data/local_evidence/human_usage_automation/usage_2026-07-02T22-10-55-941Z/` | Earlier run (same cohort shape; corrected set is preferred) |
| `docs/LOCAL_USAGE_AUTOMATION.md` | Evidence boundary: scripted usability only; not demand |

Evidence scope notes (from the artifacts themselves):

| Fact | Value |
| --- | --- |
| `session_type` | `structured_usability` |
| `can_influence_demand` | `false` |
| Installed bundle in run | `bundle_full_20260616_phase7j_alias_round2_candidate` (package install) |
| Row count | 68 |
| Natural-use logs | not included |

These rows are scripted diagnostic UX evidence. They do not invent natural user
behavior beyond the recorded harness queries and observed UI text.

Issue-class counts in the corrected JSONL:

| `issue_class` | Count |
| --- | --- |
| `no_issue_observed` | 42 |
| `interpretability` | 9 |
| `phrase_mismatch` | 8 |
| `pending_human_review` | 3 |
| `setup_ux` | 3 |
| `missing_entry` | 1 |
| `language_mismatch` | 1 |
| `spelling_error` | 1 |

No dedicated import/storage failure rows were present beyond offline-reopen
checks (most offline reopen lemma searches hit successfully on the run bundle).

## 3. Findings table

### Finding F1 — Recurring phrase-mismatch / lemma-boundary guidance

| Field | Value |
| --- | --- |
| `finding_id` | `7n2e_f1_phrase_mismatch_guidance` |
| `evidence_source` | Corrected JSONL/MD; phrase rows e.g. `comment dit-on école`, `combien ça coûte`, `merci beaucoup`, `mon enfant est malade`, `je t'aime`, `viens ici`, `je veux apprendre le maninka`, `qu'est-ce que cela veut dire` |
| `symptom` | Multiword / sentence-like queries miss with meta: `No exact result for this expression. Try one word at a time.` |
| `affected query or scenario` | Phrase scenario-card queries across G1–G5 / N1–N5 (8 `phrase_mismatch` rows; several tagged recurrence 4) |
| `category` | `phrase_mismatch` / product guidance (not lexical content) |
| `actionable_next_step` | Draft a minimal product-copy / miss-guidance improvement plan that keeps phrases as dictionary misses and clarifies lemma lookup (no phrase aliases, no sentence translation) |
| `implementation_dependency` | Product/UX copy (+ optional later UI); no linguistic tables |
| `risk` | Medium if “guidance” becomes phrase aliases or free translation |
| `status` | **recommend_next** |

Rationale: strongest recurring non-lexical cluster in the evidence; aligns with
7N2C `approved_product_boundary`; does not require Son/`fièvre`/`poulet`
validation.

### Finding F2 — English / mixed-language expectation mismatch

| Field | Value |
| --- | --- |
| `finding_id` | `7n2e_f2_english_mixed_language_copy` |
| `evidence_source` | `what does kun mean` (`language_mismatch`); `how do you say thank you` (`setup_ux` / `product_copy_onboarding`) |
| `symptom` | English or mixed prompts miss (or automation errors) while phrase-style guidance appears |
| `affected query or scenario` | N2 / N4 phrase cards |
| `category` | `language_mismatch` / `product_copy_onboarding` |
| `actionable_next_step` | Later fold into phrase/onboarding copy work if F1 proceeds; do not add English translation features |
| `implementation_dependency` | Product copy only |
| `risk` | Medium if treated as language-expansion scope |
| `status` | `defer` |

### Finding F3 — Harness settle timeout on already-shown phrase miss

| Field | Value |
| --- | --- |
| `finding_id` | `7n2e_f3_harness_phrase_meta_settle_timeout` |
| `evidence_source` | `how do you say thank you` observed `error`: Search metadata did not settle within 15000ms; **Last meta already** `No exact result for this expression. Try one word at a time.` |
| `symptom` | Automation reports error even though miss guidance text was present |
| `affected query or scenario` | English phrase query under Playwright settle wait |
| `category` | evidence quality / test harness |
| `actionable_next_step` | Optional later harness fix: treat settled phrase-miss meta as success for evidence capture |
| `implementation_dependency` | `web/e2e/human_usage/` only |
| `risk` | Low |
| `status` | `defer` |

### Finding F4 — Multi-result Maninka interpretability (`Kùn`)

| Field | Value |
| --- | --- |
| `finding_id` | `7n2e_f4_kun_multi_hit_interpretability` |
| `evidence_source` | Multiple `Kùn` / `kùn` `interpretability` rows (`hit_multi`, senses including `à` and `tête`) |
| `symptom` | Reverse lookup returns multiple senses; explainability unclear |
| `affected query or scenario` | Target→source body-word probes |
| `category` | `interpretability` / result UX |
| `actionable_next_step` | Needs semantic owner disposition before any UI ranking/filter change |
| `implementation_dependency` | Owner linguistic judgment (+ possible later result UX) |
| `risk` | Medium/high if silently demoting senses |
| `status` | `not_actionable` (blocked on owner semantic review; out of non-lexical scope for now) |

### Finding F5 — Historical lexical misses in evidence (do not reopen)

| Field | Value |
| --- | --- |
| `finding_id` | `7n2e_f5_blocked_lexical_rows` |
| `evidence_source` | `prix`, `fièvre`, `poulet` (`pending_human_review`); also historical `moto`, `maman`, `bonjour` rows on the 7J run bundle |
| `symptom` | Lemma misses or offline miss classifications in the July 2 run |
| `affected query or scenario` | Market / health / food / greeting / transport probes |
| `category` | lexical / deferred validation |
| `actionable_next_step` | None in 7N2E — Son/`prix`, `fièvre`, `poulet` remain deferred per 7N2D; do not propose lexical additions |
| `implementation_dependency` | Owner validation data (unavailable) |
| `risk` | High if reopened without data |
| `status` | `not_actionable` |

Note: some historical rows (`moto`, `maman`) are stale relative to later shipped
7N2A/7N2B deltas; they are not used to reopen lexical work here.

### Finding F6 — Offline reopen / storage observation

| Field | Value |
| --- | --- |
| `finding_id` | `7n2e_f6_offline_reopen_observation` |
| `evidence_source` | Offline-check rows (`école`, `riz`, `manger`, `écrire`, `eau`, `travail`, `langue`, plus miss rows for `moto`/`bonjour` on the run bundle) |
| `symptom` | Offline reopen generally preserved searchability for successful lemma hits; no import/storage failure payload recorded |
| `affected query or scenario` | Offline scenario cards |
| `category` | offline / storage observation |
| `actionable_next_step` | Continue post-promotion monitoring only |
| `implementation_dependency` | Real-use observation |
| `risk` | Low |
| `status` | `monitor_only` |

## 4. Recommended issue (exactly one)

```text
RECOMMENDED_ISSUE:
7n2e_f1_phrase_mismatch_guidance

CATEGORY:
phrase_mismatch / product guidance

MINIMAL_FIX_DIRECTION:
Draft clearer lemma-boundary / “try one word” product guidance for phrase misses
without adding source_phrase_aliases or sentence translation.

EVIDENCE_BASIS:
8 phrase_mismatch rows in corrected local usage evidence; repeated miss meta
already shows “Try one word at a time.”; user-impact notes call for clearer
dictionary-vs-translation communication and onboarding copy.
```

## 5. Deferred / non-actionable summary

| Finding | Status |
| --- | --- |
| F2 English / mixed-language copy | `defer` |
| F3 harness settle timeout | `defer` |
| F4 `Kùn` multi-hit interpretability | `not_actionable` |
| F5 Son/`prix`, `fièvre`, `poulet` (+ other lexical rows) | `not_actionable` |
| F6 offline/storage | `monitor_only` |

## 6. Decision

```text
USAGE_EVIDENCE_REVIEW_ACTIONABLE_ISSUE_SELECTED
```

One actionable non-lexical issue is selected: recurring phrase-mismatch product
guidance (F1). No lexical reopen. No implementation in this slice.

## 7. Next slice definition

**Phase 7N2E4J2 — Draft Minimal Fix for Selected Usage Issue**

Purpose: draft a minimal product-guidance fix plan for
`7n2e_f1_phrase_mismatch_guidance` (copy/UX only; no phrase aliases; no
runtime/catalog/source implementation in the draft slice unless later approved).

## 8. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

J1 created only this report. No edits to env, catalog, bundles, `web/src/`,
aliases, supplements, matrices, `data/` sources, `api/`, packages, or release
documents.
