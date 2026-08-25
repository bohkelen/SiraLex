# CORPUS1F14 — Malidaba Source-Update / Product-Candidate Boundary

## 1. Decision

**CORPUS1F14_MALIDABA_SOURCE_PRODUCT_BOUNDARY_COMPLETE**

| Primary decision | Value |
|------------------|-------|
| Review-volume | **BATCH001_SUFFICIENT_FOR_SOURCE_FIDELITY_GATE** |
| Source-refresh | **MALIDABA_SOURCE_REFRESH_DESIGN_READY** |
| Product-boundary | **MALIDABA_PRODUCT_CANDIDATES_RIGHTS_GATED** |

## 2. Base commit

`260549d3893cd7fdefff17ff24a5c87b6cea3096` — *Add governed Malidaba delta review persistence* (CORPUS1F13)

## 3. Why the boundary is needed

After F11–F13, SiraLex can prove that Malidaba changed and that 100 new
BASE_LEXICAL records are genuine source deltas. That proof must not silently
become:

```text
confirmed_source_delta → dictionary publication
```

That arrow does **not** exist.

Without an explicit boundary, engineering pressure will collapse:

- source maintenance
- product candidacy
- publication authorization
- commercial rights posture

into one unsafe shortcut.

## 4. Existing authority pipeline

Observed repository flow for `src_malipense`:

```text
shared/sources/malipense.yaml
  → crawl / snapshot under data/snapshots/src_malipense/
  → MalipenseLexiconParser (malipense_lexicon_v1)
  → data/ir/malipense_lexicon_v3.jsonl (canonical build IR)
  → enrichment / search index / bundles
  → web/public/bundle_* manifests (CORE_PUBLISHED_SOURCE)
```

Parallel F11–F13 evidence path (non-canonical):

```text
frozen May 2026 crawl (gitignored comparison workspace)
  → corrected comparison IR
  → trusted version delta
  → triage queues
  → Batch 001 human review
  → local malidaba_delta_reviews_v1.jsonl
```

Owner path (separate source identity):

```text
src_siralex_lexical_review
  → project-internal-review license
  → must NOT claim Mali-pense snapshot evidence
  → small owner IR (siralex_owner_lexical_v1)
```

AL1 alias/content-gap path turns search misses into **reviewed** aliases or
content-gap research — never automatic dictionary truth from user behavior.

## 5. Four-state model

| State | Name | Meaning |
|------:|------|---------|
| 1 | `SOURCE_DELTA_CONFIRMED` | Human confirmed a real Malidaba version difference under F11/F12 rules. Batch 001 has 100 such leaves. |
| 2 | `SOURCE_REFRESH_ELIGIBLE` | Newer `src_malipense` capture/IR may replace the old snapshot/IR as **source maintenance** after engineering + rights gates. Not independent authorship. |
| 3 | `PRODUCT_CANDIDATE_ELIGIBLE` | Evidence may enter a **separate** product-governance workflow. Never automatic from state 1 or 2. |
| 4 | `PUBLICATION_AUTHORIZED` | Content may enter a user-facing bundle/product under applicable rights. Strongest state; never inferred. |

## 6. Source-delta review semantics

`confirmed_source_delta` = source fidelity evidence only.

It confirms extraction/identity under frozen comparison rules.

It does **not** certify linguistic independence, commercial usability,
publication approval, or bundle inclusion.

## 7. Source-refresh semantics

Source refresh = updating the canonical `src_malipense` snapshot + IR to a newer
official Malidaba edition while preserving provenance.

This is **SOURCE FIDELITY VALIDATION**, not entry-by-entry linguistic approval.

Malidaba is already SiraLex’s primary lexicographic authority. Refreshing it
means trusting the newer source edition under engineering gates — not
re-authoring every lexeme.

## 8. Product-candidate semantics

A product candidate is a governed proposal that **references** evidence without
silently copying Malidaba authority into product truth.

Conceptual fields (not implemented):

