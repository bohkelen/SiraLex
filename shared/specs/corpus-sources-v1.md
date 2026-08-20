# Corpus sources v1

This specification defines the **corpus source registry** contract for SiraLex
CORPUS1: how we record identity, discovery metadata, language claims,
descriptive notes, and rights-review linkage for language **sources**.

A corpus source answers:

```text
What external or owned language source are we referring to?
Where did we discover it?
What does the source claim about itself?
What do we currently know or assess about it?
What rights-review state is associated with using it?
```

It does **not** answer what bytes were captured, what was spoken, what a
utterance means, or whether anything may enter the dictionary.

## Goals

- Give every corpus source a stable internal `source_id` independent of URL.
- Preserve claimed vs assessed language/variety without collapsing Manding labels.
- Represent unknown rights and publication-blocking review states.
- Fail closed on structural errors only (not linguistic or legal truth).
- Keep corpus sources distinct from dictionary `shared/sources/*.yaml`.

## Non-goals

- Captured/versioned artifacts (`corpus_source_artifacts_v1` — CORPUS1C).
- Segments, transcripts, translations, uncertain spans (CORPUS1C/D).
- Rights legal adjudication or a full rights engine.
- Media download/acquisition authorization.
- Dictionary, alias, supplement, search, or Learning mutation.
- Tool integration (ELAN, FFmpeg, ASR, datasets).

## Relation to dictionary Source Registry

`shared/specs/source-registry.md` and `shared/sources/*.yaml` describe
**dictionary ingestion sources** (lexical provenance for published entries).

CORPUS1 uses a **separate** contract:

- schema: `corpus_sources_v1`
- intended artifact path (when rows exist): `shared/corpus/corpus_sources_v1.jsonl`

A corpus source MUST NOT be treated as an approved lexical source merely
because it is registered here.

## Artifact format

Registry rows are newline-delimited JSON (`.jsonl`). Each non-empty line is one
source object.

Tracked production rows, when authorized later, live under `shared/corpus/`.
Raw media and third-party corpora MUST NOT be committed by default
(`.cursor/rules/highest-value-rules.mdc`).

CORPUS1B does **not** require creating an empty tracked registry file. Ship
`corpus_sources_v1.jsonl` only when the first real reviewed row exists.

## Schema identity

- `schema_version`: `corpus_sources_v1` (string)

## Identity invariant

```text
URL ≠ immutable source identity
```

- `source_id` is the stable SiraLex corpus identity.
- `source_locator` (optional) records where the source was discovered.
- Content hashing and capture storage belong to CORPUS1C artifacts.

### `source_id` syntax

MUST match:

```text
^csrc_[a-z0-9]+(?:_[a-z0-9]+)*$
```

Examples: `csrc_owned_pilot_001`, `csrc_public_video_demo_01`.

MUST NOT be derived solely from a mutable title or URL.

## Required fields

Each row MUST include:

| Field | Type | Notes |
|-------|------|-------|
| `schema_version` | string | Exactly `corpus_sources_v1` |
| `source_id` | string | See syntax above; unique within a table file |
| `source_type` | string enum | Controlled taxonomy below |
| `registered_at` | string | ISO-8601 date or timestamp when registered in SiraLex |
| `rights_basis` | string enum | Claimed rights basis, not legal determination |
| `rights_review_status` | string enum | Review/blocking posture |

Timestamps are validated as real calendar values via the Python standard library
(`date.fromisoformat` / `datetime.fromisoformat`). Impossible dates/times such as
`2026-02-31` or `2026-08-20T25:99` MUST fail.

## Optional discovery / locator fields

| Field | Type | Semantics |
|-------|------|-----------|
| `platform` | string | Discovery context (`local`, `youtube`, `radio_archive`, `print`, …) |
| `source_locator` | string | Where discovered (URL, shelf mark, path description). Not content identity. |
| `title` | string | Human title if known |
| `creator_or_channel` | string | Creator/channel/publisher claim if known |
| `discovered_at` | string | ISO-8601 when first observed/discovered (may precede registration) |
| `updated_at` | string | ISO-8601 when mutable metadata/assessment last updated |

Terminology note: prefer `registered_at` / `discovered_at` over `collected_at`
because CORPUS1B does not capture media.

`source_locator` may be omitted for owned/offline sources when identity is
otherwise clear (e.g. owned recording registered without a public URL).

## Source taxonomy (`source_type`)

Allowed values:

- `owned_recording`
- `permissioned_recording`
- `public_video`
- `public_audio`
- `film_or_movie`
- `radio`
- `interview`
- `sermon`
- `speech`
- `oral_history`
- `subtitle_or_existing_transcript`
- `book_or_pdf`
- `other_text`
- `future_user_submission`
- `other`

`other` is allowed when none of the specific values fit. Do not invent false
precision.

## Language / variety claim model

Do **not** use a single required `language` field as truth.

### Singular claim / assessment (source-level)

| Field | Type | Notes |
|-------|------|-------|
| `claimed_language` | string | Source-provided or title/uploader claim; free text |
| `claimed_language_by` | string | Provenance of the claim (e.g. `source_title`) |
| `assessed_language` | string | Human/machine assessment; free text |
| `assessment_method` | string | How assessment was made |
| `assessment_confidence` | string enum | `unknown` \| `low` \| `medium` \| `high` |
| `assessed_by` | string | Reviewer id/tool id |

Conditional structure:

- If `claimed_language` is present and non-empty, `claimed_language_by` is REQUIRED.
- If `claimed_language_by` is present and non-empty, `claimed_language` MUST be
  present and non-empty (no orphan claim provenance).
- If `assessed_language` is present and non-empty, `assessment_method` and
  `assessed_by` are REQUIRED.
- If any of `assessment_method`, `assessed_by`, or `assessment_confidence` is
  present, `assessed_language` MUST be present and non-empty (no orphan
  assessment provenance).

Unknown language is valid: omit assessment fields, or set values such as
`unknown` / `uncertain` in free-text language fields. The validator does **not**
normalize or equate Maninka, Malinké, Mandinka, Bambara, or Jula/Dioula.

### Multilingual soft claim

| Field | Type | Notes |
|-------|------|-------|
| `languages_present_claim` | array of strings | Optional source-level claim that multiple languages may appear |

This is **not** segment-level language identity. Precise multilingual content
belongs to CORPUS1C segments.

### Optional variety metadata

| Field | Type |
|-------|------|
| `region_claim` | string |
| `speaker_origin_claim` | string |
| `dialect_or_variety_claim` | string |

All optional; unknown is represented by omission.

## Rights linkage (structure, not legal judgment)

Required:

| Field | Allowed values |
|-------|----------------|
| `rights_basis` | `owned` \| `permissioned` \| `licensed` \| `public_domain` \| `reference_only` \| `unknown` \| `requires_review` |
| `rights_review_status` | `unknown` \| `requires_rights_review` \| `reviewed` \| `publication_blocked` |

Optional:

| Field | Type | Notes |
|-------|------|-------|
| `license_reference` | string | SPDX id, URL, or short label if known |
| `permission_evidence_ref` | string | Pointer to permission evidence (path/id); not proof of legality |
| `attribution_required` | boolean | When known |
| `rights_notes` | string | Free-text caveats |
| `rights_ref` | string | Forward reference to a future dedicated rights record |

A license string MUST NOT be treated as authorization to publish.

### Sparse usage permissions (optional stub)

To preserve coexistence of different use postures without a full rights engine,
rows MAY include:

```text
usage_permissions: {
  "<use>": "allowed" | "blocked" | "unknown",
  ...
}
```

Allowed `<use>` keys:

- `internal_analysis`
- `local_storage`
- `transcription`
- `translation`
- `corpus_storage`
- `short_excerpt_storage`
- `audio_redistribution`
- `transcript_redistribution`
- `dictionary_example_publication`
- `pronunciation_publication`
- `model_training`
- `model_evaluation`
- `commercial_redistribution`

Rules:

- Object may be omitted entirely.
- Only listed keys are allowed.
- Values MUST be `allowed`, `blocked`, or `unknown`.
- Absence of a key means **not asserted** (treat as unknown for that use).
- A global `usable` / `usable=true` field is FORBIDDEN.
- If `rights_review_status` is `publication_blocked`, then none of the following
  `usage_permissions` keys may be `allowed`:
  `audio_redistribution`, `transcript_redistribution`,
  `dictionary_example_publication`, `pronunciation_publication`,
  `commercial_redistribution`.
  Internal analysis / local storage may still be `allowed`.

Governance posture (documentation, not auto-enforced by structural validity beyond
the contradiction above):

- `rights_review_status` of `unknown`, `requires_rights_review`, or
  `publication_blocked` MUST be treated as blocking unauthorized publication
  uses until a later rights contract + human review clears them.
- Internal analysis may still be recorded as `allowed` in `usage_permissions`
  while `dictionary_example_publication` remains `blocked` or unset.

Full per-use rights matrix expansion may move to a dedicated rights contract
before real acquisition; this stub preserves the architectural invariant.

## Optional descriptive metadata (source-level only)

| Field | Type | Notes |
|-------|------|-------|
| `duration_if_known` | number | Seconds, if known at registration |
| `page_count_if_known` | integer | For text/PDF sources |
| `speaker_count_if_known` | integer | If known without capture inspection |
| `media_quality_claim` | string | Claim only |
| `background_noise_or_music_claim` | string | Claim only |
| `notes` | string | Free notes |

Do not store capture hashes, byte lengths, media types, or storage refs here.

## Mutability / revision

| Kind | Fields | Mechanism |
|------|--------|-----------|
| Stable identity | `source_id`, `schema_version` | Do not reuse IDs for different sources |
| Mutable metadata | title, locator, descriptive claims | Update row; set `updated_at` |
| Review-updatable | assessed_* , rights_* , usage_permissions | Update row; set `updated_at` |
| Audit trail | — | Git history of the JSONL artifact |

No event sourcing. The registry is not immutable like a published dictionary
bundle; changes must remain reviewable via git.

## Strict object shape

Unknown fields are rejected. Only fields listed in this specification are
allowed.

## Validation behavior

The validator:

- parses JSONL;
- enforces required fields, types, enums, `source_id` syntax, uniqueness;
- enforces claim/assessment provenance conditionals;
- accepts unknown language and unresolved rights;
- does **not** judge linguistic truth or legal usability;
- does **not** authorize acquisition or publication.

Empty files (zero rows) are structurally valid.

## Authority boundary

```text
registered source ≠ captured artifact
registered source ≠ segment / transcript
registered source ≠ reviewed corpus evidence
registered source ≠ dictionary truth
```

Downstream CORPUS1 slices and existing AL1 / IR / correction governance remain
the only paths toward product candidates and publication.
