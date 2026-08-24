# PRODUCT2 — Publication Readiness and Catalog Boundary

## PRODUCT2A — Internal 29/1 root cause (pre-commit)

| Field | Value |
|-------|-------|
| Failed contract | `sr7l_009_poil_supplement` |
| Query | `poil` |
| Direction | `source_to_target` |
| Expected | `hit_single` → `ff499fdee22b2b86` (historical generated supplement mapping IR) |
| Actual | `hit_single` → `ff7fca1eb761ae43` (current F21 internal posting IR) |
| Classification | **PRODUCT2_REGRESSION_HARNESS_BUG** |

**Trace:** Regression matrix expectation names a derived supplement mapping id from pre-refresh supplement generation. F19 virtual product repair projects that id through `generated_mapping_overlay` (`ff499f… → ff7fca…`) at **replay expectation** time; search postings correctly use the current runtime id. PRODUCT2 `evaluate.py` initially loaded only `identity_overlay.json` (10 entries) and omitted the merged supplement mapping projection (19 entries total). PRODUCT1A `build_internal_full` uses the full `_load_post_refresh_overlay()` from `product_boundary.build`.

**Repair:** PRODUCT2 now imports the canonical overlay loader (identity + generated mapping projection). Generic harness fix — no hard-coded case id, no matrix rewrite, no lexical mutation.

**After repair:** INTERNAL_FULL **30 pass / 0 fail**; publication candidate **26 pass + 4 expected owner-rights exclusion = 30**, unexpected defects **0**.

**Commit-reanchor note:** The initial frozen candidate (`bundle_noncommercial_dfd5ba62`) was produced from uncommitted PRODUCT2 code. Human authorization must bind a candidate regenerated from the committed PRODUCT2 HEAD (see `data/product2/siralex_product2_candidate_reanchor_v1.json`).

---

## PRODUCT2B — Exact-byte release artifact identity (pre-authorization)

**Problem:** Pre-commit and post-commit candidates shared the same semantic `content_sha256` and `candidate_fingerprint` (`sha256:77b9773c…`) but differed in `bundle.manifest.json` bytes (e.g. build provenance). The legacy fingerprint bound **semantic payload identity only**, not the full portable release artifact.

**Repair:** Split identity into two explicit concepts:

| Concept | Question | Key fields |
|---------|----------|------------|
| **Semantic content identity** | Same lexical/search product content? | `semantic_bundle_id`, `semantic_content_sha256`, `semantic_candidate_fingerprint` |
| **Release artifact identity** | Exact same distributed portable bytes? | `release_artifact_fingerprint`, `release_artifact_dir_name`, `distributed_file_hashes` |

**Release fingerprint:** `sha256(canonical_json({bundle_id, semantic_content_sha256, distributed_files: {sorted path → sha256}}))` covering `records.jsonl`, `search_index.jsonl`, `bundle.manifest.json`, `checksums.sha256`, `ATTRIBUTION.txt`, `DATA_LICENSES.md`. Stored **outside** the artifact (receipt / authorization v2) to avoid manifest recursion.

**Physical path hardening:** Immutable release directory `{semantic_bundle_id}__{release_artifact_prefix8}` (not semantic content prefix). Distinct release bytes never overwrite an existing immutable path. Existing published directories (e.g. `bundle_full_20260710_337619ff`) remain addressable; `bundle_catalog_v1` unchanged for old entries.

**Authorization:** `publication_authorization_worksheet_v1.json` is **SUPERSEDED_PRE_EXACT_BYTE_AUTHORIZATION_CONTRACT** (semantic-only). New blank worksheet: `publication_authorization_worksheet_v2.json` (`siralex_publication_authorization_v2`) binds `release_artifact_fingerprint` and every distributed file hash. P10 requires exact release artifact identity.

**Not published.** P10 remains **AWAITING_HUMAN_AUTHORIZATION**. Next gate: **PRODUCT2C_EXPLICIT_NONCOMMERCIAL_PUBLICATION_AUTHORIZATION**.

