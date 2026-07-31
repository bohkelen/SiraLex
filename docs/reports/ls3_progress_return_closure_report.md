# LS3 — Progress & Return Closure Report

## 1. Decision

```text
LS3_CLOSED
```

LS3 is a completed product milestone. Executable evidence supports the locked
Progress & Return surface, including offline Progress and Continue Review.
This closure slice is documentation-only.

Authoritative chain:

- `docs/reports/ls3d0_progress_return_surface_product_definition.md`
- `docs/reports/ls3i1_derived_progress_model_report.md`
- `docs/reports/ls3i2_saved_vocabulary_progress_surface_report.md`
- `docs/reports/ls3i3_return_action_navigation_integration_report.md`
- `docs/reports/ls3i4_offline_lifecycle_verification_report.md`
- `docs/reports/ls2_review_and_reflect_closure_report.md`
- `docs/reports/ls1_learning_system_closure_report.md`

No executable evidence contradicts a locked LS3 requirement.

---

## 2. Completed product capability

The user can open Saved Vocabulary, understand the current state of the
active-bundle collection through truthful derived counts, see whether to Start
or Continue Review, follow a queue-aligned return cue, review offline, return
to refreshed Progress, and retain that state across reloads without creating
persistent Progress data.

---

## 3. Final user loop

```text
Search
  → Open genuine Maninka lexicon entry
  → Save
  → Open Saved Vocabulary
  → See Progress
  → Start or Continue Review
  → Recall
  → Reveal
  → Reflect
  → Return
  → Progress refreshes
```

Offline loop:

```text
Installed dictionary
  → Saved Vocabulary
  → Progress offline
  → Continue Review offline
  → Persist reflection locally
  → Return
  → Progress refreshes
  → Reload offline
  → Progress remains
```

Clarifications:

- Progress acts on existing Learning Records.
- Progress does not create a second learning identity.
- Progress does not persist its own state.
- Progress does not represent mastery.
- Progress remains active-bundle scoped.
- Unavailable is orthogonal to learning status.
- Start and Continue launch the same fresh LS2 Review behavior.

Roadmap status for this milestone:

```text
LS3 — Closed
Learning System Post-LS3 Decision — Next
```

`docs/ROADMAP.md` has no Learning System / LS3 status index requiring update
(same pattern as LS1/LS2 closure).

---

## 4. Success-criteria matrix

| Capability | Implementation | Evidence | Status |
| --- | --- | --- | --- |
| Progress appears in Saved Vocabulary | LS3I2 renderer | renderer tests + Playwright | Pass |
| Summary only for populated collection | renderer states | renderer tests | Pass |
| Saved count | Progress deriver | LS3I1 + LS3I4 tests | Pass |
| Not reviewed derivation | canonical review helpers | LS3I1/LS3I4 tests | Pass |
| Still learning derivation | row status VM | LS3I1/LS3I4 tests | Pass |
| Remembered derivation | row status VM | LS3I1/LS3I4 tests | Pass |
| Unavailable orthogonality | resolution dimension | LS3I1/LS3I4 integration | Pass |
| Reviewable strict eligibility | shared queue helper | LS3I1 queue parity tests | Pass |
| Start Review for new collection | Progress action model | browser + integration | Pass |
| Continue Review after reflection | Progress action model | browser + integration | Pass |
| Start/Continue same Review path | application navigation | LS3I3 tests + browser | Pass |
| Fresh session behavior | LS2 host/session | LS3I3/LS3I4 tests | Pass |
| Return cue follows queue priority | Progress deriver | unit + browser | Pass |
| No Resume semantics | renderer/navigation | browser | Pass |
| Progress refresh after reflection | fresh collection reload | browser + integration | Pass |
| Immediate durability | Learning Record persistence | Playwright | Pass |
| Reveal-only reload leaves Progress unchanged | ephemeral Review state | Playwright | Pass |
| Offline Progress | PWA + IndexedDB | Playwright | Pass |
| Offline Continue Review | LS2 + LS3 integration | Playwright | Pass |
| Offline reload retains Progress | derived persisted state | Playwright | Pass |
| Removal updates counts | session recomputation | browser + integration | Pass |
| Removal to empty hides Progress | collection state model | browser + integration | Pass |
| Bundle removal preserves status dimension | Learning Records retained | integration | Pass |
| Reinstall restores reviewability | live resolution | integration | Pass |
| Bundle update preserves status | stable identity | integration | Pass |
| Active-bundle isolation | scoped list/queue | integration | Pass |
| Database deletion clears Progress source | DB lifecycle | integration | Pass |
| Duplicate activation suppressed | active host/busy guards | browser + integration | Pass |
| Stale updates dropped | host context/generation | LS3I3/LS3I4 tests | Pass |
| Dictionary/query-log isolation | separate boundaries | integration | Pass |
| Accessibility focus sequence | renderer/navigation | Playwright | Pass |
| EN/FR parity | i18n | tests + French browser smoke | Pass |

