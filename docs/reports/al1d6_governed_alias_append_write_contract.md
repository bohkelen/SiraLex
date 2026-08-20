# AL1D6 — Governed Alias Append CLI Write Contract

## 1. Decision

```text
AL1D6_GOVERNED_ALIAS_APPEND_WRITE_CONTRACT_DEFINED
```

Contract/design only. No write mode, filesystem mutation of
`source_aliases_v1.jsonl`, `--write` CLI, approval, apply, build, publish,
runtime search, UI, schema, dictionary/corpus/index, or CF2 change in this
slice.

Core principle:

```text
Write mode is not approval.
Writing candidate rows to source_aliases_v1.jsonl still does not make aliases
searchable until the existing validation/build/publish pipeline accepts them.
```

Authority flow:

```text
dry-run accepted candidate
    ↓
explicit write command + --write
    ↓
source_aliases_v1 candidate row
    ↓
source artifact validation
    ↓
separate approval/apply/build/publish
    ↓
searchable alias
```

## 2. Base commit

```text
5ea3d122d5759397cadef8a86099c2dc341e50a0
```

`git log -1`: `5ea3d12 Add governed alias append dry-run CLI`.

Working tree at contract drafting (unrelated local tooling only):

```text
?? web/scripts/
```

## 3. Files inspected

| Path | Role |
|------|------|
| `docs/reports/al1d3_governed_alias_writer_contract.md` | First-writer authority, append-as-candidate, Git-reversible |
| `docs/reports/al1d4_pure_governed_alias_append_report.md` | Pure all-or-nothing transform; no FS writes |
| `docs/reports/al1d5_governed_alias_append_cli_dry_run_report.md` | Dry-run CLI flags, artifacts, path safety |
| `docs/reports/al1d_reviewed_alias_import_contract.md` | Import authority + candidate-only import |
| `web/src/aliases/governed_alias_append.ts` | AL1D4: preserve raw lines; `status: candidate`; skip exact dupes |
| `web/src/aliases/governed_alias_append_cli_dry_run.ts` | AL1D5 dry-run orchestration; `writes_performed: false` |
| `web/tools/governed_alias_append_dry_run_cli.mjs` | Dry-run process entry |
| `web/package.json` | `alias:append-dry-run` only (no write script yet) |
| `shared/aliases/source_aliases_v1.jsonl` | Live table (24 rows; UTF-8 JSONL; final newline; statuses `approved`/`rejected`; single `alias_table_version=phase7a-round1`) |
| `shared/specs/source-alias-table-v1.md` | Schema; only `approved` affects index |
| `api/source_aliases/validate_alias_table.py` | Fail-closed table validation; allows `candidate`; rejects mixed `alias_table_version` |
| `api/source_aliases/apply_aliases_to_search_index.py` | Approved-only apply (must stay out of write mode) |
| `docs/reports/phase7n2a4c1r_fail_closed_overlay_report.md` | Repo precedent: temp sibling + `os.replace` atomic replace |

**Contract feasibility (no STOP):**

- AL1D5 dry-run contract is explicit: reads only; never mutates source; separate npm script.
- AL1D4 returns full updated JSONL on `ok: true` with existing raw-line preservation — sufficient for safe replace.
- Post-write validation can invoke Python `validate_alias_table.py` (plus TS re-parse).
- Formatting can be preserved by writing AL1D4’s full string (existing prefix bytes + appended lines + final newline).
- Write mode does **not** require approval semantics, build/publish, or runtime search changes.
- File safety can be defined (basename gate, path refusals, backup, atomic rename).

## 4. Write authority boundary

Write mode may:

1. Read the same inputs as AL1D5 dry-run (source aliases, accepted candidates, IR ids, primary keys / index snapshot).
2. Call AL1D4 `buildGovernedAliasAppend`.
3. Create a local backup of the current source file.
4. Replace `source_aliases_v1.jsonl` with AL1D4’s full updated JSONL **only** when all gates pass and `--write` is present.
5. Emit write manifests / row exports under `--out-dir`.
6. Re-validate the written file (TS + existing Python validator).

