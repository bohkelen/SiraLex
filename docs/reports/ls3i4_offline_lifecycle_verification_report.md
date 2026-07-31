# LS3I4 — Offline and Lifecycle Verification Report

## 1. Decision

```text
LS3_OFFLINE_LIFECYCLE_VERIFICATION_PASSED
```

Core online Progress → Review → refresh → reload → offline Continue → offline
reload passes in Playwright. Lifecycle edge cases are locked by focused
integration tests. No Progress model or surface redesign was required.

---

## 2. Product flow verified

```text
Save vocabulary
  → open Saved Vocabulary
  → see Progress
  → Start Review
  → reflect
  → Back
  → Progress refreshes
  → reload
  → Progress remains
  → go offline
  → reload offline
  → Progress and Continue Review still work
```

No new Progress metrics, scheduling, mastery, history, telemetry, or Progress
persistence stores were added.

---

## 3. Browser environment and fixture

| Item | Value |
|------|-------|
| Runner | Playwright Chromium |
| Config | `web/playwright.config.ts` |
| Base URL | `http://127.0.0.1:4173` (vite preview of production build) |
| Fixture | `web/public/debug-bundles/test_directional_bundle` |
| Bundle id | `bundle_full_20260418_e1c98a70` |
| Lexicon | `alpha_mnk`, `beta_mnk`, `bon_mnk` (+ glosses) |
| Spec | `web/e2e/learning/ls3_progress_return.spec.ts` |

Dictionary installation reuses the LS1/LS2 quick-import helper. Learning Records
and Progress counts are created through the real Save / Review UI (not seeded
final Progress counts).

---

## 4. Offline method

```ts
await context.setOffline(true);
```

Playwright browser-context offline (not `navigator.onLine` spoofing). After
offline:

- service-worker shell loads;
- installed debug dictionary remains active;
- Saved Vocabulary and Progress load;
- Continue Review works;
- reflection persists in IndexedDB;
- offline reload retains updated Progress counts.

---

## 5. Main Progress Playwright flow

`Progress → Review → refresh → reload → offline Continue` exercises:

1. install debug bundle online;
2. save three lexicon entries via Target→Source Save UI;
3. open Saved Vocabulary — Progress Saved=3 / Not reviewed=3 / Still learning=0 /
   Remembered=0; unavailable absent; Start review; cue Review new saved words;
4. semantic assertions: `#saved-vocab-progress-heading`, one `<dl>`, no
   progressbar, no percentage / Mastered / Resume wording;
5. Start Review → Reveal → Still learning → Reveal → Remembered → Back (third
   entry left unreviewed);
6. Progress refreshes: Saved=3, Not reviewed=1, Still learning=1, Remembered=1,
   Continue review;
7. online reload retains identical Progress;
8. `context.setOffline(true)` + reload + reopen;
9. Continue Review offline → one reflection → Back → counts update
   (Not reviewed=0, Still learning=2);
10. offline reload retains updated counts.

---

## 6. Start/Continue lifecycle

| Condition | Label | Evidence |
|-----------|-------|----------|
| New collection (`reviewable > 0`, no reflections) | Start review | Browser main flow + integration |
| After any completed reflection | Continue review | Browser main / French / durability + integration |
| Same Review surface / fresh queue | Yes | Browser + LS3I3/LS3I4 integration |
| No session resume / no search rerun | Yes | Reveal-only reload browser; LS3I3 nav isolation |

---

## 7. Reload and ephemeral-session behavior

Browser test `Reveal-only reload leaves Progress unchanged; fresh Continue starts hidden`:

1. complete one reflection → Continue;
2. open Continue → Reveal without Reflect;
3. reload — Review surface does not resume;
4. Progress counts unchanged;
5. Continue again shows a fresh hidden card.

Reveal-only state does not alter Progress.

---

## 8. Immediate durability

Browser test `immediate Progress durability after one reflection`:

- Reflect Still learning on the first card;
- wait for next card / completion;
- reload immediately;
- Progress shows Still learning=1 and Continue review.

Full Review completion is not required for Progress durability.

---

## 9. Offline Progress behavior

Covered in the main Playwright flow:

- Progress summary renders offline after reload;
- counts match the pre-offline persisted profile;
- no network fetch dependency for Progress derivation.

