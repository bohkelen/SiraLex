# CF1D0 — Community Correction and Feedback Product Definition

## 1. Decision

```text
CF1_CORRECTION_FEEDBACK_PRODUCT_DEFINED
```

CF1 is defined as a complete, bounded, offline-first correction-capture and
handoff product. This slice is documentation-only. No runtime code, tests,
IndexedDB schema, UI, CSS, i18n, Playwright, bundles, corpus data, correction
artifacts, catalog files, or deployment configuration were modified. LS4I1 was
not started. PV1A/PV1B remain parallel and were not redefined as CF1 work.

Authoritative inputs:

- `docs/reports/pd1_next_product_build_decision.md`
- `shared/specs/correction-record-schema-v1.md`
- `shared/specs/correction-application-dry-run.md`
- `web/src/types/records.ts`
- `web/src/render/render_entry.ts`
- Learning backup export conventions (`siralex_learning_backup_v1`)
- query-log export and privacy boundary
- current EN/FR interface conventions (`web/src/i18n.ts`)
- current offline-first and source-governance rules

Why not blocked:

- installed dictionary authority is preserved;
- suggestions are non-authoritative local drafts;
- targets bind to stable `(bundle_id, ir_id)` lexicon entries;
- query logs, Learning, and corrections remain separate;
- full offline operation is defined;
- export produces a reviewable handoff package without claiming Phase 1.5
  direct apply compatibility;
- human review remains mandatory before any corpus change.

---

## 2. Product outcome

> A local, user-initiated correction and feedback system that lets users
> identify problems in dictionary content, capture structured evidence against
> stable entry identity, review their pending submissions, and export a
> deterministic correction packet for external human review.

CF1 is **not**:

- live dictionary editing;
- corpus moderation;
- automatic correction application;
- cloud submission;
- community voting;
- comments;
- issue tracking;
- query logging;
- AI-assisted translation;
- a replacement for Phase 1.5 review governance.

---

## 3. User problem

Users may encounter incorrect spelling, incorrect or incomplete translation,
unclear gloss, wrong part of speech, missing or incorrect N’Ko, weak or missing
example, duplicate or misleading sense, missing usage context, missing
pronunciation information, or another entry-quality problem.

Today there is no structured way to preserve that observation with enough
identity and context for later review. The result is lost evidence.

CF1 converts an ephemeral complaint into a reviewable local artifact.

---

## 4. Authority boundary

```text
Installed dictionary content remains authoritative.
User correction drafts are non-authoritative claims.
Only a separate reviewed correction process may produce corpus changes.
```

| Stage | Meaning |
| --- | --- |
| Dictionary record | Current installed lexical content |
| Correction draft | User-authored local proposal or issue report |
| Reviewed correction artifact | Externally reviewed/approved Phase 1.5 correction input |
| Applied correction | Future corpus/bundle change through approved pipeline |

Do not collapse these stages.

---

## 5. User loop

```text
Open dictionary entry
  → Suggest a correction
  → choose issue type
  → identify affected field or sense
  → describe the problem
  → enter proposed correction or explanation
  → save locally
  → review pending suggestions
  → edit or delete
  → export correction packet
  → external human review
  → approved correction pipeline
```

---

## 6. Canonical entry point

Primary:

```text
Entry detail
→ Suggest a correction
```

Requirements:

- only available for genuine `lexicon_entry`;
- not available for `index_mapping`;
- not available for source query objects;
- not available for result relationship objects;
- not available for display-cache-only / unresolved Learning rows that lack a
  resolvable live lexicon entry.

Secondary:

```text
Manage Corrections
```

for reviewing pending local drafts and exporting feedback.

Do **not** place the primary correction action:

- in every search-result row;
- inside Review;
- inside Progress;
- inside query-log Diagnostics;
- inside Learning backup;
- inside dictionary installation controls.

---

## 7. Correction identity

```ts
type CorrectionDraftId = string;
```

Generated locally as a unique draft identity (implementation may use a UUID or
equally collision-resistant local ID). Dictionary target identity remains:

```text
(bundle_id, ir_id)
```

Correction identity must not be:

- the dictionary identity itself;
- content hash alone;
- storage scope alone;
- timestamp alone;
- query text;
- display cache / snapshot text.

Each draft targets one dictionary entry and may identify a narrower field or
sense via `target`.

---

## 8. Target context

Each correction draft must capture at creation time:

```text
bundle_id
ir_id
ir_kind            // always "lexicon_entry"
content_sha256
storage_scope_id
```

