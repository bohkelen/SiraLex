# Offline data bundle versioning plan (v1)

This spec defines how SiraLex packages and versions **offline lexicon bundles** (seed + full) so the app can:

- work offline-first on constrained devices
- update deterministically over time
- respect source disablement/removal requests
- avoid silent mutation of linguistic behavior

It is **stack-neutral**: it defines contracts and invariants, not storage tech or app architecture.

## Goals

- Define **bundle identity** and **compatibility** separately from app versioning.
- Make bundles **verifiable** (hashes) and **auditable** (manifest).
- Ensure bundles encode which transformation rules were applied (normalization/transliteration/POS mapping).
- Support **seed** and **full** bundles with the same schema and versioning semantics.

## Non-goals

- Choosing where bundles are hosted (CDN, Releases, etc.).
- Shipping any third-party data inside the git repo (bundles are artifacts, not source-controlled content).
- Defining the full lexicon schema (this spec only references it).

## Definitions

- **Bundle**: a distributable offline dataset artifact (e.g., “seed” or “full”).
- **Bundle manifest**: machine-readable metadata that describes bundle contents and provenance.
- **Bundle build**: a deterministic pipeline run that produces one or more bundles.

## Bundle types

Bundles MUST be typed:

- **`seed`**: small starter dataset for first-run experience
- **`full`**: the complete offline dataset available for download

Both bundle types MUST use the same record schema and the same manifest contract.

## Bundle identifiers

Each bundle MUST have a unique identifier:

- **`bundle_id`**: stable string identifier, unique across all time.

Recommended format (illustrative, not required):

- `bundle_{type}_{yyyymmdd}_{short_hash}`

Additionally, bundles SHOULD include:

- **`bundle_semver`**: optional semantic version for human communication (not authoritative)
- **`created_at`**: ISO-8601 timestamp (informational; see determinism rules below)

## Manifest (required)

Every bundle MUST include a manifest file (e.g., `bundle.manifest.json`) containing:

- **Identity**
  - `bundle_id`
  - `bundle_type` (`seed` | `full`)
  - `created_at` (OPTIONAL; informational only)
- **Scope / segmentation (recommended)**
  - `bundle_scope` (`locale_pack` | `global_seed` | `global_full`)
  - `locales_included[]` (e.g., `["maninka-GN"]`)
- **Language metadata (recommended for UI consumers)**
  - `languages.source_lang` (e.g., `fr`)
  - `languages.target_lang` (e.g., `mnk`)
  - `language_labels.source` (e.g., `French`)
  - `language_labels.target` (e.g., `Maninka`)
  - `scripts.target_supported[]` (e.g., `["latin", "nko"]`) when useful for display/runtime hints
- **Bundle format metadata (recommended)**
  - `bundle_format` (e.g., `directory` | `tar` | `zip`)
  - `compression` (e.g., `zst` | `gzip` | `none`)
- **Schema compatibility**
  - `record_schema_id` (e.g., `lex_v1`) and `record_schema_version`
  - `manifest_schema_version` (for this manifest format)
- **Consumer compatibility guardrails (recommended)**
  - `consumer_compat.min_manifest_schema_version`
  - `consumer_compat.min_record_schema_version`
  - `consumer_compat.min_app_version` (OPTIONAL)
- **Rule versions (required)**
  - `rule_versions.normalization` (e.g., `norm_v1`) — see `shared/specs/normalization-versioning.md`
  - `rule_versions.transliteration` (e.g., `nko_translit_v1`) when applicable
  - `rule_versions.pos_mapping` (e.g., `posmap_v1`) when applicable
  - `rule_versions.url_canonicalization` (e.g., `urlcanon_v1`) when applicable
- **Corrections (required if corrections are applied)**
  - `corrections.correctionset_id`
  - `corrections.sha256` (or include the corrections payload file in `files[]`)
- **Sources included/excluded (required)**
  - `sources.included[]`: list of `source_id` values (from `shared/specs/source-registry.md`)
  - `sources.excluded[]`: list of excluded source objects (see “Excluded sources” below)