No row is marked Pass from documentation alone.

---

## 5. Progress source of truth

Progress derives from:

```text
SavedVocabularyRowVm[]
```

Each row already contains:

- Learning Record identity and review state;
- resolved or unresolved state;
- current live lexicon entry when available;
- presentation-ready review status.

Architecture locks:

- Progress does not read IndexedDB directly.
- Progress does not re-resolve dictionary entries.
- Progress does not construct a Review queue.
- The Saved Vocabulary session builds rows; Progress derives from those rows.
- Renderer consumes the Progress view-model; it does not recompute counts.

Primary modules:

| Layer | Owner |
| --- | --- |
| Pure derivation | `web/src/learning/saved_vocabulary_progress.ts` |
| Row/session attachment | `web/src/learning/saved_vocabulary_session.ts` |
| Presentation | `web/src/render/render_saved_vocabulary.ts` |
| Navigation / focus | `web/src/main.ts` (`onStartReview`, `focusReviewActionOnce`) |
| Shared eligibility | `isResolvedLexiconReviewEligible` in `review_queue.ts` |

---

## 6. Derived model and metric semantics

Derived fields:

```text
total_saved
not_reviewed
still_learning
remembered
unavailable
reviewable
reviewAction
returnCue
showUnavailable
```

`unknown_state_count` is internal diagnostics only and is never displayed.

### `total_saved`

All active-bundle Learning Records represented in Saved Vocabulary.

### `not_reviewed`

Consistent record where:

```text
review_count === 0
last_reviewed === null
```

### `still_learning`

Consistent reviewed record where:

```text
review_count > 0
last_reviewed !== null
status === "still_learning"
```

### `remembered`

Consistent reviewed record where:

```text
review_count > 0
last_reviewed !== null
status === "remembered"
```

### `unavailable`

Saved record that cannot resolve to a live current active-bundle lexicon entry.

### `reviewable`

Resolved, consistent, identity-valid, genuine `lexicon_entry` satisfying the
same eligibility source used by LS2 Review.

---

## 7. Status/availability orthogonality

Locked:

> Learning status and dictionary availability are separate dimensions.

Valid combinations include:

```text
Not reviewed + available
Not reviewed + unavailable
Still learning + available
Still learning + unavailable
Remembered + available
Remembered + unavailable
```

Valid invariant:

```text
not_reviewed
+ still_learning
+ remembered
+ unknown_state_count
= total_saved
```

Do **not** claim:

```text
total_saved
= not_reviewed
+ still_learning
+ remembered
+ unavailable
```

because unavailable overlaps the status dimension.

Also:

```text
reviewable <= total_saved - unavailable
```

without asserting equality (resolved rows may still fail strict Review
eligibility).

---

## 8. Action semantics

### Hidden

```text
total_saved === 0
```

No Progress surface or Review action.

### Disabled

```text
total_saved > 0
reviewable === 0
```

Saved Vocabulary remains visible; action disabled with explanation.

### Start Review

```text
reviewable > 0
still_learning === 0
remembered === 0
```

### Continue Review

```text
reviewable > 0
(still_learning > 0 || remembered > 0)
```

Clarifications:

- Continue indicates previous completed reflections exist.
- Continue does not resume a saved session.
- Start and Continue invoke the same fresh LS2 Review path.
- Reviewed unavailable rows can keep the label Continue when at least one other
  row remains reviewable.
- No Resume wording appears in product copy.

---

## 9. Return-cue semantics

Exact hierarchy:

```text
if reviewable === 0
  → none

else if not_reviewed > 0
  → review_new

else if still_learning > 0
  → review_still_learning

else if remembered > 0
  → review_again

else
  → none
```

Cues:

- mirror LS2 queue-group priority;
- do not schedule;
- do not inspect time;
- do not imply due or overdue;
- do not rank individual collection rows;
- are informational text, not a second action.

---

## 10. Presentation architecture

- Saved Vocabulary owns the LS3 surface.
- Progress appears below the page heading and above Review action/list.
- Semantic `<section>` and `<dl>/<dt>/<dd>`.
- Required visible metrics: Saved, Not reviewed, Still learning, Remembered.
- Unavailable shown only when greater than zero.
- Reviewable remains internal.
- No unknown-state display.
- No percentages.
- No total review-count display.
- No collection-level last-reviewed timestamp.
- No chart, meter, badge, animation, or mastery UI.
- No `progressbar` role.

---

## 11. Navigation architecture

- Saved Vocabulary remains the canonical entry point.
- One `onStartReview` callback serves both Start and Continue labels.
- DOM id `#saved-vocab-start-review` is retained for compatibility.
- One active Review host.
- Double activation is suppressed by host ownership.
- Review Back disposes Review and reloads Saved Vocabulary.
- Completion Back uses the same path.
- Review Again creates a fresh Review host in Review context.
- No router.
- No search rerun for Progress / Start / Continue / Back.
- No stale Saved Vocabulary model reuse across host contexts.
- Focus restoration uses one-use `focusReviewActionOnce`.
- Enabled Start/Continue receives focus after Back.
- Disabled/hidden action falls back to Saved Vocabulary heading.
- Ordinary collection opening does not steal focus.
- Progress summary is not auto-focused.

---

## 12. Refresh model

Progress refreshes after:

- Saved Vocabulary load;
- returning from Review;
- successful reflection followed by collection reopen;
- successful Remove;
- Save followed by collection reopen;
- active-bundle switch;
- bundle removal;
- compatible reinstall/update;
- database deletion;
- locale-triggered application rerender/reload.

Clarifications:

- no background polling;
- no cross-tab synchronization;
- no Progress event bus;
- no manual patching of counts after reflection;
- fresh Saved Vocabulary rows are the source of truth.

---

## 13. Offline guarantees

Verified:

- application shell loads offline after installation;
- installed dictionary remains available offline;
- Saved Vocabulary loads offline;
- Progress derives offline;
- Start/Continue Review works offline;
- reflection persists offline;
- Back refreshes Progress offline;
- offline reload retains updated Progress;
- no network fetch is required for Progress;
- no catalog refresh is required;
- no telemetry or cloud state is involved.

Offline method used in Playwright evidence:

```ts
await context.setOffline(true);
```

---

## 14. Reload/session guarantees

- Progress itself has no persisted state.
- Completed reflections persist immediately on Learning Records.
- Progress reflects them on the next collection load.
- Reveal-only state does not change Progress.
- Active Review does not resume after reload.
- Continue creates a fresh queue.
- Full session completion is not required for Progress durability.

---

## 15. Removal guarantees

### Resolved row

Removal decreases:

- Saved;
- its learning-status bucket;
- Reviewable.

### Unresolved row

Removal decreases:

- Saved;
- Unavailable;
- its learning-status bucket.

### Removal to empty

- Progress disappears;
- Review action disappears;
- empty collection state appears.

### Cancel/failure

- counts remain unchanged;
- no optimistic mutation becomes durable.

---

## 16. Bundle/database lifecycle

### Bundle removal

- Learning Records remain.
- Saved/status buckets remain.
- Unavailable rises.
- Reviewable falls.
- action disables if no eligible rows remain.

### Compatible reinstall

- prior records resolve again;
- Unavailable falls;
- Reviewable rises;
- prior status remains;
- Continue remains Continue when prior reflections exist.

### Same logical bundle update

- retained `ir_id` preserves identity/status;
- live updated content is used;
- removed `ir_id` becomes unavailable;
- no duplicate Learning Record is created.

### Active-bundle switching

- Progress is recomputed for the selected bundle only;
- no cross-bundle totals;
- switching back restores that bundle’s persisted Learning Record state.

