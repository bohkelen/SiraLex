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
| 3 | Phase 2.0.1 — Web project scaffolding (Vite + TS) | Primary focus | Pending |
| 4 | Phase 2.0.2 — JS normalization mirror (`norm_v1` port) | Primary focus | Pending |
| 5 | Phase 2.0.3 — Bundle loading + client-side search | Primary focus | Pending |
| 6 | Phase 2.0.4 — Results display + entry view | Primary focus | Pending |
| 7 | Phase 2.0.5 — Offline PWA finalization | Primary focus | Pending |
| 8 | Phase 1.5 (spec + backend) — Correction schema + pipeline | Parallel, light | Pending |
| 9 | Branch C — Transliteration, morphology, linguistic inference | Only after users + data | Deferred |

Phase 2.0 (Branch A) is the primary track. Phase 2.0.0 (bundle enrichment) is complete — the data layer is ready for frontend consumption. Phase 1.5 backend work (Branch B) can proceed in parallel as light, spec-level work. Branch C is explicitly deferred until real usage data exists.

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
