# CF1I1 — Correction Draft Model and Validation Report

## 1. Decision

```text
CF1_CORRECTION_DRAFT_MODEL_IMPLEMENTED
```

Pure correction-draft and correction-feedback package model, strict validation,
deterministic serialization helpers, and focused unit tests are implemented.
No IndexedDB, database-version change, draft persistence, entry UI, Manage
Corrections, browser download, import, Phase 1.5 patch conversion, corpus
mutation, i18n, CSS, `main.ts`, or Playwright was added.

---

## 2. Draft schema

Implemented in `web/src/corrections/correction_draft_types.ts`:

```text
correction_draft_v1
```

Exact fields:

`schema_version`, `draft_id`, `bundle_id`, `ir_id`, `ir_kind`,
`content_sha256`, `storage_scope_id`, `issue_type`, `mode`, `target`,
`display_snapshot`, `problem_description`, optional `proposed_value`,
`created_at`, `updated_at`, `status: "draft"`.

No export/reviewer/device/locale/query/Learning/approval/Phase 1.5 patch fields.

---

## 3. Issue taxonomy

Exact enum:

```text
spelling
translation_or_gloss
part_of_speech
nko
example
usage_or_context
missing_information
duplicate_or_wrong_sense
other
```

`isCorrectionIssueType` and readonly `CORRECTION_ISSUE_TYPES` exposed.
Localized labels are not stored in drafts.

---

## 4. Mode rules

```text
problem_report
proposed_correction
```

| Mode | Rules |
| --- | --- |
| `problem_report` | `problem_description` required; `proposed_value` may be absent; if present must be non-empty after trim |
| `proposed_correction` | both `problem_description` and `proposed_value` required non-empty after trim |

No automatic mode inference from field presence.

---

## 5. Target model

Discriminated `CorrectionTarget` with exact-key validation per variant:

`entry`, `headword`, `part_of_speech`, `nko`, `sense`, `translation`,
`example`, `usage_note`, `other_field`.

Indices are zero-based safe non-negative integers. Extra keys, numeric strings,
fractional/negative/unsafe indices, and unsupported gloss languages are
rejected. `sense_num` is not identity.

---

## 6. Russian preservation boundary

`"ru"` is accepted only as `gloss_lang` on `translation` targets so existing
record material can be identified for review. CF1 does not add Russian product
labels, workflows, or source-language selection. Documented in module comments.

---

## 7. Snapshot model

`CorrectionDisplaySnapshot` with required `headword_latin` and optional bounded
fields. Optional present strings must be non-empty after trim. Snapshot is
bounded evidence only — not dictionary authority. Exact Unicode preserved; no
transliteration; no NFC normalization.

Limits: 500 Unicode code points per snapshot field.

---

## 8. Identity and provenance

| Field | Rule |
| --- | --- |
| `draft_id` | 1–200 chars, non-empty trimmed |
| `bundle_id` | 1–500 chars |
| `ir_id` | 1–500 chars |
| `ir_kind` | exactly `lexicon_entry` |
| `status` | exactly `draft` |
| `content_sha256` | canonical `/^sha256:[0-9a-f]{64}$/` (exactly 64 lowercase hex); uppercase rejected without normalization |
| `storage_scope_id` | 1–1000 chars |

Installation and IR resolution are not performed. `bundle_id` is never parsed
from `storage_scope_id`.

---

## 9. Timestamp rules

`created_at` / `updated_at` must be canonical UTC ISO-8601 ending in `Z`,
parseable and round-trippable by instant. Require `updated_at >= created_at`.
No repair, no locale timestamps, no clock access inside validators.

---

## 10. Unicode character counting

```ts
countUnicodeCharacters(value) // Array.from(value).length
```

Counts Unicode code points, not UTF-16 units, not grapheme clusters. Used for
all locked character limits.

---

## 11. Control-character policy

Allow: ordinary Unicode, N’Ko, combining marks, bidirectional text, `\n`,
`\r`, `\t`.

Reject: other C0 controls `U+0000–U+001F`, `U+007F`, isolated surrogates
`U+D800–U+DFFF`.

---

## 12. Exact-key validation

Unknown keys rejected at:

- draft top level;
- target object (per-variant allowlist);
- display snapshot;
- package top level.

No silent future-field preservation.

---

## 13. Validation API

```ts
parseCorrectionDraft(value)
validateCorrectionDraftForWrite(value, label?)
```

Error codes are structural only. Draft accumulation is bounded at
`CORRECTION_MAX_VALIDATION_ERRORS = 100` structural errors with
`truncated: true` and no sentinel code (draft taxonomy has no
`error_limit_reached`). Errors never include user text, headwords, or
proposed corrections.

---

## 14. Cloning and equality

```ts
cloneCorrectionTarget
cloneCorrectionDisplaySnapshot
cloneCorrectionDraft
areCorrectionDraftsEqual
```

No shared nested references. Optional-field presence preserved. No text
normalization or timestamp rewriting. Equality compares every supported field.

---

## 15. Deterministic ordering

```ts
compareCorrectionDraftsForExport
```

Order: `bundle_id` → `ir_id` → `created_at` → `draft_id` via code-point
comparison. Never `localeCompare`. Inputs not mutated.

---

## 16. Package model

Implemented in `web/src/corrections/correction_feedback_package.ts`:

```text
siralex_correction_feedback_v1
```

Fields: `package_schema`, `exported_at`, optional `app_version`,
`authority_label`, `draft_count`, `drafts`.

