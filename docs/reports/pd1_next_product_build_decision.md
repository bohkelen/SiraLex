# PD1 — Next Product Build Decision

## 1. Decision

```text
PD1_VALIDATION_MILESTONE_SELECTED
```

Selected direction:

```text
PV1 — Production and Device Validation
```

This slice is documentation-only. No runtime code, tests, IndexedDB schema, UI,
CSS, i18n, Playwright, bundles, catalog, corpus, source data, packages, or
deployment configuration were modified. LS4I1 was **not** started. Unrelated
featured-anchor work already committed at `b186e41` was not altered.

Authoritative inputs:

- `docs/reports/pd0_next_product_build_decision.md`
- `docs/reports/lp1_local_learning_backup_restore_closure_report.md`
- `docs/reports/ls4d0_guided_review_sessions_product_definition.md`
- `docs/reports/lsn1_learning_system_post_ls3_decision.md`
- `docs/ROADMAP.md`
- `docs/PHASE_7N1_RELEASE_DECISION.md`
- `docs/reports/phase7n1_slice5_device_evidence_record.md`
- `docs/reports/phase7n1r1_featured_release_candidate_package_report.md`
- `docs/reports/phase7n2b4g13_promotion_closure_report.md`
- `docs/reports/phase7n2l4q4_phase7n_evidence_quality_closure_report.md`
- `docs/DEVICE_VALIDATION.md`
- `docs/PHASE_6C_TESTER_PACKET.md`
- `docs/QUERY_VALIDATION_ROUND_1.md`
- `docs/RESULT_INTERPRETABILITY_FEASIBILITY_AUDIT.md`
- `docs/PHASE_7I_PHRASE_ALIAS_REVIEW_PACKET.md`
- current offline-first and privacy boundaries

---

## 2. Executive finding

LP1 closed the last high-confidence personal-state gap in the Learning loop.
What remains is not an automatic Learning-System continuation. With
`NO_EVIDENCE` for natural Learning use and no new search `recommend_next` after
Phase 7N evidence-quality closure, building another runtime feature would
mostly amplify an unverified delivery path.

The clearest current product problem is **delivery uncertainty**:

- the repository’s current featured identity is
  `bundle_full_20260710_337619ff` (7N2B);
- ROADMAP still treats production deploy verification as open and warns not to
  treat the featured bundle as live until confirmed on the host;
- Phase 6C cannot be sent because the tester packet still contains
  `APP_LINK_REQUIRED_BEFORE_SENDING`;
- Phase 7N1 package-device matrix completion is **0%**
  (`not_ready_for_validation`);
- Android mid-range real-device validation remains an **external blocker**
  (hardware unavailable);
- historical iPhone validation used an older catalog/manual path and
  non-current bundle identity, so it does not certify the current Learning-
  inclusive product.

**Lock:** continue building only where gain is concrete. A defined feature does
not deserve implementation automatically. Operational validation may outrank
new features when deployment uncertainty blocks real use.

Selecting **PV1** does not invent Learning demand, does not default to LS4, and
does not disguise corpus work as a consumer feature. It bounds the next work as
a validation milestone whose immediately executable core is production-host
identity confirmation and production smoke, with Android/iPhone package-matrix
execution gated on hardware access rather than pretended complete.

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
| Strict bundle and Learning data boundaries | Locked |

Current featured local identity (repository fact):

```text
bundle_id: bundle_full_20260710_337619ff
content_sha256: sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c
catalog version: norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass
package candidate SHA-256: sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0
```

This decision must not select a capability already shipped under another name.

---

## 4. Owner posture

Locked for PD1:

- Continue building only where gain is concrete.
- A defined feature does not deserve implementation automatically.
- Infrastructure is not a product unless it serves an immediate user-facing
  capability.
- Corpus work and runtime-product work must be distinguished.
- Operational validation may outrank new features when deployment uncertainty
  blocks real use.
- Lack of natural-use evidence lowers confidence and must narrow scope.
- Do not default to LS4.
- Do not default to another Learning System milestone.
- Do not default to cloud sync, scheduling, history, AI, or analytics.
- A valid result may be a narrowly bounded validation/deployment milestone
  rather than new runtime functionality.

