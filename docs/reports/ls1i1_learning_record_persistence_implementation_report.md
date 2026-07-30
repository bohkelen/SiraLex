# LS1I1 — Learning Record Persistence Implementation Report

## Decision

```text
LS1_PERSISTENCE_API_IMPLEMENTED
```

Storage and API only. No Save UI, Saved Vocabulary UI, Review, Reflect,
flashcards, progress, morphology, audio, catalog, or bundle changes.

Authoritative plan: `docs/reports/ls1d1_learning_record_implementation_plan.md`.

---

## 1. Database version and schema

| Item | Value |
| --- | --- |
| Prior version | `SIRALEX_DB_VERSION = 3` |
| New version | `SIRALEX_DB_VERSION = 4` |
| Store | `STORE_LEARNING_RECORDS = "learning_records"` |
| keyPath | `["bundle_id", "ir_id"]` |
| Index | `by_bundle_id` (non-unique) on `bundle_id` |
| Upgrade | Additive create-if-missing in `upgradeneeded` |
| Existing data | Preserved; no rewrite of meta/records/search_index/registry/query_logs |
| `deleteBundleData` | Unchanged — does **not** touch Learning Records |
| Full DB delete | Still wipes all stores including Learning Records |

`SiralexObjectStoreName` extended to include `learning_records`.

---

## 2. Types and modules

| File | Role |
| --- | --- |
| `web/src/learning/learning_record_types.ts` | `LearningRecordV1`, save input, validation |
| `web/src/learning/build_display_cache.ts` | Pure lexicon → display_cache helper |
| `web/src/learning/learning_record_store.ts` | save/get/isSaved/list/remove |
| `web/src/learning/learning_record_resolve.ts` | `resolveLearningRecordForUi` |
| `web/src/learning/learning_record_persistence.test.ts` | Unit + fake-indexeddb coverage |

Shape matches `learning_record_v1` from LS1D1 (identity, stamps, status,
display_cache, reserved `last_reviewed` / `review_count`).

---

## 3. APIs

```text
saveLearningRecord(db, input) → LearningRecordV1
getLearningRecord(db, bundleId, irId) → LearningRecordV1 | undefined
isLearningRecordSaved(db, bundleId, irId) → boolean
listLearningRecordsByBundle(db, bundleId) → LearningRecordV1[]  // newest created_at first
removeLearningRecord(db, bundleId, irId) → boolean
resolveLearningRecordForUi(db, learningRecord, activeMeta) → LearningRecordUiResolution
buildDisplayCache(entry) → LearningRecordDisplayCache
```

Save/Remove transactions open **`learning_records` only**.

---

## 4. Idempotency

- Absent → create with `still_learning`, `last_reviewed: null`, `review_count: 0`, ISO `created_at`.
- Present → return existing unchanged (timestamps, status, stamps, cache, review fields preserved).
- Display cache is **not** refreshed on re-save or during resolution.

---

## 5. Resolution

Sequence: no active → `no_active_bundle`; bundle id mismatch → `bundle_mismatch`;
live get via `resolveRecords(db, storage_scope_id, [ir_id])`; lexicon hit →
`resolved`; miss → `entry_missing`; wrong kind → `not_lexicon_entry`.

Live entry returned only when resolved. Cache never promoted to lexical authority.

---

## 6. Tests and validation results

| Suite | Result |
| --- | --- |
| `src/learning/learning_record_persistence.test.ts` | **21 passed** |
| IndexedDB-adjacent (`query_log_store`, `phase3_bundle_runtime`) | **45 passed** |
| Full `npm run test:run` | **27 files / 284 tests passed** |
| `npm run build` (`tsc` + vite) | **Pass** |
| `git diff --check` | Clean (no whitespace errors) |

Coverage includes: v3→v4 upgrade, fresh store/index, valid save, invalid reject,
index_mapping reject, idempotent re-save, get/saved, list scope + ordering,
remove present/absent, dictionary/query-log isolation, `deleteBundleData`
retention, resolution success and all unresolved reasons, no cache refresh on
resolve, display-cache builder.

---

## 7. Deviations from LS1D1

None material.

Notes:

- List tie-break uses `ir_id` localeCompare when `created_at` is equal (still
  deterministic newest-first primary order).
- Learning modules are not yet wired into `main.ts` (intentional for LS1I1).

---

## 8. Next slice

```text
LS1I2 — Implement Entry Save Affordance
```

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS1_PERSISTENCE_API_IMPLEMENTED` |
| DB | v3 → v4 + `learning_records` / `by_bundle_id` |
| UI / catalog / bundle / package changes | None |
