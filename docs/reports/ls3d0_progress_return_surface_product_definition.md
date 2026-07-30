# LS3D0 — Progress & Return Surface Product Definition

## 1. Decision

```text
LS3_PROGRESS_RETURN_PRODUCT_DEFINED
```

This slice is documentation-only. No runtime code, tests, IndexedDB schema, UI,
CSS, i18n, Playwright, bundles, catalog, source data, or packages were modified.

Authoritative inputs:

- `docs/reports/lsn0_learning_system_next_phase_decision.md`
- `docs/reports/ls2_review_and_reflect_closure_report.md`
- `docs/reports/ls1_learning_system_closure_report.md`
- current Learning Record schema (`learning_record_v1`)
- current Saved Vocabulary session / row VM model
- current Review queue / session behavior
- current EN/FR terminology in `web/src/i18n.ts`

---

## 2. Product outcome

LS3 is:

> A lightweight orientation surface that summarizes the current active-bundle
> vocabulary collection and directs the user toward the next useful action.

Product question:

> Can the user quickly understand the current state of their saved vocabulary
> and know the most useful next action without introducing scheduling, scoring,
> or misleading claims of mastery?

LS3 is **not**:

- analytics;
- a performance dashboard;
- a habit or streak system;
- a due/scheduling surface;
- a new learning identity or source of truth.

---

## 3. User loop

```text
Open Saved Vocabulary
  → See current collection state
  → Understand what has not been reviewed
  → Understand what is still being learned
  → Understand what is currently remembered
  → See unavailable entries separately
  → Start or continue Review
```

---

## 4. Architectural boundary

Locked:

| Constraint | Rule |
| --- | --- |
| Derivation | Progress is derived from existing Learning Records |
| Authority | Progress is not a new source of truth |
| Identity | No new Learning identity |
| Storage | No new IndexedDB store |
| Fields | No new IndexedDB field |
| History | No immutable Review Event |
| Scheduling | No due-state model, scheduling, or SRS |
| Scope | Active-bundle only; no cross-bundle aggregation |
| Eligibility | Only genuine saved `lexicon_entry` Learning Records contribute |
| Soft orphans | Unresolved rows remain stored and may be counted separately |
| Lexical authority | Live dictionary data remains lexical authority |
| Language | `remembered` must not be presented as mastered |
| Meaning of counts | Current collection state, not long-term retention |

---

## 5. Exact metrics

All metrics use existing Learning Records only.

Required metrics:

```text
total_saved
not_reviewed
still_learning
remembered
unavailable
reviewable
```

### `total_saved`

Count of all active-bundle Learning Records.

Includes:

- resolved records;
- unresolved records;
- consistent and inconsistent review-field rows.

### `not_reviewed`

Count of Learning Records with consistent never-reviewed fields:

```text
review_count === 0
last_reviewed === null
```

Do **not** derive from `status`.

Includes both resolved and unresolved rows that match this field pair.

### `still_learning`

Count of consistent reviewed Learning Records where:

```text
review_count > 0
last_reviewed !== null
status === "still_learning"
```

Includes resolved and unresolved rows that match.

### `remembered`

Count of consistent reviewed Learning Records where:

```text
review_count > 0
last_reviewed !== null
status === "remembered"
```

Includes resolved and unresolved rows that match.

### `unavailable`

Count of Learning Records that cannot currently resolve to a live active-bundle
`lexicon_entry`.

An unavailable record may still have a valid review status.
Do **not** treat unavailable as a fourth learning status.

### `reviewable`

Count of currently resolved Learning Records eligible for Review.

Locked derivation:

```text
reviewable = resolved rows that satisfy LS2 Review eligibility
```

Eligibility aligned with `buildReviewQueue`:

- consistent review fields;
- resolved to live `lexicon_entry`;
- usable lexicon display;
- identity match.

Do **not** derive:

```text
reviewable = total_saved - unavailable
```

Malformed or inconsistent rows must not be silently included.

### Internal diagnostic metric

```text
unknown_state_count
```

Count of rows with inconsistent or otherwise non-classifiable review fields.

**Decision:** internal-only. Not part of the public Progress view model. Not
displayed in LS3 MVP. Storage is not repaired.

---

## 6. Review-field consistency

Reuse LS2 helpers (`hasConsistentReviewFields`,
`hasLearningRecordBeenReviewed`, and Saved Vocabulary
`deriveSavedVocabularyReviewStatus`).

