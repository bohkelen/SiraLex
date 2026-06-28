# Phase 7N Intervention Review Packet

**Status:** governance template — documentation only  
**Purpose:** propose exactly **one** bounded Phase 7N intervention for human review  
**Companion:** `shared/specs/phase7n_candidate_decision_v1.md`, `docs/PHASE_7N_RELEASE_PLAN_TEMPLATE.md`, `docs/PHASE_7N_TEST_PLAN_TEMPLATE.md`

This packet is a **proposal template**. Completing it does **not** modify aliases, supplements, phrase mappings, bundles, catalogs, matrix rows, runtime search, or UI.

---

## Governance rules

```text
Frozen source truth
≠ derived search data
≠ observed user behavior
≠ approved product contracts
```

**Not approval:**

- raw query-log volume or repeat counts alone
- Phase 7K analyzer `candidate` rows without manual classification
- tester anecdotes without tied evidence tier and bundle identity
- gap-miner output, historical audit rows, or developer backlog items without corroborating direct or controlled evidence where required
- structured-usability matrix checks interpreted as demand frequency

**One intervention only:** select exactly one category below. Do not combine categories in one packet.

| Category code | Allowed intervention class |
|---|---|
| `source_aliases` | Additional reviewed source aliases |
| `source_index_supplements` | Additional reviewed source-index supplements |
| `safe_phrase_aliases` | Safe reviewed phrase aliases |
| `result_interpretability` | Result-interpretability improvement |
| `catalog_install_friction` | Catalog / install-flow friction fix |

---

## Packet metadata

| Field | Value |
|---|---|
| Packet ID | `phase7n_intervention_YYYYMMDD_NNN` |
| Author | |
| Date drafted | |
| Phase | 7N — single bounded intervention round |
| Related Phase 7M session(s) | |
| Related decision record ID(s) | `phase7n_decision_*` per `phase7n_candidate_decision_v1` |

---

## 1. Intervention category (required — choose one)

```text
[ ] source_aliases
[ ] source_index_supplements
[ ] safe_phrase_aliases
[ ] result_interpretability
[ ] catalog_install_friction
```

**Selected category:** ____________________

**Justification that no other category is bundled:** ____________________

---

## 2. Problem statement (user terms)

Describe the user-visible problem in plain language. Do not use internal taxonomy (`gap_class`, ladder rung names, bundle IDs in user-facing prose).

**User problem:**

> 

**Who is affected:**

> 

**When it occurs:**

> 

**Why a clean miss is safer than a plausible wrong hit (if applicable):**

> 

---

## 3. Evidence (required)

### 3.1 Exact source of evidence

List concrete artifacts or sessions. Every row must be traceable.

| Evidence reference | Path / session ID | What it shows |
|---|---|---|
| | | |

### 3.2 Evidence tier (required — primary tier)

Select the **strongest** tier that legitimately supports this proposal:

```text
[ ] direct user/device evidence
[ ] controlled validation evidence
[ ] historical audit evidence
[ ] developer backlog
```

**Primary evidence tier:** ____________________

**Secondary supporting tiers (if any):**

> 

**Evidence tier limitations acknowledged:**

> 

### 3.3 Current bundle / catalog identity (required)

| Field | Value |
|---|---|
| Featured `bundle_id` | |
| Featured `catalog_version` | |
| `content_sha256` | |
| `norm_version` | |
| Evidence collected against this bundle? | yes / no — if no, explain drift |

### 3.4 Recurrence observations

Describe recurrence **without** treating volume as approval.

| Observation | Classification | Notes |
|---|---|---|
| | single report / repeated natural-use / structured check only / miner flag | |

**Distinct session-bucket evidence (if v2 exports):**

> 

**Explicitly excluded from demand ranking:**

- smoke / developer / synthetic_debug traffic
- structured-usability matrix counts without natural-use corroboration
- probe strings (e.g. `zzzz-nohit-test`)

### 3.5 Usefulness outcome (required)

```text
[ ] useful
[ ] technically correct but confusing
[ ] not useful
[ ] uncertain
```

**Selected outcome:** ____________________

**Rationale:**

> 

---

## 4. Linguistic / product risk assessment

| Risk dimension | Level (low / medium / high) | Notes |
|---|---|---|
| Wrong-target routing | | |
| Phrase-to-single-word collapse | | |
| Broad kinship / umbrella mapping leakage | | |
| Ranking or posting-order change | | |
| Target-side policy drift | | |
| UX misleading copy | | |
| Offline / install regression | | |

**Overall risk:** low / medium / high

**Why a clean miss remains acceptable if this intervention is rejected:**

> 

---

## 5. Named human reviewer and disposition

