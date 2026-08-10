# RL1 — Russian Consumer-Surface Removal

**Decision:** `RL1_RUSSIAN_CONSUMER_SURFACES_ACCEPTED`
**BASE_COMMIT:** `a5a72f8bd29c143e0a08827958aeaccaab0f4805`
**Commit:** created after final validation (see git log)

---

## Final architectural contract

- Russian source/provenance data remains stored
- Production corpus is unchanged
- `gloss_ru` / `trans_ru` remain valid record fields
- `LookupLanguage` remains `fr | en | mnk`
- Russian is never a Search fallback
- Russian is not rendered by Result / Entry / Saved / Review consumer paths
- New CF1 capture offers FR/EN translation targets only
- `correction_draft_v1` remains unchanged
- Historical `gloss_lang="ru"` drafts remain valid
- Historical RU drafts remain manageable
- Historical RU drafts may be edited without changing their target
- Historical RU drafts remain exportable
- Historical RU management label remains available
- No automatic retarget RU → FR/EN
- No schema migration
- IndexedDB remains v6
- Learning / query-log / CF2 schemas unchanged
- Bundle/index builders and production corpus remain unchanged

`playwright.ml1d2.config.ts` is shared by the ML1D2 / ML1D3 / RL1 debug-bundle
Playwright suites (test harness only). This is **not** a product/runtime change.

---

## Summary

Russian remains stored source/provenance data. Ordinary consumer Search, Entry,
Saved, Review, and new CF1 Suggest Correction capture no longer offer or reveal
Russian. Historical CF1 drafts targeting `gloss_lang: "ru"` remain
schema-valid, manageable, editable without retarget, and exportable.

---

## Repository RU classification matrix

| Location | Hit | Class | Action |
|---|---|---|---|
| `web/src/types/records.ts` (`gloss_ru`, `trans_ru`) | source fields | A SOURCE / CORPUS | preserve |
| Production `records.jsonl` / corpus bundles | RU glosses | A | preserve (untouched) |
| `api/ir_parser/...`, enrichment tests | extraction | A / B BUILD | preserve |
| `api/search_index/`, `api/bundle_builder/` | builders | B | preserve (untouched) |
| `correction_draft_types.ts` `gloss_lang: "fr"\|"en"\|"ru"` | schema | C HISTORICAL | preserve |
| `correction_draft_types.test.ts` RU target | validator | C / F | preserve |
| Management `translationRuOnly` i18n + label | manage UI | C | retain |
| `resolve_preferred_gloss.ts` / `lookup_mode.ts` | presentation | D already RU-free (ML1D3) | no semantic change |
| `render_results.ts` / `render_entry.ts` | presentation | D already RU-free | no semantic change |
| `review_display.ts` | Review extract | D already FR+EN only | no code change |
| `build_display_cache.ts` / Saved session | Saved | D already FR/EN | no code change |
| `buildCorrectionTargetOptions` RU option | new capture | E NEW CAPTURE | **removed** |
| Form i18n `translationRu` | creation label | E | **removed** |
| Debug fixture `gloss_ru` / `trans_ru` | suppression proof | F TEST FIXTURE | **kept / added** |
| Unit/E2E RU markers (`дом`, `рука`, …) | suppression proof | F | retain |

Do not treat every `"ru"` token as consumer UI (schema, provenance, Cyrillic in
source fixtures are intentional).

---

## Source / provenance retention

- Record types keep `gloss_ru` / `trans_ru`.
- Production dictionary records unchanged.
- Corpus/build/audit tooling unchanged.
- Debug fixture intentionally contains RU to prove suppression.

---

## Search presentation

Already correct from ML1D3:

| Preference | Chain |
|---|---|
| FR | FR → EN → unavailable |
| EN | EN → FR → unavailable |
| Russian | NEVER |

No semantic change to `render_results.ts`. Added/retained unit coverage for
FR+EN+RU and RU-only unavailable.

`LookupLanguage` remains `"fr" | "en" | "mnk"`. Regression asserts `ru` is not a
valid LookupLanguage/LookupMode endpoint.

---

## Entry presentation

Already FR/EN via `resolvePreferredGloss`. `gloss_ru` / `trans_ru` are never
rendered. Underlying record objects still carry RU fields. Example fixture now
includes `trans_ru` so tests prove example suppression.

---

## Saved presentation

Resolved live rows: FR/EN preference only (`resolvePreferredGloss`).
Unresolved `display_cache`: FR-then-EN (unchanged Learning schema).
No Russian fallback. No Learning mutation. Existing ML1D3 Saved coverage cited;
no redundant Saved E2E added.

---

## Review presentation

`review_display.ts` extracts only `gloss_fr` / `gloss_en` (and FR/EN example
translations). RU was already excluded under LS2 dual reveal. **No Review code
changes; Review/LS2 E2E not required** (extractor is already FR/EN-only).

Evidence excerpt:

```45:47:web/src/render/review_display.ts
  const glosses: string[] = [];
  if (sense.gloss_fr) glosses.push(sense.gloss_fr);
  if (sense.gloss_en) glosses.push(sense.gloss_en);
```

---

## CF1

### Historical schema compatibility

- Schema still permits `gloss_lang: "fr" | "en" | "ru"`.
- `correction_draft_v1` unchanged. No CF1 v2. No serialized schema change.
- Validator continues accepting historical RU drafts.

### New-capture restriction

- `buildCorrectionTargetOptions` no longer emits RU translation options.
- Added `isConsumerCreatableCorrectionTarget` / `isConsumerCreatableGlossLang`
  (`fr`/`en` only).
- Form label type narrowed to creatable FR/EN.

