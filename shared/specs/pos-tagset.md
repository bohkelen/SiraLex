# POS tagset & mapping policy (v1)

This spec defines SiraLex’s **internal part-of-speech (POS) tagset** and how we map source-specific labels into it.

It is **stack-neutral**: it describes required fields and behavior, not storage or implementation.

## Goals

- Provide a **small, familiar, non-committal** internal POS vocabulary for consistent UI/search.
- Preserve **source fidelity** by storing original POS labels (`pos_raw`) as the **epistemic anchor**.
- Keep POS **optional** and explicitly **non-authoritative** (best-effort metadata, not a linguistic claim).
- Make it possible to add new sources/dialects later without breaking the UI contract.

## Non-goals

- Declaring **UD (Universal Dependencies) compliance**.
- Inventing novel POS names or imposing a Euro-centric grammatical model on Maninka.
- Linguistically exhaustive POS modeling.
- Morphosyntactic feature systems (tense/aspect/noun class, etc.) — later.

## Internal tagset (v1)

If `pos` is present, it MUST be one of the following internal tags:

- `NOUN`
- `VERB`
- `ADP`
- `PART`
- `PHRASE`
- `OTHER`

These tags are intended to be:

- human-readable
- UI-friendly
- “ML-adjacent” without claiming ML semantics

### Definitions (pragmatic, non-authoritative)

- **`NOUN`**: noun-like lexemes (as described by the source)
- **`VERB`**: verb-like lexemes (as described by the source)
- **`ADP`**: *adpositions* (covers prepositions/postpositions without committing to one)
- **`PART`**: particles / clitics / function markers that aren’t well captured elsewhere
- **`PHRASE`**: multiword expressions, idioms, set phrases
- **`OTHER`**: fallback when the source POS is absent, unclear, or not safely mappable

## Required fields on normalized records

POS is optional. Any normalized lexical record MAY include POS metadata.

If POS metadata is present, records MUST include:

- **`pos_raw`**: the original POS label(s) from the source (string or list; nullable if the source does not provide POS)

Records MAY include:

- **`pos`**: one of the internal tags above (best-effort)
- **`pos_raw_source`**: optional short identifier of the source taxonomy (e.g. `"mali-pense"`)
- **`pos_is_derived`**: boolean; true when `pos` is derived from `pos_raw` via mapping rules (recommended)
- **`pos_uncertain`**: boolean; true when mapping is ambiguous or low-confidence (recommended)

If a source provides multiple POS labels for a single record:

- store all raw values in `pos_raw` (string or list, depending on eventual schema)
- if you provide `pos`, choose the best single internal tag following the mapping policy below
- if you cannot confidently choose, set `pos` to `OTHER` and mark `pos_uncertain: true` (or omit `pos` entirely)

## Mapping policy

### Principles

- **`pos_raw` is the anchor**: never discard or overwrite it.
- **Optional and humble**: `pos` is convenience metadata; it must never be treated as authoritative.
- **Prefer stability over nuance**: map into the coarse tagset; store nuance elsewhere later.
- **Be explicit about uncertainty**: if you cannot confidently map, use `OTHER` and/or set `pos_uncertain: true` (or omit `pos`).

### Versioning

POS mapping rules MUST be versioned (similar to normalization rules):

- Example version id: `posmap_v1`
- Normalized records SHOULD carry the version used, e.g. in `derivation.rule_versions.pos_mapping`.

Changes to mapping behavior must produce a new version (`posmap_v2`) rather than silently mutating existing data.

### Suggested mapping table shape (implementation-agnostic)

The mapping config SHOULD be representable as a table like:

- `match`: string/regex/synonym set (source labels)
- `maps_to`: internal POS
- `notes`: rationale

Example (illustrative):

| match (raw) | maps_to |
|---|---|
| `n.`, `nom`, `noun` | `NOUN` |
| `v.`, `verbe`, `verb` | `VERB` |
| `prep.`, `préposition`, `postp.`, `postposition` | `ADP` |
| `part.`, `particle` | `PART` |
| `loc.`, `expr.`, `idiome` | `PHRASE` |

## UI/display guidance (Phase 1)

- UI SHOULD treat `pos` as **optional** and **best-effort**.
- UI MAY display:
  - `pos` (if present and not `pos_uncertain`), and/or
  - a neutral fallback like “(source POS available)” linking to details.
- UI SHOULD prefer showing `pos_raw` in a “Source details” panel (especially when `pos_uncertain: true`).

## Future (Phase 3+): derived UD mapping layer

If we later add UD compatibility for ML tooling, it MUST be:

- explicitly labeled as **derived**
- clearly separated from the lexicographic record
- accompanied by a disclaimer like:
  - “Derived for ML compatibility; not a lexicographic claim.”

