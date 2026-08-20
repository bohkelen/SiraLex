# CORPUS1A — Maninka Corpus Acquisition, Validation, and Tooling Audit

## 1. Decision

```text
CORPUS1A_CORPUS_ACQUISITION_VALIDATION_TOOLING_AUDIT_COMPLETE
```

Audit / design / research only. No corpus pipeline implementation. No tool
installation, dataset download, media acquisition, scraping, schema files,
fixtures, scripts, UI, APIs, migrations, or dictionary/runtime mutation.

---

## 2. Base commit

```text
feb36e57a28bbf4365dfc712dec233a5251f7973
```

`git log -1`: `feb36e5 Define governed alias append write contract`.

Working tree at audit start (unrelated to CORPUS1A):

```text
?? docs/reports/lx1a_learning_experience_audit.md
?? web/scripts/
```

---

## 3. Executive conclusion

SiraLex already has a strong **published-dictionary authority chain**
(immutable bundles, approved-only aliases/supplements, CF1/CF2 as non-truth
evidence, Learning as personal overlay, fail-closed regression). What it lacks
is a governed path from **real Maninka/Malinké language material** to
**reviewed corpus evidence** and then to **product candidates** — without
collapsing those stages into dictionary truth.

**PROPOSED** CORPUS1 architecture:

```text
source registry
  → captured/versioned artifact (URL ≠ identity)
  → segment
  → transcript / translation / annotation (method-tagged)
  → validation (confidence ≠ review ≠ promotion)
  → product candidate
  → artifact-specific governance (AL1 / corrections / lexical IR)
  → deterministic build / regression / immutable publish
```

Mature media and annotation tools should be **reused or interoperated with**.
SiraLex should **build** only provenance, rights usage matrices, authority
boundaries, review governance, candidate extraction, and dictionary promotion
integration.

Highest-value existing resources for later evaluation (not downloaded here):

| Priority | Resource | Why |
|----------|----------|-----|
| 1 | OpenSLR SLR106 (NicoLingua VA ASR) | Explicit Guinean Maninka labeled utterances; CC BY-SA 4.0 |
| 2 | OpenSLR SLR105 (NicoLingua radio) | Guinea radio; Maninka among many languages; noisy; LID/ASR research |
| 3 | ELAN + EAF interchange | Offline audio/video annotation standard for pilot |
| 4 | SimbaBench `asr_test_mlq` | Western Maninkakan ASR eval config |
| 5 | Orange SSA-HuBERT | Pretrain includes Maninkakan (`mwk`); representation/LID research |

**Do not** treat Bambara/Jula datasets, MMS Mandinka (`mnk`), or Whisper output
as Guinean Maninka dictionary evidence without explicit variety assessment.

---

## 4. Why corpus now

**OBSERVED** track state (reports / contracts):

| Track | State | Evidence |
|-------|-------|----------|
| SQ1 | CLOSED | Search-intelligence track closed |
| AL1D1–D6 | CLOSED (contracts/tooling) | `docs/reports/al1d*.md`; write CLI AL1D7 deferred |
| AL1 | PAUSED pending real failed-search evidence | `docs/reports/lx1a_learning_experience_audit.md` |
| LX1A | COMPLETE; learning expansion paused | same |
| Lexical content | Strategic backlog (“corpus program”) | `docs/reports/pd0_*.md`, `pd1_*.md` |

Structural reason:

```text
search improvements improve access to existing knowledge
aliases map alternative forms to existing knowledge
neither creates missing linguistic knowledge
```

CORPUS1 is the governed acquisition track for **new language evidence**,
aligned with existing provenance doctrine
(`shared/specs/provenance.md`, `.cursor/rules/highest-value-rules.mdc`).

---

## 5. Repository evidence inspected

### OBSERVED paths (non-exhaustive; authority-relevant)

| Path | Establishes |
|------|-------------|
| `shared/specs/offline-bundle-versioning.md` | Bundle identity / immutability |
| `shared/specs/siralex-bundle-package-v1.md` | `.siralex.zip` transport |
| `shared/specs/provenance.md` | Mandatory provenance at entry/sense/example |
| `shared/specs/source-registry.md` | Dictionary source registry contract |
| `shared/specs/source-alias-table-v1.md` | Alias authority; approved-only index effect |
| `shared/specs/source-index-supplement-v1.md` | Supplement authority |
| `shared/specs/source-phrase-alias-v1.md` | Phrase alias (spec; apply unwired) |
| `shared/aliases/source_aliases_v1.jsonl` | Tracked alias table |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Tracked supplements |
| `docs/BUILD_BUNDLE.md` | Enrich → index → bundle → verify → package → catalog |
| `docs/BUNDLE_DISTRIBUTION.md` | Publish expectations |
| `api/bundle_builder/` | Deterministic build; copy-only assembly |
| `api/source_aliases/` | Validate + apply approved aliases |
| `api/source_index_supplements/` | Generate/merge supplements |
| `api/search_regression/` | Python regression replay |
| `web/src/idb/siralex_db.ts` | IndexedDB store boundaries |
| `web/src/install/bundle_install.ts` | Staging / `storage_scope_id` |
| `web/src/search/search_query.ts` | Lookup ladder invariants |
| `web/src/corrections/` | CF1 drafts/packages |
| `web/src/search_feedback/` | CF2 drafts/packages |
| `web/src/learning/` | Learning overlay |
| `web/src/aliases/` | AL1D1–D5 tooling |
| `docs/reports/al1a_*.md` … `al1d6_*.md` | Alias governance chain |
| `docs/reports/cf1d0_*.md`, `cf2d0_*.md` | Feedback vs corpus truth |
| `docs/reports/lx1a_learning_experience_audit.md` | Learning vs dictionary |
| `docs/reports/pd0_*.md`, `pd1_*.md` | “Corpus program” as strategic track |
| `.cursor/rules/highest-value-rules.mdc` | No third-party data in git by default; provenance; offline-first |