Purpose:

- stable logical target;
- installed-content provenance;
- later detection that dictionary content changed;
- external reviewer context.

These fields are immutable after creation. Later edits may update user-authored
content, not target provenance.

Logical `bundle_id` follows Learning’s rule: use registry/active-bundle logical
identity, not a parsed storage-scope string.

---

## 9. Issue taxonomy

Exact MVP enum (language-neutral stored values):

```ts
type CorrectionIssueType =
  | "spelling"
  | "translation_or_gloss"
  | "part_of_speech"
  | "nko"
  | "example"
  | "usage_or_context"
  | "missing_information"
  | "duplicate_or_wrong_sense"
  | "other";
```

| Stored value | EN label | FR label |
| --- | --- | --- |
| `spelling` | Spelling | Orthographe |
| `translation_or_gloss` | Translation or gloss | Traduction ou glose |
| `part_of_speech` | Part of speech | Catégorie grammaticale |
| `nko` | N’Ko | N’Ko |
| `example` | Example | Exemple |
| `usage_or_context` | Usage or context | Emploi ou contexte |
| `missing_information` | Missing information | Information manquante |
| `duplicate_or_wrong_sense` | Duplicate or wrong sense | Sens en double ou incorrect |
| `other` | Other | Autre |

Rules:

- categories remain ordinary-user broad;
- labels are localized;
- stored enum values are language-neutral;
- no automatic classification;
- no linguistic judgment by the application.

---

## 10. Correction mode

```ts
type CorrectionMode = "problem_report" | "proposed_correction";
```

| Mode | Meaning |
| --- | --- |
| `problem_report` | User explains what seems wrong without supplying a replacement |
| `proposed_correction` | User supplies a replacement or additional content |

Both are valid. Proposed value is **not** required for every issue. A user may
recognize a problem without knowing the authoritative correction.

Mode selection rules for validation:

- `problem_report`: `proposed_value` may be absent or empty;
- `proposed_correction`: `proposed_value` required non-empty after trim.

---

## 11. Affected target

Inspected current entry schema (`web/src/types/records.ts`):

- `SenseRaw`, `ExampleRaw`, and `SubEntry` have **no stable IDs**;
- optional `sense_num` is display data, not identity;
- renderer falls back to positional numbering.

Locked target model:

```ts
type CorrectionTarget =
  | { type: "entry" }
  | { type: "headword" }
  | { type: "part_of_speech" }
  | { type: "nko" }
  | { type: "sense"; sense_index: number }
  | {
      type: "translation";
      sense_index: number;
      gloss_lang: "fr" | "en" | "ru";
    }
  | { type: "example"; sense_index: number; example_index: number }
  | { type: "usage_note"; sense_index: number }
  | { type: "other_field"; field_label: string };
```

Rules:

- use array indices only because the current corpus has no durable sub-identity;
- indices are zero-based and must be non-negative integers;
- always capture a display snapshot for reviewer context because indices can
  drift after corpus changes;
- do not invent stable sense IDs;
- do not treat `sense_num` as identity;
- `other_field.field_label` is a short user-visible label, not an IR path.

---

## 12. Display snapshot

```ts
type CorrectionDisplaySnapshot = {
  headword_latin: string;
  headword_nko?: string;
  part_of_speech?: string;
  selected_text?: string;
  selected_gloss?: string;
  selected_example?: string;
  target_language_form?: string;
  source_language_text?: string;
};
```

Capture rules:

- always capture `headword_latin` from the live entry at draft creation;
- capture N’Ko when present on the entry or selected example;
- capture POS when present;
- capture selected sense/gloss/example text according to `target`;
- keep snapshot bounded; do not copy the entire dictionary record;
- do not copy unnecessary provenance blobs (`source_id` trees, full
  `search_keys`, etc.).

Rules:

- snapshot is evidence, not dictionary authority;
- do not use snapshot to resolve or update the live entry;
- live entry remains authoritative for current display.

---

## 13. User-authored fields

Required / optional:

```text
issue_type              required
mode                    required
problem_description     required
proposed_value?         required only when mode = proposed_correction
```

MVP does **not** include a user-facing “reviewer note.” Do not call user text
“reviewer note.” Avoid structured fields that imply linguistic authority the
user may not possess.

---

## 14. Draft schema

