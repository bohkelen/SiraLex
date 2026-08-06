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

## Bundle identifiers (canonical identity model)

SiraLex distinguishes **logical dictionary identity** from **immutable content identity**. These MUST NOT be conflated.

| Identifier | Role | Mutability |
|------------|------|------------|
| **`bundle_id`** | Stable **logical dictionary / product-line** identity. Personal overlays (Learning, CF1, CF2) key continuity against this id. | Stable across compatible releases of the same product line |
| **`content_sha256`** | Immutable **content / artifact version** identity for a published payload | Changes whenever payload bytes change |
| **`storage_scope_id`** (consumer-local) | Exact installed version scope: `` `${bundle_id}::${content_sha256}` `` | New scope per installed content version |

### Meanings (normative)

- **`bundle_id`**: identifies the logical dictionary product line (for example the featured French/English↔Maninka line). Reusing the same `bundle_id` with a new `content_sha256` is a **compatible update** in that line, not mutation of a prior artifact.
- **`content_sha256`**: identifies one immutable published content version. Every distinct payload MUST have a distinct `content_sha256`. Installed dictionary bytes are never silently rewritten in place.
- **`storage_scope_id`**: local install key for dictionary records/index for one exact `(bundle_id, content_sha256)` pair. A replacement install creates a new scope and retires the previous dictionary payload scope while retaining personal records according to Learning/CF lifecycle rules.

### Recommended generated format (convenience default only)

Builders MAY generate a fresh id shaped like:

- `bundle_{type}_{yyyymmdd}_{short_hash}`

That format is a **convenience default for new product lines / one-off builds**. It is **not** a requirement that every content change mint a new `bundle_id`. Compatible releases of an existing product line SHOULD reuse the logical `bundle_id` and emit a new `content_sha256`.

Builders that publish compatible updates into an existing product line SHOULD accept an explicit logical `bundle_id` input (for example CLI `--bundle-id`). Until that input exists, publishers MUST pin/reuse the logical id by an equivalent reviewed packaging step rather than treating the generated default as normative.

Additionally, bundles SHOULD include:

- **`bundle_semver`**: optional semantic version for human communication (not authoritative)
- **`created_at`**: ISO-8601 timestamp (informational; see determinism rules below)

### When `bundle_id` MAY be reused

A release MAY reuse an existing `bundle_id` only when **all** of the following hold:

- same lexical dictionary / product line
- same `ir_id` identity domain (entries that keep the same `ir_id` remain the same lexical objects)
- compatible record / search semantics for REPLACE_ALL consumer update
- Learning / CF1 / CF2 continuity against `(bundle_id, …)` is intended
- consumer `update_mode` / `reconciliation_action` remain `REPLACE_ALL` (v1)
- no intentional fork that requires a separate personal-data namespace

Under that rule:

```text
same bundle_id + new content_sha256
= compatible update/release in the same logical dictionary line
```

### When a new `bundle_id` MUST be minted

A release MUST mint a new `bundle_id` when any of the following hold:

- unrelated dictionary / different product
- changed lexical identity domain (systematic `ir_id` reassignment or incompatible entry identity)
- intentionally separate edition or product line that must not share Learning/CF personal-data namespace
- publisher explicitly chooses a fork rather than a compatible in-line update

Under that rule:

```text
new bundle_id
= distinct dictionary lineage / intentionally separate Learning namespace
```

### Physical artifact directory name (publisher tooling)

Logical `bundle_id` and immutable `content_sha256` MAY map to a filesystem directory whose name differs from `bundle_id` so multiple content versions of one product line can coexist under one output root.

Recommended deterministic shape when publishing compatible updates with an explicit logical id:

```text
{bundle_id}__{first_8_hex_of_content_sha256}
```

Example: `bundle_full_20260710_337619ff__d076558b`.

Normative constraints:

- Manifest `bundle_id` remains the logical product-line id (unchanged by directory naming).
- Directory naming MUST NOT be used as Learning / CF primary identity.
- A versioned/publish-safe builder MUST NOT destructively replace an existing immutable artifact directory when the recorded `content_sha256` differs (fail closed). Identical rebuilds MAY be idempotent.
- Convenience builds that mint a fresh generated `bundle_id` MAY continue to use directory name == `bundle_id`.

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
  - `rule_versions.normalization` (e.g., `norm_v1`, `norm_v2`, `norm_v3`) — see `shared/specs/normalization-versioning.md`
  - `rule_versions.transliteration` (e.g., `nko_translit_v1`) when applicable
  - `rule_versions.pos_mapping` (e.g., `posmap_v1`) when applicable
  - `rule_versions.url_canonicalization` (e.g., `urlcanon_v1`) when applicable
