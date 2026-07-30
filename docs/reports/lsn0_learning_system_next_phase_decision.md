# LSN0 — Learning System Next-Phase Decision

## 1. Decision

```text
LSN0_NEXT_PHASE_SELECTED
```

Selected direction:

```text
LS3 — Progress & Return Surface
```

This slice is documentation-only. No Learning capability was implemented.
No scheduling, history store, telemetry, schema, UI, or runtime change was made.

Authoritative inputs:

- `docs/reports/ls1_learning_system_closure_report.md`
- `docs/reports/ls2_review_and_reflect_closure_report.md`
- `docs/reports/learning_system_mvp_definition.md`
- current Learning Record schema and Review/Save implementation
- current dictionary record model
- repository product evidence under `docs/` and local structured-usability artifacts
- owner lock: keep building via Progress & Return Surface

---

## 2. Executive finding

After durable Save (LS1) and deterministic Review and Reflect (LS2), the
highest-value next Learning System capability is a lightweight **Progress &
Return Surface**.

> **Progress & Return Surface**: A lightweight orientation layer that tells the
> user what they have saved, what remains unreviewed, what they are still
> learning, what they currently remember, and where to continue.

This direction extracts more value from existing Learning Records without
creating a new identity, event store, scheduling policy, corpus dependency, or
migration.

Progress is a **derived presentation** of current Learning Records, not a new
source of truth. Counts describe current collection state. They are not proof
of long-term retention. **Remembered must not be described as mastered.**

Competing directions (scheduling, history, lexical enrichment, source objects,
translation relationships, organization, portability/sync) remain valuable
later but are rejected for now under the owner keep-building posture and the
architectural constraints below.

Executable correctness of LS1/LS2 is not treated as product validation of
scheduling demand. Progress is selected because it closes the MVP return-habit
gap using already-shipped fields, not because longitudinal Review usage has
been measured.

---

## 3. Current Learning System baseline

### Product loop shipped

```text
Search
  → Open genuine Maninka lexicon entry
  → Save Learning Record
  → Open Saved Vocabulary
  → Start Review
  → Recall → Reveal → Reflect (Still learning | Remembered)
  → Complete → return to Saved Vocabulary
```

### Learning Record

Identity:

```text
(bundle_id, ir_id)
```

Schema (`learning_record_v1`, IndexedDB `learning_records`, DB version 4):

| Field | Role |
| --- | --- |
| `status` | Latest self-assessment: `still_learning` \| `remembered` |
| `last_reviewed` | Timestamp of last successful reflection, else `null` |
| `review_count` | Successful reflection count |
| `created_at` | Save timestamp |
| `display_cache` | Save-time fallback for unresolved rows only |
| content stamps | Resolution stamps, not identity |

Save eligibility: only `ir_kind === "lexicon_entry"`.

Not saveable or reviewable: source query strings, `index_mapping`, translation
pairs.

### Review behavior

- Active-bundle, live-resolved lexicon entries only.
- Deterministic order: never reviewed → reviewed Still learning → reviewed
  Remembered; oldest first within groups.
- Unresolved / soft-orphan rows retained in storage, excluded from Review.
- Reveal is session-local and does not persist.
- Reflection mutates only `status`, `last_reviewed`, `review_count`.
- No due dates, intervals, SRS, reminders, session history, or progress charts.

### Dictionary authority

Live Maninka `lexicon_entry` remains lexical authority. Source-language
discovery uses `index_mapping` lookup keys, not a genuine source lexicon.

### Naming clarification

MVP definition historically labeled **LS3 Progress & Return Surface**
(lightweight counts). LS2 closure labeled **Review Scheduling** as an LS3
*candidate* and required this LSN0 decision before either was assumed.

**This decision locks Progress**, not Scheduling. Future scheduling work, if
any, must use a distinct label and must not silently reinterpret LS2 fields as
objective mastery.

---

## 4. Evidence inventory

### Evidence classes used

