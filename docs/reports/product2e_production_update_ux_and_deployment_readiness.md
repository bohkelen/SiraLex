# PRODUCT2E — Production Update UX and Deployment Readiness

## 1. Decision

**PRODUCT2E_PRODUCTION_UPDATE_UX_AND_DEPLOYMENT_READY** (implementation gate)

Finalization commit decision is recorded after PRODUCT2E-A2:
**PRODUCT2E_PRODUCTION_UPDATE_UX_COMMITTED** when localization + governance
reconciliation are committed (core UX landed in `b414fec`; A1 locale fields in the
follow-up commit).

Existing-user featured-lineage update detection and consumer UX are implemented,
release notes are derived from a measured public-bundle delta (EN/FR), production
`web/dist` was built and verified, and Netlify deployment was **not** performed.

## 2. Repository vs production state

| Layer | State |
|-------|-------|
| **REPOSITORY_PUBLISHED** | **YES** — HEAD `2327fdd88558e138f8ed36c4d8ca3290c80344a2` contains featured `bundle_noncommercial_dfd5ba62` and immutable `web/public/bundle_noncommercial_dfd5ba62__51c38a75/` |
| **NETLIFY_DEPLOYED** | **NO / not performed in this workflow** — current production site has not been rebuilt from this repository state by PRODUCT2E |
| **USER_INSTALLED** | **Independent** — device IndexedDB may still hold `bundle_full_20260710_337619ff` until the user installs the featured update after a Netlify app deploy |

Do not claim production users have the new dictionary merely because `web/public` contains it.
Do not claim post-deployment validation; Netlify deploy remains a separate human step.

## 2b. Phase 7N1 manual-package track (separate)

Catalog/Netlify update (this report) does **not** close Phase 7N1 real-device
`.siralex.zip` acceptance. The Phase 7N1R1 package for
`bundle_full_20260710_337619ff` is
`HISTORICAL_PHASE7N1R1_DEVICE_VALIDATION_CANDIDATE`. Device matrix remains
`not_run` / 0%. Current-featured manual validation needs a **new** package from
`web/public/bundle_noncommercial_dfd5ba62__51c38a75/` before any matrix run.

## 3. Current bundle-install behavior (inspected)

| Case | Behavior |
|------|----------|
| **A. No bundle installed** | First-run / featured install path installs the current featured catalog entry. No “dictionary out of date” notice (notice requires an active installed identity). |
| **B. Installed == featured** | Same `bundle_id` + matching `content_sha256` → no update notice. |
| **C. Installed != featured** | **Before PRODUCT2E:** search notice only for same-id hash updates. **After:** featured lineage change also yields `UPDATE_AVAILABLE` targeting the featured catalog entry. |
| **D. Network unavailable** | Catalog refresh skipped; installed dictionary remains usable; offline required message if user starts a download while offline. |
| **E. Catalog cannot be fetched** | Cached/loaded catalog retained if any; no false update claim without catalog data. |

Persistence: ActiveBundleMeta + IndexedDB scopes; remote install via `installRemoteCatalogBundle`.

## 4. Update state model

Mapped onto existing DU1 consumer phases + featured availability:

| Conceptual state | Implementation |
|------------------|----------------|
| `NO_BUNDLE_INSTALLED` | No `currentActiveBundle` → no update notice |
| `CURRENT_BUNDLE_INSTALLED` | Featured identity matches active content |
| `UPDATE_AVAILABLE` | `isActiveFeaturedUpdateAvailable` (`same_id_content` \| `featured_lineage`) + Search notice / Dictionaries row |
| `UPDATE_DOWNLOADING` / installing | Consumer dialog `progress` phase |
| `UPDATE_READY` / activating | Install activates on commit after validation |
| `UPDATE_FAILED` | Dialog `failure`; previous active retained |
| `OFFLINE_USING_INSTALLED_BUNDLE` | Online check before download; installed path unchanged |

Dismissal: session-scoped **Not now** (`noticeDismissedThisSession`), not permanent suppress.

## 5. New-user behavior

No installed bundle → no “out of date” messaging. Featured pointer
`VITE_FEATURED_BUNDLE_ID=bundle_noncommercial_dfd5ba62` selects the newest
catalog entry for normal install.

## 6. Existing-user behavior

