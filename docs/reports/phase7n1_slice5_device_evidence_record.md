# Phase 7N1 Slice 5 — Device Evidence Record

**Status:** `not_run` — no device validation executed for this record yet  
**Protocol:** `docs/PHASE_7N1_DEVICE_ACCEPTANCE_PROTOCOL.md`  
**Release gate:** `docs/PHASE_7N1_RELEASE_DECISION.md`  
**Package identity report:** `docs/reports/phase7n1r1_featured_release_candidate_package_report.md`
**Rule:** do not mark any scenario `passed` without tester, device, date, observed result, and evidence reference

---

## Record metadata

| Field | Value |
|---|---|
| Evidence record ID | `phase7n1_slice5_evidence_20260628_001` |
| Protocol version | Slice 5A (package manual-install route) |
| Record opened | 2026-06-28 |
| Last updated | 2026-07-23 (Phase 7N1R1 — retarget primary candidate to featured 7N2B) |
| Maintainer | |
| Overall matrix status | `not_run` |

---

## Candidate identity (fill before device runs)

| Field | Primary candidate | Replacement candidate (scenario B) |
|---|---|---|
| Status | `recorded` | `not_run` |
| Provenance | Phase 7N1R1: deterministic STORED-ZIP transport envelope around current featured logical bundle `bundle_full_20260710_337619ff`. Records, index, manifest identity, and content hash were not regenerated or altered. | |
| Featured catalog `bundle_id` | `bundle_full_20260710_337619ff` | |
| Featured catalog `content_sha256` | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` | |
| Featured catalog version | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` | |
| git commit | `6ce089186a79fb970c2fd519a0bae8895f4a59a8` | |
| branch | `feat/phase-2.0.5-offline-pwa` | |
| build date (local) | 2026-07-23 18:08:25 EDT | |
| builder environment | Linux 6.8.0-117-generic; Python 3.10.12; `siralex-api` 0.1.0 | |
| candidate output root | `build/phase7n1r1_featured_rc_20260723_180825` | |
| featured bundle directory | `web/public/bundle_full_20260710_337619ff` | |
| verify command | `siralex-build-bundle verify web/public/bundle_full_20260710_337619ff` | |
| package-builder command | `siralex-build-bundle package --bundle-dir web/public/bundle_full_20260710_337619ff --output build/phase7n1r1_featured_rc_20260723_180825/packages/bundle_full_20260710_337619ff.siralex.zip` | |
| package filename | `bundle_full_20260710_337619ff.siralex.zip` | |
| package path (local, untracked) | `build/phase7n1r1_featured_rc_20260723_180825/packages/bundle_full_20260710_337619ff.siralex.zip` | |
| package SHA-256 | `sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0` | |
| package byte length | 26171149 | |
| `bundle_id` | `bundle_full_20260710_337619ff` | |
| `content_sha256` | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` | |
| records SHA-256 | `sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90` | |
| search-index SHA-256 | `sha256:55bf98fc99a592f7003aa338fc7b4790bc9cd642b676c99a725d83a5f9ca79e3` | |
| package format version | `siralex_bundle_package_v1` | |
| package reproducibility check | `cmp` byte-identical rebuild PASS (2026-07-23); both builds SHA-256 `sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0` | |
| Published to catalog? | no (transport artifact only; wraps existing featured bundle) | no |

**Build command reference (exact — official primary candidate):**

```bash
pip install -e ./api

CANDIDATE_ROOT="build/phase7n1r1_featured_rc_20260723_180825"
FEATURED_BUNDLE_DIR="web/public/bundle_full_20260710_337619ff"

siralex-build-bundle verify "$FEATURED_BUNDLE_DIR"

siralex-build-bundle package \
  --bundle-dir "$FEATURED_BUNDLE_DIR" \
  --output "$CANDIDATE_ROOT/packages/bundle_full_20260710_337619ff.siralex.zip"
```

Deterministic rebuild check (required):

```bash
siralex-build-bundle package \
  --bundle-dir "$FEATURED_BUNDLE_DIR" \
  --output "$CANDIDATE_ROOT/packages/bundle_full_20260710_337619ff.rebuild.siralex.zip"

cmp -s \
  "$CANDIDATE_ROOT/packages/bundle_full_20260710_337619ff.siralex.zip" \
  "$CANDIDATE_ROOT/packages/bundle_full_20260710_337619ff.rebuild.siralex.zip"
