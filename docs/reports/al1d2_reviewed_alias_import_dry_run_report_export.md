# AL1D2 — Reviewed Alias Import Dry-Run Report Export

## 1. Decision

```text
AL1D2_REVIEWED_ALIAS_IMPORT_DRY_RUN_REPORT_EXPORT_IMPLEMENTED
```

Deterministic multi-artifact dry-run report packaging for AL1D1 results.
Still no write to `source_aliases_v1.jsonl`. Still no approval.

## 2. Base commit

```text
5293096f2e2d9440a125f6cb5fc541a7ac0603ec
```

`git log -1`: `5293096 Add reviewed alias import validator`.

## 3. Implementation

Module: `web/src/aliases/reviewed_alias_import_dry_run_exports.ts`

| Artifact | Recommended filename | Content |
|----------|----------------------|---------|
| Accepted preview | `accepted_aliases_preview.jsonl` | `source_alias_table_v1` candidates (`status: candidate`) |
| Rejected rows | `rejected_alias_rows.jsonl` | Privacy-minimized decision + reason |
| Skipped rows | `skipped_alias_rows.jsonl` | Privacy-minimized decision + reason |
| Summary | `import_summary.md` | Counts, artifact list, authority warning |
| Manifest | `import_dry_run_manifest.json` | Filenames + summary + `writes_performed: false` |

Primary API: `buildReviewedAliasImportDryRunReport(al1d1Result, { generated_at? })`.

## 4. Ordering

Exports sort copies (never mutate AL1D1 result):

- accepted: `alias_source_term` → `alias_id`
- rejected / skipped: `reason` → `row_index` → `detail`

## 5. Authority boundary

PASS — dry-run report only; accepted rows remain `candidate`; no dictionary mutation.

## 6. Privacy

Reject/skip artifacts use `toDecisionExportSnapshot` (query-level fields only).
Stray `user_id` / `session_*` fields are not exported.

## 7. Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run -- src/aliases/` | **36 passed** |
| `npm --prefix web run test:run` | **1086 passed** (111 files) |
| `npm --prefix web run build` | **PASS** (`tsc` + vite) |
| `git diff --check` | **PASS** |

## 8. Files changed

Added:

```text
web/src/aliases/reviewed_alias_import_dry_run_exports.ts
web/src/aliases/reviewed_alias_import_dry_run_exports.test.ts
docs/reports/al1d2_reviewed_alias_import_dry_run_report_export.md
```

Modified: none.

## 9. Working tree

```text
?? web/src/aliases/reviewed_alias_import_dry_run_exports.ts
?? web/src/aliases/reviewed_alias_import_dry_run_exports.test.ts
?? docs/reports/al1d2_reviewed_alias_import_dry_run_report_export.md
?? web/scripts/
```

Commit not created.

## 10. Recommended next

```text
AL1D3 — Governed candidate append (optional writer)
```

Only after operators can inspect AL1D2 artifacts. Writer must remain
all-or-nothing, `status: candidate` only, and never auto-approve.
