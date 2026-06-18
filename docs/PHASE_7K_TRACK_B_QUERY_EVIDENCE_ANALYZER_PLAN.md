# Phase 7K Track B — Offline Query Evidence Analyzer — Implementation Plan

**Status:** planning only — no implementation until reviewed  
**Parent plan:** `docs/PHASE_7K_QUERY_EVIDENCE_PLAN.md`  
**Prerequisite:** Track A complete (`525f0fd` — query log v2 runtime + consent diagnostics, smoke-verified)  
**Scope:** offline Python analyzer only (Track B)

---

## 1. Purpose

Track B converts **exported query log JSONL files** from Track A into **reviewable evidence artifacts** for human triage. It connects production query behavior to the Phase 7J review taxonomy without changing search, bundles, or runtime logging.

Track B must **not** commit raw tester exports. Production-named evidence artifacts are generated only from real exports during maintainer review and committed only with explicit approval after that review.

---

## 2. Existing analyzer inventory

### What exists today

| Asset | Location | Role today | Track B disposition |
|-------|----------|------------|---------------------|
| **Query log summarizer** | `scripts/analyze_query_logs.py` | Stdlib-only ingest of **v1-only** exports; hit/miss counts, ladder distribution, repeated misses, legacy classification options | **Reuse lightly** for optional legacy summary subsection; **do not extend** as primary Track B entrypoint |
| **Query log tests** | `scripts/test_analyze_query_logs.py` | Synthetic v1 fixture tests | **Keep**; optional delegation test if new CLI wraps old summary |
| **Gap discovery miner** | `api/source_index_gap_discovery/` | Read-only gloss/miner over records + index | **Reuse normalization + index loading patterns**; **do not invoke miner** during evidence analysis |
| **Phase 7J gap review rows** | `shared/source_index_gap_discovery/phase7j_gap_candidates.jsonl` | Gold reference for `gap_class`, scoring, destination routing | **Reuse as schema/routing reference** and cross-link source for `already_addressed` |
| **Source alias validator** | `api/source_aliases/validate_alias_table.py` | `search_keys_for_source_term()`, `lookup_source_term()` — exactness ladder replay for `src_*` | **Reuse lookup ladder** (extract shared helper to avoid duplication) |
| **Supplement validator** | `api/source_index_supplements/validate_supplements.py` | Same ladder replay + `load_search_index()` | **Reuse index load + lookup** |
| **Alias tests directional lookup** | `api/source_aliases/tests/test_source_aliases.py` | `target_to_source` via `tgt_*` key prefix swap | **Reuse pattern** for bidirectional replay |
| **Phrase review table** | `shared/phrase_review/phrase_miss_review_v1.jsonl` | Human-reviewed phrase miss evidence | **Cross-link only** |
| **Approved aliases** | `shared/aliases/source_aliases_v1.jsonl` | Shipped alias rows | **Cross-link** for `already_addressed` |
| **Approved supplements** | `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Shipped supplement rows | **Cross-link** for `already_addressed` |
| **Norm contract** | `shared/normalization/norm_v3.py` | Same ladder as runtime featured bundle | **Required** for replay |
| **Featured bundle** | `web/public/bundle_full_20260616_phase7j_alias_round2_candidate/` | Current replay baseline | **Default `--bundle`** |
| **Catalog pointer** | `web/public/catalog.json` | Featured bundle metadata | **Read for default catalog_version in summary** |

### Path notes

| Requested | Actual |
|-----------|--------|
| `web/public/bundle_full_20260518_15605571/` | May exist locally; **not** featured catalog entry. Default replay: **`bundle_full_20260616_phase7j_alias_round2_candidate`**. |
| `shared/query_evidence/` | **Does not exist yet** — created during Track B implementation (fixtures only at first). |
| Production evidence outputs | **Do not exist yet** — generated locally from real exports; committed only after explicit maintainer approval. |

### Leave alone

- `web/` runtime, logging, UI
- `mine_candidates.py` execution during evidence ingest
- Alias/supplement validators as approval tools — read tables only
- `phrase_miss_review_v1.jsonl` content — link, don’t mutate
- ROADMAP, catalog, bundles, production assets

---

## 3. Input contract

### Supported inputs

```text
One or more local exported .jsonl paths (--input, repeatable)
Mixed query_log_event_v1 + query_log_event_v2 rows
UTF-8 NDJSON, one JSON object per non-empty line
No committed raw tester exports (confidential working inputs only)
Repo contains synthetic fixtures only under shared/query_evidence/fixtures/
```

### Per-row ingest rules

| Field / topic | Handling |
|---------------|----------|
| **`schema_version`** | Required. Accept `query_log_event_v1` or `query_log_event_v2`. Unknown schema → parse error row, skip event, continue. |
| **Parse errors** | Collect `{path, line_number, error}`; include in summary + audit report; never abort whole run unless `--strict`. |
| **Missing required fields** | v1: require `query_raw`, `direction`, `ladder_level_hit`, `ir_ids_count`, `bundle_id`, `norm_version`. v2: require full v2 set from Track A store contract. Partial rows → parse error. |
| **v1 normalization** | Map to internal unified event: `result_count ← ir_ids_count`; `matched_key_type ← ladder_level_hit`; `matched_key ← null`; derive `result_status`; synthetic `event_id` for traceability. |
| **v2** | Use fields as logged. Prefer logged `query_normalized_keys` over recompute for evidence traceability. |
| **Duplicate events** | Same `event_id` across files → keep one canonical copy, record duplicate provenance in ingest stats. |
| **Multiple exports / devices** | Aggregate by dedupe key `(query_casefold, direction, bundle_id)`; `occurrence_count` sums retained events; track distinct hashed `session_bucket_id` values. |
| **`session_bucket_id`** | Retain internally for dedupe stats; **never emit raw** in committed artifacts (see §7). |
| **`catalog_version`** | Prefer v2 field; fallback `(missing)` in summary when absent. |
| **`bundle_id`** | Required for candidate grouping; events with bundle ≠ `--bundle` replay target → ingested, flagged `bundle_mismatch` in audit. |
| **Empty `query_raw`** | Skip with warning. |

### Dedupe key (candidate grain)

```text
(query_raw trimmed, casefold-normalized, direction, bundle_id)
```

All events sharing that key collapse to **one candidate row** with aggregated metadata.

---

## 4. Output artifacts and schemas

The analyzer **can produce** three production-named outputs when run locally against real exports:

```text
shared/query_evidence/phase7k_query_summary.json
shared/query_evidence/phase7k_query_candidates.jsonl
docs/reports/phase7k_query_evidence_audit.md
```

**Commit policy:** see §12 Artifact policy. These paths are **not** auto-committed from synthetic fixture runs.

### 4.1 `phase7k_query_summary.json`

Machine-readable run manifest + aggregates.

```json
{
  "schema_version": "phase7k_query_summary_v1",
  "generated_at_iso": "2026-06-18T…",
  "analyzer_version": "0.1.0",
  "inputs": [{ "path": "…", "row_count": 42, "parse_errors": 0 }],
  "replay": {
    "bundle_id": "bundle_full_20260616_phase7j_alias_round2_candidate",
    "bundle_path": "web/public/bundle_full_20260616_phase7j_alias_round2_candidate",
    "catalog_version": "norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2",
    "norm_version": "norm_v3",
    "search_index_directional": true
  },
  "ingest": {
    "total_events": 100,
    "v1_events": 5,
    "v2_events": 95,
    "parse_errors": 1,
    "duplicate_event_ids_dropped": 2,
    "distinct_queries": 37,
    "distinct_tester_buckets_hashed": 3
  },
  "outcomes": {
    "miss": 12,
    "hit_single": 60,
    "hit_multi": 28,
    "deep_ladder_hits": 4
  },
  "candidates": {
    "total": 18,
    "by_gap_class": {},
    "by_priority_band": { "P1": 2, "P2": 8, "P3": 5, "monitor": 3 }
  },
  "cross_links": {
    "phrase_review_matches": 3,
    "approved_alias_matches": 5,
    "approved_supplement_matches": 2,
    "phase7j_gap_matches": 4
  },
  "privacy": {
    "raw_exports_committed": false,
    "session_bucket_handling": "sha256_prefix_8"
  }
}
```

### 4.2 `phase7k_query_candidates.jsonl`

One row per deduped `(query, direction, bundle_id)`.

**Schema:** `phase7k_query_evidence_v1`

| Field | Type | Rules |
|-------|------|-------|
| `review_id` | string | `phase7k_evidence_{seq:04d}` monotonic per run |
| `schema_version` | `"phase7k_query_evidence_v1"` | constant |
| `query` | string | From export (review evidence — allowed in reviewed artifacts) |
| `search_direction` | enum | `source_to_target` \| `target_to_source` |
| `occurrence_count` | int ≥ 1 | Sum across ingested exports |
| `first_seen` | ISO string | Min `timestamp_iso` |
| `last_seen` | ISO string | Max `timestamp_iso` |
| `current_result` | string | `miss`, `hit (N)`, `partial related terms only` |
| `gap_class` | enum | Phase 7J taxonomy (§5) |
| `priority_score` | int 0–100 | Deterministic heuristic score |
| `priority_reasons` | string[] | Explainable tokens |
| `resolved_ir_ids` | string[] | From **current** replay against featured bundle |
| `evidence_sources` | string[] | e.g. `query_log_export`, `search_index_replay`, `phrase_miss_review_v1` |
| `recommended_destination_artifact` | string \| null | Same routing map as Phase 7J |
| `review_status` | `"candidate"` | **Always** for Track B output |
| `reason_not_to_apply_automatically` | string | Required non-empty |
| `source_bundle_id` | string | From logs |
| `source_catalog_version` | string \| null | From logs |
| `related_log_event_ids` | string[] | v2 `event_id` list (v1 synthetic ids ok) |

**Hard invariants (validator enforced):**

- No row with `review_status` ≠ `candidate`
- No row with `review_status: approved`
- Every `gap_class` ∈ allowed enum
- `priority_reasons` non-empty when `priority_score > 0`

### 4.3 `phase7k_query_evidence_audit.md`

Human review packet. Sections:

1. Run metadata — inputs (basenames), bundle/catalog, analyzer version, privacy note  
2. Ingest health — parse errors, v1/v2 mix, duplicate handling  
3. Aggregate outcomes — hit/miss/multi/deep-ladder rates  
4. Priority queues — P1 / P2 / P3 / Monitor tables  
5. Gap class breakdown — counts + destination artifact map  
6. Regression monitor — `already_addressed` drift  
7. Cross-links — phrase review / alias / supplement / Phase 7J IDs  
8. Parse error appendix  
9. Explicit non-goals reminder  

Markdown is generated from the same internal model as JSON outputs.

---

## 5. Taxonomy and classification rules

Use Phase 7J-aligned `gap_class` enum exactly:

```text
reviewed_source_alias_candidate
reviewed_source_index_supplement_candidate
phrase_miss_candidate
true_dictionary_entry_gap
ranking_ambiguity_issue
target_side_issue
typo_noise
should_remain_no_hit
ui_copy_issue
already_addressed
```

**Pre-labeling only.** Every emitted row: `review_status: candidate`. No approved/rejected/deferred in Track B output. **No auto-approval.**

### Heuristic decision tree (first match wins unless noted)

| Signal | Typical `gap_class` | Destination |
|--------|---------------------|-------------|
| Replay hits; approved alias exists for exact query | `already_addressed` | `null` |
| Replay hits; approved supplement covers query | `already_addressed` | `null` |
| Export miss → replay hit (fix shipped since log) | `already_addressed` | `null` |
| Export miss; replay miss; singular canonical hits (plural/gender pattern) | `reviewed_source_alias_candidate` | `shared/aliases/source_aliases_v1.jsonl` |
| Export hit; incomplete mapping signals | `reviewed_source_index_supplement_candidate` | `shared/source_index_supplements/source_index_supplements_v1.jsonl` |
| Multi-token miss; phrase review row exists | `phrase_miss_candidate` | `shared/phrase_review/source_phrase_aliases_v1.jsonl` (blocked implementation) |
| Multi-token miss; phrase review says reject compositional | `should_remain_no_hit` or `true_dictionary_entry_gap` | `null` |
| `hit_multi` with kinship/basic vocab | `ranking_ambiguity_issue` | `policy_memo` |
| `target_to_source` + policy-sensitive target forms | `target_side_issue` | `policy_memo` |
| Obvious typo vs known reviewed phrase/term | `typo_noise` | `null` |
| Direction confusion with hit | `ui_copy_issue` | docs/i18n (`null` artifact) |

**Cross-link precedence:** phrase review category → Phase 7J gap row → alias/supplement tables → heuristics.

---

## 6. Replay strategy

### Default replay target

```text
Bundle: web/public/bundle_full_20260616_phase7j_alias_round2_candidate
Index:  …/search_index.jsonl
Catalog version: from web/public/catalog.json
```

### Replay engine (`api/query_evidence/replay.py`)

Reuse runtime contract via **offline Python**, not TypeScript `searchQuery()`:

1. Load index into `dict[(key_type, key)] → ir_ids[]`.  
2. For each candidate query + direction:
   - `source_to_target`: `lookup_source_term()` ladder (`src_casefold` → … → `src_nospace`)
   - `target_to_source`: same ladder with `src_` → `tgt_` prefix swap (alias test pattern)
3. Stop at first non-empty posting set (exactness ladder, no merge across levels).

### Replay by query type

| Query type | Replay action |
|------------|---------------|
| **Misses** | Full ladder; `current_result = miss` or `hit (N)` if fixed |
| **Multi-hit** | Replay; feed `ranking_ambiguity_issue` scoring if still multi |
| **Deep-ladder hits** | Detect `punct_stripped` / `nospace` from export or replay |
| **target_to_source** | `tgt_*` ladder; `target_side_issue` heuristics where applicable |
| **already_addressed** | Replay must hit; compare export vs replay; flag regressions |
| **Phrase-like misses** | Whole query + optional token probe → `partial related terms only` |

When logged `top_ir_ids` ≠ replay `ir_ids`: prefer replay; record `export_replay_drift` in reasons and audit.

---

## 7. Priority scoring

Additive model, capped 0–100, fully explained by `priority_reasons`.

| Signal | Points | Condition |
|--------|--------|-----------|
| `repeated_miss:+20` | +20 | `occurrence_count ≥ 2` and miss |
| `repeated_miss:+30` | +30 | `occurrence_count ≥ 3` |
| `replay_still_misses:+25` | +25 | Current replay miss |
| `hit_multi:+15` | +15 | Multi-hit |
| `deep_ladder:+10` | +10 | Deep ladder hit |
| `phrase_like:+10` | +10 | ≥2 tokens |
| `basic_vocabulary:+15` | +15 | High-salience term list (gap miner subset) |
| `multi_tester:+10` | +10 | ≥2 distinct hashed session buckets |
| `catalog_stale:+5` | +5 | Log catalog ≠ current featured |
| `already_addressed_penalty:-100` | −100 | Replay hit + shipped fix |
| `typo_noise_penalty:-40` | −40 | Phrase review typo class |
| `should_remain_no_hit_penalty:-30` | −30 | Compositional reject |
| `ui_copy_issue_penalty:-20` | −20 | Confusion-only |

| Band | Score | Intent |
|------|-------|--------|
| **P1** | ≥ 70 | Repeated miss + still misses + salient vocab |
| **P2** | 45–69 | Actionable alias/supplement/phrase candidates |
| **P3** | 20–44 | Ranking/target-side/monitor |
| **Monitor** | ≤ 19 or `already_addressed` | Regression controls |

---

## 8. Privacy and repo hygiene

| Rule | Implementation |
|------|----------------|
| **Raw exports never committed** | `.gitignore` for `*-query-logs-*.jsonl` outside fixtures; CI uses synthetic fixtures only |
| **Synthetic fixtures only in repo** | Hand-authored v1/v2 events under `shared/query_evidence/fixtures/` |
| **Candidate JSONL may include query text** | Review artifact by design (same boundary as phrase review tables) |
| **Exports are confidential working inputs** | Document in audit header |
| **No IP/location/account identity** | No geo enrichment; ignore unknown identity fields |
| **`session_bucket_id` minimized** | Internal dedupe only; output uses `sha256(session_bucket_id)[:8]` in summary; omit from candidate rows |
| **No `query_raw` in summary JSON** | Counts/aggregates only |

---

## 9. CLI design

### New entrypoint: `scripts/analyze_query_evidence.py`

Do **not** overload `scripts/analyze_query_logs.py`. Keep Phase 5B/6C docs valid. Optional `--legacy-summary` delegates aggregate stats to the old summarizer.

```bash
python3 scripts/analyze_query_evidence.py \
  --input /path/to/export1.jsonl \
  --input /path/to/export2.jsonl \
  --bundle web/public/bundle_full_20260616_phase7j_alias_round2_candidate \
  --catalog web/public/catalog.json \
  --aliases shared/aliases/source_aliases_v1.jsonl \
  --supplements shared/source_index_supplements/source_index_supplements_v1.jsonl \
  --phrase-review shared/phrase_review/phrase_miss_review_v1.jsonl \
  --phase7j-gaps shared/source_index_gap_discovery/phase7j_gap_candidates.jsonl \
  --output-summary shared/query_evidence/phase7k_query_summary.json \
  --output-candidates shared/query_evidence/phase7k_query_candidates.jsonl \
  --output-report docs/reports/phase7k_query_evidence_audit.md \
  [--strict] \
  [--top 25]
