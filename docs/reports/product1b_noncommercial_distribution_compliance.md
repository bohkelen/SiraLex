# PRODUCT1B — Noncommercial Distribution Compliance (Implementation Report)

## 1. Decision

**PRODUCT1B_NONCOMMERCIAL_DISTRIBUTION_COMPLIANCE_READY**

All compliance checks C1–C8 PASS. Portable bundle audit PASS. Publication remains unauthorized.

## 2. PRODUCT1A commit / base

| Item | SHA |
|------|-----|
| PRODUCT1A commit | `5c680453e320554c6567c56e642e8344f68853a3` |
| PRODUCT1B base | `5c680453e320554c6567c56e642e8344f68853a3` |
| Pre-PRODUCT1A canonical base | `88ea05adb74459b16c17576b9e376771cc5e351f` |

PRODUCT1A subject: *Add rights-aware product boundary*

## 3. Correct distribution question

PRODUCT1A measured commercial-exploitation eligibility and returned 0% commercial-safe coverage. That is **not** a SiraLex distribution blocker.

PRODUCT1B asks:

> Can SiraLex distribute its dictionary/data **noncommercially** while preserving source-specific licenses, attribution, ShareAlike obligations, provenance, and code/data license separation?

**Cancelled:** `PRODUCT1B_COMMERCIAL_PERMISSION_AND_INDEPENDENT_EVIDENCE_ROADMAP`

## 4. Source rights states

Explicit noncommercial distribution states implemented in `api/source_registry/load.py` and `api/distribution_compliance/`:

| State | Meaning |
|-------|---------|
| `NONCOMMERCIAL_DISTRIBUTION_ALLOWED_SHAREALIKE` | NC + BY + SA obligations satisfied in registry |
| `DISTRIBUTION_PERMISSION_NOT_RECORDED` | Internal review / governance only |
| `REQUIRES_RIGHTS_REVIEW` | License present but posture unclear |
| `UNKNOWN` / `BLOCKED_DISTRIBUTION` | Fail closed |

**Invariant:** noncommercial ≠ automatically distributable.

## 5. Malidaba compliance posture

| Dimension | Status |
|-----------|--------|
| Source ID | `src_malipense` |
| Claimed license | CC BY-NC-SA 4.0 |
| Registry authority | `shared/sources/malipense.yaml` |
| BY (attribution) | Registry-driven (`attribution_template` + authors) |
| NC (noncommercial) | Explicit in manifest + README + `DATA_LICENSES.md` |
| SA (ShareAlike) | Bundle notice on `MALIDABA_ADAPTED_DATA` artifacts |
| Commercial | Blocked (`commercial_distribution: false`) |

## 6. Owner / SiraLex distribution-rights audit

| Item | Value |
|------|-------|
| Source ID | `src_siralex_lexical_review` |
| Claimed license | `project-internal-review` |
| Semantics | **A:** internal review state only; external distribution permission not recorded |
| Independently evidenced lexicon rows | 3 |
| Generated owner index mappings | 4 |
| Total owner product rows | 7 |
| Noncommercial distribution permission recorded | **false** |
| Owner rows distributable | 0 |
| Owner rows excluded | 7 |
| Exclusion reason | `DISTRIBUTION_PERMISSION_NOT_RECORDED` |

Owner rows are **not** silently included in the noncommercial candidate.

## 7. Attribution authority

Attribution is generated from durable registry metadata (`shared/sources/malipense.yaml`):

- `name`, `authors`, `homepage_url`, `claimed_license`, `license_evidence_url`, `attribution_template`
- **Not** hard-coded from report prose

Malidaba attribution source: `shared/sources/malipense.yaml`

Portable bundle carries `ATTRIBUTION.txt` derived from registry.

## 8. Code / data license separation

| Surface | Separation |
|---------|------------|
| `README.md` | Software MIT/Apache vs source-specific data |
| `DATA_LICENSES.md` | Canonical data-license notice |
| Bundle manifest | `software_license` + `data_license_policy: source_specific` |

**C2: PASS**

## 9. Bundle manifest schema

Extended to **`bundle_manifest_v2`** when license enrichment is enabled:

```json
{
  "manifest_schema_version": "bundle_manifest_v2",
  "software_license": { "spdx_expression": "MIT OR Apache-2.0", "applies_to": "application_software" },
  "data_license_policy": "source_specific",
  "distribution": {
    "noncommercial_distribution": true,
    "publication_authorized": false,
    "project_posture": "noncommercial_language_infrastructure"
  },
  "sources": {
    "included": [{ "source_id", "source_title", "source_url", "claimed_license", "license_url", "attribution", "distribution_posture", "sharealike_required", "noncommercial_distribution" }],
    "excluded": [...]
  },
  "artifact_rights_classification": { ... },
  "sharealike_notice": { ... }
}
```

