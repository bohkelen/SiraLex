# LS4D0 — Guided Review Sessions Product Definition

## 1. Decision

```text
LS4_GUIDED_REVIEW_PRODUCT_DEFINED
```

This slice is documentation-only. No runtime code, tests, IndexedDB schema, UI,
CSS, i18n, Playwright, bundles, catalog, source data, or packages were modified.

Authoritative inputs:

- `docs/reports/lsn1_learning_system_post_ls3_decision.md`
- `docs/reports/ls3_progress_return_closure_report.md`
- `docs/reports/ls2_review_and_reflect_closure_report.md`
- current `SavedVocabularyProgressVm`
- current LS2 queue construction and ordering (`review_queue.ts`)
- current Review session / host model
- current Saved Vocabulary Progress surface
- current EN/FR terminology in `web/src/i18n.ts`
- current offline and host-navigation guarantees

The proposed product does **not**:

- introduce due-state or scheduling;
- persist session-choice state;
- create a new Learning identity;
- make unresolved/display-cache rows reviewable;
- present Remembered as mastered;
- fragment Review into conflicting entry points;
- require a schema migration for the MVP.

---

## 2. Product outcome

LS4 is:

> A user-selected filter over the existing active-bundle LS2 Review queue that
> creates one fresh, deterministic, ephemeral session from an existing
> review-status group.

Product question:

> How can a user choose a meaningful subset of current saved vocabulary to
> review in one fresh offline session without introducing scheduling,
> persistent session preferences, new identities, or misleading mastery
> semantics?

LS4 is **not**:

- scheduling;
- SRS;
- a due queue;
- a saved study plan;
- a persistent session;
- a separate collection;
- a new learning-object type.

---

## 3. User loop

```text
Open Saved Vocabulary
  → See Progress
  → Choose Review scope
  → Start fresh guided session
  → Recall
  → Reveal
  → Reflect
  → Complete or leave
  → Return
  → Progress refreshes
```

Default path without changing the chooser remains:

```text
Open Saved Vocabulary
  → See Progress
  → Start or Continue Review (All reviewable)
  → … existing LS2/LS3 loop
```

---

## 4. Architectural boundary

| Constraint | Rule |
| --- | --- |
| Identity | Learning Record identity remains `(bundle_id, ir_id)` |
| Eligibility | Same LS2 helper: `isResolvedLexiconReviewEligible` |
| Queue source | One canonical `buildReviewQueue` result; filter afterward |
| Ordering | Preserve LS2 group order and tie-breaks inside the filter |
| Persistence | No IndexedDB / localStorage for guided choice |
| Progress | LS3 Progress metrics and meaning unchanged |
| Sessions | Ephemeral; snapshot for the active Review host only |
| Display cache | Cannot make a row reviewable |
| Scope | Active-bundle only |
| Scheduling | Forbidden — no due, overdue, intervals, or recommendation |
| Mastery | Forbidden — Remembered remains latest self-assessment |

---

## 5. Canonical entry point

Locked:

```text
Saved Vocabulary
```

Chooser placement:

```text
below Progress / return cue
above the Review action
above the vocabulary list
```

Do **not** add:

- a new global Learning tab;
- a second top-level Review button;
- guided controls on entry detail;
- guided controls on search results;
- independent Review links on each Progress count.

Reason:

> Progress already tells the user what exists. Guided Review should convert
> that orientation into one controlled action without creating a second
> navigation model.

---

## 6. Default behavior

Preserve current Start/Continue as the default.

Default scope:

```text
All reviewable
```

Required:

- user can activate Review without changing any chooser;
- Start and Continue semantics remain based on existing LS3 Progress state;
- default launches the current full deterministic LS2 queue;
- no additional decision is required for users who prefer the existing flow.

Do **not**:

- replace Start/Continue with a mandatory modal;
- force a filter choice before Review.

---

## 7. Filter set

Exact MVP filters:

```text
All reviewable
New saved words
Still learning
Remembered
```

### All reviewable

Includes every currently LS2-reviewable row.

Ordering remains:

1. never reviewed;
2. reviewed Still learning;
3. reviewed Remembered;
4. existing oldest-first and stable identity tie-breaks
   (`created_at` / `last_reviewed`, then `bundle_id`, then `ir_id`).

### New saved words

Includes only records where:

```text
review_count === 0
last_reviewed === null
```

and all standard LS2 reviewability rules pass.

Do **not** infer from `status`.

Uses the existing never-reviewed helper (`isNeverReviewed` /
`hasLearningRecordBeenReviewed`), not status-alone inference.

### Still learning

Includes only reviewed records where:

```text
review_count > 0
last_reviewed !== null
status === "still_learning"
```

and all standard LS2 reviewability rules pass.

### Remembered

Includes only reviewed records where:

```text
review_count > 0
last_reviewed !== null
status === "remembered"
```

and all standard LS2 reviewability rules pass.

Clarifications:

- Remembered means latest self-assessment only.
- Remembered does not mean mastered.
- Unresolved or inconsistent rows are excluded from all filters.
- A consistent reviewable row belongs to exactly one status filter.

---

## 8. Filter identity

Transient type:

```ts
type GuidedReviewFilter =
  | "all"
  | "not_reviewed"
  | "still_learning"
  | "remembered";
```

The filter is:

- session input;
- not Learning Record state;
- not stored in IndexedDB;
- not persisted across reload;
- not restored after Back;
- not part of Progress;
- not part of dictionary identity;
- not a query-log event.

Do **not** use localized strings as filter identity.

---

## 9. Chooser presentation

Selected pattern:

```text
fieldset + legend + native radio buttons
```

Example shape:

```text
Review scope

(•) All reviewable — 12
( ) New saved words — 3
( ) Still learning — 5
( ) Remembered — 4

Review choices include only entries available in the current dictionary.

[Continue review]
```

Requirements:

- native radio controls;
- one selected filter;
- `All reviewable` selected initially;
- each option shows its currently reviewable count inside the label text;
- disabled or unavailable options remain understandable;
- Start/Continue remains one primary action;
- no modal;
- no dropdown that hides all choices;
- no clickable metric cards;
- no tabs (filter choice applies to session creation, not page navigation).

---

## 10. Guided counts

Chooser counts represent:

```text
currently reviewable rows in that filter
```

They must **not** reuse raw Progress status counts when unavailable or
inconsistent rows exist.

Guided counts:

```text
all_reviewable
not_reviewed_reviewable
still_learning_reviewable
remembered_reviewable
```

Important distinction:

```text
Progress not_reviewed
```

may include unresolved rows, while:

```text
guided not_reviewed_reviewable
```

must exclude them.

Therefore:

> Guided filter counts and LS3 Progress status counts serve different purposes
> and may differ.

Do **not** alter LS3 Progress metrics.

Do **not** display unknown-state counts.

`all_reviewable` must equal `SavedVocabularyProgressVm.reviewable` when both
use the same canonical LS2 eligibility helper.

---

## 11. Count invariants

For eligible (reviewable, consistent) rows:

```text
not_reviewed_reviewable
+ still_learning_reviewable
+ remembered_reviewable
= all_reviewable
```

This is a true partition because:

- all counted rows are reviewable;
- review fields are consistent;
- each belongs to one status group.

Contrast with LS3 Progress:

```text
Progress status counts
```

include unresolved rows and therefore do not partition Review eligibility.

Also:

```text
all_reviewable === progress.reviewable
```

No second independent all-reviewable rule.

---

## 12. Empty-filter behavior

When a filter count is zero:

- keep the radio option visible;
- disable it;
- show count `0`;
- do not permit session start under that filter.

Reason:

- users can understand the complete status model;
- choices do not appear and disappear unpredictably;
- disabled state explains why a cue may not be actionable.

