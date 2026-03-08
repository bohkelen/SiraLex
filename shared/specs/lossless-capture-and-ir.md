# Lossless capture & IR specification (v1.1)

This spec defines how SiraLex captures third-party sources in a **lossless enough** way to support:

- iterative parsing without re-scraping
- fine-grained provenance (entry/sense/example)
- auditability and removal/disablement

It is **stack-neutral**: it defines data contracts and invariants, not implementation.

## Goals

- **Immutable raw snapshots**: the captured "evidence" is stable over time.
- **Reproducible extraction**: parsers can reference the exact fragment used.
- **Traceability**: every extracted piece can point back to a snapshot + fragment pointer.
- **Change tolerance**: parsing/normalization rules can change without requiring re-download.

## Non-goals

- Choosing a crawler or storage backend.
- Defining full dictionary schemas (entries/senses/etc.) beyond what's needed for capture/IR links.

## Terminology

- **Source**: a third-party website/resource we ingest (e.g., Mali-pense).
- **Snapshot**: an immutable capture of a single retrieved resource (typically one HTML page).
- **Fragment**: a referenced subset of a snapshot (e.g., one dictionary entry block on the page).
- **IR (Intermediate Representation)**: a lossless-enough structured representation produced from snapshots/fragments, prior to normalization into the final lexicon.

## Phase 1.1: Raw capture (snapshots)

### Snapshot invariants

Snapshots MUST be:

- **Immutable** once stored (content never changes in-place)
- **Addressable** by a stable `snapshot_id`
- **Verifiable** by a content hash

### Required snapshot metadata (minimum)

Each snapshot MUST record:

- **`snapshot_id`**: stable internal identifier
- **`source_id`**: stable join key from the Source Registry (see `shared/specs/source-registry.md`)
- **`source_name`**: optional display label (do NOT use as an identifier)
- **`url`**: URL retrieved (as requested/resolved at time of fetch)
- **`retrieved_at`**: ISO-8601 timestamp
- **`http_status`**: numeric status (optional for non-web sources)
- **`content_type`**: as returned (best-effort)
- **`content_hash`**: hash of raw bytes (e.g., `sha256:...`)
- **`byte_length`**: size of raw bytes
- **`encoding`**: if known/declared (best-effort)

Recommended (not required but useful):

- `snapshot_group_id` (or `crawl_id`): identifier for the crawl/batch/build that produced this snapshot
- `url_canonical`: best-effort canonical URL for record identity (deterministic; see below)
- `url_canonicalization_version`: version id of the canonicalization rules used (recommended when `url_canonical` is present)
- `source_record_id`: best-effort stable record identifier when the source exposes one (preferred over URL when available)
- `redirect_chain[]`
- `request_headers` / `response_headers` (only if a redaction policy is applied; see Security section)
- `fetch_tool_version` (crawler version)
- `robots_policy_notes` (operator belief at time of capture; not proof of permission)

#### `url_canonical` (deterministic canonicalization rules)

If you compute `url_canonical`, the transformation MUST be deterministic and versioned (via `url_canonicalization_version`) so two crawls do not create different identities for the same record.

Baseline expectations for a `urlcanon_v1` ruleset:

- normalize scheme and host case (lowercase)
- remove URL fragment (`#...`)
- remove default ports (`:80` for http, `:443` for https)
- normalize trailing slash (remove trailing slash unless the path is `/`)
- normalize query parameter ordering (sort by key, then value)
- remove tracking parameters as defined by the ruleset (e.g., `utm_*`, `gclid`, `fbclid`) while preserving content-changing parameters

Canonicalization MUST be conservative: do not drop parameters unless the ruleset explicitly marks them as tracking/non-semantic.

### Snapshot payload

Snapshot payload SHOULD store:

- raw bytes (HTML) as captured
- optionally a normalized text view *in addition* (never instead of raw)

## Security / privacy hygiene (required if storing headers)

If you store HTTP request/response headers or similar metadata, you MUST:

- apply a **redaction policy** before persistence (cookies, auth headers, tokens, session identifiers, user identifiers)
- record which policy was applied via `redaction_policy_id` (or equivalent) on the snapshot metadata when headers are stored
- store only what's needed for reproducibility/debugging

Rationale: snapshots are "evidence," but we must not accidentally persist secrets.

## Fragment pointers (referencing evidence inside a snapshot)

To support provenance and auditability, IR items MUST be able to reference a fragment of a snapshot.

### Fragment pointer contract

A fragment pointer MUST include:

- **`source_id`**: stable join key from the Source Registry
- **`snapshot_id`**
- **one or more locators**, best-effort, such as:
  - `css_selector`
  - `xpath`
  - `byte_span` (start/end offsets in raw bytes) when feasible
  - `text_quote` (exact snippet or "quote" for anchoring)
- **`fragment_hash`**: strongly recommended; required in Phase 2 when feasible (see below)

#### `fragment_hash` definition (must be unambiguous)

If `fragment_hash` is present, the fragment representation MUST be explicitly defined so two implementations compute the same hash.

**Phase 1 (recommended and most stable):**

- If `byte_span` is present: `fragment_hash` MUST be the hash of the exact raw byte slice referenced by `byte_span` (i.e., `snapshot_bytes[start:end]`).

If `byte_span` is not available and you still provide a `fragment_hash`:

- The pointer MUST include `fragment_representation_kind` describing what was hashed (e.g. `dom_outer_html`, `text_quote_utf8`, `pdf_text_quote_utf8`, `image_ocr_text_utf8`)
- The pointer MUST define `fragment_hash` as the hash of the UTF-8 bytes of that representation.
  - This is less preferred than `byte_span` because DOM serialization and OCR can vary by tool/version.

For non-byte-span locators (PDF/scans), implementations SHOULD prefer hashing a canonicalized locator description rather than free-form serialization.

- Recommended (collision-safe across snapshots): compute `fragment_hash` as `sha256:` of the UTF-8 bytes of an **RFC 8785 (JCS) canonical JSON** object containing:
  - `source_id`
  - `snapshot_id` (required for collision safety across snapshots)
  - the locator fields used (e.g., `page_number`/`page_index`, `rotation_degrees`, `bbox`, and `pdf_text_quote`/`ocr_text_quote` when present)
  - `fragment_representation_kind: "locator_jcs_v1"`

**Phase 2 (required when feasible):**

- For HTML (or other byte-addressable formats) where `byte_span` can be recorded, `fragment_hash` MUST be present and computed from the referenced raw byte slice.

Notes:

- Locators are allowed to be imperfect (sites change), but `snapshot_id` + `fragment_hash` MUST still anchor what was used.
- For HTML, prefer a structural locator (`css_selector`/`xpath`) + a `text_quote` anchor.

---

## Phase 1.2: Lossless IR

IR sits between raw capture and normalized lexicon records.

### IR goals

- Preserve what the source contained, including ambiguous or messy fields.
- Keep enough structure that normalization can be deterministic and versioned later.
- Keep provenance hooks: every IR unit points back to snapshot(s) and fragment(s).

### Unicode normalization policy (layering clarification)

IR is a **structural projection**, not a display/normalization layer.

- IR `fields_raw` strings SHOULD preserve what was extracted from the source as faithfully as possible.
- IR MUST NOT enforce Unicode normalization forms (e.g., NFC) on Latin display strings as a global invariant.
- Any Unicode normalization policy (e.g., “normalize to NFC before computing keys” or “normalize to NFC for display”) belongs to the **Normalization** layer (`shared/specs/normalization-versioning.md`) and must be deterministic and versioned (`norm_vN`).

Rationale: this preserves the clean layering:

Snapshot (raw bytes) → IR (structural projection) → Corrections (optional) → Normalization (NFC + key generation) → Index/Bundle → Frontend

### IR kinds (document type discrimination)

