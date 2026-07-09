# Phase 7N2A4F0 Candidate Recomposition Readiness Audit

## 1) Current artifact lineage and featured-baseline decision

### 1.1 Current featured bundle identity

Authoritative featured bundle is the catalog-pinned entry in `web/public/catalog.json`:

- `bundle_id`: `bundle_full_20260616_phase7j_alias_round2_candidate`
- `version`: `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2`
- `content_sha256`: `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef`

This is reinforced by:

- `shared/search_regression/matrix_manifest_v1.json` (Phase 7L pinned regression bundle)
- `docs/PHASE_7N1_RELEASE_DECISION.md`
- `docs/reports/phase7n1_slice5_device_evidence_record.md`

### 1.2 Current featured package identity

A reproducible package identity exists as a transport artifact record (not catalog promotion):

- package filename: `bundle_full_20260616_phase7j_alias_round2_candidate.siralex.zip`
- package SHA-256: `sha256:d8273a18b739b8f0c165335dd104f944cb4079ed826a54f43b28d77ba26f7903`
- recorded in `docs/PHASE_7N1_RELEASE_DECISION.md` and `docs/reports/phase7n1_slice5_device_evidence_record.md`

### 1.3 Baseline-lineage decisions (required)

1. Current featured candidate/bundle identity: `bundle_full_20260616_phase7j_alias_round2_candidate`.
2. Current featured package identity exists (recorded package above).
3. `bundle_full_20260616_phase7j_alias_round2_candidate` remains the authoritative featured source baseline for behavior contracts and 7L matrix pinning.
4. `bundle_full_20260606_6b8b401a` (used in 7N2A4E1-R durability validation) is a **historical compatibility baseline only** for supplement-path evidence checks; it is not the final 7N2A recomposition baseline.
5. Future 7N2A candidate must preserve existing Phase 7J alias behavior and current 7L-pinned contracts unless explicitly and reviewedly changed by 7N2A deltas.
6. Full recomposition must source from canonical tracked inputs, not historical-bundle inheritance:
   - `data/ir/malipense_lexicon_v3.jsonl`
   - `data/ir/malipense_index_v1.jsonl`
   - `data/ir/siralex_owner_lexical_v1.jsonl`
   - `shared/target_variants/reviewed_target_variants_v1.jsonl`
   - `shared/aliases/source_aliases_v1.jsonl`
   - `shared/source_index_supplements/source_index_supplements_v1.jsonl`

### 1.4 Architectural answer (extend historical bundle vs full recomposition)

Authoritative answer: **future 7N2A candidate must be rebuilt by canonical recomposition, not by extending a historical bundle directory as primary construction path**.

Reason:

- `móbaa` is a target-side overlay applied during normalization (`normalizer.cli --target-variant-overlay`), not a post-bundle patch.
- owner lexical records (`a9c7d82decee9191`, `fefe9b063e05ed11`) are canonical IR inputs that must be normalized/enriched into candidate records.
- source aliases and source-index supplements are tracked overlays that must be applied over recomposed artifacts.
- historical-bundle merge utilities are valid compatibility tools but are not sufficient as the canonical assembly source for all accepted 7N2A layers.

## 2) Authoritative future candidate input set

The future candidate must compose all approved tracked inputs:

1. Owner lexical IR:
   - `data/ir/siralex_owner_lexical_v1.jsonl`
   - `a9c7d82decee9191` (`ndándayoro`)
   - `fefe9b063e05ed11` (`ndándadiya`)
2. Reviewed target variant overlay:
   - `shared/target_variants/reviewed_target_variants_v1.jsonl`
   - `móbaa` for canonical `c5f78c8ac66eac6b` (`móyibaa`)
3. Source alias table:
   - `shared/aliases/source_aliases_v1.jsonl`
   - `maman -> mère` generic posting only (`e5164efcdf5e6ca4`)
