# LS1 — Learning System Closure Report (Final)

## Decision

```text
LS1_CLOSED
```

LS1 is a completed product milestone. Executable evidence supports the locked
collection loop, including Source → Target direct-entry navigation. This
closure slice is documentation-only.

Authoritative chain:

- `docs/reports/learning_system_mvp_definition.md`
- `docs/reports/ls1_architecture_and_boundary_definition.md`
- `docs/reports/ls1d1_learning_record_implementation_plan.md`
- `docs/reports/ls1i1_learning_record_persistence_implementation_report.md`
- `docs/reports/ls1i1r1_atomic_idempotency_correction_report.md`
- `docs/reports/ls1i2_entry_save_affordance_implementation_report.md`
- `docs/reports/ls1i3_saved_vocabulary_surface_implementation_report.md`
- `docs/reports/ls1i4_offline_update_soft_orphan_verification_report.md`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

---

## 1. Product outcome

The user can discover a Maninka lexicon entry, save it, maintain a durable
offline vocabulary collection, reopen resolved entries, retain unresolved
entries safely, and remove saved entries without altering dictionary data.

---

## 2. Final user loop

```text
Search
  → Discover target-language result
  → Open real lexicon entry
  → Save
  → Open Saved Vocabulary
  → Reopen while offline
  → Open resolved entry or retain soft orphan
  → Remove deliberately
```

For Source → Target searches:

```text
Search source term
  → Select Maninka result
  → Resolve directly by ir_id
  → Switch to Target → Source
  → Open lexicon entry
  → Save lexicon entry
```

The source query string and the `index_mapping` discovery record are **not**
saved. Only the genuine Maninka `lexicon_entry` becomes a Learning Record.

Review, Reflect, flashcards, and progress are **not** part of LS1.

---

## 3. Success-criteria closure matrix

| Capability | Implementation | Evidence | Status |
| --- | --- | --- | --- |
| Save genuine lexicon entry | Entry Save affordance | LS1I2 session/renderer tests | Pass |
| Atomic durable persistence | `learning_records` store | LS1I1 / LS1I1R1 persistence tests | Pass |
| Active-bundle Saved Vocabulary | Collection surface | LS1I3 renderer/session/nav tests | Pass |
| Offline reload | IndexedDB + installed dictionary | LS1I4 Playwright | Pass |
| Open resolved saved entry | Live `ir_id` resolution | Session + Playwright | Pass |
| Preserve soft orphan | Cached unresolved row | LS1I4 lifecycle + LS1I3 session | Pass |
| Remove deliberately | Entry toggle + confirmed collection removal | Tests + Playwright | Pass |
| Bundle removal/reinstall survival | Non-cascading Learning Records | LS1I4 lifecycle Scenarios D–E | Pass |
| Dictionary isolation | Dedicated personal store | Isolation tests | Pass |
| Direct source-result navigation | `anchor`/`ir_id` resolution | Navigation tests + Playwright | Pass |
| No redundant search | Direct-entry navigation | Navigation contracts + Playwright | Pass |
| Stale-async protection | Generation/context guards | LS1I2–I4 + navigation tests | Pass |

No capability is marked Pass from documentation alone.

---

## 4. Final architecture

### Learning Record identity

```text
(bundle_id, ir_id)
```

- `bundle_id` is the logical dictionary identity (registry id).
- `content_sha256` and `storage_scope_id` are resolution stamps, not identity.
- First Save wins; re-save is idempotent.
- Display cache remains write-on-create fallback only.

### Save eligibility

Only genuine:

```text
ir_kind === "lexicon_entry"
```

is saveable in LS1.

Not saveable:

- source-language query strings;
- `index_mapping` records;
- translation pairs;
- first-ranked result guesses.

### Persistence

- IndexedDB schema version **v4**
- Store: `learning_records`
- KeyPath: `["bundle_id", "ir_id"]`
- Index: `by_bundle_id`
- Separate from dictionary `records` / `search_index` and from `query_logs`
- Bundle removal does **not** cascade-delete Learning Records
- Full database deletion **does** wipe Learning Records

### Resolution

- Active logical bundle only
- Resolve by stored `ir_id` in the active storage scope
- Live dictionary content is lexical authority
- Cached data is unresolved-row fallback only
- No cross-bundle matching
- No automatic cache refresh on open or re-save

### UI

