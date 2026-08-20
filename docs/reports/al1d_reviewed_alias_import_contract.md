# AL1D — Reviewed Alias Import Contract

## 1. Decision

```text
AL1D_REVIEWED_ALIAS_IMPORT_CONTRACT_DEFINED
```

Contract/design only. No import implementation, no `source_aliases_v1.jsonl`
mutation, no apply/build/runtime/UI/schema changes.

Core principle:

```text
A worksheet decision is not dictionary truth
until validated into a reviewed alias artifact
and published through the build pipeline.
```

## 2. Base commit

```text
0ac2495b2fa2b326926068e5de5d1a3826929d32
```

`git log -1`: `0ac2495 Add alias reviewer worksheet exports`.

Working tree at contract drafting:

```text
?? web/scripts/
```

## 3. Files inspected

| Path | Role |
|------|------|
| `shared/specs/source-alias-table-v1.md` | Authoritative alias schema |
| `shared/aliases/source_aliases_v1.jsonl` | Live reviewed alias table |
| `api/source_aliases/validate_alias_table.py` | Fail-closed validation |
| `api/source_aliases/apply_aliases_to_search_index.py` | Approved-only index apply |
| `shared/specs/source-index-supplement-v1.md` | Content-gap / mapping overlay path |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Supplement rows |
| `web/src/aliases/alias_candidate_evidence.ts` | AL1B evidence model |
| `web/src/aliases/alias_candidate_exports.ts` | AL1C worksheet export shape |
| `docs/reports/al1a_alias_and_content_gap_audit.md` | Authority model |
| `docs/reports/al1b_alias_content_gap_candidate_evidence_report.md` | Candidate categories |
| `docs/reports/al1c_reviewer_worksheet_export_report.md` | Export columns |
| CF1/CF2 package authority labels (prior AL1A) | Correction vs search-failure evidence |

## 4. Current reviewed alias artifact / schema

**Path:** `shared/aliases/source_aliases_v1.jsonl`

**Schema:** `source_alias_table_v1`

**Table version field:** `alias_table_version` (e.g. `phase7a-round1`)

**Required fields (all rows):**

- `schema_version` (= `source_alias_table_v1`)
- `alias_table_version`
- `alias_id`
- `status` ∈ `{candidate, approved, rejected, deferred}`
- `direction` (= `source_to_target` only in v1)
- `alias_source_term` (French user-facing alias string)
- `canonical_source_terms[]` (existing indexed French source terms)
- `resolved_ir_ids[]` (deterministic ordered posting set)
- `candidate_type` ∈ {
  `french_plural_singular_alias`,
  `french_gender_alias`,
  `hyphenation_or_compound_alias`,
  `french_common_form_alias`
  }
- `evidence_ir_ids[]`
- `rationale`
- `source_bundle_id`
- `source_norm_version`

**Approved rows additionally require:** `reviewer`, `reviewed_at`

**Semantics:** searching `alias_source_term` routes to the approved
`resolved_ir_ids` derived from `canonical_source_terms`. Generates **`src_*`
keys only**. Does **not** mutate `records.jsonl`. Does **not** create lexicon
entries.

**Build pipeline:**

```text
IR → normalize → enrich
  → build base search_index.jsonl
  → validate source_aliases_v1.jsonl
  → apply approved aliases (fail closed on conflict)
  → emit application report
  → assemble / verify bundle
```

**Validation behavior (existing):** malformed JSON / unknown schema / missing
fields / stale canonical resolution / posting mismatch / hard key conflicts →
`AliasValidationError` / `AliasApplicationError`; apply writes **no** output
index unless the whole approved set validates cleanly.

**AL1D rule:** do **not** invent a parallel alias schema. Import must produce
rows compatible with `source_alias_table_v1`.

## 5. Authority model

```text
CF2 / query logs
    ↓ evidence only
AL1B candidate evidence
    ↓ classification only
AL1C evidence worksheet export
    ↓ blank reviewer fields
Human-filled reviewed decision worksheet
    ↓ still not dictionary truth
Validated source_alias_table_v1 row (usually status: candidate first)
    ↓ human promote to approved + validate/apply
Published bundle search_index
    ↓ searchable metadata
Installed dictionary records.jsonl
    = lexical authority (unchanged by aliases)
```

