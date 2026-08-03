# CF2I6 — Search Feedback Closure Report

## 1. Decision

```text
CF2_SEARCH_FEEDBACK_CLOSED
```

CF2 is a completed product milestone. Executable evidence from CF2D0–CF2I5
supports the locked Missing Entry and Search Failure Feedback capability,
including offline create/manage/edit/export and dictionary-lifecycle retention.
This closure slice is documentation/governance only.

Authoritative chain:

- `docs/reports/pd2_post_cf1_product_build_decision.md`
- owner override `PD2_OWNER_OVERRIDE_CF2_SELECTED`
- `docs/reports/cf2d0_missing_entry_search_failure_feedback_product_definition.md`
- `docs/reports/cf2i1_search_feedback_model_validation_report.md`
- `docs/reports/cf2i2_local_search_feedback_store_report.md`
- `docs/reports/cf2i3_search_failure_capture_surface_report.md`
- `docs/reports/cf2i4_manage_search_feedback_export_report.md`
- `docs/reports/cf2i5_offline_search_feedback_lifecycle_verification_report.md`

No executable evidence contradicts a locked CF2 requirement. No matrix row is
`BLOCKED`.

---

## 2. Product capability closed

```text
A user can deliberately record that a specific search did not meet their need,
preserve that search event as local non-authoritative evidence, manage and
export it offline, and retain its original dictionary provenance without
SiraLex asserting why the search failed or modifying dictionary authority.
```

Evidence test of that claim:

| Clause | Evidence | Result |
| --- | --- | --- |
| Deliberate unmet-search record | CF2I3 Report CTA; CF2I5 Chromium no-result + results-not-useful paths | Satisfied |
| Specific search event preserved | Frozen snapshot; exact `query_raw` / direction / count / provenance | Satisfied |
| Local non-authoritative evidence | Authority label; no corpus write; isolation tests | Satisfied |
| Manage offline | CF2I4 Manage Search Feedback; CF2I5 offline manage/edit | Satisfied |
| Export offline | CF2I4/I5 Blob download + `parseSearchFeedbackJson` | Satisfied |
| Original dictionary provenance retained | CF2I2/I4/I5 removal; Vitest H1→H2 | Satisfied |
| No cause assertion | Observational `result_state` only; UI/export deny missing-entry truth | Satisfied |
| No dictionary authority change | Isolation; no Phase 1.5 auto-apply; no cascade rewrite | Satisfied |

---

## 3. Original problem

Users can search and receive either no results or results that do not meet their
need. CF1 only helps when a genuine `lexicon_entry` already exists. The miss
path had no stable entry identity and no offline way to preserve unmet-search
demand as structured product evidence.

CF2 was defined to measure **miss demand** without inventing lexical content or
diagnosing cause.

---

## 4. Owner-override governance history

```text
PD2 original disposition: PRODUCT_BUILD_DEFERRED
PD2 owner override:       PD2_OWNER_OVERRIDE_CF2_SELECTED
```

PD2 deferred construction because real-use miss-demand evidence was scarce.
That assessment remains historically valid. The owner override reopened the
product-build track and selected CF2 **to capture** that evidence — not because
new empirical proof of demand already existed.

CF2 closure does not rewrite PD2’s evidence assessment. It closes the capture
capability authorized by the override.

---

## 5. Final user loop

```text
Install/use dictionary
  → execute search
  → Report this search (no_result or results_not_useful)
  → optional notes
  → save local feedback
  → Manage Search Feedback
  → inspect / edit explanation / delete
  → Export all search feedback
  → retain local drafts (unchanged by export)
  → later external human triage outside CF2 runtime
```

Offline variant (once shell + dictionary are local):

```text
offline
  → search
  → capture / manage / edit / export
  → hard reload offline
  → feedback remains
```

---

## 6. CF1/CF2 distinction

Frozen:

```text
CF1
known lexicon_entry exists
→ user disputes or suggests something about that entry

CF2
user search did not meet their need
→ there may be no valid ir_id or known lexical object
```

