# Phase 7N2A4C1-R1B Canonical Target Identity Report

## Scope

This slice hardens canonical target resolution for reviewed target-variant overlays.

## Resolution rule update

Previous effective rule:

- accepted when one qualifying frozen Mali-Pense lexicon match existed, even if duplicate loaded records shared the same `ir_id`.

Corrected rule:

1. `canonical_ir_id` must resolve to exactly one loaded IR unit total.
2. That one resolved unit must satisfy:
   - `ir_kind == lexicon_entry`
   - `source_id == src_malipense`

Any zero or duplicate loaded identity now fails, including mixed kind/source duplicate sets.

## Target-resolution matrix

| Target-resolution case | Required result | Actual test result |
| ---------------------- | --------------- | ------------------ |
| One Mali-Pense lexicon target | Pass | PASS |
| Zero records | Fail | PASS |
| One wrong-kind target | Fail | PASS |
| One wrong-source target | Fail | PASS |
| Duplicate Mali-Pense IDs | Fail | PASS |
| Mixed duplicate IDs | Fail | PASS |

## Error-content requirement

Failure paths now include:

- overlay row line number;
- `canonical_ir_id`;
- total resolved loaded-record count;
- explicit rejection reason.

## Explicit statements

Canonical overlay targets now require one unambiguous loaded IR identity,
not merely one qualifying Mali-Pense match among duplicate IDs.

No production target-variant row has been inserted.
