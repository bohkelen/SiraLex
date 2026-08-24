# PRODUCT1A — Rights-Aware Product Boundary + Commercial-Safe Candidate

## 1. Decision

**PRODUCT1A_RIGHTS_AWARE_PRODUCT_BOUNDARY_READY**

Fail-closed commercial projection built and audited. No publication. No canonical
mutation. Tracked code/tests/report left **uncommitted** for review.

**Interpretation (non-blocking for SiraLex):** This slice measures
*commercial-exploitation eligibility*, not *noncommercial distributability*.
SiraLex’s stated posture is non-commercial community infrastructure; Malidaba is
CC BY-NC-SA 4.0. An empty commercial-safe candidate is **expected**, not a
roadmap blocker. The useful output is provenance/rights machinery and explicit
separation of code license (MIT/Apache) from data license (source-specific).

## 2. Base commit

`88ea05adb74459b16c17576b9e376771cc5e351f` — *Apply Malidaba canonical source refresh*

## 3. Post-refresh canonical state

| Check | Result |
|-------|--------|
| HEAD | `88ea05ad…` |
| Current Malidaba assertions | 11694 |
| Legacy-retained assertions (canonical layer) | 42 |
| Logical continuity | 57 (10 / 5 / 42); unresolved 0 |
| Canonical regression (INTERNAL_FULL + overlay) | **30 / 0** |
| Reference closure (F21 receipt) | 120 / 0 / 0 |
| G1–G10 | PASS |
| Working tree (pre-PRODUCT1A work) | clean except `?? web/scripts/` |

## 4. Rights profiles

| Profile | Meaning | PRODUCT1A status |
|---------|---------|------------------|
| `INTERNAL_FULL` | All internally permitted sources | Built; regression 30/0 |
| `NONCOMMERCIAL_CANDIDATE` | Malidaba-derived only after rights/compliance review | **Not publication-ready**; marked `REQUIRES_RIGHTS_REVIEW` |
| `COMMERCIAL_SAFE_CANDIDATE` | Full substantive provenance closure for commercial use | Built; **0 lexical records** (fail-closed) |

## 5. Rights classification model

`COMMERCIAL_SAFE_INDEPENDENT` · `COMMERCIAL_SAFE_LICENSED` ·
`NONCOMMERCIAL_SOURCE_DERIVED` · `MIXED_RIGHTS` · `UNKNOWN_RIGHTS` ·
`METADATA_ONLY_NONCONTENT` · `BLOCKED_COMMERCIAL`

Commercial entry requires classification ∈
{`COMMERCIAL_SAFE_INDEPENDENT`, `COMMERCIAL_SAFE_LICENSED`, `METADATA_ONLY_NONCONTENT`}
**and** recursive provenance closure PASS.

## 6. Provenance graph

Product item → record/alias/supplement/variant → `source_id` / evidence ir_ids →
source registry license → rights state. Logical continuity consulted for gap
locators only. Distinguishes lexical identity, source assertion identity,
evidence dependency, derivation dependency, and rights dependency.

## 7. Field-level rights model

Aliases, supplements, and target variants classified separately from lexicon
rows. A commercially eligible record with a Malidaba-derived alias/variant is
**not** commercially indexable with that field. Search filtering drops blocked
alias/variant keys.

Where owner targets mix Malidaba evidence (e.g. some supplements), classification
is `MIXED_RIGHTS`.

## 8. Generated-artifact rights analysis

| Artifact | Nature | Commercial result |
|----------|--------|-------------------|
| `ir_id` / hashes | Pure functional metadata | Metadata-only; does not grant content rights |
| Aliases (24) | Content-derived source-term → Malidaba targets | All blocked (`MALIDABA_DERIVED_ALIAS`) |
| Supplements (8) | Content-derived FR mappings | All blocked (Malidaba and/or owner without commercial permission) |
| Target variant `móbaa` | Content-derived spelling on Malidaba canonical | Blocked (`MALIDABA_DERIVED_VARIANT`) |
| Generated owner index_mappings | Derived postings | Blocked (`COMMERCIAL_PERMISSION_NOT_RECORDED`) |

Generated ≠ rights-free.

## 9. Owner / SiraLex source audit

| Metric | Count |
|--------|------:|
| Owner-attributed product items audited | 7 |
| Independently evidenced lexicon rows | 3 |
| Malidaba-derived owner lexicon | 0 |
| Mixed/unclear (generated index_mappings) | 4 |

Independence evidence: `review_reference` + provenance note “not derived from
Mali-Pense”. Registry license remains `project-internal-review` →
**no recorded commercial permission** → commercial eligibility FAIL
(`COMMERCIAL_PERMISSION_NOT_RECORDED`).

