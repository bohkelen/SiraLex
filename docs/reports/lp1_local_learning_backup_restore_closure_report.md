# LP1 — Local Learning Backup and Restore Closure Report

## 1. Decision

```text
LP1_CLOSED
```

LP1 is a completed product milestone. Executable evidence supports the locked
Local Learning Backup and Restore capability, including offline export/restore
and database-deletion recovery. This closure slice is documentation-only.

Authoritative chain:

- `docs/reports/pd0_next_product_build_decision.md`
- `docs/reports/lp1d0_local_learning_backup_restore_product_definition.md`
- `docs/reports/lp1i1_learning_backup_package_model_report.md`
- `docs/reports/lp1i2_deterministic_learning_export_report.md`
- `docs/reports/lp1i3_restore_preview_atomic_policies_report.md`
- `docs/reports/lp1i4_backup_restore_surface_report.md`
- `docs/reports/lp1i5_offline_lifecycle_verification_report.md`
- `docs/reports/ls3_progress_return_closure_report.md`

No executable evidence contradicts a locked LP1 requirement.

---

## 2. Completed product capability

The user can export all personal Learning Records into one local, versioned,
self-validated file and later restore them through transparent Add-missing or
Replace-all policies, online or offline, without exporting dictionary
authority, rewriting learning identities, or silently reconciling conflicts.

---

## 3. Final user loops

### Primary loop

```text
Build Learning state
  → Manage Learning Data
  → Export Learning Backup
  → Retain file outside browser storage
  → Later choose file
  → Validate
  → Preview impact
  → Select policy
  → Confirm
  → Restore
  → Reopen Saved Vocabulary
  → Progress and Review resume from restored Learning Records
```

### Offline loop

```text
Installed offline app
  → Export Learning backup offline
  → Clear or lose local Learning state
  → Select backup offline
  → Validate and preview offline
  → Restore offline
  → Open Saved Vocabulary
  → Review and reflect
  → Reload offline
  → Restored state remains
```

### Destructive-recovery loop

```text
Learning Records exist
  → Database-delete reminder
  → Optional backup export
  → Delete database
  → Reinstall dictionary separately
  → Restore Learning backup
  → Learning state returns
```

---

## 4. Product boundary

LP1 includes:

- local manual export;
- local manual restore;
- all Learning Records across bundles;
- strict package validation;
- self-validation before download;
- Add missing;
- Replace all;
- restore preview;
- missing-dictionary tolerance;
- exact field preservation;
- offline operation;
- privacy warnings;
- database-deletion reminder.

LP1 does not include:

- dictionary backup;
- query-log backup;
- cloud synchronization;
- automatic backup;
- accounts;
- encryption;
- signing;
- restore history;
- semantic merge;
- schema migration;
- cross-device conflict resolution.

Roadmap status for this milestone:

```text
LP1 — Local Learning Backup and Restore — Closed
LP1I6 — Closure — Complete
PD1 — Next Product Build Decision — Next
```

---

## 5. Success matrix

