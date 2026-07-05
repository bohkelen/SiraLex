# Phase 7N2A Implementation Authorization

**Status:** staged implementation authorization packet only  
**Lane title:** `7N2A — Common Kinship and Health-Institution Retrieval Paths`  
**Audit basis:** `docs/reports/phase7n2a_source_record_audit.md`  
**Triage basis:** `docs/PHASE_7K1_STRUCTURED_USABILITY_TRIAGE.md`  
**Specification basis:** `shared/specs/phase7n2a_common_kinship_aliases_v1.md`  
**Bundle context:** `bundle_full_20260616_phase7j_alias_round2_candidate`  
**Norm version:** `norm_v3`

This packet authorizes a **staged** 7N2A implementation plan only. It does not authorize immediate edits to dictionary source records, alias tables, source-index supplements, search indexes, runtime code, bundles, packages, catalogs, or release-status documents.

7N2A contains distinct artifact classes. It must **not** be implemented as a single generic alias operation. Alias work, target-variant work, canonical lexical-content work, and French retrieval-index work are explicitly separated below.

---

## Approved Implementation Candidates

```text
1. maman
2. móbaa
3. ndándajoro
4. ndándadiya
5. French lookup paths: clinique and centre de santé
```

### Existing retrieval path that must remain valid

```text
hôpital → dándaso
```

The existing French index mapping `61843e6630c1fbae` → lexicon `71e323e2dafa590f` (`dándaso`) must not be replaced or removed. Future additive health-institution mappings, if separately approved, may supplement this path only.

---

## Artifact Classification

| Candidate | Source-audit conclusion | Authorized future artifact type | Dependency |
| --- | --- | --- | --- |
| `maman` | Existing generic mother concept | `source_alias` plus constrained result-ranking behavior | Must target only generic mother record `e5164efcdf5e6ca4` |
| `móbaa` | Existing canonical `móyibaa` concept | `target_alias` | Must point to canonical concept `c5f78c8ac66eac6b` |
| `ndándajoro` | Missing canonical Maninka lexical content | `canonical_source_record_addition` | Requires reviewed lexical record and provenance |
| `ndándadiya` | Missing canonical Maninka lexical content | `canonical_source_record_addition` | Requires reviewed lexical record and provenance |
| `clinique` | Missing French retrieval path | `source_index_supplement` only after approved canonical record exists | Depends on reviewed target record |
| `centre de santé` | Missing French retrieval path | `source_index_supplement` only after approved canonical record exists | Depends on reviewed target record |
| `hôpital` | Existing retrieval path to `dándaso` | `no_change` or additive reviewed mapping only | Must preserve current mapping |

### Distinct artifact classes

| Class | Candidates | Meaning |
| --- | --- | --- |
| French source alias | `maman` | Missing French common form routed to an audited existing source posting |
| Target-side alias | `móbaa` | Approved spelling variant of an existing canonical Maninka concept |
| Canonical lexical addition | `ndándajoro`, `ndándadiya` | New reviewed Maninka lexical records not presently in source data |
| French retrieval supplement | `clinique`, `centre de santé` | Reviewed French index mappings after canonical target records exist |
| Preserved existing path | `hôpital` | Current `hôpital → dándaso` mapping remains valid |

French retrieval labels are index mappings, not lexical records.

---

## Lexical-Review Gate

Source-record additions for `ndándajoro` and `ndándadiya` are **blocked** until a lexical review sheet exists for each form.

No canonical lexical record may be added, normalized, enriched, indexed, aliased, or bundled until the corresponding review sheet is approved.

### Required fields for each new canonical record

```text
canonical Maninka spelling
NFC representation
tone marks
part of speech
French gloss or glosses
definition / usage note
relation between ndándajoro and ndándadiya
whether each is hospital, clinic, health centre, or a broader health-service location
source/provenance
owner linguistic approval
reviewer identity or role
```

### Prohibited inference rules

The implementation must not infer these fields from string components such as:

```text
danda
joro
diya
```

The following generic relations are prohibited:

```text
joro → place
diya → place
```

---

## Semantic Constraints

### `maman`

```text
maman
→ generic mother record only
→ canonical source posting e5164efcdf5e6ca4
→ must not indiscriminately inherit all current mère senses
```

Excluded competing records that must not be inherited by `maman` alias work:

```text
0f517a71c373f51d
d540716db9321a83
```

- `0f517a71c373f51d` is the vocative/interjection path `oh, mère!` → `wóyì`.
- `d540716db9321a83` is the respectful-address homonyme path → `tɔ́ɔma`.

No global ranking redesign is authorized. Any ranking change is limited to the `maman` / `mère` path and only as explicitly approved in a later implementation step.

### `móbaa`

```text
móbaa
→ target alias only
→ canonical concept: móyibaa
→ canonical record: c5f78c8ac66eac6b
```

