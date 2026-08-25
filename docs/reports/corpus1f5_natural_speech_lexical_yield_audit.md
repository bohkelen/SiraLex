# CORPUS1F5 — Natural-Speech Lexical-Yield Acquisition Audit

## 1. Decision

**CORPUS1F5_NATURAL_SPEECH_LEXICAL_YIELD_AUDIT_COMPLETE**

Candidate decision:

**SLR105_RECOMMENDED_FOR_NEXT_NATURAL_SPEECH_PILOT**

Gated first step (future slice; not executed here): inspect the **300-clip
tagged validation subset** for high-confidence Maninka labels before committing
to the full ~16 G archive.

## 2. Base commit

```text
268575e5fbe3e6733826df86145260ba4367bd1c
```

(CORPUS1F4: `Record persisted human translation reviews`)

## 3. Why SLR106 expansion stops

CORPUS1F empirical result (documented in
`docs/reports/corpus1f_lexical_diversity_finding.md`):

| Observed | Count |
|----------|------:|
| Audio / transcript instances | 24 |
| Unique Maninka expressions | 6 |
| Speaker realizations per expression | 4 |
| Translation annotation instances | 48 |
| Unique EN / FR semantic mappings | 6 + 6 = 12 |

```text
24 recordings ≠ 24 lexical items
48 translation annotations ≠ 48 independent lexical facts
```

SLR106 remains valuable for pronunciation variation, pipeline validation, and
review mechanics. It is a **weak next source for dictionary / phrase growth**.

## 4. Acquisition objective

```text
DISTINCT REVIEWABLE NATURAL MANINKA LEXICAL / PHRASE EVIDENCE
```

Not: maximize WAV count, speaker repetitions of a closed VA vocabulary, or
annotation-row volume.

## 5. Sources consulted

| Source | Role |
|--------|------|
| https://openslr.org/105/ | Authoritative OpenSLR resource page (identity, license, size, description) |
| https://github.com/mdoumbouya/nicolingua (README) | Project dataset summary, alternate download endpoints, CC BY-SA statement |
| Doumbouya, Einstein, Piech (2021), AAAI — paper PDF / DOI | Corpus construction details, validation-tag semantics, duration, purpose |
| `docs/reports/corpus1a_corpus_acquisition_validation_audit.md` | Prior SiraLex audit (cross-check only; not sole authority) |
| `docs/reports/corpus1f_lexical_diversity_finding.md` | SLR106 lexical-yield baseline from this pilot |

**No corpus download** was performed in this slice.

## 6. Verified SLR105 facts

Unless marked otherwise, the following are **verified** from OpenSLR and/or the
paper / NicoLingua README.

| Field | Fact | Confidence |
|-------|------|------------|
| Resource identity | OpenSLR **SLR105**; package name `nicolingua-0003-west-african-radio-corpus` | Verified |
| Summary title | West African Radio Corpus | Verified |
| License | **CC BY-SA 4.0** (OpenSLR + NicoLingua README) | Verified |
| Geography / collection | Archives from **6 Guinean radio stations** | Verified |
| Clip design | Fixed-length samples of **30 seconds** | Verified |
| Scale | Paper: **17,091** unlabeled clips ≈ **142.4 hours**; OpenSLR page text: **17,090** clips; validation **300** tagged clips (paper: total ≈ 17,391 / 144.9 h) | Verified (minor count discrepancy between page vs paper) |
| Languages listed | French, Guerze, Koniaka, Kissi, Kono, **Maninka**, Mano, Pular, Susu, Toma | Verified (list membership) |
| Purpose | Unsupervised speech representation learning on noisy “found” radio data | Verified |
| Natural speech claim | News and various radio shows; phone calls; music/noise types | Verified |
| Download burden | OpenSLR lists archive ≈ **16G** (`.tgz`) | Verified |
| Validation subset | **300** clips independently sampled; **tagged** (not the main unlabeled set) | Verified |
| Validation tag kinds (paper) | Languages spoken; single vs multiple speakers; verbal nods; telephone speech; foreground/background noise; other characteristics | Verified |
| Main corpus labeling | Mostly **uncurated / unlabeled**; music filtering incomplete | Verified |