They remain separate products with separate schemas, stores, management
surfaces, exports, and reminders. They may later converge in reviewer tooling,
not in source schemas.

---

## 7. CF2 semantic boundary

Locked distinction:

```text
Observed fact:
A particular search did not satisfy the user.

Possible causes (not inferred by CF2):
missing lexical entry
spelling variation
normalization gap
search/index problem
morphology
phrase/compositional need
wrong language direction
user typo
content gap
ranking/presentation issue
other
```

CF2 stores only the observed fact.

Canonical statement:

> **A CF2 record is evidence of unmet search demand, not evidence of a missing dictionary entry.**

---

## 8. Authority model

Frozen chain:

```text
Installed dictionary
    ↓ lexical authority
Local search-failure feedback draft
    ↓ unmet-search evidence, non-authoritative
siralex_search_feedback_v1 export
    ↓ review handoff, still non-authoritative
External human triage
    ↓ (classification / routing)
Governed lexical research / search engineering / normalization / Branch C gate
    ↓
Approved corpus or search-system change
```

CF2 does **not** bridge the final arrows automatically. Runtime never converts
feedback into missing-entry truth, Phase 1.5 patches, or community publication.

Authority label (frozen):

```text
unreviewed_search_failure_feedback_must_not_be_treated_as_missing_entry_truth
```

---

## 9. Slice/commit history

| Slice | Commit | Subject |
| --- | --- | --- |
| CF2D0 | `432854aa08b762065049a4616c877cf31e99cee1` | Define missing-entry and search-failure feedback product |
| CF2I1 | `10770d7fd9b7bfb20fb691752d1e00288ba95381` | Implement search feedback model and validation |
| CF2I2 | `e6b28d33b0b7b56f239a1aeb5f49d1f52dc74620` | Implement local search feedback store |
| CF2I3 | `0ca58a41edb1a659adecdd26429ced61461397e9` | Implement search failure feedback capture |
| CF2I4 | `9a6f45662c0f6ccd7191c7d814c61f35176767b6` | Implement search feedback management and export |
| CF2I5 | `e94721ffb15bc1601fd72802a9c1ffcdc4229401` | Verify offline search feedback lifecycle |
| CF2I6 | (this closure commit) | Close search feedback capability |

---

## 10. Requirements reconciliation matrix

Status vocabulary: `SATISFIED` | `DEFERRED_BY_DESIGN` | `BLOCKED`.

