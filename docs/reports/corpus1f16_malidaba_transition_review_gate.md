# CORPUS1F16 — Malidaba Identity Migration + Destructive-Change Review Gate

## 1. Decision

**CORPUS1F16_HUMAN_TRANSITION_REVIEW_READY**

Deterministic remap proposals and two blank human worksheets were emitted
from frozen F11–F15 evidence. Cross-ontology coupling was audited on exact
`baseline_ir_id`. No remap was applied. No human decisions were encoded.
Canonical source refresh remains blocked pending Type-A ambiguous remap review
and Type-B missing-record disposition.

Gate-ready artifact emission (proposals + worksheets): `CORPUS1F16_MALIDABA_TRANSITION_REVIEW_GATE_READY`

## 2. Base commit

`80c7e92cdf1563905e06dc739916ade6c9c5e3ae` — *Add Malidaba source refresh acceptance gate* (CORPUS1F15)

## 3. Frozen inputs

**PASS**

| Artifact | SHA-256 |
|----------|---------|
| Baseline canonical IR | `97529fc9bb69d9eb3a3ce40ffa30cc6a1b881f7f2b5edb2709ae7ed3db4dafe1` |
| Current corrected IR | `fb8e97b0a8e1b82b5fc7874d7af010063112799cc116dd458ae0c48e56778221` |
| Trusted delta | `6dd2092078ba99c512b1e7b376e68599dd7e3faa1e7f1b8cccd1fe20335abeba` |
| F13 review registry | `6ada0ee6381379ae1f260c9317e6c6ca4233d76b1dcbc0e198ade21dc8e46104` |
| F15 acceptance | `d48d7ee1382f337bc9b628fb7d98858a8e0780a8aad84ba00ebfc053faa29d1e` |
| F15 integrity manifest | `2492b284be058f24be560021abf3ca4e95d8b113969989a34bab9e8c08bb5d64` |
| F15 destructive manifest | `d7417a5cd83c6a9f766d1e14e2485fc33eed2e05b9312abf18ecb2e8e378f758` |

Hash mismatch blocks the gate.

## 4. G7 vs G9 ontology

| Type | Question | Artifact |
|------|----------|----------|
| **A — DOWNSTREAM IDENTITY MIGRATION** | What current Malidaba record should an existing SiraLex reference target after refresh? | remap proposals + ambiguous remap worksheet |
| **B — DESTRUCTIVE SOURCE CHANGE** | What should happen to a baseline Malidaba record that cannot be safely resolved in the current edition? | missing-record disposition worksheet |

Separate schemas, batch IDs, and decision vocabularies. No mixed worksheet.

Separate ontologies do **not** imply independent transition effects: a baseline
record may simultaneously require downstream reference migration (Type A) and
source-removal disposition (Type B). Coupling is exposed only on exact
`baseline_ir_id` match — never headword, page, or semantic proximity.

## 5. Cross-ontology coupling audit

Exact `baseline_ir_id` overlap (no headword matching):

| Audit | Count |
|-------|------:|
| Type-A ambiguous migration subjects | 5 |
| Type-B missing-record subjects | 42 |
| Ambiguous ∩ Missing overlap | **0** |
| Deterministic-remap ∩ Missing overlap | **0** |
| Cross-review groups (`crg_*`) | **0** |

Ambiguous-TypeA baseline ir_ids (none overlap Type B):

- `43b64456edacdbe0`
- `50da089833d1173a`
- `753fa18e0a6df4ab`
- `755e1dd98e5f4535`
- `e28e149f57ab616b`

Both worksheets include protected read-only cross-review columns even when
`cross_review_related=false`:

- `cross_review_group_id`
- `cross_review_related`
- `cross_review_counterpart_type`
- `cross_review_counterpart_subject_id`
- `cross_review_constraint`

When overlap exists, `cross_review_group_id` is deterministic:
`crg_{sha256(baseline_ir_id + frozen F15 acceptance)[:16]}`.

