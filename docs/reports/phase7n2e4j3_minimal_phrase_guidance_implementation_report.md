# Phase 7N2E4J3 — Implement Minimal Phrase Guidance

## Decision

```text
MINIMAL_PHRASE_GUIDANCE_IMPLEMENTED
```

Implemented the approved minimal phrase-miss empty-state copy. No phrase aliases,
sentence translation, lexical rows, catalog, bundles, source data, matrices,
packages, or review-artifact changes. Son/`prix`, `fièvre`, and `poulet` were
not reopened. Search/index behavior is unchanged.

## 1. Input

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2e4j2_minimal_phrase_guidance_fix_report.md` | Approved primary copy + trigger rules |

## 2. Implemented behavior

| Case | Behavior |
| --- | --- |
| Trimmed query contains whitespace and zero results | Show phrase guidance via existing `getNoResultMessage` → `search.noPhraseMatch` → `searchMeta` |
| Single-word query and zero results | Keep existing `search.noMatchGuidance` |
| Query has results | Show results normally (`getNoResultMessage` not used) |
| Empty / whitespace-only query | Does **not** return phrase guidance (`/\s/` checked on trimmed query) |

Trigger logic remains in `web/src/render/render_results.ts`:

```ts
export function getNoResultMessage(query: string): string {
  if (/\s/.test(query.trim())) {
    return t("search.noPhraseMatch");
  }
  return t("search.noMatchGuidance", { query });
}
```

No change to search/index posting, aliases, or result ranking.

## 3. Copy added

| Locale | Key | Value |
| --- | --- | --- |
| EN | `search.noPhraseMatch` | `Try searching one word at a time.` |
| FR | `search.noPhraseMatch` | `Essayez de chercher un mot à la fois.` |

Primary-only (no optional example secondary line).

## 4. Files changed

| Path | Change |
| --- | --- |
| `web/src/i18n.ts` | Updated EN/FR `search.noPhraseMatch` |
| `web/src/render/render_results.test.ts` | Focused 7N2E4J3 tests for phrase / single-word / empty |
| `web/e2e/human_usage/usage_harness.spec.ts` | Miss-status regex also recognizes new EN/FR phrase copy |
| `docs/reports/phase7n2e4j3_minimal_phrase_guidance_implementation_report.md` | This report |

## 5. Explicit non-changes

- No `source_phrase_aliases`
- No sentence translation / phrase-to-lemma auto-mapping
- No lexical IR / supplement / alias table rows
- No Son/`prix`, `fièvre`, `poulet` reopen
- No catalog, bundle, matrix, package, or review-artifact edits
- No search index algorithm changes

## 6. Tests run

| Command | Result |
| --- | --- |
| `npm --prefix web run test:run -- src/render/render_results.test.ts` | Pass (13 tests) |
| `npm --prefix web run test:run` | Pass (25 files / 257 tests) |
| `npm --prefix web run build` | Pass (`tsc` + vite + PWA generateSW) |

Focused coverage:

- phrase-like miss → phrase guidance (FR + EN)
- single-word miss → not phrase guidance
- empty / whitespace-only → not phrase guidance
- hit path documented: phrase guidance is miss-path only (`getNoResultMessage` unused when results exist)

## 7. Decision

```text
MINIMAL_PHRASE_GUIDANCE_IMPLEMENTED
```

## 8. Next slice definition

**Phase 7N2E4J4 — Verify Minimal Phrase Guidance**

Purpose: verify the implemented phrase-miss copy and trigger rules against the
J2 contract (phrase miss / single-word miss / hit / empty), without expanding
scope into aliases or lexical work.

## 9. Confirmation: no catalog / bundle / source / matrix / package changes

J3 changed only i18n copy, focused unit tests, a local usage-harness miss
classifier string match, and this report. No edits to catalog, bundles, source
data, matrices, packages, or review artifacts.
