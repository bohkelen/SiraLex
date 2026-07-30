# LSN1 — Learning System Post-LS3 Decision

## 1. Decision

```text
LSN1_NEXT_PHASE_SELECTED
```

Selected direction:

```text
LS4 — Guided Review Sessions
```

This slice is documentation-only. No Learning capability was implemented.
No scheduling, history store, portability, telemetry, schema, UI, or runtime
change was made.

Authoritative inputs:

- `docs/reports/ls1_learning_system_closure_report.md`
- `docs/reports/ls2_review_and_reflect_closure_report.md`
- `docs/reports/ls3_progress_return_closure_report.md`
- `docs/reports/lsn0_learning_system_next_phase_decision.md`
- current Learning Record schema (`learning_record_v1`)
- current Saved Vocabulary, Review, and Progress architecture
- repository product evidence under `docs/` and local structured-usability artifacts
- current offline-first and privacy boundaries
- owner posture: continue building after LS3

---

## 2. Executive finding

After durable Save (LS1), deterministic Review and Reflect (LS2), and truthful
derived Progress & Return (LS3), the highest-value next Learning System
capability is **Guided Review Sessions**.

> **Guided Review Sessions**: Let the user choose which existing status group
> (and optionally how many items) to review in a fresh ephemeral LS2 session,
> turning LS3 orientation cues into explicit, offline, reversible control
> without inventing due-state, history, or a new learning identity.

This direction extracts more value from already-shipped Learning Records,
queue groups, and Progress return cues. It does not require schema migration,
immutable events, corpus changes, or cloud infrastructure.

Competing directions remain valuable later. Local portability is the strongest
runner-up as data protection. Scheduling, history, organization, and new object
models remain rejected for now under evidence, identity, or completeness
constraints below.

Executable correctness of LS1–LS3 is not treated as product validation of
scheduling demand or large-collection pain. Guided sessions are selected
because they close the post-Progress control gap using already-derived status
buckets, not because longitudinal Review usage has been measured.

---

## 3. Current Learning System baseline

### Product loop shipped

```text
Search
  → Open genuine Maninka lexicon entry
  → Save
  → Open Saved Vocabulary
  → See Progress
  → Start or Continue Review
  → Recall → Reveal → Reflect
  → Return → Progress refreshes
```

Offline Progress and Continue Review are verified.

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

Save/Review eligibility: only genuine `ir_kind === "lexicon_entry"`.

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

### Progress behavior

- Derived from `SavedVocabularyRowVm[]`.
- No Progress store or Progress identity.
- Start/Continue share one fresh LS2 Review path.
- Return cues mirror queue-group priority and are informational only.
- Remembered must not be described as mastered.

### Dictionary authority

Live Maninka `lexicon_entry` remains lexical authority. Source-language
discovery uses `index_mapping` lookup keys, not a genuine source lexicon.

### Naming clarification

LS3 closed Progress & Return. This decision locks **Guided Review Sessions**
as LS4. Future scheduling, if any, must use a distinct label and must not
silently reinterpret LS2/LS3 fields as objective mastery or due-state.

---

## 4. Owner posture

Locked:

- Continued product development is authorized.
- Lack of longitudinal user evidence does not by itself force an evidence-only
  phase.
- Evidence quality still affects scope and confidence.
- Select the smallest coherent capability whose value does not depend on
  fabricated assumptions.
- Do not choose infrastructure without identifying its immediate user-facing
  consumer.
- Do not choose a feature merely because it is easy.
- Do not silently select scheduling because Review and Progress now exist.

---

## 5. Evidence inventory

### Evidence classes used

| Class | Meaning | Learning relevance |
| --- | --- | --- |
| A — Natural-use | Opt-in real tester exports / field observation | Absent for Learning Save/Review/Progress |
| B — Structured usability | Scripted Playwright harness; `can_influence_demand = false` | Search/lookup only; not Learning demand |
| C — Automated tests | Vitest / Playwright LS1–LS3 | Correctness of Save/Review/Progress loop |
| D — Architecture / product docs | MVP, LS1–LS3 defs and closures, LSN0 | Planning constraints |
| E — Owner product lock | Explicit continue-building after LS3 | Authorizes selecting a buildable next capability |

### Hierarchy application

