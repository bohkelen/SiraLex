# LS2 — Review and Reflect Product Definition

## 1. Decision

```text
LS2_REVIEW_AND_REFLECT_PRODUCT_DEFINED
```

LS2 answers:

> Can the user intentionally review saved vocabulary and record whether each entry is still being learned or remembered?

This document defines product behavior only. It does not modify runtime code,
tests, IndexedDB schema, UI, bundles, catalog, sources, or packages.

Authoritative priors:

- `docs/reports/learning_system_mvp_definition.md`
- `docs/reports/ls1_architecture_and_boundary_definition.md`
- `docs/reports/ls1_learning_system_closure_report.md`
- Current `LearningRecordV1` (`web/src/learning/learning_record_types.ts`)
- Current Save defaults (`status: "still_learning"`, `last_reviewed: null`,
  `review_count: 0`) and Saved Vocabulary / entry-detail behavior

### Locked LS1 foundation (unchanged)

- Learning Record identity is `(bundle_id, ir_id)`.
- Only genuine `lexicon_entry` records are saveable.
- Learning storage remains separate from dictionary and query logs.
- Live dictionary data remains lexical authority.
- Display cache remains fallback only.
- Bundle removal does not cascade-delete Learning Records.
- Re-save remains atomic, idempotent, and first-write-wins.
- LS2 must extend the existing Learning Record.
- Source queries, index mappings, and translation pairs are not LS2 learning objects.
- No cross-bundle resolution.
- No cloud sync.
- No teacher mode.

---

## 2. Product outcome

A lightweight offline review loop that lets the user revisit saved vocabulary
and record a simple reflection outcome for each entry.

LS2 is **not** spaced repetition, a full flashcard engine, or a scoring system.
It introduces no grading, streaks, levels, or achievements.

---

## 3. User loop

```text
Open Saved Vocabulary
  → Start Review
  → See one saved entry
  → Think about its meaning
  → Reveal supporting information
  → Mark Still learning or Remembered
  → Continue
  → Finish review session
```

---

## 4. Learning Record field semantics

The review object remains the existing Learning Record. LS2 activates fields
already present on `LearningRecordV1`:

```ts
status: "still_learning" | "remembered";
last_reviewed: string | null;
review_count: number;
```

Do not introduce a second personal-learning identity.
Do not create separate Review Record or Flashcard Record entities in LS2.

### `status`

The user’s most recent reflection outcome.

| Value | Meaning |
| --- | --- |
| `still_learning` | The user does not yet feel confident recalling or understanding the entry |
| `remembered` | The user currently feels able to recall or recognize the entry |

This is a **user reflection**, not an objective measurement of mastery.
Do not rename `remembered` to `mastered`.
Do not imply permanent knowledge.

### `last_reviewed`

ISO timestamp of the most recently completed reflection action.

Changes only when the user selects Still learning or Remembered.

Does **not** change when the user:

- opens an entry;
- reveals content;
- opens Review;
- leaves a session.

### `review_count`

Total number of completed reflection actions for that Learning Record.

Increment **exactly once** for each successful Still learning or Remembered
action (including same-status reflections).

Do **not** increment for:

- opening Review;
- moving between cards;
- revealing an answer;
- leaving a session;
- reopening a reviewed entry;
- failed persistence writes.

---

## 5. Never-reviewed derived state

New Save already defaults to:

```text
status: "still_learning"
last_reviewed: null
review_count: 0
```

**Product interpretation:**

> A newly saved entry begins in `still_learning`, but it has not yet been reviewed until `review_count > 0` and `last_reviewed !== null`.

Derived (not stored):

```ts
const hasBeenReviewed =
  record.review_count > 0 &&
  record.last_reviewed !== null;
```

This distinguishes:

