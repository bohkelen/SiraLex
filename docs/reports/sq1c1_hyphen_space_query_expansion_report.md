# SQ1C1 — Hyphen/Space Query Expansion

## Decision

```text
SQ1C1_HYPHEN_SPACE_QUERY_EXPANSION_IMPLEMENTED
```

## BASE_COMMIT

```text
94a74888af756a01365952e0928a1fcc8f1b0254
```

`git log -1` at slice start: `94a7488 Audit search hyphen and space normalization.`

This slice retries exact search with at most two ASCII hyphen↔space surfaces after an FR/EN miss. Exact retrieval, posting order, CF2 schema, query-log schema, IndexedDB version, and dictionary artifacts are unchanged.

---

## Variant generation rule

Module: `web/src/search/search_query_variants.ts`.

1. NFC + existing whitespace collapse (`normalizeWhitespace`).
2. If the collapsed query contains ASCII space (`U+0020`), emit space→hyphen.
3. If it contains ASCII hyphen-minus (`U+002D`), emit hyphen→space.
4. Drop candidates whose `casefold` key equals the original query.
5. Cap at **2** variants (`HYPHEN_SPACE_EXPANSION_MAX_VARIANTS`).

Examples:

| Typed | Variants |
|-------|----------|
| `grand pere` | `grand-pere` |
| `right-hand` | `right hand` |
| `pick-up` | `pick up` |
| `grand   pere` | `grand-pere` |
| `grand-pere extra` | `grand-pere-extra`, `grand pere extra` |
| `maison` | (none) |

Not transformed: en dash, em dash, slash, apostrophe, modifier apostrophe. Surrounding ASCII spaces may still be hyphenated (`sth / smb.` → `sth-/-smb.`); slash itself is not a delimiter.

---

## Language boundary

| Mode | Expansion |
|------|-----------|
| FR → MNK | Yes, after exact miss |
| EN → MNK | Yes, after exact miss |
| MNK → FR | No |
| MNK → EN | No |

Gate is `LookupMode.from === "fr" | "en"`, not UI locale. Legacy `searchQuery()` (no LookupMode) does not expand.

---

## Search order

1. Existing exact ladder on the user query.
2. If `ir_ids.length > 0`, return unchanged (`separator_variant_query` null).
3. Else if FR/EN, retry exact ladder on each variant (max 2 extra walks).
4. First variant hit wins; `separator_variant_query` is that surface.
5. If all miss, return the **original** miss result (original normalized keys).

No merge of original and variant postings.

Consumer copy when a variant hits:

| Locale | `#searchMeta` |
|--------|----------------|
| EN | Showing results for "{query}" |
| FR | Résultats pour « {query} » |

`{query}` is the expansion surface (e.g. `bon travail`), not a ladder rung name.

---

## Prefix suggestion interaction

Host order in `runSearch`:

exact original → hyphen/space variant exact retry (inside `searchQueryForLookupMode`) → SQ1B prefix only if `ir_ids.length === 0`.

Variant hit suppresses suggestions. Variant miss uses existing SQ1B on the **typed** query (no hyphen expansion inside prefix lookup).

---

## Query-log behavior

Schema **unchanged** (V3).

- Logged `query_raw` remains the user-entered string (`runSearch` still passes `query`).
- On variant hit, `result_count` / `matched_key` follow the successful variant result (existing fields).
- No new provenance field for `separator_variant_query`.

---

## CF2 behavior

Schema **unchanged** (V2).

- Still user-initiated; no auto-create.
- `lastExecutedSearch.query_raw` stays the typed query.
- Feedback is not rewritten to the matched variant.

---

## Performance cost

- Hit on original: +0 IDB `get`s.
- Miss, no hyphen/space: +0.
- Miss, FR/EN with 1–2 variants: at most **two extra exact walks** (≤ 8 extra `get`s).
- No scans, no new IDB index, no bundle rebuild. Offline: same installed `search_index`.

---

## No-go confirmations

| Item | Result |
|------|--------|
| Fuzzy / edit distance | Not implemented |
| Morphology / plurals / stemming | No |
| `œ`/`oe` | No |
| Modifier apostrophe / backtick policy | No |
| MNK hyphen folding | No |
| Slash / comma / bag-of-words | No |
| Ranking overhaul | No |
| New CF2 schema | No |
| Query-log schema change | No |
| IndexedDB version | Still **6** |
| Dictionary / corpus / index rebuild | No |
| N’Ko synthesis | No |
| Russian lookup | No |

---

## Files changed

```text
A  web/src/search/search_query_variants.ts
A  web/src/search/search_query_variants.test.ts
A  docs/reports/sq1c1_hyphen_space_query_expansion_report.md
M  web/src/search/search_query.ts
M  web/src/search/search_query.test.ts
M  web/src/search/search_suggestions.test.ts
M  web/src/main.ts
M  web/src/i18n.ts
M  web/src/i18n.test.ts
M  web/e2e/ux2_search_results.spec.ts
```

---

## Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run` | **1024 passed** / 106 files |
| `npm --prefix web run test:e2e:ux2-search` | **4 passed** (includes SQ1C1 `bon-travail` → `bon travail`; build inside) |
| `npm --prefix web run test:e2e:ml1d2-picker` | **18 passed** (includes SQ1B EN prefix + DU1/ML1E/RL1) |
| `npm --prefix web run build` | **PASS** (`tsc` + Vite; also run as part of ux2-search) |
| `git diff --check` | **PASS** |

---

## git diff --check

```text
PASS
```

---

## Working tree

Expected for this slice (audit already committed as `94a7488`):

```text
A  web/src/search/search_query_variants.ts
A  web/src/search/search_query_variants.test.ts
A  docs/reports/sq1c1_hyphen_space_query_expansion_report.md
M  web/src/search/search_query.ts
M  web/src/search/search_query.test.ts
M  web/src/search/search_suggestions.test.ts
M  web/src/main.ts
M  web/src/i18n.ts
M  web/src/i18n.test.ts
M  web/e2e/ux2_search_results.spec.ts
```

Pre-existing untracked `web/scripts/` was not modified by this slice.

Commit: **NOT CREATED** (implementation).
