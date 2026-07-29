# LS1 — Learning System Closure Report

## Decision

```text
LS1_CLOSED
```

LS1 is a completed product milestone. Repository evidence supports the locked
collection loop. No product functionality was added in this closure slice.

Authoritative chain:

- `docs/reports/learning_system_mvp_definition.md`
- `docs/reports/ls1_architecture_and_boundary_definition.md`
- `docs/reports/ls1d1_learning_record_implementation_plan.md`
- `docs/reports/ls1i1_learning_record_persistence_implementation_report.md`
- `docs/reports/ls1i1r1_atomic_idempotency_correction_report.md`
- `docs/reports/ls1i2_entry_save_affordance_implementation_report.md`
- `docs/reports/ls1i3_saved_vocabulary_surface_implementation_report.md`
- `docs/reports/ls1i4_offline_update_soft_orphan_verification_report.md`

---

## 1. Product outcome

The user can build and maintain a personal vocabulary collection from
dictionary entries, entirely offline and without altering dictionary data.

Closed user loop:

1. **Discover** a lexicon entry through search.
2. **Save** it as a Learning Record.
3. See durable **Saved** state on the entry.
4. Open **Saved Vocabulary** for the active dictionary.
5. **Reopen** resolved entries with live dictionary content.
6. **Retain** unresolved entries safely as soft orphans (cached display).
7. **Remove** entries deliberately (entry toggle or collection confirm).
8. **Return** after reload or offline use with the collection intact.

Review, Reflect, flashcards, and progress are **not** part of LS1.

---

## 2. Success-criteria closure matrix

| Capability | Implementation | Evidence | Status |
| --- | --- | --- | --- |
| Personal vocabulary collection | Learning Records + Save UI | LS1I1 persistence + LS1I2 session/renderer | Pass |
| Durable offline storage | IndexedDB `learning_records` | LS1I4 lifecycle Scenario A + Playwright offline reload | Pass |
| Saved Vocabulary surface | Active-bundle collection UI | LS1I3 renderer/session + Playwright | Pass |
| Open resolved saved entries | Live `ir_id` resolution | Session + Playwright open path | Pass |
| Preserve unresolved entries | Soft-orphan model | LS1I4 Scenario C + LS1I3 session | Pass |
| Deliberate removal | Entry toggle + collection confirm | UI/session + Playwright remove | Pass |
| Bundle lifecycle survival | No cascade delete + reinstall resolution | LS1I4 Scenarios D–E | Pass |
| Dictionary isolation | Dedicated personal store | LS1I4 isolation + persistence isolation | Pass |
| Stale-async safety | Generation/context guards | LS1I2/I3/I4 navigation and session tests | Pass |
| Offline reload | Browser E2E | Playwright `ls1_offline_saved_vocabulary.spec.ts` | Pass |

No capability is marked Pass from documentation alone.

---

## 3. Final architecture

### Learning Record identity

```text
(bundle_id, ir_id)
```

- `bundle_id` is the **logical registry** bundle ID.
- `content_sha256` and `storage_scope_id` are **resolution stamps**, not identity.
- Dictionary entries remain the **lexical authority**; Learning is a personal overlay.

### Persistence

- IndexedDB schema version **v4**
- Store: `learning_records`
- KeyPath: `["bundle_id", "ir_id"]`
- Index: `by_bundle_id`
- Personal state is separate from dictionary `records` / `search_index` and from `query_logs`
- Bundle removal does **not** cascade-delete Learning Records
- Full database deletion **does** wipe Learning Records

### Resolution

- Scoped to the **active** logical bundle
- Resolve by stored `ir_id` in the active storage scope
- Live dictionary content wins when present
- Display cache is fallback only (list / soft orphan); never lexical authority
- No cross-bundle matching
- No cache refresh on successful open or idempotent re-save (first-write-wins)

### UI surfaces

- Lexicon-entry **Save** control (saved / not-saved / busy / error / unavailable)
- **Saved Vocabulary** entry point beside Manage dictionaries
- Active-bundle collection list
- Resolved rows (Open + Remove) and unresolved soft-orphan rows (Remove only)
- Confirmed Remove from the collection surface

### Navigation

- No browser-history router introduced
- Explicit results-host context: `search` | `saved_vocabulary` | `entry_from_search` | `entry_from_saved`
- Opening or leaving Saved Vocabulary does **not** rerun search
- Entry opened from the collection returns to the collection

