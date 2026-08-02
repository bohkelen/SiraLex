# PD1 — Next Product Build Decision

## 1. Decision

```text
PD1_NEXT_BUILD_SELECTED
```

Selected next product build:

```text
CF1 — Community Correction and Feedback Capture
```

Parallel release-readiness track (not competing for the same slot):

```text
PV1A — Production Identity and Desktop Smoke
PV1B — Physical Device Validation — hardware-gated
```

This slice is documentation-only. No runtime code, tests, IndexedDB schema, UI,
CSS, i18n, Playwright, bundles, catalog, corpus, source data, packages, or
deployment configuration were modified. LS4I1 was **not** started. Unrelated
featured-anchor work already committed at `b186e41` was not altered.

Authoritative inputs:

- owner clarification that validation and product construction are parallel tracks
- `docs/reports/pd0_next_product_build_decision.md`
- `docs/reports/lp1_local_learning_backup_restore_closure_report.md`
- `docs/reports/ls4d0_guided_review_sessions_product_definition.md`
- `docs/reports/lsn1_learning_system_post_ls3_decision.md`
- `docs/ROADMAP.md` (Phase 1.5A/B complete; UI/moderation still out of scope)
- `shared/specs/correction-record-schema-v1.md`
- `shared/specs/correction-application-dry-run.md`
- `README.md` community feedback loop posture
- `docs/PHASE_7N1_RELEASE_DECISION.md`
- `docs/DEVICE_VALIDATION.md`
- `docs/PHASE_6C_TESTER_PACKET.md`
- Phase 7N evidence-quality closure and related search/content reports
- current offline-first and privacy boundaries

Revision note: an earlier PD1 draft selected validation alone
(`PD1_VALIDATION_MILESTONE_SELECTED`). Owner clarification rejects treating
validation and product construction as mutually exclusive. This document is the
authoritative PD1 record.

---

## 2. Executive finding

LP1 closed the last high-confidence personal-state gap in the Learning loop.
SiraLex already lets users search, inspect entries, save vocabulary, review it,
track progress, and protect that state. What it does **not** yet let them do is
respond when the dictionary is wrong, incomplete, unclear, or missing something.

That is not a speculative problem. A dictionary inevitably exposes spelling
errors, missing translations, weak or misleading glosses, missing examples,
incorrect parts of speech, missing N’Ko, ambiguous senses, and missing entries.
The original product direction explicitly included anonymous suggestions and
corrections. More importantly, the repository has already completed the
**correction record schema** and **dry-run correction pipeline**. ROADMAP states
that the missing layer is the user-facing and moderation side, not the
foundational correction model.

This creates a rare combination:

> Concrete user value + existing architectural foundation + strategic data leverage.

**Lock:** continue building only where gain is concrete. Do not default to LS4
or another Learning System milestone. Do not stop product development merely
because production identity and Android behavior remain unverified. Validation
proceeds in parallel as PV1A now and PV1B when hardware is available.

Corrected conclusion:

> Continue building, but stop extending the already broad Learning system. Build
> the missing community-feedback bridge while production and device validation
> proceed independently.

---

## 3. Current shipped baseline

Product already available in-repo (automated + closure evidence; not equivalent
to confirmed production/device field proof):

| Capability | Status |
| --- | --- |
| Offline dictionary installation | Shipped |
| French/English ↔ Maninka directional search | Shipped |
| Multi-bundle management | Shipped |
| Search-result interpretation UI (Phase 7G) | Shipped |
| EN/FR interface | Shipped |
| Offline Save (LS1) | Closed |
| Saved Vocabulary | Closed |
| Review and Reflect (LS2) | Closed |
| Derived Progress and Return (LS3) | Closed |
| Local Learning backup and restore (LP1) | Closed |
| Local opt-in query logging and export | Shipped |
| Package-based dictionary installation (`.siralex.zip` route) | Built; device gate not started |
| Catalog-driven featured install | Shipped in-repo |
| Correction record schema (Phase 1.5A) | Complete |
| Dry-run correction application pipeline (Phase 1.5B) | Complete |
| User-facing correction / feedback capture | **Missing** |
| Moderation dashboard / committed correction release | Out of scope for CF1 MVP |
| Strict bundle and Learning data boundaries | Locked |

