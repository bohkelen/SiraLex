# CF2I2 — Local Search Feedback Store Report

## 1. Decision

```text
CF2_SEARCH_FEEDBACK_STORE_IMPLEMENTED
```

CF2I2 persists validated CF2 search-feedback drafts in IndexedDB with secure ID
generation, deterministic management listing, optimistic concurrency,
bundle-lifecycle retention, and isolation from CF1, Learning, query logs, and
dictionary data.

No UI, search integration, export download, Playwright, Phase 1.5, or PV1 work.

Authoritative inputs:

- `docs/reports/cf2d0_missing_entry_search_failure_feedback_product_definition.md`
- `docs/reports/cf2i1_search_feedback_model_validation_report.md`
- CF1I2 store patterns (local analogues; no CF1 type coupling in store writes)

---

## 2. DB version / migration

```text
SIRALEX_DB_VERSION: 5 → 6
STORE_SEARCH_FAILURE_FEEDBACK = "search_failure_feedback"
keyPath = "feedback_id"
indexes = none
```

Excerpt (`siralex_db.ts`):

```ts
// CF2I2: search-failure feedback (v5 → v6). Additive only — no rewrite of
// dictionary, Learning, query-log, CF1 drafts, catalog, registry, meta, or
// search-index rows. No indexes: key lookup, full list, and count cover CF2.
if (!db.objectStoreNames.contains(STORE_SEARCH_FAILURE_FEEDBACK)) {
  db.createObjectStore(STORE_SEARCH_FAILURE_FEEDBACK, {
    keyPath: "feedback_id",
  });
}
```

Migration invariant: additive only. Existing local state is not reinterpreted.

---

## 3. Store contract

Module: `web/src/search_feedback/search_feedback_store.ts`

API:

```text
createSearchFeedbackDraft
getSearchFeedbackDraft
listSearchFeedbackDrafts
countSearchFeedbackDrafts
updateSearchFeedbackDraft
deleteSearchFeedbackDraft
```

No search-by-query or aggregation APIs.

---

## 4. Create API

Caller supplies search evidence + optional user fields.
Store owns `schema_version`, `feedback_id`, `created_at`, `updated_at`, `status`.

Flow:

```text
build candidate
→ validate (CF2I1)
→ one readwrite transaction
→ add()
→ await transaction completion
→ return cloned draft
```

Result codes: `invalid_input` | `invalid_timestamp` | `id_generation_failed` |
`feedback_id_conflict` | `database_write_failed`.

---

## 5. Secure ID generation

Excerpt:

```ts
if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
  return { ok: true, feedbackId: crypto.randomUUID() };
}
if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
  // RFC 4122 version 4 / variant 1 layout
  ...
}
return { ok: false, code: "id_generation_failed" };
```

No `Math.random()`, timestamp-only, or counter-only IDs.
Injectable `generateFeedbackId` for tests.
Creation uses `add()`; duplicate key → `feedback_id_conflict` (no auto-retry).

---

## 6. Timestamp generation

Create: `created_at = updated_at = now()`.
Invalid generated timestamp → `invalid_timestamp`.
Injectable `now()` for tests. No server time.

---

## 7. Transaction completion semantics

Success requires `IDBTransaction` `complete`, not merely request `success`.

Excerpt boundary:

```ts
await reqToPromise(store.add(toStore));
if (deps?.afterWriteQueued) {
  await deps.afterWriteQueued();
}
await txDone(tx);
return { ok: true, draft: cloneSearchFeedbackDraft(toStore) };
```

Test-only `afterWriteQueued` / `afterDeleteQueued` hooks remain documented and
non-production.

---

## 8. Get

Exact key lookup. Missing → `undefined`.
Stored row validated via CF2I1; corrupt → `SearchFeedbackStoreError("invalid_stored_feedback")`.
Returns defensive clone.

---

## 9. List / order

Management order (distinct from export):

```text
updated_at desc → created_at desc → feedback_id asc
```

All bundles. No active-bundle filter. No pagination.
One corrupt row fails the entire list (no silent omission).

---

## 10. Count

Raw IndexedDB `count()`. Does not deserialize rows.
May succeed even if a row is semantically corrupt.

---

## 11. Update / mutable fields

Editable only:

```text
requested_meaning?
user_description?
```

Omit / `undefined` stores canonical absence (clears prior values).

---

## 12. Search-event immutability

