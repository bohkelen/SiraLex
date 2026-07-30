# LS1D1 — Learning Record Persistence and UI Integration Plan

## Decision

```text
LS1_IMPLEMENTATION_PLAN_READY
```

Design only. No runtime, UI, IndexedDB migration, test, catalog, bundle,
source, or package code is changed by this document.

Authoritative priors:

- `docs/reports/learning_system_mvp_definition.md`
- `docs/reports/ls1_architecture_and_boundary_definition.md`
  (`LS1_ARCHITECTURE_AND_BOUNDARY_DEFINED`)

Locked decisions preserved:

| Lock | Value |
| --- | --- |
| Identity | `(bundle_id, ir_id)` |
| Resolution stamps | `content_sha256`, `storage_scope_id` — not primary identity |
| Save target | `lexicon_entry` only |
| Persistence | Dedicated personal store |
| Mutations | Never touch dictionary / catalog / bundle / search-index / query-log rows |
| Default list | Active bundle |
| Missing refs | Soft orphans; never silent delete |
| LS1 excludes | Review, Reflect UI, flashcards, progress, morphology, audio |

Repository fact required for correct live resolution (does not reopen identity):

> In `STORE_RECORDS`, the IndexedDB key field named `bundle_id` holds the
> **storage scope id** (`{bundle_id}::{content_sha256}`), not the registry
> `bundle_id`. `resolveRecords(db, scope, irIds)` and import already use that
> convention. Learning Record `bundle_id` remains the **registry** id.

---

## 1. Persistence design

### 1.1 Learning Record shape (`learning_record_v1`)

Conceptual TypeScript shape (implementation later):

```ts
type LearningRecordV1 = {
  schema_version: "learning_record_v1";
  bundle_id: string;           // registry bundle_id (identity)
  ir_id: string;               // identity
  ir_kind: "lexicon_entry";    // LS1 only allows this value
  content_sha256: string;      // resolution stamp at save
  storage_scope_id: string;    // resolution stamp at save
  status: "still_learning" | "remembered";
  created_at: string;          // ISO-8601 UTC
  display_cache: {
    headword_latin: string;
    headword_nko?: string;
    gloss_short?: string;      // first available gloss snippet
  };
  // Reserved for LS2; present so identity/storage do not fork later
  last_reviewed: string | null;
  review_count: number;
};
```

### 1.2 Key representation

| Concern | Rule |
| --- | --- |
| Primary key | Compound IndexedDB keyPath `["bundle_id", "ir_id"]` |
| Identity equality | Same as architecture: one record per `(bundle_id, ir_id)` |
| Key vs stamps | Stamps are ordinary fields; never part of the keyPath |

This mirrors the compound-key style of `STORE_RECORDS` while using the
**logical** registry `bundle_id`, not the storage scope string.

### 1.3 Field rules

| Field | Validation |
| --- | --- |
| `schema_version` | Must be `"learning_record_v1"` |
| `bundle_id` | Non-empty string |
| `ir_id` | Non-empty string |
| `ir_kind` | Exactly `"lexicon_entry"` (reject others) |
| `content_sha256` | Non-empty string (prefer `sha256:…` form from active meta) |
| `storage_scope_id` | Non-empty string |
| `status` | `"still_learning"` \| `"remembered"`; LS1 create always `"still_learning"` |
| `created_at` | Non-empty ISO-8601 string (`Date.toISOString()`) |
| `display_cache.headword_latin` | Non-empty string required |
| `display_cache.headword_nko` | Optional string |
| `display_cache.gloss_short` | Optional string (truncate at write if needed; keep short) |
| `last_reviewed` | `null` on create |
| `review_count` | `0` on create |

Reject invalid records on write (throw typed/storage error). Do not partially
persist invalid objects.

### 1.4 Display-cache content source at Save

From the live `EnrichedRecord` being saved:

- `headword_latin` ← `display.headword_latin`
- `headword_nko` ← `display.headword_nko_provided` when present
- `gloss_short` ← first non-empty among sense glosses (`gloss_fr`, then
  `gloss_en`) joined lightly, or empty if none

Cache is for list/orphan UX only — never lexical authority.

### 1.5 Dedicated IndexedDB store

| Item | Value |
| --- | --- |
| Store name | `learning_records` |
| Constant | `STORE_LEARNING_RECORDS` in `web/src/idb/siralex_db.ts` |
| keyPath | `["bundle_id", "ir_id"]` |
| Index (LS1 only) | `by_bundle_id` on `bundle_id` (non-unique) |

