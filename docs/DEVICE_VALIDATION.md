# Device Validation - Task 7

Date: 2026-05-15  
Task scope: Phase 5b Task 7 (device validation execution)  
Status: **partially complete** (iPhone validated; Android pending)

This document tracks real-device validation for the current offline-first SiraLex flow:

- HTTPS app shell access
- PWA/home-screen install behavior
- norm_v2 directional bundle import
- search direction behavior after Task 6
- validation logging UI (toggle/export/clear/recent table)
- offline reopen and persistence

## 1) Test environment table

| Date | Device | OS version | Browser | HTTPS host used | Bundle used | Result |
|---|---|---|---|---|---|---|
| 2026-05-15 | iPhone | unknown | Safari | HTTPS catalog link (user-provided) | `bundle_full_20260427_ad0e7deb` | validated |
| 2026-05-14 | Android (pending) | pending | Chrome (pending) | pending | `bundle_full_20260427_ad0e7deb` | pending |
| 2026-05-15 | Desktop sanity (optional) | not re-run in Task 7 | not re-run in Task 7 | prior dev environment | `bundle_full_20260427_ad0e7deb` | informally validated earlier; not formally re-run |

## 2) Scenario-by-scenario results

### A. Initial access / app shell

| Device | App shell loaded | First-run state correct | Issues observed |
|---|---|---|---|
| iPhone Safari | yes | yes | no blocking issue after overflow fix/retest |
| Android Chrome | pending | pending | pending |
| Desktop (optional) | pending | pending | pending |

### B. PWA / home-screen install

| Device | Install available | Install path/friction | Launch from icon works | Standalone/app-like mode | Issues observed |
|---|---|---|---|---|---|
| iPhone Safari | yes | easy | yes | yes | none blocking in install flow |
| Android Chrome | pending | pending | pending | pending | pending |

### C. Bundle import (norm_v2 directional bundle)

| Device | Import successful | Approx import time | Multi-file picker friction | Stability (freeze/reset/memory) | Active dictionary state shown |
|---|---|---|---|---|---|
| iPhone Safari (manual file import, retest) | yes | not timed | manual 3-file flow remains cognitively awkward, but functional | stable during validation run | yes |
| iPhone Safari (catalog install) | yes | not timed | low friction | stable during validation run | yes |
| Android Chrome | pending | pending | pending | pending | pending |

Manual import blocker - resolved (iPhone Safari):

- Previously observed:
  - `.jsonl` bundle files were greyed out / not selectable in iPhone Safari Files picker.
- Fix applied:
  - Removed restrictive `accept` attributes from manual bundle import inputs while preserving strict JavaScript validation.
- Retest result:
  - `bundle.manifest.json`, `records.jsonl`, and `search_index.jsonl` are all selectable on iPhone Safari.
  - Manual bundle import completes successfully.
- Status: **resolved**.

### D. Search functionality (directional behavior)

Use these baseline queries:

- source_to_target: `bon travail` -> expected hit
- target_to_source: `ߘߊ߰` -> expected hit
- source_to_target: `ߘߊ߰` -> expected miss
- target_to_source: `bon travail` -> expected miss (strict non-fallback check)

| Device | Query | Direction | Expected | Actual | Pass/Fail | Notes |
|---|---|---|---|---|---|---|
| iPhone Safari | `bon travail` | source_to_target | hit | hit | pass |  |
| iPhone Safari | `ߘߊ߰` | target_to_source | hit | hit | pass | N'Ko input by copy/paste (no keyboard configured) |
| iPhone Safari | `ߘߊ߰` | source_to_target | miss | miss | pass |  |
| iPhone Safari | `bon travail` | target_to_source | miss | miss | pass | strict directional check |
| Android Chrome | `bon travail` | source_to_target | hit | pending | pending |  |
| Android Chrome | `ߘߊ߰` | target_to_source | hit | pending | pending |  |
| Android Chrome | `ߘߊ߰` | source_to_target | miss | pending | pending |  |
| Android Chrome | `bon travail` | target_to_source | miss | pending | pending | strict directional check |

