# LS2I5 — Offline and Lifecycle Verification Report

## 1. Decision

```text
LS2_OFFLINE_LIFECYCLE_VERIFICATION_PASSED
```

Core Saved Vocabulary → Review → Reflect → offline reload persistence passes in
Playwright. Lifecycle edge cases are locked by focused integration tests.

---

## 2. Product flow verified

```text
Save vocabulary
  → open Saved Vocabulary
  → Start Review
  → Reveal
  → Reflect
  → complete
  → return to collection
  → reload offline
  → persisted review state remains
```

No new learning capabilities were added. Scope stayed verification plus one
narrow duplicate-Start-Review application guard.

---

## 3. Browser environment and fixture

| Item | Value |
|------|-------|
| Runner | Playwright Chromium |
| Config | `web/playwright.config.ts` |
| Base URL | `http://127.0.0.1:4173` (vite preview of production build) |
| Fixture | `web/public/debug-bundles/test_directional_bundle` |
| Bundle id | `bundle_full_20260418_e1c98a70` |
| Lexicon | `diag_lex_alpha` / `alpha_mnk` / `alpha_fr`; `diag_lex_beta` / `beta_mnk` / `beta_fr` |
| Spec | `web/e2e/learning/ls2_offline_review.spec.ts` |

Dictionary installation reuses the LS1 quick-import helper pattern. Learning
Records are created through the real Save UI (not IndexedDB seeding of review
state).

---

## 4. Offline method

```ts
await context.setOffline(true);
```

Playwright browser-context offline (not `navigator.onLine` spoofing). After
offline:

- shell loads from the service worker / precache;
- installed debug dictionary remains searchable;
- Saved Vocabulary and Review load;
- reflection persists in IndexedDB;
- offline reload retains updated `review_count` totals.

---

## 5. Main Playwright flow

`Saved Vocabulary → Review → offline reload persists reflections` exercises:

1. install debug bundle online;
2. save `alpha_mnk` and `beta_mnk` via Target→Source entry Save;
3. open Saved Vocabulary — both `not_reviewed`; Start Review present; no `#startReview`;
4. Start Review; meaning hidden before Reveal (gloss / revealed region absent);
5. Reveal → Still learning → next card hidden → Reveal → Remembered;
6. completion counts Reviewed 2 / Still learning 1 / Remembered 1;
7. Back restores focus to `#saved-vocab-start-review`; statuses + last-reviewed text;
8. online reload retains statuses;
9. `context.setOffline(true)` + reload + reopen collection;
10. offline Start Review → Reveal → Still learning → Back;
11. IndexedDB `review_count` total ≥ 3; offline reload preserves that total.

---

## 6. Reload and ephemeral-session behavior

Browser test `Reveal without Reflect is ephemeral across reload`:

- Start Review → Reveal → do not reflect → reload;
- Review surface does not resume;
- row remains `not_reviewed` / `review_count === 0`;
- Start Review again builds a fresh hidden-meaning queue.

Completed reflections before reload remain durable (main + immediate-persistence
tests).

---

## 7. Immediate persistence

Browser test `immediate persistence after one reflection survives reload`:

- Reflect Still learning on the first card;
- wait for next card / completion (proves commit before reload);
- reload immediately;
- Saved Vocabulary shows one `still_learning` row with `review_count === 1`.

Full session completion is not required for durability.

---

## 8. Same-status and reversal

| Case | Evidence |
|------|----------|
| Still learning → Still learning | Integration: count 1 → 2; status unchanged; `last_reviewed` updates |
| Remembered → Still learning | Integration: status flips; count increments; no failure language in renderer copy |

Browser optional for both; not duplicated in Playwright.

---

## 9. Queue ordering

Integration test seeds six records and asserts exact order:

```text
never-reviewed older
never-reviewed newer
still-learning oldest reviewed
still-learning newest reviewed
remembered oldest reviewed
remembered newest reviewed
```

Order comes from `buildReviewQueue`, not IndexedDB enumeration.

---

## 10. Unresolved lifecycle