4. Source-index supplement table:
   - `shared/source_index_supplements/source_index_supplements_v1.jsonl`
   - `src_supp_phase7n2a_0001` (`hôpital`, additive)
   - `src_supp_phase7n2a_0002` (`clinique`, new)
   - `src_supp_phase7n2a_0003` (`centre de santé`, new)
5. Frozen Mali-Pense canonical IR:
   - `data/ir/malipense_lexicon_v3.jsonl`
   - `data/ir/malipense_index_v1.jsonl`

Required preserved behaviors for recomposed candidate:

- `maman` excludes vocative/respectful mother senses.
- `móyibaa` remains preferred canonical form.
- `place` remains existing path including `díya`.
- `place` / `location` do not route to health owner records.
- `yoro` absent.
- `dándaso` remains first under `hôpital`.

## 3) Exact proposed dependency pipeline

Repository-supported dependency order for a full 7N2A candidate:

### Stage 0: validate tracked overlays and source tables

- Validate source alias table against recomposed base records/index.
- Validate source-index supplement table against recomposed records/index (with explicit `--owner-lexical-ir`).
- Overlay validation occurs via normalizer preflight when `--target-variant-overlay` is provided.

First 7N2A visibility:

- None in runtime artifacts yet; only contract validity gates.

### Stage 1: compose and normalize canonical IR inputs

Normalize in one run from:

- `malipense_lexicon_v3.jsonl`
- `malipense_index_v1.jsonl`
- `siralex_owner_lexical_v1.jsonl`
- plus explicit target overlay file

First 7N2A visibility:

- owner lexical records become normalized entries.
- `móbaa` becomes target-search-key variant on canonical `c5f78c8ac66eac6b`.

### Stage 2: apply target-side reviewed variants

Implemented in-reach of Stage 1 by explicit `--target-variant-overlay` during normalization.

First 7N2A visibility:

- `móbaa` is searchable as variant; no new `ir_id`; preferred form remains `móyibaa`.

### Stage 3: enrich composed records

Enrich normalized output with IR display projections.

First 7N2A visibility:

- owner records are display-complete for bundle/runtime rendering.

### Stage 4: apply source aliases

Apply approved alias table onto source index.

First 7N2A visibility:

- `maman` source lookup path appears, copying only generic `mère` posting.

### Stage 5: generate supplement-derived source mappings

Generate supplement-derived index mappings using:

- supplements table
- composed enriched records
- alias-applied source index
- explicit `--owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl`

First 7N2A visibility:

- deterministic generated mapping records for `hôpital`/`clinique`/`centre de santé`.

### Stage 6: merge source mappings into source search index

Merge generated supplement mappings into source index in fail-closed mode.

First 7N2A visibility:

- health-term source postings become active in final source index.
- `hôpital` additive ordering preserves base first, then owner IDs.

### Stage 7: build final search index

For full recomposition, final index must include:

- target keys from composed normalized/enriched records (including `móbaa`)
- source keys from alias and supplement layers

Critical ordering constraint:

- supplement generation/merge depends on prior base index (and alias layer if aliases are part of the same candidate).
- final emitted candidate index must be the post-alias/post-supplement index.

### Stage 8: assemble candidate bundle

Build bundle from final candidate records and final candidate search index.

### Stage 9: run regression and candidate validation

Run existing 7L regression gate against candidate identity plus additive 7N2A integration matrix (recommended below).

### Stage 10: build deterministic package only after candidate acceptance

Package only after acceptance gates pass; package is transport wrapping of verified bundle.

## 4) Operation-by-operation command inventory

For each required operation: entry point, inputs, outputs, determinism, tracked-file mutation risk, `/tmp` safety, predecessors.

### 4.1 Normalize combined Mali-Pense + owner IR

- Entry point:
  - `python3 -m normalizer.cli`
- Required inputs:
  - `--input data/ir/malipense_lexicon_v3.jsonl`
  - `--input data/ir/malipense_index_v1.jsonl`
  - `--input data/ir/siralex_owner_lexical_v1.jsonl`
  - `--target-variant-overlay shared/target_variants/reviewed_target_variants_v1.jsonl`
