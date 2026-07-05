# Phase 7K1 Structured Usability Triage

**Status:** triage and specification record only  
**Authoritative run:** `usage_2026-07-02T22-26-48-625Z`  
**Featured package candidate:** `bundle_full_20260616_phase7j_alias_round2_candidate`  
**Evidence scope:** structured usability evidence only  
**Implementation authorization:** not authorized

This document converts the corrected structured-usability review into a bounded intervention backlog. It does not authorize search-runtime changes, dictionary-record edits, source-index edits, package rebuilds, catalog publication, bundle publication, Phase 7L artifact changes, or release-status changes.

Structured-usability recurrence values are scenario/cohort recurrence values only. They must not be used as real user frequency, demand ranking, popularity evidence, or automatic lexical-expansion evidence.

---

## Evidence Sources

| Evidence artifact | Role |
|---|---|
| `data/local_evidence/human_usage_automation/candidate_rebuild_structured_usability_evidence_corrected_20260702.json` | Structured row payloads and result excerpts |
| `data/local_evidence/human_usage_automation/candidate_rebuild_structured_usability_evidence_corrected_20260702.jsonl` | One-row-per-event structured evidence |
| `data/local_evidence/human_usage_automation/candidate_rebuild_structured_usability_evidence_corrected_20260702.md` | Human-readable corrected evidence table |

The run installed the local package candidate once and reported:

```text
Install source: package
Installed bundle: bundle_full_20260616_phase7j_alias_round2_candidate
Installed records/index entries: 19328 / 112233
Active dictionary: Using: French <-> Maninka - ready to search
Can influence demand: false
```

---

## Required Row Audit

Each row below is structured-only evidence from the authoritative run. "Actual issue classification" records the Phase 7K1 interpretation, not necessarily the raw evidence `issue_class`.