## 10. Recursive provenance closure

One blocked substantive ancestor ⇒ commercial FAIL. Applied to records and
downstream alias/supplement/variant rows.

## 11. Current product surface (INTERNAL_FULL)

| Metric | Value |
|--------|------:|
| Product records | 22206 |
| Lexicon entries | 11697 |
| Unique headwords | 10151 |
| Search keys | 174720 |
| EN keys | 37942 |
| FR keys | 0 (FR surface primarily via `src_*` keys) |
| Aliases | 24 |
| Supplements | 8 |
| Target variants | 1 |
| Regression | 30 pass / 0 fail |

Built from post-refresh F21 canonical_build cache + identity/supplement mapping
overlay (same contract as F20/F21 product validation).

## 12. Malidaba dependence (lexicon-entry denominator = 11697)

| Bucket | Count | % |
|--------|------:|--:|
| DIRECT_MALIDABA | 11694 | 99.97 |
| LEGACY_MALIDABA (in product build) | 0 | 0 |
| MALIDABA_DERIVED (lexicon) | 0 | 0 |
| MIXED_MALIDABA_OTHER (lexicon) | 0 | 0 |
| INDEPENDENT_COMMERCIAL_SAFE | 0 | 0 |
| UNKNOWN_BLOCKED (owner lexicon w/o commercial permission) | 3 | 0.03 |

Canonical legacy layer still has **42** retained assertions; they are not
materialized into the INTERNAL_FULL product build used here (current+index+owner
pipeline). Downstream derived artifacts (aliases/supplements/variants) are
additionally all Malidaba-touching / non-commercial.

## 13. INTERNAL_FULL result

PASS — records=22206 · headwords=10151 · search_keys=174720 · regression 30/0.

## 14. COMMERCIAL_SAFE_CANDIDATE result

records=0 · headwords=0 · search_keys=0

Empty by fail-closed design: every substantive product row is either
CC BY-NC-SA Malidaba or owner content without recorded commercial permission.

## 15. Commercial-safe search result

Empty index (SHA of empty file =
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).
No Malidaba / blocked alias / blocked variant key leakage.

## 16. Bundle prototype

Local only: `data/product1a/commercial_safe_candidate/bundle_prototype/`

`siralex_product_profile = commercial_safe_candidate_v1`  
`publication_authorized = false`  
Manifest SHA: `76667c618fa28f5fd115817f7a98fd07d6525597b5f19bdd2c13664bc1f8ffea`

## 17. Coverage delta

| Metric | Internal | Commercial | Excluded |
|--------|---------:|-----------:|---------:|
| Records | 22206 | 0 | 22206 |
| Headwords | 10151 | 0 | 10151 |
| Search keys | 174720 | 0 | 174720 |
| EN keys | 37942 | 0 | 37942 |
| Aliases eligible | 24 | 0 | 24 |
| Supplements eligible | 8 | 0 | 8 |
| Variants eligible | 1 | 0 | 1 |

Commercial-safe lexical coverage: **0%**. Restricted/mixed: **100%**.

## 18. Query regression by profile

| Profile | Result |
|---------|--------|
| INTERNAL_FULL | pass=30 · fail=0 |
| COMMERCIAL_SAFE | pass=7 · expected_rights_exclusion=23 · unexpected_product_defect=0 |

Absent-query contracts still PASS on empty commercial index; all hit contracts
are EXPECTED_RIGHTS_EXCLUSION.

## 19. Rights-exclusion regression

| Leak class | Count |
|------------|------:|
| direct_malidaba | 0 |
| legacy_malidaba | 0 |
| derived_malidaba | 0 |
| unknown_rights | 0 |
| mixed_rights | 0 |

## 20. Commercial coverage gaps

| Metric | Count |
|--------|------:|
| Gap records | 11697 |
| High-value gaps | 10127 |
| Independent evidence already available (owner lexicon) | 3 |

Gap records are research queues (locators + reason codes), not substitute
lexical entries and do not copy restricted glosses.

## 21. Independent evidence-growth route

```text
commercial coverage gap
  → independent speaker / owner evidence
  → independently authored lexical assertion
  → separate provenance (no Malidaba paraphrase)
  → human linguistic review
  → rights confirmation (registry commercial permission)
  → product candidate
  → publication authorization
```

Malidaba may identify gaps; it must not supply supposedly independent wording.

## 22. Malidaba rights options

| Option | Description | Coverage impact (repo-measurable) |
|--------|-------------|-----------------------------------|
| A | Malidaba only in INTERNAL_FULL | Status quo; commercial 0% |
| B | Explicit commercial permission from rights holder | Would unlock ≤11694 lexicon + derived aliases/supplements/variants if granted and recorded |
| C | Build independent commercial layer over time | Starts from 3 independently evidenced owner rows after commercial permission is recorded; grow via gap queue |
| D | Clearly noncommercial Malidaba edition after dedicated review | Not authorized by PRODUCT1A; still `REQUIRES_RIGHTS_REVIEW` |

