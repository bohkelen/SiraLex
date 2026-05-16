# Roadmap (Phase 0 → Phase 5)

This roadmap documents the execution path to a usable, offline-first **French/English ↔ Maninka (Guinea)** dictionary and sentence analysis app with **Latin + N'Ko** as first-class scripts.

Guiding constraints:

- **N'Ko is always available**: generated deterministically when not provided, with **uncertainty marked** when Latin input is underspecified.
- **Offline-first**: the dictionary must remain usable without connectivity.
- **Provenance-first**: store provenance at **entry**, **sense**, and **example** levels.
- **Community trust**: no hallucinated language; uncertainty is surfaced.
- **Product language scope is explicit**: shipped dictionary surfaces are limited to **French/English ↔ Maninka**. If upstream source data contains other languages (for example Russian glosses/examples), those may remain in frozen source artifacts for provenance/history, but they are **out of scope for the product** and should not expand the runtime dictionary language set.

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

## Phase 1 — Data liberation + Offline dictionary (Maninka first)

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

> **Status:** Deferred. Transliteration generation is postponed until there are real users, search logs, and correction data to inform the rules. See [Branch C — Linguistic depth](#branch-c--linguistic-depth-deferred) below.

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

## Evolution branches (post-Phase 1.4.2)

Once the first bundle exists, the project can evolve in three orthogonal directions. **Only one should be primary at a time.**

### Phase 2.0.0 — Enriched bundle records ✅

Bundle `records.jsonl` enriched with display fields from IR `fields_raw`. Each record now contains search metadata + a `display` field for rendering. The `display` field is a shallow, read-only projection — no normalization, inference, or ranking.

- Implementation: `api/enrichment/` module, CLI `siralex-enrich`
- Spec: `shared/specs/offline-bundle-versioning.md` § Enriched record schema
- Tests: 24 tests covering lookup construction, single-record enrichment, end-to-end processing, determinism, edge cases
- Result: 19,324/19,324 records enriched (0 missing), bundle `bundle_full_20260209_8b28f152` verified
- Bundle size: 13 MB `records.jsonl` + 7.1 MB `search_index.jsonl` (~20 MB total)

---

### Branch A — Phase 2.0: Minimal Offline Dictionary UI *(most leverage, primary focus)*

This is the natural next step. Not "frontend polish", but a **read-only consumer of the bundle** that proves the data model is usable by humans, lookup latency is acceptable, and the search key strategy is sane.

#### Scope (keep it disciplined)

- One input box
- Language toggle (FR → Maninka, Maninka → FR)
- Exact + forgiving search
- Results list → entry view
- No accounts
- No feedback yet
- No ranking heuristics beyond "first match"

#### What it proves

- The normalized records are consumable by a real UI
- Lookup latency is acceptable on target devices
- The search key strategy works for real queries

#### What it unlocks

Everything else. Without a UI that proves the bundle works, further backend or linguistic work is speculative.

DoD:
- A learner can search FR → Maninka and Maninka → FR offline in a browser, using the published bundle.

---

### Branch B — Phase 1.5: Correction groundwork *(spec + backend, UI-agnostic)*

Parts of the feedback loop can be built without a UI. This work is safe and doesn't lock UX decisions.

#### 1. Correction record schema (spec-level)

JSON schema for:

- `correction_id`
- `target_ir_id`
- RFC 6902 patch
- `submitter` (anonymous token)
- `timestamps`
- `status`

This is already hinted at in multiple specs — formalizing it completes the data model loop.

#### 2. Correction application pipeline (dry-run)

Tool that:

- Takes IR JSONL
- Applies approved corrections
- Produces new IR version

No UI, no moderation yet — just correctness.

DoD:
- Correction record JSON schema formalized in `shared/specs/`.
- Dry-run pipeline can apply corrections to IR and produce a new versioned output.

---

### Branch C — Linguistic depth *(deferred)*

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

## Recommended ordering

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
| 14 | Phase 5b — Field Validation + Search Reality Calibration | Next primary focus | Pending |
| 15 | Phase 1.5 (spec + backend) — Correction schema + pipeline | Parallel, light | Pending |
| 16 | HTTPS + device validation execution | Active validation track | Pending |
| 17 | Branch C — Transliteration, morphology, linguistic inference | Only after users + data | Deferred |

Phase 2.0 (Branch A) and the originally planned Phase 3 platform work have now served their purpose: the runtime proves bundle ingestion, IndexedDB storage, query execution, rendering, offline shell behavior, manifest-driven language metadata, installed bundle registry, active bundle selection, multi-bundle isolation, and catalog-driven install/update flows. The roadmap was previously lagging behind this implementation reality. Search/index quality is no longer a single undifferentiated pending bucket: **Phase 5a** is now treated as complete because `norm_v2` indexing has been implemented and validated, while **Phase 5b** becomes the next primary engineering track for observing real search behavior under real constraints and calibrating future bundle improvements against empirical usage. Directional contract hardening remains necessary, but it is now a bounded subtask inside that validation phase rather than the phase objective. Phase 1.5 backend work can still proceed in parallel as light spec work, and device/deployment validation is elevated into active execution during Phase 5b. Branch C remains explicitly deferred until real usage data exists.

The completed Phase 2.0 work followed clean layer separation:

- **2.0.3** = storage correctness (import pipeline) ✅
- **2.0.3b** = retrieval correctness (query execution) ✅
- **2.0.4** = presentation correctness (results display + entry view) ✅
- **2.0.5** = offline correctness (PWA first-install → offline proof) ✅

#### Phase 2.0.3 — Hardening items (tracked for next PR)

These items were identified during PR C review. They should be addressed alongside or before Phase 2.0.3b:

1. **Inactive DB banner + one-click reset** — After a failed import, the DB contains partial data but no `active_bundle`. The UI should make this state unambiguous (explicit banner, one-click delete affordance, search disabled until successful import). Tracked as `TODO(hardening-1)` in `web/src/main.ts`.

2. **Optional debug duplicate-key detection** — Import counters (`records_count`, `index_entries_count`) count committed `put()` operations, not unique keys. An opt-in debug flag should track keys within each batch (Set of ≤500) to catch bundle generation regressions cheaply. Cross-batch detection is too expensive for prod. Tracked as `TODO(hardening-2)` in `web/src/import/import_records.ts` and `import_search_index.ts`.

3. **Max line length metric in bundle manifest** — The 4 MiB `MAX_JSONL_LINE_BYTES` cap is generous. The bundle builder should record the actual max line length in `search_index.jsonl` as a non-enforced informational metric in the manifest (future).

#### Phase 2.0.3b — Query execution (retrieval correctness)

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

#### Phase 2.0.4 — Results display + entry view (presentation correctness)

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

#### Phase 2.0.5 — Offline PWA finalization (first-install → offline proof) ✅

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

#### Phase 4.2.5 — Directional search semantics *(partially complete)*

This mini-phase makes the direction toggle real at query time without changing the normalized record schema.

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

Current status:

- directional `src_*` / `tgt_*` query execution is implemented
- legacy fallback is still present for older bundles
- the bundle-level capability flag is still not formalized in the typed manifest/runtime contract

**Remaining future step: bundle-level capability flag**

Right now the runtime tries the directional ladder first and falls back to the legacy (undirected) ladder only when the directional ladder returns zero results. That can create subtle ranking distortions later (e.g. directional bundle has a weak match, legacy fallback would have had a strong match → confusing ordering). To avoid hybrid logic:

- Add a manifest flag, e.g. `search_index_directional: true`.
- **If directional bundle** (flag true): never fallback; use only the directional ladder.
- **If legacy bundle** (flag absent or false): always use the legacy ladder only; do not try directional keys.

Then each bundle type has a single, predictable code path and no mixed ranking.

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

Phase 5 now has two parts: the indexing-quality upgrade that shipped as
`norm_v2`, and the remaining contract/runtime hardening needed so directional
search behavior is explicit and non-hybrid across bundle generations.

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
- `norm_version` (`norm_v1` / `norm_v2`)
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
5. Rebuild bundle (future `norm_v3`)

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

### Phase 2 memory constraint (lock-in before IndexedDB)

Observed via browser probe on the ~20 MB enriched bundle: **JSON.parse creates large transient heap spikes** even when not retaining parsed objects. To stay safe on mid-range Android, Phase 2.0.3 MUST follow these constraints:

- `records.jsonl` MUST NOT be fully materialized in memory as parsed objects.
- Import MUST be streaming: read → parse line-by-line → write to IndexedDB → discard.
- `search_index.jsonl` SHOULD NOT become a giant in-memory Map by default (87k entries can balloon).
- Prefer storing the search index in IndexedDB too (or a compact on-disk structure) and only reading what’s needed per query.

---

## Definition of Done (Phase 1 — backend pipeline)

The backend pipeline is complete when:

- ✅ Raw snapshots captured and immutable
- ✅ Lossless IR produced with provenance
- ✅ Normalization versioned and deterministic
- ✅ Search index materialized
- ✅ First offline bundle built, verified, and published

## Definition of Done (Phase 2 — minimal dictionary)

A learner can:

- Search **French → Maninka** and **Maninka → French**
- See results in **Latin** (N'Ko deferred to Branch C)
- Use the dictionary offline after initial caching/download
- Experience acceptable lookup latency on a mid-range Android phone

## Definition of Done (Phase 3 — platform generalization)

SiraLex is no longer just a single-dictionary app when:

- The active language pair is determined by bundle metadata, not hardcoded labels
- Multiple bundles can be installed locally and selected explicitly
- Search and record resolution are bundle-aware
- The app has a defined path for catalog/download-based bundle installation

Those conditions are now satisfied for the current runtime scope.
