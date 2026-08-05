# UX2I6A — More Landing, Preferences, and Management Routing

## 1. Decision

```text
UX2I6A_MORE_PREFERENCES_ROUTING_IMPLEMENTED
```

## 2. BASE_COMMIT

```text
30ac25e649d3ede0de0c17eca0e019a19ea9f2bf
```

Verified at slice start as `30ac25e` — “Redesign UX2 review and reflect experience”.

## 3. UX2I5B test-count reconciliation

Preflight full unit suite on `BASE_COMMIT`:

```text
848 passed; 9 query_log_store.test.ts baseline failures unchanged
```

Corrected `docs/reports/ux2i5b_review_reflect_report.md` §33 from **847 → 848**. UX2I5B decision unchanged.

```text
UX2I5B test-count reconciliation: PASS
verified count: 848
```

## 4. Figma reference

```text
https://coach-spider-78723578.figma.site/
Contemporary West African Modernism
```

UX2I1 / UX2I1A tokens only. No duplicated raw Figma colors.

## 5. More information architecture

Consumer hierarchy frozen:

```text
More
  CONTRIBUTE — Corrections, Search feedback
  DICTIONARY & DATA — Dictionaries, Learning data
  PREFERENCES — Theme, Interface language
  ABOUT — SiraLex, Version {APP_VERSION}, local-dictionary note
```

Diagnostics / Developer Tools are not ordinary peer rows on the landing; they remain inside the legacy management bridge.

## 6. Contribution routes

```text
#openManageCorrections → showCorrectionManagement({ returnTo: "more" })
#openManageSearchFeedback → showSearchFeedbackManagement({ returnTo: "more" })
```

Back returns to More landing and focuses `#moreHeading`. No invented contribution metrics.

## 7. Dictionary route

```text
#openManageDictionaries → openMoreManagement("dictionaries")
```

Entry/presentation only. Internal dictionary-manager visual redesign deferred.

```text
DICTIONARY_VISUAL_MIGRATION_DEFERRED_TO_UX2I6B
```

## 8. Learning Data route

```text
#openManageLearningData → openMoreManagement("learning_data")
```

Routes to existing `#learningBackupHost` / LP1 surface. No second backup implementation.

Learning backup delete reminder uses the same centralized helper.

```text
LEARNING_DATA_VISUAL_MIGRATION_DEFERRED_TO_UX2I6B
```

## 9. Theme preservation

```text
storage key: siralex.ui_theme
values: system | light | dark
#themeSelect retained
immediate <html data-theme=...> application; no reload
```

## 10. Locale preservation

```text
storage key: siralex.ui_locale
values: en | fr
#localeSelect retained
reload on change remains authoritative
```

## 11. About / version / offline wording

Uses runtime `APP_VERSION` from `package.json`. Conditional copy:

- active dictionary → “Dictionary stored on this device”
- none → “No dictionary stored for offline search”

No sync / cloud / update claims.

## 12. Back → More bridge

```text
#moreManagementBack — ← Back to More
```

Closes management host, shows More landing, keeps primary destination = more, focuses `#moreHeading`.

## 13. Search-state preservation

Search query + results survive More (including Theme change and CF1/CF2 round-trips back to More then Search). Coordinator does not clear `searchInput` / direction / last results because More opened.

## 14. Lifecycle / disposal

`navigatePrimary("more")` continues to dispose Review / CF1 / CF2 capture+management hosts and invalidate Saved/Entry generations. Search state preserved. Presentation refactored around existing coordinator.

## 15. Mobile / Desktop

Mobile (`<768px`): sectioned landing, 22px gutter via shell tokens, bottom-nav clearance, ≥44px controls, no Diagnostics on landing.

Desktop (`≥768px`): two-column More layout (`Contribute`/`Dictionary & data` | `Preferences`/`About`) within UX2 content width. No dashboard statistic cards.

## 16. Accessibility

Semantic `#moreHeading` (h2), section headings, real navigation buttons, native labeled Theme/Locale selects, decorative chevrons `aria-hidden`, Back keyboard-accessible, heading focus restore. No ARIA menu widget semantics.

## 17. Localization

EN/FR keys for sections, rows, help, Learning data, Back, version, local-dictionary copy. Consumer label **Corrections** (not “My corrections”). Search feedback remains **Search feedback** / **Retours de recherche**.

## 18. Explicit deferred work

```text
DICTIONARY_VISUAL_MIGRATION_DEFERRED_TO_UX2I6B
LEARNING_DATA_VISUAL_MIGRATION_DEFERRED_TO_UX2I6B
CF1_CF2_VISUAL_MIGRATION_DEFERRED_TO_UX2I7
UX2I8_READY_STATE_ACCESSIBILITY_CLEANUP_REMAINS_TRACKED
```

## 19. Unit tests

```text
web/src/render/render_more.test.ts — section order, callbacks, theme/locale, About, FR
i18n More key parity updated
```

Full suite after slice: **854 passed**; **9** `query_log_store.test.ts` baseline failures unchanged (863 total). Net +6 from More renderer tests vs UX2I5B’s 848.

## 20. UX2 More E2E

```text
npm run test:e2e:ux2-more — PASS (2/2)
```

## 21–27. Regressions

| Suite | Result |
|-------|--------|
| UX2 shell | PASS (2/2) |
| UX2 Search | PASS (2/2) |
| UX2 Saved | PASS (2/2) |
| UX2 Review | PASS (2/2) |
| Theme | PASS (3/3) |
| CF1 lifecycle | PASS |
| CF2 lifecycle | PASS |
| FH1 handoff | PASS (2/2) via `test:e2e:handoff` |
| feedback-input | PASS |
| Build | PASS |
| git diff --check | PASS |

## 28. Visual evidence

```text
data/local_evidence/ux2_more/<run_id>/
  mobile-light-more.png
  mobile-dark-more.png
  desktop-light-more.png
  desktop-dark-more.png
  mobile-dictionaries-bridge.png
  mobile-learning-data-bridge.png
```

Bridge screenshots are routing evidence only (UX2I6B fidelity not judged).

## 29. Final decision

```text
UX2I6A_MORE_PREFERENCES_ROUTING_IMPLEMENTED
```

Governing rule preserved: More explains product capabilities; it does not expose repository internals.
