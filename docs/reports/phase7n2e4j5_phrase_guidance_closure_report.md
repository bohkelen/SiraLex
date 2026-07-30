# Phase 7N2E4J5 — Close Minimal Phrase Guidance Workstream

## Decision

```text
MINIMAL_PHRASE_GUIDANCE_WORKSTREAM_CLOSED
```

Closure/reporting only. The 7N2E phrase-guidance workstream is closed after
verified implementation. No runtime, i18n, tests, catalog, bundles, source data,
matrices, packages, or review artifacts were changed in this slice. Son/`prix`,
`fièvre`, and `poulet` were not reopened. Phrase guidance was not expanded.

## 1. Workstream summary

| Field | Value |
| --- | --- |
| Workstream | 7N2E — Usage evidence → minimal phrase guidance |
| Selected issue | `7n2e_f1_phrase_mismatch_guidance` — recurring phrase-mismatch misses |
| Implemented fix | Phrase-like miss shows short empty-state guidance |
| Closure basis | J4 `MINIMAL_PHRASE_GUIDANCE_VERIFIED` |
| Featured baseline (unchanged by this workstream’s linguistic scope) | `bundle_full_20260710_337619ff` |

## 2. Evidence chain J1–J4

| Slice | Report | Decision |
| --- | --- | --- |
| **J1** | `phase7n2e4j1_usage_evidence_review_report.md` | `USAGE_EVIDENCE_REVIEW_ACTIONABLE_ISSUE_SELECTED` — selected F1 phrase-mismatch guidance |
| **J2** | `phase7n2e4j2_minimal_phrase_guidance_fix_report.md` | `MINIMAL_PHRASE_GUIDANCE_FIX_READY` — primary EN/FR copy + whitespace miss trigger |
| **J3** | `phase7n2e4j3_minimal_phrase_guidance_implementation_report.md` | `MINIMAL_PHRASE_GUIDANCE_IMPLEMENTED` — i18n + focused tests + harness miss regex |
| **J4** | `phase7n2e4j4_minimal_phrase_guidance_verification_report.md` | `MINIMAL_PHRASE_GUIDANCE_VERIFIED` — J2 contract checks all PASS |

## 3. Final shipped behavior

| Aspect | Shipped value |
| --- | --- |
| EN copy | `Try searching one word at a time.` |
| FR copy | `Essayez de chercher un mot à la fois.` |
| Locale key | `search.noPhraseMatch` |
| Surface | Existing search empty-state / `searchMeta` via `getNoResultMessage` |
| Trigger | Trimmed query contains whitespace **and** zero results |
| Non-triggers | Single-word miss; hits; empty / whitespace-only query |
| Optional example secondary line | Not shipped (primary-only) |

## 4. Explicit non-changes

Closed workstream did **not** introduce:

- phrase aliases (`source_phrase_aliases`)
- free sentence translation
- phrase-to-lemma auto-mapping
- lexical rows / owner lexical IR / supplements
- search/index algorithm or posting changes
- catalog / bundle / matrix / package / review-artifact edits
- Son/`prix`, `fièvre`, or `poulet` reopen

## 5. Tests / build evidence

From J3 implementation and J4 verification:

| Command | Result |
| --- | --- |
| `npm --prefix web run test:run -- src/render/render_results.test.ts` | Pass (13 tests) |
| `npm --prefix web run test:run` | Pass (25 files / 257 tests) |
| `npm --prefix web run build` | Pass (`tsc` + vite + PWA generateSW) |

## 6. Residual risks

| Risk | Rating | Note |
| --- | --- | --- |
| Users still expect sentence translation despite short guidance | medium | Product boundary preserved; further onboarding is deferred |
| Whitespace-only phrase detector is intentionally minimal | low | Punctuation-only multi-token strings without spaces stay on single-word miss path |
| Usage harness / string pinning if copy changes again | low | Harness miss regex already recognizes current EN/FR phrase copy |
| Guidance scope creep into aliases or auto-mapping | medium | Explicitly closed; reopen only via a new approved workstream |

## 7. Deferred follow-ups

Carried from J1 (not part of this closed workstream):

| Item | Status |
| --- | --- |
| English / mixed-language product copy (F2) | deferred |
| Harness settle timeout on already-shown phrase miss (F3) | deferred |
| `Kùn` multi-hit interpretability (F4) | not actionable without owner semantic review |
| Son/`prix`, `fièvre`, `poulet` lexical validation | blocked / deferred (no validation data) |
| Offline/storage observation (F6) | monitor only |
| Optional secondary example line for phrase misses | deferred (not required for closure) |
| Catalog schema hardening / repo cleanup | deferred (separate practical workstreams) |

## 8. Decision

```text
MINIMAL_PHRASE_GUIDANCE_WORKSTREAM_CLOSED
```

7N2E phrase-guidance work is complete: selected from usage evidence, drafted,
implemented, verified, and closed with a minimal empty-state copy change only.

## 9. Next slice recommendation

**Phase 7N2F4K0 — Choose Next Practical Workstream**

Purpose: choose the next practical workstream that does not depend on
unavailable lexical validation and does not reopen closed phrase-guidance scope
unless a new product need is explicitly selected.

## 10. Confirmation: no catalog / bundle / source / matrix / package changes

J5 created only this report. No edits to runtime, i18n, tests, catalog, bundles,
source data, matrices, packages, or review artifacts.