| Class | Meaning | Learning relevance |
| --- | --- | --- |
| A — Natural-use | Opt-in real tester exports / field observation | Absent for Learning Save/Review |
| B — Structured usability | Scripted Playwright harness; `can_influence_demand = false` | Search/lookup only; not Learning demand |
| C — Automated tests | Vitest / Playwright LS1/LS2 | Correctness of Save/Review loop |
| D — Architecture / product docs | MVP, LS1/LS2 defs and closures | Planning constraints |
| E — Owner product lock | Explicit keep-building selection | Authorizes Progress selection |

### Hierarchy application

1. **Observed user behavior (Learning):** none in repository.
2. **Explicit user / owner requests:** owner locks Progress & Return Surface as
   the keep-building next phase.
3. **Usability defects:** search/interpretability probes exist as Class B; no
   Learning Review abandonment field reports.
4. **Issue history:** Phase 7N / search dispositions; not Learning queue pain.
5. **Implementation limitations:** known from LS1/LS2 closures (device-local,
   no history, no scheduling, no source objects, no export, no progress counts).
6. **Corpus/data limitations:** lemma gaps, sense ambiguity, sparse examples,
   no audio/morphology in runtime IR.
7. **Architecture constraints:** `(bundle_id, ir_id)` identity; dictionary
   isolation; query-log consent ≠ Learning consent; offline-first; Progress
   must remain derived.
8. **General learning theory:** must not force scheduling ahead of Progress.

### Key finding for this decision

Absence of longitudinal Learning usage evidence **blocks scheduling** and other
high-risk directions. It does **not** block Progress: Progress uses only
current Learning Record fields already written by LS1/LS2 and completes the
MVP orientation gap already defined in
`learning_system_mvp_definition.md`.

---

## 5. Evidence maturity classification

```text
NO_USAGE_EVIDENCE
```

Natural-use Learning Save/Review evidence remains absent. That classification
is unchanged and continues to constrain scheduling, history-as-product, and
sync.

Progress is selected under owner keep-building authority plus architectural
fit to existing fields — not by claiming Class A usage proof.

---

## 6. Decision framework

Each candidate is scored 1–5 on the required criteria.

### Scale

```text
1 — weak
2 — limited
3 — moderate
4 — strong
5 — very strong
```

### Criterion polarity

| # | Criterion | High score means |
| --- | --- | --- |
| 1 | Observed user value | More evidence of present need |
| 2 | Dependency on unavailable data | **Greater** dependency (worse) |
| 3 | Learning effectiveness | Larger expected recall benefit if used |
| 4 | Architectural fit | Cleaner extension of LS1/LS2 |
| 5 | Offline suitability | Stronger offline reliability |
| 6 | Implementation complexity | **Greater** cost (worse) |
| 7 | Data-model risk | **Greater** risk (worse) |
| 8 | Reversibility | Easier to change later |
| 9 | Evidence measurability | Easier to validate benefit later |
| 10 | Opportunity cost | **More** valuable work delayed (worse) |

**Normalized favorability** for cost/risk criteria (2, 6, 7, 10):

```text
favorability = 6 − raw_score
```

Net interpretation uses qualitative dominance. Owner keep-building preference
is stated explicitly where it decides among evidence-weak options.

---

## 7. Candidate comparison matrix

| Candidate | User value | Data dep.↓ | Learn. effect | Arch. fit | Offline | Impl. cost↓ | Model risk↓ | Reversible | Measurable | Opp. cost↓ | Net reading |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Progress (selected)** | 2 | 1 | 3 | 5 | 5 | 2 | 1 | 5 | 3 | 2 | Best keep-building path now |
| A Scheduling | 1 | 2 | 4 | 3 | 3 | 4 | 4 | 2 | 4 | 5 | Premature |
| B History | 1 | 1 | 2 | 4 | 5 | 3 | 4 | 3 | 3 | 4 | Infrastructure without consumer |
| C Lexical support | 2* | 4–5 | 4 | 4 | 5 | 2–5† | 2–5† | 3 | 3 | 4 | Corpus-constrained |
| D Source objects | 1 | 5 | 3 | 2 | 4 | 5 | 5 | 2 | 3 | 5 | Blocked on source lexicon |
| E Translation objs | 1 | 4 | 3 | 2 | 4 | 5 | 5 | 2 | 3 | 5 | Blocked on identity |
| F Organization | 1 | 1 | 1 | 4 | 5 | 3 | 3 | 3 | 2 | 4 | Premature |
| G Portability | 1 | 1 | 1 | 3 | 4‡ | 3–5§ | 4–5§ | 3 | 2 | 4 | Weaker immediate learning value |

