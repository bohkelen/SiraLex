# Source phrase alias v1

This specification defines reviewed source-side phrase aliases for SiraLex bundle
generation.

Source phrase aliases are build-time search metadata for safe inflected phrase
variants only. They do not change dictionary source truth, normalized records,
target-side search, or runtime query behavior.

This spec implements **Option B**: a dedicated phrase-specific artifact. It does
**not** extend `source_alias_table_v1` (`shared/aliases/source_aliases_v1.jsonl`).

## 1. Purpose

Provide a source-side, build-time, human-reviewed phrase alias artifact for
**safe phrase variants only**.

A phrase alias means:

> When a user searches the reviewed `query` phrase, the generated source-side
> search index routes to the same records as the already-reviewed
> `canonical_phrase`.

Phrase aliases are narrow convenience routing for inflected or placeholder
variants of phrases that already exist in the source index. They are not phrase
understanding, decomposition, typo correction, or compositional lookup.

## 2. Non-goals

This specification explicitly rejects:

- **Runtime decomposition** — no query-time splitting of phrases into component
  terms.
- **Fuzzy search** — no approximate or similarity-based phrase matching.
- **AI interpretation** — no model-inferred phrase meaning or routing.
- **Typo correction** — no aliases for malformed, misspelled, or agreement-error
  queries.
- **Target-side aliases** — no `tgt_*` key generation from phrase alias rows.
- **Compositional phrase routing** — no routing a phrase to the union of its
  component single-term postings.
- **Single-word routing from phrase queries** — no routing a multi-word phrase
  query to a single-word entry.
- **`records.jsonl` mutation** — phrase aliases do not create or modify IR
  records.
- **Catalog changes** — phrase aliases do not alter catalog entries or featured
  bundle metadata.
- **Runtime search changes** — phrase aliases affect generated bundle search
  index only; runtime query handling remains unchanged.

Additional non-goals inherited from the source alias layer:

- Generic French morphology beyond reviewed inflected phrase forms.
- Correction records for missing or wrong dictionary content.
- Ranking, ordering, or result-card changes.

## 3. Proposed artifact path

Reviewed source phrase alias data lives in a tracked product/search configuration
artifact:

`shared/phrase_review/source_phrase_aliases_v1.jsonl`

It MUST NOT live under ignored raw-data locations such as `data/`.

It MUST NOT be represented in:

- `shared/aliases/source_aliases_v1.jsonl` (`source_alias_table_v1`)
- `shared/source_index_supplements/source_index_supplements_v1.jsonl`
- `records.jsonl`

## 4. Schema

Phrase alias tables are newline-delimited JSON (`.jsonl`). Each non-empty line is
one phrase alias row.

### Schema identity

- `schema_version`: `source_phrase_alias_v1`
- `alias_table_version`: release identifier for a reviewed phrase alias table,
  for example `phase7i-round1`

### Example row

```json
{
  "schema_version": "source_phrase_alias_v1",
  "alias_table_version": "phase7i-round1",
  "alias_id": "phase7i_phrase_alias_0001",
  "status": "approved",
  "search_direction": "source_to_target",
  "query": "à l'insu de qqns",
  "query_locale": "fr",
  "canonical_phrase": "à l'insu de qqn",
  "resolved_ir_ids": ["ef0667f3fb422851"],
  "category": "inflected_phrase_form",
  "source_review_id": "phase7h_phrase_0004",
  "reviewer": "reviewer-name",
  "reviewed_at": "YYYY-MM-DD",
  "rationale": "Reviewed plural placeholder variant routes to existing reviewed phrase entry.",
  "source_bundle_id": "bundle_full_20260609_phase7f_alias_candidate",
  "source_catalog_version": "norm-v3-featured-enriched-source-aliases-2-source-index-supplements-2",
  "source_norm_version": "norm_v3",
  "notes": ""
}
```

### Row fields

Each row MUST be a JSON object with these required fields:

- `schema_version` (string; MUST be `source_phrase_alias_v1`)
- `alias_table_version` (string)
- `alias_id` (string; stable row identifier)
- `status` (string enum; see §5)
- `search_direction` (string; v1 MUST be `source_to_target`)
- `query` (string; user-facing French phrase variant)
- `query_locale` (string; v1 MUST be `fr`)
- `canonical_phrase` (string; reviewed phrase that already resolves in the base
  source index)
- `resolved_ir_ids` (required field; array of strings; deterministic posting set
  expected from `canonical_phrase`; see approved-row constraint below)
- `category` (string enum; see §5)
- `source_review_id` (string; Phase 7H `review_id` or equivalent review trace)
- `rationale` (string)
- `source_bundle_id` (string)
- `source_catalog_version` (string)
- `source_norm_version` (string)

Optional fields:

- `notes` (string)

Approved rows additionally require:

- `reviewer` (string)
- `reviewed_at` (string; ISO date `YYYY-MM-DD`)
- `resolved_ir_ids` MUST be non-empty

Non-approved rows (`candidate`, `rejected`, `deferred`) MAY contain an empty
`resolved_ir_ids` array unless the row records candidate evidence.

### Status lifecycle

Allowed `status` values for the artifact schema:

- `candidate`
- `approved`
- `rejected`
- `deferred`

