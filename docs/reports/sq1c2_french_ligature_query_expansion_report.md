# SQ1C2 — French Ligature Query Expansion

## Decision

```text
SQ1C2_FRENCH_LIGATURE_QUERY_EXPANSION_IMPLEMENTED
```

## BASE_COMMIT

```text
b61f6adfd95522a1a155fec424706dfeecee854b
```

`git log -1` at slice start: `b61f6ad Add hyphen space query expansion`.

This slice retries exact search with one French `œ`/`Œ` → `oe` surface after an FR→MNK miss, before existing hyphen↔space retries. Exact retrieval, posting order, CF2 schema, query-log schema, IndexedDB version, and dictionary artifacts are unchanged.

---

## Variant generation rule

Module: `web/src/search/search_query_variants.ts`.

`frenchLigatureExpansionQueries`:

1. NFC + existing whitespace collapse.
2. Generate only if the collapsed query contains `œ` or `Œ`.
3. Replace `œ` → `oe` and `Œ` → `oe` (one surface).
4. Drop if the casefold key equals the original query.
5. Do not reverse-expand `oe` → `œ`. Do not touch `æ`, `ɔ`, or `ɛ`.

Examples:

| Typed | Variant surface | Casefold key |
|-------|-----------------|--------------|
| `sœur` | `soeur` | `soeur` |
| `cœur` | `coeur` | `coeur` |
| `œuf` | `oeuf` | `oeuf` |
| `ŒUF` | `oeUF` | `oeuf` |
| `soeur` | (none) | — |

`safeQueryVariants(query, LookupMode)` collects LookupMode-gated surfaces, original excluded, cap **3**.

---

## Language boundary

| Mode | Ligature `œ`→`oe` | Hyphen/space |
|------|-------------------|--------------|
| FR → MNK | Yes, after exact miss | Yes |
| EN → MNK | **No** | Yes |
| MNK → FR | **No** | No |
| MNK → EN | **No** | No |

Gate is `LookupMode.from === "fr"`, not UI locale. Legacy `searchQuery()` does not expand.

---

## Search order

1. Existing exact ladder on the user query.
2. If hit, return unchanged (`separator_variant_query` null).
3. Else retry `safeQueryVariants` in order:
   1. French ligature (≤1)
   2. ASCII hyphen↔space (≤2)
4. First variant hit wins; `separator_variant_query` is that surface (existing consumer copy).
5. If all miss, return the original miss result.
6. Host SQ1B prefix suggestions only if `ir_ids.length === 0`.

---

## Interaction with hyphen/space expansion

Ligature is **before** hyphen/space. Combinations (`sœur extra` → `soeur-extra`) are **not** generated.

| Query | Variants (FR) |
|-------|----------------|
| `sœur` | `soeur` |
| `grand pere` | `grand-pere` |
| `sœur extra` | `soeur extra`, `sœur-extra` |

Cap: `SAFE_QUERY_VARIANT_MAX = 3` (1 ligature + 2 hyphen/space). SQ1C1 hyphen/space still works for FR and EN.

---

## Prefix suggestion interaction

Unchanged host order: exact / variant hits suppress suggestions. Ligature is not applied inside prefix lookup.

---

## Query-log behavior

Schema **unchanged** (V3). Logged `query_raw` remains the typed string. On variant hit, existing `result_count` / `matched_key` follow the successful variant. No new matched-variant field.

---

## CF2 behavior

Schema **unchanged** (V2). User-initiated only. `lastExecutedSearch.query_raw` stays the typed query (`sœur` is not rewritten to `soeur`).

---

## Performance cost

- Original hit: +0 IDB `get`s.
- FR miss with `œ`/`Œ`: **+1** extra exact walk for ligature, then up to 2 hyphen/space walks if that misses (still ≤ 3 variant retries).
- No scans, no new IDB index, no bundle rebuild.

---

## No-go confirmations

| Item | Result |
|------|--------|
| Reverse `oe` → `œ` | Not implemented |
| EN ligature / `æ` | No |
| Fuzzy / edit distance / morphology | No |
| MNK character folding | No |
| Slash / comma / bag-of-words | No |
| New CF2 / query-log schema | No |
| IndexedDB version | Still **6** |
| Dictionary / corpus / index rebuild | No |
| N’Ko synthesis / Russian lookup | No |
| Broad Unicode transliteration | No |

---

## Files changed

```text
A  docs/reports/sq1c2_french_ligature_query_expansion_report.md
M  web/src/search/search_query_variants.ts
M  web/src/search/search_query_variants.test.ts
M  web/src/search/search_query.ts
M  web/src/search/search_query.test.ts
M  web/src/search/search_suggestions.test.ts
```

No `main.ts` / `i18n.ts` change: ligature hits reuse `search.separatorVariantMeta`.

E2E: debug directional bundle has no `soeur`/`sœur` keys. Visible `sœur` flow is covered by unit/IDB fixtures, not Playwright.

---

## Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run` | **1037 passed** / 106 files |
| `npm --prefix web run test:e2e:ux2-search` | **4 passed** (SQ1C1 hyphen flow; no `sœur` in debug bundle) |
| `npm --prefix web run test:e2e:ml1d2-picker` | **18 passed** |
| `npm --prefix web run build` | **PASS** (`tsc` + Vite; also run as part of ux2-search) |
| `git diff --check` | **PASS** |

---

## git diff --check

```text
PASS
```

---

## Working tree

Expected:

```text
A  docs/reports/sq1c2_french_ligature_query_expansion_report.md
M  web/src/search/search_query_variants.ts
M  web/src/search/search_query_variants.test.ts
M  web/src/search/search_query.ts
M  web/src/search/search_query.test.ts
M  web/src/search/search_suggestions.test.ts
```

Pre-existing untracked `web/scripts/` is not part of this slice.

Commit: **NOT CREATED**.
