# Phase 7N2A Common French Kinship and Health-Institution Retrieval Paths v1

**Status:** specification only  
**Lane name:** `7N2A - Common French Kinship and Health-Institution Retrieval Paths`  
**Source triage:** `docs/PHASE_7K1_STRUCTURED_USABILITY_TRIAGE.md`  
**Authoritative run:** `usage_2026-07-02T22-26-48-625Z`  
**Featured package candidate:** `bundle_full_20260616_phase7j_alias_round2_candidate`  
**Implementation authorization:** not authorized

This specification defines the bounded 7N2A candidate set approved for future source-record audit and implementation planning. It is not a data artifact, alias table, source-index supplement, package manifest, catalog update, or runtime-search change.

---

## Evidence Boundary

7N2A uses structured-usability evidence only as triage evidence. It must not be used for demand ranking, popularity claims, or automatic lexical expansion.

Any future implementation must first audit source records for:

```text
exact canonical spelling
Unicode normalization
tone marks
record ID or record IDs
source provenance
target/source direction semantics
```

Owner approval establishes semantic intent for the approved candidates. It does not replace source-record audit or release authorization.

---

## Allowed Scope

7N2A is limited to:

```text
maman
móbaa
ndándajoro
ndándadiya
French retrieval terms: hôpital, clinique, centre de santé
```

No other structured-run miss or interpretability concern is part of this lane.

---

## Explicit Exclusions

7N2A explicitly excludes:

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

These exclusions are normative. A future implementation plan must fail review if it introduces any excluded behavior.

---

## Candidate Requirements

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

Implementation constraints:

- Do not directly alias `maman` to every result currently returned under `mère`.
- Select the exact canonical target record or record IDs only after source-record audit.
- Preserve the distinction between generic mother sense, vocative/interjection senses, and respectful-address senses.
- Do not redesign result ranking outside the `maman` / `mère` path.

### `papa`, `père`, `fà`, and `n fa`

7N2A records the following as resolved boundary findings:

```text
papa -> existing hit
père -> existing hit
fà -> existing lexical father form
n fa / n'fa -> "my father"; separate possessive phrase, not a synonym of père
```

Required constraints:

```text
No 7N2A lexical change required for n fa / n'fa.
Do not create a "my father" result from a search for père.
Do not add n fa under papa.
```

The source query in the evidence was `père`, not `mon père`.

### `móbaa`

The project owner has given native-speaker confirmation:

```text
móbaa is an approved target-side variant of móyibaa.
It has the same intended meaning and tone.
The variant removes "yi" from the middle of móyibaa.
```

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

Implementation constraints:

- Audit the exact canonical spelling and record ID for `móyibaa` before any future change.
- Confirm Unicode normalization and tone representation for both `móbaa` and the canonical `móyibaa` record.
- Do not create a separate unrelated lexical concept.
- Do not generalize this approval into a broad target-side deletion or contraction rule.

### `ndándajoro` and `ndándadiya`

The project owner has given lexical intent:

```text
ndándajoro
ndándadiya
-> hospital / clinic / health centre
-> locations where health-related service is received
```

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

Implementation constraints:

- Do not create a general relationship `joro -> place`.
- Do not add these under broad French lookup `place` or `location`.
- Do not add speculative English labels.
- Do not add broad geographic/place labels.
- Do not add additional compounds beyond `ndándajoro` and `ndándadiya`.
- Audit source records before deciding whether the future intervention belongs in aliases, source-index supplements, or another approved artifact type.

---

## Test Matrix

The matrix is a future validation contract for a separately authorized 7N2A implementation. It does not itself authorize edits.

| Regression case identifier | Source or target query | Expected canonical result | Expected result count or ranking rule | Explicit non-result / false-positive guard | Normalization form |
|---|---|---|---|---|---|
| `phase7n2a_maman_generic_mother_primary` | source query `maman` | Exact canonical generic mother record selected after source audit; linked to `mère` | Generic mother sense ranks before vocative/interjection and respectful-address senses | Must not return every current `mère` result as an undifferentiated alias set | NFC source query; source audit must record canonical target normalization |
| `phase7n2a_mere_generic_mother_rank_guard` | source query `mère` | Existing `mère` results remain available, including generic mother sense | Generic mother sense must be interpretable; any ranking change is limited to `maman` / `mère` path | Must not globally redesign ranking for unrelated source queries | NFC source query; preserve existing canonical forms |
| `phase7n2a_papa_existing_hit_guard` | source query `papa` | Existing `papa` result with `bàba`, `bàwa` remains valid | Existing hit remains available | Must not add `n fa` / `n'fa` under `papa` | NFC source query |
| `phase7n2a_pere_existing_hit_guard` | source query `père` | Existing `père` result with `fà` remains valid | Existing hit remains available | Must not create a "my father" result or route `père` to `n fa` / `n'fa` | NFC source query |
| `phase7n2a_mobaa_variant_to_moyibaa` | target query `móbaa` | Same canonical lexical concept currently represented by `móyibaa` | Retrieve the audited canonical `móyibaa` concept; no separate unrelated concept | Must not create broad contraction or deletion rules; must not affect unrelated target words | NFC target query; source audit must record canonical `móyibaa` spelling, tones, and record ID |
| `phase7n2a_moyibaa_existing_guard` | target query `móyibaa` | Existing canonical `móyibaa` concept | Existing target retrieval remains available | Must not demote or duplicate the canonical concept because `móbaa` is added | NFC target query; preserve canonical normalization |
| `phase7n2a_ndandajoro_hopital` | source query `hôpital` | Audited health-institution target coverage including `ndándajoro` if source audit supports it | Existing hit remains; approved compound may appear only if audited as the same health-institution retrieval path | Must not add generic `joro -> place`; must not add broad `place` / `location` expansion | NFC source query; audited target normalization required |
| `phase7n2a_ndandadiya_clinique` | source query `clinique` | Audited health-institution target coverage including `ndándadiya` if source audit supports it | Query retrieves only reviewed health-institution coverage | Must not add speculative English labels or broad geographic labels | NFC source query; audited target normalization required |
| `phase7n2a_centre_de_sante` | source query `centre de santé` | Audited health-institution target coverage for approved compounds if source audit supports it | Multi-word French retrieval term is allowed only for this health-institution path | Must not authorize general phrase translation or other phrase-like searches | NFC source query; preserve accents and spacing |
| `phase7n2a_place_location_false_positive` | source query `place` / `location` | No new result caused by `ndándajoro` or `ndándadiya` | No 7N2A-added result | Must not route broad place/location queries to health-institution compounds | NFC source query |
| `phase7n2a_nfa_false_positive` | source query `père` and target query `n fa` / `n'fa` | `père` remains father lemma; `n fa` / `n'fa` remains separate possessive phrase if otherwise supported | No synonym collapse | Must not create a "my father" result from `père`; must not add `n fa` under `papa` | NFC target/source query; apostrophe normalization must be audited if ever in scope |

---

## Required Future Review Gates

Before any 7N2A implementation:

1. Source-record audit selects exact canonical record IDs.
2. Maintainer confirms artifact type for each intervention.
3. A separate implementation authorization records the exact files allowed to change.
4. Validation runs only the relevant alias/index/runtime checks approved for that future task.
5. Release status remains unchanged until normal release controls approve a package and catalog update.

---

## Non-Automation Rule

This specification is for humans. No validator, applier, catalog builder, bundle builder, or runtime process may consume it to mutate dictionary source records, search indexes, generated bundles, generated packages, `web/public/`, catalog files, search runtime code, or release-decision documents.
