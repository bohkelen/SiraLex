# DU1 — Consumer Dictionary Update Experience Report

## Decision

**DU1_DICTIONARY_UPDATE_EXPERIENCE_ACCEPTED**

## BASE_COMMIT

`6879bc2fd440a2d0a7fcd315ab62a023a784af50`

---

## Current update architecture audit (pre-change)

Already present and reused (no second update engine):

| Area | Finding |
|------|---------|
| Update detection | `compareCatalogEntryToInstalled` — same `bundle_id` + `content_sha256` inequality → `update_available` |
| Same-ID install lifecycle | `installRemoteCatalogBundle` / `installBundleIntoDb` — stage under new `storage_scope_id`, validate catalog↔manifest identity + payload byte lengths, commit active pointer, then delete previous scope |
| Failure before commit | Staging scope deleted; old active unchanged |
| Cleanup failure after commit | NEW stays active; `cleanupWarning` + session recovery on next load |
| Dictionaries Update button | Present via `renderInstalledDictionaryList` when catalog says update available |
| Featured first-run | Consumer progress mode already used |
| Remove from device | Deletes dictionary payload only; overlays retained; retain copy already present |
| Delete Database | Separate Data management section; deletes entire IDB including overlays |
| Interrupted recovery | `recoverInterruptedBundleInstall` for staging/committed sessions |
| IndexedDB | Version **6** — unchanged |
| Same-hash reinstall | **Not supported** — installer skips when scope already matches hash |

Gaps addressed by DU1:

- Search non-blocking update notice
- Consumer confirmation explaining retained data
- Consumer progress stage mapping for updates
- Success / failure dialogs
- Dictionaries card copy (“Installed” / “New version available” / “Update dictionary”)
- Remove confirm uses display name + retain wording
- Delete Database help clarifies personal-data wipe vs update/remove
- Session-only “Not now” dismissal for Search notice

---

## Consumer mental model

**Update dictionary** replaces on-device dictionary files after the new version is staged and active metadata is committed. Saved vocabulary, review progress, corrections, search feedback, query logs, and preferences are kept. Failure before commit leaves the current dictionary usable.

Not exposed in ordinary copy: `bundle_id`, `content_sha256`, `storage_scope_id`, internal artifact names.

---

## Update detection

Uses existing catalog comparison. Search notice requires **active** dictionary matching featured/catalog logical id with `update_available`. Catalog is restored from cache on boot and soft-refreshed from `FEATURED_CATALOG_URL` when online.

Same `bundle_id` + different catalog `content_sha256` = update (not a duplicate logical dictionary).

---

## Remote update validation guarantees (exact)

The remote same-ID update path provides these guarantees today. DU1 did **not** add payload cryptographic hashing/checksum verification.

| Guarantee | Status |
|-----------|--------|
| Catalog `bundle_id` matches manifest `bundle_id` | **PASS** (enforced in `installRemoteCatalogBundle`) |
| Catalog `content_sha256` matches manifest `content_sha256` | **PASS** (identity match only; not a payload digest check) |
| Manifest structure validates (`parseAndValidateManifestJson`) | **PASS** |
| Payload expected `byte_length` values enforced during streaming | **PASS** |
| New payload staged under new `storage_scope_id` before active metadata changes | **PASS** |
| Old payload remains active until commit | **PASS** |
| Remote payload cryptographic SHA-256 verification of downloaded bytes | **NOT PRESENT** |

Do not read “Checking dictionary files…” consumer progress copy as cryptographic payload SHA verification. That stage maps to catalog↔manifest identity checks and manifest structural validation.

---

## Search update notice

Non-modal `#dictionaryUpdateNoticeHost` notice when update available and not session-dismissed. Search remains usable. Disappears after successful update (hash matches catalog). “Not now” dismisses for the session only.

### `shouldShowSearchUpdateNotice` during confirm/progress

`shouldShowSearchUpdateNotice` returns `true` for `confirming` and `progress` when an update remains available (only `success` forces hide among active phases). That is intentional:

- The modal dialog is the exclusive update action surface while open (`showModal` / dialog overlay).
- Search chrome (including the notice host) is `display: none` when `data-primary` is not `search`, so Dictionaries update does not present an actionable duplicate beside the modal.
- On Search during confirm/progress, the modal blocks interaction with the notice’s Update button.
- After success, availability clears (installed hash matches catalog) and/or phase is `success`, so the notice is not shown.

No refactor in this acceptance run: no duplicate-update interaction bug observed in DU1/ML1E E2E.

---

## Dictionaries update state

One logical installed row. When update available: Installed + New version available + optional what’s-updated help + **Update dictionary**. Does not present old/new hashes as separate dictionaries.

---

## Confirmation / progress / success / failure

| Phase | Behavior |
|-------|----------|
| Confirm | Retained-data explanation; current dictionary remains if update cannot complete; Update dictionary / Cancel |
| Progress | Preparing → Downloading → Checking → Installing (± real % from bytes) → Removing old files |
| Success | Latest ready; previous files removed; saved vocabulary/feedback kept; Continue |
| Failure before commit | Update couldn't be completed; current dictionary still available; Try again / Close |
| Offline start | Graceful failure with connection-required message; no destructive start |

---

## Reinstall decision

**DEFERRED**

`DICTIONARY_REINSTALL_POLICY.supported = false`.

Reason: matching `content_sha256` is an intentional skip/activate-only path in `installRemoteCatalogBundle` / `installBundleIntoDb`. Safe same-hash force-replace is not available. Clear-first reinstall would be destructive and is out of DU1 scope (STOP rule §12/§22).

Reinstall destructive clear-first: **NO** (not implemented).

i18n keys for reinstall label/help exist for a future safe installer, but no consumer Reinstall control is shipped.

---

## Transactional lifecycle

Unchanged ordering:

1. Old active intact  
2. New staged under `bundle_id::new_hash`  
3. Catalog↔manifest identity validated; manifest structure validated; payload byte lengths enforced while streaming into the new scope  
4. Registry/active pointer committed to the new scope  
5. Previous dictionary payload scope deleted  

Installer progress copy extended only to emit consumer stage labels; ordering untouched.

Cleanup failure after commit: **NEW remains active**; problem recorded via `cleanupWarning` / install-session recovery — no rollback of the valid new dictionary.

---

## Continuity (accepted)

| Overlay | Behavior |
|---------|----------|
| Learning | Retained |
| Review | Retained |
| CF1 | Retained; original `content_sha256` / `storage_scope_id` provenance unchanged |
| CF2 | Retained; original `content_sha256` / `storage_scope_id` provenance unchanged |
| Query logs | Retained |
| Preferences (UI locale, search language) | Retained |

---

## Failure / offline

- Pre-commit failure injection (catalog/manifest `content_sha256` identity mismatch): OLD remains active and searchable; consumer failure dialog.
- Offline: current dictionary usable; update does not start destructively.

Cleanup-after-commit failure: existing `cleanupWarning` + interrupted-install recovery retained (unit/session evidence; full browser inject deferred as excessive harness).

---

## Accessibility / i18n

- Dialog `aria-labelledby`, focus on heading, touch-sized actions (`--touch-target-min`)
- Progress via `role="status"` / `aria-live`
- Notice `role="status"`
- All ordinary consumer strings EN + FR under `dictionaryUpdate.*` / related `dictionaries.*`

---

## Schemas / corpus

| Item | Result |
|------|--------|
| IndexedDB version | 6 |
| Learning / CF1 / CF2 / query-log schemas | unchanged |
| Catalog / bundle manifest schemas | unchanged |
| Production dictionary payload | unchanged |

---

## Final accepted invariants

