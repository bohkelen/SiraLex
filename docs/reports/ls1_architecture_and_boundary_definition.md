# LS1 — Architecture and Boundary Definition

## Decision

```text
LS1_ARCHITECTURE_AND_BOUNDARY_DEFINED
```

Planning / architecture-boundary only. No runtime, UI, storage schema code,
catalog, bundles, source data, tests, or packages are changed by this
document. No flashcards, Reflect UI, progress surfaces, morphology, audio,
teacher mode, or cloud sync.

Authoritative priors:

- `docs/reports/next_product_milestone_learning_system_direction.md`
- `docs/reports/learning_system_mvp_definition.md`
  (`LEARNING_SYSTEM_MVP_DEFINED` + `LEARNING_SYSTEM_MVP_OWNER_REFINED`)

LS1 guiding question (unchanged):

> Can the user build a personal vocabulary collection?

---

## 1. Purpose

Define the architecture and product boundary for **LS1 — Learning Records**
before any implementation slice.

This document locks:

1. Learning Record **identity**
2. **Persistence boundary** (what is / is not learning storage)
3. Behavior when a **referenced bundle or entry changes**
4. Minimum **Save / Saved Vocabulary** user flow
5. Explicit LS1 non-goals and handoff to LS2

It does **not** specify IndexedDB schemas, TypeScript types, UI components, or
APIs beyond conceptual contracts needed to keep later implementation honest.

---

## 2. LS1 scope

### In scope

| Item | Intent |
| --- | --- |
| Learning Record as durable personal object | Fundamental unit of the Learning System |
| Create Learning Record from a dictionary entry | Save |
| View personal collection (Saved Vocabulary) | One collection |
| Remove Learning Record | Unsave |
| Offline persistence across restarts | Device-local |
| Graceful handling of missing / changed references | Soft orphans; no silent data loss |
| Display cache sufficient for list + orphan labeling | Does not become lexical authority |

### Out of scope (LS1)

| Item | Deferred to |
| --- | --- |
| Review sessions / flashcards | LS2 |
| Reflect outcomes UI (beyond default status on create) | LS2 |
| Progress counts surface | LS3 |
| Favorites, recent searches, multi-list | Nice-to-have / future |
| Spaced repetition, quizzes, audio, morphology | Excluded from MVP |
| Cloud sync, export/import, accounts | Future / owner later |
| Mutating dictionary `records` / `search_index` | Never |

---

## 3. Current system facts (constraints)

These are existing runtime facts LS1 must respect:

| Fact | Implication for Learning Records |
| --- | --- |
| Lexical rows live in IndexedDB `records`, keyed under a **storage scope** | Learning must not write into `records` |
| `storage_scope_id` is typically `{bundle_id}::{content_sha256}` | Bundle **update** creates a new scope even when `bundle_id` is stable |
| Active bundle is selected in app meta | Search/entry UX is scoped to the active install |
| Entry identity inside a bundle is `ir_id` | Learning references must include `ir_id` |
| `ir_kind` is `lexicon_entry` or `index_mapping` | LS1 Save targets **lexicon entries** only |
| Optional `query_logs` already exist | Learning Records are a **separate** personal store — not logs |
| Multi-bundle install is supported | Collection view defaults to the **active** bundle’s Learning Records |

---

## 4. Learning Record identity

### 4.1 Identity rule (authoritative for LS1)

A Learning Record is uniquely identified by:

```text
(bundle_id, ir_id)
```

within the learner’s device-local collection.

| Part | Role |
| --- | --- |
| `bundle_id` | Which dictionary product line the learner saved against |
| `ir_id` | Which lexical entry inside that bundle |

**Uniqueness:** Saving the same `(bundle_id, ir_id)` again does **not** create a
second Learning Record. LS1 treats re-save as idempotent (record already
exists; user-facing state remains “saved”).

### 4.2 Why not `storage_scope_id` as the primary key

`storage_scope_id` encodes exact installed content bytes
(`bundle_id` + `content_sha256`). Using it as the **primary** identity would
orphan every Learning Record on routine bundle update even when the same
`ir_id` still exists in the new install.

Primary identity therefore prefers **logical continuity across updates**:
`(bundle_id, ir_id)`.

### 4.3 Resolution binding (stored with the record)

At Save time, the Learning Record also stores **resolution context** so the
app can resolve display and detect drift:

| Field (conceptual) | Purpose |
| --- | --- |
| `bundle_id` | Primary identity part |
| `ir_id` | Primary identity part |
| `content_sha256` at save (or equivalent scope stamp) | Provenance of which install the learner saved from |
| `storage_scope_id` at save (optional mirror) | Exact scope if still present on device |
| `ir_kind` | Must be `lexicon_entry` for LS1 |
| Display cache | Headword (and short gloss/label) for list + orphan UX |

Resolution preference when opening a Learning Record:

1. If the **active** bundle’s current scope still contains `ir_id` → resolve
   live from dictionary (authority).
2. Else if another installed scope for the same `bundle_id` contains `ir_id`
   → resolve from that install when the product later supports it; for LS1,
   prefer active-bundle resolution only (see §6).
3. Else → **unresolved** Learning Record (soft orphan); show display cache;
   allow Remove; do not invent lexical content.

### 4.4 What identity deliberately excludes

- Sense-level identity (saving one sense only) — out of LS1; save is
  **entry-level**.
- Query-string identity (saving the search text) — out of LS1; Save attaches
  to a resolved entry.
- Cross-bundle merging of “same word” — out of LS1; different `bundle_id`
  means different Learning Records even if headwords look alike.

---

## 5. Persistence boundary

### 5.1 What Learning storage owns

| Owns | Does not own |
| --- | --- |
| Learning Records (personal state) | Dictionary entry bodies |
| Collection membership | Search index postings |
| Default status on create (`still_learning`) | Catalog / featured selection |
| Display cache for UX resilience | Query-log analytics / consent |
| Timestamps for created (and placeholders LS2 may use) | Bundle install/update machinery |

### 5.2 Boundary rules

1. **Separate store.** Learning Records live in a dedicated personal persistence
   area. They must not be rows in `records`, `search_index`,
   `bundles_registry`, or `query_logs`.
2. **No lexical mutation.** Save / Remove / list never rewrite bundle payloads.
3. **Device-local.** No cloud account, sync, or multi-device identity in LS1.
4. **Survives restart.** Collection remains after app close/reopen offline.
5. **Independent of query logging.** Enabling/disabling query logs must not
   create, delete, or alter Learning Records.
6. **Independent of UI locale.** Locale changes do not redefine identity.

### 5.3 LS1 field set (conceptual)

Present on every Learning Record in LS1:

| Field | LS1 requirement |
| --- | --- |
| Identity `(bundle_id, ir_id)` | Required |
| Resolution stamp (`content_sha256` / scope at save) | Required |
| `created_at` | Required |
| `status` | Required; default `still_learning` on create |
| Display cache (headword + short label/gloss) | Required for list/orphan UX |
| `last_reviewed` | May exist as null/absent until LS2 |
| `review_count` | May exist as 0/absent until LS2 |

LS1 does **not** implement review behavior; it may still reserve null/zero
review fields so LS2 extends the same object without a second identity model.

### 5.4 Durability vs ephemeral

| Durable | Ephemeral / not stored as Learning data |
| --- | --- |
| Learning Record collection | In-memory search results |
| Display cache on each record | Transient UI selection state |
| Created timestamp + status | Debounced query text |

---

## 6. Bundle and entry change behavior

### 6.1 Policy summary

```text
Never auto-delete Learning Records because a bundle updated or an entry
temporarily failed to resolve.

Prefer soft-orphan + Remove over silent loss.
```

### 6.2 Event matrix

| Event | Learning Record behavior |
| --- | --- |
| App restart | Records unchanged; resolve against current active install |
| Save again same `(bundle_id, ir_id)` | Idempotent; remains saved |
| Remove | Record deleted from personal store only |
| Bundle **update** (same `bundle_id`, new `content_sha256`) | Records kept. Re-resolve by `ir_id` in the new active scope. If found → live dictionary again. If not found → unresolved (soft orphan) with display cache |
| Switch **active** bundle | Default Saved Vocabulary view shows records for the **new** active `bundle_id`. Other bundles’ records remain stored |
| Bundle **removed** from device | Records for that `bundle_id` remain as unresolved orphans until user Removes them (or a later milestone offers cleanup). Do not cascade-delete in LS1 |
| Entry present but display fields changed | Live dictionary wins when resolved; display cache may be refreshed on successful resolve (implementation detail later). Cache must not override authority when live resolve works |
| `ir_id` reused for a different lemma after rebuild | Accepted residual risk of content-addressed lexical pipelines. Mitigation is resolution stamp + user Remove; do not invent automatic “same word” merging in LS1 |

### 6.3 Active-bundle default (LS1)

LS1 Saved Vocabulary is **active-bundle scoped** in the default UI:

- Matches how search already works.
- Avoids a multi-bundle LMS surface in LS1.
- Records for inactive bundles are retained offline but not the primary list.

A later milestone may add “all bundles” browsing; not required for LS1.

### 6.4 Unresolved record UX (minimum)

When a Learning Record cannot resolve live:

- Still appears in the Saved Vocabulary list (for that `bundle_id` when active,
  or in an explicit orphan presentation if the bundle is gone — exact chrome
  deferred to UI design, but **must not vanish**).
- Shows display cache text.
- Indicates it is unavailable / needs dictionary (wording later).
- Offers **Remove**.
- Does **not** offer Review (LS2) until resolved — LS1 has no Review anyway.

