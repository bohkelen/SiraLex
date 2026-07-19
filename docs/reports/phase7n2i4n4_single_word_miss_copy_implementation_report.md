# Phase 7N2I4N4 — Implement Single-Word Miss Copy Fix

## Decision

```text
SINGLE_WORD_MISS_COPY_FIX_IMPLEMENTED
```

Implemented EN/FR `search.noMatchGuidance` only. Phrase guidance
(`search.noPhraseMatch`) unchanged. `getNoResultMessage` branching unchanged.
No search/index behavior change. No lexical rows, aliases, supplements,
matrices, or bundles. Son/`prix`, `fièvre`, `poulet`, and `bonjour` not
reopened as lexical work. No catalog, package, or review-artifact edits.

## 1. Copy implemented

| Locale | Key | New string |
| --- | --- | --- |
| EN | `search.noMatchGuidance` | `No results for "{query}". Try another spelling or form.` |
| FR | `search.noMatchGuidance` | `Aucun résultat pour « {query} ». Essayez une autre orthographe ou une autre forme.` |

Unchanged:

| Locale | Key | String |
| --- | --- | --- |
| EN | `search.noPhraseMatch` | `Try searching one word at a time.` |
| FR | `search.noPhraseMatch` | `Essayez de chercher un mot à la fois.` |

## 2. Files changed

| File | Change |
| --- | --- |
| `web/src/i18n.ts` | Updated EN/FR `search.noMatchGuidance` |
| `web/src/render/render_results.test.ts` | Updated single-word miss expectations; assert direction phrasing absent |
| `docs/reports/phase7n2i4n4_single_word_miss_copy_implementation_report.md` | This report |

## 3. Validation

| Check | Result |
| --- | --- |
| `git diff --check` | clean |
| `npm --prefix web run test:run -- src/render/render_results.test.ts` | **13 passed** |
| `npm --prefix web run test:run` | **257 passed** (25 files) |
| `npm --prefix web run build` | **passed** |

## 4. Decision

```text
SINGLE_WORD_MISS_COPY_FIX_IMPLEMENTED
```

## 5. Next slice

**Phase 7N2I4N5 — Verify Single-Word Miss Copy Fix**

## 6. Confirmation: no catalog / bundle / source / matrix / package changes

N4 touched only `web/src/i18n.ts`, focused unit expectations, and this report.
No catalog, bundle payloads, source data, matrices, or packages were modified.
