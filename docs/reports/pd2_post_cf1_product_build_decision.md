# PD2 — Post-CF1 Product Build Decision

## 1. Decision

```text
PD2_PRODUCT_BUILD_DEFERRED
```

No new product-build capability is selected for immediate construction.

Active tracks remain:

```text
Release-readiness track
PV1A — Production Identity and Desktop Smoke — Parallel active
PV1B — Physical Device Validation — Parallel, hardware-gated

Product-build track
PD2 — Post-CF1 Product Build Decision — Complete (deferred construction)
Leading deferred candidate when construction resumes:
CF2 — Missing Entry and Search Failure Feedback
```

This slice is documentation-only. No runtime code, tests, IndexedDB schema, UI,
CSS, i18n, Playwright, bundles, catalog, corpus, source data, packages,
deployment configuration, CF2 definition, or CF2 implementation were started.

Authoritative inputs:

- owner acceptance that CF1I6 closed CF1
- `docs/reports/cf1i6_correction_feedback_closure_report.md`
- `docs/reports/cf1d0_community_correction_feedback_product_definition.md`
- `docs/reports/pd1_next_product_build_decision.md`
- `docs/reports/pd0_next_product_build_decision.md`
- `docs/reports/lp1_local_learning_backup_restore_closure_report.md`
- `docs/reports/ls4d0_guided_review_sessions_product_definition.md`
- `docs/ROADMAP.md`
- `docs/PHASE_7N1_RELEASE_DECISION.md`
- `docs/QUERY_VALIDATION_ROUND_1.md`
- `docs/RESULT_INTERPRETABILITY_FEASIBILITY_AUDIT.md`
- Phase 7G–7I phrase/interpretability records
- current offline-first, provenance, and linguistic-evidence gates

---

## 2. Decision question

```text
Given the completed Search, dictionary runtime, offline PWA,
Learning system, LP1 backup/restore, and CF1 correction-feedback loop,
what is the highest-value next user-facing capability that can be built
without violating current linguistic-evidence gates?
```

Answer under current evidence:

```text
None yet.
Temporarily stop product construction.
Convert the already-built product into release and field evidence via PV1.
Reopen construction when a candidate clears the evidence/risk bar.
```

Systems filter retained from CF1:

> Prefer features that either solve a demonstrated user problem or generate
> evidence needed to solve a harder one.

That filter still applies. After CF1, it no longer automatically selects the
next adjacent feedback surface.

---

## 3. Executive finding

CF1 closed the entry-anchored correction loop and stabilized a critical
architecture boundary:

> Dictionary authority and user correction evidence are separate systems.

The product that now exists already covers the core offline dictionary loop,
personal Learning, Learning portability, and non-authoritative correction
capture/export for genuine entries. The scarce resource is no longer “missing
capture UI for defects on existing entries.” The scarce resource is
**validated real-world use** of the stack that already exists.

Selecting CF2 immediately would mostly continue CF1 momentum: the miss path was
explicitly excluded from CF1, so it looks like the obvious next slice. CF1I6
itself records the open field question:

```text
Which search failures indicate missing-entry demand for CF2?
```

That question has not been answered by natural use, production smoke, or device
validation. Controlled Round 1 shows that miss classes exist; it does not show
that a second capture product is the highest-value whole-system move before the
first capture product and release path are exercised.

Result-interpretability follow-up, phrase/sentence work, and deeper dictionary
surfaces either duplicate shipped Phase 7G, violate linguistic-evidence gates,
or belong to corpus/review programs rather than a bounded runtime product slice.

Corrected portfolio posture:

```text
Release-readiness track: continue PV1A now; PV1B when hardware is available
Product-build track: deferred until a candidate clears the post-CF1 bar
Leading resume candidate: CF2 — Missing Entry and Search Failure Feedback
```

This is not a return to “validation monopolizes all work forever.” It is a
temporary stop on **new product construction** because no candidate currently
beats converting the existing product into evidence.

---

## 4. Current product capability map