Current featured local identity (repository fact):

```text
bundle_id: bundle_full_20260710_337619ff
content_sha256: sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c
catalog version: norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass
package candidate SHA-256: sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0
```

This decision must not select a capability already shipped under another name.
CF1 is the missing capture/handoff surface over the already-shipped correction
foundation.

---

## 4. Owner posture

Locked for PD1:

- Continue building only where gain is concrete.
- A defined feature does not deserve implementation automatically.
- Infrastructure is not a product unless it serves an immediate user-facing
  capability.
- Corpus work and runtime-product work must be distinguished.
- Operational validation may proceed **in parallel** with product construction;
  it does not monopolize the next-build slot.
- Lack of natural-use evidence lowers confidence and must narrow scope.
- Do not default to LS4.
- Do not default to another Learning System milestone.
- Do not default to cloud sync, scheduling, history, AI, or analytics.
- Validation remains active even when a runtime product build is selected.

LS4 posture remains exactly:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
```

Parallel-track posture:

```text
Release-readiness track: PV1 — Production and Device Validation
Product-build track: CF1 — Community Correction and Feedback Capture
```

---

## 5. Evidence inventory

| Finding | Label |
| --- | --- |
| PD0 selected LP1; LP1 is now `LP1_CLOSED` | repository fact |
| Natural Learning Save/Review/Progress use evidence absent | repository fact |
| Phase 7N evidence-quality track closed; Round 3 had zero search `recommend_next` | repository fact |
| README / product posture includes anonymous suggestions for spelling, translations, examples, POS, N’Ko, and notes | repository fact |
| Phase 1.5A correction schema complete (`shared/specs/correction-record-schema-v1.md`) | repository fact |
| Phase 1.5B dry-run apply pipeline complete (`siralex-corrections-dry-run`) | repository fact |
| ROADMAP: UI/moderation and committed correction releases still out of scope after 1.5A/B | repository fact |
| Branch C / morphology deferred until users, logs, and correction data exist | repository fact / owner directive |
| Current featured bundle in repo is `bundle_full_20260710_337619ff` | repository fact |
| Production deploy verification remains open for current identity | missing evidence |
| Phase 6C packet still has `APP_LINK_REQUIRED_BEFORE_SENDING` | repository fact |
| Phase 7N1 package matrix 0% / `not_ready_for_validation` | repository fact |
| Android Chrome real-device validation pending hardware access | external blocker |
| Historical iPhone validation used older non-7N2B identity | repository fact |
| Controlled Phase 5b search gaps and deferred phrase aliases remain | repository fact |
| Lexical residuals (`fièvre`, `poulet`, `bonjour`, etc.) blocked on owner validation data | repository fact / external blocker |
| Phase 7G interpretability UI shipped | repository fact |
| Source-language Learning objects remain architecture/corpus blocked | repository fact |
| Owner directive: validation and product construction are parallel tracks | owner directive |
| Owner directive: select CF1 as next product build; PV1A/PV1B remain active | owner directive |
| A dictionary will expose content defects to users even without measured complaint volume | inference |
| CF1 drafts are not authoritative lexical evidence until human review | owner directive |

Do not turn an inference into an observed user need. Absence of Learning usage
evidence continues to defer LS4, scheduling, history-as-product, and collection
organization.

---

## 6. Evidence maturity by area

| Product area | Maturity |
| --- | --- |
| Learning usage | `NO_EVIDENCE` |
| Search behavior (natural) | `NO_EVIDENCE` |
| Search behavior (controlled / harness) | `STRUCTURED_TESTER_EVIDENCE` + `AUTOMATED_PRODUCT_EVIDENCE` |
| First-install friction | `STRUCTURED_TESTER_EVIDENCE` (historical/partial); current package route `NO_EVIDENCE` on device |
| Result interpretation | `AUTOMATED_PRODUCT_EVIDENCE` + architectural audit; natural confirmation `NO_EVIDENCE` |
| Offline/device behavior | Desktop automation `AUTOMATED_PRODUCT_EVIDENCE`; current Android `NO_EVIDENCE` |
| Dictionary-management behavior | `AUTOMATED_PRODUCT_EVIDENCE` + historical device notes |
| Lexical/content deficiencies | `ARCHITECTURAL_EVIDENCE` + controlled misses; natural demand `NO_EVIDENCE` |
| Correction capture demand | `ARCHITECTURAL_EVIDENCE` + product-direction evidence; natural complaint volume `NO_EVIDENCE` |
| Correction pipeline readiness | `AUTOMATED_PRODUCT_EVIDENCE` / architectural completeness for schema + dry-run |
| Backup demand | Risk closed by LP1; observed restore requests still `NO_EVIDENCE` |
| Deployment reliability | Missing for current featured identity on live host; older smoke exists for prior bundles |

Do not collapse automated correctness evidence into user-demand evidence.

---

## 7. Current external blockers

| Blocker | Affects | Status |
| --- | --- | --- |
| Physical Android hardware unavailable | PV1B Android matrix; Phase 5b Android completion | external blocker |
| Confirmed deploy URL for Phase 6C | Natural-use field program | missing evidence / operational gap (PV1A) |
| Owner validation data for lexical residuals | Direct corpus packet approval | external blocker / missing evidence |
| Human reviewer for deferred Phase 7I phrase aliases | Phrase-retrieval alias promotion | missing evidence |
| Genuine independently authoritative source lexicon + identity | Source-language Learning objects | architecture prerequisite |

Separate:

```text
validation that can be executed immediately
```

- PV1A: live host `/catalog.json` and featured-bundle identity checks;
- desktop browser production smoke including Learning paths;
- defect logging with identity hashes.

```text
externally blocked validation
```

- PV1B: Android/iPhone physical-device matrix until hardware/tester access.

These blockers constrain PV1B. They do **not** block CF1 definition or local
offline correction-capture implementation.

---

## 8. Candidate classification

| ID | Candidate | Classification |
| --- | --- | --- |
| A | Production Deployment and Device Validation | deployment/validation milestone (parallel track) |
| B | Lexical Content Quality Program | corpus/data program (fed by CF1 exports) |
| C | Search and Discovery Improvement | runtime product capability (evidence-gated) |
| D | Result Interpretation Follow-up | runtime product capability |
| E | Dictionary Distribution and Installation UX | runtime product capability |
| F | LS4 Guided Review Sessions | runtime product capability |
| G | Local Learning Organization | runtime product capability |
| H | Learning Scheduling or History | runtime product capability / research decision |
| I | Genuine Source-Language Lexical Objects | architecture prerequisite (+ corpus) |
| J | Local Data Portability Beyond Learning | operational tooling / runtime capability |
| **CF1** | Community Correction and Feedback Capture | **runtime product capability** |
| K | Sentence analysis / Branch C linguistic depth | research decision / deferred linguistic program |

CF1 is a capture-and-handoff product, not a moderation ecosystem and not a
corpus-edit feature.

---

## 9. Evaluation framework

Score each candidate **1–5**.

### Favorable-high (higher is better)

1. Immediate user gain
2. Evidence of current pain
3. Strategic leverage
4. Offline compatibility
5. Fit with existing identities and architecture
6. MVP completeness
7. Ability to validate without fabricated demand
8. Time to meaningful user outcome
9. Breadth of users helped
10. Whether the work unlocks real-world adoption / later evidence

### Unfavorable-high (higher is worse)

11. Dependency on unavailable corpus data
12. Dependency on unavailable hardware or external access
13. Schema or migration risk
14. Privacy risk
15. Operational burden
16. Opportunity cost
17. Risk of misleading language or learning claims

Decisive weights for revised PD1:

1. concrete user-facing gain that is not another Learning extension;
2. reuse of existing architectural foundation;
3. strategic leverage into lexical/search evidence;
4. offline fit and low semantic risk;
5. independence from Android hardware;
6. parallel compatibility with PV1.

Validation is scored as a parallel necessity, not as the sole winner of the
product-build slot.

---

## 10. Candidate comparison matrix

| Candidate | Gain↑ | Pain↑ | Leverage↑ | Offline↑ | Fit↑ | MVP↑ | No fabricate↑ | Time↑ | Reach↑ | Adoption/evidence↑ | Corpus dep.↓ | Hw dep.↓ | Schema↓ | Privacy↓ | Ops↓ | Opp. cost↓ | Misleading↓ | Net reading |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **CF1 (selected build)** | 5 | 4* | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 5 | 1 | 1 | 3 | 3 | 3 | 2 | 2 | Best product build: capture bridge over Phase 1.5 |
| A PV1 (parallel) | 4 | 5 | 5 | 5 | 5 | 4 | 5 | 5† | 5 | 5 | 1 | 4‡ | 1 | 1 | 3 | 2 | 1 | Required release-readiness track; not exclusive |
| B Lexical quality | 5 | 4 | 5 | 5 | 4 | 2 | 3 | 2 | 5 | 3 | 5 | 1 | 2 | 1 | 4 | 3 | 2 | Strategic corpus program; CF1 feeds it |
| C Search/discovery | 3 | 3 | 3 | 5 | 3 | 2 | 2 | 2 | 4 | 3 | 4 | 1 | 3 | 1 | 3 | 3 | 3 | Needs correction/log evidence first |
| D Result interpretation | 3 | 2 | 3 | 5 | 4 | 3 | 2 | 3 | 3 | 2 | 3 | 1 | 2 | 1 | 2 | 3 | 2 | 7G shipped; remaining needs better data |
| E Install UX | 3 | 3 | 3 | 5 | 4 | 3 | 3 | 3 | 4 | 4 | 1 | 4‡ | 2 | 1 | 3 | 3 | 1 | Observe under PV1 first |
| F LS4 | 2 | 1 | 5 | 5 | 5 | 5 | 1 | 4 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 4 | 2 | Deferred pending demonstrated need |
| G Organization | 2 | 1 | 3 | 5 | 4 | 2 | 1 | 3 | 1 | 1 | 1 | 1 | 3 | 2 | 2 | 4 | 1 | No collection-scale evidence |
| H Scheduling/History | 2 | 1 | 2 | 4 | 2 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 5 | 4 | 4 | 5 | 5 | Deferred; mastery-claim risk |
| I Source objects | 3 | 2 | 1 | 4 | 1 | 1 | 2 | 1 | 2 | 1 | 5 | 1 | 5 | 1 | 4 | 5 | 3 | Architecture-blocked |
| J Broader portability | 2 | 1 | 3 | 5 | 3 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 3 | 4 | 3 | 4 | 2 | No demand beyond LP1 |
| K Sentence analysis | 2 | 1 | 1 | 3 | 1 | 1 | 1 | 1 | 2 | 1 | 5 | 1 | 4 | 1 | 5 | 5 | 5 | Deferred linguistic depth |

\* Pain is the inevitable inability to report dictionary defects, grounded in
product direction and content-defect classes, not measured complaint volume.
† PV1A is immediately executable.
‡ Hardware dependency applies to PV1B / install-device proof, not to CF1.

---

## 11. Production deployment / device validation

### Required answers

| Question | Answer | Label |
| --- | --- | --- |
| Is current public deployment confirmed for intended bundle/app? | No confirmed record for 7N2B + post-LP1 app | missing evidence |
| Does production installation work on intended browsers? | Older smokes exist; current identity unverified | missing evidence |
| Is Android real-device offline behavior still unverified? | Yes | external blocker + missing evidence |
| Are automated browser tests sufficient to infer mobile reliability? | No | owner directive |
| Does production failure prevent every other feature from delivering value? | It reduces real-user reach; it does not freeze all local product construction | owner directive (revised) |
| Can required validation be performed now? | PV1A yes; PV1B no until hardware | mixed |
| Is deployment verification a bounded milestone? | Yes, as PV1A/PV1B | this decision |

### Conclusion

PV1 remains necessary and active. It does **not** justify stopping product
development while desktop validation proceeds or Android hardware is
unavailable. Split:

```text
PV1A — Production Identity and Desktop Smoke
PV1B — Physical Device Validation — hardware-gated
```

---

## 12. Lexical content quality

Lexical quality has very high leverage because it improves search, entries,
Saved Vocabulary, and Review. Repository evidence shows lemma gaps, sparse
examples, sense ambiguity, deferred residuals, and blocked owner-data items.

But “improve the dictionary” is not a bounded software feature. Authoritative
content review remains the bottleneck. Earlier portfolio analysis reached the
same conclusion.

### Conclusion

Keep lexical quality as **Track C — Corpus improvement**. CF1 is the product
mechanism that can feed that program through exported, human-reviewed
correction packets rather than guessing content in the runtime.

---

## 13. Search and discovery

Controlled search gaps remain, especially phrases and inflections. Several
proposed changes remain blocked by review or risk false positives. ROADMAP keeps
linguistic inference and morphology deferred until users, logs, and correction
data exist.

### Conclusion

Do not select fuzzy search, AI query interpretation, embeddings, ranking
scores, or automatic morphology. CF1 helps generate the missing evidence instead
of inventing new search rules.

---

## 14. Result interpretation

Phase 7G already implemented the first major interpretability layer. Remaining
ambiguity likely requires stronger sense data and usage examples, not merely
more interface labels. ROADMAP identifies unresolved multi-result
differentiation but says it needs further confirmation.

### Conclusion

Reject RI2 as the primary next build. Better correction/example data from CF1
and later corpus review is the higher-leverage path.

---

## 15. Installation and management

Installation and package/catalog paths should be observed under PV1. Building
another installation redesign before testing the current package and catalog
paths would be premature.

### Conclusion

Not selected as the product-build track. Defects discovered in PV1A/PV1B may
later justify a bounded DX slice.

---

## 16. LS4 Guided Review Sessions

Exact posture:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
```