---

## 1. Decision

**PRODUCT2_PUBLICATION_READINESS_READY**

A deterministic noncommercial publication candidate is frozen, rights-closed, offline-installable, catalog-simulation compatible, and user-facing Credits/Sources is implemented. **No publication occurred.** `publication_authorized = false`. P10 remains **AWAITING_HUMAN_AUTHORIZATION**.

## 2. Base commit

`6dc305a1f3bc17a0cd723a30da15c74cb8c924b1` (verified at evaluation)

Tracked tree clean except pre-existing `?? web/scripts/` (untouched).

## 3. PRODUCT1B state

- C1–C8: **PASS**
- Portable bundle audit: **PASS**
- Unresolved metadata placeholders: **0**
- Candidate counts match expected semantic baseline
- Owner rows excluded: **7** (`DISTRIBUTION_PERMISSION_NOT_RECORDED`)
- `publication_authorized`: **false**

## 4. Publication state model

Explicit states (no implicit progression):

| State | Meaning |
|-------|---------|
| `INTERNAL_FULL` | Full internal product surface |
| `NONCOMMERCIAL_DISTRIBUTION_COMPLIANT` | PRODUCT1B-compliant candidate |
| `PUBLICATION_CANDIDATE` | Frozen bytes under publication review |
| `PUBLICATION_READY` | All P1–P9 gates pass; not yet authorized |
| `PUBLICATION_AUTHORIZED` | Human approval bound to exact bytes (**not set in PRODUCT2**) |
| `PUBLISHED` | Catalog pointer promotes immutable bundle (**not set in PRODUCT2**) |

PRODUCT2 reached: **`PUBLICATION_READY`**

## 5. Release candidate identity

Two distinct identities (PRODUCT2B):

| Layer | Fields | Purpose |
|-------|--------|---------|
| Semantic | `semantic_bundle_id`, `semantic_content_sha256`, `semantic_candidate_fingerprint` | Same lexical/search payload |
| Release artifact | `release_artifact_fingerprint`, `release_artifact_dir_name`, `distributed_file_hashes` | Exact portable distributed bytes |

Legacy alias: `candidate_fingerprint` = `semantic_candidate_fingerprint` (insufficient for publication authorization).

Convention: logical id `bundle_noncommercial_{semantic_content_prefix8}`; **immutable physical dir** `{semantic_bundle_id}__{release_artifact_prefix8}` (release-specific, not semantic-only).

## 6. Candidate files / hashes

| File | SHA-256 |
|------|---------|
| `records.jsonl` | `sha256:e18c2583a60e8e4a12ce0dc2f21f11cfc1ab2d7f8c9eeb3f2219d2ca8417c1fd` |
| `search_index.jsonl` | `sha256:1ab532d9885ea8fd1216936fd1564e950260f9015911b0f9a3908a1f6eb7e44a` |
| `bundle.manifest.json` | `sha256:e8c5a2e896e9bdfe77629dfac990fe941c233aaaef341ad7f8378e730eb4a563` |
| `checksums.sha256` | `sha256:cf4ae66c4db75ac85fb9196a5483993f70f7d615f82137c026fdc918748933aa` |
| `ATTRIBUTION.txt` | `sha256:f9d747fef3acef5ab2f6800ae190d58c274cc5238eb26c75495c3ccd608aec6e` |
| `DATA_LICENSES.md` | `sha256:cdbec942ebd3ae8dfb5bd21f2925884a4fe94df7d4306ee72020ec54d52ee3c7` |

Frozen workspace: `data/product2/frozen_bundle/` (gitignored).

## 7. Candidate profile

| Metric | Value |
|--------|-------|
| Profile | `NONCOMMERCIAL_DISTRIBUTION` |
| records | 22199 |
| lexicon_entries | 11694 |
| headwords | 10148 |
| search_keys | 174700 |

## 8. Rights / provenance closure