LS4 posture remains exactly:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
```

---

## 5. Evidence inventory

| Finding | Label |
| --- | --- |
| PD0 selected LP1; LP1 is now `LP1_CLOSED` | repository fact |
| ROADMAP status block already lists LP1 closed and PD1 next | repository fact |
| Natural Learning Save/Review/Progress use evidence absent (`NO_USAGE_EVIDENCE` / `NO_EVIDENCE`) | repository fact |
| Phase 7N evidence-quality track closed; Round 3 had zero search `recommend_next` | repository fact |
| Current featured bundle in repo is `bundle_full_20260710_337619ff` | repository fact |
| ROADMAP “At a glance” still names older `bundle_full_20260518_15605571` as featured | repository fact (stale doc identity; not used as current truth) |
| Production deploy verification remains open in ROADMAP backlog | repository fact |
| Historical production smoke exists for earlier Phase 7F/7G-era bundles on `loquacious-piroshki-be432c.netlify.app` | repository fact |
| No repository record confirms the live host currently serves 7N2B + post-LP1 app | missing evidence |
| Phase 6C packet still has `APP_LINK_REQUIRED_BEFORE_SENDING` | repository fact |
| Phase 7N1 status `not_ready_for_validation`; matrix 0% executed | repository fact |
| Android Chrome real-device validation pending hardware access (~2 months deferred in DEVICE_VALIDATION) | external blocker |
| Historical iPhone validation used older `norm_v2` / non-7N2B identity | repository fact |
| Automated browser evidence covers Learning offline Save/Review/Backup | repository fact |
| Automated browser evidence is explicitly not real-device release evidence | owner directive / repository fact |
| Controlled Phase 5b: 156 queries; 108 hits / 48 misses; not real-user telemetry | repository fact |
| Phrase aliases: two candidates deferred pending human review; unsafe mappings rejected | repository fact |
| Lexical residuals (`fièvre`, `poulet`, `bonjour`, Son/`prix` validation) blocked on owner validation data | repository fact / external blocker |
| Phase 7G interpretability UI shipped; deeper multi-target summaries deferred pending 6C | repository fact |
| Multi-target French mappings were ~36% on older featured audit bundle | repository fact |
| Source-language Learning objects remain architecture/corpus blocked | repository fact |
| Owner continues building after LP1 via PD1 comparison, not via LS4 default | owner directive |
| Selecting validation now prevents building on an unverified delivery path | inference |
| Backup demand was inferred risk; LP1 closed that risk without proving restore requests | repository fact |

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
| Offline/device behavior | Desktop automation `AUTOMATED_PRODUCT_EVIDENCE`; current Android `NO_EVIDENCE`; historical iPhone on old identity only |
| Dictionary-management behavior | `AUTOMATED_PRODUCT_EVIDENCE` + historical device notes; current `.siralex.zip` gate `NO_EVIDENCE` |
| Lexical/content deficiencies | `ARCHITECTURAL_EVIDENCE` + controlled misses; natural demand `NO_EVIDENCE` |
| Backup demand | Risk closed by LP1; observed restore requests still `NO_EVIDENCE` |
| Deployment reliability | `MISSING` for current featured identity on live host; older smoke exists for prior bundles |

Do not collapse automated correctness evidence into user-demand evidence.

---

## 7. Current external blockers

| Blocker | Affects | Status |
| --- | --- | --- |
| Physical Android hardware unavailable | Android mid-range install/offline/package matrix; Phase 5b Android completion | external blocker |
| Confirmed deploy URL for Phase 6C | Natural-use / structured field feedback program | missing evidence / operational gap (solvable by production verification) |
| Owner validation data for lexical residuals (`fièvre`, `poulet`, `bonjour`, etc.) | Bounded lexical packet approval | external blocker / missing evidence |
| Human reviewer for deferred Phase 7I phrase aliases | Phrase-retrieval alias promotion | missing evidence |
| Genuine independently authoritative source lexicon + identity | Source-language Learning objects | architecture prerequisite |

Separate:

```text
validation that can be executed immediately
```

- fetch live `/catalog.json` and featured-bundle identity on the intended host;
- compare to in-repo 7N2B hashes and `VITE_FEATURED_BUNDLE_ID`;
- desktop browser production smoke: install, search, offline reopen, Save,
  Review, Progress, Learning backup/restore;
- record defects with candidate identity and rerun evidence;
- only after host confirmation, fill Phase 6C `APP_LINK`.

```text
externally blocked validation
```

- Android Chrome mid-range package/catalog matrix;
- iPhone Safari package matrix for current `.siralex.zip` candidate, unless a
  tester/device is available now;
- any claim that desktop automation certifies mobile reliability.

---

## 8. Candidate classification

| ID | Candidate | Classification |
| --- | --- | --- |
| A | Production Deployment and Device Validation | deployment/validation milestone |
| B | Lexical Content Quality Program | corpus/data program |
| C | Search and Discovery Improvement | runtime product capability (evidence-gated) |
| D | Result Interpretation Follow-up | runtime product capability (or corpus if data-absent) |
| E | Dictionary Distribution and Installation UX | runtime product capability |
| F | LS4 Guided Review Sessions | runtime product capability |
| G | Local Learning Organization | runtime product capability |
| H | Learning Scheduling or History | runtime product capability / research decision |
| I | Genuine Source-Language Lexical Objects | architecture prerequisite (+ corpus) |
| J | Local Data Portability Beyond Learning | operational tooling / runtime capability |
| K | Another repository-supported need | none stronger than A found |

A corpus or operational program must not be disguised as a consumer feature.

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
10. Whether the work unlocks real-world adoption

### Unfavorable-high (higher is worse)

11. Dependency on unavailable corpus data
12. Dependency on unavailable hardware or external access
13. Schema or migration risk
14. Privacy risk
15. Operational burden
16. Opportunity cost
17. Risk of misleading language or learning claims
18. Reversibility *inverted in narrative*: high reversibility is favorable; scored
    separately as Reversibility↑ where 5 = easy to stop/undo

No raw aggregate without weighting. Decisive weights for PD1:

1. truthful evidence of current pain;
2. unlock of real-world adoption / natural-use evidence;
3. bounded MVP;
4. offline fit and low semantic risk;
5. avoid fabricating Learning demand.

---

## 10. Candidate comparison matrix

| Candidate | Gain↑ | Pain↑ | Leverage↑ | Offline↑ | Fit↑ | MVP↑ | No fabricate↑ | Time↑ | Reach↑ | Adoption↑ | Corpus dep.↓ | Hw dep.↓ | Schema↓ | Privacy↓ | Ops↓ | Opp. cost↓ | Misleading↓ | Net reading |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A Validation (selected)** | 4 | 5 | 5 | 5 | 5 | 4 | 5 | 5* | 5 | 5 | 1 | 4† | 1 | 1 | 3 | 2 | 1 | Best now: closes delivery uncertainty; unlocks evidence |
| B Lexical quality | 5 | 4 | 5 | 5 | 4 | 2 | 3 | 2 | 5 | 3 | 5 | 1 | 2 | 1 | 4 | 3 | 2 | Strategic; needs bounded packet + human review |
| C Search/discovery | 3 | 3 | 3 | 5 | 3 | 2 | 2 | 2 | 4 | 3 | 4 | 1 | 3 | 1 | 3 | 3 | 3 | Phrase path deferred; fuzzy/rank rejected |
| D Result interpretation | 3 | 2 | 3 | 5 | 4 | 3 | 2 | 3 | 3 | 2 | 3 | 1 | 2 | 1 | 2 | 3 | 2 | 7G shipped highest-value layer; 6C not run |
| E Install UX | 3 | 3 | 3 | 5 | 4 | 3 | 3 | 3 | 4 | 4 | 1 | 4† | 2 | 1 | 3 | 3 | 1 | Package path untested on device; redesign premature |
| F LS4 | 2 | 1 | 5 | 5 | 5 | 5 | 1 | 4 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 4 | 2 | Defined; deferred; no demonstrated need |
| G Organization | 2 | 1 | 3 | 5 | 4 | 2 | 1 | 3 | 1 | 1 | 1 | 1 | 3 | 2 | 2 | 4 | 1 | No collection-scale evidence |
| H Scheduling/History | 2 | 1 | 2 | 4 | 2 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 5 | 4 | 4 | 5 | 5 | Deferred; mastery claims risk |
| I Source objects | 3 | 2 | 1 | 4 | 1 | 1 | 2 | 1 | 2 | 1 | 5 | 1 | 5 | 1 | 4 | 5 | 3 | Architecture-blocked |
| J Broader portability | 2 | 1 | 3 | 5 | 3 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 3 | 4 | 3 | 4 | 2 | Boundaries already correct; no demand |

\* Immediate production-host verification is fast; full Android matrix is not.
† Hardware dependency is high for the device half; the selected MVP therefore
front-loads host/desktop verification and treats Android as a gated sub-track,
not a silent assumption of completion.

---

## 11. Production deployment / device validation

### Required answers

| Question | Answer | Label |
| --- | --- | --- |
| Is current public deployment confirmed to serve intended bundle and app version? | **No confirmed record for 7N2B + post-LP1 app** | missing evidence |
| Does production installation work on intended browsers? | Older smokes exist; current identity unverified | missing evidence |
| Is Android real-device offline behavior still unverified for current product? | **Yes** | external blocker + missing evidence |
| Are automated browser tests sufficient to infer mobile reliability? | **No** (explicitly disallowed as release evidence) | owner directive |
| Are storage and performance acceptable on constrained devices? | Unknown for current Learning-inclusive product | missing evidence |
| Does a production failure prevent every other feature from delivering value? | **Yes** — users cannot benefit from shipped work they never receive | inference grounded in delivery chain |
| Can required validation be performed now? | Host identity + desktop production smoke: **yes**. Android matrix: **no** until hardware | mixed |
| Is deployment verification a bounded milestone with clear exit criteria? | **Yes** if scoped as PV1 | owner directive / this decision |
| Would it produce actionable defects rather than another report? | Yes, if exit criteria require defect logs, identity hashes, and rerun evidence | inference |

### Conclusion

Building another feature before answering “is the intended product actually
reachable?” would be irrational for adoption and evidence quality. Selecting a
**hardware-only** milestone would violate the rule against choosing blocked
hardware work with no substitute. PV1 therefore:

1. executes production-host and desktop production smoke **immediately**;
2. records Android/iPhone package/device matrix as **externally blocked** until
   access exists;
3. treats defects as first-class outputs;
4. unlocks Phase 6C only after a confirmed URL and identity.

---

## 12. Lexical content quality

Repository evidence shows:

- controlled misses and lemma gaps (`fièvre`, `poulet`, `bonjour` lexical-
  blocked);
- sparse examples / sense ambiguity / limited audio-morphology as source
  constraints;
- approved 7N2B content shipped (`moto`, `prix → Son`);
- phrase aliases deferred, not approved;
- N’Ko searchable where source-provided; deterministic generation deferred
  (Branch C).

Distinguish:

| Class | Examples |
| --- | --- |
| content absent | `fièvre` miss; deferred lemmas without owner data |
| content exists but is not surfaced | some lexicon sense/example richness not on index cards |
| search index does not retrieve existing content | phrase/inflection misses where canonical forms exist |
| result presentation does not explain existing content | residual multi-target ambiguity after 7G |

### Conclusion

Lexical quality remains strategically vital and improves every surface, but
“improve the dictionary” is unbounded. No owner-approved bounded packet is
ready now for the blocked residuals. Classify as standing **corpus/data
program**, not the primary PD1 selection. Reopen when a reviewed semantic
domain, ambiguity set, or missing-entry packet is approved.

---

## 13. Search and discovery

| Question | Answer |
| --- | --- |
| What failures remain evidenced? | Controlled phrase/partial/inflection misses; deferred aliases; plain `Kun` policy memo |
| Natural-use, controlled, or theoretical? | Mostly controlled / harness; natural-use absent |
| Is phrase retrieval still a leading problem? | Leading in controlled evidence; not authorized as demand |
| Approved phrase aliases available? | **No** — two deferred; seven unsafe rejected |
| Runtime decomposition authority? | Insufficient without reviewed data |
| False-positive risk of search change? | High for fuzzy/AI/embeddings/morphology |
| Deterministic offline possible? | Yes, if data-reviewed |
| New index vs reviewed data? | Prefer reviewed aliases/data over heuristics |
| First-hit ordering change? | Avoid unless measured against fixed corpus |
| Measurable against fixed query set? | Yes |
| More valuable than fixing content? | Not without approved alias/content packet |

### Conclusion

Do **not** select fuzzy search, AI query interpretation, embeddings, ranking
scores, or automatic morphology. Search improvement remains evidence-gated and
secondary to confirming delivery + obtaining natural-use signals.

---

## 14. Result interpretation

Phase 7G already shipped the highest-value presentation layer:

- French-first labels;
- neutral query hint;
- `Pourquoi ce résultat ?`;
- safer miss guidance;
- no ranking/alias claims.

Remaining gaps are either content scarcity or compact target-sense summaries
that the audit said not to implement before Phase 6C priority confirmation.
There is architectural evidence of multi-target mappings, but **no direct
tester confirmation** that residual ambiguity outranks delivery/validation.

### Conclusion

Reject RI2 as primary next build. Reconsider after Phase 6C or natural-use
reports that a specific already-authoritative field would resolve competing
results.

---

## 15. Installation and management

| Question | Answer |
| --- | --- |
| Ordinary-user first install confusing? | Historical notes suggest technical surfaces; current field confirmation missing |
| Single-file package sufficient? | Built; device matrix not run |
| Update/removal understandable? | Not re-proven on current product |
| Interrupted-install recovery? | Designed; device-unproven for package route |
| Storage warnings clear? | Not established as current top pain |
| Catalog install offline after completion? | Automation yes; production/device current identity unverified |
| Sideload vs catalog? | Both exist; catalog is ordinary path; package is alternate gate |
| Management complexity block search? | Possible historically; not proven primary now |
| Browser file-picker problems? | Historical iPhone `.jsonl` issues resolved; package picker untested on Android/iPhone |
| Manage dictionaries too technical? | Possible; redesign without measured failure is speculative |

### Conclusion

Do not rebuild already-shipped import paths. Installation problems that matter
most are currently **validation/evidence** problems under Candidate A, not a
separate UX rewrite.

---

## 16. LS4 Guided Review Sessions

Exact posture:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
```