The existing Learning system is broad enough and requires real use before more
Review controls are added. Existence of LS4D0 is not evidence.

### Conclusion

LS4 remains deferred. CF1 does not implement Guided Sessions.

---

## 17. Learning scheduling / history

No longitudinal Learning use evidence. Latest status, count, and timestamp are
not proof that due-state is needed. Privacy and mastery-claim risks remain high.

### Conclusion

Default disposition remains deferred.

---

## 18. Source-language objects

Nothing material changed since PD0/LSN1. Keep blocked. Do not use
`index_mapping` as a source lexicon. CF1 attaches to genuine dictionary entries
already addressable by `bundle_id` + `ir_id`.

---

## 19. Broader portability

LP1 already covers Learning backup. CF1 export is a **correction packet**, not
a full-database backup, not a dictionary package, and not a query-log export.
Keep those boundaries strict.

---

## 20. Other repository-supported candidate

### Sentence analysis / Branch C

Sentence analysis remains part of the broad original vision, but it is not the
responsible next build. Producing “best-guess” Maninka sentences requires phrase
authority, morphology, compositional rules, uncertainty semantics, and
significantly stronger language evidence. ROADMAP keeps that linguistic depth
deferred rather than allowing the runtime to invent language.

### CF1 as Candidate K / selected build

