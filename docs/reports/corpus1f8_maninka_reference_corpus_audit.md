# CORPUS1F8 — Maninka Reference Corpus / Malidaba Lexical-Yield Audit

## 1. Decision

**CORPUS1F8_MANINKA_REFERENCE_CORPUS_AUDIT_COMPLETE**

Independent decisions:

| Object | Decision |
|--------|----------|
| **Malidaba** | **MALIDABA_ALREADY_CORE_SOURCE** |
| Concurrent Malidaba findings | Gap comparison recommended; **NC rights block product commercialization** of source-derived content |
| **MRC** | **MRC_USEFUL_BUT_RIGHTS_BLOCKED_FOR_PRODUCT_USE** |

MRC retains **high lexical-yield potential** as corpus evidence, but multi-source copyright + selective-use doctrine already recorded in SiraLex block bulk productization. Malidaba is already the Phase 1 lexicographic backbone (`src_malipense`).

## 2. Base commit

```text
8c130a258db3f9740412463bbf2905b088dc5d3e
```

(CORPUS1F7: `Record SimbaBench Maninkakan lexical audit`)

## 3. Strategic reason for text-corpus pivot

Acquisition objective remains:

```text
DISTINCT REVIEWABLE MANINKA LEXICAL / PHRASE EVIDENCE
```

Recent speech-path evidence:

| Path | Result |
|------|--------|
| SLR106 | Accessible + reviewed; **low** lexical diversity |
| SimbaBench `asr_test_mlq` | Accessible; **same SLR106 family**; **too repetitive** |
| SLR105 | High natural-speech potential; **blocked** on clip-level validation metadata |

Therefore audit a **text / lexicographic** channel in parallel — without assuming speech is the best next lever.

## 4. Repository overlap audit

Searched docs, source registries, manifests, IR references, and design notes for Malidaba / Vydrin / MRC / Manding-English / N’Ko dictionary identifiers.

| Candidate | Overlap category |
|-----------|------------------|
| Mali-pense / **Malidaba** | **EXISTING_CORE_SOURCE** |
| Valentin Vydrin / Vydrine | **EXISTING_CORE_SOURCE** (primary author of `src_malipense`) |
| Manding-English / Manden-English dictionary (Vydrin) | **RELATED_SOURCE_FAMILY** — current Malidaba 2nd ed states Guinean Maninka data from that dictionary were **fully integrated** |
| Solomana Kantè / N’Ko lexicographic works | **RELATED_SOURCE_FAMILY** (listed among Malidaba primary sources; not a separate SiraLex `source_id` observed) |
| **Corpus Maninka de Référence / MRC** | **PARTIAL_OVERLAP** — named in `docs/SOURCES.md` + README as selective example target; **no** dedicated corpus registry ingestion / MRC IR observed in this audit |
| Maninka Reference Corpus examples already in product | **UNKNOWN** at row level without a dedicated MRC provenance sweep (architecture allows selective examples; bulk MRC IR not found) |

**Do not claim “new vocabulary from Malidaba”** before version-diff comparison: Malidaba is already core.

## 5. Existing SiraLex source lineage

Verified registry:

- `shared/sources/malipense.yaml` → `source_id: src_malipense`
- Name: “Mali-pense / Malidaba Maninka dictionary”
- Homepage: `https://www.mali-pense.net/`
- Claimed license recorded: **CC BY-NC-SA 4.0** (verified in registry notes 2026-01-22)
- Phase 1 role (`docs/SOURCES.md`): **primary lexicographic backbone**
- Bundles reference `src_malipense` + `malipense_lexicon_v3` / `malipense_index_v1`

Local IR (gitignored; inspection only):

| Artifact | Observation |
|----------|-------------|
| `data/ir/malipense_lexicon_v3.jsonl` | Present |
| Row count | **8,823** IR units |
| `source_id` | exclusively `src_malipense` |
| Parser field observed | `malipense_lexicon_v1` (field naming; pipeline labeled lexicon_v3 in manifests) |

Crawl notes in registry (capture-time claims): ~**7,283 lexemes / 8,799 entries** on `indexfr.htm` at crawl — consistent order of magnitude with current online stats, but **not identical** to May 2026 published counts → **version-difference opportunity** (§19).

