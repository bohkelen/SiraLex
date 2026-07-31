# LS3I3 — Return Action and Navigation Integration Report

## 1. Decision

```text
LS3_RETURN_NAVIGATION_INTEGRATION_IMPLEMENTED
```

Authoritative inputs:

- `docs/reports/ls3d0_progress_return_surface_product_definition.md`
- `docs/reports/ls3i1_derived_progress_model_report.md`
- `docs/reports/ls3i2_saved_vocabulary_progress_surface_report.md`
- `web/src/main.ts` host-context / generation model
- LS2I4 / LS2I5 navigation and lifecycle tests

---

## 2. Start/Continue shared action

Both Progress labels invoke the same Saved Vocabulary callback:

```ts
onStartReview(): void
```

Application path (`showReviewSurface`):

```text
Start review | Continue review
  → invalidate Saved Vocabulary generation
  → enter Review host context
  → create one fresh Review surface host
  → build one fresh active-bundle Review queue
```

`main.ts` does not inspect the button label. No separate Continue handler.

---

## 3. Fresh-session guarantee

Every enabled activation creates a new ephemeral LS2 Review session via
`createReviewSurfaceHost` → `host.start()`.

Verified:

- Start after save creates a fresh queue;
- Continue after reflections creates a fresh queue;
- Review again restarts a fresh session on the active host;
- Back then Continue creates a fresh queue;
- no `current_index`, Reveal, or busy state is reused across activations.

---

## 4. Duplicate activation guard

Ownership rule:

> Only one `activeReviewHost` may present while `isActive()` is true. Activation
> is suppressed when a host is already active. Disposal increments
> `reviewGeneration` so a disposed host cannot become current again.

Correctness is host/generation ownership, not debounce.

---

## 5. Back flow

Review Back:

1. dispose Review host;
2. invalidate Review generation;
3. set one-use `focusReviewActionOnce`;
4. reopen Saved Vocabulary;
5. reload Learning Records for the active bundle;
6. recompute rows and Progress;
7. render fresh summary;
8. focus enabled Start/Continue, else `#saved-vocab-heading`.

No search rerun. No reuse of the previous Saved Vocabulary model.

---

## 6. Completion Back flow

Back from the completion surface uses the same `onBack` path as an active card.
Progress refreshes from a fresh session load; Continue is selected when reviewed
buckets exist; focus restores to Continue when enabled.

---

## 7. Review Again flow

`onReviewAgain` calls `host.start()` while remaining in Review context:

- disposes the completed session inside the host;
- builds a fresh queue from persisted Learning Records;
- does not reopen Saved Vocabulary;
- does not rerun search.

A disposed host after navigation away cannot recreate Review via stale
`start()`.

---

## 8. Focus restoration

Renamed internal intent:

```text
focusStartReviewOnce → focusReviewActionOnce
```

Behavior after Saved Vocabulary reload when intent is set:

1. if Start/Continue exists and is enabled → focus it;
2. else → focus `#saved-vocab-heading`;
3. consume intent exactly once.

Ordinary Saved Vocabulary opens do not auto-focus the Review action.
Remove focus behavior unchanged. DOM id `#saved-vocab-start-review` retained
for compatibility.

---

## 9. Refresh after reflection

Returning from Review reloads Saved Vocabulary from IndexedDB and re-derives
Progress. First reflection transitions Start → Continue and updates
`not_reviewed` / `still_learning` / `remembered` from a fresh load — not by
patching the previous Progress VM.

---

## 10. Refresh after Remove

Session `emitPopulated` during removing keeps pre-success counts with Review
disabled. Successful remove emits fresh Progress; empty collection switches to
empty (no summary). Cancelled remove leaves counts unchanged. Stale remove
completions are dropped by generation checks.

---

## 11. Refresh after Save

Opening/reloading Saved Vocabulary after Save increases `total_saved` /
`not_reviewed` and may enable Start with `review_new`. No background push while
Saved Vocabulary is hidden.

---

## 12. Active-bundle switching

`refreshDbStatus` detects active-bundle identity change and calls
`invalidateCollectionAndReviewContexts()`. Next Saved Vocabulary open loads and
summarizes only the new bundle. No cross-bundle totals.

---

## 13. Bundle lifecycle

Existing LS2I5 coverage plus LS3I3 Progress scoping:

- removal → unavailable rises, reviewable falls, action disables when needed;
- reinstall/update → resolution restores; prior reflection fields remain;
- no automatic display-cache refresh.

---

## 14. Database deletion

Delete-DB path now explicitly:

- `invalidateCollectionAndReviewContexts()`;
- clears Review/Saved Vocabulary hosts and focus intent;
- sets host context to `search` and clears `#searchResults`;
- resets `lastKnownActiveBundleId`;
- then `refreshDbStatus()`.

No automatic restoration of personal Learning state.

---

## 15. Search/entry invalidation

- new search / results list → invalidate collection and Review;
- entry detail disposes Review; search-origin entry bumps Saved Vocabulary
  generation;
- stale collection/Review updates cannot redraw newer hosts;
- entry opened from Saved Vocabulary still returns to Saved Vocabulary.

---

## 16. Locale behavior

Existing app localization: re-render uses current locale strings. Progress
counts are locale-independent. No locale-specific Progress derivation. No
Progress persistence.

---

## 17. Host-context invariants

- only the current `resultsHostContext` may render;
- Saved Vocabulary callbacks valid only for current `savedVocabularyGeneration`;
- Review callbacks valid only for active host + `reviewGeneration`;
- disposal prevents late presentation updates;
- committed reflections may persist after navigation; stale hosts cannot redraw;
- reopening Saved Vocabulary reflects committed results.

---

## 18. Tests

| Suite | Role |
| --- | --- |
| `ls3i3_return_action_navigation.test.ts` | Start/Continue identity, Progress refresh, focus, remove, Review again, stale host, bundle scope |
| `ls2i4_saved_vocabulary_review_integration.test.ts` | Updated for `focusReviewActionOnce` + Continue label after reflection |
| `saved_vocabulary_navigation.test.ts` | Focus-intent rename |
| LS2I5 / Review host / LS3I1 / LS3I2 | Regressions |

---

## 19. Naming cleanup

| Before | After |
| --- | --- |
| `focusStartReviewOnce` | `focusReviewActionOnce` |
| `restoreStartReviewFocus` | `restoreReviewActionFocus` |

Retained for DOM compatibility:

```text
#saved-vocab-start-review
```

---

## 20. Deviations

None relative to LS3I3 instruction.

- Progress derivation and summary presentation unchanged;
- Review queue ordering unchanged;
- Playwright not added (LS3I4);
- featured-anchor work left unstaged.

---

## 21. Repository hygiene

Unrelated featured-anchor paths excluded:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

Canonical status:

```text
LS3I2 — Implemented
LS3I3 — Return Action and Navigation Integration — Implemented
LS3I4 — Offline and Lifecycle Verification — Next
```

---

## Validation

| Command | Result |
| --- | --- |
| Focused LS3I3 + LS2I4/I5 + LS3I1/I2 + Review host | **7 files / 68 tests passed** |
| Full `npm run test:run` | **Test Files 46 passed (46) / Tests 465 passed (465)** |
| `npm run build` | **pass** |
| `git diff --check` | clean for staged LS3I3 files |

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS3_RETURN_NAVIGATION_INTEGRATION_IMPLEMENTED` |
| Shared action | `onStartReview` → fresh `showReviewSurface` |
| Focus intent | `focusReviewActionOnce` |
| Next slice | `LS3I4 — Offline and Lifecycle Verification` |
