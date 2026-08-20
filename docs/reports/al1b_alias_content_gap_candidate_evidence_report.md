# AL1B — Alias / Content-Gap Candidate Evidence Report

## 1. Decision

```text
AL1B_ALIAS_CONTENT_GAP_CANDIDATE_REPORT_IMPLEMENTED
```

Offline reviewer evidence only. No alias approval. No dictionary/corpus/index
mutation. No runtime search, UI, CF2 schema, or query-log schema changes.

Invariant:

```text
AL1B produces reviewer evidence.
It does not produce dictionary truth.
```

## 2. Base commit

```text
a7c7f81a5e751b3db5a0534e6193f3e82effb03c
```

`git log -1`: `a7c7f81 Audit alias and content gap workflow` (AL1A accepted).

## 3. Evidence sources inspected

| Source | Role in AL1B |
|--------|----------------|
| CF2 V2 drafts (`search_failure_feedback_draft_v2`) | Ingest via `evidenceEventsFromCf2Drafts` |
| Query-log V3 miss rows | Ingest via `evidenceEventsFromQueryLogs` |
| In-memory search-index snapshot rows | Replay exact / SQ1 variants / SQ1B prefix |
| Reviewed alias table snapshot (read-only) | Pending `alias_source_term` signal only |
| AL1A / SQ1 closure reports | Authority + category design |
| `api/query_evidence` (Python) | Prior art for candidate-only labeling; not required at runtime |

**Limitation:** Live IndexedDB CF2/query-log stores are not read in AL1B. Callers
supply events (exports or fixtures) plus an index snapshot. Tests use fixtures.

## 4. Candidate categories

| Category | Meaning | Recommended action |
|----------|---------|--------------------|
| `already_searchable` | Exact, SQ1 variant, or prefix suggestions hit | `already_fixed_by_search` |
| `possible_alias` | Miss with plural-ish singular key or pending alias-table row | `review_alias` |
| `possible_content_gap` | Meaningful FR single-token miss, no safe alias heuristic | `review_content_gap` |
| `likely_typo_or_noise` | Empty / too short / non-linguistic | `ignore_noise` |
| `ambiguous` | Multi-token, CF2 `results_not_useful`, non-FR miss, etc. | `needs_more_context` |

Every row keeps `review_status: "candidate"` and blank `reviewer_notes`.

## 5. Classification rules

Conservative order:

1. Noise gate (`likely_typo_or_noise`).
2. CF2 `results_not_useful` → `ambiguous` (not treated as a miss).
3. Replay against snapshot: exact → `safeQueryVariants` → prefix suggestions →
   `already_searchable` when any stage hits.
4. Else pending reviewed alias-table match (non-rejected) → `possible_alias`.
5. Else plural-ish (`len>3` and ends with `s`) with indexed singular casefold →
   `possible_alias` (heuristic; explicitly not approved).
6. Else multi-token → `ambiguous`.
7. Else FR single-token meaningful miss → `possible_content_gap`.
8. Else → `ambiguous`.

No fuzzy, AI, morphology engine, or automatic promotion.

## 6. Output format

Module: `web/src/aliases/alias_candidate_evidence.ts`

| Output | Function | Use |
|--------|----------|-----|
| Structured report | `buildAliasCandidateReport` | Primary |
| Markdown worksheet | `aliasCandidateReportToMarkdown` | Fixtures/tests / local reviewer file |
| JSONL (future export shape) | `aliasCandidateReportToJsonl` | Defined now; header + one JSON object per candidate |
| CSV worksheet (future export shape) | `aliasCandidateReportToCsv` | Stable columns including blank `reviewer_notes` |

Authority label on every report:

```text
unreviewed_alias_content_gap_evidence_must_not_be_treated_as_dictionary_truth
```

Deterministic sort: category priority → frequency desc → normalized query →
lookup mode → bundle_id.

## 7. Authority boundary

| Action | AL1B |
|--------|------|
| Approve aliases | **No** |
| Edit `source_aliases_v1.jsonl` | **No** |
| Edit `records.jsonl` / `search_index.jsonl` | **No** |
| Rebuild bundle | **No** |
| Change runtime search | **No** |
| Change CF2 / query-log schemas | **No** |
| Add UI | **No** |

PASS: report rows are evidence candidates only.

## 8. Privacy / data minimization

- Query-level fields only (`query_raw`, normalized form, mode, counts, timestamps).
- No session identity, device identity, or user profile fields.
- CF2 optional free-text notes are **not** copied into the candidate report.
- Query-log consent remains a caller concern for real exports.

## 9. Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run -- src/aliases/alias_candidate_evidence.test.ts` | **16 passed** |
| `npm --prefix web run test:run` | **1066 passed** (108 files) |
| `npm --prefix web run build` | **PASS** (`tsc` + vite) |
| `git diff --check` | **PASS** |

Covered: exact / hyphen-space / ligature / prefix already_searchable;
possible_alias; possible_content_gap; noise; ambiguous; CF2/query-log ingest;
deterministic markdown/jsonl/csv; authority boundary (`review_status: candidate`).

## 10. Files changed

Added:

```text
web/src/aliases/alias_candidate_evidence.ts
web/src/aliases/alias_candidate_evidence.test.ts
docs/reports/al1b_alias_content_gap_candidate_evidence_report.md
```

Modified: none (beyond this report).

## 11. Working tree

Expected uncommitted:

```text
?? web/src/aliases/
?? docs/reports/al1b_alias_content_gap_candidate_evidence_report.md
?? web/scripts/
```

Commit not created.

## 12. Recommended next (not started)

Human review of AL1B worksheet output, then a later slice to draft
`status: candidate` rows in `source_aliases_v1.jsonl` / supplements **by hand** —
still without auto-apply.