| Question | Answer |
| --- | --- |
| Evidence full-queue Review is burdensome? | No |
| Collections large enough to require filtering? | No measured sizes |
| Users asked for New / Still learning / Remembered isolation? | No |
| Current queue satisfactory default? | Unknown; no contrary evidence |
| Chooser friction for small collections? | Plausible risk |
| More valuable than deployment/search/content? | No under current evidence |

Existence of LS4D0 is not evidence. LS4 does **not** win PD1.

---

## 17. Learning scheduling / history

| Question | Answer |
| --- | --- |
| Repeated longitudinal Learning use? | No |
| Users forget to return? | No evidence |
| All-item Review inefficient? | No evidence |
| Transparent scheduling supportable? | Not with current latest-status model alone |
| Immutable history first? | Would be a large prerequisite |
| User-facing consumer for history? | Undefined |
| Clock policy? | Undefined |
| Privacy data created? | Yes — longitudinal personal learning trails |
| Retention/mastery claims risk? | High |

Default disposition remains **deferred**. Latest status, count, and timestamp
are not proof that due-state is needed.

---

## 18. Source-language objects

Nothing material changed since PD0/LSN1:

- no genuine independently authoritative EN/FR lexicon object;
- no stable source-entry Learning identity;
- `index_mapping` is not a source lexicon;
- Save/Review ownership for source objects undefined.

