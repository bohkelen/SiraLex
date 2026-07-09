# Phase 7N2B Target-Side Similar-Spellings Discovery v1

**Status:** specification only  
**Lane name:** `7N2B - Target-Side Similar-Spellings Discovery`  
**Source triage:** `docs/PHASE_7K1_STRUCTURED_USABILITY_TRIAGE.md`  
**Authoritative run:** `usage_2026-07-02T22-26-48-625Z`  
**Featured package candidate:** `bundle_full_20260616_phase7j_alias_round2_candidate`  
**Implementation authorization:** not authorized

This specification defines a future product/search behavior lane for target-side similar-spellings discovery. It does not authorize runtime search changes, dictionary alias changes, index changes, bundle rebuilds, catalog publication, or release-status changes.

---

## Central Invariant

```text
No automatic equivalence.
No silent merge.
Exact lexical match remains primary.
Potentially confusable forms appear only as separately labeled alternatives.
```

The lane exists to make distinct target-side forms discoverable without flattening tone, vowel, or orthographic distinctions into unsafe synonymy.

---

## Approved Initial Probes

```text
Kun / kùn / kún
sɛn / sen
```

These probes are approved for specification and deferred for future implementation planning. They are not part of 7N2A.

---

## Required Distinctions

Any future 7N2B design must distinguish the following concepts:

| Term | Meaning in this spec | Required behavior |
|---|---|---|
| exact match | The query matches a lexical form under the existing normalization rules for that form. | Show first as the primary result. |
| near spelling/tone variant | A different spelling, tone, vowel, or orthographic form that may be confused by a learner. | Show only in a separate secondary section. |
| same lexical concept | A reviewed variant known to represent the same lexical concept. | May be linked only after source-record audit and explicit approval in the appropriate lane. |
| different lexical concept | A form with a distinct meaning, even if visually or phonetically similar. | Must never be implied to be a synonym or equivalent. |

7N2B may surface alternatives for discovery, but it must preserve the exact result and label alternatives as distinct forms.

---

## Probe A: `Kun`, `kùn`, and `kún`

The structured evidence and owner review confirm that tonal distinctions must be preserved. Current observed behavior includes:

```text
kùn -> tête, with another competing meaning in current results
kun / kún -> avoir de la place
```

Disposition:

```text
issue_type: target-side tonal ambiguity and result interpretability
intervention_lane: 7N2B
status: approved_for_specification
```

Required future interaction model:

```text
Search query: Kun

Exact result
-> show the exact matched lexical item first

Similar spellings or tone variants
-> separate secondary section
-> list relevant distinct forms, such as kùn and kún
-> show enough label/context to indicate that they are different words
-> never imply that they are synonyms
```

Constraints:

- Do not create an alias that merges `kun`, `kùn`, and `kún`.
- Do not normalize tones away globally.
- Do not decide that multiple results for `kùn` are incorrect without source-record audit.
- Do not treat the unaccented form as demand evidence.

---

## Probe B: `sɛn` and `sen`

The evidence indicates:

```text
sɛn -> passerelle
sen -> pied, jambe
```

Disposition:

```text
issue_type: target-side orthographic/phonemic distinction
intervention_lane: 7N2B
status: approved_for_specification
```

Required future behavior:

```text
exact match remains primary
similar spelling section is secondary
no implication that sɛn and sen have the same meaning
```

Constraints:

- Do not aggregate or normalize away `ɛ` versus `e`.
- Do not add a dictionary alias between `sɛn` and `sen`.
- Do not reclassify this as 7N2A.
- Do not use structured recurrence values as demand ranking.

---

## Discovery Surface Requirements

A future 7N2B implementation, if separately authorized, must present alternatives in a way that avoids false equivalence:

```text
Primary result:
  exact lexical result for the query

Secondary section:
  Similar spellings or tone variants
  Each item must show its own form and enough meaning/context to show difference
```

The secondary section must not use labels such as "synonyms", "same word", or "also means" unless a separate source-record audit establishes same-concept status.

---

## Initial Probe Matrix

This matrix is a future validation contract for a separately authorized 7N2B implementation. It does not itself authorize edits.

| Regression case identifier | Probe query | Expected primary behavior | Expected secondary behavior | Explicit non-result / false-positive guard | Normalization form |
|---|---|---|---|---|---|
| `phase7n2b_kun_exact_primary` | `Kun` | Exact matched lexical item for `Kun` / audited `kún` path remains primary; current observed meaning is `avoir de la place` | Similar forms such as `kùn` may appear only in a separately labeled section | Must not imply `Kun`, `kùn`, and `kún` are synonyms | Query accepted as typed; canonical display and Unicode normalization require source audit |
| `phase7n2b_kun_tone_variant_secondary` | `kùn` | Exact `kùn` result remains primary; current observed results include `tête` and another competing meaning | `kún` / `Kun` may appear only as distinct similar spellings if discovery is enabled | Must not collapse competing `kùn` meanings or route all forms to `tête` | NFC target query; decomposed form covered separately |
| `phase7n2b_kun_decomposed_guard` | `kùn` | Decomposed Unicode query remains equivalent to canonical `kùn` for lookup normalization | Similar-spelling section, if present, follows the same labeling rules | Must not treat NFC/NFD equivalence as lexical synonym evidence | NFD input normalized for lookup; canonical display requires audit |
| `phase7n2b_kun_no_global_tone_fold` | unrelated target query with tone contrast | Exact match remains primary | No unrelated alternatives unless explicitly supported by future discovery rules | Must not introduce global tone-insensitive matching | Normalization rules must be documented and versioned |
| `phase7n2b_sen_epsilon_exact_primary` | `sɛn` | Exact `sɛn` / `sɛ́n` lexical item remains primary; current observed meaning is `passerelle` | `sen` may appear only as a separate similar spelling with distinct meaning/context | Must not imply `sɛn` and `sen` have the same meaning | NFC target query; canonical tone display requires source audit |
| `phase7n2b_sen_plain_exact_primary` | `sen` / `Sen` | Exact plain Latin `sen` / audited `sèn` path remains primary; current observed meaning is `pied, jambe` | `sɛn` may appear only as a separate similar spelling with distinct meaning/context | Must not normalize `ɛ` to `e` as equivalence | Case handling follows current target lookup; canonical display requires source audit |
| `phase7n2b_no_dictionary_alias_side_effect` | `sɛn`, `sen`, `Kun`, `kùn`, `kún` | Existing exact results remain available | Discovery alternatives, if implemented, remain secondary UI/search behavior | Must not create 7N2A aliases or source-index supplements | Existing normalization plus any future 7N2B normalization must be versioned |

---

## Out of Scope

7N2B excludes:

```text
7N2A kinship and health-institution retrieval paths
dictionary source-record edits
source alias additions
source-index supplements
phrase translation
product-copy implementation
global tone-insensitive matching
global vowel folding
automatic equivalence between target-side forms
bundle/package/catalog publication
Phase 7L artifact changes
release-status changes
```

---

## Required Future Review Gates

Before any 7N2B implementation:

1. Source-record audit confirms canonical spellings, meanings, tones, Unicode normalization, and record IDs for each probe.
2. Product design specifies exact primary and secondary labeling.
3. Maintainer explicitly authorizes runtime/search files allowed to change.
4. Regression tests prove exact-primary behavior and false-positive guards.
5. Release controls remain separate from implementation validation.

---

## Non-Automation Rule

This specification is for humans. No validator, applier, catalog builder, bundle builder, or runtime process may consume it to mutate dictionary source records, search indexes, generated bundles, generated packages, `web/public/`, catalog files, search runtime code, or release-decision documents.