### Target generation

For a sense with FR+EN+RU, new options include French/English meanings only.

### Management

`translationRuOnly` retained so historical RU drafts identify accurately.

### Editing

When a historical RU draft is edited against matching live content, the RU
target key is absent from new-capture options, so
`editRetargetAllowed` becomes `false`. Description/proposed edits retain the
original RU target and snapshot. No auto-retarget to FR/EN.

### Export

Export retains `"gloss_lang":"ru"` for historical drafts (unit-proven).

---

## i18n decision

| Key | Decision |
|---|---|
| `correctionFeedback.form.target.translationRu` | removed (creation-only) |
| `correctionFeedback.manage.target.translationRuOnly` | retained (historical manage) |
| No locale `"ru"` | unchanged |
| No Search partner RU option | unchanged |
| No Entry RU heading | unchanged |

---

## LookupMode / CF2

- LookupMode unchanged (`fr`/`en`/`mnk` pairs only).
- CF2 unchanged (FR↔MNK / EN↔MNK only).
- Query-log schema unchanged.

---

## IDB impact

`SIRALEX_DB_VERSION = 6` — no migration.

---

## Data / build impact

| Area | Change |
|---|---|
| `api/search_index/` | NONE |
| `api/bundle_builder/` | NONE |
| Production corpus / `source_ir` / `normalized` | NONE |
| Debug `test_ml1d2_en_bundle` records | RU fields added for suppression proof; hashes refreshed |

---

## Test harness note

`web/playwright.ml1d2.config.ts` is currently shared by ML1D2, ML1D3, and RL1
debug-bundle E2E suites (`testMatch` includes `ml1d[23]_` and `rl1_`). This is
harness wiring only — not a product or runtime behavior change.

---

## Browser evidence (RL1 E2E)

`web/e2e/rl1_russian_consumer_surfaces.spec.ts` against bilingual+RU fixture:

- A EN→MNK: English gloss visible; `дом` absent from sense
- B FR→MNK: French gloss visible; `дом` absent
- C Entry: sense RU + example `trans_ru` absent; EN example shown
- D Suggest Correction: `translation:0:fr` + `translation:0:en` present;
  `translation:0:ru` absent; no “Russian meaning” option text

---

## Historical RU-draft evidence

`web/src/corrections/rl1_historical_ru_correction.test.ts`:

- Validator accepts RU target
- Management label = Russian meaning in sense 1
- Edit description keeps `gloss_lang: "ru"`
- Export JSON contains `"gloss_lang":"ru"`
- Delete works
- New target generation omits RU

---

## High-risk excerpts

### `correction_form_model.ts` — new-capture omits RU

Previous: when `gloss_ru` present, pushed `translation:{i}:ru`.
New: FR/EN only; RU remains on live entry.

```ts
// RL1: Russian remains source data on the live entry but is never offered
// as a new consumer correction target (historical RU drafts stay valid).
```

### `correction_draft_types.ts` — schema comment

Schema still allows `"ru"` for historical drafts; UI creation restricted.

### `render_correction_form.ts`

Creation labels are FR/EN only (no RU branch).

### `render_correction_management.ts`

Exports `formatCorrectionManagementTargetLabel` including RU-only historical
label.

### `i18n.ts`

Removed creation `translationRu`; retained manage `translationRuOnly`.

---

## Unexpected changes

NONE beyond RL1 scope. Pre-existing untracked
`web/scripts/capture_ui_screenshots.mjs` left untouched (not part of RL1).

---

## Scope deviations

NONE.

Debug fixture previously lacked `gloss_ru` despite ML1D3 commentary; RL1 added
`gloss_ru` + example `trans_ru` so real-browser suppression is falsifiable.

---

## Final validation (pre-commit)

| Suite | Result |
|---|---|
| `npm --prefix web run test:run` | 99 files / 975 tests passed |
| `npm --prefix web run test:e2e:rl1` | 4 passed |
| `npm --prefix web run test:e2e:ml1d3` | 7 passed |
| `npm --prefix web run test:e2e:ux2-entry` | 4 passed |
| `npm --prefix web run test:e2e:ux2-saved` | 2 passed |
| Review / LS2 E2E | not required (Review unchanged; FR/EN-only extractor) |
| `npm --prefix web run test:e2e:corrections` | 7 passed |
| `npm --prefix web run build` | PASS |
| `git diff --check` | PASS |

---

## Files committed

### Modified (M)

- `web/package.json`
- `web/playwright.ml1d2.config.ts`
- `web/public/debug-bundles/test_ml1d2_en_bundle/bundle.manifest.json`
- `web/public/debug-bundles/test_ml1d2_en_bundle/checksums.sha256`
- `web/public/debug-bundles/test_ml1d2_en_bundle/records.jsonl`
- `web/src/corrections/correction_draft_types.ts`
- `web/src/corrections/correction_form_model.test.ts`
- `web/src/corrections/correction_form_model.ts`
- `web/src/i18n.ts`
- `web/src/render/render_correction_form.ts`
- `web/src/render/render_correction_management.ts`
- `web/src/render/render_entry_ux2.test.ts`
- `web/src/render/render_results.test.ts`
- `web/src/search/lookup_mode.test.ts`

### Added (A)

- `docs/reports/rl1_russian_consumer_surface_removal_report.md`
- `web/e2e/rl1_russian_consumer_surfaces.spec.ts`
- `web/src/corrections/rl1_historical_ru_correction.test.ts`

### Deleted (D)

NONE

---

## Excluded from commit

- `web/scripts/capture_ui_screenshots.mjs` (pre-existing untracked)
- generated `dist/`
- `test-results/`
- local evidence