- **Reconciliation/update semantics (normative)**
  - `reconciliation_action` (`REPLACE_ALL` | `PATCH`) — v1 MUST be `REPLACE_ALL`
  - `update_mode` (`REPLACE_ALL` | `DELTA`) — v1 MUST be `REPLACE_ALL`
  - `base_bundle_id` (REQUIRED if `update_mode = "DELTA"`)
- **Build lineage (recommended but high-value)**
  - `build_id` (or `bundle_build_id`)
  - `snapshot_group_ids[]` / `crawl_ids[]` used (if available)
  - `ir_parser_versions[]` used to produce IR
  - `git_commit` (repo commit that produced the bundle tooling/spec)
- **Integrity (required)**
  - `files[]`: list of bundle payload files with `{ path, byte_length, sha256 }`
  - `content_sha256` (required; canonical content hash)
  - `artifact_sha256` (optional; transport-level hash of downloaded archive bytes, when applicable)

### Excluded sources (normative structure)

Each element of `sources.excluded[]` MUST include:

- `source_id`
- `reason`
- `disabled_at` (ISO-8601)

It MAY include:

- `request_ref` (internal ticket/email/thread identifier)

## Integrity rules (normative)

- **Canonical content hash (required)**:
  - `content_sha256` MUST be computed as `sha256:` of the UTF-8 bytes of an **RFC 8785 (JCS) canonical JSON** value representing the `files[]` list.
  - The `files[]` list MUST be sorted by `path` ascending before hashing.
  - Each element MUST include exactly `{ "path", "byte_length", "sha256" }` for the purposes of the hash.
- **Transport hash (optional)**:
  - If the bundle is distributed as a single archive artifact, `artifact_sha256` MAY be provided as the hash of the downloaded archive bytes.
  - `artifact_sha256` MUST NOT replace `content_sha256`.
- **created_at determinism**:
  - `created_at` SHOULD be omitted; if included, it MUST be informational only and MUST NOT be included in any hash computations.
- Bundle consumers MUST verify integrity using the manifest hashes before using the data.

## “No silent mutation” across bundles (normative)

If any of these change, you MUST publish a new bundle (new `bundle_id`):

- record schema version
- any `rule_versions.*` value
- included/excluded sources set
- correction dataset (approved RFC 6902 correction records) that affect outputs

This preserves reproducibility and makes trustable diffs possible.

## Disablement / removal handling (required)

If a source is disabled or a rights holder requests removal:

- A new bundle MUST be produced with that `source_id` excluded.
- The manifest MUST list that source under `sources.excluded[]` with a reason and timestamp.
- Bundle consumers MUST treat this as a reconciliation event requiring `reconciliation_action = "REPLACE_ALL"` (v1).
- The system SHOULD support “tombstoning”:
  - keep internal auditability of what changed
  - ensure distributed bundle content no longer contains excluded material

## Seed vs full selection policy (recommended)

Seed bundle SHOULD be selected to maximize learner usefulness:

- high-frequency words/phrases first (when lawful and when data supports it)
- or curated starter list

Any selection heuristic MUST be:

- deterministic
- versioned as part of the bundle build inputs (do not depend on mutable global stats unless versioned)

## Update strategy (consumer-side)

Bundle consumers SHOULD:

- keep track of current `bundle_id`
- download a new bundle when `bundle_id` changes
- verify hashes
- import into local storage (e.g., IndexedDB) idempotently

This spec does not mandate delta updates. It reserves `update_mode = "DELTA"` fields for future use; **v1 consumers MUST treat `update_mode = "DELTA"` as unsupported**. If deltas are introduced later, they must also be versioned and hash-verified.

## Enriched record schema (`records.jsonl`)

Bundle `records.jsonl` contains **enriched records** — normalized search metadata joined with IR display fields. Each line is one JSON object keyed by `ir_id`.

### Schema

```json
{
  "ir_id": "964909ef6912ff64",
  "ir_kind": "lexicon_entry",
  "source_id": "src_malipense",
  "norm_version": "norm_v1",
  "preferred_form": "-da",
  "variant_forms": ["-da"],
  "search_keys": {
    "casefold": ["-da"],
    "diacritics_insensitive": ["-da"],
    "punct_stripped": ["da"],
    "nospace": ["-da"]
  },
  "display": {
    "headword_latin": "-da",
    "headword_nko_provided": "ߘߊ",
    "ps_raw": null,
    "pos_hint": null,
    "senses": [
      {
        "gloss_fr": "aoriste intransitif",
        "gloss_en": "intransitive aorist",
        "gloss_ru": "аорист интранзитивный",
        "examples": [],
        "usage_note": null,
        "synonyms_raw": []
      }
    ],
    "variants_raw": [],
    "synonyms_raw": [],
    "etymology_raw": null,
    "literal_meaning_raw": null
  }
}
```