| State | Evidence |
| --- | --- |
| Saved but never reviewed | `review_count === 0` and `last_reviewed === null` |
| Reviewed and marked still learning | `status === "still_learning"` and `hasBeenReviewed` |
| Reviewed and marked remembered | `status === "remembered"` and `hasBeenReviewed` |

Do not add a third stored `unreviewed` status.

---

## 6. Review eligibility

Each review item is one Learning Record and its corresponding Maninka lexicon
entry. Identity remains `(bundle_id, ir_id)`.

The user reviews the Maninka entry, not:

- the original source-language query;
- the index mapping;
- a translation pair;
- every gloss as separate cards.

### Resolved item

Uses live dictionary content from the active storage scope.

### Unresolved item (selected)

- Remain stored and listed in Saved Vocabulary.
- **Excluded** from the active Review queue.
- Not silently deleted.
- Not fabricated into a review card from display cache.
- When Review starts, show a concise count/notice if unresolved entries were skipped.

Reason: display cache is fallback presentation, not lexical authority. Review
must not teach from stale or incomplete data as though it were current
dictionary content.

---

## 7. Queue construction and ordering

### Eligibility

- Active logical bundle only.
- Resolved Learning Records only.
- Deterministic order.
- No algorithmic scheduling.
- No prioritization from search frequency, demand evidence, ranking, or query logs.

### Ordering (selected)

1. Never-reviewed entries first (`!hasBeenReviewed`).
2. Previously reviewed `still_learning` entries second.
3. Previously reviewed `remembered` entries last.
4. Within each group, oldest `last_reviewed` first (nulls only in group 1).
5. For never-reviewed items, oldest `created_at` first.
6. Stable identity tie-break: `bundle_id`, then `ir_id`.

### Exact comparator (conceptual)

```ts
function reviewQueueRank(a: LearningRecordV1, b: LearningRecordV1): number {
  const group = (r: LearningRecordV1) => {
    const reviewed = r.review_count > 0 && r.last_reviewed !== null;
    if (!reviewed) return 0;
    if (r.status === "still_learning") return 1;
    return 2; // remembered
  };

  const g = group(a) - group(b);
  if (g !== 0) return g;

  if (group(a) === 0) {
    const byCreated = a.created_at.localeCompare(b.created_at);
    if (byCreated !== 0) return byCreated;
  } else {
    const byReviewed = (a.last_reviewed ?? "").localeCompare(b.last_reviewed ?? "");
    if (byReviewed !== 0) return byReviewed;
  }

  const byBundle = a.bundle_id.localeCompare(b.bundle_id);
  if (byBundle !== 0) return byBundle;
  return a.ir_id.localeCompare(b.ir_id);
}
```

Do not randomize by default.

**Refinement note relative to MVP review §8:** the earlier MVP draft suggested
filtering the default pool to still-learning only. LS2 selects a single
intentional Review queue that **includes** remembered entries last so the user
can reaffirm or revise reflection without a separate mode. Saved Vocabulary
remains the collection surface; Review is the intentional practice surface.

---

## 8. Session scope

### Selected MVP session

- Review all eligible active-bundle entries.
- One item at a time.
- Snapshot the ordered queue when Review begins.
- Entries saved after session start do not appear until the next session.
- Entries removed during the session are skipped safely.
- Unresolved entries are excluded at queue build (and skipped if they become
  unresolved mid-session).
- No configurable session length in LS2.

### Ephemeral session state (not persisted)

```ts
{
  ordered_ids: Array<{ bundle_id: string; ir_id: string }>;
  current_index: number;
  completed_count: number;
  skipped_count: number;
}
```

### Reload behavior (selected)

> A page reload ends the current ephemeral review session. Completed reflection updates remain persisted, and the user can start a new session.

Do not persist session position in LS2 unless a stronger requirement appears later.

---

## 9. Review card before/after reveal

### Before reveal

Show:

- Maninka headword
- N’Ko form when available
- Part of speech when available
- Prompt asking the user to recall or think about the meaning

Hide:

- Source-language glosses
- Definitions
- Examples
- Explanatory details

Primary action: **Reveal meaning**

### After reveal

Show available **live** dictionary support:

- French gloss
- English gloss when available
- Definition when available
- Senses
- Examples when available

Then show reflection actions:

- **Still learning**
- **Remembered**

Reveal is not a score.
Still learning / Remembered are **not** available before Reveal in LS2 MVP.

Reason: requiring Reveal produces a consistent reflection sequence and prevents
accidental status changes before the user inspects the entry.

---

## 10. Reflection state transitions

Allowed transitions:

```text
still_learning → still_learning
still_learning → remembered
remembered → remembered
remembered → still_learning
```

All four are valid. A user may forget something previously marked Remembered.
Do not prohibit regression. Do not call regression a failure.

> Reflection status is the latest self-assessment, not a permanent achievement state.

Each successful transition increments `review_count`, including same-status
reflections.

---

## 11. Atomic persistence expectations

On Still learning:

```text
status = "still_learning"
last_reviewed = now
review_count = previous_review_count + 1
```

On Remembered:

```text
status = "remembered"
last_reviewed = now
review_count = previous_review_count + 1
```

Requirements:

- Update atomically against the current persisted record.
- Prevent duplicate clicks while the update is pending.
- Increment once only.
- Preserve immutable identity and original Save fields (`created_at`,
  `display_cache`, stamps, etc.).
- Do not refresh `display_cache`.
- Do not modify dictionary data or query logs.
- Do not remove the record.
- Advance to the next card only after persistence succeeds.

On persistence failure:

- Remain on the current card.
- Allow retry.
- Show a concise error.
- Do not advance.
- Do not keep optimistic increments unless rolled back safely.

---

## 12. Saved Vocabulary integration

Saved Vocabulary remains the collection-management surface.

LS2 may add:

- **Start Review** action;
- status label (Not reviewed / Still learning / Remembered);
- optional last-reviewed date;
- review count only if useful and not visually dominant.

Do not show:

- percentages;
- scores;
- per-item progress bars.

Do not make Saved Vocabulary itself the review workflow. Review is a separate
focused surface entered from Saved Vocabulary.

---

## 13. Entry-detail boundary

- Entry detail continues to show Save / Saved.
- LS2 does **not** require reflection controls on normal entry detail.
- Status may be displayed subtly when the entry is already saved.
- Formal Still learning / Remembered actions belong to the Review surface.

Reason: search and dictionary browsing remain distinct from intentional review.

Direct entry-detail reflection is a future option, not LS2 MVP.

---

## 14. Completion state

When all session items are completed or skipped, show a simple completion surface:

- Review complete;
- number reviewed;
- number marked Still learning;
- number marked Remembered;
- number skipped (unavailable/removed), when applicable.

Actions:

- Back to Saved Vocabulary;
- Review again (starts a **fresh** queue from current persisted state).

Do not add celebratory animations, streaks, points, mastery percentages, or
social sharing.

---

## 15. Empty / unavailable / error behavior

| Condition | Behavior |
| --- | --- |
| No saved entries | “Save vocabulary entries before starting a review.” |
| Saved records exist, none resolve | “No saved entries are currently available for review.” Do not delete unresolved records. |
| No active bundle | Existing active-dictionary unavailable model |
| One item becomes unavailable mid-review | Skip safely and continue |
| Learning DB failure | Concise error; no automatic database reset or corruption |

---

## 16. Navigation and stale-async model

### Host context (smallest compatible extension)

```ts
type ResultsHostContext =
  | "search"
  | "saved_vocabulary"
  | "entry_from_search"
  | "entry_from_saved"
  | "review"
  | "review_complete";
```

### Required navigation

```text
Saved Vocabulary
  → Start Review
  → Review item
  → Review complete
  → Saved Vocabulary
```

### Back from active review