\* Class B search/content friction only.
† Low if surfacing existing fields; high if requiring corpus/audio/morphology.
‡ Local export offline-friendly; cloud sync is not.
§ Export-only lower; cloud sync much higher.

**Judgment:** Progress dominates now on architectural fit, low data-model risk,
reversibility, offline suitability, and immediate product completeness of the
MVP loop. Scheduling and History remain important later but are not selected.

---

## 8. Review Scheduling analysis

### User problem scheduling would solve

Select which saved entries are due and when, so large collections remain
tractable and spacing improves retention.

### Why rejected for now

- No longitudinal Learning usage evidence that deterministic Review is too
  burdensome.
- LS2 stores latest `status`, `last_reviewed`, and `review_count` only — not
  enough for responsible interval reconstruction.
- A `next_review_at` field would introduce clock, offline backlog, unresolved,
  and bundle-removal policies without a validated user problem.
- Named SRS algorithms are not justified by commonality alone.
- Scheduling value cannot be validated without multi-day use.

**Scheduling conclusion:** Premature without due-state policy and longitudinal
evidence. Rejected for now.

---

## 9. Learning History analysis

Possible future event shape (analysis only — not implemented):

```ts
type LearningReviewEvent = {
  event_id: string;
  bundle_id: string;
  ir_id: string;
  outcome: "still_learning" | "remembered";
  reviewed_at: string;
};
```

History would help defensible scheduling, analytics, and sync merge later. It
adds identity, append-only storage, deletion, growth, migration, and privacy
surface **without a current user-facing consumer**.

Progress does not require Review Events: counts derive from current Learning
Record fields.

**History conclusion:** Adds infrastructure without a current user-facing
consumer. Rejected for now.

---

## 10. Richer Lexical Support analysis

Review already surfaces live senses, glosses, examples, and variants when
present. Remaining gaps (missing examples, lemma coverage, audio, morphology,
N’Ko sparsity) are primarily **source-data / roadmap** constraints. UI cannot
manufacture authoritative lexical content.

| Gap | Type |
| --- | --- |
| Clearer multi-sense presentation | product feature gap (possible later) |
| Missing examples / glosses / lemmas | source-data gap |
| Pronunciation / audio | source-data + packaging gap |
| Morphology | source-data + Branch C gap |

**Lexical-support conclusion:** Valuable, but primarily constrained by
authoritative corpus data. Rejected as the next Learning System phase.

---

## 11. Source-Language Learning Object analysis

Source side today is `index_mapping` (lookup keys + target postings), not a
genuine FR/EN source lexicon with definitions and senses.

| Question | Answer |
| --- | --- |
| Object identity | Would need genuine source lexicon records |
| Current data | Mapping keys only |
| Save / Review | Blocked until source lexicon exists |
| Relation to Progress | Orthogonal; Progress uses Maninka Learning Records |

**Conclusion:** Blocked until genuine source lexicon records exist. Rejected
for now.

---

## 12. Translation-Relationship analysis

A bilingual learning object such as `man ↔ bolo` is distinct from saving either
lexicon entry. It requires separate identity and relation semantics and must
not overload `(bundle_id, ir_id)`.

**Conclusion:** Blocked on identity and relation semantics. Rejected for now.

---

## 13. Collection Organization analysis

Organization (lists, tags, favorites, manual order) helps manage learning
objects; it does not itself improve recall. No collection-management pain or
size distribution is demonstrated.

**Conclusion:** Premature before collection-management pain is demonstrated.
Rejected for now.

---

## 14. Portability and Sync analysis

### Local export/import

Useful for backup/device transfer in theory. Higher complexity than Progress
for weaker immediate learning-orientation value. No current request evidence.

