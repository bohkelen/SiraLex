# Phase 7N2A Source-Record Audit

**Status:** read-only audit report only  
**Commit basis:** `f3fabbc` (Phase 7K1 triage specifications)  
**Norm version audited:** `norm_v3`  
**Implementation authorization:** not authorized

This report audits authoritative normalized/enriched source data and documented artifact-type boundaries to resolve how each approved 7N2A candidate should be implemented later. No source data, index, runtime code, catalog, bundle, package, or release document was modified.

---

## Audit Scope and Paths

Read-only searches were performed across:

| Path | Role |
| --- | --- |
| `data/ir/malipense_lexicon_v3.jsonl` | Frozen lexicon IR (8,823 entries) |
| `data/ir/malipense_index_v1.jsonl` | Frozen French→Maninka index IR (10,501 mappings) |
| `data/normalized/malipense_normalized_norm_v3.jsonl` | Authoritative normalized records (`norm_v3`) |
| `data/enriched/malipense_enriched_norm_v3.jsonl` | Authoritative enriched display projection (`norm_v3`) |
| `shared/aliases/source_aliases_v1.jsonl` | Existing approved source aliases (no 7N2A overlap) |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Existing approved supplements (no 7N2A overlap) |
| `shared/specs/source-alias-table-v1.md` | Source-alias artifact boundary |
| `shared/specs/source-index-supplement-v1.md` | Source-index supplement artifact boundary |
| `docs/SOURCES.md` | Source provenance policy |

Searches used exact-form matching, normalized `preferred_form` / `search_keys.casefold` matching, and substring scans for approved compound spellings. Generated bundles under `web/public/`, `build/`, and `data/bundles/` were not used as audit authority.

---

## Lane-Title Editorial Correction

Record for the next authorized documentation update only. Do not modify existing Phase 7K1 files in this task.

```text
Current title:
7N2A — Common French Kinship and Health-Institution Retrieval Paths

Preferred title:
7N2A — Common Kinship and Health-Institution Retrieval Paths
```

Reason:

```text
The lane includes both French-side retrieval work and the target-side móbaa
variant. The preferred title describes the actual bounded scope without implying
that every intervention is French-source-only.
```

---

## Artifact-Type Decision Table

