# CORPUS1C — Corpus Captured Artifact and Segment Contracts

## 1. Decision

```text
CORPUS1C_CORPUS_ARTIFACT_SEGMENT_CONTRACTS_IMPLEMENTED
```

Defined and validated `corpus_source_artifacts_v1` and `corpus_segments_v1`.
No media, transcripts, tool integration, or dictionary/runtime mutation.

---

## 2. Base commit

```text
0f8015c5185bd9878b763aa5ccb87e0a46667ad0
```

`git log -1`: `0f8015c Add corpus source registry contract` (hardened CORPUS1B).

---

## 3. CORPUS1B hardening + commit

Before CORPUS1B commit:

| Change | Behavior |
|--------|----------|
| Semantic timestamps | stdlib `date`/`datetime.fromisoformat`; rejects `2026-02-31`, `T25:99`, etc. |
| Orphan claim provenance | `claimed_language_by` without `claimed_language` fails |
| Orphan assessment provenance | method/confidence/assessed_by without `assessed_language` fails |
| Rights contradiction | `publication_blocked` + publication-use `usage_permissions=allowed` fails |

CORPUS1B tests after hardening: **39 passed**.

Commit: `0f8015c5185bd9878b763aa5ccb87e0a46667ad0`  
`web/scripts/` remained untracked.

---

## 4. Repository conventions inspected

Followed CORPUS1B / alias patterns:

- Specs: `shared/specs/*-v1.md`
- Validators: `api/<domain>/validate_*.py` + CLI in `api/pyproject.toml`
- Fixtures: `shared/corpus/fixtures/`
- Tests: `api/<domain>/tests/`
- No empty production JSONL registries

Packages: `api/corpus_artifacts/`, `api/corpus_segments/` (parallel to `corpus_sources`).

---

## 5. Source → artifact → segment authority model

```text
corpus_sources_v1
  → corpus_source_artifacts_v1   (exact bytes)
  → corpus_segments_v1           (bounded span)
```

```text
registered source ≠ captured artifact
captured artifact ≠ segment
segment ≠ transcript / interpretation / dictionary truth
```

Preferred chain: `segment → artifact → source` (no redundant `source_id` on segments).

---

## 6. Artifact schema decision

Spec: `shared/specs/corpus-source-artifacts-v1.md`  
Schema: `corpus_source_artifacts_v1`

Required: `schema_version`, `artifact_id`, `source_id`, `captured_at`,
`capture_method`, `content_sha256`, `byte_length`, `media_type`.

---

## 7. Capture provenance

`capture_method` enum: `direct_recording|manual_copy|download|scan|export|generated_derivative|other`

Optional: `capture_tool`, `capture_tool_version`, `captured_by`, `storage_ref`,
`rights_snapshot_ref`, `notes`, `updated_at`.

---

## 8. Content identity / SHA-256 rule

`content_sha256` is exactly 64 hex characters. It identifies captured bytes.
URL / filename / `storage_ref` are not identity.

---

## 9. Storage / Git boundary

```text
metadata may be tracked
raw captured bytes are not tracked by default
```

No binary media fixtures. Missing `storage_ref` is valid.

---

## 10. Artifact mutability

Immutable capture facts: `artifact_id`, `source_id`, `content_sha256`,
`byte_length`, `captured_at`, `capture_method`, `media_type`.

Different bytes ⇒ new `artifact_id`. Operational fields (`storage_ref`, notes,
rights snapshot ref) may update with git audit.

---

## 11. Artifact validator

`api/corpus_artifacts/validate_corpus_artifacts.py`  
CLI: `siralex-validate-corpus-artifacts`

Fail closed on structural errors listed in Part 9 of the task brief.

### Hardening before commit (Part 0)

- `--sources` runs **full** `validate_corpus_sources` before accepting IDs
- `derived_from_artifact_ids` required for `generated_derivative`
- no self-ref / duplicate parents; parents must resolve in-table
- derivative `source_id` must match parent(s); multi-source composites deferred
- `capture_tool_version` requires `capture_tool`
- `updated_at` must not precede `captured_at`

---

## 12. Source cross-reference behavior

Optional `--sources <corpus_sources_v1.jsonl>`:

- omitted → structure only
- supplied → **full source validation**, then unknown `source_id` FAIL
- malformed sources cannot satisfy references
---

## 13. Segment schema decision

Spec: `shared/specs/corpus-segments-v1.md`  
Schema: `corpus_segments_v1`

Required: `schema_version`, `segment_id`, `artifact_id`, `span_type`.

---

## 14. Span model

