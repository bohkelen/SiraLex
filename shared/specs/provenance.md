# Provenance specification (v1)

This document defines **required provenance** for any imported/derived language data in SiraLex.  
It is **stack-neutral**: it describes *data contracts*, not implementation.

## Goals

- **Traceability**: every entry/sense/example can be traced back to the source material used to create it.
- **Auditability**: we can explain *what changed*, *when*, and *why* (including normalization/transliteration versions).
- **Revocability**: if a rights holder requests removal or modification, we can disable/remove affected content without rewriting everything else.

## Non-goals

- Defining the full dictionary schema (that will be a separate spec).
- Defining storage technology (SQL/NoSQL/files/IndexedDB/etc.).
- Defining licensing terms (we only record what we know about the source).

## Levels (where provenance must exist)

Provenance is mandatory at **all three** levels:

- **Entry**: headword/lemma record (and its variants/forms).
- **Sense**: meaning-level record (gloss/definition/translation grouping).
- **Example**: example sentences/phrases (including translations if present).

If a source does not provide a level, the record still exists but may have a minimal provenance and an explicit `derivation.kind`.

## Required fields (minimum contract)

Every record that can be displayed to a user MUST carry a `provenance` object with:

- **`source.id`**: stable internal `source_id` from the Source Registry (required)
- **`source.name`**: human-readable name (e.g. “Mali-pense French → Maninka dictionary”).
- **`source.url`**: canonical URL to the source landing page (or record page) *when available*.
- **`source.retrieved_at`**: ISO-8601 timestamp of when we retrieved the source material used.
- **`source.license_notes`**: free-text notes on known constraints/permission status (may be “unknown” but must not be omitted). Prefer centralizing this in the Source Registry (`shared/specs/source-registry.md`) and copying a short summary here.
- **`source.record_pointer`**: a stable pointer to the specific source record used (see below).

### `record_pointer` (source pointer)

`record_pointer` MUST describe **record identity** in a way that is stable across parsing changes.
It MUST use the same `kind` variants as `shared/specs/lossless-capture-and-ir.md` (`record_locator.kind`):

- `kind: "source_record_id"`
- `kind: "url_canonical+entry_index"`
- `kind: "css_selector+text_quote"`
- `kind: "page+bbox+block_index"`

`record_pointer` MUST include:

- `kind`: one of the kinds above
- the structured fields required by that kind (see below)
- `snapshot_id` (OPTIONAL; RECOMMENDED only when a real lossless snapshot exists — do not invent snapshot IDs for URL-only sources)
- `locator` (RECOMMENDED when a snapshot exists; must match the lossless locator contract)
- `fragment_hash` (OPTIONAL in Phase 1; REQUIRED when feasible in Phase 2; must match lossless hashing rules)

#### Required fields by `record_pointer.kind`

- `kind: "source_record_id"`
  - `source_record_id`: the source-published stable identifier
- `kind: "url_canonical+entry_index"`
  - `url_canonical`
  - `entry_index` (0-based)
- `kind: "css_selector+text_quote"`
  - `css_selector`
  - `text_quote`
- `kind: "page+bbox+block_index"`
  - `page_number` (PDF) OR `page_index` (scan)
  - `bbox` (normalized; see lossless spec)
  - `block_index`

#### `locator` (generic fragment locator)

The `locator` object is intentionally shared with `shared/specs/lossless-capture-and-ir.md` so HTML and books are first-class across capture → IR → provenance.

**Canonical vs duplicated fields**
Top-level fields required by `record_pointer.kind` (e.g. `css_selector`, `text_quote`, `page_number`, `bbox`, `block_index`) MAY be duplicated inside `locator`.
When `locator` is present, it SHOULD be treated as the canonical container for the locator fields; top-level fields are convenience copies to make identity explicit.

Supported locator fields include:

- HTML:
  - `css_selector`
  - `xpath`
  - `byte_span` (start/end offsets in raw bytes) when feasible
  - `text_quote`
- PDF / scans:
  - `page_number` (PDF) or `page_index` (scanned image)
  - `bbox` (normalized coordinates; see lossless spec for conventions)
  - `rotation_degrees` (`0` | `90` | `180` | `270`)
  - `block_index` (required when `kind: "page+bbox+block_index"`)
  - `pdf_text_quote` or `ocr_text_quote` (optional)