| Candidate | Exists in source data? | Canonical record ID(s) | Canonical form | Intended retrieval path | Recommended artifact type | Confidence | Blocking question |
| --------- | ---------------------- | ---------------------- | -------------- | ----------------------- | ------------------------- | ---------- | ----------------- |
| `maman` | No | None for `maman`; generic-mother targets under `mère`: `1079f8a9b2c15c7d`, `37cf4df5f441f7d1`, `bded2c40ba5bf5be`; index pointer `e8826` for `` `ná `` | French query `maman` → audited generic mother Maninka concept(s) linked to `mère` | `source_to_target` | `source_alias` | medium | Which audited generic-mother lexicon record(s) are primary for ranking among `bá`, `dénba`, `ná`, and the `` `ná `` pointer at `e8826`? |
| `móbaa` | No | Canonical concept: `c5f78c8ac66eac6b` (`móyibaa`) | Target query `móbaa` → same concept as `móyibaa` | `target_to_source` | `target_alias` | high | Confirm exact owner-approved spelling, tones, and NFC/NFD representation of `móbaa` before alias row authoring. |
| `móyibaa` | Yes | `c5f78c8ac66eac6b` | `móyibaa` | `target_to_source` | `no_change` | high | None for record existence; `móbaa` variant work must not create a separate concept. |
| `ndándayoro` | No | None | Approved owner form `ndándayoro` | French health-institution retrieval after record addition | `canonical_source_record_addition` | high | Confirm exact orthography, tones, glosses, literal decomposition, and provenance before any lexical addition. |
| `ndándadiya` | No | None | Approved owner form `ndándadiya` | French health-institution retrieval after record addition | `canonical_source_record_addition` | high | Same as `ndándayoro`; do not infer from unrelated `díya` place senses. |
| `hôpital` | Yes | Index `61843e6630c1fbae` → lexicon `71e323e2dafa590f` (`dándaso`) | French `hôpital` → `dándaso` | `source_to_target` | `no_change` | high | After approved compounds exist, should `hôpital` use `additive_source_mapping` only, without replacing `dándaso`? |
| `clinique` | No | None for French term; no approved Maninka compound yet | French `clinique` → reviewed health-institution target(s) | `source_to_target` | `canonical_source_record_addition` then `source_index_supplement` | medium | Record addition must precede index support; confirm whether `ndándadiya` alone is the intended target. |
| `centre de santé` | No | None | French `centre de santé` → reviewed health-institution target(s) | `source_to_target` | `canonical_source_record_addition` then `source_index_supplement` | medium | Multi-word French retrieval is allowed only for this health-institution path; confirm exact target mapping after source-record addition. |
| `mère` | Yes | Index `e5164efcdf5e6ca4`; competing phrase/index rows `0f517a71c373f51d`, `d540716db9321a83` | French `mère` | `source_to_target` audit context only | `no_change` | high | Which generic-mother lexicon record is the ranking anchor for future `maman` work, and how should `` `ná ``/`e8826` be handled given no lexicon-entry row in `malipense_lexicon_v3.jsonl`? |

---

## Per-Candidate Audit Detail

### `maman`

| Field | Audit result |
| --- | --- |
| Exact source-data paths searched | `data/ir/malipense_index_v1.jsonl`, `data/ir/malipense_lexicon_v3.jsonl`, `data/normalized/malipense_normalized_norm_v3.jsonl`, `data/enriched/malipense_enriched_norm_v3.jsonl` |
| Exact matching record ID(s) | None for `maman` |
| Canonical French form | Absent |
| Canonical Maninka form | None directly for `maman`; intended generic-mother targets currently reached only through `mère` index posting `e5164efcdf5e6ca4` |
| Unicode normalization form | N/A for missing French form |
| Tone-mark representation | N/A |
| Semantic/gloss fields available | None for `maman`; generic-mother glosses exist on target lexicon entries below |
| Already exists? | No |
| Classification | Existing canonical mother concept needing French source alias/index support |

Related audited generic-mother targets currently posted under `mère`:

| Lexicon `ir_id` | Source record | Canonical Maninka form | NFC casefold key | Gloss / semantics |
| --- | --- | --- | --- | --- |
| `1079f8a9b2c15c7d` | `e177` | `bá` | `bá` | `gloss_fr: mère`; also `madame` and animal-mother senses in same entry |
| `37cf4df5f441f7d1` | `e2655` | `dénba` | `dénba` | `gloss_en: mother`; literal `( enfant mère )` |
| `bded2c40ba5bf5be` | `e6468` | `ná` | `ná` | `gloss_en: mother` |
| index pointer only | `e8826` | `` `ná `` | not present as lexicon entry in `malipense_lexicon_v3.jsonl` | referenced from index only |

Recommended bounded path: `source_alias` for missing French common form `maman`, copying only the audited `mère` index posting `e5164efcdf5e6ca4` rather than every `mère`-related phrase row. Do not route to `oh, mère!` (`0f517a71c373f51d` → `wóyì`) or respectful-address homonyme (`d540716db9321a83` → `tɔ́ɔma`).

---

### `móbaa`

| Field | Audit result |
| --- | --- |
| Exact source-data paths searched | all authoritative paths listed above |
| Exact matching record ID(s) | None |
| Canonical French form | N/A (target-side candidate) |
| Canonical Maninka form | Absent; owner-approved variant of existing `móyibaa` |
| Unicode normalization form | Absent; future alias must record audited NFC/NFD form explicitly |
| Tone-mark representation | Absent; must be chosen during implementation review |
| Semantic/gloss fields available | None for `móbaa` |
| Already exists? | No |
| Classification | Existing canonical concept needing target-side variant support |

Canonical concept anchor:

| Lexicon `ir_id` | Source record | Canonical Maninka form | NFC casefold key | Gloss / semantics |
| --- | --- | --- | --- | --- |
| `c5f78c8ac66eac6b` | `e6353` | `móyibaa` | `móyibaa` | `gloss_en: parent`; literal `( naître *agent occasionnel )`; synonyms `dònko` |