---

## 7. Minimum Save / Saved Vocabulary user flow

### 7.1 Happy path

```text
Install/activate dictionary (existing)
  → Search (existing)
  → Open lexicon entry (existing)
  → Save
       → create Learning Record (bundle_id, ir_id)
       → status = still_learning
       → store resolution stamp + display cache
  → Saved Vocabulary
       → list Learning Records for active bundle
       → open entry when resolved (existing entry view)
       → Remove when desired
```

### 7.2 Flow rules

| Rule | Detail |
| --- | --- |
| Entry kind | Save is available on **`lexicon_entry`** detail only in LS1 |
| Index mappings | Out of LS1 Save target. User follows through to a lexicon entry, then Saves |
| No active bundle | Save unavailable; same as search disabled today until a bundle is active |
| Already saved | Control shows saved state; action is idempotent (no duplicate records) |
| List empty | Empty state points user back to search (copy later) |
| Offline | Entire flow works offline after dictionary install |
| Search performance | Save must not change search debounce, ladder, or result ranking |

### 7.3 User stories covered by LS1

From the MVP definition: **US1, US2, US3**, and **US8** (persistence for the
collection). US4–US7 remain LS2/LS3.

### 7.4 Explicitly not in this flow

- Reflect buttons
- Flashcard queue
- Progress counters as a product surface (LS3)
- Favorites / recent searches as required paths
- Creating Learning Records from raw query text without an open entry

---

## 8. Relationship diagram

```text
Catalog / Bundle install / Active bundle
        │
        ▼
Dictionary records + search_index     ← lexical authority
        │
        │  reference only (bundle_id, ir_id)
        ▼
Learning Record store                 ← personal overlay (LS1)
        │
        ├── Saved Vocabulary list (active bundle)
        ├── Save / Remove
        └── (LS2+) Review / Reflect attach here
```

---

## 9. Open implementation questions (not blockers for this boundary)

These may be decided in the first implementation design slice without
reopening LS1 product identity:

1. Exact IndexedDB store name / version bump strategy.
2. Whether display cache refresh happens on every successful open or only at
   Save.
3. Precise unresolved / removed-bundle empty-state copy (i18n).
4. Where the Save control sits in entry chrome (must not harm lookup clarity).
5. Whether Remove is confirm-gated.

These do **not** change `(bundle_id, ir_id)` identity, soft-orphan policy, or
active-bundle default list scope.

---

## 10. Risks specific to LS1

| Risk | Mitigation |
| --- | --- |
| Treating `storage_scope_id` as primary identity | Forbidden as primary key; stamp only |
| Cascading delete on bundle remove/update | Soft-orphan policy |
| Saving index mappings / queries | Lexicon-entry-only Save |
| Smuggling review into LS1 | Out-of-scope list; LS1 success = collection only |
| Writing into `records` for convenience | Persistence boundary forbids it |
| Using query_logs as vocabulary | Explicit separation |
| Multi-bundle collection UI complexity | Active-bundle default list |

---

## 11. LS1 success criteria

LS1 is successful when:

1. User can Save a lexicon entry into a Learning Record offline.
2. User can view Saved Vocabulary for the active bundle offline.
3. User can Remove a Learning Record.
4. Re-save of the same `(bundle_id, ir_id)` does not duplicate.
5. Collection survives restart without network.
6. Bundle update or missing `ir_id` does not silently wipe Learning Records.
7. Dictionary search/entry behavior remains the lexical authority and stays
   usable without depending on Learning storage.

LS1 is **not** unsuccessful if Review does not exist yet.

---

## 12. Handoff to next slices

| Next | Depends on LS1 |
| --- | --- |
| LS1 implementation design / code | This boundary doc |
| LS2 Review & Reflect | Stable Learning Record identity + collection UX |
| LS3 Progress | Counts derived from Learning Records |

Recommended immediate follow-up after this document is accepted:

```text
LS1 implementation plan (still design-first): store shape sketch,
entry Save affordance placement, Saved Vocabulary surface, orphan states
```

Still not flashcards-first.

---

## 13. Validation note

Documentation-only. Validate with `git diff --check`,
`git diff --name-status`, and `git status --short`.

---

## Summary

| Field | Value |
| --- | --- |
| Decision label | `LS1_ARCHITECTURE_AND_BOUNDARY_DEFINED` |
| Guiding question | Can the user build a personal vocabulary collection? |
| Primary identity | `(bundle_id, ir_id)` |
| Resolution stamp | `content_sha256` / scope at save (not primary key) |
| Persistence | Dedicated personal store; never mutate dictionary rows |
| Change policy | Soft-orphan; no cascade delete on update/remove |
| Default list scope | Active bundle |
| Save target | `lexicon_entry` only |
| LS1 flow | Search → Entry → Save → Saved Vocabulary → Remove |
| Code / data changes | None |