### External research (documentation only; no downloads)

OpenSLR SLR105/106 pages; NicoLingua paper PDF; Simba / SimbaBench docs;
Orange SSA-HuBERT HF cards; AfriSpeech / Africa Corpus Builder; An ka taa
Manding tech survey; Google USM; tool project pages (ELAN, FLEx, SayMore,
Label Studio, WhisperX, MFA, FFmpeg, yt-dlp, Praat, Tesseract, OCRmyPDF);
VOXcommons project page; related Manding ASR datasets (Jeli-ASR,
Koumankan4Dyula, Common Voice Dioula, African Next Voices Bambara).

---

## 6. Current SiraLex authority/data boundaries

### 6.1 Published dictionary authority (OBSERVED)

```text
bundle_id          = logical product line (continuity)
content_sha256     = immutable payload identity
storage_scope_id   = bundle_id::content_sha256
update_mode        = REPLACE_ALL (v1)
```

Consumer artifacts: `bundle.manifest.json`, `records.jsonl`,
`search_index.jsonl`, `checksums.sha256`. Catalog:
`web/public/catalog.json`.

**Invariant:** new content ⇒ new `content_sha256`; published directories are not
silently rewritten.

### 6.2 Reviewed search-config artifacts (OBSERVED)

| Artifact | Role | Becomes searchable when |
|----------|------|-------------------------|
| `source_aliases_v1.jsonl` | Search aliases | `status: approved` + validate + apply + rebuild |
| `source_index_supplements_v1.jsonl` | Additive mappings | approved + generate/merge + rebuild |
| `source_phrase_aliases_v1.jsonl` | Phrase aliases | **MISSING / pipeline unwired** |

Aliases augment **`search_index` only**; they do not mutate `records.jsonl`
lexical content.

### 6.3 Evidence that is not dictionary truth (OBSERVED)

| System | Store / package | Authority label pattern |
|--------|-----------------|-------------------------|
| CF1 | `correction_drafts` / `siralex_correction_feedback_v1` | unreviewed suggestions; not auto-applied |
| CF2 | `search_failure_feedback` / `siralex_search_feedback_v*` | miss demand; not missing-entry truth |
| AL1 dry-run / candidate append | preview / `candidate` rows | not searchable until approval + build |
| Learning | `learning_records` | personal overlay; never mutates publish path |
| Query logs / regression matrix | telemetry / QC | not demand; not auto-mined into corpus |

### 6.4 How reviewed data becomes published (OBSERVED)

```text
approved tracked config / IR / corrections
  → fail-closed validate + apply
  → records + search_index
  → siralex-build-bundle verify
  → immutable publish + catalog
  → IndexedDB install under storage_scope_id
```

### 6.5 What CORPUS1 must integrate with later (PROPOSED interfaces)

| Downstream SiraLex system | CORPUS1 may feed via |
|---------------------------|----------------------|
| Lexical IR / enrich path | product candidates for new headwords/senses/examples after separate governance |
| AL1 alias table | orthographic/search-form candidates (still candidate-only first) |
| Supplements | only if evidence justifies additive mapping (rare for raw speech) |
| CF2 triage | content-gap prioritization signals (not auto-entries) |
| CF1 / Phase 1.5 corrections | only when corpus contradicts published entry under correction governance |
| Search regression | optional new matrix rows after linguistic review — never auto-mined |
| Learning | optional future learning assets — never as lexical truth |

**Hard boundary CORPUS1 must not weaken:** corpus evidence ≠ published
dictionary truth; machine transcript ≠ orthography authority; AI suggestion ≠
approved language data.

---

## 7. Source acquisition taxonomy

**PROPOSED.** Each category is assessed for likely use; none is assumed
suitable for all product assets.

| Category | Linguistic value | Noise | Speaker/context | LID difficulty | Transcription difficulty | Provenance | Rights uncertainty | Likely useful for |
|----------|------------------|-------|-----------------|----------------|--------------------------|------------|--------------------|-------------------|
| `owned_recording` | High if designed | Controllable | High if known | Lower | Lower–medium | High | Lower if owned + consent | examples, pronunciation, phrases, headword attestation |
| `permissioned_recording` | High | Controllable | High if documented | Lower | Lower–medium | High | Medium until documented | same as owned |
| `public_video` | Medium–high | High (music, overlap) | Often weak | High (Manding mix) | High | Medium (URL changes) | High | search-gap, weak reference, phrases if reviewed |
| `public_audio` | Medium–high | High | Variable | High | High | Medium | High | same |
| `film_or_movie` | Medium (scripted + dialect) | Dialogue mix, FX | Characters ≠ speakers | High | High | Medium | Very high | weak/reference only until rights cleared |
| `radio` | High for Guinea speech ecology | Music, calls, noise | Often multi-speaker | High | High | Medium–high if archive known | Medium–high | LID, ASR eval, phrases with heavy review |
| `interview` | High | Medium | Often identifiable | Medium | Medium | High if owned | Consent-critical | examples, senses, phrases |
| `sermon` | Medium–high (register) | Reverb, chant | Single speaker common | Medium | Medium | Variable | Rights + sensitivity | phrases, register notes; careful publication |
| `speech` | Medium–high | Variable | Often named | Medium | Medium | Variable | Rights | examples, orthography |
| `oral_history` | Very high | Age/noise | Rich metadata possible | Medium | Medium–high | High if archived | Consent/archive terms | senses, phrases, cultural notes |
| `subtitle_or_existing_transcript` | High as bootstrap | Alignment errors | May not match audio | Medium | Lower (text exists) | Medium | Rights on both A/V + text | draft transcripts; never auto-truth |
| `book_or_pdf` | High for orthography/lexicon | OCR noise | N/A | Low–medium (variety labels) | OCR + layout | High if edition known | Copyright | headwords, senses, examples (text) |
| `other_text` | Variable | Variable | N/A | Variable | Variable | Variable | Variable | case-by-case |
| `future_user_submission` | Potentially high | Uncontrolled | Often incomplete | High | High | Must be designed | Consent + rights critical | only after intake governance |