### Consistent — never reviewed

```text
review_count === 0
last_reviewed === null
```

### Consistent — reviewed

```text
review_count > 0
last_reviewed !== null
```

### Inconsistent examples

```text
review_count === 0 && last_reviewed !== null
review_count > 0 && last_reviewed === null
```

### Selected behavior

| Bucket | Inconsistent rows |
| --- | --- |
| `not_reviewed` / `still_learning` / `remembered` | Excluded |
| `total_saved` | Included |
| `unavailable` | Included only when resolution also fails |
| `reviewable` | Excluded |
| Public UI | No unknown count |
| Storage | Do not repair |

---

## 7. Status versus availability dimensions

> **Learning status** and **dictionary availability** are separate dimensions.

Learning-status dimension (mutually exclusive for consistent rows):

```text
not_reviewed | still_learning | remembered
```

Availability dimension (orthogonal):

```text
available (resolved) | unavailable (unresolved)
```

Possible combinations:

```text
Remembered + unavailable
Still learning + unavailable
Not reviewed + unavailable
Remembered + available
Still learning + available
Not reviewed + available
```

All are valid product states.

---

## 8. Metric invariants

For consistent rows:

```text
not_reviewed + still_learning + remembered
  = count of Learning Records with consistent review fields
```

Do **not** claim:

```text
total_saved =
  not_reviewed + still_learning + remembered + unavailable
```

Unavailable overlaps learning status and must not be treated as a residual
bucket that completes a partition of `total_saved`.

Also:

```text
reviewable ≤ total_saved - unavailable
```

Equality is not guaranteed because inconsistent or otherwise ineligible
resolved rows may exist.

```text
0 ≤ unknown_state_count
```

and:

```text
not_reviewed + still_learning + remembered + unknown_state_count
  = total_saved
```

for rows classified solely by review-field consistency (independent of
availability).

---

## 9. Surface placement

Selected MVP placement:

```text
Saved Vocabulary
```

Layout order:

```text
Back
Saved Vocabulary heading
Progress & Return summary
Start / Continue Review action (+ return cue / hints)
Vocabulary list
```

Specifically:

- below the Saved Vocabulary heading;
- above Start / Continue Review;
- above the vocabulary list.

Rejected for LS3 MVP:

- global Learning dashboard;
- new top-level application tab;
- Progress on normal entry detail;
- Progress on search results.

Reason:

> Saved Vocabulary already owns collection management and Review entry.
> Progress belongs at the boundary where the user decides what to do next.

---

## 10. Summary presentation

Selected pattern:

> Use a compact semantic summary list, not visual statistic cards.

Recommended structure:

```text
Saved vocabulary

Saved: 12
Not reviewed: 3
Still learning: 5
Remembered: 4
Unavailable: 1

Review new saved words

[Continue review]
```

Rules:

- no charts;
- no percentages;
- no rings, gauges, completion bars, or mastery meters;
- no statistic-card chrome that implies gamification.

Reason:

- lower visual weight;
- avoids gamification;
- easier accessibility;
- clearer on narrow screens.

`Unavailable` appears only when `unavailable > 0`.

---

## 11. Start versus Continue Review

LS2 sessions are ephemeral and do not persist across reload.

Therefore `Continue review` must **not** imply resuming a saved session.

### `Continue review` meaning

> Start a fresh deterministic Review session when the collection already
> contains reviewed vocabulary and still has reviewable entries.

### Label rule

#### `Start review`

Use when:

```text
reviewable > 0
and
still_learning === 0
and
remembered === 0
```

This generally means no entry has yet been reviewed (consistent reviewed
buckets are empty).

#### `Continue review`

Use when:

```text
reviewable > 0
and
(still_learning > 0 or remembered > 0)
```

This means prior completed reflections exist in the collection.

### Behavior

Action behavior is identical for both labels:

```text
build a fresh current Review queue
```

Only the label changes.

Do not:

- base the label on an unfinished prior session;
- store a session-resume flag;
- change LS2 queue construction.

Current LS2 Saved Vocabulary always uses Start-review copy. LS3 introduces the
Continue label as presentation only.

---

## 12. Return cue

LS3 may provide one concise cue describing what comes next.

Cue is based on current deterministic queue priority, not scheduling.

### Hierarchy

1. If `not_reviewed > 0` → `review_new`  
   EN: `Review new saved words`  
   FR: `Réviser les nouveaux mots enregistrés`

