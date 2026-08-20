# CORPUS1D — Corpus Transcript / Translation / Annotation Contract

## 1. Decision

```text
CORPUS1D_CORPUS_ANNOTATION_CONTRACT_IMPLEMENTED
```

Implemented `corpus_annotations_v1` as versioned annotation objects with
production provenance, derivation/supersession, and Unicode uncertainty spans.

No review/promotion, ASR execution, media, or dictionary mutation.

---

## 2. Base commit

```text
590b02d0039f90b88c9ada391659c1f6017b9859
```

`git log -1`: `590b02d Add corpus artifact and segment contracts`.

---

## 3. CORPUS1C hardening + commit

Before CORPUS1C commit:

| Change | Behavior |
|--------|----------|
| Full referenced validation | `--sources` / `--artifacts` run full child validators |
| Segment chain | `--sources` requires `--artifacts` |
| `derived_from_artifact_ids` | Required for `generated_derivative` |
| Same-source derivatives | Parent source_id must match; multi-source deferred |
| Tool/version orphan | `capture_tool_version` requires `capture_tool` |
| Chronology | `updated_at` must not precede `captured_at` |

CORPUS1C commit: `590b02d0039f90b88c9ada391659c1f6017b9859`  
Tests at commit: **98 passed**. `web/scripts/` untouched.

---

## 4. Repository conventions inspected

Followed CORPUS1B/C patterns: `shared/specs/*-v1.md`, `api/corpus_annotations/`,
fixtures under `shared/corpus/fixtures/`, CLI in `api/pyproject.toml`, no empty
production JSONL.

---

## 5. Annotation authority boundary

```text
segment ≠ annotation
raw transcript ≠ normalized transcript
machine transcript ≠ reviewed transcript
annotation ≠ validated corpus truth
annotation ≠ dictionary candidate / published content
```

No `segment.transcript` fields. Review/promotion deferred to CORPUS1E.

---

## 6. Schema decision

Spec: `shared/specs/corpus-annotations-v1.md`  
Schema: `corpus_annotations_v1`

Required: `schema_version`, `annotation_id`, `segment_id`, `annotation_type`,
`content`, `created_at`, `creation_method`, `created_by`.

---

## 7. Annotation types

`transcript_raw` | `transcript_normalized` | `translation` | `gloss` |
`orthography_note`

---

## 8. Language/script model

Optional `content_language` (free-text claim).  
`script`: `Latn` | `Nkoo` | `Arab` | `mixed` | `unknown` (ISO 15924 where
applicable). Required `content_language` for translations. No Manding collapse.
N’Ko annotations remain non-authoritative without separate governance.

---

## 9. Production provenance

`creation_method` enum includes manual/ASR/MT/LLM/normalization/import/other.

Machine methods (`asr`, `machine_translation`, `llm_assisted`) require
`tool_name` or `model_name`; versions may be explicit `unknown`.

---

## 10. Derivation model

`derived_from_annotation_ids[]`: unique, no self-ref, same segment, resolve in
table, cycle detection. `transcript_normalized` requires transcript parents.

---

## 11. Supersession/versioning model

Optional `supersedes_annotation_id`:

- no self-ref; must exist; same segment
- **same `annotation_type`** (cross-type moves use derivation)
- superseding `created_at` ≥ superseded `created_at`
- **acyclic** supersession graph
- multiple annotations may supersede the same parent (competing revisions)
- history retained (no deletes)

Hardened before commit after review feedback.

---

## 12. Annotation mutability

Prefer immutable evidence rows. Material content change ⇒ new `annotation_id`
via derivation and/or supersession.

---

## 13. Uncertainty-span model

`uncertain_spans[]` with zero-based **Unicode code-point** end-exclusive
offsets (`content[start:end]` in Python 3). Optional `surface_form` must match
slice. Overlaps permitted.

---

## 14. Raw vs normalized transcript rule

Separate types; normalized must derive from `transcript_raw` or
`transcript_normalized`.

---

## 15. Translation provenance

`annotation_type=translation` + required `content_language`; optional
derivation from transcript; translation does not confirm transcript correctness.

---

## 16. Segment cross-reference behavior

Optional `--segments` runs full segment validation. Optional
`--artifacts`/`--sources` require `--segments` for full chain.

---

## 17. Annotation graph validation

Duplicate IDs, missing/self/cyclic derivation, missing/self/cross-segment
supersession, normalized parent-type checks.

---

## 18. Fixture coverage

Valid: manual/ASR raw, normalized, FR/EN translation, uncertainty, unknown
language, non-authoritative N’Ko, direct manual.

Invalid: missing id, bad segment/type/content, ASR without machine provenance,
normalized without parent, forbidden review field, bad uncertainty bounds;
supersession cycle/chronology/cross-type; graph cases covered in unit tests.

Valid supersession: `valid_supersession_same_type.jsonl`

---

## 19. Production registry decision

```text
DEFERRED
```

No `shared/corpus/corpus_annotations_v1.jsonl`.

---

## 20. Non-mutation check

No dictionary/bundle/alias/supplement/search/web/IndexedDB/media changes.

```text
PASS
```

---

## 21. Files added

```text
shared/specs/corpus-annotations-v1.md
api/corpus_annotations/*
shared/corpus/fixtures/valid_*transcript*.jsonl / valid_translation_*.jsonl /
  valid_uncertainty_span.jsonl / valid_annotation_unknown_language.jsonl /
  valid_nkoo_nonauthoritative.jsonl / valid_direct_manual_transcript.jsonl /
  invalid_*annotation*.jsonl / invalid_asr_* / invalid_normalized_* /
  invalid_forbidden_review_field.jsonl / invalid_empty_content.jsonl /
  invalid_uncertainty_bounds.jsonl
docs/reports/corpus1d_corpus_annotation_contract.md
```

---

## 22. Files modified

```text
api/pyproject.toml
```

---

## 23. Tests

```bash
PYTHONPATH=api pytest \
  api/corpus_sources/tests/test_corpus_sources.py \
  api/corpus_artifacts/tests/test_corpus_artifacts.py \
  api/corpus_segments/tests/test_corpus_segments.py \
  api/corpus_annotations/tests/test_corpus_annotations.py -q
```

Result: **133 passed** (after supersession hardening)

`ruff`: unavailable in this environment (same as prior slices).

---

## 24. `git diff --check`

PASS

---

## 25. Working tree

```text
 M api/pyproject.toml
?? api/corpus_annotations/
?? docs/reports/corpus1d_corpus_annotation_contract.md
?? shared/specs/corpus-annotations-v1.md
?? shared/corpus/fixtures/<CORPUS1D fixtures>
?? web/scripts/
```

CORPUS1D commit: **NOT CREATED**.

---

## 26. Recommended CORPUS1E boundary

```text
review status / worksheet artifacts
accepted | rejected | needs_more_evidence
evidence confidence vs review vs promotion (still separate)
NO automatic dictionary publication
```