Because each reflection persists immediately, normal Back may safely return to
Saved Vocabulary. Completed reflections remain saved; the ephemeral queue ends.
Require confirmation only if an unpersisted interaction would be lost (Reveal
alone does not persist; no confirmation needed for that).

Do not introduce a router. Do not rerun search.

### Stale-async

Guard late work after:

- leaving Review;
- reflecting on an item;
- opening another surface;
- bundle switch;
- database reset;
- starting a new review session;
- item removal;
- active dictionary replacement.

A late resolution or update must not redraw a newer card or completion state.
Use the existing generation/context model. Do not define a parallel navigation
framework.

---

## 17. Accessibility

- Semantic Review heading.
- One clear card at a time.
- Reveal, Still learning, and Remembered as real buttons.
- Busy state via `aria-busy`; disable duplicate actions while pending.
- Focus moves to revealed content after Reveal.
- After successful reflection, focus moves to the next card heading.
- Completion heading receives focus.
- Status communicated in text (not color alone).
- Errors associated with the current card.
- Full flow completable keyboard-only.
- No swipe-gesture requirement.

---

## 18. Localization

Minimum EN/FR concepts (exact keys deferred to implementation):

- Start review
- Review saved vocabulary
- Reveal meaning
- Still learning
- Remembered
- Not reviewed
- Last reviewed
- Review count
- Review complete
- Reviewed
- Skipped
- No entries available for review
- Review update failed
- Back to saved vocabulary
- Review again

Do not add morphology, audio, teacher, scoring, or streak strings.

---

## 19. Alternatives rejected

| Alternative | Status | Rationale |
| --- | --- | --- |
| Separate Review Record entity | Rejected for LS2 | Existing Learning Record already holds status / last_reviewed / review_count |
| Three statuses including `unreviewed` | Rejected | Never-reviewed is derivable from `review_count` and `last_reviewed` |
| Random queue | Rejected | Deterministic order is clearer and easier to test |
| Spaced-repetition scheduling | Rejected | No product evidence or requirement for SRS in LS2 |
| Review from normal entry detail | Rejected for LS2 | Browsing and intentional review stay separate |
| Review unresolved cache-only entries | Rejected | Cache is not lexical authority |
| Persist review-session position | Rejected for LS2 | Ephemeral session is sufficient; reload starts fresh |
| Allow Still learning / Remembered before Reveal | Rejected for LS2 MVP | Consistent reveal-then-reflect sequence |
| Include unresolved cards from display cache | Rejected | Same lexical-authority constraint |

---

## 20. Explicit non-goals

Do not define or implement in LS2:

- spaced repetition, Leitner boxes, SM-2;
- difficulty scoring, confidence scales;
- streaks, points, achievements, daily goals;
- reminders, notifications;
- source-language learning objects;
- translation-pair records;
- multiple vocabulary lists, favorites;
- export/import, cloud sync;
- teacher mode, classroom assignments;
- morphology, pronunciation/audio;
- example authoring, AI-generated definitions;
- ranking changes, query-log integration.

---

## 21. Success criteria

LS2 will be successful when executable evidence later proves:

1. User can start Review from Saved Vocabulary.
2. Only active-bundle resolved entries enter the queue.
3. Never-reviewed entries appear before reviewed entries.
4. User sees one item at a time.
5. Meaning is hidden before Reveal.
6. Reflection actions appear after Reveal.
7. Still learning persists correctly.
8. Remembered persists correctly.
9. `last_reviewed` updates once per successful reflection.
10. `review_count` increments once per successful reflection.
11. Same-status reflection increments count.
12. Remembered can return to Still learning.
13. Failed write does not advance.
14. Reload preserves completed reflections.
15. Leaving Review preserves completed updates.
16. Soft orphans remain stored and excluded from Review.
17. Dictionary and query-log stores remain unchanged by reflection.
18. Full flow works offline.
19. Stale async cannot overwrite a newer item.
20. Completion counts are accurate.

