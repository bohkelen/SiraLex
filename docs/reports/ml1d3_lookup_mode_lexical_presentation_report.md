# ML1D3 — LookupMode-Aware Lexical Presentation

**Decision:** `ML1D3_LOOKUP_AWARE_PRESENTATION_ACCEPTED`  
**Amendment:** `ML1D3A_TARGET_NAVIGATION_CONTEXT_FIXED`  
**BASE_COMMIT:** `57ea2a2493221a3c6cbf67a8be407c7275278245`  
**Commit:** created after final validation (see git log)

---

## Summary

Search results and Search-origin entry detail present FR/EN glosses according to
the immutable LookupMode that produced the navigation event. Dictionary
authority, Learning identity, search execution, query-log V3, and CF2 schemas
are unchanged. Russian is never a consumer gloss fallback.

### Preserved final contracts

- EN preference chain = EN → FR → unavailable
- FR preference chain = FR → EN → unavailable
- Russian is never a gloss fallback on changed Search/Entry paths
- `ResultDisplayContext` owns immutable LookupMode
- Settled results are not relabeled after picker changes
- Search-origin Entry uses the result event LookupMode
- Mapping→target navigation carries `origin.restoreLookupMode`
- Target hop does not read live `currentLookupMode`
- Back restores the original result mode
- Saved live secondary may follow FR/EN preference
- Learning identity remains `(bundle_id, ir_id)`
- Learning `display_cache` remains save-time FR→EN fallback
- Review remains unchanged / dual FR+EN under LS2
- Query-log / CF2 / CF1 schemas unchanged
- IndexedDB remains v6

---

## Canonical gloss preference

| LookupMode | Preferred gloss chain |
| ---------- | --------------------- |
| MNK→EN / EN→MNK | EN → FR → unavailable |
| MNK→FR / FR→MNK | FR → EN → unavailable |

Russian: **NEVER**.

---

## Central resolver

- Reuses `preferredGlossLanguage` / `glossFallbackChain` from `lookup_mode.ts`
- Adds `resolvePreferredGloss` in `web/src/search/resolve_preferred_gloss.ts`
- Never inspects `gloss_ru` / `trans_ru`

---

## Result-context model

`ResultDisplayContext` now carries immutable `lookupMode: LookupMode`, bound in
`runSearch()` from the effective mode for that completed search.

`renderResultsList` reads each context’s `lookupMode` — not live
`currentLookupMode` — so partner-picker changes cannot relabel settled results.

---

## Result rendering

- Lexicon cards: Maninka headword primary; secondary gloss via resolver
- Unavailable → localized `render.noTranslation`
- Index mappings: unchanged target `display_text` secondary (no invented EN fields)
- Limitation: mapping cards do not own sense glosses; EN/FR preference applies
  after opening the target lexicon entry

---

## Entry rendering (Search origin)

- `presentationLookupMode` snapshot (same immutable mode as Back restore)
- Senses / examples / subentries: preferred FR|EN only; RU suppressed on this path
- Fallback uses honest language label (`entry.translationLabel.fr|en`)
- Headword / N’Ko unchanged

---

## Stale-result behavior

**Option B:** keep the old list under its original LookupMode context.

Partner change still re-renders chrome and clears the CF2 executed snapshot, but
gloss text stays bound to each result’s stored `lookupMode`.

Opening an entry from a settled list uses `context.lookupMode`, not the live
partner selection.

---

## Target-entry navigation

**ML1D3A:** The result-origin LookupMode is passed through the mapping detail into
direct target navigation. The target hop does **not** read live
`currentLookupMode`.

Host flow:

1. `showResultsList` / entry open stamps `EntryNavOrigin.restoreLookupMode` from
   `ResultDisplayContext.lookupMode`
2. Mapping `onOpenTargetEntry` calls
   `handleOpenTargetLexiconEntry(target, root, origin.restoreLookupMode)`
