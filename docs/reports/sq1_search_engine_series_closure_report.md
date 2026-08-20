# SQ1 — Search-Engine Series Closure

## 1. Decision

```text
SQ1 SEARCH-ENGINE SERIES = CLOSED
```

Documentation/governance only. No runtime, UI, schema, dictionary, corpus,
index, CF2, or query-log changes in this slice.

SQ1E already verified composition of the shipped search floor. This report
closes the **search-engine series** as a product program and records the handoff
away from further retrieval rungs.

## 2. Base tip

```text
b28386a Serialize heavy ML1D2 E2E harness
```

Series-relevant tip for search product work:

```text
fb81d4c Audit search quality closure
```

Post-SQ1E commits on the same branch (`2771c6c`, `b28386a`) are DU1R1/DU1R2
harness scheduling hygiene for featured install/update E2E. They do **not**
reopen SQ1 and do **not** add search rungs.

Current working tree at closure drafting:

```text
?? web/scripts/
```

That path remains **excluded local tooling** (screenshot helper). It is not part
of SQ1 delivery and is not committed by this closure.

## 3. Authoritative slice chain

| Slice | Role | Decision / evidence |
|-------|------|---------------------|
| SQ1A | Search intelligence audit | `docs/reports/sq1a_search_intelligence_audit.md` |
| SQ1B | Prefix suggestions | `03c3099` + `docs/reports/sq1b_prefix_and_suggestions_report.md` |
| SQ1C | Normalization audit | `docs/reports/sq1c_search_normalization_audit.md` |
| SQ1C1 | FR/EN hyphen↔space exact retry | `b61f6ad` + `docs/reports/sq1c1_hyphen_space_query_expansion_report.md` |
| SQ1C2 | FR œ→oe exact retry | `ffb472c` + `docs/reports/sq1c2_french_ligature_query_expansion_report.md` |
| SQ1D | Ranking audit | `a477e71` + `docs/reports/sq1d_search_ranking_audit.md` |
| SQ1D1 | FR exact source-term promotion | `6cbb3eb` + `docs/reports/sq1d1_fr_source_term_promotion_report.md` |
| SQ1E | System closure audit | `fb81d4c` + `docs/reports/sq1e_search_quality_closure_audit.md` |
| SQ1 (series) | This report | `SQ1 SEARCH-ENGINE SERIES = CLOSED` |

Delivered product rungs (executable):

```text
SQ1B   Prefix suggestions
SQ1C1  FR/EN hyphen-space exact retry
SQ1C2  FR œ → oe exact retry
SQ1D1  FR exact source-term promotion
SQ1E   System closure audit
```

## 4. What SQ1 actually delivered

The LookupMode-gated consumer path now has a safer, more complete **search
floor**:

1. Exact ladder on the typed query (all four LookupMode pairs).
2. Miss-only safe variants: FR ligature, then FR/EN hyphen↔space.
3. Miss-only prefix suggestions (min length 3, cap 8); never merged into hits.
4. FR→MNK only: stable promotion of exact `source_term` matches among returned
   records.

Exact still wins. Variants never run on a hit. Prefix never invents results.
No fuzzy match, stemming, morphology, bag-of-words, semantic/AI search, ladder
merge, CF2-driven ranking, dictionary mutation, Russian return, or N’Ko
synthesis was added.

Schema frozen through the series: query-log V3, CF2 feedback V2, IndexedDB v6.
Featured corpus/index artifacts were not mutated by SQ1 slices.

## 5. Product line

```text
SiraLex now handles more reasonable user typing variation
while still preserving dictionary authority.
```

Reasonable variation in scope for SQ1 means: incomplete typing (prefix),
hyphen vs space on FR/EN compounds, French `œ`/`oe`, and exact French
source-term ordering among already-correct hits.

Out of line for SQ1 (and still rejected as next search work):

- fuzzy / typo engines
- plurals / stemming / morphology
- open-vowel folding on Maninka (`ɔ`/`o`, `ɛ`/`e`) as engine policy
- EN or MNK ranking without new metadata
- auto-ranking from CF2 or query logs
- any automatic dictionary write from search misses

## 6. Residual class after SQ1

SQ1 found that some remaining misses are **not retrieval failures**. Exact,
variant, and prefix stages behave correctly; the dictionary simply lacks the
alias or lemma the user typed.

Examples of that class (illustrative; not a demand list):

- valid everyday FR/EN terms with no indexed exact form (`bonjour`, `poulet`, …)
- reviewed-alias territory formerly labeled SQ1F-class in audits
- MNK open-vowel / tone variants that must not be inventively folded in search

That is a **reviewed dictionary-improvement pipeline** problem, not another
search-engine rung.

## 7. Explicit non-reopen

Do **not** add another search rung next.

Deferred / rejected as SQ1 follow-ons:

| Item | Status |
|------|--------|
| Fuzzy / typo search | Rejected for now (unsafe on short MNK) |
| Stemming / morphology | Rejected as engine work |
| EN gloss-first ranking | Deferred until primary/secondary gloss flags exist |
| MNK form ranking / ladder merge | Deferred (tone-less `bon` risk) |
| CF2 / query-log ranking | Out of product for SQ1; schemas stay frozen |
| Automatic corpus mutation from misses | Forbidden |

## 8. Next product direction

```text
AL1 — Reviewed Aliases / Content Gap Workflow
```

Reason: after SQ1, repeated no-result cases that survive exact + variants +
prefix are content/alias gaps. Fixing them requires human review that preserves
dictionary truth.

Proposed first slice:

```text
AL1A — Alias and Content Gap Audit
```

Goal: audit how to turn repeated no-result feedback into **human-reviewed alias
candidates** without mutating dictionary truth automatically.

AL1A is **not started** by this closure. It should remain audit/planning until
explicitly authorized. Existing related surfaces (CF2 search-failure evidence,
Phase 7 reviewed `shared/aliases/source_aliases_v1.jsonl`, owner lexical packets)
are inputs to that audit, not automatic promotion paths.

## 9. Files changed

This closure:

```text
docs/reports/sq1_search_engine_series_closure_report.md
```

Runtime / tests / index / `web/scripts/`: unchanged.

## 10. Final status

```text
SQ1 — Search-Engine Series — CLOSED
```

Next authorized program selection: **AL1**, starting with **AL1A** when ready.