**PROPOSED rule:** usefulness for **dictionary publication** is orthogonal to
usefulness for **ASR/LID benchmarking**. Radio corpora may be excellent for
the latter and weak for the former until rights + review clear excerpts.

---

## 8. Source registry architecture

### 8.1 Relation to existing dictionary Source Registry (OBSERVED)

`shared/specs/source-registry.md` already defines dictionary-ingestion
`source_id`, license claims, redistribution, takedown. CORPUS1 needs a
**parallel or extended** contract for multimedia/language evidence sources —
not a silent overload of dictionary source rows without schema clarity.

**PROPOSED:** `corpus_sources_v1` as a distinct conceptual registry that may
later share ID namespace conventions with dictionary sources, but must not
imply that a corpus source is a published lexicon source.

### 8.2 Recommended contract fields (PROPOSED)

**Identity / discovery**

- `source_id` (stable internal)
- `source_type` (taxonomy §7)
- `platform` (optional: radio, youtube, local_disk, archive, …)
- `source_locator` (where found — URL, call number, path template)
- `title`, `creator_or_channel`
- `collected_at`

**Language claims (never collapse)**

- `claimed_language`, `claimed_language_by`
- `assessed_language`, `assessment_method`, `assessment_confidence`, `assessed_by`
- `region_claim`, `speaker_origin_claim`, `dialect_or_variety_claim`

**Descriptive**

- `duration_or_page_count`, `speaker_count_if_known`
- `media_quality`, `background_noise_or_music`
- `notes`

**Integrity (source ≠ capture)**

- `source_version_or_revision` (publisher revision if known)
- Do **not** put `source_content_hash` only on the registry row if content is
  mutable online — prefer capture-layer hashes (§9)

**Rights**

- Link to rights record (§10), not a single risk enum
- `rights_review_status`, `permission_evidence_ref`, `attribution_required`,
  `license_reference`, `rights_notes`

### 8.3 Provenance invariant

```text
URL ≠ immutable evidence identity
```

Registry stores **where it was found**. Capture layer stores **what was
actually observed**. Both are required for reproducibility.

### 8.4 Fields to drop or defer from the prompt list

| Field | Decision |
|-------|----------|
| Flat `legal_risk` | REJECT as sole rights model |
| `source_content_hash` on registry alone | DEFER to capture artifact |
| `local_artifact_reference_if_applicable` | Prefer capture layer + optional pointer |
| Exhaustive speaker demography | DEFER; keep optional metadata refs |

---

## 9. Source capture / versioning architecture

**PROPOSED:** yes — distinguish:

```text
corpus_sources_v1          (registry entry)
corpus_source_artifacts_v1 (captured/versioned artifact)
corpus_segments_v1         (spans within an artifact)
```

### Why capture layer is justified

| Concern | Without capture | With capture |
|---------|-----------------|--------------|
| Reproducibility | Broken if URL changes | Hash-addressed bytes |
| Deleted URLs | Evidence vanishes | Local/archive copy |
| Reprocessing | Ambiguous input | Same artifact → new pipeline version |
| Provenance chain | Locator-only | Locator + content hash + capture time |
| Rights | Hard to prove what was used | Exact artifact under review |
| Legal/takedown | Unclear scope | Disable artifact / segments by hash |

### Capture record fields (PROPOSED minimum)

- `artifact_id`, `source_id`
- `captured_at`, `capture_method`, `captured_by`
- `content_hash`, `byte_length`, `media_type`
- `storage_ref` (local/offline path or object key — **not** committed to git by default)
- `capture_tool` / `tool_version` if any
- `rights_snapshot_ref` (rights state at capture time)
- `notes`

**Rule (aligns with highest-value rules):** raw third-party corpora stay out of
git unless explicitly approved under a dedicated path.

---

## 10. Rights / usage architecture

**PROPOSED:** model **permissions per use**, not a single risk score.

### Rights basis states

```text
owned | permissioned | licensed | public_domain
reference_only | unknown | requires_review
```

Unknown must be representable. System states:

```text
UNKNOWN
REQUIRES_RIGHTS_REVIEW
PUBLICATION_BLOCKED
```

### Permission matrix dimensions (PROPOSED)

For each artifact/segment (inherit with override):

| Use | Allowed? |
|-----|----------|
| `internal_analysis` | yes / no / unknown |
| `local_storage` | … |
| `transcription` | … |
| `translation` | … |
| `corpus_storage` | … |
| `short_excerpt_storage` | … |
| `audio_redistribution` | … |
| `transcript_redistribution` | … |
| `dictionary_example_publication` | … |
| `pronunciation_publication` | … |
| `model_training` | … |
| `model_evaluation` | … |
| `commercial_redistribution` | … |

### Separation

```text
rights modeling  ≠  legal determination
```

CORPUS1 stores claims, evidence refs, and review status. Humans (or counsel
when needed) make determinations. Default for unknown publication uses:
**PUBLICATION_BLOCKED**.

---

## 11. Segment architecture

**PROPOSED:** `corpus_segments_v1`

### Core fields

- `segment_id`, `source_id`, `source_artifact_ref`
- Media span: `start_time`, `end_time` **or** `page_or_text_span`
- `speaker_label`, `speaker_metadata_ref_if_available`
- `languages_present` (list; may be empty/unknown)
- `audio_quality`, `background_noise`, `speaker_overlap`
- `segment_type`, `speech_context`
- Status stubs: `transcript_status`, `translation_status`, `validation_status`
- `notes`

