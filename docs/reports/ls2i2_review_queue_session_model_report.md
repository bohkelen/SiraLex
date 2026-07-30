# LS2I2 — Review Queue and Session Model Report

## Decision

```text
LS2_REVIEW_QUEUE_SESSION_IMPLEMENTED
```

Headless active-bundle review queue construction and an ephemeral Reveal-before-Reflect
session model are implemented. Reflection advances only after durable LS2I1 persistence.
No Review UI, navigation wiring, i18n, CSS, or Playwright coverage.

---

## 1. Queue-build API

```ts
buildReviewQueue(
  db: IDBDatabase,
  activeMeta: ActiveBundleMeta | undefined,
): Promise<ReviewQueueBuildResult>
```

Also exported:

- `compareReviewQueueItems` / `compareLearningRecordsForReview`
- `hasLearningRecordBeenReviewed` / `isNeverReviewed` / `hasConsistentReviewFields`

File: `web/src/learning/review_queue.ts`

---

## 2. Queue item and result models

```ts
export type ReviewQueueItem = {
  identity: { bundle_id: string; ir_id: string };
  learningRecord: LearningRecordV1;
  liveEntry: EnrichedRecord; // ir_kind === "lexicon_entry"
};

export type ReviewQueueBuildResult =
  | { state: "ready"; bundle_id; items; unresolved_count; total_saved_count }
  | { state: "empty"; bundle_id; unresolved_count; total_saved_count;
      reason: "no_saved_records" | "no_resolved_records" }
  | { state: "unavailable"; reason: "no_active_bundle" };
```

List/DB failures propagate as thrown errors (not translated to empty).

---

## 3. Eligibility

1. Require active bundle metadata.
2. `listLearningRecordsByBundle(db, active logical bundle_id)`.
3. Validate each row; malformed rows excluded and counted unresolved.
4. Inconsistent review fields excluded (not repaired).
5. Resolve via `resolveLearningRecordForUi` against active metadata only.
6. Include only successful live `lexicon_entry` resolutions.
7. Identity of live entry must match Learning Record `ir_id`.
8. Display cache is never used as a card.
9. No writes during queue construction.
10. Per-record resolution miss/exception → unresolved for that item only.

---

## 4. Exact ordering

Groups:

| Rank | Group |
|------|--------|
| 0 | never reviewed |
| 1 | reviewed `still_learning` |
| 2 | reviewed `remembered` |

Within never-reviewed: oldest `created_at`, then `bundle_id`, then `ir_id`.

Within reviewed groups: oldest `last_reviewed`, then `bundle_id`, then `ir_id`.

No randomization, store-order dependence, frequency, ranking, or locale headword order.

---

## 5. Never-reviewed derivation

```ts
hasLearningRecordBeenReviewed(record) =
  record.review_count > 0 && record.last_reviewed !== null

isNeverReviewed(record) = !hasLearningRecordBeenReviewed(record)
```

Not derived from `status`. A newly saved `still_learning` with `review_count === 0`
and `last_reviewed === null` is never reviewed.

Inconsistent pairs (`count === 0` with non-null `last_reviewed`, or `count > 0` with
null `last_reviewed`) fail `hasConsistentReviewFields` and are excluded as unresolved.

---

## 6. Unresolved handling

Unresolved Learning Records remain stored unchanged. They do not enter the queue.
`unresolved_count` / `unresolved_at_start_count` account for them separately from
reviewed/skipped session totals.

---

## 7. Session API

```ts
createReviewSession({
  getActiveMeta, openDb, isCurrent, onUpdate, now?, buildQueue?, reflect?
}): ReviewSessionController

// load / reveal / reflect / dispose / getState
```

Models: `loading` | `unavailable` | `empty` | `reviewing` | `complete` | `error`.

File: `web/src/learning/review_session.ts`

---

## 8. Session snapshot behavior

On successful load, ordered identities and resolved live entries are copied into an
in-memory snapshot. Records saved after load do not join. Queue is not rebuilt after
each reflection. Session state is not persisted to IndexedDB.

---

## 9. Reveal behavior

Only while reviewing, not busy, and not already revealed. Sets `revealed: true`,
emits one model, no persistence, counts unchanged. Duplicate Reveal is a no-op.
Does nothing after complete/dispose.

---

## 10. Reflect behavior

Requires current revealed item, not busy, session current. Premature calls do not
persist, advance, or change counts.

Valid path: busy emit → `reflectOnLearningRecord` → on success update snapshot record,
increment `completed_count` and exactly one outcome count, advance, reset revealed,
emit next reviewing or complete.

---

## 11. Missing-record skip

`LearningRecordNotFoundError` → increment `skipped_count`, do not count as reviewed,
advance, do not recreate the record, do not fail the whole session.

---

## 12. Retry behavior

Non-not-found persistence errors: stay on current item, `busy: false`,
`error: "reflection_failed"`, remain revealed. Retry allowed; successful retry
increments once. Alternate outcome on retry is allowed.

---

## 13. Completion accounting

```text
reviewed_count = still_learning_count + remembered_count
```

`skipped_count` is separate. `unresolved_at_start_count` is separate and never merged
into reviewed totals. No mastery percentages.

---

## 14. Stale-async protection

Generation + `dispose` + `isCurrent()` guard load, resolution path completion,
reflection success/failure, skip, and complete emissions.

> Persistence may complete, but stale presentation updates are dropped.

No rollback of a committed reflection solely because the user navigated away.

---

## 15. Database connection ownership

Open-per-operation via injected `openDb()`. The controller does **not** close the
connection (host owns shared application DB lifecycle), matching entry /
saved-vocabulary sessions. No transactions held across Reveal/user interaction.
Each reflection uses the LS2I1 transaction. Queue construction performs no Learning writes.

---

## 16. Validation / malformed-row behavior

Uses `validateLearningRecordForWrite` where available. Malformed or inconsistent rows
are excluded as unresolved without repairing and without crashing the whole queue.
No schema migration.

---

## 17. Storage isolation

Queue/session operations do not mutate dictionary records, search index, bundle
registry, query logs, active metadata, display cache, or Save-time stamps.

Only successful reflection may change `status`, `last_reviewed`, and `review_count`.

---

## 18. Tests

- `web/src/learning/review_queue.test.ts` — eligibility, ordering, unresolved,
  display-cache isolation, no writes, malformed rows, cross-bundle exclusion.
- `web/src/learning/review_session.test.ts` — load/reveal/reflect/complete, snapshot,
  premature reflect, duplicate busy suppression, retry, skip, stale load/reflect,
  dispose, empty/unavailable surfaces.

---

## 19. Deviations

None material. Session uses controlled internal mutation of one snapshot object
(immutable item copies at load); public models are freshly emitted. Optional test
seams `buildQueue` / `reflect` match existing learning-session DI patterns.

Duplicate identity rows in storage: first validated occurrence kept; extras counted
toward unresolved rather than crashing.

---

## 20. Repository hygiene

Unrelated featured-anchor work left uncommitted and unstaged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

LS2I2 commit stages only:

- `web/src/learning/review_queue.ts`
- `web/src/learning/review_queue.test.ts`
- `web/src/learning/review_session.ts`
- `web/src/learning/review_session.test.ts`
- `docs/reports/ls2i2_review_queue_session_model_report.md`