Frozen claims:

- Worksheet / CF2 / query logs never auto-write dictionary truth.
- Only `status: approved` alias rows may affect generated `search_index.jsonl`.
- Alias rows are search metadata, not new lemmas.
- Supplements / new IR handle true content gaps — not this alias table.

## 6. Worksheet vs reviewed decision vs alias artifact

| Layer | What it is | Authority |
|-------|------------|-----------|
| **A. Evidence worksheet row** | AL1C export from AL1B candidates | Non-authoritative evidence |
| **B. Reviewed decision worksheet row** | Human-filled Layer A + import fields | Non-authoritative human decision |
| **C. Reviewed alias source artifact** | `source_aliases_v1.jsonl` row | Build-config authority after validate; searchable only after approve + publish |
| **Supplement / new IR** | `source_index_supplement_v1` or lexical IR work | Separate track for missing mappings / new entries |
| **CF1 correction draft** | Known-entry defect suggestion (`ir_id` required) | Non-authoritative; not an alias |

**Transitions:**

```text
A (AL1C) --human fills decision + mapping fields--> B
B --fail-closed convert/validate--> C (prefer status: candidate)
C (candidate) --separate human approve + existing validator/applier--> index
```

Layer B is **not** Layer C. Filling `approve_alias` on a CSV does not mutate
`source_aliases_v1.jsonl`.

## 7. Proposed / confirmed reviewed alias fields

### 7.1 Destination artifact (confirmed — existing)

Import target is **`source_alias_table_v1`**, not a new schema.

Required mapping from a Layer B decision into Layer C:

| `source_alias_table_v1` field | Import source |
|-------------------------------|---------------|
| `schema_version` | constant `source_alias_table_v1` |
| `alias_table_version` | importer / release policy (explicit input) |
| `alias_id` | generated stable id (deterministic recipe in AL1D1+) |
| `status` | initial import: **`candidate`** (never jump to approved from worksheet alone) |
| `direction` | `source_to_target` |
| `alias_source_term` | reviewed alias string (= worksheet `query_raw` / normalized alias) |
| `canonical_source_terms` | **required human-supplied** on Layer B |
| `resolved_ir_ids` | **required human-supplied** on Layer B; must validate against base index |
| `candidate_type` | **required human-supplied** enum |
| `evidence_ir_ids` | from decision / equals `resolved_ir_ids` for common-form rules |
| `rationale` | from `reviewer_notes` + classification reason |
| `source_bundle_id` | pinned featured / evidence bundle id |
| `source_norm_version` | e.g. `norm_v3` |
| `reviewer` / `reviewed_at` | required when later promoting to `approved` |

### 7.2 Layer B reviewed-decision worksheet (contract extension)

AL1C leaves `reviewer_decision` / `reviewer_notes` blank. For import
eligibility, Layer B MUST additionally carry (CSV/JSONL extension or sidecar):

| Field | Required for `approve_alias` |
|-------|------------------------------|
| `reviewer_decision` | yes (`approve_alias`) |
| `reviewer_notes` | strongly recommended; required if rationale otherwise empty |
| `reviewed_by` | optional local label (not a user account id) |
| `reviewed_at` | ISO date/time when decision recorded |
| `alias_source_term` | yes (defaults to normalized query if identical) |
| `alias_lang` | yes; must be `fr` for v1 source-alias import |
| `canonical_source_terms` | yes (`; `-joined in CSV; array in JSONL) |
| `resolved_ir_ids` | yes |
| `candidate_type` | yes (v1 enum) |
| `source_bundle_id` | yes |
| `evidence_queries` | optional array (query_raw list; privacy-minimized) |

Do **not** require device/session/user identifiers.

## 8. Reviewer decision vocabulary

Confirmed vocabulary for `reviewer_decision`:

| Decision | Meaning | Maps from AL1B categories (typical) |
|----------|---------|-------------------------------------|
| `approve_alias` | Human believes a **source alias** should be drafted | usually `possible_alias` |
| `reject` | Explicitly decline aliasing this query | any |
| `needs_more_context` | Cannot decide yet | `ambiguous` / thin evidence |
| `content_gap` | Not an alias; route to supplement / new IR | `possible_content_gap` |
| `already_searchable` | Confirm search floor covers it; no alias | `already_searchable` |
| `typo_or_noise` | Ignore | `likely_typo_or_noise` |

