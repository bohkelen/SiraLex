# LS2 — Review and Reflect Closure Report

## 1. Decision

```text
LS2_CLOSED
```

LS2 is a completed product milestone. Executable evidence supports the locked
Review and Reflect loop, including offline persistence. This closure slice is
documentation-only.

Authoritative chain:

- `docs/reports/ls2_review_and_reflect_product_definition.md`
- `docs/reports/ls2i1_atomic_reflection_persistence_report.md`
- `docs/reports/ls2i2_review_queue_session_model_report.md`
- `docs/reports/ls2i3_review_surface_report.md`
- `docs/reports/ls2i4_saved_vocabulary_integration_report.md`
- `docs/reports/ls2i5_offline_lifecycle_verification_report.md`
- `docs/reports/ls1_learning_system_closure_report.md`

---

## 2. Completed product capability

The user can start Review from Saved Vocabulary, recall one live Maninka
lexicon entry at a time, reveal its meaning, record Still learning or
Remembered, persist that reflection immediately offline, complete a
deterministic session, and see the resulting status in the collection.

---

## 3. Final user loop

```text
Search
  → Open genuine Maninka lexicon entry
  → Save
  → Open Saved Vocabulary
  → Start Review
  → Recall
  → Reveal
  → Reflect
  → Continue
  → Complete
  → Return to Saved Vocabulary
```

Offline loop:

```text
Installed dictionary
  → Saved Vocabulary
  → Review offline
  → Persist reflection locally
  → Reload offline
  → Reflection remains
```

Clarifications:

- Review acts on existing Learning Records.
- Review does not create a second learning identity.
- Source queries, index mappings, and translation pairs are not reviewed.
- Review uses live lexicon entries only.
- Unresolved Learning Records remain stored but are excluded from Review.

---

## 4. Success-criteria matrix

| Capability | Implementation | Evidence | Status |
| --- | --- | --- | --- |
| Start Review from Saved Vocabulary | Saved Vocabulary integration | LS2I4 tests + Playwright | Pass |
| No top-level Review entry | application chrome | LS2I4/LS2I5 tests | Pass |
| Active-bundle resolved-only queue | `buildReviewQueue` | queue + lifecycle tests | Pass |
| Deterministic ordering | comparator/group rules | queue-order tests | Pass |
| One-item Review surface | renderer/session host | LS2I3 tests + Playwright | Pass |
| Meaning hidden before Reveal | Review renderer | renderer + Playwright | Pass |
| Reveal performs no persistence | session model | session tests | Pass |
| Still learning persists | atomic reflection API | LS2I1 + Playwright | Pass |
| Remembered persists | atomic reflection API | LS2I1 + Playwright | Pass |
| Same-status increments | reflection API | LS2I1/LS2I5 tests | Pass |
| Remembered → Still learning | transition model | LS2I5 integration | Pass |
| Immediate persistence | reflect-before-advance | Playwright | Pass |
| Reflection failure retains card | session/renderer | integration tests | Pass |
| Duplicate reflection suppressed | busy session state | session/lifecycle tests | Pass |
| Duplicate Start Review suppressed | active host guard | Playwright + integration | Pass |
| Ephemeral Review session | non-persisted session | Playwright reload test | Pass |
| Offline Review | PWA + IndexedDB | Playwright offline | Pass |
| Offline reload persistence | IndexedDB Learning Record | Playwright offline reload | Pass |
| Unresolved excluded and retained | resolution model | lifecycle tests | Pass |
| Bundle removal preserves learning | non-cascading records | lifecycle tests | Pass |
| Reinstall restores resolution/status | logical bundle identity | lifecycle tests | Pass |
| Bundle update preserves identity/status | `(bundle_id, ir_id)` | lifecycle tests | Pass |
| Active-bundle isolation | queue and collection scoping | lifecycle tests | Pass |
| Database deletion removes learning | DB lifecycle | lifecycle tests | Pass |
| Dictionary isolation | separate stores | isolation tests | Pass |
| Query-log isolation | Review does not log queries | lifecycle tests | Pass |
| Accessibility focus sequence | renderer/host | Playwright | Pass |
| EN/FR parity | i18n | tests + browser smoke | Pass |

No row is marked Pass from documentation alone.

---

## 5. Learning Record semantics

Identity:

```text
(bundle_id, ir_id)
```

Activated LS2 fields:

```text
status
last_reviewed
review_count
```

Field semantics:

- `status` is the latest user reflection.
- `last_reviewed` changes only after successful reflection.
- `review_count` increments once for every successful reflection.
- Same-status reflection counts.
- Remembered is reversible.
- `remembered` does not mean mastered.

### Never reviewed

```text
review_count === 0
last_reviewed === null
```

The stored status may still be `still_learning`. That does not mean a review
occurred.