| Capability | Status | Notes |
| --- | --- | --- |
| Offline dictionary install / catalog / multi-bundle | Shipped | Production identity still PV1A-open |
| Directional FR/EN ↔ Maninka search | Shipped | Controlled gaps remain |
| Offline PWA shell | Shipped | Device release proof still PV1B-open |
| Result interpretability UI (Phase 7G) | Shipped | Residual ambiguity mostly content-bound |
| Phrase-miss review evidence / phrase-alias spec (7H/7I) | Spec/evidence only | Runtime phrase lookup unimplemented; approvals missing |
| Source aliases / supplements / regression gate | Shipped | Content program, not next UX default |
| EN/FR interface | Shipped | 6D1 review residual possible |
| LS1 Save | Closed | |
| LS2 Review and Reflect | Closed | |
| LS3 Progress and Return | Closed | |
| LS4 Guided Review Sessions | Defined, deferred | No demonstrated selective-Review need |
| LP1 Learning backup/restore | Closed | |
| Opt-in local query logging/export | Shipped | Separate consent; not user feedback product |
| Phase 1.5A/B correction schema + dry-run | Complete | No moderation/UI bridge |
| CF1 entry correction capture/export | **Closed** | Stops at unreviewed export boundary |
| Missing-entry / search-failure feedback | Missing | Named CF2; not selected here |
| Correction draft backup/restore | Missing | CF1 residual R4; not selected |
| Governed review → Phase 1.5 conversion bridge | Missing | Ops/tooling; not user-facing product |
| Production identity / desktop smoke | Open | PV1A |
| Physical device validation | Open / hardware-gated | PV1B; 7N1 package matrix 0% |
| Sentence analysis / Branch C | Deferred | Linguistic depth |

Current featured local identity (repository fact; not proven live):

```text
bundle_id: bundle_full_20260710_337619ff
content_sha256: sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c
catalog version: norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass
package candidate SHA-256: sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0
Phase 7N1 package gate: not_ready_for_validation (matrix 0%)
```

---

## 5. Unresolved user journeys

| Journey | Current state | Blocker class |
| --- | --- | --- |
| Discover dictionary defect on an existing entry → report it offline | Solved by CF1 | Needs field use to generate reviewable volume |
| Search returns nothing / wrong miss class → report missing entry or search failure | Unsolved | Product gap (CF2), but demand not field-proven |
| Multi-target result → choose the right sense | Partially solved by 7G | Remaining friction mostly content/data |
| Multiword / phrase lookup | Often fails | Linguistic/review gate; no approved phrase aliases |
| Preserve Learning state across wipe/device change | Solved by LP1 | Needs field use |
| Preserve correction drafts across wipe/device change | Unsolved | Residual R4; low urgency without real drafts |
| Trust production install / offline reopen on phone | Unverified for current identity | PV1A/PV1B |
| See user suggestions become dictionary updates | Outside runtime | Human/governed Phase 1.5 bridge |
| Save/review source-language objects as first-class lexicon | Blocked | No authoritative source lexicon/identity |
| Guided/status-filtered Review | Defined only | No Learning-use evidence |

---

## 6. Candidate set

Candidates come from the roadmap and residual portfolio, not from CF1 adjacency
alone:

| ID | Candidate | Kind |
| --- | --- | --- |
| A | CF2 — Missing Entry and Search Failure Feedback | Runtime product capability |
| B | Result interpretability / explanation improvements | Runtime product capability |
| C | Additional dictionary / content-depth surfaces | Mostly corpus + thin runtime |
| D | Sentence or phrase-oriented functionality | Runtime / linguistic program |
| E | LS4 Guided Review Sessions | Runtime Learning capability |
| F | Correction draft backup / restore | Runtime operational capability |
| G | Install / package / distribution DX | Runtime product capability |
| H | Governed review bridge / Phase 1.5 conversion tooling | Ops/tooling, not end-user product |
| I | Branch C linguistic depth / morphology / inference | Deferred research program |
| J | No new product build yet — focus on PV1 evidence | Portfolio deferral |

---

## 7. Evaluation criteria

Each candidate is judged against:

```text
User value
Evidence that the problem exists
Dependency readiness
Linguistic risk
Architectural leverage
Offline compatibility
Implementation size
Ability to generate useful future evidence
Interaction with CF1 / Learning / Search
Premature-complexity risk
```

Decisive post-CF1 weights:

1. does not violate linguistic-evidence gates;
2. solves a demonstrated user problem **or** generates evidence needed for a
   harder problem;
3. is not selected merely because it was excluded from CF1;
4. does not duplicate an already-shipped surface;
5. remains compatible with parallel PV1;
6. avoids inventing language, ranking, morphology, or sentence analysis.

---

## 8. Evidence inventory

| Finding | Label |
| --- | --- |
| CF1 closed with 29 SATISFIED / 1 DEFERRED_BY_DESIGN / 0 BLOCKED | repository fact |
| CF1 owns capture through export only; nothing after the export boundary | repository fact / architecture lock |
| Missing-entry / search-failure feedback explicitly out of CF1 → named CF2 | repository fact |
| CF1I6 asks which search failures indicate CF2 demand | repository fact / open question |
| Natural Learning use evidence still absent | repository fact |
| Natural correction-draft volume still absent | missing evidence |
| Controlled Round 1 documents missing_entry and phrase_mismatch classes | structured tester evidence |
| Phase 7G interpretability UI already shipped | repository fact |
| Remaining multi-target ambiguity often needs gloss/example data, not more chrome | architectural audit + PD1 carry-forward |
| Phase 7I phrase candidates deferred/rejected; no approved phrase aliases | repository fact |
| Branch C deferred until users, logs, and correction data | roadmap lock |
| Phase 7N1 package matrix 0% / `not_ready_for_validation` | repository fact |
| Production identity for current featured bundle unconfirmed on live host | missing evidence |
| Android real-device validation still hardware-gated | external blocker |
| PV1 has not yet recorded a concrete production/device defect for current identity | missing evidence / not_run |
| LS4 remains deferred pending demonstrated need | repository fact |
| Correction drafts excluded from LP1; no correction import/restore | repository fact (R4) |
| Query-log export already can capture miss telemetry when enabled | repository fact |
| Owner posture from PD1: validation and product construction are parallel tracks | owner directive |
| Owner posture for PD2: do not assume CF2 next; decide from whole-system needs | owner directive |

Do not collapse controlled miss probes into natural missing-entry demand.
Do not collapse CF1 closure into authorization to build CF2.

---

## 9. Candidate comparison

| Candidate | User value | Evidence | Dep. readiness | Linguistic risk | Arch. leverage | Offline | Size | Future evidence | CF1/Learning/Search interaction | Premature-complexity | Net |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A CF2** | High if miss reporting is common | Controlled misses yes; natural demand no; CF1I6 question open | Medium: reuses CF1 patterns, but needs new identity model; Phase 1.5 has no safe new-entry semantics | Medium–high if proposals invent language; lower if scoped to failure reports | High for corpus/search triage | Good | Medium–large | High | Complements CF1; must stay distinct from entry drafts and query logs | High if built from adjacency alone | Leading resume candidate; not selected now |
| B Interpretability follow-up | Moderate | 6C example + audit; 7G already shipped | Medium; data-join limits remain | Low–medium if claims overreach | Medium | Good | Small–medium | Low unless tied to content enrichment | Search UX only; weak CF1 interaction | Medium: more labels without better senses | Reject as primary build |
| C Content-depth surfaces | High if content exists | Lexical residuals exist; owner packets incomplete | Low for authoritative content | High if runtime invents depth | High strategically | Good | Unbounded if treated as one feature | Medium | Improves Search/Learning cards later | High without approved packet | Keep as Track C, not runtime default |
| D Phrase / sentence | High in vision | Phrase misses documented; sentence need speculative | Low: approvals/morphology missing | **Very high** | High long-term | Mixed | Large | Medium only after safe evidence | Search/content; not CF1 | Very high | Reject under current gates |
| E LS4 | Low–moderate | `NO_EVIDENCE` | High definition readiness | Low | Low now | Good | Medium | Low | Learning-only | High fabrication risk | Remain deferred |
| F Correction backup | Moderate protective value | Risk real; real draft volume absent | High pattern reuse from LP1 | Low | Medium | Good | Medium | Low | CF1 residual R4 | Medium without field drafts | Deferred completeness work |
| G Install/package DX | High if current path fails | Package built; device matrix not run | Medium | Low | High for adoption | Good | Unknown until PV1 | High via PV1 | Enables all journeys | High if redesigned before observation | Observe under PV1 first |
| H Review bridge | High for corpus loop | Export exists; conversion gap explicit | Medium for tooling | Low if human-governed | High for Track C | N/A offline product | Medium tooling | High for approved corrections | Consumes CF1 exports | Medium if scoped as product UI | Ops/tooling track, not PD2 product build |
| I Branch C / morphology | Speculative | Insufficient | Low | **Very high** | High long-term | Mixed | Very large | Poor if invented early | Would contaminate Search/Learning | Extreme | Reject |
| **J Defer / PV1 focus** | Indirect but system-critical | Production/device evidence missing; CF1 unused in field | PV1A ready now; PV1B hardware-gated | None | Highest near-term for all later choices | N/A | Bounded for PV1A | Unlocks natural evidence for CF1/CF2/Learning/search | Lets existing CF1/Learning/Search be exercised | Low if temporary and explicit | **Selected disposition** |