2. Else if `still_learning > 0` → `review_still_learning`  
   EN: `Review words you are still learning`  
   FR: `Réviser les mots encore en apprentissage`

3. Else if `remembered > 0` → `review_again`  
   EN: `Review saved vocabulary again`  
   FR: `Réviser à nouveau le vocabulaire enregistré`

4. Else if `reviewable === 0 && unavailable > 0` → no separate cue beyond the
   no-reviewable explanation already required for the disabled action.

5. Else → `none`

### Visibility

Show the return cue only when meaningful:

- show for cases 1–3 when `reviewable > 0`;
- do not invent filler cues;
- do not mention today, due, overdue, recommended interval, streak, or goal.

The cue reflects deterministic queue-group priority only and must not construct
a different priority system.

---

## 13. Action availability

### Reviewable entries exist (`reviewable > 0`)

Show enabled:

```text
Start review
```

or:

```text
Continue review
```

per §11.

### Saved records exist but none are reviewable

Show disabled Review action plus:

```text
No saved entries are currently available for review.
```

FR (existing):

```text
Aucune entrée enregistrée n’est actuellement disponible pour la révision.
```

Reuse current LS2 unresolved / no-resolved behavior.

### No saved records

Do not show Progress counts as six zeros.

Show the existing empty state:

```text
No saved words yet. Search and open an entry to save one.
```

FR (existing):

```text
Aucun mot enregistré. Cherchez un mot et enregistrez-le.
```

No Review action. No empty analytics panel.

### Loading

Show Saved Vocabulary heading and concise loading text. No provisional counts.
Disabled Review control only if existing loading UI already renders it.

### Error

Do not fabricate zero counts. Show the existing collection load error.

### Removing

Summary remains visible during removal. Review action is disabled while a
removal is in progress (matches current Saved Vocabulary removing behavior).

---

## 14. Unavailable presentation

Show unavailable only when:

```text
unavailable > 0
```

Wording:

```text
Unavailable: {count}
Indisponibles : {count}
```

One concise explanation (when the unavailable row is shown):

```text
These saved entries are not available in the current dictionary.
Ces entrées enregistrées ne sont pas disponibles dans le dictionnaire actuel.
```

Do not:

- imply deletion;
- imply corruption;
- call them failed words;
- include them in Review action eligibility.

Per-row unresolved badge remains as today
(`Unavailable in this dictionary` /
`Indisponible dans ce dictionnaire`).

---

## 15. Per-row versus collection-level roles

Preserve current per-row display:

- Not reviewed / Still learning / Remembered;
- last-reviewed date for reviewed rows;
- unresolved badge when applicable.

LS3 adds collection-level counts.

Do not:

- remove per-row status;
- show per-row review count;
- show per-row progress bars;
- add a per-row Continue action.

Roles:

| Layer | Role |
| --- | --- |
| Summary | Orientation |
| Rows | Item-level state |

---

## 16. Rejected collection-level metrics

| Metric / cue | Decision |
| --- | --- |
| Collection-level `max(last_reviewed)` | Rejected for LS3 MVP |
| `sum(review_count)` | Rejected for LS3 MVP |
| Percentages / completion ratios | Rejected |
| Charts / trends | Rejected |
| Due / overdue | Rejected |

Reasons:

- no Review Session record exists;
- `max(last_reviewed)` could imply persisted session history;
- total review count encourages performance interpretation and may reflect
  difficulty rather than success;
- `review_count` remains an input to status derivation only.

---

## 17. Truthfulness boundary

Locked statements:

- Saved count means records currently saved.
- Not reviewed means no completed reflection has been recorded.
- Still learning means the latest self-assessment was Still learning.
- Remembered means the latest self-assessment was Remembered.
- Unavailable means the saved record cannot currently resolve in the active
  dictionary.
- None of these proves mastery, retention, accuracy, or long-term learning.
- Counts may move backward.
- Remembered may become Still learning.
- Dictionary updates may change unavailable counts.
- Bundle switching changes the entire active-bundle summary.

> **Progress here means orientation through the current collection, not
> measured cognitive achievement.**

Forbidden language:

- Mastered;
- Completed vocabulary;
- Success rate;
- Accuracy;
- Retention;
- Progress percentage;
- Due;
- Overdue.

`Remembered` is the latest self-assessment. Do not add explanatory copy to
every summary row; keep clarification concise (product definition / a11y
context is enough).

---

