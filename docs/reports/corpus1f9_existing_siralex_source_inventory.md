# CORPUS1F9 — Existing SiraLex Language-Source Inventory / Dedup Audit

## 1. Decision

**CORPUS1F9_EXISTING_SOURCE_INVENTORY_COMPLETE**

Strategic decision:

**EXISTING_SOURCES_SUFFICIENT_FOR_NEXT_GROWTH_STEP**

Highest-value next growth does **not** require a new external acquisition URL.
It requires exhausting underused **existing** evidence: Malidaba version delta,
owner lexical / aliases / supplements from usage, and (only later) rights-gated
selective MRC — while keeping SLR106/SimbaBench closed for lexical growth and
SLR105 deferred.

## 2. Base commit

```text
b6060f65c1e250edb6393d2a6b7259be86dd83f7
```

(CORPUS1F8: `Record Maninka reference corpus audit`)

## 3. Why this inventory was necessary

Repeated near-misses showed that “new” labels were often:

- already core (`Malidaba` / `src_malipense`)
- same underlying family under another wrapper (SimbaBench mlq ≡ SLR106)
- audited but not acquired (SLR105, MRC bulk)
- local-only pilot evidence not in dictionary bundles

Before further discovery, SiraLex needed one inventory of what it already owns,
references, parses, reviews, and leaves unused.

## 4. Search scope

**Repository-only** (no web):

- `shared/sources/`, `shared/corpus/`, `shared/specs/`, `shared/aliases/`,
  `shared/source_index_supplements/`, `shared/target_variants/`,
  `shared/phrase_review/`
- `docs/`, `docs/reports/` (including CORPUS1A–1F8)
- `README*`, `docs/SOURCES.md`, `docs/DATASET.md`
- `web/public/bundle_*/bundle.manifest.json`
- fixtures, IR path references in docs/tests
- **read-only** local/gitignored: `data/ir/`, `data/corpus1f/`,
  `data/corpus1f7/`, `data/snapshots/`, `data/normalized/`, `data/enriched/`,
  `data/search_index/`, `data/bundles/`, `data/local_evidence/`, `data/url_lists/`

No downloads. No external site checks. No new acquisition audits.

## 5. Core source inventory

### Registered tracked sources (`shared/sources/`)

| source_family | repository_source_id | source_type | language | script | role | current_status | registry | local IR | bundle | rights | version/snapshot | next_action |
|---------------|----------------------|-------------|----------|--------|------|----------------|----------|----------|--------|--------|------------------|-------------|
| Mali-pense / Malidaba | `src_malipense` | LEXICOGRAPHIC | Guinean Maninka | Latin (+ N’Ko index in source) | Phase 1 primary backbone | **CORE_PUBLISHED_SOURCE** | `malipense.yaml` | yes (~8823 lexicon) | yes (all production manifests) | CC BY-NC-SA 4.0 (claimed) | Jan 2026 crawl / local IR; delta vs newer edition identified in CORPUS1F8 | **version gap comparison** |
| SiraLex owner lexical review | `src_siralex_lexical_review` | LEXICOGRAPHIC / DERIVED_INTERNAL | Maninka | Latin | owner-approved additions | **CORE_INTERNAL_SOURCE** (small) | `siralex_lexical_review.yaml` | yes (3 rows) | not in `sources.included` of production manifests sampled | project-internal-review | `siralex_owner_lexical_v1` | grow via usage review governance |

### Derived tracked search artifacts (not external sources)

| Artifact | Path | Rows | Status |
|----------|------|-----:|--------|
| Source aliases | `shared/aliases/source_aliases_v1.jsonl` | 24 | APPROVED / PARTIAL_SELECTIVE_USE |
| Source index supplements | `shared/source_index_supplements/source_index_supplements_v1.jsonl` | 8 | APPROVED / PARTIAL_SELECTIVE_USE |
| Reviewed target variants | `shared/target_variants/reviewed_target_variants_v1.jsonl` | 1 | PARTIAL_SELECTIVE_USE |
| Phrase miss review | `shared/phrase_review/phrase_miss_review_v1.jsonl` | present | REFERENCE / review packet (phrase aliases unwired) |

These map queries → existing Malidaba IR; they are **not** new linguistic corpora.

## 6. Corpus source inventory

