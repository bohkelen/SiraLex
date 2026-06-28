# Phase 7N1 Slice 5 — Device Evidence Record

**Status:** `not_run` — no device validation executed for this record yet  
**Protocol:** `docs/PHASE_7N1_DEVICE_ACCEPTANCE_PROTOCOL.md`  
**Release gate:** `docs/PHASE_7N1_RELEASE_DECISION.md`  
**Rule:** do not mark any scenario `passed` without tester, device, date, observed result, and evidence reference

---

## Record metadata

| Field | Value |
|---|---|
| Evidence record ID | `phase7n1_slice5_evidence_20260628_001` |
| Protocol version | Slice 5A (package manual-install route) |
| Record opened | 2026-06-28 |
| Last updated | 2026-06-28 |
| Maintainer | |
| Overall matrix status | `not_run` |

---

## Candidate identity (fill before device runs)

| Field | Primary candidate | Replacement candidate (scenario B) |
|---|---|---|
| Status | `recorded` | `not_run` |
| Provenance | Package constructed as a deterministic STORED-ZIP transport envelope around the exact currently featured logical bundle. Records, index, manifest identity, and content hash were not regenerated or altered. | |
| Featured catalog `bundle_id` | `bundle_full_20260616_phase7j_alias_round2_candidate` | |
| Featured catalog `content_sha256` | `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef` | |
| Featured catalog version | `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2` | |
| git commit | `befccc6ddec2a06dba5f609cfd20df067764f646` | |
| branch | `feat/phase-2.0.5-offline-pwa` | |
| build date (local) | 2026-06-28 18:55:44 EDT | |
| builder environment | Linux 6.8.0-117-generic; Python 3.10.12; `siralex-api` 0.1.0 | |
| candidate output root | `build/phase7n1_featured_candidate_20260628_185536` | |
| featured bundle directory | `web/public/bundle_full_20260616_phase7j_alias_round2_candidate` | |
| verify command | `siralex-build-bundle verify web/public/bundle_full_20260616_phase7j_alias_round2_candidate` | |
| package-builder command | `siralex-build-bundle package --bundle-dir web/public/bundle_full_20260616_phase7j_alias_round2_candidate --output build/phase7n1_featured_candidate_20260628_185536/packages/bundle_full_20260616_phase7j_alias_round2_candidate.siralex.zip` | |
| package filename | `bundle_full_20260616_phase7j_alias_round2_candidate.siralex.zip` | |
| package path (local, untracked) | `build/phase7n1_featured_candidate_20260628_185536/packages/bundle_full_20260616_phase7j_alias_round2_candidate.siralex.zip` | |
| package SHA-256 | `sha256:d8273a18b739b8f0c165335dd104f944cb4079ed826a54f43b28d77ba26f7903` | |
| package byte length | 24534212 | |
| `bundle_id` | `bundle_full_20260616_phase7j_alias_round2_candidate` | |
| `content_sha256` | `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef` | |
| records SHA-256 | `sha256:14353c66ce92b87aba108349b4f5d831961da740469d5295d54d8034ef4cf376` | |
| search-index SHA-256 | `sha256:4326bc4c9c7d51229b4afa44048751ff122a451dce3d52c2d20d56ac8281418e` | |
| package format version | `siralex_bundle_package_v1` | |
| package reproducibility check | `cmp` byte-identical rebuild PASS (2026-06-28) | |
| Published to catalog? | no (transport artifact only; wraps existing featured bundle) | no |

**Build command reference (exact — official primary candidate):**

```bash
pip install -e ./api

CANDIDATE_ROOT="build/phase7n1_featured_candidate_20260628_185536"
FEATURED_BUNDLE_DIR="web/public/bundle_full_20260616_phase7j_alias_round2_candidate"

siralex-build-bundle verify "$FEATURED_BUNDLE_DIR"

siralex-build-bundle package \
  --bundle-dir "$FEATURED_BUNDLE_DIR" \
  --output "$CANDIDATE_ROOT/packages/bundle_full_20260616_phase7j_alias_round2_candidate.siralex.zip"
```

Deterministic rebuild check (required):

```bash
siralex-build-bundle package \
  --bundle-dir "$FEATURED_BUNDLE_DIR" \
  --output "$CANDIDATE_ROOT/packages/bundle_full_20260616_phase7j_alias_round2_candidate.rebuild.siralex.zip"

cmp -s \
  "$CANDIDATE_ROOT/packages/bundle_full_20260616_phase7j_alias_round2_candidate.siralex.zip" \
  "$CANDIDATE_ROOT/packages/bundle_full_20260616_phase7j_alias_round2_candidate.rebuild.siralex.zip"
```

**Engineering-only transport-smoke artifact (not the official primary candidate):**

An earlier Slice 5B build from base `data/enriched/malipense_enriched_norm_v3.jsonl` produced `bundle_full_20260628_5098763f` under `build/phase7n1_slice5_20260628_185252/`. That artifact is deterministic and internally valid, but it is **not** product-equivalent to the current featured dictionary because it omits Phase 7J alias and source-index supplement layers. Do not use it for official Android/iPhone device evidence.

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
