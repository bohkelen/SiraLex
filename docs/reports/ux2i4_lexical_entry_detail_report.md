# UX2I4 — Lexical Entry Detail

## 1. Decision

```text
UX2I4_LEXICAL_ENTRY_DETAIL_IMPLEMENTED
```

## 2. BASE_COMMIT

```text
391fd5fd952e21c043132e179aa994fc8ca90adc
```

(Verified at slice start as `391fd5f` — UX2I3 commit “Redesign UX2 search and results”.)

## 3. Figma reference

```text
https://coach-spider-78723578.figma.site/
Contemporary West African Modernism
```

Uses UX2I1 / UX2I1A tokens only.

## 4. Lexicon entry hierarchy

Reading-surface order:

1. Back
2. Orthography (Latin + optional N’Ko)
3. POS (when present)
4. Learning Save + Suggest Correction actions
5. Variants / synonyms / etymology / literal meaning (when present)
6. Senses (authoritative order)
7. Secondary source information (`corpus_count` when present)

## 5. Latin headword

`.entry-headword` retained as `h2` with `.ux2-type-headword-large`. Remains focus target on open.

## 6. N’Ko responsive treatment

When `headword_nko_provided` exists: `lang="nqo"`, `dir="rtl"`, `.ux2-text-nko`.

- Narrow: stacked Latin then N’Ko
- Wide (`≥768px`): parallel row (Latin left / N’Ko right)

Example and subentry N’Ko use the same semantics; no Latin concatenation such as `text (ߞ…)`.

## 7. POS

Shows `pos_hint` / `ps_raw` as restrained metadata when present. No empty placeholder. Source value displayed as-is.

## 8. Senses

Editorial blocks with hairline dividers. Sense number + each available gloss on its own line. Order preserved. No collapse into a single “main translation.”

## 9. Gloss preservation

`gloss_fr`, `gloss_en`, and `gloss_ru` all render when present. No language silently dropped.

## 10. Examples

Per example: Latin, optional N’Ko, optional FR/EN/RU translations as separate lines, optional source attribution. No invented translations.

## 11. Variants/synonyms/usage/etymology/literal meaning

Labeled secondary sections only when data exists (`entry.section.*` keys).

## 12. Subentries

`text`, optional N’Ko, optional glosses as separate orthography/gloss lines. No inferred relationships.

## 13. Learning Save preservation

State machine unchanged (`loading` … `unavailable`). `#entry-learning-save` kept. Bookmark icon + visible state text; `aria-pressed` on saved-side states; ≥44×44 target.

## 14. CF1 entry affordance preservation

`#entry-suggest-correction` only when app callback provided (lexicon + eligibility). Restyled as `Suggest correction →` / FR equivalent via `entry.suggestCorrection`. Form itself unchanged.

## 15. Secondary source metadata treatment

`corpus_count` demoted into “Source information” section. No `ir_id` / `source_id` / `norm_version` on ordinary Entry Detail.

## 16. Index-mapping presentation

Source term as headword; editorial target rows with chevron; no Learning Save; no Suggest Correction; no fabricated POS/gloss.

## 17. Direct target-entry navigation

`onOpenTargetEntry` still receives exact `TargetEntry`. Application identity resolution / Back-to-results path unchanged (direct-entry E2E PASS).

## 18. Back behavior

Presentation input `backLabel`:

- Search origin → `entry.back` (“← Back to results”)
- Saved origin → `entry.backToSaved` (“← Back to saved”)

Callbacks remain owned by `main.ts`.

## 19. Mobile dedicated-entry behavior

`data-search-view="entry"` on `#ux2AppShell` when Search-origin entry (or CF1 from that entry) is open. Mobile CSS hides `#searchChrome` without clearing query/direction/results. Back restores `data-search-view="search"`.

## 20. Desktop reading-pane behavior

Entry container `max-width: var(--layout-reading-column)`. Search-origin entry coexists with Search rail at `≥768px`.

## 21. Search-state preservation

Query, direction, `lastSearchResults`, and `lastExecutedSearch` are not cleared when chrome is hidden. Shell / Entry / direct-entry E2E confirm restore without rerun.

## 22. Optional-field behavior

Unit coverage for full / minimal / mixed entries: empty N’Ko/POS/example/section shells omitted.

## 23. Pronunciation non-invention

Unit test asserts no `/…/`, IPA, or “Pronunciation” for ordinary records without such fields.

## 24. Accessibility

Semantic headword heading + focus; N’Ko lang/dir; keyboard Back/Save/Suggest/target rows; visible focus that does not crush large type; Save state text-readable.

## 25. Localization

EN/FR keys for Back-to-saved, Suggest correction CTA, and section titles. i18n tests updated.

## 26. Unit tests

```text
render_entry_ux2.test.ts — PASS
render_entry_learning.test.ts — PASS
render_entry_correction.test.ts — PASS
render_entry_target_navigation.test.ts — PASS
```

## 27. UX2 Entry E2E

```text
npm run test:e2e:ux2-entry — PASS (4/4)
```

## 28. UX2 Search E2E

```text
PASS (2/2)
```

## 29. direct-entry navigation E2E

```text
PASS (1/1)
```

## 30. LS1 regression

```text
e2e/learning/ls1_offline_saved_vocabulary.spec.ts — PASS (1/1)
```

## 31. CF1 lifecycle

```text
npm run test:e2e:corrections — PASS (7/7)
```

## 32. feedback-input regression

```text
PASS (1/1)
```

## 33. Theme E2E

```text
PASS (3/3)
```

## 34. full suite

```text
npm --prefix web run test:run
→ 9 failed | 847 passed
→ failures only in query_log_store.test.ts (known baseline)
```

## 35. build

```text
PASS
```

## 36. visual evidence path

```text
data/local_evidence/ux2_entry_detail/2026-08-05T01-22-34-589Z/
  mobile-light-lexicon-entry.png
  mobile-dark-lexicon-entry.png
  mobile-index-mapping.png
  desktop-light-lexicon-entry.png
  desktop-dark-lexicon-entry.png
  NKO_VISUAL_EVIDENCE_NOT_AVAILABLE_IN_E2E_FIXTURE.txt
```

## 37. git diff --check

```text
PASS
```

## 38. exact files changed A/M/D

See completion response / post-commit `git` listing.

## 39. exact untracked files

Pre-existing: `web/scripts/`

## 40. working-tree status

Clean for UX2I4 after commit; `web/scripts/` may remain untracked.

## 41. final decision

```text
UX2I4_LEXICAL_ENTRY_DETAIL_IMPLEMENTED
```
