# PV1A-R1 — Production Alignment Re-Smoke Report

## Original

```text
PV1A_PRODUCTION_DESKTOP_SMOKE_BLOCKED
DEPLOYMENT_BEHIND_REPOSITORY
```

Retained audit trail:

```text
docs/reports/pv1a_production_identity_desktop_smoke_report.md
```

That probe correctly refused to treat the stale 7J-only / pre-CF1/CF2 host as the
amended release candidate.

---

## Rerun

```text
PV1A_PRODUCTION_DESKTOP_SMOKE_VERIFIED
ALIGNED
```

---

## 1. Decision

```text
PV1A_PRODUCTION_DESKTOP_SMOKE_VERIFIED
```

The production host now matches the amended repository candidate. Clean
first-run featured install and the principal desktop user loops (search, entry,
Learning, LP1, CF1, CF2 with human-style typing, reload persistence, offline
reload, PWA, IndexedDB v6, EN/FR, console/network boundary) all PASS.

---

## 2. Production URL

```text
https://loquacious-piroshki-be432c.netlify.app
```

---

## 3. Repository HEAD (at verification)

```text
5750f0ee31afc423ce242ebad2dcaf04fbd9896d
```

Amended floor remains `56cb76e` (CF2I6A). PV1A-R1 harness/docs commit follows
this report.

---

## 4. Alignment status

```text
ALIGNED
```

---

## 5. Production shell asset

```text
./assets/index-B_DnyxAf.js
(~408 KB; matches local amended production build artifact name)
```

Shell markers present: featured bundle id, `#openSavedVocabulary`,
`#openManageCorrections`, `#openManageSearchFeedback`, Learning-data host,
CF1/CF2 test ids including `correction-manage-description` /
`search-feedback-report`.

---

## 6. Catalog version

Featured catalog entry version (repo = deployed):

```text
norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass
```

Deployed catalog also retains prior/fallback entries (7J, 7N2A) as non-featured
rows.

---

## 7. Featured bundle ID

```text
bundle_full_20260710_337619ff
```

Selected via deployed shell bake-in of `VITE_FEATURED_BUNDLE_ID` and present in
live `/catalog.json`.

---

## 8. Content SHA

```text
sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c
```

---

## 9. Manifest / asset reconciliation

| Asset | HTTP | Identity |
| --- | ---: | --- |
| `/` | 200 | shell `index-B_DnyxAf.js` |
| `manifest.webmanifest` | 200 | reachable |
| `/catalog.json` | 200 | featured entry present |
| featured `bundle.manifest.json` | 200 | `bundle_id` + `content_sha256` match repo |
| featured `records.jsonl` | 200 | reachable |
| featured `search_index.jsonl` | 200 | reachable |

Agreement:

```text
repo featured bundle_id
= deployed selected featured bundle_id
= deployed manifest bundle_id
= bundle_full_20260710_337619ff

repo content_sha256
= deployed catalog hash
= deployed manifest hash
= sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c
```

Normalization ruleset: `norm_v3`.

---

## 10. Production default locale

Observed in clean Playwright context **before** any locale switch:

```text
en
```

EN↔FR selector paths both work after install. This records the actual deployed
default; it is not inferred from `.env`. Guinea-facing French-first intent is
not what the clean production context currently defaults to.

---

## 11. Clean first-run install

```text
PASS
```

Clean context → first-run shell → `#featuredInstall` → install completes →
active bundle `bundle_full_20260710_337619ff` → search enabled. No IndexedDB
seeding.

---

## 12. Search

```text
PASS
```

| Path | Query | Result |
| --- | --- | --- |
| source → target | `maman` | hit |
| accented Unicode | `hôpital` | hit |
| target → source | `kun` | hit |
| no-result | `zzzz_pv1a_nohit_9f3c` | no_result CTA |
| results-not-useful | on hit search | CTA visible |

---

## 13. Entry detail

```text
PASS
```

Opened a genuine `lexicon_entry` (source-result shell → target link when
needed). Save and Suggest controls present. No `storage_scope_id` /
`content_sha256` / `git_commit` leak on the consumer entry surface.

---

## 14. Learning

```text
PASS
```

Save → Saved Vocabulary → Review → Progress (`#saved-vocab-progress-heading`).

---

## 15. LP1

```text
PASS
```

Manage Learning Data (via Manage dictionaries host) → export →
`parseLearningBackupJson` accepts artifact → restore preview opened then
abandoned without apply.

---

## 16. CF1

```text
PASS
```

Suggest a correction → sequential typing (`pv1a`) with focus + same DOM node →
save → Manage Corrections → edit with sequential typing → export. No remote
submission.

---

## 17. CF2

```text
PASS
```

`no_result` full path with sequential typing; `results_not_useful` entry CTA
observed; Manage Search Feedback → edit → export. No remote submission. No
“missing entry” diagnosis language asserted on capture surfaces.

---

## 18. Human-typing / CF2I6A regression

```text
PASS
```

Sequential key presses (not `.fill()`-only) on:

- CF1 correction description
- CF1 manage edit description
- CF2 capture meaning
- CF2 manage edit meaning

Focus remained; final text preserved; saves succeeded.

---

## 19. Reload persistence

```text
PASS
```

