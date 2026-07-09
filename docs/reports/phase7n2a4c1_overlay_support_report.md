# Phase 7N2A4C1 Overlay Support Report

**Status:** overlay mechanism implemented; zero production rows inserted  
**Storage decision commit:** `b941baa`  
**Overlay file:** `shared/target_variants/reviewed_target_variants_v1.jsonl` (0 rows)

---

## Concern matrix

| Concern | Rule implemented | Validation result |
| ------- | ---------------- | ----------------- |
| Explicit overlay loading only | `--target-variant-overlay PATH` required; no default discovery | **PASS** |
| Raw vs composed normalization | absent flag = raw; present flag = composed | **PASS** |
| Empty overlay equivalence | explicit empty overlay matches raw output | **PASS** (19,324 records; 0 drift) |
| Overlay file existence | missing path fails closed | **PASS** |
| Schema version | `reviewed_target_variant_table_v1` only | **PASS** |
| `canonical_ir_id` format | 16 lowercase hex chars | **PASS** |
| `variant_id` uniqueness | global unique | **PASS** |
| Approved NFC form uniqueness | one approved row per NFC `form` | **PASS** |
| Pending/rejected rows | schema-valid; not applied | **PASS** |
| Canonical target resolution | exactly one `lexicon_entry` required | **PASS** |
| Non-lexicon target | fails closed | **PASS** |
| Headword collision | Guard A via `LexiconVariantRegistry` | **PASS** |
| Attested Latin collision | Guard C via `LexiconVariantRegistry` | **PASS** |
| Cross-overlay form collision | table validator NFC duplicate check | **PASS** |
| Source field immutability | deep-copy before attach; frozen IR unchanged | **PASS** |
| `preferred_form` unchanged | overlay merges into `variant_forms` only | **PASS** |
| `target_script` v1 | `latin` only | **PASS** |
| `source_norm_version` | must equal `norm_v3` | **PASS** |
| Approved row sort order | `(canonical_ir_id, variant_id)` | **PASS** |
| R1/R1A guards preserved | inline reviewed-variant guards still pass | **PASS** |

---

## Overlay file

| Property | Value |
| -------- | ----- |
| Path | `shared/target_variants/reviewed_target_variants_v1.jsonl` |
| Row count | `0` |
| SHA-256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

No production target variant (`móbaa`, health mappings, owner lexical additions) has been inserted.

---

## Normalization modes

**Raw normalization:**

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --output /tmp/siralex_norm_7n2a4c1_raw.jsonl \
  -v
```

CLI reports: `Target-variant overlay: (none — raw normalization)`

**Composed normalization (explicit empty overlay):**

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --target-variant-overlay shared/target_variants/reviewed_target_variants_v1.jsonl \
  --output /tmp/siralex_norm_7n2a4c1_empty_overlay.jsonl \
  -v
```

CLI records overlay path, SHA-256, total rows (`0`), and applied rows (`0`).

---

## Empty-overlay output equivalence

Compared `/tmp/siralex_norm_7n2a4c1_raw.jsonl` vs `/tmp/siralex_norm_7n2a4c1_empty_overlay.jsonl`:

| Check | Result |
| ----- | ------ |
| Same `ir_id` set | yes (19,324) |
| `preferred_form` drift | 0 |
| `variant_forms` drift | 0 |
| `search_keys` drift | 0 |
| `provenance` / `derivation` drift | 0 |

---

## Collision and duplicate safeguards

- Table validator: `variant_id` uniqueness, approved NFC form uniqueness, approved sort order, schema fields.
- IR validator: approved rows must resolve to exactly one `lexicon_entry`.
- Normalizer: existing `LexiconVariantRegistry` guards for headword, anchor_names, attested Latin homographs, and reviewed-form registration.
- Overlay applied in memory via deep-copy; frozen IR files never mutated.

---

## Tests

```bash
pytest api/target_variants/tests/ -q                    # 16 passed
pytest api/normalizer/tests/ -q                         # 106 passed
pytest api/ir_parser/tests/test_golden_fixtures.py -q   # 25 passed
pytest api/source_aliases/tests/ -q                     # 22 passed
git diff --check                                        # clean
```

---

## Future reporting requirement

Candidate generation and composed-normalization implementation reports must record:

- exact `--target-variant-overlay` path
- overlay file SHA-256
- total overlay row count
- applied (`approved`) row count

---

## Scope confirmation

No `móbaa` row, lexical record, alias, source mapping, generated index, bundle, package, runtime behavior, catalog, or release state changed. Mali-Pense IR untouched.

Phase 7N2A4C1 established an explicit, tracked, reproducible target-variant overlay mechanism. No production target variant has been inserted, and raw normalization remains independent of ambient local overlay files.