### Required capabilities

| Case | Support |
|------|---------|
| Audio / video / text / subtitles | Yes via span type |
| Single / multiple / overlapping speakers | Yes; overlap flag + optional multi-label |
| Code-switching | `languages_present` multi-value + span-level language later |
| Uncertain language | Do **not** require `language = maninka` |

**REJECT:** treating `segment.language = maninka` as sufficient identity.

---

## 12. Transcript / translation / annotation architecture

**PROPOSED:** annotations are **versioned objects** attached to segments, never
silent overwrites of a single “the transcript” field.

### Annotation kinds

- `raw_transcript`
- `normalized_transcript`
- `translation_fr`, `translation_en`
- `gloss` / interlinear (optional later)
- `orthography_notes`, `reviewer_notes`
- `uncertain_spans` (see §13)

### Script

```text
Latin | N’Ko | Arabic-derived | mixed | unknown
```

**Invariant:** do not create authoritative N’Ko via model inference. N’Ko may
appear as observed surface form or as separately governed transliteration with
rule versions (`shared/specs/provenance.md` derivation model).

### Production metadata (required when machine-assisted)

```text
transcription_method
transcription_tool
model_name / model_version
created_by / created_at
reviewed_by / reviewed_at / review_method
```

Method vocabulary must distinguish at least:

```text
subtitle_import | asr | llm_assisted | researcher_manual
trusted_speaker | collaborative_review | unknown
```

Subtitle import, ASR, LLM, researcher, and trusted-speaker transcripts must
remain distinguishable forever.

---

## 13. Uncertainty representation

**PROPOSED:** combination of levels — not one transcript-wide float.

| Level | Role |
|-------|------|
| Segment | overall processability / overlap / noise |
| Transcript annotation | method confidence / review state |
| Token/span | local unknowns |

Example span model:

```text
uncertain_spans:
  - start / end (char or time)
  - surface_form
  - alternatives[]
  - confidence (optional ordinal)
  - reason
```

Example:

```text
N b'a taa [UNKNOWN] la sini.
```

**REJECT** relying only on a whole-transcript confidence number for promotion.

---

## 14. Language / variety identity architecture

**PROPOSED:** never collapse Manding varieties without evidence.

### Named varieties to keep distinct

| Label | Notes for SiraLex |
|-------|-------------------|
| Maninka / Guinean Maninka | Primary product target |
| Malinké | Often marketing/title label; may map to Maninka after assessment |
| Mandinka | Distinct (e.g. Senegambia); MMS `mnk` is Mandinka — not auto-Maninka |
| Bambara | Related; rich ASR resources — not interchangeable |
| Jula / Dioula | Related; Côte d’Ivoire / regional trade variety |
| Other Manding | Explicit `other` + free-text |

### Dual track

```text
claimed_language   (title, uploader, dataset label, speaker self-report)
assessed_language  (reviewer / expert / constrained LID — with method)
```

Preserve who/what made each claim. Example:

```text
video title says “Malinké”
≠
trusted reviewer identifies Guinean Maninka
```

Both are useful provenance. Ambiguous / code-switched / unknown must be
first-class.

**OBSERVED external labeling caution:** NicoLingua uses “Maninka”; SSA-HuBERT
lists “Maninkakan (`mwk`)”; SimbaBench uses Western Maninkakan (`mlq`); MMS
exposes Mandinka (`mnk`). These are **not** identical labels — map carefully.

---

## 15. Validation architecture

**PROPOSED:** three independent dimensions.

### A. Evidence confidence (ordinal, evidence-backed)

Recommended ladder:

```text
raw
machine_derived
reviewed
corroborated
strongly_triangulated
trusted_reviewer_confirmed
```

Prefer **ordinal + evidence list** over a single float (§16).

### B. Review status

```text
unreviewed | in_review | accepted | rejected | needs_more_evidence
```

### C. Promotion / publication status (product-facing)

```text
not_candidate | candidate | approved | published | rejected | deprecated
```

### Why separate

```text
High-confidence evidence does not automatically deserve publication.
Publication authority does not come from a confidence score.
```

A strongly triangulated utterance may still be `PUBLICATION_BLOCKED` on rights.
A published example may later be `deprecated` without rewriting history if
provenance is preserved.

---

## 16. Triangulation model

**PROPOSED:** confidence increases via **independent signals**, recorded as an
evidence list — not an automatic formula into dictionary truth.

### Signals

- multiple independent sources
- existing dictionary relationship
- consistent contextual meaning
- subtitle/translation agreement
- morphological / grammatical consistency (human-judged)
- different creator/source confirmation
- trusted speaker/reviewer confirmation

### Confidence encoding trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| Ordinal ladder | Matches AL1/review culture; fail-closed | Less granular |
| Numeric score | Easy to sort | False precision; promotes threshold abuse |
| Evidence-list only | Most honest | Harder to query |
| **Hybrid (recommended)** | Ordinal + linked evidence refs | Slightly more schema |

**REJECT:** `confidence >= X → publish`.

---

## 17. Corpus-to-product authority boundary

**PROPOSED authority chain:**

```text
reviewed corpus evidence
  → product candidate (typed)
  → artifact-specific review/governance
  → approved source/build artifact
  → deterministic build
  → regression validation
  → immutable publication
```

### Candidate types

```text
new_headword | new_sense | phrase | example_sentence
alias | content_gap_finding | pronunciation_audio
search_metadata | learning_asset
```

**Invariant:** no corpus evidence may directly mutate published dictionary
data, alias tables, or supplements. Promotion is always an explicit, typed
hand-off into existing governance (lexical IR / AL1 / corrections / etc.).

---

## 18. Product-specific promotion policies

**PROPOSED policies by artifact type** (guidance for later CORPUS1H; not
implemented).

