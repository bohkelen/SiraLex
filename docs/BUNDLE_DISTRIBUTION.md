# Bundle Distribution

Phase 4.5 defines how a SiraLex bundle is hosted and discovered. This phase is documentation-only: it describes the static file contract the app already uses for catalog-driven installation.

## Bundle Hosting Contract

Each hosted bundle is a directory that contains the manifest plus the two payload files the app imports:

```text
/bundles/
  bundle_a/
    bundle.manifest.json
    records.jsonl
    search_index.jsonl

catalog.json
```

The app expects `catalog.json` plus one directory per bundle. The bundle directory is the unit of distribution.

## Catalog Format

At a conceptual level, the catalog is a schema version plus a list of bundles:

```json
{
  "version": "bundle_catalog_v1",
  "bundles": [
    {
      "bundle_id": "bundle_full_20260418_1dc526df",
      "name": "French ↔ Maninka",
      "version": "1.0.0",
      "url_base": "https://example.org/bundles/bundle_full_20260418_1dc526df/",
      "content_sha256": "sha256:1dc526dfd4c3c32f32135677df84b3e162deeeb723d4ac77590f4876290ce18b",
      "size_bytes": 21323831
    }
  ]
}
```

In the current SiraLex runtime, the schema field name is `catalog_schema_version`:

```json
{
  "catalog_schema_version": "bundle_catalog_v1",
  "bundles": [
    {
      "bundle_id": "bundle_full_20260418_1dc526df",
      "name": "French ↔ Maninka",
      "version": "1.0.0",
      "url_base": "./bundle_full_20260418_1dc526df/",
      "content_sha256": "sha256:1dc526dfd4c3c32f32135677df84b3e162deeeb723d4ac77590f4876290ce18b",
      "size_bytes": 21323831
    }
  ]
}
```

Field meanings:

- `bundle_id`: stable **logical dictionary / product-line** identity used by the app for install/update state and for personal-data continuity (Learning, CF1, CF2). Compatible releases of the same product line reuse this id; a new `bundle_id` is a distinct dictionary lineage.
- `name`: human-readable dictionary name shown in the UI.
- `version`: publisher-facing release label (not the integrity identity).
- `url_base`: directory prefix for the bundle assets of this published content version.
- `content_sha256`: immutable **content / artifact version** identity. Authoritative for update detection: same `bundle_id` + new `content_sha256` means a compatible in-line update; identical pair means already current.
- `size_bytes`: bundle payload size in bytes for display and planning.

Local install scope (not a catalog field; computed by the installer):

- `storage_scope_id` = `` `${bundle_id}::${content_sha256}` ``

Stable `bundle_id` does **not** mean mutable artifact bytes. Each published payload remains immutable and addressable by `content_sha256`. A replacement install creates a new `storage_scope_id` and retires the previous dictionary payload scope while retaining personal records according to existing Learning/CF lifecycle rules.

### Physical artifact directories (publisher tooling)

On disk, publishers SHOULD keep one directory per immutable content version. When building with an explicit logical `--bundle-id`, the bundle builder defaults to a **versioned artifact directory name**:

```text
{bundle_id}__{content_sha256_prefix8}
```

Example: logical `bundle_full_20260710_337619ff` with content hash starting `d076558b…` → directory `bundle_full_20260710_337619ff__d076558b`.

The directory name is a physical packaging convenience. It is **not** Learning identity and does **not** replace `manifest.bundle_id`. Catalog `url_base` points at the chosen published directory for that content version.

See `shared/specs/offline-bundle-versioning.md` (Bundle identifiers) for the normative reuse / mint rules.

## URL Rules

`url_base` is a directory prefix, not a file path.

Rules:

- `url_base` must end with `/`.
- `url_base` must not contain `?` or `#`.
- `url_base` may be relative, root-relative, or absolute.
- Asset URLs are derived by appending the fixed filenames below.

Derived asset paths:

- `bundle.manifest.json`
- `records.jsonl`
- `search_index.jsonl`

Published **`records.jsonl`** in catalog-delivered bundles is expected to include a **`display`** object per row (from the enrichment step), so offline rendering can show IR-derived fields without re-fetching prose. Pipeline details and CLI examples: **`docs/BUILD_BUNDLE.md`**.

Example:

```text
catalog URL:  https://example.org/catalog.json
url_base:     /bundles/bundle_a/

manifest:     https://example.org/bundles/bundle_a/bundle.manifest.json
records:      https://example.org/bundles/bundle_a/records.jsonl
search index: https://example.org/bundles/bundle_a/search_index.jsonl
```

If `url_base` is relative, it is resolved against the final catalog URL.

## Hosting Options

### Internet Hosting

Any static file host can serve SiraLex bundles as long as it publishes `catalog.json` and the bundle directories unchanged.

Common options:

- GitHub Pages
- Netlify
- Simple Nginx server

Minimal local static server example:

```bash
python3 -m http.server 8080
```

If you host from a web root, make sure the published tree still looks like:

```text
catalog.json
bundles/<bundle-id>/bundle.manifest.json
bundles/<bundle-id>/records.jsonl
bundles/<bundle-id>/search_index.jsonl
```

### Local Hub

This is the practical offline distribution model for field use:

- one laptop acts as the distribution server
- phones connect over the same Wi-Fi network
- no internet connection is required

Example:

```bash
cd bundles/
python3 -m http.server 8080
```

If the folder contains `catalog.json` plus the bundle directories, phones on the same network can load:

```text
http://192.168.1.10:8080/catalog.json
```

Replace `192.168.1.10` with the laptop's actual local IP address.

### Side-Load Fallback

Manual import must remain available.

Why this matters:

- connectivity will fail in real environments
- captive portals and weak Wi-Fi happen
- some users will receive bundle files through messaging apps, USB transfer, or local file sharing

The fallback path is simple: download or copy these three files, then import them manually in the app:

- `bundle.manifest.json`
- `records.jsonl`
- `search_index.jsonl`

## Update Model

Phase 4.5 update behavior must be explicit:

- updates are hash-based
- there are no automatic updates
- updates are user-triggered only
- replacement is done safely through staging

Operational meaning:

- the catalog entry's `content_sha256` is the update identity
- if the installed bundle hash matches the catalog hash, the bundle is current
- if the hashes differ, the UI shows `Update available`
- the user must click `Update`; the app does not replace bundles on its own

Safe replacement via staging means the new bundle is imported into a fresh storage scope first, and only then becomes the installed version. If import fails, the existing installed data remains intact.

## Publishing Checklist

Before publishing a catalog:

1. Build the bundle and verify it locally.
2. Upload `catalog.json` and the bundle directory to the host.
3. Confirm `url_base` ends with `/`.
4. Confirm the derived URLs for `bundle.manifest.json`, `records.jsonl`, and `search_index.jsonl` all resolve correctly.
5. Confirm the catalog `content_sha256` matches the bundle manifest `content_sha256`.
