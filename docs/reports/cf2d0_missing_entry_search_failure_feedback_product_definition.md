# CF2D0 — Missing Entry and Search Failure Feedback Product Definition

## 1. Decision

```text
CF2_SEARCH_FAILURE_FEEDBACK_PRODUCT_DEFINED
```

CF2 is defined as a complete, bounded, offline-first search-failure feedback
product. This slice is documentation-only. No runtime code, tests, IndexedDB
schema, UI, CSS, i18n, Playwright, bundles, corpus data, correction artifacts,
catalog files, or deployment configuration were modified.

Governance posture:

```text
PD2_OWNER_OVERRIDE_CF2_SELECTED
```

PD2 originally deferred product construction because real-use miss-demand
evidence was scarce. The owner has now explicitly authorized CF2. This is a
**governance override**, not new empirical evidence that CF2 demand has already
been proven. CF2 is therefore built to **capture the missing evidence**, not as
if that evidence already exists.

Authoritative inputs:

- owner override selecting CF2 after PD2
- `docs/reports/pd2_post_cf1_product_build_decision.md`
- `docs/reports/cf1i6_correction_feedback_closure_report.md`
- `docs/reports/cf1d0_community_correction_feedback_product_definition.md`
- `web/src/search/search_query.ts` (`SearchResult`)
- `web/src/render/render_results.ts` (no-result / phrase-miss guidance)
- `web/src/idb/siralex_db.ts` (IndexedDB v5 stores)
- query-log consent and export boundary
- CF1 secure ID / ISO timestamp / export-all / retention patterns
- current EN/FR interface conventions
- offline-first and linguistic-evidence gates
- `docs/PHASE_7N1_RELEASE_DECISION.md` (device matrix remains independent)

Why not blocked:

- search-event identity does not require a lexicon `ir_id`;
- feedback asserts unmet need, not linguistic cause;
- dedicated store/export keep CF1, query logs, and Learning isolated;
- full offline create/manage/export is definable;
- Phase 1.5 / Branch C remain outside runtime;
- PV1 remains parallel and is not redefined as CF2 work.

---

## 2. Product outcome

> A local, user-initiated search-failure feedback system that lets users report
> that a search did not give them the entry they needed, capture structured
> search-context evidence without inventing lexical content, manage those
> drafts locally, and export a deterministic search-feedback packet for later
> human triage.

CF2 is **not**:

- automatic missing-entry truth;
- new dictionary-entry authoring;
- live dictionary editing;
- morphological or normalization diagnosis;
- AI-generated entries;
- cloud submission;
- moderation;
- query logging;
- CF1 correction drafts under another name;
- Phase 1.5 patches;
- Branch C / sentence analysis;
- LS4;
- PV1 work.

---

## 3. Product problem

Users can search and receive either **no results** or **results that do not
meet their need**. Today there is no deliberate, offline way to preserve that
observation as structured product evidence.

CF1 only helps when a genuine `lexicon_entry` already exists and can be opened.
The miss path has no stable entry identity and was explicitly excluded from CF1.

CF2 converts unsuccessful or inadequate searches into reviewable local
artifacts so the project can measure **miss demand**.

### Key term — Miss demand

```text
Miss demand: user demand that the current dictionary/search system cannot
satisfactorily serve.
```

CF2’s strategic value is measuring miss demand. It does not prove why a miss
occurred.

---

## 4. Definition question

> What structured evidence can SiraLex safely capture when the user cannot
> identify a valid existing lexicon entry?

Answer:

```text
Capture the search event context + optional user explanation as
non-authoritative failure evidence.
Do not assert that the dictionary is missing a word.
Do not invent a lexicon entry.
Do not diagnose morphology, normalization, ranking, or phrase cause.
```

A search failure can mean many things:

```text
true missing lexical entry
spelling variation
unsupported morphology
normalization failure
index/search defect
wrong language direction
phrase/sentence query
user typo
dictionary content gap
valid result existed but was not useful
```

CF2 records **failure evidence**. Later human review may classify causes.

---

## 5. Authority boundary

```text
Installed dictionary remains authoritative.
CF2 drafts are non-authoritative search-failure evidence.
Exports remain unreviewed user feedback.
Only later human triage may classify cause and route work.
Only governed corpus / search engineering processes may change the product.
```

