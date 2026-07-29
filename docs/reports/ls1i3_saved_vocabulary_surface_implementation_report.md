# LS1I3 — Saved Vocabulary Surface Implementation Report

## Decision

```text
LS1_SAVED_VOCABULARY_SURFACE_IMPLEMENTED
```

## Commit

`ddf431a51692f5901bf91d25a48c3b4456c92271` (`feat(learning): add saved vocabulary surface`).

Built on LS1I2 `91f6e8490dbac464231e6f1e6a9de9c2da118cf4`.

---

## Surface placement

Button `#openSavedVocabulary` in `#activeDictionaryRow` beside Manage
dictionaries. Host: `#searchResults` (same panel as search results / entry
detail). Back returns to the prior results list.

---

## View states

`loading` | `empty` | `populated` | `removing` | `unavailable` | `error`

Row flags: `openable` / `unresolved` / `removing`. Optional status:
`remove_failed` | `open_failed` while the list remains visible.

---

## Session / renderer boundary

| Module | Role |
| --- | --- |
| `saved_vocabulary_session.ts` | IDB list/remove/resolve, scope binding, stale guards, immutable VMs |
| `render_saved_vocabulary.ts` | Presentation only — applies VM, fires callbacks |
| `main.ts` | Navigation wiring, generation tokens, confirm dialog |

---

## Bundle / scope filtering

`filterRecordsForActiveScope`: keep only rows where
`bundle_id === active.bundle_id` **and**
`storage_scope_id === getBundleStorageScopeId(active)`.
No silent fallback to another bundle or scope.

---

## Navigation behavior

Open uses saved `ir_id`, live-resolves against the active storage scope, then
`showEntryDetail(liveEntry)` without rerunning search. Back from that entry
returns to Saved Vocabulary. List labels use **display_cache** only (not live
lexicon reconstruction for row text).

---

## Removal behavior

Confirm via `learning.removeConfirm`. Atomic `removeLearningRecord`. Busy
clicks ignored (`inflightRemove`). Failure restores previous rows +
`remove_failed` status.

---

## Stale-async mechanism

`savedVocabularyGeneration` + `isCurrent` / `isBindingCurrent(bundleId, scope)`.
Opening entry detail increments saved-vocab generation; opening Saved Vocabulary
invalidates entry-detail learning updates.

---

## Accessibility / i18n

Semantic `<ul>` list, button controls, focus-visible styles, `aria-busy` on
surface/remove, `role="status"` messaging. EN/FR keys under `learning.*`
(including saved vocabulary, empty, loading, unresolved, remove confirm, open).

---

## Test results

| Suite | Result |
| --- | --- |
| Saved Vocabulary session/renderer | 15 passed |
| Learning persistence + LS1I2 sessions/renderer | passed |
| Full `npm run test:run` | **31 files / 320 tests passed** |
| `npm run build` | **Pass** |

---

## Deviations

None material. Collection Remove keeps confirm (LS1D1); entry-detail Unsave
remains confirm-free (LS1I2).

---

## Recommended next slice

```text
LS1I4 — Offline, update, and soft-orphan verification
```

or LS1I5 closure if verification is folded into existing coverage.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS1_SAVED_VOCABULARY_SURFACE_IMPLEMENTED` |
| Schema / migration / search / catalog changes | None |