If the selected filter becomes zero after a fresh collection reload:

- automatically reset selection to `all`;
- do not persist stale selection;
- do not start an empty Review session accidentally.

Do **not** show an error after the user selects an already-disabled option
(disabled options are not selectable).

---

## 13. Review action semantics

The existing primary action remains:

```text
Start review
```

or:

```text
Continue review
```

based on LS3 semantics (`reviewAction` from Progress).

The selected filter changes the queue passed to Review, **not** the button’s
Start/Continue identity.

Examples:

```text
New collection + New saved words selected
→ Start review
```

```text
Prior reflections + Still learning selected
→ Continue review
```

Button availability:

```text
enabled when selected option count > 0
```

Because zero-count options are disabled and cannot be selected normally:

- All is selected initially;
- All is enabled whenever any Review action is possible (`reviewable > 0`);
- choosing another enabled filter keeps the action enabled.

Do **not** label the button:

- Resume;
- Study due words;
- Start new-words mode;
- Review 5 now;
- Master words.

Optional helper text may identify the selected scope; the primary label remains
Start/Continue.

Session creation must validate the selected filter against a **fresh** queue,
not rely only on stale rendered counts at click time.

---

## 14. Return-cue relationship

LS3 return cues remain **informational**.

MVP decision:

> Keep the return cue informational and do not auto-select a filter.

Reason:

- preserves LS3 semantics;
- avoids changing user choice unexpectedly;
- keeps default All reviewable;
- prevents the cue from becoming a second hidden action.

The user manually selects a filter.

**Rejected for MVP:** cue-driven preselection.

---

## 15. Session creation

Guided Review creation:

```text
build full active-bundle Review queue
  → apply selected status filter
  → create fresh ephemeral session snapshot
```

Ordered operations:

1. build the canonical LS2 queue using existing eligibility and ordering;
2. filter queue items by selected status group;
3. create the existing Review session over that snapshot.

(Session-size prefix is out of MVP — see §17.)

Do **not**:

- create separate queue builders per filter;
- re-resolve records;
- derive from display cache;
- query IndexedDB a second time solely for filtering;
- change LS2 ordering inside a group;
- randomize.

One canonical queue remains the source of truth.

---

## 16. Queue filtering

Pure predicate concept:

```ts
matchesGuidedReviewFilter(item, filter)
```

Requirements:

- `all` returns every canonical queue item;
- `not_reviewed` uses the canonical never-reviewed helper;
- `still_learning` requires consistent reviewed fields and
  `status === "still_learning"`;
- `remembered` requires consistent reviewed fields and
  `status === "remembered"`;
- no status-only inference for never-reviewed;
- no clock use;
- no writes;
- no mutation of inputs or Learning Records.

Do **not** duplicate review-field semantics; reuse LS2 helpers
(`hasConsistentReviewFields`, `isNeverReviewed` /
`hasLearningRecordBeenReviewed`, status checks after consistency).

---

## 17. Session-size decision

**Locked for LS4 MVP:**

```text
Defer session-size controls.
Implement status-filter selection only.
```

Rationale under `NO_USAGE_EVIDENCE`:

- `5` and `10` are arbitrary without usage validation;
- status filters alone already give meaningful control;
- avoids false completion interpretation (“finished 5” ≠ finished learning);
- keeps chooser complexity low;
- remains fully ephemeral and scheduling-free.

Future size controls, if ever added, must be:

- deterministic prefixes of the filtered queue;
- ephemeral;
- not due-state;
- separately product-defined.

---

## 18. Completion semantics

Completion counts apply only to the selected filtered snapshot.

Example:

```text
Selected Still learning
Eligible = 4
Session complete = reviewed 4
```

This does **not** mean:

- all saved vocabulary reviewed;
- all Reviewable items reviewed;
- vocabulary completed;
- daily goal completed.

**Completion copy decision:**