Frozen claim language:

```text
This report says the search did not meet the user's need.
It does not say SiraLex has proven a missing dictionary entry.
```

---

## 6. CF1 / CF2 distinction

| | CF1 | CF2 |
| --- | --- | --- |
| Trigger | Known lexicon entry defect | Search unmet need |
| Identity | `bundle_id` + `ir_id` (+ hash/scope) | `bundle_id` + search event (+ hash/scope) |
| Requires `ir_id` | Yes | No |
| Asserts | Something about an existing entry | Search did not satisfy the user |
| Store | `correction_drafts` | `search_failure_feedback` |
| Manage surface | Manage Corrections | Manage Search Feedback |
| Export | `siralex_correction_feedback_v1` | `siralex_search_feedback_v1` |
| Phase 1.5 relationship | Possible later conversion after review | Not correction data; triage/routing only |

```text
CF1:
known lexicon_entry exists
→ user disputes its content

CF2:
desired lexical result is absent or search did not surface it
→ there may be no valid ir_id
```

Do **not** reuse CF1’s entry identity contract where no entry exists.
Do **not** convert CF2 drafts into CF1 correction drafts automatically.

---

## 7. Feedback taxonomy

### Runtime feedback kinds (MVP)

```ts
type SearchFailureFeedbackKind =
  | "no_result"
  | "results_not_useful";
```

Stored on the draft as:

```ts
result_state: "no_result" | "results_not_useful"
```

Rules:

- kind is determined by **entry point**, not by user self-diagnosis;
- do **not** call both `missing_entry`;
- do **not** ask the user to choose morphology / index / phrase taxonomy.

### Reviewer classifications (out of MVP runtime)

Future human/governed review may assign labels such as:

```text
missing_entry
search_index_problem
normalization_problem
morphology_gap
phrase_request
duplicate
existing_entry_not_found
other
```

These belong to review/governance, not automatic runtime inference.

---

## 8. Canonical entry points

### A. No-result surface (primary)

When search returns zero results, extend the existing miss guidance with:

```text
EN: Report this search
FR: Signaler cette recherche
```

Placement: immediately with the no-result / phrase-miss message currently
produced by `getNoResultMessage` / `searchMeta` miss branch. This is CF2’s
strongest canonical entry point and creates `result_state = "no_result"`.

### B. Existing-results surface (secondary)

When search returns one or more results, provide a restrained secondary
affordance below the result list (not on each row):

```text
EN: Didn't find what you needed?
    Report this search.
FR: Vous n’avez pas trouvé ce qu’il vous fallait ?
    Signaler cette recherche.
```

This creates `result_state = "results_not_useful"`.

### Explicit entry-point exclusions

- no report button on every result row;
- no requirement to pick an existing entry;
- no CF2 affordance on entry detail (that remains CF1);
- no CF2 affordance inside Review, Progress, Learning backup, Manage
  Corrections, or Advanced diagnostics query-log controls;
- no automatic report creation from query logs.

---

## 9. User loop

```text
Search
  → no useful result
  → Report this search
  → confirm read-only query + direction context
  → optionally explain what they were trying to find
  → optionally add details
  → Save report
  → Manage Search Feedback
  → inspect / edit / delete
  → Export search feedback
  → retain local drafts (unchanged by export)
  → later external human triage outside CF2 runtime
```

Offline variant once shell + dictionary are local:

```text
offline search
  → failed/unsatisfactory result
  → save feedback
  → manage
  → export
  → reload offline
  → drafts remain
```

---

## 10. Search context identity / provenance

CF2 has no guaranteed `(bundle_id, ir_id)`.

Frozen search-event provenance:

```ts
type SearchFailureContextV1 = {
  bundle_id: string;
  content_sha256: string; // canonical sha256: + 64 lowercase hex
  storage_scope_id: string;

  query_raw: string;
  search_direction: "source_to_target" | "target_to_source";

  result_state: "no_result" | "results_not_useful";

  result_count: number; // 0 for no_result
  matched_ir_ids?: string[]; // evidence only; see §12
};
```

Source of provenance at capture time (same active-bundle meta CF1 uses, without
entry binding):