| # | Requirement | Implementation | Executable evidence | Status | Residual note |
| --- | --- | --- | --- | --- | --- |
| 1 | Unmet-search semantics | CF2D0/I1 | Types + authority label; UI copy | SATISFIED | Not missing-entry truth |
| 2 | No missing-entry inference | CF2I1/I3–I5 | Export/UI deny missing-entry assertion | SATISFIED | |
| 3 | Two runtime result states | CF2I1/I3 | `no_result` \| `results_not_useful` only | SATISFIED | Observational, not diagnosis |
| 4 | Dedicated `feedback_id` | CF2I1/I2 | Secure ID; store keyPath | SATISFIED | |
| 5 | Bundle/hash/scope provenance | CF2I1–I5 | Immutable fields; export retains | SATISFIED | |
| 6 | Exact `query_raw` | CF2I1/I3/I5 | Snapshot + export exact text | SATISFIED | |
| 7 | Immutable search direction | CF2I1/I2/I4 | Edit cannot change direction | SATISFIED | |
| 8 | Immutable result state/count | CF2I1/I2/I4 | Create-only; edit preserves | SATISFIED | |
| 9 | Bounded evidence-only matched IDs | CF2I1/I3 | ≤25 unique resolved IDs; not CF1 targets | SATISFIED | |
| 10 | Optional user explanation | CF2I1/I3/I4 | `requested_meaning` / `user_description` | SATISFIED | |
| 11 | Strict validation | CF2I1 | Draft + package validators | SATISFIED | Empty optional rejected |
| 12 | Dedicated IndexedDB store | CF2I2 | v6 `search_failure_feedback` | SATISFIED | |
| 13 | Secure IDs | CF2I2 | Fail-closed without secure RNG | SATISFIED | |
| 14 | Optimistic concurrency | CF2I2/I4 | `expected_updated_at` | SATISFIED | |
| 15 | Bundle removal retention | CF2I2/I4/I5 | Playwright + store | SATISFIED | No cascade delete |
| 16 | H1→H2 retention | CF2I2/I4/I5 Vitest | H1 kept; `dictionary_content_differs` | SATISFIED | Browser UI N/A |
| 17 | No auto rerun/resolution | CF2I2–I5 | Status remains `draft` | SATISFIED | |
| 18 | Zero-result capture | CF2I3/I5 | Report CTA; Chromium path | SATISFIED | |
| 19 | Results-not-useful capture | CF2I3/I5 | Bottom CTA; no per-result CF2 | SATISFIED | |
| 20 | Stale-search protection | CF2I3/I5 | Generation invalidate; blocked Save | SATISFIED | |
| 21 | Separate management surface | CF2I4/I5 | Manage Search Feedback ≠ Manage Corrections | SATISFIED | |
| 22 | Edit/delete | CF2I4/I5 | Explanation-only edit; confirm delete | SATISFIED | Stale edit/delete Vitest |
| 23 | Deterministic export-all | CF2I1/I4/I5 | Order + reparse + Blob | SATISFIED | |
| 24 | Package authority boundary | CF2I1/I4/I5 | Exact authority label | SATISFIED | |
| 25 | Database deletion reminder | CF2I4/I5 | Independent reminder lifecycle | SATISFIED | |
| 26 | EN/FR | CF2I3–I5 | i18n + FR smoke | SATISFIED | |
| 27 | Accessibility baseline | CF2I3–I5 | Focus/labels/dialog smoke | SATISFIED | Not full WCAG |
| 28 | Offline lifecycle | CF2I5 | Offline Chromium create/manage/edit/export/reload | SATISFIED | Conservative network claim |
| 29 | Query-log isolation | CF2I2–I5 | Counts unchanged by CF2 ops | SATISFIED | Separate consent |
| 30 | CF1 isolation | CF2I2–I5 | CF1 drafts unchanged | SATISFIED | |
| 31 | Learning isolation | CF2I2–I5 | Learning stores unchanged | SATISFIED | |
| 32 | No community/server submission | CF2D0–I5 | No Submit/Send/upload path | SATISFIED | Future CG1 deferred |

No matrix row is `BLOCKED`.

Remote/community submission, backup/restore, and Phase 1.5 conversion remain
`DEFERRED_BY_DESIGN` (listed in §29), not matrix blockers for MVP closure.

---

## 11. Frozen draft schema

```text
schema_version: search_failure_feedback_draft_v1
```

Frozen fields:

```text
schema_version
feedback_id
bundle_id
content_sha256
storage_scope_id
query_raw
search_direction
result_state
result_count
matched_ir_ids?      (results_not_useful only; absent for no_result)
requested_meaning?
user_description?
created_at
updated_at
status               (= "draft" only in CF2 MVP)
```

Frozen result states:

```text
no_result
results_not_useful
```

Frozen directions:

```text
source_to_target
target_to_source
```

Future change requires explicit versioning or compatibility decision.

---

## 12. Frozen export schema

```text
package_schema: siralex_search_feedback_v1
```

Frozen package fields:

```text
package_schema
exported_at
authority_label
feedback_count
feedbacks[]
app_version?   (optional package metadata where implemented)
```

Authority label:

```text
unreviewed_search_failure_feedback_must_not_be_treated_as_missing_entry_truth
```

Ordering:

```text
bundle_id → created_at → feedback_id
```

Cap:

```text
SEARCH_FEEDBACK_MAX_BYTES = 25 MiB
```

Export does not mutate drafts, change status, or submit remotely.

---

## 13. Identity/provenance contract

Canonical identity:

```text
feedback_id
```

Canonical historical provenance (immutable after create):

```text
bundle_id
content_sha256
storage_scope_id
query_raw
search_direction
result_state
result_count
matched_ir_ids?
```

Clarify:

* `matched_ir_ids` are evidence only;
* they are not CF1 correction targets;
* they are not required foreign keys;
* query/search provenance is immutable after creation.

Editable only:

```text
requested_meaning
user_description
```

---

## 14. IndexedDB/store contract

```text
SIRALEX_DB_VERSION = 6
STORE_SEARCH_FAILURE_FEEDBACK = "search_failure_feedback"
keyPath = "feedback_id"
indexes = none
```

Lifecycle:

```text
bundle removal
→ feedback retained

bundle H1 → H2 update
→ feedback retained with H1 provenance

active bundle switch
→ feedback retained

full database deletion
→ feedback removed
```

No cascade delete on bundle lifecycle. No automatic rerun. No automatic
resolution.

---

## 15. Capture contract

Two entry points only:

```text
zero-result search
→ Report this search

results exist but unsatisfactory
→ Didn't find what you needed?
→ Report this search
```

No per-result CF2 button. Specific entry-content defects remain CF1.

Capture binds a frozen executed-search snapshot, applies stale protection via
generation invalidation, and saves locally only.

---

## 16. Management contract

Separate surface:

```text
Manage Search Feedback
```

Not merged with Manage Corrections.

MVP management:

```text
list
detail
edit user explanation
delete
export all
```

Dictionary availability states (neutral context, not resolution):

```text
dictionary_current
dictionary_content_differs
dictionary_unavailable
```

Independent DB-deletion reminder: `#searchFeedbackDeleteReminder`.

---

## 17. Bundle lifecycle semantics

| Event | Feedback | Availability |
| --- | --- | --- |
| Remove originating bundle | Retained | `dictionary_unavailable` |
| Update same logical bundle H1→H2 | Retained with H1 hash/scope | `dictionary_content_differs` |
| Switch active bundle | Retained | Recomputed vs installed meta |
| Clear/delete database | Removed | — |

Edit/export/delete remain available while unavailable or content-differs.

---

## 18. Edit/delete semantics

Edit replaces optional explanation fields only; optimistic concurrency via
`expected_updated_at`; stale edit blocks overwrite and reloads current.

Delete requires confirmation; stale delete prevents deletion; no tombstones;
no cascade to dictionary/Learning/CF1/query logs.

---

## 19. Export semantics

Pipeline:

```text
readonly snapshot
→ validate all
→ deterministic package
→ serialize
→ UTF-8 byte check
→ production reparse
→ local Blob download
→ revoke object URL
```

Rules:

* export-all only;
* empty disabled;
* repeat allowed;
* no draft deletion;
* no draft status change;
* no submission state;
* no server upload.

---

## 20. Offline guarantee

Evidence-supported wording only:

> **Core CF2 operations operate without a remote network dependency once the application shell and dictionary are locally available.**

Verified offline: search, capture, local save, manage, edit, export, hard
reload, persistence.

Do **not** claim zero HTTP requests.

---

## 21. Privacy boundary

Recorded precisely:

* exact reported query text is stored;
* user notes are stored;
* data is plaintext in IndexedDB;
* export is plaintext JSON;
* no account identity field;
* no device identity field;
* no automatic upload;
* no encryption in CF2;
* query-log consent is separate;
* user-triggered Report is the deliberate act that causes CF2 storage.

Preferred wording:

```text
unattributed within the CF2 data model
```

Not cryptographically anonymous.

---

## 22. Query-log boundary

```text
Query logs
→ optional diagnostic observation
→ governed by separate logging consent
→ may record searches automatically while enabled

CF2
→ deliberate user feedback
→ created only by Report this search
→ separate store/schema/export
```

