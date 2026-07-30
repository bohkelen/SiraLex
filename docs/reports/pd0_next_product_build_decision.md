# PD0 — Next Product Build Decision

## 1. Decision

```text
PD0_NEXT_BUILD_SELECTED
```

Selected direction:

```text
LP1 — Local Learning Backup and Restore
```

This slice is documentation-only. No runtime code, tests, IndexedDB schema, UI,
CSS, i18n, Playwright, bundles, catalog, source data, or packages were modified.
LS4I1 was **not** started.

Authoritative inputs:

- owner decision after LS4D0 acceptance: do not auto-implement Guided Review;
- `docs/reports/ls4d0_guided_review_sessions_product_definition.md`
- `docs/reports/lsn1_learning_system_post_ls3_decision.md`
- `docs/reports/ls3_progress_return_closure_report.md`
- `docs/reports/ls2_review_and_reflect_closure_report.md`
- `docs/reports/ls1_learning_system_closure_report.md`
- Phase 7N evidence-quality closure and related search reports
- `docs/ROADMAP.md`
- current offline-first and privacy boundaries

---

## 2. Executive finding

LS4 Guided Review Sessions is a coherent, implementation-ready definition, but
its expected product gain is modest: it adds queue filtering to an already
functional Review flow. With `NO_USAGE_EVIDENCE`, there is no proof that users
are frustrated by full-queue Review, need status-specific sessions, or would
accept the chooser without friction. Architectural cleanliness alone does not
justify building.

**Lock:**

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
```

The next product-building decision therefore compares **broader gains** rather
than continuing to extend Review mechanics.

Among practical candidates, **Local Learning Backup and Restore** creates the
clearest non-fabricated user gain: it protects the personal LS1–LS3 state users
can now accumulate against browser clear, device loss, and intentional database
deletion — without requiring proof of Review-session frustration, new Learning
identities, scheduling, or corpus availability.

Lexical content improvement remains strategically vital for the dictionary
product and should continue as a **corpus/data program**, not as a substitute
for protecting personal Learning state. Genuine source-language lexical objects
remain architecture-blocked. Non-Learning search/PWA residuals after Phase 7N
are mostly deferred, hardware-gated, or operational rather than a clearer
immediate personal-value build than backup/restore.

---

## 3. LS4 status lock

LS4D0 remains accepted:

```text
LS4_GUIDED_REVIEW_PRODUCT_DEFINED
```

Implementation posture:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
Do not start LS4I1 unless direct use exposes a clear need for selective Review
```

Obvious gains already captured without Guided Sessions:

- durable vocabulary saving;
- deterministic offline Review;
- immediate reflection persistence;
- truthful Progress and return cues;
- complete offline reload behavior.

Guided filtering improves control, but it does **not**:

- protect data;
- improve lexical content;
- create new learning material;
- solve a demonstrated failure in the current loop.

---

## 4. Decision question

> After closing a durable Save → Review → Progress loop, which next build
> creates the most obvious user gain relative to current pain, implementation
> leverage, and strategic value — without continuing Review mechanics by
> default?

---

## 5. Evidence maturity

```text
NO_USAGE_EVIDENCE
```

for natural Learning Save/Review/Progress use.

Class B structured usability remains search/lookup-focused and does not
authorize Learning demand claims. Phase 7N Round 3 reported no new
`recommend_next` for search. Absence of Learning usage evidence:

- continues to defer LS4 implementation;
- continues to block scheduling/history-as-product;
- does **not** erase the concrete data-loss risk of device-local Learning
  Records with no restore path.

---

## 6. Candidate set

| ID | Candidate | Kind |
| --- | --- | --- |
| A | Local Learning Backup and Restore | User-facing Learning capability |
| B | Lexical Content Improvement | Corpus/data program (+ possible thin runtime surfacing) |
| C | Genuine source-language lexical objects | Architecture + corpus program |
| D | Non-Learning product area (search/discovery/PWA/ops) | Outside Learning System |
| E | LS4 Guided Review Sessions implementation | User-facing Learning capability (defined) |
| F | Evidence-only pause | Operational |

---

## 7. Evaluation framework

Score each candidate **1–5**.

### Favorable-high (higher is better)

1. **Obvious user gain** — clear benefit without inventing unmet Review frustration
2. **Current pain** — present failure, risk, or blocked user outcome in repo evidence
3. **Implementation leverage** — reuses shipped models/UX patterns
4. **Strategic value** — protects or amplifies the long-term product
5. **Offline suitability**
6. **Reversibility / MVP completeness**
7. **Ability to validate without longitudinal Learning usage**

### Unfavorable-high (higher is worse)

8. **Dependence on unavailable corpus / hardware / field logs**
9. **Schema / identity risk**
10. **Privacy / sensitivity expansion**
11. **Opportunity cost** — delays more valuable work
12. **Risk of fabricating demand**

No unexplained aggregate. Net reading uses qualitative dominance under the
owner posture that LS4 must not proceed automatically.

