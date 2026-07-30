# LS2I3 — Review Surface Report

## Decision

```text
LS2_REVIEW_SURFACE_IMPLEMENTED
```

One-card Review UI renders the LS2I2 session model with Reveal → Reflect →
advance → complete. Persistence, queue construction, and final Saved Vocabulary
collection integration remain outside this slice.

---

## 1. Renderer API

```ts
export type ReviewRenderCallbacks = {
  onReveal(): void;
  onReflect(outcome: LearningReflectionOutcome): void;
  onBack(): void;
  onReviewAgain(): void;
};

export function renderReview(
  model: ReviewSessionModel,
  callbacks: ReviewRenderCallbacks,
): ReviewView; // { root; focusTarget }
```

Follows existing Saved Vocabulary / entry renderer conventions (returns a view;
imports `t` from i18n rather than injecting a translation function).

Files:

- `web/src/render/render_review.ts`
- `web/src/render/review_display.ts`

---

## 2. Rendered model states

| Model | UI |
|-------|-----|
| `loading` | Title + loading status |
| `unavailable` | Title + no-dictionary copy + Back |
| `empty` / `no_saved_records` | Exact empty-save copy + Back |
| `empty` / `no_resolved_records` | Exact unavailable-for-review copy + unresolved note + Back |
| `error` / `load_failed` | Load-failure alert + Back |
| `reviewing` | One card (hidden or revealed) |
| `complete` | Counts + Back + Review again |

---

## 3. Before-Reveal card

Shows: Review heading, `{current} of {total}`, live Maninka headword, N’Ko,
POS when present, recall prompt, Reveal meaning, Back.

Hides: French/English glosses, senses, examples, Still learning, Remembered.

Live entry only — never `display_cache`.

---

## 4. Revealed lexical support

`extractReviewLiveDisplay(liveEntry)` pulls headword, N’Ko, POS, glosses,
examples, and variants from the live lexicon display. No fabricated text.
Malformed optional fields are tolerated.

---

## 5. Reflection controls

Still learning / Remembered appear only after Reveal. Disabled while busy.
Click invokes `onReflect` once. Labels communicate current action, not mastery.

---

## 6. Busy behavior

Card/action group `aria-busy="true"`; Reveal and reflection buttons disabled;
concise “Saving review…” status; repeated clicks ignored in the renderer.

---

## 7. Failure behavior

`error: "reflection_failed"` → card-level alert
(“Could not save your review. Try again.” /
“Impossible d’enregistrer votre révision. Réessayez.”),
card stays revealed, buttons available for retry, no advance.

---

## 8. Completion surface

Review complete heading; reviewed / still learning / remembered counts;
skipped and unavailable-at-start only when > 0; Back; Review again.
No score, streak, mastery %, animation, or sharing.

Counts are rendered verbatim from the session model.

---

## 9. Renderer/session boundary

Renderer: presentation + callbacks only.
Session (`createReviewSession`): queue load, reveal, reflect, skip, complete.
Host: maps updates → `renderReview`, wires callbacks → session methods.

---

## 10. Minimal host wiring

`createReviewSurfaceHost` (`web/src/learning/review_surface_host.ts`) binds
session + renderer on a mount element.

`main.ts` `showReviewSurface()`:

- sets host context `"review"`;
- invalidates entry/saved-vocab generations;
- mounts into `#searchResults`;
- Back → dispose + `showSavedVocabulary()`;
- Review again → `host.start()` (fresh session).

Temporary chrome button `#startReview` (“Review” / “Réviser”) exercises the
surface until LS2I4 moves Start Review into Saved Vocabulary.

---

## 11. Navigation boundary

| Wired now | Remains for LS2I4 |
|-----------|-------------------|
| Back → Saved Vocabulary | Start Review inside Saved Vocabulary |
| Leaving Review disposes/invalidates session | Focus restore to Start Review |
| Temporary chrome Review button | Remove chrome button after collection integration |
| No search rerun on Back | Final host-context polish |

---

## 12. Focus behavior

`shouldMoveReviewFocus` + `focusTarget`:

- first reviewing card → headword;
- after Reveal → meaning heading;
- next card / complete → headword or completion heading;
- busy-only / error redraw → no focus jump.

---

## 13. Accessibility

Semantic `h2` / card `article` / meaning `h3`; real buttons; position text;
`aria-busy`; `role="status"` / `role="alert"` for loading/busy/error/complete;
`aria-describedby` on reflection failure; visible `:focus-visible`; keyboard-only.

---

## 14. Localization

EN/FR `review.*` keys added in `web/src/i18n.ts` with `{current}` / `{total}` /
`{count}` interpolation. No streak/score/mastery/SRS strings.

---

## 15. Tests

- `web/src/render/render_review.test.ts` — all surfaces, interactions, a11y,
  display-cache exclusion, FR failure copy.
- `web/src/learning/review_surface_host.test.ts` — host load/reveal/reflect/
  complete, failure retry, Review again, stale drop, unavailable Back.

---

## 16. Playwright

Deferred to LS2I5. Temporary chrome entry exists for manual exercise, but no
Playwright coverage was added in LS2I3.

---

## 17. Deviations

- Renderer signature follows repo convention (`renderReview(model, callbacks)`
  returning `{ root, focusTarget }`) rather than injecting `host` + `t`.
- Temporary `#startReview` chrome button for a coherent manual path; LS2I4
  owns final Saved Vocabulary Start Review.

---

## 18. Repository hygiene

Unrelated featured-anchor work left uncommitted:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

LS2I3 stages only Review surface files listed in this report plus i18n/CSS/main
wiring and tests.