---

## 10. Removal lifecycle

| Case | Evidence |
|------|----------|
| Successful resolved removal updates counts | Browser: remove one of two rows → Saved decreases |
| Removal to empty hides Progress + Review action | Browser: second remove → Progress gone, empty status |
| Unresolved removal decreases Saved/unavailable/status | Integration |
| Cancel leaves counts unchanged | Integration (`confirmRemove → false`) |

---

## 11. Unavailable orthogonality

Integration fixture:

```text
3 saved
1 Not reviewed + resolved
1 Still learning + unresolved
1 Remembered + unresolved
→ Saved=3, Not reviewed=1, Still learning=1, Remembered=1,
  Unavailable=2, Reviewable=1
```

UI does not imply `3 = 1 + 1 + 1 + 2`. Browser unavailable/reinstall mutation
remains a gap (no clean production seam).

---

## 12. Bundle removal/reinstall/update

| Case | Evidence |
|------|----------|
| Bundle removal keeps Learning Records; unavailable rises; action disables | Integration |
| Compatible reinstall restores reviewability; Continue preserved | Integration |
| Update retained `ir_id` keeps status; removed `ir_id` unavailable | Integration |

---

## 13. Active-bundle isolation

Integration: bundle A remembered/continue profile vs bundle B start-only profile;
switching loads only the active Progress; no cross-bundle aggregation.

---

## 14. Database deletion

Integration: `deleteSiralexDb` clears Learning Records; next collection open has
no Progress / no Review action; no automatic restoration of personal learning
state.

---

## 15. Navigation/stale-host behavior

| Guarantee | Evidence |
|-----------|----------|
| Stale Saved Vocabulary paint cannot replace Review | LS3I4 integration |
| Start/Continue / Back do not run search | LS3I3 navigation tests (regression) |
| Committed reflection remains durable after navigation | Browser + integration |

---

## 16. Duplicate activation

Browser: double-click Start/Continue → one `.review-surface` / one headword;
double-click Still learning while busy → one Progress count change
(Still learning=1). Integration: one host start / one `openDb` queue load;
busy reflection suppresses duplicate writes.

---

## 17. Focus sequence

Browser:

1. Start/Continue keyboard-reachable (`focus()`);
2. Reveal focuses meaning (main flow);
3. reflection focuses next headword;
4. Back focuses Continue after prior reflection;
5. ordinary Saved Vocabulary open does not steal focus;
6. one-use restoration does not repeat after second ordinary reopen.

Unresolved-only heading focus remains covered by LS3I3 integration (browser gap:
no dictionary-mutation seam). Progress summary is not auto-focused.

---

## 18. French smoke

Browser `French Progress smoke Start → Continue`:

- `Aperçu du vocabulaire`, `Enregistrés`, `Pas encore révisés`,
  `Commencer la révision`, French return cue;
- after one reflection → `Continuer la révision`, Still learning=1,
  French still-learning cue.

Does not duplicate the full offline loop in French.

---

## 19. Locale invariance

Integration: EN→FR locale change does not alter numeric Progress values, does
not write Learning Records, and only changes labels via `t(...)`.

---

## 20. Storage/query-log isolation

Integration snapshots around Progress load/render/reflection:

- only successful reflection changes `status` / `last_reviewed` / `review_count`;
- records, search index, registry, query logs, Learning Record identity,
  `created_at`, display cache, and content stamps remain unchanged for
  Progress load/render.

---

## 21. Verification matrix