Project posture (`README.md`): explicit **non-commercial language infrastructure** intent; data/content may carry separate provenance constraints.

## 6. Malidaba identity / current version

Official pages (cormand + mali-pense mirrors), verified 2026-08-21:

| Field | Verified claim |
|-------|----------------|
| Title | Malidaba — electronic Maninka–French–English–Russian dictionary |
| Author | Valentin Vydrin (+ technical assistance: Maslinsky, Méric, Rovenchak) |
| Edition | **2nd edition**, Paris, **2026** (2nd version 2024–2026) |
| Completeness | “True dictionary” vs 2018; still **preliminary** — letters **A, B, and beginning of D** well elaborated; remainder less so |
| Variety | **Guinean Maninka** |
| Offline ZIP | `maninka-web.zip` (~3.4 MB) offered |

## 7. Malidaba source lineage

Documented:

- Integrates Guinean Maninka data from Vydrin’s **Manden-English** dictionary into the 2nd edition
- Morphological annotation for MRC historically driven by Malidaba
- Long primary-source bibliography (Kantè/N’Ko works, field notes, IRLA lexicons, missionary dictionaries, etc.)

Ontology:

```text
Malidaba = LEXICOGRAPHIC SOURCE
MRC      = CORPUS EVIDENCE SOURCE
```

Do **not** collapse into one registry object merely because they cross-link.

## 8. Malidaba rights

**Verified license claim:** **CC BY-NC-SA 4.0** (Attribution–NonCommercial–ShareAlike).

| Use | Rights posture (modeling, not legal advice) |
|-----|-----------------------------------------------|
| A. Internal research/reference | **allowed** under recorded NC project posture + attribution |
| B. Derived candidate/evidence generation (private) | **requires_rights_review** (ShareAlike / NC scope) |
| C. Redistribution of source-derived content | **requires_rights_review** / often **blocked** for free relicensing |
| D. Incorporation into a **commercial** dictionary/product | **blocked** under NC claim |

```text
rights modeling ≠ legal determination
CC BY-NC-SA ≠ automatic commercial product permission
```

Already reflected in `malipense.yaml` compliance notes (Attribution, NonCommercial, ShareAlike).

## 9. MRC identity

**Corpus Maninka de Référence** (+ **Corpus N’ko**), part of Corpora Mandeica.

Editors/project: Vydrin, Maslinsky, Méric, Rovenchak, with Ibrahima Sory 2 Condé / N’Ko Academy collaboration (project page).

Public hub: `https://cormand.huma-num.fr/cormani/`

Guinean Maninka; Latin orthography variants + N’Ko written tradition.

## 10. MRC size / access

### Size (documented)

| Subcorpus | Documented size | Status |
|-----------|----------------:|--------|
| Latin (`cormani-brut-lat`) | **384,802** words | June 2025 update on official index |
| N’Ko (`cormani-brut-nko`) | **3,400,812** words | June 2025 update |
| Disambiguated | **25,593** words | June 2025 (new, modest) |
| Opening (2016) Latin | 396,389 words | Historical |
| Opening (2016) N’Ko | ~3.1M words | Historical |

### Access

| Mode | Finding |
|------|---------|
| Project documentation / Malidaba | **Public** |
| Interactive NoSketchEngine | Documented historically (`run.cgi` / maslinsky host); **live search host DNS failed** in this audit (`maslinsky.spb.ru` NXDOMAIN); cormand `run.cgi` **404** |
| Bulk download of full corpus | **Not** presented as a simple open dump on the pages inspected |
| Small tooling download | `nkolatin.zip` converter (**~309 KB**) available on cormand |

Accessibility for concordance-first pilots is therefore **partially degraded** until a working query endpoint is re-verified.

## 11. MRC script composition

| Script | Role |
|--------|------|
| Latin | Original Latin publications (old + 1988 orthographies); tones often absent in originals; corpus may store original + corrected forms |
| N’Ko | Dominant modern written practice; texts tonalized; dual representation via converters (Rovenchak) |

Both scripts are first-class for SiraLex doctrine; conversion is **tooling**, not authority.

## 12. MRC annotation / search capabilities

Documented (guide + index):