1. **Observed user behavior (Learning):** none in repository.
2. **Explicit owner posture:** continue building; do not default to evidence-only pause.
3. **Usability defects:** search/interpretability probes exist as Class B; no
   Learning Review abandonment field reports; no measured collection sizes.
4. **Issue history:** Phase 7N / search dispositions; not Learning queue pain.
5. **Implementation limitations:** known from LS1–LS3 closures (device-local,
   no history, no scheduling, no export, Progress cues informational only).
6. **Corpus/data limitations:** lemma gaps, sense ambiguity, sparse examples,
   no audio/morphology in runtime IR — constrain Review quality, not Progress
   derivation.
7. **Architecture constraints:** `(bundle_id, ir_id)` identity; dictionary
   isolation; query-log consent ≠ Learning consent; offline-first; Progress
   derived only.

### Key finding for this decision

Absence of longitudinal Learning usage evidence **still blocks scheduling**,
history-as-analytics, and organization-as-scale-management. It does **not**
block a guided-session capability that only exposes already-derived status
groups as user-selected filters on the existing ephemeral Review path.

---

## 6. Evidence maturity classification

```text
NO_USAGE_EVIDENCE
```

Natural-use Learning Save/Review/Progress evidence remains absent.

That classification:

- continues to constrain scheduling, opaque algorithms, and telemetry;
- narrows Guided Sessions MVP to existing queue groups and transparent choice;
- raises Local Portability as a serious data-protection runner-up, but does not
  prove backup demand;
- must not fabricate collection-scale pain for tags or due-state.

Distinguish:

| Kind | Present? |
| --- | --- |
| Automated correctness evidence | Yes (LS1–LS3) |
| Developer/human-usage harness evidence | Search-focused Class B only |
| Actual learner use | No |
| Qualitative Learning feedback | No |
| Longitudinal Learning behavior | No |

---

## 7. System constraints

All candidates evaluated against:

- Learning Record identity is `(bundle_id, ir_id)`.
- Learning applies only to genuine `lexicon_entry` records.
- Source queries and index mappings are not learning objects.
- Review uses live active-bundle dictionary entries.
- Display cache is fallback presentation only.
- Learning remains active-bundle scoped.
- Review sessions are ephemeral.
- Reflection state is latest status plus count/timestamp.
- No immutable Review Event exists.
- Progress is derived, not persisted.
- Bundle removal preserves Learning Records.
- Full DB deletion removes Learning Records.
- Current learning data is device-local.
- Query-log consent does not authorize learning telemetry.
- Offline operation is mandatory.

---

## 8. Decision framework

Score each candidate **1–5** on each criterion.

### Favorable-high criteria (higher is better)

1. Immediate user value
2. Compatibility with current identities
3. Offline suitability
8. Reversibility
9. User-facing completeness of an MVP
10. Foundation value for later systems
13. Ability to validate locally

### Unfavorable-high criteria (higher is worse)

4. Dependence on unavailable corpus data
5. Need for schema migration
6. Implementation complexity
7. Risk of misleading learning claims
11. Privacy risk
12. Operational burden
14. Opportunity cost (valuable alternatives delayed)

No unexplained aggregate score. Net reading uses qualitative dominance plus
owner keep-building preference among evidence-weak but buildable options.

---

## 9. Candidate comparison matrix