| Guarantee | Browser | Integration | Status |
| ------------------------------------------ | -----------------: | ----------: | ------ |
| Progress appears in Saved Vocabulary | Yes | Yes | Pass |
| Start label for new collection | Yes | Yes | Pass |
| Continue label after reflection | Yes | Yes | Pass |
| Return cue updates | Yes | Yes | Pass |
| Counts refresh after reflection | Yes | Yes | Pass |
| Immediate durability | Yes | Yes | Pass |
| Reload retains Progress | Yes | Yes | Pass |
| Reveal-only reload leaves counts unchanged | Yes | Yes | Pass |
| Offline Progress works | Yes | Yes | Pass |
| Offline Continue Review works | Yes | Yes | Pass |
| Offline reload retains update | Yes | Yes | Pass |
| Removal updates counts | Yes | Yes | Pass |
| Removal to empty hides summary | Yes | Yes | Pass |
| Unavailable orthogonality | Preferred (gap) | Yes | Pass (integration) |
| Reinstall restores reviewability | Optional (gap) | Yes | Pass (integration) |
| Bundle update preserves status | Optional (gap) | Yes | Pass (integration) |
| Active-bundle isolation | Optional (gap) | Yes | Pass (integration) |
| Database deletion clears Progress | Optional (gap) | Yes | Pass (integration) |
| Duplicate activation suppressed | Yes | Yes | Pass |
| Stale updates dropped | Optional | Yes | Pass (integration) |
| Storage/query-log isolation | Integration | Yes | Pass |
| EN/FR copy | Smoke | Yes | Pass |
| Focus sequence | Yes | Yes | Pass |

---

## 22. Defects found and fixes

None. Verification passed against the existing LS3I1–LS3I3 implementation without
product-code changes.

---

## 23. Remaining browser gaps

1. Deterministic unresolved/reinstall Progress flow in Playwright (no clean
   production dictionary-mutation seam; covered by integration).
2. Active-bundle switch Progress UI in Playwright (costly; integration covers
   profiles).
3. Bundle update retained/removed `ir_id` Progress UI (integration).
4. Database deletion Progress UI (integration).
5. Instrumented store/query-log counts inside Playwright (integration isolation).
6. Unresolved-only Back focus to Saved Vocabulary heading (LS3I3 integration).

---

## 24. Test commands and exact results

### Focused LS3I4 integration

```text
npx vitest run src/learning/ls3i4_progress_lifecycle_verification.test.ts
→ Test Files 1 passed (1)
→ Tests 17 passed (17)
```

### Focused LS3 Playwright

```text
npx playwright test -c playwright.config.ts e2e/learning/ls3_progress_return.spec.ts
→ 6 passed (11.5s)
```

### All learning Playwright

```text
npx playwright test -c playwright.config.ts e2e/learning/
→ 12 passed (18.3s)
```

### LS1 offline Saved Vocabulary Playwright

Included in learning suite: `ls1_offline_saved_vocabulary.spec.ts` → 1 passed.

### LS2 offline Review Playwright

Included in learning suite: `ls2_offline_review.spec.ts` → 5 passed.

### Direct-entry navigation Playwright

```text
npx playwright test -c playwright.config.ts e2e/navigation/source_result_direct_entry.spec.ts
→ 1 passed (3.6s)
```

### Focused LS1/LS2/LS3 Vitest regressions

```text
npx vitest run src/learning/ls3i4_progress_lifecycle_verification.test.ts \
  src/learning/saved_vocabulary_progress.test.ts \
  src/learning/ls3i3_return_action_navigation.test.ts \
  src/render/render_saved_vocabulary.test.ts \
  src/learning/review_queue.test.ts \
  src/learning/review_surface_host.test.ts \
  src/learning/learning_record_reflection.test.ts \
  src/learning/ls1i4_lifecycle_verification.test.ts \
  src/learning/ls2i5_review_lifecycle_verification.test.ts
→ Test Files 9 passed (9)
→ Tests 105 passed (105)
```

### Full Vitest suite (one complete run)

```text
npm run test:run
→ Test Files 47 passed (47)
→ Tests 482 passed (482)
→ Duration 320.77s
```

### Web build

```text
npm run build
→ tsc + vite build + PWA generateSW succeeded
```

### Diff hygiene

```text
git diff --check
→ (clean; no whitespace errors)
```

---

## 25. Repository hygiene

Unrelated featured-anchor work remained uncommitted and was not staged:

- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`
- `web/src/navigation/open_target_lexicon_entry.ts`
- `web/src/navigation/open_target_lexicon_entry.test.ts`
- `web/src/types/records.ts`
- `web/src/search/resolve_target_lexicon.ts`
- `web/src/search/resolve_target_lexicon.test.ts`

LS3I4 staged only:

- `web/e2e/learning/ls3_progress_return.spec.ts`
- `web/src/learning/ls3i4_progress_lifecycle_verification.test.ts`
- `docs/reports/ls3i4_offline_lifecycle_verification_report.md`