| Capability | Implementation | Evidence | Status |
| --- | --- | --- | --- |
| Versioned Learning backup package | LP1I1 | package tests | Pass |
| Strict top-level/package validation | LP1I1 | package tests | Pass |
| Strict Learning Record validation | shared validator | LP1I1 + LS regressions | Pass |
| Duplicate identity rejection | LP1I1 | package tests | Pass |
| Bundle-summary verification | LP1I1 | package tests | Pass |
| Deterministic identity ordering | LP1I1/I2 | export tests | Pass |
| Stable JSON serialization | LP1I1/I2 | export tests | Pass |
| Export all bundles | LP1I2 | export/integration/browser | Pass |
| Empty export disabled | LP1I4 | browser | Pass |
| Invalid local record blocks export | LP1I2 | integration | Pass |
| Generated export reparsed | LP1I2 | export tests | Pass |
| UTF-8 byte-size enforcement | LP1I1/I4 | package/file tests | Pass |
| Browser download after validation | LP1I4 | browser | Pass |
| Verified-package provenance | LP1I3 | restore tests | Pass |
| Preview before mutation | LP1I3/I4 | browser + integration | Pass |
| Add missing preserves local conflicts | LP1I3 | browser + integration | Pass |
| Replace all exact restoration | LP1I3 | browser + integration | Pass |
| Atomic rollback | LP1I3 | integration | Pass |
| Missing dictionaries allowed | LP1I3 | integration | Pass |
| Hash mismatch allowed | LP1I3 | integration | Pass |
| Unresolved records preserved | LP1I3/I5 | integration | Pass |
| Exact timestamps/stamps/cache preserved | LP1I3/I5 | integration | Pass |
| Active bundle unchanged | LP1I3/I5 | browser + integration | Pass |
| Strict UTF-8 file handling | LP1I4 | browser + unit | Pass |
| Replace confirmation required | LP1I4 | browser | Pass |
| Privacy warnings visible | LP1I4 | browser | Pass |
| EN/FR parity | LP1I4 | renderer + browser smoke | Pass |
| Offline export | LP1I5 | Playwright | Pass |
| Offline restore | LP1I5 | Playwright | Pass |
| Offline reload persistence | LP1I5 | Playwright | Pass |
| Database deletion then restore | LP1I5 | Playwright | Pass |
| Storage/query-log isolation | LP1I3/I5 | integration | Pass |
| Stale callbacks suppressed | LP1I4/I5 | unit/integration | Pass |
| Duplicate activation suppressed | LP1I4/I5 | browser + integration | Pass |
| Accessibility focus sequence | LP1I4/I5 | browser | Pass |

No row is marked Pass from documentation alone.

---

## 6. Final architecture

Export:

```text
learning_records IndexedDB store
  → read-all export adapter
  → strict package builder
  → deterministic serializer
  → UTF-8 byte-size validation
  → parser self-validation
  → browser download
```

Restore:

```text
selected local file
  → size check
  → strict UTF-8 decode
  → strict parser
  → verified package provenance
  → readonly preview
  → explicit policy
  → confirmation
  → one atomic learning_records transaction
  → Learning host invalidation
```

Clarifications:

- dictionary and Learning package systems remain separate;
- Learning backup package is not a full-database export;
- package records are personal state, not lexical authority;
- restore never resolves dictionary entries during commit.

---

## 7. Package contract

```text
package_schema: siralex_learning_backup_v1
exported_at
app_version?
record_count
bundle_summaries
records
```

Extension:

```text
.siralex-learning-backup.json
```

Size boundary:

```text
25 MiB
```

Locks:

- UTF-8 JSON;
- records authoritative;
- summaries derived and cross-validated;
- no empty package;
- no unknown package fields;
- no unknown Learning Record fields;
- no future-version coercion;
- no partial acceptance.

---

## 8. Backup scope

Included Learning Record fields:

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

Exact exclusions:

- dictionary records;
- search index;
- installed bundle payloads;
- bundle registry;
- active bundle;
- query logs;
- query-log consent;
- settings;
- locale;
- Review state;
- Progress state;
- service-worker cache.

---

## 9. Learning identity

```text
(bundle_id, ir_id)
```

- content hash is provenance, not identity;
- storage scope is provenance, not identity;
- display cache is fallback presentation, not identity;
- package position is not identity;
- device identity does not exist;
- source queries and translation relationships remain excluded.

---

## 10. Deterministic export

```text
one readonly snapshot
→ validate every row
→ reject any invalid/inconsistent row
→ reject duplicate identity
→ canonical sort by bundle_id then ir_id
→ derive sorted summaries
→ serialize stable JSON
→ calculate UTF-8 bytes
→ reject oversize
→ reparse through same validator
→ return download artifact
```

Timestamp behavior:

- clock read once;
- same timestamp used for package, filename, and artifact;
- timestamps are not added to Learning Records;
- no persistent export history.

---

## 11. Snapshot semantics

> A backup contains the complete Learning Record set visible to one readonly IndexedDB transaction.

- committed records before snapshot are included;
- later writes are not patched into the package;
- no second database read;
- in-flight uncommitted reflection is absent;
- only `learning_records` participates.

---

## 12. Restore trust boundary

- parser success creates `VerifiedLearningBackupPackage`;
- provenance is module-private and WeakMap-backed;
- package graph is frozen;
- arbitrary lookalike objects are rejected;
- TypeScript shape alone is not trusted;
- unknown package versions never reach commit.

