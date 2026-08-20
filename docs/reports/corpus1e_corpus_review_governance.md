# CORPUS1E — Corpus Annotation Review Governance + Review Worksheet

## 1. Decision

```text
CORPUS1E_CORPUS_REVIEW_GOVERNANCE_IMPLEMENTED
```

Introduced `corpus_annotation_reviews_v1` as a separate immutable reviewer
decision layer with worksheet export and dry-run import. No production review
registry write. No annotation mutation. No promotion/publication logic.

Final fail-closed hardening before commit:

| Hardening | Behavior |
|-----------|----------|
| Event timestamps | `created_at` / `reviewed_at` require timezone-aware ISO datetimes |
| Review chronology | with `--annotations`, `reviewed_at >= annotation.created_at` |
| Worksheet identity | required `worksheet_schema` column on every row |
| Context integrity | dry-run compares all read-only columns to reconstructed export |
| `evidence_refs` | worksheet column + dry-run round-trip |
| Table dry-run | shared `validate_corpus_review_table` after row conversion |
| Generated `review_id` | `crev_<ann>_<sha12>` over immutable review fields |
| Preview write | `--preview-jsonl` only when entire dry-run passes |
| Worksheet supersession | deferred (contract capability only) |

---

## 2. Base commit

```text
9c6f26fb219787af453c99b48a1cdc01f811a429
```

`git log -1`: `9c6f26f Harden corpus annotation provenance graph`.

---

## 3. CORPUS1D final hardening + commit

CORPUS1D was already committed as `5861998` (`Add versioned corpus annotation
contract`). Final provenance hardening was applied and committed separately:

| Rule | Behavior |
|------|----------|
| Derivation chronology | child `created_at` ≥ each parent `created_at` |
| Combined graph | union of derivation + supersession edges is acyclic |
| Same-segment | already enforced for derivation and supersession |
| Leaf semantics | current = not superseded; multiple leaves OK; no timestamp winner |
| Helper | `find_supersession_leaves` returns all leaves deterministically |

CORPUS1D final hardening commit:

```text
9c6f26fb219787af453c99b48a1cdc01f811a429
```

B+C+D tests after hardening: **138 passed**. `web/scripts/` untouched.

---

## 4. Existing review/governance patterns inspected

| Pattern | Takeaway for CORPUS1E |
|---------|------------------------|
| AL1C/AL1D alias worksheets | CSV worksheet is derived working artifact; dry-run before write |
| CORPUS1A authority split | evidence ≠ review ≠ promotion |
| CORPUS1B–D validators | fail-closed JSONL validators; fixtures only; no empty production registry |

---

## 5. Review authority boundary

```text
annotation ≠ accepted evidence
review ≠ dictionary candidate
accepted review ≠ publication approval
evidence strength ≠ review decision
review decision ≠ promotion status
linguistic acceptance ≠ rights authorization
```

Reviews record judgments. They do not rewrite annotations or create product
truth.

---

## 6. Review schema

Spec: `shared/specs/corpus-annotation-reviews-v1.md`  
Schema: `corpus_annotation_reviews_v1`

Required: `schema_version`, `review_id`, `annotation_id`, `reviewer_id`,
`reviewed_at`, `review_method`, `decision`.

Optional: `evidence_strength`, `evidence_refs[]`, `issue_codes[]`,
`review_notes`, `supersedes_review_id`.

---

## 7. Reviewer provenance

Required `reviewer_id`, `reviewed_at`, `review_method` ∈
`manual_review` | `trusted_speaker_review` | `linguistic_review` |
`collaborative_review` | `other`.

Method is provenance, not automatic competence certification.

---

## 8. Evidence-strength model

Optional ordinal:

```text
unknown | weak | moderate | strong | very_strong
```

Independent of `decision`. Optional opaque `evidence_refs[]` (no triangulation
automation).

---

## 9. Issue-code model

Controlled small vocabulary: `unclear_audio`, `segment_boundary_problem`,
`speaker_overlap`, `language_identity_uncertain`, `orthography_uncertain`,
`unknown_word`, `translation_uncertain`, `meaning_uncertain`, `code_switching`,
`rights_block`, `needs_second_reviewer`, `other`.

---

## 10. Review supersession

Optional `supersedes_review_id`:

- no self-supersession
- same `annotation_id`
- same `reviewer_id` (other reviewers create independent reviews)
- `reviewed_at` ≥ superseded
- acyclic graph

---