The key rule: **we must be able to locate the original evidence** without re-scraping.

## Derivation (how a record was produced)

Records may be:

- directly imported from a source (“as-is”)
- normalized (orthography/search keys)
- transliterated (Latin → N’Ko)
- merged from multiple sources

To keep this transparent, records SHOULD include a `derivation` object:

- **`derivation.kind`**: `imported` | `normalized` | `transliterated` | `merged` | `manual_override`
- **`derivation.inputs`**: list of input record references (when derived/merged)
- **`derivation.rule_versions`**: version stamps for:
  - normalization ruleset (e.g. `norm_v1`)
  - transliteration ruleset (e.g. `nko_translit_v1`)

No “silent mutation”: if a ruleset changes, new outputs must carry the new version.

**Manual overrides / corrections**
If `derivation.kind = manual_override`, the override MUST be represented as a separate correction record
(using RFC 6902 JSON Patch semantics) that references a target record + scope. The base evidence MUST remain immutable.

## Multi-source attribution

When content is composed from multiple sources:

- Keep **all** contributing provenance references (do not collapse to one source).
- Prefer a structure like:
  - `provenance.primary` (the backbone source)
  - `provenance.contributors[]` (additional sources)

## Removal / disablement expectations

The system must support a rights holder request to disable/remove a source:

- Content derived from that source should be **excludable** by filtering on `source.*` and `record_pointer`.
- Removal should affect:
  - future imports and builds
  - offline bundles (seed/full) on next release
- Audit trail should remain internally (what was removed/disabled and why), but distribution should respect the request.

## Example payloads (illustrative)

### Minimal provenance (single source, imported)

```json
{
  "provenance": {
    "source": {
      "id": "src_malipense",
      "name": "Mali-pense French → Maninka dictionary",
      "url": "https://example.invalid/mali-pense",
      "retrieved_at": "2026-01-02T00:00:00Z",
      "license_notes": "Public academic resource; permission status pending; attribution required.",
      "record_pointer": {
        "kind": "url_canonical+entry_index",
        "url_canonical": "https://example.invalid/mali-pense/entry/123",
        "entry_index": 0
      }
    }
  },
  "derivation": {
    "kind": "imported",
    "rule_versions": {
      "normalization": "norm_v1"
    }
  }
}
```

### Provenance with snapshot pointer (lossless capture)

```json
{
  "provenance": {
    "source": {
      "id": "src_malipense",
      "name": "Mali-pense French → Maninka dictionary",
      "url": "https://example.invalid/mali-pense",
      "retrieved_at": "2026-01-02T00:00:00Z",
      "license_notes": "Attribution required; redistribution policy under review.",
      "record_pointer": {
        "kind": "css_selector+text_quote",
        "snapshot_id": "snap_9f2c...",
        "css_selector": "div.entry:nth-child(4) > p.headword",
        "text_quote": "bàra …",
        "locator": {
          "css_selector": "div.entry:nth-child(4) > p.headword",
          "text_quote": "bàra …"
        },
        "fragment_hash": "sha256:..."
      }
    }
  },
  "derivation": {
    "kind": "normalized",
    "rule_versions": {
      "normalization": "norm_v1",
      "transliteration": "nko_translit_v1"
    }
  }
}
```

### Provenance with snapshot pointer (PDF/scan-style locator)

```json
{
  "provenance": {
    "source": {
      "id": "src_some_book",
      "name": "Some Book (Maninka lexicon)",
      "url": "https://example.invalid/some-book",
      "retrieved_at": "2026-01-02T00:00:00Z",
      "license_notes": "Attribution required; redistribution policy under review.",
      "record_pointer": {
        "kind": "page+bbox+block_index",
        "snapshot_id": "snap_pdf_001",
        "page_number": 12,
        "bbox": { "x": 0.10, "y": 0.25, "w": 0.80, "h": 0.10 },
        "block_index": 0,
        "locator": {
          "page_number": 12,
          "rotation_degrees": 0,
          "bbox": { "x": 0.10, "y": 0.25, "w": 0.80, "h": 0.10 },
          "block_index": 0,
          "pdf_text_quote": "…"
        },
        "fragment_hash": "sha256:..."
      }
    }
  },
  "derivation": {
    "kind": "imported",
    "rule_versions": {
      "normalization": "norm_v1"
    }
  }
}
```
