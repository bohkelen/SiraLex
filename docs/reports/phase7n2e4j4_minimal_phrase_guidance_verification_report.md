# Phase 7N2E4J4 — Verify Minimal Phrase Guidance

## Decision

```text
MINIMAL_PHRASE_GUIDANCE_VERIFIED
```

Verification only. No new behavior, copy changes, catalog, bundles, source data,
matrices, packages, or review artifacts were modified. Son/`prix`, `fièvre`, and
`poulet` were not reopened.

## 1. Inputs

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2e4j2_minimal_phrase_guidance_fix_report.md` | J2 contract (copy + trigger rules) |
| `docs/reports/phase7n2e4j3_minimal_phrase_guidance_implementation_report.md` | J3 implementation record |
| `web/src/i18n.ts` | EN/FR `search.noPhraseMatch` |
| `web/src/render/render_results.ts` | `getNoResultMessage` trigger |
| `web/src/render/render_results.test.ts` | Focused contract tests |
| `web/e2e/human_usage/usage_harness.spec.ts` | Miss-status recognition of new copy |
| `web/src/main.ts` | Empty-state wiring (`ir_ids.length === 0` → `getNoResultMessage`) |

## 2. Contract checklist

| Check | Expected (J2) | Observed | Result |
| --- | --- | --- | --- |
| EN phrase-like miss copy | `Try searching one word at a time.` | `web/src/i18n.ts` EN `search.noPhraseMatch` exact match; unit test asserts EN | **PASS** |
| FR phrase-like miss copy | `Essayez de chercher un mot à la fois.` | FR `search.noPhraseMatch` exact match; unit tests assert FR | **PASS** |
| Trigger | trimmed query has whitespace + zero results | `getNoResultMessage` uses `/\s/.test(query.trim())`; `main.ts` calls it only when `result.ir_ids.length === 0` | **PASS** |
| Single-word miss | not phrase guidance | Tests assert FR/EN single-word miss uses `search.noMatchGuidance` and excludes phrase copy | **PASS** |
| Hit path | no phrase guidance | Hits render via `renderResultsList`; `getNoResultMessage` unused when results exist; documented in unit test | **PASS** |
| Empty / whitespace-only | no phrase guidance | Trim empties whitespace-only; `/\s/` gate fails; tests assert neither EN nor FR phrase copy | **PASS** |
| No aliases / translation / lexical / index changes | J3 scope only | J3 commit touched only i18n, focused tests, harness miss regex, and J3 report | **PASS** |

Optional secondary example lines from J2 were **not** shipped (primary-only), matching J2 recommended default and J3 record.

## 3. Code evidence (read-only)

```ts
// getNoResultMessage
if (/\s/.test(query.trim())) {
  return t("search.noPhraseMatch");
}
return t("search.noMatchGuidance", { query });
```

```ts
// main.ts empty-state path
if (result.ir_ids.length === 0) {
  searchMeta.textContent = getNoResultMessage(query);
  ...
}
```

```text
EN search.noPhraseMatch = Try searching one word at a time.
FR search.noPhraseMatch = Essayez de chercher un mot à la fois.
```

## 4. Non-scope confirmation

Verified absent from the J3 implementation commit file set:

- catalog / featured env
- bundle payloads
- source aliases / supplements / owner lexical IR
- search regression matrices
- packages / review artifacts
- Son/`prix`, `fièvre`, `poulet` reopen

Harness change only extends miss-status regex recognition to the new EN/FR phrase
copy; it does not alter search/index behavior.

## 5. Tests / build

| Command | Result |
| --- | --- |
| `npm --prefix web run test:run -- src/render/render_results.test.ts` | Pass (13 tests) |
| `npm --prefix web run test:run` | Pass (25 files / 257 tests) |
| `npm --prefix web run build` | Pass (`tsc` + vite + PWA generateSW) |

## 6. Issues found

None. No J2/J3 mismatch requiring copy or behavior repair.

## 7. Decision

```text
MINIMAL_PHRASE_GUIDANCE_VERIFIED
```

## 8. Next slice definition

**Phase 7N2E4J5 — Close Minimal Phrase Guidance Workstream**

Purpose: close the 7N2E phrase-guidance workstream after verified implementation,
recording residual risks and any deferred follow-ups without expanding scope.

## 9. Confirmation: no catalog / bundle / source / matrix / package changes

J4 created only this report. No edits to runtime, i18n, tests, catalog, bundles,
source data, matrices, packages, or review artifacts.
