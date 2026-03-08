# Normalization rules versioning strategy (v1)

This document defines how SiraLex performs **normalization** while preserving:

- Maninka-first linguistic humility (no invented language)
- provenance + traceability
- stable offline search behavior
- **no silent mutation** when rules change

It is **stack-neutral**: it specifies contracts and invariants, not implementation.

## Goals

- Define what “normalization” means in this project (and what it does not mean).
- Make normalization **deterministic and versioned** (`norm_v1`, `norm_v2`, …).
- Support **diacritics-insensitive search** without destroying display forms.
- Preserve variants and mark preferred forms without collapsing diversity.

## Non-goals

- Hardcoding linguistic assumptions (tone/length rules, etc.) inside code.
- Declaring a single “correct” orthography for Maninka.
- Mutating previously-produced normalized outputs in place.

## Core principle: separation of concerns

Normalization MUST separate:

- **Display forms**: what we show users (faithful to source + editorial corrections)
- **Search keys**: derived representations used for matching/indexing
- **Identity pointers**: stable record pointers/provenance anchors (never derived from normalized text alone)

Normalization must never overwrite evidence (snapshots/IR) or hide uncertainty.

## What counts as “normalization” (Phase 1)

Normalization is a **derived layer** applied to IR to produce stable search/display affordances.

Examples of Phase 1 normalization outputs:

- **Search keys**:
  - diacritics-insensitive key(s)
  - punctuation/whitespace-normalized key(s)
  - case-normalized key(s) (where applicable)
- **Variant handling metadata**:
  - detect and preserve spelling variants
  - mark a preferred form (source-provided or editorial)
- **POS mapping** (optional, best-effort) according to `shared/specs/pos-tagset.md`

Normalization must not:

- invent tones/length/nasalization that are not in the source
- collapse two distinct forms into one “canonical” display form

## Versioning model

Normalization rules MUST be grouped into explicit, immutable rulesets:

- `norm_v1`, `norm_v2`, …

Any normalized record MUST carry the ruleset used, e.g. via:

- `derivation.rule_versions.normalization = "norm_v1"`

Ruleset changes MUST be “append-only”:

- new ruleset version is created
- old rulesets remain available for audit and rebuilds

## No silent mutation (normative)

When a new normalization ruleset is introduced:

- previously-produced normalized outputs MUST NOT be modified in place
- instead, produce a new build/output set stamped with the new ruleset version

This supports reproducibility and preserves trust.

## Determinism requirements

For a fixed inputs set:

- IR unit(s)
- correction records (RFC 6902 patches) that apply
- normalization ruleset version (`norm_vN`)

…normalization output MUST be deterministic:

- same inputs → same outputs

If a rule depends on a mapping table, that table MUST be part of the versioned ruleset artifact.

## Search-key strategy (Phase 1)

### Multiple keys, not one

Records SHOULD store multiple search keys rather than one “magic” normalized string, e.g.:

- `search_key_diacritics_insensitive`
- `search_key_whitespace_normalized`
- `search_key_stripped_punct`

This keeps behavior explicit and testable.

For maximal stack-neutrality, keys MAY be stored as a map/object (e.g., `search_keys.{name} = value`) rather than fixed columns/fields.

### Diacritics-insensitive keys

We support “written search ignores diacritics/tone but displays them when available”.

Normative expectations:

- Keys SHOULD be computed by removing/normalizing diacritics in a deterministic way.
- Keys MUST NOT be used as display forms.
- If a source lacks diacritics, we do not “add” them in normalization.

### Normative algorithms (Phase 1)

This section exists to prevent “spec-compliant divergence” across implementations.

#### Unicode normalization baseline

Unless otherwise specified by a given ruleset (`norm_vN`), all search-key transforms MUST treat strings as Unicode and MUST be defined in terms of Unicode operations (not locale-specific rules).

For **N’Ko** keys, `norm_v1` MUST apply **NFC** before any other transform.

#### Diacritics stripping (normative)

For keys described as “diacritics-insensitive”, `norm_v1` MUST use this algorithm:

1. Apply Unicode normalization form **NFD** to the input string.
2. Remove all code points with Unicode General Category in:
   - `Mn` (Nonspacing Mark)
   - `Mc` (Spacing Mark)
   - `Me` (Enclosing Mark)
3. Apply Unicode normalization form **NFC** to the result.

If `norm_v(N+1)` needs exceptions (e.g., preserve a mark in a specific context), those exceptions MUST be explicitly listed as part of the `norm_v(N+1)` ruleset artifact (see “Ruleset artifact composition”).

#### Whitespace normalization (normative)

For keys described as “whitespace-normalized”, `norm_v1` MUST:

1. Replace any Unicode whitespace sequence with a single ASCII space (`U+0020`).
2. Trim leading/trailing spaces.

#### Punctuation normalization (normative)

Because “punctuation/whitespace-normalized” is otherwise ambiguous, `norm_v1` defines two distinct key behaviors:

- **punctuation_to_space**: replace any character with Unicode General Category starting with `P` (any punctuation) with a single ASCII space (`U+0020`), then apply Whitespace normalization.
- **punctuation_stripped**: delete any character with Unicode General Category starting with `P`, then apply Whitespace normalization.

Implementations MUST NOT invent additional punctuation heuristics (e.g., French elision handling) unless those rules are explicitly specified and versioned in the active `norm_vN` ruleset.

#### Apostrophes (normative key guidance)

Apostrophes are a known “landmine” across Maninka Latin orthographies and French typing habits, so `norm_v1` MUST support at least two distinct keys:

- an **apostrophe-preserving key** (do not treat apostrophes as punctuation; preserve them through punctuation transforms)
- an **apostrophe-insensitive key** computed using one of the punctuation behaviors above (`punctuation_to_space` or `punctuation_stripped`)

This avoids forcing a single apostrophe policy while remaining deterministic and versioned.

#### Case normalization boundaries (normative)

Case behavior MUST be explicit per script:

- **Latin script**: apply Unicode casefold to compute case-insensitive keys.
- **N’Ko script**: case normalization is a no-op (unchanged).
- **Other scripts**: MUST be explicitly specified by the active `norm_vN` ruleset (otherwise unchanged).

#### Multiword expressions (PHRASE) keys (normative)

For multiword expressions, `norm_v1` MUST support both behaviors by producing two keys:

- a **spaced key** (spaces preserved after Whitespace normalization)
- a **no-space key** (spaces removed after Whitespace normalization), to support common “phone typing” habits

If an implementation chooses to store fewer keys, that decision MUST be documented at the storage layer; the normalization ruleset definition remains normative about how keys are computed.

## Ruleset artifact composition (normative)

If a normalization rule depends on any auxiliary data (mapping tables, exception lists, frequency lists, etc.), that data MUST be part of the versioned ruleset artifact and treated as immutable.

`norm_vN` MUST be distributable as a self-contained artifact such as:

- a directory (or equivalent bundle) containing:
  - a machine-readable **manifest** (YAML or JSON)
  - any required mapping/exception data files referenced by the manifest

The manifest MUST include:

- `ruleset_id` (e.g. `norm_v1`)
- a changelog or `description`
- cryptographic hashes (e.g. sha256) for each referenced data file

This prevents stashing “just a small table” inside code without it being versioned as part of the ruleset.

## Variants vs preferred

Normalization MUST support:

- preserving multiple orthographic variants for the same lexeme
- marking a preferred form without deleting variants

Preferred form selection:

- MAY follow the source’s own “preferred” marker if present
- MAY follow editorial corrections (separate correction records)
- MUST be transparent and versioned (selection rules belong to `norm_vN`)

Preferred selection MUST NOT depend on mutable global statistics (e.g., corpus frequency) unless the statistics dataset is itself:

- versioned, immutable, and included in the active `norm_vN` ruleset artifact, and
- referenced by hash in the ruleset manifest

## Interaction with corrections (RFC 6902)

Corrections are applied as separate correction records (see lossless spec).

Normalization MUST define the evaluation order:

1. start from IR-derived base record(s)
2. apply approved correction patches (RFC 6902) to the relevant scope
3. compute normalization outputs (search keys, variant/preferred markers) under `norm_vN`

## Interaction with provenance and record pointers

Normalization MUST preserve provenance:

- provenance fields come from IR and source registry
- normalization MUST stamp `derivation.rule_versions.normalization = "norm_vN"`
- if a record includes normalization-derived fields (e.g., search keys, variant/preferred markers), `derivation.kind` SHOULD be `normalized` to align with `shared/specs/provenance.md`

Normalization MUST NOT change:

- `provenance.source.record_pointer` identity semantics
- snapshot/fragment anchors

## Rollout / upgrade procedure (recommended)

When proposing `norm_v(N+1)`:

- include a written changelog: what behavior changes and why
- provide a fixture set of representative examples (inputs → outputs)
- run the ruleset on the fixture set and review diffs
- only then publish the new ruleset as the current default

## Minimal metadata contract (summary)

Normalized records SHOULD be able to carry:

- `derivation.rule_versions.normalization = "norm_vN"`
- display forms (from source/IR + corrections)
- explicit search keys (derived)
- variant/preferred markers (derived)

