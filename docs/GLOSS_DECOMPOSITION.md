# Gloss Decomposition Contract

This document defines the `norm_v2` source-term decomposition contract used for
`index_mapping.fields_raw.source_term`.

The goal is to improve real search quality without replacing or mutating the
original stored string.

## Scope

This contract applies only to:

- `index_mapping.fields_raw.source_term`

It does not change:

- `lexicon_entry` record structure
- per-string search-key transforms
- runtime search ladder semantics
- storage or IndexedDB schema

## Additive rule

The original `source_term` MUST always be preserved as the first emitted
variant.

Any derived phrases are additive aliases. They never replace the original.

## Decomposition pipeline

`extract_source_phrases(source_term)` in `shared/normalization/norm_v2.py`
follows this deterministic contract:

1. Preserve the full original `source_term`.
2. Split top-level enumerations such as `a)`, `b)`, `1.`, `2.`.
3. Split each enumeration segment on top-level commas, semicolons, and slashes.
4. For each resulting segment:
   - keep the full segment
   - if it ends with trailing parenthetical context, also emit a version
     without that trailing parenthetical
5. Strip leading and trailing punctuation for the cleaned variant only.
6. Filter noise:
   - minimum phrase length is `3`
   - stopword-only phrases are discarded
7. Deduplicate in first-seen order.

## Quality constraints

To keep index growth controlled, `norm_v2` uses these explicit limits:

- no whitespace tokenization: multiword phrases stay intact
- maximum top-level split segments processed from one `source_term`: `12`
- maximum emitted phrases per `source_term` (including the original): `12`

These limits are part of the versioned `norm_v2` ruleset behavior.

## Intended outcomes

Examples:

- `a) bon travail! (une salutation ...), b) merci! (pour un travail)`
  emits additive phrases including:
  - the full original string
  - `bon travail`
  - `merci`

- `bon réveil! (lit : que tu sortes de la nuit!)`
  emits additive phrases including:
  - the full original string
  - `bon réveil`

## Non-goals

`norm_v2` does not:

- generate single-word tokens from every phrase
- rank derived phrases
- infer synonyms
- change frontend query semantics
- mutate frozen `norm_v1` artifacts in place