Recommended bounded path: `target_alias` only, pointing `móbaa` to `c5f78c8ac66eac6b`. Do not create a separate unrelated lexical concept.

---

### `móyibaa`

| Field | Audit result |
| --- | --- |
| Exact source-data paths searched | all authoritative paths listed above |
| Exact matching record ID(s) | `c5f78c8ac66eac6b` |
| Canonical French form | N/A as headword; reached from French `parent` via index `5437cc8267a78303` |
| Canonical Maninka form | `móyibaa` |
| Unicode normalization form | preferred `móyibaa`; casefold `móyibaa`; diacritics-insensitive `moyibaa` |
| Tone-mark representation | `ó` high tone on first vowel; `y`, `i`, `aa` preserved |
| Semantic/gloss fields available | `gloss_en: parent`; literal `( naître *agent occasionnel )`; synonym `dònko` |
| Already exists? | Yes |
| Classification | Existing canonical concept; no direct change required |

Recommended bounded path: `no_change`.

---

### `ndándayoro`

| Field | Audit result |
| --- | --- |
| Exact source-data paths searched | all authoritative paths listed above |
| Exact matching record ID(s) | None |
| Canonical French form | None |
| Canonical Maninka form | None in canonical source data |
| Unicode normalization form | N/A |
| Tone-mark representation | N/A |
| Semantic/gloss fields available | Owner intent only: hospital / clinic / health centre |
| Already exists? | No |
| Classification | Missing lexical content requiring a reviewed source-record addition |

Nearest related existing health term:

| Lexicon `ir_id` | Canonical Maninka form | Gloss | Note |
| --- | --- | --- | --- |
| `71e323e2dafa590f` | `dándaso` | `gloss_en: hospital` | Existing hospital term already mapped from French `hôpital`; not equivalent to approved compound spellings |

Related but not semantically substitutable forms found:

| Lexicon `ir_id` | Form | Gloss | Why not a substitute |
| --- | --- | --- | --- |
| `7cee636745c067f2` | `jɔ́rɔ` | fish-gig | unrelated meaning |
| `de6fb406453616e3` | `díya` | place, endroit | broad place sense; must not become `yoro → place` expansion |

Recommended bounded path: `canonical_source_record_addition`. Do not disguise absence with alias or supplement rows.

---

### `ndándadiya`

| Field | Audit result |
| --- | --- |
| Exact source-data paths searched | all authoritative paths listed above |
| Exact matching record ID(s) | None |
| Canonical French form | None |
| Canonical Maninka form | None in canonical source data |
| Unicode normalization form | N/A |
| Tone-mark representation | N/A |
| Semantic/gloss fields available | Owner intent only: hospital / clinic / health centre |
| Already exists? | No |
| Classification | Missing lexical content requiring a reviewed source-record addition |

Recommended bounded path: `canonical_source_record_addition`. Same constraints as `ndándayoro`.

---

### `hôpital`

| Field | Audit result |
| --- | --- |
| Exact source-data paths searched | all authoritative paths listed above |
| Exact matching record ID(s) | index `61843e6630c1fbae`; target lexicon `71e323e2dafa590f` |
| Canonical French form | `hôpital` |
| Canonical Maninka form | `dándaso` |
| Unicode normalization form | French casefold `hôpital`; target preferred `dándaso`; casefold `dándaso` |
| Tone-mark representation | `á` on first syllable of `dándaso` |
| Semantic/gloss fields available | `gloss_en: hospital`; literal `( soigner village )` |
| Already exists? | Yes |
| Classification | Existing source form with current single-target mapping |

Current posting copies exactly:

```text
hôpital -> dándaso
```

Approved compounds `ndándayoro` and `ndándadiya` are absent and therefore not semantically attachable yet. Future work, if owner-approved after record addition, should use `additive_source_mapping` only.

Recommended bounded path: `no_change` now.

---

### `clinique`