### Cloud sync

Separate program: authentication, remote identity, merge, deletion,
encryption, offline reconciliation, infrastructure. Must not be bundled with
basic export/import.

**Conclusion:** Higher complexity and weaker immediate learning value than
Progress. Rejected for now.

---

## 15. Other evidence-supported candidate

```text
Candidate H — Progress & Return Surface (selected)
```

Progress was already defined in the Learning System MVP as LS3. LS2 closure
correctly refused to auto-select scheduling. Owner keep-building lock now
selects Progress as the next phase.

No stronger alternative emerged from repository usage evidence.

---

## 16. Minimum viable form of each candidate

| Candidate | Smallest credible product-coherent step |
| --- | --- |
| **Progress (selected)** | Derived counts + empty states + Continue/Start Review from existing fields |
| A Scheduling | Simple due-state model without SRS — only after due-state policy + usage |
| B History | Append one immutable event per reflection — defer until a selected consumer |
| C Lexical support | Surface one existing authoritative example/sense more clearly |
| D Source objects | Package genuine source lexicon records first |
| E Translation relationships | Architecture definition only |
| F Organization | One optional user tag — only after management pain |
| G Portability | Local JSON export with no import — only after backup demand |

### Progress MVP field set

Use only existing fields:

```text
status
last_reviewed
review_count
created_at
```

May provide:

- total saved entries;
- number not yet reviewed;
- number Still learning;
- number Remembered;
- number currently unavailable (unresolved / soft orphan);
- clear **Continue review** or **Start review** action;
- simple return cue based on existing queue order;
- empty states for no saved vocabulary and no reviewable vocabulary;
- active-bundle scope only.

Must not add:

- due dates;
- review scheduling;
- spaced repetition;
- streaks;
- scores;
- mastery percentages;
- immutable review history;
- charts implying learning performance;
- daily goals;
- notifications;
- new IndexedDB fields;
- cross-bundle aggregation;
- source-language or translation-pair objects.

---

## 17. Dependency graph

```text
LS1 Learning Records
  → enables LS2 Review and Reflect
  → enables LS3 Progress & Return Surface (derived counts)

LS3 Progress
  → optional later enhancement path to return habit measurement
  → does not require History
  → does not require Scheduling

Learning History (later optional)
  → may enable defensible Scheduling
  → may enable analytics
  → may support future sync reconciliation

Source-language lexicon data (prerequisite for D)
  → enables source-language saving / Review
  → may enable translation-relationship objects

Lexical-content quality (constraint)
  → constrains Review quality
  → constrains usefulness of Scheduling
  → does not block Progress counts
```

Progress is an **optional enhancement** relative to Save/Review correctness, and
the **selected next product slice** relative to competing Learning directions.

---

## 18. Selected direction

```text
LS3 — Progress & Return Surface
```

### Architectural constraint

> Progress is a derived presentation of current Learning Records, not a new
> source of truth.

### Truthfulness rules

- Do not describe Remembered as mastered.
- Counts are current collection state, not proof of long-term retention.
- Never-reviewed remains derived (`review_count === 0` and
  `last_reviewed === null`), not a third stored status.
- Unavailable / unresolved rows may be counted separately; they must not be
  treated as reviewable progress.

---

## 19. Rejected-for-now candidates

| Candidate | Why not now |
| --- | --- |
| Review Scheduling | Premature without due-state policy and longitudinal evidence |
| Learning History | Adds infrastructure without a current user-facing consumer |
| Richer lexical support | Valuable, but primarily constrained by authoritative corpus data |
| Source-language objects | Blocked until genuine source lexicon records exist |
| Translation relationships | Blocked on identity and relation semantics |
| Organization | Premature before collection-management pain is demonstrated |
| Portability / sync | Higher complexity and weaker immediate learning value |

---

## 20. Preconditions

Before LS3 implementation:

1. `LS3D0 — Progress & Return Surface Product Definition` is complete.
2. Exact metrics, empty states, placement, return action, and terminology are
   defined.
