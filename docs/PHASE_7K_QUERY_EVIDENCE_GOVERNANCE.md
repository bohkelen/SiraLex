# Phase 7K Query Evidence Governance

**Status:** maintainer decision document — documentation only  
**Audience:** project maintainers reviewing query evidence, analyzer output, and downstream artifacts  
**Companion:** `docs/PHASE_7K_TRACK_C_TESTER_OPERATIONS_PACKET.md`  
**Analyzer invariant:** Track B emits `review_status: candidate` only; humans own all promotion decisions

---

## Evidence hierarchy

Evidence types rank from weakest to strongest for **product and content decisions**. Higher layers may override lower-layer frequency signals.

| Rank | Evidence type | Typical source | Use |
|------|---------------|----------------|-----|
| 1 (weakest for demand) | Synthetic / debug fixtures | `cohort: synthetic_debug`, repo fixtures | Analyzer regression only |
| 2 | Smoke and developer traffic | `cohort: smoke`, `cohort: developer` | Tooling and engineering verification |
| 3 | Structured usability | `cohort: tester`, `collection_mode: structured_usability` | UX validation, confusion discovery, known-case checks — **not demand frequency** |
| 4 | Natural tester logs | `cohort: tester`, `collection_mode: natural_use` | Primary input for product-triage aggregate |
| 5 | Human-reviewed candidate rows | Post-analyzer manual review | Queue for specific downstream review workflows |
| 6 | Approved downstream artifacts | Phase 7I / 7J / editorial packets with explicit approval | Implementation input |
| 7 (strongest) | Published bundle changes | Normal release controls | Shipped behavior |

**Rule:** Only layers 4–7 may support product-demand conclusions. Layers 1–2 are never merged into product triage. Layer 3 is supplementary only.

Cross-checks (tester qualitative feedback, phrase review tables, prior gap packets) **inform** review but do not replace natural-use log evidence for demand ranking.

---

## Candidate lifecycle

Query evidence candidates are **hypotheses for human review**, not approved changes. The lifecycle is entirely human-governed after analyzer emission.

```text
candidate
  → human review
  → approved for a specific downstream review workflow
  → separately implemented artifact
  → validation
  → published bundle only after normal release controls
```

### Stage definitions

| Stage | Owner | Description |
|-------|-------|-------------|
| **candidate** | Analyzer (Track B) | Row emitted with `review_status: candidate`, heuristic `gap_class`, priority score, replay against **current** featured bundle |
| **human review** | Maintainer | Manual read of query, direction, export context, replay, cross-links, and classification caution rules |
| **approved for workflow** | Maintainer | Decision to open or extend a specific review packet (alias table, supplement table, phrase review, policy memo, editorial track) — not yet a data change |
| **implemented artifact** | Maintainer + normal edit process | Concrete JSONL / doc row drafted in the target artifact path |
| **validation** | Validators + tests | e.g. alias/supplement validators, bundle checks, UX verification |
| **published bundle** | Release process | Catalog pointer update, checksums, staging — existing Phase 7 release controls |

**Critical rule:** The analyzer **never** changes a candidate `review_status` beyond `candidate`. No script, batch job, or maintainer shortcut may mark analyzer output as `approved`, `rejected`, or `deferred` inside `phase7k_query_candidates.jsonl`. Status changes belong in downstream review artifacts and decision logs only.

---

## What the analyzer can and cannot infer

### Can infer (heuristic, pre-label only)

- Aggregated hit/miss/multi/deep-ladder rates from ingested exports
- Deduped `(query, direction, bundle_id)` grains with occurrence counts **within the ingested file set**
- Distinct hashed session-bucket counts (v2) for multi-session hints
- Current featured-bundle replay outcome vs export-time outcome (drift / `already_addressed`)
- Suggested `gap_class`, priority band, and recommended destination artifact path
- Cross-links to phrase review, approved aliases/supplements, Phase 7J gap rows

### Cannot infer

- True user population demand or market frequency
- That a repeated event implies repeated **users** without distinct session-bucket evidence (v1 has no buckets)
- That `true_dictionary_entry_gap` proves a missing dictionary entry (hypothesis only)
- Tester intent (typo, partial typing, test probe, language choice)
- Which bundle/catalog was authoritative at event time if logs disagree with current featured replay
- Approval to modify any production artifact or bundle

Treat analyzer priority scores as **queue ordering aids**, not approval scores.

---

## Classification caution rules

Apply these rules during human review of every actionable row (P1, P2, and all `true_dictionary_entry_gap`).

| Rule | Implication |
|------|-------------|
| `true_dictionary_entry_gap` is a **hypothesis**, not proof of a missing dictionary entry | Require editorial judgment, cross-source checks, and policy review before any content action |
| Repeated events do **not** prove repeated users unless distinct session evidence exists | v2: compare hashed session buckets; v1: treat repeat counts as within-file only |
| v1 exports have **no session-bucket evidence** | Do not claim multi-tester convergence from v1 alone without written limitation |
| Structured-usability queries are **not** demand-frequency evidence | Exclude from repeat-miss promotion unless corroborated by natural-use logs |
| Current-featured replay can differ from the bundle used at event time | Flag `bundle_mismatch` and `already_addressed` drift; do not blame index without checking export metadata |

### Observed examples (conceptual — not committed test results)

These patterns appear in mixed traffic and must not auto-elevate to content work:

| Pattern | Likely interpretation | Review stance |
|---------|----------------------|---------------|
| Partial typing such as `bra`, `mang`, `mange`, `mo` | Incomplete input while composing a longer lemma, not necessarily lexical gaps | Down-rank for `true_dictionary_entry_gap`; check natural full-form queries first |
| Deliberate strings such as `zzzz-nohit-test` | Intentional no-hit probes (smoke, structured S5, developer checks) | Exclude from triage; classify as probe, not content candidate |