### Database deletion

- Learning Records disappear;
- Progress source disappears;
- Review action becomes unavailable;
- no automatic restoration.

---

## 17. Storage/query-log isolation

Progress derivation, rendering, Start/Continue navigation, Reveal, and Back do
not mutate:

- dictionary records;
- search index;
- bundle registry;
- active-bundle metadata;
- query logs;
- Learning Record identity;
- `created_at`;
- display cache;
- content stamps.

Successful reflection may change only:

```text
status
last_reviewed
review_count
```

Successful Remove may delete the selected Learning Record.

Progress does not append query logs for Progress views, return cues,
Start/Continue, Review outcomes, completion, or count changes.

---

## 18. Accessibility/localization

- Saved Vocabulary remains primary page heading.
- Progress has an accessible section heading (`#saved-vocab-progress-heading`).
- Native definition-list semantics.
- Real Review button.
- Disabled explanation associated with the button.
- No color-only semantics.
- No `aria-live` on static summary.
- No progressbar role.
- Start/Continue keyboard reachable.
- Reveal focuses meaning.
- reflection focuses next card or completion.
- Back focuses Continue after prior reflection.
- ordinary collection open does not steal focus.
- EN/FR parity for all Progress labels and cues.
- French browser smoke completed.
- locale changes alter labels only, not numbers or persistence.

---

## 19. Truthfulness boundary

Locked statements:

- Saved means currently stored Learning Records.
- Not reviewed means no completed reflection has been recorded.
- Still learning means the latest completed self-assessment was Still learning.
- Remembered means the latest completed self-assessment was Remembered.
- Unavailable means the record cannot currently resolve in the active dictionary.
- Reviewable means currently eligible for LS2 Review.
- Remembered is reversible.
- Remembered does not mean mastered.
- Counts can move backward.
- Dictionary lifecycle may change Unavailable and Reviewable without changing status.
- Bundle switching changes the entire summary.
- Progress is orientation, not measured cognitive achievement.

Explicit definition:

> **Progress in LS3 means orientation through the current active-bundle
> collection, not analytics, mastery, retention, accuracy, or long-term
> learning measurement.**

---

## 20. Locked invariants

1. Progress derives from existing Saved Vocabulary rows.
2. Progress has no persistent store.
3. Progress adds no Learning identity.
4. Learning Record identity remains `(bundle_id, ir_id)`.
5. Only genuine lexicon-entry Learning Records contribute.
6. Active-bundle scope only.
7. No cross-bundle aggregation.
8. Learning status and availability are orthogonal.
9. Unavailable is not a learning-status bucket.
10. Never-reviewed derives from review count and timestamp.
11. `status` alone does not determine reviewed state.
12. Inconsistent rows remain internal unknown state.
13. Inconsistent rows cannot enable Review.
14. Reviewability shares LS2 eligibility logic.
15. Renderer does not derive counts.
16. Renderer does not access IndexedDB.
17. Progress load performs no writes.
18. Start and Continue share one Review path.
19. Continue does not imply session resume.
20. Review sessions remain ephemeral.
21. Return cues follow LS2 queue-group priority.
22. Return cues do not schedule.
23. No due or overdue semantics.
24. No percentages.
25. No mastery language.
26. No total review-count display.
27. No collection last-reviewed timestamp.
28. No query-log writes from Progress or Review actions.
29. Stale surfaces cannot redraw newer contexts.
30. Successful reflection changes only LS2 reflection fields.
31. Bundle removal does not cascade-delete Learning Records.
32. Database deletion removes Learning Records.
33. Saved Vocabulary remains the canonical Progress and Review surface.
34. Future analytics or scheduling must not reinterpret LS3 counts as objective achievement.

---

## 21. Known limitations

Explicit scope boundaries (not LS3 defects):

- active-bundle only;
- device-local learning;
- no global dashboard;
- no cross-bundle summary;
- no persistent Progress history;
- no Review Event history;
- no session resume;
- no charts or trends;
- no collection-level last-reviewed timestamp;
- no total review count;
- no due-state;
- no scheduling;
- no SRS;
- no goals, streaks, reminders, or notifications;
- no telemetry;
- no browser-level unresolved/reinstall mutation flow;
- no browser-level active-bundle switching flow;
- no browser-level bundle-update mutation flow;
- no browser-level database-deletion Progress flow;
- store/query-log isolation is integration-tested rather than browser-instrumented;
- unresolved-only Back focus is integration-tested rather than Playwright;
- no export/import;
- no cloud sync;
- no source-language Learning Records;
- no translation-pair Learning Records;
- no morphology;
- no audio.

