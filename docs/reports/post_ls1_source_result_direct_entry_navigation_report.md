# Post-LS1 — Source Result Direct Entry Navigation

## Decision

```text
SOURCE_RESULT_DIRECT_ENTRY_NAVIGATION_IMPLEMENTED
```

Product decision selected:

```text
SOURCE_RESULT_DIRECT_ENTRY_NAVIGATION_SELECTED
```

---

## 1. Previous behavior

From a Source → Target index-mapping entry, clicking a Maninka target link:

1. wrote `display_text` into `#searchInput`;
2. left direction at Source → Target;
3. called `runSearch` / `triggerSearch`.

That re-query used Maninka text under a source-language direction, often producing misses or unrelated results.

Affected path: `render_entry.ts` `onSearch(target.display_text)` → `main.ts` `triggerSearch`.

---

## 2. Selected behavior

When the user selects a Maninka lexicon target from an index mapping:

1. resolve `target.anchor` as `ir_id` in the active storage scope;
2. confirm `ir_kind === "lexicon_entry"`;
3. switch visible/internal direction to Target → Source;
4. open the existing lexicon-entry detail surface;
5. preserve the original search query and result list for Back;
6. do **not** call `runSearch`;
7. do **not** rewrite the search input to the Maninka headword;
8. keep the LS1 Save affordance on the opened lexicon entry.

---

## 3. Affected interaction and files

| Area | File |
| --- | --- |
| Index-mapping target links | `web/src/render/render_entry.ts` |
| App navigation / direction / Back | `web/src/main.ts` |
| Direct-open helper | `web/src/navigation/open_target_lexicon_entry.ts` |
| i18n | `web/src/i18n.ts` |
| Minimal status CSS | `web/src/style.css` |
| Tests | `web/src/navigation/*.test.ts`, `web/src/render/render_entry_target_navigation.test.ts` |
| Playwright | `web/e2e/navigation/source_result_direct_entry.spec.ts` |
| This report | `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md` |

Unrelated result-card Open behavior (opens the mapping/record itself) is unchanged.

---

## 4. Direct-entry resolution path

```text
TargetEntry.anchor
  → resolveRecords(activeStorageScope, [ir_id])
  → require lexicon_entry + lexicon display
  → setDirection(target_to_source)
  → showEntryDetail(liveRecord, restoreDirection=prior)
```

No text matching. No fake entry construction from the index mapping.

---

## 5. Direction synchronization

`setSearchDirection` updates:

- internal `searchDirection`
- toggle label via `updateLangToggle()`
- search label and direction-dependent placeholder

Direction change during navigation does **not** append a query log.

---

## 6. Search-field preservation

Opening by `ir_id` never assigns the Maninka headword to `#searchInput`.
Stale guards also treat a changed input value as navigation invalidation.

Example: query `alpha_fr` → open `alpha_mnk` → input remains `alpha_fr`.

---

## 7. Back-navigation context

Entry origin:

```ts
type EntryNavOrigin =
  | { kind: "search"; restoreDirection: SearchDirection }
  | { kind: "saved_vocabulary" };
```

Back from a target-opened lexicon entry:

- restores `restoreDirection` (Source → Target when opened from that context);
- restores `lastSearchResults` via `showResultsList()`;
- does not call `runSearch`.

Saved Vocabulary open/back path unchanged.

---

## 8. Save-affordance compatibility

Opened destination is a true lexicon entry, so LS1 Save remains available.
Learning Record identity stays `(bundle_id, ir_id)` for the Maninka entry.
Index mappings are not saved.

---

## 9. Stale-async handling

Pending open captures:

- `entryDetailGeneration`
- `searchSeq`
- `resultsHostContext`
- active `bundle_id`
- preserved search-input value

Late resolution returns `stale` and does not open or switch direction.
Prefer resolve-first; direction switches only after successful resolution.

---

## 10. Accessibility and localization

- Target controls remain real `<button type="button">` elements.
- Accessible name: `entry.openTarget` (“Open entry: {headword}” / FR parity).
- Unavailable: `entry.targetUnavailable` on `#entry-target-status` (`role="status"`).
- Focus moves to `.entry-headword` (tabIndex -1) after open.
- No fake second-search announcement.

---

## 11. Tests

| Suite | Coverage |
| --- | --- |
| `open_target_lexicon_entry.test.ts` | open by ir_id; empty/missing/non-lexicon; stale; no search |
| `source_result_direct_entry_navigation.test.ts` | direction/Back/Save-identity/stale/bundle-switch contracts |
| `render_entry_target_navigation.test.ts` | callback identity; Save on lexicon; unavailable status |
| LS1 / results regressions | persistence, entry learning, Saved Vocabulary nav, results, entry learning render |
| Playwright | Source→Target `alpha_fr` → target link → lexicon + direction + Back |

---

## 12. Alternative options (not implemented)

| Option | Status | Rationale |
| --- | --- | --- |
| A — Direct open without direction change | `REJECTED_FOR_CURRENT_PRODUCT_MODEL` | Visible direction would disagree with Maninka entry context |
| B — Switch direction and rerun search | `REJECTED_AS_REDUNDANT` | Loses ir_id certainty; extra ranking/async |
| C — Keep previous text-search behavior | `REJECTED_AS_INCONSISTENT` | Query language conflicts with direction |

---

## 13. Deviations / unresolved

`triggerSearch` was removed from the entry-detail wiring path (no remaining callers in `main.ts` for target links). Search input debounce/`runSearch` for typed queries is unchanged.

### Featured-bundle anchor correction

Initial implementation treated `TargetEntry.anchor` only as `ir_id`. That is
correct for the debug directional fixture, but the featured Mali-pense bundle
stores HTML fragment ids (e.g. `e1385`) that match
`record_locator.source_record_id` on the lexicon entry — **not** `ir_id`
(`anchors_ok` as ir_id = 0 in that bundle).

Resolution order is now:

1. treat `anchor` as `ir_id`;
2. else find lexicon entry by `record_locator.source_record_id === anchor`
   within the active storage scope.

Still no text re-search. Still no translation-pair Learning Records.

---

## 14. Validation results

| Check | Result |
| --- | --- |
| Focused direct-navigation + LS1 regression Vitest | **80 passed** (8 files, pre-full-suite) |
| Playwright (`source_result_direct_entry` + LS1 offline) | **2 passed** |
| Full `npm run test:run` | **36 files / 351 tests passed** |
| `npm run build` | **Pass** |
| `git diff --check` | Clean |

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `SOURCE_RESULT_DIRECT_ENTRY_NAVIGATION_IMPLEMENTED` |
| Navigation | Direct `ir_id` open + Target → Source switch |
| Search | Not re-run for target selection |
| Next milestone | `LS2 — Review and Reflect` |