### Reviewed Still learning

```text
review_count > 0
last_reviewed !== null
status === "still_learning"
```

### Reviewed Remembered

```text
review_count > 0
last_reviewed !== null
status === "remembered"
```

### Inconsistent state

Examples: `review_count === 0` with non-null `last_reviewed`, or
`review_count > 0` with null `last_reviewed`.

Behavior: treat as malformed/unknown; do not repair automatically; exclude from
Review when validation requires; do not infer from `status` alone.

---

## 6. Atomic reflection architecture

API:

```text
reflectOnLearningRecord(...)
```

Properties:

- one `learning_records` read-write transaction;
- persisted row is source of truth;
- exact increment semantics;
- missing record is not recreated;
- Save-time identity, stamps, cache, and `created_at` remain unchanged;
- no active-bundle lookup required at persistence layer.

---

## 7. Queue architecture

Properties:

- active logical bundle only;
- live resolved lexicon entries only;
- no display-cache cards;
- unresolved records counted but excluded;
- deterministic ordering:

  1. never reviewed;
  2. reviewed Still learning;
  3. reviewed Remembered;
- oldest first within groups;
- stable identity tie-break;
- no randomization;
- no scheduling.

Owner: `buildReviewQueue` / comparator helpers (`web/src/learning/review_queue.ts`).

---

## 8. Session architecture

Properties:

- ephemeral queue snapshot;
- one active item;
- Reveal state local to session;
- reflection persists immediately;
- advance only after successful persistence;
- missing current record becomes skipped;
- ordinary write failure remains retryable;
- stale UI updates are dropped;
- committed personal state is not rolled back after navigation.

Owner: review session + `createReviewSurfaceHost`.

---

## 9. Review surface

Properties:

- one-card Review surface;
- live headword/N’Ko/POS before Reveal;
- meanings and lexical support after Reveal;
- reflection controls only after Reveal;
- completion counts;
- no score, mastery, streak, percentage, or animation.

Owner: `render_review` / review display helpers.

---

## 10. Saved Vocabulary integration

Properties:

- Saved Vocabulary is the canonical Review entry point;
- Start Review enabled only with at least one resolved row;
- rows show Not reviewed / Still learning / Remembered;
- last-reviewed date shown only for reviewed records;
- no review-count display;
- returning from Review reloads persisted Learning Records;
- temporary top-level `#startReview` chrome button is absent.

Owner: `saved_vocabulary_session`, `render_saved_vocabulary`, `main.ts` host wiring.

---

## 11. Navigation and stale-async model

Properties:

- explicit host contexts;
- no router;
- no search rerun for Review/collection navigation;
- Back restores Saved Vocabulary;
- one-use Start Review focus restoration;
- bundle switch / search / database lifecycle invalidates stale Review surfaces;
- only one active Review host (`activeReviewHost?.isActive()` guard).

---

## 12. Offline guarantees

Verified:

- application shell works offline after installation;
- installed dictionary remains available offline;
- Saved Vocabulary loads offline;
- Review queue loads offline;
- reflection persists offline;
- offline reload preserves completed reflections;
- Reveal-only state disappears on reload;
- completed reflections survive reload before session completion.

Method: Playwright `context.setOffline(true)` (not `navigator.onLine` spoofing).

---

## 13. Bundle/database lifecycle

Verified:

- Learning Records survive dictionary removal;
- compatible reinstall restores resolution and prior reflection fields;
- same logical bundle updates preserve identity and reflection fields;
- removed `ir_id` becomes unresolved and leaves Review eligibility;
- active-bundle switching isolates collections and queues;
- full database deletion removes learning history;
- no cascade deletion of Learning Records on bundle data removal;
- no automatic restoration of personal learning state after DB deletion.

---

## 14. Storage and query-log isolation

Successful reflection may change only:

```text
learning_records.status
learning_records.last_reviewed
learning_records.review_count
```

Unchanged by reflection / queue load / Reveal:

- dictionary `records`;
- `search_index`;
- bundle registry;
- active-bundle metadata;
- query logs;
- Learning Record identity;
- `created_at`;
- content stamps;
- `display_cache`.

Review does not append query logs for headwords viewed, Reveal, reflection, or
completion.

---

## 15. Accessibility and localization

Recorded:

- keyboard-reachable Start Review;
- semantic Review / card / completion headings;
- real buttons;
- meaning hidden before Reveal;
- reflection controls after Reveal;
- busy state and disabled duplicate actions;
- error announcement;
- focus moves: Review card → revealed meaning → next card → completion →
  Start Review after Back;
- text-only status;
- no colour-only meaning;
- EN/FR key parity;
- browser French smoke completed (`Commencer la révision`, `Pas encore révisé`,
  `Révéler le sens`, `Encore en apprentissage`, `Mémorisé`).