When export-time result and current replay diverge, prefer **current replay** for “what would happen now” but preserve export-time miss as behavioral evidence.

---

## Production-artifact approval gate

Production-named artifacts are:

```text
shared/query_evidence/phase7k_query_summary.json
shared/query_evidence/phase7k_query_candidates.jsonl
docs/reports/phase7k_query_evidence_audit.md
```

Committing these paths populated from **real** tester exports requires **all** of the following gates to pass. Partial completion is insufficient.

| Gate | Requirement |
|------|-------------|
| Privacy inspection passed | No unexpected PII; no raw session UUIDs in committed files; provenance records contain no banned fields |
| Provenance records reviewed | Every input export documented; cohort/mode verified |
| Tester-only aggregate used for product triage | No smoke/developer/synthetic traffic in the aggregate that fed committed outputs |
| No raw exports in repository | JSONL exports remain outside git |
| Candidate rows remain `candidate` | Committed JSONL still has `review_status: candidate` only |
| Manual review completed for actionable rows | Every P1/P2 and every `true_dictionary_entry_gap` row reviewed with documented disposition |
| Explicit maintainer approval recorded | Decision log entry with date, approver, commit hash intent, and scope |

**Default:** Do not commit real-analysis outputs. Repo retains **synthetic fixtures only** under `shared/query_evidence/fixtures/` until this gate is explicitly satisfied.

Passing the gate commits **evidence artifacts for review**, not approved aliases, supplements, or bundle changes. Implementation still follows the candidate lifecycle.

---

## Privacy and retention rules

### Data minimization in committed artifacts

- Session buckets: hashed prefix only in summary outputs (per Track B policy); never commit raw `session_bucket_id`
- Queries in committed candidate rows: allowed **only after** privacy inspection and explicit approval — queries are lookup strings but may still be sensitive
- No tester identity fields in any committed file

### Local retention (maintainer)

| Data | Retention guidance |
|------|-------------------|
| Raw exports | Keep only as long as needed for active review; delete when decision log records completion or tester withdraws consent |
| Uncommitted analysis outputs | Delete or archive offline after committed artifacts supersede them |
| Provenance records | Keep non-sensitive fields for audit trail; store identity-linked notes offline only |

### Tester rights

- Tester may request deletion of maintainer-held copies at any time
- Withdrawal of consent invalidates derived aggregates that included that export; re-run analysis without those inputs before any publication

### Repository boundaries

Never commit:

- Raw `.jsonl` tester exports
- Full local paths, emails, names, session UUIDs in docs
- Real analysis outputs without passing the production-artifact approval gate

---

## Audit trail requirements

Maintain a traceable, non-sensitive audit trail for every evidence cycle that may influence product decisions.

### Required records

1. **Provenance record** per export (Track C template — basename only)
2. **Analyzer run metadata** — ingest counts, input basenames, bundle/catalog replay target, analyzer version (from summary JSON or private run notes)
3. **Exclusion log** — which exports/events removed from triage and why
4. **Manual review notes** — disposition per P1/P2 / `true_dictionary_entry_gap` row (even if “no action”)
5. **Decision log entry** when passing or failing the production-artifact gate
6. **Git commit hash** when approved artifacts are committed

### Linkage

Decision log entries should reference:

- `export_basename` list (not paths)
- Analyzer output location (commit hash if committed, or “local only / deleted”)
- Downstream review packet IDs opened (if any) — e.g. Phase 7J review id, phrase review row

Do not rely on git history of raw exports — there should be none.

---

## Decision log template

Copy one entry per significant evidence review or gate decision. Store in maintainer records; commit redacted summaries only if explicitly useful and privacy-safe.

```yaml
decision_id: phase7k_evidence_YYYY-MM-DD_001
date: YYYY-MM-DD
decision_type: production_artifact_gate | triage_conclusion | row_disposition_batch | collection_stop
maintainer: initials or role only — no personal email required
inputs:
  export_basenames:
    - siralex-query-logs-YYYYMMDDTHHMMSSZ.jsonl
  cohort_verified: tester_only
  collection_modes:
    natural_use: 2
    structured_usability: 1
sufficient_evidence_threshold:
  met: yes | no | partial
  gaps: (list unmet criteria if any)
analyzer_run:
  location: local | committed
  commit_hash: null or git SHA
  bundle_replay: bundle_full_YYYYMMDD_*
privacy_gate: passed | failed
manual_review:
  p1_p2_reviewed: count
  true_dictionary_entry_gap_reviewed: count
  exclusions_applied: summary
outcome:
  production_artifacts_committed: yes | no
  downstream_packets_opened: []
  notes: Free text — decisions, not raw queries
next_review_date: YYYY-MM-DD or null
```

### Prohibited in committed decision logs

Same as provenance template: no full paths, tester name, email, session UUID, or raw export payloads.

---

## Quick reference — maintainer obligations

| Obligation | Document section |
|------------|------------------|
| Label cohort and mode before triage | Track C — Cohort labels, Collection modes |
| Exclude non-tester traffic | Track C — Exclusion rules |
| Never auto-approve analyzer rows | Candidate lifecycle |
| Classify with caution | Classification caution rules |
| Commit real artifacts only after full gate | Production-artifact approval gate |
| Keep audit trail | Audit trail requirements, Decision log template |

When evidence is insufficient, state **preliminary** conclusions only and continue collection under Track C protocols — do not lower the threshold retroactively.