| Candidate | Kind | Imm. value↑ | Identity fit↑ | Offline↑ | Corpus dep.↓ | Schema↓ | Complexity↓ | Misleading↓ | Reversible↑ | MVP complete↑ | Foundation↑ | Privacy↓ | Ops↓ | Local validate↑ | Opp. cost↓ | Net reading |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **H Guided Sessions (selected)** | User-facing | 4 | 5 | 5 | 1 | 1 | 2 | 2 | 5 | 5 | 3 | 1 | 1 | 4 | 2 | Best post-LS3 learning-control path |
| A Local Portability | User-facing | 3 | 4 | 5 | 1 | 3 | 4 | 1 | 3 | 4 | 4 | 4 | 3 | 3 | 3 | Strong runner-up; import semantics heavy |
| B Learning History | Prerequisite / weak UX | 2 | 4 | 5 | 1 | 4 | 4 | 3 | 3 | 2 | 5 | 4 | 3 | 2 | 4 | Infrastructure without clear consumer |
| C Review Scheduling | User-facing | 2 | 3 | 3 | 1 | 4 | 5 | 5 | 2 | 2 | 4 | 3 | 4 | 1 | 5 | Premature; due-state + clock + evidence |
| D Organization | User-facing | 1 | 3 | 5 | 1 | 4 | 3 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | 4 | No collection-management evidence |
| E Richer lexical | Corpus/data program | 3 | 5 | 5 | 5 | 1–4* | 2–5* | 2 | 3 | 2 | 4 | 1 | 2 | 3 | 4 | Corpus-constrained, not Learning UI milestone |
| F Source-language objects | Architecture + corpus | 2 | 1 | 4 | 5 | 5 | 5 | 2 | 2 | 1 | 4 | 1 | 3 | 2 | 5 | Blocked: no genuine source lexicon |
| G Translation relationships | Architecture | 2 | 1 | 4 | 4 | 5 | 5 | 3 | 2 | 1 | 3 | 1 | 3 | 2 | 5 | Blocked on relation identity |
| I Usage-evidence-only pause | Operational | 1 | 5 | 5 | 1 | 1 | 1 | 1 | 5 | 1 | 2 | 1 | 2 | 2 | 5 | Rejected by owner keep-building posture |

\* Low if surfacing already-present fields; high if requiring audio/morphology/new corpus.

**Judgment:** Guided Sessions dominate on immediate learning-control value,
identity compatibility, zero schema migration, offline suitability,
reversibility, and MVP completeness. Local Portability is the closest rival as
protection for accumulating personal state, but import/merge/privacy scope is
heavier and value depends more on assumed accumulation/risk than on a gap in
the shipped learning loop. Scheduling remains the wrong default after Progress.

---

## 10. Local Learning Portability analysis

Kind: **user-facing capability** (local only; not cloud sync).

### User harm without portability

Browser storage clear or device replacement permanently destroys Learning
Records. Full DB deletion already does this by design. As LS1–LS3 state
accumulates, that harm grows.

### Can portability preserve LS1–LS3 state?

Yes, in principle: export Learning Records with schema version, identity,
status, timestamps, counts, display cache, and content stamps. Destination
dictionary resolution remains live; unresolved rows must remain representable.

### Critical open design questions

| Question | Assessment |
| --- | --- |
| Dictionary in export? | Prefer Learning Records only; dictionary remains installable separately |
| Unresolved representation | Must export identity + display cache + stamps |
| Compatibility metadata | schema_version, app/bundle ids, content stamps |
| One bundle vs all | Prefer one-file-per-bundle or explicit multi-bundle package with scopes |
| Destination missing dictionary | Import Learning Records; rows unresolved until dictionary present |
| Different content hash | Resolve by live entry; do not rewrite identity |
| Duplicates / restore mode | Needs merge vs replace vs user-selected — high product complexity |
| Malformed / future versions | Validated import with reject/skip rules |
| Display cache | Include for unresolved fallback; not lexical authority |
| Sensitive vocabulary | Export exposes personal study vocabulary — privacy warning required |
| Encryption | Not required for MVP if local file + explicit user consent/warning |
| Export-only | **Rejected** — creates unrestorable “backup” illusion |

### Export-only vs export + validated import

```text
export-only → rejected (unrestorable)
export + validated import → coherent MVP, but merge/replace semantics are hard
```

### Portability conclusion

Serious and increasingly valuable. Not selected now because:

1. no repository evidence of large accumulated Learning state or backup demand;
2. import/merge/versioning is a full product surface, not a thin follow-on;
3. the post-LS3 learning loop still has a clearer product gap: Progress cues
   are not actionable as session filters.

**Runner-up.** Revisit after Guided Sessions or when personal-state risk becomes
concrete.

---

## 11. Learning History analysis

Kind: primarily **architectural prerequisite** for defensible scheduling /
trends; not automatically a user-facing capability.

Conceptual shape only (not selected/implemented):

```ts
type LearningReviewEvent = {
  event_id: string;
  bundle_id: string;
  ir_id: string;
  outcome: "still_learning" | "remembered";
  reviewed_at: string;
};
```

### Immediate consumer?

No repository evidence that users need a timeline, recent activity feed, or
per-word history today. Without that consumer, History is infrastructure-first.

### Open risks