Only `approved` rows are eligible to affect generated search-index output.
`candidate`, `rejected`, and `deferred` rows are review artifacts only and MUST
NOT generate index rows.

### Relationship to Phase 7H evidence

`shared/phrase_review/phrase_miss_review_v1.jsonl` is a **review-only evidence
dataset**. It MUST remain inert and MUST NOT be used as a generation input for
phrase alias application.

Approved phrase alias rows MAY reference a Phase 7H row via `source_review_id`
for provenance, but the phrase alias artifact is the sole authoritative input
for build-time phrase alias application.

## 5. Allowed v1 scope

v1 phrase aliases are restricted to:

| Field | Allowed v1 value |
| --- | --- |
| `search_direction` | `source_to_target` only |
| `category` | `inflected_phrase_form` only |
| `status` (for application) | `approved` only |
| Generated keys | `src_*` key families only |

v1 MUST NOT represent:

- compositional phrase expectations
- phrase-to-single-word routing
- typo-like or fuzzy variants
- target-side phrase behavior
- categories other than `inflected_phrase_form`

Future schema revisions may add categories or directions only through an explicit
spec revision. Silent extension of `source_alias_table_v1` is forbidden.

## 6. Safety rules

Phrase alias application MUST be conservative and fail closed.

### Review and eligibility

- **Only approved rows apply** — `candidate`, `rejected`, and `deferred` rows
  MUST NOT generate search-index keys.
- **Reviewer required** — every `approved` row MUST include `reviewer`.
- **Reviewed_at required** — every `approved` row MUST include `reviewed_at`.
- **Resolved_ir_ids required for approved rows** — every row MUST include the
  `resolved_ir_ids` field as an array. Every `approved` row MUST include a
  non-empty `resolved_ir_ids` array. Non-approved rows MAY contain an empty
  `resolved_ir_ids` array unless the row records candidate evidence.

### Resolution integrity

- **Canonical phrase must already resolve** — `canonical_phrase` MUST resolve
  to a deterministic posting list in the base source search index before alias
  application.
- **Resolved_ir_ids must match canonical phrase postings exactly** — the build
  MUST recompute the ordered posting list for `canonical_phrase` from the base
  source index. The recomputed list MUST exactly equal `resolved_ir_ids`,
  including order. If it differs, the row is stale or invalid and MUST be rejected
  before any output index is written.

### Build context

- **Source_bundle_id, source_catalog_version, and source_norm_version must match
  expected build context** — rows whose provenance fields do not match the
  current build context MUST be rejected.

### Collision and scope limits

- **Conflicts fail hard** — if a phrase-alias-derived source key already exists
  with a different ordered posting list, or with the same set in a different
  order, the build MUST fail closed. The build MUST NOT merge, overwrite, or
  silently broaden existing source keys.
- **No tgt_* keys** — phrase aliases generate only `src_*` search-index key
  families.
- **No runtime decomposition** — phrase aliases MUST NOT trigger or depend on
  runtime query splitting.
- **No fuzzy correction** — phrase aliases MUST NOT approximate or normalize
  queries by edit distance or similarity.
- **No typo-like aliases** — queries classified as typos, agreement errors, or
  malformed forms in Phase 7H review MUST NOT become phrase aliases in v1.
- **No compositional aliases** — phrase aliases MUST NOT route to the union of
  component single-term postings.
- **No phrase-to-single-word routing** — a multi-word `query` MUST NOT route to
  a single-word `canonical_phrase` or single-term posting set.

### Key generation

Phrase-alias-derived keys MUST use the same search-key generation path as
normalized source terms for the `query` phrase string.

## 7. Pipeline position

Phrase alias application is a **future** build step. It is not wired in the
current pipeline.

When implemented, the pipeline position MUST be:

```text
IR
→ normalize norm_v3
→ enrich
→ build base search_index.jsonl
→ validate source_aliases_v1.jsonl
→ apply approved source aliases
→ validate source_phrase_aliases_v1.jsonl
→ apply approved source phrase aliases
→ emit phrase alias application report
→ build bundle
→ verify bundle
```

Phrase alias validation and application occur **after** base source alias
application and **before** bundle assembly.

For v1, `records.jsonl` remains unchanged. Only `search_index.jsonl` is augmented.

## 8. Reports

Phrase alias application MUST emit an external report. Manifest metadata is
optional unless the manifest schema explicitly supports it.

The report MUST include per-alias outcome rows with:

- `alias_id`
- `query`
- `canonical_phrase`
- `status`
- `added_keys`
- `resolved_ir_ids`
- `outcome`
- `reason`
- `source_review_id`

Allowed outcomes:

- `applied`
- `skipped`
- `rejected`

The report summary SHOULD include table-level counts analogous to the source alias
report (`approved_alias_count`, `applied_alias_count`, `skipped_alias_count`, and
so on) scoped to `source_phrase_alias_v1`.

## Versioning

Source phrase alias v1 is compatible with a refreshed enriched `norm_v3` bundle
because it adds reviewed build-time index metadata rather than changing
normalization semantics.

A future schema revision is required before adding categories beyond
`inflected_phrase_form`, target-side phrase behavior, or runtime query expansion.
