# LP1I5 — Offline and Lifecycle Verification Report

## 1. Decision

```text
LP1_OFFLINE_LIFECYCLE_VERIFICATION_PASSED
```

Browser evidence includes a real Playwright export → mutate → Replace restore
round trip and an offline export/restore/reload path. Vitest alone was not used
to pass.

---

## 2. Browser fixture and environment

- Playwright Chromium via `web/playwright.config.ts`
- Preview server: `vite preview` on `127.0.0.1:4173`
- Dictionary fixture: `web/public/debug-bundles/test_directional_bundle`
  (`bundle_full_20260418_e1c98a70`) — same as LS1–LS3 learning e2e
- Spec: `web/e2e/learning/lp1_learning_backup_restore.spec.ts` (6 product tests)
- Integration: `web/src/learning/lp1i5_backup_restore_lifecycle_verification.test.ts`

---

## 3. Primary round trip

Browser path:

1. Install debug dictionary online
2. Save `alpha_mnk`, `beta_mnk`, `bon_mnk`
3. Complete two reflections (Still learning / Remembered)
4. Open Manage Learning Data; export via UI download
5. Clear Learning Records in IndexedDB (dictionary kept)
6. Confirm empty export state
7. Select downloaded backup; Replace all; cancel confirmation once
8. Confirm Replace all; verify restore counts `0 → 3`
9. Reopen Saved Vocabulary with restored statuses; Start Review usable

Restored state is never seeded directly.

---

## 4. Download verification

- `page.waitForEvent("download")` captures the UI download
- Filename matches `siralex-learning-backup-YYYY-MM-DDTHH-MM-SSZ.json`
- Filename contains no vocabulary tokens
- Package parses as `siralex_learning_backup_v1` with expected identities
- Success copy does not claim the file is permanently safe

---

## 5. Export empty/failure behavior

- Empty Learning store disables Export and shows “No learning data to back up”
- Invalid local rows / no partial download covered in LP1I2/I5 integration
- Error copy remains vocabulary-free in package/export tests

---

## 6. File validation

Browser:

- Invalid JSON → invalid state, no preview, no mutation
- Unsupported schema → generic unsupported-version wording (no “newer” claim)
- Invalid UTF-8 → user-facing UTF-8 failure, no preview

Oversized-file exact byte enforcement retained in file/package integration tests
(no 25 MiB browser allocation).

---

## 7. Add-missing flow

Browser: shared identity retained locally, missing identity added, local-only
row kept; preview add/skip counts verified; Saved Vocabulary shows all three.

---

## 8. Replace-all flow

Browser primary path: cancel confirmation leaves store empty; commit replaces
exact backup set; active bundle unchanged.

---

## 9. Missing dictionary and hash mismatch

| Case | Browser | Integration |
| --- | --- | --- |
| Missing dictionary soft-orphan restore | Gap (no cheap production bundle-omit seam in this fixture) | Yes — restore succeeds; records retained; active bundle unchanged |
| Hash mismatch compatibility | Optional / not Playwright-driven here | Yes — preview reports mismatch; restore available; stamps preserved |

---

## 10. Offline export

Playwright: online install + SW control → `context.setOffline(true)` → reload →
Manage Learning Data → export download → package record count verified.

---

## 11. Offline restore

While still offline: clear Learning Records → select prior download → Replace
restore → Saved Vocabulary → Review reflection → offline reload retains state.

---

## 12. Database deletion lifecycle

Browser: reminder visible when Learning count > 0; reminder opens Manage
Learning Data without auto-export; Delete database uses existing semantics;
dictionary reinstall is separate; Learning restored from external backup.

---

## 13. Post-restore invalidation

`onAfterRestoreSuccess` invalidates Saved Vocabulary / Review / entry hosts.
Browser reopens Saved Vocabulary from live restored rows. Integration covers
surface disposal after commit without cancelling the transaction.

---

## 14. Stale file/preview/surface handling

| Concern | Evidence |
| --- | --- |
| Stale file race | Integration (surface generation / file token) |
| Stale preview after bundle remove | Product fix: `invalidatePreviewForBundleChange` after remove + `refreshDbStatus`; integration + remove path |
| Committed restore after surface disposal | Integration |

---

## 15. Duplicate activation

Browser: export busy/trial duplicate click; Replace confirmation is single
commit. Integration coalesces duplicate export/add-missing activations.
Atomicity remains LP1I3 transactions.

---

## 16. File reselection

Browser validation test reselects invalid then other fixtures. Integration
covers reset/reselect semantics after cancel/success.

---

## 17. Privacy

Browser asserts contains/store/trust wording and absence of encryption, cloud,
and account language before export/restore.

---

## 18. Localization

English carries full lifecycle coverage. French smoke checks Manage Learning
Data heading, export/restore labels, and privacy wording.

---

## 19. Accessibility

Browser: persistent file-input label, keyboard Export (Enter), preview focus,
native policy radios, Replace dialog heading, Cancel returns focus to Replace
policy.

---

## 20. Storage/query-log isolation

Integration snapshots around export/validate/preview/Add missing/Replace all:
only `learning_records` mutate on restore commits; dictionary, search index,
bundle registry, active bundle, query logs, and settings unchanged. Query-log
baseline unchanged across backup actions.

---

## 21. Exact field preservation

Integration asserts exact equality after restore for never-reviewed, Still
learning, Remembered, unresolved, non-ASCII display cache, multi-bundle, and
multi-hash rows (no timestamp/provenance normalization).

---

