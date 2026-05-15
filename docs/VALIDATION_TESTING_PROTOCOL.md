# Validation testing protocol

Lightweight checklist for exercising **validation logging** on a local build of SiraLex (web app). Goal: reproducible device or desktop sessions that produce query logs you can export and analyze offline.

## Prerequisites

- A dictionary bundle installed and selected as active.
- A build of the app you can open in a browser (for example `npm run preview` or a deployed static preview).

## How to enable logging

1. Open the **Search** section of the app.
2. Find the **Validation logging** panel (inside the bordered area under Search).
3. Click **Turn On** so the status reads **On**.
4. Optional: confirm the **Recent query logs (debug)** area appears below (table or “No logs yet.”) and that the log count increases after queries.

Logging is **opt-in** and **local only**. Nothing is uploaded automatically.

## How to test (session flow)

1. **Warm-up:** run a few queries you already know are hits, and a few you expect to be misses, in both directions if you use **Source → Target** / **Target → Source**.
2. **Volume:** aim for enough diversity that patterns emerge (see ROADMAP Phase 5b exit criteria: on the order of 100 queries or strong diversity).
3. **Stability:** avoid clearing logs mid-session unless you intentionally want a clean slice; otherwise export first.
4. **Debug table:** use **Recent query logs (debug)** only to sanity-check recent rows (raw query, hit/miss, ladder level, timestamp). It reflects the same store as export.

## How to export logs

1. Ensure **Validation logging** is **On** (export still works if logging is off, as long as rows exist; for a coherent session, keep it on while testing).
2. Click **Export logs**.
3. The browser downloads a **JSONL** file (one JSON object per line, UTF-8). Filename is timestamped (for example `siralex-query-logs-YYYYMMDDThhmmssZ.jsonl`).
4. Store the file with your test notes (device, OS, browser, bundle id, date).

**Clear logs** removes all rows from local storage after confirmation. Export before clear if you need the data.

## Scenarios to test

Cover as many as apply to your bundle and languages:

| Scenario | What to observe |
|----------|-----------------|
| Known headword (exact) | Hit at early ladder step; `ir_ids_count` > 0. |
| Case / diacritics variants | Which `ladder_level_hit` resolves the hit. |
| Punctuation and spacing | `punct_stripped` / `nospace` behavior. |
| Multi-word / phrase queries | Miss vs hit; note `query_raw` and ladder. |
| Direction flip | Same string in **Source → Target** vs **Target → Source**. |
| Rare or loanword-like strings | Misses at `none`; note for offline analysis. |
| After bundle switch | Logs include `bundle_id` / `storage_scope_id`; verify you are testing the intended bundle. |
| Long session | App remains responsive; export still succeeds. |

## How to report issues

Include enough context that someone else can reproduce or classify the row.

1. **Environment:** device or desktop OS, browser name and version, app build or commit if known.
2. **Bundle:** `bundle_id`, `bundle_version` (if present), `norm_version` from the log line or from bundle metadata.
3. **Steps:** exact query string, search direction, and what you expected vs what happened (hit/miss, ladder level if shown).
4. **Evidence:** one or more **verbatim JSONL lines** (redact personal data if any). Prefer lines where `schema_version` is `query_log_event_v1`.
5. **Optional:** attach the full export if size and privacy allow; otherwise a minimal excerpt of misses (`ir_ids_count` == 0) plus a few representative hits.

For taxonomy-style labels (spelling vs phrase vs index, and so on), use [QUERY_FAILURE_TAXONOMY.md](./QUERY_FAILURE_TAXONOMY.md) as vocabulary only; the log line does **not** auto-classify failures today.

## Related docs

- [LOG_ANALYSIS_WORKFLOW.md](./LOG_ANALYSIS_WORKFLOW.md) — offline steps after export.
- [QUERY_FAILURE_TAXONOMY.md](./QUERY_FAILURE_TAXONOMY.md) — definitions and examples for failure classes.
