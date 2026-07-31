# LP1I4 — Backup and Restore Surface Report

## 1. Decision

```text
LP1_BACKUP_RESTORE_SURFACE_IMPLEMENTED
```

Manage Learning Data wires LP1I1–LP1I3 into the management surface with file
validation, export download, restore preview/confirmation, EN/FR copy,
accessibility basics, and a database-deletion reminder. No Playwright.

---

## 2. Surface placement

Inside `#manageDictionariesPanel`, above Delete Database, in
`#learningBackupHost`. Separate from Diagnostics / query-log export.

---

## 3. File adapter

`web/src/learning/learning_backup_file.ts`:

- size check against `LEARNING_BACKUP_MAX_BYTES` before `arrayBuffer` when
  `file.size` is known;
- strict UTF-8 decode;
- `parseLearningBackupJson` → verified package only;
- download adapter for validated export artifacts.

---

## 4. UTF-8 validation

`TextDecoder("utf-8", { fatal: true })`. Malformed bytes → `invalid_utf8`; no
replacement characters; no parse/preview/mutation after failure.

---

## 5. Export orchestration

Surface controller loads Learning count (all bundles), disables Export when
empty, calls `createLearningBackupExport` once while busy, then download
adapter. Failures trigger no download.

---

## 6. Download adapter

`downloadLearningBackupArtifact`: Blob → object URL → temporary anchor →
revoke in `finally`. Injectable URL/document seams for tests.

---

## 7. Export states

Loading count → empty / ready → exporting → success/error. Duplicate export
clicks ignored while busy. Success shows count + filename without claiming the
file was retained.

---

## 8. Restore state machine

`idle → reading → validating → invalid|preview → confirming → restoring →
success|error`. Generation + file-token guards drop stale callbacks. Changing
files clears prior verified package/preview/policy.

---

## 9. Preview presentation

Filename, exported_at, schema, counts, compatibility table, Add missing /
Replace all impacts. No vocabulary list by default.

---

## 10. Local-corruption behavior

When `local_validation.state === "invalid"`: explain inconsistency, disable Add
missing, keep Replace all available, no auto-select of Replace all.

---

## 11. Policy selection

Native radios. Default Add missing when available; otherwise no automatic
Replace all selection. Cancel clears selection without mutation.

---

## 12. Replace confirmation

Accessible `<dialog>` with dedicated warning and Cancel / Replace actions.
Add missing commits from the explicit preview action without this dialog.

---

## 13. Restore commit

`commitLearningBackupRestore` with selected verified package and policy.
Busy disables file/policy/export controls. Results use commit-time counts.

---

## 14. Post-restore invalidation

`invalidateCollectionAndReviewContexts()`; clear Learning hosts when active;
refresh management count; clear verified package/preview; optional open Saved
Vocabulary. Active bundle unchanged.

---

## 15. Stale-host handling

Surface generation rejects stale export/restore UI redraws. Committed restore
remains durable if the surface was disposed mid-flight. Bundle switch
invalidates preview.

---

## 16. Privacy

Visible EN/FR warnings before export and restore. No encryption/authenticity
claims. Separate from query-log terminology.

---

## 17. Localization

Dedicated `learningBackup.*` keys in `web/src/i18n.ts` (EN + FR).
`unsupported_package_schema` uses generic unsupported-version wording (not an
automatic “newer version” claim).

---

## 18. Accessibility

Heading hierarchy; real buttons; labeled file input; privacy as readable text;
fieldset/radios; disabled Add missing explanation; dialog confirmation; focus
targets for invalid/preview/confirm/result; `aria-busy` while busy.

---

## 19. Database-deletion reminder

Non-blocking reminder near Delete Database when Learning Records exist, with
navigation to Manage Learning Data. No forced/auto export.

---

## 20. Tests

| Suite | Result |
| --- | --- |
| Focused LP1I4 file/surface/renderer | 16 passed |
| Focused LP1I1–I4 + LS1–LS3 + i18n (11 files) | 156 passed |
| Full `npm run test:run` | 53 files / 560 tests passed (381.86s) |
| `npm run build` | success (`tsc` + vite) |
| `git diff --check` | clean |

---

## 21. Deviations

- Replace confirmation uses `<dialog>` rather than `window.confirm` for a11y.
- Database deletion remains available without a typed phrase; reminder is
  non-blocking as specified.
- Bundle-registry changes invalidate preview on active-bundle change; other
  install paths rely on reopening/refresh.

---

## 22. Repository hygiene

Featured-anchor work left untouched / unstaged.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LP1_BACKUP_RESTORE_SURFACE_IMPLEMENTED` |
| Full suite | 53 files / 560 tests passed |
| Build | success |
| Next slice | `LP1I5 — Offline and Lifecycle Verification` |