Installed `bundle_full_20260710_337619ff` vs featured `bundle_noncommercial_dfd5ba62`
→ `featured_lineage` → Search notice + Dictionaries update action targeting the
**featured** catalog entry. Old dictionary remains usable until a successful
install.

## 7. Actual release delta

Source audit (not lexical truth): `data/product2e/release_delta.json` (gitignored under `data/`).

| Metric | Old (`…337619ff`) | New (`…dfd5ba62`) |
|--------|-------------------|-------------------|
| records / ir_ids | 19335 | 22199 (net +2864; +8906/−6042) |
| distinct `preferred_form` values (`preferred_form_values`) | 17927 | 20634 |
| search index lines | 147178 | 174700 |
| unique search keys | 62849 | 75095 (+12508/−262) |
| approx size | ~29.8 MB | ~32.8 MB |
| release files | 4 payload files | 6 (adds ATTRIBUTION + DATA_LICENSES) |
| manifest schema | v1 | v2 (Credits/Sources projectable) |
| owner review rows | 7 | 0 (Malidaba-only noncommercial) |

**Metric definition — `preferred_form_values`:** count of distinct non-empty
`preferred_form` string fields across `records.jsonl` lines. This is a PRODUCT2E
delta audit statistic only.

**Not the same as** publication-candidate **canonical unique published headwords**
(`headwords: 10148`) or `lexicon_entries: 11694` from PRODUCT2 readiness / IR
build accounting. Do not treat 20634 as the canonical unique published headword count.

Categories:

- **DATA_CHANGE** — refreshed/larger record set
- **SEARCH_CHANGE** — more index lines and unique keys
- **RIGHTS/CREDITS_CHANGE** — offline attribution/licenses + v2 sources; noncommercial packaging
- **APP_FEATURE_CHANGE** — Credits UI already present; newly populated by this bundle

## 8. User-facing release summary

English:

> An updated Maninka dictionary is available with refreshed dictionary entries, broader search coverage, and a new offline Credits & Sources section.

French (same measured facts):

> Une mise à jour du dictionnaire maninka est disponible, avec des entrées actualisées, une couverture de recherche élargie et une nouvelle section Crédits et sources accessible hors ligne.

Carried in catalog `update_summary` / `short_summary_fr` (+ `highlights_fr`) outside sealed six files, with matching i18n fallbacks.

### PRODUCT2E-A1 localization repair

**Defect:** English-only catalog `update_summary` overrode French i18n, so FR UI chrome mixed with English release body.

**Fix:** Additive `title_fr` / `short_summary_fr` / `highlights_fr` (nested `{en,fr}` also accepted). Shared `resolveDictionaryUpdateSummary(summary, locale, i18n)` used by Search notice, confirm dialog, and Dictionaries update help.

**Fallback:** FR = catalog_fr → i18n → catalog_en; EN = catalog_en → i18n.

## 9. Update UI implementation

- Search banner (`renderSearchUpdateNotice`) with title, short summary, optional size, Update / Not now
- Confirm dialog with summary + highlights + size; no bundle ids / hashes / IndexedDB jargon in primary copy
- Dictionaries management row update for active featured lineage change
- Spec: `shared/specs/dictionary-update-summary-v1.md`

## 10. Download / install safety

Existing installer: download → verify hashes → stage → activate → optional same-id scope cleanup.

**PRODUCT2E runtime fix:** catalog `bundle_id` is authoritative when `content_sha256` matches.
Sealed manifest still carries internal build id `bundle_noncommercial_20260825_dfd5ba62`;
installer remaps durable ActiveBundleMeta to catalog semantic id
`bundle_noncommercial_dfd5ba62` so featured pointer and install identity align.
Sealed public bytes are not modified.

## 11. Offline behavior

Catalog refresh skipped offline; installed dictionary continues; download blocked with offline-required copy when `navigator.onLine === false`.

## 12. Failure behavior

Failed remote install rejects; previous active bundle remains (`product2e` test). User sees retryable failure dialog.

## 13. Tests

| Suite | Result |
|-------|--------|
| `dictionary_update_availability.test.ts` | PASS (lineage + same-id) |
| `render_dictionary_update.test.ts` | PASS (summary presentation) |
| `product2e_featured_lineage_update.test.ts` | PASS (new user, lineage, already-current, catalog remap install, failed rollback, offline notice gating) |
| `product2d_public_publication.test.ts` | PASS (re-checked earlier) |

