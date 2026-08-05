# UX2I2 — Responsive Application Shell and Primary Navigation

## 1. Decision

```text
UX2I2_RESPONSIVE_SHELL_NAVIGATION_IMPLEMENTED
```

## 2. BASE_COMMIT

```text
936ca29087ad8ad15dd06169a10f662a27ea40d8
```

## 3. UX2 navigation amendment

```text
UX2_NAVIGATION_AMENDMENT
IMPLEMENTED
```

Review is now a stable top-level primary destination (`search | saved | review | more`).

This changes entry/navigation only. Review eligibility, active-bundle scope, ordering, ephemeral session behavior, Reveal, Still learning / Remembered persistence, and completion semantics remain owned by the existing Review host.

Historical Saved → Review entry still works; primary destination switches to `review`. Review Back returns to Saved and syncs primary nav to `saved`.

## 4. PrimaryDestination model

```ts
type PrimaryDestination = "search" | "saved" | "review" | "more";
```

Kept separate from `ResultsHostContext` (`search | saved_vocabulary | entry_from_search | entry_from_saved | review`).

Initial destination: `search`. Not persisted to IndexedDB/localStorage.

Coordinator: `navigatePrimary(destination)` in `main.ts`.

## 5. Mobile shell

Viewport `<768px` (CSS):

- Fixed bottom primary nav (`--layout-nav-height-mobile` + safe-area)
- Icon + visible text label for Search / Saved / Review / More
- Touch targets ≥ 44×44 CSS px
- Main content padded above the nav
- Active label uses `--color-action-text`; icon accent uses `--color-accent`
- Inactive uses muted text
- No floating pill container

## 6. Desktop shell

Viewport `≥768px` (CSS):

- Compact top header: SiraLex wordmark (`.ux2-type-wordmark`) + primary nav
- Same destinations and active state as mobile
- Mobile bottom positioning disabled via media query
- Desktop context rail **not** implemented (deferred)

Single shared nav DOM (CSS repositions); no separate desktop navigation state.

## 7. Search behavior

`navigatePrimary("search")`:

- Shows Search chrome
- Preserves input text, direction, `lastSearchResults`, `lastExecutedSearch`
- Restores result presentation when valid; does not auto-rerun search
- Entry detail / CF2 capture remain under Search destination semantics

## 8. Saved behavior

`navigatePrimary("saved")` → existing `showSavedVocabulary()`.

Transitional Saved Back → `navigatePrimary("search")` (syncs nav).

## 9. Review top-level behavior

`navigatePrimary("review")` → existing `showReviewSurface()`.

Empty/no-reviewable states use the existing Review host empty UI. Nav item is never removed/disabled.

Saved → Start/Continue Review sets primary destination to `review`.

## 10. More transitional bridge

Minimal More landing (`#moreDestination`) with:

- My corrections
- Search feedback
- Dictionaries
- Theme
- Interface language

Not the final UX2I6 More redesign.

## 11. Theme relocation

Theme control moved from permanent header into More.

Preserved: `siralex.ui_theme` / `system|light|dark` / UXT1 apply path. No second theme store.

## 12. Locale relocation

Locale control moved into More.

Preserved: `siralex.ui_locale` and reload-on-change behavior. Independent of dictionary search direction.

## 13. Management Back behavior

Manage Corrections / Manage Search Feedback Back → More landing (`navigatePrimary("more")`).

No Search-result detour when entered from More.

## 14. Search-state preservation

Verified by UX2 shell E2E: leave Search with query/results → Saved/Review/More → return Search restores query and results.

## 15. Lifecycle/disposal behavior

Existing dispose/generation architecture preserved:

- Review host
- CF1 form / management
- CF2 capture / management

`navigatePrimary` and surface `show*` functions continue explicit disposal before replace. Stale-host protections unchanged.

## 16. Accessibility

- `<nav aria-label="Primary">` (EN/FR)
- Buttons with `aria-current="page"` only on active destination
- Icons `aria-hidden="true"`; labels carry meaning
- Focus-visible via `--color-focus` ring
- Focus targets: Search heading, Saved heading, Review heading, More heading
- Does not claim ARIA tablist semantics

## 17. Responsive behavior

CSS-only breakpoint at 768px. Resizing does not recreate application state.

## 18. Advanced-tools boundary

Diagnostics, Developer tools, manual bundle import, catalog tooling, query-log tooling remain in legacy location.

Final consumer/advanced separation deferred to UX2I8.

## 19. Explicitly deferred UX2 work

- Search field/direction visual composition
- Results / Entry Detail / N’Ko arrangement redesign
- Saved rows / Progress / Review recall-reveal visual redesign
- CF1/CF2 form visual redesign
- Final More hierarchy
- Dictionary manager visual redesign
- Desktop context rail
- Recent search history
- URL router / deep linking
- New settings/analytics/counters

## 20. Unit tests

```text
render_primary_navigation.test.ts — PASS (7)
i18n.test.ts nav/More keys — PASS
theme / theme_contrast — PASS
```

## 21. UX2 shell E2E

```text
npm --prefix web run test:e2e:ux2-shell
→ 2 passed (mobile + desktop)
```

## 22. Theme E2E

```text
npm --prefix web run test:e2e:theme
→ 3 passed
```

Updated to use primary nav + More for Theme/Locale/management. Former `.saved-vocab-back` instability path removed.

## 23. Feedback-input E2E

```text
npm --prefix web run test:e2e:feedback-input
→ 1 passed
```

## 24. Full test suite

```text
npm --prefix web run test:run
→ Test Files  1 failed | 83 passed (84)
→ Tests       9 failed | 834 passed (843)
```

The 9 failures remain the pre-existing `query_log_store.test.ts` IndexedDB baseline (unchanged on BASE_COMMIT). No new unit failures.

Also run:

```text
test:e2e:corrections → 7 passed
test:e2e:search-feedback → 7 passed
```

## 25. Build

```text
npm --prefix web run build
→ PASS
```

## 26. git diff --check

```text
PASS
```

## 27. Exact files changed A/M/D

See completion response / `git diff --name-status` against BASE_COMMIT.

## 28. Exact untracked files

```text
?? web/scripts/   (pre-existing; not part of UX2I2)
```

## 29. Working-tree status

See completion response after commit.

## 30. Final decision

```text
UX2I2_RESPONSIVE_SHELL_NAVIGATION_IMPLEMENTED
```
