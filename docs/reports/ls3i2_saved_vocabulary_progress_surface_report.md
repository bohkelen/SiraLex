# LS3I2 — Saved Vocabulary Progress Surface Report

## 1. Decision

```text
LS3_PROGRESS_SURFACE_IMPLEMENTED
```

Authoritative inputs:

- `docs/reports/ls3d0_progress_return_surface_product_definition.md`
- `docs/reports/ls3i1_derived_progress_model_report.md`
- `web/src/learning/saved_vocabulary_progress.ts`
- current Saved Vocabulary renderer / session / i18n / CSS

---

## 2. Surface placement

Progress renders only on populated/removing Saved Vocabulary surfaces.

Order:

```text
Back
Saved Vocabulary heading
Progress summary
Unavailable explanation (when shown)
Return cue (when meaningful)
Start / Continue Review action
Vocabulary list
```

No global dashboard. No new page. No Progress on loading / empty / unavailable / error.

---

## 3. Summary structure

Semantic compact definition list:

```html
<section class="saved-vocab-progress" aria-labelledby="saved-vocab-progress-heading">
  <h3 id="saved-vocab-progress-heading">…</h3>
  <dl class="saved-vocab-progress-list">
    <div class="saved-vocab-progress-item">
      <dt>…</dt>
      <dd>…</dd>
    </div>
  </dl>
</section>
```

No table, chart, progress bar, canvas, or ARIA roles that duplicate native semantics.

---

## 4. Metrics rendered

Always shown:

- Saved (`total_saved`)
- Not reviewed
- Still learning
- Remembered

Shown only when `showUnavailable === true`:

- Unavailable

Not rendered:

- `reviewable`
- `unknown_state_count`
- review-count totals
- collection last-reviewed
- percentages

Counts come only from `model.progress.*`. The renderer does not count DOM rows or re-derive from `model.rows`.

---

## 5. Start versus Continue rendering

Button label and enablement come from `model.progress.reviewAction`:

| Action | Label EN / FR |
| --- | --- |
| enabled / start | Start review / Commencer la révision |
| enabled / continue | Continue review / Continuer la révision |
| disabled | Disabled button + existing no-reviewable explanation |
| hidden | Button omitted (defensive) |

Both enabled labels invoke the same `onStartReview` callback. Continue does not imply session resume.

During `removing`, the button is disabled while the summary remains visible.

---

## 6. Return cue rendering

When `returnCue !== "none"`, a `<p class="saved-vocab-return-cue">` is rendered before the Review action.

| Cue | EN | FR |
| --- | --- | --- |
| review_new | Review new saved words | Réviser les nouveaux mots enregistrés |
| review_still_learning | Review words you are still learning | Réviser les mots encore en apprentissage |
| review_again | Review saved vocabulary again | Réviser à nouveau le vocabulaire enregistré |

Informational text only — not a button, not an alert, not auto-focused, no `aria-live`.

---

## 7. Unavailable rendering

When `showUnavailable === true`:

- Unavailable count in the summary;
- one explanation: “These saved entries are not available in the current dictionary.”

Placed below the summary and before the return cue/action. Per-row unresolved badge unchanged.

---

## 8. Removing behavior

- summary remains visible;
- counts reflect current in-memory rows;
- Review button disabled;
- return cue may remain;
- row busy behavior unchanged;
- no optimistic count mutation before successful removal.

---

## 9. Other surface states

| Surface | Progress |
| --- | --- |
| loading | No summary; disabled Start control preserved |
| empty | No summary / action / zero panel |
| unavailable | No stale summary |
| error | No fabricated counts |

---

## 10. Renderer / model boundary

`renderSavedVocabulary(model, callbacks)` unchanged as API.

Renderer consumes `model.progress` only. No IndexedDB, resolution, queue construction, or count derivation.

Callbacks remain Back / Open / Remove / Start Review.

---

## 11. `canStartReview` migration

Selected result: **removed**.

- removed from `SavedVocabularyModel`;
- removed `canStartReviewFromSavedVocabularyModel`;
- session emits `progress` only;
- renderer uses `progress.reviewAction` exclusively.

No dual action-state signals remain.

---

## 12. Localization

Dedicated `progress.*` keys (EN/FR parity):

```text
progress.heading
progress.saved
progress.notReviewed
progress.stillLearning
progress.remembered
progress.unavailable
progress.startReview
progress.continueReview
progress.cue.reviewNew
progress.cue.reviewStillLearning
progress.cue.reviewAgain
progress.unavailableExplanation
```

Per-row singular `review.*` labels unchanged. Existing `review.noResolved` reused for disabled Review explanation.

---

## 13. Accessibility

- Progress section has accessible heading;
- native `<dl>` / `<dt>` / `<dd>`;
- Review is a real button;
- disabled button described by hint via `aria-describedby`;
- return cue is normal text (no live region / alert);
- no colour-only meaning;
- no `aria-live` on summary;
- no progressbar role;
- unique IDs;
- existing Start/Continue button remains the Review focus target.

---

## 14. Styling

Minimal styles in `style.css` for:

- `.saved-vocab-progress`
- `.saved-vocab-progress-heading`
- `.saved-vocab-progress-list` / item / label / value
- `.saved-vocab-return-cue`
- `.saved-vocab-unavailable-explanation`

Compact, subordinate to the page heading, narrow-screen friendly. No card grid, badges, progress bars, celebratory colors, or animation. Uses existing CSS variables.

---

## 15. Tests

| Suite | Coverage |
| --- | --- |
| `render_saved_vocabulary.test.ts` | summary presence/absence, metrics, unavailable, Start/Continue, cues, semantics, FR copy, regressions |
| `i18n.test.ts` | Progress EN/FR keys |
| Session / LS2 Saved Vocabulary / LS3I1 | model cleanup + regressions |

---

## 16. Deviations

None relative to LS3D0 / LS3I2 instruction.

- Progress derivation semantics unchanged;
- Review queue / host / `main.ts` / Playwright / schema untouched;
- featured-anchor work left unstaged.

---

## 17. Repository hygiene

Unrelated featured-anchor paths excluded:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

Canonical status:

```text
LS3I1 — Implemented
LS3I2 — Saved Vocabulary Progress Surface — Implemented
LS3I3 — Return Action and Navigation Integration — Next
```

---

## Validation

| Command | Result |
| --- | --- |
| Focused renderer / i18n / session / LS3I1 / LS2 SV | **7 files / 71 tests passed** |
| Full `npm run test:run` | **Test Files 45 passed (45) / Tests 454 passed (454)** |
| `npm run build` | **pass** |
| `git diff --check` | clean for staged LS3I2 files |

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS3_PROGRESS_SURFACE_IMPLEMENTED` |
| Placement | Saved Vocabulary, below heading, above Review |
| Action source | `progress.reviewAction` only |
| Next slice | `LS3I3 — Return Action and Navigation Integration` |