## 18. Active-bundle behavior

Progress is active-bundle scoped.

On bundle switch:

- invalidate the old summary;
- load Learning Records for the new active bundle;
- recompute all counts;
- do not aggregate across bundles;
- do not preserve old summary on screen;
- do not compare bundles.

If no active bundle:

- use the existing Saved Vocabulary unavailable state;
- do not show stale counts.

---

## 19. Refresh behavior

Counts must refresh after:

- Save;
- Remove;
- successful reflection;
- returning from Review;
- bundle switch;
- bundle removal;
- bundle reinstall/update;
- database deletion;
- reopening Saved Vocabulary.

Counts need not update live while Saved Vocabulary is not visible.

Do not add:

- background polling;
- reactive cross-tab synchronization in LS3 MVP.

Saved Vocabulary reload remains the source of truth for the visible summary.

---

## 20. Computation ownership

Selected architecture:

```text
Saved Vocabulary session/controller
  → derives summary from row VMs
  → renderer presents summary
```

The renderer must not:

- access IndexedDB;
- resolve dictionary entries;
- calculate status consistency;
- construct Review queues.

Derivation source:

```text
SavedVocabularyRowVm[]
```

because the session already owns Learning Record, resolution state, and
review-status derivation.

Derive summary after all rows are built.

Requirements:

- one pass over rows;
- no second database load;
- no second dictionary resolution pass;
- no Review queue construction solely for Progress;
- no writes.

The actual Review session remains authoritative when Review starts.

Note on current `canStartReview`:

Today Saved Vocabulary sets `canStartReview` from any resolved row. LS3
`reviewable` is stricter (resolved + Review-eligible / consistent).
Implementation must drive Start/Continue enablement from `reviewable`, not
from a looser resolved-only count.

---

## 21. View model

Presentation-ready model (exact names may differ in code):

```ts
type SavedVocabularyProgressVm = {
  total_saved: number;
  not_reviewed: number;
  still_learning: number;
  remembered: number;
  unavailable: number;
  reviewable: number;
  reviewAction:
    | { state: "enabled"; label: "start" | "continue" }
    | { state: "disabled"; reason: "no_reviewable_entries" }
    | { state: "hidden"; reason: "empty_collection" };
  returnCue:
    | "review_new"
    | "review_still_learning"
    | "review_again"
    | "none";
  showUnavailable: boolean;
};
```

Rules:

- attach Progress VM only on populated / removing surfaces;
- omit Progress VM on empty / loading / unavailable / error;
- `showUnavailable === (unavailable > 0)`;
- renderer consumes the VM; it does not recompute counts.

`unknown_state_count` remains internal to the deriver / diagnostics, not on
this public VM.

---

## 22. Accessibility

Requirements:

- semantic Saved Vocabulary heading remains primary;
- summary uses `<dl>` or equivalent semantic label/value structure;
- count labels are explicit text;
- no information conveyed by colour alone;
- Review action is a real button;
- disabled action has explanatory text (`aria-describedby` or equivalent);
- summary does not announce every count repeatedly on rerender;
- focus restoration from Review remains on Start/Continue Review;
- keyboard-only access;
- screen readers hear label and count together;
- singular/plural phrasing where supported by existing interpolation;
- no charts requiring visual interpretation.

---

## 23. Localization

### Required English labels

```text
Saved
Not reviewed
Still learning
Remembered
Unavailable
Start review
Continue review
Review vocabulary
Review new saved words
Review words you are still learning
Review saved vocabulary again
These saved entries are not available in the current dictionary
No saved entries are currently available for review
```

### Required French labels

```text
Enregistrés
Pas encore révisés
Encore en apprentissage
Mémorisés
Indisponibles
Commencer la révision
Continuer la révision
Réviser le vocabulaire
Réviser les nouveaux mots enregistrés
Réviser les mots encore en apprentissage
Réviser à nouveau le vocabulaire enregistré
Ces entrées enregistrées ne sont pas disponibles dans le dictionnaire actuel
Aucune entrée enregistrée n’est actuellement disponible pour la révision
```

### Pluralization strategy

Recommended MVP:

- use the current interpolation system;
- permit neutral count phrases;
- do not add a new pluralization framework solely for LS3.

Example:

```text
Saved: {count}
Enregistrés : {count}
```

### Relation to existing keys

