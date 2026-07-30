# Phase 7N2H4M1 — Draft Full-Bundle Usage Harness Plan

## Decision

```text
FULL_BUNDLE_USAGE_HARNESS_PLAN_READY
```

Planning only. No harness, runtime, catalog, bundles, source data, matrices,
tests, packages, or review artifacts were changed. Son/`prix`, `fièvre`, and
`poulet` were not reopened. Usage evidence remains structured usability only
(not lexical validation / not demand).

## 1. Inputs

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2h4m0_next_practical_workstream_report.md` | Selected 7N2H full-bundle usage mode |
| `docs/reports/phase7n2g4l6_harness_settle_fix_closure_report.md` | Residual: default debug runs are all-miss |
| `docs/LOCAL_USAGE_AUTOMATION.md` | Documents `SIRALEX_USAGE_BUNDLE_DIR` / package env |
| `web/e2e/human_usage/usage_harness.spec.ts` | Bundle selection + install path |
| `web/.env.production` | Featured id `bundle_full_20260710_337619ff` |
| `web/public/catalog.json` | Featured 7N2B catalog entry present |

## 2. Current harness bundle mode

| Field | Value |
| --- | --- |
| Default command | `npm --prefix web run test:e2e:usage` |
| Default bundle dir | `web/public/debug-bundles/test_directional_bundle` (~28K) |
| Selection logic | `SIRALEX_USAGE_PACKAGE` if set → package import; else `SIRALEX_USAGE_BUNDLE_DIR` if set → three-file quick import; else default debug dir; catalog `#featuredInstall` click only if no package/dir and search still disabled |
| Why debug by default | Keep local automation fast for development smoke (`docs/LOCAL_USAGE_AUTOMATION.md`) |
| Typical debug outcome | Many/all misses — cannot exercise featured hit settle or real featured miss behavior |
| Existing full-bundle support | **Yes** — set `SIRALEX_USAGE_BUNDLE_DIR` to a three-file bundle directory (already documented) |
| Package alternative | `SIRALEX_USAGE_PACKAGE=/path/to/*.siralex.zip` (longer install; higher default timeout) |

Relevant defaults in harness:

```ts
usageBundleDir =
  process.env.SIRALEX_USAGE_BUNDLE_DIR?.trim()
  ?? path.join(webRoot, "public/debug-bundles/test_directional_bundle");
```

## 3. Target featured bundle

| Field | Value |
| --- | --- |
| Target | `bundle_full_20260710_337619ff` |
| Path | `web/public/bundle_full_20260710_337619ff/` |
| Size | ~25M (three-file dir present: manifest, records, search_index, checksums) |
| Catalog / env | Listed in `web/public/catalog.json`; selected by `VITE_FEATURED_BUNDLE_ID` |
| Not for this track | Lexical validation of Son/`prix`, `fièvre`, `poulet` |

## 4. Expected value of a full-bundle run

| Value | Why |
| --- | --- |
| Real hits + real misses | Featured 7N2B content, not debug stub |
| Hit settle path exercised | Complements harness settle fix verified mostly on miss-only debug runs |
| Phrase-miss guidance under featured | Confirm shipped “one word at a time” still appears on multiword misses |
| 7N2B smoke usability signal | Structured evidence only (`can_influence_demand: false`) |

## 5. Minimal implementation option for M2

**Recommendation: dedicated npm script wrapping existing env support** (no harness logic rewrite required).

| Option | Needed? | Notes |
| --- | --- | --- |
| Documented command only | Already exists | Sufficient for experts; easy to forget timeouts |
| Env flag in harness | Optional later | Not required; `SIRALEX_USAGE_BUNDLE_DIR` already is the flag |
| Small harness option / code branch | **No for minimal M2** | Install path already supports three-file dirs |
| Dedicated script | **Yes — prefer** | Thin `package.json` script + short docs line |

Proposed M2 shape:

1. Add npm script, e.g. `test:e2e:usage:featured`, that runs the same Playwright entry with:
   - `SIRALEX_USAGE_BUNDLE_DIR` pointing at `web/public/bundle_full_20260710_337619ff` (absolute or repo-relative resolved by harness `path.resolve`)
   - optionally elevated `SIRALEX_USAGE_INSTALL_TIMEOUT_MS` (e.g. ≥180000) for larger import
2. Document the script in `docs/LOCAL_USAGE_AUTOMATION.md` as the opt-in featured mode.
3. Keep `test:e2e:usage` on the debug default for fast iteration.

Example command (plan only; not executed in M1):

```bash
SIRALEX_USAGE_BUNDLE_DIR="$PWD/web/public/bundle_full_20260710_337619ff" \
SIRALEX_USAGE_INSTALL_TIMEOUT_MS=180000 \
npm --prefix web run test:e2e:usage
```

## 6. Risks

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Full-bundle run becomes the only default and slows everyday iteration | medium | Keep debug as default; featured mode opt-in via script |
| Longer install / query times flake | medium | Raise install timeout for featured script; keep query timeout unless evidence shows need |
| Scripted full-bundle rows treated as demand or lexical validation | medium | Preserve structured-usability / `can_influence_demand: false` boundary in docs + notes |
| Accidental catalog/runtime edits while “wiring” mode | low | M2 limited to npm script + docs (and harness only if path resolution requires it) |

## 7. Decision

```text
FULL_BUNDLE_USAGE_HARNESS_PLAN_READY
```

Support already exists via `SIRALEX_USAGE_BUNDLE_DIR`. The smallest M2 is a
dedicated featured npm script + docs, not a new harness architecture.

## 8. Next slice definition

**Phase 7N2H4M2 — Implement Featured-Bundle Usage Harness Mode**

Purpose: add the opt-in featured-bundle usage script (and docs) targeting
`bundle_full_20260710_337619ff`, keeping the debug default unchanged, without
changing product runtime or catalog behavior.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

M1 created only this report. No edits to harness code, env, catalog, bundles,
runtime, source data, matrices, tests, packages, or review artifacts.