- `candidate_id`, `candidate_type`
- `source_id` (must remain `src_malipense` when derived)
- `source_delta_review_ids`
- `current_record_fingerprint`, `source_version`
- `evidence_status`, `rights_status`, `product_eligibility`
- `blocked_reasons`

Renaming artifacts does not change rights inheritance.

## 9. Publication semantics

Publication authorization is distribution-specific:

- non-commercial / ShareAlike-compatible distribution may follow source refresh
  under CC BY-NC-SA compliance (attribution, NC, SA)
- commercial productization of Malidaba-derived content remains rights-gated /
  blocked pending separate rights strategy (existing inventory conclusion)

No state below 4 may emit a published bundle claim.

## 10. Rights boundary

Recorded license (`shared/sources/malipense.yaml`): **CC BY-NC-SA 4.0**.

Existing modeling:

| Use | Posture |
|-----|---------|
| Non-commercial source refresh with attribution + SA | `allowed` / `requires_rights_review` for distribution packaging |
| Commercial productization of source-derived Malidaba content | `blocked` / `requires_rights_review` |
| Independent owner lexical additions (`src_siralex_lexical_review`) | project-internal; must not strip or fake Malidaba provenance |

This report does **not** make a legal determination. It binds engineering to
existing rights modeling.

## 11. Commercial vs non-commercial implications

| Path | Commercial? | Malidaba content copy? |
|------|-------------|------------------------|
| Refresh `src_malipense` for NC/SA-compliant offline builds | No (NC) | Yes, as source |
| Put Malidaba glosses into a commercial SiraLex SKU | Yes | **Blocked** without rights change |
| Use Malidaba delta as **gap signal** → owner research → independent record | Possible | No Malidaba text copied |

## 12. Whether remaining 636 new-headword records require review

Counts (F12A / F13):

| Class | Count |
|-------|------:|
| Queue A BASE_LEXICAL | 740 |
| With senses (eligible) | 736 |
| Batch 001 reviewed | 100 |
| Remaining eligible | **636** |
| Onomastic/addon new-headword | 2,055 |
| UNKNOWN PS | 2 |

**Decision: `BATCH001_SUFFICIENT_FOR_SOURCE_FIDELITY_GATE`**

Rationale:

1. Batch 001 was diversity-first across 24 pages; 100/100 confirmed.
2. Parser baseline regression: 0 semantic diffs; current structural coverage PASS.
3. Delta is deterministic and frozen-hash gated.
4. Onomastic material is already separated; ambiguous identity quarantined.
5. Reviewing all 636 would conflate **source fidelity validation** with
   **entry-by-entry linguistic approval** — the wrong question for an already-
   authoritative lexicographic source.
6. Additional review should be **risk-triggered** (parser anomalies, destructive
   change classes, sample audits) — not “because rows exist.”

Do **not** generate Batch 002 in this slice.

## 13. Changed-record future governance

4,320 `CHANGED_MATCHED_RECORD` rows are a **different** problem from new
headwords. Do not mix queues.

Higher future inspection priority (illustrative):

| Change class | Risk |
|--------------|------|
| `HEADWORD_CHANGED` / `NKO_CHANGED` | High — identity / orthography |
| Large `GLOSS_CHANGED` / sense removal patterns | High — meaning drift |
| `SENSE_CHANGED` structure | Medium–high |
| `VARIANT_CHANGED` / `CROSS_REFERENCE_CHANGED` | Medium |
| `EXAMPLE_CHANGED` / `IDIOM_CHANGED` from authoritative source | Lower for source-refresh fidelity |

No changed-record worksheets in F14.

## 14. Missing / destructive-change governance

42 missing-source evidence rows / 40 baseline headwords absent from current are
**not deletions**.

Rule:

> Apparent removals require a stronger future gate than additions.
> No automatic deletion of baseline product knowledge from delta absence alone.

Proposed destructive gate flavor: `NO_UNREVIEWED_DESTRUCTIVE_CHANGE`.

## 15. Ambiguous-identity governance

