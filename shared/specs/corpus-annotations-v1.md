# Corpus annotations v1

This specification defines **versioned linguistic annotations** for SiraLex CORPUS1:

```text
corpus_sources_v1
  → corpus_source_artifacts_v1
  → corpus_segments_v1
  → corpus_annotations_v1
```

An annotation is an interpretation or representation attached to a segment
(transcript, translation, gloss, orthography note). It is **not** review
approval, promotion, or dictionary truth.

## Goals

- Keep annotations as separate versioned objects (never `segment.transcript`).
- Preserve raw vs normalized transcripts as distinct rows.
- Record production provenance (who/what/how), including machine identity.
- Support derivation and supersession without destructive overwrite.
- Represent local uncertainty spans with explicit Unicode indexing.
- Fail closed on structural errors only.

## Non-goals

- Review status / acceptance / promotion (CORPUS1E).
- Dictionary candidates, aliases, IR mutation.
- ASR/MT execution, ELAN import, media acquisition.
- Full FLEx/interlinear models.

## Artifact format

Newline-delimited JSON (`.jsonl`). Intended production path when rows exist:

`shared/corpus/corpus_annotations_v1.jsonl`

CORPUS1D does **not** create an empty production file. Synthetic fixtures live
under `shared/corpus/fixtures/`.

## Schema identity

- `schema_version`: `corpus_annotations_v1`

## Identity

### `annotation_id`

MUST match:

```text
^cann_[a-z0-9]+(?:_[a-z0-9]+)*$
```

### `segment_id`

MUST match:

```text
^cseg_[a-z0-9]+(?:_[a-z0-9]+)*$
```

## Required fields

| Field | Type | Notes |
|-------|------|-------|
| `schema_version` | string | Exactly `corpus_annotations_v1` |
| `annotation_id` | string | See syntax |
| `segment_id` | string | See syntax |
| `annotation_type` | string enum | See types |
| `content` | string | Non-empty annotation text |
| `created_at` | string | Full ISO-8601 **datetime with explicit timezone** (`Z` or `±HH:MM`). Date-only and timezone-naive values are rejected. |
| `creation_method` | string enum | How it was produced |
| `created_by` | string | Human/system id |

## Annotation types

- `transcript_raw` — transcription attempt closest to perceived speech
- `transcript_normalized` — intentional orthographic/normalization transform
- `translation` — meaning in a target/content language
- `gloss` — minimal gloss-like linguistic material
- `orthography_note` — explanatory orthography note (not authority)

## Content language and script

Optional:

| Field | Type | Notes |
|-------|------|-------|
| `content_language` | string | Free-text label/claim; unknown valid |
| `script` | string enum | `Latn` \| `Nkoo` \| `Arab` \| `mixed` \| `unknown` |

`Latn`, `Nkoo`, and `Arab` are ISO 15924 codes. `mixed` / `unknown` are
SiraLex extensions.

No Manding label normalization. Model-produced N’Ko remains machine-produced
candidate material with provenance — never authoritative orthography by default.

For `annotation_type = translation`, `content_language` is REQUIRED (non-empty).

## Creation / production provenance

### `creation_method` enum

- `manual_transcription`
- `subtitle_import`
- `asr`
- `manual_translation`
- `machine_translation`
- `normalization`
- `llm_assisted`
- `manual_annotation`
- `import`
- `other`

Optional tool/model fields:

- `tool_name`, `tool_version`
- `model_name`, `model_version`

When `creation_method` is `asr`, `machine_translation`, or `llm_assisted`:

- at least one of `tool_name` or `model_name` is REQUIRED (non-empty)
- corresponding version fields MAY be the explicit string `unknown` when a
  precise version is unavailable; silent omission of all machine identity is
  not allowed

`tool_version` without `tool_name`, and `model_version` without `model_name`,
are rejected.

## Derivation

Optional:

```text
derived_from_annotation_ids: [annotation_id, ...]
```

Rules:

- unique IDs; no self-reference
- parents must resolve in the same annotations table
- parents MUST share the same `segment_id`
- derived annotation `created_at` MUST be `>=` each parent `created_at`
  (equality allowed for coarse timestamps)
- no cycles in the derivation graph

`transcript_normalized` REQUIRES non-empty `derived_from_annotation_ids`.
When the table is available, every parent MUST have
`annotation_type` in `{transcript_raw, transcript_normalized}`.

Direct human transcription from a segment may omit parents.

## Supersession / revision

Optional:

```text
supersedes_annotation_id
```

Rules:

- no self-supersession
- referenced annotation must exist in the table
- superseded annotation MUST share the same `segment_id`
- superseding annotation MUST preserve `annotation_type` (same type only)
- superseding `created_at` MUST be `>=` superseded `created_at`
- the supersession graph MUST be acyclic
- multiple annotations MAY supersede the same parent (competing revisions)
- derivation (not supersession) is the mechanism for crossing types
  (e.g. translation deriving from a transcript)

A translation does not supersede a transcript. An orthography note does not
supersede a gloss.

Material content changes SHOULD create a new `annotation_id` related via
derivation and/or supersession. Prefer treating annotation rows as immutable
evidence records; do not silently rewrite `content` in place.

## Combined provenance graph

Derivation and supersession are separately meaningful, but they form one
overall annotation-provenance system. Validators MUST treat the **union** of:

```text
derived_from_annotation_ids edges
+
supersedes_annotation_id edges
```

as a single directed graph and require that union to be **acyclic**.

A pattern such as “A derives from B” and “B supersedes A” is invalid even
when each relation type alone looks acyclic. Parallel edges that point
consistently in the same historical direction remain valid.

## Current revision (leaf) semantics

A **current annotation revision** is an annotation that is **not superseded**
by any other annotation in the table (a supersession leaf).

```text
current revision count may be > 1
```

Competing same-type supersessions are legal. Example: `transcript_B` and
`transcript_C` both supersede `transcript_A` ⇒ both B and C are current
leaves.

The system MUST NOT define `latest created_at` as the authoritative winner.
Timestamp ordering is provenance chronology, not linguistic authority.
Helpers such as `find_supersession_leaves` MUST return **all** leaves
deterministically and MUST NOT select a winner.

## Uncertainty spans

Optional `uncertain_spans` array on textual annotations.

Each span object:

| Field | Type | Notes |
|-------|------|-------|
| `start_char` | integer | ≥ 0 |
| `end_char` | integer | > `start_char` |
| `reason` | string | Optional |
| `surface_form` | string | Optional; if present MUST equal content slice |
| `alternatives` | array of non-empty strings | Optional |
| `confidence` | enum | `unknown` \| `low` \| `medium` \| `high` |

### Indexing rule (normative)

Offsets are **zero-based Unicode code-point indices**, **end-exclusive**.

In Python terms, they match `len(str)` / slicing on a Python 3 `str`
(`content[start_char:end_char]`).

They are **not** UTF-8 byte offsets and **not** UTF-16 code units.

`end_char` MUST be ≤ Unicode length of `content`.

Overlapping uncertain spans are **permitted** (competing local hypotheses).

## Forbidden fields

Reject review/promotion authority fields, including:

- `review_status`, `accepted`, `approved`, `published`
- `promotion_status`, `dictionary_candidate`, `headword_candidate`
- `alias_candidate`, `usable`

## Validation behavior

- Structure-only validation works on an annotations file alone.
- Optional `--segments` runs **full** segment validation, then checks refs.
- Optional `--artifacts` / `--sources` may be supplied with `--segments` to
  validate the full chain (sources requires artifacts; both require segments).
- Empty files are structurally valid.

## Authority boundary

```text
annotation ≠ validated corpus truth
annotation ≠ dictionary candidate
annotation ≠ published dictionary content
machine annotation ≠ reviewed annotation
```
