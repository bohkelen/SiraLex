# LP1D0 — Local Learning Backup and Restore Product Definition

## 1. Decision

```text
LP1_BACKUP_RESTORE_PRODUCT_DEFINED
```

This slice is documentation-only. No runtime code, tests, IndexedDB schema, UI,
CSS, i18n, Playwright, bundles, catalog, source data, or packages were modified.

Authoritative inputs:

- `docs/reports/pd0_next_product_build_decision.md`
- `docs/reports/ls3_progress_return_closure_report.md`
- `docs/reports/ls2_review_and_reflect_closure_report.md`
- `docs/reports/ls1_learning_system_closure_report.md`
- current `learning_record_v1` / `learning_records` store
- current bundle lifecycle and database deletion behavior
- current query-log export as a separate privacy boundary
- current EN/FR terminology and offline-first requirements

The product definition does **not**:

- provide export without restore;
- import dictionary records as Learning data;
- redefine Learning identity;
- silently overwrite existing records;
- accept malformed or future-incompatible packages without validation;
- introduce cloud upload or sync;
- merge records without an explicit deterministic policy;
- drop unresolved records;
- treat display cache as lexical authority.

---

## 2. Product outcome

LP1 is:

> A local, user-initiated, versioned backup file containing personal Learning
> Records that can be validated and restored into SiraLex without requiring
> network access or bundling dictionary content.

LP1 is **not**:

- cloud sync;
- account backup;
- dictionary export;
- query-log export;
- automatic backup;
- background synchronization;
- device pairing;
- learning analytics.

---

## 3. User problem

Learning Records created by Save, Review, and Progress are device-local.
Browser storage clear, device replacement, or full database deletion permanently
destroys that personal state. No Learning export/import exists today. Users need
an offline path to preserve and restore personal LS1–LS3 Learning Records
without exporting dictionary authority or inventing cloud accounts.

---

## 4. User loop

```text
Open Learning backup controls
  → Export local Learning backup
  → Save file outside browser storage
  → Later select backup file
  → Validate package
  → Preview impact
  → Confirm restore policy
  → Restore Learning Records
  → Reopen Saved Vocabulary
  → Resolve available entries
  → Preserve unavailable entries as soft orphans
```

---

## 5. Architectural boundary

| Constraint | Rule |
| --- | --- |
| Identity | Remains `(bundle_id, ir_id)` |
| Contents | Learning Records only |
| Dictionary | Never exported or imported by LP1 |
| Authority | Live dictionary remains lexical authority |
| Display cache | Unresolved fallback only; never reviewability |
| Offline | Export and restore fully local |
| Sync | Forbidden |
| Telemetry | Forbidden |
| Query logs | Separate surface and consent |
| Schema | Backup package schema distinct from dictionary packages |
| LS4 | Remains defined and deferred; not implemented by LP1 |

---

## 6. Canonical surface

Canonical location:

```text
Manage Learning Data
```

within the existing application management area (near dictionary/database
management controls).

Contents:

- Export Learning Backup
- Restore Learning Backup
- concise local-only explanation
- privacy warning
- latest action result

Placement relative to Delete Database:

- same broader management area;
- visually separated from Delete Database;
- restore confirmation must not be confused with database deletion;
- Learning backup controls must not share the query-log export control group.

Do **not** place backup controls:

- inside Saved Vocabulary rows;
- inside Review;
- inside entry detail;
- beside query-log export as if they were the same feature;
- in the primary search flow.

Reason:

> Backup and restore are destructive-data-management operations, not ordinary
> learning actions.

---

## 7. Backup scope

The backup includes personal Learning Records only.

Required included fields for each record (exact stored values):

```text
schema_version
bundle_id
ir_id
ir_kind
content_sha256
storage_scope_id
status
created_at
display_cache
last_reviewed
review_count
```

Why content stamps and display cache remain included:

- stamps preserve provenance and resolution context at save time;
- display cache preserves unresolved-row fallback presentation;
- neither becomes dictionary authority after restore.

Do **not** export:

- dictionary records;
- search index;
- bundle payloads;
- bundle registry;
- active-bundle selection;
- query logs;
- query-log consent;
- app settings;
- locale;
- Review session state;
- Progress state;
- service-worker data;
- browser cache;
- installation files.

---

## 8. Package identity

Dedicated package schema:

```ts
type LearningBackupPackageV1 = {
  package_schema: "siralex_learning_backup_v1";
  exported_at: string; // ISO-8601 UTC
  app_version?: string;
  record_count: number;
  bundle_summaries: LearningBackupBundleSummary[];
  records: LearningRecordV1[];
};

type LearningBackupBundleSummary = {
  bundle_id: string;
  record_count: number;
  content_sha256_values: string[]; // unique values present among records
};
```

### Include

```text
package_schema
exported_at
app_version
record_count
bundle_summaries
records
```

### Exclude

```text
device_id
user_id
account_id
locale
active_bundle_id
package_id as required identity
checksum/signature (MVP)
```

Reason: no account/device identity is required; locale and active bundle are not
personal Learning identity; records remain authoritative.

Bundle summaries are non-authoritative preview/validation helpers. The `records`
array is the source of restored content.

---

## 9. File format

MVP format:

```text
UTF-8 JSON file
```

Extension / media handling:

```text
.siralex-learning-backup.json
```

Advantages: inspectable; easy to validate; no ZIP dependency; suitable for
current expected volumes; lower complexity.

Rejected for MVP: ZIP packages; reuse of dictionary bundle package schema.

Learning backup and dictionary packages remain distinct.

---

## 10. Deterministic export

Export behavior:

1. read **all** Learning Records across all bundles;
2. validate each against supported schema **and** review-field consistency;
3. sort deterministically;
4. construct package + bundle summaries;
5. serialize deterministically;
6. self-validate with the restore parser;
7. trigger local download.

Record order:

```text
bundle_id ascending
ir_id ascending
```

Do not rely on IndexedDB cursor order.

JSON serialization (locked):

- UTF-8;
- stable object field order for package and records;
- two-space indentation;
- trailing newline at EOF;
- no localized field names;
- `JSON.stringify` with deterministic key order enforced by construction order.

Bit-for-bit determinism for identical stored data is the preferred goal under
these rules. Semantic equivalence is the hard requirement.

---

## 11. Export preconditions

### No Learning Records

- disable Export;
- show `No learning data to back up`;
- do **not** generate an empty backup.

### Valid records

Export all records across all bundles.

### Any malformed / review-inconsistent local record

Do **not** silently omit.

Result:

```text
backup_export_blocked_invalid_record
```

Show:

- export not created;
- count of invalid records;
- no record contents / vocabulary in error copy;
- guidance that Learning data could not be safely backed up.

Do **not** repair records during export.

Empty backup packages are rejected for MVP.

---

## 12. Filename

Deterministic human-readable filename using UTC:

```text
siralex-learning-backup-YYYY-MM-DDTHH-mm-ssZ.json
```

Example:

```text
siralex-learning-backup-2026-07-30T22-30-00Z.json
```

Do **not** include vocabulary words, bundle names, user names, or device names.

---

## 13. Restore flow

Required stages:

```text
Choose file
  → Read locally
  → Parse
  → Validate package schema
  → Validate every record
  → Analyze compatibility
  → Build restore preview
  → Select restore policy
  → Confirm
  → Apply atomically
  → Report result
```

No database mutation before final confirmation.

Do **not** automatically restore immediately after file selection.

---

## 14. Validation layers

### Layer 1 — File

- size ≤ 25 MiB;
- readable;
- valid UTF-8;
- valid JSON;
- exactly one top-level object.

### Layer 2 — Package

- `package_schema === "siralex_learning_backup_v1"`;
- required fields present with expected types;
- `record_count === records.length`;
- bundle summaries consistent with records;
- `exported_at` parseable ISO-8601.

### Layer 3 — Record

Every record must satisfy current Learning Record write validation **and**
review-field consistency (`hasConsistentReviewFields`):

- supported `schema_version` (`learning_record_v1` in MVP);
- non-empty `bundle_id`, `ir_id`;
- `ir_kind === "lexicon_entry"`;
- valid status;
- valid timestamps;
- non-negative safe-integer `review_count`;
- consistent never-reviewed / reviewed pairing;
- valid display cache;
- valid content stamps.

### Layer 4 — Package consistency

- no duplicate `(bundle_id, ir_id)`;
- summaries match records;
- no unsupported object types.

Reject the **entire** package on structural invalidity. No partial import of
malformed packages in MVP.

---

## 15. Version compatibility

### Package schema

| Case | Behavior |
| --- | --- |
| Current `siralex_learning_backup_v1` | Accept after validation |
| Older supported package | Accept only via explicit migration (none in MVP) |
| Newer unknown package schema | Reject safely |