- **Directional search capability (required for new bundle builds)**
  - `search_index_directional` (`true` | `false`)
  - consumer behavior is strict and single-path:
    - `true` -> use directional `src_*` / `tgt_*` ladders only
    - `false` or absent -> use legacy undirected ladder only
  - mixed fallback between directional and legacy ladders is not allowed
  - bundle builders must emit this field for current builds; older legacy
    bundles may omit it for backward compatibility
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

## “No silent mutation” across content versions (normative)

Published payload bytes are immutable. If any of the following change, you MUST publish a **new immutable content artifact** (new `content_sha256` and new payload files). You MUST NOT rewrite a previously published artifact in place:

- record schema version
- any `rule_versions.*` value
- included/excluded sources set
- correction dataset (approved RFC 6902 correction records) that affect outputs
- search index / records payload bytes for any other reason

**Immutability is about `content_sha256` / artifact bytes, not about minting a new `bundle_id`.**

Whether that new artifact reuses the prior `bundle_id` is governed by the reuse / mint rules in **Bundle identifiers** above:

- compatible in-line product release → **reuse** `bundle_id`, new `content_sha256`
- incompatible identity domain or intentional fork → **new** `bundle_id` and new `content_sha256`

This preserves reproducibility and makes trustable diffs possible without fragmenting Learning identity on routine compatible updates.

## Disablement / removal handling (required)

If a source is disabled or a rights holder requests removal:

- A new **immutable content artifact** MUST be produced with that `source_id` excluded (new `content_sha256`).
- The manifest MUST list that source under `sources.excluded[]` with a reason and timestamp.
- If the result remains the same product line with compatible `ir_id` continuity, the release MAY reuse the existing logical `bundle_id`; otherwise it MUST mint a new `bundle_id` per the identity rules above.
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

- keep track of current logical `bundle_id` **and** installed `content_sha256` / `storage_scope_id`
- when the catalog/manifest shows the **same** `bundle_id` with a **new** `content_sha256`, treat that as a **compatible in-line update**: import the new payload into a new `storage_scope_id`, REPLACE_ALL dictionary records/index for that logical id, retire the previous dictionary payload scope, and retain personal overlays keyed by `bundle_id` per Learning/CF lifecycle rules
- when the catalog/manifest shows a **new** `bundle_id`, treat that as a **distinct dictionary lineage** (separate Learning/CF namespace), not as an in-place continuation of the prior line
- verify hashes before trusting payload bytes
- import into local storage (e.g., IndexedDB) idempotently (same `storage_scope_id` ⇒ already current)

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
  },
  "record_locator": {
    "kind": "source_record_id",
    "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
    "source_record_id": "e2203",
    "anchor_names": ["-da"]
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

Index-mapping enriched rows MUST NOT include top-level `record_locator`.

### `display` field rules (normative)

- `display` contains a **shallow, read-only projection** of IR `fields_raw` sufficient for user-facing rendering.
- `display` MUST NOT contain inferred, ranked, or normalized content.
- All values are copied from IR `fields_raw` unchanged.
- If the IR record for a given `ir_id` is unavailable, the enrichment step MUST emit the record **without** a `display` field and log a warning.

### `record_locator` field rules (normative; lexicon_entry only)

For `ir_kind = "lexicon_entry"`, enrichment MUST project durable IR locator metadata onto the enriched record so consumers can join `index_mapping.display.target_entries[].anchor` to a lexicon `ir_id` without display-text matching.

Required keys (copied from IR `record_locator`, not from `fields_raw`):

- `kind` (non-empty string; typically `source_record_id`)
- `url_canonical` (non-empty string)
- `source_record_id` (non-empty string; e.g. Mali-Pense HTML anchor `e2533`)
- `anchor_names` (list of strings; always present on enriched output)

Rules:

- Projection is fail-closed on missing/invalid join-critical keys (`kind`,
  `url_canonical`, `source_record_id`).
- If IR omits `anchor_names`, enrichment MUST emit `anchor_names: []` (some
  Mali-Pense IR rows lack the key). Invalid non-list `anchor_names` MUST abort.
- Locator-tuple uniqueness is fail-closed: two different lexicon `ir_id`s MUST
  NOT expose the same `(source_id, url_canonical, source_record_id)` unless an
  explicit allowlist is introduced later (none in this version).
- Owner-reviewed lexicon rows MUST continue to preserve
  `provenance.source.record_pointer.url_canonical` and
  `provenance.source.record_pointer.source_record_id` from the normalized
  baseline; enrichment MUST NOT rewrite provenance.
- `record_locator` MUST NOT be inferred from `display_text` / headword forms alone.

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