Implementation: `api/bundle_builder/build_bundle.py` + `api/distribution_compliance/manifest.py`

## 10. ShareAlike artifact classification

| Artifact | Classification |
|----------|----------------|
| `records.jsonl` | `MALIDABA_ADAPTED_DATA` |
| `search_index.jsonl` | `MALIDABA_ADAPTED_DATA` |
| `bundle.manifest.json` | `COLLECTION_METADATA` |
| `checksums.sha256` | `COLLECTION_METADATA` |
| `ATTRIBUTION.txt` | `COLLECTION_METADATA` |
| `DATA_LICENSES.md` | `COLLECTION_METADATA` |

Software/build metadata is **not** falsely classified as CC BY-NC-SA.

## 11. NONCOMMERCIAL_DISTRIBUTION_CANDIDATE

Local/gitignored workspace: `data/product1b/noncommercial_distribution_candidate/`

Built from INTERNAL_FULL by excluding rows whose source rights do not support external noncommercial distribution.

## 12. Coverage

| Metric | INTERNAL_FULL | NONCOMMERCIAL_CANDIDATE |
|--------|---------------|-------------------------|
| records | 22206 | 22199 |
| lexicon entries | 11697 | 11694 |
| headwords | 10151 | 10148 |
| search keys | 174720 | 174700 |

### Exclusions (7 records)

| Reason | Count |
|--------|-------|
| `DISTRIBUTION_PERMISSION_NOT_RECORDED` | 7 |
| `INTERNAL_ONLY` | 0 |
| `UNKNOWN` | 0 |
| `OTHER_RIGHTS_BLOCK` | 0 |

## 13. Full provenance scan

| Metric | Value |
|--------|-------|
| records_scanned | 22199 |
| records_with_source_provenance | 22199 |
| records_missing_source_provenance | 0 |
| unresolvable_source_ids | 0 |

## 14. Derived artifact provenance

| Artifact | pass | blocked |
|----------|------|---------|
| aliases | 0 | 0 |
| supplements | 4 | 0 |
| variants | 0 | 0 |
| search index | 174700 candidate postings | license via bundle manifest |

Derived lexical artifacts with unknown substantive provenance: **0**

## 15. Search-license treatment

Search keys derived from Malidaba lexical text are treated as distributed transformed data (`MALIDABA_ADAPTED_DATA`). Per-posting attribution is not duplicated; coverage is via bundle-level source/license manifest + record `source_id` / `record_locator` provenance mapping.

## 16. C1 — Attribution

**PASS**

- README references source-specific licensing
- Portable bundle `ATTRIBUTION.txt`
- Manifest per-source attribution from registry

## 17. C2 — Code/data separation

**PASS**

## 18. C3 — Per-source bundle license

**PASS** — `src_malipense` exposes CC BY-NC-SA 4.0, URL, attribution, distribution posture

## 19. C4 — ShareAlike

**PASS** — notice on Malidaba-adapted lexical payloads

## 20. C5 — Provenance

**PASS**

## 21. C6 — Registry / manifest consistency

**PASS** — no license/URL mismatches

## 22. C7 — Noncommercial posture

**PASS** — NC visible; Malidaba not represented as commercially licensed

## 23. C8 — Owner source separation

**PASS** — owner content without recorded permission excluded from candidate

## 24. Portable bundle audit

**PASS**

Copied to `data/product1b/portable_bundle_audit/` without repository context. Recipient can determine sources, licenses, attribution, ShareAlike status, and provenance linkage from bundle contents alone.

## 25. User-facing credits

**USER_FACING_CREDITS_SURFACE_MISSING** → **`CREDITS_SURFACE_NOT_IMPLEMENTED`**

Web About section exists (`web/src/render/render_more.ts`) but lacks dedicated registry-driven Sources/Credits surface. Per-entry source info exists in dictionary entries. README corrected to describe Credits/Sources as planned. For PRODUCT1B packaging readiness, README + portable bundle notices are sufficient.

## 26. Compliance manifest

Local/gitignored: `data/product1b/siralex_noncommercial_distribution_compliance_v1.json`

CLI: `siralex-check-noncommercial-distribution`

## 27. Tests

```
36 passed (14 PRODUCT1A + 22 PRODUCT1B)
```

Coverage includes: code≠data license, Malidaba CC BY-NC-SA, registry attribution, missing metadata blocks, manifest/registry mismatch, ShareAlike classification, owner fail-closed, provenance scan, portable bundle, non-mutation guards.

## 28. Canonical non-mutation

**NONE** — canonical IR, `shared/malidaba`, review registries untouched.

## 29. Publication non-mutation

