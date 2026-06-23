# Phase 7N candidate decision v1

Human-governance schema for Phase 7N intervention selection.

This specification defines how maintainers record **review decisions**. It is **not** a machine generation format for aliases, supplements, phrase mappings, bundles, catalogs, or regression matrix rows.

```text
Frozen source truth
≠ derived search data
≠ observed user behavior
≠ approved product contracts
```

---

## Purpose

Phase 7N decisions sit between observed evidence (Phase 7K analyzer output, Phase 7M exports, audit rows) and any future bounded implementation. A decision record answers:

- whether a candidate may proceed to a bounded implementation plan;
- what evidence and bundle identity that judgment rests on;
- what must explicitly **not** happen.

Decision records are **governance artifacts**. They do not change product behavior by themselves.

---

## Non-goals

- Automatic ingestion into alias, supplement, or phrase-alias appliers
- Automatic bundle or catalog publication
- Automatic Phase 7L matrix or golden updates
- Replacing Phase 7I / 7J review packets for their specialized artifact types
- Storing raw tester exports or session identifiers in git

---

## Allowed decision states

| State | Who may set | Meaning |
|---|---|---|
| `candidate` | Analyzer (Phase 7K Track B) or maintainer during triage | Hypothesis for human review; **not** approval |
| `approve_for_workflow` | Named human reviewer only | Authorizes drafting a bounded implementation + release + test plan; **does not** authorize shipping |
| `defer` | Named human reviewer only | Insufficient evidence, blocked dependency, or needs more review |
| `reject` | Named human reviewer only | Must remain no-hit, out of scope, or unsafe |

**Forbidden states in this schema:** `approved`, `shipped`, `published`, `implemented`. Those belong to downstream artifact tables (`source_aliases_v1.jsonl`, supplements, phrase aliases, bundle release notes) after separate release controls.

---

## Lifecycle

```text
candidate
  → human review (Phase 7N intervention packet + this decision record)
  → approve_for_workflow | defer | reject
  → [if approve_for_workflow] bounded implementation plan + release plan + test plan
  → separate maintainer authorization to implement
  → artifact edit + validation + bundle publication (outside this schema)
```

**Critical rules:**

1. Analyzer output may create only `candidate`.
2. Only a named human reviewer may create `approve_for_workflow`, `defer`, or `reject`.
3. `approve_for_workflow` does **not** authorize implementation; it authorizes a bounded implementation plan.
4. No decision record in this schema may be consumed automatically by alias, supplement, phrase-alias, bundle, catalog, or matrix tooling.
5. Implementation authorization is a separate explicit field (see § Required fields).

---

## Required fields

Every decision record MUST include all of the following. Records may live in maintainer-controlled JSONL, markdown decision logs, or private notes — but the **field set** is fixed.

| Field | Type | Required | Rules |
|---|---|---|---|
| `schema_version` | string | yes | MUST be `phase7n_candidate_decision_v1` |
| `decision_id` | string | yes | Stable identifier, e.g. `phase7n_decision_20260623_001` |
| `candidate_id` | string | yes | Stable candidate identifier; may link to Phase 7K `review_id` or audit `review_id` |
| `decision_state` | enum | yes | `candidate` \| `approve_for_workflow` \| `defer` \| `reject` |
| `intervention_category` | enum | yes | Exactly one: `source_aliases` \| `source_index_supplements` \| `safe_phrase_aliases` \| `result_interpretability` \| `catalog_install_friction` |
| `query_or_subject` | string | yes | Lookup string, UX surface, or subject under review |
| `search_direction` | enum | no | `source_to_target` \| `target_to_source` \| `not_applicable` |
| `evidence_references` | array | yes | Paths, session IDs, or artifact IDs — not raw export blobs |
| `evidence_tier_primary` | enum | yes | `direct_user_device` \| `controlled_validation` \| `historical_audit` \| `developer_backlog` |
| `bundle_id` | string | yes | Featured or candidate bundle the decision was reviewed against |
| `catalog_version` | string | yes | Catalog entry version at review time |
| `norm_version` | string | yes | e.g. `norm_v3` |
| `rationale` | string | yes | Why this state was chosen |
| `reviewer_name_or_role` | string | yes | Named human reviewer; MUST NOT be `analyzer` or `automated` for non-`candidate` states |
| `reviewed_at` | string | yes | ISO 8601 date or timestamp |
| `risk_assessment` | string | yes | Linguistic/product risk summary |
| `non_goals` | array of strings | yes | Explicit exclusions |
| `implementation_authorization_status` | enum | yes | `not_authorized` \| `authorized` |
| `implementation_authorized_by` | string | no | Required when `implementation_authorization_status` = `authorized` |
| `implementation_authorized_at` | string | no | Required when authorized |
| `linked_intervention_packet_id` | string | no | `phase7n_intervention_*` from review packet |
| `notes` | string | no | Freeform maintainer notes |

### `implementation_authorization_status`

| Value | Meaning |
|---|---|
| `not_authorized` | Default. Decision record and `approve_for_workflow` do not permit code/data changes. |
| `authorized` | Separate maintainer gate passed; bounded implementation may proceed per linked release/test plans. |

Setting `decision_state` to `approve_for_workflow` MUST leave `implementation_authorization_status` as `not_authorized` until a distinct authorization step is recorded.

---

## Evidence tier definitions

