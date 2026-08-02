# CF1I6 — Correction Feedback Closure Report

## 1. Decision

```text
CF1_CORRECTION_FEEDBACK_CLOSED
```

CF1 is a completed product milestone. Executable evidence from CF1I1–CF1I5
supports the locked Community Correction and Feedback Capture capability,
including offline create/manage/edit/export and dictionary-lifecycle retention.
This closure slice is documentation/governance only.

Authoritative chain:

- `docs/reports/pd1_next_product_build_decision.md`
- `docs/reports/cf1d0_community_correction_feedback_product_definition.md`
- `docs/reports/cf1i1_correction_draft_model_validation_report.md`
- `docs/reports/cf1i2_local_correction_draft_store_report.md`
- `docs/reports/cf1i3_entry_suggestion_surface_report.md`
- `docs/reports/cf1i4_pending_corrections_export_report.md`
- `docs/reports/cf1i5_offline_correction_lifecycle_verification_report.md`

No executable evidence contradicts a locked CF1 requirement.

---

## 2. Product capability closed

```text
A user can identify a defect in a genuine installed dictionary entry,
capture a structured non-authoritative correction draft entirely locally,
retain and manage that draft independently of dictionary lifecycle changes,
export all validated drafts as a deterministic review artifact, and do all
core correction operations offline without changing dictionary authority.
```

Evidence test of that claim:

| Clause | Evidence | Result |
| --- | --- | --- |
| Genuine installed entry | CF1I3 entry gate + CF1I5 Chromium Suggest on `diag_lex_alpha` | Satisfied |
| Structured local draft | CF1I1/I2 model+store; CF1I5 create path | Satisfied |
| Non-authoritative | Authority label; no corpus write; isolation tests | Satisfied |
| Retain across dictionary lifecycle | CF1I2/I4/I5 removal; Vitest H1→H2 | Satisfied |
| Manage drafts | CF1I4 Manage Corrections + CF1I5 edit/delete | Satisfied |
| Deterministic export | CF1I1 package + CF1I4/I5 download/reparse | Satisfied |
| Offline core ops | CF1I5 offline create/manage/edit/export/reload | Satisfied |
| No dictionary authority change | Isolation + no Phase 1.5 auto-apply | Satisfied |

---

## 3. Original problem

Users need a way to report lexical defects against installed dictionary content
without editing the dictionary in-place, inventing corpus authority, or
depending on a network-backed community system. CF1D0 defined a local capture
and handoff-export product that stops at unreviewed user evidence.

---

## 4. Final user loop

```text
Install/use dictionary
  → open genuine lexicon_entry
  → Suggest a correction
  → describe issue / optional proposal
  → save local draft
  → Manage Corrections
  → inspect / edit / delete
  → Export correction feedback
  → retain local drafts (unchanged by export)
  → later external human review outside CF1 runtime
```

Offline variant (once shell + dictionary are local):

```text
offline
  → open entry
  → create / manage / edit / export
  → reload offline
  → drafts remain
```

---

## 5. Authority model

Frozen chain:

```text
Installed dictionary
    ↓ lexical authority
Local correction draft
    ↓ user evidence, non-authoritative
siralex_correction_feedback_v1 export
    ↓ review handoff, still non-authoritative
External human review / conversion
    ↓
Phase 1.5 governed correction artifact
    ↓
Approved corpus/bundle change
```

CF1 does **not** bridge the final two arrows automatically. Runtime never
converts drafts or exports into approved dictionary authority.

---

## 6. Slice/commit history

