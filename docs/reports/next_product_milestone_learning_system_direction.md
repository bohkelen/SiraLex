# Next Product Milestone — Learning System Direction

## Decision

```text
NEXT_PRODUCT_MILESTONE_LEARNING_SYSTEM_SELECTED
```

Planning / product-direction record only. No runtime, catalog, bundles,
source data, tests, packages, or Phase 7N / 7N1 device-matrix work was
reopened or changed. Morphology and audio are **not** part of the first
Learning System implementation. Teacher mode is **not** part of the first
milestone.

---

## 1. Product decision

The next major product milestone for SiraLex is a **Learning System** built
on top of the existing offline dictionary foundation.

**Core product direction:** SiraLex should evolve from an offline dictionary
into an offline vocabulary-learning tool.

This decision is owner-directed. The repository does not choose product
strategy; this document records the selected direction and its boundaries.

---

## 2. Why the Learning System is the next milestone

The Learning System creates the clearest immediate user value:

| Reason | Effect |
| --- | --- |
| Return habit | Gives users a reason to return regularly |
| Retention | Turns one-time searches into retained learning |
| Lookup → practice | Creates a path from dictionary lookup to practice |
| Buildable now | Builds on the current dictionary without requiring new linguistic validation before work can begin |
| Later classroom base | Creates a stronger base for later classroom and teacher workflows |

Compared with Morphological Intelligence or Pronunciation and Audio, Learning
System work can start from shipped lookup behavior and local persistence, and
does not depend on new linguistic validation or audio provenance pipelines.

---

## 3. Current product baseline

SiraLex today is an **offline-first dictionary** with:

- catalog-driven featured bundle install and multi-bundle support
- directional French/English ↔ Maninka search (Latin + N'Ko as first-class scripts)
- offline PWA / local storage for installed bundles
- consumer search-first UX and French-first interface work already shipped
- featured linguistic / promotion tracks (Phase 7N line) treated as closed or
  stable for product-direction purposes — not reopened by this milestone

The dictionary engine remains the foundation. The Learning System sits **on
top of** lookup, entries, and offline install — it does not replace them.

Phase 7N maintenance and Phase 7N1 device-matrix work are **not** resumed by
this decision.

---

## 4. Target user value

Users should be able to:

1. Look up a word in the offline dictionary (existing capability).
2. Save or favor words they want to keep.
3. Revisit recent searches and personal vocabulary lists offline.
4. Run simple review / flashcard-style recall sessions.
5. See lightweight progress that encourages return visits.

Primary value: **lookup becomes learning**, without requiring connectivity and
without expanding into a full language-learning platform.

---

## 5. Initial capability boundary

The first Learning System milestone remains **narrow**. In-scope capability
areas:

| Capability | Intent |
| --- | --- |
| Saved words | Persist words the user wants to keep |
| Favorites | Mark high-priority vocabulary |
| Recently searched words | Surface recent lookup history for revisit |
| Personal vocabulary lists | User-owned lists built from dictionary entries |
| Simple review sessions | Short practice loops over saved/listed words |
| Flashcard-style recall | Lightweight front/back recall against known entries |
| Lightweight progress tracking | Minimal signals (e.g. reviewed count / streak-adjacent stats) — not a full analytics product |
| Offline persistence | All learning data must work offline; online sync is out of scope for the first milestone |

MVP detail (journeys, storage schema, exact review rules, success criteria) is
**not** defined here; it belongs to the next owner-aligned implementation
slice.

---

## 6. Explicit non-goals

The first Learning System milestone must **not**:

- build a full language-learning platform
- include Morphological Intelligence (inflection, plural/verb recovery,
  spelling tolerance, ranked-search upgrades)
- include Pronunciation and Audio (offline playback, recordings, speaker /
  provenance metadata, audio bundling)
- define or ship teacher mode
- define classroom vocabulary workflows as required deliverables
- require new linguistic validation before Learning System work can begin
- reopen Phase 7N maintenance or Phase 7N1 device-matrix tracks as part of
  this milestone
- treat morphology or audio as prerequisites for the first learning MVP

These exclusions keep the milestone narrow and buildable on the current
dictionary foundation.

---

## 7. Relationship to the existing dictionary engine

| Concern | Relationship |
| --- | --- |
| Lookup / search | Remains the entry point; Learning System consumes known entries and query history |
| Bundles / catalog | Unchanged as the content source; learning state is user-local, not catalog content |
| Offline-first | Learning features must define offline behavior (work offline by default) |
| Linguistic authority | Learning does not invent lemmas or senses; it organizes and practices existing dictionary content |
| Provenance | Dictionary provenance rules remain; learning state is personal preference/progress data |

The Learning System is an **overlay product layer** on the offline dictionary,
not a fork of the linguistic pipeline.

---

## 8. Future roadmap — Morphological Intelligence

**Status:** Approved future direction. **Not** the current milestone.

Place **after** the initial Learning System milestone unless future evidence
justifies changing the order.

Candidate scope (for later planning only):

- inflection handling
- plural and verb-form recovery
- normalized variants
- spelling tolerance
- improved ranked search

Do not treat this as part of the first Learning System implementation.

---

## 9. Future roadmap — Pronunciation and Audio

**Status:** Approved future direction. **Not** the current milestone.

Place **after** the initial Learning System milestone unless future evidence
justifies changing the order.

Candidate scope (for later planning only):

- offline pronunciation playback
- reviewed recordings
- speaker and provenance metadata
- bundle-compatible audio delivery

Do not treat this as part of the first Learning System implementation.

---

## 10. Later possibilities (not current commitments)

Retain as later possibilities only — not commitments of the Learning System
milestone:

- teacher mode
- classroom vocabulary workflows
- example sentences
- broader lesson structures

These may benefit from a Learning System base later; they are out of scope
until the owner explicitly promotes them.

---

## 11. Open product questions (owner direction required)

The following require explicit owner decisions before or during MVP definition.
Do not hardcode answers in the repository.

1. **Primary user journey** — What is the single default path from lookup to
   first successful review?
2. **Minimum feature set** — Which of the boundary capabilities are MVP-required
   vs. immediately deferred within Learning System?
3. **Storage model** — Where does learning state live (browser storage only,
   export/import, multi-device later)? What is durable vs. ephemeral?
4. **Review-session behavior** — Card order, pass/fail rules, session length,
   and whether reviews are list-scoped or global.
5. **Success criteria** — What counts as a successful first Learning System
   slice for users and for release readiness?
6. **Explicit exclusions within Learning** — Any additional owner vetoes
   (e.g. streaks, SRS scheduling, sharing) beyond the non-goals above?
7. **Roadmap order revisit triggers** — What evidence would justify promoting
   Morphological Intelligence or Pronunciation and Audio ahead of finishing
   the Learning System MVP?

---

## 12. Recommended name for the next implementation phase

```text
Learning System MVP Definition
```

Suggested short label for planning artifacts:

```text
LS-MVP-DEF
```

Purpose of that phase: lock primary journey, minimum feature set, storage
model, review-session behavior, success criteria, and explicit exclusions with
the owner — before any Learning System implementation code.

---

## 13. Recommended next slice

Define the Learning System MVP with the owner, including:

- primary user journey
- minimum feature set
- storage model
- review-session behavior
- success criteria
- explicit exclusions

No implementation until that definition is owner-approved.

---

## 14. Validation note

This document is a product-direction record only. Validation for this change
is documentation hygiene (`git diff --check`, name-status, short status). No
runtime, catalog, bundle, source, test, or package changes are in scope.

---

## Summary

| Field | Value |
| --- | --- |
| Decision label | `NEXT_PRODUCT_MILESTONE_LEARNING_SYSTEM_SELECTED` |
| Selected milestone | Learning System (offline vocabulary learning on the dictionary) |
| Not current milestone | Morphological Intelligence; Pronunciation and Audio |
| Not commitments | Teacher mode; classroom workflows; example sentences; broader lessons |
| Next slice | Learning System MVP Definition with owner |
| Code / data changes | None |
