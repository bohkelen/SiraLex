# SQ1B — Prefix + Suggestions

## Decision

```text
SQ1B_PREFIX_AND_SUGGESTIONS_IMPLEMENTED
```

## BASE_COMMIT

```text
7f0edbc99c019aadf8a44954d66f93181c4a2e9f
```

`git log -1`: `7f0edbc Integrate SiraLex logo assets`.

This slice adds bounded prefix **suggestions** after an exact-search miss. Exact retrieval, posting order, CF2 schema, query-log schema, IndexedDB version, and dictionary artifacts are unchanged.

---

## Current exact-search behavior

Unchanged. `searchQueryForLookupMode` still:

1. Normalizes the query with `computeSearchKeys` / NFC (same ladder as the index).
2. Looks up `[storageScopeId, {family}_{rung}, key]` point-gets.
3. Stops at the first non-empty posting list.
4. Returns stored `ir_ids[]` with no client re-rank and no prefix merge.

Comment in `web/src/search/search_query.ts` now points prefix suggestions to a **separate miss-only path**.

---

## Prefix lookup design

New module: `web/src/search/search_suggestions.ts`.

| Item | Behavior |
|------|----------|
| When | Only after exact search returns `ir_ids.length === 0` |
| Family | `indexFamilyForLookupInput(LookupMode.from)` → `src_*` / `en_*` / `tgt_*` |
| Match | `candidate_key.startsWith(normalized_query)` |
| Ladder | Same rung order as exact search; **first rung with any prefix candidates wins**; rungs are not merged |
| IDB | `IDBKeyRange.bound([scope, key_type, prefix], [scope, key_type, prefix + U+FFFF])` on the existing compound keyPath `[bundle_id, key_type, key]` |
| Cursor | Stops after 64 inspected keys |
| Cross-mode | None. FR never reads `en_*`; EN never reads `src_*`; MNK reads `tgt_*` only |
| Russian | No `ru_*` family is ever selected |
| N’Ko | No Latin→N’Ko synthesis; only already-indexed keys can appear |

Selecting a suggestion writes that complete key into `#searchInput` and re-runs the **existing** exact search path.

---

## Query length rules

Normalized character count (`Array.from`) of the primary ladder key:

| Length | Prefix suggestions |
|--------|-------------------|
| 0 | No |
| 1 | No |
| 2 | No (deferred; family-size gating would need extra stats/indexes) |
| ≥ 3 | Yes |

---

## Suggestion limit

| Bound | Value |
|-------|------:|
| Visible | 8 |
| Inspected (IDB cursor) | 64 |

---

## Ranking rule (suggestions only)

1. Exact normalized-key equality (if the inspected set includes it)
2. Shorter key before longer key (code-point length)
3. Code-point lexical order (no `localeCompare`, no `ir_id`, no popularity, no CF2/logs)

This is not SQ1G result ranking.

---

## LookupMode boundaries

| Mode | Prefix family | Tests |
|------|---------------|-------|
| FR → MNK | `src_*` | `enf` → `enfant` / `enfance`; `hou` does not leak `house` |
| EN → MNK | `en_*` | `hou` → `house`; `com` → `come` / `come back`; `enf` does not leak `enfant` |
| MNK → FR | `tgt_*` | `bol` → `bolo` / `bolokala` |
| MNK → EN | `tgt_*` | same Maninka keys; no FR/EN gloss leakage |

Partner change and direction swap **re-run search** when the previous surface was an exact miss, so stale suggestions disappear. Exact-hit lists still re-render in place (existing ML1D gloss-preference behavior).

---

## CF2 / query-log impact

| Surface | Change |
|---------|--------|
| CF2 schema | **None** (V2 unchanged) |
| CF2 auto-create | **None**. Miss + suggestions still uses user-initiated no-result capture if the existing affordance is shown |
| Query-log schema | **None** (V3 unchanged) |
| Query-log rows | Existing settle (800 ms) still records the **current input**. Selecting a suggestion cancels the pending miss log and logs the selected complete query if logging is enabled. If the user waits out settle on the partial query, that miss may already have been written — same as any other miss, no schema change |

---

## Performance notes

- Exact path: still 1–4 IDB `get`s.
- Suggestion path: one bounded cursor on a single `[bundle, key_type, prefix…]` range. No full-store scan. No IndexedDB version bump. No extra prefix index.
- Offline: suggestions read the already-installed search_index store.

---

## Accessibility notes

- Suggestion list is a labeled `<ul>` of native `<button type="button">` controls (Tab / Enter / click).
- Heading: “Suggestions” / “Suggestions”.
- Each button has `aria-label` “Search {key}” / “Chercher « {key} »”.
- Visually secondary (muted type, metadata heading).
- Touch min-height uses `--touch-target-min`.
- Escape hides the suggestion list without changing schema (query remains). Clearing the input still clears the surface.
- Not a combobox / modal overlay.

---

## Display copy

| Locale | Exact-miss meta (when suggestions exist) | Heading |
|--------|------------------------------------------|---------|
| EN | No exact match. | Suggestions |
| FR | Aucun résultat exact. | Suggestions |

When there are no prefix completions, existing `getNoResultMessage` copy is unchanged.

---

## No-go confirmations

| Item | Result |
|------|--------|
| Typo-tolerant fuzzy / edit distance | Not implemented |
| AI / cloud / semantic search | Not implemented |
| Morphology / bag-of-words | Not implemented |
| Hyphen/space normalization | Not implemented (SQ1C) |
| Ladder-rung merge / SQ1G ranking | Not implemented |
| New CF2 schema | No |
| Query-log schema change | No |
| IndexedDB version | Still **6** |
| Dictionary / corpus / index rebuild | No |
| N’Ko synthesis | No |
| Russian suggestions / fallback | No |

---

## Files changed

```text
A  web/src/search/search_suggestions.ts
A  web/src/search/search_suggestions.test.ts
A  web/src/render/render_search_suggestions.ts
A  web/src/render/render_search_suggestions.test.ts
A  docs/reports/sq1b_prefix_and_suggestions_report.md
M  web/src/search/search_query.ts
M  web/src/main.ts
M  web/src/i18n.ts
M  web/src/style.css
M  web/e2e/ux2_search_results.spec.ts
M  web/e2e/ml1d2_english_search_picker.spec.ts
```

Pre-existing untracked `docs/reports/sq1a_search_intelligence_audit.md` and `web/scripts/` were not modified by this slice.

---

## Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run` | **1008 passed** / 105 files |
| `npm --prefix web run test:e2e:ux2-search` | **3 passed** (includes SQ1B prefix test; build inside) |
| `npm --prefix web run test:e2e:ml1d2-picker` | **18 passed** (includes SQ1B EN leakage/LookupMode test + ML1D2/D3/RL1/ML1E/DU1) |
| `npm --prefix web run build` | **PASS** (`tsc` + Vite; also run as part of ux2-search) |
| `git diff --check` | **PASS** |

---

## git diff --check

```text
PASS
```

---

## Working tree

SQ1B files listed above plus any pre-existing untracked files from earlier slices (SQ1A report, `web/scripts/`). Commit not created.