Notes:

- Vocabulary is **decision** language, not automatic promotion of AL1B
  `candidate_category`.
- `approve_alias` is allowed only when eligibility rules (§9) pass.
- Blank `reviewer_decision` means **not reviewed** → never import.

## 9. Eligibility rules

A Layer B row is eligible for **alias import conversion** only if **all** hold:

1. `candidate_category == possible_alias`
2. `reviewer_decision == approve_alias`
3. `alias_lang == fr`
4. non-blank `alias_source_term`
5. non-empty `canonical_source_terms`
6. non-empty `resolved_ir_ids` (ordered)
7. valid `candidate_type` (v1 enum)
8. non-blank `source_bundle_id`
9. lookup mode is FR→MNK (`fr->mnk`) when present
10. every `resolved_ir_id` exists in pinned bundle `records.jsonl`
11. canonical terms resolve on the pinned base index consistent with
    `source_alias_table_v1` rules (including common-form subset rules)

**Must not import** (reject row):

- `possible_content_gap`, `ambiguous`, `likely_typo_or_noise`, `already_searchable`
- blank / unknown `reviewer_decision`
- `approve_alias` missing IR / canonical / language / candidate_type
- `approve_alias` with `alias_lang` ≠ `fr`
- EN/MNK/Russian/N’Ko alias attempts into `source_aliases_v1.jsonl`
- target IR missing
- unsafe collision with existing `src_*` key (different postings)
- morphology/fuzzy/semantic-only justification without explicit canonical+IR map

## 10. Validation rules

Future importer/validator MUST fail closed.

Reject when:

- malformed JSON / CSV
- unknown worksheet schema or unknown `source_alias_table_v1` fields after convert
- unsupported `alias_lang`
- blank alias / blank targets
- IR not found in pinned records
- canonical resolution stale vs declared `resolved_ir_ids`
- duplicate `alias_id`
- same `alias_source_term` conflicting with a different approved/candidate target
  set (unless identical ordered postings → explicit dedupe/skip policy)
- existing index key conflict (different ordered `ir_ids`)
- Russian alias / Russian language
- N’Ko synthesis or N’Ko alias without a separately approved contract (none today)
- row requires morphology/fuzzy/semantic interpretation instead of explicit fields
- unapproved/blank reviewer decision
- content_gap / typo / ambiguous / already_searchable decisions offered as alias
- attempt to write `status: approved` directly from worksheet without a second
  governed approval step

**Initial import status policy:** converted rows enter
`source_aliases_v1.jsonl` (or a dry-run preview) as **`candidate`**. Promotion
to `approved` remains the existing human + validator/applier path.

## 11. Language boundaries

| Language | Alias import into `source_aliases_v1` |
|----------|----------------------------------------|
| French (`fr`) | **Allowed** (v1 design: `alias_source_term` is French) |
| English (`en`) | **Out of scope** — no `en_*` alias table in v1 |
| Maninka Latin (`mnk`) | **Out of scope** — no `tgt_*` aliasing in v1 |
| Russian | **Excluded** |
| N’Ko | **Excluded** (no synthesis; no N’Ko alias contract) |

If future EN aliases are needed, they require a **new** reviewed schema — not
silent extension of `source_alias_table_v1`.

## 12. Content-gap boundary

`reviewer_decision: content_gap` and/or AL1B `possible_content_gap` MUST NOT
become `source_alias_table_v1` rows.

Route instead to:

- `source_index_supplement_v1` candidates (missing/incomplete FR mappings), or
- owner lexical / new IR research, or
- a future content-gap queue (AL1F-class)

Spec forbid-list already bans representing missing mappings (e.g. standalone
`poil`) as aliases.

## 13. Provenance model

Preserve on Layer C `rationale` / optional future provenance note (still no PII):