- Offline `event_id` generation and duplicate-write protection.
- Clock rollback vs insertion order.
- Deletion policy vs Learning Record remove / bundle remove / DB delete.
- Migration: current aggregate `review_count` cannot reconstruct past events.
- Creates sensitive behavioral timelines.
- Increases future sync reconciliation complexity.

### History conclusion

Rejected for now: no defined immediate user-facing consumer. May return as a
prerequisite if scheduling or personal history becomes the product goal.

---

## 12. Review Scheduling analysis

Kind: **user-facing capability**, but data/policy heavy.

### User problem

Make large collections tractable and space reviews over time.

### Why not now

- No evidence that all-item deterministic Review is burdensome.
- Latest status/count/timestamp is weak for responsible interval policy.
- Due-state identity, clock policy, offline backlog, unavailable rows, and
  bundle reinstall interactions are undefined.
- Remembered must not silently become “mastered longer interval.”
- Algorithmic SRS (SM-2, FSRS, etc.) is not justified by external prestige.
- Validation requires longitudinal use that the repository does not have.

Compare:

```text
simple user-visible interval policy  → still needs clock + due identity
algorithmic spaced repetition        → opaque; higher misleading-risk
```

### Scheduling conclusion

Premature. Rejected for now. Must not be selected merely because Review and
Progress exist.

---

## 13. Collection Organization analysis

Kind: **user-facing capability**.

No repository evidence that one active-bundle list is difficult, or that users
organize by lesson/topic/project. Tags create identity/ownership/deletion
questions and may fragment Review entry points.

### Organization conclusion

Rejected for now: no plausible collection-management problem evidenced yet.

---

## 14. Richer Lexical Support analysis

Kind: primarily **corpus/data program**, sometimes thin rendering work.

Current Review already surfaces live senses/glosses/examples/variants when
present. Documented gaps (lemma coverage, sense ambiguity, sparse examples, no
audio/morphology, N’Ko sparsity) are mainly authoritative source constraints.

Separate:

```text
rendering or interaction defect  → Learning UI possible if data already present
authoritative corpus deficiency  → not a Learning System UI milestone
```

### Lexical-support conclusion

Valuable, but not selected as the next Learning System capability. Treat as
corpus/roadmap work unless a specific already-available field is proven missing
from Review rendering.

---

## 15. Source-Language Learning Object analysis

Kind: **architecture decision + corpus program**.

No genuine independently authoritative English/French lexicon record exists in
the Learning model. `index_mapping` must not be treated as a lexicon object.
Identity, bundle ownership, multi-target linking, and independent Review are
undefined.

### Source-object conclusion

Blocked. `LSN1_ARCHITECTURE_DECISION_REQUIRED` would apply if this were forced
now; it is rejected rather than selected.

---

## 16. Translation-Relationship analysis

Kind: **architecture decision**.

Is the learned object a word or a bilingual relation? Relation identity, sense
cardinality, prompt direction, update behavior, and coexistence with
`(bundle_id, ir_id)` are unresolved. Do not overload current identity.

### Translation-relationship conclusion

Blocked on identity coherence. Rejected for now.

---

## 17. Guided Learning Sessions analysis

Kind: **user-facing capability**.

Distinct from scheduling: user-selected session filter, not algorithmic
due-state.

### Potential MVP

```text
Choose what to review:
- New saved words
- Still learning
- Remembered
- All reviewable
```

Optional bounded session size:

```text
5
10
All
```

### Required answers

| Question | Answer |
| --- | --- |
| Useful control without persistent state? | Yes — choice applies to one fresh ephemeral session |
| Uses current status + LS2 queue order? | Yes — filter then existing deterministic order |
| Schema changes? | No |
| Preserve ephemeral sessions? | Yes |
| Unavailable / malformed? | Excluded as today; do not invent new eligibility |
| Remembered selection imply mastery? | No — copy must remain self-assessment language |
| Session-size truncation fair? | Yes if deterministic prefix of filtered queue |
| Fragment canonical Review action? | Risk — MVP must keep Saved Vocabulary canonical; choice attaches to Start/Continue or an adjacent explicit chooser |
| Make Progress cues actionable? | Yes — primary product rationale |
| Choice worth interaction cost? | Yes if default remains current Start/Continue full-queue behavior |

### Strengths

- user-facing;
- no schema migration;
- uses current status buckets and queue;
- turns LS3 return cues into explicit control;
- offline and reversible;
- validates locally via Playwright/Vitest without longitudinal field use.