| Query | Evidence row | Search direction | Observed result | Actual issue classification | Structured-only | Owner disposition | Lane | Why bounded |
|---|---:|---|---|---|---|---|---|---|
| `tête` | JSON line 134 / MD line 22 | `source_to_target` | `hit_single`, 1 result; entry `tête`; translations `kùn`, `sála` | no issue observed | yes | no change | none | Baseline French body lookup only; no intervention inferred. |
| `Kùn` | JSON lines 180, 1526, 2270, 2503, 3057 / MD lines 23, 52, 68, 73, 85 | `target_to_source` | `hit_multi`, 2 results for `kùn`: meanings `à` and `tête`; one offline reopen row also returned 2 results | target-side tonal ambiguity and result interpretability | yes | do not merge; specify discovery behavior | 7N2B | Limited to exact-primary plus separately labeled similar spellings; no equivalence rule. |
| `Kun` | JSON lines 226, 1480 / MD lines 24, 51 | `target_to_source` | `hit_single`, 1 result; found `kún`; meaning `avoir de la place` | target-side tonal ambiguity and result interpretability | yes | do not merge; specify discovery behavior | 7N2B | Distinguishes unaccented query recovery from synonymy; preserves tone distinctions. |
| `kùn` | JSON line 878 / MD line 38 | `target_to_source` | `hit_multi`, 2 results for `kùn`: meanings `à` and `tête` | target-side tonal ambiguity and result interpretability | yes | do not merge; specify discovery behavior | 7N2B | Does not flatten competing current meanings into one lexical concept. |
| `kùn` | JSON line 1155 / MD line 44 | `target_to_source` | `hit_multi`, 2 results for decomposed Unicode query; meanings `à` and `tête` | Unicode normalization check plus target-side ambiguity | yes | preserve NFC/NFD equivalence; do not merge lexical meanings | 7N2B | Bounded to normalization evidence and interpretability; no new aliases. |
| `papa` | JSON line 1294 / MD line 47 | `source_to_target` | `hit_single`, 1 result; entry `papa`; translations `bàba`, `bàwa` | existing hit | yes | no lexical change | none | The informal French form already retrieves a result. |
| `père` | JSON line 1340 / MD line 48 | `source_to_target` | `hit_single`, 1 result; entry `père`; translation `fà` | existing hit; grammar boundary resolved | yes | no lexical change; do not route `père` to `n fa` / `n'fa` | none | Source query was `père`, not `mon père`; possessive phrase handling is out of scope. |
| `maman` | JSON line 1667 / MD line 55 | `source_to_target` | `miss`; no results for `maman` | French common-form source alias plus result ranking | yes | approved for specification | 7N2A | Limited to one common French kinship retrieval path and ranking against audited mother records. |
| `mère` | JSON line 1713 / MD line 56 | `source_to_target` | `hit_multi`, 3 results; `oh, mère!` -> `wóyì`; respectful-address formula -> `tɔ́ɔma`; generic `mère` -> `bá`, `dénba`, `ná`, `` `ná`` | ranking issue for generic mother path | yes | approved only as ranking/context evidence for `maman` | 7N2A | Requires exact canonical target record or record IDs after source-record audit; no alias to every current `mère` result. |
| `sɛn` | JSON line 2130 / MD line 65 | `target_to_source` | `hit_single`, 1 result; found `sɛ́n`; meaning `passerelle` | target-side orthographic/phonemic distinction | yes | do not aggregate with `sen`; specify discovery behavior | 7N2B | Exact match remains primary and any similar form is separately labeled. |
| `Sen` | JSON lines 553, 2176 / MD lines 31, 66 | `target_to_source` | `hit_single`, 1 result; N2 row found `sèn`; meaning `pied, jambe` | target-side orthographic/phonemic distinction | yes | do not aggregate with `sɛn`; specify discovery behavior | 7N2B | Maintains distinct meanings; no dictionary-alias change. |
| `sen` | No lowercase exact row; reviewed through `Sen` rows and owner-provided distinction | `target_to_source` | Evidence uses `Sen`; current interpreted form is `sèn` with meaning `pied, jambe` | target-side orthographic/phonemic distinction | yes | do not aggregate with `sɛn`; specify discovery behavior | 7N2B | Treats lowercase `sen` as the conceptual probe for plain Latin `Sen`, not as separate demand evidence. |
| `parent` | JSON line 2919 / MD line 82 | `source_to_target` | `hit_single`, 1 result; translations `dònko`, `móyibaa` | existing hit; target variant candidate context | yes | `móbaa` approved by owner as target-side variant of `móyibaa` | 7N2A | Variant work is limited to the canonical `móyibaa` concept after source-record audit. |
| `hôpital` | JSON line 3011 / MD line 84 | `source_to_target` | `hit_single`, 1 result; translation `dándaso` | existing health-institution hit; coverage context for approved compounds | yes | `ndándajoro` / `ndándadiya` approved for specification | 7N2A | Limited to health-institution retrieval terms; no broad place/location expansion. |
| `moto` | JSON line 1620 / MD line 54 | `source_to_target` | `miss` after successful offline reopen; no results for `moto`; `offline_reopen_checked: true` | missing lexical content or source-index gap; not offline-install reliability | yes | pending linguistic/product review | backlog | Reclassified only; no content addition or offline-runtime fix authorized. |
| `bonjour` | JSON line 2872 / MD line 81 | `source_to_target` | `miss` after successful offline reopen; no results for `bonjour`; `offline_reopen_checked: true` | missing lexical content or source-index gap; not offline-install reliability | yes | pending linguistic/product review | backlog | Reclassified only; no greeting content addition or offline-runtime fix authorized. |
| `how do you say thank you` | JSON line 2826 / MD line 80 | `source_to_target` | automation `error`; last meta already said "No exact result for this expression. Try one word at a time." | `automation_harness_observability_defect`; secondary product-copy/onboarding observation; not a failed lookup engine result | yes | separate from product dictionary behavior | harness backlog | Bounded to harness observability and later copy review; no runtime lookup change. |

---

## Corrected Reclassifications

### `moto` and `bonjour`

The evidence rows for `moto` and `bonjour` were originally labeled like offline-install reliability concerns because they occurred inside offline-check tasks. Phase 7K1 reclassifies both as:

```text
missing lexical content or source-index gap
pending linguistic/product review
not offline-install reliability
```

Both rows explicitly record `offline_reopen_checked: true`, and both observed misses after the app reopened. That means the local package installation and offline reopen path had already proceeded far enough for a lookup to run.

### Offline Reopen Worked

Successful offline-reopen evidence must be kept separate from lexical misses:

| Query | Evidence row | Observed result |
|---|---:|---|
| `école` | JSON line 320 / MD line 26 | `hit_single`; after offline reopen: 1 result for `école` |
| `riz` | JSON line 645 / MD line 33 | `hit_single`; after offline reopen: 1 result for `riz` |
| `manger` | JSON line 970 / MD line 40 | `hit_single`; after offline reopen: 1 result for `manger` |
| `écrire` | JSON line 1247 / MD line 46 | `hit_single`; after offline reopen: 1 result for `écrire` |
| `eau` | JSON line 1945 / MD line 61 | `hit_single`; after offline reopen: 1 result for `eau` |
| `travail` | JSON line 2595 / MD line 75 | `hit_single`; after offline reopen: 1 result for `travail` |

These rows are proof that the package installation and offline reopen path worked in the Chromium automation environment. They are not evidence that every lexical query should hit.

### `how do you say thank you`

This is not a product dictionary failure. The app had already reached the expected phrase-miss state:

```text
No exact result for this expression. Try one word at a time.
```

The automation then timed out waiting for metadata to settle. Phase 7K1 classifies this as:

```text
automation_harness_observability_defect
secondary product-copy/onboarding observation
not a failed lookup engine result
```

No runtime code change is authorized in this task.

---

## Decision Table

| Finding | Correct class | Owner decision | Lane | Status |
|---|---|---|---|---|
| `maman` | French source alias + ranking | approved | 7N2A | ready for source audit |
| `papa` / `père` / `n fa` | grammar boundary | no change | none | resolved |
| `móbaa` | target-side variant | approved | 7N2A | ready for source audit |
| `ndándajoro` | health-institution coverage | approved | 7N2A | ready for source audit |
| `ndándadiya` | health-institution coverage | approved | 7N2A | ready for source audit |
| `Kun` / `kùn` / `kún` | tonal ambiguity | do not merge | 7N2B | specified, deferred |
| `sɛn` / `sen` | orthographic distinction | do not merge | 7N2B | specified, deferred |
| phrase-like searches | product-boundary mismatch | onboarding later | 7N2C | deferred |
| `moto` / `bonjour` | lexical coverage issue | reclassified | backlog | pending review |
| harness timeout | automation issue | separate from product | harness backlog | pending review |

---

## Approved 7N2A Dispositions

### `maman`

```text
issue_type: French common-form source alias + result ranking
intervention_lane: 7N2A
status: approved_for_specification
```

Required intended behavior:

```text
French query: maman
-> returns the generic mother lexical sense
-> generic mother sense is ranked before vocative/interjection and respectful-address senses
-> result clearly remains connected to "mère"
```

Do not directly alias `maman` to every result currently returned under `mère`. The 7N2A specification requires an exact canonical target record or record IDs to be selected after source-record audit.

### `papa`, `père`, `fà`, and `n fa`

Phase 7K1 records:

```text
papa -> existing hit
père -> existing hit
fà -> existing lexical father form
n fa / n'fa -> "my father"; separate possessive phrase, not a synonym of père
```

Disposition:

```text
No 7N2A lexical change required for n fa / n'fa.
Do not create a "my father" result from a search for père.
Do not add n fa under papa.
```

The source query in the evidence was `père`, not `mon père`; the reviewed concern is resolved without implementation.

### `móbaa`

The project owner has given native-speaker confirmation:

```text
móbaa is an approved target-side variant of móyibaa.
It has the same intended meaning and tone.
The variant removes "yi" from the middle of móyibaa.
```

Disposition:

```text
issue_type: target-side lexical variant
intervention_lane: 7N2A
status: approved_for_specification
```

Required intended behavior:

```text
target query: móbaa
-> retrieves the same canonical lexical concept currently represented by móyibaa
-> does not create a separate unrelated concept
```

Before any future implementation, audit the exact canonical spelling, Unicode normalization, tones, and relevant record ID from the source data. Owner approval establishes semantic equivalence; source audit establishes the precise technical representation.

### `ndándajoro` and `ndándadiya`

The project owner has given lexical intent:

```text
ndándajoro
ndándadiya
-> hospital / clinic / health centre
-> locations where health-related service is received
```

Disposition:

```text
issue_type: health-institution lexical/index coverage
intervention_lane: 7N2A
status: approved_for_specification
```

Required French lookup targets, subject to source-record audit:

```text
hôpital
clinique
centre de santé
```

Do not create a general relationship:

```text
joro -> place
```

Do not add these under broad French lookup `place` or `location` merely because a component can carry a place-related meaning. Do not add speculative English labels, broad geographic/place labels, or additional compounds.

---

## Approved 7N2B Dispositions

### `Kun`, `kùn`, and `kún`

The review confirms that tonal distinctions must be preserved. Evidence currently indicates different lexical results, including:

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

### `sɛn` and `sen`

Do not aggregate or normalize away the distinction. The evidence indicates:

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

This is not a 7N2A dictionary-alias change.

---

## Deferred Phrase-Like Searches

Examples include:

```text
comment dit-on école
combien ça coûte
mon enfant est malade
merci beaucoup
je t'aime
viens ici
```

Disposition:

```text
issue_type: product-boundary / onboarding clarity
intervention_lane: later 7N2C
status: deferred
```

These are not automatic phrase-content additions. The existing dictionary is lemma-oriented, not a general sentence translator.

Future copy direction only:

```text
This dictionary searches individual words.
Try a key word, for example: école, coûte, malade, merci.
```

This copy is not implemented in Phase 7K1.

---

## Bounded Backlog

### 7N2A - Common French Kinship and Health-Institution Retrieval Paths

Allowed scope:

```text
maman
móbaa
ndándajoro
ndándadiya
French retrieval terms: hôpital, clinique, centre de santé
```

Explicitly excluded scope:

```text
global tone-insensitive matching
kun/kùn/kún ambiguity behavior
sɛn/sen ambiguity behavior
phrase translation
generic place/location expansions
n fa / n'fa phrase handling
all other structured-run lexical misses
ranking redesign outside the maman/mère path
```

Companion spec: `shared/specs/phase7n2a_common_kinship_aliases_v1.md`.

### 7N2B - Target-Side Similar-Spellings Discovery

Approved initial probes:

```text
Kun / kùn / kún
sɛn / sen
```

Central invariant:

```text
No automatic equivalence.
No silent merge.
Exact lexical match remains primary.
Potentially confusable forms appear only as separately labeled alternatives.
```

Companion spec: `shared/specs/phase7n2b_target_variant_discovery_v1.md`.