- `bundle_id` ← active bundle meta
- `content_sha256` ← `expected_content_sha256`
- `storage_scope_id` ← `getBundleStorageScopeId(activeMeta)`
- `query_raw` ← exact settled search string
- `search_direction` ← settled direction
- `result_state` / `result_count` / optional `matched_ir_ids` ← settled search
  outcome

Locks:

- provenance is immutable after create;
- bundle update/removal must not rewrite query context;
- `matched_ir_ids` never convert a CF2 draft into a CF1 correction draft;
- for `no_result`, `matched_ir_ids` are omitted or empty and `result_count = 0`.

---

## 11. Frozen draft schema

```ts
type SearchFailureFeedbackDraftV1 = {
  schema_version: "search_failure_feedback_draft_v1";

  feedback_id: string;

  bundle_id: string;
  content_sha256: string;
  storage_scope_id: string;

  query_raw: string;
  search_direction: "source_to_target" | "target_to_source";
  result_state: "no_result" | "results_not_useful";
  result_count: number;

  matched_ir_ids?: string[];

  requested_meaning?: string;
  user_description?: string;

  created_at: string; // ISO-8601 UTC with Z
  updated_at: string; // ISO-8601 UTC with Z

  status: "draft";
};
```

### Field decisions

| Field | MVP decision | Rationale |
| --- | --- | --- |
| `requested_meaning` | Optional | Primary “What were you trying to find?” signal; useful without becoming entry authoring |
| `user_description` | Optional | Additional details only |
| `result_count` | Required | Tiny; distinguishes empty vs multi-result dissatisfaction |
| `matched_ir_ids` | Optional; only meaningful for `results_not_useful` | Evidence of what was shown; not CF1 targeting |
| matched key / ladder / normalized keys | **Excluded** | Diagnostic telemetry; belongs to query logs, not deliberate feedback |
| POS / N’Ko / morphology / examples | **Excluded** | Would invent dictionary-authoring scope |

Save rules:

- query context alone is sufficient evidence; both user text fields may be empty;
- UI emphasizes `requested_meaning` but does not hard-require it;
- status remains `"draft"` only; no submitted/exported/resolved statuses in MVP.

---

## 12. Result-ID capture decision

```text
MVP: capture matched_ir_ids for results_not_useful only
```

Details:

- preserve search order;
- hard cap: **25** IDs;
- omit or empty array for `no_result`;
- IDs are dictionary identifiers, not account identity;
- they are review evidence only;
- they do not authorize CF1 correction creation;
- they must not be rendered as editable targets in the CF2 form.

Rejected for MVP:

- capturing full result display snapshots;
- capturing matched ladder key / key type;
- capturing normalized key arrays.

Those remain available through opt-in query logs when enabled, under a separate
consent boundary.

---

## 13. User-authored fields and form

Keep the form extremely small.

```text
Search:
<read-only exact query>
Direction:
<read-only direction label from active bundle metadata>

What were you trying to find?
[optional text → requested_meaning]

Additional details
[optional text → user_description]

[privacy warnings]

Save report
Cancel
```

### Size limits (Unicode code points)

| Field | Max |
| --- | --- |
| `query_raw` | 1000 |
| `requested_meaning` | 2000 |
| `user_description` | 2000 |

Empty-query reports are rejected. Whitespace-only user text is stored as absent
/ empty after trim policy defined in CF2I1 validation.

### Forbidden form fields

- POS guesses;
- morphology classification;
- language-family taxonomy;
- suggested N’Ko;
- pronunciation fields;
- example sentences;
- linguistic diagnosis;
- “create dictionary entry” controls.

### Primary UX principle

CF2 is not:

```text
Add a missing dictionary entry
```

It is:

```text
Tell us what you were trying to find.
```

---

## 14. EN/FR terminology

| Role | EN | FR |
| --- | --- | --- |
| Primary action | Report this search | Signaler cette recherche |
| Results prompt | Didn't find what you needed? | Vous n’avez pas trouvé ce qu’il vous fallait ? |
| Meaning field | What were you trying to find? | Que cherchiez-vous à trouver ? |
| Details field | Additional details | Détails supplémentaires |
| Save | Save report | Enregistrer le signalement |
| Manage surface | Manage Search Feedback | Gérer les retours de recherche |
| Local save confirmation | Search feedback saved on this device. | Retour sur la recherche enregistré sur cet appareil. |
| Export action | Export search feedback | Exporter les retours de recherche |
| Older-dictionary note | Search was recorded against an older dictionary version. | Cette recherche a été enregistrée avec une ancienne version du dictionnaire. |