CF1 is the strongest repository-supported next **runtime product** because:

- product direction already names the feedback loop;
- Phase 1.5A/B foundation exists;
- UI/moderation gap is explicitly recorded;
- offline local capture can ship without Android hardware;
- exports feed later lexical/search work without claiming authority.

---

## 21. Candidate MVPs

### CF1 — selected

```text
From a genuine dictionary entry, capture a structured local correction
suggestion with issue type, current/proposed values, explanation, and stable
entry context; allow pending review/edit/delete; export a deterministic
correction packet for external human review into the existing correction
pipeline — without modifying the installed dictionary
```

Loop:

```text
Entry detail
  → Suggest a correction
  → choose issue type
  → enter proposed correction and explanation
  → save locally
  → review pending suggestions
  → export correction packet
  → external human review
  → existing correction pipeline
```

### PV1 — parallel

```text
PV1A: confirm production identity and complete desktop production smoke
PV1B: execute physical-device matrix when hardware is available
```

### Rejected primary MVPs

- Lexical: one reviewed domain/packet — corpus track, not CF1 substitute
- Search: one reviewed phrase mechanism — blocked on approved data
- Result interpretation: surface one authoritative distinguishing field — premature
- Install UX: resolve one measured failure — observe under PV1 first
- LS4: status-filtered Review — deferred
- Sentence analysis: rejected as inventing language under current evidence

