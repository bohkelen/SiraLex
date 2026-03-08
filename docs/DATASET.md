# SiraLex Dataset v1.0

This document describes the first frozen dataset release of the SiraLex project.

## What is in v1.0

The dataset covers **Maninka (Guinea)** lexicographic data extracted from the Mali-pense French-Maninka dictionary. It includes:

- **8,823 lexicon entries** with headwords (Latin + N'Ko when source-provided), senses, translations (French, English, Russian where available), examples, and POS tags.
- **10,501 French-to-Maninka index mappings** linking French terms to lexicon entries.
- **19,324 normalized records** with search keys in 4 types: case-insensitive, diacritics-insensitive, punctuation-stripped, and no-space (phone-typing).

Scripts represented: Latin (primary), N'Ko (where provided by source).

## What is frozen

The git tag `v1.0-dataset-freeze` marks the immutability boundary. The following artifacts are frozen:

| Artifact | File | Count |
|---|---|---|
| Lexicon IR | `data/ir/malipense_lexicon_v3.jsonl` | 8,823 |
| Index IR | `data/ir/malipense_index_v1.jsonl` | 10,501 |
| Normalized records | `data/normalized/malipense_normalized_norm_v1.jsonl` | 19,324 |

Parser versions: `malipense_lexicon_v3`, `malipense_index_v1`
Normalization ruleset: `norm_v1` (pure Unicode transforms, no auxiliary data)

**Immutability contract**: these artifacts will never be modified in place. Any future corrections or rule changes produce new versions (e.g., `malipense_lexicon_v4`, `norm_v2`).

## How to cite

If you use this dataset in research or other projects, please cite:

> SiraLex Project. *SiraLex Maninka Lexicon Dataset v1.0*. 2026. Available at: https://github.com/bohkelen/siralex (tag: `v1.0-dataset-freeze`).

The underlying lexicographic data originates from:

> Mali-pense. *Dictionnaire Maninka*. https://www.mali-pense.net/emk/lexicon/

Please also credit the original source authors per the attribution policy in `docs/SOURCES.md`.

## How to report errors

If you find errors in the dataset (incorrect translations, missing diacritics, wrong POS tags, etc.):

1. **Open a GitHub issue** using the appropriate template:
   - "Data removal / source maintainer request" for rights-related concerns
   - "Normalization rule change" for normalization behavior issues
   - A general bug report for data quality issues

2. **Be specific**: include the headword, the `ir_id` if you have it, and what you believe is incorrect.

Corrections are tracked as separate records and applied in future dataset versions, never as in-place edits to frozen artifacts.