| Artifact | Minimum evidence posture | Notes |
|----------|--------------------------|-------|
| Example sentence | Often: one clear, rights-cleared, reviewed utterance with translation | Still needs orthography review |
| New headword | Stronger: repeated attestation and/or trusted lexical source + orthography + sense | Frequency alone insufficient |
| New sense | Evidence of genuinely distinct meaning vs contextual noise | Compare existing senses |
| Phrase | Repeated or contextually strong attestation | Align with phrase-alias governance when search-facing |
| Alias | Prefer AL1/CF2 search-failure evidence + form relation | Corpus frequency alone weak |
| Pronunciation | One clear speaker ⇒ **example**, not universal norm | Multi-speaker later for variation notes |
| Learning asset | May reuse reviewed examples under Learning overlay rules | Never becomes lexicon truth |
| Content-gap finding | CF2 + corpus absence triangulation | Prioritization signal only |

---

## 19. Existing Tool / Project / Dataset Landscape

### 19.1 Executive findings

1. **Do not build a custom Corpus Workbench before schemas stabilize.**
   Prefer ELAN (or similar) → export → SiraLex importer.
2. **Guinea-specific open speech data exists** (NicoLingua SLR105/106) and is
   the highest-priority evaluation target for a later pilot — with rights and
   variety caveats.
3. **Related Manding ASR data is abundant for Bambara/Jula**, scarce for
   Guinean Maninka dictionary-quality spontaneous speech.
4. **Multilingual ASR (Whisper/MMS/USM) may assist drafts** but has unknown
   Guinean Maninka quality; treat as `machine_derived` only.
5. **SiraLex unique value** is provenance + authority + promotion — not VAD,
   FFmpeg, or generic labeling UIs.

### 19.2 Maninka / Guinea-specific resources

#### NicoLingua / OpenSLR (high priority)

| Resource | SLR105 West African Radio Corpus | SLR106 West African VA ASR Corpus |
|----------|----------------------------------|-----------------------------------|
| Publisher | Doumbouya et al. / OpenSLR | same |
| URL | https://openslr.org/105/ | https://openslr.org/106/ |
| Code | https://github.com/mdoumbouya/nicolingua | same |
| Paper | AAAI 2021 *Using Radio Archives…* | same |
| Geography | Six Guinean radio stations | Guinean speakers (VA task) |
| Languages labeled | French, Guerze, Koniaka, Kissi, Kono, **Maninka**, Mano, Pular, Susu, Toma (radio; multi) | French, **Maninka**, Pular, Susu |
| Volume | ~17,090 × 30s ≈ 142h (+ 300 tagged val clips) | 10,083 utterances; 49 speakers (16F/33M); ages 5–76 |
| Annotation | Mostly unlabeled; validation tags (language, noise, multi-speaker, …) | Labeled utterance classes (commands, digits, names, …) |
| License (OpenSLR) | **CC BY-SA 4.0** | **CC BY-SA 4.0** |
| Pilot suitability | LID/noise realism; weak for dictionary examples without heavy review | Strong for ASR/LID eval; limited lexical diversity (VA vocabulary) |
| Dictionary evidence | Mostly **weak / reference / speech-research** until excerpt rights + linguistic review | Possible **pronunciation / form** candidates for closed vocabulary; not general lexicon |
| CORPUS1A action | Document only — **do not download** | Document only — **do not download** |

**Lessons for CORPUS1:** found radio data is valuable but noisy; validation
tags for multi-speaker/music are essential; small-vocabulary labeled Maninka
exists; first ASR systems for Maninka were built from this stack — still not
orthographic authority.

#### Other Guinea / Maninka-adjacent

| Resource | Finding | Mode |
|----------|---------|------|
| SimbaBench `asr_test_mlq` (Western Maninkakan) | ASR eval config; small hours | BENCHMARK |
| Orange SSA-HuBERT | Pretrain includes Maninkakan `mwk` (~791h unlabeled in paper table) | BENCHMARK / LEARN_FROM |
| Google USM | Marketing/docs list Maninka among supported languages; public eval on Guinean Maninka **UNKNOWN** | INVESTIGATE_LATER |
| VOXcommons (Parsons DT 2026 page) | Participatory telephony corpus focused on Maninkakan / Guinea languages; project page describes collection+validation intent | INVESTIGATE_LATER (maturity/license/data access UNKNOWN) |
| MMS `facebook/mms-tts-mnk` | **Mandinka** TTS — not Guinean Maninka | LEARN_FROM / REJECT as Maninka substitute |

### 19.3 Tool landscape by pipeline stage

#### Compact decision table