---

## 13. Validation layers

### File

- one file;
- max size;
- readable bytes;
- fatal UTF-8 decode;
- valid JSON.

### Package

- exact schema;
- required fields;
- timestamp;
- count consistency;
- exact keys.

### Records

- `learning_record_v1`;
- genuine `lexicon_entry`;
- exact fields;
- valid timestamps/stamps/cache;
- consistent review fields.

### Consistency

- unique `(bundle_id, ir_id)`;
- summaries exactly match records;
- no partial import.

---

## 14. Restore preview

Preview includes:

- filename;
- export timestamp;
- package schema;
- backup record count;
- current local count;
- bundle compatibility;
- Add-missing counts;
- Replace-all counts;
- local validation state.

- preview performs no writes;
- preview is advisory;
- commit recomputes against transaction-time state;
- bundle compatibility is informational;
- no vocabulary list appears by default.

---

## 15. Restore policies

### Add missing

- insert only absent identities;
- preserve existing identical records;
- preserve existing conflicting records;
- retain local-only records;
- no overwrite;
- no semantic merge;
- no timestamp comparison;
- no status preference;
- repeat restore is idempotent.

### Replace all

- count current records;
- clear Learning store;
- add every backup record;
- commit all or none;
- final Learning set equals exact backup set;
- malformed local rows may be removed as recovery.

### Cancel

- no mutation.

---

## 16. Local-corruption policy

- invalid local records block Add missing;
- preview exposes invalid count without content;
- Replace all remains available;
- Replace all can recover a corrupt Learning store using a valid verified backup;
- no automatic Replace-all selection.

---

## 17. Atomicity

- one readwrite transaction per restore;
- only `learning_records` is writable;
- Add missing uses absent-only insertion;
- Replace all uses clear plus add;
- success returned only after transaction completion;
- any failure aborts complete transaction;
- no partial counts reported;
- no persistent restore log.

---

## 18. Dictionary compatibility

### Dictionary installed and matching

Records may resolve normally.

### Installed with different content hash

- restore allowed;
- preview warns;
- backup provenance retained;
- current dictionary remains lexical authority.

### Dictionary absent

- restore allowed;
- Learning Records retained;
- active bundle unchanged;
- records remain soft orphans until compatible dictionary exists.

### `ir_id` missing

- record retained;
- unresolved;
- non-reviewable;
- display cache fallback only.

---

## 19. Exact field preservation

Exact preservation of:

```text
created_at
last_reviewed
review_count
status
content_sha256
storage_scope_id
display_cache
```

Do not add:

```text
restored_at
imported_at
source_device
backup_source
```

Do not normalize timestamps or cache text.

---

## 20. Display-cache boundary

- included in backup;
- restored exactly;
- usable for unresolved Saved Vocabulary rows;
- never makes a record reviewable;
- never overwrites live dictionary content;
- never becomes lexical authority;
- never fabricates a lexicon entry.

---

## 21. Post-restore lifecycle

After commit:

- active Review host is disposed;
- Saved Vocabulary generations are invalidated;
- entry Learning state is invalidated;
- Progress is discarded and rederived;
- management count refreshes;
- selected file/preview is cleared;
- active bundle stays unchanged.

Do not automatically:

- start Review;
- switch bundle;
- install dictionary;
- rerun search;
- create Progress state.

---

## 22. Offline guarantees

Verified:

- application shell works offline after installation;
- export works offline;
- browser download works offline;
- selected backup validates offline;
- preview works offline;
- Add missing works offline;
- Replace all works offline;
- Saved Vocabulary reloads offline;
- Review works after offline restore;
- reflection persists offline;
- offline reload retains restored and newly reflected state;
- no catalog, account, cloud, or telemetry dependency.

---

## 23. Database deletion relationship

- Delete Database still removes Learning Records and dictionaries;
- LP1 does not change deletion semantics;
- reminder appears when Learning Records exist;
- reminder is non-blocking;
- no automatic backup;
- external backup enables later Learning recovery;
- dictionary reinstall remains a separate operation.

---

## 24. Storage/query-log isolation

Export, file validation, and preview do not mutate any store.

Restore may mutate only:

```text
learning_records
```

Must remain unchanged:

- dictionary records;
- search index;
- bundle registry;
- active bundle metadata;
- query logs;
- settings;
- query-log consent.

No query-log append. No restore telemetry.

---

## 25. Privacy

> A Learning backup exposes saved vocabulary, latest learning status, review counts, timestamps, bundle associations, provenance stamps, and display cache.

- warnings appear before export and restore;
- filename contains no vocabulary;
- no user/device ID;
- no automatic upload;
- no query-log consent reuse;
- package is not encrypted;
- package is not authenticated;
- structure is validated, authorship is not;
- user must store and restore files they trust.

---

## 26. Accessibility/localization

- semantic management heading;
- real Export button;
- persistent file-input label;
- fieldset/radio policy controls;
- disabled Add missing explanation;
- accessible Replace-all dialog;
- focus to invalid, preview, confirmation, policy after cancel, and result;
- keyboard Export;
- busy-state control disabling;
- no color-only meaning;
- EN/FR parity;
- generic unsupported-version wording;
- no raw filesystem path.

---

## 27. Concurrency/stale state

- export calls are independent;
- UI suppresses duplicate activation;
- Add missing is transactionally idempotent;
- Replace all converges to exact backup set;
- file token rejects stale file A after file B;
- stale preview invalidated after bundle lifecycle;
- stale surface cannot redraw after navigation;
- confirmed restore may complete after surface disposal;
- committed data remains durable;
- reopening surfaces reads actual persisted state;
- no persistent lock store.

---

## 28. Browser evidence

Playwright specification: `web/e2e/learning/lp1_learning_backup_restore.spec.ts`

Evidence paths:

- primary online export/replace round trip;
- Add-missing conflict flow;
- offline export/restore/reload;
- validation/privacy/French smoke;
- database deletion and recovery;
- accessibility flow.

Rerun results (this closure):

```text
Focused LP1 Playwright: 6 passed
All Learning Playwright: 18 passed
LS1–LS3 + navigation Playwright: 13 passed
```

Exact command timings are recorded in §36.

---

## 29. Integration evidence

`web/src/learning/lp1i5_backup_restore_lifecycle_verification.test.ts` plus
LP1I1–I4 module tests cover:

- exact field round trip;
- multiple bundles;
- multiple hashes;
- unresolved records;
- Add missing conflicts;
- Replace exact set;
- corrupt-local recovery;
- invalid package no mutation;
- rollback;
- hash mismatch;
- missing dictionary;
- active-bundle preservation;
- store/query-log isolation;
- deletion and restore;
- stale preview;
- stale committed restore;
- duplicate operations;
- file reselection.

---

## 30. Known limitations

These are not LP1 defects:

- local manual backup only;
- no automatic backup;
- no backup scheduling;
- no cloud storage;
- no accounts;
- no multi-device synchronization;
- no semantic conflict merge;
- no per-record restore decisions;
- no restore history;
- no backup history;
- no package encryption;
- no package signature;
- no authenticity verification;
- no compression;
- no streaming parser;
- 25 MiB limit;
- only current package schema;
- only current Learning Record schema;
- no historical migration;
- all-bundles backup only;
- no one-bundle export;
- dictionary data not included;
- query logs not included;
- app settings not included;
- active bundle not included;
- browser download initiation cannot prove user retained the file.

---

## 31. Remaining browser gaps

1. missing-dictionary omit/install path not driven through Playwright;
2. installed hash mismatch not mutated through production browser UI;
3. stale file A/B race covered in controller integration, not Playwright;
4. exact 25 MiB file not allocated in browser;
5. transaction rollback remains integration-only;
6. corrupt-local Replace recovery remains integration-only;
7. deep store/query-log isolation remains integration-level.

Executable integration evidence covers each locked guarantee listed above.

---

## 32. Verification defects and fixes

### Dialog attachment

`showModal()` before DOM attachment emptied or broke the management host.

Fix:

- attach first;
- open dialog after connection;
- renderer regression.

### Mount TDZ

Synchronous initial model emission closed over an uninitialized `const surface`.

Fix:

- assign controller through `let`;
- mount remains stable.

### Bundle lifecycle preview

Bundle removal left compatibility preview stale.