---

## 10. Candidate analyses

### A — CF2 Missing Entry and Search Failure Feedback

CF2 is the strongest **future** product candidate.

Why it scores well later:

- CF1 cannot start when no entry exists;
- empty-result and misclassified-miss journeys remain open;
- controlled validation already names `missing_entry` and `phrase_mismatch`;
- a carefully scoped non-authoritative miss report can generate corpus/search
  triage evidence without auto-applying language.

Why it is not selected now:

- CF1 closure explicitly left missing-entry demand as an open field question;
- no stable `ir_id`; Phase 1.5 does not define safe new-entry semantics;
- query-log export already covers some miss observability for controlled work;
- choosing CF2 immediately is the CF1-momentum path this decision was told to
  avoid unless whole-system comparison still wins;
- linguistic risk rises sharply if CF2 becomes “propose a new Maninka entry”
  rather than “report a search failure / suspected missing item.”

Disposition:

```text
Leading deferred product candidate
Do not start CF2D0 or CF2 implementation in PD2
```

### B — Result interpretability / explanation improvements

Phase 7G already shipped direction labels, sense/translation labels, query
hints, and `Pourquoi ce résultat ?`. The feasibility audit shows multi-target
French mappings are common, but remaining differentiation depends on richer
sense/example projection and content quality more than another explanation
layer.

Disposition: reject as primary next build.

### C — Additional dictionary / content-depth surfaces

High strategic value, wrong shape for a single runtime product decision.
Authoritative enrichment remains a corpus/review program (Track C), fed later
by CF1 exports and owner-approved packets. Do not build content-looking UI that
implies depth the bundle cannot support.

Disposition: continue as Track C; not selected.

### D — Sentence or phrase-oriented functionality

Phrase runtime remains blocked: 7H/7I produced evidence and a spec, not
approved aliases. Sentence analysis remains Branch C. Both fail the
linguistic-evidence gate and the “do not invent language” rule.

Disposition: reject under current gates.

### E — LS4

