# CF2I3 — Search Failure Capture Surface Report

## 1. Decision

```text
CF2_SEARCH_FAILURE_CAPTURE_SURFACE_IMPLEMENTED
```

CF2I3 lets a user deliberately convert one unsatisfied executed search into one
local CF2 draft. Capture stops at creation. Manage Search Feedback and export
remain CF2I4.

User-facing meaning:

> This search did not give me what I needed, and I want to preserve that fact
> for later review.

Not:

> SiraLex is missing this word.

Authoritative inputs:

- `docs/reports/cf2d0_missing_entry_search_failure_feedback_product_definition.md`
- `docs/reports/cf2i1_search_feedback_model_validation_report.md`
- `docs/reports/cf2i2_local_search_feedback_store_report.md`
- CF1I3A lifecycle patterns (DB ownership, post-commit invalidation) without CF1 type coupling

---

## 2. User loop

```text
Search
→ observe no result OR unsatisfactory results
→ Report this search
→ optional explanation
→ Save local feedback
→ return to the same search
```

---

## 3. No-result entry point

When a settled search has zero logical results and capture is offerable:

```text
No results for “<query>”
[Report this search]
```

French:

```text
Aucun résultat pour « <query> »
[Signaler cette recherche]
```

Rendered in `#searchResults` via `renderNoResultSearchFeedbackEntry`.
Binds `result_state = "no_result"`, `result_count = 0`, `matched_ir_ids` absent.

Gates: genuine executed search; non-empty `query_raw.trim()`; usable active
dictionary provenance; count exactly 0; current generation snapshot present.

---

## 4. Results-not-useful entry point

When one or more current results exist, a secondary surface is appended **after**
the results list (never per-row):

```text
Didn't find what you needed?
[Report this search]
```

French:

```text
Vous n’avez pas trouvé ce que vous cherchiez ?
[Signaler cette recherche]
```

Binds `result_state = "results_not_useful"` and the exact logical result count.
CF1 remains the path for a specific entry problem.

---

## 5. Executed-search snapshot source

Main settles one in-memory `ExecutedSearchSnapshot` (`lastExecutedSearch`) when a
search generation completes successfully with usable provenance.

Cleared immediately when a new search starts, the query is blanked, or direction
changes — so capture cannot bind a later input to an old CTA.

Does **not** reconstruct from query logs, DOM text, or normalized keys.

---

## 6. Exact query/direction provenance

`query_raw` is the exact string passed into `runSearch` / `searchInput` at
execution time (untrimmed). Direction is the direction frozen at execution start
(`executedDirection`), not the live toggle after the fact.

---

## 7. Result count semantics

`result_count` is the logical resolved-record count for that executed search
(`records.length` after `resolveRecords`, or `0` on miss). It is not a DOM node
count and does not include headers, skeletons, or feedback UI.

---

## 8. `matched_ir_ids` derivation

### What is one logical displayed result?

`resolveRecords` returns the ordered `EnrichedRecord[]` that
`renderResultsList` displays. Each record may be:

- `lexicon_entry`, or
- `index_mapping`

Both are real displayed results when present in that list.

### Do result objects expose genuine `ir_id`?

Yes. `EnrichedRecord.ir_id` is the stable identity used throughout search and
entry navigation.

### Can `index_mapping` objects appear?

Yes. They are included when present in the resolved display list. Their `ir_id`
is captured the same way as lexicon entries — as display-result evidence only,
never as a CF1 correction target.

### Capture policy (CF2I3)

```text
take first up to 25 unique genuine ir_ids
in deterministic resolved-result order
```

Implemented by `deriveMatchedIrIdsFromRecords`:

- skips empty/whitespace-padded IDs
- deduplicates while preserving first-seen order
- caps at 25
- returns `undefined` when none (and for `no_result`, IDs remain absent)

Deduplication is **capture derivation**: the search model may surface the same
entry through multiple match paths before resolution. This is not persisted-data
repair. CF2I1 still rejects duplicate IDs on write.

`result_count` may exceed captured-ID count.

---

## 9. Capture context

Preferred type:

```ts
type SearchFeedbackCaptureContext = {
  bundle_id: string;
  content_sha256: string;
  storage_scope_id: string;
  query_raw: string;
  search_direction: SearchFeedbackDirection;
  result_state: SearchFeedbackResultState;
  result_count: number;
  matched_ir_ids?: string[];
  search_generation: number; // runtime only — not persisted
};
```

Built by `buildSearchFeedbackCaptureContext` from `ExecutedSearchSnapshot`.

---