3. `bindTargetNavToSearchOrigin(origin)` derives restore + temporary MNK→partner
   chrome from that snapshot only
4. Target lexicon presentation uses the same restore snapshot; Back restores it

Stale mapping browser regression (EN settle → FR picker without new search →
open old mapping → target still EN; inverse FR→EN) is covered in
`ml1d3_lookup_presentation.spec.ts`.

---

## Saved policy

Live Saved Vocabulary secondary gloss uses
`siralex.search_lookup_lang` + EN capability clamp
(`resolveSavedPresentationPreferredGlossLanguage`).

- Does **not** mutate Learning Records
- Does **not** store preferred gloss language on Learning
- Save-time `display_cache.gloss_short` remains FR-then-EN for offline unresolved rows

---

## Review policy

**Deferred / unchanged.**

LS2 Review intentionally reveals **both** FR and EN support text from live
dictionary data (`review_display.ts`). Applying single preferred-gloss
presentation would conflict with that freeze. Documented for a future reopen;
ML1D3 does not change Review write behavior or card identity.

---

## Learning identity impact

- Identity remains `(bundle_id, ir_id)`
- No language-specific duplicate saves
- Learning / CF1 schemas unchanged

---

## UI locale independence

UI locale selects label language (`Traduction anglaise`, section titles).
LookupMode selects which lexical gloss string is shown. Covered by unit + E2E.

---

## Query-log / CF2 consistency

Unchanged schemas. One completed search still feeds the same effective
LookupMode into execution, result `lookupMode`, query log, and CF2 snapshot.

---

## Russian boundary

ML1D3 helper and newly wired Search/Entry paths never use RU.
Independent RU surfaces (if any remain outside these paths) are left for RL1.

---

## High-risk excerpts

### `render_results.ts` — lexicon gloss

Previous: `gloss_fr ?? gloss_en ?? gloss_ru`  
New: `resolvePreferredGloss` from `context.lookupMode`; RU never; unavailable copy.

### `render_entry.ts` — sense gloss

Previous: render all of FR, EN, RU when present  
New: single preferred (+ labeled fallback); RU omitted on this path.

### `main.ts` — result binding + navigation

- `lookupMode` stamped on each `ResultDisplayContext`
- Entry open from results uses `context.lookupMode` for restore/presentation

### `main.ts` — ML1D3A mapping→target hop

Previous: `handleOpenTargetLexiconEntry` did
`const restoreLookupMode = { ...currentLookupMode }` (live picker).  
New: receives `origin.restoreLookupMode` from Search-origin entry detail and
binds restore + MNK→partner chrome via `bindTargetNavToSearchOrigin(origin)`
only — live `currentLookupMode` is not read on this path.

---

## Unexpected changes

NONE (unrelated untracked: `web/scripts/capture_ui_screenshots.mjs`)

## Scope deviations

- Review presentation deliberately deferred due to LS2 dual FR+EN freeze
- Index-mapping result cards remain target-text secondary (no synthesized gloss)

---

## Validation

Final reconciliation validation (this commit):

| Gate | Result |
| ---- | ------ |
| Unit suite | **969 passed** (98 files) |
| ML1D3 E2E | PASS (7 tests) |
| ML1D2 picker E2E | PASS (includes ML1D2 + ML1D3 under shared config; 10 passed) |
| Search E2E | PASS (2) |
| Entry E2E | PASS (4) |
| Saved E2E | PASS (2) |
| LS1 E2E | PASS (1) |
| CF2 E2E | PASS (`search-feedback` 7, `ux2-search-feedback` 4) |
| Build | PASS |
| `git diff --check` | PASS |
| Review E2E | NOT RUN (Review deferred / unchanged) |

---

## Working tree

Accepted on `feat/phase-2.0.5-offline-pwa`.  
Final decision: `ML1D3_LOOKUP_AWARE_PRESENTATION_ACCEPTED`.
