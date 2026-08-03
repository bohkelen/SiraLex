# PV1A — Production Identity and Desktop Smoke Report

## 1. Decision

```text
PV1A_PRODUCTION_DESKTOP_SMOKE_BLOCKED
```

The repository amended candidate (CF2I6A floor `56cb76e`, HEAD including
`b8cc8e6`) is identifiable, but the live HTTPS deployment is **not** that
candidate. Product desktop loops that require Learning / CF1 / CF2 / featured
`7N2B` were therefore not validated against production as the amended release
candidate.

---

## 2. Production URL

```text
https://loquacious-piroshki-be432c.netlify.app
```

Resolved from repository historical production references
(`docs/ROADMAP.md` production smoke host). Override:
`SIRALEX_PRODUCTION_URL`.

---

## 3. Repository HEAD

```text
b8cc8e6398e5d0c5f82d488ab7d061611db3a529
```

Amended floor (must exist in smoked candidate):

```text
56cb76e3b5c90dd01f0dc70128561e77c693fca5  Fix feedback form input stability
```

Also on HEAD before this PV1A commit:

```text
b8cc8e6398e5d0c5f82d488ab7d061611db3a529  Fix Manage Corrections description focus steal
```

---

## 4. Deployed build identity

| Field | Value |
| --- | --- |
| Shell title | SiraLex |
| Shell JS asset | `./assets/index-CA1dBBsz.js` (~124 KB) |
| App package version marker | `0.0.0` present in shell JS |
| Strong app git/build stamp | **Absent** (release-readiness gap) |
| Deployed catalog primary | `bundle_full_20260616_phase7j_alias_round2_candidate` |
| Deployed catalog version | `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2` |
| Deployed primary content_sha256 | `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef` |
| Deployed primary manifest build.git_commit | `d1697b18a92b71ecad8336c6b1148f4299b95262` (dictionary content only) |
| CF1 / CF2 / Learning shell markers | **Absent** |
| Repository featured bundle in shell | **Absent** |

`app 0.0.0` is recorded as insufficient sole release identity for the app shell.
Dictionary manifests expose `build.git_commit`, but that does not identify the
deployed web runtime.

---

## 5. Alignment status

```text
DEPLOYMENT_BEHIND_REPOSITORY
```

| | Repository candidate | Deployed production candidate |
| --- | --- | --- |
| Featured / primary bundle | `bundle_full_20260710_337619ff` (via `VITE_FEATURED_BUNDLE_ID`) | `bundle_full_20260616_phase7j_alias_round2_candidate` (sole catalog entry) |
| Catalog version | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` | `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2` |
| content_sha256 | `sha256:337619ff…a08484` → `337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` | `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef` |
| Featured manifest HTTPS | Present in repo `web/public/…` | **HTTP 404** on production |
| Amended runtime (CF1/CF2 + featured id) | Present in current build (~408 KB JS) | Missing in deployed ~124 KB JS |

Per PV1A rule: the older deployment was **not** smoked as the amended release
candidate.

---

## 6. Catalog identity

**Repository** (`web/public/catalog.json`):

- schema: `bundle_catalog_v1`
- bundles: 7J fallback, 7N2A prior, 7N2B featured candidate
- featured selection: `web/.env.production` → `VITE_FEATURED_BUNDLE_ID=bundle_full_20260710_337619ff`
  (not a catalog `featured` field)

**Deployed** (`/catalog.json`):

- schema: `bundle_catalog_v1`
- bundles: only `bundle_full_20260616_phase7j_alias_round2_candidate`

---

## 7. Featured bundle identity

```text
Repository featured bundle_id:
bundle_full_20260710_337619ff

Repository featured catalog version:
norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass

Repository content_sha256:
sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c

Normalization ruleset:
norm_v3

storage_scope_id pattern:
bundle_full_20260710_337619ff::sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c
```

---

## 8. Manifest / hash reconciliation

| Check | Result |
| --- | --- |
| Repo catalog featured `bundle_id` === repo manifest `bundle_id` | PASS |
| Repo catalog `content_sha256` === repo manifest `content_sha256` | PASS |
| Deployed catalog featured match for repo featured id | FAIL (not listed) |
| Deployed featured manifest reachable | FAIL (HTTP 404) |
| Deployed primary catalog hash === deployed primary manifest hash | PASS (7J only) |

---

## 9. Browser / environment

```text
Harness: Playwright Chromium (Desktop Chrome device profile)
OS (host): linux 6.8.0-136-generic x86_64
Browser UA (Playwright): Chrome/149 desktop profile
Verification timestamp: 2026-08-03T17:13:25Z (latest evidence run)
```

---

## 10. Clean first-run install

```text
FAIL (not exercised as amended-candidate install)
```

Clean context opened production root. First-run shell and `#featuredInstall`
were visible; search disabled until install. Install of the **amended** featured
dictionary was not performed because production lacks the repository featured
assets and amended app shell.