Keep **blocked**.

---

## 19. Broader portability

LP1 correctly separated Learning backup from dictionary packages and query logs.

| Need | Evidence |
| --- | --- |
| Full app backup | None |
| Dictionary installation backup | Packages already are distribution artifacts |
| Query-log backup | Separate consent; diagnostic, not Learning |
| Settings migration | No demand |
| Device-to-device transfer beyond Learning backup | No demand |

Do not select full-database export for convenience.

---

## 20. Other repository-supported candidate

No Candidate K outranks PV1. Closest runners-up:

- bounded lexical packet (blocked on owner data);
- Phase 6C field program (blocked on confirmed app link — solved by PV1);
- Phase 7N1 device matrix (subset of PV1; Android externally blocked).

Unrelated featured-anchor navigation (`b186e41`) is outside this decision and
must not be mixed into the PD1 commit.

---

## 21. Candidate MVPs

### A — selected

```text
Confirm current production build serves the intended app and featured 7N2B
identity; complete desktop production smoke for catalog install, offline
reopen, Save, Review, Progress, and Learning backup/restore; document
Android/iPhone package and mid-range device matrix as externally blocked
until hardware access; record defects with identity hashes and rerun evidence
```

### B — lexical

```text
Review and enrich one bounded ambiguity or missing-entry set with
authoritative owner-approved data and rebuild the bundle
```