Write mode must **not**:

- Approve aliases (`status: approved`)
- Set `approved_at` / `applied_at` / `published_at` (or any searchability implication fields)
- Run apply / build / publish / bundle verify
- Mutate records, corpus, search index, supplements, or CF2/query logs
- Change runtime search behavior
- Treat dry-run “accepted” as searchable truth
- Mutate the source file without explicit `--write`

**Git reversibility:** a successful write is a normal tracked-file change under
`shared/aliases/source_aliases_v1.jsonl`. Operator recovery is `git checkout` /
`git restore` / `git revert`, plus the local `.bak.jsonl` copy.

## 5. Future command contract

Recommended npm script (AL1D7):

```bash
cd web && npm run alias:append-write -- \
  --source-aliases <path> \
  --accepted-candidates <path> \
  --out-dir <path> \
  --expected-bundle-id <bundle_id> \
  --primary-keys <path> \
  --dictionary-ir-ids <path> \
  --records <path> \
  --search-index <path> \
  --write \
  [--source-label <label>] \
  [--reviewed-by <label>] \
  [--reviewed-at <iso>] \
  [--backup-dir <path>] \
  [--generated-at <iso>] \
  [--allow-skip-exact-duplicates] \
  [--allow-test-source-basename]
```

Rules:

| Rule | Contract |
|------|----------|
| Explicit `--write` | **Required** for any mutation of the source aliases path |
| Command name alone | **Not** sufficient; `alias:append-write` without `--write` must refuse mutation (recommended: behave as dry-run / exit non-zero with clear error) |
| Interactive prompts | **Forbidden** for automation; flags only |
| Dry-run default | `alias:append-dry-run` remains the default operator path; write is opt-in |
| AL1D4 gate | If AL1D4 returns `ok: false`, write nothing to source |
| Candidate status only | New rows must be `status: "candidate"` |
| No apply/build/publish | Write CLI must not invoke those tools |

AL1D5 `alias:append-dry-run` remains unchanged and must keep `writes_performed: false`.

## 6. Required flags

### Required

| Flag | Purpose |
|------|---------|
| `--source-aliases` | Current `source_aliases_v1.jsonl` path |
| `--accepted-candidates` | AL1D2 `accepted_aliases_preview.jsonl` |
| `--expected-bundle-id` | Bundle pin for AL1D4 revalidation |
| `--dictionary-ir-ids` | IR id snapshot (same shapes as AL1D5) |
| `--primary-keys` | Search-index-shaped JSONL `{key_type,key,ir_ids}` |
| `--out-dir` | Write artifact directory (manifests, row exports; **not** the live source path) |
| `--records` | Bundle `records.jsonl` for post-write Python `validate_alias_table` |
| `--search-index` | Base `search_index.jsonl` for post-write Python validation |
| `--write` | Explicit mutation authorization |

### Optional

| Flag | Purpose |
|------|---------|
| `--source-label` | Provenance label (default may mirror AL1D5: `al1d2_accepted_preview`) |
| `--reviewed-by` | Local non-PII reviewer label → AL1D4 report / rationale |
| `--reviewed-at` | Explicit ISO timestamp → AL1D4 report / rationale |
| `--backup-dir` | Directory for `.bak.jsonl` (default: same directory as source, or under `--out-dir` — AL1D7 must pick one and document it; recommend **same directory as source** for Git-adjacent recovery, or `--out-dir` if source dir is read-only in tests) |
| `--generated-at` | Manifest/summary timestamp only (tests pass fixed value) |
| `--allow-skip-exact-duplicates` | Documents AL1D4 default: exact same-target duplicates are non-fatal skips. Presence may be required by policy docs; absence must **not** change AL1D4 skip-exact default in v1 |
| `--allow-test-source-basename` | Test-only: permit source basename ≠ `source_aliases_v1.jsonl` |

### Explicitly out of argv for write mode

- Any flag that sets `status: approved`
- Any apply / build / publish / bundle flag
- Implicit clocks for provenance when `--reviewed-at` is required by operator policy (AL1D4 already avoids clock reads for row fields)