Preserve existing LS2 completion counts. Use a concise scoped completion
heading when the session filter is not `all`:

| Filter | EN heading | FR heading |
| --- | --- | --- |
| `all` | Review complete (existing) | Révision terminée (existing) |
| `not_reviewed` | New words review complete | Révision des nouveaux mots terminée |
| `still_learning` | Still learning review complete | Révision « encore en apprentissage » terminée |
| `remembered` | Remembered review complete | Révision des mots mémorisés terminée |

No achievement language. No Guided Session persistence.

Exact i18n keys are implementation concerns under `guidedReview.*` (or scoped
completion keys that do not overwrite `review.complete` for the All case).

---

## 19. Back behavior

Back from a guided session:

- disposes the Review host;
- discards filter/session state;
- reloads Saved Vocabulary;
- recomputes Progress and guided counts;
- **resets chooser to `All reviewable`**;
- restores focus to the Start/Continue action or heading per existing LS3 rules
  (`focusReviewActionOnce`).

Focus decision:

1. Back returns focus to the primary Review action (if enabled) else heading;
2. chooser resets to All;
3. do **not** restore focus to the previously selected radio.

Reason: session choice is ephemeral; LS3 focus contract remains stable.

**Filter after Back:** reset to All.

---

## 20. Review Again behavior

```text
Review Again
→ rebuild canonical queue
→ reapply the same filter within the current Review context
→ create a fresh filtered session
```

Session filter may remain in memory only while the Review host remains active.

After leaving Review or reloading:

```text
filter resets to All
```

Requirements:

- no Saved Vocabulary reopen for Review Again;
- no persistent preference;
- current statuses may change queue membership;
- reflected records can move out of the selected group.

Required example:

```text
Still learning session
→ mark one Remembered
→ Review Again
→ that item no longer appears in Still learning
```

---

## 21. Dynamic membership

Guided sessions use a **snapshot**.

During an active session:

- reflection changes persisted Learning Record status;
- current session snapshot does not reshuffle;
- item is counted once in that session;
- subsequent Review Again or new session rebuilds membership.

Do **not** remove the just-reflected card retroactively before advancing.

Do **not** insert newly matching cards into the active snapshot.

---

## 22. Reload semantics

Reload while chooser is visible:

- filter resets to All;
- no preference persists.

Reload during guided Review:

- Review session disappears;
- filter choice disappears;
- completed reflections persist;
- reopen Saved Vocabulary shows refreshed Progress/guided counts;
- next Review defaults to All.

Do **not** resume a guided session.

---

## 23. Offline semantics

After dictionary installation, offline must support:

- chooser renders;
- counts derive;
- filter selection works;
- guided queue builds;
- Review runs;
- reflection persists;
- Review Again rebuilds filtered queue;
- Back refreshes Progress and guided counts;
- reload resets choice to All.

No network dependency. No catalog dependency. No telemetry.

---

## 24. Active-bundle behavior

Guided filters are active-bundle scoped.

On bundle switch:

- discard chooser selection;
- dispose active guided Review;
- recompute counts for the new bundle;
- default to All;
- no cross-bundle queue or counts;
- switching back does **not** restore old filter choice.

---

## 25. Unavailable/inconsistent handling

Locked:

- unavailable rows may contribute to LS3 Progress status counts;
- unavailable rows contribute to **no** guided-filter count;
- inconsistent rows contribute to **no** guided-filter count;
- display cache cannot make a row reviewable;
- disabled filters use guided eligible count, not Progress count;
- no repair occurs.

Valid example:

```text
Progress Still learning = 3
Guided Still learning = 1
```

when two Still learning records are unavailable.

**Helper text decision:** always visible once below the chooser (when the
chooser is shown):

> Review choices include only entries available in the current dictionary.

Do **not** repeat under every option.

---

## 26. Computation ownership

Architecture:

```text
Saved Vocabulary session/controller
  → existing rows
  → Progress derivation
  → Guided Review option derivation
  → renderer
```

View models:

```ts
type GuidedReviewFilter =
  | "all"
  | "not_reviewed"
  | "still_learning"
  | "remembered";

type GuidedReviewOptionVm = {
  filter: GuidedReviewFilter;
  count: number;
  enabled: boolean;
};

type GuidedReviewChooserVm = {
  selected: GuidedReviewFilter;
  options: readonly GuidedReviewOptionVm[];
};
```

Selected filter is UI/session-local state.

The renderer must **not**:

- calculate filter counts;
- inspect Learning Record fields;
- resolve entries;
- access IndexedDB;
- construct queues.

The Review host receives selected filter as immutable initial input for that
session (and may retain it for Review Again while the host is active).

---

## 27. State ownership

### Saved Vocabulary chooser state

Owned by the current Saved Vocabulary surface host/controller.

Lifetime:

```text
current Saved Vocabulary surface only
```

Resets on:

- reload;
- leaving Saved Vocabulary;
- entering Review;
- bundle switch;
- database deletion;
- new Saved Vocabulary open;
- successful Remove (see §32);
- Back from Review (via new Saved Vocabulary open).

### Guided Review filter state

Owned by the current Review host.

Lifetime:

```text
current Review context
```

May be reused for Review Again.

Destroyed on:

- Back;
- reload;
- host disposal;
- search/entry navigation;
- bundle switch;
- database deletion.

No IndexedDB or localStorage persistence.

---

## 28. Empty-queue race

When:

```text
selected option showed >0
but fresh queue has 0 matching items
```

Possible causes: remove, bundle change, DB deletion, prior reflection, stale
surface.

Required behavior:

- do **not** show a false completion screen;
- do **not** create an empty Review session as success;
- return to refreshed Saved Vocabulary;
- refresh counts;
- reset chooser to All;
- present a concise no-items condition if needed via existing collection /
  Review-unavailable messaging, or a transient guided empty presentation.

Presentation/session result concept (not persisted):

```text
guided_filter_empty
```

**MVP presentation decision:** return to refreshed Saved Vocabulary; do not
mount a successful empty Review surface.

---

## 29. Localization

Dedicated `guidedReview.*` keys. Do **not** overwrite `progress.*` or
`review.*` strings.

### English

```text
Review scope
All reviewable
New saved words
Still learning
Remembered
Review choices include only entries available in the current dictionary.
```

### French

```text
Portée de la révision
Tous les mots disponibles
Nouveaux mots enregistrés
Encore en apprentissage
Mémorisés
Les choix de révision comprennent uniquement les entrées disponibles dans le dictionnaire actuel.
```

Terminology constraints:

- no Mastered / Maîtrisés;
- no Due / À réviser;
- no Overdue / En retard;
- no Recommended today;
- no Resume;
- no difficulty score.

**French wording note:** Locked strings above align with existing Progress
plural forms where relevant (`Encore en apprentissage`, `Mémorisés`) and with
the “new saved words” cue phrasing (`Nouveaux mots enregistrés`). Row-level
`review.remembered` remains singular (`Mémorisé`) and is not overwritten.

Count presentation: include count in the radio label text
(e.g. `New saved words — 3` / `Nouveaux mots enregistrés — 3`).

---

## 30. Accessibility

- chooser uses `<fieldset>` and `<legend>`;
- native radio inputs;
- labels include option name and count;
- disabled options use native `disabled`;
- helper text associated with the chooser (e.g. described-by / adjacent text);
- primary Review action remains a real button;
- keyboard users can move among radio options;
- selecting a filter does **not** move focus automatically;
- no live-region announcement for every radio change;
- empty-filter race / no-items path receives appropriate focus on return;
- Back focus contract remains the primary Review action or heading;
- no color-only distinction;
- no clickable cards replacing radios.

---

## 31. Surface states

### Loading

