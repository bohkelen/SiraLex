# Phase 7N2E4J2 — Draft Minimal Fix for Selected Usage Issue

## Decision

```text
MINIMAL_PHRASE_GUIDANCE_FIX_READY
```

Draft/planning only. No runtime, catalog, bundles, source data, matrices, tests,
or packages were changed. No phrase aliases, lexical rows, or Son/`prix` /
`fièvre` / `poulet` reopen.

Selected issue: `7n2e_f1_phrase_mismatch_guidance`

## 1. Inputs

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2e4j1_usage_evidence_review_report.md` | Selected F1 phrase-mismatch guidance issue |
| `docs/LOCAL_USAGE_AUTOMATION.md` | Scripted usability evidence boundary |
| `data/local_evidence/human_usage_automation/` | Phrase-mismatch examples and observed miss meta |

## 2. Current baseline (inspection only)

Phrase queries already remain dictionary misses. Current empty-state path:

| Location | Behavior |
| --- | --- |
| `web/src/main.ts` search empty branch | When `result.ir_ids.length === 0`, sets `searchMeta.textContent = getNoResultMessage(query)` |
| `web/src/render/render_results.ts` `getNoResultMessage` | If trimmed query contains whitespace → `search.noPhraseMatch`; else single-word miss guidance |
| `web/src/i18n.ts` EN | `No exact result for this expression. Try one word at a time.` |
| `web/src/i18n.ts` FR | `Aucun résultat exact pour cette expression. Essayez un mot à la fois.` |

Usage evidence already recorded that EN miss meta for phrase rows. The minimal fix
is therefore a **copy/clarity refinement** of existing phrase-miss guidance, not
a new search feature and not phrase aliasing.

## 3. Proposed guidance behavior

When a user submits a **phrase-like** query and the dictionary returns **no
results**, keep the miss, and show short lemma-boundary guidance in the existing
search empty-state / `searchMeta` area.

Do **not**:

- add `source_phrase_aliases`
- map phrases to lemmas automatically
- offer free sentence translation
- change hit behavior for indexed multiword source terms that already resolve

## 4. Where the guidance should appear

| Surface | Role |
| --- | --- |
| Primary | Existing search empty-state message (`searchMeta` via `getNoResultMessage`) |
| Keys to update in J3 | `search.noPhraseMatch` in `web/src/i18n.ts` (EN + FR) |
| Optional secondary line | Only if needed for clarity; keep in the same empty-state block (still copy-only). Prefer one short primary line first. |

No new page, modal, onboarding tour, or catalog/bundle change in the minimal fix.

## 5. Proposed user-facing copy

Keep copy short.

### English (primary)

```text
Try searching one word at a time.
```

### English (optional secondary example — include only if primary alone feels too thin)

```text
For example, search école instead of comment dit-on école.
```

Alternative optional secondary (if example-query coupling is unwanted):

```text
This dictionary works best with single words.
```

### French (primary)

```text
Essayez de chercher un mot à la fois.
```

### French (optional secondary)

```text
Par exemple, cherchez école au lieu de comment dit-on école.
```

or:

```text
Ce dictionnaire fonctionne mieux avec des mots seuls.
```

### Recommended J3 default

Ship **primary line only** (EN + FR) as the smallest change. Add the optional
example line only if product review wants a concrete recovery hint in the same
slice.

## 6. Trigger / non-trigger rules

### Trigger (show phrase guidance)

All of:

1. Active dictionary is available and search runs.
2. Query is phrase-like under the existing minimal rule: trimmed query contains
   whitespace (`/\s/` — same gate as current `getNoResultMessage`).
3. Search returns no results (`ir_ids.length === 0`).

Examples from usage evidence that should continue to miss and show guidance:

| Query | Evidence issue class |
| --- | --- |
| `comment dit-on école` | `phrase_mismatch` |
| `combien ça coûte` | `phrase_mismatch` |
| `merci beaucoup` | `phrase_mismatch` |
| `mon enfant est malade` | `phrase_mismatch` |
| `je t'aime` | `phrase_mismatch` |
| `viens ici` | `phrase_mismatch` |
| `je veux apprendre le maninka` | `phrase_mismatch` |
| `qu'est-ce que cela veut dire` | `phrase_mismatch` |

### Do not trigger phrase guidance when

| Case | Expected behavior |
| --- | --- |
| Single-word miss (e.g. unknown lemma) | Keep single-word miss copy (`search.noMatchGuidance`) |
| Any hit (one or more results) | Show results; no phrase-miss empty state |
| Indexed multiword source term that already hits | Unchanged hit path |
| Empty / whitespace-only query | Existing empty-query handling; do not invent new phrase UX |
| Son/`prix`, `fièvre`, `poulet` | Out of scope — do not reopen lexical work |

Punctuation-only differences without spaces remain single-token under the
whitespace rule (intentional minimal scope).

## 7. Risks

| Risk | Rating | Mitigation |
| --- | --- | --- |
| “Guidance” becomes phrase aliases or auto lemma mapping | medium | Explicit J3 forbid list: no aliases, no sentence translation, no phrase-to-lemma mapping |
| Example line teaches users a specific lemma that later confuses | low/medium | Prefer primary-only; if example ships, keep it illustrative and FR/EN localized |
| Changing copy breaks usage-automation string expectations | medium | Update only i18n + existing `getNoResultMessage` tests; adjust harness assertions if they pin old EN/FR strings |
| Over-scoping into onboarding tours / English translation features | medium | Keep J3 to empty-state copy for whitespace misses only |
| Stale evidence bundle vs featured | low | Behavior is product copy on miss path; phrase miss contract already confirmed on featured in 7N2C |

## 8. Minimal implementation target for next slice

**Phase 7N2E4J3 — Implement Minimal Phrase Guidance**

Implement only:

1. Update `search.noPhraseMatch` EN/FR strings to the approved short primary copy
   (and optional secondary only if explicitly included in J3).
2. Keep trigger logic as whitespace + no results (no new phrase detector unless
   required to preserve current tests).
3. Update focused unit test(s) in `web/src/render/render_results.test.ts` for the
   new copy.
4. Do not touch aliases, supplements, owner lexical IR, catalog, bundles, or
   matrices.

Out of J3 scope:

- phrase aliases / sentence translation
- lexical additions
- Son/`prix`, `fièvre`, `poulet`
- catalog schema / storage / repo cleanup
- harness settle-timeout fix (F3), unless it blocks verifying the copy change

## 9. Decision

```text
MINIMAL_PHRASE_GUIDANCE_FIX_READY
```

The smallest product fix is ready to implement: refine existing phrase-miss
empty-state copy to guide users to search one word at a time, while keeping
phrase queries as dictionary misses.

## 10. Next slice definition

**Phase 7N2E4J3 — Implement Minimal Phrase Guidance**

Purpose: implement the approved minimal phrase-miss guidance copy (and tests)
without phrase aliases, lexical changes, or catalog/bundle edits.

## 11. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

J2 created only this report. No edits to `web/src/`, env, catalog, bundles,
aliases, supplements, matrices, `data/` sources, `api/`, packages, or release
documents.