Rejected vague MVP shapes: “improve UX”, “improve content”, “make search
smarter”, “add AI”, “build analytics”, “prepare for sync.”

---

## 22. Dependency graph

```text
Production deployment (PV1A)
  → enables real-user access                         [hard prerequisite for field use]
  → enables natural-use evidence                     [evidence prerequisite]
  → informs search/content/Learning priorities       [evidence prerequisite]
  → independent of CF1 local implementation          [independent]

Physical device validation (PV1B)
  → hard prerequisite: hardware access               [hard prerequisite / external]
  → independent of CF1 definition/implementation     [independent]

CF1 local correction capture
  → optional foundation for later lexical packets    [optional foundation]
  → evidence prerequisite for many search rule changes [evidence prerequisite]
  → does not auto-apply to dictionary                [independent constraint]
  → hard fit: genuine lexicon_entry identity         [hard prerequisite]

Authoritative corpus enrichment
  → improves search results                          [optional foundation]
  → improves entry detail                            [optional foundation]
  → improves Saved Vocabulary / Review cards         [optional foundation]
  → hard need: human review of CF1 exports           [hard prerequisite]

Natural Learning use
  → may justify LS4                                  [evidence prerequisite]
  → may justify History or Scheduling later          [evidence prerequisite]

Source-language corpus + identity
  → prerequisite for source-language Learning objects [hard prerequisite]
```

