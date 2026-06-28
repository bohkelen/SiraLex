# Phase 7N1 Slice 5 — Device Acceptance Protocol

**Status:** documentation only — governs real-device validation of the single-file `.siralex.zip` manual-install route  
**Scope:** Slice 4 package picker (`1c6d6e0`) through Slice 3A/3B verification and existing installer  
**Does not authorize release:** completing this protocol template or recording `passed` in the evidence file requires human tester execution and evidence attachment  
**Companion:** `docs/reports/phase7n1_slice5_device_evidence_record.md`, `docs/PHASE_7N1_RELEASE_DECISION.md`

---

## Integrity and trust boundaries (read first)

A `.siralex.zip` package is **internally integrity-verified**, not publisher-authenticated.

The app verifies:

- STORED-ZIP package structure
- manifest schema and payload mapping
- SHA-256 consistency between manifest and payload blobs
- handoff into the existing bundle installer

The app does **not** verify publisher identity, code signing, or protection against a malicious sender.

Do **not** use language such as “trusted,” “signed,” “officially authenticated,” or “secure against a malicious sender” in tester notes or release rationale.

The **Advanced / legacy option** three-file route remains an independent fallback. Do not describe it as removed or deprecated.

---

## Release model

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

---

## Status vocabulary (required on every row)

Use exactly one status per scenario / environment row:

| Status | Meaning |
|---|---|
| `planned` | Scheduled but not started |
| `in_progress` | Tester actively executing |
| `passed` | Observed result meets pass criterion; evidence attached |
| `failed` | Observed result violates pass criterion |
| `blocked` | Cannot run (device, access, candidate, or environment blocker) |
| `not_run` | No tester, device, date, and observed result yet |
| `not_applicable` | Scenario legitimately out of scope for this candidate round |

A row without tester, device, date, and observed result is **`not_run`**, not “pending pass.”

---

## What is not evidence

The following do **not** substitute for device validation:

- unit tests
- Vitest/jsdom tests
- `npm run build`
- desktop-only testing
- a screenshot without candidate identity
- an unverified claim that a package was installed

---

## Tester quick path (one page)

Use this before the full matrix when time is limited. Full matrix evidence is still required before any release status above `in_device_validation`.

1. **Record candidate identity** in `docs/reports/phase7n1_slice5_device_evidence_record.md` § Candidate identity (build commands, SHAs, `bundle_id`, commit).
2. **Start clean:** no active dictionary, or note the starting active bundle in the evidence record.
3. **Primary route:** Manage Dictionaries → **Install dictionary package** → **Choose package** → select exactly one valid `.siralex.zip`.
4. **Watch progress:** `Preparing package…` → `Verifying dictionary data…` → `Installing dictionary…` → `Dictionary installed.`
5. **Confirm active dictionary** appears after refresh; run one French source query and one Maninka target query.
6. **Offline check:** airplane mode → close/reopen app → confirm dictionary still active and searchable.
7. **Invalid check:** with a working dictionary active, select an integrity-failed fixture; confirm concise failure and unchanged active dictionary.
8. **Attach evidence** (screenshots or screen recording filenames) to the evidence record; set row status to `passed` or `failed`.
9. **Do not** change release decision status without project-owner sign-off in `docs/PHASE_7N1_RELEASE_DECISION.md`.

---

## Required acceptance environments

| Environment | Minimum evidence |
|---|---|
| Desktop Chromium or Firefox | Smoke baseline for package selection and install |
| Android Chrome | Browser and installed-PWA behavior where available |
| iPhone Safari | Browser behavior and installed-PWA behavior where available |

Record for **every** run:

```text
tester identifier
date and local time
device model
OS version
browser / PWA mode
network condition
candidate package filename
candidate package SHA-256
bundle_id
content_sha256
result
evidence location or screenshot filename
notes
```

Do not assume identical file-picker behavior on Android and iPhone. Scenario **I** must be run separately on both mobile platforms.

---

## Candidate identity record (required before device runs)

Reproduce and record in the evidence file before executing scenarios. The candidate package is an **unpublished transport artifact** — do not commit `.siralex.zip` files or generated production bundles to the repository.

### Prerequisites

From repository root:

```bash
pip install -e ./api
```

### Build a verified bundle directory

Follow `docs/BUILD_BUNDLE.md` through verify. Example using an enriched normalized input already present in your builder environment:

```bash
mkdir -p build/bundles build/packages build/search_index data/enriched

siralex-build-index \
  --input data/enriched/malipense_enriched_norm_vN.jsonl \
  --output build/search_index.jsonl

siralex-build-bundle build \
  --normalized data/enriched/malipense_enriched_norm_vN.jsonl \
  --search-index build/search_index.jsonl \
  --output-dir build/bundles \
  --bundle-type full \
  --source-lang fr \
  --target-lang mnk \
  --source-label French \
  --target-label Maninka \
  --target-script latin \
  --target-script nko

siralex-build-bundle verify build/bundles/<bundle-id>
```