---

## 22. Remaining browser gaps

1. unresolved → reinstall Progress mutation in Playwright;
2. active-bundle switching Progress UI in Playwright;
3. bundle update retained/removed `ir_id` in Playwright;
4. database deletion Progress UI in Playwright;
5. browser instrumentation for store/query-log counts;
6. unresolved-only Back focus in Playwright.

Integration evidence covers each locked requirement. Optional browser gaps are
not failed product requirements.

---

## 23. Deferred future systems

Possible future directions (not selected or implemented by this closure):

### Usage Evidence

Real user use may reveal whether users understand and act on the Progress
surface. Potential evidence includes saved collection sizes, repeated Review
use, Start versus Continue activation, queue abandonment, qualitative confusion
around Remembered, and usefulness of return cues. Do not add telemetry
automatically.

### Review Scheduling

Would require due-state semantics, time policy, longitudinal evidence,
potentially immutable Review Events, migration, and offline clock behavior.

### Learning History

Would require event identity, an append-only model, retention/deletion policy,
storage growth policy, and sync implications.

### Portability

Local export/import may become valuable as Learning Records accumulate.

### Richer lexical support

May matter more than further Progress features if Review usefulness is limited
by corpus quality.

---

## 24. Next milestone boundary

Do not automatically declare LS4 implementation.

Next milestone:

```text
Learning System Post-LS3 Decision
```

Recommended slice label:

```text
LSN1 — Learning System Post-LS3 Decision
```

Decision question:

> After durable Save, Review, and truthful Progress, what is the highest-value
> next capability: real-world usage validation, local portability, Review
> history, scheduling, richer lexical support, or another evidenced need?

The next slice should be decision/research, not implementation. It must
consider actual user value, field evidence, whether Progress changes behavior,
whether collections are large enough for scheduling or organization, whether
portability risk now matters, whether corpus quality constrains Review more
than product mechanics, data-model and migration consequences, and privacy
boundaries.

This slice does not create the full LSN1 instruction.

---

## 25. Final executable baseline

Rerun for this closure (not copied from LS3I4):

| Command | Result |
| --- | --- |
| LS3I1 Progress (`saved_vocabulary_progress.test.ts`) | **10 passed** |
| LS3I2 renderer (`render_saved_vocabulary.test.ts`) | **14 passed** |
| LS3I2 i18n Progress keys (`i18n.test.ts`) | **10 passed** |
| LS3I3 navigation (`ls3i3_return_action_navigation.test.ts`) | **11 passed** |
| LS3I4 lifecycle (`ls3i4_progress_lifecycle_verification.test.ts`) | **17 passed** |
| Focused LS1/LS2/LS3 Vitest regressions (11 files) | **118 passed** |
| Focused LS3 Playwright (`ls3_progress_return.spec.ts`) | **6 passed** |
| All learning Playwright (`e2e/learning/`) | **12 passed** |
| LS2 offline Review Playwright | **5 passed** |
| LS1 offline Saved Vocabulary Playwright | **1 passed** |
| Direct-entry navigation Playwright | **1 passed** |
| Full `npm run test:run` | **Test Files 47 passed (47) / Tests 482 passed (482)** |
| `npm run build` | **pass** |

Exact Playwright commands rerun for closure:

```text
npx playwright test -c playwright.config.ts e2e/learning/ls3_progress_return.spec.ts
→ 6 passed

npx playwright test -c playwright.config.ts e2e/learning/
→ 12 passed

npx playwright test -c playwright.config.ts e2e/learning/ls2_offline_review.spec.ts
→ 5 passed

npx playwright test -c playwright.config.ts e2e/learning/ls1_offline_saved_vocabulary.spec.ts
→ 1 passed

npx playwright test -c playwright.config.ts e2e/navigation/source_result_direct_entry.spec.ts
→ 1 passed
```

---

