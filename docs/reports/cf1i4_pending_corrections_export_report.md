# CF1I4 — Pending Corrections and Export Report

## 1. Decision

```text
CF1_PENDING_CORRECTIONS_EXPORT_IMPLEMENTED
```

Users can open **Manage Corrections**, list all local correction drafts, inspect a
draft, optionally edit or delete it, and export every validated draft as one
deterministic correction-feedback package. Drafts remain unchanged after export.
No import, server submission, Phase 1.5 conversion, Learning/query-log coupling,
or corpus mutation was added.

---

## 2. User loop

```text
Manage Corrections
→ list all local drafts
→ inspect a draft
→ optionally edit or delete it
→ export all validated drafts
→ retain drafts unchanged after export
```

---

## 3. Entry-point placement

Secondary action `#openManageCorrections` beside Saved Vocabulary / Manage
Dictionaries in the active-dictionary area. Remains available when drafts exist
even if no matching dictionary is currently installed.

Not placed inside Learning, query logs, Review, or dictionary installation.

Distinct non-blocking database-deletion reminder
`#correctionFeedbackDeleteReminder` near Delete database (separate from the
Learning backup reminder). Its action opens Manage Corrections.

---

## 4. Modules

| Module | Role |
| --- | --- |
| `web/src/corrections/correction_management_session.ts` | List/detail/edit/delete/export controller |
| `web/src/render/render_correction_management.ts` | Pure DOM renderer |
| `web/src/corrections/correction_feedback_export.ts` | Deterministic export pipeline |
| `web/src/corrections/correction_feedback_file.ts` | Injectable browser download adapter |

Focused tests sit beside each module; integration covers create → manage → edit →
export → delete isolation.

---

## 5. List behavior

- Calls `listCorrectionDrafts` (CF1I2 management order).
- Shows all bundles; no active-bundle filter.
- Corrupt stored row blocks the complete surface (`invalid_stored_draft`).
- Primary rows show bounded snapshot/headword, issue type, target, updated
  timestamp, and availability text — never raw content hash or storage scope.

---

## 6. Draft detail

Shows headword/snapshot, issue type, mode, target, problem description, proposed
value when present, timestamps, and dictionary availability.

Immutable provenance is expandable only:

- `bundle_id`, `ir_id`, `content_sha256`, `storage_scope_id`

Live comparison resolves `(storage_scope_id, ir_id)` when available:

| State | Meaning |
| --- | --- |
| matching live content | Entry and hash match |
| dictionary unavailable | Bundle not installed |
| entry unavailable | Entry missing / wrong kind |
| dictionary content differs | Installed hash ≠ draft hash (neutral wording) |

---

## 7. Editing

Editable: issue type, mode, target (only when live retarget allowed),
problem description, proposed value; snapshot rebuilt from live content when
retargeting.

Immutable: schema version, draft id, bundle/ir/kind/hash/scope, created_at,
status.

Uses `expected_updated_at` from the opened draft. On `stale_draft`: no overwrite,
stale message, reload current stored draft, require edit again.

When the original entry is unavailable: user-authored text remains editable;
existing target/snapshot retained; no invented retarget structure.

---

## 8. Deletion

Explicit confirmation; passes expected updated timestamp; stale deletion does not
delete; success returns to refreshed list; no tombstones; no dictionary /
Learning / query-log changes.

---

## 9. Export

Sequence:

```text
list all
→ validate all
→ build with caller-supplied exportedAt
→ serialize
→ UTF-8 byte length (reject > 25 MiB)
→ reparse generated artifact
→ Blob download via injectable adapter
→ revoke object URL
```

Requirements enforced:

- one readonly draft-list snapshot;
- deterministic CF1I1 package order;
- no partial package / no partial download;
- invalid local row or duplicate draft IDs block export;
- export does not mutate drafts or mark them submitted/exported;
- repeat export allowed;
- no Phase 1.5 conversion fields;
- empty export disabled;
- export-all only.

Authority warning (EN/FR UI):

> This file contains unreviewed user suggestions. It must not be applied automatically.

> Ce fichier contient des suggestions utilisateur non révisées. Il ne doit pas être appliqué automatiquement.

Success copy shows filename and count only.

---

## 10. Database deletion reminder

Shown when `countCorrectionDrafts > 0`:

> Before deleting the database, export your correction drafts if you want to keep them.

Refreshes after draft creation, edit, delete, database deletion, and management
reload / Manage Dictionaries open. Not merged with the Learning backup reminder.

---

## 11. Main integration

Uses `correctionManagementGeneration` (not Saved Vocabulary generation).

Successful CF1I3 save calls `invalidateCorrectionManagementGeneration()` and
refreshes the deletion reminder even when the form host is no longer current.

Production management session uses `dbOwnership: "controller_owned"`.

---

## 12. Localization

Dedicated `correctionFeedback.manage.*` keys in EN/FR only (no Russian).

---

## 13. Accessibility

Page heading, status region, semantic list, stable button labels, edit form
labels/counters, stale-edit error summary, delete confirmation, focus return
after delete / navigation, `aria-busy` during writes/export, text (not
color-only) availability, keyboard-complete operation.

---

## 14. Explicit non-goals (unchanged)

Import; server submission; accounts; sync; moderation; approval status;
Phase 1.5 conversion; direct corpus mutation; automatic deletion after export;
export-selected; per-draft exported flag; missing-entry feedback; query-log /
Learning / LS4 / PV1 implementation.

---

## 15. Validation evidence

Focused CF1I4 modules:

```text
npx vitest run src/corrections/correction_feedback_export.test.ts \
  src/corrections/correction_management_session.test.ts \
  src/corrections/correction_management_integration.test.ts \
  src/render/render_correction_management.test.ts
→ Test Files  4 passed (4)
→ Tests  28 passed (28)
```

Full suite:

```text
npm run test:run
→ Test Files  66 passed (66)
→ Tests  693 passed (693)
```

Build:

```text
npm run build
→ tsc + vite build succeeded
```

Also: `git diff --check` clean.

---

## 16. Allowed surface touched

- correction management session/model
- renderer
- focused tests
- narrow `main.ts` wiring
- i18n + minimal CSS
- database deletion reminder
- this report
- narrow roadmap update

IndexedDB version/schema, `correction_draft_v1`, correction feedback package
schema, Learning, query logs, dictionary bundle formats, corpus, Phase 1.5
tooling, Playwright, PV1, and LS4 were not modified.

---

## 17. Next slice

```text
CF1I5 — Offline Correction Lifecycle Verification
```