For `ir_kind = "index_mapping"`, the `display` field contains:

```json
{
  "display": {
    "source_term": "abandonner",
    "source_lang": "fr",
    "target_entries": [
      { "lexicon_url": "/emk/lexicon/b.htm", "anchor": "e504", "display_text": "bàn" }
    ]
  }
}
```

### `display` field rules (normative)

- `display` contains a **shallow, read-only projection** of IR `fields_raw` sufficient for user-facing rendering.
- `display` MUST NOT contain inferred, ranked, or normalized content.
- All values are copied from IR `fields_raw` unchanged.
- If the IR record for a given `ir_id` is unavailable, the enrichment step MUST emit the record **without** a `display` field and log a warning.

### Enrichment non-goals

The enrichment step MUST NOT:

- Apply language ranking or preference ordering
- Apply frequency-based pruning of senses or examples
- Merge or deduplicate across entries
- Apply UI formatting or presentation logic

It is **data plumbing only**.

## Compatibility rule (record schema)

Consumers MUST enforce compatibility using **both** schema identity and version:

- `record_schema_id` MUST equal the schema ID the consumer expects (e.g., `lex_v1`)
- `record_schema_version` MUST be greater than or equal to `consumer_compat.min_record_schema_version`

## Compatibility rule (language metadata)

Language metadata is intentionally additive:

- consumers MUST continue to accept bundles that omit `languages`, `language_labels`, or `scripts`
- consumers MAY use these fields to drive runtime labels, bundle selectors, and script-aware UI
- missing language metadata must not invalidate an otherwise compatible bundle

## Minimal example manifest (illustrative)

```json
{
  "manifest_schema_version": "bundle_manifest_v1",
  "bundle_id": "bundle_full_20260105_ab12cd",
  "bundle_type": "full",
  "created_at": "2026-01-05T00:00:00Z",
  "bundle_scope": "locale_pack",
  "locales_included": ["maninka-GN"],
  "languages": {
    "source_lang": "fr",
    "target_lang": "mnk"
  },
  "language_labels": {
    "source": "French",
    "target": "Maninka"
  },
  "scripts": {
    "target_supported": ["latin", "nko"]
  },
  "bundle_format": "zip",
  "compression": "zst",
  "record_schema_id": "lex_v1",
  "record_schema_version": "1",
  "consumer_compat": {
    "min_manifest_schema_version": "bundle_manifest_v1",
    "min_record_schema_version": "1",
    "min_app_version": "0.1.0"
  },
  "rule_versions": {
    "normalization": "norm_v1",
    "transliteration": "nko_translit_v1",
    "pos_mapping": "posmap_v1",
    "url_canonicalization": "urlcanon_v1"
  },
  "corrections": {
    "correctionset_id": "corrset_20260105_01",
    "sha256": "sha256:..."
  },
  "sources": {
    "included": ["src_malipense"],
    "excluded": [
      {
        "source_id": "src_example_removed",
        "reason": "Removal request from rights holder",
        "disabled_at": "2026-01-04T00:00:00Z",
        "request_ref": "email-thread-2026-01-04"
      }
    ]
  },
  "reconciliation_action": "REPLACE_ALL",
  "update_mode": "REPLACE_ALL",
  "build": {
    "build_id": "build_20260105_01",
    "snapshot_group_ids": ["crawl_2026-01-04_malipense_v1"],
    "ir_parser_versions": ["parser_v1"],
    "git_commit": "abcdef123456"
  },
  "files": [
    { "path": "records.jsonl.zst", "byte_length": 1234567, "sha256": "sha256:..." },
    { "path": "corrections.json.zst", "byte_length": 23456, "sha256": "sha256:..." }
  ],
  "content_sha256": "sha256:...",
  "artifact_sha256": "sha256:..."
}
```