---

## 4. Locked invariants

Future work must preserve these as architecture constraints:

1. Learning Records never mutate dictionary records.
2. Learning Records never feed demand evidence or query ranking.
3. Query-log consent does not control Learning storage.
4. Bundle removal does not cascade-delete Learning Records.
5. Full database deletion may wipe Learning Records.
6. Display cache is not lexical authority.
7. No automatic cross-bundle resolution.
8. Re-save remains first-write-wins and idempotent.
9. LS2 must extend Learning Records rather than fork a second personal-learning identity.
10. Future features must not silently reinterpret unresolved rows as valid live entries.

---

## 5. Test evidence (closure baseline)

Exact counts from the closure-time validation run (this slice):

| Suite | Result |
| --- | --- |
| Focused LS1 Vitest (7 files) | **72 passed** |
| LS1I1 / LS1I1R1 persistence | **28 passed** (`learning_record_persistence.test.ts`) |
| LS1I2 session + renderer | **8 + 6 passed** |
| LS1I3 session + renderer + navigation | **6 + 5 + 9 passed** |
| LS1I4 lifecycle/isolation | **10 passed** |
| Playwright offline scenario | **1 passed** |
| Full `npm run test:run` | **33 files / 335 tests passed** |
| `npm run build` | **Pass** |

Slice artifacts (implementation evidence, not modified by closure):

- `web/src/learning/learning_record_persistence.test.ts`
- `web/src/learning/entry_learning_session.test.ts`
- `web/src/learning/saved_vocabulary_session.test.ts`
- `web/src/learning/saved_vocabulary_navigation.test.ts`
- `web/src/learning/ls1i4_lifecycle_verification.test.ts`
- `web/src/render/render_entry_learning.test.ts`
- `web/src/render/render_saved_vocabulary.test.ts`
- `web/e2e/learning/ls1_offline_saved_vocabulary.spec.ts`

---

## 6. Known limitations

These are scoped LS1 boundaries, not defects against LS1 requirements:

- Default Saved Vocabulary is **active-bundle only**.
- Records for inactive/uninstalled bundles remain stored but have **no all-bundle browsing UI**.
- No pagination or virtualization (MVP-sized collections assumed).
- Soft-orphan browser path is **not** directly exercised in Playwright (covered at integration/session level).
- No Review, Reflect, progress, favorites, multiple lists, export, sync, audio, or morphology.
- Full database deletion removes personal vocabulary.
- Device-local only.

---

## 7. LS2 handoff boundary

```text
LS2 — Review and Reflect
```

LS2 begins from **existing Learning Records**.

Product question:

> Can the user return to saved vocabulary, review it intentionally, and record whether each word is still being learned or remembered?

LS2 may use already-reserved fields:

- `status`
- `last_reviewed`
- `review_count`

This closure does **not** implement or redesign LS2.

Likely LS2 capability areas:

- review queue
- Reflect action
- `still_learning` / `remembered`
- review timestamp
- review count
- simple review completion state

Explicitly deferred beyond LS2 MVP intent (unchanged exclusions):

- spaced-repetition scheduling
- scoring algorithms
- streaks
- achievements
- teacher mode
- cloud sync
- morphology
- audio

No LS2 implementation plan is created in this slice.

---

## 8. Roadmap status sync

`docs/ROADMAP.md` has no Learning System / LS1 status index requiring update.
Canonical closure status is this report only:

```text
LS1 — Closed
LS2 — Next
```

---

## 9. Closure-time validation results

| Check | Result |
| --- | --- |
| Focused LS1 Vitest | **7 files / 72 tests passed** |
| Playwright LS1 offline | **1 passed** (~1.5s) |
| Full web test suite | **33 files / 335 tests passed** |
| Web build | **Pass** |
| `git diff --check` | Clean (docs-only commit) |

---

## 10. Documentation-only confirmation

This slice changes only documentation (this report). No runtime code, UI,
IndexedDB schema, tests, fixtures, Playwright configuration, bundles,
catalog, sources, or packages were modified.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS1_CLOSED` |
| Product outcome | Offline personal vocabulary collection without mutating dictionary data |
| Next milestone | `LS2 — Review and Reflect` |
| Code changes | None |