```

**Retired / non-official identities (do not use for remaining Phase 7N1 device evidence):**

- Historical Slice 5 primary package wrapping Phase 7J `bundle_full_20260616_phase7j_alias_round2_candidate` (`sha256:d8273a18b739b8f0c165335dd104f944cb4079ed826a54f43b28d77ba26f7903`) — superseded by Phase 7N1R1 because featured product is now 7N2B.
- Engineering-only transport-smoke artifact `bundle_full_20260628_5098763f` — not product-equivalent to featured.

Official primary release candidate for all remaining Phase 7N1 work: **`bundle_full_20260710_337619ff.siralex.zip`** / **`sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0`**.

---

## Environment run header (copy per session)

| Field | Value |
|---|---|
| Session ID | |
| Scenario ID(s) | |
| Status | `not_run` |
| Tester identifier | |
| Date and local time | |
| Device model | |
| OS version | |
| Browser / PWA mode | browser / installed PWA |
| Network condition | online / offline / airplane mode |
| App URL / build | |
| Candidate package filename | |
| Candidate package SHA-256 | |
| `bundle_id` | |
| `content_sha256` | |
| Result summary | |
| Evidence location | |
| Notes | |

---

## Scenario matrix summary

Status key: `planned` | `in_progress` | `passed` | `failed` | `blocked` | `not_run` | `not_applicable`

| Scenario | Desktop Chromium/Firefox | Android Chrome | iPhone Safari | Notes |
|---|---|---|---|---|
| A — first valid install | `not_run` | `not_run` | `not_run` | |
| B — valid replacement | `not_run` | `not_run` | `not_run` | |
| C — offline persistence | `not_run` | `not_run` | `not_run` | |
| D — invalid structure | `not_run` | `not_run` | `not_run` | |
| E — integrity mismatch | `not_run` | `not_run` | `not_run` | |
| F — same-file retry | `not_run` | `not_run` | `not_run` | |
| G — concurrent-action protection | `not_run` | `not_run` | `not_run` | |
| H — three-file fallback | `not_run` | `not_run` | `not_run` | |
| I — file-picker behavior | `not_applicable` | `not_run` | `not_run` | run separately on each mobile platform |

---

## Scenario A — Valid package install (first dictionary)

### Desktop Chromium/Firefox

| Field | Value |
|---|---|
| Status | `not_run` |
| Tester | |
| Date/time | |
| Device / OS / browser | |
| Network | |
| Candidate filename / SHA-256 | |
| `bundle_id` / `content_sha256` | |
| French query used | |
| Maninka query used | |
| Normalization-sensitive query used | |
| Observed progress sequence | |
| Active dictionary after refresh? | |
| Search results acceptable? | |
| Survives close/reopen? | |
| Evidence file(s) | |
| Notes | |

### Android Chrome

| Field | Value |
|---|---|
| Status | `not_run` |
| *(same fields as desktop)* | |

### iPhone Safari

| Field | Value |
|---|---|
| Status | `not_run` |
| *(same fields as desktop)* | |

---

## Scenario B — Valid package replacement

Repeat environment blocks for Desktop / Android / iPhone. Record both primary and replacement candidate identities.

| Field | Value |
|---|---|
| Status | `not_run` |
| Prior active `bundle_id` | |
| New active `bundle_id` | |
| Switch atomic? | |
| Search on new bundle OK? | |
| Evidence file(s) | |

---

## Scenario C — Offline persistence

| Field | Value |
|---|---|
| Status | `not_run` |
| Offline method | airplane mode / other |
| Active dictionary identity offline | |
| French query offline result | |
| Maninka query offline result | |
| Forced reinstall after reconnect? | yes / no |
| Evidence file(s) | |

---

## Scenario D — Invalid package structure

| Field | Value |
|---|---|
| Status | `not_run` |
| Fixture used | |
| Concise failure message observed | |
| False success observed? | yes / no |
| Prior dictionary still active? | |
| Prior search still works? | |
| Evidence file(s) | |

---

## Scenario E — Integrity mismatch

| Field | Value |
|---|---|
| Status | `not_run` |
| Fixture used | e.g. local copy of `records_sha_mismatch.siralex.zip` |
| Concise failure message observed | |
| Install attempted? | yes / no |
| Prior dictionary still active? | |
| Prior search still works? | |
| Evidence file(s) | |

---

## Scenario F — Same-file retry

| Field | Value |
|---|---|
| Status | `not_run` |
| Initial failure scenario | D / E / other |
| Second attempt started? | |
| Evidence file(s) | |

---

## Scenario G — Concurrent-action protection

| Field | Value |
|---|---|
| Status | `not_run` |
| Concurrent action attempted | second package / legacy import / catalog |
| Second write started? | yes / no |
| False success observed? | yes / no |
| Controls recovered? | |
| Evidence file(s) | |

---

## Scenario H — Advanced three-file fallback

| Field | Value |
|---|---|
| Status | `not_run` |
| Three files used | manifest / records / index paths or names |
| Legacy route operational? | |
| Active bundle correct afterward? | |
| Search correct afterward? | |
| Evidence file(s) | |

---

## Scenario I — File-picker behavior

### Android Chrome

| Field | Value |
|---|---|
| Status | `not_run` |
| Picker opened? | |
| `.siralex.zip` selectable? | |
| Cancel harmless? | |
| Non-package rejection message | |
| Filename visibility / UX notes | |
| Evidence file(s) | |

### iPhone Safari

| Field | Value |
|---|---|
| Status | `not_run` |
| *(same fields as Android)* | |

---

## Issue log

Record one taxonomy class per issue. Use `no_issue` only when explicitly confirming clean execution.

| Issue ID | Taxonomy class | Severity | Reproducibility | Environment | Candidate | Disposition | Evidence | Status |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | `not_run` |

---

## Session sign-off

| Gate | Status |
|---|---|
| Candidate identity recorded and reproducible | `not_run` |
| All required environments attempted or marked `blocked` with reason | `not_run` |
| Blocker scenarios evaluated | `not_run` |
| Issue log complete | `not_run` |
| Raw exports / packages **not** committed to git | `not_run` |
| Ready for release-decision review | `not_run` |

**Maintainer summary:**

> *(empty — no device validation executed yet)*
