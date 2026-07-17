# Phase 7N2F4K0 — Choose Next Practical Workstream

## Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

Planning only. No runtime, catalog, bundles, source data, matrices, tests,
packages, or review artifacts were changed. Son / `prix`, `fièvre`, and `poulet`
were not reopened. No validation workflows were created. Closed phrase-guidance
scope was not expanded.

## 1. Current baseline

| Field | Value |
| --- | --- |
| Featured / default | `bundle_full_20260710_337619ff` |
| 7N2B closure | `PHASE_7N2B_PROMOTION_CLOSED_STABLE` |
| 7N2D lexical intake | `7N2D_DEFERRED_NO_ACTIONABLE_VALIDATION_DATA` |
| 7N2E phrase guidance | `MINIMAL_PHRASE_GUIDANCE_WORKSTREAM_CLOSED` |
| Constraint | Prefer the smallest workstream that can actually move forward now |
| Working-tree clutter (present) | untracked `build/` (~137M); untracked `web/public/bundle_full_20260518_15605571/` (~24M) |

## 2. Evidence inspected

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2e4j5_phrase_guidance_closure_report.md` | Phrase guidance closed; deferred catalog/cleanup/lexical items |
| `docs/reports/phase7n2e4j1_usage_evidence_review_report.md` | Remaining F2–F6 non-lexical / blocked findings after F1 shipped |
| `docs/reports/phase7n2d4i1_deferred_non_actionable_closure_report.md` | Lexical validation still unavailable |
| `docs/reports/phase7n2b4g13_promotion_closure_report.md` | Residual catalog/env/storage risks on stable featured baseline |

## 3. Candidate workstream evaluation table

| workstream_id | value | dependency | risk | recommended_status | reason |
| --- | --- | --- | --- | --- | --- |
| A — Catalog schema hardening | Medium — explicit featured/status metadata reduces env/sort ambiguity | Engineering planning then schema/runtime conventions | Medium/high | `defer` | Important residual G13 risk, but larger than immediate hygiene that can move now |
| B — Storage/import observation | Low — passive post-promotion watch | Real-use observation | Low | `monitor_only` | Keep watching; does not define an actionable plan slice by itself |
| C — Repo cleanup | Medium hygiene — resolve leftover untracked `build/` + old public bundle | Policy decision (ignore / archive / remove) + possible `.gitignore` / cleanup | Low/medium if wrong paths removed | **recommend_next** | Smallest concrete forward workstream now that phrase guidance is closed; clutter is present and repeatedly observed |
| D — Usage evidence round 2 | Low/medium — remaining F2/F3 after phrase guidance shipped | Report/analysis of already-reviewed evidence | Low | `defer` | Primary actionable F1 already closed; leftover findings are smaller/deferred and not the smallest unblock |
| E — Phrase guidance follow-up | Low — optional example line / copy refinement | Product copy change on closed workstream | Medium if scope expands | `defer` | 7N2E just closed; do not expand phrase guidance without a new explicit need |
| F — Deferred lexical validation | High if data existed — Son/`prix`, `fièvre`, `poulet` | External owner validation data | High if invented | `blocked` | Still no actionable validation data (7N2D); do not reopen or create validation workflows |

Exactly one `recommend_next`: **C**.

## 4. Recommended workstream

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2F — Repo cleanup for untracked build and stale public bundle artifacts

WORKSTREAM_TYPE:
repo_cleanup

SCOPE_SHAPE:
Decide whether leftover untracked artifacts should remain ignored, be archived
outside the working tree, or be removed:
  - build/ (~137M)
  - web/public/bundle_full_20260518_15605571/ (~24M)
Draft an explicit keep/ignore/remove policy before any destructive action.

EXPLICITLY_OUT_OF_SCOPE:
Son / prix / fièvre / poulet validation; phrase-guidance expansion; catalog
schema migration; search/index or runtime feature work; deleting currently
featured or catalog-visible rollback bundles without explicit approval

RATIONALE:
Phrase guidance is closed and lexical validation remains blocked. The smallest
workstream that can move forward now is a bounded cleanup-policy plan for
long-lived untracked build/package artifacts that continue to appear in
git status.

BLOCKERS:
none for K1 plan drafting;
any delete/archive action remains blocked until the K1 policy is approved
```

## 5. Explicit deferrals / blocked items

| Item | Status | Why |
| --- | --- | --- |
| Catalog schema hardening | `defer` | Engineering planning later; not smallest next step |
| Storage/import observation | `monitor_only` | Passive residual risk |
| Usage evidence round 2 (F2/F3/etc.) | `defer` | F1 already shipped; remaining rows are lower priority |
| Phrase guidance follow-up | `defer` | Closed workstream; do not expand |
| Son/`prix`, `fièvre`, `poulet` | `blocked` | No external validation data; do not reopen |

## 6. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Deleting a still-needed local package/build input | medium | K1 drafts policy only; no delete until explicit approval |
| Ignoring paths that should remain reviewable | low/medium | Distinguish ephemeral `build/` outputs vs intentional local evidence |
| Using cleanup to sneak catalog/runtime changes | medium | Keep out-of-scope list explicit |
| Reopening lexical validation under “cleanup” | high | Forbidden; remain `blocked` |

## 7. Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2F — Repo cleanup for untracked build and stale public bundle artifacts

WORKSTREAM_TYPE:
repo_cleanup

RATIONALE:
Smallest forward path after phrase-guidance closure: decide
ignore/archive/remove policy for lingering untracked build and old public
bundle artifacts, without lexical reopen or product-scope expansion.

BLOCKERS:
none for K1 drafting
```

## 8. Next slice definition

**Phase 7N2F4K1 — Draft Selected Workstream Plan**

Purpose: draft the concrete repo-cleanup policy plan (inventory of untracked
paths, keep/ignore/archive/remove options, safety checks, and non-destructive
default) without deleting files or changing runtime/catalog behavior.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

K0 created only this report. No edits to env, catalog, bundles, `web/src/`,
aliases, supplements, matrices, `data/`, `api/`, review artifacts, packages, or
release documents.