Still:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
```

No natural Learning-use evidence. Do not extend Learning by default.

### F — Correction draft backup / restore

CF1 residual R4 is real. LP1 does not include correction drafts. Without field
draft accumulation, this is completeness work, not the highest-value next
capability.

Disposition: deferred residual; reconsider after real CF1 use or explicit
data-loss reports.

### G — Install / package / distribution DX

`.siralex.zip` candidate exists, but Phase 7N1 remains
`not_ready_for_validation` with matrix 0%. Redesigning installation before
PV1 observation would be premature.

Disposition: observe under PV1; spawn a bounded DX slice only from measured
failures.

### H — Governed review bridge

Necessary for dictionary improvement, but not a user-facing product capability
in the PD2 sense. It sits after the CF1 export boundary and belongs to
ops/corpus governance.

Disposition: Track C / tooling; not selected as product build.

### I — Branch C / morphology / inference

Rejected. Technically interesting is not a selection criterion.

### J — No new product build yet

Selected disposition.

Why this clears the bar now:

1. the shipped capability map is already broad;
2. CF1’s strategic value depends on being used and reviewed, not on immediately
   stacking a second feedback product;
3. every evidence-sensitive candidate (CF2, RI residual, phrase, LS4, content
   surfaces) is gated by missing field/production evidence or linguistic review;
4. PV1A is executable now and is the common prerequisite for natural evidence;
5. deferral is temporary and names CF2 as the leading resume candidate rather
   than freezing the roadmap indefinitely.

This does **not** claim PV1 has already found a concrete production bug. It
claims the whole-system evidence state says further product construction is
premature relative to exercising what exists.

---

## 11. Dependencies

```text
PV1A — Production Identity and Desktop Smoke
  → hard prerequisite for trustworthy field access
  → evidence prerequisite for natural CF1/CF2/Learning/search demand
  → independent of any new product feature
  → immediately actionable

PV1B — Physical Device Validation
  → hard prerequisite: hardware/tester access
  → release-blocking for package/offline phone claims
  → independent of CF2 definition

CF2 (future)
  → optional foundation: CF1 store/export patterns
  → hard need: distinct query/miss identity model
  → hard need: non-invention scope (failure report ≠ new lexicon authority)
  → evidence prerequisite: miss-demand signal beyond CF1 adjacency
  → must not mutate dictionary authority
  → must not silently reuse correction_draft_v1 entry targeting

Track C — Corpus / review
  → consumes human-reviewed CF1 exports
  → later may consume CF2 miss reports
  → hard need: human review; not runtime auto-apply

Phrase runtime
  → hard need: approved phrase-alias rows + safe applier
  → currently blocked

LS4
  → evidence prerequisite: demonstrated selective-Review need
```

Reinforcing loop after deferral:

```text
PV1A/PV1B
  → real users can install and use the existing product
  → CF1 drafts + query evidence + Learning use appear
  → miss-demand for CF2 becomes measurable or remains weak
  → reopen product construction with evidence, not adjacency