- no chooser counts yet;
- no provisional zeros;
- existing loading state.

### Empty collection

- no Progress;
- no chooser;
- no Review action.

### Populated, reviewable (`reviewable > 0`)

- Progress;
- chooser;
- enabled primary action (subject to selected option count).

### Populated, unresolved-only (`reviewable === 0`)

**Decision:** show chooser **only when** `reviewable > 0`.

When unresolved-only:

- Progress remains;
- chooser omitted;
- disabled Review action;
- existing no-reviewable explanation.

Reason: all filters would otherwise be disabled; current disabled Review
explanation already communicates the condition.

### Removing

- chooser remains visible;
- all chooser controls disabled;
- Review action disabled;
- counts remain pre-success until removal completes.

### Unavailable/error

- no chooser;
- no stale guided counts.

---

## 32. Remove/refresh behavior

**Decision after successful Remove:**

> Reset chooser to All after any successful removal.

Also:

- recompute Progress;
- recompute guided counts;
- if collection becomes empty, remove chooser;
- no optimistic durable count change before persistence succeeds.

Cancel/failure leaves selection and counts unchanged.

Reason for reset: deterministic, avoids stale selection, removal is uncommon,
no persistent preference.

---

## 33. Truthfulness boundary

Locked:

- filter count means currently eligible entries in that group;
- New means never reflected, not recently saved by time;
- Still learning means latest self-assessment;
- Remembered means latest self-assessment;
- All means all currently reviewable active-bundle entries;
- selection does not mean priority, due-state, recommendation, or mastery;
- completion applies only to the chosen snapshot;
- choosing Remembered does not validate long-term retention.

> **Guidance in LS4 means user-selected scope, not algorithmic instruction.**

---

## 34. Success criteria

LS4 succeeds when executable evidence later proves:

1. chooser appears only when reviewable entries exist;
2. All is selected initially;
3. All count equals canonical reviewable count;
4. status-filter counts partition All;
5. unavailable rows do not enter guided counts;
6. inconsistent rows do not enter guided counts;
7. New uses count/timestamp semantics, not status;
8. Still learning filter is exact;
9. Remembered filter is exact;
10. zero-count options are disabled;
11. default Start/Continue still launches All;
12. selected filter launches only matching items;
13. filtered queue preserves LS2 ordering;
14. no second DB/resolution pass;
15. fresh queue validates selected filter at activation;
16. empty-filter race is handled safely;
17. session remains ephemeral;
18. reload resets to All;
19. Back resets to All;
20. Review Again preserves filter only within active Review context;
21. Review Again rebuilds membership from current persisted status;
22. active session snapshot does not reshuffle;
23. bundle switch discards filter;
24. database deletion discards filter;
25. offline chooser and guided Review work;
26. Progress remains unchanged in meaning;
27. no schema or persistence change;
28. no due/mastery/resume language;
29. EN/FR parity;
30. keyboard and screen-reader behavior works;
31. LS1–LS3 behavior remains intact;
32. session-size controls are absent from MVP.

---

## 35. Alternatives rejected

| Alternative | Reject reason |
| --- | --- |
| Mandatory modal chooser | Default Review should remain one click |
| Multiple primary Review buttons | Fragments the canonical action |
| Clickable Progress metrics | Progress includes unavailable rows; not queue counts |
| Auto-select from return cue | Cue remains informational |
| Persist last filter | Choice is session-local; evidence absent |
| Random session subsets | LS2 ordering is deterministic |
| Due or recommended filter | Scheduling not selected |
| Source-language prompt filters | Source-language Learning objects do not exist |
| Custom tags/lists | Organization is not LS4 |
| Session history | Review Events not selected |
| Session-size controls in MVP | Deferred under `NO_USAGE_EVIDENCE` |

---

## 36. Explicit non-goals

Do not define or implement in LS4:

- due dates;
- scheduling;
- SRS;
- Review Events;
- history;
- persistent filter preference;
- saved sessions;
- Resume Review;
- randomization;
- difficulty levels;
- confidence scoring;
- mastery;
- streaks;
- goals;
- reminders;
- notifications;
- analytics;
- telemetry;
- global dashboard;
- cross-bundle sessions;
- unresolved/display-cache Review;
- source-language Learning objects;
- translation-relationship objects;
- tags/lists;
- export/import;
- cloud sync;
- morphology;
- audio;
- schema migration;
- session-size limits (deferred).

---

## 37. Implementation slices

Define but do not implement in this slice:

```text
LS4I1 — Guided Queue Filter Model
LS4I2 — Saved Vocabulary Review Scope Chooser
LS4I3 — Guided Session and Review Again Integration
LS4I4 — Offline and Lifecycle Verification
LS4I5 — LS4 Closure
```

| Slice | Purpose | Main output | Dependencies | Boundary |
| --- | --- | --- | --- | --- |
| LS4I1 | Pure filter/count model and canonical queue filtering | `GuidedReviewFilter`, count derivation, `matchesGuidedReviewFilter`, filtered-queue helper | LS2 queue helpers, LS3 Progress eligibility | No UI |
| LS4I2 | Chooser rendering, localization, accessibility | `GuidedReviewChooserVm` in Saved Vocabulary surface; `guidedReview.*` i18n; fieldset radios | LS4I1, LS3 Progress surface | No Review-host changes |
| LS4I3 | Pass selected filter into Review; Back / Review Again / empty-race | Application navigation + Review host initial filter input | LS4I1, LS4I2, LS2 host | No new persistence |
| LS4I4 | Playwright offline and lifecycle verification | Browser evidence for chooser, filter, offline, reload, Back, Review Again | LS4I1–I3 | Verification + narrow fixes only |
| LS4I5 | Documentation-only closure | Closure report | LS4I1–I4 | Docs only |

Next slice after this definition:

```text
LS4I1 — Guided Queue Filter Model
```

Roadmap status for this milestone:

```text
LS4 — Guided Review Sessions — Product defined
LS4I1 — Guided Queue Filter Model — Next
```

`docs/ROADMAP.md` has no Learning System status index requiring update.

---

## 38. Open issues

All open issues for MVP are **resolved** as follows:

| # | Issue | Decision |
| --- | --- | --- |
| 1 | Session-size controls | **Deferred** from LS4 MVP |
| 2 | Chooser when `reviewable === 0` | **Hidden** |
| 3 | Filter after Back | **Reset to All** |
| 4 | Filter after successful Remove | **Reset to All** |
| 5 | Review Again filter | **Preserve only within active Review context** |
| 6 | Completion copy | **Concise scoped heading when filter ≠ all; keep LS2 counts** |
| 7 | Empty-filter race presentation | **Return to refreshed Saved Vocabulary; `guided_filter_empty` conceptual result** |
| 8 | Helper text | **Always visible once below chooser when shown** |
| 9 | Counts placement | **Included in radio label text** |
| 10 | Exact French wording | **Locked strings in §29** |

No unresolved product decisions remain that would block `LS4_GUIDED_REVIEW_PRODUCT_DEFINED`.

---

## Documentation-only confirmation

This slice changes only documentation (this report). No runtime code, UI, CSS,
i18n, IndexedDB schema, tests, Playwright specifications, fixtures, bundles,
catalog, sources, or packages were modified.

---

## Repository hygiene

Unrelated featured-anchor work remains uncommitted and was not staged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

This slice stages only:

```text
docs/reports/ls4d0_guided_review_sessions_product_definition.md
```

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS4_GUIDED_REVIEW_PRODUCT_DEFINED` |
| Product | User-selected status filter over canonical LS2 queue |
| Session size | Deferred |
| Persistence | None |
| Next slice | `LS4I1 — Guided Queue Filter Model` |
| Code changes | None |