## 11. Independent / disagreeing reviews

Multiple active reviews of one annotation are valid. No majority vote, average
score, trusted-method override, or latest-wins consensus.

---

## 12. Competing annotation leaf behavior

Worksheet default export = **all supersession leaves**. Competing same-type
leaves are all exported. Chronology does not select a winner.
`--include-superseded` exports historical revisions. Optional
`--annotation-type` filter.

---

## 13. Subject fingerprint

`annotation_fingerprint_sha256` = SHA-256 of canonical sorted-key JSON of the
full annotation record. Dry-run import fails with `FAIL STALE REVIEW SUBJECT`
on mismatch.

---

## 14. Worksheet export

CLI: `siralex-export-corpus-review-worksheet`  
Module: `api/corpus_reviews/export_review_worksheet.py`  
Format: CSV (`corpus_annotation_review_worksheet_v1` columns). Derived only.

---

## 15. Worksheet import / dry-run

CLI: `siralex-corpus-review-dry-run`  
Module: `api/corpus_reviews/dry_run_import_reviews.py`

Flow: filled CSV → validate → preview review rows. Reports rows read/skipped,
decision counts, stale fingerprint errors, unknown annotation errors.
No production review JSONL write by default.

---

## 16. Cross-reference validation

CLI: `siralex-validate-corpus-reviews`

- Structure-only without annotations
- Optional `--annotations` (full annotation validation + ref check)
- Optional `--segments` / `--artifacts` / `--sources` with `--annotations` for
  full chain

---

## 17. Rights separation

Linguistic `accepted` does not clear rights. `rights_block` issue code can
surface rights concern as review context only. No rights authorization fields.

---

## 18. Fixture coverage

**Valid:** accepted manual; rejected transcript; needs-more-evidence translation;
disagreeing reviews; same-reviewer supersession; strong evidence refs;
competing transcript leaves (annotation fixture for export).

**Invalid:** missing review_id; bad annotation_id; invalid decision; missing
reviewer metadata; unknown annotation ref (with annotations table);
self-supersession; supersession cycle; supersede other reviewer; cross-annotation
supersession; reviewed_at before superseded; promotion field.

Stale fingerprint covered in dry-run unit tests.

---

## 19. Production registry decision

**DEFERRED.** No `shared/corpus/corpus_annotation_reviews_v1.jsonl` production
file. Validator + worksheet exporter + dry-run importer only.

---

## 20. Non-mutation check

No changes to dictionary `records.jsonl`, `search_index.jsonl`, bundles,
catalog, source aliases, supplements, dictionary source artifacts, search
regression fixtures, web runtime, IndexedDB, PWA, or Learning.
`web/scripts/` remains untracked/untouched by this slice.
No external corpus/media data added.

---

## 21. Files added

- `shared/specs/corpus-annotation-reviews-v1.md`
- `api/corpus_reviews/` package (validator, fingerprint, export, dry-run, tests)
- `docs/reports/corpus1e_corpus_review_governance.md`
- Review/competing-leaf fixtures under `shared/corpus/fixtures/`

---

## 22. Files modified

- `api/pyproject.toml` (package + CLI entry points)

CORPUS1D hardening (already committed before this report’s working tree for
CORPUS1E): annotation validator/spec/report/fixtures/tests.

---

## 23. Tests

```bash
PYTHONPATH=api pytest \
  api/corpus_sources/tests/test_corpus_sources.py \
  api/corpus_artifacts/tests/test_corpus_artifacts.py \
  api/corpus_segments/tests/test_corpus_segments.py \
  api/corpus_annotations/tests/test_corpus_annotations.py \
  api/corpus_reviews/tests/ -q
```

Result: **180 passed**.

---

## 24. git diff --check

PASS (`ruff` not available in environment; not installed for ceremony)

---

## 25. Working tree

CORPUS1E committed after final hardening. Unrelated `web/scripts/` remains
untracked/untouched.

---

## 26. Recommended CORPUS1F manual-pilot boundary

CORPUS1F should run a **manual pilot** with synthetic or carefully rights-cleared
sample content only:

1. Export worksheet from real pilot annotations (leaves only).
2. Humans fill decisions / issue codes / notes.
3. Dry-run import; fix stale/unknown rows.
4. Only then consider a governed append writer for
   `corpus_annotation_reviews_v1` (still no promotion).
5. Explicitly defer consensus policy, dictionary candidacy, and publish gates.

Do not collapse review into promotion in CORPUS1F.
