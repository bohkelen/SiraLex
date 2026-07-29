# LS1I4 — Offline, Update, and Soft-Orphan Verification Report

## Decision

```text
LS1_OFFLINE_ORPHAN_VERIFICATION_PASSED
```

Executable evidence covers the locked LS1 collection loop across IndexedDB
lifecycle, isolation, navigation/stale-async guards, failure paths, and one
minimal Playwright offline browser path. No product expansion.

---

## 1. Verification matrix

| # | Locked guarantee | Evidence layer | Result |
| --- | --- | --- | --- |
| 1 | Save works offline after dictionary installation | Playwright offline reopen + Save state | Pass |
| 2 | Learning Records survive browser/app reload | Scenario A + Playwright reload offline | Pass |
| 3 | Saved Vocabulary scoped to active logical bundle | Scenario F + session tests | Pass |
| 4 | Same-`bundle_id` update re-resolves by `ir_id` | Scenario B | Pass |
| 5 | Missing `ir_id` → retained soft orphan | Scenario C (+ session soft-orphan) | Pass |
| 6 | Bundle removal does not cascade-delete Learning Records | Scenario D (`deleteBundleData`) | Pass |
| 7 | Reinstall same logical bundle can resolve again | Scenario E | Pass |
| 8 | Remove affects only Learning storage | Isolation + remove failure retention | Pass |
| 9 | Query-log settings/writes do not alter Learning Records | Isolation (appendQueryLog) | Pass |
| 10 | Dictionary/search/ranking/display independent | Isolation snapshots | Pass |
| 11 | Saved Vocabulary nav without rerunning search | Navigation guards + Playwright | Pass |
| 12 | Late async cannot overwrite newer view | Navigation + session stale guards | Pass |

---

## 2. Tests added by layer

| Layer | File | Coverage |
| --- | --- | --- |
| IndexedDB lifecycle / isolation / integrity / perf sanity | `web/src/learning/ls1i4_lifecycle_verification.test.ts` | Scenarios A–F, isolation, integrity, failure lookup, list-read sanity |
| Navigation / stale-async | `web/src/learning/saved_vocabulary_navigation.test.ts` | Expanded guards (no `runSearch`, back paths, stale load/remove, bundle switch, remove→not_saved contract) |
| Prior session/render/persistence | Existing LS1I1–I3 suites | Failure paths, soft orphans, remove retention, malformed stamps |
| Playwright | `web/e2e/learning/ls1_offline_saved_vocabulary.spec.ts` | One real-browser offline Save → list → open → remove → reload |

No new general-purpose usage harness.

---

## 3. Offline browser flow

Fixture: `public/debug-bundles/test_directional_bundle` via three-file quick import.

Observed path:

1. Install / activate debug directional bundle
2. Toggle target→source; search `alpha_mnk`
3. Open lexicon entry; Save; confirm Saved
4. Open Saved Vocabulary; one row
5. `context.setOffline(true)`; reload
6. Reopen Saved Vocabulary; row still present
7. Open resolved row; live headword + Saved
8. Back → Saved Vocabulary; Remove (confirm accepted)
9. Empty state; reload offline again; row does not return

Result: **1 passed** (~1.3s).

---

## 4. Reload persistence evidence

- **Scenario A:** close/reopen DB → record identical; resolves against active bundle.
- **Playwright:** reload while offline → Saved Vocabulary still lists the record; after Remove + offline reload → empty persists.

---

## 5. Same-bundle update with matching `ir_id`

**Scenario B:** Save under scope/hash 1; activate scope/hash 2 with same `ir_id` and changed lexical display.

Confirmed:

- resolution succeeds with live updated dictionary content
- Learning Record identity unchanged
- stamps and display cache remain from first Save
- exactly one Learning Record

---

## 6. Same-bundle update with missing `ir_id`

**Scenario C:** update active metadata to scope/hash 2 without placing the saved `ir_id`.

Confirmed:

- record remains stored
- resolution `entry_missing`
- Saved Vocabulary row unresolved with cached display
- Remove succeeds

Browser soft-orphan scenario: **not added**. No clean production test seam without debug-only controls. Soft orphans covered at integration/session level (this scenario + LS1I3 session tests).

---

## 7. Bundle removal and reinstall

**Scenario D:** real `deleteBundleData`:

- dictionary `records` / `search_index` cleared
- active selection cleared
- Learning Record retained
- Saved Vocabulary surface `unavailable` without active bundle
- direct resolve → `no_active_bundle`

**Scenario E:** reinstall same logical `bundle_id` with matching `ir_id`:

- retained record resolves to live content
- re-save is idempotent (no duplicate; cache not refreshed)

---

## 8. Active-bundle scoping

**Scenario F:** records for bundles A and B; activate A → list only A; activate B → list only B; both remain persisted.

---

## 9. Storage isolation

Learning ops (Save, idempotent re-save, `isLearningRecordSaved`, list load, live resolve) do not change counts for:

- `records`
- `search_index`
- `bundles_registry`
- `query_logs`

`appendQueryLog` does not change Learning Record count or contents.

Full `deleteSiralexDb` wipes Learning Records (integrity test). Cross-bundle resolve returns `bundle_mismatch`.

---

## 10. Navigation and stale-async evidence

Guards assert:

- open Saved Vocabulary does not call `runSearch`
- Back restores prior results without `runSearch`
- entry opened from Saved Vocabulary returns to Saved Vocabulary
- stale list apply dropped when generation/host changes (including entry view)
- stale remove completion dropped after leaving Saved Vocabulary
- active-bundle switch requires a new open/generation
- Remove then next entry render uses `not_saved`
- unresolved rows have no Open action (contract + render suite)

Playwright exercises the integrated Save → list → open → back → remove path.

---

## 11. Failure-path behavior

| Failure | Evidence | Outcome |
| --- | --- | --- |
| Learning DB read failure on entry saved-state | LS1I4 failure + LS1I2 session | `error_not_saved`; no write |
| List load failure / no active bundle | LS1I3 session + Scenario D | `error` / `unavailable`; no persistence mutation |
| One row resolution failure | LS1I3 session | unresolved soft orphan row |
| Remove failure | LS1I3 session | row retained + row error |
| Stale async completion | navigation + sessions | dropped |
| No active bundle | sessions + Scenario D | unavailable / unresolved |

Lexical search/content paths remain independent; no automatic database reset.

---

## 12. Defects found and corrected

None. Verification passed against the completed LS1 collection without production code changes in this slice.

Environment note: Playwright Chromium had to be installed locally (`npx playwright install chromium`) before the browser scenario could run; this is tooling, not an LS1 product defect.

---

## 13. Remaining gaps

- Soft-orphan UX is not exercised in Playwright (integration/session only; no clean test seam).
- Bundle update/orphan matrices are IndexedDB/session-level, not production UI clicks (by design).
- Navigation guards are generation/host contracts mirroring `main.ts`, not a full DOM router harness.
- No pagination/virtualization benchmarks (explicit non-goal); only list-read / no-write sanity.

None of these gaps leave a locked LS1 guarantee covered only by documentation.

---

## 14. Validation results

| Check | Result |
| --- | --- |
| Focused LS1 Vitest (7 files / 72 tests) | **Pass** |
| `ls1i4_lifecycle_verification.test.ts` | **10 passed** |
| Learning Record persistence | **28 passed** |
| LS1I2 entry-learning (+ render) | **Pass** |
| LS1I3 Saved Vocabulary (+ render/nav) | **Pass** |
| Playwright offline scenario | **1 passed** |
| Full `npm run test:run` | **33 files / 335 tests passed** |
| `npm run build` | **Pass** |
| `git diff --check` | Clean (post-commit verification) |

---

## Performance sanity

List load uses one bundle-indexed Learning Record read (`listLearningRecordsByBundle`). Resolution performs no Learning writes. List resolution does not rerun search. No unbounded retry loops introduced. MVP-sized collections (smoke: 5 rows) resolve without architectural blockers.

---

## Explicit non-goals confirmed

No Review, Reflect, flashcards, progress, favorites, multiple lists, all-bundle browsing, export/import, morphology, audio, cloud sync, teacher mode, new usage harness architecture, analytics coupling, or catalog/source/package feature expansion.

---

## Next slice

```text
LS1I5 — LS1 Closure
```

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS1_OFFLINE_ORPHAN_VERIFICATION_PASSED` |
| Primary evidence | Lifecycle Vitest + one Playwright offline flow |
| Production changes | None |
