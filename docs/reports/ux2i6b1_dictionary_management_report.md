# UX2I6B1 — Dictionary Management Consumer Surface

## 1. Decision

```text
UX2I6B1_DICTIONARY_MANAGEMENT_IMPLEMENTED
```

## 2. BASE_COMMIT

```text
e6833cb0a4253b4378f140a008e28ce49bb2c5f6
```

Verified at slice start as `e6833cb` — “Redesign UX2 More landing and preferences”.

## 3. Figma reference

```text
https://coach-spider-78723578.figma.site/
Contemporary West African Modernism
```

UX2I1 / UX2I1A tokens and existing UX2 patterns only. No new visual system.

## 4. Dictionary consumer hierarchy

```text
More → Dictionaries
  ← Back to More (#moreManagementBack)
  Dictionaries (#dictionary-management-heading, h2, focused on open)
  Installed dictionaries (h3) + Active dictionary (#bundleSelect)
  Add a dictionary (h3) + #packageImport / #packageImportFile + #importProgress
  Advanced (details#dictionariesAdvanced, collapsed by default)
```

Legacy `<details id="manageDictionariesPanel">` / “Manage dictionaries (optional)” is no longer the page hierarchy. `#manageDictionariesPanel` remains as a structural div for compatibility.

Primary nav stays Search / Saved / Review / More with More `aria-current="page"` while Dictionaries is open.

## 5. Dictionaries / Learning Data separation

```text
data-more-management="dictionaries" | "learning-data"
```

| Mode | Visible | Hidden |
|------|---------|--------|
| dictionaries | dictionary consumer surface, install controls, progress, Advanced, shared data-management footer | `#learningBackupHost` / LP1 UI |
| learning_data | `#learningBackupHost` (single instance) | dictionary consumer surface; Diagnostics/Developer Tools collapsed via CSS |

```text
LEARNING_DATA_VISUAL_MIGRATION_DEFERRED_TO_UX2I6B2
```

No second LP1 surface. Learning Data route regression: More → Learning data → `#learning-backup-heading` (LP1 E2E PASS).

## 6. Management coordinator

`openMoreManagement(mode)` / `setMoreManagementMode(mode)` own:

- management mode token on `#ux2AppShell`
- visible sub-surface (`#dictionaryManagementSurface` / `#learningDataSurface`)
- Back → More (`hideMoreManagementHost` + landing focus `#moreHeading`)
- Dictionaries focus → `#dictionary-management-heading`
- Learning Data focus → `#learning-backup-heading`
- Advanced collapsed on Dictionaries open (`dictionariesAdvanced.open = false`)

## 7. Installed dictionary presentation

Presentation helper: `web/src/render/render_dictionary_management.ts`.

Editorial rows (not dashboard cards): display name, Active text, version/language meta, offline line, retained-data note, Remove from device / Use / Update actions, hairline divider.

Authoritative data remains `listInstalledBundles()` / `getActiveBundleId()` / existing metadata helpers. No second store. No invented fields (ratings, sync, download dates, etc.).

Technical dump stays in `#installedBundleStatus` under Advanced.

## 8. Active dictionary presentation

- Explicit localized **Active** text on the active row (not color-only)
- `#bundleSelect` labeled “Active dictionary” / “Dictionnaire actif”
- Switching paths converge on existing `setActiveBundleId` → `refreshDbStatus`

## 9. Bundle selector preservation

`#bundleSelect` retained with existing change handler. Row **Use** also calls `setActiveBundleId` + `refreshDbStatus`. No second active-bundle variable.

## 10. Removal semantics

Existing `window.confirm(t("bundle.removeConfirm", …))` + `deleteBundleData` unchanged.

Consumer label: **Remove from device**. Explanatory copy: `dictionaries.savedDataRetained` (“Saved learning data and local feedback are kept.”).

After removal: dictionary records/index removed per existing lifecycle; Learning / CF1 / CF2 personal records retained (E2E smoke + CF1/CF2 lifecycle PASS).

## 11. Package install presentation

Consumer section **Add a dictionary** preserves `#packageImport` / `#packageImportFile` and verified `.siralex.zip` flow (`prepareVerifiedBundlePackage` / `installVerifiedBundlePackage`).

Package pipeline messages already consumer-facing (Preparing / Verifying / Installing / Dictionary installed).

```text
PACKAGE_INSTALL_UX2_E2E_NOT_AVAILABLE
PACKAGE_INSTALL_VISUAL_EVIDENCE_NOT_AVAILABLE
```

No public `.siralex.zip` fixture; Advanced three-file debug import remains test setup only. Existing package unit/integration coverage retained.

## 12. Install progress

- Consumer: `#importProgress` (`role="status"`) in Add section
- Advanced: `#installedBundleStatus` technical installed-bundle dump; legacy three-file import progress still writes `#importProgress`

## 13. Empty state

When no bundles: “No dictionaries installed” + help + Choose dictionary file. No “0 bundles / 0 bytes” primary copy. Search nav remains available.

## 14. Advanced boundary

```html
<details id="dictionariesAdvanced">
  <summary>Advanced</summary>
```

Collapsed by default. Contains catalog URL/load/list, legacy three-file import, technical status. No custom accordion.