---

## 11. Search smoke

```text
source → target: FAIL (skipped; misaligned deployment)
target → source: FAIL (skipped; misaligned deployment)
accented / no-result / results-not-useful: not run on amended candidate
```

Representative amended-bundle queries prepared for the aligned path:
`maman`, `hôpital`, `kun`, `zzzz_pv1a_nohit_9f3c`.

---

## 12. Entry / detail

```text
FAIL (skipped; misaligned deployment)
```

Deployed shell lacks Learning/CF1/CF2-era entry surfaces required by the amended
candidate smoke.

---

## 13. Learning

```text
FAIL (skipped; `#openSavedVocabulary` absent on deployed shell)
```

---

## 14. LP1

```text
FAIL (skipped; Manage Learning Data absent on deployed shell)
```

---

## 15. CF1

```text
FAIL (skipped; `#openManageCorrections` / suggest-correction absent)
```

---

## 16. CF2

```text
FAIL (skipped; `#openManageSearchFeedback` / report-search absent)
```

---

## 17. Feedback-input amendment regression

```text
FAIL on production amended candidate (deployment behind)
PASS on local regression harness (see Test results)
```

CF2I6A human-typing E2E (`npm run test:e2e:feedback-input`) remains green
against the local amended build. Production cannot claim that fix until the
amended shell is deployed.

---

## 18. Reload persistence

```text
FAIL (skipped; no Learning/CF1/CF2 drafts creatable on deployed shell)
```

---

## 19. Offline desktop smoke

```text
FAIL (skipped against amended candidate)
```

Conservative statement **not** claimed for production amended candidate.

Observed only: production root remains HTTPS-reachable; PWA manifest reachable.

---

## 20. PWA / service worker

```text
PASS (host-level observation on current deployment)
```

- `manifest.webmanifest`: HTTP 200
- Service worker: `navigator.serviceWorker.ready` resolved; scope
  `https://loquacious-piroshki-be432c.netlify.app/`
- Initial clean visit observed `active=activating`, `controller=false` before
  full control settles (first-visit lifecycle)

No Workbox configuration changes were made.

---

## 21. IndexedDB / schema observation

```text
FAIL (skipped; amended candidate not installed on production)
```

Expected when aligned: `siralex_db` version `6` with stores including
`learning_records`, `correction_drafts`, `search_failure_feedback`,
`query_logs`, `records`, `search_index`, `bundles_registry`, `meta`.

---

## 22. Locale behavior

```text
FAIL for full amended-candidate EN/FR product-loop verification
```

Observations on current deployment:

- `#localeSelect` present
- Observed default in clean Playwright profile: `en`
- EN↔FR selector switch works (reload-based)

For Guinea-facing deployment intent, repository docs recommend
`VITE_DEFAULT_LOCALE=fr`. That default was **not** observed on the current host
default (`en`). Re-check after amended deploy.

---

## 23. Console

```text
PASS
```

No unexpected console errors / pageerrors captured during the PV1A probe.

---

## 24. Network

```text
PASS (local-only feedback boundary; no unexpected third-party posts)
```

Observed expected production GETs for root / shell assets / catalog probes.
Repository featured manifest request returns 404 (deployment gap).
No CF1/CF2/Learning remote submission endpoints observed.

---

## 25. Local-only feedback boundary

```text
PASS (probe)
```

No remote POST/PUT/PATCH of correction, search-feedback, or learning-backup
payloads. Full Save/Export boundary proof for amended loops requires aligned
deploy.

---

## 26. Defects

| Class | Summary | Blocks VERIFIED |
| --- | --- | --- |
| `DEPLOYMENT_DEFECT` | Live catalog/assets still 7J-only; repository featured `bundle_full_20260710_337619ff` manifest 404 | Yes |
| `DEPLOYMENT_DEFECT` | Deployed app shell lacks CF1/CF2/Learning and featured-bundle runtime markers; cannot contain CF2I6A | Yes |
| Release-identity gap (recorded) | App shell exposes only `0.0.0`; no deployed git/build stamp for the web runtime | Does not alone decide BLOCKED here (deployment gap already blocks) |