**No other indexes in LS1.** Access patterns covered:

| Pattern | Mechanism |
| --- | --- |
| Get one / saved? | `store.get([bundle_id, ir_id])` |
| List by active bundle | `index("by_bundle_id").getAll(bundle_id)` |
| Create idempotent | `get` then `put` only if absent (or `put` with create-only helper) |
| Remove | `store.delete([bundle_id, ir_id])` |
| Count/enumerate (tests) | `store.count()` / `getAll()` |

Do not index `status`, `created_at`, or stamps until a later milestone needs
them.

### 1.6 Database version and migration

| Item | Value |
| --- | --- |
| Current | `SIRALEX_DB_VERSION = 3` |
| Proposed | `SIRALEX_DB_VERSION = 4` |
| Upgrade work | In `upgradeneeded`: if store missing, create `learning_records` + `by_bundle_id` |
| Existing data | **No migration** of `meta`, `records`, `search_index`, `bundles_registry`, or `query_logs` |
| Rollback | None automated. Failed upgrade aborts open (browser IndexedDB behavior). App should surface open failure as today |
| `deleteBundleData` | **Must not** delete Learning Records (explicit non-coupling) |
| Full `deleteSiralexDb` | Remains wipe-all including Learning Records (user-initiated DB delete) |

Extend `SiralexObjectStoreName` to include `learning_records` only where
needed; do not route Learning Records through `storeHasData` dictionary
checks.

---

## 2. Learning storage API

Smallest module surface. Follow the `query_logging/` pattern: focused store
module + types — **no** generic repository framework.

Proposed files (implementation later):

| File | Role |
| --- | --- |
| `web/src/learning/learning_record_types.ts` | Types, schema constant, validators |
| `web/src/learning/learning_record_store.ts` | CRUD against `STORE_LEARNING_RECORDS` |
| `web/src/learning/learning_record_resolve.ts` | Active-scope live resolve + UI result shape |
| `web/src/learning/build_display_cache.ts` | Pure helper: entry → display_cache |

### 2.1 Store API

```ts
saveLearningRecord(db, input: SaveLearningRecordInput): Promise<LearningRecordV1>
getLearningRecord(db, bundleId, irId): Promise<LearningRecordV1 | undefined>
isLearningRecordSaved(db, bundleId, irId): Promise<boolean>
listLearningRecordsByBundle(db, bundleId): Promise<LearningRecordV1[]>
removeLearningRecord(db, bundleId, irId): Promise<boolean> // true if deleted
```

`SaveLearningRecordInput` (from UI/caller):

- `bundle_id`, `ir_id`, `ir_kind`, stamps, `display_cache`
- Caller supplies stamps from **active** `ActiveBundleMeta` at save time
- Store sets `schema_version`, `created_at`, `status: "still_learning"`,
  `last_reviewed: null`, `review_count: 0` on create

### 2.2 Idempotency

| Call | Behavior |
| --- | --- |
| `saveLearningRecord` when absent | Insert; return new record |
| `saveLearningRecord` when present | **No-op on identity**; return existing record unchanged (including `created_at`, `status`, cache, stamps) |
| `removeLearningRecord` when absent | Return `false`; not an error |
| `removeLearningRecord` when present | Delete; return `true` |

LS1 does **not** refresh cache on idempotent re-save (see §3.3). UI may still
show “Saved”.

### 2.3 Resolve API

```ts
resolveLearningRecordForUi(
  db,
  learningRecord: LearningRecordV1,
  activeMeta: ActiveBundleMeta | undefined,
): Promise<LearningRecordUiResolution>
```

### 2.4 Errors

| Condition | Behavior |
| --- | --- |
| Invalid input / failed validation | Throw; no write |
| IndexedDB tx failure | Propagate; UI maps to persistence-error state |
| Resolve miss | Not an error — return `unresolved` |
| Wrong `ir_kind` on save | Throw / reject before write |

---

## 3. Resolution behavior

### 3.1 Sequence (displaying a saved item)

Given a stored Learning Record `L` and current active meta `A`:

1. If `A` is missing → **unresolved** (no active dictionary).
2. If `A.bundle_id !== L.bundle_id` → **unresolved** for default LS1 UI
   (active-bundle list should not surface this row; if called anyway, do not
   cross-resolve other bundles).
3. Live-get via existing pattern:
   `resolveRecords(db, getBundleStorageScopeId(A), [L.ir_id])`.
4. If a record is returned and `ir_kind === "lexicon_entry"` (and displayable)
   → **resolved**; use live dictionary data for presentation.