| Tool / Project | Pipeline Role | Maninka Relevance | Offline/Local | License (reported) | Maturity | Integration Mode | Recommendation | Reason |
|----------------|---------------|-------------------|---------------|--------------------|----------|------------------|----------------|--------|
| ELAN | Manual A/V annotation | Language-agnostic | Yes (desktop) | GPL-3 | High | INTEROPERATE | Prefer for pilot | EAF standard; tiers for transcript/translation |
| SayMore / lameta | Field documentation + metadata | Agnostic | Yes | SIL OSS | Medium (SayMore maintenance caution; lameta metadata-focused) | LEARN_FROM / INTEROPERATE | Optional | Good workflow lessons; ELAN often enough |
| FieldWorks / FLEx | Lexicography / interlinear | Agnostic | Yes | Open source (SIL) | High | INTEROPERATE / DEFER | Later for interlinear lexicon bridge | Dictionary-oriented; not first A/V workbench |
| Label Studio | Generic labeling | Agnostic | Local or cloud | Apache-2.0 | High | WRAP / INVESTIGATE_LATER | Secondary | Strong automation hooks; less linguistic-tier native than ELAN |
| Praat | Phonetics / TextGrid | Agnostic | Yes | GPL-3 | High | INTEROPERATE | Specialty | Phonetic analysis; TextGrid interchange |
| FFmpeg | Media conversion | N/A | Yes | LGPL/GPL (build-dependent) | High | WRAP | Adopt as utility | Commodity media; rights-gated use |
| yt-dlp | Acquisition utility | N/A | Yes | Unlicense | High | WRAP (rights-gated) | Technical only | **Permission ≠ tool availability** |
| Audacity | Manual audio edit | N/A | Yes | GPL | High | LEARN_FROM | Optional human tool | Not core architecture |
| pyannote.audio | Diarization / VAD | Agnostic | Local+models | Model/tool licenses vary | High | WRAP / BENCHMARK | Later automation | Useful; not authority |
| OpenAI Whisper | ASR draft | Unknown Maninka quality | Local possible | MIT (code); model terms apply | High | BENCHMARK | Machine drafts only | No assumed Maninka fitness |
| faster-whisper | Faster Whisper runtime | Same | Local | MIT | High | WRAP | Same as Whisper | Infra convenience |
| WhisperX | ASR + align + diarize | Align models limited for Maninka | Local+HF | Project OSS; deps vary | High | BENCHMARK | Later | Alignment language coverage likely weak for Maninka |
| Montreal Forced Aligner | Forced alignment | Needs language models/dicts | Local | OSS (Kaldi-based) | High | INVESTIGATE_LATER | After orthography/lexicon models | Strong FA; Maninka acoustic models UNKNOWN |
| Meta MMS | Multilingual ASR/LID/TTS | Mandinka ≠ Maninka; LID wide | Local possible | Model cards / FAIR terms | High | BENCHMARK / LEARN_FROM | Eval only | Variety mismatch risk |
| Orange SSA-HuBERT | SSL representations | Maninkakan in pretrain | Local+HF | Check model card | Research | BENCHMARK | Research | LID/ASR finetune research |
| Google USM | Multilingual ASR | Claims Maninka | Cloud/product-oriented | Proprietary/service | High | INVESTIGATE_LATER | Non-authoritative | Access/eval path unclear for CORPUS1 |
| Tesseract | OCR | Script/lang packs | Yes | Apache-2.0 | High | WRAP | Text sources | Latin OCR; N’Ko support REQUIRES_EVALUATION |
| OCRmyPDF | Searchable PDF OCR | Via Tesseract | Yes | MPL-2.0 | High | WRAP | PDF books | Pipeline utility |
| Simba / SimbaBench | African speech benchmark | `mlq` Western Maninkakan | Dataset+code | Research release | Active | BENCHMARK | Eval harness | Standardized African ASR/LID |
| AfriSpeech Africa Corpus Builder | Bible-aligned **text** | Many African langs | Download on use | Check dataset terms | Active | LEARN_FROM / REJECT for speech | Text MT/NLP | Not speech; religious domain bias |
| AfriSpeech-200 | African **English** accents | Not Maninka | HF | Research | Mature | REJECT for Maninka lexicon | Wrong language | Accented English ASR |
| NicoLingua datasets | Guinea speech | Direct Maninka | Local after download | CC BY-SA 4.0 | Published 2021 | BENCHMARK / LEARN_FROM | Highest priority datasets | See §19.2 / §24 |

#### Pipeline build-vs-reuse summary

| Stage | Recommendation |
|-------|----------------|
| Source discovery | BUILD (SiraLex registry + human curation); LEARN_FROM existing catalogs |
| Media acquisition | WRAP yt-dlp/FFmpeg **only when rights allow**; else manual/owned |
| Media conversion | REUSE FFmpeg |
| Voice activity detection | REUSE/WRAP later (Silero/pyannote); DEFER for manual pilot |
| Speech segmentation | Manual in ELAN first; WRAP automation later |
| Speaker diarization | WRAP pyannote later; DEFER for pilot |
| Overlap detection | Manual flags first; automation INVESTIGATE_LATER |
| Speech separation | DEFER / REJECT for early CORPUS1 |
| ASR | BENCHMARK Whisper/MMS/SSA finetunes; never authoritative |
| Language identification | BENCHMARK (NicoLingua lessons, SSA-HuBERT, Simba SLID); human assess for promotion |
| Forced alignment | INVESTIGATE_LATER (MFA) after transcript quality |
| Manual linguistic annotation | REUSE ELAN (primary) |
| Transcript correction/review | REUSE ELAN tiers + SiraLex review status |
| Translation/gloss | ELAN tiers; FLEx later for interlinear |
| Lexicography management | INTEROPERATE FLEx/LIFT later; do not replace SiraLex bundles |
| Phonetic analysis | REUSE Praat as needed |
| OCR | REUSE Tesseract/OCRmyPDF |
| Corpus search/concordance | BUILD minimal over SiraLex corpus store later; or WRAP existing tools |
| Collaborative review | BUILD lightweight governance on top of exports; Label Studio optional |
| Dataset/provenance/version | **BUILD** (SiraLex-unique) |
| Review governance / promotion | **BUILD** (SiraLex-unique) |
| Dictionary promotion | **BUILD** adapters into AL1 / IR / corrections |

### 19.4 Existing dataset landscape