3. Boundary between truthful orientation and misleading gamification is locked.
4. Progress remains derived from existing Learning Record fields only.
5. No new IndexedDB fields or stores are introduced for Progress MVP.
6. Active-bundle scope only.
7. LS1/LS2 invariants remain intact.
8. Query-log consent is not reused for Learning analytics.
9. Remembered is never presented as mastered.

---

## 21. Stop conditions

Stop or refuse Progress implementation if work attempts to:

- add due dates, scheduling, or SRS;
- add streaks, scores, mastery percentages, or performance charts;
- add immutable Review Events as a Progress dependency;
- add new IndexedDB Learning fields for Progress;
- aggregate across bundles;
- invent source-language or translation-pair learning objects;
- treat `display_cache` as lexical authority;
- silently reinterpret LS2 fields as objective mastery;
- mix unrelated featured-anchor / search work into the Progress slice;
- add Learning telemetry under query-log consent.

---

## 22. Smallest next slice

```text
LS3D0 — Progress & Return Surface Product Definition
```

Definition-only slice. It must define:

- exact metrics and derivation rules from `status`, `last_reviewed`,
  `review_count`, and `created_at`;
- empty states for no saved vocabulary and no reviewable vocabulary;
- placement (Saved Vocabulary and/or related return surfaces);
- **Continue review** / **Start review** action semantics;
- return cue based on existing deterministic queue order;
- terminology (especially Still learning vs Remembered vs not yet reviewed);
- accessibility and EN/FR parity expectations;
- the boundary between truthful orientation and misleading gamification;
- explicit non-goals matching this LSN0 lock.

No runtime implementation in LS3D0.

---

## 23. Privacy boundary

Current query-logging consent must **not** silently authorize Learning
analytics.

Progress MVP uses on-device derived counts from existing Learning Records. It
does not add telemetry.

If future usage evidence requires Learning telemetry, a separate decision must
cover local-only versus exportable data, consent, exact fields, retention,
deletion, no automatic upload, and sensitivity of vocabulary and learning
behavior.

---

## 24. Open issues

1. Exact placement of Progress relative to Saved Vocabulary chrome.
2. Whether `review_count` is ever shown numerically, or only used as derivation
   input for never-reviewed.
3. Wording for unavailable / unresolved counts without alarming soft orphans.
4. Whether a “last reviewed” collection-level cue is shown in addition to
   per-row dates already present.
5. How Continue vs Start Review labels switch when a session was just completed.
6. Naming reservation: future scheduling must not reuse “LS3” ambiguously.

These belong to LS3D0, not this decision.

---

## 25. Explicit non-goals

This slice does **not** implement:

- Progress UI or derived-count runtime;
- scheduling, due dates, SRS;
- Review Events / history store;
- analytics or telemetry;
- source-language records;
- translation-pair records;
- multiple lists / tags / favorites;
- export/import;
- cloud sync;
- morphology or audio;
- corpus changes;
- schema migration;
- IndexedDB changes;
- Playwright tests;
- runtime code.

---

## 26. Repository hygiene

Allowed change:

```text
docs/reports/lsn0_learning_system_next_phase_decision.md
```

`docs/ROADMAP.md` has no Learning System status index (same pattern as LS1/LS2
closures). Canonical status lives in this report:

```text
LS2 — Closed
LSN0 — Decided: NEXT_PHASE_SELECTED
LS3 — Progress & Return Surface — Selected
LS3D0 — Progress & Return Surface Product Definition — Next
```

Unrelated featured-anchor / search work must remain unstaged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

---

## Documentation-only confirmation

This slice changes only documentation (this report). No runtime code, UI,
IndexedDB schema, tests, Playwright specifications, fixtures, bundles,
catalog, sources, packages, CSS, or i18n were modified.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LSN0_NEXT_PHASE_SELECTED` |
| Selected direction | `LS3 — Progress & Return Surface` |
| Evidence maturity | `NO_USAGE_EVIDENCE` (unchanged; constrains scheduling, not Progress) |
| Architectural rule | Progress is derived presentation, not a new source of truth |
| Next slice | `LS3D0 — Progress & Return Surface Product Definition` |
| Code changes | None |