Copy:

> This backup was created by a newer version of SiraLex and cannot be restored
> here.

Do not guess compatibility. Do not strip unknown fields and continue.

### Learning Record schema

| Case | Behavior |
| --- | --- |
| Current `learning_record_v1` | Accept after strict validation |
| Older known record version | Accept only via explicit migration |
| Future unknown record version | Reject package |

MVP: support only `learning_record_v1`. Define migration architecture for later;
implement no historical migrations unless such versions exist.

---

## 16. Dictionary compatibility

Dictionary installation is **not** required for restore.

| Destination state | Behavior |
| --- | --- |
| Matching installed logical bundle | Records may resolve normally after restore |
| Same `bundle_id`, different content hash | Restore unchanged; informational warning in preview |
| Dictionary not installed | Restore unchanged; later unresolved when that bundle is active |
| `ir_id` missing from installed dictionary | Restore as unavailable soft orphan |

Do **not**:

- fetch dictionaries automatically;
- embed dictionary data;
- rewrite `storage_scope_id` or content stamps;
- delete unresolved records;
- fabricate entries from display cache.

---

## 17. Multi-bundle scope

Backup scope:

```text
all Learning Records across all bundles
```

Reason: protects complete personal state; avoids requiring users to understand
bundle boundaries; one backup is simpler.

Restore preview groups by bundle.

Restore does **not** change active-bundle selection.

One-bundle export is deferred, not MVP.

---

## 18. Restore policy analysis

Analyzed candidates:

| Policy | Assessment |
| --- | --- |
| Replace all | Exact restore; destructive; requires strong warning |
| Full semantic Merge | Needs conflict arbitration; opaque risk |
| Add only missing | Transparent; preserves local conflicts |
| Per-record conflict UI | Disproportionate MVP complexity |

Silent latest-timestamp / “most advanced reflection” arbitration is rejected
because it invents opaque or mastery-like semantics.

---

## 19. Selected restore policies

Locked MVP set:

### Add missing records

- insert backup identities absent locally;
- preserve every existing local record;
- skip conflicting identities;
- report inserted/skipped counts;
- no field-level reconciliation.

### Replace all

- atomically delete current Learning Records;
- insert all validated backup records;
- final Learning state equals backup contents;
- dictionary data remains untouched.

### Cancel

- no mutation.

Full semantic Merge is deferred.

Do **not** call “Add missing records” Merge.

---

## 20. Conflict semantics

Under **Add missing records**, for identity `(bundle_id, ir_id)`:

| Case | Result |
| --- | --- |
| Only in backup | Insert |
| Only local | Keep local |
| Identical | Unchanged / skipped as present |
| Conflict (same identity, different fields) | **Skip**; keep local |

No backup-wins or local-wins field arbitration in MVP.

Under **Replace all**, conflicts are irrelevant: local Learning Records are
cleared and backup contents become the entire store.

---

## 21. Restore preview

Before confirmation, display:

```text
Backup created
Package version
Total records
Bundles represented
Installed dictionaries matched
Dictionaries missing
Content-hash mismatches (informational)
Current local record count
Records to add
Conflicts to skip
Records to replace (Replace all only)
```

Preview varies by selected policy.

Do **not** display every vocabulary word by default.

Optional expandable detail may show bundle IDs and counts.

---

## 22. Replace warning

Required explicit warning:

> Replace all will permanently remove the current Learning Records on this
> device and replace them with the selected backup. Dictionary data will not be
> changed.

Confirmation must distinguish:

- Learning Records;
- dictionary data;
- query logs;
- application settings.

Do **not** reuse generic database-delete confirmation.

**Confirmation strength (MVP):** one strong confirmation dialog; no typed phrase
unless later usability policy requires it.

---

## 23. Atomicity

Restore is atomic at the Learning Record store level.

### Add missing

One read/write transaction:

- inspect current keys;
- insert only absent records;
- commit all or none.

### Replace all

One read/write transaction:

- clear Learning Record store;
- insert all backup records;
- commit all or none.

Expected Learning volumes fit a single IndexedDB transaction. If implementation
discovers otherwise, a staging design must be defined before shipping — never
leave partial restore results.

Do **not** mutate dictionary stores.

---

## 24. Concurrency

Required:

- one export at a time;
- one restore parse/preview operation at a time;
- one restore commit at a time;
- controls disabled while busy;
- duplicate confirmation cannot create duplicate writes;
- database deletion and Learning restore cannot run concurrently;
- bundle installation must not interleave with Learning restore commit.

Use existing single-writer / busy-guard discipline. Do not invent a second
unrelated locking framework without necessity.

---

## 25. Post-restore behavior

After successful restore:

1. invalidate Saved Vocabulary;
2. invalidate active Review host;
3. discard Progress models;
4. discard guided/deferred session state if any;
5. refresh relevant application status;
6. show result summary;
7. allow user to open Saved Vocabulary;
8. Progress derives from restored records;
9. unresolved rows remain visible when their bundle is active.

Do **not** automatically start Review.

Do **not** automatically switch active bundle.

Do **not** automatically install missing dictionaries.

---

## 26. Result states

### Add missing success

```text
added_count
skipped_conflict_count
unchanged_count
```

### Replace success

```text
previous_count
restored_count
```

### Validation failure / cancel / transaction failure

No mutation.

### Stale host/navigation

Commit may complete if already confirmed, but stale UI must not redraw newer
surfaces.

---

## 27. Export self-validation

Locked:

> Serialize, parse with the same validator used by restore, verify record count
> and identities, then generate the download.

Detects serialization defects and increases trust.

Do **not** write the backup into IndexedDB.

---

## 28. Integrity decision

MVP:

> Strict schema validation and record-count/identity checks; no cryptographic
> signature; no package checksum required.

Local backup files remain user-editable and untrusted on restore.

Do **not** claim tamper resistance.

Optional checksum/signing deferred.

---

## 29. File-size limit

```text
25 MiB
```

Justification: Learning Records are small personal overlays (identity, status,
timestamps, compact display cache). Tens of thousands of records remain well
under 25 MiB in UTF-8 JSON. The limit protects browser memory and prevents
accidental giant-file restores without implying unlimited growth.

Requirements:

- reject oversized files before JSON parsing where possible;
- clear error; no partial restore;
- export blocks if generated payload would exceed the limit.

Unlimited file size is rejected.

---

## 30. Privacy

Locked:

> A Learning backup contains personal vocabulary choices and learning-state
> history in aggregate form.

The file exposes:

- saved words (via display cache / identity);
- bundle associations;
- latest self-assessment;
- review count;
- timestamps;
- display cache.

Required export warning:

> Anyone with this file may be able to see the words you saved and your
> learning progress. Store it somewhere you trust.

Required restore warning:

> Only restore files you trust. SiraLex validates the file structure but cannot
> verify who created or edited it.

Do **not**:

- upload / email / sync automatically;
- reuse query-log consent;
- include query logs;
- include hidden device identifiers.

---

## 31. Encryption

```text
Deferred
```

Reason: passphrase UX and recovery complexity; key-management risk; local
user-controlled storage is a coherent MVP. Privacy warnings remain mandatory.

Do **not** imply the backup file is encrypted.

---

## 32. Offline behavior

Export and restore must work fully offline:

- read IndexedDB locally;
- create backup locally;
- select local file;
- validate / preview / restore locally;
- no catalog request;
- no dictionary download;
- no account or cloud dependency.

Service worker is not required beyond normal application availability for the
chosen local file.

---

## 33. Active-bundle behavior

Backup spans all bundles.

Restore does **not**:

- change active bundle;
- aggregate Progress across bundles;
- make inactive-bundle records visible in the current Saved Vocabulary surface.

After restore:

- Progress remains active-bundle scoped;
- records for other bundles remain stored;
- switching bundles later reveals their restored state.

---

## 34. Unresolved records

Locked:

- unresolved Learning Records are valid backup content;
- restore preserves them exactly;
- display cache remains fallback only;
- missing dictionary does not invalidate restore;
- unresolved records remain non-reviewable;
- compatible reinstall may resolve them later;
- no automatic cache refresh;
- no automatic deletion.

---

## 35. Invalid/inconsistent records

| Kind | Export | Restore |
| --- | --- | --- |
| Valid but currently unresolved | Include | Accept |
| Structurally invalid or review-field inconsistent | **Block entire export** | **Reject entire package** |

Locked safety posture:

> Block export and restore when any record is structurally invalid or
> review-field inconsistent.

Reason: avoids silent data loss; forces explicit repair tooling later; current
production write paths should not create inconsistent records.

Partial backups that skip invalid records are rejected for MVP.

---

## 36. Timestamp handling

Preserve exactly:

```text
created_at
last_reviewed
```

Do **not** replace with import time.

Do **not** add `restored_at`, `imported_at`, or `backup_source` to Learning
Record schema. Package-level restore metadata may exist only in transient UI
result state.

---

## 37. Content stamps

Preserve exactly:

```text
content_sha256
storage_scope_id
```

Do **not** rewrite to the destination’s current bundle metadata.

Resolution remains based on stable logical identity and current active
dictionary rules. Restored stamps may differ from currently installed content;
preview may note hash mismatches informationally.

---

## 38. Display cache

Include and restore `display_cache`.

Rules:

- preserve exact valid cache;
- use only for unresolved Saved Vocabulary presentation;
- never use to make a row reviewable;
- never overwrite live dictionary display;
- never infer a lexicon record from cache;
- never treat cache as authoritative translation data.

---

## 39. Learning identity

Locked:

```text
(bundle_id, ir_id)
```

No backup-specific identity is added. Package uniqueness uses the same key.

Do **not** include source-query, translation-pair, content-hash, storage-scope,
or device identity as Learning identity.

---

## 40. Database deletion relationship

- Delete Database still removes Learning Records.
- Backup provides an external recovery path only when the user exported
  beforehand.
- Database deletion must not automatically generate a backup.

**MVP enhancement included:**

> Before destructive database deletion, show a non-blocking reminder that
> Learning data can be backed up.

- do not force backup;
- do not auto-export;
- reminder copy must not confuse Delete Database with Learning Restore.

---

## 41. Query-log separation

Learning backup and query-log export remain visibly and architecturally
separate.

Do **not**:

- include query logs in Learning backup;
- reuse query-log export filenames or copy;
- require logging consent for Learning backup;
- imply Learning backup contains search diagnostics;
- combine restore with query-log import.

There is no query-log import in LP1.

---

## 42. Localization

Dedicated keys: `learningBackup.*`.

Do **not** reuse query-log or dictionary-import copy where semantics differ.

### English concepts

```text
Manage Learning Data
Learning backup
Export learning backup
Restore learning backup
No learning data to back up
Backup created
Choose backup file
Validate backup
Restore preview
Add missing records
Replace all learning records
Cancel
This backup contains your saved vocabulary and learning progress.
Anyone with this file may be able to see the words you saved and your learning progress. Store it somewhere you trust.
Only restore files you trust. SiraLex validates the file structure but cannot verify who created or edited it.
Dictionary data will not be changed.
Some dictionaries in this backup are not installed.
This backup was created by a newer version of SiraLex and cannot be restored here.
Backup file is invalid.
Restore completed.
Restore failed. No learning data was changed.
Before deleting the database, you can export a Learning backup.
Replace all will permanently remove the current Learning Records on this device and replace them with the selected backup. Dictionary data will not be changed.
```

### French concepts (equivalent meaning)

```text
Gérer les données d’apprentissage
Sauvegarde d’apprentissage
Exporter la sauvegarde d’apprentissage
Restaurer la sauvegarde d’apprentissage
Aucune donnée d’apprentissage à sauvegarder
Sauvegarde créée
Choisir un fichier de sauvegarde
Valider la sauvegarde
Aperçu de la restauration
Ajouter les enregistrements manquants
Remplacer tous les enregistrements d’apprentissage
Annuler
Cette sauvegarde contient votre vocabulaire enregistré et votre progression d’apprentissage.
Toute personne disposant de ce fichier pourra éventuellement voir les mots que vous avez enregistrés et votre progression. Conservez-le dans un endroit de confiance.
Restaurez uniquement des fichiers auxquels vous faites confiance. SiraLex valide la structure du fichier, mais ne peut pas vérifier qui l’a créé ou modifié.
Les données du dictionnaire ne seront pas modifiées.
Certains dictionnaires de cette sauvegarde ne sont pas installés.
Cette sauvegarde a été créée par une version plus récente de SiraLex et ne peut pas être restaurée ici.
Le fichier de sauvegarde est invalide.
Restauration terminée.
Échec de la restauration. Aucune donnée d’apprentissage n’a été modifiée.
Avant de supprimer la base de données, vous pouvez exporter une sauvegarde d’apprentissage.
Remplacer tout supprimera définitivement les enregistrements d’apprentissage actuels sur cet appareil et les remplacera par la sauvegarde sélectionnée. Les données du dictionnaire ne seront pas modifiées.
```

