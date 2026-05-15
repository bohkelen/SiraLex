# Log analysis workflow

Simple **offline** workflow for turning exported SiraLex query logs (JSONL) into grouped misses and human-readable gap hypotheses. No network required after export.

## What you have

Each line is one JSON object (`query_log_event_v1`). Fields that matter most for analysis:

| Field | Use |
|-------|-----|
| `query_raw` | What the user typed. |
| `ir_ids_count` | **0** = miss for classification; **> 0** = hit. |
| `ladder_level_hit` | Last ladder step considered when resolving (including `none` on full miss). |
| `query_normalized_keys` | Per-step keys actually tried (arrays per ladder stage). |
| `direction` | `source_to_target` or `target_to_source`. |
| `bundle_id`, `storage_scope_id`, `norm_version` | Scope for joining to bundle or norm tooling. |
| `timestamp_iso` | Order and session slicing. |

Import means: **read the file as newline-delimited JSON**, not as a single JSON array.

## Step 1: Import JSONL

Pick one tool and stay consistent for the session.

- **Spreadsheet:** import as text, split lines, parse JSON per row (or use a script to flatten to CSV).
- **jq (CLI):** stream-parse lines; example miss filter:  
  `jq -c 'select(.ir_ids_count == 0)' siralex-query-logs-....jsonl`
- **Python:** `for line in open(path): obj = json.loads(line)`.

Validate: every non-empty line parses; `schema_version` is present; skip blank lines at end of file.

## Step 2: Group misses

1. Filter to **`ir_ids_count == 0`** (these are misses in the same sense as the debug table’s “miss”).
2. **Group** for triage, for example:
   - by `ladder_level_hit` (many `none` may indicate different issues than early-ladder exhaustion);
   - by `direction`;
   - by prefix or token count of `query_raw` (single token vs multi-token);
   - by script or Unicode range if you are comparing multilingual noise (manual bucket is fine).

Produce a short table or list: **group id, count, example `query_raw` (3–5 each)**.

## Step 3: Identify gap types (manual)

Use the taxonomy in [QUERY_FAILURE_TAXONOMY.md](./QUERY_FAILURE_TAXONOMY.md) as **labels only**. The log does not assign them; you assign after inspecting bundle content and index.

### Phrase gaps

**Signal:** Multi-word or idiomatic `query_raw`, miss at `none`, normalized keys still look plausible as text but no entry covers the whole phrase.

**Check:** Search bundle records or enriched source for the phrase or close variants; if absent as a unit, treat as **phrase / coverage** gap (may overlap `missing_entry`).

### Normalization gaps

**Signal:** You find a lexical entry that *should* match, but `query_normalized_keys` at the hit ladder step do not align with index keys (ruleset version in `norm_version`).

**Check:** Re-run normalization mentally or with the same `norm_version` tooling; compare to `search_index` keys for the same headword. If rules diverge from user expectation, treat as **normalization** gap.

### Missing entries

**Signal:** Canonical form of the query exists in the language (dictionary-worthy lemma) but no record contains it in any field you expect to be searchable.

**Check:** Grep or DB search the **records** corpus for the lemma; if absent, **content** gap (new entry), not an index bug.

### Partial-language confusion

**Signal:** Wrong language script or mixed-script input; user expects language A but typed language B script, or a transliteration that maps to another language’s segment.

**Check:** Direction, `query_raw` script, and bundle `language_meta`; compare to how ladder keys are built. Often clusters as user education or keyboard layout, sometimes as **language_mismatch** in taxonomy terms.

### Index gaps

**Signal:** Record exists with the expected surface form, but queries still miss at `none`; `query_normalized_keys` match what you believe the indexer should have stored.

**Check:** Inspect `search_index` for the bundle and `norm_version`; verify key_type chain and ir_ids. If record present but index line missing or wrong ir_ids, treat as **index** gap.

## Step 4: Output of the workflow

For each significant miss group, capture:

1. Representative **JSONL lines** (verbatim).
2. **Hypothesis** (one primary: phrase / normalization / missing entry / language confusion / index).
3. **Next check** (which file or query would confirm: records vs index vs norm spec).

Keep conclusions conservative: “consistent with X” is better than asserting root cause without opening the bundle.

## Related docs

- [VALIDATION_TESTING_PROTOCOL.md](./VALIDATION_TESTING_PROTOCOL.md) — how to produce logs.
- [QUERY_FAILURE_TAXONOMY.md](./QUERY_FAILURE_TAXONOMY.md) — failure class definitions and examples.