No query-log record becomes CF2 automatically. CF2 does not enable or require
query logging.

---

## 23. Learning boundary

```text
CF2 is not Learning data.
```

No Learning Record identity, Save/Review/Progress state, LP1 backup/restore, or
Learning export coupling. Correction/search-feedback backup remains deferred.

---

## 24. CF1 boundary

CF2 create/edit/export/delete leave CF1 drafts untouched. CF2 export contains no
CF1 fields. Surfaces, reminders, and schemas remain separate.

---

## 25. Phase 1.5 boundary

CF2 export is not Phase 1.5 correction input.

Future routing (external):

```text
CF2 evidence
→ human triage

if true lexical gap:
  lexical research / governed entry creation

if search/index issue:
  search engineering

if normalization issue:
  normalization evidence process

if morphology/phrase issue:
  linguistic evidence gate / Branch C process
```

No runtime path:

```text
CF2 → corpus patch
```

---

## 26. Branch C/search evidence role

Strategic function:

```text
CF2
→ measures miss demand
→ exposes recurring unmet-search patterns
→ creates evidence for later decisions
```

Downstream findings may later justify normalization, aliases, phrase handling,
morphology, ranking, or content additions. CF2 itself diagnoses none of them.

---

## 27. Community/governance boundary

Current runtime boundary (frozen):

```text
Save → local device
Manage Search Feedback → local device
Export → local JSON file
```

None of those means submitted, sent to moderators, visible to community,
approved, or published.

Future governance direction (not implemented):

> **Submission access may eventually be broad, but review visibility and lexical authority must remain governed.**

Recommended future architecture:

```text
local CF1 / CF2 evidence
→ explicit future submission action
→ centralized intake
→ deduplication / abuse controls
→ triage
→ qualified linguistic/editorial review
→ governed corpus decision
```

Ordinary users should not automatically see all other users’ raw notes.

---

## 28. Future CG1 concept

Deferred future capability (not authorized by CF2I6):

```text
CG1 — Community Feedback Governance
```

Conceptual scope:

```text
remote submission protocol
central intake
deduplication/grouping
abuse/rate controls
review queues
reviewer roles
editorial decision workflow
audit history
Phase 1.5/corpus bridge
```

This is **not** CF2I7. Do not automatically authorize it.

---

## 29. Deferred work

```text
remote/community submission
central moderation/reviewer dashboard
contributor identity/accounts
contributor reputation
public voting/comments
deduplication/aggregation service
abuse/rate controls
submission status tracking
server sync
search-feedback import
CF2 backup/restore
LP1 integration
automatic missing-entry classification
automatic search diagnosis
automatic resolution
search rerun against newer dictionary
Phase 1.5 conversion tooling
Branch C morphology/transliteration
phrase/compositional runtime work
LS4
```

CF2 closure does **not** complete community contribution governance.

---

## 30. Residual risks

### R1 — Query sensitivity

| | |
| --- | --- |
| Impact | Exact search text may contain sensitive user-authored content |
| Current mitigation | Local-only explicit Report; plaintext warnings |
| Future owner/slice | Privacy/encryption decision; future submission consent |

### R2 — No backup/restore

| | |
| --- | --- |
| Impact | CF2 drafts lost on full DB deletion unless manually exported |
| Current mitigation | Deletion reminder + export-all |
| Future owner/slice | CF2 backup/import or LP1 integration decision |

### R3 — No centralized intake

| | |
| --- | --- |
| Impact | Exported files do not automatically reach reviewers |
| Current mitigation | Explicit non-submission boundary |
| Future owner/slice | CG1 / remote submission capability |

### R4 — Cause remains unknown

| | |
| --- | --- |
| Impact | Miss may stem from content, spelling, normalization, morphology, ranking, or user behavior |
| Current mitigation | No automatic diagnosis; observational states only |
| Future owner/slice | Human triage / later analysis tooling |

