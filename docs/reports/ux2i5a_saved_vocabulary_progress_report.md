# UX2I5A — Saved Vocabulary and Progress

## 1. Decision

```text
UX2I5A_SAVED_VOCABULARY_PROGRESS_IMPLEMENTED
```

```text
REVIEW_VISUAL_MIGRATION_DEFERRED_TO_UX2I5B
```

## 2. BASE_COMMIT

```text
3cd75412273d1db7f22387347428fd3999d8ab2e
```

(Verified at slice start as `3cd7541` — UX2I4 commit “Redesign UX2 lexical entry detail”.)

## 3. Figma reference

```text
https://coach-spider-78723578.figma.site/
Contemporary West African Modernism
```

Uses established UX2I1 / UX2I1A tokens only. No new Learning visual language.

## 4. Top-level Saved navigation amendment

```text
UX2_SAVED_TOP_LEVEL_NAVIGATION_AMENDMENT: IMPLEMENTED
```

Saved Vocabulary is a primary destination (`Search | Saved | Review | More`). Ordinary Saved no longer renders a permanent `← Back to search` control. Users leave via primary navigation.

Empty-state contextual action uses explicit `onSearch()` → Search (not a Back control). Presentation API renamed from misleading `onBack`.

## 5. Legacy duplicate Saved entry

```text
NOT_PRESENT
```

`#openSavedVocabulary` remains the **primary-nav** Saved control id (UX2I2 compat), not a separate chrome duplicate. LS1 E2E now uses `[data-testid="ux2-nav-saved"]` / `navigateUx2Primary(..., "saved")`.

## 6. Page hierarchy

```text
Saved vocabulary (#saved-vocab-heading)
Vocabulary overview (Progress dl)
return cue
Start / Continue Review
saved lexical rows
```

Typography, spacing, hairline row dividers, and subtle surface treatment — not nested cards.

## 7. Progress truthfulness

Renderer still consumes `model.progress` only. Metrics unchanged:

- Saved / Not reviewed / Still learning / Remembered
- Unavailable only when `showUnavailable === true`

No mastery, percentages, streaks, due/overdue, charts, stacked bars, or progressbars. Forbidden-signal unit coverage retained.

## 8. Progress visual migration

Semantic `<section>` + `<h3>` + `<dl>/<dt>/<dd>` preserved. Editorial label/value rows (not dashboard stat cards).

## 9. Start / Continue Review

Driven only by `progress.reviewAction`. Continue still means a fresh deterministic Review session (not resume). Review CTA uses accessible outline styling with `--color-action-text` / `--color-accent` border (not unverified filled terracotta+white).

## 10. Return cues

Unchanged model values (`review_new` / `review_still_learning` / `review_again` / `none`). Ordinary informational `<p>` — no `role=alert` / `aria-live` / badges.

## 11. Resolved rows

Editorial row: serif headword, optional N’Ko, gloss, textual review status; last-reviewed + Remove in footer. Lexical open control is a real `<button class="saved-vocab-open">` (sibling of Remove — no nested buttons). Opens existing `onOpen` → UX2I4 Entry Detail.

## 12. Unresolved / soft-orphan rows

Cached presentation only; “Unavailable in this dictionary”; no Open; Remove retained. Subdued, legible.

## 13. N’Ko semantics

When `row.nkoText` exists: `lang="nqo"`, `dir="rtl"`, `.ux2-text-nko`. No empty N’Ko block; no Latin synthesis.

## 14. Review statuses / last reviewed

Textual Not reviewed / Still learning / Remembered preserved. Last-reviewed only when VM supplies a valid value via existing `formatReviewTimestamp`.

## 15. Empty / loading / unavailable / error

- Empty: intentional copy + Search CTA; no zero Progress; no disabled Start Review
- Loading: heading + status; no fabricated Progress; no Start Review
- Unavailable: no stale counts; clear active-dictionary copy
- Error: `role="alert"`; no IndexedDB/stack details

## 16. Remove lifecycle

Busy row disables Open/Remove and Review action; Progress remains; no optimistic count mutation. Row-scoped remove error via `aria-describedby`.

## 17. Navigation contracts

- Saved → resolved row → Entry → Back to saved → collection restore (no Search rerun)
- Saved → Start/Continue → existing LS2 Review host (legacy Review chrome acceptable)
- Review → Back → Saved with one-use focus on Start/Continue preserved
- Primary Review nav unchanged

## 18. Mobile / desktop layout

- Mobile: single column, 22px gutter via shell, document scroll, bottom-nav clearance
- Desktop (`≥768px`): Saved-specific rail (context) + collection pane; not a global new shell

## 19. Accessibility

`#saved-vocab-heading`; semantic list; real buttons; ≥44×44 targets; N’Ko lang/dir; visible focus; textual status; Progress `dl`; no color-only status; no aria progressbar / live Progress.

## 20. Localization

EN/FR parity for empty lead/hint, Search CTA, open entry aria-label. Established Learning labels preserved.

## 21. Tests

Unit: `render_saved_vocabulary.test.ts` updated for UX2I5A contracts.

E2E: `web/e2e/ux2_saved_vocabulary.spec.ts` + `npm run test:e2e:ux2-saved`.

LS1 offline updated for primary nav + empty-lead selector.

LS2/LS3: install helper uses `openMoreAnd`; save helper uses `ensureTargetToSource` (UX2 icon-only swap broke legacy toggle-text direction detection). Behavioral assertions unchanged.

## 22. Visual evidence

Ignored local screenshots under:

```text
data/local_evidence/ux2_saved_vocabulary/<run_id>/
```

Captured:

- mobile-light-saved-populated.png
- mobile-dark-saved-populated.png
- mobile-light-saved-empty.png
- desktop-light-saved-populated.png
- desktop-dark-saved-populated.png

```text
UNRESOLVED_VISUAL_EVIDENCE_NOT_AVAILABLE_IN_E2E_FIXTURE
```

Unresolved presentation covered by renderer unit tests.

## 23. Scope exclusions honored

Review card/Reveal/reflection/completion UI not redesigned. More/Settings, CF1/CF2, Dictionary manager, Learning Backup, Diagnostics, filters/SRS/mastery/etc. not added.

## 24. Exact Git changes

See commit file list. Pre-existing untracked: `web/scripts/`.