- Output:
  - normalized JSONL path (caller-chosen, safe under `/tmp`)
- Deterministic:
  - yes for fixed inputs/order; fail-closed preflight and transactional output write.
- Mutates tracked files:
  - no (unless output path is pointed into tracked tree intentionally).
- Safe under `/tmp`:
  - yes.
- Predecessors:
  - tracked IR and overlay rows exist and validate.

### 4.2 Apply reviewed target-variant overlay explicitly

- Entry point:
  - same as 4.1 (`normalizer.cli --target-variant-overlay ...`)
- Inputs:
  - overlay JSONL + loaded IR set.
- Output:
  - composed normalization with overlay-applied variants.
- Deterministic:
  - yes.
- Mutates tracked files:
  - no by default.
- `/tmp` safety:
  - yes.
- Predecessors:
  - none beyond Stage 0 table validity.

### 4.3 Enrich composed normalized output

- Entry point:
  - `python3 -m enrichment.cli` (or `siralex-enrich`)
- Inputs:
  - composed normalized JSONL
  - same IR set (`--ir` repeated)
- Output:
  - enriched JSONL
- Deterministic:
  - yes for fixed inputs/order.
- Mutates tracked files:
  - no unless output path targets tracked files.
- `/tmp` safety:
  - yes.
- Predecessors:
  - Stage 1/2 normalized output.

### 4.4 Apply source aliases

- Validation entry point:
  - `python3 -m source_aliases.validate_alias_table` (or `siralex-validate-source-aliases`)
- Application entry point:
  - `python3 -m source_aliases.apply_aliases_to_search_index` (or `siralex-apply-source-aliases`)
- Inputs:
  - `--aliases shared/aliases/source_aliases_v1.jsonl`
  - `--records <candidate records>`
  - `--search-index <base source index>`
- Output:
  - alias-augmented search index + report
- Deterministic:
  - yes (sorted serialization; conservative fail-closed conflict handling).
- Mutates tracked files:
  - no by default.
- `/tmp` safety:
  - yes.
- Predecessors:
  - base search index exists.

### 4.5 Generate source-index supplement records (with owner IR)

- Entry point:
  - `python3 -m source_index_supplements.generate_supplement_records`
  - (`siralex-generate-source-index-supplements`)
- Required inputs:
  - `--supplements shared/source_index_supplements/source_index_supplements_v1.jsonl`
  - `--records <candidate records>`
  - `--search-index <current source index>`
  - `--owner-lexical-ir data/ir/siralex_owner_lexical_v1.jsonl`
- Output:
  - `--output-records <records_with_supplements.jsonl>`
  - `--output-report <generate_report.json>`
- Deterministic:
  - yes (deterministic generated IDs and projection checks).
- Mutates tracked files:
  - no by default.
- `/tmp` safety:
  - yes.
- Predecessors:
  - candidate records and current source index exist.

### 4.6 Merge supplements into candidate source index

- Entry point:
  - `python3 -m source_index_supplements.merge_supplements_into_search_index`
  - (`siralex-merge-source-index-supplements`)
- Inputs:
  - supplements table
  - records input
  - baseline search index
  - baseline bundle dir (manifest identity)
  - optional owner lexical IR
- Output:
  - merged search index + compatibility merge report
- Deterministic:
  - yes for fixed inputs.
- Mutates tracked files:
  - no by default.
- `/tmp` safety:
  - yes.
- Predecessors:
  - supplement generation/validation preconditions satisfied.

### 4.7 Construct final search index from complete candidate record set

- Entry point:
  - `python3 -m search_index.cli` (or `siralex-build-index`)
- Inputs:
  - candidate records JSONL
- Output:
  - deterministic sorted `search_index.jsonl`
- Deterministic:
  - yes (sorted keys, stable posting order by first occurrence).
- Mutates tracked files:
  - no by default.
- `/tmp` safety:
  - yes.
- Predecessors:
  - final candidate records ready.

### 4.8 Build bundle

