# LP1I1 — Learning Backup Package Model Report

## 1. Decision

```text
LP1_BACKUP_PACKAGE_MODEL_IMPLEMENTED
```

Pure package model, strict parser, deterministic builder/serialization helpers,
and restore-preview types are implemented without IndexedDB access, export
download, restore mutation, UI, i18n, CSS, Playwright, or Learning Record schema
version changes.

---

## 2. Package constants

| Constant | Value |
| --- | --- |
| `LEARNING_BACKUP_PACKAGE_SCHEMA` | `siralex_learning_backup_v1` |
| `LEARNING_BACKUP_MAX_BYTES` | `25 * 1024 * 1024` |
| `LEARNING_BACKUP_FILE_SUFFIX` | `.siralex-learning-backup.json` |
| `LEARNING_BACKUP_MAX_VALIDATION_ERRORS` | `100` |

Dictionary package constants are not reused.

---

## 3. Package types

Implemented in `web/src/learning/learning_backup_package.ts`:

- `LearningBackupBundleSummaryV1`
- `LearningBackupPackageV1`

`records` is authoritative. Summaries are validation/preview metadata only.
No device/user/active-bundle/locale/query-log/dictionary fields.

---

## 4. Parser API

```ts
parseLearningBackupJson(jsonText, options?: { byteLength?: number })
```

- checks byte length against 25 MiB before JSON parse when oversized;
- requires one plain object top-level value;
- pure; no IndexedDB; no locale dependence;
- preserves validated input record order (does not rewrite untrusted order).

---

## 5. Validation errors

Discriminated `ParseLearningBackupResult` with codes:

`file_too_large`, `invalid_json`, `invalid_top_level`,
`unsupported_package_schema`, `invalid_package_field`, `invalid_exported_at`,
`record_count_mismatch`, `invalid_bundle_summary`, `bundle_summary_mismatch`,
`invalid_learning_record`, `inconsistent_review_fields`,
`duplicate_learning_identity`, `error_limit_reached`.

Errors use structural paths only (no headwords / display-cache values).

Error accumulation is bounded at 100, with `truncated` / `error_limit_reached`
when exceeded.

---

## 6. Strictness policy

- Reject unknown top-level package fields.
- Reject unknown summary fields.
- Reject empty packages (`record_count === 0` / empty `records`).
- Learning Record exact-shape enforcement lives in the shared write validator
  (unknown top-level and `display_cache` keys rejected).

---

## 7. Learning Record validator reuse

Backup parsing calls `validateLearningRecordForWrite` from
`learning_record_types.ts`, then `hasConsistentReviewFields`.

Exact-key enforcement was added to the shared write validator so write path and
backup parser share one structural source of truth. Existing valid writes are
unchanged; unknown fields were never part of the supported shape.

---

## 8. Review-field consistency

Uses `hasConsistentReviewFields`:

- never reviewed: `review_count === 0 && last_reviewed === null`
- reviewed: `review_count > 0 && last_reviewed !== null`

No repair, inference, or timestamp normalization.

---

## 9. Duplicate identity handling

Identity key: `learningBackupRecordKey(bundle_id, ir_id)` → `bundle_id\0ir_id`.

Duplicates are rejected even when byte-identical. Content hash and storage scope
are not identity.

---

## 10. Bundle-summary derivation

`deriveLearningBackupBundleSummaries`:

- group by `bundle_id`;
- unique sorted `content_sha256_values`;
- summaries sorted by `bundle_id` ascending;
- pure; no mutation.

---

## 11. Bundle-summary validation

Provided summaries are canonicalized (bundle order + hash order) and compared
exactly to summaries derived from validated records. Ordering differences alone
do not fail validation.

---

## 12. Builder

`buildLearningBackupPackage(records, { exportedAt, appVersion? })`:

- rejects empty input;
- validates every record + consistency;
- rejects duplicates;
- sorts canonically;
- derives summaries;
- clones values (no input mutation);
- no clock / IndexedDB access.

---

## 13. Deterministic serialization

`serializeLearningBackupPackage`:

- stable top-level field order;
- stable Learning Record field order;
- optional `app_version` omitted when undefined;
- optional display-cache fields omitted when undefined;
- two-space indentation;
- trailing newline at EOF.

---

## 14. Filename helper

`buildLearningBackupFilename(exportedAt)` →

```text
siralex-learning-backup-YYYY-MM-DDTHH-mm-ssZ.json
```

UTC; milliseconds truncated to whole seconds; no vocabulary/device text.

---

## 15. UTF-8 size handling

`getUtf8ByteLength` uses `TextEncoder`. Oversized `byteLength` fails with
`file_too_large` before JSON parse.

---

## 16. Preview-analysis types

Exported (no DB analysis in LP1I1):

- `LearningBackupRestorePolicy`
- `LearningBackupBundleCompatibility`
- `LearningBackupRestorePreview`

---

## 17. Purity

No IndexedDB, dictionary resolution, clock inside builder, locale comparison,
logging, network, or query-log interactions. Builder/serialization clone rather
than mutate inputs.

---

## 18. Tests

`web/src/learning/learning_backup_package.test.ts` covers valid packages,
package shape, summaries, Learning Records, duplicates, deterministic
builder/serialization, filename, size limit, and shared validator unknown-field
behavior.

Validation runs:

| Suite | Result |
| --- | --- |
| Focused backup + LS1–LS3 (8 files) | 123 passed |
| Full `npm run test:run` | 48 files / 503 tests passed (368.71s) |
| `npm run build` | success (`tsc` + vite) |
| `git diff --check` | clean |

---

## 19. Deviations

None material relative to LP1D0 / LP1I1 instruction.

- Filename uses `.json` as locked by the product filename example; the distinct
  `LEARNING_BACKUP_FILE_SUFFIX` constant remains available for file-type
  recognition.
- Exact-key rejection was added to the shared Learning Record write validator
  (tightening unknown fields) without changing valid write behavior.
- `invalid_utf8` is reserved in the error-code union for the byte adapter (LP1I4);
  LP1I1 text parser receives JS strings.

---

## 20. Repository hygiene

Unrelated featured-anchor work was not modified or staged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

Staged LP1I1 files only:

- `web/src/learning/learning_backup_package.ts`
- `web/src/learning/learning_backup_package.test.ts`
- `web/src/learning/learning_record_types.ts` (shared exact-key validation)
- `docs/reports/lp1i1_learning_backup_package_model_report.md`
- `docs/ROADMAP.md` (status: LP1I1 implemented / LP1I2 next)

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LP1_BACKUP_PACKAGE_MODEL_IMPLEMENTED` |
| Module | `web/src/learning/learning_backup_package.ts` |
| Full suite | 48 files / 503 tests passed |
| Build | success |
| Next slice | `LP1I2 — Deterministic Export` |
