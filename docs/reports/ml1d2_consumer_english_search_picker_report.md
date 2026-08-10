# ML1D2 — Consumer English Search Picker + Preference Restore

**Decision:** `ML1D2_CONSUMER_ENGLISH_SEARCH_PICKER_ACCEPTED`  
**Amendments:** `ML1D2A_CAPABILITY_RECOVERY_AND_BROWSER_VERIFIED` + `ML1D2A1_E2E_SEAM_CONTAINED`  
**BASE_COMMIT:** `040b4d9b03371bc09a76162d35fe3f283aeb4316`  
**Commit:** created after final validation (see git log)

---

## Summary

ML1D2 exposes the FR/EN partner language on consumer Search when the active bundle advertises English capability, restores `siralex.search_lookup_lang` after active-bundle capability is known, and drives Search chrome presentation from `LookupMode` (not ambiguous `SearchDirection`).

ML1D1 execution, capability gating, swap, query-log V3, and CF2 identity are reused unchanged in schema.

### Preserved contracts

- LookupMode remains runtime source of truth
- FR/EN picker only appears on English-capable bundles
- Maninka remains static endpoint
- Explicit FR/EN choice preserves orientation
- Preference written only on explicit FR/EN selection
- Startup restores preference in forward orientation
- Bundle-id change restores preference
- Same-bundle EN false→true restores preference
- Same-capability update preserves orientation
- Capability loss clamps effective state but retains stored preference
- Query-log V3 unchanged
- CF2 schema unchanged
- IndexedDB remains v6
- Production build exposes no E2E refresh hook
- Dedicated ML1D2 E2E build may expose gated refresh hook
- UI locale remains independent of dictionary lookup language

---

## Checklist

| Check | Result |
| ---------------------------------------------- | ----------- |
| English picker exposed | PASS (when active bundle supports EN) |
| LookupMode remains sole runtime source | PASS |
| Default FR→MNK | PASS |
| Stored FR restore | PASS → FR→MNK |
| Stored EN restore on capable bundle | PASS → EN→MNK |
| Stored EN downgrade on unsupported bundle | PASS → FR→MNK effective |
| Stored EN retained across capability downgrade | PASS (preference not erased) |
| Same-bundle EN capability recovery | PASS (ML1D2A) |
| Same-capability content update preserves orientation | PASS (ML1D2A) |
| FR→MNK ↔ MNK→FR swap | PASS |
| EN→MNK ↔ MNK→EN swap | PASS |
| Explicit FR/EN selection preserves orientation | PASS (`withPartnerLookupLanguage`) |
| `src_*` search | PASS (unchanged ML1D1 path) |
| `en_*` search | PASS (unchanged ML1D1 path) |
| `tgt_*` search | PASS (unchanged ML1D1 path) |
| Presentation follows LookupMode | PASS |
| UI locale independent of lookup language | PASS |
| Query-log V3 pair matches search | PASS (unchanged write path) |
| CF2 pair matches search | PASS (unchanged snapshot binding) |
| Query-log schemas changed | NO |
| CF2 schema changed | NO |
| IDB version | 6 |
| Production E2E hook exposed | NO |
| Unit suite | **951 passed** |
| Picker E2E | PASS (`test:e2e:ml1d2-picker`, 3 tests) |
| Search E2E | PASS (`test:e2e:ux2-search`) |
| CF2 E2E | PASS (`test:e2e:search-feedback`, `test:e2e:ux2-search-feedback`) |
| Build | PASS |
| `git diff --check` | PASS |
| Final decision | `ML1D2_CONSUMER_ENGLISH_SEARCH_PICKER_ACCEPTED` |

---

## ML1D2A — Capability recovery + real-browser verification

### Preference restoration (corrected)

Preference restoration occurs on:

- **initial hydration**
- **active logical `bundle_id` change**
- **English capability recovery** (`unavailable → available`) on the same `bundle_id`

Same-bundle ordinary content updates with **unchanged** English capability **preserve** the current LookupMode including swap orientation (revalidate only).

Capability loss (`available → unavailable`) **revalidates/clamps** the effective mode (EN endpoints → FR→MNK) and **does not** overwrite `siralex.search_lookup_lang`.

Pure policy: `decideLookupModeActiveBundleSync` in `lookup_mode_active_bundle_sync.ts`.  
Runtime wiring: `syncLookupModeForActiveBundle` in `main.ts` tracks `lastKnownEnglishAvailable` separately from `bundle_id`.

### High-risk excerpt (`main.ts`)

**Before (defect):** restore only on `!hydrated || bundle_id change`; same-bundle EN false→true left effective FR→MNK.

**After:**

```ts
const action = decideLookupModeActiveBundleSync({
  hydrated: lookupPreferenceHydrated,
  previousBundleId,
  nextBundleId,
  previousEnglishAvailable: lastKnownEnglishAvailable,
  nextEnglishAvailable,
});
// restore_preference_forward | revalidate_current | default_fr_mnk
```

