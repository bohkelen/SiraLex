# AL1C — Reviewer Worksheet Export

## 1. Decision

```text
AL1C_REVIEWER_WORKSHEET_EXPORT_IMPLEMENTED
```

Deterministic offline CSV / JSONL / Markdown worksheet exports from AL1B
candidate evidence. Review artifacts only.

Invariant:

```text
AL1C exports reviewer worksheets.
It does not approve aliases or mutate dictionary truth.
```

## 2. Base commit

```text
82111c4cb19532cd80e94cd183457491f9a21630
```

`git log -1`: `82111c4 Add alias content gap evidence report`.

## 3. Export formats

| Format | Recommended filename | Function |
|--------|----------------------|----------|
| CSV | `alias_content_gap_candidates.csv` | `exportAliasCandidateCsv` |
| JSONL | `alias_content_gap_candidates.jsonl` | `exportAliasCandidateJsonl` |
| Markdown | `alias_content_gap_candidates.md` | `exportAliasCandidateMarkdown` |

Module: `web/src/aliases/alias_candidate_exports.ts`

Schema id: `alias_content_gap_reviewer_worksheet_v1`

AL1B’s earlier serializers remain as evidence-report helpers. AL1C is the
**reviewer worksheet** contract (blank `reviewer_decision` / `reviewer_notes`,
privacy-minimized columns).

## 4. Column / schema definitions

CSV header (always present):

```text
query_raw,normalized_query,lookup_mode,evidence_sources,evidence_count,last_seen,current_search_status,prefix_suggestions,nearby_keys,candidate_category,recommended_human_action,reviewer_decision,reviewer_notes
```

| Field | Source (AL1B) | Notes |
|-------|---------------|-------|
| `query_raw` | `query_raw` | |
| `normalized_query` | `normalized_query` | |
| `lookup_mode` | `lookup_mode` | `fr->mnk` string |
| `evidence_sources` | `evidence_source` | |
| `evidence_count` | `occurrence_count` | |
| `last_seen` | `last_seen` | |
| `current_search_status` | `current_search_status` | |
| `prefix_suggestions` | `prefix_suggestions` | CSV: join with `; `; JSONL: array |
| `nearby_keys` | `closest_exact_or_prefix_keys` | same |
| `candidate_category` | `candidate_category` | |
| `recommended_human_action` | `recommended_human_action` | |
| `reviewer_decision` | _(new blank)_ | always `""` |
| `reviewer_notes` | forced blank | always `""` |

**Not exported:** `bundle_id`, `content_sha256`, `classification_reason`,
`matched_key`, `separator_variant_query`, `review_status`, session/device ids.

## 5. Ordering rule

Exports sort a **copy** of candidates (never mutate input):

1. category priority: `possible_alias` → `possible_content_gap` → `ambiguous` →
   `already_searchable` → `likely_typo_or_noise`
2. `evidence_count` descending
3. `normalized_query` ascending
4. `lookup_mode` ascending
5. `query_raw` ascending

No local-clock sorting. Markdown `generated_at` is optional and caller-supplied.

## 6. Authority boundary

| Action | AL1C |
|--------|------|
| Approve aliases | **No** |
| Write `source_aliases_v1.jsonl` / supplements | **No** |
| Mutate records / search index | **No** |
| Runtime search / UI / schema changes | **No** |
| Default `reviewer_decision` | always blank |

PASS.

## 7. Privacy / data minimization

PASS — worksheet fields only; no user/device/session identifiers; AL1B extra
metadata stripped by `toAliasReviewerWorksheetRow`.

## 8. Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run -- src/aliases/` | **23 passed** (AL1B 16 + AL1C 7) |
| `npm --prefix web run test:run` | **1073 passed** (109 files) |
| `npm --prefix web run build` | **PASS** (`tsc` + vite) |
| `git diff --check` | **PASS** |

## 9. Files changed

Added:

```text
web/src/aliases/alias_candidate_exports.ts
web/src/aliases/alias_candidate_exports.test.ts
docs/reports/al1c_reviewer_worksheet_export_report.md
```

Modified: none.

## 10. Working tree

Expected uncommitted:

```text
?? web/src/aliases/alias_candidate_exports.ts
?? web/src/aliases/alias_candidate_exports.test.ts
?? docs/reports/al1c_reviewer_worksheet_export_report.md
?? web/scripts/
```

Commit not created.

## 11. Known limitations

- Pure string exporters only; no browser download wiring / CLI file write.
- Live CF2/query-log stores still supplied by callers as AL1B events.
- `reviewer_decision` vocabulary is intentionally unconstrained blank text for
  humans (not an enum in AL1C).

## 12. Recommended next slice

```text
AL1D — Reviewed Alias Import Contract
```

Define how a **human-completed** worksheet (or equivalent) becomes validated
`status: candidate` rows for `source_aliases_v1.jsonl` / supplements — still
without auto-approval or index apply.