Different source document types produce different IR shapes. To prevent schema confusion and enable type-specific validation:

**`ir_kind`** (required): discriminator for the IR unit type.

Supported values:

| `ir_kind` | Description | Example |
|-----------|-------------|---------|
| `lexicon_entry` | Dictionary entry from a lexicon page (headword + senses + examples) | Mali-pense `/emk/lexicon/a.htm` |
| `index_mapping` | Mapping from one language to entry references | Mali-pense `/emk/index-french/a.htm` |
| `metadata_page` | Landing/info pages with metadata but not lexical entries | Mali-pense `/emk/lexicon/indexfr.htm` |

Different `ir_kind` values have different `fields_raw` schemas. Parsers SHOULD validate against the appropriate schema.

### IR unit shape (required fields)

An IR unit MUST include:

- **`ir_id`**: stable internal identifier (see computation rules below)
- **`ir_kind`**: document type discriminator (see above)
- **`source_id`**: stable join key from the Source Registry
- **`evidence`**: one or more fragment pointers covering the **full entry block** (see evidence rules below)
- **`record_locator`**: required identity hint for the source record (see below)
- **`fields_raw`**: extracted candidate fields *as found* (see field extraction rules below)
- **`parse_warnings[]`**: non-fatal warnings when structure is unclear
- **`parser_version`**: version stamp of the parser used to produce this IR

**Fields NOT stored on IR units (join instead):**

- ~~`retrieved_at`~~: Belongs to the snapshot. Join via `evidence[].snapshot_id` → `snapshot.retrieved_at`.
- ~~`source_name`~~: Belongs to Source Registry. Join via `source_id`.

Rationale: Avoid denormalized data that can drift. Timestamps and display names are authoritative on their origin records.

### `ir_id` computation (normative, collision-safe)

`ir_id` MUST be deterministic and globally unique.

**Problem:** Source-internal IDs (e.g., `id="e15"`) are often **page-scoped** and will collide across pages. Mali-pense has `e15` on every lexicon page.

**Required computation:**

```
ir_id = sha256(source_id + "|" + url_canonical + "|" + record_id_component + "|" + parser_version)[:16]
```

Where:
- `source_id`: from Source Registry (e.g., `src_malipense`)
- `url_canonical`: the page URL (required for global uniqueness)
- `record_id_component`: the page-scoped ID (e.g., `e15`) OR stringified `entry_index` if no ID exists
- `parser_version`: ensures different parser versions produce different IDs

**Example:**
```python
ir_id = sha256("src_malipense|https://www.mali-pense.net/emk/lexicon/a.htm|e15|malipense_lexicon_v1")[:16]
# Result: "a7b3c9d2e1f04567"
```

This produces a collision-safe identifier that is:
- **Deterministic**: same inputs → same ID
- **Globally unique**: includes URL
- **Versioned**: parser changes produce new IDs

### `record_locator` (required; prevents duplicates)

IR MUST include a `record_locator` describing how this IR unit corresponds to a specific record within the captured evidence.

#### `record_locator.kind` (minimal enum)

To prevent drift across implementations, `record_locator.kind` MUST be one of:

- `source_record_id`
- `url_canonical+entry_index`
- `css_selector+text_quote`
- `page+bbox+block_index`

#### `record_locator` required fields by kind

**`kind: "source_record_id"` (preferred when source has stable IDs):**

```json
{
  "kind": "source_record_id",
  "url_canonical": "https://...",           // REQUIRED for global uniqueness
  "source_record_id": "e15",                // Page-scoped ID from source
  "anchor_names": ["ábadàn", "abadan"]      // Optional: human-friendly anchors
}
```

**Important:** `url_canonical` is REQUIRED even for `source_record_id` kind because source IDs are typically page-scoped.

**`kind: "url_canonical+entry_index"` (when no stable ID exists):**

```json
{
  "kind": "url_canonical+entry_index",
  "url_canonical": "https://...",
  "entry_index": 0                          // 0-based, DOM order
}
```

