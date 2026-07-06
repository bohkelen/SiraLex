# Phase 7N2A4E0-R Place Path Correction Report

The prior place -> ndándadiya assertion was incorrect and is superseded.

The preserved existing base behavior is place -> díya.

No health-institution record is authorized under place or location.

## Scope and method

- Documentation-only correction.
- Read-only verification against provisioned local IR:
  - `data/ir/malipense_index_v1.jsonl`
  - `data/ir/malipense_lexicon_v3.jsonl`
  - `data/ir/siralex_owner_lexical_v1.jsonl`
- No supplement row insertion and no pipeline execution.

## Verified correction checks

| Check | Verified value |
| --- | --- |
| Existing place source mapping ir_id | `96b72ff71179d689` |
| Existing preserved target ir_id | `de6fb406453616e3` |
| Existing preserved target form | `díya` |
| `ndándadiya` ir_id | `fefe9b063e05ed11` |
| `ndándayoro` ir_id | `a9c7d82decee9191` |
| Health IDs absent from place posting | `fefe9b063e05ed11`: absent; `a9c7d82decee9191`: absent |
| `yoro` artifact status | prohibited / absent |
| Any supplement-table change | none |

## Direct IR verification summary

- Source term `place` is present in `data/ir/malipense_index_v1.jsonl` as mapping `96b72ff71179d689`.
- The `place` target entries resolve to existing Mali-Pense lexicon records, including:
  - anchor `e2782` -> `de6fb406453616e3` -> `díya`.
- Owner health records are separate and confirmed in `data/ir/siralex_owner_lexical_v1.jsonl`:
  - `fefe9b063e05ed11` -> `ndándadiya`
  - `a9c7d82decee9191` -> `ndándayoro`
- Neither health ID appears in the existing resolved `place` posting.

## Policy boundary (restored)

Existing place -> díya behavior remains unchanged.

No 7N2A mapping may route place or location to ndándayoro or ndándadiya.

Standalone yoro remains prohibited from lexical records, target variants, source aliases, source-index supplements, and all 7N2A retrieval paths.

## Health mapping plan status

The approved health-mapping plan remains unchanged:

- `hôpital`: preserve `dándaso`, then append `ndándayoro` and `ndándadiya`.
- `clinique`: new mapping to `ndándayoro` and `ndándadiya` only.
- `centre de santé`: new mapping to `ndándayoro` and `ndándadiya` only.