| Slice | Commit | Subject |
| --- | --- | --- |
| CF1D0 | `521fc7a2ddcdae2da3dae52443dea613edf4b10c` | Define community correction feedback product |
| CF1I1 | `71d00a37abcee90897339f2bbb83fdf104a932b5` | Implement correction draft model and validator |
| CF1I1A | `e1ab99248faf473f20f4e26417523b2674d1bded` | Tighten correction provenance validation |
| CF1I2 | `1b92eccf71fb1ab00604255a0af04e3558045ad1` | Implement local correction draft store |
| CF1I2A | `c13aaa52b65a02d36a22fbbeed74170ad4fa2956` | Require secure correction draft IDs |
| CF1I3 | `a81b9c9368c17ea29be66c2f8aefebf5ed5ee15c` | Implement entry correction suggestion surface |
| CF1I3A | `7157ecf15d0120992ad4645714cc6616ac1e27a6` | Fix correction form commit lifecycle |
| CF1I4 | `cab96ac1cff2a51bac271496661ec834d13f059d` | Implement pending corrections and export |
| CF1I5 | `a0b4589662230083e4b507b4d9bf9e41802e22f0` | Verify offline correction lifecycle |
| CF1I6 | (this closure commit) | Close Community Correction and Feedback Capture |

---

## 7. Requirements reconciliation matrix

Status vocabulary for this matrix: `SATISFIED` | `DEFERRED_BY_DESIGN` | `BLOCKED`.

| # | Requirement | Implementation | Executable evidence | Status | Residual note |
| --- | --- | --- | --- | --- | --- |
| 1 | Genuine `lexicon_entry` entry point | CF1I3 | Form gate + CF1I5 Suggest on lexicon entry | SATISFIED | `index_mapping` never opens form |
| 2 | Local-only draft creation | CF1I2/I3 | Store create + isolation tests; no upload | SATISFIED | |
| 3 | Dedicated `draft_id` | CF1I2/I2A | Secure UUID path; conflict on add | SATISFIED | Fails closed if secure RNG unavailable |
| 4 | `(bundle_id, ir_id)` targeting | CF1I1/I3 | Draft identity fields; export provenance | SATISFIED | |
| 5 | Immutable content hash/scope provenance | CF1I1–I4 | Edit preserves hash/scope; export retains | SATISFIED | |
| 6 | Issue taxonomy | CF1I1/I3 | Enum validation + UI | SATISFIED | |
| 7 | Correction modes | CF1I1/I3 | `problem_report` / `proposed_correction` | SATISFIED | |
| 8 | Discriminated target model | CF1I1/I3 | Target variants + retarget options | SATISFIED | Index-based sense/example targets (R1) |
| 9 | Bounded snapshots | CF1I1/I3 | Snapshot field caps + rebuild on retarget | SATISFIED | |
| 10 | Strict validation | CF1I1/I1A/I2/I4 | Parse/write/export reject invalid rows | SATISFIED | Error cap 100 + `error_limit_reached` |
| 11 | Unicode/N’Ko preservation | CF1I1/I4/I5 | Package + browser export text | SATISFIED | |
| 12 | Dedicated IndexedDB store | CF1I2 | v5 `correction_drafts` | SATISFIED | |
| 13 | Immutable provenance during edit | CF1I2/I4 | Update mutates user fields only | SATISFIED | |
| 14 | Stale-edit protection | CF1I2/I4 | `expected_updated_at`; reload on stale | SATISFIED | |
| 15 | Bundle removal retention | CF1I2/I4/I5 | Playwright + store tests | SATISFIED | Unavailable; no cascade delete |
| 16 | Bundle update/hash-mismatch retention | CF1I2/I4/I5 Vitest | H1 retained; `dictionary_content_differs` | SATISFIED | Browser second-hash UI N/A |
| 17 | Manage Corrections | CF1I4/I5 | Secondary entry + session/UI | SATISFIED | |
| 18 | Edit/delete | CF1I4/I5 | Confirm delete; no tombstones | SATISFIED | |
| 19 | Deterministic export | CF1I1/I4/I5 | Export order + reparse | SATISFIED | |
| 20 | Export-all only | CF1I4 | No export-selected | SATISFIED | |
| 21 | No mutation after export | CF1I4/I5 | Drafts unchanged; repeat export allowed | SATISFIED | |
| 22 | No import | CF1D0 non-goal | No import UI/API in CF1 | DEFERRED_BY_DESIGN | Future restore/import |
| 23 | DB deletion behavior/reminder | CF1I2/I4/I5 | Clear drafts; separate reminder | SATISFIED | Not merged with Learning reminder |
| 24 | EN/FR localization | CF1I3–I5 | i18n keys + FR smoke | SATISFIED | No Russian locale |
| 25 | Accessibility baseline | CF1I3–I5 | Focus/labels/`aria-busy` smoke | SATISFIED | Not full WCAG audit |
| 26 | Offline lifecycle | CF1I5 | Offline Chromium create/manage/edit/export/reload | SATISFIED | Wording: no remote dependency |
| 27 | Learning isolation | CF1I2–I5 | Store snapshots unchanged | SATISFIED | |
| 28 | Query-log isolation | CF1I2–I5 | Store snapshots unchanged | SATISFIED | Separate consent semantics |
| 29 | No automatic corpus mutation | Entire CF1 | No corpus/bundle write from drafts | SATISFIED | |
| 30 | Phase 1.5 handoff boundary | CF1D0/I1/I4/I5 | No Phase 1.5 fields; authority warning | SATISFIED | External conversion only |