Rejected as primary: no approved packet ready.

### C — search

```text
Implement one reviewed phrase-retrieval mechanism over approved phrase data
with fixed regression corpus
```

Rejected as primary: approved phrase data unavailable.

### D — result interpretation

```text
Surface one already-authoritative context field that materially distinguishes
competing results
```

Rejected as primary: 7G shipped; 6C priority unconfirmed.

### E — installation UX

```text
Resolve one measured first-install or recovery failure through the current
package/catalog path
```

Rejected as primary: failures not yet measured on current route; measurement
belongs to PV1.

### F — LS4

```text
Status-filtered fresh Review sessions using existing queue groups
```

Rejected: deferred pending demonstrated need.

### G–J

Rejected: no evidence / architecture-blocked / boundary-violating convenience.

Rejected MVP shapes include “improve UX”, “improve content”, “make search
smarter”, “add AI”, “build analytics”, and “prepare for sync.”

---

## 22. Dependency graph

```text
Production deployment
  → enables real-user access                    [hard prerequisite]
  → enables natural-use evidence                [evidence prerequisite]
  → informs search/content/Learning priorities  [evidence prerequisite]

Authoritative corpus enrichment
  → improves search results                     [optional foundation]
  → improves entry detail                       [optional foundation]
  → improves Saved Vocabulary                   [optional foundation]
  → improves Review cards                       [optional foundation]

Reviewed search evidence
  → may justify index/data changes              [evidence prerequisite]
  → does not automatically justify runtime heuristics [independent constraint]

Natural Learning use
  → may justify LS4                             [evidence prerequisite]
  → may justify History or Scheduling later     [evidence prerequisite]

Source-language corpus + identity
  → prerequisite for source-language Learning objects [hard prerequisite]

Desktop production smoke
  → partial substitute for host identity questions [optional foundation]
  → not a substitute for Android reliability      [independent constraint]

Android hardware access
  → hard prerequisite for Android matrix          [hard prerequisite / external]
```