| Dataset | Publisher | Languages | Origin | Volume (reported) | Transcripts | License | CORPUS1 uses |
|---------|-----------|-----------|--------|-------------------|-------------|---------|--------------|
| SLR106 NicoLingua VA | Doumbouya et al. | fra, Maninka, Pular, Susu | Guinea | 10k utt / 49 speakers | Yes (closed vocab) | CC BY-SA 4.0 | Pilot ASR/LID; limited lexical |
| SLR105 NicoLingua radio | same | 10+ incl. Maninka | Guinea radio | ~142h | Mostly no | CC BY-SA 4.0 | LID/noise; weak dictionary |
| SimbaBench subsets | UBC-NLP | many African incl. `mlq` | Aggregated | per-config (mlq ~0.04h test listed) | Yes (eval) | Check HF | BENCHMARK |
| Jeli-ASR | RobotsMali | Bambara | Mali | ~30h | Partial | Check Zenodo/repo | LEARN_FROM Manding ASR; not Maninka |
| African Next Voices Bambara | RobotsMali | Bambara | Mali | ~612h spontaneous | Yes (project claims) | Check release | LEARN_FROM; variety ≠ Maninka |
| Koumankan4Dyula | UVCI | Dioula | Côte d’Ivoire | ~15h | Yes + FR/EN | Check HF | LEARN_FROM related Manding |
| Common Voice Dioula | Mozilla | dyu | Community | small hours | Yes | CC-0-ish CV terms | Weak volume; variety ≠ Maninka |
| AfriSpeech Africa Corpus | AfriSpeech | 693 African **text** | Bible-aligned | verses | Text | Check | Orthography/MT research only |
| WAXAL | Google et al. | 24 African (list excludes Maninka in paper summary) | Multi-country | large | Yes | CC-BY-4.0 claimed | INVESTIGATE_LATER if Maninka absent |

**Priority for Guinea Maninka:** SLR106 > SLR105 tagged val > Simba `mlq` >
everything Bambara/Jula (reference only).

### 19.5 African speech / model landscape

| Project | Role for SiraLex |
|---------|------------------|
| NicoLingua WAwav2vec | Historical proof that Guinea radio SSL helps LID/ASR — LEARN_FROM |
| Orange SSA-HuBERT | Modern African SSL including Maninkakan — BENCHMARK |
| Simba models | African ASR/TTS/SLID suite — BENCHMARK |
| Meta MMS | Broad coverage; variety label caution — BENCHMARK |
| Google USM | Claims Maninka; access/eval UNKNOWN — INVESTIGATE_LATER |
| Whisper family | Ubiquitous draft ASR — BENCHMARK drafts only |

### 19.6 Standards / interoperability landscape

| Format | Role | SiraLex stance |
|--------|------|----------------|
| ELAN EAF | A/V annotation interchange | **Import/export adapter** — primary pilot format |
| Praat TextGrid | Alignment/phonetics | Adapter as needed |
| LIFT / FLEx flextext | Lexicon/interlinear | Later INTEROPERATE; not replace bundles |
| Web Annotation JSON | Generic annotation | Optional; not required |
| SRT/VTT | Subtitles | Import as `subtitle_import` method |
| CSV/TSV / JSONL | Manifests & SiraLex-native evidence | **SiraLex-native corpus evidence** likely JSONL |
| Speech dataset manifests | HF/OpenSLR style | Adapter for eval imports |

**Do not modify** current SiraLex dictionary bundle format for CORPUS1.

**SiraLex-native vs adapter:**

```text
Native: corpus_sources / artifacts / segments / annotations / rights / validation / candidates
Adapter: EAF, TextGrid, SRT/VTT, dataset manifests, LIFT (later)
```

### 19.7 Corpus Workbench build-vs-reuse analysis

| Option | Effort | Offline | A/V annotate | Transcript fix | Translation | Provenance | Automation | Verdict |
|--------|--------|---------|--------------|----------------|-------------|------------|------------|---------|
| ELAN first | Low | Strong | Strong | Strong | Tier-based | Manual metadata | Low | **RECOMMENDED initial** |
| Label Studio | Medium | Possible | Good | Good | Custom | Custom | High | Secondary / automation |
| FLEx | Medium | Strong | Weak alone | Text-strong | Strong interlinear | Lexicon-centric | Low | Later lexicon bridge |
| SayMore | Low–med | Strong | Medium | Medium | Medium | Good field meta | Low | Optional |
| Custom SiraLex Workbench | Very high | Designable | Rebuild all | Rebuild | Rebuild | Best fit | Designable | **DEFER** until ontology stable |

**Recommendation:**

```text
media → ELAN (or equivalent) → reviewed EAF/export
  → SiraLex importer → corpus evidence format
  → promotion governance
```

Mode: **INTEROPERATE** now; reconsider **BUILD** only after CORPUS1F–G
prove gaps that mature tools cannot close (likely: rights matrix, promotion
UI, dictionary candidate hand-off).

### 19.8 Highest-priority tools / resources

1. ELAN + EAF  
2. OpenSLR SLR106 / NicoLingua  
3. OpenSLR SLR105 (tagged validation subset first)  
4. FFmpeg (conversion)  
5. SimbaBench / SSA-HuBERT (eval)  
6. existing SiraLex provenance + alias/correction governance patterns  

### 19.9 Defer or reject

| Item | Mode | Reason |
|------|------|--------|
| Custom workbench (now) | DEFER | Ontology first |
| yt-dlp mass scraping | REJECT as policy | Rights-gated; not authorized |
| Treating Whisper/MMS as orthography | REJECT | Non-authoritative |
| Bambara/Jula as Maninka lexicon | REJECT without assessment | Variety collapse |
| AfriSpeech-200 | REJECT for Maninka content | English accents |
| Bible-text corpora as spoken Maninka evidence | REJECT for speech claims | Domain/scripture bias; text≠speech |
| Crowdsourced auto-publish | REJECT | Violates review governance |
| Speech separation as early dependency | DEFER | Complexity ≫ pilot value |

### 19.10 Research gaps (UNKNOWN / REQUIRES_EVALUATION)

- Hands-on Maninka WER for Whisper / MMS / USM / finetuned SSA-HuBERT  
- Practical N’Ko OCR quality in Tesseract  
- VOXcommons public data availability and license  
- Whether SLR106 utterance orthography matches SiraLex dictionary norms  
- MFA acoustic model feasibility for Maninka  
- Exact redistribution constraints for dictionary **examples** under CC BY-SA
  when derived from SLR106 (ShareAlike implications — **REQUIRES_RIGHTS_REVIEW**)  
