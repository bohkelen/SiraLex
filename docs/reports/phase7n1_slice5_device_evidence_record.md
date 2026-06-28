# Phase 7N1 Slice 5 — Device Evidence Record

**Status:** `not_run` — no device validation executed for this record yet  
**Protocol:** `docs/PHASE_7N1_DEVICE_ACCEPTANCE_PROTOCOL.md`  
**Release gate:** `docs/PHASE_7N1_RELEASE_DECISION.md`  
**Rule:** do not mark any scenario `passed` without tester, device, date, observed result, and evidence reference

---

## Record metadata

| Field | Value |
|---|---|
| Evidence record ID | `phase7n1_slice5_evidence_YYYYMMDD_NNN` |
| Protocol version | Slice 5A (package manual-install route) |
| Record opened | |
| Last updated | |
| Maintainer | |
| Overall matrix status | `not_run` |

---

## Candidate identity (fill before device runs)

| Field | Primary candidate | Replacement candidate (scenario B) |
|---|---|---|
| Status | `not_run` | `not_run` / `not_applicable` |
| git commit | | |
| branch | | |
| build date (local) | | |
| builder environment | | |
| bundle-builder command | | |
| package-builder command | | |
| input bundle directory | | |
| package filename | | |
| package SHA-256 | | |
| package byte length | | |
| `bundle_id` | | |
| `content_sha256` | | |
| records SHA-256 | | |
| search-index SHA-256 | | |
| package format version | | |
| Published to catalog? | no (transport artifact only) | no |

**Build command reference (exact):**

```bash
pip install -e ./api

siralex-build-bundle build \
  --normalized <path-to-enriched.jsonl> \
  --search-index <path-to-search_index.jsonl> \
  --output-dir build/bundles \
  --bundle-type full \
  --source-lang fr \
  --target-lang mnk \
  --source-label French \
  --target-label Maninka \
  --target-script latin \
  --target-script nko

siralex-build-bundle verify build/bundles/<bundle-id>

siralex-build-bundle package \
  --bundle-dir build/bundles/<bundle-id> \
  --output build/packages/<bundle-id>.siralex.zip
```

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