5. Otherwise → **unresolved**; use `display_cache`; never invent glosses.

### 3.2 UI result shape

```ts
type LearningRecordUiResolution =
  | {
      state: "resolved";
      learningRecord: LearningRecordV1;
      liveEntry: EnrichedRecord;
    }
  | {
      state: "unresolved";
      learningRecord: LearningRecordV1;
      liveEntry?: undefined;
      reason:
        | "no_active_bundle"
        | "bundle_mismatch"
        | "entry_missing"
        | "not_lexicon_entry";
    };
```

Rules:

- `learningRecord` is always the stored personal object.
- `liveEntry` is present only when `state === "resolved"`.
- Display cache is never promoted to an `EnrichedRecord` authority object.

### 3.3 Display-cache refresh rule (LS1 lock)

```text
Write display_cache only when creating a new Learning Record (first Save).
Do not refresh display_cache on idempotent re-save.
Do not refresh display_cache on successful live resolve / open from Saved Vocabulary.
```

Rationale: cache is a stable orphan/list fallback for “what I saved”; live
dictionary always wins when resolved. Avoids write churn and accidental
authority bleed.

---

## 4. Save affordance

### 4.1 Placement

Exact existing surface: **lexicon entry detail** rendered by
`renderEntryDetail` → `renderLexiconEntry` in
`web/src/render/render_entry.ts`, shown via `showEntryDetail` in
`web/src/main.ts` inside `#searchResults`.

Integration approach (implementation later):

- Extend `EntryDetailCallbacks` with optional learning callbacks, e.g.
  `getSaveState`, `onSave`, `onUnsave`.
- Render a compact control in the entry header row of **lexicon** entries
  only (after headword/pos, or a small actions row under the header — must
  remain below/beside content without covering senses).
- **Index mapping** entries: omit the Save control entirely (not a disabled
  trap in the primary chrome). If a shared actions slot exists, it may show
  unavailable copy only if needed for tests; preferred LS1 UX is **no Save**
  on `entry-index`.

Do not alter search debounce, ladder, results ranking, or `runSearch`.

### 4.2 Control states

| State | UI | Action |
| --- | --- | --- |
| `not_saved` | Button “Save” / « Enregistrer » | Call save API |
| `saving` | Disabled / busy label | Ignore duplicate clicks |
| `saved` | Button “Saved” / « Enregistré » (toggle affordance) | Unsave |
| `removing` | Disabled busy | Ignore duplicate clicks |
| `error` | Short error under control; prior state restored | Retry allowed |
| `unavailable_kind` | No control (index mapping) | — |
| `unavailable_no_bundle` | No save / disabled if entry somehow shown | — |

Unsave from entry detail: **no confirm dialog** (fast toggle).  
Remove from Saved Vocabulary list: **confirm** (destructive from collection view).

### 4.3 Localization keys (EN / FR)

Add to `web/src/i18n.ts` `MESSAGES.en` / `MESSAGES.fr` (names locked here;
implementation adds them):

| Key | EN | FR |
| --- | --- | --- |
| `learning.save` | Save | Enregistrer |
| `learning.saved` | Saved | Enregistré |
| `learning.saving` | Saving… | Enregistrement… |
| `learning.removing` | Removing… | Suppression… |
| `learning.saveError` | Couldn’t save. Try again. | Enregistrement impossible. Réessayez. |
| `learning.removeError` | Couldn’t remove. Try again. | Suppression impossible. Réessayez. |
| `learning.savedVocabulary` | Saved vocabulary | Vocabulaire enregistré |
| `learning.openSaved` | Saved vocabulary | Vocabulaire enregistré |
| `learning.backToSearch` | Back to search | Retour à la recherche |
| `learning.empty` | No saved words yet. Search and open an entry to save one. | Aucun mot enregistré. Cherchez un mot et enregistrez-le. |
| `learning.noActiveBundle` | Add a dictionary to use saved vocabulary. | Ajoutez un dictionnaire pour utiliser le vocabulaire enregistré. |
| `learning.unresolved` | Unavailable in this dictionary | Indisponible dans ce dictionnaire |
| `learning.remove` | Remove | Retirer |
| `learning.removeConfirm` | Remove this word from saved vocabulary? | Retirer ce mot du vocabulaire enregistré ? |
| `learning.loading` | Loading saved vocabulary… | Chargement du vocabulaire… |
| `learning.listError` | Couldn’t load saved vocabulary. | Impossible de charger le vocabulaire enregistré. |

Keep copy functional and short. No streak/progress language.

---

