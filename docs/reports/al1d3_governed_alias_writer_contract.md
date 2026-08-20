# AL1D3 — Governed Alias Writer Contract

## 1. Decision

```text
AL1D3_GOVERNED_ALIAS_WRITER_CONTRACT_DEFINED
```

Contract/design only. No writer, CLI, filesystem append, approval transition,
build/publish change, runtime search change, UI, or schema mutation in this
slice.

Core principle:

```text
The first writer must be governed, explicit, reversible by Git, and fail-closed.
A dry-run accepted candidate is still not searchable truth.
```

## 2. Base commit

```text
9309d2db30bc9d203872d7858f49fb120df2e023
```

`git log -1`: `9309d2d Add reviewed alias dry-run exports`.

Working tree at contract drafting:

```text
?? web/scripts/
```

## 3. Files inspected

| Path | Role |
|------|------|
| `shared/specs/source-alias-table-v1.md` | Alias schema + apply semantics |
| `shared/aliases/source_aliases_v1.jsonl` | Live table (24 rows; ends with newline; statuses today: `approved`, `rejected`) |
| `api/source_aliases/validate_alias_table.py` | Fail-closed validation; `candidate` allowed; only `approved` applied |
| `api/source_aliases/apply_aliases_to_search_index.py` | Approved-only index augmentation |
| `api/source_aliases/tests/test_source_aliases.py` | Preserve-order / candidate-skip / conflict tests |
| `docs/reports/al1d_reviewed_alias_import_contract.md` | Import authority + all-or-nothing write policy |
| `web/src/aliases/reviewed_alias_import.ts` | AL1D1 dry-run validator |
| `web/src/aliases/reviewed_alias_import_dry_run_exports.ts` | AL1D2 artifact package |
| `docs/reports/al1d1_*.md`, `docs/reports/al1d2_*.md` | Prior slice decisions |

## 4. Existing `source_aliases_v1` behavior

**Writer target (confirmed):**

```text
shared/aliases/source_aliases_v1.jsonl
```

**Schema:** `source_alias_table_v1`

**Direction:** `source_to_target` only

**Language:** French `alias_source_term` → `src_*` keys only

**Statuses:** `candidate` | `approved` | `rejected` | `deferred`

**Apply rule:** only `status: approved` affects generated `search_index.jsonl`

**Current file facts:** UTF-8 JSONL, one object/line, final newline present; live rows today are `approved`/`rejected` only (schema already permits `candidate`)

Appending `candidate` rows is therefore **search-inert** until a separate approval + validate/apply + publish path runs. That is the intended first-writer safety property.

## 5. Writer authority boundary

```text
worksheet / AL1C export
    ↓
AL1D1 validation (dry-run)
    ↓
AL1D2 dry-run artifacts (writes_performed: false)
    ↓
explicit governed writer (this contract)
    ↓
source_aliases_v1.jsonl rows with status: candidate
    ↓
separate human approval → status: approved
    ↓
existing validate + apply + bundle publish
    ↓
searchable index
```

**Not authority:**

- CF2 / query logs
- blank worksheet decisions
- AL1D1 “accepted” without revalidation
- AL1D2 preview files alone
- `candidate` rows in the table (search metadata pending approval)

**Git reversibility:** any successful append is a normal tracked-file change; revert is `git revert` / checkout of the alias table.

## 6. Pure transformation layer contract

**Implement first (recommended as AL1D4).**

### Input

| Input | Required | Notes |
|-------|----------|-------|
| Current alias table | yes | Prefer **raw JSONL string** (or raw lines) to preserve bytes of existing rows |
| Candidate rows | yes | From AL1D1 accepted / AL1D2 `accepted_aliases_preview.jsonl` |
| Validation snapshots | yes | `known_ir_ids` + base `search_index` rows for revalidation |
| Options | yes | See §8 |
| Explicit timestamp | yes if provenance requires `reviewed_at` | No `Date.now` in pure layer |

### Behavior

1. Parse existing table fail-closed.
2. **Re-run** AL1D1-class validation against **current** snapshots (never trust stale dry-run alone).
3. Apply duplicate/conflict policy (§12).
4. If any selected row fails → **entire write fails**; return original content unchanged.
5. On success → return **new full JSONL string** = exact existing raw lines + appended candidate lines + final newline.
6. `writes_performed: false` always at pure layer.

### Output

Success:

```text
ok: true
updated_source_aliases_jsonl: string
appended_count
skipped_duplicate_count
appended_rows[]
skipped_rows[]
rejected_rows[] (empty on success path for selected set)
summary
writes_performed: false
```

Failure:

```text
ok: false
updated_source_aliases_jsonl: absent
errors[]
rejected_rows[]
writes_performed: false
```

No filesystem I/O in this layer.

## 7. Future CLI / file layer contract

**Not in AL1D3 / not first implementation.**

Future CLI may:

1. Read `source_aliases_v1.jsonl`, records, search index, AL1D2 package.
2. Call pure transformation.
3. Default `--dry-run` (print artifacts only).
4. Write file **only** with explicit `--write` after `ok: true`.
5. Set `writes_performed: true` only after successful filesystem replace (atomic write recommended: temp + rename).
6. Refuse write if working tree dirty for the alias file when policy requires (optional operator flag).

CLI must not approve, apply index, or publish bundles.

## 8. Input contract

### Preferred input

**AL1D2 dry-run package** (`accepted_aliases_preview.jsonl` + manifest), **plus mandatory revalidation** against current records/index and current `source_aliases_v1.jsonl`.

Acceptable equivalent: AL1D1 `AcceptedAliasPreviewRow[]` produced in-process immediately before write (still revalidated).

### Disallowed input

- Raw AL1C worksheet rows without AL1D1 validation
- Rejected / skipped AL1D2 rows
- Rows with `status: approved`
- EN / MNK / Russian / N’Ko aliases
- Content-gap / typo / ambiguous / already_searchable decisions

### Required options

| Option | Rule |
|--------|------|
| `expected_bundle_id` | Must match candidate `source_bundle_id` and pinned snapshot identity |
| `source_label` | Package / worksheet label for provenance (non-PII) |
| `reviewed_at` | Explicit ISO timestamp when writing reviewer provenance fields |
| `reviewed_by` / local reviewer label | Optional but recommended; no user-account id |
| `write_mode` | `all_or_nothing` only for v1 writer |
| `dry_run` | Pure layer always dry regarding FS; CLI defaults true |
| `allow_duplicate_same_target` | Default: **skip** exact duplicates (see §12) |

## 9. Output contract

### Pure layer

As §6. Always `writes_performed: false`.

### Written row shape

Must be valid `source_alias_table_v1` objects with:

- `status: "candidate"` **only**
- `direction: "source_to_target"`
- `schema_version: "source_alias_table_v1"`
- required fields per spec (`alias_id`, `alias_table_version`, `alias_source_term`, `canonical_source_terms`, `resolved_ir_ids`, `candidate_type`, `evidence_ir_ids`, `rationale`, `source_bundle_id`, `source_norm_version`)
- optional on candidates: `reviewer`, `reviewed_at` (allowed; required later for `approved`)

**Do not** add schema-incompatible required fields. Put AL1 provenance into `rationale` (and optional `reviewer`/`reviewed_at`). Do **not** rely on ad-hoc fields like `provenance_source` unless/until the shared spec is amended.

### Post-append validation

Before declaring success, the pure layer MUST validate the **entire** resulting table parse + shape rules (and IR existence for declared ids). Prefer also running the existing Python validator in a later integration slice (AL1D5-class); AL1D4 may mirror critical checks in TS and/or shell out in tests.

## 10. File formatting rules

| Rule | Contract |
|------|----------|
| Format | JSONL, one JSON object per non-empty line |
| Encoding | UTF-8 |
| Final newline | Required |
| Existing rows | **Preserve raw line bytes** when possible (parse for validation; serialize only new appends) |
| Append position | New candidate rows appended **after** all existing rows |
| Reordering existing file | **Forbidden** |
| Blank lines | Do not introduce; strip only if validating empty lines as skip (prefer reject malformed blanks if unexpected) |
| Comments | Forbidden |
| Field order on new rows | Stable insertion order matching existing table style where practical |

If a stringify round-trip would rewrite historical rows, the writer MUST keep original raw lines and only concatenate new lines.

## 11. Validation / failure model

**All-or-nothing.** If any selected candidate fails after revalidation, write nothing.

Abort entire operation when:

- target content missing / empty when expected present (policy: empty table allowed only if explicitly opted in)
- target malformed JSONL
- existing table fails validation
- any selected candidate fails AL1D1 eligibility / IR / index / language checks
- `expected_bundle_id` mismatch
- unsupported language / Russian / N’Ko
- missing IR
- alias conflict with **different** `resolved_ir_ids` (existing candidate/approved/deferred)
- unsafe primary/`src_*` key conflict with different postings
- row attempts `status: approved` (or any non-`candidate`)
- required timestamp/reviewer missing when options demand them
- duplicate `alias_id` in input or against existing table
- output table fails validation after simulated append
- formatting would corrupt existing raw lines

On abort: return failure object; original content conceptually unchanged.

## 12. Duplicate / conflict policy