```ts
type CorrectionDraftV1 = {
  schema_version: "correction_draft_v1";
  draft_id: string;
  bundle_id: string;
  ir_id: string;
  ir_kind: "lexicon_entry";
  content_sha256: string;
  storage_scope_id: string;
  issue_type: CorrectionIssueType;
  mode: CorrectionMode;
  target: CorrectionTarget;
  display_snapshot: CorrectionDisplaySnapshot;
  problem_description: string;
  proposed_value?: string;
  created_at: string; // ISO-8601 UTC
  updated_at: string; // ISO-8601 UTC
  status: "draft";
};
```

`status` is included and fixed to `"draft"` to keep a stable boundary against
future exported/submitted local states. MVP does **not** persist moderation
workflow states.

Do **not** include:

- user ID;
- device ID;
- email;
- account;
- approval status;
- reviewer identity;
- applied status;
- moderation result;
- public visibility;
- vote counts.

Exact top-level keys only; unknown fields rejected by validation.

---

## 15. Draft lifecycle

```text
create
edit
delete
export
```

Post-export behavior:

> Export does not delete, lock, or mark drafts as submitted.

Reason:

- browser download does not prove receipt;
- no server acknowledgment exists;
- user may need to export again.

Do not add local MVP workflow states:

```text
submitted
approved
rejected
applied
```

A transient UI result (`exported` / `export created`) is sufficient.

---

## 16. Local persistence

Dedicated store:

```text
correction_drafts
```

Requirements:

- separate from dictionary records;
- separate from Learning Records;
- separate from query logs;
- separate from Phase 1.5 correction corpus artifacts;
- local-only;
- offline;
- no automatic deletion on bundle removal;
- full database deletion may remove it;
- deterministic key by `draft_id`.

IndexedDB impact (implementation note only; not implemented here):

- current `SIRALEX_DB_VERSION = 4`;
- CF1I2 must bump DB version and create `correction_drafts` in an upgrade
  path without mutating dictionary or Learning stores.

---

## 17. Bundle removal / update

| Event | Behavior |
| --- | --- |
| Bundle removed | Draft remains. Unresolved against live dictionary; retains target identity and snapshot. |
| Same bundle updated | Draft remains with original `content_sha256` and `storage_scope_id`. Management may warn that dictionary content changed. |
| Entry removed | Draft remains. |
| Compatible entry remains | Draft can reopen current entry; reviewer context preserves original snapshot. |

Do not rewrite provenance on bundle update. Do not delete drafts automatically.

Warning copy (neutral):

```text
Dictionary content has changed since this correction was created.
```

French:

```text
Le contenu du dictionnaire a changé depuis la création de cette correction.
```

---

## 18. Editing

Allow editing:

- issue type;
- mode;
- target selection where coherent with current snapshot/live entry;
- problem description;
- proposed value.

Do not allow editing:

- draft ID;
- original target bundle;
- original `ir_id`;
- original content hash;
- original storage scope;
- original created timestamp;
- `ir_kind`;
- `status` (remains `"draft"`).

Rule:

> To target a different dictionary entry, create a new correction draft.

Do not silently retarget. Successful edit updates `updated_at` only.

---

## 19. Validation

Strict validation. Do not silently repair malformed drafts.

### Identity

- non-empty `draft_id`;
- non-empty `bundle_id`;
- non-empty `ir_id`;
- `ir_kind === "lexicon_entry"`;
- `schema_version === "correction_draft_v1"`;
- `status === "draft"`.

### Provenance

- non-empty `content_sha256` with expected installed-hash shape used elsewhere
  in the app (`sha256:...` or the same canonical form Learning already stores);
- non-empty `storage_scope_id`.

### Issue type / mode

- supported enums only.

### Target

- exact supported shape;
- valid non-negative integer indices;
- `gloss_lang` only `fr` | `en` | `ru` when present;
- `other_field.field_label` non-empty after trim and within length limit;
- no unknown fields.

### User text

- `problem_description` non-empty after trim;
- `proposed_value` required non-empty after trim when
  `mode === "proposed_correction"`;
- maximum lengths enforced;
- reject disallowed control characters (preserve Unicode, N’Ko, diacritics,
  newlines);
- do not transliterate or normalize linguistic content beyond safe storage.

### Timestamps

- valid ISO-8601 UTC ending in `Z`;
- `updated_at >= created_at`.

### Snapshot

- `headword_latin` required non-empty after trim;
- optional snapshot strings within length limits;
- no unknown snapshot fields.

---

## 20. Text limits

Unicode-aware character counting where practical:

```text
problem_description: 2,000 characters
proposed_value: 2,000 characters
other_field.field_label: 120 characters
display_snapshot string fields: 500 characters each
```