## 15. Diagnostics / Developer Tools

Not redesigned. Remain collapsed `.ux2-more-legacy-advanced` under the management host; hidden in learning-data mode via CSS. Not promoted into Dictionaries content. Query logging stays Diagnostics-only.

```text
UX2I8_READY_STATE_ACCESSIBILITY_CLEANUP_REMAINS_TRACKED
UX2I8_ADVANCED_INTERNAL_SEPARATION_REMAINS_TRACKED
```

## 16. Delete Database boundary

`#clearDb` lives in `#dictionariesDestructive` (Data management), not in ordinary Installed/Add sections. Reminders preserved:

- `#learningBackupDeleteReminder` → `openMoreManagement("learning_data")`
- `#correctionFeedbackDeleteReminder`
- `#searchFeedbackDeleteReminder`

## 17. Catalog preservation

`fetchBundleCatalog` / comparison / remote install / update semantics unchanged. Catalog UI remains under Advanced. Badge truth from existing comparison only. No marketplace.

## 18. Mobile / Desktop

- Mobile `<768px`: single column, shell gutter, page scroll, ≥44px actions, bottom-nav clearance, Advanced disclosure, no Learning Backup in dictionaries mode
- Desktop `≥768px`: `.ux2-dict-layout` CSS grid — Installed | Add, Advanced below

## 19. Accessibility

Semantic h2 Dictionaries + h3 sections; native labeled `#bundleSelect`; real buttons; heading focus on open; Advanced keyboard-native; Active/Remove not color-only; no ARIA listbox for the select.

## 20. Localization

EN/FR `dictionaries.*` keys added; reuse of `manage.*` / `catalog.*` / `import.*` where meaning already fits.

## 21. Search-state behavior

Documented current behavior (unchanged policy):

- More → Dictionaries → Back → More → Search **without** active-bundle change: query and results preserved (E2E asserts `#searchInput` value + result count).
- If active dictionary **does** change, existing `refreshDbStatus` detects identity/hash change and invalidates collection/Review contexts; search is not auto-re-executed by the More coordinator. Opening Dictionaries alone does not close/reopen the database.

## 22. High-risk implementation changes

No changes to:

```text
installBundleIntoDb / installRemoteCatalogBundle / prepareVerifiedBundlePackage /
installVerifiedBundlePackage / deleteBundleData / setActiveBundleId /
catalog comparison / interrupt recovery / IndexedDB schema
```

Presentation rewiring only in `renderInstalledBundleManager` (maps to `renderInstalledDictionaryList`) while callbacks still call the same lifecycle APIs.

## 23. Unit tests

```text
web/src/render/render_dictionary_management.test.ts
i18n dictionaries key parity
```

Full suite:

```text
858 passed; 9 query_log_store.test.ts baseline failures unchanged (867 total)
```

## 24. UX2 Dictionaries E2E

```text
npm run test:e2e:ux2-dictionaries — PASS (4/4)
```

Covers: mobile hierarchy/focus/Advanced/Back/Learning separation, empty state, desktop layout + Search-state, removal retention smoke.

## 25–32. Regressions

| Suite | Result |
|-------|--------|
| UX2 More | PASS (2/2) |
| UX2 Search | PASS (2/2) |
| UX2 Saved | PASS (2/2) |
| UX2 Review | PASS (2/2) |
| Theme | PASS (3/3) |
| CF1 lifecycle | PASS (7/7) |
| CF2 lifecycle | PASS (7/7) |
| FH1 handoff | PASS (2/2) via `test:e2e:handoff` |
| LP1 backup/restore | PASS (6/6) |
| Build | PASS |
| git diff --check | PASS |

LP1 E2E helper updates (intentional routing / UX2 Search affordances only):

- Dictionaries install via `openMoreAnd(..., "dictionaries")`
- Wait for terminal import status (`Complete|already installed`)
- `ensureTargetToSource` + navigate to Search before save (icon-only swap / top-level Saved hide `#searchInput`)

## 33. Visual evidence

```text
data/local_evidence/ux2_dictionaries/2026-08-05T19-47-46-781Z/
  mobile-light-dictionaries-installed.png
  mobile-dark-dictionaries-installed.png
  mobile-light-dictionaries-empty.png
  mobile-light-dictionaries-advanced.png
  desktop-light-dictionaries-installed.png
  desktop-dark-dictionaries-installed.png
```

```text
PACKAGE_INSTALL_VISUAL_EVIDENCE_NOT_AVAILABLE
```

## 34. Explicit deferred markers

```text
LEARNING_DATA_VISUAL_MIGRATION_DEFERRED_TO_UX2I6B2
CF1_CF2_VISUAL_MIGRATION_DEFERRED_TO_UX2I7
UX2I8_READY_STATE_ACCESSIBILITY_CLEANUP_REMAINS_TRACKED
UX2I8_ADVANCED_INTERNAL_SEPARATION_REMAINS_TRACKED
```

## 35. Final decision

```text
UX2I6B1_DICTIONARY_MANAGEMENT_IMPLEMENTED
```

Governing rule preserved: a dictionary is the product surface; a bundle remains the implementation underneath.
