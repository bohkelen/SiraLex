# CORPUS1F11 — Malidaba Parser Compatibility Restoration + Trusted Delta Rerun

## 1. Decision

**CORPUS1F11_MALIDABA_PARSER_COMPATIBILITY_RESTORED**

Human-review readiness: **MALIDABA_DELTA_HUMAN_REVIEW_READY**

## 2. Base commit

`0d09cb94e24e59d37eb9dd72533a9107689cec9e`

(CORPUS1F10: *Add guarded Malidaba version delta audit*)

## 3. F10 blocked state

CORPUS1F10 correctly blocked semantic compare because May 2026 HTML nests
`lxP2` inside `lxP` while the historical parser collected only following
siblings → **0 / 11,694** current senses. Identity-only NEW/MISSING counts were
evidence, not trusted lexical growth.

## 4. HTML structure change

Inspected all baseline (26) and current (27) lexicon pages in the existing
captures.

| Layout | Baseline (Jan 2026) | Current (May 2026 crawl) |
|--------|---------------------|---------------------------|
| Raw / BS4 | `lxP` then sibling `lxP2` | `lxP2` nested inside `lxP` (malformed HTML; BS4 nests) |
| Page pattern | 26/26 sibling | 27/27 nested |
| Multiple `lxP2` per entry | yes (siblings) | yes (nested children) |
| Gloss tags | primarily `div.GlFr/En/Ru` | primarily `span.GlFr/En/Ru` |
| Mixed nested+sibling | not observed as real dual ownership | raw “mixed” flags were false positives from close-tag heuristics; BS4 shows nested-only |

Entry boundaries remain recoverable: next `p.lxP` (not `lxP2`) starts the next entry.

## 5. Parser compatibility implementation

Updated `api/ir_parser/malipense_lexicon.py`:

1. `_collect_entry_elements` — nested `lxP2` + sibling blocks, deduped by object id
2. Layout-aware gloss lookup — `div` always; `span` only when `lxP2.parent is header`
3. Example translation walk accepts `span` glosses under the same rule
4. Header-strip field extraction excludes nested `lxP2` (prevents false `ps_raw` / cross-field bleed)
5. Explicit warning `structural_lxp2_present_but_no_senses` when structure exists but senses empty

## 6. Parser-version decision

**Kept `PARSER_VERSION = malipense_lexicon_v1`.**

Rationale: change broadens syntactic compatibility only. Historical sibling/div
HTML continues to produce the **same semantic IR projection** as canonical
`malipense_lexicon_v3.jsonl` (0 semantic diffs on full baseline reparse). No
silent rewrite of historical semantics → no new parser identity required.

Canonical baseline IR was **not** regenerated.

## 7. Historical regression result

**PASS**

| Check | Result |
|-------|--------|
| Reparse rows | 8,823 |
| Identity key set | exact match to canonical |
| Semantic projection diffs | **0** |
| Entries with senses | 8,776 / 8,823 |
| Nested pages in baseline | 0 |
| Baseline reparse SHA-256 | `64b5509e97274f4045302e61c12697519a32cad7a51ac3433c9d975664592142` |

Temporary output: `data/malidaba_delta/current/f11_gates/baseline_reparse.jsonl` (gitignored).

## 8. Current structural coverage result

**PASS** (same 2026-08-21 crawl; no re-crawl)

| Metric | Value |
|--------|------:|
| Current rows | 11,694 |
| Structurally expected sense entries | 10,124 |
| Parsed with senses | 10,124 |
| Unexpected no-sense (expected but empty) | **0** |
| Parsed without senses (no structural gloss/Exe/SnsN) | 1,570 |
| Nested `lxP2` pages | 27 / 27 |

## 9. Current corrected IR count

**11,694** entry records (header identity space unchanged from F10; senses now filled where structure warrants).

## 10. Stable identity hierarchy

`identity_rule_id`: **`malipense_identity_v2_partial`**

1. **STRONG** — `(url, source_record_id)` + same headword  
2. **PROVISIONAL** — unique `(url, headword)`  
3. **EXACT_CONTENT_SUPPORTED** — within ambiguous same-page/same-headword groups, unique identical canonical semantic projection (1:1 only)  
4. **AMBIGUOUS** — remaining homonym collisions  
5. **UNMATCHED_*** — NEW / MISSING evidence  

No fuzzy / edit-distance matching.

## 11. Identity refinement findings

- `source_record_id` remains unstable across editions (renumbering).
- Exact semantic projection recovered **490** additional confident pairs inside
  ambiguous homonym groups without collapsing changed senses.
- Remaining ambiguity kept explicit.

## 12. Strong / exact / provisional / ambiguous counts

| Confidence | Count |
|------------|------:|
| STRONG | 13 |
| EXACT_CONTENT_SUPPORTED | 490 |
| PROVISIONAL | 6,218 |
| AMBIGUOUS | 4,234 |
| UNMATCHED_BASELINE | 42 |
| UNMATCHED_CURRENT | 2,799 |

Overall identity confidence: **PARTIAL**

## 13. Semantic delta counts

Semantic comparison: **ACTIVE**

| Classification | Count |
|----------------|------:|
| UNCHANGED | 2,401 |
| CHANGED_EXISTING_RECORD | 4,320 |
| NEW_IN_CURRENT_SOURCE | 2,799 |
| MISSING_FROM_CURRENT_SOURCE | 42 |
| IDENTITY_AMBIGUOUS | 4,234 |

Matched identity pool for UNCHANGED/CHANGED = STRONG + EXACT + PROVISIONAL (6,721).

## 14. Change subtype counts