Do not choose unlimited text. Do not prohibit N’Ko, diacritics, or multiline
explanations.

---

## 21. Draft creation flow

```text
Suggest a correction
  → choose issue type
  → choose affected part
  → choose mode (report problem / propose correction)
  → describe the problem
  → optionally propose a correction
  → review summary
  → Save correction draft
```

Keep this on one bounded form. Do not create a complex wizard. Do not submit
automatically. Do not autosave.

---

## 22. Missing-entry decision

```text
Excluded from CF1 MVP
```

Reason:

- no stable `ir_id` for a missing entry;
- requires separate source-query or lexical-candidate identity;
- Phase 1.5 `correction_record_v1` targets an existing IR record and does not
  define safe new-entry semantics for CF1 capture.

Allowed:

```text
missing_information within an existing entry
```

Not allowed in CF1:

```text
create an entirely new dictionary entry
```

Future product: `CF2 — Missing Entry and Search Failure Feedback`.

---

## 23. Search-result boundary

Do not attach corrections to search-result relationships in MVP.

A user must open the genuine `lexicon_entry` before creating a correction.

Reason:

- result order is not lexical identity;
- one query may map to multiple entries;
- query-result relationships are not dictionary records;
- avoids confusing search dissatisfaction with content correction.

Search miss reporting remains query-validation / future CF2 territory.

---

## 24. Entry-unavailable behavior

When a pending draft’s target cannot resolve:

- show snapshot;
- show bundle ID and entry ID in technical details where appropriate;
- indicate entry currently unavailable;
- allow edit / delete / export;
- do not allow live entry comparison;
- do not treat the snapshot as a live dictionary entry;
- do not discard the draft.

---

## 25. Pending Corrections surface

Canonical management surface:

```text
Manage Corrections
```

Required states:

```text
loading
empty
populated
editing
deleting
exporting
exported
error
```

Each row shows:

- headword or snapshot label;
- issue type (localized label);
- short problem description;
- created or updated date;
- current availability;
- Edit;
- Delete.

Do not show full proposed text in every row by default.

Empty state: no drafts; Export disabled.

---

## 26. Draft detail / edit surface

Required:

- original snapshot;
- current live entry comparison when resolvable;
- issue type;
- target field;
- mode;
- problem description;
- proposed value;
- created/updated timestamps;
- Save;
- Delete;
- Back.

Do not claim differences are automatically conflicts. Neutral wording:

```text
Current dictionary content differs from the content shown when this draft was created.
```

French:

```text
Le contenu actuel du dictionnaire diffère de celui affiché lors de la création de ce brouillon.
```

---

## 27. Export product

Chosen format:

```text
versioned UTF-8 JSON handoff package
```

Package schema:

```text
siralex_correction_feedback_v1
```

Recommended top-level shape:

```ts
type CorrectionFeedbackPackageV1 = {
  package_schema: "siralex_correction_feedback_v1";
  exported_at: string; // ISO-8601 UTC
  app_version?: string;
  authority_label:
    "unreviewed_user_suggestions_must_not_be_applied_automatically";
  draft_count: number;
  drafts: CorrectionDraftV1[];
};
```

### Phase 1.5 compatibility decision

```text
Handoff package — not direct dry-run input
```

Inspected Phase 1.5 requirements CF1 **cannot** honestly populate as a complete
`correction_record_v1` / correctionset:

| Phase 1.5 field / contract | CF1 capability |
| --- | --- |
| `patch` RFC 6902 under `/fields_raw/...` | User text is not a validated IR patch |
| `submitter.anonymous_token` | No identity/token product in MVP |
| `status: approved` | Forbidden; only human review may approve |
| `provenance.target_snapshot.ir_version` | App has bundle identity, not IR freeze version |
| `provenance.target_snapshot.record_sha256` for apply | Bundle `content_sha256` ≠ IR record hash contract |
| `provenance.audit.submitted_via` | Not `manual_import` / `api` / `batch` without conversion |
| `correction_id` format `corr_YYYYMMDD_######` | Local draft IDs are separate |
| correctionset manifest + integrity wrapper | Built by review tooling, not the app |

Direct compatibility is **rejected** to avoid falsely claiming dry-run safety.

Handoff mapping after human review/conversion:

```text
CF1 correction draft
  → unreviewed user evidence
  → human review/conversion
  → Phase 1.5 correction artifact (correction_record_v1 + correctionset)
  → dry-run application
  → approved release process
```

Fields CF1 can contribute as review inputs:

- `bundle_id`, `ir_id`, `content_sha256`, `storage_scope_id`;
- issue type / mode;
- target locator + snapshot;
- problem description / proposed value;
- draft timestamps and draft ID.

Fields requiring human review before Phase 1.5 eligibility:

- RFC 6902 patch construction;
- IR version pinning;
- IR record hash verification;
- approval status and audit metadata;
- correctionset assembly.

---

## 28. Export authority label

Every export must state, at package level:

```text
These records are unreviewed user suggestions.
They must not be applied automatically.
```

French:

```text
Ces enregistrements sont des suggestions d’utilisateurs non révisées.
Ils ne doivent pas être appliqués automatiquement.
```

Do not call the file:

- approved corrections;
- correction release;
- patch;
- migration;
- authoritative update.

Prefer:

```text
correction feedback
correction drafts
unreviewed suggestions
```

---

## 29. Export scope

MVP:

```text
Export all pending correction drafts
```

- disable when empty;
- no empty export;
- no selected-draft export in MVP.

Optional future: selected drafts / one draft.

---

## 30. Export ordering

Deterministic order (do not rely on IndexedDB cursor order):

1. `bundle_id` ascending (bytewise);
2. `ir_id` ascending;
3. `created_at` ascending;
4. `draft_id` ascending.

---

## 31. Export filename

```text
siralex-correction-feedback-YYYY-MM-DDTHH-mm-ssZ.json
```

Requirements:

- UTC;
- no headword;
- no vocabulary;
- no user/device name;
- no email;
- no bundle ID.

Media type: `application/json;charset=utf-8`.

---

## 32. Export validation

Before download:

1. read all drafts in one readonly snapshot;
2. validate each draft;
3. reject complete export if any draft is invalid;
4. sort deterministically;
5. construct package;
6. serialize stable UTF-8 JSON;
7. parse/validate generated output;
8. trigger download.

Do not silently omit invalid drafts. Do not export a partial packet labeled
complete. Export does not mutate drafts.

---

## 33. Import decision

```text
Export only; no local re-import in CF1.
```

Reason:

- primary handoff is toward human review;
- import creates merge, identity, provenance, and device-transfer complexity;
- LP1 already protects Learning data, not correction drafts.

Data-loss boundary decisions:

- dedicated correction-draft backup is **deferred**;
- correction drafts are **not** included in LP1 Learning backup;
- full database deletion reminder **must** mention pending correction drafts
  when any exist;
- a future broader local backup product may include correction drafts only after
  an explicit product decision.

Do not silently assume correction drafts are protected by LP1.

---

## 34. Database deletion relationship

Lock:

- full database deletion removes correction drafts;
- CF1 does not alter deletion semantics;
- when pending drafts exist, show a non-blocking reminder:

```text
Export your correction feedback before deleting the database.
```

French:

```text
Exportez vos commentaires de correction avant de supprimer la base de données.
```

- no automatic export;
- no forced export;
- no guarantee the downloaded file was retained.

Keep Learning-backup and correction-export reminders distinct.

---

## 35. Privacy

Correction drafts may expose:

- words the user inspected;
- perceived errors;
- proposed translations;
- linguistic opinions;
- timestamps;
- bundle and entry identifiers.

Required warning:

> Correction feedback may contain words, translations, and notes you entered.
> Anyone with the exported file may be able to read them.

French:

> Les commentaires de correction peuvent contenir des mots, des traductions et
> des notes que vous avez saisis. Toute personne disposant du fichier exporté
> pourrait les lire.

Lock:

- local-only;
- no upload;
- no account;
- no email;
- no device identifier;
- no query-log consent reuse;
- no Learning-backup consent reuse;
- plaintext;
- not authenticated;
- authorship not verified.

---

## 36. Anonymous / attributed decision

```text
anonymous local drafts
```

Do not collect:

- name;
- email;
- phone;
- organization;
- demographic profile.

External reviewers may later receive files through a separate transfer channel.
Attribution requires a separate privacy and identity decision.

---

## 37. Offline behavior

Required:

- create draft offline;
- edit offline;
- delete offline;
- list offline;
- compare with installed entry offline;
- export offline;
- no catalog request;
- no server submission;
- no telemetry.

Do not require connectivity for any CF1 MVP action.

---

## 38. Language / script handling

User-authored text must support:

- French;
- English;
- Maninka Latin;
- N’Ko;
- diacritics;
- multiline text.

Do not transliterate automatically. Do not normalize proposed linguistic content
beyond safe storage requirements. Preserve exact Unicode text.

