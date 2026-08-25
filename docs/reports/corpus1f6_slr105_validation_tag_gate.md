# CORPUS1F6 — SLR105 Validation-Tag Gate

## 1. Decision

**CORPUS1F6_SLR105_VALIDATION_TAG_GATE_BLOCKED**

Acquisition recommendation:

**SLR105_VALIDATION_METADATA_INACCESSIBLE**

Reason: clip-level validation tags cannot be inspected from official sources
without acquiring the ~16 G radio archive (or an equivalent unofficial copy,
which this gate forbids). Aggregate Maninka tag incidence is documented in
project notebooks, but that is **not** a substitute for reproducible clip IDs.

## 2. Base commit

```text
fad56f1288b2cee82e3d21bc9bfe844b962165e2
```

(CORPUS1F5: `Record SLR105 lexical yield audit`)

## 3. Metadata sources inspected

| Source | What was inspected |
|--------|--------------------|
| https://openslr.org/105/ | Resource description; license; single download artifact |
| https://www.openslr.org/resources/105/ | Directory listing (`about.html`, `info.txt`, **only** the ~15–16 G `.tgz`) |
| https://www.openslr.org/resources/105/info.txt | Package name + alternate S3 URL |
| https://github.com/mdoumbouya/nicolingua | README; no published `metadata.csv` |
| Official notebooks (`002_…`, `003_multilabel_…`) | Annotation loader schema + embedded aggregate tag stats |
| `html/js/tag-editor.jsx` / tag-editor HTML | Tag-category UI (taxonomy hints) |
| Doumbouya et al. 2021 (paper / arXiv 2104.13083) | Validation-set prose; LID subset construction |
| NicoLingua S3 object headers | Confirms ~16.3 GB gzip+tar object; Accept-Ranges present |

**Not used:** unofficial mirrors, guessed filenames, or inferred labels from WAV
names.

## 4. Validation metadata artifact identity

| Field | Status |
|-------|--------|
| Exact official OpenSLR sidecar filename | **UNKNOWN / NOT PUBLISHED separately** |
| Experimenter path referenced in official notebooks | **VERIFIED path string:** `/media/xtrem/data/experiments/nicolingua-0001-language-id/language-id-annotations/metadata.csv` (local machine path in repo notebooks — **not** a downloadable URL) |
| Format (from notebook loaders) | **VERIFIED schema expectation:** CSV with at least `file`, `tags` columns; tags semicolon-separated |
| Clip identifier field | **VERIFIED name:** `file` (relative audio path/name in their experiment layout) |
| Tag representation | **VERIFIED:** multi-tag strings e.g. `ct-speech;lng-maninka;spkr-single` |
| Multi-language per clip | **VERIFIED possible:** multi-label taxonomy; multilingual utterance tags exist |
| Speaker-count tags | **VERIFIED vocabulary:** `spkr-single`, `spkr-multi` / `spkr-mult` |
| Telephone / noise / music tags | **VERIFIED vocabulary:** `ct-telephone`, `ct-noise`, `ct-fg-music` / `ct-tr-music`, `ct-bg-music`, etc. |
| Relationship metadata ID → OpenSLR archive audio path | **UNKNOWN** without archive inspection |

## 5. Metadata accessibility without 16G download

**NO — not for clip-level inspection.**

Findings:

1. OpenSLR resource **105** exposes only the large archive (+ tiny `about.html` /
   `info.txt`). No validation CSV/JSON sidecar is listed.
2. NicoLingua GitHub does **not** ship `metadata.csv`.
3. Hugging Face search for nicolingua / west-african-radio datasets returned no
   separate official tag release.
4. Bounded probe: streamed the first **50 MiB** of the official S3 `.tgz`
   (gzip+tar), decompressed headers looking for `meta` / `valid` / `annot` /
   `tag` / `csv` / `json` / `readme` / `txt` members → **0 hits** before the
   compressed window ended. Early archive content appears to be audio payload,
   not a small leading metadata member.
5. Full sequential gzip extraction to hunt for `metadata.csv` later in the
   archive would risk multi-gigabyte download — treated as **full-archive
   acquisition**, which this gate forbids.

## 6. Schema / tag structure (verified from official notebooks)

