# CF1I2 — Local Correction Draft Store Report

## 1. Decision

```text
CF1_CORRECTION_DRAFT_STORE_IMPLEMENTED
```

Local IndexedDB persistence for validated correction drafts is implemented with
schema upgrade, create/get/list/count/update/delete, stale-edit protection,
bundle-lifecycle retention, and isolation from dictionary, Learning, and
query-log stores. No UI, i18n, CSS, `main.ts`, Playwright, export orchestration,
Phase 1.5 conversion, or corpus mutation was added.

**CF1I2A amendment:** production `draft_id` generation uses only secure randomness
(`crypto.randomUUID` or `crypto.getRandomValues`) and fails closed with
`id_generation_failed` when neither is available. `Math.random()` is never used.

---

## 2. Database version

```ts
SIRALEX_DB_VERSION = 5
```

---

## 3. Upgrade path

v4 → v5 (and fresh opens at v5):

- create only `correction_drafts` when absent;
- preserve meta, records, search index, bundles registry, query logs, Learning
  Records, and all existing row contents;
- no rewrite or migration of existing stores.

---

## 4. Store schema

```ts
export const STORE_CORRECTION_DRAFTS = "correction_drafts";
```

- keyPath: `draft_id`
- no indexes (key lookup, full list, and count cover CF1 needs)

Central constant used from `web/src/idb/siralex_db.ts`.

---

## 5. Creation input

```ts
CreateCorrectionDraftInput
```

Excludes system fields: `schema_version`, `draft_id`, `created_at`,
`updated_at`, `status`. Store constructs the full `correction_draft_v1` row.

---

## 6. ID generation

Production policy (CF1I2A):

1. Prefer `crypto.randomUUID()`.
2. Otherwise construct a UUID-compatible identifier with `crypto.getRandomValues()`.
3. If neither secure API exists, fail closed with `id_generation_failed`.
4. Never use `Math.random()`.
5. Never use timestamp-only identity.

Injectable `generateDraftId` remains available for deterministic tests and bypasses
the production generator.

Create uses `objectStore.add` (not `put`). Duplicate key →
`draft_id_conflict`. No silent overwrite. No retry loop.

`id_generation_failed` performs no IndexedDB transaction or write.

---

## 7. Timestamp generation

Injectable `now` (default `new Date().toISOString()`).

Create: `now()` once; same value for `created_at` and `updated_at`.

Update: `now()` once; must be strictly greater than previous `updated_at`.

---

## 8. Create semantics

```ts
createCorrectionDraft(db, input, deps?)
```

- validate constructed draft before write;
- one readwrite transaction;
- success only after transaction completion;
- clone returned draft;
- no text normalization/repair;
- no user vocabulary in error codes.

---

## 9. Get semantics

```ts
getCorrectionDraft(db, draftId)
```

- bounded draft ID required;
- readonly transaction;
- validate before return;
- clone result;
- missing → `undefined`;
- corrupt → throw `CorrectionDraftStoreError("invalid_stored_draft")`.

---

## 10. List/count semantics

```ts
listCorrectionDrafts(db)
countCorrectionDrafts(db)
```

- all drafts / count (no active-bundle filter);
- list validates every row; any corrupt row blocks the complete list;
- count uses store `count()` without row parsing;
- clones all list values.

---

## 11. Management ordering

```ts
compareCorrectionDraftsForManagement
```

1. `updated_at` descending  
2. `created_at` descending  
3. `draft_id` ascending  

Code-point comparison only. Distinct from CF1I1 export ordering.

---

## 12. Edit input

```ts
UpdateCorrectionDraftInput
```

Includes `expected_updated_at` optimistic token and mutable user fields only.

---

## 13. Immutable fields

Preserved from stored row on update:

```text
schema_version
draft_id
bundle_id
ir_id
ir_kind
content_sha256
storage_scope_id
created_at
status
```

Updated:

```text
issue_type
mode
target
display_snapshot
problem_description
proposed_value?
updated_at
```

---

## 14. Stale-edit policy

Inside one readwrite transaction:

1. read + validate current;
2. compare `expected_updated_at`;
3. mismatch → `stale_draft`;
4. build updated row from immutable current + mutable input;
5. validate;
6. `put`;
7. await completion.

Repeated update with the same token: first succeeds, second `stale_draft`.

---

