# Phase 7N1R0 — Reconcile Device Acceptance Gate With Current Featured Bundle

**Status:** reconciliation complete — analysis only  
**Scope:** recover unfinished Phase 7N1 `.siralex.zip` manual-install device gate; retarget candidate identity to the current featured product  
**Does not authorize release, device execution, or product changes**  
**Allowed file for this slice:** this report only

---

## Decision

```text
DEVICE_GATE_BLOCKED_BY_MISSING_PACKAGE
```

**Why:** Package generation, verification, import, install, reopen, offline search, and persistence paths are implemented. The original Phase 7N1 gate was never executed on devices. The recorded candidate package wraps the **old Phase 7J** featured bundle, not the **current Phase 7N2B** featured bundle. No valid `.siralex.zip` package for `bundle_full_20260710_337619ff` is present or recorded. Real-device execution cannot start until that package is rebuilt, identity-recorded, and transferred for the matrix.

This is **not** a proven product defect and **not** already satisfied. Desktop Playwright / featured usage harness runs do **not** close this gate.

---

## 1. Original gate

### Objective

Validate the single-file `.siralex.zip` **manual package import** route on real devices before any package-route release status above `not_ready_for_validation` / `in_device_validation`.

Authoritative sources:

| Document | Role |
|---|---|
| `docs/PHASE_7N1_RELEASE_DECISION.md` | Release gate status (`not_ready_for_validation`) |
| `docs/PHASE_7N1_DEVICE_ACCEPTANCE_PROTOCOL.md` | Scenarios A–I, environments, pass criteria |
| `docs/reports/phase7n1_slice5_device_evidence_record.md` | Evidence tables (all `not_run`) |
| `docs/PHASE_7N_DEVICE_VALIDATION_CHECKLIST.md` | Broader field checklist (catalog/search; stale featured identity) |

### Release model (unchanged)

```text
Candidate package
→ build identity recorded
→ desktop smoke evidence
→ Android browser/PWA evidence
→ iPhone browser/PWA evidence
→ offline persistence evidence
→ invalid-package preservation evidence
→ release decision
```

### Release-blocking failures (original)

Do not approve if any required environment shows:

- valid package cannot be installed on Android Chrome
- valid package cannot be installed on iPhone Safari
- installed dictionary fails after offline restart
- invalid or integrity-failed package changes active dictionary state
- same-file retry fails
- a second write can begin while one is in progress
- legacy three-file fallback is broken
- candidate identity cannot be reproduced

### Scenario groups (original matrix)

| ID | Scenario | Gate impact |
|---|---|---|
| A | First valid install | release-blocking |
| B | Valid replacement (distinct `bundle_id`) | major |
| C | Offline persistence | release-blocking |
| D | Invalid structure | release-blocking |
| E | Integrity mismatch | release-blocking |
| F | Same-file retry | release-blocking |
| G | Concurrency protection | release-blocking |
| H | Three-file fallback still works | release-blocking |
| I | File-picker behavior (mobile platforms separately) | major |

**Historical execution state:** matrix completion **0%** — every environment row `not_run`. Status remained `not_ready_for_validation`.

Integrity claim boundary (unchanged): packages are structurally and content-consistency verified at install; **not** publisher-authenticated or code-signed.

---

## 2. Candidate identities referenced by Phase 7N1 documents

### 2.1 `docs/PHASE_7N1_RELEASE_DECISION.md`

| Field | Recorded value |
|---|---|
| Decision status | `not_ready_for_validation` |
| Primary `bundle_id` | `bundle_full_20260616_phase7j_alias_round2_candidate` |
| Primary `content_sha256` | `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef` |
| Package filename | `bundle_full_20260616_phase7j_alias_round2_candidate.siralex.zip` |
| Package SHA-256 | `sha256:d8273a18b739b8f0c165335dd104f944cb4079ed826a54f43b28d77ba26f7903` |
| git commit at build | `befccc6ddec2a06dba5f609cfd20df067764f646` |

### 2.2 `docs/reports/phase7n1_slice5_device_evidence_record.md`

Same 7J primary candidate as above, plus:

| Field | Recorded value |
|---|---|
| Featured catalog version (at record time) | `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2` |
| featured bundle directory | `web/public/bundle_full_20260616_phase7j_alias_round2_candidate` |
| candidate output root | `build/phase7n1_featured_candidate_20260628_185536` |
| package path (local, untracked) | `…/packages/bundle_full_20260616_phase7j_alias_round2_candidate.siralex.zip` |
| package byte length | `24534212` |
| package format version | `siralex_bundle_package_v1` |
| Overall matrix status | `not_run` |

Engineering-only smoke artifact `bundle_full_20260628_5098763f` was explicitly **not** product-equivalent; do not use for official device evidence.

### 2.3 `docs/PHASE_7N_DEVICE_VALIDATION_CHECKLIST.md`

Template “featured baseline at template time” still lists:

- `bundle_id`: `bundle_full_20260616_phase7j_alias_round2_candidate`
- `catalog_version`: `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2`

### 2.4 Local package artifact today

| Check | Result |
|---|---|
| Old candidate dir `build/phase7n1_featured_candidate_20260628_185536` | **Absent** (removed under Phase 7N2F4K repo cleanup; `build/` was ephemeral staging) |
| Any `*337619ff*.siralex.zip` in workspace | **None found** |
| Committed product `.siralex.zip` for featured | **None** (by design — transport artifacts stay untracked) |

---

## 3. Current repository baseline

### 3.1 Current featured bundle identity

