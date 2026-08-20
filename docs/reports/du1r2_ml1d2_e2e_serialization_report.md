# DU1R2 — Serialize Heavy Featured-Install E2E Harness

## Decision

**DU1R2_ML1D2_E2E_SERIALIZED**

## Base commit

`2771c6c91e8f24e51d3ab46abd5b521f129baf2a` — Triage featured update E2E timeout (DU1R1)

`git log -1` at slice start: `2771c6c Triage featured update E2E timeout`.

## Root cause from DU1R1

The ml1d2 Playwright suite used Playwright’s default worker count (50% of CPUs → **2 workers** on this 4-core host). `fullyParallel: false` only serializes tests **within** a file, so the long DU1 featured-update test could run concurrently with the ML1E featured-install path.

Under that contention:

- update active metadata had already switched to NEW_HASH
- post-commit IndexedDB cleanup of ~112k old index rows was still running
- the success dialog waits for cleanup to finish
- the DU1 test then hit the 40-minute `test.setTimeout` waiting for `.dictionary-update-dialog[data-phase=success]`

DU1R1 classified this as a **test-harness scheduling defect**, not SQ1 runtime, not DU1 product/runtime, and not selector drift.

## Config change

`web/playwright.ml1d2.config.ts` now matches the heavy-install pattern already used by `playwright.pvr1.config.ts` and `playwright.pv1a.config.ts`:

| Field | Before | After |
|-------|--------|-------|
| `workers` | unset (Playwright default: 2 on this host) | `1` |
| `fullyParallel` | `false` (unchanged) | `false` |
| `timeout` | `2_400_000` (unchanged) | `2_400_000` |

Comment added next to `workers: 1`:

```ts
// Heavy featured install/update flows; one worker avoids concurrent IDB contention.
```

## Why runtime unchanged

This slice changes only Playwright process scheduling. No production modules, search path, dictionary installer, IndexedDB schema, cleanup ordering, success-dialog gating, or test assertions were modified. Timeouts were not raised.

## Validation results

| Command | Result |
|---------|--------|
| `npm --prefix web run test:e2e:ml1d2-picker` | **18 passed (1.2h)** — 1 worker. Long DU1 **29.7m**, DU1 failure-path **8.6m**, ML1E **30.4m** (sequential, after DU1). Previously-failing success-dialog wait **passed**. |
| `npm --prefix web run test:e2e:du1` | **2 passed (30.6m)** — 1 worker. Long test **23.6m**, sibling **6.8m**. |
| `npm --prefix web run test:run` | **107 files / 1050 tests passed** (334.86s) |
| `npm --prefix web run build` | **PASS** |
| `git diff --check` | **PASS** |

Serialization kept the long DU1 test inside the existing 40-minute timeout (~10 min headroom in the combined suite; ~16 min isolated). No timeout increase was required.

## Files changed

| Path | Change |
|------|--------|
| `web/playwright.ml1d2.config.ts` | Set `workers: 1` plus short contention comment |
| `docs/reports/du1r2_ml1d2_e2e_serialization_report.md` | Added (this report) |

## Working tree

```text
 M web/playwright.ml1d2.config.ts
?? docs/reports/du1r2_ml1d2_e2e_serialization_report.md
?? web/scripts/
```

`web/scripts/` is pre-existing untracked (screenshot helper). Unrelated to this slice.

## Commit

NOT CREATED
