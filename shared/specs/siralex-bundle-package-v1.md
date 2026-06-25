# SiraLex bundle package v1

Transport-only ZIP container for manual offline dictionary sideload.

The inner logical bundle contract is unchanged:

```text
bundle.manifest.json
records.jsonl
search_index.jsonl
```

The inner manifest remains `bundle_manifest_v1` with existing `bundle_format: directory`
semantics. The `.siralex.zip` file is a standard ZIP envelope, not a custom binary
format and not a replacement bundle schema.

## Goals

- Allow ordinary users to select **one** offline package file for manual import.
- Preserve the existing manifest, checksum, streaming import, and IndexedDB install
  pipeline without creating a second bundle contract.
- Fail closed on malformed, unexpected, or unsafe archive structure.

## Non-goals (v1)

- Package signing or sender authentication.
- Encrypted ZIP entries.
- DEFLATE or other compressed entry methods.
- ZIP64, multi-disk archives, or archive comments.
- Catalog schema changes or replacement of directory-hosted bundles.
- Python package generation (Slice 2).

## File extension

```text
.siralex.zip
```

MIME hint for pickers: `application/zip`.

## Required inner layout (v1)

Exactly **three** entries at the **archive root**, ASCII names, once each:

| Entry name | Role |
|---|---|
| `bundle.manifest.json` | Existing bundle manifest |
| `records.jsonl` | Existing records payload |
| `search_index.jsonl` | Existing search-index payload |

Rules:

- No nested directories.
- No extra entries.
- No duplicate names.
- Reject path separators, `..`, absolute paths, drive prefixes, backslashes.
- Reject non-ASCII filenames.

## Compression (v1 profile)

Only **STORE** / ZIP compression method `0` is accepted.

A future compressed-package profile requires a separate design review and proof that
streaming inflation can feed the existing JSONL importers without loading full
payloads into memory. It is out of scope for v1.

## Parser policy limits (implementation defaults)

These are **parser implementation limits for package-v1**, not timeless bundle-size
policy for all future language packs. Any increase requires a versioned specification
change.

| Limit | Default value |
|---|---|
| Max archive bytes | 64 MiB |
| Max total uncompressed bytes (sum of three entries) | 80 MiB |
| Max one entry uncompressed bytes | 60 MiB |
| Max compression ratio (defensive) | 100:1 |

Even though STORE entries should have ratio ≈ 1:1, the ratio guard remains as a
zip-bomb heuristic.

## Integrity and trust model

Inner manifest checksums establish **accidental-corruption detection** and internal
consistency. They do **not** authenticate a package sender. Package
signing/provenance is outside package-v1 scope.

## Future package-import sequence (not implemented in Slice 1)

Slice 1 implements structural ZIP validation and byte-range exposure only. A future
import slice must follow this sequence exactly:

```text
open package
→ structural ZIP validation
→ read manifest
→ parse existing bundle manifest
→ first pass: stream-hash records and search index
→ verify byte lengths + per-file SHA-256 + content_sha256
→ second pass: reopen Blob slices
→ stream verified payloads through existing installBundleIntoDb()
```

Reason: do not write unverified payload data into IndexedDB.

## Browser reader (Slice 1)

TypeScript reader: `web/src/import/bundle_package.ts`

- Reads ZIP end-of-central-directory record from package tail.
- Locates and validates central directory entries.
- Validates matching local file headers and payload byte ranges.
- Exposes the three payloads as `Blob` slices via `File.slice(...)`.
- Must not materialize `records.jsonl` or `search_index.jsonl` as complete strings,
  `ArrayBuffer`, or parsed JSONL.

## Related documents

- `shared/specs/offline-bundle-versioning.md` — inner bundle manifest contract
- `docs/BUNDLE_DISTRIBUTION.md` — directory hosting contract
- `docs/PHASE_7N_RELEASE_PLAN_TEMPLATE.md` — future release checklist