```

---

## 12. Linguistic-risk assessment

| Candidate | Risk | Gate result |
| --- | --- | --- |
| CF2 failure-report scope | Medium; manageable if no invented target language is treated as authority | Allowed later only with strict non-authoritative identity |
| CF2 new-entry proposal scope | High | Unsafe under current Phase 1.5 semantics |
| Interpretability follow-up | Low–medium | Allowed but low leverage after 7G |
| Content-depth UI without approved content | High (false authority) | Blocked |
| Phrase aliases without approval | High | Blocked |
| Sentence analysis / morphology / inference | Very high | Blocked / deferred Branch C |
| LS4 / correction backup / install DX | Low linguistic | Not linguistic-blocked; rejected/deferred on evidence or sequencing |

PD2 refuses any next build that requires inventing Maninka forms, automatic
morphology, ranking speculation, or unapproved phrase decomposition.

---

## 13. Expected strategic leverage

Deferred construction maximizes near-term leverage by forcing the portfolio to
use the product it already has:

- PV1A can confirm or refute production identity;
- desktop/production smoke can expose install or offline defects worth a bounded
  DX slice;
- real CF1 use can test whether entry-anchored feedback is sufficient;
- miss patterns from real use or controlled field rounds can justify CF2 with a
  safe identity model;
- Learning natural use can reopen LS4 only if selective Review pain appears.

Building CF2 now would spend implementation budget on a second evidence-capture
system before the first has produced reviewable field evidence.

---

## 14. Rejected alternatives and why

| Candidate | Disposition | Why | Missing evidence / prerequisite | Reconsider when |
| --- | --- | --- | --- | --- |
| A CF2 now | Deferred leading candidate | Strong future fit, but current selection would be CF1 adjacency ahead of demand signal and safe identity definition | Natural/field miss-demand; CF2 identity/non-invention model | Miss-demand evidence exists **or** owner explicitly prioritizes CF2D0 after PV1A progress |
| B Interpretability | Rejected as primary | 7G shipped; remainder is mostly content | Confirmed residual ambiguity for existing fields / better sense projection | Content can differentiate senses or 6C confirms UI gap |
| C Content-depth surfaces | Track C | Not a bounded runtime MVP without approved packets | Owner-approved domain/packet | Approved LQ packet with exit criteria |
| D Phrase/sentence | Rejected | Linguistic-evidence gate | Approved phrase rows; Branch C prerequisites | Explicit approvals / Branch C entry criteria |
| E LS4 | Remain deferred | No demonstrated need | Large collections or explicit filter requests | Direct Learning use exposes selective-Review need |
| F Correction backup | Deferred residual | Real R4, low urgency without drafts | Real draft accumulation or loss reports | After field CF1 use or explicit restore need |
| G Install DX rewrite | Deferred pending PV1 | Observe current package/catalog paths first | Measured failure on current path | Reproducible PV1 install/offline defect |
| H Review bridge | Tooling/Track C | Not user-facing product build | Review workflow ownership | When CF1 exports need conversion path |
| I Branch C | Rejected | Invents language under weak evidence | Users, logs, correction data | Roadmap Branch C prerequisites met |
| Exclusive permanent validation-only roadmap | Rejected | Over-restrictive; PD1 parallel posture retained | — | N/A — PV1 remains active, construction is only paused |

---

## 15. Selected capability

```text
PD2_PRODUCT_BUILD_DEFERRED
```

No new user-facing product capability is authorized for implementation by this
decision.

Leading candidate retained for the next construction reopening:

```text
CF2 — Missing Entry and Search Failure Feedback
```

Expected future CF2 shape if reopened (definition only later; not implemented
here):

```text
From a search miss or search-failure state, capture a local non-authoritative
failure report anchored to query + direction + bundle provenance, with a
bounded issue classification, optional note, local manage/export, and no
dictionary mutation — without inventing approved lexicon entries.
```

---

## 16. Smallest next slice

Because construction is deferred, the smallest next slice is **not** a product
definition for a new capability.

```text
PV1A — Production Identity and Desktop Smoke
```

PV1A should:

1. confirm live host `/catalog.json` and featured-bundle identity against the
   current repository featured identity;
2. run desktop production smoke across install/search/Learning/CF1 paths as
   applicable;
3. log defects with identity hashes;
4. either clear the production-identity gap or spawn a bounded DX/fix slice
   from measured failure.

When product construction is reopened, the default smallest definition slice is:

```text
CF2D0 — Missing Entry and Search Failure Feedback Product Definition
```

unless PV1 exposes a more urgent bounded product/DX defect, or stronger evidence
selects a different candidate.

Do **not** start CF2D0 inside PD2.

---

## 17. Interaction with PV1

```text
PD2 does not replace PV1
PD2 does not absorb PV1 into a product feature
PD2 makes PV1 the active near-term execution focus for the release-readiness track
while product construction is deferred
```

| Track | Status after PD2 |
| --- | --- |
| PV1A | Active now |
| PV1B | Active when hardware/tester access exists |
| Product construction | Deferred |
| CF1 | Closed; exercise under PV1/field use |
| CF2 | Not started; leading resume candidate |
| LS4 | Still deferred pending demonstrated need |
| Track C corpus/review | Continues when approved packets/review capacity exist |

If PV1A/PV1B expose a concrete foundational defect (broken production identity,
package install failure, offline persistence failure, destructive lifecycle
bug), that defect may justify a bounded fix/DX slice ahead of CF2. That would
be a measured exception, not a vague “improve UX” program.

---

## 18. Explicit non-goals

PD2 does not:

- implement CF2 or any other product capability;
- write CF2D0;
- start LS4I1;
- change runtime, schema, UI, i18n, CSS, tests, Playwright, bundles, catalog,
  corpus, or deployment configuration;
- approve phrase aliases;
- open Branch C;
- build moderation/review UI;
- merge correction drafts into LP1;
- treat CF1 closure as production/device validation;
- treat controlled Round 1 miss probes as natural CF2 demand;
- invent Maninka language, morphology, ranking, or sentence analysis.

---

## 19. Preconditions to reopen product construction

Reopen the product-build track when one of the following is true:

1. **Miss-demand signal for CF2:** natural use, structured field use, or
   repeated controlled/field miss evidence shows users need a search-failure /
   missing-entry report path beyond query logs and CF1 entry drafts;
2. **PV1 defect slice:** PV1A/PV1B records a reproducible foundational install,
   identity, or offline defect that needs a bounded product/DX fix;
3. **Approved content surface:** an owner-approved content/packet decision
   requires a thin runtime surface that is not linguistic invention;
4. **Learning need:** direct Learning use demonstrates selective-Review need for
   LS4;
5. **Owner override:** explicit owner selection of a named next build after
   reviewing current PV1/CF1 evidence.

Default reopen candidate remains CF2, via CF2D0, unless a higher-urgency
measured defect displaces it.

---

## 20. Stop conditions while deferred

Remain deferred / do not quietly resume construction if:

1. the only argument for CF2 is that CF1 excluded it;
2. a proposed feature requires unapproved phrase/sentence/morphology behavior;
3. a proposed “content depth” UI would fake sense authority the bundle lacks;
4. LS4 is restarted without demonstrated need;
5. PV1 is abandoned rather than executed;
6. CF1 exports are treated as approved lexical evidence without human review.

---

## 21. Confidence and uncertainty

```text
Confidence: MODERATE-HIGH
```

Confidence is moderate-high that **immediate construction should pause**,
because the shipped map is broad and every strong construction candidate is
either linguistically gated or demand-underdetermined.

Uncertainty remains about the eventual winner after PV1/field evidence:

- CF2 is the best current resume candidate;
- a PV1-measured DX defect could outrank it;
- content/review work could remain the real value path without a new runtime
  surface.

Uncertainty narrows current action to PV1A execution and explicit non-start of
CF2.

---

## 22. Roadmap status locks

After PD2:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
LP1 — Local Learning Backup and Restore — Closed
PD1 — Next Product Build Decision — Complete
CF1 — Community Correction and Feedback Capture — CLOSED
PD2 — Post-CF1 Product Build Decision — Complete
PD2 disposition — PRODUCT_BUILD_DEFERRED
Leading deferred product candidate — CF2 — Missing Entry and Search Failure Feedback
PV1A — Production Identity and Desktop Smoke — Parallel active / near-term focus
PV1B — Physical Device Validation — Parallel, hardware-gated
```