| Field | Value |
|---|---|
| Reviewer name / role | |
| Review date | |
| Disposition | `candidate` / `approve_for_workflow` / `defer` / `reject` |
| Rationale | |

**Rules:**

- Analyzer output may create only `candidate`.
- Only a named human reviewer may set `approve_for_workflow`.
- `approve_for_workflow` authorizes a **bounded implementation plan**, not implementation itself.
- `reject` and `defer` require written rationale.

**Linguistic / content reviewer required?** yes / no — if yes, name: ____________________

---

## 6. Explicit non-goals

List what this intervention must **not** do.

- [ ] fuzzy search
- [ ] automatic typo correction
- [ ] runtime phrase decomposition
- [ ] ranking or scoring changes (unless explicitly in scope and separately approved)
- [ ] morphology generation
- [ ] Latin-to-N'Ko generation
- [ ] semantic search
- [ ] AI-generated translations or runtime AI search
- [ ] automatic promotion of query-log candidates
- [ ] bulk cleanup from developer intuition
- [ ] combining with another intervention category
- [ ] other: ____________________

**Non-goals narrative:**

> 

---

## 7. Affected artifacts (if approved for workflow later)

| Artifact | Change type (add / edit / publish / UI) |
|---|---|
| | |

---

## 8. Protected artifacts (must remain unchanged unless this packet explicitly authorizes)

Default protected set:

```text
searchQuery() semantics
normalization behavior (norm_v3)
directional ladder
posting-list order (except where an approved alias/supplement intentionally copies an existing posting set exactly)
records.jsonl immutability doctrine
unrelated search_index.jsonl keys
unrelated alias / supplement / phrase rows
Phase 7L matrix rows not in scope
Python and runtime goldens (except intentional same-change-set updates)
query logging behavior
unrelated ordinary-user UI
```

**Additional protected items:**

> 

---

## 9. Regression strategy

Reference `docs/PHASE_7N_TEST_PLAN_TEMPLATE.md`.

**New or updated Phase 7L matrix cases (if any):**

| Proposed `case_id` | Query | `case_family` | `source_of_expectation` |
|---|---|---|---|
| | | | |

**Control queries that must not change:**

> 

**Exact validation commands (from repo root unless noted):**

```bash
python3 -m pytest \
  api/search_regression/tests/test_validate_matrix.py \
  api/search_regression/tests/test_replay_golden.py \
  -q
```

```bash
cd web
npm ci
npx vitest run -c vitest.search_regression.config.ts
npx vitest run src/search/search_query.test.ts
```

**Category-specific validators (if applicable):**

> 

---

## 10. Rollback baseline

| Field | Value |
|---|---|
| Rollback `bundle_id` | |
| Rollback `catalog_version` | |
| Rollback `content_sha256` | |
| Git revert target / tag | |

**Rollback procedure summary:**

> 

---

## 11. Explicit authorization field

```text
Implementation authorized: [ ] NO   [ ] YES
```

**Authorization rules:**

- Default is **NO**.
- **YES** may be set only after:
  1. disposition = `approve_for_workflow`;
  2. completed `docs/PHASE_7N_RELEASE_PLAN_TEMPLATE.md`;
  3. completed `docs/PHASE_7N_TEST_PLAN_TEMPLATE.md`;
  4. maintainer sign-off with date and scope boundary.
- This packet alone never authorizes implementation.

| Field | Value |
|---|---|
| Implementation authorized | NO / YES |
| Authorized by | |
| Authorization date | |
| Authorized scope summary | |

---

## 12. Future tooling (planned — not implemented in Phase 7N0)

A read-only evidence consolidation script (`scripts/consolidate_phase7n_evidence.py`) and consolidated report (`docs/PHASE_7N_EVIDENCE_CONSOLIDATION.md`) are **deferred**.

**Do not implement until:**

- at least one real opt-in Phase 7M export exists outside the repository;
- export schema, provenance, consent state, and classification workflow have been inspected on real data;
- Phase 7K production-artifact governance gate requirements are understood for that export.

Until then, maintainers consolidate evidence manually using this packet and `phase7n_candidate_decision_v1`.

---

## References

| Document | Role |
|---|---|
| Phase 7N0 decision memo / maintainer record | Outcome B — no intervention authorized yet |
| `docs/PHASE_7K_QUERY_EVIDENCE_GOVERNANCE.md` | Evidence hierarchy and candidate lifecycle |
| `docs/PHASE_7K_TRACK_C_TESTER_OPERATIONS_PACKET.md` | Cohort and collection-mode rules |
| `docs/PHASE_7N_DEVICE_VALIDATION_CHECKLIST.md` | Field validation aligned with Phase 7M |
| `docs/reports/search_regression_changelog.md` | Phase 7L update procedure |
| `shared/specs/phase7n_candidate_decision_v1.md` | Human decision record schema |