---

## 39. Localization

Dedicated keys:

```text
correctionFeedback.*
```

Required concepts and locked EN/FR terminology:

| Concept | EN | FR |
| --- | --- | --- |
| Suggest action | Suggest a correction | Suggérer une correction |
| Report mode | Report a problem | Signaler un problème |
| Propose mode | Propose a correction | Proposer une correction |
| Issue type | Issue type | Type de problème |
| Affected content | Affected content | Contenu concerné |
| Describe problem | Describe the problem | Décrivez le problème |
| Proposed value | Proposed correction | Correction proposée |
| Save | Save correction draft | Enregistrer le brouillon de correction |
| Pending surface | Manage Corrections | Gérer les corrections |
| Pending title | Pending corrections | Corrections en attente |
| Edit | Edit | Modifier |
| Delete | Delete | Supprimer |
| Export | Export correction feedback | Exporter les commentaires de correction |
| Unreviewed warning | Unreviewed suggestions — must not be applied automatically | Suggestions non révisées — ne doivent pas être appliquées automatiquement |
| Local-only warning | Saved on this device only. Nothing is uploaded. | Enregistré uniquement sur cet appareil. Rien n’est envoyé. |
| Entry unavailable | Entry currently unavailable | Entrée actuellement indisponible |
| Dictionary changed | Dictionary content has changed since this correction was created. | Le contenu du dictionnaire a changé depuis la création de cette correction. |
| Empty | No correction drafts yet | Aucun brouillon de correction |
| Export created | Correction feedback export created | Export des commentaires de correction créé |
| Export failed | Could not export correction feedback | Impossible d’exporter les commentaires de correction |
| Deletion reminder | Export your correction feedback before deleting the database. | Exportez vos commentaires de correction avant de supprimer la base de données. |

Do not use “submit” where no transmission occurs.

Prefer:

```text
Save correction draft
Export correction feedback
```

---

## 40. Accessibility

Define:

- real Suggest Correction button;
- labeled form fields;
- fieldset for mode and issue type where appropriate;
- persistent descriptions;
- error summary;
- focus to first invalid field;
- confirmation before delete;
- semantic pending-draft list;
- keyboard operation;
- visible save/export result;
- no color-only issue category;
- Unicode/N’Ko input supported;
- current versus original content clearly labeled;
- no inaccessible custom select controls.

---

## 41. Concurrency / stale state

Required:

- one save operation at a time;
- duplicate save suppressed;
- editing stale draft detects deletion or replacement;
- bundle switch invalidates live-entry comparison;
- draft identity remains stable;
- export uses one readonly snapshot;
- bundle update during editing does not rewrite draft provenance;
- stale entry host cannot create a draft for a different entry;
- navigation away discards unsaved form state unless explicit draft save occurs.

Do not autosave in MVP.

---

## 42. Timestamps

Use:

```text
created_at
updated_at
```

Rules:

- created once;
- updated on successful edit;
- store generates timestamps consistently at write time;
- no immutable edit history;
- no audit event store;
- no export timestamp written back to drafts.

Do not add:

```text
submitted_at
reviewed_at
approved_at
applied_at
```

---

## 43. Deletion

Require explicit confirmation.

Deletion:

- removes local draft only;
- does not affect dictionary;
- does not affect previously exported files;
- does not affect Phase 1.5 artifacts;
- does not create a tombstone;
- does not create audit history.

---

## 44. Phase 1.5 relationship

```text
CF1 correction draft
  → unreviewed user evidence
  → human review/conversion
  → Phase 1.5 correction artifact
  → dry-run application
  → approved release process
```

CF1 drafts are **not** valid `correction_record_v1` rows and are **not**
correctionset dry-run inputs.

Reviewers/converters must:

1. interpret issue type, target, snapshot, and user text;
2. construct a constrained RFC 6902 patch under `/fields_raw/...` when a
   content change is approved;
3. pin IR version and record hash;
4. set status/`audit` fields under Phase 1.5 governance;
5. assemble correctionset manifest + `corrections.jsonl`.

Problem reports without a proposed value may still become reviewed corrections,
deferrals, or rejections after human judgment.

---

## 45. Query-log relationship

Lock:

- query logs capture search behavior;
- correction drafts capture explicit user-authored content claims;
- separate stores;
- separate exports;
- separate warnings;
- separate management surfaces;
- no automatic linking;
- no shared consent.

Optional future query reference is outside MVP.

---

## 46. Learning relationship

Lock:

- correction drafts are not Learning Records;
- correction identity does not use Learning identity;
- Save Vocabulary does not create corrections;
- Review does not ask for corrections;
- correction drafts are not included in LP1 Learning backup;
- correction status does not affect Progress;
- no correction prompts inside Review.

This prevents CF1 from becoming LS4 by another route. LS4 remains:

```text
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
```

---

## 47. Lexical-quality relationship

CF1 produces candidate evidence, not approved corpus content.

Expected downstream use:

```text
exported feedback
  → review
  → classify
  → reject/defer/approve
  → convert to governed correction artifact
  → rebuild data
  → validate bundle
  → publish
```

Do not let the runtime close the loop automatically.

---

## 48. Missing-entry future boundary

```text
CF2 — Missing Entry and Search Failure Feedback
```

Potential identity:

```text
bundle_id
query_raw
direction
observed result state
proposed lexical item
```

Do not implement or merge CF2 into CF1. Phase 1.5 does not currently define safe
new-entry semantics for entry-correction drafts.

---

## 49. Surface states

Entry correction form:

```text
idle
editing
validating
saving
saved
error
```

Pending Corrections:

```text
loading
empty
populated
editing
deleting
exporting
exported
error
```

Do not create moderation states.

---

## 50. Success criteria

CF1 succeeds when later executable evidence proves:

1. Suggest Correction appears only on genuine lexicon entries.
2. Search mappings cannot be corrected as entries.
3. Draft stores stable `(bundle_id, ir_id)` target.
4. Original content hash and storage scope are preserved.
5. Issue category is required.
6. Problem description is required.
7. Proposed value is optional except in `proposed_correction` mode.
8. N’Ko and diacritics persist exactly.
9. Draft creation works offline.
10. Draft editing works offline.
11. Draft deletion works offline.
12. Bundle removal does not delete drafts.
13. Bundle update does not rewrite draft provenance.
14. Unresolved drafts remain visible.
15. Live dictionary remains authoritative.
16. Display snapshot remains non-authoritative.
17. Pending list shows all drafts deterministically.
18. Duplicate save activation does not create duplicate drafts.
19. Invalid drafts cannot persist.
20. Export disabled when empty.
21. Export includes all valid drafts.
22. Export blocks on any invalid local draft.
23. Export ordering is deterministic.
24. Export filename contains no vocabulary.
25. Export labels records unreviewed.
26. Export works offline.
27. Export does not mutate drafts.
28. Export does not append query logs.
29. Export does not alter Learning Records.
30. Dictionary stores remain unchanged.
31. Delete draft does not alter dictionary.
32. Full database deletion removes drafts.
33. Deletion reminder appears when drafts exist.
34. No automatic upload occurs.
35. No account identity is collected.
36. No correction is auto-applied.
37. EN/FR parity.
38. Accessibility focus and keyboard flow work.
39. Phase 1.5 handoff boundary is explicit.
40. CF1 remains separate from Learning, query logging, and dictionary authority.

---

## 51. Implementation architecture

```text
CF1I1 — Correction Draft Model and Validation
CF1I2 — Local Correction Draft Store
CF1I3 — Entry Suggestion Surface
CF1I4 — Pending Corrections and Export
CF1I5 — Offline and Lifecycle Verification
CF1I6 — CF1 Closure
```

### CF1I1

- schema;
- enums;
- target model;
- strict validator;
- exact Unicode handling;
- deterministic serialization helpers for drafts and package construction.

### CF1I2

- IndexedDB `correction_drafts` store and DB version bump;
- create/edit/delete/list;
- bundle lifecycle retention;
- timestamps;
- atomic writes.

### CF1I3

- Suggest Correction entry action;
- form;
- current-entry context and snapshot capture;
- validation;
- EN/FR;
- accessibility.

### CF1I4

- Manage Corrections;
- edit/delete;
- export package;
- deletion reminder;
- handoff artifact warnings.

### CF1I5

- Playwright offline flow;
- bundle update/remove lifecycle;
- export isolation from Learning/query logs/dictionary;
- package validation evidence;
- Phase 1.5 handoff-boundary verification (not auto-apply).

### CF1I6

- closure report;
- final evidence matrix;
- limitations;
- next decision.

Parallel tracks remain:

```text
PV1A — Production Identity and Desktop Smoke
PV1B — Physical Device Validation — hardware-gated
```

---

## 52. Alternatives rejected

