# Phase 7N2A4C1-R Fail-Closed Overlay Report

**Status:** completed  
**Scope:** repair overlay correctness gaps only (no production overlay insertion)

## Gap matrix

| Gap | Prior behavior | Corrected behavior | Test result |
| --- | -------------- | ------------------ | ----------- |
| Frozen-Mali-Pense target scope | Overlay target accepted any single `lexicon_entry` regardless of source | Approved overlay rows must resolve to exactly one loaded `lexicon_entry` with `source_id = src_malipense`; zero/multiple/non-lexicon/non-Mali-Pense targets fail closed with explicit source-scope error | PASS |
| `reviewed_at` ISO-8601 enforcement | Non-empty `reviewed_at` strings were accepted | `reviewed_at` must be valid ISO-8601 date or datetime under repository conventions; malformed values fail validation | PASS |
| Composed normalization fail-closed + transactional output | Invalid overlays could return error but output semantics were not atomic and CLI exit behavior was permissive | Overlay validation and collision preflight run before opening destination output; normalization writes to temp sibling then atomically replaces destination only on success; failures return errors, preserve existing output, and CLI exits non-zero | PASS |

## Repair details

- Overlay schema validation now enforces ISO-8601 parsing for `reviewed_at`.
- Overlay target resolution now enforces v1 scope to frozen Mali-Pense lexical entries only.
- `process_ir_files()` now preflights overlay application against `LexiconVariantRegistry` before output file creation.
- Output writing is transactional (`NamedTemporaryFile` sibling + `os.replace` on success).
- On any error path, temporary output is removed; existing output remains unchanged.
- `normalizer.cli` exits with code `1` when `stats["errors"] > 0`.

## Verification summary

- Raw normalization and composed normalization with explicit empty overlay are equivalent:
  - same `ir_id` set
  - same `preferred_form`
  - same `variant_forms`
  - same `search_keys`
  - same provenance/derivation behavior
- Synthetic invalid-overlay CLI invocation returns non-zero and does not create/replace output.

## Required explicit statements

No production overlay row has been added.

No móbaa behavior exists yet.

Composed normalization now fails atomically on invalid overlays and cannot
silently leave a partial successful-looking output.
