# Phase 7N2H4M2 — Implement Featured-Bundle Usage Harness Mode

## Decision

```text
FEATURED_USAGE_HARNESS_MODE_IMPLEMENTED
```

Opt-in featured/full-bundle usage harness mode was added without changing product
runtime, catalog, bundle payloads, source data, matrices, or packages.
Son/`prix`, `fièvre`, and `poulet` were not reopened. Usage evidence remains
structured usability only (not lexical validation / not demand).

## 1. Inputs

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2h4m1_full_bundle_usage_harness_plan.md` | Minimal option: dedicated npm script |
| `web/package.json` | Script entry points |
| `docs/LOCAL_USAGE_AUTOMATION.md` | Local run docs |

## 2. Change summary

| File | Change |
| --- | --- |
| `web/package.json` | Added `test:e2e:usage:featured` |
| `docs/LOCAL_USAGE_AUTOMATION.md` | Documented opt-in featured mode |
| `docs/reports/phase7n2h4m2_featured_usage_harness_mode_report.md` | This report |
| `web/e2e/human_usage/usage_harness.spec.ts` | **Unchanged** — existing `SIRALEX_USAGE_BUNDLE_DIR` + timeout env suffice |

## 3. Script added

```json
"test:e2e:usage:featured": "SIRALEX_USAGE_BUNDLE_DIR=public/bundle_full_20260710_337619ff SIRALEX_USAGE_INSTALL_TIMEOUT_MS=900000 npm run test:e2e:usage"
```

| Setting | Value |
| --- | --- |
| Bundle dir | `public/bundle_full_20260710_337619ff` (featured 7N2B three-file dir) |
| Install timeout | `900000` ms |
| Why not 180000 | First featured attempt was still staging `search_index.jsonl` at ~180s; import completed under the package-class timeout |

## 4. Debug default confirmation

| Command | Bundle | Result |
| --- | --- | --- |
| `npm --prefix web run test:e2e:usage` | `web/public/debug-bundles/test_directional_bundle` (unchanged default) | **1 passed** (~23s) |

## 5. Featured run result

| Command | Bundle | Result |
| --- | --- | --- |
| `npm --prefix web run test:e2e:usage:featured` | `bundle_full_20260710_337619ff` | **1 passed** (~6.8m) |

Generated local evidence under `data/local_evidence/human_usage_automation/` is run
output only and is not treated as lexical validation or demand evidence.

## 6. Validation

| Check | Result |
| --- | --- |
| `git diff --check` | clean |
| `npm --prefix web run test:e2e:usage` | passed |
| `npm --prefix web run test:e2e:usage:featured` | passed |

## 7. Decision

```text
FEATURED_USAGE_HARNESS_MODE_IMPLEMENTED
```

## 8. Next slice

**Phase 7N2H4M3 — Verify Featured-Bundle Usage Harness Mode**

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

M2 touched only `web/package.json`, `docs/LOCAL_USAGE_AUTOMATION.md`, and this
report. No harness rewrite, runtime, catalog, bundle payload, source data,
matrix, or package edits.