## 5. Saved Vocabulary surface

### 5.1 Navigation placement

No hash router exists today. Follow the existing in-panel pattern
(`showResultsList` / `showEntryDetail`).

| Item | Plan |
| --- | --- |
| Entry point | Button in the **search card**, in `#activeDictionaryRow` (beside or under manage), id e.g. `#openSavedVocabulary` |
| Host | Reuse `#searchResults` as the view host (same as results/entry) |
| Title | `learning.savedVocabulary` |
| Back | `learning.backToSearch` → restore prior search results list or empty search host |

Visibility: button available whenever the app shell is shown; empty/no-bundle
states handled inside the surface.

### 5.2 Scope and list content

- List **only** Learning Records where `bundle_id === activeMeta.bundle_id`.
- Sort: stable by `created_at` descending (newest first) — simple default.
- Row content:
  - Primary: `display_cache.headword_latin` (and nko if present)
  - Secondary: gloss_short when present
  - Unresolved badge when resolution state is unresolved
  - Actions: Open (if resolved), Remove (always)

### 5.3 Row behaviors

| State | Behavior |
| --- | --- |
| Resolved row | Tap/Open → `showEntryDetail(liveEntry)` with Save affordance in saved state |
| Unresolved row | Not openable to live entry; show unresolved label; Remove allowed |
| Empty | `learning.empty` |
| Loading | `learning.loading` |
| Error | `learning.listError` |
| No active bundle | `learning.noActiveBundle`; no list fetch required |
| Remove | Confirm → `removeLearningRecord` → refresh list |

### 5.4 Explicit absences

No multiple lists, filters, favorites, review buttons, confidence editors,
or progress metrics on this surface.

---

## 6. Soft-orphan states

| Situation | List visibility | Resolution | User actions |
| --- | --- | --- | --- |
| Active bundle exists; `ir_id` missing in current scope | Shown in active-bundle list | `unresolved` / `entry_missing` | Remove; no Open |
| Referenced bundle installed but inactive | **Not** in default list | N/A for default UI; record retained in store | Switch active bundle to see it; never auto-match across bundles |
| Referenced bundle not installed | **Not** in default list (no active match) | Retained in store; soft orphan | Remains until user Removes (future cleanup UI out of LS1); full DB delete wipes all |
| Display cache incomplete | Shown if in active list | Use available cache fields; if `headword_latin` missing (should not pass validation) treat as unresolved with generic unresolved copy | Remove |

**No automatic cross-bundle word matching.**

Bundle update (same `bundle_id`, new scope): records remain; list re-resolves
against new active scope; missing `ir_id` → soft orphan row.

`deleteBundleData`: dictionary rows removed; Learning Records for that
`bundle_id` **retained** as orphans (not listed until that bundle_id is active
again — which requires reinstall; after reinstall, resolve by `ir_id`).

---

## 7. Implementation slices

### LS1I1 — Persistence store and Learning Record API

| | |
| --- | --- |
| **Objective** | DB v4 + `learning_records` store + typed store/resolve helpers |
| **Allowed areas** | `web/src/idb/siralex_db.ts`; `web/src/learning/*`; related unit/IDB tests under `web/src/learning/` |
| **Tests** | Validation; save idempotent; get/list/remove; resolve resolved/unresolved; no writes to other stores |
| **Acceptance** | API usable from tests with `fake-indexeddb`; migration creates empty store on v3→v4 |
| **Non-goals** | UI, Save button, Saved Vocabulary page, Review |

### LS1I2 — Entry Save affordance

| | |
| --- | --- |
| **Objective** | Save/Saved/Unsave on lexicon entry detail only |
| **Allowed areas** | `web/src/render/render_entry.ts` (+ tests); `web/src/main.ts` wiring; `web/src/i18n.ts` save-related keys; learning modules as needed |
| **Tests** | Lexicon shows control; index mapping does not; save/unsave state; error state; search behavior unchanged |
| **Acceptance** | User can save/unsave from entry offline; idempotent |
| **Non-goals** | Saved Vocabulary list UI; Review |

### LS1I3 — Saved Vocabulary surface

| | |
| --- | --- |
| **Objective** | Open Saved Vocabulary, list active-bundle rows, open resolved, remove |
| **Allowed areas** | `web/src/main.ts` shell; optional `web/src/render/render_saved_vocabulary.ts`; i18n keys; CSS only if required for readability |
| **Tests** | Empty/loading/error/no-bundle; list scoping; open resolved; unresolved row; remove confirm |
| **Acceptance** | Collection UX complete for LS1 happy path |
| **Non-goals** | Filters, favorites, progress, Review |

