# AL1D1 — Reviewed Alias Import Parser / Validator

## 1. Decision

```text
AL1D1_REVIEWED_ALIAS_IMPORT_VALIDATOR_IMPLEMENTED
```

Dry-run only. Parses Layer B reviewed-decision rows, validates against AL1D +
`source_alias_table_v1`, emits accepted candidate previews / rejects / skips.

Never writes `source_aliases_v1.jsonl`, records, search index, or runtime search.

## 2. Base commit

```text
8693d489f5e4e55f838eecb4d4aa02a209add53d
```

`git log -1`: `8693d48 Define reviewed alias import contract`.

## 3. Implementation

Module: `web/src/aliases/reviewed_alias_import.ts`

| API | Role |
|-----|------|
| `parseReviewedAliasDecisionCsv` | Layer B CSV → rows |
| `parseReviewedAliasDecisionJsonl` | Layer B JSONL → rows |
| `validateReviewedAliasImportDryRun` | Accept / reject / skip |
| `emitAcceptedAliasesPreviewJsonl` | `accepted_aliases_preview.jsonl` shape |
| `emitRejectedAliasRowsJsonl` | `rejected_alias_rows.jsonl` shape |
| `emitReviewedAliasImportSummaryMarkdown` | Summary worksheet |

Accepted previews are **`source_alias_table_v1` rows with `status: "candidate"`**
only (`provenance_source: worksheet_manual`).

## 4. Behavior summary

| Outcome | When |
|---------|------|
| **accepted** | `possible_alias` + `approve_alias` + FR + full mapping + IR/index checks |
| **skipped** | blank decision; non-import decisions; identical existing alias/index |
| **rejected** | unknown decision; EN/MNK/RU/N’Ko; missing fields; IR miss; conflicts; `status: approved` |

FR-only enforced. Russian/N’Ko rejected by lang and script. EN/MNK rejected.
`writes_performed` always `false`.

## 5. Authority boundary

PASS — dry-run evidence/preview only; no dictionary truth; no approve/apply.

## 6. Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run -- src/aliases/` | **32 passed** |
| `npm --prefix web run test:run` | **1082 passed** (110 files) |
| `npm --prefix web run build` | **PASS** (`tsc` + vite) |
| `git diff --check` | **PASS** |

## 7. Files changed

Added:

```text
web/src/aliases/reviewed_alias_import.ts
web/src/aliases/reviewed_alias_import.test.ts
docs/reports/al1d1_reviewed_alias_import_validator_report.md
```

Modified: none.

## 8. Working tree

```text
?? web/src/aliases/reviewed_alias_import.ts
?? web/src/aliases/reviewed_alias_import.test.ts
?? docs/reports/al1d1_reviewed_alias_import_validator_report.md
?? web/scripts/
```

Commit not created.

## 9. Recommended next

```text
AL1D2 — Worksheet→source_aliases converter (candidate append)
```

Still no auto-approve; optional governed append of dry-run-accepted `candidate`
rows after explicit operator confirmation.