---

## 8. Candidate comparison matrix

| Candidate | Gain↑ | Pain↑ | Leverage↑ | Strategy↑ | Offline↑ | MVP↑ | Validate w/o Learning usage↑ | Corpus/hw dep.↓ | Schema risk↓ | Privacy↓ | Opp. cost↓ | Fabrication↓ | Net reading |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A Backup/Restore (selected)** | 5 | 4* | 4 | 5 | 5 | 4 | 5 | 1 | 3 | 4 | 2 | 2 | Best next build: protects accumulated personal state |
| B Lexical content | 5 | 4 | 3 | 5 | 5 | 2 | 3 | 5 | 2 | 1 | 3 | 2 | Strategic; primarily corpus program, not one runtime slice |
| C Source-language objects | 3 | 2 | 1 | 4 | 4 | 1 | 2 | 5 | 5 | 1 | 5 | 3 | Blocked on identity + authentic source lexicon |
| D Non-Learning area | 3 | 3† | 3 | 4 | 4 | 3 | 3 | 3–5† | 2 | 1 | 3 | 2 | No stronger immediate personal-value build than backup |
| E LS4 Guided Sessions | 2 | 1 | 5 | 2 | 5 | 5 | 3 | 1 | 1 | 1 | 4 | 4 | Defined; deferred pending demonstrated need |
| F Evidence-only pause | 1 | 1 | 5 | 2 | 5 | 1 | 2 | 1 | 1 | 1 | 5 | 1 | Rejected: owner continues building, but not via LS4 |

\* Pain is **risk of irreversible personal data loss**, not measured Review abandonment.  
† Remaining non-Learning items are largely deferred search policy, Android/hardware, production deploy verification, or package/device-gate ops — real, but not a clearer personal Learning-value product than backup.

---

## 9. Candidate analyses

### A — Local Learning Backup and Restore

**User problem:** Learning Records are device-local. Browser storage clear, device
replacement, or full database deletion permanently destroys Save/Review/Progress
state. There is no Learning export/import today (query-log export is a separate
consent boundary and does not restore Learning Records).

**Why gain is obvious without Learning usage evidence:**

- LS1–LS3 already make personal state accumulateable and valuable;
- wipe/delete semantics are implemented and verified;
- absence of restore is a product completeness gap, not a guessed UX preference.

**MVP shape (for later product definition; not implemented here):**

```text
Versioned local backup export + validated restore for Learning Records
```

Export-only is rejected (unrestorable “backup” illusion). Cloud sync is out of
scope. Privacy warnings are mandatory because exports expose vocabulary and
learning state.

**Why now:** Protects the completed LS1–LS3 investment before more personal
state accumulates and before future schema-heavy Learning work.

### B — Lexical Content Improvement

Improves every search hit, saved word, and Review card. Repository evidence
shows lemma gaps, sparse examples, sense ambiguity, no audio/morphology, and
`lexical_blocked` misses. This is primarily a **corpus/data program** (and
Branch C remains deferred until users + data). It should continue in parallel
as content work, but selecting it as the sole “next product build” without an
owner-scoped content package would either:

- under-specify the MVP, or
- sprawl into pipeline/enrichment without a bounded consumer surface.

**Not selected as the primary next runtime product slice.** Remains a standing
strategic program.

### C — Genuine source-language lexical objects

Still blocked: no genuine independently authoritative EN/FR lexicon object;
`index_mapping` must not be treated as one; identity and Save/Review semantics
are undefined. Rejected until architecture + corpus exist.

### D — Non-Learning product area

Phase 7N evidence-quality work closed with no new search `recommend_next`.
Remaining items include Android real-device validation (hardware), production
deploy verification, package/device-gate ops, deferred phrase aliases, and
evidence-gated policies (e.g. plain `Kun`). These matter, but none currently
outweigh protecting irreversible personal Learning data as the next
**product-build** choice under this portfolio comparison.

Uncommitted featured-anchor navigation work remains outside this decision and
must not be mixed into the PD0 commit.

### E — LS4 Guided Review Sessions

Defined and ready, but deferred. Modest expected gain; no demonstrated need.

### F — Evidence-only pause

Rejected as the selected outcome: building continues, but not by defaulting
into Review-filter implementation.

---

## 10. Privacy

| Candidate | Privacy note |
| --- | --- |
| Backup/Restore | Export exposes personal vocabulary + learning state; local-only; warnings required; no upload |
| Lexical content | Dictionary content; low new personal sensitivity |
| Source objects | Architecture/corpus; low personal sensitivity until Learning attaches |
| Non-Learning | Depends on area; query-log remains separate consent |
| LS4 | No new stored personal fields |

Locked:

> Existing query-log consent does not authorize learning analytics, automatic
> upload, or cloud sync of Learning Records.

---

## 11. Dependency graph