---

## 23. Opportunity cost

| If selected | Delayed | Trade-off |
| --- | --- | --- |
| **PV1 (selected)** | Immediate runtime feature coding; corpus packet execution | Prevents building on an unverified delivery path; unlocks Phase 6C and truthful prioritization |
| Lexical quality | Validation and any runtime polish | Improves every surface but waits on human linguistic/owner review; does not prove users can reach the app |
| Search improvement | Validation + content authority | Risks false positives without approved data |
| Result interpretation | Validation / content | Likely duplicates 7G value without 6C confirmation |
| Install UX rewrite | Validation | Speculative without measured current failures |
| LS4 | Broader dictionary value and delivery proof | Improves control for an unproven problem |
| Scheduling/history | Almost everything valuable | High schema/privacy/claim risk for zero evidenced pain |
| Source objects | All nearer gains | Architecture-blocked |
| Broader portability | User-facing dictionary value | Convenience infrastructure without consumer demand |

---

## 24. Selected direction

```text
PD1_VALIDATION_MILESTONE_SELECTED
PV1 — Production and Device Validation
```

Classification: **deployment/validation milestone** (not a runtime product
feature, not a corpus program).

---

## 25. User problem

Users (and Phase 6C testers) cannot be honestly directed to a confirmed current
production build. Without host identity confirmation and production smoke for
the Learning-inclusive 7N2B product, every shipped capability — search, Save,
Review, Progress, backup — may fail to deliver real-world value. Android
reliability for the intended mid-range audience remains unverified and
externally blocked, which further prevents truthful adoption claims.