Directional search matrix outcome (iPhone Safari): **passed**. No search correctness failures observed.

### E. Validation logging UI

| Device | Toggle works | Settled logging increments count | Recent table updates | Export works | JSONL file accessible | Clear works | Notes |
|---|---|---|---|---|---|---|---|
| iPhone Safari | yes | yes | yes | yes | yes | yes | "Clear logs" remains enabled even when count is zero (minor polish backlog) |
| Android Chrome | pending | pending | pending | pending | pending | pending |  |

### F. Offline reopen

| Device | Offline app shell loads | Bundle persists | Search works offline | Logging UI usable offline | Issues after kill/reopen |
|---|---|---|---|---|---|
| iPhone Safari | yes | yes | yes | yes | none observed |
| Android Chrome | pending | pending | pending | pending | pending |

Additional offline checks (iPhone Safari):

- Clear logs usable offline: **yes**
- Export usable offline: **yes**

### G. Persistence after reload/relaunch

| Device | Active bundle persists | Search still works | Query logs persist until cleared | Logging enabled state persists | Notes |
|---|---|---|---|---|---|
| iPhone Safari | yes | yes | yes | yes |  |
| Android Chrome | pending | pending | pending | pending |  |

## 3) Friction points

Record every user-visible friction even if behavior is technically correct.

- Manual three-file import remains cognitively awkward, even though it now works.
- N'Ko queries required copy/paste because no N'Ko keyboard was configured on test device.

## 4) Failures

Use this format for each failure:

- Severity: blocking | significant | minor
- Device/browser:
- Reproduction steps:
- Expected:
- Actual:
- Notes/follow-up task:

Current failures recorded:

- none currently open from iPhone validation pass
- **Minor backlog** - logging UX polish: "Clear logs" remains enabled even when there are no logs to clear.

Resolved and revalidated issues:

- **Resolved (previously blocking)** - iPhone Safari manual import `.jsonl` selection issue in Files picker.
- **Resolved (previously significant)** - iPhone responsive layout overflow (catalog/bundle metadata and validation logging areas now remain within usable viewport layout).

## 5) Outcome summary

Current assessment:

- iPhone Safari: **validated**
- Android Chrome: **pending real-device access** (temporarily deferred; no device access for ~2 months)
- Desktop: **informally validated during prior task reviews, not formally re-run**
- Overall Task 7: **partially complete pending Android real-device validation**

Reason:

- iPhone Safari validation completed successfully for app shell, install, import (catalog + manual), directional search, logging tools, offline reopen, and persistence.
- Previously observed iPhone blockers/friction sources were fixed and revalidated:
  - manual `.jsonl` import selection now works
  - mobile overflow no longer forces zoom-out
- Android Chrome real-device validation is still pending (temporarily deferred
  until hardware access resumes, expected in ~2 months).
- Desktop was informally validated during prior task reviews but not formally re-run in Task 7.

Mobile layout overflow - resolved (iPhone Safari):

- Previously observed:
  - App layout exceeded iPhone viewport width.
  - Large blank area appeared to the right.
  - User had to zoom out to use the page comfortably.
- Fix applied:
  - Responsive overflow hardening:
    - shrinkable flex children
    - safe wrapping for long URLs/hashes/technical strings
    - local horizontal containment for recent query logs table
    - minor mobile padding adjustment
- Retest result:
  - No page-level horizontal overflow observed on iPhone.
  - No forced zoom-out needed.
  - Catalog/bundle metadata and validation logging sections remain within usable mobile layout.
- Status: **resolved**.

## Notes

- This task intentionally avoids behavior changes.
- If blocking bugs are found during execution, document first, then create follow-up tasks.
- Related logging protocol: `docs/VALIDATION_TESTING_PROTOCOL.md`.
