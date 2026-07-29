# LS1I3 — Saved Vocabulary Surface Implementation Report

## Decision

```text
LS1_SAVED_VOCABULARY_SURFACE_IMPLEMENTED
```

Active-bundle Learning Records are now visible, openable when resolved, and
removable with confirmation. Soft orphans remain listed. No Review, Reflect,
flashcards, progress, favorites, multi-list, morphology, or audio.

---

## 1. Entry-point placement

In `#activeDictionaryRow`, beside Manage dictionaries:

- Button `#openSavedVocabulary`
- Label: EN `Saved vocabulary` / FR `Vocabulaire enregistré` (`learning.openSaved`)

Host: `#searchResults` (same in-panel host as results/entry).

---

## 2. Navigation model

Explicit `resultsHostContext`:

```text
search | saved_vocabulary | entry_from_search | entry_from_saved
```

| Action | Behavior |
| --- | --- |
| Open Saved Vocabulary | Replace `#searchResults`; do not rerun search |
| Back from Saved Vocabulary | Restore prior results list via `showResultsList` (no search re-run) |
| Open resolved row | `showEntryDetail(liveEntry, "saved_vocabulary")` |
| Back from that entry | Reopen Saved Vocabulary |
| Open entry from search | Back returns to results list |

`savedVocabularyGeneration` invalidates late list/remove updates.

---

## 3. Boundary

| Module | Role |
| --- | --- |
| `render_saved_vocabulary.ts` | Presentation only |
| `saved_vocabulary_session.ts` | Load / resolve / remove / confirm gate / row VM |
| `main.ts` | Entry point, host context, generation, confirm via `window.confirm` |

---

## 4. View model and surface states

Row VM: `resolved` (live entry + texts) | `unresolved` (display_cache + reason).

Surface: `loading` | `empty` | `populated` | `removing` | `unavailable` | `error`.

Order: store order (newest `created_at` first). No alphabetical re-sort.

---

## 5. Loading / resolution

1. Emit loading
2. Active meta absent → unavailable (no list-by-bundle)
3. `listLearningRecordsByBundle(active.bundle_id)`
4. Resolve each with `resolveLearningRecordForUi` (`Promise.all`)
5. Per-row resolve failure → unresolved soft orphan, not page error

Cache is never mutated or promoted to lexical authority.

---

## 6. Rows

- **Resolved:** live Latin / N’Ko / short gloss; Open + Remove
- **Unresolved:** cache texts + “Unavailable in this dictionary”; Remove only
- Empty primary → `learning.unresolvedFallback`
- No IDs/hashes in normal UI

---

## 7. Open entry

Uses `liveEntry` only; LS1I2 Save affordance remains; initial state loads as saved when present.

---

## 8. Remove

Confirm (EN/FR) → busy row → `removeLearningRecord` → drop row or empty; failure keeps row + row-level error. Cancel leaves list unchanged. Dictionary untouched.

---

## 9. Stale-async

Generation + `resultsHostContext === "saved_vocabulary"` on session `isCurrent` and `applyModel`. Opening search/entry from search bumps generation.

---

## 10. Accessibility / i18n

- `h2#saved-vocab-heading`, `ul` list, real buttons
- `aria-busy` on busy rows; row errors `role="status"`
- Focus after successful remove → next Open/Remove or Back
- Keys: `learning.savedVocabulary`, `openSaved`, `backToSearch`, `loading`, `empty`, `noActiveBundle`, `unresolved`, `unresolvedFallback`, `open`, `remove`, `removeConfirm`, `listError`, plus existing removeError

---

## 11. Tests and validation

| Suite | Result |
| --- | --- |
| Renderer | 5 passed |
| Session | 6 passed |
| Navigation guards | 2 passed |
| LS1I1 + LS1I2 focused | passed |
| Full suite | **32 files / 318 tests passed** |
| Build | **Pass** |

---

## 12. Deviations

None material. Application navigation covered via guard unit tests + main wiring rather than a full Playwright shell harness in this slice.

---

## 13. Next slice

```text
LS1I4 — Offline, Update, and Soft-Orphan Verification
```

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS1_SAVED_VOCABULARY_SURFACE_IMPLEMENTED` |
| Scope | Active-bundle collection only |
| Soft orphans | Visible + removable |