Dry-run reconstructs cross-review fields from frozen evidence; editing them
fails closed (stale-context protection).

## 6. Cross-review consistency matrix (future apply; not persisted in F16)

Rules apply **only** when exact `baseline_ir_id` coupling exists.

| Rule | Type A | Type B | Result |
|------|--------|--------|--------|
| A | `retain_legacy_target` | `accept_source_removal` | **BLOCK** — `legacy_target_requires_record_retention` |
| B | active legacy retention | `accept_source_removal` | **BLOCK** — downstream reference cannot retain legacy target after removal accepted |
| C | `confirmed_remap` (target X) | `current_equivalent_confirmed` (target Y) | **BLOCK** if X ≠ Y |
| D | `needs_more_evidence` | `accept_source_removal` | **BLOCK** — not permission for destructive apply |
| E | `no_current_equivalent` | `accept_source_removal` | **BLOCK** — no automatic removal authorization |
| — | `retain_legacy_target` | `retain_baseline_record` | **OK** |
| — | `retain_legacy_target` | `needs_more_evidence` | **OK** |

Pure validation helper: `validate_cross_review_consistency()` — **READY** (not blocking gate emission; overlap is zero on real data).

## 7. 37 raw identity-bound references

Reconstructed from the frozen F15 integrity manifest + baseline/current IR +
trusted delta (not from F15 prose):

| F15 status | Raw refs | Unique baseline ir_ids |
|------------|---------:|-----------------------:|
| REQUIRES_REMAP | 23 | 10 |
| AMBIGUOUS | 14 | 5 |
| **Total problem** | **37** | **15** |

Artifact mix: source-index supplements, search regression, reviewed target
variants, one source alias.

## 8. Unique migration subjects

**15** = 10 remap subjects + 5 ambiguous subjects.

Grouping key: baseline Malidaba `ir_id` + candidate-current target set +
F15 resolution status. Duplicate raw refs (same old id in multiple artifacts)
are not re-asked of the human.

## 9. Deterministic remap proposal method

A REQUIRES_REMAP subject becomes `PROPOSAL_READY` only if:

- exactly one current target
- target exists in frozen current IR
- baseline and candidate `headword_latin` match
- F11 confidence is `STRONG`, `EXACT_CONTENT_SUPPORTED`, or `UNIQUE_PROVISIONAL`
  (F11 `PROVISIONAL` is labeled `UNIQUE_PROVISIONAL`)
- no many-to-one collapse onto the same current `ir_id`

No fuzzy match. No edit distance. No “best candidate.”

AMBIGUOUS subjects never receive an automatic proposal.

## 10. Proposal results

| Result | Count |
|--------|------:|
| PROPOSAL_READY | 10 subjects (covering 23 raw refs) |
| AMBIGUOUS_NO_AUTOMATIC_PROPOSAL | 5 subjects (covering 14 raw refs) |
| BLOCKED_MANY_TO_ONE | 0 |
| BLOCKED_TARGET_MISSING | 0 |

Proposal manifest SHA-256:
`74c1553f4bdd5846f20dcf5085e3c52045e3cbddc3b4eebf700bc47d156f290b`

Proposals are evidence only.

## 11. Virtual remap regression before/after

In-memory overlay of the 10 READY pairs only. Tracked alias/supplement/variant
tables were **not** edited. Virtual copies live under `f16/virtual/`.

| Surface | Before | After deterministic virtual remap |
|---------|--------|-----------------------------------|
| G7 requires_remap | 23 | **0** |
| G7 ambiguous | 14 | **14** |
| G7 still_resolves | 0 | **23** |
| Regression pass/fail | 16 / 14 | **17 / 13** |

`sr7l_011_kun_target_exact` is the extra pass: expected baseline `ir_id`
virtually remapped onto the current posting the isolated index already returns.

Virtual alias *apply* could not complete: alias `evidence_ir_ids` still include
ambiguous baseline `755e1dd98e5f4535` (not in overlay by design). Remaining
alias/supplement regression cases therefore stay `OTHER` until Type-A human
remap review.