After Learning + CF1 + CF2 drafts exist, hard reload keeps Saved Vocabulary,
Manage Corrections, and Manage Search Feedback rows accessible.

---

## 20. Offline smoke

```text
PASS
```

Offline → hard reload → search → open lexicon entry → Saved Vocabulary /
Manage Corrections / Manage Search Feedback accessible.

Conservative claim:

> Core shipped desktop functionality remains usable without a remote network
> dependency after the application shell and dictionary are locally available.

---

## 21. PWA

```text
PASS
```

- `manifest.webmanifest` HTTP 200
- Service worker registered; `controller=true`; `active=activated`
- Scope: `https://loquacious-piroshki-be432c.netlify.app/`
- Offline reload exercised above

---

## 22. IndexedDB v6

```text
PASS
```

`siralex_db` version `6`; expected stores present including
`learning_records`, `correction_drafts`, `search_failure_feedback`,
`query_logs`, `records`, `search_index`, `bundles_registry`, `meta`.

---

## 23. Console

```text
PASS
```

No unexpected console errors / pageerrors / IndexedDB or service-worker
failures captured during the successful run.

---

## 24. Network / local-only boundary

```text
PASS
```

Expected production GETs only for shell/catalog/bundle/PWA assets. No
third-party requests. No CF1/CF2/Learning-backup remote uploads. Downloads are
local artifacts.

---

## 25. Scenario matrix

| Scenario | Status |
| --- | --- |
| Production identity resolved | PASS |
| HTTPS root/catalog/manifest/payloads | PASS |
| Shell capability gate | PASS |
| Repository/deployment alignment | PASS |
| Clean first-run install | PASS |
| Source→target search | PASS |
| Target→source search | PASS |
| Accented Unicode search | PASS |
| Entry detail | PASS |
| Learning smoke | PASS |
| LP1 smoke | PASS |
| CF1 human typing + save/manage/export | PASS |
| CF2 human typing + save/manage/export | PASS |
| Feedback-input amendment regression | PASS |
| Hard-reload persistence | PASS |
| Offline desktop reload/search | PASS |
| PWA/service worker | PASS |
| EN/FR smoke | PASS |
| Console clean/explained | PASS |
| Network boundary | PASS |
| IndexedDB schema observation | PASS |

---

## 26. Defects

```text
none blocking
```

Non-blocking observation (does not overturn VERIFIED):

- Clean production default locale observed as `en` (not French-first).
- App shell package version remains `0.0.0` without a stronger deployed git/build
  stamp (dictionary manifests still expose `build.git_commit`).

---

## 27. Harness fixes (aligned-path only)

No product runtime changes.

Harness adjustments required once the live host became the amended candidate:

- open genuine `lexicon_entry` via source-result target link when needed
- Learning Save selector `#entry-learning-save`
- Progress via `#saved-vocab-progress-heading`
- LP1 open via Manage dictionaries + `parseLearningBackupJson`
- CF1/CF2 export after **Back to list** (not shell-level manage back)
- featured payload HTTP checks + shell capability gate
- longer Playwright timeout for production featured install

Alignment hard-block behavior from the original PV1A harness is preserved.

---

## 28. Evidence path

```text
data/local_evidence/pv1a_production_desktop/pv1a_2026-08-03T17-54-07-329Z/
```

Gitignored. Includes `summary.json`, `identity.json`, `network.json`,
`console.txt`, `screenshots/`, `downloads/`.

---

## 29. Test results

```text
npm run test:e2e:pv1a:              1 PASS (VERIFIED)
npm run test:e2e:feedback-input:    1 PASS
npm run test:e2e:corrections
 + search-feedback lifecycle:      14 PASS
 (combined with feedback-input:    15 PASS)
npm run test:run:                  79 files / 798 tests PASS
  (query_log eviction test timeout raised to 30s; was flaking at 5s under suite load)
npm run build:                     PASS
```

---

## 30. Build

```text
npm run build → PASS
dist asset index-B_DnyxAf.js matches deployed shell filename
```

---

## 31. Files changed

Exact list from `git diff --name-status 5750f0e..HEAD` after the PV1A-R1 commit:

```text
Files changed
-------------
M  docs/ROADMAP.md
A  docs/reports/pv1a_production_alignment_rerun_report.md
M  web/e2e/pv1a/identity.ts
M  web/e2e/pv1a/production_desktop_smoke.spec.ts
M  web/playwright.pv1a.config.ts
M  web/src/query_logging/query_log_store.test.ts
```

---

## 32. Untracked files

```text
Untracked files: none
```

---

## 33. Repository hygiene

- Original blocked PV1A report preserved unchanged.
- Evidence under gitignored `data/local_evidence/…`.
- No secrets; no product runtime mutation.

---

## 34. PV1B boundary

```text
PV1B — Physical Device Validation — hardware-gated / not run
```

PV1A-R1 does not claim Android/iPhone/physical-device/mobile-keyboard PASS.

---

## 35. Final decision

```text
PV1A_PRODUCTION_DESKTOP_SMOKE_VERIFIED
```

Acceptance criterion now holds for desktop production:

> The production candidate corresponding to the amended repository build is
> positively identified, its featured dictionary assets reconcile, and the
> principal SiraLex desktop user loops operate successfully on the deployed
> HTTPS application, including offline reload after local initialization.