4,234 identity-ambiguous rows remain quarantined for:

- automatic deletion
- automatic replacement
- cross-version change claims requiring known identity
- product-candidate generation that asserts baseline pairing

They may still be valid current-source records. Delta identity failure ≠ parse
failure.

## 16. Source-content vs gap-signal distinction

**MALIDABA AS SOURCE CONTENT**

Refresh/publish Malidaba-derived IR under the source’s rights posture.

**MALIDABA AS GAP SIGNAL**

A confirmed delta may tell SiraLex: “current snapshot lacks concept/headword X”
without copying Malidaba gloss/example text into a commercial product.

Gap signal may motivate:

- owner / independent speaker research
- `src_siralex_lexical_review` records with separate provenance
- AL1 content-gap workflows

Independent evidence must actually be independent. Provenance stripping to evade
a license is forbidden.

## 17. Owner lexical / independent evidence path

Existing identity `src_siralex_lexical_review` already states additions must
**not** claim Mali-pense snapshot/page evidence.

Future rights-compatible commercial path (design only):

```text
Malidaba gap signal
  → owner / independent evidence research
  → independently authored lexical record
  → separate provenance + review
  → product candidate
  → publication only if authorized
```

Not implemented in F14.

## 18. Proposed source-refresh gates

Before replacing canonical `src_malipense` snapshot/IR:

1. `SOURCE_CAPTURE_VALID`
2. `PARSER_COMPATIBILITY_PASS`
3. `BASELINE_REGRESSION_PASS`
4. `CURRENT_STRUCTURAL_COVERAGE_PASS`
5. `DELTA_DETERMINISTIC`
6. `DELTA_REVIEW_EVIDENCE_SUFFICIENT` (Batch 001 fidelity sample may satisfy)
7. `RIGHTS_POSTURE_ACCEPTED_FOR_TARGET_DISTRIBUTION`
8. `BUILD_REGRESSION_PASS`
9. `NO_UNREVIEWED_DESTRUCTIVE_CHANGE`

Not implemented.

## 19. Proposed product-candidate gate

Minimum future checks:

- explicit candidate artifact (not raw IR copy)
- retained `source_id` / rights inheritance
- `SOURCE_DELTA_CONFIRMED` or stronger evidence reference
- `rights_status ∈ {allowed, requires_rights_review}` for intended distribution
- blocked if commercial use of NC source content without rights strategy
- never auto-created from confirmed deltas alone

## 20. What must never happen automatically

- `confirmed_source_delta` → published dictionary word
- delta absence → deletion
- ambiguous identity → force-matched change claims
- onomastic/addon → treated as ordinary lexicon growth without classification
- Malidaba gloss copy → commercial SKU without rights gate
- artifact rename → rights erasure
- silent same-reviewer competing reviews (closed in F13 hardening)

## 21. Recommended next engineering slice

**Implement SOURCE_REFRESH_ACCEPTANCE gate scaffolding (dry-run only)** for a
future `src_malipense` version bump:

- evaluate gates 1–9 against frozen F11 artifacts + Batch 001 leaf counts
- emit an acceptance receipt
- still **do not** write canonical IR / snapshots / bundles

Optional parallel design spike: gap-signal → owner-lexical candidate template
(no Malidaba text body).

Do **not** start Batch 002 unless a specific fidelity failure appears.

## 22. Files added/modified

Added (uncommitted F14):

- `docs/reports/corpus1f14_malidaba_source_product_boundary.md`

No code changes in F14.

## 23. Non-mutation

| Check | Result |
|-------|--------|
| Canonical IR | NONE |
| Snapshots | NONE |
| Bundles / search / catalog | NONE |
| Aliases / supplements / owner lexical | NONE |
| Product candidates | NONE |
| Batch 002 | NONE |
| Local F13 registry | UNCHANGED |

## 24. git diff --check

PASS for F14 doc addition when staged; F13 already committed cleanly.

## 25. Working tree

After F13 commit: F14 report uncommitted; `?? web/scripts/` untouched.