Frozen on create; never accepted by update:

```text
bundle_id
content_sha256
storage_scope_id
query_raw
search_direction
result_state
result_count
matched_ir_ids
schema_version
feedback_id
created_at
status
```

> The saved search event is immutable historical evidence. Only the user's
> explanation of what they wanted may change.

---

## 13. Optimistic concurrency

Requires `expected_updated_at === stored.updated_at`.
Mismatch → `stale_feedback` (no overwrite / merge / last-write-wins).

New `updated_at` must be **strictly greater** than previous; same-clock →
`invalid_timestamp`.

Same-transaction get → validate → compare → candidate → validate → put →
complete:

```ts
const existingRaw = await reqToPromise(store.get(input.feedback_id));
...
if (current.updated_at !== input.expected_updated_at) {
  return await abortAnd({ ok: false, code: "stale_feedback" });
}
...
await reqToPromise(store.put(toStore));
await txDone(tx);
```

---

## 14. Delete

Optional `expectedUpdatedAt` (CF1 pattern; CF2I4 should always supply it).
Missing → `not_found`. Corrupt → `invalid_stored_feedback` (no silent delete).
Stale expected → `stale_feedback`. No tombstones.

---

## 15. Corrupt-row policy

| Op | Behavior |
| --- | --- |
| get | `invalid_stored_feedback` |
| list | entire list fails |
| update | no write; `invalid_stored_feedback` |
| delete | blocked; `invalid_stored_feedback` |
| count | raw count may still succeed |

No silent repair. Full DB delete remains the destructive reset.

---

## 16. Bundle retention

```text
bundle removal → feedback retained
bundle update H1→H2 → H1 provenance retained unchanged
active-bundle switch → retained unchanged
```

Never cascade-delete, rewrite hash/scope, rerun query, mutate `result_state`,
or auto-resolve.

---

## 17. DB deletion

`deleteSiralexDb()` removes the CF2 store with the database.
Reopen creates empty v6 schema; count is 0.

---

## 18. Connection ownership

Store functions operate on a caller-supplied `IDBDatabase` and do not close it.

---

## 19. Defensive cloning

`cloneSearchFeedbackDraft` copies `matched_ir_ids` arrays.
Returned objects do not alias stored/in-memory mutable arrays.

---

## 20. Isolation

CF2 create/update/delete modify only `search_failure_feedback`.
Executable tests prove CF1 drafts, Learning Records, query logs, records,
search_index, and bundle registry counts remain unchanged across CF2 ops.
Migration v6 creates the store without rewriting semantic rows elsewhere.

---

## 21. Tests

Focused:

```text
src/search_feedback/search_feedback_store.test.ts  16 passed
```

Full suite + build:

```text
npm run test:run  →  70 files / 745 tests PASS
npm run build     →  PASS
```

Covered: fresh v6; v5→v6 preservation (CF1/Learning/logs/dictionary/meta);
create paths (no_result, results_not_useful, query-only, Unicode, RNG paths,
conflict, abort, clone); get/list/count + corrupt; update immutability +
concurrency + clear-to-absence; delete; H1 retention across update/removal;
isolation; full DB wipe.

CF2I1 model/package and CF1/Learning persistence regressions updated for
current DB version 6 and passing.

---

## 22. Deviations

| Item | Classification | Note |
| --- | --- | --- |
| Update clears optionals by omission | compatible | Matches CF2I1 absence-canonical form |
| Optional expected timestamp on delete | compatible | Same flexibility as CF1I2 |

No unexplained scope expansion. No search/UI/package/CF1 schema changes.

---

## 23. Repository hygiene

Touched:

```text
web/src/idb/siralex_db.ts
web/src/search_feedback/search_feedback_store.ts
web/src/search_feedback/search_feedback_store.test.ts
web/src/corrections/correction_draft_store.test.ts   // version expectations → 6
web/src/learning/learning_record_persistence.test.ts // version expectations → 6
docs/reports/cf2i2_local_search_feedback_store_report.md
docs/ROADMAP.md
```

Unchanged: CF2I1 schema semantics, package schema, search UI/behavior, query
logging, Learning runtime, CF1 runtime, Phase 1.5, PV1, Playwright.

---

## 24. Next slice

```text
CF2I3 — Search Failure Capture Surface
```

CF2I2 preserves:

> The saved search event is immutable historical evidence. Only the user's
> explanation of what they wanted may change.
