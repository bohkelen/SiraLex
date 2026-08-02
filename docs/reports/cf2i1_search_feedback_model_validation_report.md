# CF2I1 — Search Feedback Model and Validation Report

## 1. Decision

```text
CF2_SEARCH_FEEDBACK_MODEL_IMPLEMENTED
```

CF2I1 implements the pure CF2 draft model, strict validation, deterministic
export-package model, and fixtures. No IndexedDB, UI, search integration,
network, management surface, or query-log integration was added.

Authoritative inputs:

- `docs/reports/cf2d0_missing_entry_search_failure_feedback_product_definition.md`
- owner acceptance of CF2D0
- CF1 validation/package patterns for generic helpers only (local copies; no CF1
  type coupling)

---

## 2. CF2 evidence semantics

Locked implementation statement:

> A CF2 record is evidence that a user need was not satisfied by a specific
> search against a specific dictionary version. It is not evidence that the
> requested lexical object should exist.

Therefore:

- a valid draft proves deliberate unmet-need reporting against search context;
- it does **not** prove a dictionary entry is missing;
- it does **not** prove the query was correct;
- it does **not** claim SiraLex knows why the search failed.

No `missing_entry`, diagnosis, review, resolved, submitted, author, account,
device, query-log, or Learning fields exist on the schema.

---

## 3. Draft schema

```ts
schema_version: "search_failure_feedback_draft_v1"
feedback_id: string
bundle_id: string
content_sha256: string
storage_scope_id: string
query_raw: string
search_direction: "source_to_target" | "target_to_source"
result_state: "no_result" | "results_not_useful"
result_count: number
matched_ir_ids?: string[]
requested_meaning?: string
user_description?: string
created_at: string
updated_at: string
status: "draft"
```

Type name: `SearchFeedbackDraftV1`.

---

## 4. Record identity

Identity is **`feedback_id` only**.

Independent from `query_raw`, `bundle_id`, and `matched_ir_ids`.
No schema-layer deduplication. Same search may be reported independently.

---

## 5. Provenance

Required non-empty trimmed `bundle_id` and `storage_scope_id`.

Canonical hash only:

```text
sha256:<64 lowercase hex>
```

Rejects uppercase hex, bare digests, short hashes, and non-`sha256` prefixes.
No silent normalization.

---

## 6. Query preservation

`query_raw` is required.

- `.trim()` used only to detect emptiness;
- stored string preserved exactly (Unicode, accents, N’Ko, punctuation,
  multiword, internal/leading/trailing spaces when non-blank);
- no lowercase / NFC / whitespace collapse / transliteration / tokenize /
  punctuation strip.

Limit: **1000** Unicode code points (CF2D0).

---

## 7. Result-state invariants

```text
no_result:
  result_count === 0
  matched_ir_ids === undefined   // empty array rejected

results_not_useful:
  result_count >= 1
  matched_ir_ids optional
```

Excerpt (`search_feedback_validation.ts`):

```ts
} else if (resultState === "no_result") {
  if (value.result_count !== 0) {
    pushError(collector, {
      code: "invalid_result_count",
      path: "result_count",
    });
  }
} else if (resultState === "results_not_useful") {
  if (value.result_count < 1) {
    pushError(collector, {
      code: "invalid_result_count",
      path: "result_count",
    });
  }
}
```

No silent repair.

---

## 8. Matched-result semantics

`matched_ir_ids` are **evidence, not identity**.

- never required foreign keys;
- never CF1 correction targets;
- never mutable anchors;
- max **25**;
- non-empty bounded IDs;
- no duplicates;
- order preserved;
- length may be **less than** `result_count` (not required equal);
- forbidden on `no_result` (must be absent, not `[]`).

---

## 9. User-authored fields

Optional:

```text
requested_meaning?
user_description?
```

Limits: **2000** Unicode code points each (CF2D0).

Canonical optional form is **absence**, not `""`.
Present empty / whitespace-only values are rejected (no silent normalize-on-parse).
Exact text preserved; no normalize/translate/tokenize/infer-language/search-key use.

Query-only drafts (both optionals absent) are valid.

---

## 10. Validation limits

| Field | Max |
| --- | --- |
| `query_raw` | 1000 |
| `requested_meaning` | 2000 |
| `user_description` | 2000 |
| `feedback_id` | 200 |
| `bundle_id` | 500 |
| `storage_scope_id` | 1000 |
| `matched_ir_ids` | 25 entries |
| each matched ir_id | 500 |
| package bytes | 25 MiB (dedicated CF2 constant) |

Control policy: allow `\n` `\r` `\t`; reject other C0, DEL, isolated surrogates.

---

## 11. ID validation

CF2I1 validates bounded non-empty trimmed `feedback_id` strings (fixture IDs and
UUID-style IDs accepted).

Generation belongs to CF2I2:

```text
crypto.randomUUID()
→ crypto.getRandomValues() UUID fallback
→ fail closed
```

No `Math.random()`. No timestamp-only IDs.

---

## 12. Timestamp rules

Canonical UTC ISO-8601 ending in `Z`, round-trippable.

Require `updated_at >= created_at`.

No `submitted_at` / `resolved_at` / `exported_at` / `reviewed_at` on drafts.

---

## 13. Strict parsing

Rejects missing required properties, unknown top-level fields, wrong schema
version, wrong types, invalid enums, non-finite numbers, duplicate matched IDs,
and impossible result-state combinations.

No silent field dropping. No migrations. No permissive forward compatibility.

Result shape:

```ts
| { ok: true; value: SearchFeedbackDraftV1 }
| { ok: false; errors: SearchFeedbackValidationError[]; truncated: boolean }
```

---

## 14. Error-cap policy

Maximum **100** errors:

```text
99 structural errors + error_limit_reached
truncated: true
```

Never emits 101 errors. Same pattern for draft and package validators.

Excerpt:

```ts
if (collector.errors.length === SEARCH_FEEDBACK_MAX_VALIDATION_ERRORS - 1) {
  collector.errors.push({ code: "error_limit_reached" });
  collector.truncated = true;
  return false;
}
```

---

## 15. Package schema

```text
package_schema: siralex_search_feedback_v1
```

```ts
{
  package_schema,
  exported_at,
  app_version?,
  authority_label,
  feedback_count,
  feedbacks: SearchFeedbackDraftV1[]
}
```

Field name `feedbacks` is the CF2D0 lock (not CF1 `drafts`).

---

## 16. Authority label

Exact CF2D0 string:

```text
unreviewed_search_failure_feedback_must_not_be_treated_as_missing_entry_truth
```

Communicates: search failure evidence ≠ missing-entry truth.

---

## 17. Deterministic ordering

CF2D0 order:

```text
bundle_id → created_at → feedback_id
```

Code-point comparison only (`<` / `>`), never `localeCompare`.

Excerpt:

```ts
export function compareSearchFeedbackDraftsForExport(a, b): number {
  const byBundle = compareCodePoints(a.bundle_id, b.bundle_id);
  if (byBundle !== 0) return byBundle;
  const byCreated = compareCodePoints(a.created_at, b.created_at);
  if (byCreated !== 0) return byCreated;
  return compareCodePoints(a.feedback_id, b.feedback_id);
}
```

---

## 18. Serialization

- fixed property order;
- 2-space indentation;
- trailing EOF newline;
- same logical package → byte-identical JSON;
- no locale / environment data.

---

## 19. UTF-8 / package cap

```ts
SEARCH_FEEDBACK_MAX_BYTES = 25 * 1024 * 1024  // dedicated CF2 constant
getSearchFeedbackUtf8ByteLength(value) → TextEncoder byteLength
```

Empty packages rejected on parse and build (export-all empty disabled).

---

## 20. Filename

```text
siralex-search-feedback-YYYY-MM-DDTHH-mm-ssZ.json
```

Deterministic UTC formatting from `exported_at`.

---

## 21. Privacy boundary

Schema necessarily includes exact `query_raw`. No encryption in CF2I1.
No account/device identity fields. Warnings/UI belong to later slices.

---

## 22. Query-log isolation

No `query_log_id`, `consent_version`, `logging_enabled`, or diagnostic log
references on draft or package.

---

## 23. Learning isolation

No Learning status, Saved Vocabulary identity, review/progress, or LP1 fields.

---

## 24. CF1 isolation

Does not import CF1 record types (`issue_type`, `CorrectionTarget`,
`display_snapshot`, etc.).

Local copies of generic helpers only:
Unicode counting, control policy, SHA/timestamp shape checks.

Separate package schema and authority label from
`siralex_correction_feedback_v1`.

---

## 25. No-diagnosis boundary

Hard pass/fail: schema/package contain no automatic cause labels such as
`missing_entry`, `probable_typo`, morphology/ranking/normalization/phrase issue
flags.

---

## 26. Test results

Focused CF2I1:

```text
src/search_feedback/search_feedback_validation.test.ts  21 passed
src/search_feedback/search_feedback_package.test.ts     10 passed
```

Full suite + build:

```text
npm run test:run  →  69 files / 729 tests PASS
npm run build     →  PASS
```

CF1 model/package regressions included (`correction_draft_types` /
`correction_feedback_package` passed).

Fixtures covered in tests:

- no-result Maninka query
- no-result French query
- results-not-useful with result IDs
- N’Ko query
- multiword query
- multiline user_description

No production data. No personally identifying search text.

APIs exposed for CF2I4:

```text
validateSearchFeedbackDraft
validateSearchFeedbackDraftForWrite
buildSearchFeedbackPackage
serializeSearchFeedbackPackage
parseSearchFeedbackJson
getSearchFeedbackUtf8ByteLength
buildSearchFeedbackFilename
compareSearchFeedbackDraftsForExport
```

---

## 27. Deviations from D0

| Item | Classification | Note |
| --- | --- | --- |
| `no_result` + `matched_ir_ids: []` rejected | contract-tightening | D0 allowed “omit or empty”; CF2I1 locks absence as canonical |
| optional `""` rejected | contract-tightening | D0 preferred absence; parse rejects non-canonical empties |
| filename clock form `YYYY-MM-DDTHH-mm-ssZ` | compatible refinement | D0 allowed implementation to refine UTC timestamp formatting |
| type name `SearchFeedbackDraftV1` | compatible | schema_version remains `search_failure_feedback_draft_v1` |

No unexplained scope expansion. No IndexedDB / UI / search changes.

---

## 28. Repository hygiene

Touched:

```text
web/src/search_feedback/search_feedback_types.ts
web/src/search_feedback/search_feedback_validation.ts
web/src/search_feedback/search_feedback_package.ts
web/src/search_feedback/search_feedback_validation.test.ts
web/src/search_feedback/search_feedback_package.test.ts
docs/reports/cf2i1_search_feedback_model_validation_report.md
docs/ROADMAP.md
```

Unchanged: IndexedDB version/stores, search behavior/renderer, query logs,
Learning, CF1 schemas/packages, Phase 1.5, PV1.

---

## 29. Next slice

```text
CF2I2 — Local Search Feedback Store
```

CF2I1 leaves unambiguous:

> A valid CF2 record proves that a user deliberately reported an unmet search
> need against a specific dictionary/search context. It does not prove that a
> dictionary entry is missing, that the query was correct, or that SiraLex knows
> why the search failed.