#### `entry_index` semantics (if used)

If you use `entry_index` in a `record_locator`, it MUST be:

- **0-based**
- computed in **DOM order** for HTML snapshots
- computed after applying the parser's deterministic "entry selection" rule for that source
- stable **within a snapshot for a given parser version**

### Evidence pointers (must cover full entry block)

Evidence MUST reference the **complete entry block**, not just the headword element.

**Problem:** An entry like `#e15` is a `<span>` containing just the headword. The full entry includes multiple sibling paragraphs with senses, examples, etc. Evidence pointing only to `#e15` loses auditability for downstream data.

**Required:** Store evidence covering the entry block boundary:

```json
{
  "evidence": [{
    "source_id": "src_malipense",
    "snapshot_id": "abc123...",
    "entry_block": {
      "start_selector": "span#e15",
      "end_selector": "span#e16",
      "block_selectors": [                   // OR explicit list
        "p.lxP:has(#e15)",
        "p.lxP2:nth-of-type(1)",
        "p.lxP2:nth-of-type(2)"
      ]
    },
    "text_quote": "ábadàn",                  // Anchor text for verification
    "fragment_hash": "sha256:..."            // Hash of the block content
  }]
}
```

#### `entry_block` boundary semantics (normative)

To prevent ambiguity when rehydrating evidence blocks:

- **`start_selector`**: Points to the **first element** of the entry. **INCLUSIVE** - this element is part of the entry.
- **`end_selector`**: Points to the **first element of the next entry**. **EXCLUSIVE** - this element is NOT part of the current entry.

This means the entry block spans: `[start_selector, end_selector)` (half-open interval).

If `end_selector` is `null`, the entry extends to the end of the page/document.

**Example:** For entry `e15` with `end_selector: "span#e16"`:
- Entry `e15` includes all content from `span#e15` up to (but NOT including) `span#e16`
- Entry `e16` begins at `span#e16`

The parser MUST define its entry block boundary rule (e.g., "from `p.lxP` containing `#eN` until next `p.lxP`").

### `fields_raw` extraction rules (conservative)

IR is for **preservation**, not interpretation. Extract fields literally.

#### Rule: Don't over-interpret compound strings

**Example problem:** Mali-pense `<span class="PS">adv jamais</span>` contains POS + gloss concatenated.

**Wrong (over-interpretation):**
```json
{
  "pos_raw": "adv",
  "gloss_fr": "jamais"
}
```

**Correct (literal extraction):**
```json
{
  "ps_raw": "adv jamais",           // Exactly as found in span.PS
  "pos_hint": "adv"                 // Optional, only if parser is confident
}
```

Glosses should come from dedicated gloss elements (`GlFr`, `GlEn`, etc.), not from the PS line.

#### Rule: Distinguish "provided" vs "generated" forms