Preference writes remain only on explicit partner selection (`setPartnerLookupLanguage(..., { persist: true })`), which also clears CF2 executed-search snapshot and does **not** append a query log.

### Browser fixture

`web/public/debug-bundles/test_ml1d2_en_bundle`

- `bundle_id`: `bundle_ml1d2_en_debug_v1`
- directional index
- `lookup_languages`: fr, en, mnk
- `search_key_families`: src, en, tgt
- controls: FR `ouverture`/`alpha_fr`, EN `house`, MNK `house_mnk` (+ existing tgt terms)

FR-only contrast: existing `test_directional_bundle` (no EN capability fields).

### Playwright scenarios (`e2e/ml1d2_english_search_picker.spec.ts`)

1. EN-capable: picker visible, FR→EN selection, EN search `house`, swap endpoint movement, MNK→EN `house_mnk`, preference reload (swap not persisted), French UI + Anglais option + EN lookup.
2. FR-only: `search-partner-language` count 0; static French; swap still works.
3. Same-bundle capability loss/recovery via IDB meta patch + gated
   `__siralexRefreshDbStatus` (only when `VITE_E2E_TEST_HOOKS=true`; stored `en`
   retained; effective restores EN→MNK).

### ML1D2A1 — E2E refresh seam containment

- Hook install: `installE2ERefreshDbStatusHook` / `shouldExposeE2ERefreshHook`
- Call site in `main.ts` gated on `import.meta.env.VITE_E2E_TEST_HOOKS === "true"`
  so ordinary production builds dead-code-eliminate the install path (no
  `__siralexRefreshDbStatus` string in `dist/`)
- Ordinary production build: hook undefined
- Picker E2E: dedicated Vite outDir `dist-ml1d2-e2e` with `VITE_E2E_TEST_HOOKS=true`
- Does not describe the global hook as consumer runtime API

---

## ML1D2A — Partner language picker

- Chrome hosts `#searchSourceLanguage` / `#searchTargetLanguage` render either:
  - static Maninka label, or
  - FR/EN `<select data-testid="search-partner-language">` on the non-Maninka endpoint.
- English options appear only when `bundleSupportsEnglishLookup(active meta)`.
- Selection uses `withPartnerLookupLanguage` (preserves orientation; does not call swap).
- Explicit selection persists preference via `writeSearchLookupLangPreference`.

## ML1D2B — Preference restore

See ML1D2A correction above for the full restore matrix.

## ML1D2C — Presentation

`applyLookupModePresentation` sets labels, accessible swap name, `#searchLabel`, and placeholder from `LookupMode` + i18n:

- `lookup.lang.fr` / `lookup.lang.en` / `lookup.lang.mnk`
- `lookup.partnerSelect`

UI locale and lookup language remain independent (e.g. French UI + EN→MNK).

---

## Files

### Modified (full ML1D2 + ML1D2A + ML1D2A1 tree)
- `web/src/main.ts`
- `web/src/search/lookup_mode.ts`
- `web/src/search/lookup_mode.test.ts`
- `web/src/search/search_lookup_lang_preference.ts`
- `web/src/search/search_lookup_lang_preference.test.ts`
- `web/src/i18n.ts`
- `web/src/style.css`
- `web/src/vite-env.d.ts`
- `web/e2e/helpers/ux2_nav.ts`
- `web/package.json`
- `.gitignore` (`web/dist-ml1d2-e2e/`)

### Added
- `web/src/render/render_lookup_mode_chrome.ts`
- `web/src/render/render_lookup_mode_chrome.test.ts`
- `web/src/search/ml1d2_preference_restore.test.ts`
- `web/src/search/lookup_mode_active_bundle_sync.ts`
- `web/src/search/lookup_mode_active_bundle_sync.test.ts`
- `web/src/e2e_test_hooks.ts`
- `web/src/e2e_test_hooks.test.ts`
- `web/e2e/ml1d2_english_search_picker.spec.ts`
- `web/playwright.ml1d2.config.ts`
- `web/public/debug-bundles/test_ml1d2_en_bundle/*`
- `docs/reports/ml1d2_consumer_english_search_picker_report.md` (this file)

### Unexpected changes
- NONE

### Scope deviations
- E2E lifecycle hook `__siralexRefreshDbStatus` is **test/debug gated** via
  `VITE_E2E_TEST_HOOKS=true` (dedicated `playwright.ml1d2.config.ts` /
  `dist-ml1d2-e2e`). It is **absent** from ordinary `npm run build` / production
  preview and is **not** part of the consumer runtime API.

### Untracked unrelated
- `web/scripts/capture_ui_screenshots.mjs`

---

## Working tree

Accepted on `feat/phase-2.0.5-offline-pwa`.  
Final decision: `ML1D2_CONSUMER_ENGLISH_SEARCH_PICKER_ACCEPTED`.