| Alternative | Reason |
| --- | --- |
| Direct dictionary editing | Bypasses authority and release governance |
| Automatic correction application | Unsafe and linguistically invalid |
| Public comment threads | Moderation, identity, abuse, and sync burden |
| Voting | Popularity is not linguistic authority |
| Anonymous server submission | Network, consent, storage, abuse, and backend scope |
| Query-log reuse | Explicit content claims differ from behavioral logging |
| Learning-record reuse | Correction drafts are not learning state |
| Full issue tracker | Excessive workflow scope |
| AI-generated correction suggestions | Hallucination and authority risk |
| New-entry proposals inside entry correction | No stable identity / Phase 1.5 new-entry semantics |
| Auto-delete after export | Download does not prove receipt |
| Mark exported as submitted | No acknowledgment exists |
| Full edit history | No consumer in MVP |
| Direct Phase 1.5 JSONL export as dry-run input | Required reviewer/patch/IR fields missing |
| Sense IDs invented by runtime | Corpus has no durable sub-identities |

---

## 53. Explicit non-goals

Do not define or implement in CF1:

- cloud submission;
- backend;
- accounts;
- attribution;
- moderation dashboard;
- reviewer workflow;
- approval UI;
- automatic application;
- corpus rebuild;
- bundle publishing;
- voting;
- comments;
- public profiles;
- reputation;
- AI correction generation;
- transliteration;
- pronunciation recording;
- audio upload;
- missing-entry workflow;
- search-miss workflow;
- query-log linking;
- Learning integration;
- LP1 expansion;
- synchronization;
- encryption;
- signing;
- correction import;
- edit history;
- telemetry;
- analytics.

---

## 54. Open issues

Resolved by this definition:

| # | Issue | Decision |
| --- | --- | --- |
| 1 | Exact issue enum | Locked nine-value taxonomy in §9 |
| 2 | Problem-report vs proposed-correction | Both supported via `mode` |
| 3 | Target-field representation | Discriminated `CorrectionTarget` |
| 4 | Stable sub-IDs vs indices | Indices + snapshot; no invented IDs |
| 5 | Exact draft schema | `correction_draft_v1` in §14 |
| 6 | Persistent status | Fixed `status: "draft"` only |
| 7 | Text limits | 2,000 / 2,000 / 120 / 500 |
| 8 | Display snapshot scope | Bounded snapshot in §12 |
| 9 | Bundle update warning | Retain provenance; neutral changed warning |
| 10 | Unresolved-draft behavior | Remain editable/exportable with snapshot |
| 11 | Export JSON vs JSONL | Versioned JSON handoff package |
| 12 | Direct Phase 1.5 compatibility | Handoff conversion required |
| 13 | Export package schema | `siralex_correction_feedback_v1` |
| 14 | Export ordering | bundle_id → ir_id → created_at → draft_id |
| 15 | Export filename | `siralex-correction-feedback-...Z.json` |
| 16 | Export-all vs selected | Export all only; empty disabled |
| 17 | Post-export state | No draft mutation; transient UI result |
| 18 | Database deletion reminder | Distinct non-blocking reminder when drafts exist |
| 19 | Missing-entry exclusion | Excluded; future CF2 |
| 20 | Correction-draft backup boundary | Deferred; not in LP1 |
| 21 | Anonymous vs attributed | Anonymous local drafts |
| 22 | Exact EN/FR terminology | Locked table in §39 |

No blocking open issue remains for CF1I1 to begin model/validation work.

---

## Roadmap status

```text
CF1 — Community Correction and Feedback Capture — Selected
CF1D0 — Community Correction and Feedback Product Definition — Defined
CF1I1 — Correction Draft Model and Validation — Next
PV1A — Production Identity and Desktop Smoke — Parallel active
PV1B — Physical Device Validation — Parallel, hardware-gated
LS4 — Guided Review Sessions — Defined, deferred pending demonstrated need
```

---

## Documentation-only confirmation

This slice creates only the product definition report and an optional narrow
roadmap status update. No runtime, schema, UI, test, corpus, bundle, catalog,
deployment, or Phase 1.5 artifact changes were made.

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `CF1_CORRECTION_FEEDBACK_PRODUCT_DEFINED` |
| Product | Local offline non-authoritative correction capture + handoff export |
| Entry point | Entry detail → Suggest a correction |
| Store | `correction_drafts` |
| Export | `siralex_correction_feedback_v1` JSON package |
| Phase 1.5 | Handoff conversion required; not direct dry-run input |
| Missing entries | Excluded (future CF2) |
| Next slice | `CF1I1 — Correction Draft Model and Validation` |
| Code changes | None |
