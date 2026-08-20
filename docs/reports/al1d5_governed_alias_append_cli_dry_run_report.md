# AL1D5 — Governed Alias Append CLI Dry-Run

## 1. Decision

```text
AL1D5_GOVERNED_ALIAS_APPEND_CLI_DRY_RUN_IMPLEMENTED
```

Dry-run file wrapper only. Reads inputs, calls AL1D4, writes preview
artifacts under `--out-dir`. Does not mutate `source_aliases_v1.jsonl`,
approve, apply, or publish.

## 2. Base commit

```text
cba32ce2c4f8e3fefefdcfb511208294ff390c39
```

`git log -1`: `cba32ce Add pure governed alias append`.

## 3. CLI location

Tracked TypeScript tooling (not untracked `web/scripts/`):

| Role | Path |
|------|------|
| Orchestration + argv parse + `main` | `web/src/aliases/governed_alias_append_cli_dry_run.ts` |
| Process entry (Vite SSR loader) | `web/tools/governed_alias_append_dry_run_cli.mjs` |
| npm script | `web/package.json` → `alias:append-dry-run` |

```bash
cd web && npm run alias:append-dry-run -- \
  --source-aliases <path> \
  --accepted-candidates <path> \
  --out-dir <path> \
  --expected-bundle-id <bundle_id> \
  --primary-keys <path> \
  --dictionary-ir-ids <path> \
  [--source-label <label>] \
  [--reviewed-by <label>] \
  [--reviewed-at <iso>] \
  [--generated-at <iso>]
```

`web/scripts/` remains unrelated local tooling and was not staged.

## 4. Input flags

Required:

- `--source-aliases` — current `source_aliases_v1.jsonl`
- `--accepted-candidates` — AL1D2 `accepted_aliases_preview.jsonl`
- `--out-dir` — dry-run artifact directory
- `--expected-bundle-id` — bundle pin for AL1D4 revalidation
- `--primary-keys` — search-index-shaped JSONL `{key_type,key,ir_ids}`
- `--dictionary-ir-ids` — IR snapshot: records JSONL (`ir_id`), bare ids, or JSON string array

Optional:

- `--source-label` (default `al1d2_accepted_preview`)
- `--reviewed-by`, `--reviewed-at` (passed to AL1D4 when set)
- `--generated-at` (manifest/summary only; tests pass fixed value)

## 5. Output artifacts

Under `--out-dir` only:

| File | When |
|------|------|
| `append_manifest.json` | always (on successful path safety + writes) |
| `append_summary.md` | always (includes authority warning) |
| `append_preview_source_aliases_v1.jsonl` | only when AL1D4 `ok: true` |
| `append_rejected_rows.jsonl` | when rejected rows or errors exist |
| `append_skipped_rows.jsonl` | when skips exist |

No output is named exactly `source_aliases_v1.jsonl`.

Manifest always has `writes_performed: false`.

## 6. Dry-run authority boundary

Every human-facing summary includes:

> Dry-run only. No reviewed alias source file was modified. Preview rows remain candidates and are not searchable until validated, written through a governed write, built into a bundle, and published.

Language used: accepted by dry-run / appended preview / candidate / skipped / rejected. No “approved aliases” emit path.

## 7. Dangerous path protections

`assertSafeDryRunOutputPaths` refuses:

- source path equals accepted path
- `out-dir` equals the source file path
- any output basename exactly `source_aliases_v1.jsonl`
- output path that would overwrite the source file
- same-directory outputs whose basename matches the live source basename
- `..` / escape filenames

## 8. Validation / revalidation behavior

CLI parses accepted preview fail-closed, loads snapshots, then calls
`buildGovernedAliasAppend` (AL1D4): revalidates candidates, all-or-nothing,
preserves existing raw lines, appends `status: candidate` only.

## 9. Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run -- src/aliases/governed_alias_append_cli_dry_run.test.ts` | **10 passed** |
| `npm --prefix web run test:run` | **1104 passed** (113 files) |
| `npm --prefix web run build` | **PASS** (`tsc` + vite) |
| `git diff --check` | **PASS** |

Coverage includes: read inputs, write artifacts, `writes_performed: false`,
safe preview name, source unchanged, no preview on reject, rejected/skipped
export, path refusals, candidate-only status, no runtime probe mutation,
determinism with fixed timestamp, empty accepted, malformed fail-closed.

## 10. Files changed

Added:

```text
web/src/aliases/governed_alias_append_cli_dry_run.ts
web/src/aliases/governed_alias_append_cli_dry_run.test.ts
web/tools/governed_alias_append_dry_run_cli.mjs
docs/reports/al1d5_governed_alias_append_cli_dry_run_report.md
```

Modified:

```text
web/package.json
```

## 11. Working tree

Unrelated untracked `web/scripts/` left untouched.

Commit: **NOT CREATED**.

## 12. Recommended next slice

```text
AL1D6 — Governed Alias Append CLI Write Contract
```

Next step after a reviewed dry-run package is a **write contract** (still gated),
not approval/publish. AL1E remains after write boundary is explicit.