Replace `<bundle-id>` with the directory name emitted by the build step.

Record from `bundle.manifest.json` and verify output:

- `bundle_id`
- `content_sha256`
- records file SHA-256 (`files[]` entry for `records.jsonl`)
- search-index SHA-256 (`files[]` entry for `search_index.jsonl`)

### Build the deterministic transport package

Only after `verify` succeeds:

```bash
mkdir -p build/packages

siralex-build-bundle package \
  --bundle-dir build/bundles/<bundle-id> \
  --output build/packages/<bundle-id>.siralex.zip
```

Record from the command report:

- package filename
- package SHA-256
- package byte length
- package format version

### Candidate identity fields (fill in evidence record)

| Field | Source |
|---|---|
| git commit | `git rev-parse HEAD` at build time |
| branch | `git branch --show-current` |
| bundle-builder command | exact `siralex-build-bundle build …` line used |
| package-builder command | exact `siralex-build-bundle package …` line used |
| input bundle directory | e.g. `build/bundles/<bundle-id>` |
| package filename | e.g. `<bundle-id>.siralex.zip` |
| package SHA-256 | from package command output |
| package byte length | from package command output |
| `bundle_id` | manifest |
| `content_sha256` | manifest |
| records SHA-256 | manifest `files[]` |
| search-index SHA-256 | manifest `files[]` |
| build date | local date/time |
| builder environment | OS, Python version, `pip show siralex` or equivalent |

For scenario **B** (replacement), build and record a **second** verified candidate with a distinct `bundle_id`.

---

## UI surfaces under test

### Primary manual route (package)

Location: **Manage Dictionaries** (before Advanced setup)

| UI element | English copy |
|---|---|
| Section title | Install dictionary package |
| Hint | Choose a .siralex.zip package |
| Button | Choose package |

Progress messages (in order on success):

1. `Preparing package…`
2. `Verifying dictionary data…`
3. `Installing dictionary…`
4. `Dictionary installed.` (followed by record/index counts)

### Advanced fallback (three-file)

Location: **Manage Dictionaries → Advanced setup**

| UI element | English copy |
|---|---|
| Label | Advanced / legacy option |
| Hint | Install from three bundle files |
| Button | Install from three bundle files |

---

## Tester-visible failure states (package route)

Concise messages appear in the import progress area. Raw technical detail appears only in advanced diagnostics output (`#dbOut`), not in the primary progress text.

| Condition | Expected concise progress message |
|---|---|
| Invalid ZIP / package structure | The selected file is not a valid dictionary package. |
| Invalid manifest | The package manifest is invalid. |
| Verification failure (other) | Package verification failed. |
| Contents / hash mismatch | Package contents do not match the manifest. |
| Installer failure | Dictionary installation failed. (may append partial-removal note) |
| Writer busy / concurrent write | Another dictionary operation is already in progress. Try again when it finishes. |
| Multi-file selection | Select one .siralex.zip package only. |

**Pass observation rule:** never treat an attempt as successful unless `Dictionary installed.` appears **after** installation completes. Writer-busy and verification failures must not leave a false success state.

---

## Invalid-package fixtures (maintainer-supplied, not committed as release artifacts)

Use local copies derived from repository test fixtures or maintainer-built malformed packages. Do **not** commit generated candidate or fixture packages to git.

| Scenario | Suggested fixture source | Purpose |
|---|---|---|
| D — invalid structure | Non-zip file renamed to `.siralex.zip`, or corrupt archive | Structure rejection |
| E — integrity mismatch | Copy of `web/src/import/fixtures/bundle_package_integrity/records_sha_mismatch.siralex.zip` (maintainer local copy) | Hash mismatch before install |

---

## Scenario matrix

Execute every scenario on every required environment unless marked `not_applicable`. Record results in `docs/reports/phase7n1_slice5_device_evidence_record.md`.

### A. Valid package install — first dictionary

**Steps**

1. Start from a browser/PWA state with **no active dictionary**.
2. Use **Install dictionary package**.
3. Select exactly one valid `.siralex.zip` candidate.
4. Observe preparation, verification, installation, and success states.
5. Confirm the active dictionary is shown after refresh.
6. Search at least:
   - one French source query (example: `fruit`);
   - one Maninka target query (example: `Kun`);
   - one accent-insensitive or normalization-sensitive target query covered by the regression gate (example: unaccented `Kun` with direction set to Maninka → French, or accented `Kùn` per project baseline).
7. Close and reopen the PWA/browser.
8. Confirm the dictionary remains active and searchable.

**Pass criterion:** installation completes once; no false success; dictionary remains available after restart.

---

### B. Valid package replacement

**Steps**

1. Begin with an active valid dictionary (from scenario A or prior install).
2. Install a second verified candidate package with a **distinct** `bundle_id`.
3. Confirm the new bundle becomes active only after successful completion.
4. Confirm search works against the newly active bundle.
5. Confirm prior state is not left partially active (no ambiguous active-bundle messaging).