### LS1I4 — Offline, update, and soft-orphan verification

| | |
| --- | --- |
| **Objective** | Prove persistence + orphan policies against real flows |
| **Allowed areas** | Tests primarily (`web/src/learning/*.test.ts`, focused IDB integration, optional Playwright scenario under `web/e2e/`); no product-scope expansion |
| **Tests** | Restart persistence; bundle update same ir_id; missing ir_id orphan; bundle remove retains Learning Records; query-log consent irrelevant; dictionary stores unchanged by save/remove |
| **Acceptance** | Architecture event matrix covered by automated tests |
| **Non-goals** | New features |

### LS1I5 — LS1 closure

| | |
| --- | --- |
| **Objective** | Closure report: LS1 success criteria met; handoff note to LS2 |
| **Allowed areas** | `docs/reports/` closure doc only (plus trivial doc fixes if needed) |
| **Tests** | Cite existing green suites; no new scope |
| **Acceptance** | `LS1_CLOSED` (or equivalent) recorded |
| **Non-goals** | Starting LS2 implementation |

---

## 8. Test plan

### 8.1 Unit tests

- `build_display_cache` from lexicon fixture
- Validators reject empty ids / wrong `ir_kind` / bad status
- Idempotent save returns same `created_at`
- Resolve reason mapping (`no_active_bundle`, `bundle_mismatch`, `entry_missing`)

### 8.2 IndexedDB integration (`fake-indexeddb` + vitest)

- Create store on open at DB v4
- Save lexicon Learning Record
- Repeated save idempotent
- `isLearningRecordSaved` true/false
- List scoped by `bundle_id`
- Remove affects only `learning_records`
- Live resolve hit via scoped `resolveRecords`
- After scope/content change simulation: missing `ir_id` → unresolved; row still present
- `deleteBundleData` leaves Learning Records
- Toggle query-log consent / append log → Learning Records unchanged
- Assert `STORE_RECORDS` / `STORE_SEARCH_INDEX` row counts unchanged across save/remove

### 8.3 UI component tests

- `render_entry`: Save present for lexicon; absent for index mapping
- State transitions not_saved → saving → saved → removing → not_saved
- Saved Vocabulary renderer: empty, unresolved badge, remove confirm path
  (if extracted)

### 8.4 Playwright offline scenario

Minimal e2e (extend existing Playwright harness patterns under `web/e2e/`):

1. Install/use debug or featured bundle offline after install
2. Search → open lexicon entry → Save
3. Reload (restart) → Saved Vocabulary still lists word
4. Open resolved row → entry detail shows Saved
5. Remove → list empty / without that row

Optional second scenario: simulate missing entry (test hook or fixture) →
unresolved row remains.

Do not require network after install for these assertions.

---

## 9. Security and data integrity

| Rule | Enforcement |
| --- | --- |
| Device-local personal state | IndexedDB only; no sync APIs in LS1 |
| No demand-evidence coupling | Learning store never feeds query-log analyzer / demand ranking |
| No query-log coupling | Separate store; consent flags ignored by learning APIs |
| No dictionary mutation | Learning transactions open `learning_records` only (resolve uses readonly `records`) |
| Invalid records | Reject on write; skip/ignore corrupt rows on list if encountered (log/dev assert); never crash search |
| Clear DB | User `deleteSiralexDb` remains full wipe including learning |
| Bundle remove | Must not cascade-delete Learning Records |

---

## 10. Explicit non-goals (plan-wide)

- Review / Reflect / flashcards / progress surfaces
- Favorites, recent searches, multi-list
- Morphology, audio, SRS, cloud accounts
- Generalized learning platform / repository framework
- Changing Learning Record identity or Save target
- Automatic cross-bundle lemma matching
- Display-cache refresh on open (forbidden in LS1 by §3.3)

---

## 11. Validation note

Documentation-only. Validate with `git diff --check`,
`git diff --name-status`, and `git status --short`.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS1_IMPLEMENTATION_PLAN_READY` |
| Store | `learning_records` @ DB v4; keyPath `[bundle_id, ir_id]`; index `by_bundle_id` |
| API | save / get / isSaved / listByBundle / remove + resolveForUi |
| Cache rule | Write on create only |
| Save UI | Lexicon `render_entry` header actions |
| Saved Vocabulary | Button in search card → `#searchResults` host; active-bundle list |
| Soft orphans | Retain always; default list active-bundle only |
| Slices | LS1I1 → LS1I5 |
| Code changes | None |
