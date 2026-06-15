# Build Bundle

This document describes the Phase 4.5 developer pipeline for producing a distributable SiraLex bundle.

The **production pipeline for consumer / UI-facing bundles** is unambiguous:

```text
normalized -> enrich -> index -> bundle -> catalog
```

That means:

1. start from normalized JSONL records (no `display` field)
2. **enrich** so every row gains a dict-valued `display` projection from IR `fields_raw` (required for renderable installs)
3. build the search index from that **enriched** JSONL
4. assemble the bundle directory (`records.jsonl` carries enriched rows — including `display`)
5. publish the verified bundle plus root `catalog.json`

Intermediate **normalized-only** builds (skipped enrichment) produce bundles whose `records.jsonl` lacks `display` and **will not render** entry content in the app. Treat those as indexer-only experiments, not shippable consumer bundles.

## Prerequisite

Install the backend CLI tools into your Python environment:

```bash
pip install -e ./api
```

## Step 1: Start From Normalized Records

Input artifact:

- normalized JSONL file

Example path (substitute the ruleset suffix `N` to match your artifact):

```text
data/normalized/malipense_normalized_norm_vN.jsonl
```

Use **`norm_v1`** when reproducing the **frozen v1.0 dataset**. Use the **current successor** artifact — for example **`norm_v3`** — when building the latest search/index bundle from the active normalizer output.

## Step 2: Enrich (required for UI / catalog bundles)

Enrichment joins normalized search metadata with IR `fields_raw` as a read-only **`display`** object per record.

Run `siralex-enrich` after normalization and **before** indexing or bundling:

```bash
mkdir -p data/enriched

siralex-enrich \
  --normalized data/normalized/malipense_normalized_norm_vN.jsonl \
  --ir data/ir/malipense_lexicon_v3.jsonl \
  --ir data/ir/malipense_index_v1.jsonl \
  --output data/enriched/malipense_enriched_norm_vN.jsonl \
  -v
```

Expect **`Missing display (no IR): 0`** in the printed summary when the IR snapshot is complete.

### Display-only drift gate

Before building the search index from enriched output, confirm enrichment did not change any non-display field (`ir_id` set/count, `ir_kind`, `norm_version`, `preferred_form`, `variant_forms`, `search_keys`, and any other normalized keys):

```bash
siralex-validate-enrichment-display-only \
  --baseline data/normalized/malipense_normalized_norm_vN.jsonl \
  --enriched data/enriched/malipense_enriched_norm_vN.jsonl \
  -v
```

If this command fails, **stop** — do not index or bundle until the enrichment output is corrected.

## Step 3: Build the Search Index

Use `siralex-build-index` from the **enriched** JSONL (same key material as normalized; indexer ignores `display`):

```bash
siralex-build-index \
  --input data/enriched/malipense_enriched_norm_vN.jsonl \
  --output build/search_index.jsonl
```

Output:

- `build/search_index.jsonl`

## Step 4: Build the Bundle Directory

Use `siralex-build-bundle` with the **same enriched JSONL** you indexed:

```bash
siralex-build-bundle build \
  --normalized data/enriched/malipense_enriched_norm_vN.jsonl \
  --search-index build/search_index.jsonl \
  --output-dir build/bundles \
  --bundle-type full \
  --source-lang fr \
  --target-lang mnk \
  --source-label French \
  --target-label Maninka \
  --target-script latin \
  --target-script nko
```

Result:

- a new bundle directory under `build/bundles/`
- `bundle.manifest.json`
- `records.jsonl`
- `search_index.jsonl`

The bundle manifest's `rule_versions.normalization` value is derived from the
normalized records' `norm_version`. This is how rulesets such as
`norm_v2` / `norm_v3` remain explicit in published bundles.

The builder also emits `search_index_directional` as a bundle capability:

- `norm_v2` / `norm_v3` build path -> `search_index_directional: true`
- legacy build path -> `search_index_directional: false`

The builder validates that `search_index.jsonl` key families match the declared
capability (directional `src_*`/`tgt_*` only vs legacy undirected only). Mixed
key families fail the build.

For the formal `norm_v2` source-term phrase extraction contract, see
`docs/GLOSS_DECOMPOSITION.md`.

Expected shape:

```text
build/bundles/
  <bundle-id>/
    bundle.manifest.json
    records.jsonl
    search_index.jsonl
```

## Step 5: Verify the Bundle

Verify the generated bundle before publishing it:

```bash
siralex-build-bundle verify build/bundles/<bundle-id>
```

This checks manifest integrity and the bundle payload hashes.

## Step 6: Publish a Catalog Entry

The bundle builder creates the bundle directory, but `catalog.json` is the publisher-facing index that tells the app where to find it.

Minimal runtime-aligned example:

```json
{
  "catalog_schema_version": "bundle_catalog_v1",
  "bundles": [
    {
      "bundle_id": "<bundle-id>",
      "name": "French ↔ Maninka",
      "version": "1.0.0",
      "url_base": "./<bundle-id>/",
      "content_sha256": "sha256:<bundle-content-hash>",
      "size_bytes": 12345678
    }
  ]
}
```

Rules:

- `url_base` must end with `/`
- `content_sha256` must match the value in `bundle.manifest.json`
- `size_bytes` should reflect the bundle payload size you intend to advertise to clients

## End-to-End Example

```bash
mkdir -p build/bundles data/enriched

siralex-enrich \
  --normalized data/normalized/malipense_normalized_norm_vN.jsonl \
  --ir data/ir/malipense_lexicon_v3.jsonl \
  --ir data/ir/malipense_index_v1.jsonl \
  --output data/enriched/malipense_enriched_norm_vN.jsonl \
  -v

siralex-validate-enrichment-display-only \
  --baseline data/normalized/malipense_normalized_norm_vN.jsonl \
  --enriched data/enriched/malipense_enriched_norm_vN.jsonl \
  -v

siralex-build-index \
  --input data/enriched/malipense_enriched_norm_vN.jsonl \
  --output build/search_index.jsonl

siralex-build-bundle build \
  --normalized data/enriched/malipense_enriched_norm_vN.jsonl \
  --search-index build/search_index.jsonl \
  --output-dir build/bundles \
  --bundle-type full \
  --source-lang fr \
  --target-lang mnk \
  --source-label French \
  --target-label Maninka \
  --target-script latin \
  --target-script nko
```

After that:

1. inspect the generated bundle directory
2. run `siralex-build-bundle verify`
3. publish the bundle directory plus `catalog.json`

For hosting and catalog layout, see `docs/BUNDLE_DISTRIBUTION.md`.