---

## 43. Accessibility

- Export and Restore are real buttons;
- restore file input has an accessible label;
- validation status uses appropriate status semantics;
- destructive Replace warning is readable before confirmation;
- preview is navigable by heading structure;
- bundle summaries use lists or tables with proper semantics;
- focus moves to validation error heading on failure;
- focus moves to preview heading after successful validation;
- focus moves to result heading after commit;
- keyboard-only operation;
- no color-only success/failure state;
- file name is announced;
- confirmation dialogs are accessible;
- busy state prevents duplicate activation.

Do **not** announce every record individually.

---

## 44. Surface states

### Export

```text
loading_count
empty
ready
exporting
exported
error
```

### Restore

```text
idle
reading
validating
invalid
preview
confirming
restoring
success
error
```

No restore mutation before:

```text
preview → explicit policy → confirmation
```

Do not combine validation and commit into one opaque state.

---

## 45. Failure handling

Failure classes:

- unreadable file;
- oversized file;
- invalid JSON;
- unsupported package version;
- invalid package shape;
- duplicate identities;
- invalid record;
- review-field inconsistent record;
- record count mismatch;
- summary mismatch;
- transaction failure;
- database unavailable;
- stale application context;
- export blocked by invalid local record;
- generated export exceeds size limit.

Every failure must state:

- no Learning data changed;
- whether the selected file can be retried;
- no dictionary data changed.

Do not expose stack traces in ordinary UI.

---

## 46. Auditability

LP1 does not add a persistent restore log.

After restore, show a transient result summary.

Do **not** create:

- backup history store;
- restore event store;
- source-device history;
- analytics event;
- telemetry upload.

Future audit history requires a separate decision.

---

## 47. Success criteria

LP1 succeeds when executable evidence later proves:

1. Export disabled when no Learning Records exist.
2. Export includes all valid Learning Records across bundles.
3. Export excludes dictionary/query-log/settings data.
4. Package schema and record count are correct.
5. Export is deterministic by identity order.
6. Generated package passes the same validator used by restore.
7. Backup filename contains no personal vocabulary.
8. Restore performs no mutation before confirmation.
9. Invalid JSON is rejected.
10. Unknown package version is rejected.
11. Invalid Learning Record is rejected.
12. Review-inconsistent record is rejected.
13. Duplicate identity is rejected.
14. Oversized file is rejected.
15. Missing dictionaries do not block restore.
16. Unresolved records restore intact.
17. Display cache restores but remains non-authoritative.
18. Content stamps restore unchanged.
19. Add missing inserts only absent identities.
20. Add missing preserves conflicts.
21. Replace all produces exact backup record set.
22. Restore is atomic.
23. Transaction failure leaves original records unchanged.
24. Dictionary stores remain unchanged.
25. Search index remains unchanged.
26. Query logs remain unchanged.
27. Bundle registry remains unchanged.
28. Active bundle remains unchanged.
29. Progress derives correctly after restore.
30. Review eligibility remains live-entry based.
31. Active-bundle isolation remains intact.
32. Full DB deletion still removes restored Learning Records.
33. Deletion reminder about backup is non-blocking.
34. Export works offline.
35. Restore works offline.
36. Duplicate activation is suppressed.
37. EN/FR parity.
38. Accessibility focus flow works.
39. Privacy warnings appear.
40. Replace-all warning distinguishes Learning from dictionary data.
41. No cloud request occurs.
42. LS1–LS3 behavior remains unchanged.
43. LS4 remains deferred and unimplemented.

---

## 48. Implementation architecture

Define but do not implement:

```text
LP1I1 — Learning Backup Package Model and Validator
LP1I2 — Deterministic Export
LP1I3 — Restore Preview and Atomic Policies
LP1I4 — Backup and Restore Surface
LP1I5 — Offline and Lifecycle Verification
LP1I6 — LP1 Closure
```

| Slice | Purpose | Main output | Boundary |
| --- | --- | --- | --- |
| LP1I1 | Package types, strict parser, record validation, identity checks, preview analysis model | Validator + analysis types | No UI; no DB writes |
| LP1I2 | Read all Learning Records; deterministic package; self-validation; local file generation | Export pipeline | No restore; no full UI |
| LP1I3 | Add missing / Replace all transactions; preview counts; atomicity; isolation | Restore engine | No general UI |
| LP1I4 | Management surface; EN/FR; privacy warnings; file selection; preview; confirmation; a11y; deletion reminder | UI | Uses LP1I1–I3 |
| LP1I5 | Playwright online/offline export/restore; destructive lifecycle; missing dictionary; isolation; failures | Browser evidence | Verification + narrow fixes |
| LP1I6 | Closure report; final evidence matrix; limitations | Docs | Docs only |