**NONE** — no writes to `web/public/`, catalog, or deployment outputs.

## 30. git diff --check

**PASS**

## 31. PRODUCT1B-A compliance hardening

### Unresolved-template audit

Initial portable bundle inspection found literal `{retrieved_at}` and stale
`(pending scope confirmation)` in `ATTRIBUTION.txt` and manifest source
attribution — **C1 was defective** despite prior PASS receipt.

**Fix:** registry-driven template rendering in `api/source_registry/load.py`
with deterministic substitution from durable fields; fail-closed scan in C1
and portable bundle audit.

| Surface | Before | After |
|---------|--------|-------|
| `{retrieved_at}` in metadata | YES (literal) | NO — rendered `2026-01-22` from `license_verified_at` |
| `(pending scope confirmation)` | YES | NO — removed from template |

**Retrieved-at handling:** RENDERED from `shared/sources/malipense.yaml`
`license_verified_at: "2026-01-22"` (matches `license_inference_note` evidence).

### Rendered attribution (Malidaba)

```text
Source: Mali-pense / Malidaba French → Maninka dictionary
License: CC BY-NC-SA 4.0
License evidence: https://www.mali-pense.net/emk/lexicon/indexfr.htm
URL: https://www.mali-pense.net/
Retrieved: 2026-01-22
```

### README / UI credits reconciliation

| Check | Result |
|-------|--------|
| Credits UI implemented | **NO** (`web/src/render/render_more.ts` — About only; no Credits/Sources section) |
| Per-entry source info | YES (`entry.section.source` in dictionary entries) |
| README credits statement | **CORRECTED** — now describes Credits/Sources as planned, not implemented |
| PRODUCT1B audit label | `CREDITS_SURFACE_NOT_IMPLEMENTED` |

C1 remains PASS via README + portable `ATTRIBUTION.txt` + license-aware manifest.

### “Pending scope confirmation” classification

**STALE_ATTRIBUTION_TEMPLATE_TEXT** (with separate **DIFFERENT_SCOPE_QUESTION** for attribution wording)

| Evidence | Finding |
|----------|---------|
| `claimed_license: CC BY-NC-SA 4.0` | Durable license field |
| `license_inference_note` (2026-01-22) | Page explicitly states CC BY-NC-SA 4.0 for lexicon |
| `license_verified_at: 2026-01-22` | Added from same evidence |
| Template `(pending scope confirmation)` | Stale — contradicted license evidence |
| `Pending: Confirm preferred attribution wording` in inference note | Narrower question — preferred wording only, not license scope |

**Final Malidaba distribution posture:** `NONCOMMERCIAL_DISTRIBUTION_ALLOWED_SHAREALIKE`

Not `GENUINE_RIGHTS_SCOPE_UNRESOLVED` — license scope is evidenced; only preferred attribution wording remains open with maintainers.

### Rebuilt bundle hashes (post-hardening)

| Artifact | SHA-256 |
|----------|---------|
| records | `e18c2583a60e8e4a12ce0dc2f21f11cfc1ab2d7f8c9eeb3f2219d2ca8417c1fd` |
| search_index | `1ab532d9885ea8fd1216936fd1564e950260f9015911b0f9a3908a1f6eb7e44a` |
| manifest | `eaa8d65657c610236b52921d52ea76f83584fc9d34b166fe4aad3884e613fd3c` |
| compliance manifest | `d16cd59d24882d757f0cba325cf032388988402bde651418aaad0c3989977434` |

### C1–C8 rerun (post-hardening)

All **PASS**. C1 additionally: `unresolved_placeholder_count = 0`.

### Tests (post-hardening)

**95 passed** (14 PRODUCT1A + 25 PRODUCT1B + 56 bundle-builder), 0 failed.

## 32. Commit status

PRODUCT1B committed after PRODUCT1B-A hardening (subject: *Add noncommercial distribution compliance*).

Not committed: `data/product1b/**`, `web/scripts/`

## 33. Recommended next gate

**PRODUCT2_PUBLICATION_READINESS_AND_CATALOG_BOUNDARY**

Assumes noncommercial distribution only. Validates catalog pointers, publication authorization workflow, and user-facing credits wiring before any `web/public/` bundle promotion.

---

## Relationship to PRODUCT1A

| PRODUCT1A | PRODUCT1B |
|-----------|-----------|
| Commercial-safe projection | Noncommercial distribution compliance |
| 0% commercial-safe (expected) | Not a blocker |
| INTERNAL_FULL correctness | Preserved (30/0 regression) |
| Provenance machinery | Reused for C5/C6 |

## Cancelled path

```text
PRODUCT1B_COMMERCIAL_PERMISSION_AND_INDEPENDENT_EVIDENCE_ROADMAP → CANCELLED
```