## 26. Closure evidence matrix

| Group | Guarantee | Implementation owner | Test owner | Level | Status |
| --- | --- | --- | --- | --- | --- |
| Product flow | Save → Saved Vocabulary → Progress → Start/Continue → Reflect → refreshed Progress | main / learning / render | LS3I3/I4 + Playwright | Browser + integration | Pass |
| Product flow | Offline Progress → Continue → persist → reload retains | PWA + IndexedDB + Progress | LS3I4 Playwright | Browser | Pass |
| Derivation | Counts from `SavedVocabularyRowVm[]` | `saved_vocabulary_progress` | LS3I1/LS3I4 | Integration | Pass |
| Derivation | Shared Review eligibility | `isResolvedLexiconReviewEligible` | LS3I1 queue parity | Integration | Pass |
| Derivation | Unavailable orthogonal to status | resolution + Progress | LS3I1/LS3I4 | Integration | Pass |
| Action semantics | Start for new; Continue after reflection | Progress `reviewAction` | browser + LS3I4 | Browser + integration | Pass |
| Action semantics | Hidden empty; disabled when no reviewable | Progress action model | LS3I2/LS3I4 | Browser + integration | Pass |
| Action semantics | Same fresh Review path; no Resume | main navigation | LS3I3 + Playwright | Browser + integration | Pass |
| Return cues | Queue-priority hierarchy; informational only | Progress deriver | unit + browser | Browser + integration | Pass |
| Presentation | `<section>` + `<dl>`; required metrics; no %/mastery | `render_saved_vocabulary` | renderer + Playwright | Browser + integration | Pass |
| Presentation | Unavailable only when > 0 | renderer | renderer + Playwright | Browser + integration | Pass |
| Navigation | One host; double activation suppressed | main / Review host | LS3I3/I4 + Playwright | Browser + integration | Pass |
| Navigation | Back reloads collection; focus one-use | `focusReviewActionOnce` | LS3I3 + Playwright | Browser + integration | Pass |
| Navigation | Stale Saved Vocabulary cannot replace Review | host context/generation | LS3I3/LS3I4 | Integration | Pass |
| Refresh | Fresh rows after Back / remove / reopen | Saved Vocabulary session | browser + integration | Browser + integration | Pass |
| Offline | Progress + Continue + reflection offline | PWA + Learning Records | LS3I4 Playwright | Browser | Pass |
| Reload | Reveal-only ephemeral; reflection durable | Review host + Learning Records | Playwright | Browser | Pass |
| Removal | Counts update; empty hides Progress | session remove | browser + LS3I4 | Browser + integration | Pass |
| Bundle lifecycle | Remove/reinstall/update/isolation | Learning Record identity | LS3I4 | Integration | Pass |
| Database lifecycle | Deletion clears Progress source | `deleteSiralexDb` | LS3I4 | Integration | Pass |
| Isolation | Dictionary/query-log unchanged by Progress path | store boundaries | LS3I4 | Integration | Pass |
| Accessibility | Focus sequence + semantics | renderer/navigation | Playwright | Browser | Pass |
| Localization | EN/FR Progress labels/cues; locale invariance | i18n | i18n + FR smoke + LS3I4 | Browser + integration | Pass |

---

## 27. Repository hygiene

Unrelated featured-anchor work remains uncommitted and was not staged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

This slice stages only:

```text
docs/reports/ls3_progress_return_closure_report.md
```

---

## 28. Deviations

None relative to the LS3 closure instruction.

- ROADMAP was not modified: it has no Learning System / LS3 status index
  (same pattern as LS1/LS2 closure).
- Optional browser gaps remain documented gaps, not contradictions of locked
  requirements.
- Next milestone is `LSN1 — Learning System Post-LS3 Decision`, not automatic
  LS4 scheduling or analytics implementation.

---

## Documentation-only confirmation

This slice changes only documentation (this report). No runtime code, UI, CSS,
i18n, IndexedDB schema, tests, Playwright specifications, fixtures, bundles,
catalog, sources, or packages were modified.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS3_CLOSED` |
| Product outcome | Truthful offline Progress & Return on Saved Vocabulary |
| Next milestone | `LSN1 — Learning System Post-LS3 Decision` |
| Code changes | None |
