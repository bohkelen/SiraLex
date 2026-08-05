# UX2I6B2 — Learning Data / Backup & Restore Surface

## 1. Decision

```text
UX2I6B2_LEARNING_DATA_IMPLEMENTED
```

## 2. BASE_COMMIT

```text
de5cd8b8ba4644a82aec330d019796dec67913af
```

Verified at slice start as `de5cd8b` — “Redesign UX2 dictionary management”.

## 3. Figma reference

```text
https://coach-spider-78723578.figma.site/
Contemporary West African Modernism
```

UX2I1 / UX2I1A tokens only. No new palette, gradients, glassmorphism, or font dependency.

## 4. LP1 invariants

Presentation-only migration. Unchanged:

```text
siralex_learning_backup_v1
Learning Record identity / validation / review-field rules
export serialization / deterministic ordering / 25 MiB / UTF-8
restore preview analysis / bundle compatibility
add_missing / replace_all semantics
atomic restore + rollback
stale preview / file-token / generation guards
display_cache / content_sha256 / storage_scope_id / timestamps / status
unresolved-record retention
active-bundle / dictionary / query-log / settings isolation
offline behavior
```

Controller stack preserved:

```text
learning_backup_package → export → restore → learning_backup_surface → render_learning_backup
```

Restore state machine unchanged:

```text
idle → reading → validating → invalid | preview → confirming → restoring → success | error
```

## 5. Dictionaries / Learning Data separation

UX2I6B1 invariant retained:

- Learning Data mode: `#learningDataSurface` / `#learningBackupHost` visible; dictionary consumer surface hidden
- Dictionaries mode: `#learningBackupHost` hidden

Single `#learningBackupHost` — no second LP1 surface.

## 6. Learning Data hierarchy

```text
← Back to More
Manage Learning Data (#learning-backup-heading, h2, focused after count refresh)
page intro (dictionary vs learning distinction)
local-only line
privacy note (contains + store)
Backup | Restore (two-column desktop when idle)
result region
```

## 7. Privacy / local-only

- `learningBackup.localOnly` remains primary local/device copy
- `.learning-backup-privacy` keeps contains + store (no encrypt/cloud/account claims)
- Trust warning placed at Restore (`learningBackup.privacy.trust`) to reduce repeated fatigue while remaining discoverable

## 8. Record count

Uses controller `recordCount` via existing `learningBackup.export.count` / empty / loading. No achievement framing.

## 9. Export states

Empty → disabled + “No learning data to back up.”  
Ready → count + Export Learning Backup  
Success → Backup created + count/filename  
Busy / duplicate suppression unchanged in controller

## 10. Restore states

File input `#learning-backup-file-input` + labeled chooser preserved.  
Reading / validating status lines preserved.  
Invalid: heading + mapped error + non-mutation boundary (Learning + dictionary unchanged).  
Preview: counts lead; schema/filename secondary; compatibility table; native radios.  
Replace-all: preview **Continue** → existing `<dialog>` confirmation (wording unchanged).  
Add-missing: **Restore learning data** commits from preview.  
Busy / success / failure / Open saved vocabulary preserved.

## 11. Dictionary compatibility

States unchanged (`installed_matching` / `installed_hash_mismatch` / `not_installed`). Consumer wording refined; no raw SHA in default summary. Missing dictionary remains non-blocking. Mobile table stacks as list via CSS without losing semantics.

## 12. Post-restore

`onOpenSavedVocabulary` → existing `showSavedVocabulary()` (UX2 top-level Saved).  
Controller still invalidates collection/Review contexts and refreshes count.

## 13. More navigation

`#moreManagementBack` → More landing → `#moreHeading`. More remains `aria-current="page"`.

## 14. Mobile / Desktop

Mobile: single column, shell gutter, page scroll, ≥44px actions, responsive compat, dialog usable.  
Desktop idle: Backup | Restore side-by-side; preview spans full reading width.

## 15. Accessibility

Semantic h2/h3, file label, native radio fieldset/legend, compatibility table, focus targets (invalid/preview/confirm/result), status/alert roles, dialog semantics, visible focus, text for compatibility states.

Focus glue: `openMoreManagement("learning_data")` awaits `refreshCount()` before focusing `#learning-backup-heading` so remount does not steal focus.

## 16. Localization

EN/FR parity. New hierarchy keys: `pageIntro`, `backupSectionHelp`, `restoreSectionHelp`, `restore.noLearningChanged`, `policy.restoreAction`, `policy.continueReplace`. Existing destructive/privacy meanings preserved. Compatibility/count copy lightly clarified.

## 17. High-risk implementation changes

```text
High-risk LP1 code changed: NO
```

Not modified:

```text
learning_backup_package.ts
learning_backup_export.ts
learning_backup_restore.ts
learning_backup_surface.ts
```

`main.ts` change: Learning Data open focus after `refreshCount` only (presentation glue).

## 18. Unit tests

```text
render_learning_backup.test.ts — expanded UX2 assertions (9 tests)
learning_backup_surface / export / restore / package / file — PASS
lp1i5_backup_restore_lifecycle_verification — PASS (14)
i18n Learning Data key checks — PASS
```

Full suite:

```text
863 passed; 9 query_log_store.test.ts baseline failures unchanged (872 total)
```

## 19. UX2 Learning Data E2E

```text
npm run test:e2e:ux2-learning-data — PASS (3/3)
```

## 20. LP1 original E2E

```text
npm run test:e2e:lp1 — PASS (6/6)
```

Preview replace action selector updated to **Continue**; confirmation dialog still **Replace all learning records**.

## 21–27. Regressions

| Suite | Result |
|-------|--------|
| UX2 Dictionaries | PASS (4/4) |
| UX2 More | PASS (2/2) |
| UX2 Saved | PASS (2/2) |
| UX2 Review | PASS (2/2) |
| Theme | PASS (3/3) |
| Build | PASS |
| git diff --check | PASS |

## 28. Visual evidence

```text
data/local_evidence/ux2_learning_data/2026-08-05T20-09-32-380Z/
  mobile-light-learning-data-ready.png
  mobile-dark-learning-data-ready.png
  mobile-light-restore-preview.png
  mobile-light-replace-confirm.png
  mobile-light-restore-success.png
  mobile-invalid-backup.png
  desktop-light-learning-data-ready.png
  desktop-dark-learning-data-ready.png
  desktop-light-restore-preview.png
```

## 29. Known fixture gaps

```text
MISSING_DICTIONARY_RESTORE_VISUAL_EVIDENCE_NOT_AVAILABLE
CORRUPT_LOCAL_RECOVERY_VISUAL_EVIDENCE_NOT_AVAILABLE
```

Integration / controller proofs remain authoritative.

## 30. Explicit deferred markers

```text
CF1_CF2_VISUAL_MIGRATION_DEFERRED_TO_UX2I7
UX2I8_READY_STATE_ACCESSIBILITY_CLEANUP_REMAINS_TRACKED
UX2I8_ADVANCED_INTERNAL_SEPARATION_REMAINS_TRACKED
```

## 31. Final decision

```text
UX2I6B2_LEARNING_DATA_IMPLEMENTED
```

Governing rule preserved: make backup and restore understandable without making it less strict.