- Lexicon-entry Save control
- Saved Vocabulary entry point
- Resolved and unresolved rows
- Confirmed collection removal
- Active-bundle collection only

### Navigation

- No router
- Explicit host/origin context (`search` with restore direction | `saved_vocabulary`)
- Source → Target result opens the selected Maninka entry directly by `ir_id`
- Successful direct open switches to Target → Source
- No `runSearch` for that selection
- Original query and results preserved
- Back restores original direction and results
- Saved Vocabulary navigation remains independent

---

## 5. Locked invariants

Future work must preserve these as architecture constraints:

1. Learning Records never mutate dictionary data.
2. Learning Records never influence search ranking or demand evidence.
3. Query-log consent does not control Learning storage.
4. Bundle removal does not cascade-delete Learning Records.
5. Full database deletion may remove Learning Records.
6. Display cache is not lexical authority.
7. No automatic cross-bundle resolution.
8. Re-save remains atomic, idempotent, and first-write-wins.
9. Source queries and index mappings are not LS1 learning objects.
10. Target results must open by stable identity, not text replay.
11. LS2 must extend the existing Learning Record.
12. Future code must not silently reinterpret soft orphans as live entries.

---

## 6. Final validation baseline

Exact counts from the closure-time validation run (this slice):

| Suite | Result |
| --- | --- |
| Focused LS1 + direct-entry Vitest | **10 files / 88 tests passed** |
| LS1I1 / LS1I1R1 persistence | **28 passed** |
| LS1I2 entry Save (session + render) | **8 + 6 passed** |
| LS1I3 Saved Vocabulary (session + render + nav) | **6 + 5 + 9 passed** |
| LS1I4 lifecycle/isolation | **10 passed** |
| Direct-entry navigation (helper + contracts + render) | **6 + 7 + 3 passed** |
| Playwright (LS1 offline + direct entry) | **2 passed** |
| Full `npm run test:run` | **36 files / 351 tests passed** |
| `npm run build` | **Pass** |
| `git diff --check` | Clean (docs-only commit) |

---

## 7. Known limitations

Scope boundaries (not defects against LS1):

- Saved Vocabulary is **active-bundle only**.
- Inactive-bundle records remain stored but cannot be browsed globally.
- Learning is **device-local**.
- Full database deletion removes saved vocabulary.
- No pagination or virtualization.
- Soft-orphan UI lacks a dedicated Playwright scenario (covered at integration/session level).
- Source-language mappings cannot be saved.
- Translation relationships are not learning objects.
- No Review, Reflect, flashcards, progress, favorites, multiple lists, export, cloud sync, morphology, audio, or teacher mode.

---

## 8. Future object-model decisions to preserve

Recorded without implementation:

### Source-language lexicon entry

A source word such as `man` may eventually become independently saveable when
it has its own full lexicon record containing definitions, senses, grammar,
and translation links.

### Translation relationship

A bilingual association such as `man ↔ target entry` may eventually become a
separate translation-learning object.

Do **not** overload the current Learning Record to represent either model
without a future architecture decision.

---

## 9. LS2 handoff

```text
LS2 — Review and Reflect
```

Product question:

> Can the user intentionally review saved vocabulary and record whether each entry is still being learned or remembered?

LS2 must use the current Learning Record and may activate:

- `status`
- `last_reviewed`
- `review_count`

Likely capability areas:

- review queue
- one-item review surface
- Reflect action
- `still_learning` / `remembered`
- review timestamp
- review count
- simple completion state

Explicitly deferred:

- spaced repetition
- scoring
- streaks
- achievements
- teacher mode
- cloud sync
- morphology
- audio

No LS2 implementation plan is created in this slice.

---

## 10. Roadmap status sync

`docs/ROADMAP.md` has no Learning System / LS1 status index requiring update.
Canonical closure status is this report:

```text
LS1 — Closed
LS2 — Next
```

---

## 11. Documentation-only confirmation

This slice changes only documentation (this report). No runtime code, UI,
IndexedDB schema, tests, fixtures, Playwright configuration, bundles,
catalog, sources, or packages were modified.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS1_CLOSED` |
| Product outcome | Offline personal vocabulary from genuine Maninka lexicon entries |
| Direct-entry navigation | Incorporated (`SOURCE_RESULT_DIRECT_ENTRY_NAVIGATION_IMPLEMENTED`) |
| Next milestone | `LS2 — Review and Reflect` |
| Code changes | None |