```text
LS1 Save + LS2 Review + LS3 Progress
  → create accumulateable personal Learning state
  → make Local Backup/Restore valuable now
  → do not require LS4

LS4 Guided Review Sessions
  → defined
  → deferred pending demonstrated selective-Review need
  → independent of Backup/Restore

Lexical corpus program
  → improves search/save/Review quality continuously
  → independent of Backup/Restore
  → hard prerequisite for source-language objects

Source-language lexical objects
  → hard need: authentic source lexicon + identity decision
  → blocked

Non-Learning residuals
  → mostly ops / hardware / deferred search policy
  → independent portfolio track
```

---

## 12. Selected direction

```text
LP1 — Local Learning Backup and Restore
```

Product direction: let users preserve and restore personal Learning Records
between installations/devices via a versioned local package — offline, without
cloud synchronization.

---

## 13. User problem

Personal Learning state created by Save, Review, and Progress can be destroyed
with no restore path. As that state grows, the cost of loss grows. Backup and
validated restore close that failure mode.

---

## 14. Why now

- LS1–LS3 are closed and already create durable personal data;
- wipe/delete behavior is real and verified;
- no Learning portability exists;
- selecting Backup does not invent Review frustration;
- LS4 remains available if direct use later proves selective Review needed;
- protects personal state before further Learning accumulation or migrations.

---

## 15. Rejected-for-now / deferred candidates

| Candidate | Disposition |
| --- | --- |
| LS4 Guided Review Sessions | **Defined, deferred pending demonstrated need** — do not start LS4I1 |
| Lexical Content Improvement | Strategic corpus program; not the selected runtime product slice |
| Source-language lexical objects | Architecture + corpus blocked |
| Non-Learning residuals | Continue as ops/validation/deferred-policy tracks; not selected here |
| Scheduling / History / Organization | Remain rejected under LSN1/LS3 constraints |
| Evidence-only pause | Not selected |

---

## 16. Confidence and uncertainty

```text
MODERATE
```

Confidence is moderate because backup demand is inferred from irreversible
loss risk rather than observed restore requests. Uncertainty narrows the MVP
to:

- Learning Records only (not full dictionary payloads);
- versioned export + validated import;
- explicit privacy warnings;
- no cloud sync;
- no encryption requirement unless later product-defined;
- merge/replace semantics must be defined before implementation (LP1D0).

---

## 17. Preconditions

Before LP1 implementation:

1. `LP1D0 — Local Learning Backup and Restore Product Definition` is complete.
2. Export-only is rejected; restore is in scope.
3. Package format, schema version, and compatibility metadata are defined.
4. Unresolved-row representation and missing-dictionary restore behavior are defined.
5. Duplicate / merge / replace policy is explicit.
6. Privacy warning and local-only boundary are explicit.
7. Query-log export remains a separate consent surface.
8. LS4 remains deferred; this work must not silently implement Guided Sessions.

---

## 18. Stop conditions

Block LP1 implementation if:

1. restore cannot validate packages safely;
2. import would mutate dictionary authority or invent lexicon content;
3. cloud upload/sync is introduced without a separate decision;
4. export omits restore and ships as “backup”;
5. Learning identity is redefined without necessity;
6. privacy warnings / local-only constraints are dropped.

Demonstrated need for selective Review would reopen LS4, not replace LP1
preconditions.

---

## 19. Smallest next slice

```text
LP1D0 — Local Learning Backup and Restore Product Definition
```

LP1D0 must define package format, export contents, restore validation,
merge/replace, unresolved handling, bundle-scope rules, privacy UX, offline
behavior, EN/FR copy constraints, and non-goals.

Do not implement backup/restore in LP1D0 if that slice is definition-only.

---

## 20. Explicit non-goals for this slice

PD0 does not implement:

- runtime code;
- UI;
- export/import;
- schema/migrations;
- LS4I1 or any Guided Review code;
- corpus changes;
- source-language objects;
- scheduling/history/telemetry;
- cloud sync;
- Playwright/tests/CSS/i18n.

---

## 21. Roadmap status

Locked status strings:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
Next — Product Portfolio Decision
```

After this PD0 selection:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
LP1 — Local Learning Backup and Restore — Selected
LP1D0 — Local Learning Backup and Restore Product Definition — Next
```

`docs/ROADMAP.md` is updated with a Learning System / product-portfolio status
block reflecting this lock.

---

## 22. Repository hygiene

Unrelated featured-anchor work remains uncommitted and was not staged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

This slice stages only:

```text
docs/reports/pd0_next_product_build_decision.md
docs/ROADMAP.md
```

---

## Documentation-only confirmation

This slice changes only documentation (this report and the roadmap status
block). No Learning capability was implemented. LS4I1 was not started.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `PD0_NEXT_BUILD_SELECTED` |
| LS4 posture | Defined, deferred pending demonstrated need |
| Selected build | `LP1 — Local Learning Backup and Restore` |
| Evidence maturity | `NO_USAGE_EVIDENCE` |
| Confidence | `MODERATE` |
| Next slice | `LP1D0 — Local Learning Backup and Restore Product Definition` |
| Code changes | None |
