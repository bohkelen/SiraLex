# Phase 7N2J4O0 — Choose Next Practical Workstream

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
| 7N2D lexical intake | `7N2D_DEFERRED_NO_ACTIONABLE_VALIDATION_DATA` |
| 7N2E phrase guidance | `MINIMAL_PHRASE_GUIDANCE_WORKSTREAM_CLOSED` |
| 7N2F repo cleanup | `REPO_CLEANUP_WORKSTREAM_CLOSED` |
| 7N2G harness settle | `HARNESS_SETTLE_FIX_WORKSTREAM_CLOSED` |
| 7N2H featured usage harness | `FEATURED_USAGE_HARNESS_WORKSTREAM_CLOSED` |
| 7N2I single-word miss copy | `SINGLE_WORD_MISS_COPY_WORKSTREAM_CLOSED` |
| Constraint | Prefer the smallest workstream that can move forward now |
| Post-copy state | Phrase + single-word miss guidance both shipped; prior featured evidence pre-dates single-word copy change |

## 2. Evidence inspected

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2i4n6_single_word_miss_copy_closure_report.md` | Copy fix closed; EN/mixed deferred; lexical blocked; catalog/cleanup/storage residual |
| `docs/reports/phase7n2h4m4_featured_usage_harness_closure_report.md` | Opt-in featured harness available |
| `docs/reports/phase7n2g4l6_harness_settle_fix_closure_report.md` | Settle closed |
| `docs/reports/phase7n2f4k4_repo_cleanup_closure_report.md` | Tracked-bundle cleanup still deferred |
| `docs/reports/phase7n2d4i1_deferred_non_actionable_closure_report.md` | Lexical validation still unavailable |
| `docs/reports/phase7n2b4g13_promotion_closure_report.md` | Catalog schema + storage/import residuals |

## 3. Candidate workstream evaluation table

| workstream_id | value | dependency | risk | recommended_status | reason |
| --- | --- | --- | --- | --- | --- |
| 1 — Catalog schema hardening | Medium — explicit featured/status metadata reduces env/sort ambiguity | Engineering planning then schema/runtime conventions | Medium/high | `defer` | Still larger than a bounded post-copy usage evidence round |
| 2 — Storage/import observation | Low/medium — summarize ~7–8 min featured import/storage notes | Existing featured harness timings | Low | `monitor_only` | Useful residual; not the smallest product-forward next slice after copy closure |
| 3 — English/mixed-language copy | Low/medium — clarify dictionary ≠ sentence translation | Product copy only | Medium if scoped as language expansion | `defer` | N2 found weak signal beyond phrase guidance; may re-enter if round 3 strongly evidences it |
| 4 — Tracked bundle cleanup | Medium hygiene — assess older tracked `web/public/bundle_full_*` retention | Retention policy + careful deletion discipline | Medium/high if deleted wrongly | `defer` | Higher risk than a report-only evidence round |
| 5 — Featured usage round 3 | Medium for planning quality — review remaining featured usability evidence after phrase + single-word copy fixes | Opt-in `test:e2e:usage:featured`; structured-usability boundary | Low if review stays non-lexical / non-demand | **recommend_next** | Smallest forward path: selected N2 issue is closed; remaining deferred findings need a fresh post-copy pass (ideally new featured run so miss meta matches shipped copy) |
| 6 — Lexical validation | High if data existed — Son/`prix`, `fièvre`, `poulet` | External owner validation data | High if invented | `blocked` | Still no actionable validation data; do not reopen |

Exactly one `recommend_next`: **5**.

## 4. Recommended workstream

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2J — Featured usage round 3 (post-copy, non-lexical)

WORKSTREAM_TYPE:
structured_usability_evidence_review

SCOPE_SHAPE:
After phrase guidance and single-word miss copy are shipped, run or reuse
featured-bundle usage evidence and review remaining non-lexical product/usability
issues only — without treating rows as demand or lexical authority, and without
reopening Son/prix, fièvre, or poulet.

EXPLICITLY_OUT_OF_SCOPE:
Lexical validation/additions; catalog schema migration; tracked-bundle deletion;
sentence translation / language-pack expansion unless strongly re-evidenced;
demand ranking

RATIONALE:
7N2I closed the only selected actionable issue from the prior featured review.
The smallest practical next step is a bounded round-3 review of remaining
evidence under the new miss-copy baseline, not a larger engineering track.

BLOCKERS:
none for O1 plan drafting;
fresh featured harness run optional but preferred so miss meta reflects N4 copy
```

## 5. Explicit deferrals / blocked items

| Item | Status | Why |
| --- | --- | --- |
| Catalog schema hardening | `defer` | Larger engineering track |
| Storage/import observation | `monitor_only` | Passive residual summarize later if needed |
| English/mixed-language copy | `defer` | Weak beyond phrase guidance; may re-enter via round 3 |
| Tracked bundle cleanup | `defer` | Higher-risk retention/deletion track |
| Son/`prix`, `fièvre`, `poulet` | `blocked` | No external validation data |

## 6. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Treating round-3 rows as demand or lexical validation | medium | Keep `can_influence_demand: false` / structured-usability boundary |
| Re-selecting already-closed phrase or single-word copy issues | medium | Explicitly mark those as closed baseline |
| Expanding into English onboarding without strong evidence | medium | Require strong recurring non-phrase signal |
| Catalog schema left unaddressed | medium | Remain deferred but listed |

## 7. Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2J — Featured usage round 3 (post-copy, non-lexical)

WORKSTREAM_TYPE:
structured_usability_evidence_review

RATIONALE:
Smallest forward path after single-word miss copy closure: review remaining
featured usability evidence under the new miss-copy baseline.

BLOCKERS:
none for O1 drafting
```

## 8. Next slice

**Phase 7N2J4O1 — Draft Selected Workstream Plan**

Purpose: draft the smallest round-3 review plan (evidence inputs, whether to
re-run featured harness, selection criteria, out-of-scope boundaries).

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

O0 created only this report. No runtime, catalog, bundles, source data,
matrices, tests, packages, or review artifacts were edited.