---

## 16. Locked invariants

1. LS2 extends the existing Learning Record.
2. Learning Record identity remains `(bundle_id, ir_id)`.
3. Only genuine `lexicon_entry` records are reviewable.
4. Source queries, index mappings, and translation pairs are not Review objects.
5. Live dictionary data remains lexical authority.
6. Display cache is never used as a Review card.
7. Unresolved Learning Records remain stored but are excluded from Review.
8. Reflection changes only `status`, `last_reviewed`, and `review_count`.
9. Dictionary data, search index, registry, query logs, identity, stamps, cache, and `created_at` remain unchanged by reflection.
10. Each successful reflection increments exactly once.
11. Failed reflection does not advance.
12. Same-status reflection is valid.
13. Remembered may return to Still learning.
14. Never-reviewed remains a derived state.
15. Queue remains deterministic and active-bundle scoped.
16. Review sessions remain ephemeral.
17. Reveal does not count as Review.
18. Review does not append query logs.
19. Bundle removal does not cascade-delete Learning Records.
20. Full database deletion removes Learning Records.
21. No cross-bundle resolution.
22. Saved Vocabulary remains the canonical Review entry point.
23. Normal dictionary entry detail does not host Reflect controls.
24. Stale presentation updates must not overwrite newer surfaces.
25. LS3 or future scheduling work must not silently reinterpret LS2 fields as objective mastery.

---

## 17. Known limitations

Explicit scope boundaries (not LS2 defects):

- active-bundle Review only;
- device-local learning;
- ephemeral session does not resume after reload;
- unresolved records cannot be reviewed;
- no global all-bundle collection;
- no browser-level soft-orphan lifecycle test;
- no browser-injected persistence-failure test;
- same-status, reversal, bundle lifecycle, bundle switching, and DB deletion are
  integration-tested rather than duplicated in Playwright;
- no review-count display;
- no session history;
- no review-event history;
- no export/import;
- no cloud sync;
- no reminders;
- no teacher mode;
- no morphology;
- no pronunciation/audio;
- no source-language learning objects;
- no translation-pair learning objects.

---

## 18. Remaining browser verification gaps

1. Soft-orphan / unresolved full Playwright flow — no clean production
   bundle-mutation seam (same constraint as LS1).
2. Browser-injected reflection persistence failure — no production-safe test
   hook; host/integration evidence retained.
3. Same-status, Remembered reversal, bundle remove/reinstall/update,
   active-bundle switching, and DB deletion — integration-only by design to keep
   the product Playwright flow focused.

None contradict locked LS2 requirements.

---

## 19. Deferred future systems

Recorded without selecting or implementing them.

### LS3 candidate — Review Scheduling

Potential question: Should SiraLex decide which saved entries are due for review
and when?

Would require a separate product decision for due-state semantics, scheduling
data, review-event history, interval calculation, clock behavior, migration,
user control, and offline scheduling.

Do not assume spaced repetition is the next milestone.

### Learning History

A future immutable Review Event may become necessary for historical reflection
timeline, analytics, scheduling reconstruction, sync conflict resolution, or
auditability. Do not retrofit LS2 records silently.

### Source-language learning object

A source-language word may become independently saveable only with a genuine
source lexicon entry.

### Translation relationship object

A bilingual pair may become a distinct learning object only after an explicit
architecture decision.

### Sync

Cloud or multi-device synchronization requires separate identity, merge,
deletion, privacy, and conflict policies.

---

## 20. Next-phase decision boundary

Do not automatically declare LS3 implementation as next.

Next milestone:

```text
Learning System Next-Phase Decision
```

Recommended label:

```text
LSN0 — Learning System Next-Phase Decision
```

Product question:

> What is the highest-value next learning capability after durable Save and
> Review: scheduling, learning history, richer lexical support, source-language
> learning objects, translation relationships, or another user-validated need?

The next slice should be a decision/research slice, not implementation. It
should evaluate user value, evidence, data-model consequences, offline
complexity, migration cost, whether LS2 usage data exists, whether scheduling is
justified, and whether lexical-content gaps matter more than scheduling.

This slice does not create the detailed LSN0 instruction.

Canonical closure status:

```text
LS2 — Closed
Learning System Next-Phase Decision — Next
```

`docs/ROADMAP.md` has no Learning System / LS2 status index requiring update.
Canonical status lives in this report (same pattern as LS1 closure).

---

## 21. Final executable baseline

Rerun for this closure (not copied from LS2I5):

