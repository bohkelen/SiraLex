# Phase 7N2K4P0 — Choose Next Practical Workstream

## Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

Planning only. No runtime, catalog, bundles, source data, matrices, tests,
packages, or review artifacts were changed. Son/`prix`, `fièvre`, and `poulet`
were not reopened. Usage evidence is not treated as lexical validation or
demand evidence. No validation workflows were created.

## 1. Current baseline

| Field | Value |
| --- | --- |
| Featured / default | `bundle_full_20260710_337619ff` |
| 7N2B closure | `PHASE_7N2B_PROMOTION_CLOSED_STABLE` |
| 7N2I single-word miss copy | `SINGLE_WORD_MISS_COPY_WORKSTREAM_CLOSED` |
| 7N2J featured usage round 3 | `FEATURED_USAGE_ROUND3_NO_ACTIONABLE_ISSUE` |
| Constraint | Prefer the smallest workstream that can move forward now |
| Round-3 residual of note | Successful offline hits still labeled `setup_ux` / `offline_install_reliability` (`7n2j_o2_offline_issue_class_noise`) |

## 2. Evidence inspected

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2j4o2_featured_usage_round3_review_report.md` | No product issue; offline issue-class noise `monitor_only` |
| `docs/reports/phase7n2i4n6_single_word_miss_copy_closure_report.md` | Miss-copy baselines closed |
| `docs/reports/phase7n2h4m4_featured_usage_harness_closure_report.md` | Featured harness mode available |
| `docs/reports/phase7n2b4g13_promotion_closure_report.md` | Catalog schema + storage/import residuals |

## 3. Candidate workstream evaluation table

| workstream_id | value | dependency | risk | recommended_status | reason |
| --- | --- | --- | --- | --- | --- |
| 1 — Catalog schema hardening | Medium — explicit featured/status metadata reduces env/sort ambiguity | Engineering planning then schema/runtime conventions | Medium/high | `defer` | Important G13 residual, but larger than a bounded harness-label fix |
| 2 — Storage/import observation | Low/medium — summarize ~7–8 min featured import/storage | Existing featured harness timings | Low | `monitor_only` | Useful residual watch; not the smallest actionable forward fix after round 3 |
| 3 — English/mixed-language copy | Low/medium — clarify dictionary ≠ sentence translation | Product copy only | Medium if scoped as language expansion | `defer` | Round 3 again found weak signal beyond shipped phrase + single-word miss copy |
| 4 — Tracked bundle cleanup | Medium hygiene — assess older tracked `web/public/bundle_full_*` retention | Retention policy + careful deletion discipline | Medium/high if deleted wrongly | `defer` | Higher risk than harness evidence-quality cleanup |
| 5 — Offline issue-class cleanup | Medium for review quality — stop tagging successful offline hits as `setup_ux` | `evidence_writer.deriveIssueClass` + offline persona `expectedIssueClass`; no product runtime | Low | **recommend_next** | Smallest forward path: repeated N2/O2 residual; harness-only; unblocks clearer future evidence review without lexical/catalog risk |
| 6 — Lexical validation | High if data existed — Son/`prix`, `fièvre`, `poulet` | External owner validation data | High if invented | `blocked` | Still no actionable validation data; do not reopen |

Exactly one `recommend_next`: **5**.

## 4. Recommended workstream

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2K — Offline issue-class cleanup (harness evidence quality)

WORKSTREAM_TYPE:
harness_evidence_labeling_fix

SCOPE_SHAPE:
Plan (then later implement) the smallest change so successful offline/reopen
hit rows are not labeled setup_ux / offline_install_reliability solely because
offline_check personas expect setup_ux — e.g. deriveIssueClass maps hit_* +
offline expected setup_ux → no_issue_observed (or equivalent), while true
offline failures remain setup_ux. Product UI/runtime unchanged.

EXPLICITLY_OUT_OF_SCOPE:
Product empty-state copy; lexical validation/additions; catalog schema;
tracked-bundle deletion; English onboarding expansion; demand ranking;
expanding the diagnostic cohort beyond labeling logic

RATIONALE:
Round 3 found no product usability issue. The clearest remaining practical
fix is harness evidence quality: successful offline rows misread as setup
failures. That is small, local to e2e evidence writing, and can proceed now.

BLOCKERS:
none for P1 plan drafting
```

## 5. Explicit deferrals / blocked items

| Item | Status | Why |
| --- | --- | --- |
| Catalog schema hardening | `defer` | Larger engineering track |
| Storage/import observation | `monitor_only` | Passive residual |
| English/mixed-language copy | `defer` | Weak beyond shipped miss copy |
| Tracked bundle cleanup | `defer` | Higher-risk retention/deletion track |
| Son/`prix`, `fièvre`, `poulet` | `blocked` | No external validation data |

## 6. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Over-clearing real offline failures to `no_issue_observed` | medium | Only remap successful `hit_*` (and maybe content miss with dictionary still active); keep `blocked`/`error` as `setup_ux` |
| Scope creep into persona redesign | medium | Prefer `deriveIssueClass` override; avoid rewriting all offline tasks unless required |
| Treating harness cleanup as product/runtime work | low | Keep changes under `web/e2e/human_usage/` only |
| Lexical reopen via miss rows | medium | Keep lexical track blocked |

## 7. Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2K — Offline issue-class cleanup (harness evidence quality)

WORKSTREAM_TYPE:
harness_evidence_labeling_fix

RATIONALE:
Smallest forward path after round 3: fix misleading setup_ux labels on
successful offline harness rows without product or lexical changes.

BLOCKERS:
none for P1 drafting
```

## 8. Next slice

**Phase 7N2K4P1 — Draft Selected Workstream Plan**

Purpose: draft the minimal `deriveIssueClass` / offline labeling plan,
including trigger cases, non-triggers, test impact, and risks.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

P0 created only this report. No runtime, catalog, bundles, source data,
matrices, tests, packages, or review artifacts were edited.