Expected loader behavior (official code):

```text
CSV DictReader
→ row['file']
→ row['tags'].split(';') → tag set
```

Documented tag classes used in multilabel notebook taxonomy (examples):

| Group | Example tags |
|-------|----------------|
| Language | `lng-maninka`, `lng-french`, `lng-pular`, `lng-susu`, `lng-koniaka`, `lng-guerze`, `lng-arabic`, `lng-unknown` |
| Speakers | `spkr-single`, `spkr-multi`/`spkr-mult`, `spkr-male`, `spkr-female` |
| Content | `ct-speech`, `ct-song`, `ct-laughter`, `ct-telephone`, `ct-noise` |
| Music | `ct-fg-music`/`ct-tr-music`, `ct-bg-music` |
| Utterance | `utt-verbal-nod`, `utt-multi-lingual`, … |

**Do not collapse** Maninka with Mandinka/Bambara/Koniaka/Kono. Only
`lng-maninka` counts as Maninka for this gate.

## 7. Total validation rows

**300** — verified in OpenSLR prose, paper, and notebook aggregate table header
(“out of 300”).

Per-row CSV itself: **not accessible** without the archive.

## 8. Explicit Maninka clip count

### Aggregate only (not clip IDs)

From official notebook
`notebooks/003_multilabel_speech_attribute_classification.ipynb` **stored
output table**:

| Class | Tag | Instances (out of 300) |
|-------|-----|------------------------:|
| Maninka Language | `lng-maninka` | **123** |

Interpretation:

- **VERIFIED aggregate:** 123 validation clips carry the `lng-maninka` tag
  (multi-label; may co-occur with other languages/noise/music tags).
- **NOT verified here:** the 123 filenames / OpenSLR member paths.

### Paper secondary evidence (not a substitute for the CSV)

LID experiment selected clips where spoken languages include **exactly one** of
Maninka, Susu, or Pular, **28 per language** (84 total). That implies the
authors could identify **≥28** Maninka-exclusive (among those three) speech
clips historically — still **without** releasing those IDs in this gate’s
accessible materials.

## 9. Maninka-only count

**UNKNOWN** (requires per-clip tag sets).

Cannot compute “Maninka and no other `lng-*`” without the CSV.

## 10. Maninka multilingual count

**UNKNOWN** (requires per-clip tag sets).

Aggregate multilingual utterance tag incidence (all languages): **59** clips with
`utt-multi-lingual` / related tags (notebook table) — **not** Maninka-specific.

## 11. Co-occurring language labels

**UNKNOWN at Maninka-clip granularity.**

Language aggregates from the same official table (all validation clips):

| Tag | Count / 300 |
|-----|------------:|
| `lng-maninka` | 123 |
| `lng-french` | 73 |
| `lng-unknown` | 54 |
| `lng-susu` | 41 |
| `lng-pular` | 34 |
| `lng-koniaka` | 19 |
| `lng-guerze` | 13 |
| `lng-arabic` | 11 |

These are **not mutually exclusive**.

## 12. Speaker-tag breakdown

### All validation clips (aggregate)

| Tag class | Count / 300 |
|-----------|------------:|
| `spkr-single` | 108 |
| `spkr-multi` / `spkr-mult` | 160 |

### Maninka-tagged subset

**UNKNOWN** without join to `lng-maninka` rows.

## 13. Noise / music / telephone breakdown

### All validation clips (aggregate)

| Tag class | Count / 300 |
|-----------|------------:|
| `ct-speech` | 216 |
| `ct-song` | 95 |
| `ct-fg-music` / `ct-tr-music` | 104 |
| `ct-bg-music` | 64 |
| `ct-noise` | 57 |
| `ct-telephone` | 55 |
| `ct-laughter` | 31 |
| `utt-verbal-nod` | 100 |

### Maninka-tagged subset

**UNKNOWN**.

## 14. Duplicate / repetition metadata findings

**Cannot assess** without clip IDs / file paths.

No candidate list → no duplicate-ID screen.

## 15. Tier A / B / C counts

| Tier | Count |
|------|------:|
| A | **0 computed** (metadata insufficient) |
| B | **0 computed** |
| C | **0 computed** |