## 7. File safety rules

Write mode must protect the real source artifact.

Ordered gates (fail closed; write nothing to source on failure):

1. **Resolve** `--source-aliases` to an absolute real path when possible.
2. **Basename gate:** refuse unless `basename(source) === "source_aliases_v1.jsonl"`, unless `--allow-test-source-basename` is set (tests only).
3. **Path identity refusals:**
   - source path ≠ accepted-candidates path
   - source path ≠ out-dir
   - source path ≠ any planned out-dir artifact path
   - out-dir must not be “inside” the source file path in a confused way (reuse/extend AL1D5 `assertSafeDryRunOutputPaths` ideas)
   - refuse if a planned preview/artifact basename is exactly `source_aliases_v1.jsonl` under `--out-dir` (artifacts must use write-specific names)
4. **Generated-output confusion:** refuse if source path resolves inside `--out-dir` in an unsafe/confused layout (source must remain the tracked shared alias file, not a generated copy treated as live).
5. **Read** current source bytes (UTF-8).
6. **Parse inputs** fail-closed (accepted candidates, IR ids, primary keys) — same as AL1D5.
7. **Run AL1D4** pure append.
8. If AL1D4 `ok: false` → write nothing to source; emit failure artifacts under `--out-dir` only.
9. **`alias_table_version` unity gate (required for Python validator):**
   - Existing table must have a single `alias_table_version` (or be empty).
   - Every appended row must use that same `alias_table_version`.
   - If candidates would introduce a second version → **fail closed before backup/replace**.
   - AL1D4 today copies candidate `alias_table_version` as-is; AL1D7 must enforce this gate in the write CLI (or a small pure helper) without silently rewriting historical rows.
10. **Pre-replace content validation:** parse AL1D4 `updated_source_aliases_jsonl` with the same TS table parse used by AL1D4; optionally dry-run Python validation against a temp copy **before** touching the live file (recommended).
11. If `appended_count === 0` (exact-duplicate no-op) → **do not replace** the live file; emit no-op / skip manifest with `writes_performed: false`.
12. **Backup** original bytes (see §8).
13. **Atomic replace** (see §9).
14. **Emit** write manifest + hashes + row exports.
15. **Post-write validation** (see §10).
16. **Never** partially append line-by-line to the live file; never open live file in append mode for candidate rows.

## 8. Backup / reversibility model

Write mode must be Git-reversible and locally recoverable.

### Required before live replace

- Create a backup copy of the **exact original bytes**, unless disabled only by an explicit **test-only** hook (not a production flag).
- Backup must not overwrite an existing file: if target backup path exists → fail closed; write nothing.
- Recommended name:

```text
source_aliases_v1.<timestamp>.bak.jsonl
```

Timestamp must be explicit when provided (`--generated-at` or a dedicated write timestamp), filesystem-safe (replace `:` as needed).

### Manifest must record

| Field | Required |
|-------|----------|
| `source_aliases_path` | yes |
| `backup_path` | yes (when a write replace occurred) |
| `original_sha256` | yes |
| `updated_sha256` | yes (of intended/written content) |
| `appended_count` | yes |
| `skipped_count` | yes |
| `rejected_count` | yes |
| `timestamp` / `generated_at` | yes |
| `source_label` | yes |
| `command` / `command_mode: "write"` | yes |
| `reviewed_by` / `reviewed_at` | when provided |

### Recovery order on failure after replace

1. Prefer automatic restore from backup if post-write validation fails and restore is safe (hash of current live file matches `updated_sha256` we just wrote; backup hash matches `original_sha256`).
2. If restore is unsafe/ambiguous → **STOP**, report critical failure, instruct manual restore from backup path and/or Git.
3. Never continue to build/publish.

## 9. Atomic write model

Preferred (matches repo precedent: temp sibling + replace):

1. Write full updated JSONL to a temp file in the **same directory** as the source
   (e.g. `source_aliases_v1.jsonl.tmp.<pid>.<random>`).