Portfolio structure:

```text
Track A — Product construction
Deferred after CF1
Leading resume candidate: CF2

Track B — Release readiness
PV1A — Production Identity and Desktop Smoke
PV1B — Physical Device Validation when hardware is available

Track C — Corpus improvement
Human review of CF1 exports and owner-approved packets
  → Phase 1.5 dry-run / approved artifacts
  → reviewed bundle release
```

---

## 23. Repository hygiene

This slice stages only:

```text
docs/reports/pd2_post_cf1_product_build_decision.md
docs/ROADMAP.md
```

No CF2 implementation. No CF2D0. No runtime changes.

---

## Documentation-only confirmation

This slice changes only documentation (this report and a narrow roadmap status
update). No product capability was implemented. CF2 was not started. PV1 remains
active. CF1 remains closed and was not reopened.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `PD2_PRODUCT_BUILD_DEFERRED` |
| Selected product build | None now |
| Leading resume candidate | `CF2 — Missing Entry and Search Failure Feedback` |
| Near-term execution focus | `PV1A — Production Identity and Desktop Smoke` |
| Parallel validation | `PV1A` active; `PV1B` hardware-gated |
| LS4 posture | Defined, deferred pending demonstrated need |
| CF1 posture | Closed |
| Confidence | `MODERATE-HIGH` |
| Next slice | PV1A execution; CF2D0 only after reopen trigger |
| Code changes | None |
