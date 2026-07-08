# Phase 7N2A4F1-S0 — Project Lexicon Locator Metadata for Resolved Regression

## Status

**Complete.** Enrichment now projects durable IR `record_locator` onto
`lexicon_entry` enriched/bundle records so
`index_mapping.display.target_entries[].anchor` can resolve to lexicon `ir_id`
without display-text matching.

Resolved-target search-regression assertions (**7N2A4F1-S**) are **not**
implemented in this slice.

No candidate, package, catalog, or published bundle was rebuilt.

## 1. Root issue (from 7N2A4F1-S investigation)

Additive 7N2A health cases need resolved target lexicon IDs, but replay could
not join mapping targets from bundle records alone:

| Layer | Mali-Pense lexicon | Owner lexicon |
| --- | --- | --- |
| IR | Has `record_locator.source_record_id` (e.g. `e2533`) | Has `record_locator` + `provenance.source.record_pointer` |
| Pre-S0 enriched/bundle | Only `display.anchor_names` (headword forms); **no** HTML `source_record_id` | Provenance pointer preserved; no top-level `record_locator` |
| Mapping `target_entries` | `anchor: e2533` | `anchor: 7n2a_ndandayoro_v1` |

Display-text-only matching was rejected (homographs). Option A was chosen:
project durable locator metadata at enrichment time.

## 2. Exact enrichment change

`api/enrichment/enrich.py`:

- `build_ir_lookup` now stores `{fields_raw, record_locator, ir_kind}` per `ir_id`.
- For `ir_kind == lexicon_entry`, `enrich_record` projects:

```json
"record_locator": {
  "kind": "...",
  "url_canonical": "...",
  "source_record_id": "...",
  "anchor_names": ["..."]
}
```

- `index_mapping` rows still get `display` only (no top-level `record_locator`).
- Owner `provenance` / `derivation` continue to pass through unchanged from the
  normalized baseline.
- Legacy callers that pass `ir_id → fields_raw` still enrich `display` only
  (no locator projection).

Fail-closed:

- Missing/invalid `kind`, `url_canonical`, or `source_record_id` →
  `EnrichmentLocatorError`.
- Invalid non-list `anchor_names` → `EnrichmentLocatorError`.
- IR rows that omit `anchor_names` (1,387 Mali-Pense lexicon units) emit
  `anchor_names: []` so the field is always present on enriched lexicon rows.
- Duplicate locator tuples across distinct lexicon `ir_id`s →
  `EnrichmentDuplicateLocatorError`. Tuple:

```text
(source_id, record_locator.url_canonical, record_locator.source_record_id)
```

  No allowlist exists in this slice. Index-mapping rows are ignored (they must
  not carry `record_locator`).

## 3. Display-only gate update

`validate_enrichment_display_only` now allows enrichment additives:

```text
display (required)
record_locator (optional; lexicon_entry only; schema-validated)
```

All other fields must still equal the normalized baseline. The gate also runs
the same fail-closed duplicate locator-tuple check over enriched lexicon rows.

## 4. Spec update

`shared/specs/offline-bundle-versioning.md` documents lexicon
`record_locator` projection rules and states index_mapping rows must not
include top-level `record_locator`.

## 5. Required outcome proof (temp pipeline)

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --input data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/phase7n2a4f1s0_locator_proj/normalized.jsonl -v

PYTHONPATH=api:shared python3 -m enrichment.cli \
  --normalized /tmp/phase7n2a4f1s0_locator_proj/normalized.jsonl \
  --ir data/ir/malipense_lexicon_v3.jsonl \
  --ir data/ir/malipense_index_v1.jsonl \
  --ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/phase7n2a4f1s0_locator_proj/enriched.jsonl -v

PYTHONPATH=api:shared python3 -m enrichment.validate_enrichment_display_only \
  --baseline /tmp/phase7n2a4f1s0_locator_proj/normalized.jsonl \
  --enriched /tmp/phase7n2a4f1s0_locator_proj/enriched.jsonl -v
```

Results:

| Check | Result |
| --- | --- |
| IR / normalized / enriched count | 19,326 |
| Enriched with `record_locator` | 8,825 (all lexicon entries) |
| Index mappings with `record_locator` | 0 |
| **duplicate locator tuple count** | **0** |
| Display-only gate | PASSED |
| `71e323e2dafa590f` (`dándaso`) | `source_record_id=e2533` |
| `a9c7d82decee9191` | locator + `provenance.source.record_pointer` preserved |
| `fefe9b063e05ed11` | locator + `provenance.source.record_pointer` preserved |

Mali-Pense enriched lexicon records now expose:

```text
source_id
record_locator.kind
record_locator.url_canonical
record_locator.source_record_id
record_locator.anchor_names
```

Owner lexical records preserve:

```text
provenance.source.record_pointer.url_canonical
provenance.source.record_pointer.source_record_id
```

and also receive top-level `record_locator` aligned with those pointers.

## 6. Tests

```bash
pytest api/enrichment/tests/ -q
```

Coverage added/updated:

- Mali-Pense `e2533` projection
- Owner provenance pointer preservation + locator projection
- Gate allows lexicon `record_locator`; rejects it on `index_mapping`
- Missing `source_record_id` fails closed
- Missing IR `anchor_names` defaults to `[]`
- Duplicate Mali-Pense locator tuple fails closed
- Duplicate owner locator tuple fails closed
- Distinct locator tuples pass
- Index-mapping rows ignored by uniqueness check
- `enrich_records` aborts on duplicate locator tuples
- Display-only gate reports duplicate locator tuples

## 7. Explicit non-goals for this slice

- No `expected_id_space` / resolved-target regression assertions (still **7N2A4F1-S**)
- No candidate recomposition, package, catalog, or featured-bundle publish
- No search-index, alias, or supplement changes
- No frozen 7L matrix changes

## 8. Next slice

```text
Phase 7N2A4F1-S — Source Mapping Resolution Assertions for Search Regression
```

With enriched/bundle lexicon `record_locator.source_record_id` available,
implement `expected_id_space: resolved_target_ir_ids` using fail-closed join:

```text
target_entries[].anchor  →  lexicon.record_locator.source_record_id  →  ir_id
```

Owner rows may also resolve via `provenance.source.record_pointer` when present.
Do not use display-text-only matching.

## Explicit statement

```text
Enriched lexicon records now carry durable source locator metadata
(source_record_id / url_canonical / kind / anchor_names) so resolved-target
search regression can join mapping anchors without display-text matching.
Resolved-target assertion mode itself is deferred to Phase 7N2A4F1-S.
```
