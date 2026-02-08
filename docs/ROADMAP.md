# Roadmap (Phase 0 → Phase 1)

This roadmap documents the execution path to a usable, offline-first **French/English ↔ Maninka (Guinea)** dictionary and sentence analysis app with **Latin + N’Ko** as first-class scripts.

Guiding constraints:

- **N’Ko is always available**: generated deterministically when not provided, with **uncertainty marked** when Latin input is underspecified.
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

### Phase 1.3 — Transliteration layer (Latin → N’Ko)

- Deterministic transliteration module:
  - generate N’Ko for all display surfaces when missing
  - **mark uncertainty** when Latin is underspecified
- Round-trip `N’Ko → Latin normalized` can wait until Phase 2

DoD:
- Any record can be displayed in Latin and N’Ko, with uncertainty clearly indicated.

### Phase 1.4 — Offline-first dictionary experience

- Client-side offline search (IndexedDB + local index)
- Seed dataset + optional full download (size-aware)

DoD:
- On a mid-range Android phone, lookup works instantly offline after first load/download.

### Phase 1.5 — Feedback loop (anonymous, auditable)

- Anonymous “suggest correction” for:
  - spelling, translations, examples, POS, N’Ko, notes
- Moderation queue with **audit trail + rollback**

DoD:
- Users can report issues without accounts.
- Maintainers can review, accept/reject, and revert changes with a clear history.

### Definition of Done (Phase 1)

A learner can:

- Search **French → Maninka** and **English → Maninka**
- Search **Maninka → French** and **Maninka → English**
- See results in **Latin + N’Ko**
- Enter a French/English sentence and receive a **best-guess Maninka sentence** plus a transparent breakdown
- Use the dictionary offline after initial caching/download
- Flag inaccuracies (anonymous) for review

