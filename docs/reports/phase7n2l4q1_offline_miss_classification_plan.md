# Phase 7N2L4Q1 — Draft Offline Miss Classification Plan

## Decision

```text
OFFLINE_MISS_CLASSIFICATION_PLAN_READY
```

Planning only. No code was implemented. No product runtime, catalog, bundles,
source data, matrices, packages, or search behavior were changed. Son/`prix`,
`fièvre`, `poulet`, and `bonjour` were not reopened as lexical work. Offline
misses are not demand evidence and not lexical validation. Later implementation
stays limited to harness evidence labeling.

## 1. Problem

After 7N2K, successful offline **hits** are labeled `no_issue_observed` / `none`.
Offline **misses** still keep persona defaults:

| Field | Offline miss today (P3 featured `bonjour`) |
| --- | --- |
| `task_layer` | `offline_check` |
| `offline_reopen_checked` | `true` |
| `observed_result.status` | `miss` |
| `search_meta_text` | normal no-result copy (e.g. `Try another spelling or form.`) |
| `issue_class` | `setup_ux` |
| `candidate_intervention_category` | `offline_install_reliability` |

So a content miss after a successful offline reopen looks like an install/setup
failure.

## 2. How offline miss rows are derived today

| Step | Behavior |
| --- | --- |
| Personas | Every `offline_check` task sets `expectedIssueClass: "setup_ux"` and `candidateInterventionCategory: "offline_install_reliability"` |
| Harness | `reopenOffline` then `runQuery`; miss when meta matches no-result patterns; `error` on automation failure; `blocked` when search not cleanly miss/hit |
| `deriveIssueClass` | Remaps `setup_ux` + hit → `no_issue_observed`; **returns `expected` unchanged for `miss` + `setup_ux`** |
| Intervention | `none` only when `issue_class === "no_issue_observed"` |

Evidence sample: `usage_2026-07-23T18-38-14-185Z` — 9 offline hits remapped; 1 offline
miss (`bonjour`) still `setup_ux` / `offline_install_reliability`.

## 3. Distinction: setup failure vs normal offline content miss

| Signal | True setup/offline failure | Normal offline content miss |
| --- | --- | --- |
| Reopen | Search never becomes usable | `#searchInput` enabled after reopen |
| Query status | `blocked` / `error` (or no settled miss meta) | `miss` with normal no-result / phrase-miss meta |
| Meaning | Offline install/reopen path broken | Dictionary searchable offline; lemma/phrase not found |
| Desired label | Keep `setup_ux` | **Not** `setup_ux` |

## 4. Classification options (no new taxonomy)

| Option | Map `setup_ux` + normal offline `miss` → | Pros | Cons |
| --- | --- | --- | --- |
| A | `no_issue_observed` | Matches offline_check *purpose* (setup OK); auto `none` intervention; same pattern as hit remap | “no_issue” while status is miss can confuse if read as content OK |
| B | `pending_human_review` | Existing content-miss class | Intervention stays `offline_install_reliability` unless mapping also changes — still misleading |
| C | `missing_entry` | Names content gap | Looks like lexical conclusion; conflicts with lexical_blocked / non-demand rules |
| D | Keep `setup_ux` | No change | Problem remains |

**Recommendation: Option A — `no_issue_observed`.**

Rationale:

- Offline_check evidence is about **setup/offline reliability**, not lemma coverage.
- `observed_result.status` remains `miss` (content outcome still visible).
- Intervention becomes `none` via existing mapping (clears false `offline_install_reliability`).
- No new `IssueClass` value.
- Does **not** assert lexical correctness or demand; disposition stays `pending_owner_review`.

## 5. Planned trigger / non-trigger rules (Q2)

### Trigger → `no_issue_observed`

All of:

1. `expectedIssueClass === "setup_ux"`, and
2. `status === "miss"`, and
3. search completed normally after reopen (harness already recorded a settled miss meta — the definition of `miss` today).

Effect:

- `issue_class` → `no_issue_observed`
- `candidate_intervention_category` → `none`

Optional safety (if needed): also require `offlineReopenChecked === true` or
`task.layer === "offline_check"` (currently all `setup_ux` expects are offline_check).

### Non-triggers — keep `setup_ux` (or existing failure path)

| Case | Keep |
| --- | --- |
| `blocked` | `setup_ux` (already forced) |
| `error` | `setup_ux` (already forced) |
| Install failure | via blocked/error |
| Offline reopen failure / search unavailable after reopen | blocked/error path |
| Missing/invalid offline evidence boundary | blocked/error / notes path — not remapped as normal miss |
| Hit remaps | unchanged from 7N2K |
| Non-`setup_ux` expected classes | unchanged |

### Explicitly out of scope

- Lexical additions or validation for `bonjour` / `fièvre` / `poulet` / Son/`prix`
- Product UI / empty-state copy
- Catalog, bundles, matrices, packages, search/index behavior
- Demand ranking
- New issue-class taxonomy

## 6. Proposed `deriveIssueClass` shape (plan only)

```ts
function deriveIssueClass(status: ObservedResultStatus, expected: IssueClass): IssueClass {
  if (status === "hit_single" && expected === "pending_human_review") return "no_issue_observed";
  if (status === "hit_multi" && expected === "pending_human_review") return "interpretability";
  if (status === "miss" && expected === "pending_human_review") return "pending_human_review";
  if (status === "blocked" || status === "error") return "setup_ux";
  if ((status === "hit_single" || status === "hit_multi") && expected === "setup_ux") {
    return "no_issue_observed";
  }
  // NEW: normal offline content miss after searchable reopen is not a setup failure
  if (status === "miss" && expected === "setup_ux") {
    return "no_issue_observed";
  }
  return expected;
}
```

## 7. Test impact (Q2)

| Check | Expectation |
| --- | --- |
| `web/src/human_usage_evidence_writer.test.ts` | Add: `miss` + `setup_ux` → `no_issue_observed` / `none`; keep blocked/error/hits cases |
| Debug / featured usage | Offline miss rows (e.g. `bonjour`) show `no_issue_observed` / `none` while `status` remains `miss` |
| Product unit suites | Unchanged |

## 8. Risks and residuals

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Readers think `no_issue_observed` means “bonjour is fine lexically” | medium | Docs + review notes: setup OK only; status remains miss; lexical still blocked |
| Remapping a miss that occurred because search was half-broken | low | Only `miss` (settled no-result meta); blocked/error stay setup_ux |
| Offline miss still conflated with demand | low | Keep `can_influence_demand: false` |

Residual after Q2 (expected): content gaps remain visible as `miss` status only;
owners still must not treat them as validation/demand.

## 9. Decision

```text
OFFLINE_MISS_CLASSIFICATION_PLAN_READY
```

```text
RECOMMENDED_CLASSIFICATION:
setup_ux + miss (normal completed search after reopen) → no_issue_observed
(intervention none via existing mapping; no new IssueClass)
```

## 10. Next slice

**Phase 7N2L4Q2 — Implement Offline Miss Classification Cleanup**

Purpose: implement the miss remapping in `deriveIssueClass`, extend focused
unit tests, and confirm featured offline miss labeling without product/lexical
changes.

## 11. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

Q1 created only this plan report. No harness code, runtime, catalog, bundles,
source data, matrices, or packages were modified.