| Command | Result |
| --- | --- |
| LS2I1 reflection (`learning_record_reflection.test.ts`) | 14 passed (in focused LS2 vitest) |
| LS2I2 queue/session | 9 + 11 passed |
| LS2I3 renderer/host | 16 + 6 passed |
| LS2I4 Saved Vocabulary integration + related | 3 + 13 + 10 passed |
| LS2I5 lifecycle | **13 passed** |
| Focused LS2 vitest (I1–I5 owners, 9 files) | **95 passed** |
| Focused LS2 Playwright (`ls2_offline_review.spec.ts`) | **5 passed** |
| All learning Playwright (`e2e/learning/`) | **6 passed** |
| LS1 offline Playwright | **1 passed** |
| Direct-entry navigation Playwright | **1 passed** |
| Full `npm run test:run` | **Test Files 44 passed (44) / Tests 441 passed (441)** |
| `npm run build` | **pass** |

---

## 22. Closure evidence matrix

| Group | Guarantee | Implementation owner | Test owner | Level | Status |
| --- | --- | --- | --- | --- | --- |
| Product flow | Save → Saved Vocabulary → Review → Reflect → Complete | main / learning / render | LS2I4 + Playwright | Browser + integration | Pass |
| Product flow | No top-level `#startReview` | main chrome | LS2I4/LS2I5 | Browser + integration | Pass |
| Persistence | Atomic Still learning / Remembered | `reflectOnLearningRecord` | LS2I1 + Playwright | Browser + integration | Pass |
| Persistence | Same-status increment | reflection API | LS2I1/LS2I5 | Integration | Pass |
| Persistence | Remembered → Still learning | reflection API | LS2I5 | Integration | Pass |
| Persistence | Immediate durability before session end | session host | Playwright | Browser | Pass |
| Persistence | Failure retains card; retry once | session/renderer | LS2I5 | Integration | Pass |
| Queue | Active-bundle resolved-only | `buildReviewQueue` | LS2I2/LS2I5 | Integration | Pass |
| Queue | Deterministic group order | comparator | LS2I2/LS2I5 | Integration | Pass |
| Session | Ephemeral; Reveal local; advance after write | review session/host | LS2I3 + Playwright | Browser + integration | Pass |
| Session | Duplicate Start Review suppressed | active host guard | LS2I5 + Playwright | Browser + integration | Pass |
| Session | Duplicate reflect suppressed | busy state | LS2I3/LS2I5 | Integration | Pass |
| Presentation | Meaning hidden before Reveal | `render_review` | LS2I3 + Playwright | Browser + integration | Pass |
| Presentation | One card; completion counts; no score UI | renderer | LS2I3 + Playwright | Browser + integration | Pass |
| Collection | Start Review from Saved Vocabulary | render/session | LS2I4 + Playwright | Browser + integration | Pass |
| Collection | Status + last-reviewed; no count UI | row model | LS2I4 + Playwright | Browser + integration | Pass |
| Offline | Review + reflection + reload | PWA + IndexedDB | LS2I5 Playwright | Browser | Pass |
| Offline | Reveal-only discarded on reload | ephemeral session | Playwright | Browser | Pass |
| Lifecycle | Unresolved excluded/retained | resolution model | LS2I5 | Integration | Pass |
| Lifecycle | Bundle remove/reinstall/update | Learning Record identity | LS2I5 | Integration | Pass |
| Lifecycle | Active-bundle isolation | queue/collection scope | LS2I5 | Integration | Pass |
| Lifecycle | DB deletion removes learning | `deleteSiralexDb` | LS2I5 | Integration | Pass |
| Isolation | Dictionary stores unchanged by Review | separate stores | LS2I5 | Integration | Pass |
| Isolation | Query logs unchanged by Review | no Review logging | LS2I5 | Integration | Pass |
| Accessibility | Focus sequence + semantics | renderer/host | Playwright | Browser | Pass |
| Localization | EN/FR parity + FR smoke | i18n | tests + Playwright | Browser + integration | Pass |

---

## 23. Repository hygiene

Unrelated featured-anchor work remains uncommitted and was not staged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

This slice stages only:

```text
docs/reports/ls2_review_and_reflect_closure_report.md
```

---

## 24. Deviations

None relative to the LS2 closure instruction.

- ROADMAP was not modified: it has no Learning System / LS2 status index
  (same pattern as LS1 closure).
- Browser soft-orphan and browser failure-injection remain documented gaps,
  not contradictions of locked requirements.
- Next milestone is `LSN0 — Learning System Next-Phase Decision`, not automatic
  LS3 scheduling implementation.

---

## Documentation-only confirmation

This slice changes only documentation (this report). No runtime code, UI,
IndexedDB schema, tests, Playwright specifications, fixtures, bundles,
catalog, sources, or packages were modified.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS2_CLOSED` |
| Product outcome | Deterministic offline Review and Reflect on saved Maninka lexicon entries |
| Next milestone | `LSN0 — Learning System Next-Phase Decision` |
| Code changes | None |