Forbidden product language in MVP:

```text
Add missing word
Submit new entry
Create dictionary entry
Missing entry confirmed
```

---

## 15. Storage architecture

```text
Option A — dedicated store: SELECTED
```

```text
store name: search_failure_feedback
keyPath: feedback_id
indexes: none in MVP
SIRALEX_DB_VERSION: 5 → 6 (additive createObjectStore only)
```

Rejected:

```text
Option B — generic feedback store shared with CF1
```

Why dedicated:

- CF1 identity is bundle + lexicon `ir_id`;
- CF2 identity is bundle + search event;
- authority, validation, lifecycle, and review semantics differ;
- collapsing them creates a fake abstraction.

Reuse low-level patterns from CF1 where semantics match (secure IDs, ISO-Z
timestamps, export-all, retention). Do not force-share CF1 modules or schema.

---

## 16. ID generation and timestamps

### IDs

```text
feedback_id: crypto.randomUUID()
fallback: crypto.getRandomValues UUID v4
fail closed if secure RNG unavailable
```

No `Math.random`, no timestamp IDs, no query-derived IDs.
Create uses add-not-put semantics; duplicate `feedback_id` fails closed.

### Timestamps

```text
created_at / updated_at: Date.toISOString() UTC with Z
validator: round-trippable ISO-8601 UTC Z
```

`created_at` immutable after create. `updated_at` changes only on allowed edits.

---

## 17. Edit / delete semantics

Editable after create:

- `requested_meaning`
- `user_description`
- `updated_at`

Immutable after create:

- schema version, feedback id, bundle/hash/scope, query_raw, direction,
  result_state, result_count, matched_ir_ids, created_at, status

Delete:

- confirmed delete;
- no tombstones;
- does not touch dictionary, Learning, query logs, or CF1 drafts.

Stale concurrency:

- use `expected_updated_at` on update/delete like CF1;
- stale paths do not overwrite or delete silently.

---

## 18. Dictionary lifecycle

| Event | Feedback fate | Manage UI |
| --- | --- | --- |
| Bundle removed | Retained with original provenance | Show unavailable / older-context note as needed |
| Content hash changes H1→H2 | Retained with original H1 provenance | “Search was recorded against an older dictionary version.” |
| Full database deletion | Removed | Reminder hidden after recreate |

Locks:

- do not cascade-delete on bundle removal;
- do not rewrite query context;
- do not automatically re-run search and mutate saved feedback;
- no automatic “resolved” status in MVP.

---

## 19. Search-rerun behavior

```text
Deferred from MVP
```

A future “Re-run this search against the current dictionary” action may help
detect fixed failures, but it introduces cross-version comparison, resolution
semantics, and status transitions. CF2D0 evaluates and rejects it for MVP.

---

## 20. Automatic resolution semantics

```text
None in MVP
```

No auto-resolved, auto-closed, auto-duplicate, or auto-missing-entry states.

---

## 21. Management surface

```text
Manage Search Feedback
```

Separate from:

```text
Manage Corrections
```

Do **not** expand CF1 Manage Corrections into a generic feedback dashboard in
CF2 MVP.

Placement guidance:

- secondary shell control near other manage actions (Saved Vocabulary / Manage
  dictionaries / Manage Corrections), without burying it in Advanced diagnostics;
- management surface may replace the main results host similarly to CF1 manage,
  but remains a distinct session/UI module;
- list shows query, result_state, timestamps, optional meaning snippet, and
  older-dictionary note when hashes differ;
- edit/delete/export live here.

Future optional grouping:

```text
Manage Feedback
  Corrections
  Search feedback
```

is out of CF2 MVP scope.

---

## 22. Export architecture

Preferred and selected MVP package:

```text
package_schema: siralex_search_feedback_v1
```

Not:

```text
siralex_correction_feedback_v1
```

### Package shape