---

## 26. Evidence and confidence

Evidence supporting the problem:

- ROADMAP production deploy verification still open / “do not treat as live”;
- Phase 6C blocked on missing app link;
- Phase 7N1 package matrix 0% / `not_ready_for_validation`;
- DEVICE_VALIDATION Android pending hardware;
- no confirmed live-host record for current featured 7N2B + post-LP1 app;
- historical production smokes and iPhone validation refer to older identities.

```text
Confidence: HIGH
```

for selecting validation over another Learning feature or speculative search UI.

```text
Confidence: MODERATE
```

that production is actually broken — the gap is **unverified**, not proven
failed. Uncertainty narrows PV1 to verification-first work with explicit pass/
fail identity checks rather than assumed redeploy churn.

Overall decision confidence:

```text
HIGH
```

---

## 27. Why now

- LP1 closed the last concrete Learning personal-state gap.
- No natural-use Learning evidence appears after LP1; LS4 remains deferred.
- Phase 7N closed without a new search implementation candidate.
- Delivery uncertainty now outranks adjacent feature design as the clearest
  gain-to-cost problem.
- Production-host verification can start immediately and unlocks the evidence
  programs every other candidate needs.
- Selecting LS4/search/lexical runtime work now would prefer convenience or
  documentation adjacency over truthful adoption leverage.

---

## 28. Expected gain

Visible / product gains:

- confirmed production URL and bundle/app identity;
- actionable defect list or green smoke for the Learning-inclusive product;
- Phase 6C packet unblocked once URL is confirmed;
- honest status for Android/iPhone gates (executed or explicitly blocked);
- portfolio clarity so later search/content/Learning choices rest on real use.

---

## 29. Scope constraint

Uncertainty narrows the MVP to:

- identity verification before feature invention;
- desktop production smoke as the immediate executable core;
- Android/iPhone matrix as a gated sub-track, not a fake completion claim;
- no runtime feature implementation inside PV1 definition;
- no corpus edits disguised as validation;
- no Learning scheduling/history/LS4 work;
- defects must be reproducible against recorded hashes.

---

## 30. Rejected-for-now candidates

| Candidate | Disposition | Reason | Missing evidence | Prerequisite | Trigger for reconsideration |
| --- | --- | --- | --- | --- | --- |
| B Lexical quality | Standing corpus program; not primary | No bounded approved packet ready; owner data blocked for key misses | Owner-validated entries / domain packet | Authoritative review + rebuild path | Approved LQ packet with exit criteria |
| C Search/discovery | Deferred | Phrase aliases not approved; fuzzy/rank forbidden without evidence | Natural-use misses; approved aliases | Reviewed data + fixed regression corpus | Approved phrase/data packet or repeated natural misses |
| D Result interpretation follow-up | Deferred | Phase 7G shipped top layer; 6C unrun | Tester “which result?” reports | Phase 6C or natural-use confirmation | Confirmed ambiguity pain for an existing field |
| E Install UX | Deferred as rewrite | Current package/catalog failures not measured | Measured first-install/recovery defects | PV1 measurements | Specific reproducible install failure on current path |
| F LS4 | Defined, deferred pending demonstrated need | No selective-Review need; chooser may add friction | Large collections or user requests | Natural Learning use | Real collections large or explicit status-filter requests |
| G Organization | Deferred | No retrieval/scale pain | Collection-size / findability complaints | Natural Learning use | Users cannot find saved items at measured scale |
| H Scheduling | Deferred | No longitudinal use; mastery-claim risk | Return/forget evidence; due-state decision | History/clock/privacy decisions | Longitudinal Review usage + explicit due-state decision |
| H History | Deferred | No consumer; privacy expansion | Product consumer definition | Immutable event model decision | Explicit consumer + privacy review |
| I Source objects | Blocked | No authoritative source lexicon/identity | Source corpus + identity semantics | Architecture + corpus program | Authoritative source lexicon and identity architecture exist |
| J Broader portability | Deferred | Boundaries already correct; no demand | Migration/backup requests beyond Learning | Keep package/log/settings separation | Concrete device-migration need not solved by LP1 + packages |
| Evidence-only pause with no access plan | Rejected | Owner continues; PV1 is the access plan | — | — | — |

