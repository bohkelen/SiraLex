# Phase 7K Query Evidence Audit

## Run metadata

- Analyzer version: 0.1.0
- Generated at: 2026-06-18T20:00:00.000Z
- Schema version: phase7k_query_summary_v1
- Synthetic fixture run: yes
- Replay bundle: bundle_full_20260616_phase7j_alias_round2_candidate
- Catalog version: norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2
- Deduped query groups: 6
- Candidate rows: 6

## Ingest health

- This run used synthetic fixture inputs under `shared/query_evidence/fixtures/`.
- Total events ingested: 8
- v1 events: 1
- v2 events: 7
- Parse/validation issues: 0
- Duplicate event IDs dropped: 0
- Distinct queries: 6
- Distinct session bucket hashes: 1

## Aggregate outcomes

- Logged misses: 1
- Logged hit_single: 6
- Logged hit_multi: 1
- Logged deep ladder hits: 1

## Candidate priority queues

### P1 (0 rows)

_None._

### P2 (1 rows)

- `phase7k_evidence_0002` score=45 query='bonjour' direction=source_to_target gap_class=true_dictionary_entry_gap

### P3 (3 rows)

- `phase7k_evidence_0001` score=25 query='bon-jour' direction=source_to_target gap_class=true_dictionary_entry_gap
- `phase7k_evidence_0004` score=25 query='mère' direction=source_to_target gap_class=ranking_ambiguity_issue
- `phase7k_evidence_0006` score=25 query='zzzz-nohit-test' direction=source_to_target gap_class=true_dictionary_entry_gap

### monitor (2 rows)

- `phase7k_evidence_0003` score=0 query='fruit' direction=source_to_target gap_class=already_addressed
- `phase7k_evidence_0005` score=0 query='salut' direction=source_to_target gap_class=already_addressed

## Gap class breakdown

- already_addressed: 2
- ranking_ambiguity_issue: 1
- true_dictionary_entry_gap: 3

## Candidate preview

- `phase7k_evidence_0002` | score=45 | 'bonjour' | source_to_target | true_dictionary_entry_gap | miss
- `phase7k_evidence_0001` | score=25 | 'bon-jour' | source_to_target | true_dictionary_entry_gap | miss
- `phase7k_evidence_0004` | score=25 | 'mère' | source_to_target | ranking_ambiguity_issue | hit (3)
- `phase7k_evidence_0006` | score=25 | 'zzzz-nohit-test' | source_to_target | true_dictionary_entry_gap | miss
- `phase7k_evidence_0003` | score=0 | 'fruit' | source_to_target | already_addressed | hit (1)
- `phase7k_evidence_0005` | score=0 | 'salut' | source_to_target | already_addressed | hit (1)

## Parse/validation issues

_None._

## Privacy note

- Raw `session_bucket_id` values are never emitted in summary JSON.
- Summary JSON omits query text; candidate JSONL and this audit may include query text for review.
- Raw tester exports must never be committed to the repository.

## Non-goals

- All candidate rows remain `candidate`; no auto-approval is performed.
- This audit is a review packet only; it does not apply aliases, supplements, or phrase changes.
- Production-named evidence artifacts require explicit maintainer approval after real export review.