| Field | Value |
|---|---|
| Featured selector | `web/.env.production` → `VITE_FEATURED_BUNDLE_ID=bundle_full_20260710_337619ff` |
| Selection mechanism | Explicit Vite env (Phase 7N2B4G11); **not** catalog sort order |
| `bundle_id` | `bundle_full_20260710_337619ff` |
| Catalog `version` | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` |
| Catalog / manifest `content_sha256` | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| Directory | `web/public/bundle_full_20260710_337619ff/` |
| Catalog `size_bytes` | `26169580` |
| Manifest records SHA-256 | `sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90` |
| Manifest search-index SHA-256 | `sha256:55bf98fc99a592f7003aa338fc7b4790bc9cd642b676c99a725d83a5f9ca79e3` |
| Bundle format on disk | three-file directory (`bundle.manifest.json`, `records.jsonl`, `search_index.jsonl`) |

### 3.2 Catalog companions (not featured)

| Role | `bundle_id` | Catalog `version` |
|---|---|---|
| Prior featured / fallback | `bundle_full_20260708_27643bb0` | `norm-v3-prior-featured-fallback-7n2a4f8` |
| Older rollback | `bundle_full_20260616_phase7j_alias_round2_candidate` | `norm-v3-prior-featured-fallback-phase7j` |

Note: catalog **sort order alone** still prefers 7J; production featured is env-selected 7N2B. Stale docs that treat “first catalog entry” or “7J” as featured are wrong for current product.

### 3.3 Current featured package identity

| Field | Value |
|---|---|
| Valid `.siralex.zip` for current featured | **Missing** |
| Recorded package SHA-256 for 7N2B | **None** |
| Package filename (expected when built) | `bundle_full_20260710_337619ff.siralex.zip` (convention) |
| Builder available | Yes — `siralex-build-bundle package` / `api/bundle_builder/package_bundle.py` (`siralex_bundle_package_v1`) |
| Source directory ready to wrap | Yes — verified featured dir under `web/public/` |

---

## 4. Stale references and assumptions

Caused by the move from old 7J featured candidate → current 7N2B featured product:

| Stale assumption | Where it appears | Correct current fact |
|---|---|---|
| Featured logical bundle is 7J `bundle_full_20260616_phase7j_alias_round2_candidate` | 7N1 release decision, Slice 5 evidence record, 7N checklist template baseline | Featured is 7N2B `bundle_full_20260710_337619ff` via `VITE_FEATURED_BUNDLE_ID` |
| Featured catalog version is `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2` | Evidence record; checklist template | Featured catalog version is `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` |
| Recorded package SHA `d8273a18…` is the gate candidate | Release decision + evidence record | That package wraps **7J**, not 7N2B; local artifact directory is gone |
| “Exact currently featured logical bundle” language in 7N1 docs still true | Release decision rationale text | True only at record time (2026-06-28); **false now** |
| Prior Phase 5b iPhone DEVICE_VALIDATION evidence closes mobile install | `docs/DEVICE_VALIDATION.md` | Validated **catalog / three-file** path on **old** `bundle_full_20260427_ad0e7deb`; not `.siralex.zip`; not 7N2B |
| Android was “pending hardware” for catalog path | ROADMAP / DEVICE_VALIDATION | Separate historical track; does **not** create a product defect for 7N1 package route, but Android remains required for 7N1 |
| Featured usage harness / Playwright offline rows close the gate | 7N2H–7N2L evidence-quality track | Structured usability / harness labeling only; explicitly not real-device package acceptance |
| Retaining 7J identity because it is still in catalog / old docs | Temptation during recovery | 7J is rollback only; gate target must follow **current featured** |

Do **not** reopen Phase 7N evidence-label work (closed in `docs/reports/phase7n2l4q4_phase7n_evidence_quality_closure_report.md`).

---

## 5. Implementation-versus-evidence gap

### 5.1 Implementation already complete

| Capability | Evidence of implementation |
|---|---|
| Deterministic package generation | `api/bundle_builder/package_bundle.py`; CLI `siralex-build-bundle package`; STORED-ZIP `siralex_bundle_package_v1` |
| Bundle verify before package | `verify_bundle` preflight in package builder |
| Package structure + integrity verification | `web/src/import/bundle_package.ts`, `bundle_package_integrity.ts` + fixtures/tests |
| Install into existing IndexedDB installer | `web/src/import/bundle_package_install.ts` + tests |
| Manual UI route | Manage Dictionaries → Install dictionary package → Choose package (`web/src/main.ts`, i18n keys) |
| Concise failure messaging / writer-busy | Manual import flow + protocol expected copy |
| Same-file retry / input reset | Covered in `manual_package_import_flow` tests |
| Legacy three-file Advanced fallback | Still present (Advanced setup); independent of package route |
| Catalog featured install path | Separate from package route; still active for 7N2B |
| Offline-first PWA shell | Existing service-worker / offline app path (not newly gated here) |
| Unit / Vitest package integrity fixtures | `web/src/import/fixtures/bundle_package_integrity/*` |

### 5.2 Evidence missing (gate-blocking)

| Missing item | Notes |
|---|---|
| Recorded reproducible `.siralex.zip` for **current featured** 7N2B | Primary blocker for this reconciliation |
| Replacement candidate package (scenario B) with distinct `bundle_id` | Can wrap 7N2A or 7J directory once primary exists |
| Desktop Chromium/Firefox package smoke (control) | Protocol requires it; not a mobile substitute |
| Android Chrome real-device matrix A–I | Original release-blocking environments |
| iPhone Safari real-device matrix A–I | Original release-blocking environments; file-picker (I) must be separate |
| Offline persistence on Android + iPhone after package install | Release-blocking |
| Invalid / integrity-fail preservation evidence on devices | Scenarios D/E |
| Owner-signed release decision update | After evidence — out of scope for R0 |

### 5.3 Documentation stale

| Doc | Staleness |
|---|---|
| `docs/PHASE_7N1_RELEASE_DECISION.md` | Candidate identity = 7J; claims “exact currently featured” |
| `docs/reports/phase7n1_slice5_device_evidence_record.md` | Candidate identity + build commands = 7J; matrix still empty |
| `docs/PHASE_7N_DEVICE_VALIDATION_CHECKLIST.md` | Featured baseline template = 7J |
| `docs/DEVICE_VALIDATION.md` | Phase 5b catalog/3-file era; unrelated package identity |

R0 does **not** rewrite those files. Future execution slices must update candidate identity when packaging 7N2B.

### 5.4 Genuine product defect?

| Question | Finding |
|---|---|
| Is package import unimplemented? | **No** |
| Is featured 7N2B directory missing/corrupt in catalog? | **No** (present; promotion closed G11–G13) |
| Is there device evidence of package-route failure on current product? | **No** — never run |
| Does missing package imply a code bug? | **No** — missing **transport artifact + recorded identity** for the new featured dir |

**No `DEVICE_GATE_BLOCKED_BY_PRODUCT_DEFECT` from this analysis.** Defects may still appear during later device execution.

---

## 6. Required device matrix (minimum to close original gate)

Targets limited to representative classes already intended by the repository. Desktop is control only.

### 6.1 Classes in / out

| Device class | In minimum matrix? | Rationale |
|---|---|---|
| Android phone (Chrome; browser and/or installed PWA where available) | **Yes** | Original release-blocking environment |
| Android tablet | **No** (unless picker/storage differs materially) | Not in original 7N1 environment table; phone covers Chrome PWA path |
| iPhone (Safari; browser and/or Add-to-Home-Screen PWA where available) | **Yes** | Original release-blocking; historical PWA path exists |
| iPad | **No** (unless picker differs materially) | Not separately required by original gate |
| Desktop Chromium or Firefox | **Yes — control only** | Protocol smoke baseline; **not** a substitute for mobile |

### 6.2 Shared package identity for all runs

| Field | Required value for execution |
|---|---|
| Primary package | Deterministic wrap of `web/public/bundle_full_20260710_337619ff` |
| Expected `bundle_id` | `bundle_full_20260710_337619ff` |
| Expected `content_sha256` | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| Format | `siralex_bundle_package_v1` |
| Replacement (scenario B) | Second verified package with **distinct** `bundle_id` (recommended: wrap catalog fallback `bundle_full_20260708_27643bb0` or rollback 7J) |
| Invalid fixtures | Local copies only (e.g. `records_sha_mismatch.siralex.zip`); not committed as release artifacts |

### 6.3 Per-class matrix

#### Android phone — Chrome

| Item | Definition |
|---|---|
| Install/import method | Manage Dictionaries → **Install dictionary package** → **Choose package** → select `.siralex.zip` (transfer via Files / Downloads / share as needed) |
| Package identity | Primary 7N2B package (above); replacement for B |
| Browser/runtime | Android Chrome (record browser vs installed PWA mode) |
| Online install test | Scenario **A** (and **B** when replacement available) |
| Reopen test | Close/reopen browser or PWA; active dictionary remains |
| Offline launch test | Airplane mode → launch → shell loads with prior dictionary |
| Offline search test | Scenario **C**: French + Maninka queries from A still work |
| Persistence test | Active `bundle_id` / search survive reopen offline and after reconnect without forced reinstall |
| Update/reinstall | Scenario **B** atomic switch; no ambiguous active state |
| Negative / safety | **D, E, F, G**; **H** legacy three-file; **I** picker |
| Evidence required | Tester, device model, OS, browser/PWA mode, date/time, package filename + SHA-256, `bundle_id`, `content_sha256`, observed result, screenshot/recording refs |
| Pass/fail | Per `docs/PHASE_7N1_DEVICE_ACCEPTANCE_PROTOCOL.md` scenario criteria; release-blocking failures as listed in §1 |

#### iPhone — Safari

| Item | Definition |
|---|---|
| Install/import method | Same package UI; Files picker (record any `.siralex.zip` visibility friction under **I**) |
| Package identity | Same primary / replacement as Android |
| Browser/runtime | iPhone Safari (browser and/or home-screen PWA where available) |
| Online install / reopen / offline launch / offline search / persistence / update | Same scenario set **A–C, B** as Android |
| Negative / safety | **D–H**; **I** run **separately** (do not assume Android picker results) |
| Evidence required | Same identity + observation fields as Android |
| Pass/fail | Same protocol criteria; Android pass does **not** satisfy iPhone |

#### Desktop Chromium or Firefox (control)

| Item | Definition |
|---|---|
| Role | Smoke control for package selection/install/progress copy |
| Required scenarios | Minimum **A**, plus **D** or **E** safety spot-check recommended before mobile days |
| Not sufficient alone | Cannot advance release status; cannot replace Android/iPhone evidence |

### 6.4 What does not count

- Vitest / jsdom / unit tests
- `npm run build`
- `npm run test:e2e:usage` / `test:e2e:usage:featured` (Playwright structured usability)
- Desktop-only testing as mobile acceptance
- Screenshots without candidate identity
- Catalog-path or three-file installs as proof of the **package** route (except scenario **H**, which proves fallback still works)
- Phase 5b iPhone catalog validation on `bundle_full_20260427_ad0e7deb`

---

## 7. Exact remaining execution slices

Ordered minimum path to reopen and close the original gate against **current featured**:

| Slice | Purpose | Outcome needed |
|---|---|---|
| **7N1R1** | Rebuild + record primary `.siralex.zip` from `web/public/bundle_full_20260710_337619ff` (verify → package → deterministic rebuild `cmp` → record SHA/bytes/commit in evidence + release decision candidate fields) | Removes `DEVICE_GATE_BLOCKED_BY_MISSING_PACKAGE` |
| **7N1R2** | Build/record replacement package (distinct `bundle_id`) + stage invalid fixtures locally | Unblocks scenarios B/D/E |
| **7N1R3** | Desktop control smoke (A + safety spot-check); update status toward `in_device_validation` when human matrix begins | Control baseline |
| **7N1R4** | Android phone matrix A–I with attached evidence | Android release-blocking rows filled |
| **7N1R5** | iPhone Safari matrix A–I with attached evidence | iPhone release-blocking rows filled |
| **7N1R6** | Issue disposition + owner release-decision review | Gate decision update (not automatic) |

R0 stops at reconciliation. Do not implement packaging or device runs in this slice.

---

## 8. Explicit non-goals

- New product roadmap or Phase 8 capability selection
- Reopening Phase 7N evidence-label / harness-classification work
- Runtime, catalog, bundle payload, source data, lexical data, test, or deployment changes in R0
- Committing `.siralex.zip` product packages to git
- Treating Playwright featured runs as device acceptance
- Keeping 7J as the gate candidate merely because old docs name it
- Requiring Android tablet or iPad in the minimum matrix without material difference
- Claiming publisher authentication / code signing for packages
- Authorizing limited field validation or release

---

## 9. Closure criteria for Phase 7N1R0

R0 is closed when this report:

- [x] Recovers the original Phase 7N1 acceptance objective
- [x] Records candidate identities in each Phase 7N1 document
- [x] Records current featured bundle identity
- [x] Lists stale assumptions from 7J → 7N2B move
- [x] Determines current featured package presence (**missing**)
- [x] Separates implementation / evidence / docs / defects
- [x] Defines minimum real-device matrix and remaining slices
- [x] States an allowed decision grounded in evidence

**R0 does not** close the device gate itself. Gate closure remains future work after package rebuild + real-device evidence.

---

## 10. Related inputs consulted

| Input | Use |
|---|---|
| `docs/PHASE_7N1_RELEASE_DECISION.md` | Original status + 7J candidate |
| `docs/PHASE_7N1_DEVICE_ACCEPTANCE_PROTOCOL.md` | Scenarios and pass criteria |
| `docs/reports/phase7n1_slice5_device_evidence_record.md` | Empty matrix + recorded 7J package |
| `docs/PHASE_7N_DEVICE_VALIDATION_CHECKLIST.md` | Stale featured baseline |
| `web/public/catalog.json` + `web/.env.production` | Current featured 7N2B |
| `web/public/bundle_full_20260710_337619ff/bundle.manifest.json` | Content hashes |
| `api/bundle_builder/package_bundle.py` + `web/src/import/*` | Implementation presence |
| `docs/reports/phase7n2l4q4_phase7n_evidence_quality_closure_report.md` | Evidence-quality track closed; do not reopen |
| `docs/reports/phase7n2b4g11_featured_promotion_report.md` | Featured promotion mechanism |
| `docs/reports/phase7n2f4k1_repo_cleanup_plan.md` | Old `build/phase7n1_*` packages cleaned as ephemeral |
| `docs/DEVICE_VALIDATION.md` | Historical non-package device evidence (not transferable) |

---

## Sign-off (reconciliation)

| Field | Value |
|---|---|
| Slice | Phase 7N1R0 |
| Decision | `DEVICE_GATE_BLOCKED_BY_MISSING_PACKAGE` |
| Next execution slice | **Phase 7N1R1** — rebuild and record current-featured 7N2B `.siralex.zip` candidate identity |
| Product behavior changed in R0 | **No** |
