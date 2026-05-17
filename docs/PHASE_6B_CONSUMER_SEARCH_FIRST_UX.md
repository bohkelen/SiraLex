# Phase 6B Proposal: Consumer Search-First UX + Infrastructure Layering

## Objective

Make the default SiraLex experience self-serve for ordinary dictionary users while preserving the full infrastructure/management surface behind a secondary, clearly discoverable layer.

SiraLex remains both:

- a consumer offline dictionary experience, and
- an offline-first dictionary platform/infrastructure surface.

This milestone is a UX layering milestone, not an infrastructure rollback.

## Core design question

How should SiraLex expose:

1. a simple dictionary-first consumer experience, and
2. a powerful bundle/platform management experience,

without making either one worse?

## Pilot findings incorporated

- Users could access/install the app, but needed guidance.
- Catalog URL -> load catalog -> install dictionary is not self-explanatory.
- Users do not naturally understand catalog/bundle concepts.
- After install, management controls dominate visual priority above search.
- Direction switching is understandable once shown.
- One-word lookup feels useful.
- Multiword/phrase lookup feels weaker/harder, consistent with earlier validation signals (partial phrase retrieval granularity).

---

## 1) Interface-layering principle

Primary principle:

- default surface = consumer task flow (install dictionary once, then search)
- secondary surfaces = platform/operator workflows (catalog/manual import/diagnostics/registry management)

Rules:

- progressive disclosure for advanced capabilities
- keep advanced capabilities fully available
- remove visual competition on primary screen, not capability

---

## 2) First-run consumer flow

### Primary path (consumer-first)

- Show one prominent CTA: **Install dictionary**
- CTA installs the **deployment-configured featured dictionary** without exposing catalog URL details
- The current public deployment may feature French <-> Maninka, but the UX model must not assume one globally hardcoded dictionary forever
- Copy should explain outcome in plain language (for example: "Install featured dictionary")

### Secondary path (advanced setup)

Provide a clearly labeled secondary entry point: **Advanced setup**, containing:

- load custom catalog URL
- manual bundle import/sideload

No catalog URL field should appear in the first-run primary path.

### First-run offline/failure fallback behavior

Required behavior:

- if no dictionary is installed and no network is available, show a clear offline-first recovery state (no silent failure)
- if featured dictionary install fetch fails, show understandable failure message + retry action
- include an explicit **Retry install** action in primary flow
- keep **Advanced setup** available in failure states for:
  - manual import recovery
  - custom catalog recovery

---

## 3) Installed-state consumer layout

After at least one dictionary is installed, the default screen should prioritize:

1. search input
2. direction toggle
3. results list
4. entry detail

Active dictionary state should be visible but minimal (for example: compact "Using: <dictionary>" row with a manage link).

If multiple dictionaries are installed, active dictionary switching should remain accessible either:

- from the same compact primary-surface row, or
- from Manage dictionaries,

without reintroducing management clutter above search.

Dictionary-management details should not dominate the top of the main screen.

---

## 4) Secondary management surface

Recommended IA structure:

- **Manage dictionaries** (primary secondary surface)
  - installed bundle registry
  - install/switch/remove dictionary
  - dictionary metadata
- **Advanced setup** (inside Manage dictionaries)
  - catalog URL load flow
  - manual bundle import
- **Advanced diagnostics** (separate secondary surface)
  - validation logging toggle
  - export logs
  - recent log inspection
- **Settings** (app-level options, not dictionary operations or diagnostics)

Recommendation:

- use a split structure where **Manage dictionaries** is discoverable from main UI,
- keep **Advanced setup** inside Manage dictionaries (collapsed/sectioned),
- keep **Advanced diagnostics** as a separate secondary surface from dictionary management,
- avoid hiding routine dictionary switching behind a generic Settings screen.

---

## 5) Validation/diagnostics surface

Validation tooling remains available but should not compete with search-first UI.

Information architecture rule:

- **Manage dictionaries** owns bundle install/switch/remove/manual import/catalog controls
- **Advanced diagnostics** is a separate secondary surface for validation logging/export/recent logs
- diagnostics should not be conceptually buried inside dictionary management unless a specific future constraint requires it

Default diagnostics entry may be visually minimized/collapsed, but it should remain clearly discoverable.

---

## First-run install progress and outcome states

Primary featured-install path should expose plain-language progress states without requiring catalog/bundle terminology:

1. **Install started**
2. **Downloading/preparing dictionary**
3. **Installed and ready to search**
4. **Install failed** with understandable recovery actions (Retry, Advanced setup)

Users should always understand what the app is currently doing and what to do next.

---

## 6) Preserve platform architecture (non-negotiable)

This milestone must not remove or weaken:

- catalog-driven install architecture
- multi-bundle support
- manual import/sideload path
- validation/logging/export tooling

Only UX layering and information architecture should change.

---

## 7) UX success criteria

Phase 6B is complete when:

- a first-time ordinary user can install the deployment-configured featured dictionary without explanation
- after install, search is the primary visible task at page top
- advanced tooling remains accessible but no longer dominates default layout
- platform/operator workflows still function without regression

---

## 8) Search-quality signal (captured, not solved here)

Confirmed early user signal:

- multiword/phrase search is perceived as weaker than one-word lookup

Handling rule for this milestone:

- record this as a validated product/search quality signal
- do not solve inside Phase 6B unless a separate scoped search-quality milestone is explicitly opened

---

## Out of scope for this milestone

- Branch C linguistic feature implementation
- `norm_v3` indexing changes
- large correction UI/moderation workflow build
- committed correction-release workflow UX