No matrix row is `BLOCKED`.

---

## 8. Frozen draft schema

```text
schema_version: correction_draft_v1
```

Frozen fields:

```text
schema_version
draft_id
bundle_id
ir_id
ir_kind          (= "lexicon_entry")
content_sha256   (canonical sha256: + 64 lowercase hex)
storage_scope_id
issue_type
mode
target
display_snapshot
problem_description
proposed_value?  (required when mode = proposed_correction)
created_at
updated_at
status           (= "draft" only in CF1)
```

Frozen issue enums:

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

Frozen modes:

```text
problem_report
proposed_correction
```

Frozen target variants (discriminated):

```text
entry | headword | part_of_speech | nko |
sense | translation | example | usage_note | other_field
```

Snapshot semantics: bounded presentation helper rebuilt from live content when
retargeting is allowed; never an editable provenance substitute.

Status remains `"draft"` only. No submitted/exported/approved status in CF1.

“Frozen” means future changes require explicit versioning or a separately
approved compatibility decision — not permanent product immutability.

---

## 9. Frozen export package

```text
package_schema: siralex_correction_feedback_v1
authority_label: unreviewed_user_suggestions_must_not_be_applied_automatically
max bytes: 25 MiB (dedicated CF1 constant)
```

Package fields:

```text
package_schema
exported_at
app_version?
authority_label
draft_count
drafts
```

Export ordering (CF1I1):

```text
bundle_id asc → ir_id asc → created_at asc → draft_id asc
```

Locks:

- export-all only;
- validate every local row before build;
- duplicate `draft_id` blocks export;
- no partial package / no partial download;
- no export-state mutation of draft rows;
- no Phase 1.5 conversion fields;
- reparse generated artifact before download.

UI authority warning (EN/FR) remains required on the management surface.

---

## 10. IndexedDB/store contract

```text
SIRALEX_DB_VERSION = 5
STORE_CORRECTION_DRAFTS = "correction_drafts"
keyPath = "draft_id"
indexes = none
```

Lifecycle rule:

```text
bundle removal/update does not cascade-delete or retarget correction drafts
full database deletion removes them
```

---

## 11. Entry and targeting boundaries

- Suggest is offered only for genuine `lexicon_entry` with complete active-bundle
  provenance.
- Targeting uses dictionary identity `(bundle_id, ir_id)` plus immutable
  `content_sha256` / `storage_scope_id`.
- Sub-entry targets may use sense/example indices because durable sense IDs are
  absent (R1).
- Missing-entry / search-failure feedback is out of scope (CF2).

---

## 12. Bundle lifecycle semantics

| Event | Draft fate | UI availability |
| --- | --- | --- |
| Bundle removed | Retained | `dictionary_unavailable` |
| Content hash changes (H1→H2) | Retained with H1 provenance | `dictionary_content_differs` (neutral) |
| Entry missing under still-installed hash | Retained | `entry_unavailable` |
| Full DB delete | Removed | Reminder hidden after recreate |

No automatic retarget or rewrite of provenance.