Reinforcing loop:

```text
Production access
  → real use
  → correction submissions and query evidence
  → reviewed lexical improvements
  → better search, entries, Saved Vocabulary, and Review
```

---

## 23. Opportunity cost

| If selected | Delayed | Trade-off |
| --- | --- | --- |
| **CF1 (selected build)** | Immediate LS4/search/RI coding; direct corpus edits without capture path | Builds the feedback bridge; feeds Track C; does not extend Learning by default |
| PV1 alone as exclusive next work | All product construction | Rejected: too restrictive; validation remains parallel instead |
| Lexical quality as sole build | Capture surface + validation attention | Improves content but lacks a bounded runtime consumer and owner-packet readiness |
| Search improvement | CF1 evidence generation | Risks false positives without correction/log evidence |
| Result interpretation | Data enrichment | Likely duplicates 7G without stronger sense/example data |
| Install UX rewrite | Measured PV1 defects | Premature before package/catalog observation |
| LS4 | Broader dictionary value | Improves control for an unproven problem |
| Sentence analysis | Almost all nearer gains | High invention risk; deferred linguistic depth |

---

## 24. Selected direction

```text
PD1_NEXT_BUILD_SELECTED
CF1 — Community Correction and Feedback Capture
```

Classification: **runtime product capability** (capture and handoff).

Parallel validation:

```text
PV1A — Production Identity and Desktop Smoke
PV1B — Physical Device Validation — hardware-gated
```

---

## 25. User problem

Users can discover dictionary defects while searching and reading entries, but
they have no local, offline, structured way to propose a correction or note
missing information. The backend correction model already exists; the missing
product surface prevents both immediate user agency and disciplined later
lexical improvement.

---

## 26. Evidence and confidence

Evidence supporting the problem and selection:

- README / product direction names anonymous suggestions/corrections;
- ROADMAP Phase 1.5A/B complete with UI/moderation still missing;
- correction schema and dry-run pipeline are implemented;
- Branch C explicitly waits for correction data among other prerequisites;
- controlled lexical/search gaps show content defects exist even without
  natural-use complaint volume;
- Learning natural-use evidence remains absent, so LS4 stays deferred;
- owner directive establishes parallel validation rather than exclusive
  validation.

```text
Confidence: HIGH
```

Uncertainty narrows CF1 to local non-authoritative capture/export, not
auto-apply, upload, moderation UI, or linguistic judgment.

---

## 27. Why now

- LS1–LS3 and LP1 already cover a broad Learning loop.
- Extending Learning further would prefer adjacency over unmet dictionary agency.
- Phase 1.5 foundation makes CF1 unusually low-waste relative to greenfield work.
- CF1 can proceed offline without Android hardware.
- PV1A/PV1B can proceed in parallel without freezing construction.
- CF1 produces the evidence later lexical/search work claims to need.

---

## 28. Expected gain

Visible / product gains:

- users can record structured correction suggestions offline;
- pending suggestions remain editable before export;
- exports hand off into the existing correction pipeline after human review;
- installed dictionary remains unchanged by suggestions;
- later lexical, search, N’Ko, and interpretability work gain reviewed inputs;
- production/device validation continues independently toward real adoption.

