# Phase 7N2L4Q0 — Choose Next Practical Workstream

## Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

Planning only. No runtime, catalog, bundles, source data, matrices, tests,
packages, or review artifacts were changed. Son/`prix`, `fièvre`, and `poulet`
were not reopened. Usage evidence is not treated as lexical validation or
demand evidence. No validation workflows were created.

## 1. Current baseline

| Field | Value |
| --- | --- |
| Featured / default | `bundle_full_20260710_337619ff` |
| 7N2B closure | `PHASE_7N2B_PROMOTION_CLOSED_STABLE` |
| 7N2I single-word miss copy | `SINGLE_WORD_MISS_COPY_WORKSTREAM_CLOSED` |
| 7N2J featured usage round 3 | `FEATURED_USAGE_ROUND3_NO_ACTIONABLE_ISSUE` |
| 7N2K offline hit labeling | `OFFLINE_ISSUE_CLASS_CLEANUP_WORKSTREAM_CLOSED` |
| Constraint | Prefer the smallest workstream that can move forward now |
| Documented residual | Offline **miss** rows with persona `setup_ux` still look like setup failures (content miss ≠ install failure) |

## 2. Evidence inspected

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2k4p4_offline_issue_class_cleanup_closure_report.md` | Hit remapping closed; offline-miss `setup_ux` residual noted |
| `docs/reports/phase7n2j4o2_featured_usage_round3_review_report.md` | No product issue; EN/mixed weak; lexical blocked |
| `docs/reports/phase7n2i4n6_single_word_miss_copy_closure_report.md` | Miss-copy baselines closed |
| `docs/reports/phase7n2b4g13_promotion_closure_report.md` | Catalog schema + storage/import residuals |

## 3. Candidate workstream evaluation table

| workstream_id | value | dependency | risk | recommended_status | reason |
| --- | --- | --- | --- | --- | --- |
| 1 — Catalog schema hardening | Medium — explicit featured/status metadata reduces env/sort ambiguity | Engineering planning then schema/runtime conventions | Medium/high | `defer` | Larger than completing the harness labeling residual left by 7N2K |
| 2 — Storage/import observation | Low/medium — summarize featured import/storage timings | Existing featured harness timings | Low | `monitor_only` | Useful residual watch; not the smallest actionable labeling follow-up |
| 3 — English/mixed-language copy | Low/medium — clarify dictionary ≠ sentence translation | Product copy only | Medium if scoped as language expansion | `defer` | Round 3 found weak signal beyond shipped miss copy |
| 4 — Tracked bundle cleanup | Medium hygiene — assess older tracked `web/public/bundle_full_*` retention | Retention policy + careful deletion discipline | Medium/high if deleted wrongly | `defer` | Higher risk than harness evidence-class clarification |
| 5 — Offline miss classification follow-up | Medium for review quality — decide whether offline content misses should stay `setup_ux` or use a separate evidence class | `deriveIssueClass` + offline_check personas; no product runtime | Low | **recommend_next** | Smallest forward path: documented 7N2K residual; harness-only; completes offline labeling clarity without lexical/catalog work |
| 6 — Lexical validation | High if data existed — Son/`prix`, `fièvre`, `poulet` | External owner validation data | High if invented | `blocked` | Still no actionable validation data; do not reopen |

Exactly one `recommend_next`: **5**.

## 4. Recommended workstream

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2L — Offline miss classification follow-up (harness evidence quality)

WORKSTREAM_TYPE:
harness_evidence_labeling_clarification

SCOPE_SHAPE:
Plan (then later decide/implement) how offline/reopen rows with status miss
should be labeled when search completed normally after reopen — e.g. keep
setup_ux, map to pending_human_review / no_issue_observed-adjacent class, or
introduce a clearer non-setup class — without treating content misses as
lexical authority or demand, and without product UI changes.

EXPLICITLY_OUT_OF_SCOPE:
Adding lemmas for bonjour / fièvre / poulet / Son; catalog schema;
tracked-bundle deletion; English onboarding expansion; demand ranking;
product empty-state copy changes

RATIONALE:
7N2K fixed successful offline hits. The remaining offline labeling gap is
content misses still tagged setup_ux. That is the smallest practical next
harness-clarity slice and can proceed without blocked lexical data.

BLOCKERS:
none for Q1 plan drafting
```

## 5. Explicit deferrals / blocked items

| Item | Status | Why |
| --- | --- | --- |
| Catalog schema hardening | `defer` | Larger engineering track |
| Storage/import observation | `monitor_only` | Passive residual |
| English/mixed-language copy | `defer` | Weak beyond shipped miss copy |
| Tracked bundle cleanup | `defer` | Higher-risk retention/deletion track |
| Son/`prix`, `fièvre`, `poulet` | `blocked` | No external validation data |

## 6. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Remapping offline miss hides real offline setup failure | medium | Only remap when search completed with a normal miss meta (dictionary still active) |
| Treating remapped miss as lexical “fixed” | medium | Keep lexical track blocked; labeling ≠ content authority |
| Expanding into new IssueClass taxonomy without need | low/medium | Prefer reuse of existing classes if sufficient |
| Catalog schema left unaddressed | medium | Remain deferred but listed |

## 7. Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2L — Offline miss classification follow-up (harness evidence quality)

WORKSTREAM_TYPE:
harness_evidence_labeling_clarification

RATIONALE:
Smallest forward path after 7N2K: clarify offline content-miss labeling so
reviewers do not confuse dictionary misses with setup failures.

BLOCKERS:
none for Q1 drafting
```

## 8. Next slice

**Phase 7N2L4Q1 — Draft Selected Workstream Plan**

Purpose: draft the offline-miss classification options, recommended mapping,
non-triggers, and test impact for harness evidence labeling only.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

Q0 created only this report. No runtime, catalog, bundles, source data,
matrices, tests, packages, or review artifacts were edited.