Fix:

- invoke preview invalidation;
- refresh database status;
- integration/browser coverage.

No architecture expansion resulted.

---

## 33. Locked invariants

1. Backup includes Learning Records only.
2. Learning identity remains `(bundle_id, ir_id)`.
3. Dictionary data is never backup authority.
4. Query logs are excluded.
5. Active-bundle state is excluded.
6. All bundles’ Learning Records are exported.
7. Export reads one readonly snapshot.
8. Export validates every record.
9. Invalid local record blocks complete export.
10. No partial backup.
11. Empty backup is not generated.
12. Duplicate identities are rejected.
13. Package summaries must match records.
14. Serialization is deterministic.
15. UTF-8 byte size is enforced.
16. Generated output must reparse successfully.
17. Browser download follows validation.
18. Restore accepts only verified package provenance.
19. Missing dictionaries do not block restore.
20. Hash mismatch does not block restore.
21. Unresolved records are retained.
22. Display cache remains fallback only.
23. Content stamps are preserved.
24. Timestamps are preserved.
25. Add missing never overwrites.
26. Add missing never merges.
27. Replace all produces exact backup set.
28. Restore is atomic.
29. Failure leaves original Learning state unchanged.
30. Only `learning_records` may change.
31. Active bundle remains unchanged.
32. No automatic dictionary installation.
33. No automatic Review start.
34. No Progress persistence.
35. No query-log writes.
36. No cloud request.
37. No telemetry.
38. Privacy warnings precede use.
39. Backup is not claimed encrypted or authentic.
40. Confirmed restore may complete after UI disposal.
41. Stale surfaces cannot redraw newer contexts.
42. LS4 remains deferred.
43. Future sync must not reinterpret LP1 as conflict-resolution infrastructure.
44. Future migrations require explicit package and record-version policy.

---

## 34. Future-system boundaries

Deferred possibilities — **not selected** in LP1 closure:

### Backup encryption

Requires passphrase UX, recovery policy, key derivation, browser-crypto review,
wrong-password behavior, and no silent loss.

### Package migrations

Requires package-version registry, record migration functions, migration tests,
and downgrade behavior.

### Cloud synchronization

Requires account identity, device identity, conflict model, deletion semantics,
privacy and consent, and offline reconciliation.

### Automatic backup

Requires destination authority, scheduling, retention, user awareness, and
failure notification.

### Semantic merge

Requires explicit conflict policy, timestamp trust, status/history semantics,
and user-facing explanation.

---

## 35. Next milestone boundary

Do not automatically begin LP2, LS4, scheduling, sync, or encryption.

Next milestone:

```text
PD1 — Next Product Build Decision
```

Decision question:

> After durable Save, Review, Progress, and Local Backup/Restore, which remaining product problem offers the clearest user gain: lexical/content quality, search/discovery, deployment/device validation, another dictionary-management need, or an evidenced Learning feature?

The decision must:

- compare product areas, not automatically extend LP1;
- consider the lack or presence of real user evidence;
- prioritize obvious user gain;
- keep LS4 deferred unless need is demonstrated;
- distinguish corpus programs from runtime product work;
- avoid infrastructure-first selection without a user-facing consumer.

This slice does not create the complete PD1 instruction.

---

## 36. Final executable baseline

Rerun results for this closure (not copied from prior reports):

### Focused LP1 Vitest pack

```text
npx vitest run \
  src/learning/lp1i5_backup_restore_lifecycle_verification.test.ts \
  src/learning/learning_backup_package.test.ts \
  src/learning/learning_backup_export.test.ts \
  src/learning/learning_backup_restore.test.ts \
  src/learning/learning_backup_file.test.ts \
  src/learning/learning_backup_surface.test.ts \
  src/render/render_learning_backup.test.ts
→ Test Files  7 passed (7)
→ Tests  92 passed (92)
```

### Focused LS1–LS3 Vitest regressions

```text
npx vitest run \
  src/learning/ls1i4_lifecycle_verification.test.ts \
  src/learning/ls2i5_review_lifecycle_verification.test.ts \
  src/learning/ls3i4_progress_lifecycle_verification.test.ts
→ Test Files  3 passed (3)
→ Tests  40 passed (40)
```

