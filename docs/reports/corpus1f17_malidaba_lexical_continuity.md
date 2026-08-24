# CORPUS1F17 — Malidaba Legacy-Preserving Lexical Continuity Gate

## 1. Decision

**CORPUS1F17_MALIDABA_LEXICAL_CONTINUITY_GATE_READY**

Human Type-B `retain_baseline_record × 42` was mechanically encoded. Provisional
G9 PASSes under the VERSIONED LEXICAL CONTINUITY model. Type-A v2 blank
continuity worksheet (5 subjects, one-to-many capable) was emitted. Stable
logical lexical reference prototype is READY. Canonical refresh remains blocked
until Type-A continuity sets are selected.

## 2. Base commit

`604a0927fa870e93a1736da55a2de46bf2b0c76f` — *Add Malidaba transition review gate* (CORPUS1F16)

## 3. Human governance decision supplied

1. Baseline Malidaba entries are valid lexical evidence.
2. Current/new Malidaba entries are also valid lexical evidence.
3. The newer edition may add senses, layers, examples, idioms, symbolic
   meanings, or reorganized meanings.
4. Absence of an old sense/record from the newer edition does **not** invalidate
   older evidence.
5. Source refresh must preserve valid legacy knowledge while adding newer
   knowledge.
6. Edition-level provenance must be retained; legacy-only material must not be
   falsely attributed to the newer edition.
7. One lexical form may correspond to multiple current source records/senses;
   do not force one-old-ir_id → one-new-ir_id where polysemy/homonym structure
   applies.

This is a **human** governance decision. Cursor/AI encodes consequences only.

## 4. Why replacement model was insufficient

F15/F16 conceptually treated refresh as:

old edition → replaced by → new edition

That model treated missing baseline records as destructive removals requiring
`CURRENT_EQUIVALENT_RESOLVED` or `NOT_PRODUCT_VISIBLE`. Under the human decision,
omission from the newer edition is not erasure of valid legacy evidence.

## 5. Polysemy / multi-assertion implications

F16 Type-A `confirmed_remap` required exactly one `selected_current_ir_id`.
That assumption is too strong when one baseline form may continue into multiple
current senses/records. F17 Type-A v2 allows one-or-many current IDs without
merging source records.

## 6. Versioned continuity model

```
logical lexical continuity object
├── baseline-edition Malidaba assertions
└── current-edition Malidaba assertions
```

Union of evidence ≠ rewrite of source history. Derived views may expose both
while preserving which edition asserted each piece.

## 7. Type-B 42-row human decision encoding

Mechanically encoded (not AI-reviewed):

| Field | Value |
|-------|-------|
| `review_decision` | `retain_baseline_record` × 42 |
| `reviewer_id` | `Reviewer_001` |
| `review_method` | `manual_review` |
| `reviewed_at` | `2026-08-24T12:00:00+00:00` |
| `selected_current_ir_id` | blank |
| `issue_codes` / `review_notes` | blank |

Worksheet SHA-256:
`424104119bcc575a57704245d84a94b793641c33b8effc89490d283b3dd49157`

## 8. Type-B dry-run

```
rows_read=42
rows_skipped_unreviewed=0
preview_row_count=42
error_count=0
retain_baseline_record=42
```

No Type-B review persistence into F13 registry in this slice (dry-run evidence).

## 9. Updated G9 semantics

**Model:** VERSIONED LEXICAL CONTINUITY

**Meaning:** NO UNREVIEWED DESTRUCTIVE CHANGE

PASS when every absent baseline record is one of:

- `CURRENT_EQUIVALENT_RESOLVED`
- `NOT_PRODUCT_VISIBLE`
- `RETAIN_BASELINE_RECORD` (new; human-retained legacy)

Still BLOCK:

- unreviewed `DESTRUCTIVE_CHANGE_REQUIRES_REVIEW`
- unresolved `AMBIGUOUS`
- `NEEDS_MORE_EVIDENCE`
- `ACCEPT_SOURCE_REMOVAL` without required governance

F15 destructive classifier unchanged; F17 overlays human Type-B decisions for
provisional G9 without rewriting frozen F15 manifests.

## 10. Field-level assertion preservation

Continuity evaluates separately for: headword, N’Ko, POS, variants, senses,
glosses, examples, idioms/subentries, cross-references.

No whole-record “current wins” overwrite.

## 11. Current / legacy / both / conflicting assertion model

| Class | Meaning |
|-------|---------|
| `BOTH_EDITIONS_ASSERTION` | Exact equivalent in both; display once, keep both provenance links |
| `CURRENT_ASSERTION` | Current-only |
| `LEGACY_SUPPORTED_ASSERTION` | Baseline-only; retained as legacy evidence |
| `CONFLICTING_ASSERTIONS` | Non-identical; both preserved; no auto-pick |
| `NEEDS_REVIEW` | Empty on both sides |

Virtual assertion totals (deterministic pairs + legacy-only objects):

| Class | Count |
|-------|------:|
| BOTH_EDITIONS | 31 |
| CURRENT | 0 |
| LEGACY_SUPPORTED | 166 |
| CONFLICTING | 9 |
| NEEDS_REVIEW | 50 |

## 12. Type-A one-to-many continuity requirement

One baseline lexical target may continue into one or more current source
assertions under one stable logical continuity reference. Source records remain
immutable provenance objects (no merge).

## 13. Type-A v2 worksheet

Local/gitignored:

`data/malidaba_delta/current/source_refresh/f17/malidaba_ambiguous_reference_continuity_review_001.csv`

Schema: `malidaba_reference_continuity_review_worksheet_v2`

Rows: **5** (same F16 ambiguous subject set/order)