| Subtype | Matched records (may multi-label) |
|---------|----------------------------------:|
| GLOSS_CHANGED | 2,190 |
| SENSE_CHANGED | 3,366 |
| VARIANT_CHANGED | 663 |
| IDIOM_CHANGED | 705 |
| EXAMPLE_CHANGED | 165 |
| CROSS_REFERENCE_CHANGED | 219 |
| NKO_CHANGED | 32 |

(`OTHER_LEXICAL_CHANGE` no longer dominates after header-strip PS bleed fix.)

## 15. Exact headwords absent from baseline

| Descriptor | Value |
|------------|------:|
| Current unique headwords | 10,148 |
| Baseline unique headwords | 7,434 |
| **CURRENT_HEADWORD_ABSENT_FROM_BASELINE** (unique) | **2,754** |
| Records carrying those headwords | 2,797 |

Separate from NEW record evidence (2,799 unmatched current records).

## 16. Baseline headwords absent from current

| Descriptor | Value |
|------------|------:|
| **BASELINE_HEADWORD_ABSENT_FROM_CURRENT** (unique) | **40** |
| Records | 42 |

Not asserted as deletions.

## 17. N’Ko delta

| Side | Records with N’Ko headword | Examples | Idiom/subentries |
|------|---------------------------:|---------:|-----------------:|
| Baseline | 8,823 | 1,334 | 1,814 |
| Current | 11,694 | 3,748 | 6,278 |

Among confidently matched records: N’Ko changed **32**, examples changed **165**, idioms changed **705**.

## 18. Example / idiom delta

See §17. Sense-level parse restoration enables these counts; they are evidence only.

## 19. Source-count reconciliation

| Unit | Figure | Notes |
|------|------:|-------|
| May 2026 public base | 7,913 | page claim |
| May 2026 public addon | 1,950 | page claim |
| Public sum | 9,863 | ≠ IR rows |
| Baseline IR rows | 8,823 | |
| Current IR rows | 11,694 | entry blocks |
| Current with senses | 10,124 | structural coverage |
| Index IR | 10,501 | out of scope |

Do not force equality across units.

## 20. Determinism hashes

| Artifact | SHA-256 |
|----------|---------|
| Baseline canonical IR | `97529fc9bb69d9eb3a3ce40ffa30cc6a1b881f7f2b5edb2709ae7ed3db4dafe1` |
| Baseline temporary reparse | `64b5509e97274f4045302e61c12697519a32cad7a51ac3433c9d975664592142` |
| Current corrected comparison IR | `fb8e97b0a8e1b82b5fc7874d7af010063112799cc116dd458ae0c48e56778221` |
| Corrected delta JSONL | `6dd2092078ba99c512b1e7b376e68599dd7e3faa1e7f1b8cccd1fe20335abeba` |

Two independent runs → identical current-IR and delta hashes. **Deterministic rerun: PASS**

## 21. Local output paths (gitignored)

```
data/malidaba_delta/current/
  snapshots/src_malipense/crawl_20260821_170103_554_2876_src_malipense/   # unchanged capture
  f11_gates/baseline_reparse.jsonl
  f11_gates/baseline_regression.json
  f11_gates/current_coverage.json
  f11_gates/malidaba_current_ir_corrected.jsonl
  artifacts/malidaba_current_ir.jsonl
  artifacts/malidaba_version_delta.jsonl
  artifacts/malidaba_version_delta_summary.json
```

## 22. Rights boundary

Unchanged: CC BY-NC-SA 4.0; internal evidence ≠ publication authorization; no bundle promotion.

## 23. Non-mutation

| Check | Result |
|-------|--------|
| Canonical IR SHA | unchanged |
| Baseline payload-set SHA | unchanged (`729b061a…`) |
| Canonical snapshots | untouched (no re-crawl; no write into `data/snapshots/src_malipense/`) |
| Bundles / search / catalog | none |
| Non-mutation | **PASS** |

## 24. Tests

`api/ir_parser/tests/` + `api/malipense_version_delta/tests/` → **69 passed**

Includes structural sibling/nested/equivalence/multi-sense/boundary/malformed
warnings; delta unchanged/new/missing/changed; provenance ignored; ambiguous;
exact-content-supported; no fuzzy; parser block vs activate; example/N’Ko
subtypes; determinism; non-mutation.

## 25. git diff --check

**PASS**

## 26. Working tree

Uncommitted CORPUS1F11 tracked changes:

- `api/ir_parser/malipense_lexicon.py`
- `api/ir_parser/tests/test_structure_compat.py`
- `api/malipense_version_delta/**` (identity v2, compare enrichments, tests)
- `docs/reports/corpus1f11_malidaba_parser_compatibility_delta.md`

Pre-existing unrelated: `?? web/scripts/` (untouched).

## 27. Human-review readiness

**MALIDABA_DELTA_HUMAN_REVIEW_READY**

Because: parser compat PASS, baseline regression PASS, structural coverage PASS,
semantic compare ACTIVE, deterministic rerun PASS, identity confidence exposed,
ambiguous rows separated (not force-resolved).

Ambiguous count may be non-zero; those rows must stay excluded from claims that
require known cross-version identity.

## 28. Recommended next gate

**HUMAN REVIEW OF TRUSTWORTHY MALIDABA VERSION-DELTA EVIDENCE**

Focus review queues on:

1. NEW record evidence + CURRENT_HEADWORD_ABSENT_FROM_BASELINE  
2. CHANGED matched records by subtype (gloss/sense/example/idiom)  
3. MISSING / baseline-absent headwords (non-deletion until reviewed)  
4. Keep AMBIGUOUS quarantined  

No automatic promotion.