## 22. Corrupt-local recovery

Integration: invalid local row → Add missing disabled → Replace all recovers
valid backup set.

---

## 23. Transaction failure

Integration forced Add missing / Replace all failures leave original store
exact; UI reports no Learning data changed; no stale success.

---

## 24. Verification matrix

| Guarantee | Browser | Integration | Status |
| --- | ---: | ---: | --- |
| Export available when records exist | Yes | Yes | Pass |
| Export disabled when empty | Yes | Yes | Pass |
| Download contains all Learning Records | Yes | Yes | Pass |
| Export excludes dictionary/query logs/settings | Yes | Yes | Pass |
| Strict UTF-8 rejection | Yes | Yes | Pass |
| Unsupported schema rejection | Yes | Yes | Pass |
| Preview before mutation | Yes | Yes | Pass |
| Add missing preserves conflicts | Yes | Yes | Pass |
| Replace all exact restore | Yes | Yes | Pass |
| Replace confirmation required | Yes | Yes | Pass |
| Missing dictionary does not block | Preferred gap | Yes | Pass (integration) |
| Hash mismatch does not block | Optional | Yes | Pass (integration) |
| Unresolved records preserved | Preferred gap | Yes | Pass (integration) |
| Offline export | Yes | Yes | Pass |
| Offline restore | Yes | Yes | Pass |
| Offline reload retains state | Yes | Yes | Pass |
| Database deletion reminder | Yes | Yes | Pass |
| Deletion followed by restore | Yes | Yes | Pass |
| Active bundle unchanged | Yes | Yes | Pass |
| Stale file race dropped | Preferred→integration | Yes | Pass |
| Stale preview invalidated | Yes (remove path fix) | Yes | Pass |
| Committed stale restore remains durable | Optional→integration | Yes | Pass |
| Duplicate activation suppressed | Yes | Yes | Pass |
| Storage/query-log isolation | Integration (+ browser no side UI) | Yes | Pass |
| Corrupt local Replace recovery | Optional→integration | Yes | Pass |
| EN/FR copy | Smoke | Yes | Pass |
| Accessibility focus flow | Yes | Yes | Pass |

---

## 25. Defects found and fixes

1. **Replace confirmation `showModal` before connect**  
   `render_learning_backup.ts` called `showModal()` before `host.appendChild`,
   throwing and leaving `#learningBackupHost` empty.  
   Fix: open modal after attach; regression in `render_learning_backup.test.ts`.

2. **TDZ in `createAndMountLearningBackupSurface`**  
   Sync `onModel` during construction closed over `const surface = create…`,
   causing `Cannot access before initialization` and unstable mount.  
   Fix: assign through a `let` after construction (`main.ts`).

3. **Stale preview after bundle remove** (LP1I4 lifecycle gap)  
   Fix: `invalidatePreviewForBundleChange()` + `refreshDbStatus()` after remove.

---

## 26. Remaining browser gaps

- Missing-dictionary install/omit seam not exercised in Playwright (integration covers soft-orphan restore).
- Hash-mismatch installed-bundle mutation not driven through production UI.
- Stale file race preferred browser path covered by surface integration instead.
- Oversized-file boundary not allocated as a real 25 MiB browser download.

---

## 27. Test commands and exact results

Focused LP1I1–I5 Vitest (one run):

```text
npx vitest run src/learning/lp1i5_backup_restore_lifecycle_verification.test.ts \
  src/learning/learning_backup_package.test.ts \
  src/learning/learning_backup_export.test.ts \
  src/learning/learning_backup_restore.test.ts \
  src/learning/learning_backup_file.test.ts \
  src/learning/learning_backup_surface.test.ts \
  src/render/render_learning_backup.test.ts
→ Test Files  7 passed (7)
→ Tests  92 passed (92)
```

Focused LP1I5 integration only:

```text
npx vitest run src/learning/lp1i5_backup_restore_lifecycle_verification.test.ts
→ 14 passed
```

Focused LP1 Playwright (one run):

```text
npx playwright test -c playwright.config.ts e2e/learning/lp1_learning_backup_restore.spec.ts
→ 6 passed (43.4s)
```

All Learning Playwright (one run):

```text
npx playwright test -c playwright.config.ts e2e/learning/
→ 18 passed (45.0s)
```

LS1–LS3 offline + direct-entry navigation (one run):

```text
npx playwright test -c playwright.config.ts \
  e2e/learning/ls1_offline_saved_vocabulary.spec.ts \
  e2e/learning/ls2_offline_review.spec.ts \
  e2e/learning/ls3_progress_return.spec.ts \
  e2e/navigation/source_result_direct_entry.spec.ts
→ 13 passed (14.8s)
```

Focused LS1–LS3 Vitest regressions (one run):

```text
npx vitest run src/learning/ls1i4_lifecycle_verification.test.ts \
  src/learning/ls2i5_review_lifecycle_verification.test.ts \
  src/learning/ls3i4_progress_lifecycle_verification.test.ts
→ Test Files  3 passed (3)
→ Tests  40 passed (40)
```

Full suite (one exact command):

```text
npm run test:run
→ Test Files  54 passed (54)
→ Tests  574 passed (574)
→ Duration  372.70s
```

Build:

```text
npm run build
→ ✓ built (tsc + vite + PWA generateSW)
```

Hygiene:

```text
git diff --check → clean
```

---

## 28. Repository hygiene

Unrelated featured-anchor work left unstaged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

LP1I5 stages only verification files and narrowly required fixes listed above.