---

## 13. Edit/delete semantics

Editable: issue, mode, target (only when live retarget allowed), user text,
snapshot rebuilt from live content when retargeting.

Immutable: schema, draft id, bundle/ir/kind/hash/scope, created_at, status.

Stale edit/delete uses `expected_updated_at`; stale paths do not overwrite or
delete. Confirmed delete has no tombstones and does not touch dictionary /
Learning / query logs.

---

## 14. Export semantics

```text
list all → validate all → build(exportedAt) → serialize
→ UTF-8 byte check → reparse → Blob download → revoke URL
```

Empty export disabled. Repeat export allowed. Drafts remain local drafts after
export. Success copy reports filename and count only — never upload, receipt,
review, or application.

---

## 15. Offline guarantee and evidence wording

Evidence-supported claim:

```text
Core correction operations — create, manage, edit, delete, and export —
operate without a remote network dependency once the app shell and dictionary
are locally available.
```

Also recorded:

- offline Chromium reload passed in CF1I5;
- no cloud/backend is involved in CF1;
- network evidence does **not** claim that correction actions generate zero
  attempted same-origin HTTP requests unless separately proven.

Defensible offline/network statement:

> Correction create/manage/edit/export requires no remote network dependency and
> operates successfully in the offline browser context.

---

## 16. Privacy/security boundary

- Drafts are plaintext local IndexedDB data.
- Exports are plaintext JSON files.
- No account identity field.
- No device identity field.
- No automatic upload.
- No encryption in CF1.
- Exported descriptions/proposals may contain sensitive user-authored text.
- The application warns before export (authority warning) and before database
  deletion (correction reminder).
- Correction data has separate semantics from query-log consent and Learning data.

Attribution wording:

```text
unattributed within the CF1 data model
```

Do not call the system “anonymous” in a cryptographic sense.

---

## 17. Accessibility/localization boundary

- EN/FR dedicated `correctionFeedback.*` keys; no Russian locale path.
- Accessibility baseline: headings, labels, status/error regions, delete
  confirmation, focus management, `aria-busy`, keyboard operation, N’Ko
  `lang`/`dir` where shown.
- Not a full WCAG certification.

---

## 18. Learning/query-log isolation

Correction create/edit/delete/export change only `correction_drafts` (plus UI
host state). Learning Records, query logs, consent, dictionary records, search
index, and settings remain unchanged. Correction reminders are not merged with
Learning backup reminders.

---

## 19. Phase 1.5 boundary

CF1 export is review handoff evidence only. It is not a Phase 1.5 dry-run input
and is not applied automatically. Conversion into Phase 1.5-compatible
correction records/patches remains an external governed workflow.

---

## 20. Production/PV1 boundary

```text
CF1 product capability: CLOSED
PV1 release/device validation: remains parallel
```

- CF1 Playwright proves Chromium lifecycle behavior.
- It does not replace physical iPhone/Android validation.
- Android remains subject to the existing PV1 hardware gate.
- Production host identity remains a PV1 concern unless independently resolved.

---

## 21. Deferred work

```text
CF2 — Missing Entry and Search Failure Feedback
Phase 1.5 human-review/conversion tooling beyond existing dry-run pipeline
server/community submission infrastructure
moderation UI
accounts/attribution
sync
correction import/restore
correction backup integration with LP1
AI-assisted correction
voting/comments
LS4 Guided Review Sessions
```

Linguistic/search evidence gates remain outside CF1 closure and must not be
smuggled into this milestone.

---

## 22. Future corpus-review bridge

```text
CF1 export
→ external human review
→ explicit conversion into Phase 1.5-compatible correction records/patches
→ dry-run validation
→ approval/audit
→ corpus rebuild
→ new dictionary bundle
→ PV1/release validation
```

Future governed workflow — not CF1 runtime behavior.

---

## 23. Future field-learning questions

Observability questions for later research (no telemetry in CF1I6):

```text
How many correction drafts are created?
Which issue categories dominate?
Which lexical entries receive repeated independent reports?
How many exported suggestions become approved corrections?
How often do drafts become stale because dictionary content changes?
Which search failures indicate missing-entry demand for CF2?
```