- NoSketchEngine-style query (lemma, word, gloss, tags, source attributes)
- Automatic morphological annotation based on **Malidaba**
- Homonym lumping warning on concordance counts (not disambiguated for most of the corpus)
- Small **disambiguated** subcorpus inaugurated June 2025

## 13. MRC source diversity

Documented genres: newspapers/periodicals, belles-lettres, literacy/popularization, religious works, etc.

Malidaba’s primary-source list (and MRC text lists) include **published authors**, **N’Ko Academy** materials, **religious translations** (e.g. Qur’an/Kurana references in Malidaba bibliography), novels, primers, and field notes.

Genre diversity supports **high** phrase/lemma exposure relative to SLR106 VA prompts.

## 14. MRC source-level provenance

Correct SiraLex unit:

```text
corpus collection
→ individual source/text provenance
→ captured artifact/evidence
→ segment/annotation/review
```

**Not:**

```text
“the entire MRC is freely reusable as one blob”
```

June 2025 notes still warn that many texts historically lacked rich metatextual data (improving over time, incomplete).

## 15. MRC rights complexity

| Layer | Posture |
|-------|---------|
| Interface / collection presentation | Open-access research interface historically; **no single simple CC claim verified for every embedded text** in this audit |
| Individual published sources | Likely **retain separate copyright** (authors, publishers, religious texts, private novels) |
| Concordance display for research | Historically intended; **not** equivalent to bulk redistribution |
| Product incorporation of excerpts | **requires_rights_review** / often **blocked** without permission |
| SiraLex existing doctrine | README + `docs/SOURCES.md`: examples **selectively**; **avoid bulk redistribution** until explicit permission |

## 16. Lexical-yield assessment

| Source | Classification | Basis |
|--------|----------------|-------|
| **MRC** | **LEXICAL_YIELD_HIGH** | ~3.8M+ tokens across Latin+N’Ko; multi-genre; lemma/gloss search design; far beyond closed VA |
| **Malidaba** | High as a dictionary, but **already core** — incremental yield = **version delta**, not first acquisition | 7,913 base + 1,950 addon (May 2026 page) |
| SLR106 / SimbaBench mlq | **LEXICAL_YIELD_LOW** | Closed VA; 6–20 unique strings |
| SLR105 | **LEXICAL_YIELD_UNKNOWN** (hypothesis high) | Metadata gate blocked |

No invented type/lemma counts beyond published figures.

## 17. Sample data-shape inspection

Bounded, non-scraping checks only:

- Fetched Malidaba English/French landing pages for edition/count/license (**no** bulk entry scrape)
- Fetched MRC index + projet pages for size/update notes
- Confirmed `nkolatin.zip` exists (converter tooling; not opened into git)
- Did **not** dump concordance HTML into the repository
- Did **not** automate broad extraction

Shape summary:

| Object | Shape |
|--------|-------|
| Malidaba entry | Lemma + variants + POS + FR/EN/RU glosses + examples/idioms + optional MRC concordance link |
| MRC hit (when search works) | Surface form + lemma/gloss tags + source attribute (Latin) + dual-script fields (N’Ko) |

## 18. N’Ko / Latin implications

| Rule | Implication |
|------|-------------|
| Authoritative N’Ko source ≠ machine-generated N’Ko | Preserve original script in artifacts |
| Transliteration ≠ lexical equivalence | Dual forms need provenance of conversion |
| Converter available (`nkolatin.zip`) | Useful tooling; **not** implemented/integrated in this slice |
| Tones | N’Ko tonalized; Latin originals often untoned; normalized Latin may add tones per project conventions |

## 19. Version-difference opportunity

**Highest near-term lexicographic finding:**

SiraLex already depends on Malidaba (`src_malipense`), but the **public May 2026** stats (7,913 base + 1,950 addon; +730 since 2023 claim on page) may exceed the **Jan 2026 crawl snapshot** recorded in registry notes (~7,283 lexemes / ~8,799 entries) and the local IR row count (**8,823**).

Future deterministic comparison (design only):

```text
existing src_malipense lexeme/entry identities
vs
current Malidaba release identities
→ new-entry / new-sense / new-example / variant / changed-entry candidates
```

**Do not import now.** NC + ShareAlike still apply to any derived product path.

## 20. Source-value comparison matrix

