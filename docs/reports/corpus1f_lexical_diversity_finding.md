# CORPUS1F — SLR106 Lexical-Diversity Finding

## Decision

**CORPUS1F_SLR106_LEXICAL_DIVERSITY_FINDING_RECORDED**

## Empirical pilot counts

| Measure | Count |
|---------|------:|
| `transcript_raw` annotation instances | 24 |
| Distinct adult speakers | 4 |
| Unique Maninka expressions | 6 |
| Speaker realizations per expression | 4 |
| Translation annotation instances | 48 |
| English translation instances | 24 |
| French translation instances | 24 |

Linguistic collapse of the translation set:

| Measure | Count |
|---------|------:|
| Unique Maninka → English mappings | 6 |
| Unique Maninka → French mappings | 6 |
| Unique semantic mappings (EN + FR) | 12 |

Therefore:

```text
48 translation annotation records ≠ 48 independent lexical facts
```

Arithmetic:

```text
6 unique Maninka expressions
× 4 speakers
= 24 audio / transcript instances

24 instances
× 2 translations (English + French)
= 48 translation worksheet rows
```

## Unique expressions observed

Confirmed from the local CORPUS1F SLR106 pilot annotations (dataset vocab
mappings; not newly invented):

| Maninka | Dataset English | Dataset French | Audio instances |
|---------|-----------------|----------------|----------------:|
| `Simbon` | Guru | Savant | 4 |
| `foci` | zero | zero | 4 |
| `kelen` | one | un | 4 |
| `mo do bila a kono` | add a person | ajoute une personne | 4 |
| `mo do gninin` | search a person | cherche une personne | 4 |
| `n'na` | Mom | Maman | 4 |

Example structure: the four `n'na` recordings are separate WAV/segment evidence
units from speakers `s023`, `s024`, `s025`, and `s027`. The same four-speaker
pattern holds for the other five expressions.

## Interpretation

SLR106 is a **closed-vocabulary virtual-assistant** corpus.

**Primary value to SiraLex in this pilot:**

- multiple-speaker pronunciation evidence
- repeated realization of the same expressions
- provenance pipeline validation
- annotation / review workflow validation
- governed human-review persistence validation

**Weakness for the current SiraLex growth objective:**

- low lexical diversity
- repeated closed-vocabulary expressions
- poor fit for broad dictionary / phrase discovery

The original audit already warned that SLR106 is more useful for
ASR/pronunciation-style evidence than general vocabulary discovery. This pilot
makes that concrete.

## Authority distinction

```text
annotation instance ≠ unique linguistic fact
speaker realization ≠ new lexical item
translation annotation instance ≠ new semantic mapping
```

Repeated rows remain **valid evidence** because each is attached to a different
audio/segment evidence unit. They support reproducibility and pronunciation
variation claims.

Do **not** deduplicate or mutate the existing pilot annotations to collapse
these rows. Storage remains instance-level; interpretation must stay
fact-aware.

## Human translation review (CORPUS1F3)

CORPUS1F3’s 48-row human translation worksheet remains **valid and unchanged**.

Each row reviews one translation annotation attached to one segment.
Repeated semantic mappings may naturally receive the same judgment.

However:

```text
48 reviewed translation annotations
must not later be reported as
48 newly validated lexical translations
```

Any later summary MUST distinguish:

- **annotation-level review count** (up to 48)
- **unique lexical/semantic mapping count** (12 in this pilot)

## Strategic acquisition decision

**STOP expanding SLR106 for vocabulary-growth purposes.**

SLR106 may remain useful later for:

- pronunciation variation
- ASR evaluation
- speaker variation
- speech-model benchmarking

The next vocabulary-oriented corpus acquisition should optimize for:

- distinct Maninka lexical items
- distinct phrases
- natural / conversational speech
- broader semantic domains
- speaker / context diversity
- strong provenance
- reviewable rights posture

Do **not** optimize primarily for raw audio-file count.

## Next corpus criterion (heuristic)

```text
Corpus lexical yield =
  distinct reviewable lexical/phrase evidence
  per unit of acquisition + transcription + review cost
```

This is an acquisition heuristic only — not a formal numeric scoring model yet.

## Next resource direction

Richer natural-speech material such as the previously audited **SLR105-class**
radio corpus is a stronger next research direction for lexical discovery than
further SLR106 sampling.

This report does **not** acquire, download, or start CORPUS1G.

## Relation to CORPUS1F3

CORPUS1F3 human translation review continues independently.

This report does not block or alter the 48-row worksheet. It records a strategic
dataset-level conclusion discovered from the pilot.

## Non-mutation

No changes to:

- `data/corpus1f/`
- annotations / translations / review registry / worksheets
- dictionary / search index / bundles / aliases / supplements
- web runtime / `web/scripts/`

Tracked change in this slice: this report file only.