---

## 22. Recommended implementation slices

Do not implement in this slice.

### LS2I1 — Atomic Reflection Persistence

- **Purpose:** Persist Still learning / Remembered updates atomically on existing Learning Records.
- **Main output:** Store API for reflection updates; validation; unit/integration tests.
- **Dependencies:** LS1 persistence (`LearningRecordV1`).
- **Boundary:** No Review UI; no queue; no Saved Vocabulary chrome beyond what tests need.

### LS2I2 — Review Queue and Session Model

- **Purpose:** Build eligible ordered queues and ephemeral session state.
- **Main output:** Queue comparator, session snapshot, skip/complete counters (headless).
- **Dependencies:** LS2I1; LS1 resolve helpers.
- **Boundary:** No DOM Review surface.

### LS2I3 — Review Surface

- **Purpose:** One-card Review UI with Reveal → Reflect → advance → completion.
- **Main output:** Renderer + session wiring; a11y/i18n for Review.
- **Dependencies:** LS2I1, LS2I2.
- **Boundary:** No Saved Vocabulary status chrome beyond Start Review entry if required for demo; prefer entry from host in LS2I4 if cleaner.

### LS2I4 — Saved Vocabulary Integration

- **Purpose:** Start Review, status/never-reviewed labels, navigation into/out of Review.
- **Main output:** Collection surface affordances + host-context extension.
- **Dependencies:** LS2I3.
- **Boundary:** No SRS; no entry-detail Reflect controls.

### LS2I5 — Offline and Lifecycle Verification

- **Purpose:** Prove offline review, soft-orphan exclusion, isolation, stale-async, reload.
- **Main output:** Focused tests + optional Playwright review flow.
- **Dependencies:** LS2I1–I4.
- **Boundary:** No product expansion.

### LS2I6 — LS2 Closure

- **Purpose:** Formal closure report and handoff to LS3 Progress.
- **Main output:** Closure decision and evidence matrix.
- **Dependencies:** LS2I5 green.
- **Boundary:** Documentation-only.

---

## 23. Open issues

None blocking for product definition.

Implementation-time details deferred (not product blockers):

- Exact i18n key names and FR copy polish.
- Whether Start Review is disabled vs hidden when the queue would be empty.
- Whether mid-session “became unresolved” increments `skipped_count` separately from build-time skip notice.
- Whether optional review-count display appears on Saved Vocabulary rows in LS2I4 or is deferred to LS3 Progress.

---

## 24. Explicit product decisions checklist

1. Existing Learning Record remains the review object. **Selected.**
2. New Save defaults to `still_learning`. **Selected** (already implemented in LS1).
3. `review_count === 0` (with null `last_reviewed`) means never reviewed. **Selected.**
4. Reflection requires Reveal first. **Selected.**
5. Unresolved records are excluded from Review. **Selected.**
6. Queue is active-bundle only. **Selected.**
7. Queue is deterministic, not randomized. **Selected.**
8. Never-reviewed entries come first. **Selected.**
9. Session is ephemeral. **Selected.**
10. Reflection persists immediately. **Selected.**
11. Same-status reflection increments review count. **Selected.**
12. Remembered may transition back to Still learning. **Selected.**
13. Normal entry detail does not host LS2 reflection controls. **Selected.**
14. No spaced repetition in LS2. **Selected.**
15. No mastery score. **Selected.**

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS2_REVIEW_AND_REFLECT_PRODUCT_DEFINED` |
| Review object | Existing `LearningRecordV1` |
| Reflection outcomes | `still_learning` \| `remembered` |
| Never-reviewed | Derived from `review_count` / `last_reviewed` |
| Queue | Active-bundle, resolved-only, deterministic |
| Session | Ephemeral snapshot |
| Card flow | Reveal → Reflect |
| Next slice | `LS2I1 — Atomic Reflection Persistence` |
| Code changes | None |