| Case | Policy |
|------|--------|
| Same `alias_source_term` (casefold) + **identical ordered** `resolved_ir_ids` already in table | **Skip** as duplicate; report; does not fail batch |
| Same alias + **different** `resolved_ir_ids` (any existing status) | **Fail entire write** |
| Same candidate repeated in input with identical postings | Deduplicate input → single append or skip; do not double-append |
| Same candidate repeated in input with conflicting postings | **Fail entire write** |
| Alias-derived `src_*` key exists with identical postings | Allow append of candidate row (table audit) **or** skip as `identical_index_postings` — **recommend skip** to avoid redundant candidates |
| Alias-derived `src_*` key exists with different postings | **Fail entire write** |
| Existing `rejected` row same alias different target | **Fail entire write** (human must resolve; do not silently revive) |
| Existing `rejected` row same alias same target | **Skip** (already decided) or require explicit supersede flag (default: skip) |

Default: **no silent overwrite** of any existing row.

## 13. Status / approval semantics

| Stage | Meaning |
|-------|---------|
| AL1D1 accepted | Dry-run eligible preview |
| AL1D2 artifact | Reviewable dry-run package |
| Writer append `candidate` | Tracked reviewed-config **proposal** in Git |
| Human sets `approved` | Separate governed edit / future approval slice |
| validate + apply + publish | Searchable |

**Writer must not approve.**

**Writer must not apply search index.**

**Writer must not publish bundles.**

Live table today lacks `candidate` rows; introducing them is intentional and search-safe because apply ignores non-approved statuses.

## 14. Content-gap boundary

Writer must not append rows derived from:

- `content_gap` / `possible_content_gap`
- supplement / new IR workflows
- `ambiguous`, `typo_or_noise`, `already_searchable`
- phrase-only expectations

Those remain outside `source_aliases_v1.jsonl`.

## 15. Provenance model

Minimum provenance encoded on each appended candidate (via `rationale` + optional reviewer fields):

- `source_label` (AL1D2 package / worksheet id)
- evidence query string(s) when available
- reviewer decision (`approve_alias`)
- reviewer notes (human-authored only)
- `reviewed_by` local label (optional)
- `reviewed_at` explicit caller timestamp
- `source_bundle_id` + `source_norm_version`
- `canonical_source_terms` + `resolved_ir_ids`
- statement that row originated from governed worksheet import and remains `candidate`

No user / device / session identifiers.

## 16. Privacy / data minimization

- Query-level evidence only
- No user IDs, device IDs, session IDs
- No raw query-log dumps
- Reviewer label optional/local
- Source package label allowed

## 17. Recommended next slice

```text
AL1D4 — Pure Governed Alias Source Append Function
```

Scope:

- Pure TS (or shared) transformation implementing §6–§12
- Inputs: raw alias JSONL + AL1D1/AL1D2 accepted candidates + snapshots + explicit options/timestamp
- Outputs: success/failure object with updated JSONL string **only on success**
- Tests: all-or-nothing, preserve existing bytes, candidate-only status, duplicate skip, conflict fail, no FS writes
- **No CLI write** yet

Later:

| Slice | Intent |
|-------|--------|
| AL1D5 | CLI/file layer with `--dry-run` default and explicit `--write` |
| AL1D6 | Hook post-append validation to Python `validate_alias_table` |
| AL1E | Approval / publish semantics (candidate → approved) — separate program |

## 18. Non-goals

- Implementing writer/CLI in AL1D3
- Auto-approval or auto-apply
- Runtime search / UI / schema changes
- EN/MNK/Russian/N’Ko alias writes
- Partial batch appends
- Rewriting historical alias rows
- Treating dry-run acceptance as dictionary truth

## 19. Risks

| Risk | Rating | Mitigation |
|------|--------|------------|
| Treating writer append as searchable | High | `candidate` only; apply ignores non-approved |
| Trusting stale AL1D2 JSONL | High | Mandatory revalidation at write time |
| Round-trip corrupting historical rows | High | Preserve raw lines; append only |
| Silent duplicate / conflicting appends | High | Skip exact dupes; fail on conflicts |
| Premature CLI write | Medium | AL1D4 pure-only before CLI |
| Provenance schema drift | Medium | Prefer `rationale` + existing fields |

## 20. Test plan for next implementation slice (AL1D4)

1. Success: append one FR candidate; existing raw lines byte-identical prefix; final newline; `status: candidate`.
2. Failure: one bad row in batch → `ok: false`; no updated content.
3. Exact duplicate → skip; other valid rows still append (or define: skips do not count as failures).
4. Conflicting duplicate → fail entire batch.
5. `status: approved` in input → fail.
6. EN/MNK/RU/N’Ko → fail.
7. Missing IR / index conflict → fail.
8. Bundle id mismatch → fail.
9. Deterministic output given explicit timestamp; no clock reads.
10. Pure function performs zero filesystem writes (spy/mock).
11. Existing AL1D1/AL1D2 tests remain green.

## 21. Files changed

```text
docs/reports/al1d3_governed_alias_writer_contract.md
```

## 22. git diff --check

```text
PASS
```

(report-only)

## 23. Working tree

Expected uncommitted:

```text
?? docs/reports/al1d3_governed_alias_writer_contract.md
?? web/scripts/
```

Commit not created.