### Risks

- added choice complexity;
- may appear to duplicate deterministic queue behavior if poorly framed;
- session-size rules must be exact and deterministic;
- copy must not invent due/mastery language.

### Guided-session conclusion

Selected. Completes the post-LS3 orientation → action path with the smallest
coherent Learning capability that preserves identities and offline guarantees.

---

## 18. Other evidence-supported candidate

No stronger repository-supported Learning direction emerged beyond the
candidate set. Usage-evidence-only pause is rejected by owner keep-building
posture. Phase 7N search evidence does not identify a Learning feature demand.

---

## 19. Privacy analysis

| Candidate | New sensitive data? |
| --- | --- |
| Guided Sessions | No new stored fields; session choice ephemeral |
| Local Portability | Yes — export file exposes vocabulary + learning state |
| History | Yes — behavioral timeline |
| Scheduling | Yes — due-state / review timing patterns |
| Organization | Possibly — topics/lists reveal interests |
| Lexical / source / translation | Mostly dictionary; low new personal sensitivity |

Locked:

> Existing query-log consent does not authorize learning analytics, history
> export, or automatic upload.

No telemetry or cloud upload in LSN1 or the selected LS4 direction.

---

## 20. Dependency graph

```text
Learning Records + LS2 queue groups + LS3 Progress cues
  → enable Guided Review Sessions (selected)
  → independent of History and Scheduling

Learning History
  → optional foundation for defensible Scheduling
  → optional foundation for trends/analytics
  → not a hard prerequisite for Guided Sessions

Local Portability
  → protects accumulated LS1–LS3 data
  → may precede larger schema migrations
  → independent of Guided Sessions
  → does not require cloud sync

Review Scheduling
  → hard need: due-state policy + clock behavior
  → optional foundation: History
  → constrained by longitudinal evidence and collection scale

Authoritative lexical data
  → enables richer Review support
  → enables genuine source-language objects
  → may enable translation relationships
  → independent Learning UI milestone only when data already exists
```

Distinction:

| Edge | Type |
| --- | --- |
| Records/queue/Progress → Guided Sessions | Hard prerequisite (already shipped) |
| History → Scheduling | Optional foundation |
| Portability → future migrations | Optional foundation |
| Lexical corpus → richer Review / source objects | Hard prerequisite for those candidates |

---

## 21. Minimum coherent MVPs

| Candidate | Smallest coherent MVP | Verdict |
| --- | --- | --- |
| Guided Sessions | Choose one existing LS2 queue group and start a fresh session | **Accepted** |
| Local Portability | Versioned local backup export + validated restore for Learning Records | Coherent, not selected |
| History | Append one immutable event per successful reflection + one word-level history view | Rejected: consumer weak |
| Scheduling | Transparent deterministic due policy with user override | Rejected: premature |
| Organization | One active-bundle tag per Learning Record with collection filter | Rejected: no scale problem |
| Richer lexical | One authoritative lexical enhancement proven available in current corpus | Rejected as Learning milestone unless field already present |
| Source objects | Blocked until genuine source lexicon + identity | Rejected |
| Translation relations | Blocked until relation identity | Rejected |

Any “MVP” that leaves the system unrestorable, unusable, or semantically
misleading is rejected (including export-only portability).

---

## 22. Selected direction

```text
LS4 — Guided Review Sessions
```

Product direction, not a technical component: give learners explicit control
over which part of their current collection to review next, without inventing
scheduling.

---

## 23. User problem

After Progress shows Not reviewed / Still learning / Remembered and offers a
return cue, Start/Continue still always enters the full deterministic queue.
The user cannot act on the cue directly (for example, review only new words or
only Still learning) without manually advancing through other groups.

Guided Review Sessions solve that control gap.

---

## 24. Why now

- LS1–LS3 shipped the full orientation loop; cues exist but are not selectable.
- Current status buckets and queue groups already encode the needed filters.
- No schema, history, due-state, or corpus dependency is required.
- Offline reliability and Learning identity remain unchanged.
- Owner keep-building posture authorizes a complete user-facing capability.
- Preferable to scheduling because it provides control without opaque policy.

---

## 25. Rejected-for-now candidates