If the source provides data that might also be generated later (e.g., N'Ko script), mark it explicitly:

```json
{
  "headword_latin": "ábadàn",
  "headword_nko_provided": "ߤߓߊߘߊ߲߫",   // From source (preserve as-is)
  // Later phases may add:
  // "headword_nko_generated": "..."      // From transliteration
}
```

This prevents confusion about whether N'Ko forms came from the source or were generated.

### `fields_raw` schemas by `ir_kind`

#### `ir_kind: "lexicon_entry"`

```json
{
  "fields_raw": {
    "headword_latin": "ábadàn",
    "headword_nko_provided": "ߤߓߊߘߊ߲߫",
    "anchor_names": ["ábadàn", "abadan"],
    "ps_raw": "adv jamais",
    "pos_hint": "adv",
    "senses": [
      {
        "sense_num": 1,
        "gloss_fr": "jamais",
        "gloss_en": "never",
        "gloss_ru": "никогда́",
        "examples": [
          {
            "text_latin": "wùlu` ní ɲàari` té díya hábadan",
            "text_nko_provided": "ߥߎ߬ߟߎ ߣߌ߫...",
            "trans_fr": "le chien et le chat...",
            "trans_en": "a dog and a cat...",
            "source_attribution": "[Diane Mamadi]"
          }
        ]
      }
    ],
    "variants_raw": ["hábadan", "hábada"],
    "synonyms_raw": ["bedebeli", "kádawù"],
    "etymology_raw": "Ar. ...",
    "literal_meaning_raw": "( ... )"
  }
}
```

#### `ir_kind: "index_mapping"`

```json
{
  "fields_raw": {
    "source_term": "abandonner",
    "source_lang": "fr",
    "target_entries": [
      {"lexicon_url": "../lexicon/b.htm", "anchor": "e504", "display_text": "bàn"},
      {"lexicon_url": "../lexicon/b.htm", "anchor": "e1096", "display_text": "bìla"}
    ]
  }
}
```

---

## Linking IR to provenance (entry/sense/example)

When IR is later converted to normalized lexicon records, provenance MUST be preserved per `shared/specs/provenance.md`.

At minimum, normalized records should be able to set:

- `provenance.source.record_pointer.kind = "snapshot"`
- `snapshot_id` from the IR evidence
- selector/span/quote information (best-effort)

Join to snapshot for `retrieved_at` (do not copy to avoid drift).

## Versioning (parser vs normalization)

This spec only requires versioning fields that prevent silent mutation and support deterministic rebuilds:

- **`parser_version`** (mandatory on IR): identifies the extractor that produced IR from snapshot+fragments.
- **Normalization / mapping versions** (mandatory downstream): normalized/display records MUST record the versions of transformation rules applied (e.g., normalization, transliteration, POS mapping). See `shared/specs/provenance.md` (`derivation.rule_versions`).

Do not overload `parser_version` to mean "normalization version": they change for different reasons and must be recorded independently.

IR MUST be "rerunnable":

- Re-parsing the same snapshots with a new parser version produces a new IR set (new `parser_version`) without mutating old IR.

## Removal/disablement requirements

Design requirement: if a source needs to be disabled or removed:

- We must be able to identify all affected IR and normalized records via:
  - `source_id`
  - `snapshot_id` (and/or `url`)
- We must be able to exclude them from:
  - future normalization builds
  - offline bundles on the next release

## Human-in-the-loop corrections (editorial layer)

This spec stops at capture + IR, but it MUST be explicit about mutability boundaries:

- Raw snapshots are immutable.
- IR is immutable once written (new parser versions produce new IR; old IR is preserved).
- Human/editorial changes MUST be stored as **separate override/correction records** that reference a target record + scope; they MUST NOT mutate snapshot, fragment, IR, or normalized base records in place.

This prevents "just edit the DB row" drift and preserves auditability/rollback.

### Minimal correction record schema (required)

Any correction/override record MUST include:

- `correction_id`
- `target_id` (what record is being overridden)
- `target_scope` (e.g., `entry` | `sense` | `example` | `form`)
- `patch_payload` (the changes; format is pinned below)
- `editor_id` (may be `"system"` for automated overrides)
- `review_status` (`pending` | `approved` | `rejected`)
- `created_at` (ISO-8601)

It MAY include `reason_code` and optional evidence pointers (bbox/screenshot/audio).

#### `patch_payload` format (pinned)

To avoid "two valid interpretations," `patch_payload` MUST be an **RFC 6902 JSON Patch** payload:

- `patch_payload` is an array of operations (`add`, `remove`, `replace`, etc.)
- each operation MUST include `op` + `path`, and `value` when required by RFC 6902

If a correction targets a record scope (`entry`/`sense`/`example`/`form`), the JSON Patch `path` MUST be interpreted relative to the JSON object representing that scope.

---

## Extension: books (PDFs + scans) as sources (Phase 1 compatible)

Snapshots are not only HTML. Support multiple snapshot kinds:

- `snapshot_kind`: `html` | `pdf` | `image_scan` | `text_file`

Fragment locator extensions:

### PDF fragments

Use:

- `page_number`
- `bbox` (x, y, w, h; see bbox conventions below)
- optional: `pdf_text_quote` (when the PDF has a text layer)

### Scanned image fragments

Use:

- `page_index` (or `image_id`)
- `bbox`
- optional: `ocr_text_quote` (only if OCR is performed)

### `bbox` conventions (normative)

To avoid ambiguity in highlighting and fragment comparison, `bbox` MUST follow these rules:

- **Origin**: top-left of the page/image
- **Units**: normalized floats in the range \([0, 1]\), relative to the full page/image width/height
- **Reference space**: full page/image (not a cropped subregion). If a crop is applied, record the crop explicitly alongside the locator (implementation-defined).
- **Rotation**: locators SHOULD be expressed in a normalized "upright" orientation. If the underlying page/image is rotated, record `rotation_degrees` (one of `0`, `90`, `180`, `270`) and compute `bbox` in the upright coordinate space.

### OCR stance (important)

OCR output is **not raw evidence**. Treat OCR as a **derived artifact**:

- derived from a specific snapshot/page/bbox
- stamped with `ocr_engine` + `ocr_version`
- produces its own IR units so OCR can be re-run later without corrupting lineage

#### OCR-derived IR units (required shape)

If OCR is performed, the OCR output MUST be represented as IR units that:

- include `source_id`, `parser_version`, and normal IR provenance fields
- include `ocr_engine` and `ocr_version`
- reference the underlying evidence fragment (snapshot + page + bbox) in `evidence[]`

---

## Normative examples

These are intentionally concrete; they are here to prevent "two correct interpretations."

### Example A: HTML lexicon page with entries → IR units

Snapshot metadata:

```json
{
  "snapshot_id": "a7b3c9d2e1f04567",
  "source_id": "src_malipense",
  "snapshot_kind": "html",
  "url_canonical": "https://www.mali-pense.net/emk/lexicon/a.htm",
  "url_canonicalization_version": "urlcanon_v1",
  "retrieved_at": "2026-01-22T04:27:47Z",
  "http_status": 200,
  "content_type": "text/html; charset=utf-8",
  "content_sha256": "487846e7fb73de88...",
  "byte_length": 217276
}
```

IR unit for entry `e15` (ábadàn):

```json
{
  "ir_id": "f8a2b1c3d4e56789",
  "ir_kind": "lexicon_entry",
  "source_id": "src_malipense",
  "parser_version": "malipense_lexicon_v1",
  "evidence": [{
    "source_id": "src_malipense",
    "snapshot_id": "a7b3c9d2e1f04567",
    "entry_block": {
      "start_selector": "span#e15",
      "end_selector": "span#e16"
    },
    "text_quote": "ábadàn"
  }],
  "record_locator": {
    "kind": "source_record_id",
    "url_canonical": "https://www.mali-pense.net/emk/lexicon/a.htm",
    "source_record_id": "e15",
    "anchor_names": ["ábadàn", "abadan"]
  },
  "fields_raw": {
    "headword_latin": "ábadàn",
    "headword_nko_provided": "ߤߓߊߘߊ߲߫",
    "anchor_names": ["ábadàn", "abadan"],
    "ps_raw": "adv jamais",
    "pos_hint": "adv",
    "senses": [
      {
        "sense_num": 1,
        "gloss_fr": "jamais",
        "gloss_en": "never",
        "gloss_ru": "никогда́",
        "examples": [
          {
            "text_latin": "wùlu` ní ɲàari` té díya hábadan",
            "text_nko_provided": "ߥߎ߬ߟߎ ߣߌ߫ ߢߊ߰ߙߌ ߕߋ߫ ߘߌߦߊ߫ ߤߓߊߘߊ߲߫",
            "trans_fr": "le chien et le chat ne seront jamais en bonnes relations",
            "trans_en": "a dog and a cat will never live in peace",
            "source_attribution": "[Diane Mamadi]"
          }
        ]
      },
      {
        "sense_num": 2,
        "gloss_fr": "toujours, pour toujours",
        "gloss_en": "always, for ever",
        "gloss_ru": "всегда́, навсегда́"
      }
    ],
    "variants_raw": ["hábadan", "hábada", "háyibadan"]
  },
  "parse_warnings": []
}
```

### Example B: French index mapping → IR unit

```json
{
  "ir_id": "b2c3d4e5f6a78901",
  "ir_kind": "index_mapping",
  "source_id": "src_malipense",
  "parser_version": "malipense_index_v1",
  "evidence": [{
    "source_id": "src_malipense",
    "snapshot_id": "c9d8e7f6a5b43210",
    "css_selector": "tr:has(span.IxFr:contains('abandonner'))",
    "text_quote": "abandonner"
  }],
  "record_locator": {
    "kind": "url_canonical+entry_index",
    "url_canonical": "https://www.mali-pense.net/emk/index-french/a.htm",
    "entry_index": 35
  },
  "fields_raw": {
    "source_term": "abandonner",
    "source_lang": "fr",
    "target_entries": [
      {"lexicon_url": "../lexicon/b.htm", "anchor": "e504", "display_text": "bàn"},
      {"lexicon_url": "../lexicon/b.htm", "anchor": "e1096", "display_text": "bìla"},
      {"lexicon_url": "../lexicon/b.htm", "anchor": "e1423", "display_text": "bólokà"},
      {"lexicon_url": "../lexicon/k.htm", "anchor": "e5194", "display_text": "kɔ́n"},
      {"lexicon_url": "../lexicon/l.htm", "anchor": "e5589", "display_text": "lábìla"},
      {"lexicon_url": "../lexicon/l.htm", "anchor": "e5650", "display_text": "láfìli"}
    ]
  },
  "parse_warnings": []
}
```

### Example C: PDF fragment + derived OCR IR

PDF snapshot metadata:

```json
{
  "snapshot_id": "snap_pdf_001",
  "source_id": "src_some_book",
  "snapshot_kind": "pdf",
  "url": "file:///imports/some_book.pdf",
  "retrieved_at": "2026-01-04T12:34:56Z",
  "content_type": "application/pdf",
  "content_sha256": "...",
  "byte_length": 987654
}
```

Derived OCR IR unit:

```json
{
  "ir_id": "ir_ocr_12_0",
  "ir_kind": "lexicon_entry",
  "source_id": "src_some_book",
  "parser_version": "ocr_pipeline_v1",
  "ocr_engine": "tesseract",
  "ocr_version": "5.x",
  "evidence": [{
    "source_id": "src_some_book",
    "snapshot_id": "snap_pdf_001",
    "page_number": 12,
    "rotation_degrees": 0,
    "bbox": { "x": 0.10, "y": 0.25, "w": 0.80, "h": 0.10 }
  }],
  "record_locator": {
    "kind": "page+bbox+block_index",
    "page_number": 12,
    "bbox": { "x": 0.10, "y": 0.25, "w": 0.80, "h": 0.10 },
    "block_index": 0
  },
  "fields_raw": {
    "ocr_text": "..."
  },
  "parse_warnings": []
}
```

---

## Changelog

### v1.1 (2026-01-26)

- Added `ir_kind` discriminator for document type (lexicon_entry, index_mapping, metadata_page)
- Made `ir_id` computation normative and collision-safe (requires url_canonical)
- Removed `retrieved_at` and `source_name` from IR units (join instead)
- Required `url_canonical` on all `record_locator` kinds for global uniqueness
- Added `anchor_names` field to `record_locator` for human-friendly lookups
- Required evidence pointers to cover full entry block, not just headword
- Added `fields_raw` extraction rules (conservative, literal extraction)
- Distinguished "provided" vs "generated" forms (e.g., `headword_nko_provided`)
- Added `fields_raw` schemas by `ir_kind`
- Updated normative examples for Mali-pense structure
