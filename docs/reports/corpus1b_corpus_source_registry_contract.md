# CORPUS1B — Corpus Source Registry Contract

## 1. Decision

```text
CORPUS1B_CORPUS_SOURCE_REGISTRY_CONTRACT_IMPLEMENTED
```

Implemented `corpus_sources_v1` as a distinct structural contract with
deterministic Python validation, synthetic fixtures, and unit tests.

No media acquisition, capture layer, segments, transcripts, tool integration,
or dictionary/runtime mutation.

---

## 2. Base commit

```text
13fbe9087871499cf416ca7af152a56957511995
```

`git log -1`: `13fbe90 Add CORPUS1A corpus acquisition validation tooling audit`.

### Audit-history commits (Part 0)

| Slice | Commit |
|-------|--------|
| LX1A | `7cd18ef5fb824606499018b15e7c45bc5fadf72d` |
| CORPUS1A | `13fbe9087871499cf416ca7af152a56957511995` |

`web/scripts/` left untracked.

---

## 3. Existing repository conventions inspected

| Convention | Observation | CORPUS1B choice |
|------------|-------------|-----------------|
| Specs | `shared/specs/*-v1.md` | `shared/specs/corpus-sources-v1.md` |
| Tracked JSONL registries | `shared/aliases/`, `shared/source_index_supplements/` | Future `shared/corpus/corpus_sources_v1.jsonl` when real rows exist |
| Dictionary sources | `shared/specs/source-registry.md` + `shared/sources/*.yaml` | **Not overloaded** — separate corpus registry |
| Validators | Python fail-closed under `api/<domain>/` + CLI script | `api/corpus_sources/validate_corpus_sources.py` |
| Tests | `api/<domain>/tests/` + `tmp_path` / fixtures | `api/corpus_sources/tests/` + `shared/corpus/fixtures/` |
| `schema_version` | string token (`source_alias_table_v1`) | `corpus_sources_v1` |
| Empty JSONL placeholders | Not used (e.g. phrase aliases absent until content) | Empty registry **deferred** |
| Reports | `docs/reports/{track}{slice}_*.md` | this file |

---

## 4. Source-vs-artifact boundary

```text
corpus_sources_v1          ← CORPUS1B (this slice)
corpus_source_artifacts_v1 ← CORPUS1C
corpus_segments_v1         ← CORPUS1C
annotations                ← CORPUS1D
```

CORPUS1B forbids capture fields (`content_hash`, `byte_length`,
`capture_method`, `storage_ref`) and rejects a global `usable` flag.

Invariant preserved:

```text
URL ≠ immutable source identity
source_id = stable SiraLex identity
source_locator = discovery location (optional)
```

---

## 5. Schema decision

**Decision:** define a **separate** corpus-specific registry
(`corpus_sources_v1`), not an extension of dictionary `shared/sources/*.yaml`.

Reason: dictionary source registry implies lexical ingestion provenance for
published entries. CORPUS1A requires that a registered multimedia/language
source must not be silently treated as approved dictionary truth.

Required fields:

- `schema_version`
- `source_id` (`^csrc_[a-z0-9]+(?:_[a-z0-9]+)*$`)
- `source_type`
- `registered_at`
- `rights_basis`
- `rights_review_status`

Strict unknown-field rejection.

---

## 6. Source taxonomy

Implemented CORPUS1A taxonomy plus `other` for unknown/non-fitting cases:

```text
owned_recording
permissioned_recording
public_video
public_audio
film_or_movie
radio
interview
sermon
speech
oral_history
subtitle_or_existing_transcript
book_or_pdf
other_text
future_user_submission
other
```

`other` added so validators need not force false precision.

---

## 7. Language / variety claim model

Singular claim/assessment with provenance conditionals:

- `claimed_language` + required `claimed_language_by` when claim present
- `assessed_language` + required `assessment_method` / `assessed_by` when assessment present
- optional `assessment_confidence`: `unknown|low|medium|high`
- optional soft multilingual claim: `languages_present_claim[]`
- optional `region_claim` / `speaker_origin_claim` / `dialect_or_variety_claim`

No automatic normalization of Maninka / Malinké / Mandinka / Bambara / Jula.
Disagreement between claimed and assessed is valid.

Segment-level multilingual identity deferred to CORPUS1C.

---

## 8. Rights linkage model

Required:

- `rights_basis`: `owned|permissioned|licensed|public_domain|reference_only|unknown|requires_review`
- `rights_review_status`: `unknown|requires_rights_review|reviewed|publication_blocked`

Optional: `license_reference`, `permission_evidence_ref`, `attribution_required`,
`rights_notes`, `rights_ref` (forward pointer).

Unresolved rights are valid registry state. License strings are not treated as
publication authorization.

---

## 9. Per-use rights matrix decision

```text
DEFERRED-WITH-STUB
```

Optional sparse `usage_permissions` object with CORPUS1A use keys and values
`allowed|blocked|unknown`.

This preserves coexistence such as:

```text
internal_analysis = allowed
dictionary_example_publication = blocked
model_training = unknown
```