---

## 31. Preconditions

Before PV1 execution slices beyond definition:

1. `PV1D0` defines exact host URL(s), identity fields to compare, smoke script,
   pass/fail criteria, and Android/iPhone gate handling.
2. In-repo featured identity remains the comparison baseline unless a newer
   promotion supersedes it before execution.
3. Desktop production smoke includes Learning paths now that LP1 exists.
4. Android work does not silently claim completion without hardware.
5. Phase 6C is not sent until `APP_LINK` is a confirmed deployed URL.
6. LS4 remains deferred; PV1 must not implement Guided Sessions.
7. No corpus/bundle rebuild is required merely to “look busy” during
   validation.
8. Unrelated featured-anchor work stays out of PV1 commits unless a validation
   defect specifically implicates it.

---

## 32. Stop conditions

Block or halt PV1 implementation/execution expansion if:

1. no deployable host/access exists and none can be created — then escalate as
   external blocker, not as feature coding;
2. validation is redefined into unbounded redesign without defects;
3. unit/Playwright-only results are treated as device release evidence;
4. Android is marked passed without real-device runs;
5. Learning analytics, cloud sync, or telemetry are smuggled in;
6. LS4/scheduling/history starts under a validation label;
7. corpus fabrication is used to “fix” validation misses.

---

## 33. Smallest next slice

```text
PV1D0 — Production and Device Validation Definition
```

PV1D0 must define:

- production host URL(s) under test;
- exact identity checks (`catalog.json`, featured `bundle_id`,
  `content_sha256`, app/build markers if available);
- desktop smoke scenarios including catalog install, offline reopen, search,
  Save, Review, Progress, Learning backup/restore;
- Phase 7N1 package-matrix relationship and status vocabulary;
- Android/iPhone external-blocker handling and exit criteria when hardware
  returns;
- defect logging format and rerun rules;
- Phase 6C unblocking rule after confirmed URL;
- explicit non-goals (no feature coding, no corpus edits, no LS4).

Do not implement deployment changes or device testing inside PV1D0 if that
slice is definition-only.

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
- source objects.

This slice decides only.

---

## 35. Repository hygiene

This slice stages only:

```text
docs/reports/pd1_next_product_build_decision.md
docs/ROADMAP.md
```

Roadmap update is limited to:

- LP1 closed (already recorded; retained);
- selected next direction PV1;
- exact next slice PV1D0.

Unrelated featured-anchor work at `b186e41` is excluded from this decision’s
file set and must not be reopened here.

Locked status strings after PD1:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
LP1 — Local Learning Backup and Restore — Closed
PD1 — Next Product Build Decision — Complete
PV1 — Production and Device Validation — Selected
PV1D0 — Production and Device Validation Definition — Next
```

---

## Documentation-only confirmation

This slice changes only documentation (this report and a narrow roadmap status
update). No runtime, corpus, deployment, test, schema, or UI implementation
occurred. LS4I1 was not started.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `PD1_VALIDATION_MILESTONE_SELECTED` |
| Selected direction | `PV1 — Production and Device Validation` |
| Classification | deployment/validation milestone |
| LS4 posture | Defined, deferred pending demonstrated need |
| Evidence maturity (Learning natural use) | `NO_EVIDENCE` |
| Confidence | `HIGH` |
| Next slice | `PV1D0 — Production and Device Validation Definition` |
| Code changes | None |
