# CORPUS1F7 — SimbaBench Western Maninkakan (`asr_test_mlq`) Audit

## 1. Decision

**CORPUS1F7_SIMBABENCH_MLQ_AUDIT_COMPLETE**

Candidate decision:

**SIMBABENCH_MLQ_TOO_REPETITIVE**

Primary reason: the accessible `asr_test_mlq` slice is a **closed-vocabulary
NicoLingua-0004 / OpenSLR SLR106** VA subset. **182 rows collapse to 20 unique
texts**, heavily repeated — not a path to distinct natural lexical growth.

## 2. Base commit

```text
8531a1103b0154881fcbdad51a5b1a48cf99f531
```

(CORPUS1F6: `Record SLR105 validation metadata gate`)

## 3. Candidate identity

| Field | Value |
|-------|-------|
| Dataset | `UBC-NLP/SimbaBench_dataset` |
| Config | `asr_test_mlq` |
| Stated language | Western Maninkakan |
| ISO | `mlq` |
| Card claim | 182 ASR test samples; ~0.04 hours; audio + text; license `cc-by-4.0` |
| Shard filename | `asr_test/HF_test-mlq*Nicolingua-0004-West-African.parquet` (~4.9 MB) |

## 4. Sources consulted

| Source | Role |
|--------|------|
| https://huggingface.co/datasets/UBC-NLP/SimbaBench_dataset | Dataset card, config table, license tag, source citations |
| HF API `datasets/UBC-NLP/SimbaBench_dataset` | Confirmed `license: cc-by-4.0` |
| HF tree `asr_test/` | Confirmed mlq-only shard + Nicolingua-0004 in filename |
| Downloaded mlq parquet only (~4.9 MB → `data/corpus1f7/`) | Row-level schema + diversity analysis |
| https://github.com/UBC-NLP/simba | Project README / VoC pointer |
| OpenSLR SLR106 / NicoLingua paper (prior CORPUS1 knowledge) | Original VA corpus identity |
| CORPUS1F SLR106 pilot + lexical-diversity finding | Comparison baseline |

## 5. Original provenance

**Verified:** SimbaBench encodes the original project in the shard name and
`benchmark_id` prefix:

```text
Nicolingua-0004-West-African
```

That is the **West African Virtual Assistant Speech Recognition Corpus**
(OpenSLR **SLR106**, Doumbouya et al. 2021) — the same closed-vocabulary VA
resource already piloted in CORPUS1F.

| Provenance layer | Finding |
|------------------|---------|
| Benchmark aggregator | SimbaBench / Voice of a Continent (UBC-NLP) |
| Original dataset | NicoLingua-0004 / SLR106 |
| Original license | **CC BY-SA 4.0** (OpenSLR / NicoLingua) |
| Original language label | Maninka (among fra/Maninka/Pular/Susu in SLR106) |
| Geography | Guinean speakers (VA collection) |
| Audio context | Elicited VA utterances (commands, digits, kinship, wake/confirm, …) |
| Transcript provenance | Closed utterance-class strings from the VA design / vocab — **benchmark reference text**, not free spontaneous transcription |

```text
SimbaBench label ≠ original linguistic authority
mlq ISO mapping ≠ automatic Guinean Maninka dictionary authority
```

## 6. License chain

| Layer | Claim |
|-------|-------|
| SimbaBench HF release | **CC BY 4.0** (`license: cc-by-4.0` on dataset card/API) |
| Original NicoLingua-0004 / SLR106 | **CC BY-SA 4.0** |

**Audit posture:** for SiraLex, treat **original CC BY-SA constraints as still
relevant** for redistributed audio/text derivatives even when the aggregator
card says CC BY 4.0. This is rights modeling, not a legal determination.

| Use | Posture |
|-----|---------|
| Local storage / internal analysis / private review | Compatible with recorded audit posture |
| Public dictionary examples / pronunciation publication / audio redistribution / commercial reuse | **Blocked / unknown** until separate rights review |

## 7. Accessibility

| Question | Answer |
|----------|--------|
| Independent of full SimbaBench? | **YES** — config `asr_test_mlq` maps to one parquet shard |
| Row-level access | **YES** |
| Audio available | **YES** (embedded `audio.bytes` in parquet; 0 missing) |
| Text available | **YES** (0 empty) |
| `benchmark_id` stable | **YES** — 182 unique IDs |
| mlq-only download size | **~4.92 MB** parquet (includes audio bytes) |

No unrelated languages downloaded.

## 8. Actual schema

Verified columns:

| Column | Type (parquet) |
|--------|----------------|
| `split` | string (`test` only) |
| `benchmark_id` | string |
| `audio` | struct[`bytes`, `path`] (`path` null; bytes present) |
| `text` | string |
| `duration_s` | float |
| `lang_iso3` | string (`mlq`) |
| `lang_name` | string (`Western Maninkakan`) |

## 9. Row / duration statistics

| Metric | Value |
|--------|------:|
| Rows | **182** (matches card) |
| Unique `benchmark_id` | 182 |
| Empty text | 0 |
| Missing audio bytes | 0 |
| Total duration | **≈153.3 s ≈ 0.0426 h** (matches ~0.04 h claim) |
| Min / median / max duration | 0.54 s / 0.785 s / 1.53 s |

## 10. Exact / normalized text diversity

Minimal descriptive normalization only: Unicode NFC + trim + collapse
whitespace. Original `text` unchanged in source files.

| Metric | Count |
|--------|------:|
| Unique exact texts | **20** |
| Unique normalized texts | **20** |
| Rows beyond unique texts | **162** |

