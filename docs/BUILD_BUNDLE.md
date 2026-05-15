# Build Bundle

This document describes the Phase 4.5 developer pipeline for producing a distributable SiraLex bundle.

The pipeline is:

```text
normalized -> index -> bundle -> catalog
```

That means:

1. start from normalized JSONL records
2. build a search index
3. build a bundle directory
4. publish that bundle behind a `catalog.json`

## Prerequisite

Install the backend CLI tools into your Python environment:

```bash
pip install -e ./api
```

## Step 1: Start From Normalized Records

Input artifact:

- normalized JSONL file

Example path:

```text
data/normalized/<dataset>_normalized_norm_vN.jsonl
```

## Step 2: Build the Search Index

Use `siralex-build-index` to generate `search_index.jsonl` from the normalized records.

```bash
siralex-build-index \
  --input data/normalized/malipense_normalized_norm_v1.jsonl \
  --output build/search_index.jsonl
```

Output:

- `build/search_index.jsonl`

## Step 3: Build the Bundle Directory

Use `siralex-build-bundle` to assemble the normalized records and search index into a distributable directory bundle.

```bash
siralex-build-bundle build \
  --normalized data/normalized/malipense_normalized_norm_v1.jsonl \
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
normalized records' `norm_version`. This is how new rulesets such as
`norm_v2` remain explicit in published bundles.

The builder also emits `search_index_directional` as a bundle capability:

- `norm_v2` build path -> `search_index_directional: true`
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

## Step 4: Verify the Bundle

Verify the generated bundle before publishing it:

```bash
siralex-build-bundle verify build/bundles/<bundle-id>
```

This checks manifest integrity and the bundle payload hashes.

## Step 5: Publish a Catalog Entry

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
mkdir -p build/bundles

siralex-build-index \
  --input data/normalized/malipense_normalized_norm_v1.jsonl \
  --output build/search_index.jsonl

siralex-build-bundle build \
  --normalized data/normalized/malipense_normalized_norm_v1.jsonl \
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