| Field | Audit result |
| --- | --- |
| Exact source-data paths searched | all authoritative paths listed above |
| Exact matching record ID(s) | None |
| Canonical French form | Absent |
| Canonical Maninka form | No approved compound present yet |
| Unicode normalization form | N/A |
| Tone-mark representation | N/A |
| Semantic/gloss fields available | Owner intent only |
| Already exists? | No |
| Classification | Missing lexical content requiring reviewed source-record addition, then French index support |

Recommended bounded path:

1. `canonical_source_record_addition` for reviewed Maninka health-institution compound(s), likely including `ndándadiya` if owner orthography is confirmed.
2. `source_index_supplement` with `new_source_mapping` for French `clinique` after lexical records exist.

---

### `centre de santé`

| Field | Audit result |
| --- | --- |
| Exact source-data paths searched | all authoritative paths listed above |
| Exact matching record ID(s) | None |
| Canonical French form | Absent |
| Canonical Maninka form | No approved compound present yet |
| Unicode normalization form | N/A |
| Tone-mark representation | N/A |
| Semantic/gloss fields available | Owner intent only |
| Already exists? | No |
| Classification | Missing lexical content requiring reviewed source-record addition, then French index support |

Recommended bounded path:

1. `canonical_source_record_addition` for reviewed Maninka health-institution compound(s).
2. `source_index_supplement` with `new_source_mapping` for multi-word French `centre de santé` after lexical records exist.

This is not phrase translation. It is a reviewed health-institution retrieval term only.

---

### `mère`

| Field | Audit result |
| --- | --- |
| Exact source-data paths searched | all authoritative paths listed above |
| Exact matching record ID(s) | primary index `e5164efcdf5e6ca4`; phrase/index competitors `0f517a71c373f51d`, `d540716db9321a83` |
| Canonical French form | `mère` |
| Canonical Maninka forms posted | `bá`, `dénba`, `ná`, `` `ná `` |
| Unicode normalization form | French casefold `mère`; diacritics-insensitive `mere` |
| Tone-mark representation | target forms preserve source tones as above |
| Semantic/gloss fields available | see generic-mother targets and competing rows below |
| Already exists? | Yes |
| Classification | Audit context only; no implementation in this task |

#### Generic mother posting under `mère`

Index `e5164efcdf5e6ca4` (`source_term: mère`) posts to:

| Target anchor | Lexicon `ir_id` if resolved | Form | Role |
| --- | --- | --- | --- |
| `e177` | `1079f8a9b2c15c7d` | `bá` | generic mother / madame senses |
| `e2655` | `37cf4df5f441f7d1` | `dénba` | mother |
| `e6468` | `bded2c40ba5bf5be` | `ná` | mother |
| `e8826` | not present in `malipense_lexicon_v3.jsonl` | `` `ná `` | index pointer only |

#### Competing vocative / respectful-address records surfaced in structured evidence

These are separate source-index rows and must not be treated as generic-mother aliases for `maman`:

| Index `ir_id` | French source term | Target | Role |
| --- | --- | --- | --- |
| `0f517a71c373f51d` | `oh, mère!` | `wóyì` (`f365eb712b295a4a`) | vocative / interjection |
| `d540716db9321a83` | `homonyme de mon père/mère (...)` | `tɔ́ɔma` (`c5a892a194fbf249`) | respectful-address formula |

Recommended bounded path: `no_change`. This audit informs future `maman` ranking only.

---

## Explicit Exclusions Confirmed

The following were not audited for implementation and remain deferred or out of scope:

```text
Kun / kùn / kún
sɛn / sen
global tone-insensitive search
global vowel folding
phrase translation
moto
bonjour
n fa / n'fa
runtime similar-spelling UI
catalog publication
bundle/package generation
release-status changes
```

7N2B remains deferred.

---

## Implementation Boundary

This audit distinguishes:

| Situation | Correct later artifact |
| --- | --- |
| missing French common form with existing mother posting | `source_alias` |
| missing French index term with no source mapping | `source_index_supplement` after lexical targets exist |
| missing Maninka compound approved by owner | `canonical_source_record_addition` |
| approved target-side spelling variant of existing concept | `target_alias` |
| existing canonical record or posting | `no_change` |

No retrieval behavior has changed. A separate implementation authorization is required before any artifact edit, index rebuild, bundle generation, or release action.