| `span_type` | Fields | Rules |
|-------------|--------|-------|
| `time` | `start_ms`, `end_ms` | integers; `start_ms>=0`; `end_ms>start_ms` |
| `page` | `start_page`, `end_page` | `start_page>=1`; `end_page>=start_page` |
| `text` | `start_char`, `end_char` | `start_char>=0`; `end_char>start_char` |
| `whole_artifact` | none | justified for small complete evidence units |

Incompatible span fields are rejected.

---

## 15. Speaker metadata

Optional `speaker_labels[]`, `speaker_overlap`. Empty labels + `speaker_overlap=true`
is valid (unknown overlapping speakers). No speaker registry.

---

## 16. Language metadata

Optional `languages_present[]` with required
`language_assessment_method` / `language_assessed_by` when non-empty.
Optional confidence enum. Orphan language provenance rejected.
No Manding normalization.

---

## 17. Segment-boundary revision rule

```text
material boundary change → new segment_id
```

Descriptive metadata may update in place with `updated_at`.

---

## 18. Segment validator

`api/corpus_segments/validate_corpus_segments.py`  
CLI: `siralex-validate-corpus-segments`

Forbidden transcript/translation/dictionary fields rejected explicitly.

---

## 19. Artifact cross-reference behavior

Optional `--artifacts <corpus_source_artifacts_v1.jsonl>`:

- omitted → structure only
- supplied → **full artifact validation**, then unknown `artifact_id` FAIL
- malformed artifacts cannot satisfy references

Optional `--sources` on segment CLI requires `--artifacts` and validates
segment → artifact → source.
---

## 20. Fixture coverage

Under `shared/corpus/fixtures/` (synthetic hashes/refs only):

**Artifacts:** valid audio/video/PDF/no-storage; invalid hash/source syntax/timestamp  
**Segments:** valid time/page/text/multilingual/unknown-speaker/whole; invalid time/page/mixed spans/transcript field

---

## 21. Production-artifact decision

```text
DEFERRED
```

No production `corpus_source_artifacts_v1.jsonl` or `corpus_segments_v1.jsonl`.

---

## 22. Non-mutation check

No changes to dictionary bundles, aliases, supplements, search regression,
web runtime, IndexedDB, Learning, or raw media.

```text
PASS
```

---

## 23. Files added

```text
shared/specs/corpus-source-artifacts-v1.md
shared/specs/corpus-segments-v1.md
api/corpus_artifacts/*
api/corpus_segments/*
shared/corpus/fixtures/valid_*artifact*.jsonl
shared/corpus/fixtures/invalid_artifact_*.jsonl
shared/corpus/fixtures/valid_*segment*.jsonl
shared/corpus/fixtures/invalid_*span*.jsonl
shared/corpus/fixtures/invalid_segment_transcript_field.jsonl
docs/reports/corpus1c_corpus_artifact_segment_contracts.md
```

---

## 24. Files modified

```text
api/pyproject.toml
```

---

## 25. Tests

```bash
PYTHONPATH=api pytest \
  api/corpus_sources/tests/test_corpus_sources.py \
  api/corpus_artifacts/tests/test_corpus_artifacts.py \
  api/corpus_segments/tests/test_corpus_segments.py -q
```

Result: **98 passed** (CORPUS1B + hardened CORPUS1C).

`ruff`: not available in this environment (`python3 -m ruff` / `ruff` missing);
validators follow existing style.

---

## 26. `git diff --check`

PASS (verified at completion).

---

## 27. Working tree

```text
 M api/pyproject.toml
?? api/corpus_artifacts/
?? api/corpus_segments/
?? docs/reports/corpus1c_corpus_artifact_segment_contracts.md
?? shared/specs/corpus-source-artifacts-v1.md
?? shared/specs/corpus-segments-v1.md
?? shared/corpus/fixtures/<CORPUS1C fixtures>
?? web/scripts/
```

CORPUS1C commit: **NOT CREATED**.

---

## 28. Recommended CORPUS1D boundary

```text
transcript / translation / annotation objects on segments
method-tagged production metadata
uncertain_spans
NO dictionary promotion
NO automatic ASR authority
```

Import/export (e.g. ELAN EAF adapters) only after annotation contracts exist.

---

## Final invariants (confirmed)

```text
A source identifies where language material came from.
An artifact identifies the exact captured bytes.
A segment identifies a bounded portion of those exact bytes.
A segment does not state what was said or what it means.
Content hash, not URL or storage path, identifies captured bytes.
Unknown language and unknown speaker are valid states.
No transcript or translation belongs in CORPUS1C.
No external corpus data belongs in git by default.
```