No product runtime change was made in this PV1A slice.

---

## 27. Harness fixes

Verification-only additions:

- `web/e2e/pv1a/*` identity resolver + production smoke
- `web/playwright.pv1a.config.ts` (HTTPS production target, no local webServer)
- `web/package.json` script `test:e2e:pv1a`

Behavior when misaligned: record identity, probe shell markers, **do not** treat
old host as amended RC, write evidence, decision `BLOCKED`.

---

## 28. Scenario matrix

| Scenario | Status |
| --- | --- |
| Production identity resolved | PASS |
| HTTPS root/catalog/manifest | FAIL |
| Clean first-run install | FAIL |
| Source→target search | FAIL |
| Target→source search | FAIL |
| Entry detail | FAIL |
| Learning smoke | FAIL |
| LP1 smoke | FAIL |
| CF1 human typing + save/manage/export | FAIL |
| CF2 human typing + save/manage/export | FAIL |
| Feedback-input amendment regression (prod amended) | FAIL |
| Hard-reload persistence | FAIL |
| Offline desktop reload/search | FAIL |
| PWA/service worker | PASS |
| EN/FR smoke | FAIL |
| Console clean/explained | PASS |
| Network boundary | PASS |
| Repository/deployment alignment | FAIL |
| IndexedDB/schema observation | FAIL |

---

## 29. Evidence path

```text
data/local_evidence/pv1a_production_desktop/pv1a_2026-08-03T17-13-25-655Z/
```

Gitignored under `data/*`. Contains `summary.json`, `identity.json`,
`network.json`, `console.txt`, `screenshots/`.

---

## 30. PV1B boundary

PV1A does **not** claim:

```text
Android PASS
iPhone PASS
physical-device PASS
mobile keyboard PASS
installability on all devices
```

Those remain:

```text
PV1B — Physical Device Validation — hardware-gated / not run
```

---

## 31. Test results

```text
PV1A production smoke E2E:        1 PASS (decision BLOCKED recorded)
feedback-input E2E:               1 PASS
CF1 + CF2 lifecycle E2E:         14 PASS
npm run test:run:                79 files / 798 tests PASS
npm run build:                   PASS
```

---

## 32. Build

```text
npm run build
→ PASS
dist shell JS ~408 KB (amended candidate)
deployed shell JS ~124 KB (older candidate)
```

---

## 33. Files changed

```text
Files changed
-------------
M  docs/ROADMAP.md
M  docs/reports/cf2i6a_feedback_input_stability_amendment_report.md
A  docs/reports/pv1a_production_identity_desktop_smoke_report.md
M  web/e2e/feedback_input_stability.spec.ts
A  web/e2e/pv1a/evidence.ts
A  web/e2e/pv1a/identity.ts
A  web/e2e/pv1a/production_desktop_smoke.spec.ts
M  web/package.json
A  web/playwright.pv1a.config.ts
M  web/src/corrections/correction_management_session.test.ts
M  web/src/corrections/correction_management_session.ts
M  web/src/render/render_correction_management.test.ts
M  web/src/render/render_correction_management.ts
```

Source command: `git diff --name-status 56cb76e..HEAD` (includes CF2I6A residual
`b8cc8e6` plus this PV1A verification commit).

---

## 34. Untracked files

```text
Untracked files: none
```

(after commit; evidence remains gitignored under `data/`)

---

## 35. Repository hygiene

- Verification/docs only; no product runtime change to force a green matrix.
- No secrets; no downloaded user artifacts committed.
- Evidence under gitignored `data/local_evidence/pv1a_production_desktop/`.

---

## 36. Final decision

```text
PV1A_PRODUCTION_DESKTOP_SMOKE_BLOCKED
```

**Blocking cause:** `DEPLOYMENT_BEHIND_REPOSITORY` — production still serves a
pre-Learning/CF1/CF2 shell with 7J-only catalog assets, while the amended
repository candidate features `bundle_full_20260710_337619ff` and includes
CF2I6A.

**Unblock path:** deploy the amended repository build (at/after `56cb76e` /
current HEAD) so that:

1. production catalog lists and serves featured `7N2B` assets with matching hashes
2. production shell contains CF1/CF2/Learning + featured bundle id markers
3. re-run `npm run test:e2e:pv1a` to completion on the aligned host

Acceptance criterion status: **not yet true** for production.