```ts
type SiralexSearchFeedbackPackageV1 = {
  package_schema: "siralex_search_feedback_v1";
  exported_at: string;
  app_version?: string;
  authority_label:
    "unreviewed_search_failure_feedback_must_not_be_treated_as_missing_entry_truth";
  feedback_count: number;
  feedbacks: SearchFailureFeedbackDraftV1[];
};
```

### Export rules

- export-all only;
- empty export disabled;
- validate every local row before build;
- duplicate `feedback_id` blocks export;
- no partial package;
- no export-state mutation of drafts;
- repeat export allowed;
- reparse generated artifact before download;
- max bytes: **25 MiB** (dedicated CF2 constant);
- deterministic ordering:

```text
bundle_id asc → created_at asc → feedback_id asc
```

Filename pattern (implementation may refine clock formatting):

```text
siralex-search-feedback-<UTC-timestamp>.json
```

Success copy reports filename and count only — never upload, receipt, review
completion, or dictionary application.

---

## 23. Import / non-import

```text
No import / restore in CF2 MVP
```

Export is handoff evidence, not a backup product. A future correction/search
feedback backup decision remains separate (parallel to CF1 residual R4).

---

## 24. Database deletion and reminders

Full database deletion removes `search_failure_feedback`.

UI reminder:

- dedicated CF2 reminder near clear-database controls;
- **not** merged with Learning backup reminder;
- **not** merged with CF1 correction reminder;
- reminder links to Manage Search Feedback.

---

## 25. Privacy boundary

CF2 necessarily stores exact `query_raw`. That may be sensitive.

Frozen privacy rules:

- plaintext local IndexedDB storage;
- plaintext export files;
- no account identity field;
- no device identity field;
- no automatic upload;
- no encryption requirement in MVP;
- explicit privacy warnings on form and before export;
- wording must say local device storage and that export contains search text;
- do not call the system cryptographically “anonymous.”

Suggested warning themes (EN/FR keys in implementation):

```text
This report is saved on this device.
It includes the exact search text.
Exporting creates a file you can share; SiraLex does not upload it automatically.
This report does not change the dictionary.
```

---

## 26. Query-log boundary

```text
query logging consent ≠ CF2 feedback consent
```

| | Query logs | CF2 |
| --- | --- | --- |
| Purpose | diagnostic/search-behavior observation | deliberate unmet-need feedback |
| Activation | explicit logging consent | explicit Report action |
| Recording | potentially automatic while enabled | only selected feedback |
| Store | `query_logs` | `search_failure_feedback` |
| Export | query-log JSONL | `siralex_search_feedback_v1` |

Locks:

- CF2 must not require query logging enabled;
- CF2 must not enable query logging;
- CF2 must not silently copy query-log rows;
- query logs must not automatically become CF2 feedback;
- no shared consent checkbox.

---

## 27. Learning boundary

CF2 create/edit/delete/export change only `search_failure_feedback` (+ UI host
state). Learning Records, LP1 packages, Review/Progress mechanics, and Learning
reminders remain unchanged and unmerged.

---

## 28. CF1 boundary

- separate store;
- separate manage surface;
- separate export package;
- separate deletion reminder;
- no automatic conversion either direction;
- opening an entry to use CF1 remains available and independent;
- `matched_ir_ids` in CF2 are not CF1 draft targets.

---

## 29. Phase 1.5 boundary

CF2 export is **not** correction data and cannot directly become a corpus patch.

Future process:

```text
CF2 evidence
  → human triage
  → classify cause
  → if true lexical gap:
       lexical research / entry creation
       → governed corpus process
  → if search problem:
       search engineering
  → if morphology / phrase / normalization issue:
       linguistic-evidence gate / later program
```

CF2 is a routing mechanism for evidence, not a Phase 1.5 input format.

---

## 30. Branch C / search evidence relationship

```text
CF2 → evidence
  → later linguistic/search diagnosis
  → only then Branch C / search expansion where justified
```

CF2 must not contain:

- morphology analyzers;
- automatic phrase decomposition;
- ranking changes;
- inferred cause labels;
- Branch C implementation.

Its value is enabling those later decisions with measured miss demand.

---

## 31. Offline requirement

Required:

```text
offline search
→ failed/unsatisfactory result
→ save feedback
→ manage
→ export
```