**Pass criterion:** atomic user-visible switch with no ambiguous active-bundle state.

---

### C. Offline persistence

**Steps**

1. Install a valid package while online.
2. Verify normal search.
3. Disable connectivity (airplane mode or equivalent).
4. Close and reopen the PWA/browser.
5. Verify active dictionary identity.
6. Repeat the selected French and Maninka searches from scenario A.
7. Restore connectivity; verify no forced reinstallation occurs.

**Pass criterion:** dictionary search and active-bundle state remain usable while offline.

---

### D. Invalid package structure

**Steps**

1. Begin with a known working active dictionary.
2. Select a static invalid-structure fixture (see fixtures table).
3. Confirm concise failure messaging.
4. Confirm no `Dictionary installed.` message appears.
5. Confirm the original active dictionary remains active.
6. Confirm a search still returns prior data.

**Pass criterion:** invalid package does not alter active dictionary or leave partial user-visible state.

---

### E. Integrity mismatch

**Steps**

1. Begin with a known working active dictionary.
2. Select a structurally valid package whose records or index hash does not match the manifest (see fixtures table).
3. Confirm a contents/verification failure message (`Package contents do not match the manifest.` or equivalent concise text).
4. Confirm original active dictionary remains active and searchable.

**Pass criterion:** integrity mismatch fails before installation.

---

### F. Same-file retry

**Steps**

1. Attempt a package install that fails (scenario D or E is sufficient).
2. Immediately select the **same file** again.
3. Confirm a second attempt begins (progress messages restart).

**Pass criterion:** input reset permits same-file retry.

---

### G. Concurrent-action protection

**Steps**

1. Begin package preparation or installation (large candidate or throttled network if needed to widen the window).
2. Attempt another package selection and, where feasible, another manual dictionary write action (legacy three-file picker or catalog install).
3. Confirm no second write/install begins.
4. Confirm no false-success status appears.
5. Confirm controls recover after the original action completes or fails.

**Pass criterion:** one write operation at a time, with a recoverable user state.

---

### H. Advanced three-file fallback

**Steps**

1. Open **Advanced setup**.
2. Use **Advanced / legacy option** → **Install from three bundle files**.
3. Install a valid three-file bundle through the pre-existing route (`bundle.manifest.json`, `records.jsonl`, `search_index.jsonl`).
4. Confirm package UI changes did not break the legacy route.
5. Confirm active bundle and search behavior remain correct.

**Pass criterion:** legacy route remains operational and independent.

---

### I. File-picker behavior (Android and iPhone separately)

**Steps**

1. Trigger **Choose package**.
2. Confirm the picker permits selecting a `.siralex.zip` file.
3. Confirm selecting no file is harmless.
4. Confirm selecting a non-package file is rejected by application validation (concise failure; active dictionary unchanged if one was active).
5. Record exact picker limitations, filename visibility, and user confusion points.

**Pass criterion:** selection path is understandable enough for a normal user; platform limitations are recorded rather than hidden.

---

## Field-evidence taxonomy (exactly one per issue)

```text
package_picker_friction
package_structure_failure
manifest_failure
integrity_failure
install_failure
offline_persistence_failure
active_bundle_state_failure
search_after_install_failure
legacy_fallback_failure
concurrency_state_failure
translation_or_copy_issue
device_specific_behavior
no_issue
```

Every issue record must include:

```text
severity: blocker | major | minor
reproducibility: always | intermittent | once
affected environment
candidate identity
steps
expected result
actual result
screenshot / video reference
recommended disposition: fix_before_release | document_known_limit | defer | reject_candidate
```

---

## Release-blocking failures

Do **not** approve release if any of these occur on required environments:

- valid package cannot be installed on Android Chrome
- valid package cannot be installed on iPhone Safari
- installed dictionary fails after offline restart
- invalid or integrity-failed package changes active dictionary state
- same-file retry fails
- a second write can begin while one is in progress
- legacy three-file fallback is broken
- candidate identity cannot be reproduced

---

## Conditional release prerequisites

A release may be considered only when:

- all required environments have completed evidence
- all blocker scenarios pass
- all major issues have explicit accepted disposition
- candidate package identity is recorded
- offline persistence passes on Android and iPhone
- release decision is signed by the designated project owner

---

## Related documents

| Document | Role |
|---|---|
| `docs/reports/phase7n1_slice5_device_evidence_record.md` | Per-run evidence tables |
| `docs/PHASE_7N1_RELEASE_DECISION.md` | Release gate status and owner sign-off |
| `docs/BUILD_BUNDLE.md` | Bundle and package build commands |
| `docs/PHASE_7N_DEVICE_VALIDATION_CHECKLIST.md` | General Phase 7M/7N field session checklist |
| `docs/PHASE_7N_RELEASE_PLAN_TEMPLATE.md` | Separate template for search/data intervention releases |