2. `fsync` the temp file if the platform/Node APIs used by AL1D7 support it practically; otherwise document best-effort close.
3. Atomically replace via `rename` / `fs.promises.rename` (POSIX same-filesystem rename is atomic).
4. On any failure before successful rename: delete temp if present; leave original unchanged.
5. Never stream-append into the live path.

**Cross-platform note:** Node `rename` over existing destination is supported on Linux (this project’s primary host). If a future Windows path cannot replace via rename, AL1D7 must use the safest available same-dir replace and still require backup-first; do not fall back to in-place append.

**No-op path:** skip temp/rename entirely when `appended_count === 0`.

## 10. Post-write validation model

After a successful rename, future implementation must re-read the live file and verify:

| Check | Rule |
|-------|------|
| Non-empty / non-truncated | File length > 0; ends with `\n`; parses as JSONL |
| SHA256 | Live file hash === manifest `updated_sha256` |
| TS parse | Entire table parses with AL1D4 existing-table rules |
| Python validation | `python -m` / direct invoke of `api/source_aliases/validate_alias_table.py` with `--aliases` (live path) `--records` `--search-index` exits 0 |
| Appended rows exist | Each intended new `alias_id` present |
| Status | Each newly appended row has `status: "candidate"` |
| No approval introduced by write | Set of `approved` `alias_id`s after write equals set before write (pre-existing approved rows may remain; write must add none) |
| Version unity | Single `alias_table_version` across file |

On post-write validation failure:

- Report **critical failure**
- Attempt safe backup restore (§8)
- Or STOP with manual restore instructions
- Exit non-zero
- **Never** proceed to apply/build/publish

## 11. Output artifacts

Under `--out-dir` (never using basename `source_aliases_v1.jsonl`):

| Artifact | When |
|----------|------|
| `append_write_manifest.json` | always after path-safety + attempt |
| `append_write_summary.md` | always |
| `append_written_rows.jsonl` | when rows were appended |
| `append_skipped_rows.jsonl` | when skips exist |
| `append_rejected_rows.jsonl` | when rejects/errors exist |
| `source_aliases_v1.<timestamp>.bak.jsonl` | backup location per `--backup-dir` / default policy (may live beside source rather than only under out-dir) |

### Manifest fields (minimum)

```text
writes_performed: true | false
source_aliases_path
backup_path | null
original_sha256
updated_sha256 | null when no replace
appended_count
skipped_count
rejected_count
expected_bundle_id
reviewed_by | null
reviewed_at | null
source_label
command_mode: "write"
post_write_validation: "pass" | "fail" | "skipped" (skipped only when no replace)
ok: boolean
```

`writes_performed: true` **only** after successful live-file replace.

### Human summary must include exactly this authority sentence

> Write mode appended candidate rows only. It did not approve aliases, apply aliases, rebuild the dictionary, or publish a searchable bundle.

## 12. Status / approval boundary

Hard rule:

Future write mode may write only:

```text
status: candidate
```

It must reject inputs / transforms that would write:

- `status: approved`
- `approved_at`
- `applied_at`
- `published_at`
- anything implying searchability

unless those fields already exist on **pre-existing** preserved raw lines (write must not rewrite or “upgrade” them).

AL1D4 already omits reviewer schema fields on new objects and forces `status: "candidate"`. Write mode inherits that and must not reintroduce approval fields.

**Approval performed:** NO  
**Build/publish performed:** NO  
**Searchable after write alone:** NO

## 13. All-or-nothing failure model

Write nothing to the live source file if any of:

- selected candidate invalid / AL1D1 revalidation rejects
- AL1D4 returns `ok: false`
- bundle mismatch
- source file invalid / unreadable
- alias conflict (same alias, different target)
- primary-key / index posting conflict
- `alias_id` conflict
- `alias_table_version` would become mixed
- backup cannot be created (including collision with existing backup path)
- temp write fails
- rename fails
- post-write validation fails (then restore or critical STOP)
- required flags missing / `--write` absent
- dangerous path / basename refusal