| Dimension | SLR106 | SimbaBench mlq | SLR105 | Malidaba | MRC |
|-----------|--------|----------------|--------|----------|-----|
| Lexical diversity | Low | Low | High? | High (lexicographic) | **High** (corpus) |
| Naturalness (speech) | Elicited VA | Same | Natural radio | N/A (dict) | Written genres |
| Text alignment | Yes | Yes | No/weak | Yes | Yes |
| Glosses/translations | Via VA EN/FR | Via VA | No | **Rich FR/EN/RU** | Gloss tags / partial |
| Variety relevance | Guinean Maninka | Plausible `mlq` | Listed Maninka | **Guinean Maninka** | **Guinean Maninka** |
| Accessibility | High | High (~5 MB) | Metadata blocked | High (already in-repo) | Docs high; **live search uncertain** |
| Rights vs product | CC BY-SA | BY over BY-SA | BY-SA | **NC-SA** | Multi-source complex |
| Human-review cost | Low | Low | High | Low–medium (gap diff) | Medium–high (rights+disambig) |
| Dictionary-growth potential | Exhausted | Exhausted | Deferred | **Delta vs snapshot** | Selective evidence |
| Pronunciation value | High (multi-speaker) | Medium | High potential | Low (mostly text) | Low (text) |

## 21. Recommended Malidaba action

1. Treat as **already core** — do not re-crawl as if unknown.
2. Plan a **deterministic gap comparison** against the current online 2nd edition / May 2026 counts (**MALIDABA_GAP_COMPARISON_RECOMMENDED** as follow-on).
3. Keep **commercial productization of NC-derived content blocked** pending rights strategy (**MALIDABA_RIGHTS_BLOCKS_PRODUCT_INTEGRATION**).
4. Continue attribution + NC project posture already encoded in `malipense.yaml`.

## 22. Recommended MRC action

1. Keep MRC as a **high-yield written evidence channel**, not a bulk free lexicon dump.
2. Do **not** begin bulk ingestion.
3. Re-verify a working concordance/query endpoint before any text pilot.
4. Any future pilot must be **source-provenanced**, **rights-reviewed**, **small**, and **diversity-first**.
5. Prefer disambiguated subcorpus / well-metadated texts when available.

## 23. Proposed future pilot (design only — not run)

Two separate tracks:

**A. Malidaba gap comparison (lexicographic)**  
- Compare local `src_malipense` identities to current Malidaba release metadata  
- Output candidate lists only; no auto-merge  

**B. MRC selective evidence (corpus)** — only if rights review clears specific texts  
- 5–10 distinct source texts / provenanced excerpts  
- Maximize new constructions/phrases, not line count  
- Attach reviews; no automatic dictionary promotion  

Speech path: keep **SLR105 deferred**; keep **SLR106/SimbaBench closed for lexical-growth expansion**.

## 24. Unknowns

- Exact byte-level delta between local IR and May 2026 Malidaba without a formal diff
- Whether any MRC concordance examples already exist inside published bundles
- Current authoritative live NoSketchEngine URL (documented hosts failed in this audit)
- Per-text copyright status for high-value MRC genres (esp. religious / published novels)
- Whether maintainers would grant explicit SiraLex use permissions beyond CC BY-NC-SA dictionary terms

## 25. Stop conditions

Triggered:

- Treating Malidaba as a “new” acquisition without overlap check → **avoided**
- Bulk MRC scrape → **not done**
- Assuming NC material can enter commercial product freely → **blocked**

Not triggered:

- Complete absence of Guinean Maninka lexicographic material (already present)
- Zero lexical-yield potential (MRC/Malidaba remain high)

## 26. Files added / modified

Tracked (uncommitted):

- `docs/reports/corpus1f8_maninka_reference_corpus_audit.md`

No code/schema changes.

## 27. Local artifacts

None created for CORPUS1F8.

(CORPUS1F7 SimbaBench files may remain under gitignored `data/corpus1f7/` — not promoted.)

Local Malidaba IR inspected read-only under gitignored `data/ir/` — not modified.

## 28. git diff --check

PASS expected (see final return).

## 29. Working tree

CORPUS1F8 report left **uncommitted**. `web/scripts/` untouched. Dictionary/search/corpus registries unchanged.
