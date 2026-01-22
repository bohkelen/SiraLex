# `api/`

Backend service package for Nkokan.

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
nkokan-crawl --source src_malipense \
    --urls https://www.mali-pense.net/emk/index-french/a.htm

# Crawl multiple URLs
nkokan-crawl --source src_malipense \
    --urls URL1 URL2 URL3

# Crawl URLs from a file
nkokan-crawl --source src_malipense \
    --url-file urls.txt

# With verbose logging
nkokan-crawl --source src_malipense \
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

## Planned responsibilities (Phase 1+)

- Ingestion pipeline entry points (raw capture → lossless IR → normalized records)
- Provenance enforcement (entry/sense/example)
- Transliteration service/module hooks (Latin → N'Ko + uncertainty flags)
- Moderation queue for anonymous suggestions (audit + rollback)