- Entry point:
  - `python3 -m bundle_builder.cli build` (or `siralex-build-bundle build`)
- Inputs:
  - `--normalized <candidate records.jsonl>`
  - `--search-index <candidate search_index.jsonl>`
  - output bundle parent directory
- Output:
  - new bundle directory with manifest/checksums/records/index
- Deterministic:
  - content hash deterministic for same payload; bundle_id includes date + content hash.
- Mutates tracked files:
  - no by default when output to build/tmp path.
- `/tmp` safety:
  - yes.
- Predecessors:
  - final records and index.

### 4.9 Build deterministic package

- Entry point:
  - `python3 -m bundle_builder.cli package` (or `siralex-build-bundle package`)
- Inputs:
  - verified bundle dir
  - explicit output zip path
- Output:
  - deterministic STORED zip `.siralex.zip` with fixed entry order/metadata
- Deterministic:
  - yes for identical verified input bundle.
- Mutates tracked files:
  - no by default.
- `/tmp` safety:
  - yes.
- Predecessors:
  - bundle build + verify success.

### 4.10 Register or record candidate without promotion

- Command/script status:
  - **No dedicated automated candidate-registration CLI found in repository for non-promotion recording.**
- Existing repository-supported mechanism:
  - governance/evidence record update (e.g. `docs/reports/phase7n1_slice5_device_evidence_record.md` style) without `web/public/catalog.json` pointer change.
- Deterministic:
  - manual documentation discipline; not CLI-generated.
- Mutates tracked files:
  - yes only if maintainer chooses to record in docs.
- `/tmp` safety:
  - N/A (documentation artifact).
- Predecessors:
  - candidate identity (bundle/package hashes) already measured.

### 4.11 Run existing 7L regression replay against a candidate

- Entry point:
  - `python3 scripts/run_search_regression.py`
- Inputs:
  - `--matrix shared/search_regression/search_regression_matrix_v1.jsonl`
  - `--manifest shared/search_regression/matrix_manifest_v1.json`
  - `--bundle <candidate bundle dir>`
  - optional `--catalog web/public/catalog.json`
- Output:
  - JSON replay result (stdout or `--output`)
- Deterministic:
  - yes for fixed matrix/manifest/bundle.
- Mutates tracked files:
  - no.
- `/tmp` safety:
  - yes (output can be under `/tmp`).
- Predecessors:
  - candidate bundle built and checksum-known.

## 5) Artifact-class visibility map for each accepted 7N2A change

### 5.1 `ndándayoro` / `ndándadiya` owner lexical records

- First visible in:
  - normalized record (new lexicon entries)
  - enriched record (`display`)
- Then visible in:
  - target search-index rows (`tgt_*`) via recomposed indexing
  - supplement-generated source mappings (`hôpital`, `clinique`, `centre de santé`)
  - bundle records and bundle search index
  - runtime results and package (after candidate publication/install path)

### 5.2 `móbaa` reviewed target variant

- First visible in:
  - normalized canonical record `c5f78c8ac66eac6b` variant/search keys via overlay
- Then visible in:
  - target search-index rows (`tgt_*`)
  - bundle search index
  - runtime target lookup
- Not visible as:
  - preferred form change
  - new `ir_id`

### 5.3 `maman` source alias

- First visible in:
  - source alias table
  - source search-index rows (`src_*`) after alias application
- Then visible in:
  - bundle search index and runtime source lookup
- Not visible in:
  - normalized/enriched records as new record

### 5.4 Health source-index supplements

- First visible in:
  - supplement table
  - supplement-generated index_mapping records
  - merged source search-index rows
- Then visible in:
  - bundle records (when generated mappings included)
  - bundle search index and runtime source lookup
- Must preserve:
  - `hôpital` base `dándaso` first
  - `place`/`location` boundaries and `yoro` absence

## 6) Expected-delta inventory

### 6.1 Existing behavior that must remain unchanged