Allowed decisions:

- `confirmed_continuity` — requires `selected_current_ir_ids` ⊆ frozen candidates (one or more)
- `legacy_only` — empty target list
- `needs_more_evidence` — empty target list

Worksheet SHA-256:
`15589d7424c3f5a8756517465e278c70d9b5c735b97909de84335f046a452681`

Blank dry-run:

```
rows_read=5
rows_skipped_unreviewed=5
preview_row_count=0
error_count=0
```

No Type-A human decisions encoded in F17.

## 14. Stable logical lexical reference prototype

Schema: `malidaba_logical_lexical_continuity_v1`

Deterministic `logical_lexical_id = llx_{hash24}` from:

- `source_id = src_malipense`
- sorted `baseline_ir_ids`
- sorted `current_ir_ids`
- `continuity_status`
- frozen F15 acceptance identity

**Not** derived from headword alone or `source_record_id` alone.

Status: **READY**

## 15. 10 deterministic continuity mappings

From F16 `PROPOSAL_READY` subjects: provisional logical continuity objects with
baseline + current ir_ids and field-level edition assertions.

## 16. 42 legacy-retained continuity objects

`continuity_status = LEGACY_RETAINED`

- `baseline_ir_id` present
- `current_ir_ids = []`
- not attributed as May-2026 / current-edition assertions
- rights inherited from `src_malipense`

## 17. 5 unresolved human continuity subjects

Type-A ambiguous subjects remain `UNRESOLVED_HUMAN_CONTINUITY` placeholders.
No fabricated resolution.

## 18. Virtual G7 result

With 10 deterministic overlays only (Type-A unresolved):

| Metric | Value |
|--------|------:|
| requires_remap | 0 |
| ambiguous | 14 |
| still_resolves | 23 |

G7 does **not** PASS overall (ambiguous remain).

## 19. Virtual G8 result

Regression after deterministic virtual overlay: **17 pass / 13 fail**

(Same provisional surface as F16; Type-A unresolved keeps alias/supplement debt.)

## 20. Provisional G9 result

**PASS** under VERSIONED CONTINUITY MODEL

| Metric | Value |
|--------|------:|
| missing_evidence_total | 42 |
| retain_baseline_record | 42 |
| destructive_unresolved | 0 |

Does **not** authorize overall source refresh (Type-A / G7 still open).

## 21. Rights inheritance

Unchanged: **CC BY-NC-SA 4.0** via `src_malipense`.

Retaining legacy assertions does not create SiraLex-owned content. Commercial
distribution remains blocked / rights-gated.

## 22. Why legacy retention ≠ newer-edition attribution

A baseline-only assertion is labeled `LEGACY_SUPPORTED_ASSERTION` with
`legacy_relabeled_as_current = false` and
`current_edition_attribution = false`. Presentation priority may prefer the
current edition first, but that is not authority deletion and not false
attribution of legacy material to the newer edition.

## 23. Local artifacts

Under `data/malidaba_delta/current/source_refresh/f17/` (gitignored):

- `malidaba_missing_record_disposition_review_001.csv` (completed Type-B)
- `malidaba_ambiguous_reference_continuity_review_001.csv` (blank Type-A v2)
- `lexical_continuity_gate.json`
- `g9_versioned_continuity_dispositions.json`
- `virtual/logical_lexical_continuity.jsonl`
- `virtual/edition_ir_to_logical_lexical_id.jsonl`
- `virtual/` overlay copies for G7/G8

Completed Type-B encoding also mirrored onto the F16 worksheet path the human
reviewed (local/gitignored).

## 24. Tests

`api/malipense_version_delta/tests/test_lexical_continuity_gate.py`

Coverage includes retain×42 validation, G9 retain semantics, provenance,
assertion classes, one-to-many continuity, identity rejection rules,
Type-A v2 multi-select / stale protection, rights inheritance, no canonical
writes.

Full relevant suite: **163 passed**

## 25. Non-mutation

| Target | Result |
|--------|--------|
| Canonical Malidaba IR | UNCHANGED (`97529fc9…`) |
| Review registry | UNCHANGED (`6ada0ee6…`) |
| F15 acceptance | UNCHANGED (`d48d7ee1…`) |
| F15 destructive / integrity manifests | UNCHANGED (frozen hashes) |
| Aliases / supplements / variants / regressions | NONE (virtual only) |
| Bundles / web/public / search | NONE |
| Owner lexical | NONE |
| Type-A persistence | NONE |
| Product promotion | NONE |
| `web/scripts/` | UNTOUCHED |

## 26. git diff --check

PASS

## 27. Working tree

Tracked (uncommitted for ChatGPT review):

- `api/malipense_version_delta/source_refresh/continuity/**`
- `api/malipense_version_delta/source_refresh/model.py`
- `api/malipense_version_delta/source_refresh/paths.py`
- `api/malipense_version_delta/source_refresh/transition/virtual_overlay.py`
- `api/malipense_version_delta/tests/test_lexical_continuity_gate.py`
- `api/pyproject.toml`
- `docs/reports/corpus1f17_malidaba_lexical_continuity.md`

Local/gitignored F17 evidence under `data/malidaba_delta/current/source_refresh/f17/`

Also present: `?? web/scripts/` (untouched)

## 28. Next human gate

**HUMAN SELECTION OF CONTINUITY SETS FOR 5 TYPE-A SUBJECTS**

Fill `malidaba_ambiguous_reference_continuity_review_001.csv` with
`confirmed_continuity` (one or more frozen candidate IDs) or `legacy_only` /
`needs_more_evidence`. Do not apply source refresh until Type-A continuity is
resolved.
