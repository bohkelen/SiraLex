# Corpus source artifacts v1

This specification defines **captured/versioned artifacts** for SiraLex CORPUS1:

```text
corpus_sources_v1
  → corpus_source_artifacts_v1
  → corpus_segments_v1
```

An artifact answers:

```text
Which registered source did these exact bytes come from?
When and how were they captured?
How can the exact bytes be identified again?
What type and size were they?
Where are they stored, if still retained?
```

It does **not** answer what was spoken, what language a span is, what it means,
or whether anything may enter the dictionary.

## Goals

- Separate registered source identity from exact captured bytes.
- Make `content_sha256` the immutable content identity (not URL or path).
- Keep raw media out of git by default while allowing metadata registries later.
- Fail closed on structural errors only.

## Non-goals

- Segments / transcripts / translations (CORPUS1C segments / CORPUS1D).
- Media download, ASR, ELAN import, or tool integration.
- Dictionary, alias, supplement, search, or Learning mutation.
- Requiring that storage files currently exist on disk.

## Artifact format

Newline-delimited JSON (`.jsonl`). Intended production path when rows exist:

`shared/corpus/corpus_source_artifacts_v1.jsonl`

CORPUS1C does **not** create an empty production file. Synthetic fixtures live
under `shared/corpus/fixtures/`.

## Schema identity

- `schema_version`: `corpus_source_artifacts_v1`

## Identity

### `artifact_id`

MUST match:

```text
^cart_[a-z0-9]+(?:_[a-z0-9]+)*$
```

Stable SiraLex identity. MUST NOT be derived solely from URL, filename, title,
or storage path.

### `source_id`

MUST match corpus source syntax:

```text
^csrc_[a-z0-9]+(?:_[a-z0-9]+)*$
```

References `corpus_sources_v1`. Structural validation may run without a source
table; when a sources file is supplied, unknown `source_id` values FAIL.

## Required fields

| Field | Type | Notes |
|-------|------|-------|
| `schema_version` | string | Exactly `corpus_source_artifacts_v1` |
| `artifact_id` | string | See syntax |
| `source_id` | string | See syntax |
| `captured_at` | string | ISO-8601 date/timestamp (calendar-validated) |
| `capture_method` | string enum | How the bytes were obtained |
| `content_sha256` | string | Exactly 64 lowercase or uppercase hex chars |
| `byte_length` | integer | Must be `> 0` |
| `media_type` | string | Non-empty MIME/media-type string |

`content_sha256` identifies the exact captured bytes. Validators check hex form
only; they do not hash local files.

## `capture_method` enum

- `direct_recording`
- `manual_copy`
- `download`
- `scan`
- `export`
- `generated_derivative`
- `other`

## Optional capture provenance

| Field | Type | Notes |
|-------|------|-------|
| `capture_tool` | string | Tool name if any |
| `capture_tool_version` | string | Requires non-empty `capture_tool` when present |
| `captured_by` | string | Operator/system id |
| `storage_ref` | string | Where bytes are stored **if retained**; not identity |
| `rights_snapshot_ref` | string | Pointer to rights state at capture time |
| `notes` | string | Free notes |
| `updated_at` | string | ISO-8601; must not precede `captured_at` |
| `derived_from_artifact_ids` | array of artifact IDs | Parent captures for derivatives |

Absence of `storage_ref` is valid (artifact may be recorded after deletion or
before offline placement). Storage existence ≠ artifact identity.

### Generated derivatives

When `capture_method` is `generated_derivative`:

- `derived_from_artifact_ids` is REQUIRED and non-empty
- entries must be unique and must not self-reference
- parents must resolve within the same artifacts table
- each parent's `source_id` must equal the derivative's `source_id`

Multi-source composite artifacts are **deferred**. Do not overwrite parent
artifact rows to represent processing outputs; create a new `artifact_id` and
hash instead.

## Storage / Git boundary

```text
metadata may be tracked
raw captured bytes are not tracked by default
```

Do not commit third-party media into git unless explicitly approved under a
dedicated reviewed path.

## Mutability

### Immutable capture facts

Do not silently rewrite these to represent different bytes:

- `artifact_id`
- `source_id`
- `content_sha256`
- `byte_length`
- `captured_at`
- `capture_method`
- `media_type`

A materially different capture of a source MUST receive a **new** `artifact_id`
(and normally a new hash/length).

### Mutable operational metadata

May evolve under repository governance (with `updated_at` when practical):

- `storage_ref`
- `rights_snapshot_ref`
- `notes`
- capture tool labels if corrected for documentation accuracy

Audit trail: git history of the JSONL artifact. No event sourcing.

## Forbidden fields

Reject fields that collapse later ontology into the artifact row, including:

- `usable`
- `transcript` / `raw_transcript` / `normalized_transcript`
- `translation` / `gloss` / `orthography`
- `uncertain_spans`
- `dictionary_candidate`
- `segment_id` / span fields

Unknown fields are rejected.

## Validation behavior

- Structural validation works on an artifacts file alone.
- Optional `--sources <corpus_sources_v1.jsonl>` first runs **full**
  `corpus_sources_v1` validation, then fails on unknown `source_id`.
- Parent derivative IDs are resolved within the artifacts table under validation.
- Empty files are structurally valid.
- Validators do not require bytes to exist at `storage_ref`.

## Authority boundary

```text
registered source ≠ captured artifact
captured artifact ≠ segment
captured artifact ≠ transcript / evidence / dictionary truth
```
