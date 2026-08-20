# AL1D4 — Pure Governed Alias Source Append Function

## 1. Decision

```text
AL1D4_PURE_GOVERNED_ALIAS_APPEND_IMPLEMENTED
```

Pure transform only. May return an updated JSONL string. Does not write,
approve, apply, or publish.

## 2. Base commit

```text
761132dec6bf930ff7801716071cddbaacc9772b
```

`git log -1`: `761132d Define governed alias writer contract`.

## 3. Function shape

Module: `web/src/aliases/governed_alias_append.ts`

```text
buildGovernedAliasAppend({
  existing_source_aliases_jsonl,
  accepted_candidates,
  known_ir_ids,
  index_rows,
  options: { expected_bundle_id, source_label, reviewed_by?, reviewed_at? }
})
```

Success: `ok: true`, `updated_source_aliases_jsonl`, appended/skipped, `writes_performed: false`

Failure: `ok: false`, no updated JSONL, errors/rejected, `writes_performed: false`

## 4. Parse / validation behavior

- Split raw lines; reject internal blank lines / malformed JSON
- Validate existing `source_alias_table_v1` shape
- Preserve existing raw lines exactly; append after them; final newline
- Require known IRs for existing resolved ids when snapshots provided

## 5. Revalidation behavior

Candidates are converted to AL1D1 decision rows and revalidated via
`validateReviewedAliasImportDryRun` against current snapshots + existing alias
table. Stale previews are not trusted blindly.

## 6. Duplicate / conflict policy

| Case | Result |
|------|--------|
| Exact same alias+postings in table | skip |
| Same alias+different postings | fail batch |
| Exact duplicate in input | skip extras; keep first |
| Conflicting duplicate in input | fail batch |
| Index key conflict (different postings) | fail batch |

## 7. All-or-nothing

Any fatal error → `ok: false`, no updated content. Exact-duplicate skips are
non-fatal.

## 8. Output format

New rows: stable field order, `status: "candidate"` only, no
`provenance_source` / `reviewer` / `reviewed_at` fields on the written object
(reviewer metadata stays in `report` + `rationale` text).

## 9. Status semantics

Appended rows are **candidate** proposals only — not approved, not searchable.

## 10. Provenance / privacy

`source_label`, optional `reviewed_by`/`reviewed_at` in result `report` and
encoded into `rationale`. No user/device/session ids.

## 11. Authority boundary

PASS — pure string transform; no FS; no approve/apply/publish.

## 12. Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run -- src/aliases/` | **44 passed** |
| `npm --prefix web run test:run` | **1094 passed** (112 files) |
| `npm --prefix web run build` | **PASS** (`tsc` + vite) |
| `git diff --check` | **PASS** |

## 13. Files changed

Added:

```text
web/src/aliases/governed_alias_append.ts
web/src/aliases/governed_alias_append.test.ts
docs/reports/al1d4_pure_governed_alias_append_report.md
```

## 14. Working tree

```text
?? web/src/aliases/governed_alias_append.ts
?? web/src/aliases/governed_alias_append.test.ts
?? docs/reports/al1d4_pure_governed_alias_append_report.md
?? web/scripts/
```

Commit not created.

## 15. Recommended next slice

```text
AL1D5 — Governed Alias Append CLI Dry-Run
```

CLI that reads files, calls `buildGovernedAliasAppend`, prints AL1D2-style
artifacts / updated JSONL preview; `--write` remains a later explicit step.