- evidence query string(s)
- evidence source kind (`cf2` / `query_log` / `both` / `fixture`)
- occurrence_count when available
- reviewer_decision
- reviewed_by (optional local label)
- reviewed_at
- `resolved_ir_ids` / `canonical_source_terms`
- `source_bundle_id` + `source_norm_version`
- pointer that origin was worksheet/manual (`provenance_source` may be recorded
  inside `rationale` text until/unless schema gains an optional field)

Do **not** store user id, device id, or session id.

## 14. Failure model

**Recommendation: dry-run per-row report + all-or-nothing write.**

| Mode | Behavior |
|------|----------|
| **Dry-run (default for AL1D1)** | Emit accepted preview + rejected rows with reasons; **no** mutation of `source_aliases_v1.jsonl` |
| **Write mode (later)** | If any selected row fails validation, **abort entire write**; leave existing alias table unchanged |

Rationale: alias tables are small, authority-sensitive, and already fail closed
in apply. Partial silent append of half-validated rows is unsafe.

Never publish, never change runtime search, never apply index from import alone.

### Future dry-run outputs (not implemented in AL1D)

- `accepted_aliases_preview.jsonl` — proposed `source_alias_table_v1` candidates
- `rejected_alias_rows.jsonl` — Layer B rows + reject reason codes
- `import_summary.md` — counts, language scope, authority warning

## 15. Privacy / data minimization

- Export/import query-level evidence only.
- No user / device / session identifiers.
- Reviewer identity optional local label (`reviewed_by`), not an account system.
- Do not copy CF2 free-text beyond what the human places in `reviewer_notes`.

## 16. Recommended next implementation slice

```text
AL1D1 — Reviewed Alias Import Parser / Validator (dry-run)
```

Scope:

- Parse Layer B reviewed-decision rows (CSV/JSONL).
- Enforce §8–§11 eligibility + validation.
- Emit dry-run `accepted_aliases_preview.jsonl` + `rejected_alias_rows.jsonl` +
  summary markdown.
- **No** write to `source_aliases_v1.jsonl`, no apply, no bundle rebuild.

Later menu (not started):

| Slice | Intent |
|-------|--------|
| AL1D2 | Worksheet→`source_aliases` converter (candidate append, still no approve) |
| AL1D3 | Integrate conversion output with existing validate_alias_table |
| AL1D4 | Alias publish dry-run / application report gate |
| AL1D5 | Alias search regression cases for newly approved rows |

## 17. Non-goals

- Implementing import/apply/UI in AL1D
- Auto-approval from CF2/query logs/worksheets
- Runtime synonym engine / local user aliases
- EN/MNK/Russian/N’Ko alias schemas
- Fuzzy / AI / morphology engines
- CF2 / query-log / IndexedDB schema changes
- Mutating records.jsonl via alias import
- Treating content gaps as aliases

## 18. Risks

| Risk | Rating | Mitigation |
|------|--------|------------|
| Treating Layer B `approve_alias` as publishable truth | High | Import only as `candidate`; separate approve+apply |
| Inventing incompatible alias schema | High | Bind to `source_alias_table_v1` only |
| Importing content gaps as aliases | High | Hard eligibility + supplement routing |
| EN pressure into `src_*` table | Medium | Language boundary FR-only |
| Partial batch writes | Medium | All-or-nothing write; dry-run default |
| Over-broad `resolved_ir_ids` | High | Reuse existing validator posting checks (maman pattern) |

## 19. Test plan for next slice (AL1D1)

1. Eligible FR `possible_alias` + `approve_alias` + full mapping → preview row
   `status: candidate`.
2. Blank decision → reject.
3. `content_gap` / `typo_or_noise` / `ambiguous` / `already_searchable` → reject.
4. Missing IR / wrong lang / EN mode → reject.
5. Collision with different postings → reject.
6. Dry-run writes **zero** bytes to `source_aliases_v1.jsonl`.
7. Deterministic preview ordering + stable reject reason codes.
8. No runtime search / UI / CF2 / query-log schema diffs.

## 20. Files changed

```text
docs/reports/al1d_reviewed_alias_import_contract.md
```

## 21. git diff --check

```text
PASS
```

(report-only)

## 22. Working tree

Expected uncommitted:

```text
?? docs/reports/al1d_reviewed_alias_import_contract.md
?? web/scripts/
```

Commit not created.
