# LS3I1 — Derived Progress Model Report

## 1. Decision

```text
LS3_DERIVED_PROGRESS_MODEL_IMPLEMENTED
```

Authoritative inputs:

- `docs/reports/ls3d0_progress_return_surface_product_definition.md`
- `docs/reports/ls2_review_and_reflect_closure_report.md`
- current `SavedVocabularyRowVm` / session model
- LS2 review-field and queue eligibility rules

---

## 2. Public Progress VM

Module: `web/src/learning/saved_vocabulary_progress.ts`

```ts
export type SavedVocabularyProgressVm = {
  total_saved: number;
  not_reviewed: number;
  still_learning: number;
  remembered: number;
  unavailable: number;
  reviewable: number;
  reviewAction:
    | { state: "enabled"; label: "start" | "continue" }
    | { state: "disabled"; reason: "no_reviewable_entries" }
    | { state: "hidden"; reason: "empty_collection" };
  returnCue:
    | "review_new"
    | "review_still_learning"
    | "review_again"
    | "none";
  showUnavailable: boolean;
};
```

No localized strings, percentages, review-count totals, or collection-level
last-reviewed timestamp.

---

## 3. Internal diagnostics

```ts
export type SavedVocabularyProgressDiagnostics = {
  unknown_state_count: number;
};
```

Returned beside the public VM. Never attached to the renderer-facing Progress
object. No logging side effects. No storage repair.

---

## 4. Derivation API

```ts
export function deriveSavedVocabularyProgress(
  rows: readonly SavedVocabularyRowVm[],
): {
  progress: SavedVocabularyProgressVm;
  diagnostics: SavedVocabularyProgressDiagnostics;
};

export function isSavedVocabularyRowReviewable(
  row: SavedVocabularyRowVm,
): boolean;
```

One pass over rows. Pure. No IndexedDB. No resolution. No Review queue
construction. No writes.

---

## 5. Exact metric rules

| Metric | Rule |
| --- | --- |
| `total_saved` | `rows.length` |
| `not_reviewed` | `reviewStatus.state === "not_reviewed"` |
| `still_learning` | `reviewStatus.state === "still_learning"` |
| `remembered` | `reviewStatus.state === "remembered"` |
| `unavailable` | `row.state === "unresolved"` |
| `reviewable` | `isSavedVocabularyRowReviewable(row)` |
| `showUnavailable` | `unavailable > 0` |
| `unknown_state_count` | unknown / missing / unclassifiable reviewStatus |

Status buckets never derive from `status` alone.

---

## 6. Reviewability source of truth

Extracted pure helper in `review_queue.ts`:

```ts
export function isResolvedLexiconReviewEligible(
  learningRecord: LearningRecordV1,
  liveEntry: EnrichedRecord,
): boolean
```

Requires:

- consistent review fields;
- live `lexicon_entry`;
- usable lexicon display (`isLexiconDisplay`);
- `liveEntry.ir_id === learningRecord.ir_id`.

`buildReviewQueue` uses this helper after resolution.
`isSavedVocabularyRowReviewable` uses the same helper for resolved rows.

One source of truth. No duplicate eligibility rules. No queue construction for
Progress.

---

## 7. Orthogonal status/availability handling

Learning-status counts include both resolved and unresolved rows.

Unavailable is independent and may overlap any status:

```text
Remembered + unavailable
Still learning + unavailable
Not reviewed + unavailable
```

Unavailable is not a fourth learning status.

---

## 8. Action derivation

| Condition | Action |
| --- | --- |
| `total_saved === 0` | `hidden` / `empty_collection` |
| `total_saved > 0 && reviewable === 0` | `disabled` / `no_reviewable_entries` |
| `reviewable > 0 && still_learning === 0 && remembered === 0` | `enabled` / `start` |
| `reviewable > 0 && (still_learning > 0 \|\| remembered > 0)` | `enabled` / `continue` |

Continue means prior reflections exist in the collection, including when those
reviewed rows are currently unavailable. It does not mean session resume.

---

## 9. Return-cue hierarchy

```text
reviewable === 0 → none
else not_reviewed > 0 → review_new
else still_learning > 0 → review_still_learning
else remembered > 0 → review_again
else → none
```

Matches LS2 queue-group priority. No due dates, recency weighting, or session
state.

---

## 10. Invariants

Tests assert:

```text
not_reviewed + still_learning + remembered + unknown_state_count
  = total_saved
```

and:

```text
reviewable <= total_saved - unavailable
```

Do **not** assert:

```text
total_saved =
  not_reviewed + still_learning + remembered + unavailable
```

---

## 11. Inconsistent / malformed handling

- increment `unknown_state_count`;
- include in `total_saved`;
- include in `unavailable` when unresolved;
- exclude from status buckets and `reviewable`;
- do not throw;
- do not repair;
- do not infer from `status`.

A resolved inconsistent row does not enable Review.

Defensive classification also covers missing/unknown reviewStatus and eligibility
failures (identity mismatch, non-lexicon live entry, unusable display).

---

## 12. Purity

Deriver:

- does not mutate input rows / Learning Records / live entries;
- does not access IndexedDB;
- does not call date/time or translation APIs;
- does not log or persist;
- is deterministic for identical input.

---

## 13. Saved Vocabulary session integration

`SavedVocabularyModel` populated/removing surfaces now include:

```ts
progress: SavedVocabularyProgressVm
```

Session derives Progress after rows are built (`emitPopulated`), with no second
DB or resolution pass.

Renderer is unchanged and ignores the new field until LS3I2.

Boundary selected: attach Progress in the session model in LS3I1.

---

## 14. `canStartReview` migration

Previously: `countResolved(rows) > 0` (loose).

Now:

```ts
canStartReview: progress.reviewAction.state === "enabled"
```

Retained as a transitional UI signal for the existing renderer. Documented as
derived from Progress. Single eligibility path — no independent loose rule.

---

## 15. Tests

| Suite | Coverage |
| --- | --- |
| `saved_vocabulary_progress.test.ts` | empty/basic, orthogonality, actions, cues, reviewability, diagnostics/invariants/purity |
| `saved_vocabulary_session.test.ts` | Progress attachment; canStartReview from Progress; Continue after reflection |
| `review_queue.test.ts` | shared helper parity with queue inclusion |
| Existing Saved Vocabulary / LS2 suites | type-coherent fixtures with Progress; no behavior regressions |

---

## 16. Deviations

None relative to LS3D0 / LS3I1 instruction.

- Renderer / CSS / i18n / Playwright / schema untouched.
- Featured-anchor work left unstaged.
- `canStartReview` retained for LS3I2 transition, derived from Progress.

---

## 17. Repository hygiene

Unrelated featured-anchor paths were present and excluded:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

Staged only LS3I1 owners.

Canonical status:

```text
LS3D0 — Defined
LS3I1 — Derived Progress Model — Implemented
LS3I2 — Saved Vocabulary Progress Surface — Next
```

---

## Validation

| Command | Result |
| --- | --- |
| Focused Progress / Saved Vocab / queue / LS2 suites | **7 files / 70 tests passed** |
| Full `npm run test:run` | **Test Files 45 passed (45) / Tests 452 passed (452)** |
| `npm run build` | **pass** |
| `git diff --check` | clean for staged LS3I1 files |
---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS3_DERIVED_PROGRESS_MODEL_IMPLEMENTED` |
| Module | `web/src/learning/saved_vocabulary_progress.ts` |
| Eligibility source | `isResolvedLexiconReviewEligible` |
| Next slice | `LS3I2 — Saved Vocabulary Progress Surface` |