### Clip / archive granularity

- **Verified:** clips are already cut to ~30 s from longer archives; sampling was
  proportional to archive length (~20% of archive length per paper).
- **Verified:** this is **not** utterance-level VA segmentation like SLR106.
- **Unknown without download:** exact on-disk layout of tags vs WAVs; whether
  validation tags ship as a small sidecar usable without extracting all 16 G.

## 7. Unknowns / uncertainties

| Topic | Status |
|-------|--------|
| Exact count of Maninka-labeled clips in the 300 validation set | **Unknown** (requires metadata inspection) |
| Maninka proportion in the 17k unlabeled pool | **Unknown** (unlabeled; LID required) |
| Orthography / variety (Guinean Maninka vs related Manding) for any clip | **Unknown** until human assessment |
| Program titles, station IDs, domain labels per clip | **Unknown** from public pages (may exist only inside archive) |
| Speaker identities / demographics | **Unknown** for radio corpus (pseudonymous speaker metadata is an SLR106 feature, not claimed for SLR105) |
| Presence of any transcripts or translations for radio clips | **No evidence of transcripts/translations** in authoritative docs → treat as **absent** for planning |
| Audio quality distribution (usable speech vs music-heavy) | Partially characterized (tags + “uncurated”); per-clip unknown |
| OpenSLR 17,090 vs paper 17,091 unlabeled | Minor documentation inconsistency |

## 8. Rights posture

This section records the **SiraLex audit posture** based on the public
**CC BY-SA 4.0** license claim for SLR105. It is **not** a legal determination.

```text
rights modeling ≠ legal determination
license ≠ product publication approval
```

| Use | Audit posture (not legal advice) |
|-----|----------------------------------|
| Local storage | Treated as compatible with CC BY-SA 4.0 + attribution for internal pilot work |
| Internal analysis / research | Same posture |
| Transcription + local corpus evidence storage | Same posture; ShareAlike may apply to redistributed derivatives |
| Human review (private) | Same posture |
| Public dictionary examples / pronunciation publication | **Blocked / separate rights review** — license ≠ publication authorization |
| Audio redistribution / commercial reuse | **Not authorized by this audit**; requires explicit rights decision |
| Transcript redistribution | **Not authorized by this audit** |

**Invariant:** License ≠ publication authorization.

## 9. Language / variety identification posture

- **Verified:** Maninka is explicitly named among languages present in the radio
  material.
- **Verified:** only the **300-clip validation set** carries human language tags
  among other characteristics.
- **Verified:** the main ~17k set is intended as unlabeled for SSL / LID research.
- **Inference:** clip-level Maninka confidence is **strong only where validation
  tags assert Maninka** (and even then needs human confirmation for SiraLex
  Guinean Maninka variety).
- **Unknown:** multi-language clips within 30 s (code-switching / French + local)
  rate in Maninka-tagged subset.

SiraLex must treat language labels as **reviewable claims**, not automatic
dictionary-authority language identity.

## 10. Natural-speech characteristics

| Characteristic | Assessment |
|----------------|------------|
| Spontaneous / broadcast speech | **Supported** (news + radio shows) |
| Conversational / phone-in | **Supported** (paper notes phone calls) |
| Closed VA prompts | **Not** the design (contrast SLR106) |
| Noise / music | **Expected** (foreground/background music, incomplete music filtering) |
| Multi-speaker | **Expected in some clips** (validation tag exists) |
| Longer utterances / richer lexicon | **Reasonable inference** vs SLR106 closed vocab — not quantified without listening |

## 11. Transcript / translation availability

| Layer | Availability |
|-------|--------------|
| Trusted transcripts | **None documented** for SLR105 radio clips |
| Translations (EN/FR) | **None documented** |
| ASR models in paper | Built for **SLR106-style VA vocabulary**, not as authority transcripts for radio content |

Planning assumption for next pilot:

```text
captured 30-second clip
→ listen / inspect boundaries
→ IF the complete clip is one coherent reviewable evidence unit:
     whole_artifact MAY be used
→ ELSE:
     create one or more bounded time segments
→ transcript_raw annotations attach to those actual evidence units
→ human review
→ translation annotation(s)
→ human review
```

`whole_artifact` is justified only when the small complete capture itself is the
evidence unit — not as a convenience alias for missing time bounds. Examples
that typically require time segmentation: multiple speakers/turns, Maninka +
French code-switching, music/jingle before speech, unrelated speech portions,
phone insert plus studio speech, multiple independent utterances.

Machine draft ASR may be useful later as **non-authoritative assist** only.
Not implemented or run in this slice.

## 12. Metadata structure

**Verified (validation subset):** multi-tag annotation including language(s),
speaker count, telephone speech, noise characteristics.

**Unknown without archive inspection:** schema of tag files; station/program
fields; filename conventions linking clip → archive provenance.

**Provenance path for SiraLex (proposed, not implemented):**

```text
OpenSLR SLR105 package
→ source row (dataset + license + citation)
→ artifact (clip storage_ref + checksum)
→ listen / inspect the 30s capture
→ segment(s): whole_artifact ONLY if the complete clip is the evidence unit;
   otherwise exact time-bounded segment(s)
→ annotations / reviews attached to those segments
```

## 13. Lexical-yield analysis (qualitative)

### Heuristic (not a numeric score)

```text
CORPUS LEXICAL YIELD
≈
distinct reviewable lexical/phrase evidence
relative to
acquisition + segmentation + transcription + translation + review effort
```

### Dimensions

| Dimension | SLR105 expectation | Basis |
|-----------|--------------------|-------|
| A. Lexical diversity potential | **High** vs SLR106 | Natural radio content; not closed VA prompts |
| B. Naturalness | **High** | News/shows/calls |
| C. Semantic/domain diversity | **Medium–high (inferred)** | News + varied shows; domains not enumerated in metadata pages |
| D. Language-ID confidence | **Low on bulk; medium on tagged val** | Unlabeled main set; 300 tagged |
| E. Segmentation readiness | **Medium** | Already 30 s clips; finer utterance cuts still needed for dictionary phrases |
| F. Transcription burden | **High** | No transcripts; noise/multi-speaker |
| G. Translation burden | **High** | No translations; follows transcription |
| H. Speaker/context diversity | **Likely high; weakly documented** | Many shows/stations; no speaker IDs like SLR106 |
| I. Provenance quality | **Medium–high** | OpenSLR + paper + station-archive origin; clip→archive linkage TBD |
| J. Rights/reuse posture | **Clear for internal pilot; cautious for publication** | CC BY-SA 4.0 |
| K. Human-review cost | **High per minute of audio** | Noise + LID + orthography + meaning |

**Yield judgment:** For vocabulary growth, SLR105’s expected **distinct phrase
yield per reviewed minute** is materially higher than further SLR106 sampling,
despite much higher transcription cost. That tradeoff is acceptable for the next
pilot **if** selection is restricted to high-confidence Maninka-tagged,
preferably single-speaker, speech-forward clips.

## 14. Comparison with SLR106

| | SLR106 (observed) | SLR105 (documented) |
|--|-------------------|---------------------|
| Strengths | Clean short WAVs; explicit metadata; adult filter; supplied orthography; EN/FR; easy review; multi-speaker of **same** items | Natural radio speech; domain richness; scale; Maninka listed; CC BY-SA; tagged validation for LID/noise/multi-speaker |
| Weaknesses | Closed VA vocab; repetition; 24→6 expressions; weak dictionary growth | ~16 G; unlabeled bulk; no transcripts; noise/music; LID cost; unknown Maninka tagged count |
| Best use | Pronunciation / pipeline / review mechanics | Lexical/phrase discovery after gated selection |
| Failure mode if misused | Pretend 48 rows = 48 lexical facts | Download all 16 G and transcribe randomly |

SLR106 was **not a failed dataset**. It proved CORPUS1 machinery. It is simply
the wrong **next** acquisition for lexical growth.

## 15. Human transcription burden

Expect, per selected 30 s clip:

- multiple listen passes
- possible music/phone overlays
- possible multi-speaker turns
- orthography decisions under uncertainty
- `transcript_raw` annotation + fingerprint + review

Order-of-magnitude: **far higher** than SLR106’s import-of-vocab-CSV path.
Pilot size must stay small (see §18).

## 16. Human translation burden

Only after accepted (or at least reviewed) Maninka transcript evidence:

- EN and/or FR translation annotations as **separate** subjects
- no automatic inheritance from SLR106 translation acceptances
- CORPUS1F3/F4 worksheet/review machinery remains applicable

Translation cost is **conditional** on transcription success.

## 17. ELAN decision

**ELAN_DECISION_REQUIRES_REAL_PILOT**

Rationale:

- 30 s clips are long enough that time-aligned regions **may** matter.
- Multi-speaker / overlap / music are documented risk factors.
- CSV-only replay may become painful, but the first pilot can preferentially
  select **single-speaker, speech-forward** tagged clips and defer ELAN until
  friction is demonstrated.
- EAF→SiraLex import remains unimplemented; do not block a minimal pilot solely
  on ELAN engineering.

Do **not** implement ELAN in this slice.

## 18. Proposed next pilot (design only — not run)

**Do not optimize for number of clips.**

Proposed shape:

1. **Gate:** inspect validation-tag metadata; enumerate Maninka-tagged clips.
2. **Select ~10–20 clips** maximizing:
   - high-confidence Maninka tag
   - single-speaker preference when tagged
   - low music / high speech usability (from tags + listen)
   - distinct content / shows when observable
   - manageable audio quality
3. **Avoid:** selecting many clips that are the same jingle, same bumper, or
   near-duplicate speech merely to inflate artifact count.
4. **Pipeline:** source → artifact → **listen first** → segment (`whole_artifact`
   only when the complete 30s clip is one coherent evidence unit; otherwise
   time-bounded segments) → manual `transcript_raw` → review → optional
   translation → review.
5. **Success metric:** distinct reviewable Maninka lexical/phrase evidence
   produced — **not** “N WAVs ingested.”

Adjust count downward if Maninka-tagged usable clips are scarce; that is a
**stop condition**, not a reason to invent labels.

## 19. Stop conditions (abort or redesign)

Recommend against immediate bulk acquisition / expansion if:

- Maninka-tagged validation yield is too small or tags are too weak
- rights posture for **internal** pilot use becomes disputed relative to the
  recorded CC BY-SA audit posture
- sampled clips are mostly music / unusable speech
- provenance cannot link clip → package → license → citation
- transcription cost for usable distinct phrases overwhelms expected yield
- another already-audited source clearly dominates for Guinean Maninka lexicon
  (none identified in this audit as superior **and** equally accessible)

## 20. Recommended next action

```text
1. Keep SLR106 closed for vocabulary expansion.
2. Plan a gated SLR105 validation-subset inspection (future slice).
3. Only then select 10–20 natural-speech Maninka candidates.
4. Transcribe + review manually; measure distinct lexical/phrase yield.
5. Revisit ELAN after real transcription friction data.
6. Still no dictionary promotion from corpus until natural-speech evidence
   proves it can create new product-grade knowledge.
```

**Do not acquire or download in this task.**  
**Do not begin CORPUS1G / SLR105 ingestion here.**

## 21. Files added / modified

### CORPUS1F5 (this slice)

Added:

- `docs/reports/corpus1f5_natural_speech_lexical_yield_audit.md`

### CORPUS1F4 (committed earlier in this session)

- `docs/reports/corpus1f4_translation_review_persistence.md`
- `api/corpus_reviews/tests/test_translation_review_worksheet_v3.py`
  (dynamic registry non-mutation invariant)

## 22. Tests

CORPUS1F4 verification: **205 passed** (full corpus suite).

CORPUS1F5: documentation-only; no new code tests required.

## 23. git diff --check

PASS expected for this documentation file (see final return).

## 24. Working tree

CORPUS1F5 report left **uncommitted** for review.  
`web/scripts/` untouched. No corpus download. No schema/runtime changes.
