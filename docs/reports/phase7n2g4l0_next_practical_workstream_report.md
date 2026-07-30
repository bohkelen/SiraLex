# Phase 7N2G4L0 — Choose Next Practical Workstream

## Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

Planning only. No runtime, catalog, bundles, source data, matrices, tests,
packages, or review artifacts were changed. Son / `prix`, `fièvre`, and `poulet`
were not reopened. No validation workflows were created. Closed phrase-guidance
and repo-cleanup scopes were not expanded.

## 1. Current baseline

| Field | Value |
| --- | --- |
| Featured / default | `bundle_full_20260710_337619ff` |
| 7N2B closure | `PHASE_7N2B_PROMOTION_CLOSED_STABLE` |
| 7N2D lexical intake | `7N2D_DEFERRED_NO_ACTIONABLE_VALIDATION_DATA` |
| 7N2E phrase guidance | `MINIMAL_PHRASE_GUIDANCE_WORKSTREAM_CLOSED` |
| 7N2F repo cleanup | `REPO_CLEANUP_WORKSTREAM_CLOSED` |
| Constraint | Prefer the smallest workstream that can actually move forward now |
| Tracked public bundles (inventory note) | 8 dirs; catalog uses 7J + 7N2A + 7N2B; five older tracked bundles remain |

## 2. Evidence inspected

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2f4k4_repo_cleanup_closure_report.md` | Cleanup closed; tracked-bundle cleanup deferred |
| `docs/reports/phase7n2e4j5_phrase_guidance_closure_report.md` | Phrase guidance closed; F2/F3/F4 residuals listed |
| `docs/reports/phase7n2d4i1_deferred_non_actionable_closure_report.md` | Lexical validation still unavailable |
| `docs/reports/phase7n2b4g13_promotion_closure_report.md` | Residual catalog/env/storage risks |

## 3. Candidate workstream evaluation table

| workstream_id | value | dependency | risk | recommended_status | reason |
| --- | --- | --- | --- | --- | --- |
| A — Catalog schema hardening | Medium — explicit featured/status metadata reduces env/sort ambiguity | Engineering planning then schema/runtime conventions | Medium/high | `defer` | Important G13 residual, but larger than a small evidence re-triage that can run immediately |
| B — Storage/import observation | Low — passive post-promotion watch | Real-use observation | Low | `monitor_only` | Keep watching; does not define a forward plan slice by itself |
| C — Usage evidence round 2 | Medium for planning — remaining non-lexical rows after phrase guidance shipped | Existing local evidence only (report/analysis) | Low | **recommend_next** | Smallest actionable forward path now: re-triage F2/F3/etc. without lexical reopen or bundle edits |
| D — Tracked bundle cleanup | Medium hygiene — assess retention of older tracked `web/public/bundle_full_*` | Retention policy + careful git history awareness | Medium/high if deleted wrongly | `defer` | Natural after 7N2F, but higher risk than evidence re-triage; keep for a later dedicated track |
| E — Phrase guidance follow-up | Low — optional example line / copy refinement | Product copy on closed workstream | Medium if scope expands | `defer` | 7N2E closed; do not expand without a new explicit need from evidence |
| F — Lexical validation | High if data existed — Son/`prix`, `fièvre`, `poulet` | External owner validation data | High if invented | `blocked` | Still no actionable validation data; do not reopen |

Exactly one `recommend_next`: **C**.

## 4. Recommended workstream

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2G — Usage evidence round 2 for remaining non-lexical issues

WORKSTREAM_TYPE:
usage_evidence_review

SCOPE_SHAPE:
Re-inspect local human-usage automation evidence for remaining actionable
non-lexical issues after phrase guidance shipped (e.g. English/mixed-language
copy F2; harness settle-timeout F3). Select at most one recommend_next issue,
or record that none remain actionable.

EXPLICITLY_OUT_OF_SCOPE:
Son / prix / fièvre / poulet validation; phrase-alias / sentence translation;
catalog schema migration; tracked-bundle deletion; reopening closed 7N2E copy
unless evidence clearly justifies a tiny follow-up

RATIONALE:
Phrase guidance and untracked-repo cleanup are closed. Lexical validation
remains blocked. The smallest workstream that can move forward now is a second
usage-evidence pass over already-collected rows to decide whether any residual
non-lexical issue is worth a minimal fix.

BLOCKERS:
none for L1 plan drafting
```

## 5. Explicit deferrals / blocked items

| Item | Status | Why |
| --- | --- | --- |
| Catalog schema hardening | `defer` | Larger engineering track |
| Storage/import observation | `monitor_only` | Passive residual risk |
| Tracked bundle cleanup | `defer` | Higher-risk retention/deletion track after untracked cleanup |
| Phrase guidance follow-up | `defer` | Closed workstream; no expand by default |
| Son/`prix`, `fièvre`, `poulet` | `blocked` | No external validation data |

## 6. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Round 2 quietly reopens lexical work | medium | Explicit blocked list for Son/`fièvre`/`poulet` |
| Round 2 expands closed phrase-guidance scope | medium | Only recommend a phrase follow-up if evidence shows a distinct gap beyond shipped primary copy |
| Skipping catalog residual indefinitely | medium | Keep catalog hardening deferred but listed |
| Jumping to tracked-bundle deletes | medium/high | Keep tracked cleanup deferred until a dedicated policy plan |

## 7. Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2G — Usage evidence round 2 for remaining non-lexical issues

WORKSTREAM_TYPE:
usage_evidence_review

RATIONALE:
Smallest forward path after phrase-guidance and repo-cleanup closures: re-triage
remaining non-lexical usage evidence without lexical reopen or bundle edits.

BLOCKERS:
none for L1 drafting
```

## 8. Next slice definition

**Phase 7N2G4L1 — Draft Selected Workstream Plan**

Purpose: draft the concrete usage-evidence round-2 plan (sources to re-inspect,
exclusion of deferred lemmas, selection rule for at most one actionable
non-lexical issue) without changing runtime or source data.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

L0 created only this report. No edits to env, catalog, bundles, `web/src/`,
aliases, supplements, matrices, `data/`, `api/`, review artifacts, packages, or
release documents.
