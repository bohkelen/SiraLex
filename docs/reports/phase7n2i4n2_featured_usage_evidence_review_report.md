# Phase 7N2I4N2 — Review Featured Usage Evidence

## Decision

```text
FEATURED_USAGE_REVIEW_ACTIONABLE_ISSUE_SELECTED
```

Review only. No runtime, catalog, bundles, source data, matrices, tests,
packages, or review artifacts were changed. Usage rows were not treated as
demand evidence or lexical validation. Son/`prix`, `fièvre`, and `poulet` were
not reopened as lexical work; `fièvre` / `poulet` miss rows were used only as
empty-state copy evidence. No lexical additions were proposed.

## 1. Evidence reviewed

| Run | Role | Bundle | Boundary |
| --- | --- | --- | --- |
| `usage_2026-07-17T23-49-49-008Z` | **Primary** | featured `bundle_full_20260710_337619ff` | `session_type: structured_usability`; `can_influence_demand: false` (summary + all 68 rows) |
| `usage_2026-07-17T23-35-12-183Z` | Secondary | same featured bundle | Same status mix; confirms primary |

Primary mix: **43** `hit_single` / **11** `hit_multi` / **14** `miss`. Phrase misses
uniformly show shipped guidance: `Try searching one word at a time.`

## 2. Findings table

| finding_id | category | evidence_source | symptom | actionability | risk | recommended_status | reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `7n2i_n2_single_word_miss_direction_hint` | A — empty-state clarity (B adjacent) | Primary single-word misses: `fièvre`, `poulet`, `bonjour` — meta `No results for "…". Check the search direction or try another form.` while `search_direction` was already `source_to_target` | Single-word empty state always urges checking search direction, even when direction is already correct; can mislead users on content misses | Product copy / empty-state only (not new lemmas) | Medium — must not become lexical fill for those terms | **recommend_next** | Meets N1 threshold (≥3 rows, same copy pattern, non-lexical); smallest product-forward follow-up after shipped phrase guidance |
| `7n2i_n2_phrase_guidance_ok` | A — empty-state clarity | 8 `phrase_mismatch` (+ related whitespace) rows | Multiword misses correctly show `Try searching one word at a time.` | None — already shipped (7N2E) | Low | `not_actionable` | Phrase empty-state working as intended on featured bundle |
| `7n2i_n2_offline_reopen_ok` | C — offline/reopen | 10 `offline_check` rows; 9/10 hits after reopen (`école`, `riz`, `manger`, `écrire`, `moto`, `eau`, `Kùn`, `travail`, `langue`) | Offline reopen keeps dictionary searchable | None for product offline reliability | Low | `not_actionable` | Featured offline reopen succeeds; `bonjour` miss is content miss, not offline loss |
| `7n2i_n2_offline_issue_class_noise` | E — harness/evidence quality | Successful offline hits still `issue_class: setup_ux` / `offline_install_reliability` (persona `expectedIssueClass`) | Reviewers may read successful offline rows as setup failures | Harness labeling clarity only | Low/medium | `monitor_only` | Expected tagging from personas; noisy but not a product runtime defect |
| `7n2i_n2_result_interpretability` | D — result-display usability | `interpretability` on `famille`, `parent`, `tante`, `kùn` | Broad/multi results flagged for owner meaning review | Owner/semantic disposition, not UI display proof | Medium if treated as UI rewrite | `defer` | Meta only proves result counts/text, not scan/layout friction; avoid sense-ranking work |
| `7n2i_n2_english_mixed_copy` | F — English/mixed-language copy | `what does kun mean`, `how do you say thank you` → same phrase miss copy | EN/mixed queries fail safely with one-word guidance | Weak beyond already-shipped phrase guidance | Medium if scoped as language expansion | `defer` | N1 requires strong evidence beyond phrase guidance; not met |
| `7n2i_n2_fievre_poulet_lexical` | A (content miss) | `fièvre`, `poulet` single-word misses | Standalone dictionary misses | Lexical / owner validation only | High if invented | `lexical_blocked` | Do not reopen; no validation data |
| `7n2i_n2_spelling_alias_signals` | D / harness persona tags | `spelling_error` / `source_aliases` on accented Maninka / informal forms | Accent/alias friction tagged by cohort | Lexical/alias policy, not this review’s product copy track | High if treated as demand | `defer` | Out of selected empty-state scope; not demand |

Exactly one `recommend_next`: **`7n2i_n2_single_word_miss_direction_hint`**.

## 3. Recommended issue

```text
SELECTED_ISSUE_ID:
7n2i_n2_single_word_miss_direction_hint

CATEGORY:
empty-state clarity (single-word miss copy)

SYMPTOM:
Featured single-word zero-result copy always says to check search direction,
even when direction is already correct (evidenced on fièvre / poulet / bonjour
rows in source_to_target).

MINIMAL_FIX_SHAPE (N3 plan only — not implemented here):
Adjust search.noMatchGuidance (EN/FR) so single-word misses do not over-blame
direction; keep phrase path (search.noPhraseMatch) unchanged; no lexicon edits.

EXPLICITLY_OUT_OF_SCOPE:
Adding fièvre / poulet / bonjour / Son entries; demand ranking; sentence
translation; direction-toggle redesign; alias matrices
```

## 4. Decision

```text
FEATURED_USAGE_REVIEW_ACTIONABLE_ISSUE_SELECTED
```

## 5. Next slice

**Phase 7N2I4N3 — Draft Minimal Fix for Selected Featured Usage Issue**

Purpose: draft the smallest EN/FR empty-state copy change for
`7n2i_n2_single_word_miss_direction_hint` without lexicon or runtime-behavior
expansion beyond message selection already used by `getNoResultMessage`.

## 6. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

N2 created only this review report. No runtime, catalog, bundles, source data,
matrices, tests, packages, or review artifacts were edited.