Integration coverage:

- soft-orphan row remains visible / unavailable / no Open;
- Start Review disabled when only unresolved rows remain;
- queue excludes unresolved;
- restoring dictionary content re-resolves;
- prior reflection fields remain on the Learning Record.

**Browser limitation:** no clean production seam to remove/replace live dictionary
content mid-session without debug-only controls (same constraint as LS1 soft-orphan
browser omission). Integration lifecycle coverage is the authoritative evidence.

---

## 11. Bundle removal/reinstall

Integration: `deleteBundleData` removes dictionary stores; Learning Records remain;
Saved Vocabulary shows unresolved; reinstall/reactivate resolves; reflection fields
unchanged; no cascade deletion of Learning Records.

---

## 12. Bundle update

Integration covers same-logical-bundle content stamp change:

- retained `ir_id` keeps identity `(bundle_id, ir_id)` and reflection fields;
- live queue uses current resolution;
- removed `ir_id` becomes unresolved and leaves Review eligibility;
- no duplicate Learning Record;
- display cache is not auto-refreshed by Review.

---

## 13. Active-bundle isolation

Integration: bundle A reviewed + bundle B saved; surfaces show only the active
bundle; switch A↔B invalidates stale hosts; A reflection state intact on return.
No cross-bundle fallback / all-bundle Review.

---

## 14. Database deletion

Integration: `deleteSiralexDb` removes dictionary data, Learning Records, and
review history. Review cannot start without active bundle / records. No automatic
restoration of personal learning state.

---

## 15. Duplicate activation

| Layer | Evidence |
|-------|----------|
| Browser | `dblclick` Start Review → one `.review-surface` / one headword |
| Integration | application-style `isActive()` guard → `starts === 1` |
| Narrow fix | `main.ts` `onStartReview`: `if (activeReviewHost?.isActive()) return;` |
| Busy reflect | Integration: concurrent outcome clicks → one write / one advance |

No debounce-as-correctness.

---

## 16. Failure/retry evidence

Integration forces reflection persistence failure, asserts revealed card + error +
no advance, restores persistence, retries → exactly one successful increment and
advance.

**Browser limitation:** no production-visible test seam for injecting IndexedDB
write failure cleanly in Playwright. Host/integration evidence retained; browser
failure injection not added.

---

## 17. Stale-async evidence

Integration `busy reflection suppresses duplicate writes; stale host drops redraw`:

- reflection may commit;
- disposed / non-current host must not redraw over the current surface.

Also covered indirectly by generation guards in Saved Vocabulary / Review hosts
from LS2I3–I4.

---

## 18. Storage and query-log isolation

Integration snapshot around queue load + reflection:

Unchanged: dictionary `records`, `search_index`, bundle registry, query logs,
Learning Record identity / `created_at` / content stamps / `display_cache`.

Changed only on successful reflect: `status`, `last_reviewed`, `review_count`.

Queue loading performs no writes. Review actions do not append query logs.

---

## 19. Accessibility

Playwright main flow asserts:

- Start Review keyboard focusable;
- `#review-heading` present;
- card semantic headword heading;
- Reveal is `type="button"`;
- reflection actions only after Reveal;
- focus → meaning heading after Reveal;
- focus → next headword after reflection;
- focus → completion heading;
- Back restores focus to Start Review.

Unresolved-only `aria-describedby` association remains covered by
`render_saved_vocabulary` / LS2I4 tests. Double Start Review + busy-state
guards cover duplicate activation suppression.

---

## 20. French smoke coverage

Browser: locale `fr` → `Commencer la révision`, `Pas encore révisé`,
`Révéler le sens`, `Encore en apprentissage`, `Mémorisé`.

Integration: renderer FR copy smoke for Start Review / status labels.

Full offline scenario is English-only (not duplicated in FR).

---

## 21. Verification matrix