| Candidate | Why not now |
| --- | --- |
| A Local Portability | Strong runner-up; import/merge/privacy heavier; no evidenced backup demand yet |
| B Learning History | Prerequisite/infrastructure without immediate consumer |
| C Review Scheduling | Premature without due-state policy and longitudinal evidence |
| D Collection Organization | No collection-management pain evidenced |
| E Richer Lexical Support | Primarily corpus/data program |
| F Source-language objects | No genuine source lexicon; identity undefined |
| G Translation relationships | Relation identity undefined; do not overload `(bundle_id, ir_id)` |
| I Evidence-only pause | Rejected by owner continue-building posture |
| Telemetry / cloud sync | Unauthorized; privacy boundary |

---

## 26. Confidence and uncertainty

```text
MODERATE
```

Confidence is moderate because:

- architectural fit and MVP completeness are high;
- natural-use Learning evidence remains absent;
- interaction design (chooser placement, defaults, session-size) can still be
  wrong even if the capability is right.

### Scope constraint from uncertainty

Narrow the MVP to:

- filters that already exist as LS2 queue groups / LS3 status buckets;
- optional deterministic session-size limits;
- no due-state, no opaque ranking, no new persistence;
- default path remains current Start/Continue full reviewable queue;
- copy must not imply mastery, due, or overdue.

---

## 27. Preconditions

Before LS4 implementation:

1. `LS4D0 — Guided Review Sessions Product Definition` is complete.
2. Filters map exactly to existing reviewable queue groups / Progress buckets.
3. Session remains ephemeral; choice does not persist across reloads.
4. Unavailable and inconsistent rows remain excluded as today.
5. Remembered filter language remains self-assessment, not mastery.
6. Saved Vocabulary remains the canonical Review entry point.
7. Offline behavior is defined and testable.
8. No Learning Record schema change is introduced by the MVP.

---

## 28. Stop conditions

Block implementation if:

1. the product definition invents due-state or scheduling under another name;
2. schema migration or Review Events become required for the MVP;
3. session choice becomes a second Learning identity or persisted Progress store;
4. unavailable rows are made reviewable from display cache;
5. Remembered is presented as mastered or due later;
6. Start/Continue identity is fragmented into multiple conflicting entry points
   without a clear canonical surface;
7. a concrete architecture contradiction appears during LS4D0.

Weak usage evidence alone is not a stop condition for Guided Sessions.

---

## 29. Smallest next slice

```text
LS4D0 — Guided Review Sessions Product Definition
```

Decision/research for LSN1 ends here. LS4D0 must define:

- chooser placement relative to Progress / Start / Continue;
- exact filter set and empty-filter behavior;
- optional session-size truncation rules;
- copy (EN/FR constraints);
- focus/navigation;
- offline and reload semantics;
- non-goals (no due-state, no history, no persistence of the choice).

Do not implement Guided Sessions in LS4D0 if that slice is definition-only by
instruction at the time.

Roadmap status for this milestone:

```text
LS3 — Closed
LS4 — Guided Review Sessions — Selected
LS4D0 — Guided Review Sessions Product Definition — Next
```

`docs/ROADMAP.md` has no Learning System status index requiring update.

---

## 30. Explicit non-goals

This LSN1 slice does not implement:

- runtime code;
- UI;
- IndexedDB stores or fields;
- migrations;
- Review Events;
- scheduling;
- export/import;
- tags/lists;
- source-language records;
- translation relationships;
- telemetry;
- cloud sync;
- corpus changes;
- Playwright;
- tests;
- CSS;
- i18n.

This slice only decides.

---

## 31. Repository hygiene

Unrelated featured-anchor work remains uncommitted and was not staged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

This slice stages only:

```text
docs/reports/lsn1_learning_system_post_ls3_decision.md
```

---

## Documentation-only confirmation

This slice changes only documentation (this report). No runtime code, UI,
IndexedDB schema, tests, Playwright specifications, fixtures, bundles,
catalog, sources, or packages were modified.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LSN1_NEXT_PHASE_SELECTED` |
| Selected direction | `LS4 — Guided Review Sessions` |
| Evidence maturity | `NO_USAGE_EVIDENCE` (constrains scheduling/history/organization; does not block guided filters) |
| Confidence | `MODERATE` |
| Next slice | `LS4D0 — Guided Review Sessions Product Definition` |
| Code changes | None |