Exact duplicate same target may be skipped if AL1D4 classifies it as non-fatal (`exact_duplicate_existing`, `exact_duplicate_input`, `identical_index_postings`). If the batch reduces to zero appends → success/no-op without live mutation.

## 14. Privacy / data minimization

Inherited from AL1D3–AL1D5:

- Query-level evidence / rationale only
- No user IDs, device IDs, session IDs
- No raw query-log dumps in write artifacts
- `reviewed_by` is an optional local label only
- `source_label` is a package/worksheet label only

## 15. Test plan for future implementation (AL1D7)

Required tests:

1. Dry-run remains default (`alias:append-dry-run` unchanged; write script without `--write` does not mutate).
2. `--write` required for mutation.
3. Valid write creates backup.
4. Valid write replaces source file with updated JSONL (existing prefix preserved).
5. Appended rows have `status: candidate`.
6. No approved rows written by the command.
7. Write manifest has `writes_performed: true` after real replace.
8. Original and updated SHA256 recorded.
9. Post-write validation passes (TS + Python validator).
10. Invalid candidate writes nothing (source bytes unchanged).
11. Invalid source writes nothing.
12. Backup failure writes nothing.
13. Duplicate different target writes nothing.
14. Exact duplicate same target skips without mutation **or** emits no-op manifest with `writes_performed: false`.
15. Source file unchanged on any failure before rename.
16. Dangerous output/source path rejected.
17. Temp write failure leaves original unchanged.
18. Post-write validation failure restores backup or reports critical failure (and does not claim success).
19. No build/publish command runs (spy/assert no subprocess to apply/bundle tools).
20. Dictionary/corpus/index files unchanged.
21. Runtime search unchanged (no runtime module writes).
22. Deterministic with explicit timestamp (`--generated-at` / `--reviewed-at`).
23. Basename gate refuses non-`source_aliases_v1.jsonl` without test flag.
24. Mixed `alias_table_version` would-be append fails closed before replace.
25. Pre-existing approved rows remain byte-identical in the file prefix.

## 16. Recommended next slice

```text
AL1D7 — Governed Alias Append CLI Write Implementation
```

**Operator pause (recommended before coding AL1D7):**

Stop and run the AL1D5 dry-run pipeline on real reviewed candidate evidence
(`accepted_aliases_preview.jsonl` + pinned bundle snapshots) and human-review
the preview package **before** implementing write mode, if no reviewed worksheet
/ dry-run artifact set exists yet. Write mode should land against known-good
inputs, not speculative ones.

AL1E (approval / publish semantics) remains a **separate** program after write
exists and remains candidate-only.

## 17. Non-goals (this slice)

- Implementing write mode / `--write`
- Mutating `shared/aliases/source_aliases_v1.jsonl`
- Approval, apply, build, publish
- Runtime search / UI / schema changes
- Dictionary / corpus / index / CF2 mutation
- Changing AL1D4/AL1D5 behavior beyond documentation references
- Softening all-or-nothing or candidate-only rules

## 18. Risks

| Risk | Rating | Mitigation |
|------|--------|------------|
| Treating write as approval/searchable | High | Candidate-only; summary authority sentence; no apply/publish hooks |
| Stale accepted preview | High | Mandatory AL1D4 revalidation at write time |
| Mixed `alias_table_version` fails Python validator | High | Explicit unity gate before replace |
| Partial/corrupt live file | High | Backup + same-dir temp + rename; no line-by-line append |
| Accidental overwrite via out-dir confusion | High | Path safety gates; forbid live basename in out-dir artifacts |
| No-op still rewriting file / dirtying Git | Medium | Skip replace when `appended_count === 0` |
| Implementing write without real dry-run evidence | Medium | Recommended pause before AL1D7 |

## 19. Files changed

Added:

```text
docs/reports/al1d6_governed_alias_append_write_contract.md
```

Modified:

```text
(none)
```

## 20. git diff --check

```text
PASS
```

(report-only; no unit/build required)

## 21. Working tree

Expected uncommitted after this slice:

```text
?? docs/reports/al1d6_governed_alias_append_write_contract.md
?? web/scripts/
```

Commit: **NOT CREATED**.
