# Roadmap (Phase 0 → Phase 2+)

This roadmap documents the execution path to a usable, offline-first **French/English ↔ Maninka (Guinea)** dictionary and sentence analysis app with **Latin + N'Ko** as first-class scripts.

Guiding constraints:

- **N'Ko is always available**: generated deterministically when not provided, with **uncertainty marked** when Latin input is underspecified.
- **Offline-first**: the dictionary must remain usable without connectivity.
- **Provenance-first**: store provenance at **entry**, **sense**, and **example** levels.
- **Community trust**: no hallucinated language; uncertainty is surfaced.

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
- Implementation: `api/search_index/` module, CLI `nkokan-build-index`

DoD:
- 87,153 index entries from 19,324 records. Deterministic, byte-identical output.

#### Phase 1.4.1 — Offline bundle skeleton ✅

- Assemble normalized records + search index into a versioned bundle directory
- Bundle manifest (`bundle.manifest.json`) with per-file SHA-256 checksums and `content_sha256`
- Support for `full` and `seed` bundle types
- Implementation: `api/bundle_builder/` module, CLI `nkokan-build-bundle`
- Spec: `shared/specs/offline-bundle-versioning.md`

DoD:
- Bundle builder produces spec-compliant bundles with integrity verification (`verify_bundle()`).

#### Phase 1.4.2 — First real bundle build ✅

- Validation run: execute the full pipeline on frozen data
- Run `nkokan-build-index` → `nkokan-build-bundle` on real frozen normalized JSONL
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

- Implementation: `api/enrichment/` module, CLI `nkokan-enrich`
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
| 7 | Phase 2.0.5 — Offline PWA finalization (first-install → offline proof) | Primary focus | Pending |
| 8 | Phase 1.5 (spec + backend) — Correction schema + pipeline | Parallel, light | Pending |
| 9 | Branch C — Transliteration, morphology, linguistic inference | Only after users + data | Deferred |

Phase 2.0 (Branch A) is the primary track. Phases 2.0.0–2.0.4 are complete — the data layer, build tooling, JS normalization mirror, bundle ingestion, search query execution, and results display are all functional. Phase 1.5 backend work (Branch B) can proceed in parallel as light, spec-level work. Branch C is explicitly deferred until real usage data exists.

The remaining Phase 2.0 work follows clean layer separation:

- **2.0.3** = storage correctness (import pipeline) ✅
- **2.0.3b** = retrieval correctness (query execution) ✅
- **2.0.4** = presentation correctness (results display + entry view) ✅
- **2.0.5** = offline correctness (PWA first-install → offline proof)

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

#### Phase 2.0.5 — Offline PWA finalization (first-install → offline proof)

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