- Overlap between Simba `mlq` materials and NicoLingua  

---

## 20. AI / model role

**PROPOSED:** AI may assist with rough transcription, candidate segmentation,
LID, translation suggestions, duplicate detection, reviewer support, and
candidate extraction.

Authority path:

```text
model output → candidate evidence → review → (optional) promotion governance
```

Never:

```text
model output → dictionary
```

Preserve where appropriate: tool/model identity, version, task, timestamp,
input provenance, output provenance, review status.

---

## 21. Legal / ethical architecture

**Not legal advice.** Design states the system needs.

| Topic | Governance need |
|-------|-----------------|
| Copyright | Per-use permission matrix; default PUBLICATION_BLOCKED |
| Source preservation | Capture hashes; offline retention policy |
| Redistribution | Separate audio vs transcript vs short excerpt |
| Model training vs evaluation | Distinct permission flags |
| Private / owned recordings | Consent records; retention limits |
| Speaker consent | Explicit for identifiable speech |
| User-submitted recordings | Intake terms + minors policy before enabling |
| Attribution | Required fields when license demands |
| Sensitive speech | Flag + heightened review |
| Removal / takedown | Disable source/artifact/segments without rewriting history |
| Minors | Block collection until policy exists; SLR106 includes ages 5–76 — extra caution |
| Internal research vs product | Rights matrix must allow internal_analysis while blocking publication |

CC BY-SA datasets (NicoLingua) may allow research use with attribution, but
**dictionary example publication** may trigger ShareAlike obligations —
flag **REQUIRES_RIGHTS_REVIEW** before any product use.

---

## 22. Product opportunities

### Near-term (after schemas + small pilot)

- Content-gap prioritization (with CF2)  
- Example sentence candidates  
- Orthography / alias evidence for AL1  
- Pronunciation examples (rights-cleared)  
- Reviewer training on real Maninka audio  

### Speculative later

- Broader dictionary coverage / sense discovery  
- Phrase inventory  
- Learner listening assets  
- ASR evaluation harness for Maninka tooling  
- Model evaluation sets  
- Community contribution under governance  

---

## 23. Major risks

| Risk | Mitigation |
|------|------------|
| Collapsing corpus into dictionary truth | Hard multi-status model; no auto-publish |
| Variety collapse (Bambara≠Maninka) | claimed vs assessed language |
| Rights contamination | Per-use matrix; default block |
| Treating ASR as orthography | Method tags + review |
| Building custom workbench too early | ELAN-first roadmap |
| URL-only provenance | Capture layer mandatory |
| CC BY-SA ShareAlike into product | Rights review before publication |
| Scope explosion (full automation) | Manual pilot before automation |
| Git pollution with raw media | Keep artifacts outside git by default |

---

## 24. Recommended CORPUS1 roadmap

Refined sequence:

| Slice | Focus |
|-------|-------|
| **CORPUS1A** | This audit — COMPLETE |
| **CORPUS1B** | `corpus_sources_v1` schema (+ rights stub linkage) |
| **CORPUS1C** | `corpus_source_artifacts_v1` + `corpus_segments_v1` |
| **CORPUS1D** | Transcript / translation / annotation schema + uncertainty spans |
| **CORPUS1E** | Validation + review worksheet/export (mirror AL1C lessons) |
| **CORPUS1F** | Small manual pilot (3–10 sources; 20–50 segments) — prefer rights-clear / CC-reviewed materials; **ELAN-based** |
| **CORPUS1G** | Workbench decision / EAF importer prototype (still not full custom UI unless justified) |
| **CORPUS1H** | Candidate extraction + corpus-to-product promotion governance |
| **LATER** | Automated acquisition, ASR assist, large-scale ingest, trusted community contribution |

**Do not** build a custom workbench before evidence ontology and interchange
contracts are stable (after ~1D/1E; confirm at 1G).

### Manual pilot principle (CORPUS1F)

```text
3–10 deliberately chosen sources
20–50 manually processed evidence segments
```

Purpose: stress-test segmentation, overlap, orthography, unknowns,
code-switching, language identity, translation style, duplicates, speaker
metadata, evidence quality, reviewer burden, provenance, rights states —
**not** scale.

---

## 25. Non-goals

CORPUS1A does not authorize: scraping; downloading; transcription; automatic
translation; ASR execution; model calls; API integration; corpus ingestion;
dataset import; public crowdsourcing; dictionary/alias/supplement mutation;
runtime search changes; N’Ko generation; learning changes; cloud/backend
dependencies; AI runtime integration; schema implementation; tool
installation; custom workbench implementation.

---

## 26. Files changed

```text
ADDED:    docs/reports/corpus1a_corpus_acquisition_validation_audit.md
MODIFIED: (none)
```

---

## 27. Validation

```bash
git diff --check
```

Expected: PASS (report-only addition; no whitespace errors in staged sense —
run at completion).

Unit tests / build: **NOT REQUIRED** for this report-only slice.

---

## 28. Working tree

At completion, expected:

```text
?? docs/reports/corpus1a_corpus_acquisition_validation_audit.md
?? docs/reports/lx1a_learning_experience_audit.md   # pre-existing untracked
?? web/scripts/                                       # pre-existing untracked
```

Commit: **NOT CREATED** (not requested).

---

## FINAL INVARIANTS (restated)

```text
Corpus evidence is not dictionary truth.
Evidence must preserve provenance and uncertainty.
External software output is not automatically trusted evidence.
Machine transcription is not authoritative transcription.
Validation does not imply promotion.
Promotion does not imply publication.
Use mature existing tools where they satisfy the requirement.
Build custom SiraLex machinery only for provenance, governance,
integration, and deterministic publication.
Published SiraLex knowledge must still pass explicit review,
deterministic build/publish controls, and regression governance.
```