| source_family | wrappers / ids | type | status | local data | reviewed evidence | rights | next_action |
|---------------|----------------|------|--------|------------|-------------------|--------|-------------|
| NicoLingua-0004 / OpenSLR **SLR106** | `csrc_openslr_slr106_nicolingua_va`; CORPUS1F pilot | SPEECH_CORPUS | **EXHAUSTED_FOR_LEXICAL_GROWTH**; LOCAL_ACQUIRED_NOT_PUBLISHED to dictionary | `data/corpus1f/` | yes — 24 transcript + 48 translation reviews (72 total) | CC BY-SA 4.0; pub examples blocked pending review | retain for pronunciation/pipeline; **no vocab expansion** |
| SimbaBench `asr_test_mlq` | HF wrapper of Nicolingua-0004 | BENCHMARK → same family | **AUDITED_NOT_ACQUIRED** / exhausted | `data/corpus1f7/` | no SiraLex reviews | HF cc-by-4.0 over original BY-SA | do not ingest for growth |
| OpenSLR **SLR105** radio | NicoLingua-0003 | SPEECH_CORPUS | **BLOCKED_ACCESS** (clip-level tags) | none | none | CC BY-SA 4.0 (documented in audits) | deferred until metadata accessible |
| **MRC** / Corpus Maninka de Référence (+ Corpus N’ko) | cormand / Corpora Mandeica | TEXT_CORPUS | **REFERENCE_ONLY** in repo; **BLOCKED_RIGHTS** for bulk product | none as corpus IR | none found in Malidaba IR needles | multi-source; selective doctrine in SOURCES/README | rights-gated selective pilot only |
| Manding-adjacent speech (Bambara/Jula, AfriSpeech-200, MMS `mnk`, …) | CORPUS1A evaluations | SPEECH / REFERENCE | REJECT / LEARN_FROM / INVESTIGATE_LATER | none ingested | none | varies | **not** Guinean Maninka authority |
| Synthetic corpus fixtures | `csrc_fixture_*` | fixtures | REFERENCE_ONLY | `shared/corpus/fixtures/` | N/A | N/A | tests only |

**No production tracked** `shared/corpus/corpus_sources_v1.jsonl` registry of real sources (fixtures only).

## 7. Local-only source inventory

| Path | Contents | Canonical? | Reviewed? | Retain? |
|------|----------|------------|-----------|---------|
| `data/ir/malipense_*.jsonl` | Lexicon v1/v2/v3 (8823); index v1 (10501) | build input (gitignored) | published via bundles | **yes** |
| `data/ir/siralex_owner_lexical_v1.jsonl` | 3 owner additions | internal | yes (governance) | **yes** |
| `data/snapshots/src_malipense/` | HTML crawl snapshots | snapshot | N/A | yes (audit/rebuild) |
| `data/url_lists/` | crawl URL lists | tooling | N/A | yes |
| `data/normalized/`, `data/enriched/`, `data/search_index/` | derived build artifacts | derived | N/A | yes |
| `data/corpus1f/` | SLR106 pilot tables + audio + reviews | local corpus evidence | **yes** | **yes** (not dictionary authority) |
| `data/corpus1f7/` | SimbaBench mlq parquet + meta | audit artifact | no | optional retain |
| `data/bundles/` | local bundle staging | staging | N/A | as needed |
| `data/local_evidence/` | UX/CF lifecycle evidence (**not** lexicon) | product evidence | N/A | yes (separate from language sources) |
| `data/aliases/` | empty | — | — | — |

## 8. Source-family / wrapper relationships

```text
NicoLingua-0004 (West African VA ASR)
├── OpenSLR SLR106
├── CORPUS1F local pilot (csrc_openslr_slr106_nicolingua_va)
└── SimbaBench asr_test_mlq (HF_test-mlq*Nicolingua-0004-…)
    → SAME CLOSED-VA SOURCE FAMILY
    → EXHAUSTED FOR LEXICAL GROWTH

Malidaba lineage
├── Mali-pense / Malidaba (src_malipense) ← CORE
├── Vydrin Manden-English / Manding-English ← RELATED / integrated predecessor
├── Kantè / N’Ko lexicographic works ← RELATED bibliography (no source_id)
└── IRLA / missionary / field notes ← RELATED bibliography
    → VERSION / LINEAGE RELATIONSHIP — not separate SiraLex acquisitions

MRC family
├── Corpus Maninka Latin
├── Corpus N’ko
└── Malidaba morphological annotation dependency
    → CORPUS EVIDENCE ≠ LEXICOGRAPHIC SOURCE
    → REFERENCE_ONLY in current SiraLex data plane
```

## 9. Malidaba current role

**MALIDABA = PRIMARY / CORE LEXICOGRAPHIC SOURCE**

Verification (repo only):

| Check | Result |
|-------|--------|
| `src_malipense` registry | present |
| `docs/SOURCES.md` Phase 1 primary | yes |
| `shared/sources/README.md` | “Phase 1 primary source” |
| Production bundle `sources.included` | `src_malipense` |
| IR present | `malipense_lexicon_v3.jsonl` **8823** rows; index **10501** |
| Aliases/supplements rely on it | yes (map to existing IR) |
| Examples/phrases | primarily from Malidaba entry structure in IR |

## 10. MRC actual repository usage

**MRC_REFERENCE_ONLY**

Evidence:

- Named in `docs/SOURCES.md` / `README.md` as selective examples; avoid bulk redistribution
- CORPUS1F8: no dedicated MRC IR / corpus registry ingest
- Needle search in `data/ir/malipense_lexicon_v3.jsonl` for `cormand` / `cormani` / `Corpus Maninka` / `concordance` / `NoSketch` → **0 hits**
- No `data/corpus*` MRC tree

Kurana/Coran strings inside Malidaba IR are **dictionary attributions**, not MRC corpus rows.

## 11. Other pre-existing corpora discovered

Beyond Malidaba + SLR106 pilot:

1. **SLR105** — audited, not acquired (access blocked)
2. **SimbaBench mlq** — audited local parquet; same as SLR106 family
3. **MRC** — reference only
4. **CORPUS1A evaluated Manding-adjacent / wrong-language resources** — not ingested
5. **Synthetic fixtures** under `shared/corpus/fixtures/`
6. **No other real text/speech corpus IR** found under `data/ir/` or tracked registries

## 12. Rights / status map

| Source | Rights posture (from repo) | Usage status |
|--------|----------------------------|--------------|
| Malidaba | CC BY-NC-SA 4.0 claimed; NC blocks commercial productization | CORE_PUBLISHED_SOURCE |
| Owner lexical | project-internal | CORE_INTERNAL_SOURCE |
| SLR106 pilot | CC BY-SA; publication examples pending | REVIEWED_CORPUS_EVIDENCE + EXHAUSTED_FOR_LEXICAL_GROWTH |
| SimbaBench mlq | wrapper over BY-SA | AUDITED_NOT_ACQUIRED / exhausted |
| SLR105 | CC BY-SA documented | BLOCKED_ACCESS |
| MRC | multi-source; selective doctrine | REFERENCE_ONLY + BLOCKED_RIGHTS (bulk) |
| Bambara/Mandinka substitutes | N/A | REJECT as Maninka authority |

## 13. Version / staleness map

| Source | Classification | Evidence |
|--------|----------------|----------|
| Malidaba local IR vs newer public edition | **VERSION_DELTA_ALREADY_IDENTIFIED** | CORPUS1F8: May 2026 page 7913+1950 addon vs local ~8823 IR / crawl notes ~7283 lexemes |
| SLR106 pilot | CURRENT_AS_KNOWN (closed vocab) | CORPUS1F reports |
| SLR105 | VERSION_UNKNOWN for clip tags | never acquired |
| MRC sizes in reports | CURRENT_AS_KNOWN *as documented in F8* (June 2025 figures) | no live re-check this slice |

## 14. Duplication map

See §8. Critical dedup rules:

- Do not treat SimbaBench mlq as new Maninka speech evidence
- Do not treat “new Malidaba URL” as new source without version diff
- Do not treat Mandinka MMS as Maninka

## 15. Sources exhausted for lexical growth

- OpenSLR **SLR106** / NicoLingua-0004 / CORPUS1F closed-VA pilot
- **SimbaBench `asr_test_mlq`** (same family; 182→20 unique)

## 16. Sources blocked but valuable

| Source | Block | Value |
|--------|-------|-------|
| SLR105 | clip-level validation metadata inaccessible | natural-speech lexical potential |
| MRC bulk | rights / multi-source copyright + selective doctrine | high written lexical/phrase yield |

## 17. Existing unused / underused evidence

| Opportunity class | Existing asset | Notes |
|-------------------|----------------|-------|
| A. VERSION DELTA | Malidaba IR vs newer edition | highest near-term dictionary growth |
| B. NOT YET INDEXED | Malidaba fields / N’Ko index richness already in source | may need projection, not acquisition |
| C. CORPUS NOT PRODUCT-GOVERNED | CORPUS1F reviews (72) | pronunciation/evidence ≠ dictionary promotion |
| D. REVIEWED INTERNAL | owner lexical (3) + alias/supplement machinery | scalable via CF/usage |
| E. N’KO | Malidaba N’Ko index; MRC N’Ko (reference) | under-exploited in product exposure |
| F. PHRASES | phrase_miss_review packet; Malidaba examples | partial exposure |
| G. RIGHTS BLOCKED | MRC bulk; NC commercial path | governance, not crawl |
| H. EXHAUSTED | SLR106 / SimbaBench | stop expanding |

## 18. Highest-value opportunities WITHOUT new acquisition

Qualitative rank:

1. **Malidaba deterministic gap comparison** (expected distinct lexemes/senses/examples; medium effort; NC rights already modeled; low duplication if identity-aware)
2. **Usage → aliases / supplements / owner lexical** (high product value; low rights risk; uses existing IR)
3. **Expose / govern existing Malidaba examples & N’Ko forms** already in IR/source
4. **Retain CORPUS1F reviews** as pronunciation evidence — do not invent new VA downloads
5. **MRC selective** only after rights clearance — do not scrape

## 19. Recommended next action

```text
Do NOT start another external corpus hunt.

Next growth step (design/implement later):
1. Malidaba version-delta comparison against local src_malipense IR
2. Continue usage-driven alias / owner-lexical pipeline
3. Keep SLR105 deferred; keep SLR106/SimbaBench closed for vocab growth
4. Treat MRC as reference until a rights-cleared selective pilot is approved
```

## 20. Files added / modified

Tracked (uncommitted):

- `docs/reports/corpus1f9_existing_siralex_source_inventory.md`

## 21. Non-mutation

No changes to dictionary, IR, bundles, catalogs, corpus tables, reviews, runtime, or `web/scripts/`.
Local data inspected read-only.

## 22. git diff --check

PASS expected (see final return).

## 23. Working tree

CORPUS1F9 left **uncommitted**. `web/scripts/` untouched if still present as untracked.