No cloud submission. No telemetry requirement. No online reviewer.
Evidence wording must stay conservative (no remote dependency for core CF2
operations once shell + dictionary are local), matching CF1 offline discipline.

---

## 32. Accessibility

Baseline equivalent to CF1:

- headings and labeled fields;
- status/error regions;
- keyboard operable controls;
- focus management on open/save/cancel/delete;
- `aria-busy` during save/export where applicable;
- confirm before delete;
- N’Ko/`lang`/`dir` only if such text appears in UI chrome (query may contain
  mixed scripts; preserve user text as entered).

Not a full WCAG certification milestone.

---

## 33. Validation bounds

Implementation (CF2I1) must enforce:

| Rule | Bound |
| --- | --- |
| schema_version | exact `search_failure_feedback_draft_v1` |
| feedback_id | non-empty secure UUID string |
| content_sha256 | `/^sha256:[0-9a-f]{64}$/` |
| query_raw | 1..1000 after capture policy |
| result_count | integer ≥ 0; `no_result` ⇒ 0 |
| matched_ir_ids | absent/empty for `no_result`; ≤ 25 for `results_not_useful` |
| user text fields | ≤ 2000 each |
| status | `"draft"` only |
| validation error accumulation | cap 100 structural errors; no user-text echo in codes |

---

## 34. Resolved definition questions checklist

| # | Question | Resolution |
| --- | --- | --- |
| 1 | Exact record schema | Frozen `search_failure_feedback_draft_v1` in §11 |
| 2 | Dedicated vs shared store | Dedicated `search_failure_feedback`; DB v6 |
| 3 | ID generation | Secure UUID; fail closed |
| 4 | Timestamp semantics | ISO-8601 UTC Z; created immutable; updated on edit |
| 5 | Max query size | 1000 Unicode code points |
| 6 | Max user-description size | 2000; same for requested_meaning |
| 7 | Whether `requested_meaning` exists | Yes, optional primary meaning field |
| 8 | Whether result IDs are captured | Yes for `results_not_useful`, cap 25; not for no_result |
| 9 | Whether result count is captured | Yes, required |
| 10 | Whether matched-key info is captured | No in MVP |
| 11 | Whether normalization/search diagnostics are captured | No in MVP |
| 12 | One or two report classes | Two: `no_result`, `results_not_useful` |
| 13 | Exact no-result entry point | “Report this search” on miss surface |
| 14 | Exact results-not-useful entry point | Secondary prompt below results list |
| 15 | Management surface placement | Separate Manage Search Feedback |
| 16 | Edit/delete behavior | Edit user text only; confirm delete; stale-safe |
| 17 | Bundle update/removal lifecycle | Retain original provenance; no rewrite/rerun |
| 18 | Export schema | `siralex_search_feedback_v1` |
| 19 | Export-all vs selected | Export-all only |
| 20 | Import/non-import | No import in MVP |
| 21 | Database deletion behavior | Store cleared; dedicated reminder |
| 22 | Relationship to correction deletion reminders | Separate; not merged |
| 23 | Privacy warning | Required; query text disclosed |
| 24 | Query-log isolation | Absolute; separate consent |
| 25 | Learning isolation | Absolute |
| 26 | EN/FR terminology | Frozen in §14 |
| 27 | Offline requirement | Required end-to-end local loop |
| 28 | Accessibility | CF1-equivalent baseline |
| 29 | Phase 1.5 boundary | Not correction data; triage/routing only |
| 30 | CF1 boundary | Separate identity/store/manage/export |
| 31 | Search-rerun behavior | Deferred from MVP |
| 32 | Automatic resolution semantics | None in MVP |
| 33 | Evidence for future search/Branch C | Yes as undiagnosed miss-demand evidence |
| 34 | Implementation slice plan | CF2I1–CF2I6 in §36 |

All listed definition questions are resolved for product definition purposes.

---

## 35. Explicit non-goals

```text
automatic new-entry creation
dictionary editing
automatic morphological analysis
AI-generated dictionary entries
automatic diagnosis of why search failed
cloud submission
moderation
accounts
public voting
comments
telemetry
query-log activation
automatic correction creation
Phase 1.5 patches
corpus mutation
sentence analysis
Branch C implementation
LS4
PV1 changes
shared CF1/CF2 store
generic Manage Feedback dashboard
search re-run / auto-resolution
import/restore of search feedback
matched-key / ladder capture in CF2 drafts
```

