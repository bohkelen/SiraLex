# SiraLex Roadmap

This roadmap documents the execution path to a usable, offline-first **French/English ↔ Maninka (Guinea)** dictionary and sentence analysis app with **Latin + N'Ko** as first-class scripts.

Guiding constraints:

- **N'Ko is always available**: generated deterministically when not provided, with **uncertainty marked** when Latin input is underspecified.
- **Offline-first**: the dictionary must remain usable without connectivity.
- **Provenance-first**: store provenance at **entry**, **sense**, and **example** levels.
- **Community trust**: no hallucinated language; uncertainty is surfaced.
- **Product language scope is explicit**: shipped dictionary surfaces are limited to **French/English ↔ Maninka**. If upstream source data contains other languages (for example Russian glosses/examples), those may remain in frozen source artifacts for provenance/history, but they are **out of scope for the product** and should not expand the runtime dictionary language set.

---

## How to read this document

This file mixes **historical milestones** (Phases 0–1), **shipped runtime work** (Phases 2–3, 6), and **ongoing calibration** (Phase 5). Use it in this order:

1. **[At a glance](#at-a-glance)** — what is done, what is pending, priority table.
2. **Phase sections** — details by theme (runtime, platform, search, product UX).
3. **[Open backlog](#open-backlog--follow-ups)** — intentional follow-ups, not active build work.
4. **[Definition of Done](#definition-of-done)** — milestone checklists.

Status markers: **✅ Complete** · **in progress** · **deferred** · **pending** (external dependency).

## Contents

- [At a glance](#at-a-glance)
- [Phase 0 — Repo + infra skeleton](#phase-0--repo--infra-skeleton)
- [Phase 1 — Data pipeline & frozen dataset](#phase-1--data-pipeline--frozen-dataset)
- [Phase 2 — Offline dictionary runtime](#phase-2--offline-dictionary-runtime)
- [Phase 3 — Platform generalization](#phase-3--platform-generalization--bundle-metadata-)
- [Phase 5 — Search/index quality](#phase-5--searchindex-quality-improvement)
- [Phase 6 — Consumer product layer](#phase-6--consumer-product-layer)
- [Phase 1.5 — Corrections (spec + dry-run)](#phase-15--corrections-spec--dry-run)
- [Deferred — Branch C (linguistic depth)](#deferred--branch-c-linguistic-depth)
- [Open backlog & follow-ups](#open-backlog--follow-ups)
- [Definition of Done](#definition-of-done)

---

## At a glance

### What ships today

- **Offline-first web app** with catalog-driven featured dictionary install, multi-bundle support, and directional search.
- **Featured bundle (in-repo):** `bundle_full_20260518_15605571` (`norm_v3`, display-enriched). Root `web/public/catalog.json` points here. **Production deploy verification** still pending (do not treat as live until confirmed on the host).
- **Consumer pipeline:** `normalized → enrich → index → bundle → catalog` (`docs/BUILD_BUNDLE.md`).
- **Controlled `norm_v2` test bundle** remains under `web/public/norm-v2-test/` for validation; not the default featured catalog.

### Priority & status

| Priority | Phase | Type | Status |
|----------|-------|------|--------|
| 1 | Phase 1.4.2 — Build and verify the first real bundle | Immediate | ✅ Complete |
| 2 | Phase 2.0.0 — Enrich bundle with display data | Backend prerequisite | ✅ Complete |
| 3 | Phase 2.0.1 — Web project scaffolding (Vite + TS) | Primary focus | ✅ Complete |
| 4 | Phase 2.0.2 — JS normalization mirror (`norm_v1` port) | Primary focus | ✅ Complete |
| 5 | Phase 2.0.3 — Bundle ingestion (storage correctness) | Primary focus | ✅ Complete |
| 5b | Phase 2.0.3b — Query execution (retrieval correctness) | Primary focus | ✅ Complete |
| 6 | Phase 2.0.4 — Results display + entry view (presentation correctness) | Primary focus | ✅ Complete |
| 7 | Phase 2.0.5 — Offline PWA finalization (first-install → offline proof) | Primary focus | ✅ Complete |
| 8 | Phase 3.1 — Manifest language metadata | Platform generalization | ✅ Complete |
| 9 | Phase 3.2 — Language-agnostic UI + direction semantics | Platform generalization | ✅ Complete |
| 10 | Phase 3.3 — Installed bundle registry | Platform generalization | ✅ Complete |
| 11 | Phase 3.4 — Multi-bundle support | Platform generalization | ✅ Complete |
| 12 | Phase 3.5 — Bundle selection + distribution | Platform generalization | ✅ Complete |
| 13 | Phase 5a — `norm_v2` indexing shipped | Search/index quality | ✅ Complete |
| 14 | `norm_v3` — NFC search-key canonicalization | Search/index correctness | ✅ Featured enriched bundle generated and root catalog updated; analytical + manual UI validation complete; production deployment verification pending |
| 15 | Phase 5b — Field Validation + Search Reality Calibration | Validation track | Substantially complete (Android real-device validation deferred pending hardware access) |
| 16 | Phase 1.5A — Correction record schema/specification | Next formal engineering milestone | ✅ Complete |
| 17 | Phase 1.5B — Dry-run correction application pipeline | Follows 1.5A approval | ✅ Complete |
| 18 | HTTPS + Android validation execution | Active validation follow-up | Pending hardware access |
| 19 | Branch C — Transliteration, morphology, linguistic inference | Only after users + data | Deferred |
| 20 | Phase 6B — Consumer Search-First UX + Infrastructure Layering | UX/product milestone | ✅ Complete |
| 21 | Phase 6D1 — Localization Architecture + French-First Interface Pass | Near-term consumer productization milestone | Implemented (pending review) |

### Rollout notes (norm_v3 featured bundle)

**Featured enriched bundle (root catalog):** `bundle_full_20260518_15605571`.

**Manual UI sign-off (complete):** `tête` → `kùn` path; reverse `Kùn`; reverse decomposed `kùn`; `pied`; reverse `Sen`.

**Policy note:** plain accentless `Kun` remains a separate search-policy topic, not a defect in this rollout.

**Validation observation (non-blocking):** NFC canonicalization can produce earlier `casefold` hits and narrower first-rung result sets for a small number of queries seen in validation (e.g. `-lú`, `-lù`, and `Kùn` / decomposed `kùn` versus `norm_v2`); under the current first-hit ladder doctrine this is treated as an expected precision shift, not a blocker.

**Decision memo:** plain accentless target-side lookup policy is framed in `docs/PLAIN_KUN_POLICY_DECISION_MEMO.md`; do not implement before Phase 6C logs show real user demand.

### Where the codebase stands

- **Phases 2.0 and 3** — Runtime, PWA, bundle ingestion, query ladder, multi-bundle, and catalog install are **complete** for current scope.
- **Phase 5a / `norm_v3`** — Indexing rulesets shipped; featured enriched `norm_v3` bundle generated and validated (analytical + manual UI); production URL check pending.
- **Phase 5b** — Validation layer and Round 1 (156 queries) **complete**; **Android real-device validation** still pending (hardware access).
- **Phase 1.5A/B** — Correction schema + dry-run pipeline **complete**; UI/moderation and committed correction releases **out of scope**.
- **Phase 6B / 6D1** — Consumer search-first UX and French-first localization **shipped** (6D1 pending review).
- **Branch C** — Transliteration / morphology **deferred** until usage data exists.

### Learning System & next product build

Canonical status (see `docs/reports/pd1_next_product_build_decision.md`,
`docs/reports/pd0_next_product_build_decision.md`, and
`docs/reports/lp1_local_learning_backup_restore_closure_report.md`):

```text
LS1 — Save — Closed
LS2 — Review and Reflect — Closed
LS3 — Progress and Return — Closed
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
LP1 — Local Learning Backup and Restore — Closed
LP1D0 — Defined
LP1I1 — Learning Backup Package Model and Validator — Implemented
LP1I2 — Deterministic Export — Implemented
LP1I3 — Restore Preview and Atomic Policies — Implemented
LP1I4 — Backup and Restore Surface — Implemented
LP1I5 — Offline and Lifecycle Verification — Implemented
LP1I6 — Closure — Complete
PD1 — Next Product Build Decision — Complete
CF1 — Community Correction and Feedback Capture — Selected
CF1D0 — Defined
CF1I1 — Correction Draft Model and Validation — Implemented
CF1I1A — Correction Validator Boundary Fixes — Complete
CF1I2 — Local Correction Draft Store — Implemented
CF1I2A — Correction Draft ID Generation Boundary — Complete
CF1I3 — Entry Suggestion Surface — Next
PV1A — Production Identity and Desktop Smoke — Parallel active
PV1B — Physical Device Validation — Parallel, hardware-gated
```

- **LS4** remains product-defined (`docs/reports/ls4d0_guided_review_sessions_product_definition.md`) but **must not** proceed to `LS4I1` unless direct use exposes a clear need for selective Review.
- **LP1** is closed (`docs/reports/lp1_local_learning_backup_restore_closure_report.md`).
- **PD1** selects `CF1 — Community Correction and Feedback Capture` as the next product build while keeping release validation as a parallel track (`docs/reports/pd1_next_product_build_decision.md`).
- **CF1D0** defines the local offline non-authoritative correction-capture and handoff-export product (`docs/reports/cf1d0_community_correction_feedback_product_definition.md`).
- **CF1I1** implements the pure draft/package model and validators (`docs/reports/cf1i1_correction_draft_model_validation_report.md`).
- **CF1I1A** tightens SHA-256 provenance to exactly 64 lowercase hex digits and caps package validation errors at 100 with `error_limit_reached`.
- **CF1I2** persists validated drafts in IndexedDB `correction_drafts` (v5) with stale-edit protection and bundle-lifecycle retention (`docs/reports/cf1i2_local_correction_draft_store_report.md`).
- **CF1I2A** requires secure draft IDs (`randomUUID` / `getRandomValues`) and fails closed when secure randomness is unavailable; never `Math.random()`.
- **Next slice:** `CF1I3 — Entry Suggestion Surface`.
- **Parallel validation:** `PV1A` production identity/desktop smoke now; `PV1B` physical-device matrix when hardware is available.
- Prior portfolio decision record: `docs/reports/pd0_next_product_build_decision.md`.

---

## Phase 0 — Repo + infra skeleton

Goal: create a stable foundation that supports ingestion, provenance, and offline distribution later.

### Deliverables

- **Monorepo structure decided** (or explicitly deferred, with decision date)
- **Dev environment** basics:
  - formatting/linting hooks (later)
  - baseline CI placeholder (later)
- **Source governance**:
  - `docs/SOURCES.md` policy (already present)
  - removal/modification request workflow (issue template already present)

### Definition of Done (Phase 0)

- A contributor can clone the repo, understand the goals, and open issues/PRs with the right templates.
- No third-party content is redistributed unintentionally.

---



## Phase 1 — Data pipeline & frozen dataset

Goal: ship a usable dictionary + sentence analysis experience for learners, starting with **Maninka (Guinea)**.

### Phase 1.1 — Raw capture (scrape + snapshot)

- Capture raw HTML snapshots (immutable) + crawl metadata:
  - URL, retrieved timestamp, content hash
- Store snapshots so parsing can iterate without re-scraping

DoD:
- Re-running parsing does not require re-downloading pages.

### Phase 1.2 — Parse + normalize (lossless IR)

- Produce a **lossless intermediate representation (IR)**:
  - raw fragment text/HTML blocks + extracted fields
- Normalization:
  - diacritics-insensitive search keys
  - POS mapping into internal tagset; keep `pos_raw`
  - preserve spelling variants and mark **preferred**
- Schema supports: `entry → sense → translation → form`, plus provenance at each level

DoD:
- Imported data retains traceability to raw snapshots and extracted fragments.

### Phase 1.x Freeze — Dataset immutability milestone

**Tag:** `v1.0-dataset-freeze`

All Phase 1.0–1.3 outputs are treated as **immutable artifacts** from this point forward. Any future corrections or rule changes produce new versions, never in-place edits.

Frozen artifacts:

- `data/ir/malipense_lexicon_v3.jsonl` (8,823 lexicon entries)
- `data/ir/malipense_index_v1.jsonl` (10,501 index mappings)
- `data/normalized/malipense_normalized_norm_v1.jsonl` (19,324 normalized records)
- Parser versions: `malipense_lexicon_v3`, `malipense_index_v1`
- Normalization ruleset: `norm_v1` (`shared/normalization/norm_v1.py`)
- Normalization manifest: `shared/normalization/manifest.yaml`

---

### Phase 1.3 — Transliteration layer (Latin → N'Ko) *(deferred → Branch C)*

- Deterministic transliteration module:
  - generate N'Ko for all display surfaces when missing
  - **mark uncertainty** when Latin is underspecified
- Round-trip `N'Ko → Latin normalized` can wait until later phases

DoD:
- Any record can be displayed in Latin and N'Ko, with uncertainty clearly indicated.

> **Status:** Deferred. Transliteration generation is postponed until there are real users, search logs, and correction data to inform the rules. See [Deferred — Branch C](#deferred--branch-c-linguistic-depth) below.

### Phase 1.4 — Search index + Offline bundle pipeline

Goal: produce a verified, distributable offline bundle from frozen data.

#### Phase 1.4 — Minimal search index ✅

- Materialize an inverted index mapping `(key_type, key)` → list of `ir_id` values
- Single JSONL file: `data/search_index/norm_v1_search_index.jsonl`
- Covers all 4 key types from `norm_v1`: `casefold`, `diacritics_insensitive`, `punct_stripped`, `nospace`
- No ranking, scoring, or UX decisions — just string → IR ID resolution
- Implementation: `api/search_index/` module, CLI `siralex-build-index`

DoD:
- 87,153 index entries from 19,324 records. Deterministic, byte-identical output.

#### Phase 1.4.1 — Offline bundle skeleton ✅

- Assemble normalized records + search index into a versioned bundle directory
- Bundle manifest (`bundle.manifest.json`) with per-file SHA-256 checksums and `content_sha256`
- Support for `full` and `seed` bundle types
- Implementation: `api/bundle_builder/` module, CLI `siralex-build-bundle`
- Spec: `shared/specs/offline-bundle-versioning.md`

DoD:
- Bundle builder produces spec-compliant bundles with integrity verification (`verify_bundle()`).

#### Phase 1.4.2 — First real bundle build ✅

- Validation run: execute the full pipeline on frozen data
- Run `siralex-build-index` → `siralex-build-bundle` on real frozen normalized JSONL
- Verify determinism (byte-identical across reruns) and bundle integrity
- Publish as draft GitHub release with manifest and checksums

DoD:
- Bundle `bundle_full_20260208_a5479c6d` built, verified, and attached to GitHub release (draft).
- Contents: 6.5 MB `records.jsonl` (19,324 records), 7.0 MB `search_index.jsonl` (87,153 entries).

---



## Phase 2 — Offline dictionary runtime

Goal: prove the frozen bundle is usable offline in a real browser — import, search, render entries, and work without connectivity.

**Status:** ✅ Complete for Phases 2.0.0–2.0.5 (see priority table above).

### Phase 2.0 overview

Delivered a minimal consumer of the bundle (not “frontend polish”):

- One search box, direction toggle, exact + forgiving ladder search, results → entry view
- No accounts, no ranking beyond first-match ladder
- Proves normalized records, latency, and search-key strategy on target devices

### Phase 2.0.0 — Enriched bundle records ✅

Bundle `records.jsonl` enriched with display fields from IR `fields_raw`. Each record now contains search metadata + a `display` field for rendering. The `display` field is a shallow, read-only projection — no normalization, inference, or ranking.

- Implementation: `api/enrichment/` module, CLI `siralex-enrich`
- Spec: `shared/specs/offline-bundle-versioning.md` § Enriched record schema
- Tests: 24 tests covering lookup construction, single-record enrichment, end-to-end processing, determinism, edge cases
- Result: 19,324/19,324 records enriched (0 missing), bundle `bundle_full_20260209_8b28f152` verified
- Bundle size: 13 MB `records.jsonl` + 7.1 MB `search_index.jsonl` (~20 MB total)

Layer separation (shipped):

- **2.0.3** — storage correctness (import pipeline) ✅
- **2.0.3b** — retrieval correctness (query execution) ✅
- **2.0.4** — presentation correctness (results display + entry view) ✅
- **2.0.5** — offline correctness (PWA first-install → offline proof) ✅

### Phase 2.0.3 — Hardening items (tracked for next PR)

These items were identified during PR C review. They should be addressed alongside or before Phase 2.0.3b:

1. **Inactive DB banner + one-click reset** — After a failed import, the DB contains partial data but no `active_bundle`. The UI should make this state unambiguous (explicit banner, one-click delete affordance, search disabled until successful import). Tracked as `TODO(hardening-1)` in `web/src/main.ts`.

2. **Optional debug duplicate-key detection** — Import counters (`records_count`, `index_entries_count`) count committed `put()` operations, not unique keys. An opt-in debug flag should track keys within each batch (Set of ≤500) to catch bundle generation regressions cheaply. Cross-batch detection is too expensive for prod. Tracked as `TODO(hardening-2)` in `web/src/import/import_records.ts` and `import_search_index.ts`.

3. **Max line length metric in bundle manifest** — The 4 MiB `MAX_JSONL_LINE_BYTES` cap is generous. The bundle builder should record the actual max line length in `search_index.jsonl` as a non-enforced informational metric in the manifest (future).

### Phase 2.0.3b — Query execution (retrieval correctness)

Goal: given a user query string, return an ordered list of `ir_id` values from IndexedDB.

**Critical implementation constraint**: the query function MUST call `computeSearchKeys([query])` from `web/src/norm/norm_v1.ts` — the same function used during import parity tests. It must never re-derive normalization logic. If the normalization mirror ever changes, both importer and query behavior stay consistent through this single entry point.

- Exactness ladder: `casefold` → `diacritics_insensitive` → `punct_stripped` → `nospace`
- For each key type (in order), do `store.get([key_type, normalized_key])` against `search_index`
- Stop at first non-empty `ir_ids[]` — no merging across levels, no ranking
- Preserve `ir_ids[]` order as-is (order from the bundle)
- No prefix search, no suggestions, no fuzzy matching

Performance expectations (87k entries, exact compound key lookup):

- O(1) per lookup, 1–3 ms on mid-range Android
- Worst case: 4 lookups (only `nospace` matches) = ~4–12 ms
- No batching needed

DoD:

- A user can type a query in the harness and see matching `ir_id` values from IndexedDB.
- Query uses the same normalization path as the import pipeline.

### Phase 2.0.4 — Results display + entry view (presentation correctness)

Goal: render search results as human-readable dictionary entries.

- Resolve `ir_id` list → fetch records from `records` store
- **Record resolution**: use `Promise.all` with multiple `get()` calls in a single read-only transaction, or parallel `get()` calls. Never open a transaction per record.
- Display summary line per result (headword, POS, first translation)
- Entry detail view: full senses, translations, variant forms, examples, provenance
- Language toggle: FR → Maninka vs Maninka → FR
- Consume the enriched `display` object (from Phase 2.0.0)
- No styling polish, no animations

DoD:

- A user can type a query, see a results list, and tap into a full entry view.

### Phase 2.0.5 — Offline PWA finalization (first-install → offline proof) ✅

Goal: prove the app works fully offline after manual bundle import.

The PWA shell (application code) and the dictionary bundle (dataset artifact) are separate layers that evolve independently. The app must not assume a canonical bundle host — different communities may host different bundles. Bundle acquisition via remote fetch, bundle catalogs, and delta updates belong in Phase 3.

Scope:

1. **Clear first-run state** — When no bundle is installed, show explicit guidance ("No dictionary installed. Download a dictionary bundle and import it.") with a single "Import bundle files" action that opens a multi-file picker. The user selects all 3 bundle files (`bundle.manifest.json`, `records.jsonl`, `search_index.jsonl`); the app auto-identifies, validates, and imports them.

2. **Verify service worker caching** — `vite-plugin-pwa` with default Workbox `generateSW` precaches all Vite build output. Verify `vite build` produces `sw.js` + `manifest.webmanifest` in `dist/`. Confirm in browser DevTools: Application → Service Workers (registered), Application → Cache Storage (static assets present). Do not modify Workbox config unless something is broken.

3. **Device testing** — On Chrome Android (mid-range device): visit site → install PWA → import bundle via file picker → kill browser → reopen → search offline. This proves IndexedDB persistence + service worker caching + offline shell + offline data.

Out of scope:

- No `fetch()`-based bundle download
- No bundle hosting decisions
- No CORS, range requests, or streaming download from network
- No bundle catalog or remote URL import
- No Workbox runtime caching rules
- No update orchestration

DoD:

- A learner can install the PWA, import a bundle via file picker, close the browser, reopen offline, and search successfully.

### Memory constraints (import / IndexedDB)

Observed via browser probe on the ~20 MB enriched bundle: **JSON.parse creates large transient heap spikes** even when not retaining parsed objects. To stay safe on mid-range Android, Phase 2.0.3 MUST follow these constraints:

- `records.jsonl` MUST NOT be fully materialized in memory as parsed objects.
- Import MUST be streaming: read → parse line-by-line → write to IndexedDB → discard.
- `search_index.jsonl` SHOULD NOT become a giant in-memory Map by default (87k entries can balloon).
- Prefer storing the search index in IndexedDB too (or a compact on-disk structure) and only reading what’s needed per query.

---

## Phase 3 — Platform generalization + bundle metadata ✅

Goal: evolve SiraLex from a proven offline dictionary for the first language pair into a reusable platform that can host multiple language bundles without embedding language-specific logic in the app.

### What Phase 3 must accomplish

- Move language knowledge out of the app and into bundle metadata
- Remove Maninka-specific UI assumptions from the frontend runtime
- Support multiple installed bundles with explicit active-bundle selection
- Prepare for bundle distribution/download without changing the core importer/search architecture

### Design constraints

- The platform should remain **bundle-driven**: language labels, language codes, and script/display metadata come from bundle manifests, not hardcoded app logic.
- Existing bundles should continue to import if the new metadata is absent; language metadata should be added as **optional, forward-looking fields** first.
- The current importer, search key generation, and normalized record/search-index formats are already strong foundations and should be reused rather than replaced.
- Do not treat large-scale search optimization as a Phase 3 blocker. Keep the architecture open for future indexing improvements, but do not over-engineer before real bundle scale requires it.

### Phase 3.1 — Manifest language metadata ✅

Extend `bundle.manifest.json` so the UI can describe the installed dictionary accurately.

Status note: implemented in the manifest type/parser, bundle builder emission, and compatibility tests.

Recommended metadata:

- `languages.source_lang`
- `languages.target_lang`
- `language_labels.source`
- `language_labels.target`
- optional script/display hints for the target language

Implementation impact:

- Update the runtime manifest type in the web app
- Update the bundle builder to emit metadata when available
- Preserve compatibility with older bundles by allowing these fields to be missing

DoD:
- A bundle can declare its language pair and display labels in the manifest.
- The app can parse that metadata safely, with sensible fallback behavior when absent.

### Phase 3.2 — Language-agnostic UI and direction semantics ✅

Replace language-specific frontend assumptions such as `FR → Maninka`, `Maninka → FR`, and enum values like `fr_to_mnk`.

Status note: implemented with runtime-derived labels and `source_to_target` / `target_to_source` search semantics.

Required direction semantics:

- `source_to_target`
- `target_to_source`

UI labels should be generated from manifest metadata instead of hardcoded strings.

DoD:
- Search labels, toggle text, placeholders, and entry-render labels are derived from the active bundle metadata.
- Frontend runtime code no longer embeds a specific target language in its direction model.
- Runtime search semantics enforce the selected direction instead of treating the toggle as display-only state.

#### Phase 4.2.5 — Directional search semantics ✅

This mini-phase makes the direction toggle real at query time without changing the normalized record schema. *(It was introduced with Phase 3 platform work; the **non-hybrid** manifest/builder/runtime alignment was completed later — see Phase 5b, “Directional contract hardening”.)*

Bundle contract:

- `search_index.jsonl` stores directional `key_type` values rather than a separate `direction` field
- source-side keys use the `src_` prefix
- target-side keys use the `tgt_` prefix
- the exactness ladder stays the same within each direction family:
  - `src_casefold` → `src_diacritics_insensitive` → `src_punct_stripped` → `src_nospace`
  - `tgt_casefold` → `tgt_diacritics_insensitive` → `tgt_punct_stripped` → `tgt_nospace`

Runtime rule:

- `source_to_target` searches only `src_*` keys
- `target_to_source` searches only `tgt_*` keys
- search still stops at the first matching exactness level and preserves stored `ir_ids[]` order

Current bundle-generation mapping:

- `index_mapping` records emit `src_*` keys from `fields_raw.source_term`
- `lexicon_entry` records emit `tgt_*` keys from headword/variant normalization

**Status (Phase 5b-aligned):** The bundle manifest exposes **`search_index_directional`**. The builder and runtime use a **single ladder per bundle**: directional bundles (`search_index_directional: true`, including `norm_v2` / `norm_v3` publish paths) use **only** directional `src_*` / `tgt_*` keys; legacy bundles use **only** undirected key families. There is **no** cross-family fallback, so ordering stays predictable.

### Phase 3.3 — Installed bundle registry ✅

Phase 2 proved the runtime for one imported bundle. Phase 3 should make bundle installation explicit by tracking installed bundles locally.

Status note: implemented with a dedicated bundle registry store plus active bundle metadata and install/update timestamps.

Suggested local registry responsibilities:

- installed bundle identity
- language pair metadata
- install/update timestamp
- active bundle flag or active bundle reference

DoD:
- The app can enumerate installed bundles and identify which bundle is active.

### Phase 3.4 — Multi-bundle support ✅

Support more than one dictionary bundle on the same device.

Status note: implemented with bundle-scoped IndexedDB keys and active-bundle-scoped query/record resolution.

The critical requirement is that storage and query behavior become **bundle-aware** before public multi-bundle release. The exact implementation can be a compound key, namespaced stores, or another equivalent IndexedDB strategy, but lookups must target the active bundle rather than implicitly assuming a single global dictionary.

DoD:
- Multiple bundles can coexist locally without search ambiguity.
- Query execution and record resolution operate against the active bundle only.

### Phase 3.5 — Bundle selection and distribution ✅

Add the user-facing pieces needed to choose and acquire dictionaries.

Status note: catalog-driven bundle acquisition is implemented and documented.

Scope:

- active dictionary selector
- optional local bundle catalog metadata
- remote catalog/download flow that reuses the existing importer

Notes:

- Manual import can remain supported.
- Update orchestration can stay simple at first (detect new bundle version/hash and prompt the user).
- Future task: unify catalog schema naming (`version` vs `catalog_schema_version`) and declare a single canonical catalog field before wider external bundle publishing.

DoD:
- A user can select which installed dictionary is active.
- The app has a documented path for catalog-driven bundle download/import, even if update logic remains minimal.

---



## Phase 5 — Search/index quality improvement

Phase 5 covers **indexing rulesets** (`norm_v2`, then **`norm_v3`** as the successor normalizer default for new derived artifacts) and **Phase 5b** — field validation and search-reality calibration. **Directional search** is **fully explicit**: manifests carry **`search_index_directional`**, and the runtime uses a **single** ladder per bundle (directional `src_*` / `tgt_*` **or** legacy undirected keys only — **no hybrid fallback**). That contract alignment shipped as the Phase 5b “Directional contract hardening” subtask.

### Phase 5a — `norm_v2` indexing shipped ✅

This milestone is complete.

What shipped:

- `norm_v2` was introduced additively rather than mutating frozen `norm_v1`
- `index_mapping.fields_raw.source_term` remains preserved verbatim
- deterministic extracted source phrases are added at normalization time for
  better `src_*` key coverage
- source-provided N'Ko headwords are included in target-side variants so
  `tgt_*` keys can match real N'Ko queries
- runtime query execution remains structurally unchanged; improved retrieval
  comes from better bundle key coverage, not from new client heuristics

Completion criteria now satisfied:

- the project has a documented, versioned indexing strategy for whole-string
  keys versus atomic searchable units
- real-bundle validation showed materially better retrieval for phrase-heavy
  and punctuation-heavy source entries without regressing deterministic bundle
  generation
- `norm_v2` remains explicit in derived artifacts and bundle metadata through
  `rule_versions.normalization`

### `norm_v3` — NFC search-key canonicalization (successor default) ✅

**Status:** Implemented. The normalizer’s active ruleset is **`norm_v3`**, which
preserves the full **`norm_v2`** variant and phrase-extraction contract and adds
**NFC preprocessing** of search-key input forms so composed and decomposed
Unicode spellings (e.g. `kùn` vs `kùn`) produce equivalent search-key material.
Frozen **`norm_v1`** / historical **`norm_v2`** Python modules are unchanged; new
builds stamp `norm_version: "norm_v3"` and manifest
`rule_versions.normalization: "norm_v3"`. Directional `src_*` / `tgt_*` bundles
behave like `norm_v2` from the runtime’s perspective (unchanged
`searchQuery` + ladder).

Rollout closure details (featured bundle, manual UI sign-off, precision-shift notes): see [At a glance — Rollout notes](#rollout-notes-norm_v3-featured-bundle).

### Phase 5b — Field Validation + Search Reality Calibration

Primary objective:
Observe and measure real search behavior under real-world constraints
(offline-first, low-literacy, mixed-language input).

This phase transitions SiraLex from architectural correctness to operational
validation.

#### Scope

This phase introduces a local-first validation layer that captures how users
actually interact with the search system and where it fails.

The goal is not to improve search heuristics yet, but to produce reliable
empirical signals that guide future bundle and normalization improvements.

#### Core components

##### 1. Query logging layer (opt-in, local-first)

Capture the following per query:

- `query_raw`
- `query_normalized_keys` (output of `computeSearchKeys`)
- `direction` (`source_to_target` | `target_to_source`)
- `ladder_level_hit` (`casefold` | `diacritics_insensitive` |
  `punct_stripped` | `nospace` | `none`)
- `ir_ids_count`
- `bundle_id`
- `bundle_version` (from manifest)
- `norm_version` (`norm_v1` / `norm_v2` / `norm_v3`)
- `app_version` (build identifier)
- `timestamp`
- `logging_enabled` (boolean)

Constraints:

- logging must be disabled by default
- must function fully offline
- storage must be local-only (IndexedDB or equivalent)
- must support manual export (JSONL)
- must support full deletion/reset

##### 2. Failure classification layer (manual, structured)

Provide a mechanism to tag queries with one of:

- `spelling_error`
- `phrase_mismatch`
- `language_mismatch`
- `missing_entry`
- `index_gap`

Rules:

- no automatic classification
- tagging can be post-hoc (after export or via debug UI)

##### 3. Local effectiveness metrics

Compute locally:

- `success_rate = queries with results / total queries`
- `empty_rate = no results / total queries`
- `fallback_rate = queries not resolved at first ladder level`

No dashboards required. Raw values are sufficient.

##### 4. Bundle feedback loop (offline-compatible)

Define the cycle:

1. Export query logs
2. Analyze externally
3. Identify failure patterns
4. Update:
   - phrase extraction
   - normalization rules
   - index coverage
5. Rebuild normalized JSONL, search index, and bundle under the appropriate `norm_vN` — for example, a refreshed `norm_v3` build, or a future `norm_v4+` only when a new ruleset change is justified.

No runtime AI involvement.

##### 5. Deployment & device validation (elevated priority)

Must be executed during this phase:

- HTTPS deployment of app shell
- iPhone (Safari PWA) offline install + reopen validation
- Android mid-range device validation
- bundle import friction test
- offline persistence validation

This is not optional.

Current status note:

- iPhone Safari validation path is complete.
- Android real-device validation is still pending and remains required for full
  Phase 5b completion; currently deferred while physical Android hardware is
  unavailable (expected follow-up window: ~2 months), then rerun and document.
- Task 8 controlled validation round is complete:
  - 156 controlled queries executed through the real runtime path
  - recurring patterns documented from observed outcomes
  - at least one concrete future bundle/index candidate identified:
    partial phrase retrieval granularity
- No search/index behavior changes are part of Task 8 completion.

##### 6. Directional contract hardening (subtask) ✅

Complete:

- manifest capability is formalized (`search_index_directional`)
- builder/runtime are aligned on the same directional contract
- strict runtime path separation (non-hybrid):
  - directional bundle -> directional ladder only
  - legacy bundle -> legacy ladder only

Constraint:

- must not delay validation work
- must not expand scope beyond contract explicitness

#### Privacy & safety constraints

- logging must be explicitly opt-in
- no automatic upload or transmission
- export must be manual
- users must be able to clear all logs instantly

#### Implementation tasks (execution order)

1. **Task 1 — Logging schema + store**
   - define JSONL schema
   - create IndexedDB store (for example `query_logs`)
   - implement append-only write
2. **Task 2 — Hook into query execution**
   - instrument Phase 2.0.3b query path
   - capture ladder resolution result
   - record bundle + norm metadata
3. **Task 3 — Debug mode toggle**
   - UI flag: enable/disable logging
   - persist setting locally
4. **Task 4 — Export + reset**
   - export logs -> JSONL file
   - add `clear logs` action
5. **Task 5 — Minimal inspection UI (debug only)**
   - last N queries
   - hit/miss indicator
   - ladder level
   - no styling, no productization
6. **Task 6 — Directional contract flag** ✅
   - manifest capability formalized (`search_index_directional`)
   - builder/runtime aligned on contract selection and validation
   - directional and legacy bundles now use distinct, non-hybrid lookup paths
7. **Task 7 — Device validation execution** (in progress)
   - run real device tests
   - document friction points
   - document failures
   - status: iPhone complete; Android pending future access
8. **Task 8 — First query validation round + search failure analysis** ✅
   - collect exported validation logs from a meaningful test round
   - target `>=100` queries, or enough diverse usage to reveal recurring failure patterns
   - manually classify notable failures using:
     - `spelling_error`
     - `phrase_mismatch`
     - `language_mismatch`
     - `missing_entry`
     - `index_gap`
   - compute basic external summary metrics from exported logs:
     - total queries
     - hit rate
     - miss rate
     - ladder-level distribution
   - document recurring failure patterns
   - derive at least one concrete bundle/index improvement candidate grounded in observed logs
   - constraints:
     - no dashboards
     - no automated classifiers
     - no ranking/search behavior changes
   - this is an analysis/validation milestone, not a feature-building milestone
   - completion note:
     - controlled Round 1 executed with 156 queries via real runtime path
     - recurring patterns documented in `docs/QUERY_VALIDATION_ROUND_1.md`
     - concrete future candidate identified: partial phrase retrieval granularity

#### Strict boundaries

Do not:

- modify normalization rules
- introduce fuzzy search
- introduce ranking/scoring
- introduce AI assistance
- expand linguistic scope (Branch C)

This phase is measurement only.

#### Exit criteria

Phase 5b is complete when:

- query logs are captured and exportable
- validation has been run on:
  - at least one Android device
  - at least one iPhone (Safari/PWA)
- recurring failure classes are observable
- at least one bundle/index improvement candidate is derived from real query
  data
- sufficient query volume exists:
  - target: `>=100` queries, or
  - enough diversity to reveal stable failure patterns

#### Outcome definition

You are done when:

- the system produces real behavioral data
- failures are observable, not theoretical
- bundle improvements are data-driven, not speculative

### Explicitly deferred beyond Phase 5b

These are valid future directions, but they should not be framed as Phase 3 prerequisites:

- prefix-range or Kindle-style narrowing indexes
- advanced ranking/scoring heuristics
- speculative performance work not justified by observed bundle size or device behavior

Those belong in a later scaling/performance phase once real multi-bundle usage and device measurements justify them.

#### Product/UX backlog from device validation: single-file manual bundle import

Observation (Task 7, iPhone Safari):

- manual import is now functional after compatibility fixes, but the current
  three-file selection flow is cognitively awkward for ordinary users:
  - `bundle.manifest.json`
  - `records.jsonl`
  - `search_index.jsonl`

Follow-up direction (not current scope):

- introduce a single distributable bundle package artifact (for example `.zip`
  or `.siralexbundle`) that contains manifest + payload files
- let users select one package file for manual sideload
- unpack locally, then run the existing strict manifest/checksum/import
  validation flow unchanged
- keep catalog install as the primary connected-install path
- keep raw three-file import as advanced/debug fallback

Status:

- backlog only; do not implement as part of current Phase 5b execution

---

## Phase 6 — Consumer product layer

### Phase 6B — Consumer Search-First UX + Infrastructure Layering ✅

Completion note:

- consumer search-first UX layering shipped
- featured dictionary primary install path shipped
- Manage dictionaries and Advanced diagnostics remain available as secondary infrastructure surfaces
- no platform capabilities were removed (catalog-driven install, multi-bundle support, manual import, validation diagnostics)

### Phase 6D1 — Localization Architecture + French-first interface pass *(implemented, review pending)*

Rationale:

- the dictionary content is French ↔ Maninka
- Guinea-facing users are more likely to expect a French interface than an English-first shell
- the current English-first app shell creates audience mismatch even when dictionary behavior is correct
- this is UI localization work; it is not Branch C linguistic depth and not a data-model change

Implemented scope:

1. **French UI copy coverage** for:
   - first-run install flow
   - search screen
   - progress/success/failure messages
   - offline fallback text
   - Manage dictionaries
   - Advanced setup
   - Advanced diagnostics
   - empty states and action buttons

2. **Lightweight localization architecture**:
   - keyed UI strings
   - current locale selection
   - English and French supported initially

3. **Deployment intent**:
   - current Guinea-facing/public deployment should likely default to French
   - English remains available as an optional interface language (or deployment-level configuration)

Implementation notes:

- lightweight keyed string layer introduced for consumer shell copy with `en` and `fr`
- deployment-configured default locale support added (`VITE_DEFAULT_LOCALE`) with fallback order: configured locale → browser locale → `fr`
- visible in-app locale selector is now present in the app shell (`Français` / `English`) and persists user preference locally (`siralex.ui_locale`)
- for Guinea-facing/public Netlify deployment, set `VITE_DEFAULT_LOCALE=fr` to enforce French-first UI regardless of browser locale

Boundaries preserved:

- do not alter dictionary content language coverage
- do not conflate this phase with Branch C transliteration/morphology work

Sequencing note:

- Phase 6C UX revalidation can proceed on the current build
- Phase 6D should be considered soon after (or alongside) pilot analysis because it directly affects self-serve audience fit

### Phase 6C feedback carry-forward (implementation follow-up)

Evidence from early Phase 6C user feedback indicates a clear product split:

- ordinary users need stronger first-run guidance and less technical landing copy before first dictionary install
- advanced/platform capabilities remain required, but should be framed as secondary/optional surfaces

This keeps the existing product philosophy intact:

- primary surface: search + direction toggle + results
- secondary surfaces: Manage dictionaries, Advanced setup, Advanced diagnostics
- no platform capability removal

Deferred product finding (not in the immediate patch):

- **Result interpretability / sense differentiation**: users may not know which target form to choose when one source query maps to multiple targets (example reported: `amour` → `jàrabi`, `kànin`, `tin`)
- treat this as a separate content + presentation track; do not fold it into first-run UX copy changes or phrase-retrieval/search-runtime behavior in the Phase 6C follow-up patch
- feasibility audit drafted in `docs/RESULT_INTERPRETABILITY_FEASIBILITY_AUDIT.md`; do not implement before Phase 6C confirms priority

Phase 6C revalidation packet and log-analysis support:

- tester packet + structured feedback template: `docs/PHASE_6C_TESTER_PACKET.md`
- local query-log export analysis workflow: `scripts/analyze_query_logs.py`
- analysis target: distinguish remaining setup/UX friction from search/content issues before opening the next implementation phase
- manual miss classifications to preserve during analysis:
  - `phrase_mismatch`
  - `missing_entry`
  - `index_gap`
  - `language_mismatch`
  - `spelling_error`

### Phase 7A — Source-side alias/index coverage ✅ *(complete)*

Phase 7A shipped a reviewed source-side alias layer for the enriched `norm_v3` featured bundle without changing runtime search logic, target-side search, or normalization semantics.

Completion notes:

- source-alias table v1 spec and tooling are in place (`shared/specs/source-alias-table-v1.md`, `api/source_aliases/`)
- reviewed alias data is tracked in `shared/aliases/source_aliases_v1.jsonl`
- featured bundle `bundle_full_20260602_7052fa3a` is published via root `web/public/catalog.json` as `norm-v3-featured-enriched-source-aliases-1`
- `records.jsonl` stayed byte-for-byte unchanged; only approved source-side alias keys were added to `search_index.jsonl`
- production smoke tests passed for `Yeux`, `Grande`, and `jumelle`; `Kun` and `mere` remained unchanged

Still deferred:

- `grand-parents` multi-target alias review
- `poil`, `oncle`, and `tante` source/content correction review
- phrase/compositional lookup, ranking changes, plain `Kun` policy, and result interpretability

### Phase 7B Round 1 — Source-index supplement coverage ✅ *(complete)*

Completion notes:

- source-index supplement tooling was added
- featured bundle `bundle_full_20260603_d0e4f812` was published via catalog version `norm-v3-featured-enriched-source-aliases-1-source-index-supplements-1`
- `poil`, `poils`, and `tante` were validated in production
- `tante` returns `nàlaka` first and `tɛ́nɛn` second
- `oncle` remains candidate/unapplied
- unrelated behavior remained unchanged for `mere`, target-side `Kun`, `Yeux`, `Grande`, `jumelle`, and phrase misses

Deferred follow-ups:

- `oncle` broad mapping review
- phrase/compositional lookup
- `mere` ranking/order investigation
- plain `Kun` accentless recall policy
- result interpretability / sense differentiation

### Phase 7D — `oncle` broad source-index supplement ✅ *(complete)*

Completion notes:

- Phase 7D added the broad `oncle` source-index supplement.
- featured bundle `bundle_full_20260606_6b8b401a` was published via catalog version `norm-v3-featured-enriched-source-aliases-1-source-index-supplements-2`
- `oncle` now returns the reviewed broad supplement with `bári`, `bárin`, `bárinkɛ`, `bɛ́nɔɔ`, `bɛ́nɔɔba`, and `bɛ́nɔɔnɛn`
- production smoke tests confirmed unchanged behavior for `poil`, `poils`, `tante`, `Yeux`, `Grande`, `jumelle`, `mere`, target-side `Kun`, phrase misses, and plural/form candidates
- reproducibility caveat: `source_index_supplements_v1.jsonl` is cumulative and not idempotent against already-supplemented baselines; Phase 7D publication used a scoped `oncle`-only rollout input derived from the cumulative reviewed table

### Phase 7E — Source-index supplement idempotent replay ✅ *(complete)*

Completion notes:

- Phase 7E added idempotent replay for source-index supplements.
- the cumulative `source_index_supplements_v1.jsonl` table can now be safely replayed against already-supplemented bundles
- replay outcomes are classified as `applied`, `already_present`, or `conflict`
- already-present identical generated records are skipped without duplication; conflicting records or source-index states fail hard
- report-level provenance was added; bundle manifest schema was intentionally not changed
- validator CLI gained `--defer-index-conflicts` for replay-aware workflows
- focused tests passed: `21 passed`
- migration validation passed:
  - against `bundle_full_20260603_d0e4f812`: `poil`, `poils`, and `tante` were `already_present`; `oncle` was `applied`
  - against `bundle_full_20260606_6b8b401a`: all four were `already_present`

Deferred follow-ups:

- optional manifest-level supplement provenance
- result interpretability
- phrase/compositional lookup
- `mere`/kinship ranking review

### Phase 7F — Reviewed plural/form source aliases ✅ *(complete)*

Completion notes:

- Phase 7F added seven reviewed French plural/form source aliases using `source_alias_table_v1`
- aliases shipped:
  - `mains → main`
  - `jours → jour`
  - `pieds → pied`
  - `hommes → homme`
  - `femmes → femme`
  - `oreilles → oreille`
  - `frères → frère`
- alias data commit: `4aabe4c Add reviewed plural form source aliases for Phase 7F`
- featured bundle publication commit: `b4c3d43 Publish Phase 7F plural form alias featured bundle`
- new production bundle: `bundle_full_20260609_phase7f_alias_candidate`
- production catalog version: `norm-v3-featured-enriched-source-aliases-2-source-index-supplements-2`
- production smoke passed on: `loquacious-piroshki-be432c.netlify.app`
- search-index delta: `28` `src_*` keys added; `0` changed keys; `0` removed keys; `0` target-side changes
- `records.jsonl` remained unchanged
- no runtime search, ranking, morphology, supplement schema, or target-side search changes were required

Deferred follow-ups:

- consolidate or retire the legacy Netlify site: `helpful-rugelach-e310ff.netlify.app`
- Phase 7F Round 2 alias candidates require a separate evidence-review cycle
- result interpretability remains deferred
- phrase/compositional lookup remains deferred
- `mere`/kinship ranking review remains deferred

### Phase 7G — Result interpretability UI ✅ *(complete)*

Completion notes:

- Phase 7G added compact French-first result-card labels.
- result cards now show:
  - direction label
  - entry found label
  - translation/sense label
  - neutral query hint when searched text differs from displayed entry
  - `Pourquoi ce résultat ?` disclosure
- the disclosure uses neutral wording only and does not expose alias/supplement claims
- ordinary detail pages no longer expose internal metadata:
  - `ir_id`
  - `source`
  - `norm`
  - raw `fr` metadata
  - target anchor IDs
- empty states improved:
  - ordinary no-result guidance
  - phrase-miss guidance for multi-word misses
- French UI language labels were fixed:
  - `Français ↔ Maninka`
  - `Français → Maninka`
- English UI still shows:
  - `French ↔ Maninka`
  - `French → Maninka`
- no bundle schema, bundle data, catalog, aliases, supplements, ranking, search algorithm, normalization, or bundle-generation changes were made
- production smoke passed on: `loquacious-piroshki-be432c.netlify.app`
- implementation commits:
  - `599bf70 Add Phase 7G result interpretability UI`
  - `8f498f9 Localize bundle language labels in UI`

Deferred follow-ups:

- exact alias/supplement provenance remains deferred until display-safe provenance exists
- result-card copy can be user-tested later with real Guinea-facing users
- phrase/compositional lookup remains deferred
- `mere`/kinship ranking review remains deferred
- Phase 7F Round 2 aliases remain a separate evidence-review cycle

### Phase 7H — Phrase miss review evidence ✅ *(complete)*

Completion notes:

- Phase 7H completed the review-control layer for phrase/compositional lookup without changing runtime behavior.
- Phrase lookup remains intentionally unimplemented. Phase 7H created the evidence and validation layer required before any future reviewed phrase-alias mechanism.
- Phase 7H added:
  - `shared/phrase_review/phrase_miss_review_v1.jsonl`
  - `api/phrase_review/validate_phrase_review.py`
  - `api/phrase_review/tests/test_validate_phrase_review.py`
- 9 phrase-miss evidence rows were added.
- No row is marked `approved`.
- The dataset is inert and not wired into search, alias generation, supplement tooling, bundle generation, catalog, UI, or runtime.
- The validator is read-only, stdlib-only, strict by default, and direct-script runnable.
- Validator checks:
  - JSONL integrity
  - required fields
  - enum constraints
  - duplicate `review_id`
  - duplicate `query`
  - review-state safety
  - related-term object shape
  - fixed bundle/catalog provenance
- Validation passed:
  - `validated 9 phrase review rows`
  - `approved rows: 0`
  - `candidate rows: 4`
  - `deferred rows: 1`
  - `rejected rows: 4`
  - `16 passed`
- implementation commits:
  - `6094fd6 Add Phase 7H phrase miss review dataset`
  - `7e11761 Add Phase 7H phrase review validator`

Deferred follow-ups:

- reviewed phrase-alias mechanism remains deferred
- phrase/compositional lookup remains deferred
- no runtime decomposition is approved
- no fuzzy search is approved
- `ferme la bouche → bouche` remains unsafe unless phrase-level evidence is reviewed
- future approved phrase aliases should use a phrase-specific artifact or explicit schema revision, not silent reuse of `source_alias_table_v1`

### Phase 7I — Source phrase alias spec and review packet ✅ *(complete)*

Completion notes:

- Phase 7I completed planning/specification only.
- Phase 7I defines the future phrase-alias mechanism but leaves implementation blocked until a named human reviewer approves at least one candidate with rationale.
- Phase 7I added:
  - `shared/specs/source-phrase-alias-v1.md`
  - `docs/PHASE_7I_PHRASE_ALIAS_REVIEW_PACKET.md`
- Option B was selected: a dedicated phrase-specific artifact.
- Future artifact path is `shared/phrase_review/source_phrase_aliases_v1.jsonl`.
- The future artifact was **not created**.
- Phase 7H evidence dataset (`phrase_miss_review_v1.jsonl`) remains inert and is not a generation input.
- `source_alias_table_v1` was not silently extended.
- Runtime search remains unchanged.
- No phrase aliases were approved.
- Both candidate rows were marked `deferred`:
  - `à l'insu de qqns → à l'insu de qqn`
  - `à la mesure des → à la mesure de`
- Seven unsafe mappings remain explicitly rejected:
  - `ferme la bouche → bouche`
  - `Grand chose → grand + chose`
  - `grande bouche → grand + bouche`
  - `à l'intérieurs → à l'intérieur`
  - `à la vue perçantes → à la vue perçante`
  - `à parts → part`
  - `à part ças → à part ça`
- implementation commits:
  - `d4154ef Add Phase 7I source phrase alias spec`
  - `31f768d Record Phase 7I phrase alias review decisions`

Deferred follow-ups:

- human review of both candidate rows
- creation of `source_phrase_aliases_v1.jsonl` only after approval
- validator/applier/report implementation only after approval
- pipeline wiring only after approved rows exist
- no runtime decomposition
- no fuzzy correction
- no typo-like aliases
- no phrase-to-single-word aliases
- no compositional phrase aliases

### Phase 7J — Source-index quality audit and alias round 2 publication ✅ *(complete)*

Completion notes:

- Phase 7J completed the full evidence-to-publication path for Alias Round 2:
  1. Source-index quality audit
  2. Alias Round 2 review packet
  3. Human review decision record
  4. `source_aliases_v1.jsonl` update
  5. Alias application validation/reports
  6. New immutable bundle publication
  7. Featured catalog update
- 11 Phase 7J source aliases were approved, added, validated, applied, and published:
  - `fruits → fruit`
  - `grains → grain`
  - `griots → griot`
  - `jambes → jambe`
  - `mots → mot`
  - `nuages → nuage`
  - `parents → parent`
  - `paroles → parole`
  - `enfants → enfant`
  - `feuilles → feuille`
  - `grand-parents → grand-mère + grand-père`
- `grand-parents` preserves order:
  - `grand-mère → 1f6d3a5919110b21`
  - `grand-père → 957bd76b41fda053`
- new featured bundle: `bundle_full_20260616_phase7j_alias_round2_candidate`
- production catalog version: `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2`
- `content_sha256`: `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef`
- `size_bytes`: `24532394`
- validation summary:
  - `11/11` new alias hits
  - `44` new `src_*` keys
  - `0` new `tgt_*` keys
  - `0` removed keys
  - `0` changed existing keys
  - `0` control regressions
  - `records.jsonl` byte-identical to Phase 7F
  - bundle verification VALID
  - source_aliases tests: `20 passed`
  - bundle_builder tests: `40 passed`
- implementation commits:
  - `e14f47e Add Phase 7J source-index quality audit`
  - `03c36a8 Add Phase 7J alias round 2 review packet`
  - `ca4facb Record Phase 7J alias round 2 review decisions`
  - `295b88d Add Phase 7J source alias rows`
  - `d1697b1 Add Phase 7J source alias application reports`
  - `8151000 Publish Phase 7J alias round 2 bundle`

Boundaries preserved:

- no runtime code changes
- no ranking changes
- no normalization changes
- no UI changes
- no supplements added
- no phrase aliases added
- no fuzzy search
- no decomposition
- no typo correction
- Phase 7F bundle `bundle_full_20260609_phase7f_alias_candidate` remains available as rollback baseline
- no deployment performed

Deferred follow-ups:

- update phrase-review validator expected bundle ID only if phrase-review tooling should target the new featured bundle
- optional local smoke: install featured dictionary from `/catalog.json` in dev server
- push branch / open PR
- deploy only after merge or explicit deployment approval

### Phase 7L — Curated search regression gate ✅ *(complete)*

Phase 7L adds a curated Python/runtime search-regression gate for approved lookup contracts against the pinned featured bundle. It is engineering QC only — not telemetry.

- CI workflow: `.github/workflows/phase7l_search_regression.yml`
- Operating procedure and human-authored changelog: `docs/reports/search_regression_changelog.md`
- Matrix and goldens live under `shared/search_regression/`; Python runner under `api/search_regression/`; runtime adapter under `web/src/search_regression/`

---

## Phase 1.5 — Corrections (spec + dry-run)

Parts of the feedback loop can be built without a UI. This work is safe and doesn't lock UX decisions.

### 1.5A — Correction record schema/specification ✅ *(complete)*

JSON schema for:

- `correction_id`
- `target_ir_id`
- RFC 6902 patch
- `submitter` (anonymous token)
- `timestamps`
- `status`

Formal specification has now been drafted:

- Spec: `shared/specs/correction-record-schema-v1.md`
- Scope includes:
  - exact schema fields
  - allowed correction statuses
  - `target_ir_id` relationship to IR
  - RFC 6902 patch constraints
  - validation rules
  - provenance/audit metadata
  - test requirements for validation behavior

This milestone is schema-only and does not change runtime behavior.

### 1.5B — Correction application pipeline (dry-run) ✅ *(complete)*

Tool that:

- Takes IR JSONL
- Applies approved corrections
- Produces new IR version

No UI, no moderation yet — just correctness.

Planning/specification artifact drafted:

- Spec: `shared/specs/correction-application-dry-run.md`
- Scope includes:
  - correctionset input format and deterministic ordering
  - input contracts and IR version context
  - validation stages and approved-status filtering
  - conflict policy and deterministic apply/reject behavior
  - apply-on-copy behavior and output artifact contract
  - failure reason codes and deterministic test matrix

Implementation completion note:

- correctionset manifest contract validation + `corrections.jsonl` integrity checks (`byte_length` + `sha256`)
- lifecycle resolution, supersession filtering, and same-target conflict handling
- deterministic apply-on-copy corrected IR output + machine-readable report generation
- CLI command: `siralex-corrections-dry-run`
- focused backend test coverage for lifecycle, integrity, conflicts, patch validation, and deterministic replay

Current boundaries (still intentional):

- correction schema/spec is complete
- dry-run apply pipeline is complete
- no UI/moderation workflow exists yet
- no committed correction-release workflow exists yet
- dry-run does not persist lifecycle transitions to `applied`

DoD:
- Correction record schema/specification is formalized in `shared/specs/correction-record-schema-v1.md`.
- Dry-run pipeline specification is formalized in `shared/specs/correction-application-dry-run.md`.
- Dry-run pipeline implementation is complete with deterministic dry-run outputs and report generation.

## Deferred — Branch C (linguistic depth) *(deferred)*

This includes:

- Transliteration (Latin → N'Ko)
- Cross-entry variant graph
- Morphology
- Sense clustering

> **Do not start this until:**
>
> - You have users
> - You have search logs
> - You have correction data
>
> Otherwise you'll invent rules in a vacuum. Transliteration generation was correctly deferred for this reason.

DoD:
- Defined per-feature when the prerequisites are met.

---



## Open backlog & follow-ups

Items intentionally **not** part of the current closure scope:

| Item | Notes |
|------|--------|
| **Production deploy verification** | Confirm live `/catalog.json` and `bundle_full_20260518_15605571` manifest after Netlify deploy. |
| **Plain accentless `Kun`** | Separate search-policy decision; not a `norm_v3` rollout defect. |
| **Old featured bundle directory** | `web/public/bundle_full_20260418_1dc526df/` retained temporarily for stale URL safety; remove after cache window. |
| **`real-test-bundles/` mirror** | Unreferenced duplicate tree; deprecate or remove in a hygiene PR. |
| **Android device validation (Phase 5b)** | iPhone complete; Android pending hardware access. |
| **Phase 6C UX revalidation** | Re-run user feedback on enriched `norm_v3` featured surface. |
| **Single-file manual bundle import** | Backlog from device validation (see Phase 5b); keep three-file import as advanced fallback. |
| **Result interpretability** | Sense disambiguation when one source maps to many targets (6C feedback); separate content/presentation track. |

---

## Definition of Done

### Phase 1 — backend pipeline

The backend pipeline is complete when:

- ✅ Raw snapshots captured and immutable
- ✅ Lossless IR produced with provenance
- ✅ Normalization versioned and deterministic
- ✅ Search index materialized
- ✅ First offline bundle built, verified, and published

### Phase 2 — minimal dictionary

A learner can:

- Search **French → Maninka** and **Maninka → French**
- See results in **Latin** (N'Ko deferred to Branch C)
- Use the dictionary offline after initial caching/download
- Experience acceptable lookup latency on a mid-range Android phone

### Phase 3 — platform generalization

SiraLex is no longer just a single-dictionary app when:

- The active language pair is determined by bundle metadata, not hardcoded labels
- Multiple bundles can be installed locally and selected explicitly
- Search and record resolution are bundle-aware
- The app has a defined path for catalog/download-based bundle installation

Those conditions are now satisfied for the current runtime scope.

