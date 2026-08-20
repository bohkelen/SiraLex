# DU1R1 — Featured Update E2E Failure Triage

## Decision

**DU1R1_FEATURED_UPDATE_E2E_FAILURE_TRIAGED**

## Base commit

`6cbb3ebded1914d40fe1883def337d48b970f0e5` — Promote exact French source term hits (SQ1D1)

## Failing command

```bash
npm --prefix web run test:e2e:ml1d2-picker
```

(`test:e2e:du1` runs the same DU1 spec via `playwright.ml1d2.config.ts`.)

## Failing test name

**File:** `web/e2e/du1_dictionary_update_experience.spec.ts`  
**Test:** `DU1 dictionary update experience › Search notice → confirm → update → overlays retained → old payload gone`

## Observed failure (SQ1E closure run)

```text
Test timeout of 2400000ms exceeded.
expect(locator('[data-testid="dictionary-update-dialog"][data-phase="success"]')).toBeVisible()
```

- Suite result: **17 passed, 1 failed** (~49 min total wall time).
- Sibling in same file passed: `failed update leaves OLD dictionary usable` (8.4m).
- ML1E featured-update continuity in the same suite **passed** (~39.2m) — ran **in parallel** with the failing DU1 test (Playwright default **2 workers**; `fullyParallel: false` only serializes tests **within** a file).
- First ml1d2 invocation hit port contention (`127.0.0.1:4175 already used`); after freeing the port, the suite ran to completion with the DU1 timeout above.
- Prior SQ1E artifacts under `web/test-results/ml1d-picker/` were not retained in the workspace at triage time; no trace/video (trace is `off` in config).

### Timing budget

| Limit | Value |
|-------|-------|
| `test.setTimeout` | 2_400_000 ms (40 min) |
| `installTimeoutMs` (per-step) | 1_200_000 ms (20 min) |
| DU1 acceptance (isolated) | 32.8 min (`du1_dictionary_update_experience_report.md`) |
| Headroom at acceptance | ~7.2 min before 40 min wall |

Under parallel load with ML1E (~39 min featured install on another worker), the long DU1 test exceeded the 40 min **test** timeout before the success dialog appeared.

## Artifacts inspected

| Artifact | Result |
|----------|--------|
| SQ1E failure log (conversation / sq1e report) | Timeout at success-dialog wait |
| Playwright trace | Not captured (`trace: "off"`) |
| Screenshot | Referenced in SQ1E run; not present at triage |
| Video | Not configured |
| Browser console | Not captured in retained artifacts |
| Network/install logs | Not captured; install is local bundle fetch |
| Selector `data-phase="success"` | **Unchanged** — `render_dictionary_update.ts:79` |
| DU1 cleanup / IDB scope | OLD scope ~19k records + ~112k index rows; NEW ~19k + ~147k |
| SQ1 diff `03c3099..6cbb3eb` | Search ranking only; no dictionary/update/schema/IDB changes |

## Runtime flow (why poll can pass before success UI)

1. Consumer update: `runConfirmedDictionaryUpdate` → `installCatalogEntry` (`main.ts` ~882–914).
2. On commit, `setActiveBundleMeta` switches active hash **before** old-scope cleanup (`bundle_install.ts` ~423–442).
3. Test poll (lines 107–112) asserts `expected_content_sha256 === NEW_HASH` — passes at **commit**.
4. Success dialog (`markUpdateSuccess` + `data-phase="success"`) mounts only after **full** `installCatalogEntry` returns, including `deleteBundleScopeData` on the previous scope (~131k IDB rows for OLD).
5. Dialog can remain on **`progress`** (cleanup phase) while poll already shows NEW_HASH — comment at spec line 114 acknowledges this.

Conclusion: failure mode is **stalled/slow post-commit cleanup under contention**, not a missing update or selector rename. Not proven that cleanup never completed (test died on wall clock).

## Root cause classification

**Primary: D — Test harness sequencing issue**  
**Secondary: E — Artifact/install performance under parallel E2E load**  
**Tertiary: A — Timeout / flake** (40 min wall vs ~33 min isolated acceptance + unbounded cleanup tail)

| Class | Verdict |
|-------|---------|
| A Flake / timeout only | Partial — real resource contention, not random UI flake |
| B Selector drift | **No** — `data-testid` + `data-phase` intact |
| C DU1 behavioral regression | **No evidence** — SQ1D1 does not touch update path |
| D Test harness sequencing | **Yes** — 2 workers run DU1 + ML1E heavy installs concurrently |
| E Artifact/install performance | **Yes** — large featured bundles + IDB cursor deletes |
| F Unknown | Ruled out given code path + parallel timing |

## SQ1 runtime affected

**NO** — SQ1B/SQ1C/SQ1D1 changes are search post-processing only (`partitionFrExactSourceTermHits` after `resolveRecords`). No changes to dictionary install, catalog, or update UI.

## DU1 runtime affected

**NO** — Update semantics unchanged since DU1 acceptance. Isolated re-run **passed** (long test 27.9m, suite 34.8m). Failure in the combined ml1d2 suite is **harness timing under parallel load**, not a consumer regression.

## Recommended action

1. **DU1R2 (harness):** Set `workers: 1` in `playwright.ml1d2.config.ts` (matches `playwright.pvr1.config.ts` / `playwright.pv1a.config.ts` pattern for heavy installs). Smallest fix; does not weaken assertions.
2. **Optional:** Increase long DU1 `test.setTimeout` to 3_600_000 ms if CI hosts remain slow after serializing workers.
3. **Do not** change runtime cleanup or success-dialog gating without product decision — current behavior (success after cleanup) is intentional.
4. **Do not** modify SQ1 search logic for this failure.

## Fix applied (this slice)

**NO** — Triage only per scope.

## Re-run validation

| Command | Result |
|---------|--------|
| `npm --prefix web run test:e2e:du1` | **2 passed (34.8m)** — long test **27.9m**, sibling failure-path **6.8m**, 1 worker |
| `npm --prefix web run test:e2e:ml1d2-picker` | **18 passed (40.3m)** — long DU1 **32.1m** parallel with ML1E **30.5m**, 2 workers |

Isolated DU1 confirms success dialog and post-cleanup assertions succeed when not contending with ML1E on a second worker.

DU1R1 re-run of the full ml1d2 suite **passed**, but wall time (**40.3m**) and parallel DU1 duration (**32.1m**) sit at the edge of the **40 min** `test.setTimeout`. SQ1E failure is **reproducible under contention variance** (cleanup tail + dual featured installs), not a deterministic pass/fail — consistent with classification **A + D + E**.

## Files changed

| Path | Change |
|------|--------|
| `docs/reports/du1r1_featured_update_e2e_failure_triage.md` | Added (this report) |

No runtime, test, schema, or artifact changes.

## Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run` | Not run (no code changes) |
| `npm --prefix web run build` | Not run (no code changes) |

## git diff --check

PASS (report-only addition)

## Commit

NOT CREATED