| Tier | Examples | May support `approve_for_workflow` alone? |
|---|---|---|
| `direct_user_device` | Opt-in Phase 7M natural-use export + classified feedback | Sometimes — still requires human review |
| `controlled_validation` | Phase 7L replay, controlled calibration, device checklist results | Usually supporting only |
| `historical_audit` | Phase 7J gap rows, phrase review, feasibility audit | No — needs corroboration for product changes |
| `developer_backlog` | ROADMAP deferrals, miner flags, maintainer intuition | No |

Raw query volume is **never** sufficient alone for `approve_for_workflow`.

---

## Category constraints

| Category | Decision record must confirm |
|---|---|
| `source_aliases` | Copies existing canonical posting set exactly; no target broadening |
| `source_index_supplements` | Supplement mode and broad-mapping scope explicitly reviewed |
| `safe_phrase_aliases` | Phrase-specific artifact path; no silent `source_alias_table_v1` extension |
| `result_interpretability` | Separates UI-only vs bundle/display-contract changes |
| `catalog_install_friction` | Does not smuggle search or ranking changes |

---

## Invalid examples (explicit)

The following are **invalid** uses of this schema. Do not record them.

### 1. Raw query volume becoming approval

**Invalid:**

```json
{
  "decision_state": "approve_for_workflow",
  "rationale": "Query appeared 14 times in export.",
  "evidence_tier_primary": "direct_user_device"
}
```

**Why invalid:** Repeat counts without classification, bundle identity check, and linguistic review do not prove safe routing.

### 2. Unreviewed phrase mapping

**Invalid:**

```json
{
  "decision_state": "approve_for_workflow",
  "intervention_category": "safe_phrase_aliases",
  "query_or_subject": "ferme la bouche",
  "rationale": "Related term bouche hits; route phrase to bouche."
}
```

**Why invalid:** Phrase-to-single-word collapse without phrase-level evidence; contradicts Phase 7H/7I rejections.

### 3. Synthetic fixture becoming field evidence

**Invalid:**

```json
{
  "decision_state": "approve_for_workflow",
  "evidence_references": ["shared/query_evidence/fixtures/sample_export_v2.jsonl"],
  "evidence_tier_primary": "direct_user_device"
}
```

**Why invalid:** Repo fixtures are analyzer regression inputs, not opt-in tester/device evidence.

### 4. Analyzer candidate becoming an alias row

**Invalid workflow:**

1. Phase 7K emits `review_status: candidate` in `phase7k_query_candidates.jsonl`
2. Maintainer copies row directly into `shared/aliases/source_aliases_v1.jsonl` with `status: approved`

**Why invalid:** Skips Phase 7N decision record, intervention packet, linguistic review, validation, and release plan. Analyzer rows MUST NOT be auto-promoted.

### 5. Combined categories in one decision

**Invalid:**

```json
{
  "intervention_category": "source_aliases",
  "non_goals": [],
  "notes": "Also add supplement and fix install UX in same release."
}
```

**Why invalid:** Phase 7N allows one bounded intervention category per round.

### 6. `approve_for_workflow` with `implementation_authorization_status: authorized` in the same review step

**Invalid:** Collapsing workflow approval and implementation authorization into one undifferentiated sign-off.

**Why invalid:** Release and test plans must exist before implementation authorization.

---

## Valid example (sketch)

```json
{
  "schema_version": "phase7n_candidate_decision_v1",
  "decision_id": "phase7n_decision_20260623_001",
  "candidate_id": "phase7k_evidence_0042",
  "decision_state": "defer",
  "intervention_category": "source_index_supplements",
  "query_or_subject": "soeur",
  "search_direction": "source_to_target",
  "evidence_references": [
    "phase7j_gap_0026",
    "maintainer_note:2026-06-20:structured_S2_only"
  ],
  "evidence_tier_primary": "historical_audit",
  "bundle_id": "bundle_full_20260616_phase7j_alias_round2_candidate",
  "catalog_version": "norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2",
  "norm_version": "norm_v3",
  "rationale": "Query already hits on featured bundle; additive supplement risks broad-mapping leakage without natural-use miss evidence.",
  "reviewer_name_or_role": "maintainer_linguistic_reviewer",
  "reviewed_at": "2026-06-23T12:00:00Z",
  "risk_assessment": "medium — kinship umbrella expansion",
  "non_goals": [
    "ranking change",
    "runtime search change",
    "automatic promotion from miner"
  ],
  "implementation_authorization_status": "not_authorized",
  "linked_intervention_packet_id": "phase7n_intervention_20260623_001",
  "notes": "Revisit after Phase 7M natural-use export classifies recurrence."
}
```

---

## Tooling boundary

No validator, applier, bundle builder, or CI job may read this schema and mutate:

- `shared/aliases/source_aliases_v1.jsonl`
- `shared/source_index_supplements/source_index_supplements_v1.jsonl`
- `shared/phrase_review/source_phrase_aliases_v1.jsonl`
- `web/public/` bundle trees or `catalog.json`
- `shared/search_regression/search_regression_matrix_v1.jsonl`
- goldens under `shared/search_regression/tests/`

Decision records inform humans only.

---

## Related documents

| Document | Role |
|---|---|
| `docs/PHASE_7N_INTERVENTION_REVIEW_PACKET.md` | One-intervention proposal template |
| `docs/PHASE_7K_QUERY_EVIDENCE_GOVERNANCE.md` | Analyzer vs human promotion rules |
| `docs/PHASE_7N_RELEASE_PLAN_TEMPLATE.md` | Post-approval release checklist |
| `docs/PHASE_7N_TEST_PLAN_TEMPLATE.md` | Validation checklist |