No general deletion rule, contraction rule, vowel-folding rule, or tone-folding rule is authorized.

### Health-institution terms

```text
ndándajoro
ndándadiya
→ future reviewed canonical lexical records only
→ may later support hôpital, clinique, centre de santé
→ hôpital → dándaso must remain valid
```

French retrieval labels are index mappings, not lexical records.

- `clinique` and `centre de santé` are authorized only as future French retrieval paths.
- They are not canonical Maninka lexical records.
- They may receive `source_index_supplement` rows only after reviewed Maninka target records exist.
- `hôpital` remains bound to the existing `dándaso` posting unless a separately approved additive mapping is authorized later.

---

## Explicit Exclusions

The following are prohibited in the future 7N2A implementation unless separately authorized:

```text
Kun / kùn / kún behavior
sɛn / sen behavior
global tone-insensitive matching
global epsilon/e vowel folding
phrase translation
general phrase search
moto
bonjour
n fa / n'fa
generic place/location expansion
unrelated source aliases
ranking redesign beyond maman / mère
catalog publication
release-status change
```

7N2B remains deferred. No runtime similar-spelling UI work is authorized under 7N2A.

---

## Mandatory Implementation Order

No step may be skipped or merged.

```text
1. Lexical review sheet approval for ndándajoro and ndándadiya
2. Exact authorized source-record changes
3. Normalize/enrich through existing pipeline
4. Add only approved aliases and source-index mappings
5. Regenerate affected index artifacts
6. Run focused regression tests and full relevant suite
7. Produce candidate bundle and package
8. Human review of candidate behavior
9. Separate release authorization
```

Step 1 blocks all health-institution lexical additions. Steps 4 through 9 remain blocked until the exact authorized source-record changes in step 2 are recorded in a separate maintainer authorization.

---

## Regression Contract

The following regression case identifiers are required for future 7N2A validation. They are defined here only; they are not implemented in this task.

| Regression case identifier | Scope | Expected target / guard |
| --- | --- | --- |
| `phase7n2a_maman_generic_mother_primary` | `maman` | Generic mother posting from `e5164efcdf5e6ca4` only |
| `phase7n2a_mere_generic_mother_rank_guard` | `mère` | Ranking change limited to `maman` / `mère`; no global redesign |
| `phase7n2a_mobaa_variant_to_moyibaa` | `móbaa` | Resolves to `c5f78c8ac66eac6b` |
| `phase7n2a_moyibaa_existing_guard` | `móyibaa` | Existing canonical concept remains available |
| `phase7n2a_hopital_existing_dandaso_guard` | `hôpital` | Existing `dándaso` mapping remains valid |
| `phase7n2a_clinique_reviewed_health_term` | `clinique` | `BLOCKED_PENDING_LEXICAL_REVIEW` |
| `phase7n2a_centre_de_sante_reviewed_health_term` | `centre de santé` | `BLOCKED_PENDING_LEXICAL_REVIEW` |
| `phase7n2a_ndandajoro_no_place_false_positive` | `ndándajoro` | `BLOCKED_PENDING_LEXICAL_REVIEW`; must not route broad place/location queries |
| `phase7n2a_ndandadiya_no_place_false_positive` | `ndándadiya` | `BLOCKED_PENDING_LEXICAL_REVIEW`; must not route broad place/location queries |
| `phase7n2a_kun_unchanged_guard` | `Kun` / `kùn` / `kún` | No 7N2A side effects |
| `phase7n2a_sen_unchanged_guard` | `sɛn` / `sen` | No 7N2A side effects |

Do not invent expected translations for `clinique`, `centre de santé`, `ndándajoro`, or `ndándadiya` before lexical-review sheets exist.

---

## Authorization Boundary

This packet authorizes planning and staged execution controls only.

It does **not** authorize:

- immediate edits to `data/ir/`
- immediate edits to `shared/aliases/source_aliases_v1.jsonl`
- immediate edits to `shared/source_index_supplements/source_index_supplements_v1.jsonl`
- search-runtime changes under `web/src/`
- bundle or package publication
- catalog publication
- release-status changes

A separate maintainer action is required to move from this authorization packet to artifact edits, index regeneration, bundle generation, or release.

---

## Related Documents

| Document | Role |
| --- | --- |
| `docs/reports/phase7n2a_source_record_audit.md` | Source-record existence and artifact-type audit |
| `docs/PHASE_7K1_STRUCTURED_USABILITY_TRIAGE.md` | Structured-usability triage and owner dispositions |
| `shared/specs/phase7n2a_common_kinship_aliases_v1.md` | Bounded 7N2A candidate specification |
| `shared/specs/source-alias-table-v1.md` | Source-alias artifact rules |
| `shared/specs/source-index-supplement-v1.md` | Source-index supplement artifact rules |