---

## 29. Scope constraint

Uncertainty and owner posture narrow CF1 MVP to:

- local-first capture only;
- non-authoritative suggestions;
- genuine dictionary entries only;
- structured issue categories;
- deterministic export packet;
- explicit “does not modify installed dictionary” warning;
- no server upload, accounts, cloud sync, voting, AI generation, or moderation
  dashboard in CF1;
- no automatic application to IR/bundles;
- no Learning-system expansion.

PV1 remains split so hardware unavailability cannot block PV1A or CF1.

---

## 30. Rejected-for-now candidates

| Candidate | Disposition | Reason | Missing evidence | Prerequisite | Trigger for reconsideration |
| --- | --- | --- | --- | --- | --- |
| A PV1 as exclusive next build | Active parallel track; not exclusive | Validation matters but must not freeze construction | Current host identity; Android runs | PV1A now; hardware for PV1B | Defects may spawn bounded DX work later |
| B Lexical quality as primary runtime build | Standing corpus Track C | Unbounded without approved packet; CF1 feeds it | Owner-approved domain/packet | Human review + rebuild path | Approved LQ packet with exit criteria |
| C Search/discovery | Deferred | Alias/review blockers; false-positive risk | Natural-use misses; approved aliases | Reviewed data + fixed corpus | Approved phrase/data packet or repeated natural misses |
| D Result interpretation follow-up | Deferred | 7G shipped; remaining needs data/confirmation | Tester ambiguity reports | Stronger sense/example data or 6C | Confirmed residual ambiguity for existing fields |
| E Install UX | Deferred as rewrite | Observe under PV1 first | Measured current-path failures | PV1A/PV1B observations | Specific reproducible install failure |
| F LS4 | Defined, deferred pending demonstrated need | Learning already broad; no selective-Review need | Large collections or user requests | Natural Learning use | Real collections large or explicit status-filter requests |
| G Organization | Deferred | No retrieval/scale pain | Collection-size complaints | Natural Learning use | Users cannot find saved items at measured scale |
| H Scheduling/History | Deferred | No longitudinal use; claim risk | Return/forget evidence; due-state decision | History/clock/privacy decisions | Longitudinal Review usage + explicit due-state decision |
| I Source objects | Blocked | No authoritative source lexicon/identity | Source corpus + identity semantics | Architecture + corpus program | Authoritative source lexicon and identity architecture exist |
| J Broader portability | Deferred | LP1 boundaries sufficient | Migration needs beyond Learning | Keep package/log/settings/correction separation | Concrete transfer need not solved by existing artifacts |
| K Sentence analysis / Branch C | Deferred | Would invent language under weak evidence | Users, logs, correction data | Stronger linguistic authority | Explicit Branch C entry criteria met |

---

## 31. Preconditions

Before CF1 implementation beyond definition:

1. `CF1D0` defines draft model, categories, local store, export packet contract,
   privacy warnings, offline behavior, EN/FR copy, and non-goals.
2. Suggestions attach only to genuine `lexicon_entry` records with stable
   `bundle_id` / `ir_id` / content hash or storage-scope context.
3. Export format relationship to `correction_record_v1` / correctionset handoff
   is explicit; CF1 drafts are not silently treated as `approved`.
4. Installed dictionary mutation is forbidden in CF1.
5. Query-log consent remains separate from correction export.
6. Learning backup remains a separate package family.
7. LS4 remains deferred; CF1 must not implement Guided Sessions.
8. PV1A/PV1B remain active parallel tracks and are not redefined as CF1 work.
9. No anonymous server upload is introduced without a separate decision.

---

## 32. Stop conditions

Block or halt CF1 implementation if:

1. suggestions would mutate installed dictionary authority;
2. exported drafts are treated as approved lexical evidence without human review;
3. cloud upload/sync/accounts are introduced without a separate decision;
4. AI-generated corrections or automatic linguistic judgment are added;
5. moderation dashboard scope expands CF1 beyond capture/handoff;
6. Learning identity or Review mechanics are redefined without necessity;
7. privacy warnings / local-only constraints are dropped;
8. CF1 is used as a vehicle to start LS4, scheduling, or sentence analysis.

---

## 33. Smallest next slice

```text
CF1D0 — Community Correction and Feedback Product Definition
```

