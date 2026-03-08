# Snapshot Engine specification (v1)

This document defines **crawler/capture behavior** for the SiraLex Snapshot Engine.

It complements `lossless-capture-and-ir.md` (which defines snapshot **data contracts**) by specifying how the engine **operates**: idempotency, politeness, storage layout, and change detection.

It is **stack-neutral**: it defines behavioral requirements, not implementation language or storage backend.

## Why this exists

Old sites die. Links rot. Character encoding quirks become impossible to debug without raw evidence.

**"Snapshot first"** is the only posture that prevents catastrophic dependency on fragile external hosts.

## Goals

- **Idempotent**: re-running the engine produces the same outcome without duplication or data loss.
- **Evidence-preserving**: store enough metadata to resolve future encoding/content disputes.
- **Polite**: respect target servers; do not cause outages or get blocked.
- **Incremental**: support partial crawls and resumption.
- **Change-aware**: detect content changes across crawl runs, including reverts (A→B→A).

## Non-goals

- Parsing HTML into structured records (that's Phase 1.2 / IR).
- Defining full storage technology (local files vs object store vs DB).
- Defining normalization or transliteration rules.

---

## Snapshot output contract (per page)

Each captured page MUST produce a snapshot record with:

| Field | Required | Description |
|-------|----------|-------------|
| `snapshot_id` | ✅ | Deterministic identifier (see computation rule below) |
| `source_id` | ✅ | Stable join key from Source Registry |
| `url_original` | ✅ | URL as requested |
| `url_canonical` | ✅ | URL after redirect resolution + canonicalization |
| `url_canonicalization_version` | ✅ | Version of canonicalization rules applied |
| `retrieved_at` | ✅ | ISO-8601 timestamp (UTC, second precision) |
| `http_status` | ✅ | Numeric HTTP status code |
| `headers` | ✅ | Full response headers (after redaction; see below) |
| `content_sha256` | ✅ | SHA-256 hash of raw response body bytes (hex, lowercase) |
| `byte_length` | ✅ | Size of raw body in bytes |
| `payload_path` | ✅ | Path/key to compressed payload file |
| `robots_observed` | ✅ | `true` if robots.txt was checked; `false` otherwise |
| `robots_policy_notes` | Recommended | Notes on robots.txt status (allowed/disallowed/no-robots-file) |
| `encoding` | Recommended | Declared or detected character encoding |
| `content_type` | Recommended | Content-Type header value |
| `redirect_chain` | Recommended | Array of redirect hops `[{status, url}, ...]` if any |
| `crawl_id` | Recommended | Identifier for the crawl batch/run |
| `fetch_tool_version` | Recommended | Version of the crawler/engine |

### `snapshot_id` computation (normative)

To prevent divergence across implementations, `snapshot_id` MUST be computed deterministically:

```
snapshot_id = sha256_hex(url_canonical + "\n" + retrieved_at + "\n" + content_sha256)[:16]
```

Where:
- `url_canonical` is the canonicalized URL (string)
- `retrieved_at` is the ISO-8601 timestamp in UTC with second precision (e.g., `2026-01-15T14:30:00Z`)
- `content_sha256` is the lowercase hex SHA-256 of the raw response body
- `sha256_hex(...)` computes SHA-256 and returns lowercase hex
- `[:16]` truncates to the first 16 hex characters

This produces a unique identifier per fetch event: same content fetched at different times yields different `snapshot_id` values.

### Payload storage

- Raw response body MUST be stored as compressed bytes (`.html.zst` recommended; `.html.gz` acceptable).
- Payload files MUST be immutable once written.
- Payload filename SHOULD include `snapshot_id` or `content_sha256` for traceability.

### Header redaction (required)

Before persisting headers, the engine MUST apply a redaction policy:

**MUST redact** (remove entirely or replace with `[REDACTED]`):
- `Set-Cookie`, `Cookie`
- `Authorization`, `Proxy-Authorization`
- Any header containing tokens, session IDs, or credentials

**SHOULD preserve** (for debugging/evidence):
- `Content-Type`, `Content-Length`, `Content-Encoding`
- `Last-Modified`, `ETag`
- `X-*` headers (unless they contain credentials)
- `Server`, `Date`

Record `redaction_policy_id` (e.g., `"header_redact_v1"`) on the snapshot metadata.

---

## Idempotency requirements

The engine MUST be idempotent:

1. **Skip if unchanged**: If the content hash of a newly fetched page matches an existing snapshot for the same `url_canonical`, do NOT create a new snapshot. Instead, record the match in `crawl_results.jsonl` (see below).

2. **Never overwrite**: Existing snapshots are immutable. A changed page produces a **new** snapshot (new `snapshot_id`, new `retrieved_at`), not an update.

3. **Track status**: For each URL in a crawl run, record one of:
   - `new` — no prior snapshot for this `url_canonical`; new snapshot created
   - `changed` — content hash differs from latest snapshot; new snapshot created
   - `unchanged` — content hash matches latest snapshot; no new snapshot created
   - `error` — fetch failed (record HTTP status or exception)
   - `robots_blocked` — fetch skipped due to robots.txt disallow (see Politeness)

4. **Resumable**: If a crawl is interrupted, re-running SHOULD resume from where it left off (skip already-captured URLs in the current batch).

### Timeline preservation (A→B→A scenario)

To support detecting content that changes and then reverts (A→B→A), the engine MUST record every URL check in `crawl_results.jsonl`, even when no new payload is stored.

This ensures:
- Crawl 1: Store snapshot with hash A → status `new`
- Crawl 2: Store snapshot with hash B → status `changed`
- Crawl 3: No new snapshot (matches A) → status `unchanged`, `matched_snapshot_id` points to original

The timeline is preserved in the crawl results, not just the snapshot store.

---

## Politeness requirements

The engine MUST be polite to target servers:

| Requirement | Default | Notes |
|-------------|---------|-------|
| **Single-threaded** | Yes | No parallel requests to the same host |
| **Request delay** | ≥ 2 seconds | Between consecutive requests to same host |
| **User-Agent** | Descriptive | Include project name + contact (e.g., `SiraLex-Snapshot/1.0 (+https://github.com/bohkelen/siralex)`) |
| **Retry with backoff** | Yes | On 429/5xx, exponential backoff (max 3 retries) |
| **Abort on block** | Yes | If server returns persistent 403/429, stop crawl for that source and alert |

### Robots.txt handling (normative)

The engine MUST respect robots.txt with the following behavior:

1. **Default action when disallowed**: If robots.txt disallows the URL for our User-Agent, **do not fetch** unless the Source Registry entry includes `permission_override: true`.

2. **Recording**: Every snapshot MUST include:
   - `robots_observed: true|false` — whether robots.txt was checked
   - `robots_policy_notes` — one of:
     - `"allowed"` — robots.txt permits access
     - `"disallowed"` — robots.txt forbids access (should not have fetched unless override)
     - `"no_robots_file"` — no robots.txt found (404 or empty)
     - `"permission_override"` — fetched despite disallow due to explicit permission

3. **No hard-fail on missing**: If robots.txt returns 404 or is unreachable, proceed with fetch and record `"no_robots_file"`.

---

## Required crawl artifacts (per `crawl_id`)

Each crawl run MUST produce **two** artifact files:

### 1. `snapshots.jsonl`

One JSON object per line for each **new snapshot created** during this crawl.

Contains full snapshot metadata (all required fields from the output contract).

### 2. `crawl_results.jsonl`

One JSON object per line for **every URL checked** during this crawl, regardless of whether a new snapshot was created.

Required fields:

| Field | Description |
|-------|-------------|
| `url_canonical` | Canonicalized URL |
| `crawl_status` | One of: `new`, `changed`, `unchanged`, `error`, `robots_blocked` |
| `checked_at` | ISO-8601 timestamp of when this URL was checked |
| `snapshot_id` | If `new` or `changed`: the new snapshot's ID. If `unchanged`: the matched existing snapshot's ID. |
| `content_sha256` | Hash of fetched content (if fetched) |
| `error_details` | If `error`: HTTP status or exception message |

This file enables:
- Timeline reconstruction (A→B→A detection)
- Crawl coverage verification
- Resumption after interruption

---

## Storage layout (reference)

This spec does not mandate a specific layout, but implementations MUST ensure:

1. Given a `snapshot_id`, the payload is locatable.
2. Given a `crawl_id`, both `snapshots.jsonl` and `crawl_results.jsonl` are locatable.

Recommended structure:

```
data/
  snapshots/
    {source_id}/
      {crawl_id}/
        snapshots.jsonl           # new snapshot metadata
        crawl_results.jsonl       # all URL check results
        payloads/
          {snapshot_id}.html.zst
```

Or content-addressed payloads:

```
data/
  snapshots/
    {source_id}/
      crawls/
        {crawl_id}/
          snapshots.jsonl
          crawl_results.jsonl
      payloads/
        {content_sha256_prefix}/{content_sha256}.html.zst
```

---

## Crawl execution strategy (recommended)

### Phase 1.1 execution order

1. **Prototype crawl** — Capture a single index page (e.g., `/emk/index-french/a.htm`) + a handful of linked entry pages.
   - Validate: encoding detection, link discovery, canonicalization, storage layout.
   - Fix any spec/implementation issues before proceeding.

2. **Expand** — Crawl all A–Z index pages with rate limiting.
   - Produce a manifest of all entry URLs discovered.

3. **Entry crawl** — Crawl all discovered entry pages.
   - Apply idempotency (skip if already captured with same hash).

4. **Re-crawl (later)** — Periodic re-crawl with unchanged/changed/new accounting.

---

## Success conditions (Phase 1.1 DoD)

Phase 1.1 is complete when:

- [ ] **Rebuild independence**: Any downstream parse can be executed without re-fetching from the source website.
- [ ] **Change detection**: Re-running the crawl detects unchanged/changed/new pages by hash comparison, with timeline preserved in `crawl_results.jsonl`.
- [ ] **Evidence sufficiency**: Stored headers + raw bytes are sufficient to resolve future encoding/content disputes.
- [ ] **Idempotency verified**: Re-running the engine on the same URL set produces no duplicate snapshots.
- [ ] **Two-artifact compliance**: Each crawl produces both `snapshots.jsonl` and `crawl_results.jsonl`.

---

## Relationship to other specs

| Spec | Relationship |
|------|--------------|
| `lossless-capture-and-ir.md` | Defines snapshot **data fields**; this spec defines **engine behavior** |
| `source-registry.md` | Engine MUST reference `source_id` from the registry; check `permission_override` for robots bypass |
| `provenance.md` | Downstream IR/records will reference `snapshot_id` from engine output |

---

## Normative example: snapshot record

```json
{
  "snapshot_id": "a1b2c3d4e5f67890",
  "source_id": "src_malipense",
  "url_original": "https://www.mali-pense.net/emk/index-french/a.htm",
  "url_canonical": "https://www.mali-pense.net/emk/index-french/a.htm",
  "url_canonicalization_version": "urlcanon_v1",
  "retrieved_at": "2026-01-15T14:30:00Z",
  "http_status": 200,
  "headers": {
    "Content-Type": "text/html; charset=iso-8859-1",
    "Last-Modified": "Sun, 01 Jan 2023 00:00:00 GMT",
    "Content-Length": "45678"
  },
  "content_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "byte_length": 45678,
  "payload_path": "payloads/a1b2c3d4e5f67890.html.zst",
  "encoding": "iso-8859-1",
  "redirect_chain": [],
  "crawl_id": "crawl_2026-01-15_malipense_v1",
  "fetch_tool_version": "siralex-snapshot/0.1.0",
  "redaction_policy_id": "header_redact_v1",
  "robots_observed": true,
  "robots_policy_notes": "allowed"
}
```

## Normative example: crawl result entry (unchanged)

```json
{
  "url_canonical": "https://www.mali-pense.net/emk/index-french/a.htm",
  "crawl_status": "unchanged",
  "checked_at": "2026-02-01T10:00:00Z",
  "snapshot_id": "a1b2c3d4e5f67890",
  "content_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```