## 10. Form fields

- Read-only search (exact query + direction/result-state description)
- Optional requested meaning (≤ 2000 Unicode code points)
- Optional additional details (≤ 2000 Unicode code points)
- Save / Cancel

Neither optional field is required. Query-only reports are valid.

---

## 11. Optional-field canonicalization

UI blank / whitespace-only optional fields are converted to absence **before**
building create input. Non-blank text is preserved exactly, including leading
and trailing spaces. This is controller/model UI policy, not a schema relaxation.

---

## 12. Stale-search protection

A form bound to generation G becomes stale (neutral message, Save disabled,
Cancel available, no retarget) when search generation, query event, direction,
bundle identity/hash/scope, or host generation drifts before Save.

English:

```text
This search has changed. Return to the current results and report it again.
```

French equivalent is localized under `searchFeedback.capture.error.staleContext`.

---

## 13. Pre-save context verification

Before persistence the controller verifies:

1. host still current
2. bound search generation still current
3. active bundle exists (memory + DB)
4. bundle ID / content SHA / storage scope match
5. bound query event still equals current executed snapshot
6. direction / result-state / count / matched IDs remain compatible

It does **not** rerun search to re-diagnose usefulness.

---

## 14. Duplicate Save suppression

Concurrent Save calls coalesce on one in-flight promise. After success, the same
mounted controller cannot save again. Retry remains allowed after store failure.

---

## 15. DB ownership

```ts
dbOwnership?: "controller_owned" | "caller_owned";
```

Default / production: `controller_owned` — every `openDb()` connection closes in
`finally` for verify, save success, save failure, stale, and thrown paths.

Tests injecting one shared DB use `caller_owned`.

---

## 16. Post-commit invalidation

```ts
onFeedbackSaved?: () => void;
```

Runs exactly once after a successful create commit, even if the host became
stale or the controller was disposed before success UI can render. Main bumps
`searchFeedbackManagementGeneration` for CF2I4.

No CF2 deletion reminder is built in I3.

---

## 17. Error mapping

| Store / controller code | User-safe copy |
| --- | --- |
| `invalid_input` / `invalid_fields` | Review the feedback fields. |
| `invalid_timestamp` | The report could not be saved because the local device time is invalid. |
| `id_generation_failed` | A secure local report ID could not be created. |
| `feedback_id_conflict` | The report could not be saved because of a local ID conflict. Try again. |
| `database_write_failed` | The report could not be saved on this device. |
| `search_context_changed` | This search has changed… |

No raw enum names, no server/network language.

---

## 18. Navigation/return behavior

No router refactor. Cancel and successful Back return to the same in-memory
search surface (zero-result CTA or results list + secondary CTA) without
rerunning the original query.

---

## 19. Privacy/authority copy

EN:

```text
This saves a local report about this search. It does not add a word to the
dictionary or determine why the search did not meet your need.

Your exact search text will be stored on this device as part of the report.
Nothing is sent online.
```

French equivalents are under `searchFeedback.capture.privacy.*`.
No Submit / Send / community-sent / missing-word language.

---

## 20. Query-log isolation

CF2 capture does not call `appendQueryLog` / `appendSearchQueryLogIfEnabled`.
Context is built from the executed-search snapshot only.

Integration evidence: post-search/pre-save query-log counts stay unchanged across
CF2 Save (logging-enabled seed row preserved; CF2 adds no extra log row).

---

## 21. CF1 isolation

Saving CF2 does not create correction drafts or expose Suggest-a-correction
semantics. CF1 remains entry-scoped; CF2 remains search-event-scoped.

---

## 22. Learning isolation

Saving CF2 does not create Learning Records or change Saved Vocabulary /
Review / Progress stores.

---

## 23. Community/server non-goal

```text
CF2I3 Save
≠ send to community
≠ submit to server
≠ moderator visibility
```

All CF2I3 data remains private in the local database until a future deliberate
export or separately governed remote-submission capability.

---

## 24. EN/FR

Namespace: `searchFeedback.capture.*` (EN + FR only). No Russian locale.
Focused French renderer assertions do not fall back to English copy.

---

## 25. Accessibility

Implemented for the capture surface:

- form heading focused on open
- read-only query labeled
- optional fields marked optional with help text
- Unicode counters
- validation error summary focused after invalid Save
- success heading focused
- stale message via `role="alert"`
- Save busy/disabled during persistence
- Cancel usable when stale
- keyboard-operable Report/Save buttons
- N’Ko query display uses `lang="nqo"` / `dir="rtl"` when N’Ko code points are present