Unique normalized strings (all 20):

```text
Simbon
e-hen
fila
foci
kelen
konondo
lolu
mo do bila a kono
mo do gninin
n'fa
n'na
nanin
ohon
saba
sein
wo bo a kono
wo mafalin
wo wolé
woro
woronwila
```

## 11. Duplicate distribution

Normalized-text frequency: every unique string appears **5–13 times**.

Examples: `wo bo a kono` ×13; several commands/tokens ×11–12; `Simbon` ×5.

No punctuation-only rows.

## 12. Descriptive token diversity

Whitespace-delimited descriptors only (not linguistic segmentation):

| Metric | Value |
|--------|------:|
| Token instances | 309 |
| Unique token forms | **25** |
| Tokens/row min / median / max | 1 / 1 / 5 |

## 13. Naturalness / content origin

**Elicited / scripted closed-vocabulary VA speech** (NicoLingua VA design).

Not spontaneous conversation, not radio broadcast, not Bible reading, not
synthetic (human-recorded VA prompts). Short command/digit/kinship-style
utterances.

```text
high text diversity ≠ natural conversational evidence
```

Here, text diversity is **low** anyway.

## 14. Variety identity

**VARIETY_MATCH_PLAUSIBLE**

- SimbaBench labels ISO `mlq` / Western Maninkakan.
- Original source is Guinean NicoLingua Maninka VA data.
- Plausible Western Maninkakan / Guinean Maninka relationship, but **not** a
  strong automatic identity claim for SiraLex dictionary authority.

Do not collapse with Bambara, Mandinka, or other Manding labels.

## 15. Transcript provenance

`text` is **benchmark reference / imported closed utterance-class text** from
the NicoLingua VA resource — not an independently produced free transcript of
open speech.

If ever imported later:

- do **not** invent `manual_transcription` unless a human re-transcribes
- creation_method must reflect import / benchmark-reference provenance
- text remains evidence, not reviewed SiraLex truth

## 16. Rights posture

See §6. Internal private evidence use: audit-compatible under CC chain with
attribution / ShareAlike caution. Publication uses remain blocked/unknown.

## 17. Comparison with SLR106 (CORPUS1F observed)

| | SLR106 pilot (observed) | SimbaBench `asr_test_mlq` |
|--|-------------------------|---------------------------|
| Source family | NicoLingua-0004 / SLR106 | **Same** |
| Rows inspected | 24 transcripts | 182 |
| Unique Maninka expressions | **6** | **20** |
| Realizations | 4 speakers × 6 exprs | 5–13 repeats per string |
| Nature | Closed VA | Closed VA |
| Lexical-growth value | Low | **Low** (broader closed vocab coverage, not new domains) |

Overlap with CORPUS1F’s six pilot expressions: **all 6** appear inside the 20
unique `asr_test_mlq` texts.

## 18. Comparison with blocked SLR105 path

| | SLR105 (deferred) | SimbaBench mlq |
|--|-------------------|----------------|
| Potential natural lexical yield | High (hypothesis) | Low (measured) |
| Accessibility of selectable evidence | Blocked (no clip-level tags) | Excellent (~5 MB) |
| Role | Future natural-speech path | Low-cost closed-vocab / pronunciation secondary |

Accessibility ≠ lexical yield.

## 19. Lexical-yield assessment

```text
UNIQUE TEXTUAL EVIDENCE / ROWS ≈ 20 / 182 ≈ 11%
UNIQUE TEXTS / MINUTES ≈ 20 / 2.55 ≈ 7.8 unique strings per minute
```

Descriptors only — not dictionary headwords.

Assessment: **poor corpus lexical yield for growth**. Useful mainly as another
view of the same VA closed set (more utterance classes than the 24-clip CORPUS1F
sample, still closed).

## 20. Recommended pilot decision

**SIMBABENCH_MLQ_TOO_REPETITIVE**

Not recommended as a small **lexical-growth** pilot.

Optional later secondary use (out of scope here): pronunciation / ASR eval
across the 20 closed classes — **not** vocabulary discovery.

## 21. Proposed pilot shape

**No ingestion.**

If a future secondary pronunciation pass were desired (not authorized now):

- work from the **20 unique texts**, not all 182 rows
- pick few speaker realizations per class
- do not report 182 as 182 lexical facts

Because CORPUS1F already exercised SLR106 review machinery, SimbaBench mlq adds
little new architectural learning.

## 22. Unknowns

- Exact SimbaBench sampling rule that chose these 182 SLR106 rows for `test`
- Whether HF CC BY 4.0 packaging was intended to relicense ShareAlike material
  (treat conservatively)
- Finer dialect geography beyond Guinean VA collection + `mlq` mapping

## 23. Stop conditions

Triggered for lexical-growth acquisition:

- structurally closed VA vocabulary
- extreme repetition (182→20)
- same original source already piloted

Not triggered: access blocked; provenance unrecoverable.

## 24. Files added / modified

Tracked (uncommitted):

- `docs/reports/corpus1f7_simbabench_mlq_audit.md`

## 25. Local artifacts (gitignored under `data/*`)

- `data/corpus1f7/HF_test-mlq_Nicolingua-0004-West-African.parquet`
- `data/corpus1f7/mlq_metadata_only.jsonl`
- `data/corpus1f7/mlq_diversity_summary.json`

No SiraLex corpus registry rows created. Audio not promoted to canonical corpus
evidence.

## 26. git diff --check

PASS expected (see final return).

## 27. Working tree

CORPUS1F7 report left **uncommitted**. `web/scripts/` untouched. No schema /
dictionary / runtime mutation.