B and D are **not** currently authorized.

## 23. Business decision metrics

| Metric | Value |
|--------|------:|
| Commercial-safe lexical coverage | 0% |
| Restricted/mixed coverage | 100% |
| High-value commercial gaps | 10127 |
| Independent owner lexicon already available | 3 |
| Review queue size (gap records) | 11697 |
| Concepts recoverable via independent evidence (seed) | 3 (+ gap-driven research) |
| Concepts needing explicit Malidaba rights for exact source content | ~11694 lexicon + derived tables |

## 24. Product rights manifest

Local: `data/product1a/siralex_product_rights_manifest_v1.jsonl`  
SHA-256: `c40257cba1be069280e0244b02bdfee855a68752d328f9a5e460309b0a48f5cb`  
22239 deterministic rows (records + aliases + supplements + variants).

## 25. Rights invariants

- Correct lexical evidence ≠ commercially usable product content
- CC BY-NC-SA Malidaba ⇒ commercial blocked
- Owner attribution ≠ commercial permission
- Generated artifacts inherit substantive source constraints
- Gap signal ≠ content right
- Search must not leak excluded fields

## 26. Operational debt

`REAL_APPLY_ENTRYPOINT_SHOULD_BE_COMMITTED_AND_AUDITABLE` — **OPEN**  
Classification: `SOURCE_MAINTENANCE_OPERATIONAL_DEBT` (does not block PRODUCT1A)

## 27. Tests

`api/product_boundary/tests/test_product_boundary.py` — **14 passed**

Covers: direct/legacy Malidaba block, derivative/mixed/unknown block, owner
independence without commercial permission, metadata vs substantive
contamination, recursive closure, alias/variant/supplement exclusion, leakage
audit, deterministic serialization, license compatibility.

## 28. Non-mutation

Canonical IR, `shared/malidaba`, review registries, owner IR, `web/public`,
catalog, `web/scripts/` — **unchanged**. Product outputs under
`data/product1a/` (gitignored).

## 29. git diff --check

PASS (on tracked PRODUCT1A additions when reviewed)

## 30. Working tree

Uncommitted for review:

- `api/product_boundary/**`
- `api/pyproject.toml` (package + CLI registration)
- `docs/reports/product1a_rights_aware_product_boundary.md`
- pre-existing `?? web/scripts/`

Local/gitignored: `data/product1a/**`

## 31. Recommended next gate

**SUPERSEDED (2026-08-24 strategic clarification).**

The original recommendation below answered: *“How much could enter a
commercially exploitable product under rights currently recorded?”* That
question is **not** the SiraLex mission gate.

SiraLex is explicitly **non-commercial language infrastructure** (see
`README.md`). Malidaba is **CC BY-NC-SA 4.0**. **0% commercial-safe does not
mean 0% distributable** — it means Malidaba’s NC condition blocks *commercial*
exploitation under the public license, which aligns with project posture.

**Do not pursue PRODUCT1B** (commercial-permission dossier, Malidaba commercial
negotiation, or mass independent re-creation for commercial purposes).

**Correct next rights gate:**

```text
PRODUCT1B_NONCOMMERCIAL_DISTRIBUTION_COMPLIANCE
  → verify attribution (BY)
  → verify data-license notices (code MIT/Apache ≠ data CC BY-NC-SA)
  → verify ShareAlike treatment of Malidaba-derived adapted data (SA)
  → verify source provenance survives bundles/downloads
  → verify README / user-facing credits
  → proceed with dictionary/corpus development
```

See `docs/reports/product1b_noncommercial_distribution_compliance.md`.

PRODUCT1A remains a useful **rights-boundary audit** (provenance machinery,
fail-closed projection, leakage checks). Its commercial-empty candidate is
expected and **not a blocker** for the noncommercial SiraLex roadmap.

**Cancelled:** `PRODUCT1B_COMMERCIAL_PERMISSION_AND_INDEPENDENT_EVIDENCE_ROADMAP`
(commercial licensing is not a roadmap gate for current SiraLex posture).

---

*Original PRODUCT1A recommendation (archived):*

**PRODUCT1B_COMMERCIAL_PERMISSION_AND_INDEPENDENT_EVIDENCE_ROADMAP**

Because measured commercial-safe coverage is 0%: pursue (1) recording
commercial permission for independently authored owner content in the source
registry, and/or (2) explicit Malidaba commercial licensing, and (3) execute
the independent evidence-growth queue.