Tiers remain defined for a future gate once `metadata.csv` (or equivalent
official sidecar) is obtainable:

- **A:** `lng-maninka`; no other `lng-*` if represented; `spkr-single`; no
  foreground music/noise tags when present
- **B:** Maninka with one complication (multilingual, telephone, background
  noise, …)
- **C:** Maninka with major friction (strong music/noise, multi-speaker, …)

## 16. Candidate manifest location

**Not created.**

Creating IDs without authoritative per-clip tags would invent evidence.

## 17. Selected candidate IDs count

**0**

## 18. Selection rationale

Pilot selection is **downstream of evidence quality**. Aggregate “123 Maninka
tags exist” is encouraging potential, but SiraLex cannot responsibly pick 10–20
clip IDs, avoid duplicates, or tier difficulty without the validation CSV (or
equivalent official clip-level export).

## 19. Metadata→audio identity confidence

**LOW / UNVERIFIED for pilot acquisition.**

Known: notebooks used a `file` column pointing at experimenter-local audio
paths under a `language-id-annotations` layout.

Unknown: exact mapping from those names to members inside
`nicolingua-0003-west-african-radio-corpus.tgz`.

## 20. Language-authority boundary

Even when `lng-maninka` is present, it remains:

```text
dataset/reviewer language evidence
≠
SiraLex final Guinean Maninka variety determination
```

Future source/segment rows must preserve claimed vs assessed language
provenance and allow `language_identity_uncertain`, code-switching, and
multiple languages.

## 21. Segmentation rule for future audio pilot

No segments created in CORPUS1F6.

When audio eventually exists:

```text
listen / inspect each selected 30s clip
→ IF entire clip = one coherent bounded evidence unit
     → whole_artifact MAY be justified
→ ELSE
     → create exact time-bounded segment(s)
→ transcript annotations attach only to those units
```

Do **not** decide this from metadata alone. Do **not** default 30s radio clips
to `whole_artifact` as a missing-bounds convenience.

## 22. Lexical-yield hypothesis

```text
HIGH LEXICAL-DIVERSITY POTENTIAL — NOT YET MEASURED
```

123/300 Maninka tags (aggregate) supports the hypothesis that tagged radio
validation is richer than SLR106’s closed VA set, but **actual distinct
lexical/phrase yield per reviewed minute remains unmeasured** until manual
transcription of identifiable clips.

## 23. Rights posture

Unchanged from CORPUS1F5: SiraLex **audit posture** under claimed CC BY-SA 4.0
for internal pilot use; not a legal determination; license ≠ publication
approval.

## 24. ELAN decision

**ELAN_DECISION_REQUIRES_REAL_PILOT** (unchanged)

Metadata inspection cannot establish transcription UI friction.

## 25. Stop conditions encountered

- **Triggered:** validation tags cannot be inspected without full-archive-scale
  acquisition.
- Not triggered (yet): Maninka identity too weak in principle — aggregates
  suggest Maninka is frequent (`lng-maninka` = 123/300) **if** the notebook
  table is accepted as faithful to the inaccessible CSV.

## 26. Recommended next action

1. **Do not** download the full ~16 G archive solely to discover tag counts.
2. Prefer an **official small sidecar release** (or documented extraction recipe
   limited to the validation annotation folder) from OpenSLR / NicoLingua
   maintainers.
3. Only after clip-level `file` + `tags` are available:
   - compute Maninka-only vs multilingual
   - tier A/B/C
   - write `data/corpus1f6/slr105_validation_candidate_manifest.csv`
   - select ≤10–20 IDs without quota-filling
4. Keep SLR106 closed for vocabulary expansion.
5. Still no transcription / ELAN / ASR / dictionary promotion in this gate.

## 27. Files added / modified

Added (tracked, uncommitted):

- `docs/reports/corpus1f6_slr105_validation_tag_gate.md`

## 28. Local / gitignored artifacts

None created (no manifest without IDs).

Temporary research probes only (not retained as project data): ≤50 MiB ranged
fetch discarded after header scan.

## 29. git diff --check

PASS expected (see final return).

## 30. Working tree

CORPUS1F6 report left **uncommitted**.  
`web/scripts/` untouched. No schema/runtime/dictionary mutation. No audio
acquired.