CF1D0 must define:

- issue-type taxonomy;
- draft suggestion fields and validation;
- local persistence model and identity;
- pending-list edit/delete semantics;
- export packet schema and determinism;
- relationship to Phase 1.5 correction records / correctionsets;
- non-authoritative boundary and user-facing warnings;
- offline behavior;
- EN/FR copy constraints;
- privacy boundary;
- explicit non-goals;
- proposed implementation slices CF1I1–CF1I6.

Do not implement capture/export UI in CF1D0 if that slice is definition-only.

Parallel validation naming remains:

```text
PV1A — Production Identity and Desktop Smoke
PV1B — Physical Device Validation — hardware-gated
```

---

## 34. Explicit non-goals

PD1 does not implement:

- runtime features;
- corpus changes;
- bundle rebuilds;
- deployment changes;
- tests;
- Playwright;
- schema changes;
- UI;
- CSS;
- i18n;
- cloud sync;
- AI;
- telemetry;
- scheduling;
- LS4;
- source objects;
- moderation dashboard;
- automatic correction application.

This slice decides only.

### CF1 MVP inclusions (for later implementation; not done here)

- Suggest correction from a genuine dictionary entry.
- Structured categories: spelling; translation/gloss; example; part of speech;
  N’Ko; missing information; other note.
- Stable context: `bundle_id`; `ir_id`; content hash/storage scope; field or
  sense challenged; current displayed value; proposed value; explanation;
  timestamp.
- Local pending suggestions list with edit/delete before export.
- Deterministic JSONL or versioned correction packet export.
- Full offline operation.
- Warning that a suggestion does not modify the installed dictionary.
- EN/FR interface.

### CF1 MVP exclusions

- automatic application;
- anonymous server upload;
- accounts;
- cloud synchronization;
- public comments;
- voting;
- AI-generated corrections;
- automatic linguistic judgment;
- moderation dashboard;
- changing the live dictionary directly;
- treating user suggestions as authoritative evidence.

---

## 35. Repository hygiene

This revision stages only:

```text
docs/reports/pd1_next_product_build_decision.md
docs/ROADMAP.md
```

Roadmap update records:

- LP1 closed;
- PD1 complete with CF1 selected;
- CF1D0 next;
- PV1A/PV1B parallel validation status.

Unrelated featured-anchor work at `b186e41` remains excluded.

### Revised portfolio structure

```text
Track A — Product construction
CF1 — Community Correction and Feedback Capture
  CF1D0 — Product Definition
  CF1I1 — Correction Draft Model and Validation
  CF1I2 — Local Correction Store
  CF1I3 — Entry Suggestion Surface
  CF1I4 — Pending Suggestions and Export
  CF1I5 — Offline Lifecycle Verification
  CF1I6 — Closure

Track B — Release readiness
PV1A — Production Identity and Desktop Smoke
PV1B — Physical Device Validation when hardware is available

Track C — Corpus improvement
Human review of exported corrections
  → approved correction artifacts
  → dry-run application
  → reviewed bundle release
```

Locked status strings after revised PD1:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
LP1 — Local Learning Backup and Restore — Closed
PD1 — Next Product Build Decision — Complete
CF1 — Community Correction and Feedback Capture — Selected
CF1D0 — Community Correction and Feedback Product Definition — Next
PV1A — Production Identity and Desktop Smoke — Parallel active
PV1B — Physical Device Validation — Parallel, hardware-gated
```

---

## Documentation-only confirmation

This slice changes only documentation (this report and a narrow roadmap status
update). No runtime, corpus, deployment, test, schema, or UI implementation
occurred. LS4I1 was not started. PV1 remains active in parallel and was not
abandoned.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `PD1_NEXT_BUILD_SELECTED` |
| Selected product build | `CF1 — Community Correction and Feedback Capture` |
| Classification | runtime product capability (capture/handoff) |
| Parallel validation | `PV1A` now; `PV1B` hardware-gated |
| LS4 posture | Defined, deferred pending demonstrated need |
| Evidence maturity (Learning natural use) | `NO_EVIDENCE` |
| Confidence | `HIGH` |
| Next slice | `CF1D0 — Community Correction and Feedback Product Definition` |
| Code changes | None |
