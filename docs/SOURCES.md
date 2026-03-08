# Sources, attribution, and provenance

SiraLex modernizes and makes usable (including offline) a set of existing scholarly and lexicographic resources with **attribution-first** intent.

## Principles

- **Attribution-first**: sources are credited in-app and in the repository.
- **Fine-grained provenance**: every imported record is traceable at **entry**, **sense**, and **example** levels.
- **Revocation is possible**: the system is designed so a source can be disabled or removed without rewriting the entire dataset.
- **Non-commercial posture**: we do not intend paywalls or extractive commercialization of the lexicon (see `README.md`).

## Phase 1 ingestion targets

### Mali-pense French → Maninka dictionary

- **Role**: primary lexicographic backbone (Phase 1)
- **Use**: dictionary entries, structured senses/translations (as permitted)
- **Attribution**: always include source name + URL + retrieval date in provenance

### Corpus Maninka de Référence

- **Role**: examples (selective)
- **Use**: examples are used selectively; we avoid bulk redistribution until explicit permission is confirmed
- **Attribution**: include source name + URL + retrieval date per example provenance

## Provenance fields (stored with imported data)

At minimum:

- `source_name`
- `source_url`
- `retrieved_at`
- `license_notes`
- `source_record_id` (or stable pointer to the source page/record when possible)

## Removal / modification requests

If you are a source maintainer, author, or rights holder and you want content modified or removed:

- Please open an issue using the **“Data removal / source maintainer request”** template, or contact the maintainers via GitHub.
- We will respond promptly and can:
  - disable a source in future builds,
  - remove or redact affected records from offline bundles,
  - keep an internal audit trail of what changed and why.

We aim to be maximally respectful: this work is intended to improve accessibility and utility while preserving credit and authority.

