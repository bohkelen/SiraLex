# CORPUS1F2 — Governed Review Persistence Pilot

## 1. Decision

```text
CORPUS1F2_GOVERNED_REVIEW_PERSISTENCE_COMPLETE
```

Implemented the smallest governed writer to materialize the 24 completed
CORPUS1F human transcript reviews into a **local/gitignored** immutable review
registry after canonical worksheet re-validation.

No tracked production review registry. No dictionary/runtime mutation. No
translation reviews persisted.

---

## 2. Base commit

```text
0cd6f658327abb34441610441a7eb5f30a898587
```

`git log -1`: `0cd6f65 Add translation context to corpus review worksheet`.

---

## 3. Why persistence is now justified

The completed v2 worksheet passed canonical dry-run with:

- 24 reviewed rows
- 0 errors
- all `accepted` / `Reviewer_001` / `manual_review` / `strong`

Human review evidence now exists. AL1-style discipline still applies: dry-run
first, explicit apply, no silent mutation. Persistence is justified **because**
validated human judgments exist — not because a registry file was on the
roadmap.

---

## 4. Human review result summary

| Field | Value |
|-------|-------|
| Rows | 24 |
| `reviewer_id` | `Reviewer_001` |
| `decision` | `accepted` (24) |
| `evidence_strength` | `strong` |
| `review_method` | `manual_review` |
| Subject type | `transcript_raw` only |

---

## 5. Authority boundary

```text
review = linguistic judgment about an annotation
review ≠ dictionary candidate
review ≠ publication / rights / bundle / search truth
accepted transcript ≠ accepted EN/FR translation
```

Preview JSONL is diagnostic, not write authority.

---

## 6. Local-vs-tracked registry decision

Pilot annotations live only under gitignored `data/corpus1f/`.

Therefore reviews persist at:

```text
data/corpus1f/tables/corpus_annotation_reviews_v1.jsonl
```

**Not** `shared/corpus/corpus_annotation_reviews_v1.jsonl` (would dangle against
untracked annotation IDs). Tracked production registry remains deferred.

---

## 7. Writer CLI

```text
siralex-write-corpus-reviews
```

Module: `api/corpus_reviews/write_corpus_reviews.py`

Inputs: completed worksheet + annotations (+ optional segments/artifacts/sources)
+ `--output` registry path.

---

## 8. Validation-before-write pipeline

1. Full annotation chain validation (via dry-run / referenced validators)
2. Worksheet schema/context/fingerprint checks
3. Candidate review conversion
4. Structural + full candidate table validation
5. Load/validate existing destination registry if present
6. Merge plan (append / identical / conflict)
7. Full merged-table validation against annotations
8. Only then optional atomic write

---

## 9. Apply gate

Default: validate + report; **no write**.

Persistence requires explicit `--apply`.

---

## 10. Idempotence rules

- Candidate `review_id` not present in the existing registry → append
- Same `review_id` + identical canonical JSON → already present / no-op
- Same `review_id` + different content → FAIL CONFLICT

`review_id` is required on every canonical review record.

---

## 11. Conflict behavior

No overwrite of immutable review fields. Changed judgments need a new review
record (supersession UX deferred).

---

## 12. Atomicity

Write temp sibling in destination directory → fsync → **validate temp file from
disk** with the canonical review validator + annotation chain → `os.replace` →
best-effort parent-directory fsync.

Failed temp validation or failed replace leaves prior registry intact.

---

## 13. Post-write verification

After `--apply`, re-open destination and run
`validate_corpus_reviews` against the annotation chain. Success requires
post-write validation PASS.

---

## 14. Write receipt

Local:

```text
data/corpus1f/outputs/review_persistence_report.json
```

Includes row counts, decision counts, reviewer IDs, worksheet/annotation/
registry SHA-256, persistence timestamp. Operational provenance only.

---

## 15. First apply result

| Metric | Value |
|--------|-------|
| rows before | 0 |
| candidate rows | 24 |
| new rows written | 24 |
| already present | 0 |
| rows after | 24 |
| decision.accepted | 24 |

---

## 16. Second / idempotent apply result

| Metric | Value |
|--------|-------|
| candidate rows | 24 |
| new rows written | 0 |
| already present identical | 24 |
| rows after | 24 |

Registry SHA unchanged across second apply.

---

## 17. Persisted review counts

24 `corpus_annotation_reviews_v1` rows targeting 24 `transcript_raw`
annotations.

---

## 18. Translation-review boundary

**NONE** persisted for the 48 EN/FR translation annotations.

They remain imported contextual evidence only. Transcript acceptance does not
accept translations.

---

## 19. Tests

Writer coverage includes: no-write default, `--apply`, create, idempotence,
conflict, invalid candidate blocks all writes, invalid existing registry,
stale/fingerprint blocks write, merged validation, atomic failure preserves
prior file, post-write validation, deterministic ordering, receipt hashes.

Full B+C+D+E+writer suite: **195 passed**.

---

## 20. Non-mutation check

No dictionary/search/alias/supplement/bundle/catalog/web runtime/IndexedDB/PWA/
Learning changes. `web/scripts/` untouched. `data/corpus1f/` untracked.

---

## 21. git diff --check

PASS

---

## 22. Files added

- `api/corpus_reviews/write_corpus_reviews.py`
- `api/corpus_reviews/tests/test_write_corpus_reviews.py`
- `docs/reports/corpus1f2_governed_review_persistence.md`

---

## 23. Files modified

- `api/pyproject.toml`
- `shared/specs/corpus-annotation-reviews-v1.md`
- `docs/reports/corpus1f_translation_context_from_pilot_friction.md`
  (explicit review-target semantics: transcript acceptance does not accept
  translations)

---

## 24. Local / gitignored artifacts

- `data/corpus1f/tables/corpus_annotation_reviews_v1.jsonl`
- `data/corpus1f/outputs/review_persistence_report.json`
- `data/corpus1f/outputs/review_persistence_report_idempotent.json`
- apply/plan JSON reports under `data/corpus1f/outputs/`

---

## 25. Working tree

CORPUS1F2 implementation left **uncommitted** for review.

---

## 26. Recommended next architectural decision

Base the next slice on what this pilot actually demonstrated:

1. **Closed-vocabulary VA speech + imported orthography/glosses can complete a
   full human review + governed persistence loop.**
2. **Worksheet friction was real** (translations as context), already corrected.
3. **ELAN/workbench is not yet evidenced as blocking** — humans finished review
   with CSV + local audio paths.
4. **Translation annotations were never review subjects** — if semantic gloss
   quality matters next, **C. translation-specific human review** is the
   highest-evidence follow-on.
5. **Richer conversational speech (B)** is needed before product candidacy (D)
   or assuming dictionary promotion readiness.
6. **CORPUS1G ELAN (A)** remains useful later for denser media annotation, but
   is not the bottleneck revealed by this pilot.

**Recommendation:** prefer **C** (translation-subject review) and/or **B**
(richer conversational pilot) before CORPUS1G or corpus-to-product governance.
Do not choose A or D merely because they were earlier roadmap labels.