No full WCAG claim.

---

## 26. Integration evidence

Focused integration (`search_feedback_capture_integration.test.ts`):

- genuine `searchQuery` miss → no_result save → feedback +1; IDs absent; other stores unchanged
- genuine hit → results_not_useful save → exact count + derived matched IDs; query logs / CF1 / Learning unchanged
- stale generation/query and bundle lifecycle → Save blocked; 0 feedback
- seeded query log unchanged across CF2 Save

Main wiring:

- `runSearch` builds/clears `lastExecutedSearch`
- zero-result and results-list CTAs
- capture host with `controller_owned` + `onFeedbackSaved`

---

## 27. Tests

| Suite | Coverage |
| --- | --- |
| `search_feedback_capture_model.test.ts` | context build, exact provenance, ID derivation/cap/dedupe, optional canonicalization, Unicode counters, no diagnosis fields |
| `search_feedback_capture_controller.test.ts` | ready/save/optional/exact input, double-save, no resave, retry, error map, stale generation/query/direction/bundle/hash/scope, dispose/stale post-commit notify, DB ownership closes, no query-log/CF1/Learning calls |
| `render_search_feedback_capture.test.ts` | EN/FR entry copy, form fields/privacy, no Submit/Send/missing-word/internal IDs, invalid/busy/stale/success focus, Cancel when stale, keyboard |
| `search_feedback_capture_integration.test.ts` | real search miss/hit paths, isolation, stale/bundle, query-log independence |

---

## 28. Deviations

None material.

Implementation note carried from CF2I2 (not a blocker): store test-only
transaction hooks must remain immediate; CF2I3 production path does not use them.

CF2 deletion reminder deferred to CF2I4 by design.

---

## 29. Repository hygiene

Modules added/updated within allowed CF2I3 scope:

- `web/src/search_feedback/search_feedback_capture_model.ts` (+ test)
- `web/src/search_feedback/search_feedback_capture_controller.ts` (+ test)
- `web/src/search_feedback/search_feedback_capture_integration.test.ts`
- `web/src/render/render_search_feedback_capture.ts` (+ test)
- narrow `web/src/main.ts` search-host seam
- `web/src/i18n.ts`, minimal `web/src/style.css`
- this report + `docs/ROADMAP.md`

Unchanged by design: DB version/schema, CF2 draft/package/store semantics, CF1,
Learning, query-log consent/behavior, ranking/normalization/morphology, Phase 1.5,
PV1, Playwright.

---

## 30. Next slice

```text
CF2I4 — Manage Search Feedback and Export
```

---

## High-risk excerpts

### Executed-search snapshot construction (`main.ts`)

```ts
const seq = ++searchSeq;
clearExecutedSearchSnapshot();
activeSearchFeedbackForm?.notifySearchChanged();
const executedDirection = searchDirection;
// ...
lastExecutedSearch = {
  generation: seq,
  query_raw: query,
  search_direction: executedDirection,
  result_state: "no_result", // or results_not_useful
  result_count: /* 0 or records.length */,
  content_sha256: contentSha,
  storage_scope_id: activeStorageScopeId,
  // matched_ir_ids only for results_not_useful via deriveMatchedIrIdsFromRecords
};
```

### `matched_ir_ids` derivation

```ts
export function deriveMatchedIrIdsFromRecords(
  records: ReadonlyArray<{ ir_id: string }>,
): string[] | undefined {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const id = record.ir_id;
    if (typeof id !== "string" || id.trim() === "" || id !== id.trim()) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= SEARCH_FEEDBACK_MATCHED_IR_IDS_MAX) break;
  }
  return out.length > 0 ? out : undefined;
}
```

### Stale-generation verification

```ts
function searchEventMatchesBound(
  bound: SearchFeedbackCaptureContext,
  current: ExecutedSearchSnapshot,
): boolean {
  if (current.generation !== bound.search_generation) return false;
  if (current.query_raw !== bound.query_raw) return false;
  if (current.search_direction !== bound.search_direction) return false;
  // result_state/count/ids + provenance also compared
  return true;
}
```

### Post-commit `onFeedbackSaved` ordering

```ts
completedSuccessfully = true;
feedbackId = result.draft.feedback_id;
notifyFeedbackSavedOnce();
if (disposed || !deps.isCurrent()) {
  return; // success UI suppressed; invalidation already ran
}
state = "saved";
emit();
```

### DB connection closure

```ts
} finally {
  closeIfControllerOwned(db, dbOwnership);
}
```

Used on both verify and save paths under `controller_owned`.
