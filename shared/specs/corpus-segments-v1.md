# Corpus segments v1

This specification defines **bounded spans** inside captured corpus artifacts:

```text
corpus_sources_v1
  → corpus_source_artifacts_v1
  → corpus_segments_v1
```

A segment answers:

```text
Which bounded portion of a captured artifact are we referring to?
```

It does **not** answer what was said, what it means, how it should be
normalized, or whether it should become dictionary content (CORPUS1D+).

## Goals

- Point at exact captured bytes via `artifact_id` (not URL).
- Represent time, page, text, and whole-artifact spans without float timestamps.
- Allow unknown speakers and unknown/mixed languages as valid states.
- Keep language tags as assessments with provenance.
- Fail closed on structural errors only.

## Non-goals

- Transcripts, translations, glosses, uncertain transcript spans (CORPUS1D).
- Token-level language spans.
- Full speaker registry.
- Dictionary promotion or review worksheets.
- Requiring media files to exist on disk.

## Artifact format

Newline-delimited JSON (`.jsonl`). Intended production path when rows exist:

`shared/corpus/corpus_segments_v1.jsonl`

CORPUS1C does **not** create an empty production file. Synthetic fixtures live
under `shared/corpus/fixtures/`.

## Schema identity

- `schema_version`: `corpus_segments_v1`

## Identity and references

### `segment_id`

MUST match:

```text
^cseg_[a-z0-9]+(?:_[a-z0-9]+)*$
```

### `artifact_id`

MUST match:

```text
^cart_[a-z0-9]+(?:_[a-z0-9]+)*$
```

Preferred normalization:

```text
segment → artifact → source
```

`source_id` is **not** duplicated on segment rows (avoids drift).

Structural validation may run without an artifacts table; when an artifacts
file is supplied, unknown `artifact_id` values FAIL.

## Required fields

| Field | Type | Notes |
|-------|------|-------|
| `schema_version` | string | Exactly `corpus_segments_v1` |
| `segment_id` | string | See syntax |
| `artifact_id` | string | See syntax |
| `span_type` | string enum | `time` \| `page` \| `text` \| `whole_artifact` |

## Span model

Fields from incompatible span types MUST NOT be mixed.

### `span_type = time`

Required integers:

- `start_ms` ≥ 0
- `end_ms` > `start_ms`

### `span_type = page`

Required integers:

- `start_page` ≥ 1
- `end_page` ≥ `start_page`

### `span_type = text`

Required integers:

- `start_char` ≥ 0
- `end_char` > `start_char`

### `span_type = whole_artifact`

No time/page/text span fields.

**Decision:** `whole_artifact` is justified when a small complete capture (e.g.
short owned clip, single-page PDF excerpt stored as its own artifact) is the
evidence unit. It is not a convenience alias for “forgot to set bounds.”

## Speaker metadata (optional, non-authoritative)

| Field | Type | Notes |
|-------|------|-------|
| `speaker_labels` | array of strings | e.g. `["speaker_1"]`; empty array allowed |
| `speaker_overlap` | boolean | Unknown overlapping speakers may be `true` without labels |

No speaker registry in CORPUS1C.

## Language metadata (optional, non-authoritative)

| Field | Type | Notes |
|-------|------|-------|
| `languages_present` | array of strings | Segment-level soft assessment list |
| `language_assessment_method` | string | Required when `languages_present` is non-empty |
| `language_assessed_by` | string | Required when `languages_present` is non-empty |
| `language_assessment_confidence` | string enum | `unknown` \| `low` \| `medium` \| `high` |

Rules:

- Empty `languages_present` is valid (unknown/unassessed).
- Non-empty `languages_present` requires method + assessor provenance.
- Orphan language provenance without non-empty `languages_present` is rejected.
- No Manding label normalization.

## Optional descriptive fields

| Field | Type |
|-------|------|
| `audio_quality` | string |
| `background_noise` | string |
| `segment_type` | string |
| `speech_context` | string |
| `notes` | string |
| `registered_at` | string (ISO-8601) |
| `updated_at` | string (ISO-8601) |

Keep minimal. Do not expand into full linguistic annotation.

## Segment-boundary revision rule

```text
material boundary change → new segment_id
```

Changing `span_type` or span bounds creates a different evidence unit and MUST
use a new `segment_id`. Descriptive metadata (`notes`, quality flags, language
assessment updates that do not change the span) may update the same row with
`updated_at`.

Audit: git history. No event sourcing.

## Forbidden fields

Reject:

- `transcript` / `raw_transcript` / `normalized_transcript`
- `translation` / `gloss` / `orthography`
- `uncertain_spans`
- `dictionary_candidate`
- `usable`
- `source_id` (use artifact→source chain)
- `content_sha256` / capture fields belonging to artifacts

Unknown fields are rejected.

## Validation behavior

- Structural validation works on a segments file alone.
- Optional `--artifacts <corpus_source_artifacts_v1.jsonl>` first runs **full**
  artifact validation, then fails on unknown `artifact_id`.
- Optional `--sources` requires `--artifacts` and validates the chain
  segment → artifact → source (sources fully validated via artifact validator).
- Empty files are structurally valid.

## Authority boundary

```text
segment ≠ transcript
segment ≠ linguistic interpretation
segment ≠ reviewed corpus evidence
segment ≠ dictionary truth
```
