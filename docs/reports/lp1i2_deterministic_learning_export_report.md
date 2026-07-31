# LP1I2 — Deterministic Learning Export Report

## 1. Decision

```text
LP1_DETERMINISTIC_EXPORT_IMPLEMENTED
```

Export generation reads one Learning Record snapshot, validates every row,
builds a deterministic package via LP1I1, serializes it, enforces size,
reparses with the LP1I1 validator, and returns a presentation-ready artifact.
No browser download, restore, UI, i18n, CSS, Playwright, or schema change.

---

## 2. Export architecture

```text
openDb (caller-owned)
  → readAllLearningRecordsForBackup (one readonly learning_records tx)
  → buildLearningBackupExportArtifact (pure)
       → analyze/validate all rows
       → buildLearningBackupPackage
       → serializeLearningBackupPackage
       → getUtf8ByteLength / max-bytes check
       → parseLearningBackupJson (self-validate)
       → LearningBackupExportArtifact
```

Module: `web/src/learning/learning_backup_export.ts`

Store addition: `listAllLearningRecords` in `learning_record_store.ts`.

---

## 3. Result model

- `LearningBackupExportArtifact` — filename, `application/json` text, byteLength,
  recordCount, bundleCount, exportedAt (no Blob / object URL).
- `CreateLearningBackupExportResult` — `{ ok: true, artifact }` or
  `{ ok: false, code, invalidRecordCount? }`.
- Error codes never include headwords, record bodies, or stack traces.

---

## 4. Read-all Learning adapter

`readAllLearningRecordsForBackup(db)` / `listAllLearningRecords(db)`:

- one readonly `learning_records` transaction;
- all bundles;
- no active-bundle filter;
- no dictionary resolution;
- no writes;
- store/cursor order is not package-canonical (builder sorts).

---

## 5. Snapshot semantics

> The backup contains the complete Learning Record set observed by one readonly
> IndexedDB transaction.

Package construction runs after that transaction completes. Later writes are not
patched into the artifact. No second Learning Record read. No Review/session
state. Only `learning_records` participates.

---

## 6. Validation and failure mapping

| Condition | Code |
| --- | --- |
| Empty store / empty rows | `no_learning_records` |
| Structural or review-inconsistent rows | `invalid_local_record` (+ count) |
| Duplicate `(bundle_id, ir_id)` | `duplicate_learning_identity` |
| Self-validation / bad clock / bad app version | `generated_package_invalid` |
| UTF-8 size above max | `generated_package_too_large` |
| `openDb` throws | `database_unavailable` |
| Read throws | `database_read_failed` |

No skip, repair, or partial artifact.

LP1I1 `LearningBackupBuildError` provides typed builder failures mapped by export.

---

## 7. Timestamp handling

`deps.now()` is called exactly once before DB open. The same string is used for
`exported_at`, filename, and artifact `exportedAt`. Invalid timestamp →
`generated_package_invalid`. Pure builder never reads the clock.

---

## 8. Package construction

Reuses LP1I1 exclusively:

- `buildLearningBackupPackage`
- `serializeLearningBackupPackage`
- `buildLearningBackupFilename`
- `getUtf8ByteLength`
- `parseLearningBackupJson`

---

## 9. Deterministic serialization

Inherited from LP1I1: canonical record order, stable field order, two-space
indent, EOF newline. IndexedDB cursor order does not control package order.

---

## 10. Self-validation

After serialization, `parseLearningBackupJson(text, { byteLength })` must
succeed. Export also checks record count, package schema, identity set, and
bundle set. Failure → `generated_package_invalid` (no artifact returned).

---

## 11. Size enforcement

UTF-8 byte length after serialization compared to `LEARNING_BACKUP_MAX_BYTES`
(25 MiB). Exact max accepted; above rejected without truncation/compression.
Test seam: `maxBytes` on the pure builder.

---

## 12. Artifact semantics

Successful artifact fields only. No active bundle, dictionary counts, query-log
counts, locale, or export history. Filename contains no vocabulary/device IDs.

---

## 13. Database ownership

`createLearningBackupExport` does **not** close the connection returned by
injected `openDb` (matches repository session conventions). Caller owns lifecycle.

---

## 14. Concurrency boundary

No module-level mutable state. Each call is independent. Export is readonly;
UI busy-state belongs to LP1I4. Snapshot is not synchronized with writes after
the read transaction completes.

---

## 15. Storage / query-log isolation

Export may only read `learning_records` and allocate in-memory package data.
Tests snapshot learning/records/search/bundles/query_logs/active bundle before
and after; counts and values unchanged. No download, DOM, Blob, or network.

---

## 16. Tests

`web/src/learning/learning_backup_export.test.ts` — 24 tests covering pure
artifacts, DB adapter, invalid local state, timestamp, self-validation, size,
isolation, and snapshot behavior.

Validation runs:

| Suite | Result |
| --- | --- |
| Focused LP1I2 | 24 passed |
| Focused LP1I2 + LP1I1 + store + LS1–LS3 (8 files) | 137 passed |
| Full `npm run test:run` | 49 files / 527 tests passed (384.66s) |
| `npm run build` | success (`tsc` + vite) |
| `git diff --check` | clean |

---

## 17. Deviations

- Blob / `createLearningBackupBlob` deferred to LP1I4 (recommended).
- DB is not closed inside export (caller-owned `openDb`), documented above.
- Narrow typed `LearningBackupBuildError` added to LP1I1 builder (Option A).

---

## 18. Repository hygiene

Featured-anchor work left untouched / unstaged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

LP1I2 staged files only (plus narrow LP1I1 typed-error change).

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LP1_DETERMINISTIC_EXPORT_IMPLEMENTED` |
| Module | `web/src/learning/learning_backup_export.ts` |
| Full suite | 49 files / 527 tests passed |
| Build | success |
| Next slice | `LP1I3 — Restore Preview and Atomic Policies` |
