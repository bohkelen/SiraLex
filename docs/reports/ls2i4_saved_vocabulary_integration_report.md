# LS2I4 — Saved Vocabulary Integration Report

## Decision

```text
LS2_SAVED_VOCABULARY_INTEGRATION_IMPLEMENTED
```

Saved Vocabulary is the canonical entry point for Review. The temporary chrome
Review button is removed. Collection rows show derived review status; returning
from Review reloads persisted outcomes and restores focus to Start Review.

---

## 1. Temporary chrome button removal

Removed `#startReview` from `#activeDictionaryRow` in `main.ts`, including its
element lookup and click wiring. Dictionary row retains Saved Vocabulary and
Manage dictionaries only.

---

## 2. Start Review placement

Under the Saved Vocabulary heading, before the list. Callback: `onStartReview()`.
Button id: `#saved-vocab-start-review`.

---

## 3. Availability rules

| Surface | Start Review |
|---------|--------------|
| `populated` with ≥1 resolved row | enabled (`canStartReview: true`) |
| `populated` unresolved-only | disabled + `review.noResolved` explanation |
| `removing` | disabled |
| `loading` | disabled |
| `empty` / `unavailable` / `error` | omitted |

Eligibility uses the Saved Vocabulary row model (`resolved rows > 0`), not a
second queue build. The Review session remains authoritative when started.

---

## 4. Row review-status model

```ts
SavedVocabularyReviewStatus =
  | { state: "not_reviewed"; labelKey: "review.notReviewed" }
  | { state: "still_learning"; labelKey: "review.stillLearning"; last_reviewed }
  | { state: "remembered"; labelKey: "review.remembered"; last_reviewed }
  | { state: "unknown" }
```

Derived in `deriveSavedVocabularyReviewStatus` / `buildSavedVocabularyRowVm`.

---

## 5. Never-reviewed derivation

Reuses LS2I2 helpers:

- `hasConsistentReviewFields`
- `hasLearningRecordBeenReviewed`

Not derived from `status` alone. Inconsistent fields → `unknown` (no repair).

---

## 6. Last-reviewed display

Shown only for reviewed still-learning / remembered rows via
`formatReviewTimestamp` + `review.lastReviewed` (`Last reviewed: {date}`).
No review-count, percentage, or relative-time timers.

---

## 7. Renderer/session boundary

Session derives `reviewStatus` and `canStartReview`. Renderer displays labels
and Start Review availability. No IndexedDB in the renderer.

---

## 8. Navigation flow

```text
Saved Vocabulary → Start Review → Review → Back → Saved Vocabulary (reload)
```

Review again stays in Review with a fresh session. No search rerun.

---

## 9. Focus restoration

One-use `focusStartReviewOnce` intent set on Review Back. After Saved Vocabulary
reload (non-loading):

- focus Start Review when enabled;
- else focus Saved Vocabulary heading.

Does not overwrite later navigation. Post-remove focus unchanged.

---

## 10. Host-context invalidation

Contexts: `search | saved_vocabulary | entry_from_search | entry_from_saved | review`.

Late Saved Vocabulary updates cannot redraw Review (generation + context gates).
Search clear, search results, and bundle switches invalidate collection + Review
via `invalidateCollectionAndReviewContexts()`.

---

## 11. Bundle-change behavior

`refreshDbStatus` tracks `lastKnownActiveBundleId`. On change, invalidates
collection/Review generations and clears Review/Saved Vocabulary surfaces when
visible. Next open loads the new active bundle only.

---

## 12. Localization

EN/FR:

- `review.start` — Start review / Commencer la révision
- `review.notReviewed` — Not reviewed / Pas encore révisé
- `review.lastReviewed` — Last reviewed: {date} / Dernière révision : {date}
- Reuses `review.noResolved`, `review.stillLearning`, `remembered`

---

## 13. Accessibility

Real Start Review button; disabled semantics; `aria-describedby` for unresolved
explanation; textual status + last-reviewed; heading `tabIndex=-1` for restore;
visible focus styles.

---

## 14. Tests

- `render_saved_vocabulary.test.ts` — Start Review availability, statuses, a11y
- `saved_vocabulary_session.test.ts` — derivation, eligibility, no-write load
- `ls2i4_saved_vocabulary_review_integration.test.ts` — chrome removal, full
  path with persistence, focus restore, unresolved/empty guards

---

## 15. Playwright

Deferred to LS2I5 (offline browser flow).

---

## 16. Deviations

None material. Empty/unavailable/error omit Start Review rather than showing a
permanently disabled control (loading still shows disabled).

---

## 17. Repository hygiene

Unrelated featured-anchor work left uncommitted:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`