- `src_malipense` included
- Claimed license: **CC BY-NC-SA 4.0**
- Distribution posture: **NONCOMMERCIAL_DISTRIBUTION_ALLOWED_SHAREALIKE**
- Owner source not included; owner product rows included = **0**
- Missing substantive provenance = **0**
- Unresolvable source ids = **0**
- Unresolved attribution placeholders = **0**
- Owner leakage audit: **PASS** (0 lexical rows, 0 index postings, 0 owner-only keys)

## 9. Credits / Sources implementation

- **More → Credits & sources** navigation row
- Renderer: `web/src/render/render_sources_credits.ts`
- Projection: `web/src/bundle_credits.ts` from `bundle_manifest_v2`
- Stored on install in `ActiveBundleMeta.source_credits`
- Separate display of software license (MIT OR Apache-2.0) vs per-source data licenses
- Malidaba CC BY-NC-SA 4.0, NonCommercial, ShareAlike visible when present in manifest

## 10. Offline credits test

- Vitest: `web/src/publication_readiness_offline.test.ts` — installs frozen candidate from `data/product2/`, verifies v2 manifest parse + credits projection without network — **PASS**

## 11. Portable bundle

Copied to `data/product2/portable_bundle_audit/frozen/` with no repository context — **PASS**

## 12. Offline install

Repository install path (`installBundleIntoDb`) with local bundle files — **PASS**

## 13. Search validation

Rights-aware regression vs INTERNAL_FULL (30-case surface):

| Metric | Count |
|--------|-------|
| Internal pass | 30 |
| Internal fail | 0 |
| Publication candidate pass | 26 |
| Expected owner-rights exclusion | 4 |
| Unexpected defects | **0** |
| Accounting | 26 + 4 = **30** classified |

Partial owner exclusion (e.g. `7n2a_hopital_health_order` retains Malidaba hit, drops owner-only expected ids) classified as **EXPECTED_OWNER_RIGHTS_EXCLUSION**.

## 14. Rights leakage audit

| Check | Result |
|-------|--------|
| Owner lexical rows | 0 |
| Owner index postings | 0 |
| Owner-only search keys | 0 |
| Unknown-rights substantive records | 0 |
| Unresolved distribution rights | 0 |

## 15. Current catalog contract

- Schema: `bundle_catalog_v1` (`web/src/bundle_catalog.ts`)
- Fields consumed: `bundle_id`, `name`, `version?`, `size_bytes`, `url_base`, `content_sha256`, optional `languages` / `language_labels`
- No `status` / `featured` in schema; featured selection via env + sort order
- Current published bundles in `web/public/catalog.json` (3 entries); featured id `bundle_full_20260710_337619ff`

## 16. Proposed catalog entry (local/gitignored)

`data/product2/proposed_catalog_entry_v1.json`:

```json
{
  "bundle_id": "bundle_noncommercial_dfd5ba62",
  "name": "French ↔ Maninka (noncommercial)",
  "version": "noncommercial-publication-candidate-product2",
  "size_bytes": 32805478,
  "url_base": "./bundle_noncommercial_dfd5ba62__dfd5ba62/",
  "content_sha256": "sha256:dfd5ba62514caa72f9e282d16160ded01c26164c5c982fd6d164b78b6f7aeb33",
  "languages": { "source_lang": "fr", "target_lang": "mnk" },
  "language_labels": { "source": "French", "target": "Maninka" }
}
```

## 17. Catalog boundary

| Layer | Role |
|-------|------|
| **Bundle artifact** | Immutable content at versioned path |
| **Catalog entry** | Metadata describing one immutable bundle |
| **Active pointer** | Mutable publication decision (env / user install) |

New bundle does not overwrite old immutable bytes. Pointer change is a separate explicit operation.

## 18. Staged catalog simulation

Local mirror: `data/product2/catalog_simulation/` — **PASS**

- Old bundles remain addressable: **YES**
- New candidate addressable: **YES**
- Active selection deterministic: **YES**
- No missing paths / checksum mismatch

## 19. Rollback semantics

- Rollback target: `bundle_full_20260710_337619ff`
- Semantics: restore catalog active/recommended pointer
- Does **not** delete historical bundle bytes or rewrite previous bundle