- all existing Phase 7L regression cases
- source behavior for `mère`
- non-health source mappings
- current target-side preferred forms
- `place` posting and targets (including `díya`)
- existing `dándaso` under `hôpital`
- offline package contract and bundle manifest semantics
- catalog semantics
- source/target index family separation

### 6.2 New expected candidate behavior and artifact visibility

1. `maman` resolves to exact generic `mère` posting only, excluding `wóyì` and `tɔ́ɔma`.
   - visible in: source alias table, source search-index row, bundle search index, runtime result.
2. `móbaa` target lookup resolves via canonical `móyibaa` record; no new `ir_id`; not preferred.
   - visible in: normalized record, target search-index row, bundle search index, runtime result.
3. `hôpital` target order is exactly:
   - `dándaso`, `ndándayoro`, `ndándadiya`.
   - visible in: supplement table, generated mapping record, source search-index row, bundle search index, runtime result.
4. `clinique` resolves only `ndándayoro`, `ndándadiya`.
   - visible in: supplement table, source search-index row, bundle search index, runtime result.
5. `centre de santé` resolves only `ndándayoro`, `ndándadiya`.
   - visible in: supplement table, source search-index row, bundle search index, runtime result.
6. `place` retains `díya`, excludes both health IDs; `location` absent; `yoro` absent.
   - visible in: source search-index rows, bundle search index, runtime result.

## 7) Regression-matrix recommendation

Recommendation: **Option B** — create a new additive 7N2A integration matrix that runs beside the frozen Phase 7L matrix.

Why:

- Phase 7L is explicitly pinned governance + golden gate for featured baseline behavior.
- 7N2A introduces additive contracts that should be gated without rewriting frozen 7L intent.
- This preserves original 7L role as stable regression anchor while enabling explicit 7N2A candidate acceptance coverage.

Minimum future additive 7N2A cases:

1. `maman ->` generic `mère` targets only
2. `maman` excludes vocative/respectful mother senses
3. `móbaa` target lookup -> canonical `móyibaa` record
4. `hôpital` -> `dándaso` first, then both health records
5. `clinique` -> both health records only
6. `centre de santé` -> both health records only
7. `place` retains `díya` and excludes both health records
8. `location` remains absent
9. `yoro` remains absent
10. existing 7L cases unchanged

## 8) Candidate acceptance gates

A future 7N2A candidate should be accepted only if all pass:

1. canonical recomposition completed from tracked IR + tracked overlays/tables.
2. overlay, alias, and supplement validators all pass fail-closed.
3. owner evidence adapter used explicitly for owner targets (`--owner-lexical-ir`).
4. no duplicate keys/postings and deterministic output ordering.
5. expected 7N2A deltas match exactly (including `hôpital` ordering and boundaries).
6. pinned 7L matrix remains green.
7. additive 7N2A integration matrix is green.
8. bundle verify pass and candidate identity hashes recorded.
9. package build occurs only after acceptance.
10. catalog promotion remains separate explicit decision.

## 9) Explicit prohibited shortcuts

The following are prohibited for the recomposition slice:

- treating historical bundle inheritance as substitute for canonical recomposition
- skipping explicit target overlay application
- omitting explicit owner lexical IR for health supplement generation
- introducing synthetic index-mapping evidence in production candidate inputs
- mutating frozen Mali-Pense IR to emulate overlays/aliases/supplements
- bypassing staged validation and regression gates
- promoting catalog pointer as part of candidate-only recording

## 10) Definition of the next implementation slice

Next slice is:

**Phase 7N2A4F1 — Additive 7N2A Candidate Regression Matrix**

Scope boundary for 4F1:

- create additive 7N2A matrix artifacts/cases only;
- do not mutate frozen Phase 7L matrix semantics;
- keep candidate build mechanics unchanged;
- define and validate the minimum 10-case integration contract listed in section 7.

---

Phase 7N2A4F0 defines the authoritative recomposition path for a future 7N2A
candidate. No candidate bundle, package, catalog entry, or user-visible runtime
artifact was generated or changed in this audit slice.