without implementing a full rights engine. Full matrix may move to a dedicated
rights contract before real acquisition.

Forbidden: single global `usable=true`.

---

## 10. Mutability / revision model

| Kind | Mechanism |
|------|-----------|
| Stable identity | `source_id` (do not reuse for different sources) |
| Mutable metadata / assessments / rights | update row + optional `updated_at` |
| Audit | git history of JSONL artifact |

No event sourcing. Registry is not immutable like published bundles.

---

## 11. Validator behavior

Module: `api/corpus_sources/validate_corpus_sources.py`  
CLI: `siralex-validate-corpus-sources` (via `api/pyproject.toml`)

Fail closed on:

- missing required fields
- invalid schema version
- malformed `source_id`
- unsupported `source_type`
- invalid rights enums
- invalid timestamps (shape **and** impossible calendar/time values)
- wrong field types
- unknown / forbidden fields
- duplicate `source_id`
- missing claim/assessment provenance when those fields are set
- orphan claim/assessment provenance without the corresponding language field
- `publication_blocked` contradicting publication/redistribution `usage_permissions=allowed`
- invalid `usage_permissions` keys/values

Does **not** reject:

- unknown assessed language
- unresolved rights
- missing locator for owned/offline sources
- claimed≠assessed language
- empty registry files
- internal analysis allowed while publication remains blocked

### Hardening before commit (Part 0)

- Semantic timestamp parsing via stdlib `date`/`datetime.fromisoformat`
- Reject orphan `claimed_language_by` / assessment provenance fields
- Reject clearest `publication_blocked` vs publication-use `allowed` contradiction

---

## 12. Fixture coverage

Under `shared/corpus/fixtures/` (synthetic only; no NicoLingua/OpenSLR content):

**Valid**

- `valid_owned_recording.jsonl`
- `valid_public_video_rights_unknown.jsonl`
- `valid_book_or_pdf.jsonl`
- `valid_claimed_malinke_assessed_maninka.jsonl`
- `valid_multilingual_or_language_unknown.jsonl`

**Invalid**

- `invalid_missing_source_id.jsonl`
- `invalid_source_type.jsonl`
- `invalid_rights_state.jsonl`
- `invalid_schema_version.jsonl`
- `invalid_field_type.jsonl`

Additional negative cases covered in unit tests (duplicate IDs, usable flag,
capture fields, timestamps, usage keys, CLI).

---

## 13. Empty-registry decision

```text
DEFERRED
```

No empty `shared/corpus/corpus_sources_v1.jsonl`. Matches repository pattern
(no empty placeholder JSONL; phrase-alias artifact likewise absent until
content). Fixtures live under `shared/corpus/fixtures/` only.

---

## 14. Files added

```text
shared/specs/corpus-sources-v1.md
api/corpus_sources/__init__.py
api/corpus_sources/validate_corpus_sources.py
api/corpus_sources/tests/test_corpus_sources.py
shared/corpus/fixtures/*.jsonl (10 fixture files)
docs/reports/corpus1b_corpus_source_registry_contract.md
```

---

## 15. Files modified

```text
api/pyproject.toml
```

(adds `corpus_sources` package + `siralex-validate-corpus-sources` script)

---

## 16. Tests

```bash
PYTHONPATH=api pytest api/corpus_sources/tests/test_corpus_sources.py -q
```

Result: **39 passed**

Also spot-checked:

```bash
PYTHONPATH=api python3 -m corpus_sources.validate_corpus_sources \
  shared/corpus/fixtures/valid_owned_recording.jsonl
```

→ PASSED

---

## 17. `git diff --check`

PASS

---

## 18. Working tree (at report authoring)

```text
 M api/pyproject.toml
?? api/corpus_sources/
?? shared/corpus/
?? shared/specs/corpus-sources-v1.md
?? docs/reports/corpus1b_corpus_source_registry_contract.md
?? web/scripts/
```

CORPUS1B implementation commit: **NOT CREATED** (awaiting explicit request).

---

## 19. Recommended CORPUS1C boundary

CORPUS1C should define:

```text
corpus_source_artifacts_v1
corpus_segments_v1
```

including capture hashing, storage refs, media types, and segment spans —
without collapsing into transcripts (CORPUS1D) or promotion (CORPUS1H).

Do not implement tool acquisition/ELAN import until source + artifact +
segment contracts exist.

---

## Non-mutation check

No changes to:

```text
records.jsonl / search_index.jsonl / bundle manifests / catalog
source_aliases_v1 / source_index_supplements_v1
search regression fixtures
web runtime / IndexedDB
```

```text
PASS
```

---

## Final invariants (confirmed)

```text
A registered source is not corpus evidence.
A URL is not immutable source identity.
A language claim is not a linguistic determination.
An assessed language is still an assessment with provenance.
Unknown rights are valid registry state but block unauthorized downstream use.
Source registry metadata does not authorize acquisition.
CORPUS1B does not implement captured artifacts, segments, transcripts,
tool integration, or dictionary publication.
The validator validates structure, not linguistic truth or legal truth.
```
