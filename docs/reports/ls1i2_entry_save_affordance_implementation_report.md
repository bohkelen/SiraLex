# LS1I2 — Entry Save Affordance Implementation Report

## Decision

```text
LS1_ENTRY_SAVE_AFFORDANCE_IMPLEMENTED
```

Lexicon entry detail now exposes Save / Saved / Unsave against the LS1
Learning Record persistence API. No Saved Vocabulary surface, Review, Reflect,
progress, morphology, audio, catalog, or bundle changes.

---

## 1. UI placement

On **lexicon** entry detail (`renderLexiconEntry`), immediately under the
entry header (headword / N’Ko / POS), before variants and senses:

- container `.entry-learning-actions`
- button `#entry-learning-save` (text-first: Save / Saved / …)
- error `#entry-learning-error` (`role="status"`, `aria-describedby`)

**Index mappings** never receive a Learning control (even if a `learning`
callback object is mistakenly passed).

---

## 2. Renderer / application boundary

| Layer | Owns |
| --- | --- |
| `render_entry.ts` | Control chrome, state presentation, click → callbacks, busy ignore, a11y attrs |
| `entry_learning_session.ts` | Save input construction, IDB calls, generation guard, inflight suppression |
| `main.ts` `showEntryDetail` | Generation token, wires session + renderer, starts `loadInitial` after lexical paint |

Renderer does **not** open IndexedDB.

---

## 3. State model

```text
loading | not_saved | saving | saved | removing
error_not_saved | error_saved | unavailable
```

Initial open: lexical content renders immediately; control starts `loading`
when metadata is sufficient, else `unavailable` (hidden).

---

## 4. Save input construction

`buildSaveInputFromActiveEntry(entry, activeMeta)`:

- `bundle_id` ← `activeMeta.bundle_id` (registry; never parsed from scope)
- `ir_id` ← live entry
- `ir_kind` ← `"lexicon_entry"`
- `content_sha256` ← `activeMeta.expected_content_sha256` (required; no invented fallback)
- `storage_scope_id` ← `getBundleStorageScopeId(activeMeta)`
- `display_cache` ← `buildDisplayCache(entry)`

Returns `null` when stamps/kind/display are insufficient → no partial write.

---

## 5. Save / Unsave behavior

- Save → `saving` → `saveLearningRecord` → `saved` / `error_not_saved`
- Unsave → `removing` → `removeLearningRecord` → `not_saved` (including already absent) / `error_saved`
- No confirm on entry-detail toggle
- No navigation / search re-run
- Duplicate clicks ignored while busy (UI + session `inflight`)

---

## 6. Stale-async protection

`entryDetailGeneration` increments on each `showEntryDetail`. Session
`isCurrent()` must remain true before applying `setState`. Stale completions
are dropped.

---

## 7. Accessibility and localization

- Semantic `<button type="button">`
- `disabled` + `aria-busy` while loading/saving/removing
- `aria-pressed` for saved-side states
- Error text via `aria-describedby` / `role="status"`
- No focus steal on async resolve
- Keys (EN/FR): `learning.save`, `learning.saved`, `learning.saving`,
  `learning.removing`, `learning.checking`, `learning.saveError`,
  `learning.removeError`

---

## 8. Tests and results

| Suite | Result |
| --- | --- |
| `render_entry_learning.test.ts` | 6 passed |
| `entry_learning_session.test.ts` | 8 passed |
| Learning persistence + related focused | passed |
| Full `npm run test:run` | **29 files / 305 tests passed** |
| `npm run build` | **Pass** |

---

## 9. Deviations

None material. Saved Vocabulary navigation keys intentionally omitted (LS1I3).

---

## 10. Next slice

```text
LS1I3 — Implement Saved Vocabulary Surface
```

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS1_ENTRY_SAVE_AFFORDANCE_IMPLEMENTED` |
| Placement | Lexicon header actions, text Save control |
| Collection UI | Not in this slice |