- Same bundle/update engine reused (no second update engine)
- Same `bundle_id` + different content hash = update
- Search notice non-blocking
- Dictionaries row shows update state/action
- Confirmation explains retained personal data
- Old dictionary stays active while new version stages
- Active pointer changes only after new payload staging succeeds
- Old payload cleanup happens after commit
- Cleanup failure keeps NEW active
- Learning / Review / CF1 / CF2 / query logs / preferences retained
- Reinstall deferred (no safe same-hash force replacement)
- No destructive clear-first reinstall
- Delete Database remains a separate destructive operation
- IndexedDB remains v6
- No Learning/CF1/CF2/query-log/catalog schema changes
- Production dictionary payload unchanged

---

## High-risk files changed

### `web/src/install/bundle_install.ts`

- **Why:** Map lifecycle to consumer stages (download / identity-check / install / cleanup) without changing order.
- **Old:** Consumer mode mostly “Preparing” + percent “Adding…”.
- **New:** Optional stage strings; cleanup emits cleanup copy after commit.
- **Transactional/failure:** Unchanged.
- **Overlay impact:** None.
- **Verification:** No new cryptographic payload SHA engine.

### `web/src/main.ts`

- **Why:** Wire Search notice, confirm dialog, consumer update path, catalog soft-check, remove confirm copy.
- **Old:** Dictionaries Update called `installCatalogEntry` in detailed mode with no confirm.
- **New:** Confirm → consumer install with update progress copy → success/failure UI.
- **Overlay impact:** None (same installer).

### `web/src/render/render_dictionary_management.ts` / `render_dictionary_update.ts`

- Presentation only.

### `web/src/i18n.ts` / `web/src/style.css`

- Consumer copy + notice/dialog styling.

---

## Unexpected changes

NONE beyond DU1 UX/lifecycle integration and test harness.

## Scope deviations

- **Reinstall UI not shipped** — deferred; installer same-hash skip (documented).
- Cleanup-failure browser inject: documented as existing recovery path; not a new destructive harness.
- Remote payload cryptographic SHA verification: **NOT PRESENT** (not added in DU1).

---

## Tests / build

### Unit

`npm --prefix web run test:run` — **103 files, 992 tests passed**

### DU1 E2E

`npm --prefix web run test:e2e:du1` — **2 passed (32.8m)**

### ML1E E2E

`npm --prefix web run test:e2e:ml1e` — **1 passed (26.9m)**

### Regression E2E

| Suite | Result |
|-------|--------|
| `test:e2e:ux2-search` | 2 passed |
| `test:e2e:ux2-saved` | 2 passed |
| `test:e2e:ux2-review` | 2 passed |
| `test:e2e:corrections` | 7 passed (re-run clean after contended first attempt) |
| `test:e2e:search-feedback` | 7 passed |

### Build / diff check

`npm --prefix web run build` — **PASS**  
`git diff --check` — **PASS (exit 0)**

---

## Files changed (exact A/M/D)

### Modified

- `web/e2e/ml1e_featured_update_continuity.spec.ts`
- `web/package.json`
- `web/playwright.ml1d2.config.ts`
- `web/src/i18n.ts`
- `web/src/install/bundle_install.ts`
- `web/src/main.ts`
- `web/src/render/render_dictionary_management.test.ts`
- `web/src/render/render_dictionary_management.ts`
- `web/src/style.css`

### Added

- `docs/reports/du1_dictionary_update_experience_report.md`
- `web/e2e/du1_dictionary_update_experience.spec.ts`
- `web/src/dictionary_update/dictionary_update_availability.ts`
- `web/src/dictionary_update/dictionary_update_availability.test.ts`
- `web/src/dictionary_update/dictionary_update_consumer_state.ts`
- `web/src/install/bundle_install_du1_progress.test.ts`
- `web/src/render/render_dictionary_update.ts`
- `web/src/render/render_dictionary_update.test.ts`

### Deleted

NONE

### Untracked (pre-existing, not DU1 — not staged)

- `web/scripts/capture_ui_screenshots.mjs`

---

## Commit

Created after final validation (acceptance run).
