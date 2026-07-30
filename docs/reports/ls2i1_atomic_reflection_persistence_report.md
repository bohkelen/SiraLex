# LS2I1 — Atomic Reflection Persistence Report

## Decision

```text
LS2_ATOMIC_REFLECTION_PERSISTENCE_IMPLEMENTED
```

LS2 reflection outcomes (`still_learning` / `remembered`) now persist atomically on
existing Learning Records. No Review UI, queue, session, navigation, or product
expansion.

---

## 1. API name and signature

```ts
reflectOnLearningRecord(
  db: IDBDatabase,
  bundleId: string,
  irId: string,
  outcome: LearningReflectionOutcome,
  reviewedAt?: string,
): Promise<LearningRecordV1>
```

Types:

```ts
export type LearningReflectionOutcome = LearningRecordStatus;
// "still_learning" | "remembered"

export class LearningRecordNotFoundError extends Error
```

Files:

- `web/src/learning/learning_record_store.ts`
- `web/src/learning/learning_record_types.ts`
- `web/src/learning/learning_record_reflection.test.ts`

---

## 2. Transaction structure

Single `readwrite` transaction on `learning_records` only:

1. `get([bundleId, irId])`
2. validate current row
3. build updated row from persisted value
4. `put(updated)`
5. await transaction complete

No readonly preflight transaction. No dictionary or query-log store access.

---

## 3. Validation

Rejects before/without write:

- empty `bundleId` / `irId`
- unsupported `outcome`
- invalid `reviewedAt` (must pass `isValidIsoTimestamp`)
- missing record → `LearningRecordNotFoundError` (no create)
- malformed stored record (`validateLearningRecordForWrite`)
- stored identity mismatch vs requested key
- non-safe / negative `review_count`
- `review_count >= Number.MAX_SAFE_INTEGER` (increment would overflow)

`review_count` write validation also requires `Number.isSafeInteger`.

---

## 4. Missing-record behavior

Throws `LearningRecordNotFoundError`. Does not create a Learning Record. Does not
infer Save. Learning store row count remains unchanged.

---

## 5. Immutable fields

Updated object is `{ ...existing, status, last_reviewed, review_count }` only.

Preserved unchanged:

- `schema_version`
- `bundle_id`
- `ir_id`
- `ir_kind`
- `content_sha256`
- `storage_scope_id`
- `created_at`
- `display_cache`

No `buildDisplayCache` call. No stamp rewrite.

---

## 6. Transition semantics

All required transitions covered by tests:

| From | Outcome | Count |
| --- | --- | --- |
| never-reviewed `still_learning` | `still_learning` | +1 |
| never-reviewed `still_learning` | `remembered` | +1 |
| reviewed `still_learning` | `still_learning` | +1 |
| reviewed `still_learning` | `remembered` | +1 |
| reviewed `remembered` | `remembered` | +1 |
| reviewed `remembered` | `still_learning` | +1 |

Same-status reflections are not optimized away.

---

## 7. Concurrent-update behavior

IndexedDB serializes `readwrite` transactions on `learning_records`.

`Promise.all` of two successful `reflectOnLearningRecord` calls starting from
`review_count = 2` yields final `review_count = 4`. Each call is a completed
reflection; the store does not merge or dedupe application-level calls.

---

## 8. Timestamp behavior

- Optional `reviewedAt`; default `new Date().toISOString()` once per call.
- Exact accepted value is persisted to `last_reviewed`.
- Format validated; chronology not enforced (device clocks may skew).

---

## 9. Failure atomicity

Invalid outcome/timestamp/identity, missing record, malformed stored row, unsafe
counts, and overflow boundary leave the prior stored value unchanged (verified by
re-read after rejection).

No optimistic increment outside the transaction.

---

## 10. Count bounds

Before increment:

```ts
Number.isSafeInteger(review_count)
review_count >= 0
review_count < Number.MAX_SAFE_INTEGER
```

Overflow / unsafe values reject without wrap or clamp.

---

## 11. Storage isolation

Reflection does not change counts for:

- `records`
- `search_index`
- `bundles_registry`
- `query_logs`

Active-bundle metadata unchanged. Works with no active bundle (identity-only
personal update). Offline = IndexedDB only; no network API.

---

## 12. Tests

`learning_record_reflection.test.ts`:

- six core transitions + immutable field checks
- reopen persistence
- concurrent double-increment
- sequential same-status double call
- missing record
- invalid outcome/timestamp/empty ids
- malformed / negative / fractional / unsafe / overflow counts
- dictionary/search/registry/log/meta isolation
- no-active-bundle reflection

---

## 13. Validation results

| Check | Result |
| --- | --- |
| Focused LS2I1 reflection tests | **14 passed** |
| LS1 persistence + lifecycle + SV + entry Save focused | **66 passed** (5 files) |
| Full `npm run test:run` | **38 files / 369 tests passed** |
| `npm run build` | **Pass** |

---

## 14. Deviations

None material.

`validateLearningRecordForWrite` now also requires `review_count` to be a safe
integer (strengthening, not weakening).

---

## 15. Repository hygiene and unrelated-work isolation

At slice start, unrelated featured-anchor work was present and left untouched:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

LS2I1 commit stages only reflection persistence files and this report.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS2_ATOMIC_REFLECTION_PERSISTENCE_IMPLEMENTED` |
| API | `reflectOnLearningRecord` |
| Next slice | `LS2I2 — Review Queue and Session Model` |
