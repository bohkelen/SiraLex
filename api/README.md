# `api/`

Backend service package for SiraLex.

## Snapshot Engine (Phase 1.1)

The Snapshot Engine captures raw HTML snapshots from source websites, following the behavioral requirements in `shared/specs/snapshot-engine.md`.

### Setup

```bash
cd api/
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -e .
```

### Usage

```bash
# Crawl a single URL
siralex-crawl --source src_malipense \
    --urls https://www.mali-pense.net/emk/index-french/a.htm

# Crawl multiple URLs
siralex-crawl --source src_malipense \
    --urls URL1 URL2 URL3

# Crawl URLs from a file
siralex-crawl --source src_malipense \
    --url-file urls.txt

# With verbose logging
siralex-crawl --source src_malipense \
    --urls URL \
    --verbose
```

### Output structure

```
data/snapshots/
  {source_id}/
    {crawl_id}/
      snapshots.jsonl       # New snapshot metadata
      crawl_results.jsonl   # All URL check results
      payloads/
        {snapshot_id}.html.zst
```

### Key features

- **Idempotent**: Re-running skips unchanged content (by hash comparison)
- **Polite**: Single-threaded, 2s delay between requests, clear User-Agent
- **Evidence-preserving**: Stores raw bytes, headers, timestamps, hashes
- **Robots.txt aware**: Respects disallow by default

See `shared/specs/snapshot-engine.md` for full specification.

## IR Parser (Phase 1.2)

The IR Parser extracts structured IR (Intermediate Representation) units from raw snapshots. IR preserves all source data in a lossless-enough format for downstream normalization.

### Usage

```bash
# Parse all lexicon snapshots from a crawl
siralex-parse-ir --crawl-dir data/snapshots/src_malipense/crawl_xxx \
    --output data/ir/malipense_lexicon.jsonl

# With verbose logging
siralex-parse-ir --crawl-dir data/snapshots/src_malipense/crawl_xxx \
    --output data/ir/malipense_lexicon.jsonl -v
```

### Output structure

```
data/ir/
  malipense_lexicon.jsonl   # One IR unit per line (JSONL)
```

### IR unit shape

```json
{
  "ir_id": "a7b3c9d2...",           // Deterministic, collision-safe
  "ir_kind": "lexicon_entry",       // Document type
  "source_id": "src_malipense",
  "parser_version": "malipense_lexicon_v1",
  "evidence": [{                    // Full entry block coverage
    "source_id": "src_malipense",
    "snapshot_id": "20f263ef...",
    "entry_block": {...},
    "text_quote": "ábadàn"
  }],
  "record_locator": {...},          // Identity hint
  "fields_raw": {                   // Literal extraction
    "headword_latin": "ábadàn",
    "headword_nko_provided": "...",
    "senses": [...]
  }
}
```

### Key design decisions

- **`ir_id`**: Deterministic hash of `source_id|url_canonical|record_id|parser_version`
- **No `retrieved_at`**: Join via `snapshot_id` instead
- **Evidence covers full block**: Not just headword element
- **Literal extraction**: `ps_raw` preserved verbatim, `pos_hint` only if confident
- **"Provided" forms**: N'Ko from source stored as `headword_nko_provided`

See `shared/specs/lossless-capture-and-ir.md` for full specification.

## Planned responsibilities (Phase 1.3+)

- Normalization pipeline (IR → normalized lexicon records)
- Provenance enforcement (entry/sense/example)
- Transliteration service/module hooks (Latin → N'Ko + uncertainty flags)
- Moderation queue for anonymous suggestions (audit + rollback)