Existing per-row / Review keys remain for item-level and Review surfaces
(e.g. `review.notReviewed` = “Not reviewed” / “Pas encore révisé”).
Collection-level Progress may introduce dedicated `progress.*` keys so
plural collection wording does not overwrite singular per-row labels.

EN/FR parity is required for all Progress-facing strings.

---

## 24. Empty / loading / unavailable / error states

### Loading

- Saved Vocabulary heading;
- loading text (`Loading saved vocabulary…` /
  `Chargement du vocabulaire…`);
- no provisional counts;
- disabled Review action only if existing loading UI already renders it.

### Empty

- no summary;
- no Review action;
- existing save-guidance copy.

### Populated with reviewable rows

- summary;
- enabled Start or Continue Review;
- return cue when meaningful;
- row list.

### Populated with unresolved-only / non-reviewable rows

- summary:
  - total saved;
  - unavailable (if > 0);
  - valid review-status counts where applicable;
- disabled Review action;
- no-reviewable explanation;
- row list remains.

### No active bundle (unavailable)

- active dictionary unavailable state;
- no stale summary.

### Error

- collection load error;
- no fabricated summary.

### Removing

- summary remains visible;
- Review action disabled;
- row list remains with busy state on the row being removed.

---

## 25. Success criteria

LS3 succeeds when executable evidence later proves:

1. summary appears only for populated Saved Vocabulary;
2. `total_saved` counts all active-bundle records;
3. not-reviewed derives from count/timestamp, not status;
4. Still learning derives correctly;
5. Remembered derives correctly;
6. unavailable is orthogonal to learning status;
7. reviewable counts resolved eligible rows only;
8. malformed review fields do not corrupt counts;
9. Start Review appears for never-reviewed collections;
10. Continue Review appears after completed reflections exist;
11. both actions create a fresh LS2 Review session;
12. return cue follows existing queue-group priority;
13. unresolved-only collection cannot start Review;
14. summary refreshes after reflection;
15. summary refreshes after removal;
16. summary refreshes after bundle switch;
17. no cross-bundle aggregation;
18. no review count, percentage, score, streak, due date, or mastery language
    appears;
19. renderer performs no persistence or resolution;
20. dictionary and query-log stores remain unchanged;
21. full surface works offline;
22. EN/FR parity;
23. keyboard and screen-reader semantics work;
24. LS1/LS2 behavior remains unchanged.

---

## 26. Product decisions

1. Progress lives in Saved Vocabulary.
2. Summary is shown only when the collection is populated.
3. Summary uses a semantic compact list.
4. Metrics are `total_saved`, `not_reviewed`, `still_learning`, `remembered`,
   `unavailable`, `reviewable`.
5. Availability and learning status are orthogonal.
6. Unknown/inconsistent status is internal-only.
7. No collection-level last-reviewed timestamp.
8. No total review count.
9. No percentage.
10. No chart.
11. No mastery language.
12. Start Review means no prior reviewed entries (consistent reviewed buckets
    empty) while reviewable entries exist.
13. Continue Review means prior reflections exist, not session resume.
14. Start and Continue launch the same fresh LS2 session behavior.
15. Return cue follows existing queue group order and appears only when
    meaningful.
16. Active-bundle only.
17. Summary derives from Saved Vocabulary row VMs.
18. No second database or resolution pass.
19. No polling.
20. No telemetry.
21. Hide unavailable when zero.
22. Summary remains visible during removal; Review action disabled during
    removal.
23. Review enablement uses `reviewable`, not looser resolved-only counting.

Decision label:

```text
LS3_PROGRESS_RETURN_PRODUCT_DEFINED
```

---

## 27. Alternatives rejected

| Alternative | Why rejected for LS3 MVP |
| --- | --- |
| Global Learning dashboard | New navigation surface without evidence |
| Percentage complete | No valid denominator represents vocabulary mastery |
| Remembered percentage | Remembered is reversible self-assessment |
| Total review count | Repetition volume is not progress |
| Collection-level last-reviewed time | No Review Session history; limited value |
| Resume unfinished Review | LS2 sessions are intentionally ephemeral |
| Due / overdue cues | Scheduling is not selected |
| Charts and trends | No event history exists |
| Cross-bundle totals | Learning remains active-bundle scoped |
| Progress persistence | All metrics are derived |

---

## 28. Explicit non-goals

Do not define or implement in LS3:

- due dates;
- scheduling;
- SRS;
- Review Events;
- history;
- analytics;
- telemetry;
- charts;
- trends;
- percentages;
- mastery score;
- streaks;
- goals;
- reminders;
- notifications;
- total review count display;
- session resume;
- persistent Review sessions;
- global dashboard;
- cross-bundle aggregation;
- source-language Learning Records;
- translation-pair records;
- lists or tags;
- export/import;
- cloud sync;
- morphology;
- audio;
- corpus changes;
- schema migration;
- new IndexedDB fields or stores.

---

## 29. Recommended implementation slices

### LS3I1 — Derived Progress Model

- **Purpose:** Pure derivation of Progress counts and action/cue decisions from
  `SavedVocabularyRowVm[]`.
- **Main output:** Progress deriver + unit tests for metrics, orthogonality,
  consistency, Start/Continue rules, return-cue hierarchy.
- **Dependencies:** LS3D0; existing Saved Vocabulary row VM / LS2 consistency
  helpers.
- **Boundary:** No UI, i18n, IndexedDB writes, or Review queue construction.

### LS3I2 — Saved Vocabulary Progress Surface

- **Purpose:** Present the Progress summary on Saved Vocabulary.
- **Main output:** Renderer support for Progress VM; EN/FR Progress strings;
  semantic summary list.
- **Dependencies:** LS3I1.
- **Boundary:** Presentation only; no persistence/resolution; no charts or
  mastery language.

### LS3I3 — Return Action and Navigation Integration

- **Purpose:** Wire Start/Continue labeling, return cue, focus restoration, and
  host refresh after Save/Remove/Review/bundle events.
- **Main output:** Host/session integration proving action identity with LS2
  fresh-session behavior.
- **Dependencies:** LS3I1, LS3I2, existing LS2 Review host.
- **Boundary:** No session resume; no scheduling; no second resolution pass.

### LS3I4 — Offline and Lifecycle Verification

- **Purpose:** Prove offline Progress, refresh after reflection/removal/bundle
  lifecycle, isolation from dictionary/query-log stores.
- **Main output:** Focused tests + Playwright coverage as appropriate.
- **Dependencies:** LS3I1–I3.
- **Boundary:** Verification only; no feature expansion.

### LS3I5 — LS3 Closure

- **Purpose:** Documentation-only closure against success criteria.
- **Main output:** Closure report and canonical status.
- **Dependencies:** LS3I1–I4 executable evidence.
- **Boundary:** No runtime change.

---

## 30. Open issues

Resolved in this definition:

| Issue | Decision |
| --- | --- |
| Unavailable when zero | Hide |
| Continue Review wording | `Continue review` / `Continuer la révision` |
| Return cue visibility | Only when meaningful (`reviewable > 0` and cases 1–3) |
| Unknown/inconsistent handling | Internal-only; exclude from public status buckets |
| Singular/plural strategy | Neutral count interpolation; dedicated Progress keys |
| Summary during removal | Remains visible |
| Review action during removal | Disabled |

Remaining for implementation detail (non-blocking):

1. Exact CSS class names / DOM ids for the summary region.
2. Whether unavailable explanation is always visible with the unavailable count
   or disclosed once near the Review hint when unresolved-only.
3. Exact key names under `progress.*` vs reuse of selected `review.*` strings
   where wording already matches.
4. Whether loading continues to show a disabled Start control (preserve current
   LS2 loading chrome unless LS3I2 finds a clearer empty loading state).

---

## Repository hygiene

This slice stages only:

```text
docs/reports/ls3d0_progress_return_surface_product_definition.md
```

Unrelated featured-anchor work must remain unstaged.

Canonical status:

```text
LSN0 — Selected: LS3 Progress & Return Surface
LS3D0 — Progress & Return Surface Product Definition — Defined
LS3I1 — Derived Progress Model — Next
```

`docs/ROADMAP.md` has no Learning System status index requiring update.

---

## Documentation-only confirmation

This slice changes only documentation (this report). No runtime code, UI,
IndexedDB schema, tests, Playwright, fixtures, bundles, catalog, sources,
packages, CSS, or i18n were modified.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS3_PROGRESS_RETURN_PRODUCT_DEFINED` |
| Product | Truthful active-bundle orientation on Saved Vocabulary |
| Metrics | `total_saved`, `not_reviewed`, `still_learning`, `remembered`, `unavailable`, `reviewable` |
| Placement | Saved Vocabulary, below heading, above Review action |
| Next slice | `LS3I1 — Derived Progress Model` |
| Code changes | None |