```

### Module layout (implementation)

```text
scripts/analyze_query_evidence.py
api/query_evidence/
  models.py
  ingest.py          # v1/v2 parse + normalize + dedupe
  replay.py          # index load + directional ladder
  crosslink.py       # aliases, supplements, phrase, phase7j
  classify.py
  score.py
  emit.py
  validate_output.py
  tests/
shared/query_evidence/fixtures/
  sample_export_v2.jsonl
  sample_export_mixed_v1_v2.jsonl
  …
shared/query_evidence/fixtures/tests/
  golden_summary.json
  golden_candidates.jsonl
  …
```

---

## 10. Test plan

All tests use **synthetic fixtures** under `shared/query_evidence/fixtures/`. Golden expected outputs live under **`shared/query_evidence/fixtures/tests/`** only.

| Fixture | Purpose |
|---------|---------|
| `sample_export_v2.jsonl` | Pure v2 events |
| `sample_export_mixed_v1_v2.jsonl` | v1 + v2 dedupe |
| `sample_export_parse_errors.jsonl` | malformed lines |
| `sample_export_already_addressed.jsonl` | miss in export, hit on replay |
| `sample_export_phrase_miss.jsonl` | phrase-like miss |
| `fixtures/tests/golden_summary.json` | Expected summary for fixture set |
| `fixtures/tests/golden_candidates.jsonl` | Expected candidates (stable fields) |

### Assertions

- No `review_status: approved` rows  
- Valid `gap_class` enum  
- Dedupe: identical query/direction → one candidate, correct `occurrence_count`  
- `priority_score` deterministic  
- No full `session_bucket_id` in outputs  
- Replay: `fruits` → `already_addressed` on featured bundle  
- Audit markdown smoke: priority queues + parse errors sections  

Run via: `python3 -m pytest api/query_evidence/tests/` (or `scripts/test_analyze_query_evidence.py` matching existing script test style).

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Small sample / one tester | Report hashed bucket count; require repeated misses for P1 |
| Export vs replay drift | Prefer replay; document drift |
| v1 backlog exports | Unified ingest adapter |
| Heuristic mis-routing | Required `reason_not_to_apply_automatically`; human review only |
| Accidental commit of real exports | gitignore + fixture-only CI |
| Duplicate lookup code | Extract shared `replay_lookup()` in `api/query_evidence` |

---

## 12. Artifact policy

### May commit during Track B implementation

```text
scripts/analyze_query_evidence.py
api/query_evidence/
shared/query_evidence/fixtures/
golden test outputs under shared/query_evidence/fixtures/tests/
```

### Must not commit unless explicitly approved after analyzing real exports

```text
shared/query_evidence/phase7k_query_summary.json
shared/query_evidence/phase7k_query_candidates.jsonl
docs/reports/phase7k_query_evidence_audit.md
```

### Policy statements

```text
Synthetic fixture outputs must live only under fixtures/golden test paths.
Production-named evidence artifacts must only be generated from real tester exports and reviewed before commit.
Raw tester exports must never be committed.
```

CI validates the analyzer against fixtures and golden paths under `fixtures/tests/`. It does **not** regenerate or commit production-named evidence artifacts.

---

## 13. Non-goals

Track B explicitly excludes:

- Runtime logging / UI / consent changes  
- Remote telemetry or upload  
- New aliases, supplements, or phrase aliases  
- Bundle publication or catalog updates  
- Auto-approval or `review_status: approved` output  
- Committing raw tester exports  
- Re-running gap miner during ingest  
- Search behavior / ranking / normalization changes  
- Anonymized export mode (deferred)  
- Auto-committing production evidence artifacts from synthetic runs  

---

## 14. Recommendation

**Proceed with Track B implementation** as a focused Python PR after this plan lands:

1. **`api/query_evidence/`** — ingest (mixed v1/v2), replay, classify, score, emit, validate  
2. **`scripts/analyze_query_evidence.py`** — CLI  
3. **`shared/query_evidence/fixtures/`** + **`fixtures/tests/`** golden outputs  
4. **Do not commit** production-named artifacts until real exports are analyzed and explicitly approved  

**Implementation order:** replay + ingest → dedupe/summary → classify/score → emit/validate → fixture golden tests.

**Track C (later, docs-only):** maintainer tester export request template + local analyzer ops guide.
