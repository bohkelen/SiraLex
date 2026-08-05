# UX2I5B — Review and Reflect Experience

## 1. Decision

```text
UX2I5B_REVIEW_REFLECT_IMPLEMENTED
```

## 2. BASE_COMMIT

```text
089bdd7d11cf267c187fa6ffebee28b3a29dd39f
```

(Verified at slice start as `089bdd7` — UX2I5A commit “Redesign UX2 saved vocabulary and progress”.)

## 3. Figma reference

```text
https://coach-spider-78723578.figma.site/
Contemporary West African Modernism
```

UX2I1 / UX2I1A tokens only.

## 4. Behavioral invariants

Presentation migration only. Unchanged: queue construction/order/snapshot, eligibility, Learning Record identity/validation, reflection transaction, `review_count` / `last_reviewed` / status semantics, Reveal ephemerality, session ephemerality, Review-again, `display_cache` authority, query-log isolation, IndexedDB schema.

Architecture preserved:

```text
buildReviewQueue → createReviewSession → createReviewSurfaceHost → renderReview
```

## 5. Review direction preservation

Governed direction unchanged: live lexicon headword → recall meaning → Reveal → reflect. No “translate into Maninka” inversion for Figma fidelity.

## 6. Hidden-card hierarchy

`#review-heading` + position + large headword + optional N’Ko/POS + recall instruction + Reveal. No meanings, examples, variants, or reflection controls before Reveal.

## 7. Reveal semantics

`.review-reveal` → `onReveal()` only. Ephemeral; no IndexedDB / status / `review_count` / query-log writes.

## 8. Live dictionary authority

`extractReviewLiveDisplay(liveEntry)` only. Learning Record `display_cache` never rendered. Unit anti-regression for `CACHE-ONLY` retained/strengthened.

## 9. N’Ko semantics

Headword and example N’Ko: `lang="nqo"`, `dir="rtl"`, `.ux2-text-nko`. Omitted when absent. No Latin concatenation; no synthesis.

## 10. Revealed lexical support

`#review-meaning-heading` section with FR/EN glosses (separate lines), examples, example N’Ko/translations, variants — from `ReviewLiveDisplay` only. Sense order preserved.

## 11. Reflection action label amendment

```text
UX2_REVIEW_ACTION_LABEL_AMENDMENT: IMPLEMENTED
```

Buttons:

- EN: Not yet / Got it
- FR: Pas encore / Je l’ai

Callbacks remain `still_learning` / `remembered`. Saved status labels and completion counts still use Still learning / Remembered.

## 12. Outcome mapping

```text
.review-still-learning → onReflect("still_learning")
.review-remembered → onReflect("remembered")
```

Neutral peer hierarchy; no red=error / green=success styling. Prompt: “How did that feel?”

## 13. Busy persistence

`model.busy` → `aria-busy`, disabled outcomes, “Saving review…”, duplicate-click suppression. Persist-first advance unchanged.

## 14. Failure/retry

`reflection_failed` keeps revealed card; `#review-card-error` `role="alert"`; `aria-describedby` on outcomes; host retry coverage retained.

## 15. Card advance

Successful reflection → next item, focused headword, hidden meaning. No Reveal carry-over.

## 16. Completion

Exact model counts; skipped/unavailable only when > 0. Editorial rows; no percentage/mastery/score/streak.

## 17. Review again

`.review-again` → `host.start()` fresh deterministic session.

## 18. Back → Saved

`.review-back` → dispose host → Saved refresh → one-use Start/Continue focus when valid. Subordinate “← Back to saved” treatment.

## 19. Direct primary Review entry

Same `showReviewSurface()` / Review host as Saved Start/Continue.

## 20. Empty/unavailable/error states

- `no_saved_records`: intentional empty lead/hint; no card; no fabricated metrics
- `no_resolved_records` + `unresolved_count`
- unavailable: no stale queue
- load error: `role="alert"`

## 21. Mobile layout

Centered recall workspace, 22px shell gutter, ≥44px outcomes, document scroll, bottom-nav clearance.

## 22. Desktop layout

Focused bounded workspace (`max-width: 720px`), not a Saved-style rail. Centered orthography stack.

## 23. Focus behavior

`shouldMoveReviewFocus()` unchanged. Headword → Meaning heading → next headword → completion heading.

## 24. Accessibility

Semantic headings, article card, real buttons, N’Ko lang/dir, visible focus, busy/status/alert roles, meanings absent before Reveal, no color-only outcomes.

## 25. Localization

EN/FR for Not yet / Got it / reflection prompt / empty lead / Back / title. Established `review.stillLearning` / `review.remembered` retained for Saved/status/completion.

## 26. Explicit non-goals

No SRS, LS4, shuffle, multiple choice, mastery, audio, analytics, More/CF1/CF2 redesign.

## 27. Unit tests

```text
render_review.test.ts — PASS (17)
review_surface_host.test.ts — PASS
ls2i5_review_lifecycle_verification.test.ts — PASS
```

## 28. UX2 Review E2E

```text
npm run test:e2e:ux2-review — PASS (2/2)
```

## 29. LS2 offline

```text
PASS (5/5)
```

## 30. LS3 Progress/Return

```text
PASS (6/6)
```

## 31. UX2 Saved regression

```text
PASS (2/2)
```

## 32. Theme regression

```text
PASS (3/3)
```

## 33. Full suite

```text
848 passed; 9 query_log_store.test.ts baseline failures unchanged
```

(Corrected during UX2I6A preflight on `30ac25e`; prior report text said 847. UX2I5B decision unchanged.)

## 34. Build

```text
PASS
```

## 35. Visual evidence

```text
data/local_evidence/ux2_review/<run_id>/
```

Captured required light/dark mobile and desktop hidden/revealed/complete screenshots.

```text
NKO_REVIEW_VISUAL_EVIDENCE_NOT_AVAILABLE_IN_E2E_FIXTURE
REFLECTION_FAILURE_E2E_NOT_AVAILABLE
```

## 36. git diff --check

```text
PASS
```

## 37–40. Git / final decision

See completion response and commit for exact A/M/D list, untracked `web/scripts/`, and working-tree status.

```text
UX2I5B_REVIEW_REFLECT_IMPLEMENTED
```
