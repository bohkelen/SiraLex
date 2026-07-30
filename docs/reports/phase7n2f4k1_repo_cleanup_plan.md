# Phase 7N2F4K1 — Draft Repo Cleanup Plan

## Decision

```text
REPO_CLEANUP_PLAN_READY
```

Planning/report only. No artifacts were deleted. No edits to `.gitignore`,
catalog, bundles, runtime, source data, matrices, tests, or packages.

## 1. Inputs inspected

| Source | Finding |
| --- | --- |
| `git status --short` | Untracked: `build/`; `web/public/bundle_full_20260518_15605571/` |
| `.gitignore` | Ignores `web/dist/` and related web outputs; **does not** ignore top-level `build/` or the May 18 public bundle path |
| `web/public/catalog.json` | Only three bundles: 7J, 7N2A, 7N2B |
| Featured / fallback dirs (present + tracked) | `bundle_full_20260710_337619ff` (featured); `bundle_full_20260708_27643bb0` (7N2A); `bundle_full_20260616_phase7j_alias_round2_candidate` (7J) |

## 2. Current runtime catalog inventory

| Role | `bundle_id` | In catalog | Tracked under `web/public/` |
| --- | --- | --- | --- |
| Featured | `bundle_full_20260710_337619ff` | yes | yes |
| Fallback (7N2A) | `bundle_full_20260708_27643bb0` | yes | yes |
| Rollback (7J) | `bundle_full_20260616_phase7j_alias_round2_candidate` | yes | yes |
| Untracked May 18 artifact | `bundle_full_20260518_15605571` | **no** | **no** (0 tracked files) |

Neither cleanup candidate is required for current featured 7N2B, fallback 7N2A, or
rollback 7J.

## 3. Artifact findings

### Artifact A — `build/`

| Field | Value |
| --- | --- |
| `path` | `build/` |
| `current status` | Untracked directory (~137M) |
| Contents (top level) | `phase7j_publish_staging/`, `phase7n1_featured_candidate_20260628_185536/`, `phase7n1_slice2_compat/`, `phase7n1_slice3a_fixtures/`, `phase7n1_slice5_20260628_185252/` (staging, fixtures, `.siralex.zip` packages, jsonl intermediates) |
| Generated output? | **Yes** — local pipeline/publish/staging outputs, not source of truth for featured runtime |
| `referenced_by_catalog` | `false` |
| `needed_for_current_runtime` | `false` |
| `recommended_action` | `ignore_and_remove` |
| `reason` | Ephemeral generated staging; not catalog-visible; not featured/fallback/rollback; currently unignored so it pollutes `git status`. Add `build/` to `.gitignore` in K2, then delete the local untracked tree. |
| `risk` | Low/medium — local historical package paths under `build/` would need regeneration if a future local usage/package experiment expects them; not required for current 7N2B runtime |

### Artifact B — `web/public/bundle_full_20260518_15605571/`

| Field | Value |
| --- | --- |
| `path` | `web/public/bundle_full_20260518_15605571/` |
| `current status` | Untracked directory (~24M); contains `bundle.manifest.json`, `checksums.sha256`, `records.jsonl`, `search_index.jsonl` |
| `referenced_by_catalog` | `false` |
| `needed_for_current_runtime` | `false` |
| Optional local references | Historical docs; `web/tools/norm_v3_matrix_runner.ts` (optional tools runner); `scripts/test_analyze_query_logs.py` fixture string — **not** current featured/fallback path |
| `recommended_action` | `ignore` |
| `reason` | Not in catalog and not needed for 7N2B/7N2A/7J, but still useful as an optional local historical fixture for tools. Prefer ignore (stop status noise) over delete in the first cleanup apply. |
| `risk` | Low if ignored and kept. Medium if removed without updating optional tools that hardcode this path. |

## 4. Recommended cleanup actions (for K2)

| Path | Recommended K2 action | Notes |
| --- | --- | --- |
| `build/` | 1) Add `build/` to `.gitignore` 2) Delete local untracked `build/` tree | Generated; safe relative to current runtime |
| `web/public/bundle_full_20260518_15605571/` | Add ignore rule for this path (or a narrow pattern) and **keep** local files for now | Clears status noise; avoids breaking optional historical tools |

Explicitly **do not** touch in K2:

- `web/public/bundle_full_20260710_337619ff/`
- `web/public/bundle_full_20260708_27643bb0/`
- `web/public/bundle_full_20260616_phase7j_alias_round2_candidate/`
- other already-tracked historical `web/public/bundle_full_*` directories
- `web/public/catalog.json`
- runtime / source / matrices / packages

Optional later follow-up (not this cleanup apply):

- Delete May 18 untracked bundle after retargeting or retiring optional tools that reference it
- Broader cleanup of older **tracked** public bundles (separate, higher-risk track)

## 5. Decision

```text
REPO_CLEANUP_PLAN_READY
```

Inspection is sufficient to proceed to an approved apply slice with a
non-destructive-first policy for the May 18 bundle and ignore+remove for
generated `build/`.

## 6. Next slice definition

**Phase 7N2F4K2 — Apply Approved Repo Cleanup**

Purpose: apply the approved plan — ignore `build/` and remove the local
untracked `build/` tree; ignore `web/public/bundle_full_20260518_15605571/`
while keeping the local files — without changing catalog, featured/fallback
bundles, or runtime behavior.

## 7. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

K1 created only this report. No deletions. No `.gitignore` edit. No catalog,
bundle, runtime, source, matrix, test, or package edits.
