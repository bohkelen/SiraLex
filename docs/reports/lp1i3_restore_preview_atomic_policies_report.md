# LP1I3 — Restore Preview and Atomic Policies Report

## 1. Decision

```text
LP1_RESTORE_ENGINE_IMPLEMENTED
```

Non-UI restore engine provides verified-package preview, Add missing, and Replace
all with atomic `learning_records` transactions, storage isolation, and rollback
on failure. No file I/O, UI, i18n, CSS, `main.ts`, Playwright, or schema change.

---

## 2. Verified-package boundary

`parseLearningBackupJson` seals a `VerifiedLearningBackupPackage` via module
`WeakMap` provenance (same pattern as verified bundle install).

- Trust is the WeakMap token, not a public boolean.
- Package surface is deep-frozen.
- Preview/commit reject arbitrary plain `{ package }` objects.
- Success parse result includes both `package` and `verified`.

---

## 3. Restore architecture

```text
verified package
  → analyzeLearningBackupRestore (readonly learning + registry)
  → restoreLearningBackupAddMissing | restoreLearningBackupReplaceAll
       (one learning_records readwrite transaction)
  → commitLearningBackupRestore (caller-owned openDb adapter)
```

Module: `web/src/learning/learning_backup_restore.ts`

---

## 4. Preview model

Extended `LearningBackupRestorePreview`:

- `local_validation`: `valid` | `invalid` (+ count)
- `add_missing`: `available` counts | `unavailable` (`invalid_local_records`)
- `replace_all`: previous/restored counts
- sorted `bundle_compatibility`

Invalid local state does **not** hide Replace all recovery; Add missing is marked
unavailable.

---

## 5. Local validation policy

Preview and Add missing validate every local row with
`validateLearningRecordForWrite` + `hasConsistentReviewFields`.

- Add missing **blocks** on invalid/duplicate local state.
- Replace all **may proceed** as recovery (clears then restores valid package).
- Preview remains constructible when local state is invalid.

---

## 6. Add-missing semantics

Identity `(bundle_id, ir_id)`:

- absent → insert exact backup record (`add`)
- present (identical or conflicting) → skip
- local-only identities retained
- `unchanged_count` = local row count before restore (retained afterward)

Never overwrites. Never rewrites stamps/timestamps/cache.

---

## 7. Replace-all semantics

One transaction: count → clear → `add` every backup record.

Final store equals exact backup identity and field set. Local-only rows removed.
Package order does not affect store semantics.

---

## 8. Conflict handling

No merge, backup-wins, timestamp preference, or field reconciliation.
Existing identities always skip under Add missing.

---

## 9. Bundle compatibility

From installed registry metadata only:

- `installed_matching` — expected hash ∈ summary hashes
- `installed_hash_mismatch` — installed but hash not in summary
- `not_installed` — no registry entry

Mismatch/missing does not block preview or commit. No per-`ir_id` resolution.

---

## 10. Preview determinism

Same verified package + Learning snapshot + registry snapshot → identical preview.
Compatibility rows sorted by `bundle_id` with code-point ordering. No clock,
locale sort, dictionary resolution, or mutation.

---

## 11. Add-missing transaction

One `learning_records` readwrite transaction: validate local rows → get each key
→ conditional `add` → commit. ConstraintError on race is prevented from aborting
and counted as skip.

---

## 12. Replace-all transaction

One `learning_records` readwrite transaction: count → clear → add all → commit.
Uses `add` (not `put`).

---

## 13. Atomicity / rollback

Failure codes include `transaction_failed`. Hooks may force abort after queued
adds or after clear; original Learning set remains unchanged. No partial success
counts.

---

## 14. Stale preview behavior

Preview is advisory. Commit rereads inside its transaction and returns
commit-time counts. Add missing never overwrites identities that appeared after
preview.

---

## 15. Timestamp / stamp / cache preservation

Restore clones exact supported fields. No rewrite of `created_at`,
`last_reviewed`, `review_count`, `status`, `content_sha256`, `storage_scope_id`,
or `display_cache`.

---

## 16. Unresolved records

Restored exactly whether dictionary is missing, hash-mismatched, or `ir_id`
absent. Unavailable is derived later by Saved Vocabulary.

---

## 17. Database ownership

Injected `openDb` remains caller-owned. Direct-DB APIs available for tests.
`commitLearningBackupRestore` does not close the connection.

---

## 18. Concurrency

No module-global busy flag. Repeated Add missing is idempotent. Concurrent
Replace all with the same package converges to the same set. UI suppression
belongs to LP1I4.

---

## 19. Storage / query-log isolation

Only `learning_records` may change. Registry, dictionary, search, query logs,
active bundle, and settings remain unchanged. No restore log/telemetry/network.

---

## 20. Tests

`web/src/learning/learning_backup_restore.test.ts` — verified boundary, preview,
compatibility, Add missing, Replace all, rollback, stale preview, isolation.

| Suite | Result |
| --- | --- |
| Focused LP1I3 | 17 passed |
| Focused LP1I1/I2/I3 + LS1–LS3 (8 files) | 144 passed |
| Full `npm run test:run` | 50 files / 544 tests passed (382.40s) |
| `npm run build` | success (`tsc` + vite) |
| `git diff --check` | clean |

---

## 21. Deviations

- Preview type refined with `local_validation` / Add-missing availability (per
  instruction §34).
- Replace all allowed as recovery when local rows are invalid; Add missing
  blocks (locked product interpretation).
- LP1I2 export fault-injection test updated to include `verified` on mocked
  parse success after ParseLearningBackupResult gained provenance.

---

## 22. Repository hygiene

Featured-anchor work left untouched / unstaged.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LP1_RESTORE_ENGINE_IMPLEMENTED` |
| Module | `web/src/learning/learning_backup_restore.ts` |
| Full suite | 50 files / 544 tests passed |
| Build | success |
| Next slice | `LP1I4 — Backup and Restore Surface` |