## 12. Remaining ambiguous migration subjects

**5 unique subjects / 14 raw refs.** Homonym groups (same page + same
headword) presented as frozen candidate sets, e.g. `kùn` (2 current), `bárí`
(4 current). No automatic choice.

## 13. Ambiguous remap worksheet

Local/gitignored:

`data/malidaba_delta/current/source_refresh/f16/malidaba_ambiguous_reference_remap_review_001.csv`

Schema: `malidaba_reference_remap_review_worksheet_v1`

Rows: **5**

Worksheet SHA-256: `c5bc336a186e116ae034869bbe96c612ee3518f002c489dc3e083636b4e4fa2a`

Allowed decisions: `confirmed_remap` | `no_current_equivalent` |
`retain_legacy_target` | `needs_more_evidence`

`confirmed_remap` requires `selected_current_ir_id` ∈ presented candidates.
All other decisions require that field blank.

## 14. 42 missing baseline records

Reconstructed from the frozen F15 destructive manifest + baseline IR:

| F15 disposition | Count |
|-----------------|------:|
| DESTRUCTIVE_CHANGE_REQUIRES_REVIEW | 37 |
| AMBIGUOUS (anchor reused, different headword) | 5 |
| **Total** | **42** |

One record = one subject. Homonyms are not collapsed.

Same-page/same-headword current candidates: **0 of 42**. Possible candidates
column is therefore empty. The 5 AMBIGUOUS rows document recycled
`source_record_id` anchors holding a *different* current headword — not an
equivalent.

All 42 appear in the featured canonical search index.

## 15. Missing-record worksheet

Local/gitignored:

`data/malidaba_delta/current/source_refresh/f16/malidaba_missing_record_disposition_review_001.csv`

Schema: `malidaba_missing_record_disposition_worksheet_v1`

Rows: **42**

Worksheet SHA-256: `60191121f91a9933c289dcc109a5417e5dd560303d181de94896511beb8b032b`

## 16. Human decision semantics

**Type A**

- `confirmed_remap` — selected current record is the transition successor for
  existing SiraLex references
- `no_current_equivalent` — no presented current record is a successor
- `retain_legacy_target` — keep the old target through this transition
- `needs_more_evidence`

**Type B**

- `retain_baseline_record` — preserve the baseline record through this
  transition (not a claim that the old edition is linguistically superior)
- `current_equivalent_confirmed` — selected current record is the successor
  (not independent lexical verification)
- `accept_source_removal` — accept this removal as part of the
  `src_malipense` source transition (not “word does not exist”, not owner-lexical
  deletion, not commercial publication)
- `needs_more_evidence`

## 17. Human observability

Worksheets expose headword, N’Ko, gloss/sense summaries, source URL /
`source_record_id`, candidate lexical summaries, affected-reference provenance,
and product-visibility JSON. Reviewers are not asked to decide from `ir_id`
hashes alone.

## 18. Stale-context protection

Fingerprints cover protected context (baseline target, candidate set/lexical
context, affected refs or visibility, F15 acceptance identity, cross-review
coupling fields). Edited context fails closed.

## 19. Subject preservation (regeneration)

| Check | Result |
|-------|--------|
| Type-A same subject set | **YES** |
| Type-A same order | **YES** |
| Type-B same subject set | **YES** |
| Type-B same order | **YES** |

All human review fields blank: **PASS** (Type A + Type B)

## 20. Blank dry-runs

Ambiguous remap:

```
rows_read=5
rows_skipped_unreviewed=5
preview_row_count=0
error_count=0
```

Missing disposition:

```
rows_read=42
rows_skipped_unreviewed=42
preview_row_count=0
error_count=0
```

No persistence in F16.

## 21. Provisional G7 result

Using deterministic remaps only:

- `requires_remap=0`
- `ambiguous=14` (still BLOCK for canonical refresh)
- `still_resolves=23`