---

## 36. Implementation slices

Do not implement during CF2D0.

```text
CF2I1 — Search Feedback Model and Validation
CF2I2 — Local Search Feedback Store
CF2I3 — Search Failure Capture Surface
CF2I4 — Manage Search Feedback and Export
CF2I5 — Offline Search Feedback Lifecycle Verification
CF2I6 — CF2 Closure
```

Notes:

- reuse CF1 low-level patterns only where semantics genuinely match;
- do not force-reuse CF1 modules;
- PV1A/PV1B remain parallel and must not be displaced by CF2 implementation;
- CF2 captures evidence; it does not claim demand already proven.

Suggested module seams (non-binding until implementation):

```text
web/src/search_feedback/  (types, validate, store, session, export/package)
web/src/render/           (capture form + manage surface renderers)
i18n keys under searchFeedback.*
```

---

## 37. Success criterion

CF2D0 passes because it defines a product contract where a search failure can be
preserved as useful evidence **without asserting a linguistic cause that
SiraLex does not know**.

```text
CF2_SEARCH_FAILURE_FEEDBACK_PRODUCT_DEFINED
```

---

## 38. Preconditions before CF2I1

1. This CF2D0 definition remains accepted.
2. Implementation preserves non-missing-entry-truth authority language.
3. Dedicated store and separate export package are used.
4. Query-log and Learning isolation remain absolute.
5. CF1 Manage Corrections is not silently generalized.
6. No Branch C / phrase / morphology logic is introduced.
7. PV1A/PV1B remain active parallel tracks.
8. No cloud upload path is introduced.

---

## 39. Stop conditions

Block or halt CF2 implementation if:

1. drafts are treated as proven missing entries;
2. runtime invents lexicon entries or Maninka forms;
3. CF2 is merged into CF1 correction identity/export;
4. query logging is auto-enabled or silently reused as CF2;
5. Phase 1.5 patches are generated automatically from CF2;
6. Branch C / sentence analysis is smuggled into CF2;
7. cloud upload/accounts/moderation expand MVP without a separate decision;
8. PV1 is redefined as CF2 work or abandoned because CF2 started.

---

## 40. Roadmap / portfolio state after CF2D0

```text
Release-readiness:
PV1A — Production Identity and Desktop Smoke — ACTIVE
PV1B — Physical Device Validation — HARDWARE-GATED / NOT RUN

Product-build:
CF2 — Missing Entry and Search Failure Feedback — DEFINITION
Next slice:
CF2I1 — Search Feedback Model and Validation
```

Owner-override note remains:

```text
PD2_OWNER_OVERRIDE_CF2_SELECTED
```

Phase 7N1 / PV1 device evidence remains independent: candidate package identity
may be recorded while desktop/Android/iPhone scenario matrices remain `not_run`.

---

## 41. Repository hygiene

This slice stages:

```text
docs/reports/cf2d0_missing_entry_search_failure_feedback_product_definition.md
docs/ROADMAP.md
docs/reports/pd2_post_cf1_product_build_decision.md  (narrow governance addendum only)
```

No runtime implementation. No schema migration. No tests beyond documentation
validation.

---

## Documentation-only confirmation

This slice defines CF2 only. It does not implement capture/export UI, IndexedDB
v6, or any search-behavior change. CF1 remains closed and unchanged. PV1 remains
active in parallel.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `CF2_SEARCH_FAILURE_FEEDBACK_PRODUCT_DEFINED` |
| Governance | `PD2_OWNER_OVERRIDE_CF2_SELECTED` |
| Product | Local search-failure feedback capture/export |
| Identity | Search-event context, not lexicon `ir_id` |
| Kinds | `no_result`, `results_not_useful` |
| Store | dedicated `search_failure_feedback` (DB v6) |
| Export | `siralex_search_feedback_v1` |
| Manage | Manage Search Feedback (separate from CF1) |
| Import | None in MVP |
| Offline | Required |
| Next slice | `CF2I1 — Search Feedback Model and Validation` |
| Code changes | None |