Full Playwright DU1/PRODUCT2E browser e2e of ~30MB install was not required for this unit-verified readiness gate; post-deploy smoke checklist covers human verification.

## 14. Production build

`cd web && npm run build` → **PASS** (`web/dist` generated).

**Build correctness fix (included):** `InstallEligibleSnapshot` omitted `manifestBlob`
while `installVerifiedBundlePackage` required it, so `tsc` failed on this HEAD.
Restored `manifestBlob` on the snapshot type and factory — generic package-integrity
typing alignment, not a catalog/update semantic change. Covered by existing
`bundle_package_install` / integrity tests that read `manifestBlob` from the snapshot.

## 15. dist / public byte equality

Authorized `web/public/bundle_noncommercial_dfd5ba62__51c38a75/` vs
`web/dist/bundle_noncommercial_dfd5ba62__51c38a75/`: **6/6 exact**.

Dist catalog: 4 bundles; featured entry `url_base` `./bundle_noncommercial_dfd5ba62__51c38a75/`; `update_summary` present; rollback id present.

## 16. Netlify configuration

| Item | Value |
|------|-------|
| In-repo `netlify.toml` | **Absent** — site settings live in Netlify UI |
| Expected build command | `npm run build` (from `web/`) |
| Expected publish directory | `web/dist` (or site base=`web` + publish=`dist`) |
| Evidence | Historical production reports use `npm run build` / Vite PWA; site `loquacious-piroshki-be432c.netlify.app` |
| Config verdict | **NETLIFY_BUILD_CONFIG_VALID** for the generated `web/dist` artifact, assuming UI still points at `web` + `dist` as in prior deploys. Human must confirm UI settings before deploy. |

**Do not deploy from this workflow.**

## 17. Cache / service-worker audit

- VitePWA `registerType: "autoUpdate"`; generated `dist/sw.js` calls `skipWaiting`, `clientsClaim`, `precacheAndRoute`, `cleanupOutdatedCaches`
- Precache is **app shell only** (html/js/css/icons/manifest) — **not** `catalog.json` and **not** immutable bundle directories
- New Netlify deploy → new hashed JS/CSS + new SW revision → clients should pick up updated app shell and then fetch fresh `/catalog.json` (network) for update detection
- Versioned bundle paths remain safely cacheable by URL; old and new release dirs coexist under `dist/`

Verdict: **PASS** for discoverability of new app + catalog without broad cache disabling.

## 18. Deployment smoke checklist (post human Netlify deploy)

1. Site loads
2. Catalog shows 4 bundles
3. Featured resolves `bundle_noncommercial_dfd5ba62` → `…__51c38a75/`
4. Fresh user installs featured (no “out of date” copy)
5. Existing user seeded with `bundle_full_20260710_337619ff` sees update notice + friendly summary
6. Update succeeds; ActiveBundleMeta = new id/hash; notice clears; reload retains
7. Offline search works after update
8. Credits/Sources works from installed v2 metadata
9. Old public bundle remains catalog-addressable for rollback install

## 19. Non-mutation

| Artifact | Status |
|----------|--------|
| Authorized six release files | **UNCHANGED** (6/6 auth hashes) |
| Canonical lexical IR / shared/malidaba / review registries | **NONE** |
| Publication authorization record | **NONE** |
| Previous immutable bundles | **NONE** |
| `web/scripts/` | **UNTOUCHED** |

Allowed changes: update UX/runtime, catalog `update_summary`, tests, spec, report, package integrity type fix, gitignored `data/product2e/release_delta.json`.

## 20. git diff --check

**PASS** (exit 0)

## 21. Working tree

Uncommitted PRODUCT2E implementation/tests/report (and package integrity build fix). `web/scripts/` remains untracked/untouched. `web/dist/` gitignored build output.

## 22. Recommended next action

1. **COMMIT PRODUCT2E** (human review)
2. **HUMAN NETLIFY PRODUCTION DEPLOYMENT** of `web/dist` from this tree
3. **POST-DEPLOYMENT SMOKE VERIFICATION** (section 18)

---

Base commit: `2327fdd88558e138f8ed36c4d8ca3290c80344a2`  
Netlify deployment: **NOT PERFORMED**  
Commit: **NOT CREATED**