## 22. Provisional G8 result

Regression: **17 pass / 13 fail** (was 16/14).

Remaining 13:

- 2 `AMBIGUOUS_REFERENCE` (`sr7l_012`, `sr7l_013` kùn homonyms)
- 11 `OTHER` (alias/supplement/owner-path contracts; virtual alias apply blocked
  by remaining ambiguous evidence ids)

## 23. G9 status

**BLOCK — HUMAN DISPOSITION REQUIRED**

42-row worksheet is blank. No automatic retain/delete/equivalent.

## 24. Version-coupled reference debt

**YES**

Downstream artifacts bind Malidaba through `ir_id`. `ir_id` is
`sha256(source_id|url_canonical|source_record_id|parser_version)[:16]`.
F11 established that `source_record_id` **renumbers across editions**.

This is not only a one-time map of 23 references. It is **systemic dependence
on edition-specific ir_id**.

## 25. Recommended identity strategy

**STABLE_LOGICAL_LEXICAL_REFERENCE_LAYER**

Would the next Malidaba edition that renumbers anchors repeat this G7 failure?
**YES** — for any remaining `ir_id`-bound aliases, supplements, variants, and
regression matrices — unless SiraLex stops treating edition-specific `ir_id` as
a stable product identity.

A one-time `EXPLICIT_VERSION_MIGRATION_MAP` can clear *this* edition’s 23
READY remaps. It does not change the architecture that produced G7. F16 does
not implement the logical layer.

## 26. Local artifacts

Under `data/malidaba_delta/current/source_refresh/f16/` (gitignored):

- `downstream_ir_id_remap_proposals.jsonl`
- `malidaba_ambiguous_reference_remap_review_001.csv`
- `malidaba_missing_record_disposition_review_001.csv`
- `transition_review_gate.json`
- `virtual/` (rewritten tables + overlay copies only)

## 27. Tests

`api/malipense_version_delta/tests/test_transition_review_gate.py` plus the
existing F15/F13 suites.

Coverage includes:

- no-overlap case (real data: overlap = 0)
- exact `baseline_ir_id` overlap detection (synthetic)
- deterministic `cross_review_group_id`
- same headword / different `baseline_ir_id` does not couple
- Type-A and Type-B subjects remain separate
- cross-review fields exported and stale-protected
- blank worksheets skip cleanly
- subject set/order preserved on regeneration
- consistency matrix: retain_legacy + accept_removal blocks; retain_legacy + retain_baseline OK; target mismatch blocks; needs_more_evidence blocks removal
- no canonical writes

Full relevant run: **141 passed**

## 28. Non-mutation

| Target | Result |
|--------|--------|
| Canonical IR | UNCHANGED (`97529fc9…`) |
| Review registry | UNCHANGED (`6ada0ee6…`) |
| F15 acceptance | UNCHANGED (`d48d7ee1…`) |
| Aliases / supplements / variants / regressions | NONE |
| Bundles / web/public / search | NONE |
| Owner lexical | NONE |
| Human review persistence | NONE |
| `web/scripts/` | UNTOUCHED |

## 29. git diff --check

PASS

## 30. Working tree

Committed in CORPUS1F16:

- `api/malipense_version_delta/source_refresh/transition/**`
- `api/malipense_version_delta/source_refresh/paths.py`
- `api/malipense_version_delta/tests/test_transition_review_gate.py`
- `api/pyproject.toml`
- `docs/reports/corpus1f16_malidaba_transition_review_gate.md`

Local/gitignored F16 evidence under `data/malidaba_delta/current/source_refresh/f16/`

Not committed: `data/malidaba_delta/**`, `web/scripts/` (untouched)

## 31. Next human gate

**HUMAN REVIEW OF AMBIGUOUS REMAPS + 42 MISSING-RECORD DISPOSITIONS**

Do not apply remaps or mutate canonical `src_malipense` until both worksheets
are reviewed under their separate ontologies.