### R5 — Result-ID snapshot bounded

| | |
| --- | --- |
| Impact | `matched_ir_ids` captures at most 25 result identities |
| Current mitigation | Evidence-only semantics + full `result_count` |
| Future owner/slice | Schema version if larger snapshots required |

### R6 — Dictionary evolution

| | |
| --- | --- |
| Impact | Old feedback may reference a dictionary version no longer installed |
| Current mitigation | Immutable H1 provenance + neutral availability states |
| Future owner/slice | Reviewer workflow / later management UX |

### R7 — Physical-device validation

| | |
| --- | --- |
| Impact | CF2 Chromium lifecycle is verified; wider release/device evidence remains PV1 |
| Current mitigation | Playwright Chromium + Vitest lifecycle |
| Future owner/slice | PV1A / PV1B |

---

## 31. Test/evidence baseline

Final CF2I5 baseline (no runtime files changed in CF2I6):

```text
CF2I5 focused:
13 files / 143 tests PASS

CF2I5 E2E:
7 Chromium tests PASS

Full:
79 files / 794 tests PASS

Build:
PASS

PRODUCT_DEFECTS found in I5:
0

Product runtime changes in I5:
none
```

Evidence path (gitignored):

```text
data/local_evidence/cf2_offline_lifecycle/<run_id>/
```

---

## 32. Production/PV1 boundary

```text
CF2 product capability: CLOSED
PV1A: remains active
PV1B: remains hardware-gated / not run
```

CF2 browser verification does not substitute for production-host identity,
deployed catalog validation, Android validation, or broader physical-device
release validation.

---

## 33. Deviations from CF2D0

| Deviation | Classification | Note |
| --- | --- | --- |
| `no_result` requires `matched_ir_ids` absent (empty `[]` rejected) | contract-tightening | D0 allowed omit or empty; I1 locked absence |
| Optional blank/`""` fields rejected (canonical absence) | contract-tightening | D0 preferred absence; I1 enforces |
| `matched_ir_ids` derived from resolved search-result records (≤25 unique, stable order) | compatible | Implements D0 evidence-only matched IDs |
| Browser H1→H2 path `NOT_APPLICABLE`; Vitest covers retention | compatible | Same evidence strategy as CF1 |
| Stale edit/delete verified via Vitest rather than browser injection | compatible | Capture stale path verified in browser |
| Management/export module decomposition (`session` / `export` / render) | compatible | Exact D0 surface semantics preserved |
| Stricter validator rules (canonical hash, caps, error limit) | contract-tightening | Within D0 validation intent |
| Store behavior tightenings (immutable provenance; secure IDs) | contract-tightening | Within D0 store intent |
| Observational wording refinements in UI/export | compatible | Strengthens no-diagnosis semantics |

No unexplained `scope-expansion`. No closure blocker.

---

## 34. Files changed — exact A/M/D list

Generated after CF2I6 commit from:

```bash
git diff --name-status e94721f..HEAD
```

```text
Files changed
-------------
M  docs/ROADMAP.md
A  docs/reports/cf2i6_search_feedback_closure_report.md
```

---

## 35. Untracked files

```text
Untracked files: none
```

---

## 36. Repository hygiene

- Docs-only closure; no runtime, tests, DB, or schema changes.
- No secrets / user data committed.
- Working tree clean after commit.

---

## 37. Final closure statement

> **CF2 closes the unmet-search evidence loop at the boundary where a user can preserve and export a failed or unsatisfactory search without SiraLex claiming the cause, changing dictionary authority, or sending the evidence to a community system.**

Portfolio state after closure:

```text
Product-build track:
NO ACTIVE PRODUCT BUILD

Release-readiness:
PV1A active
PV1B hardware-gated / not run
```

Potential future candidates remain evidence-driven (CG1, remote submission,
Branch C, phrase/search improvements, LS4, other roadmap items). CF2I6 does not
automatically select one.