Dedicated byte limit:

```text
CORRECTION_FEEDBACK_MAX_BYTES = 25 * 1024 * 1024
```

Same numeric ceiling as LP1, not a shared product-domain constant.

---

## 17. Package parser

```ts
parseCorrectionFeedbackJson(text, options?: { byteLength? })
```

- size check before JSON parse when oversized;
- exact top-level keys;
- current schema only;
- exact authority label;
- non-empty package;
- all drafts valid;
- `draft_count === drafts.length`;
- duplicate `draft_id` rejected;
- no partial success;
- no dictionary resolution;
- no Phase 1.5 conversion;
- preserves validated input draft order;
- error accumulation capped at exactly 100:
  99 structural errors + final `error_limit_reached`, with `truncated: true`.

---

## 18. Duplicate semantics

Package uniqueness is `draft_id`. Duplicate IDs rejected even if drafts are
identical. Multiple drafts may target the same `(bundle_id, ir_id)`.

---

## 19. Builder

```ts
buildCorrectionFeedbackPackage(drafts, { exportedAt, appVersion? })
```

Rejects empty input, invalid drafts, duplicate IDs, invalid timestamps /
app versions. Clones, sorts canonically, preserves fields exactly. Caller
supplies timestamp. Typed `CorrectionFeedbackBuildError` without vocabulary
leakage.

---

## 20. Deterministic serialization

```ts
serializeCorrectionFeedbackPackage
```

Stable package / draft / target / snapshot field order, two-space indentation,
EOF newline, exact Unicode, omit absent optionals. Identical semantic input +
timestamp ⇒ identical bytes.

---

## 21. Filename and UTF-8 sizing

```ts
buildCorrectionFeedbackFilename(exportedAt)
→ siralex-correction-feedback-YYYY-MM-DDTHH-mm-ssZ.json

getCorrectionFeedbackUtf8ByteLength(value) // TextEncoder
```

UTC only; no vocabulary / bundle / user / device metadata.

---

## 22. Phase 1.5 boundary

Module documentation locks:

```text
CorrectionFeedbackPackageV1 is not:
- correction_record_v1
- correctionset_v1
- RFC 6902 patch input
- approved correction data
```

No Phase 1.5 application types imported. No automatic converter.

---

## 23. Purity

Modules perform no IndexedDB, clock, DOM, download, dictionary resolution,
query logging, Learning access, network, localization, Phase 1.5 mutation,
transliteration, or input mutation.

---

## 24. Tests

Focused:

```text
npx vitest run \
  src/corrections/correction_draft_types.test.ts \
  src/corrections/correction_feedback_package.test.ts
→ Test Files  2 passed (2)
→ Tests  40 passed (40)
```

Coverage includes valid drafts, invalid shapes, mode rules, target strictness,
text limits with astral characters, control characters, exact SHA-256
provenance, package validation including the 100-error cap, deterministic
serialization, filename/UTF-8 sizing, and Phase 1.5 boundary.

Shared regressions and full-suite/build results for CF1I1A are recorded at
commit time in the amendment execution notes below.

### CF1I1A validation rerun

```text
npx vitest run \
  src/corrections/correction_draft_types.test.ts \
  src/corrections/correction_feedback_package.test.ts
→ Test Files  2 passed (2)
→ Tests  40 passed (40)

npx vitest run \
  src/learning/learning_backup_package.test.ts \
  src/learning/learning_record_persistence.test.ts
→ Test Files  2 passed (2)
→ Tests  49 passed (49)

npm run test:run
→ Test Files  56 passed (56)
→ Tests  614 passed (614)

npm run build
→ pass (tsc + vite + PWA generateSW)
```

---

## 25. Deviations

- Timestamp validation is implemented inside the corrections module (UTC `Z`
  required) rather than extracting Learning’s looser helper, to avoid Learning
  coupling and to match CF1D0’s stricter UTC-Z rule.
- Content-hash validation requires `sha256:` + exactly 64 lowercase hex digits
  (`/^sha256:[0-9a-f]{64}$/`). Uppercase is rejected without normalization.
  An earlier permissive `/^sha256:[0-9a-fA-F]+$/` acceptance (including
  `sha256:abc`) was corrected in CF1I1A.
- Package error accumulation previously could reach 101 by appending
  `error_limit_reached` after 100 structural errors; CF1I1A enforces
  99 structural + `error_limit_reached` = 100 total.
- No deviations from CF1D0 schema, taxonomy, export package identity, or
  authority label.

### CF1I1A amendment

```text
CF1I1A — Correction Validator Boundary Fixes
```

Decision remains:

```text
CF1_CORRECTION_DRAFT_MODEL_IMPLEMENTED
```

---

## 26. Repository hygiene

Staged only:

- `web/src/corrections/correction_draft_types.ts`
- `web/src/corrections/correction_draft_types.test.ts`
- `web/src/corrections/correction_feedback_package.ts`
- `web/src/corrections/correction_feedback_package.test.ts`
- `docs/reports/cf1i1_correction_draft_model_validation_report.md`
- narrow `docs/ROADMAP.md` status update

No IndexedDB/schema/UI/i18n/Playwright/corpus/Learning/query-log/PV1/LS4
changes.

Roadmap status:

```text
CF1D0 — Defined
CF1I1 — Correction Draft Model and Validation — Implemented
CF1I2 — Local Correction Draft Store — Next
PV1A — Parallel active
PV1B — Hardware-gated
```