## 20. Publication transaction design

Guarded transaction (not executed): freeze → verify semantic + release fingerprints → verify authorized distributed file hashes → verify destination absent or byte-identical release path → copy immutable release artifact → validate copy → update catalog atomically → validate runtime → rollback pointer on failure. **No overwrite of differing bytes at existing bundle id or release path.**

## 21. Authorization contract

- **Superseded:** `data/product2/publication_authorization_worksheet_v1.json` — `SUPERSEDED_PRE_EXACT_BYTE_AUTHORIZATION_CONTRACT` (semantic-only fingerprint)
- **Current blank worksheet:** `data/product2/publication_authorization_worksheet_v2.json` (`siralex_publication_authorization_v2`)

Protected fields bind semantic identity, `release_artifact_fingerprint`, full `distributed_file_hashes`, counts, C1–C8, regression accounting, P gates. Editable future fields: `publication_decision`, `reviewer_id`, `reviewed_at`, `review_method`, `notes`.

## 22. Exact-byte authorization rule

Publication authorization MUST bind `release_artifact_fingerprint` and every entry in `distributed_file_hashes`. The legacy `semantic_candidate_fingerprint = sha256(canonical_json({bundle_id, semantic_content_sha256}))` remains for semantic lineage only; manifest-only or sidecar changes change release identity without changing semantic identity.

## 23. Documentation consistency

Updated:

- `README.md` — Credits & sources available after bundle install
- `docs/USER_GUIDE.md` — offline Credits workflow
- `docs/BUNDLE_DISTRIBUTION.md` — catalog boundary, credits, rollback

No fake download URL. No claim that publication occurred.

## 24. P1–P10 gates

| Gate | Result |
|------|--------|
| P1_CANDIDATE_REPRODUCIBLE | PASS |
| P2_BUNDLE_INTEGRITY | PASS |
| P3_RIGHTS_COMPLIANCE | PASS |
| P4_PROVENANCE_COMPLETE | PASS |
| P5_OFFLINE_INSTALL | PASS |
| P6_SEARCH_VALIDATION | PASS |
| P7_USER_CREDITS | PASS |
| P8_CATALOG_COMPATIBILITY | PASS |
| P9_ROLLBACK_DESIGN | PASS |
| P10_PUBLICATION_AUTHORIZATION_NOT_YET_GRANTED | **AWAITING_HUMAN_AUTHORIZATION** |

## 25. Tests

Python (PRODUCT2 module + baseline suites):

- `publication_readiness/tests/`: 17 tests
- Combined product_boundary + distribution_compliance + bundle_builder + publication_readiness: **128 passed**

Web:

- `bundle_credits.test.ts`, `render_sources_credits.test.ts`, `render_more.test.ts`, `publication_readiness_offline.test.ts`: **14 passed**

CLI: `siralex-check-publication-readiness`

## 26. Canonical non-mutation

**NONE** — no changes to canonical lexical IR, `shared/malidaba`, or human review registries.

## 27. web/public non-mutation

**NONE** — `web/public/catalog.json` and published bundle directories unchanged.

## 28. git diff --check

**PASS**

## 29. Working tree

Tracked implementation uncommitted (per commit policy):

- `api/publication_readiness/`
- Credits UI + manifest v2 install support
- Tests, docs, report
- `?? web/scripts/` untouched

Gitignored artifacts: `data/product2/`

## 30. Recommended next gate

**PRODUCT2C_EXPLICIT_NONCOMMERCIAL_PUBLICATION_AUTHORIZATION**

Requires human completion of authorization worksheet v2 binding exact `release_artifact_fingerprint` and distributed file hashes, then catalog pointer promotion as a separate reversible transaction.

---

**Publication readiness receipt SHA:** `sha256:afb78a0ef2d9e0a74b556a57f4c33c492c67d1b9fc40aafd26d001f0d7dd3d9e`

Receipt path: `data/product2/siralex_publication_readiness_v1.json`
