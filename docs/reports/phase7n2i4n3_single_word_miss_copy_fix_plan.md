# Phase 7N2I4N3 — Draft Minimal Fix for Selected Featured Usage Issue

## Decision

```text
SINGLE_WORD_MISS_COPY_FIX_PLAN_READY
```

Planning only. No code or copy was changed. Phrase guidance was not changed.
Search/index behavior was not changed. No lexical rows, aliases, supplements,
or matrices were added. Son/`prix`, `fièvre`, `poulet`, and `bonjour` were not
reopened as lexical work. No runtime, catalog, bundles, source data, tests,
packages, or review artifacts were edited.

## 1. Selected issue

| Field | Value |
| --- | --- |
| Issue id | `7n2i_n2_single_word_miss_direction_hint` |
| Source | `docs/reports/phase7n2i4n2_featured_usage_evidence_review_report.md` |
| Current EN | `No results for "{query}". Check the search direction or try another form.` |
| Current FR | `Aucun résultat pour « {query} ». Vérifiez le sens de recherche ou essayez une autre forme.` |
| Key | `search.noMatchGuidance` in `web/src/i18n.ts` |
| Selector | `getNoResultMessage` in `web/src/render/render_results.ts` — whitespace → `search.noPhraseMatch`; else → `search.noMatchGuidance` |

## 2. Proposed copy

| Locale | Key | Proposed string |
| --- | --- | --- |
| EN | `search.noMatchGuidance` | `No results for "{query}". Try another spelling or form.` |
| FR | `search.noMatchGuidance` | `Aucun résultat pour « {query} ». Essayez une autre orthographe ou une autre forme.` |

Rationale:

- Remove / soften **Check the search direction** / **Vérifiez le sens de recherche**.
- Keep guidance generic: try another spelling/form.
- Keep `{query}` interpolation.
- Leave `search.noPhraseMatch` and `search.noMatch` unchanged.

Unchanged phrase copy:

| Locale | Key | Remains |
| --- | --- | --- |
| EN | `search.noPhraseMatch` | `Try searching one word at a time.` |
| FR | `search.noPhraseMatch` | `Essayez de chercher un mot à la fois.` |

## 3. Trigger / non-trigger behavior

| Case | Trigger | Message key | N4 change? |
| --- | --- | --- | --- |
| Single-token miss (no whitespace in trimmed query) | `getNoResultMessage` else branch | `search.noMatchGuidance` | **Yes — string only** |
| Multi-word / whitespace miss | `/\s/.test(query.trim())` | `search.noPhraseMatch` | **No** |
| Hits | `getNoResultMessage` not used | result list | **No** |
| Empty / whitespace-only | not phrase branch (trim has no `\s` match after trim… empty string has no `\s`) | `search.noMatchGuidance` with empty query | **No logic change** (existing contract) |
| Direction toggle / search index | n/a | n/a | **No** |

N4 implementation shape (not done here):

1. Edit EN/FR `search.noMatchGuidance` strings in `web/src/i18n.ts` only.
2. Update pinned expectations in `web/src/render/render_results.test.ts`.
3. Do **not** change `getNoResultMessage` branching unless a test requires asserting the new strings (logic already correct).
4. Do **not** change harness settle/miss detection unless a regex hard-requires the old direction sentence (current phrase-miss path is separate).

## 4. Test impact

| File | Impact |
| --- | --- |
| `web/src/render/render_results.test.ts` | Update FR exact expectations that still assert `Vérifiez le sens de recherche…`; update EN single-word assertion to expect new guidance and still exclude phrase copy |
| Phrase-guidance describes (`Phase 7N2E4J3…`) | Keep phrase assertions unchanged; only single-word expected strings change |
| Usage harness | Expect no change if miss detection already accepts generic “No results” / phrase copy; verify in N4/N5 if needed |
| Search/index unit suites | No intentional impact |

## 5. Risks

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Users who *are* in the wrong direction get slightly less explicit hint | low/medium | Soften, don’t remove all recovery advice (“another spelling or form”); direction control remains visible in UI |
| Accidental phrase-copy edit | medium | Touch only `search.noMatchGuidance`; leave `search.noPhraseMatch` alone |
| Scope creep into adding `fièvre` / `poulet` / `bonjour` lemmas | high if opened | Keep lexical work blocked; copy-only N4 |
| Test/harness string pin drift | low | Update unit expectations with the copy change; smoke usage if needed |

## 6. Decision

```text
SINGLE_WORD_MISS_COPY_FIX_PLAN_READY
```

## 7. Next slice

**Phase 7N2I4N4 — Implement Single-Word Miss Copy Fix**

Purpose: apply the EN/FR `search.noMatchGuidance` strings above and update
focused unit expectations, without changing phrase guidance, search/index
behavior, or lexicon content.

## 8. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

N3 created only this plan report. No `i18n.ts`, tests, harness, runtime,
catalog, bundles, source data, matrices, or packages were modified.
