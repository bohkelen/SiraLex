# Phase 7N2L4Q2 — Implement Offline Miss Classification Cleanup

## Decision

```text
OFFLINE_MISS_CLASSIFICATION_CLEANUP_IMPLEMENTED
```

Harness evidence-labeling only. No product runtime, catalog, bundles, source
data, matrices, packages, or search behavior changes. Persona tasks not
rewritten. Son/`prix`, `fièvre`, `poulet`, and `bonjour` not reopened as lexical
work. Offline misses are not demand evidence and not lexical validation.

## 1. Implemented labeling behavior

In `web/e2e/human_usage/evidence_writer.ts` → `deriveIssueClass`:

| Condition | Result |
| --- | --- |
| `setup_ux` + `miss` | `no_issue_observed` (**new**) |
| `setup_ux` + `hit_single` / `hit_multi` | `no_issue_observed` (7N2K preserved) |
| `blocked` / `error` | `setup_ux` |
| `pending_human_review` + `miss` | `pending_human_review` |
| Other expected classes | unchanged |

Also preserved:

- `observed_result.status` remains `miss` for content misses
- `candidate_intervention_category` → `none` when `issue_class === "no_issue_observed"`

## 2. Files changed

| File | Change |
| --- | --- |
| `web/e2e/human_usage/evidence_writer.ts` | Added `miss` + `setup_ux` → `no_issue_observed` |
| `web/src/human_usage_evidence_writer.test.ts` | Extended focused coverage for miss remap + pending_human_review miss |
| `docs/reports/phase7n2l4q2_offline_miss_classification_implementation_report.md` | This report |

## 3. Validation

| Check | Result |
| --- | --- |
| `git diff --check` | clean |
| `npm --prefix web run test:run -- src/human_usage_evidence_writer.test.ts` | **6 passed** |
| `npm --prefix web run test:e2e:usage` | **1 passed** (~23s) |
| `npm --prefix web run test:e2e:usage:featured` | **1 passed** (~8.3m) |

## 4. Featured offline miss result

Primary run: `usage_2026-07-23T21-29-12-718Z`

| Query | `status` | `issue_class` | `candidate_intervention_category` |
| --- | --- | --- | --- |
| `bonjour` (offline_check) | `miss` | `no_issue_observed` | `none` |

All 9 offline hits remain `no_issue_observed` / `none`.

## 5. Decision

```text
OFFLINE_MISS_CLASSIFICATION_CLEANUP_IMPLEMENTED
```

## 6. Next slice

**Phase 7N2L4Q3 — Verify Offline Miss Classification Cleanup**

## 7. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

Q2 touched harness evidence labeling + focused unit test + this report only.