### Focused LP1 Playwright

```text
npx playwright test -c playwright.config.ts e2e/learning/lp1_learning_backup_restore.spec.ts
→ 6 passed (43.8s)
```

### All Learning Playwright

```text
npx playwright test -c playwright.config.ts e2e/learning/
→ 18 passed (44.9s)
```

### LS1–LS3 offline + direct-entry navigation Playwright

```text
npx playwright test -c playwright.config.ts \
  e2e/learning/ls1_offline_saved_vocabulary.spec.ts \
  e2e/learning/ls2_offline_review.spec.ts \
  e2e/learning/ls3_progress_return.spec.ts \
  e2e/navigation/source_result_direct_entry.spec.ts
→ 13 passed (16.4s)
```

### Full Vitest (one complete run)

```text
npm run test:run
→ Test Files  54 passed (54)
→ Tests  574 passed (574)
→ Duration  389.39s
```

### Build

```text
npm run build
→ pass (tsc + vite + PWA generateSW; built in 2.15s)
```

No partial runs were merged into a claimed full-suite result.

Hygiene after documentation edits:

```text
git diff --check → clean
```
---

## 37. Closure evidence matrix

| Guarantee group | Guarantee | Implementation | Executable owner | Level | Status |
| --- | --- | --- | --- | --- | --- |
| Package | Versioned schema + exact keys | LP1I1 | package tests | Integration | Pass |
| Package | Duplicate identity rejection | LP1I1 | package tests | Integration | Pass |
| Package | Bundle summaries match records | LP1I1 | package tests | Integration | Pass |
| Export | Readonly all-bundles snapshot | LP1I2 | export + I5 | Integration + browser | Pass |
| Export | Invalid row blocks complete export | LP1I2 | export/I5 | Integration | Pass |
| Export | Deterministic serialize + reparse | LP1I2 | export tests | Integration | Pass |
| File validation | Size / UTF-8 / JSON / schema | LP1I4 | file + browser | Both | Pass |
| Preview | Readonly impact before mutation | LP1I3/I4 | restore + browser | Both | Pass |
| Add missing | Absent-only; conflicts preserved | LP1I3 | browser + I5 | Both | Pass |
| Replace all | Exact backup set + confirmation | LP1I3/I4 | browser + I5 | Both | Pass |
| Atomicity | One transaction; rollback exact | LP1I3 | restore/I5 | Integration | Pass |
| Dictionary compatibility | Missing/hash mismatch allowed | LP1I3 | restore/I5 | Integration | Pass |
| Offline | Export/restore/reload | LP1I5 | Playwright | Browser | Pass |
| Deletion lifecycle | Reminder + restore recovery | LP1I5 | Playwright | Browser | Pass |
| Invalidation | Post-restore host refresh | LP1I4/I5 | surface + browser | Both | Pass |
| Privacy | Warnings; no crypto/cloud claims | LP1I4 | browser smoke | Browser | Pass |
| Accessibility | Focus + keyboard + dialog | LP1I4/I5 | Playwright | Browser | Pass |
| Localization | EN/FR parity | LP1I4 | renderer + FR smoke | Both | Pass |
| Concurrency | Duplicate/stale suppression | LP1I4/I5 | unit/I5 + browser | Both | Pass |
| Isolation | Only `learning_records` writable | LP1I3/I5 | I5 integration | Integration | Pass |

---

## 38. Repository hygiene

Unrelated featured-anchor work left unstaged throughout LP1I6:

- `web/src/search/resolve_target_lexicon.ts` (+ test)
- `web/src/navigation/open_target_lexicon_entry.ts` (+ test)
- `web/src/types/records.ts`
- `docs/reports/post_ls1_source_result_direct_entry_navigation_report.md`

LP1I6 stages only:

- `docs/reports/lp1_local_learning_backup_restore_closure_report.md`
- narrow `docs/ROADMAP.md` status update

---

## 39. Deviations

- Missing-dictionary and hash-mismatch browser paths remain integration-covered gaps (§31); locked guarantees still Pass via executable integration.
- Exact 25 MiB browser allocation is not performed; size enforcement is proven in package/file tests.
- No contradictions to locked LP1 requirements were found during the closure baseline rerun.