| Guarantee | Browser | Integration | Status |
| ---------------------------------------- | -----------------: | ----------: | ------ |
| Review starts from Saved Vocabulary | Yes | Yes | Pass |
| Temporary top-level Review absent | Yes | Yes | Pass |
| Meaning hidden before Reveal | Yes | Yes | Pass |
| Still learning persists | Yes | Yes | Pass |
| Remembered persists | Yes | Yes | Pass |
| Immediate persistence before completion | Yes | Yes | Pass |
| Offline Review works | Yes | Yes | Pass |
| Offline reload retains reflection | Yes | Yes | Pass |
| Active Review reload resets session | Yes | Yes | Pass |
| Same-status increments | Optional browser | Yes | Pass |
| Remembered can return to Still learning | Optional browser | Yes | Pass |
| Unresolved excluded | Preferred browser omitted | Yes | Pass (integration; browser seam gap) |
| Bundle removal preserves Learning Record | Optional browser | Yes | Pass |
| Reinstall restores resolution/status | Optional browser | Yes | Pass |
| Bundle update preserves identity/status | Optional browser | Yes | Pass |
| Active-bundle isolation | Optional browser | Yes | Pass |
| Database deletion removes learning state | Optional browser | Yes | Pass |
| Duplicate activation suppressed | Yes | Yes | Pass |
| Stale updates dropped | Optional browser | Yes | Pass |
| Dictionary/query-log isolation | Integration | Yes | Pass |
| EN/FR copy | Smoke | Yes | Pass |
| Focus sequence | Yes | Yes | Pass |

Browser column marked Yes only when Playwright exercised the guarantee.

---

## 22. Defects found and fixes

| Defect | Fix |
|--------|-----|
| Rapid double Start Review could start a second host | `main.ts`: guard `onStartReview` with `activeReviewHost?.isActive()`; regression in LS2I5 integration + Playwright dblclick |

Test-only race fixes (not product defects):

- save helper waited for stale prior search results before opening the second entry;
- assertions read the previous headword before the next card mounted after Reflect.

---

## 23. Remaining verification gaps

1. Soft-orphan / unresolved full Playwright flow — no clean production bundle-mutation seam.
2. Browser-injected reflection failure — no production-safe test hook.
3. Same-status / Remembered-reversal / bundle lifecycle / active-bundle / DB delete —
   integration-only (optional browser not added to keep the product flow focused).

None block the offline product-loop decision.

---

## 24. Test commands and exact results

```bash
npx vitest run src/learning/ls2i5_review_lifecycle_verification.test.ts
# → 13 passed

npx playwright test e2e/learning/ls2_offline_review.spec.ts -c playwright.config.ts
# → 5 passed

npx playwright test e2e/learning/ls1_offline_saved_vocabulary.spec.ts -c playwright.config.ts
# → 1 passed

npx playwright test e2e/navigation/source_result_direct_entry.spec.ts -c playwright.config.ts
# → 1 passed (also re-verified in combo run)

npx playwright test e2e/learning/ -c playwright.config.ts
# → 6 passed

npx vitest run src/learning/ls2i5_review_lifecycle_verification.test.ts \
  src/learning/learning_record_reflection.test.ts \
  src/learning/review_queue.test.ts src/learning/review_session.test.ts \
  src/learning/review_surface_host.test.ts src/render/render_review.test.ts \
  src/learning/ls2i4_saved_vocabulary_review_integration.test.ts \
  src/render/render_saved_vocabulary.test.ts \
  src/learning/saved_vocabulary_session.test.ts \
  src/learning/ls1i4_lifecycle_verification.test.ts \
  src/learning/learning_record_persistence.test.ts
# → 11 files / 133 passed

npm run test:run
# → Test Files 44 passed (44) / Tests 441 passed (441) — one complete run

npm run build
# → success

git diff --check
# → clean
```

---

## 25. Repository hygiene

Unrelated featured-anchor work left unstaged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

LS2I5 commit stages only:

- `web/e2e/learning/ls2_offline_review.spec.ts`
- `web/src/learning/ls2i5_review_lifecycle_verification.test.ts`
- `web/src/main.ts` (narrow Start Review guard)
- `docs/reports/ls2i5_offline_lifecycle_verification_report.md`
