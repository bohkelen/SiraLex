# Phase 7N2F4K2 — Apply Approved Repo Cleanup

## Decision

```text
REPO_CLEANUP_APPLIED
```

Applied the K1 approved cleanup plan. Catalog, featured/fallback/rollback
bundles, runtime, source data, matrices, tests, packages, and review artifacts
were not edited. The May 18 local bundle was kept.

## 1. Cleanup actions applied

| Action | Result |
| --- | --- |
| Preflight: `git ls-files build` | empty (untracked) |
| Preflight: `git ls-files web/public/bundle_full_20260518_15605571` | empty (untracked) |
| Add `/build/` ignore rule | applied in `.gitignore` |
| Add narrow May 18 ignore rule | applied in `.gitignore` |
| Delete local untracked `build/` via filesystem `rm -rf` (not `git rm`) | applied; path no longer exists |
| Keep `web/public/bundle_full_20260518_15605571/` locally | kept (manifest/checksums/records/search_index present) |

## 2. `.gitignore` rules added

```gitignore
# Local generated pipeline/publish staging (do not commit)
/build/

# Local untracked historical public bundle kept for optional tools (not catalog)
/web/public/bundle_full_20260518_15605571/
```

Rules are rooted (`/…`) and do **not** broadly ignore all `web/public/bundle_full_*`.

## 3. Confirmation: `build/` was untracked and deleted locally

| Check | Result |
| --- | --- |
| Tracked files under `build/` before delete | none |
| Local deletion method | filesystem only (`rm -rf build`) |
| `build/` exists after delete | no |
| `git check-ignore -v build/` | `.gitignore:44:/build/	build/` |

## 4. Confirmation: May 18 bundle untracked, ignored, kept

| Check | Result |
| --- | --- |
| Tracked files under May 18 path | none |
| Local directory kept | yes |
| `git check-ignore -v web/public/bundle_full_20260518_15605571/` | `.gitignore:47:/web/public/bundle_full_20260518_15605571/	web/public/bundle_full_20260518_15605571/` |
| Appears in `git status --short` | no |

## 5. Confirmation: catalog / runtime / source / matrix / package untouched

Untouched in this slice:

- `web/public/catalog.json`
- `web/public/bundle_full_20260710_337619ff/` (featured)
- `web/public/bundle_full_20260708_27643bb0/` (7N2A)
- `web/public/bundle_full_20260616_phase7j_alias_round2_candidate/` (7J)
- runtime / i18n / source data / matrices / tests / packages / review artifacts

Post-apply presence check: featured + 7N2A + 7J directories still present.

## 6. Decision

```text
REPO_CLEANUP_APPLIED
```

## 7. Next slice definition

**Phase 7N2F4K3 — Verify Repo Cleanup State**

Purpose: re-verify ignore rules, absence of `build/`, presence of ignored May 18
bundle, clean status for those paths, and untouched catalog/runtime inventory.