---

## 24. Residual risks

### R1 — Snapshot/index fragility

| | |
| --- | --- |
| Impact | Sense/example targets can drift if array order changes |
| Current mitigation | Content hash mismatch surfaces neutrally; no silent retarget |
| Future owner/slice | Corpus sense-ID work / later correction model version |

### R2 — External review gap

| | |
| --- | --- |
| Impact | Export is not directly consumable as approved Phase 1.5 data |
| Current mitigation | Explicit authority label + non-goals |
| Future owner/slice | Phase 1.5 conversion / review tooling |

### R3 — Plaintext data

| | |
| --- | --- |
| Impact | Local/exported user notes are readable on device/share |
| Current mitigation | Local-only warnings; no automatic upload |
| Future owner/slice | Future privacy/encryption decision (not CF1) |

### R4 — Backup gap

| | |
| --- | --- |
| Impact | Drafts are not in LP1 and have no import/restore path |
| Current mitigation | Export-all + DB deletion reminder |
| Future owner/slice | Correction backup/import or LP1 integration decision |

### R5 — Dictionary evolution

| | |
| --- | --- |
| Impact | Older drafts may become content-different/unavailable |
| Current mitigation | Retention + neutral availability states + immutable provenance |
| Future owner/slice | Reviewer workflow / later management UX |

### R6 — Physical-device evidence

| | |
| --- | --- |
| Impact | CF1 lifecycle is browser-verified, not full device-release proof |
| Current mitigation | Chromium Playwright + Vitest lifecycle |
| Future owner/slice | PV1A/PV1B |

---

## 25. Test/evidence baseline

Final CF1I5 baseline (no runtime files changed in CF1I6):

```text
Focused:
22 files / 258 tests PASS
E2E:
7 Chromium tests PASS
Full:
67 files / 698 tests PASS
Build:
PASS
```

Evidence root pattern:

```text
data/local_evidence/cf1_offline_lifecycle/<run_id>/
```

CF1I6 closure validation:

```text
npm run test:run
npm run build
git diff --check
git status --short
```

---

## 26. Deviations from CF1D0

| Deviation | Classification | Note |
| --- | --- | --- |
| Module decomposition (model/store/form/session/export/renderer) | compatible | Same product contracts; clearer seams |
| Browser H1→H2 update path covered at Vitest, not Playwright | compatible | Fixture lacks second-hash UI seam; executable proof exists |
| Offline network wording refined to “no remote dependency” | contract-tightening | Avoids overclaiming zero same-origin attempts |
| CF1I3A controller-owned DB close + always-notify `onDraftSaved` | contract-tightening | Lifecycle correctness under stale hosts |
| CF1I2A secure draft IDs (`randomUUID`/`getRandomValues`, fail closed) | contract-tightening | Stronger than generic unique-id wording |
| CF1I1A exact 64-hex SHA + validation error cap | contract-tightening | Tightens CF1I1 provenance/validation bounds |
| Missing-entry feedback deferred to CF2 | scope-reduction | Explicit CF1D0 non-goal / later slice |
| No correction import/restore in MVP | scope-reduction | Explicit non-goal |
| No cloud/moderation/accounts in MVP | scope-reduction | Explicit non-goal |

No unexplained `scope-expansion`.

---

## 27. Repository hygiene

CF1I6 touches:

```text
docs/reports/cf1i6_correction_feedback_closure_report.md
docs/ROADMAP.md
```

No runtime implementation changes in this slice.

---

## 28. Final closure statement

CF1 closes the correction-capture loop at the boundary where structured,
unreviewed user evidence leaves the runtime for governed human review. It does
not convert user suggestions into dictionary authority.

Roadmap status:

```text
CF1 — Community Correction and Feedback Capture — CLOSED
```

Next decision returns to the parallel roadmap: PV1 remains active for release
validation, while the next product-build slice should be selected from the
broader SiraLex roadmap rather than assumed to be CF2.
