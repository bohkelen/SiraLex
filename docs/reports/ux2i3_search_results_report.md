# UX2I3 — Search Home and Search Results

## 1. Decision

```text
UX2I3_SEARCH_RESULTS_IMPLEMENTED
```

## 2. BASE_COMMIT

```text
fb32888d93cca1f563fa79acb00dc8f44d3afc89
```

## 3. Figma reference

```text
https://coach-spider-78723578.figma.site/
Contemporary West African Modernism
```

Uses UX2I1 / UX2I1A semantic tokens only (no new palette / raw Figma hex scatter).

## 4. Search Home migration

Ordinary ready Search Home is now:

- bundle-derived language direction row
- underline search field (icon + `#searchInput`)
- no giant side-by-side direction button
- semantic `#searchHeading` retained (visually hidden, focusable)

Technical ready messaging and active-dictionary card remain in the DOM for diagnostics/install paths but are demoted when `data-search-ready="true"`.

## 5. Direction-control implementation

Presentation helper: `web/src/render/render_search_chrome.ts`

- `#searchSourceLanguage` / `#searchTargetLanguage` visible labels
- `#langToggle` swap control (icon-only, `aria-hidden` SVG, ≥44×44)
- dynamic `aria-label` via `search.switchDirection`
- `#searchLabel` retained as visually hidden compatibility description with current direction text

## 6. Bundle-derived labels

Labels come from `getSourceLabel` / `getTargetLabel` + active bundle `language_meta`. French/Maninka are not hardcoded in runtime presentation logic.

## 7. Search input migration

`#searchInput` remains debounce-driven (150ms unchanged). Editorial underline field with focus accent; no Search/Submit button.

## 8. Technical-status demotion

`#dictStatus` and `#activeDictionarySummary` keep update functions; CSS demotes them for ready state. First-run install UI remains available when no active dictionary.

## 9. Search result visual model

`render_results.ts` uses hairline-separated rows (typography + dividers), not card chrome. No terracotta “best result” ranking bar.

## 10. lexicon_entry behavior

Primary lexical headword (serif role), optional POS, optional gloss. Optional fields omitted cleanly.

## 11. index_mapping behavior

Rendered as mapping summary (`source` + `target · target · …`), not fabricated lexicon rows. Existing click → entry behavior unchanged.

## 12. ordering invariant

Renderer order = provided `lastSearchResults` order = runtime/bundle order. No alphabetical sort / promotion.

## 13. Phase 7G interpretability preservation

Neutral query hint + `Why this result?` disclosure retained and visually demoted. Internal match-key / ir_id / provenance labels stay out of ordinary summaries.

## 14. CF2 results-not-useful presentation

Single bottom affordance retained. Copy:

- EN: “Didn't find what you needed?” / “Tell us what you were looking for →”
- FR: equivalent

Capture form itself not redesigned (UX2I7).

## 15. no-result presentation

`#searchMeta` carries calm no-result / phrase guidance with exact query provenance. CF2 invitation is secondary (“Looking for something else?” / report CTA). `result_state = no_result` lifecycle unchanged.

## 16. error-state distinction

Search execution errors still set distinct `search.error` meta text and clear results; not styled as zero-results.

## 17. mobile layout

`<768px`: wordmark → direction → field → meta → results → CF2 → bottom nav. 22px gutter preserved; bottom padding reserved for nav.

## 18. desktop Search rail

`≥768px` and `data-primary="search"`: `#searchChrome` in sticky context rail (`--layout-rail-width-min/max`); `#searchResults` main pane. No rails for Saved/Review/More.

## 19. Search state restoration

UX2I2 invariant preserved: leave Search → return restores query, direction, result/no-result surface without automatic rerun (shell + UX2 search E2E).

## 20. accessibility

Semantic heading; labeled input; dynamic swap name; visible focus; 44×44 swap; keyboard-activatable rows; CF2 CTA keyboard accessible; result count in `#searchMeta` (`aria-live="polite"`); action text uses `--color-action-text`.

## 21. localization

Added EN/FR keys for switch direction, lightweight result count, looking-for-something-else, CF2 Search CTAs, calmer no-result guidance. Key parity covered by TypeScript `TranslationKey` + i18n tests.

## 22. explicit non-goals

Entry Detail, Saved, Progress, Review, More final hierarchy, CF1/CF2 forms, Recent searches, suggestions, fuzzy/ranking, animations, new linguistic inference — not in this slice.

## 23. unit tests

```text
render_results.test.ts — PASS
render_search_chrome.test.ts — PASS
render_search_feedback_capture.test.ts — PASS
i18n UX2I3 keys — PASS
```

## 24. UX2 Search E2E

```text
npm run test:e2e:ux2-search — PASS (2/2)
```

## 25. shell E2E

```text
npm run test:e2e:ux2-shell — PASS (2/2)
```

## 26. CF2 lifecycle E2E

```text
npm run test:e2e:search-feedback — PASS (7/7)
```

## 27. direct-entry navigation E2E

```text
e2e/navigation/source_result_direct_entry.spec.ts — PASS (1/1)
```

## 28. theme E2E

```text
npm run test:e2e:theme — PASS (3/3)
```

## 29. full suite

```text
npm --prefix web run test:run
→ 9 failed | 840 passed
→ failures only in query_log_store.test.ts (known baseline)
```

Also: `npm run test:e2e:feedback-input` — PASS.

## 30. build

```text
npm --prefix web run build — PASS
```

## 31. visual evidence path

```text
data/local_evidence/ux2_search_results/2026-08-05T00-39-06-767Z/
  mobile-light-search-home.png
  mobile-light-results.png
  mobile-dark-results.png
  mobile-no-result.png
  desktop-light-results.png
  desktop-dark-results.png
```

Ignored via `data/*` gitignore; not committed.

## 32. git diff --check

```text
PASS
```

## 33. exact files changed A/M/D

See completion response / `git status` after commit.

## 34. exact untracked files

Pre-existing: `web/scripts/` (unchanged, not part of this slice).

## 35. working-tree status

Clean after commit for UX2I3 files; `web/scripts/` may remain untracked baseline.

## 36. final decision

```text
UX2I3_SEARCH_RESULTS_IMPLEMENTED
```