## 15. Timestamp monotonicity

Require:

```text
new updated_at > previous updated_at
```

Same-timestamp clocks return `invalid_timestamp`. No silent +1 ms mutation.

---

## 16. Delete semantics

```ts
deleteCorrectionDraft(db, draftId, { expectedUpdatedAt? }, deps?)
```

- optional stale token for user flows;
- validate stored row;
- no tombstones;
- repeated delete → `not_found`;
- does not alter dictionary / Learning / query logs / registry / exports.

---

## 17. Corrupt-row policy

| Operation | Behavior |
| --- | --- |
| get | throw `invalid_stored_draft` |
| list | throw `invalid_stored_draft` (blocks complete list) |
| update | `invalid_stored_draft` |
| delete | `invalid_stored_draft` |

No force-delete in CF1I2. Full DB deletion remains the recovery path.

---

## 18. Bundle removal retention

`deleteBundleData` clears dictionary scope data only. Correction drafts remain
unchanged with original provenance.

---

## 19. Bundle update retention

Draft retains original `content_sha256` and `storage_scope_id` after installing
a new hash for the same logical bundle. No rewrite or stored availability flag.

---

## 20. Full database deletion

`deleteSiralexDb()` removes the database including `correction_drafts`. Reopen
at v5 yields an empty correction store. Deletion reminder belongs to CF1I4.

---

## 21. Transaction discipline

One transaction per operation. Write success requires transaction completion,
not request success alone. Caller-owned `IDBDatabase` is never closed by store
functions.

---

## 22. Atomicity

Test-only `afterWriteQueued` / `afterDeleteQueued` hooks force failures after
queued writes. Failed create/update/delete leave no partial correction state
and do not change other stores.

---

## 23. Duplicate activation boundary

- Same `draft_id` cannot overwrite (`add` → conflict).
- Distinct generated IDs create distinct drafts (not semantic dedupe).
- Duplicate UI save activation is a CF1I3 controller responsibility.
- Update: second call with same token → stale.
- Delete: second call → not found.

---

## 24. Database ownership

All APIs accept caller-owned `IDBDatabase` and leave it open.

---

## 25. Storage / query-log / Learning isolation

Only `correction_drafts` count changes during create/update/delete. Snapshot
tests cover meta, records, search index, registry, query logs, and Learning
Records.

---

## 26. Tests

Focused store + CF1I1 + Learning persistence:

```text
npx vitest run \
  src/corrections/correction_draft_store.test.ts \
  src/corrections/correction_draft_types.test.ts \
  src/corrections/correction_feedback_package.test.ts \
  src/learning/learning_record_persistence.test.ts
→ Test Files  4 passed (4)
→ Tests  88 passed (88)
```

Full suite:

```text
npm run test:run
→ Test Files  57 passed (57)
→ Tests  634 passed (634)
```


Build:

```text
npm run build
→ tsc + vite build succeeded
```

---

## 27. Deviations

- No force-delete for corrupt rows (explicit CF1I2 limitation).
- Delete `expectedUpdatedAt` is optional for internal cleanup; user flows should
  pass it.
- Learning persistence tests updated for DB v5 version assertions only
  (additive schema change), without Learning behavior changes.
- No deviations from CF1D0 immutable provenance / retention locks.
- **CF1I2A:** removed the non-cryptographic `Math.random()` ID fallback that
  incorrectly claimed collision resistance; production ID generation now fails
  closed when secure randomness is unavailable.

---

## 28. Repository hygiene

Changed:

- `web/src/idb/siralex_db.ts`
- `web/src/corrections/correction_draft_store.ts`
- `web/src/corrections/correction_draft_store.test.ts`
- `web/src/learning/learning_record_persistence.test.ts` (v5 version asserts)
- `docs/reports/cf1i2_local_correction_draft_store_report.md`
- narrow `docs/ROADMAP.md`

No UI / i18n / CSS / `main.ts` / Playwright / corpus / Phase 1.5 / PV1 / LS4
behavior changes.

Roadmap status:

```text
CF1I1 — Implemented
CF1I1A — Complete
CF1I2 — Local Correction Draft Store — Implemented
CF1I2A — Correction Draft ID Generation Boundary — Complete
CF1I3 — Entry Suggestion Surface — Next
PV1A — Parallel active
PV1B — Hardware-gated
```