Next slice:

```text
LP1I1 — Learning Backup Package Model and Validator
```

---

## 49. Alternatives rejected

| Alternative | Reject reason |
| --- | --- |
| Export only | Not a usable backup product |
| Automatic cloud backup | Privacy, accounts, sync, consent outside LP1 |
| Full database export | Mixes dictionary, logs, settings, personal state |
| Dictionary plus Learning package | Dictionary has its own package/install lifecycle |
| Silent merge by latest timestamp | Clock and mastery ambiguity |
| Silent field-wise reconciliation | Opaque conflict semantics |
| Per-record conflict dialog | Disproportionate MVP complexity |
| Automatic Replace all | Destructive without explicit choice |
| Restore only when dictionary installed | Unresolved records are valid portable state |
| Rewrite content stamps on restore | Destroys provenance |
| Exclude display cache | Harms unresolved presentation |
| Encrypt by default | Deferred key-management complexity |
| Persist restore history | New behavioral data store |
| Empty backup when no records | Useless and misleading |
| Partial export skipping invalid records | Silent incomplete backup risk |
| ZIP package | Unnecessary complexity for expected volume |

---

## 50. Explicit non-goals

Do not define or implement in LP1:

- cloud sync;
- accounts;
- automatic backup;
- background backup;
- device discovery;
- QR / email transfer;
- dictionary export/restore;
- query-log import or bundling;
- Learning history;
- restore audit store;
- scheduling;
- SRS;
- LS4 Guided Sessions;
- new Learning identity;
- Learning Record schema migration (except future package migrations);
- encryption;
- compression;
- signing;
- remote backup;
- telemetry;
- analytics;
- cross-device conflict resolution;
- per-record merge UI;
- source-language Learning objects;
- translation relationships;
- corpus changes.

---

## 51. Open issues

All open issues for MVP are **resolved**:

| # | Issue | Decision |
| --- | --- | --- |
| 1 | JSON vs ZIP | **UTF-8 JSON** |
| 2 | Extension | **`.siralex-learning-backup.json`** |
| 3 | Package schema | **`siralex_learning_backup_v1`** |
| 4 | Scope | **All bundles** |
| 5 | Empty export | **Disable; no empty backup** |
| 6 | Invalid local record | **Block entire export** |
| 7 | File-size limit | **25 MiB** |
| 8 | Bundle summaries | **Include counts + unique content hashes** |
| 9 | Restore policies | **Add missing / Replace all / Cancel** |
| 10 | Conflicts | **Skipped under Add missing; local kept** |
| 11 | Replace confirmation | **One strong dialog; no typed phrase** |
| 12 | Atomicity | **One transaction, all or none** |
| 13 | Checksum/signature | **None in MVP** |
| 14 | Encryption | **Deferred** |
| 15 | Missing dictionaries | **Allowed** |
| 16 | Different content hashes | **Allowed; informational warning** |
| 17 | DB deletion reminder | **Included; non-blocking** |
| 18 | Deterministic serialization | **Yes (stable order + 2-space JSON)** |
| 19 | Export self-validation | **Yes, before download** |
| 20 | EN/FR terminology | **Locked in §42 under `learningBackup.*`** |

No unresolved product decisions remain that would block
`LP1_BACKUP_RESTORE_PRODUCT_DEFINED`.

---

## Documentation-only confirmation

This slice changes only documentation (this report and the roadmap status
update). No export/import runtime, schema, UI, tests, or i18n were implemented.
LS4 remains deferred and unimplemented.

---

## Repository hygiene

Unrelated featured-anchor work remains uncommitted and was not staged:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

This slice stages only:

```text
docs/reports/lp1d0_local_learning_backup_restore_product_definition.md
docs/ROADMAP.md
```

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LP1_BACKUP_RESTORE_PRODUCT_DEFINED` |
| Package | `siralex_learning_backup_v1` JSON |
| Policies | Add missing / Replace all / Cancel |
| Encryption / checksum | Deferred / none |
| LS4 | Remains deferred |
| Next slice | `LP1I1 — Learning Backup Package Model and Validator` |
| Code changes | None |
