# SiraLex

Offline-first dictionary and sentence analysis tooling for the Manding language family — starting with **Maninka (Guinea)** — with **Latin + N’Ko** treated as first-class scripts throughout. Domain: **siralex.org**.
100% built with AI. Why not!

## What it aims to do (Phase 1)

- **Dictionary lookup**
  - French ↔ Maninka
  - English ↔ Maninka
  - Display results in **Latin and N’Ko** (N’Ko is always generated when not explicitly provided)
- **Sentence analysis**
  - Given a French or English sentence, produce a **best-guess Maninka sentence**
  - Provide a transparent per-token/per-phrase breakdown and mark uncertainty when appropriate
- **Offline-first**
  - Designed to work on low/mid-range Android devices, with a small seed dataset and an optional full offline download later
- **Community feedback loop**
  - Anonymous suggestions/corrections for spelling, translations, examples, POS, N’Ko, and notes
  - Moderation workflow with **audit trail + rollback** (planned early; expanded later)

## How to Use SiraLex

Phase 4.5 bundle distribution and user operation are documented here:

- `docs/USER_GUIDE.md`
- `docs/BUNDLE_DISTRIBUTION.md`
- `docs/BUILD_BUNDLE.md`

## Credits and thanks (data sources)

This project builds on and modernizes existing scholarly/lexicographic resources. We are deeply grateful to the authors, maintainers, and contributors of these works.

Primary Phase 1 sources (initial ingestion targets):

- **Mali-pense French → Maninka dictionary** (lexicographic backbone)
- **Corpus Maninka de Référence** (examples selectively; not intended for bulk redistribution without explicit permission)

Design rule: provenance is stored at **entry**, **sense**, and **example** levels. After installing a dictionary bundle, open **More → Credits & sources** to view offline source attribution, data licenses (including Mali-pense / Malidaba **CC BY-NC-SA 4.0**), and the separate **MIT OR Apache-2.0** software license. Per-entry source information is also shown in dictionary entries. Bundle-sidecar files (`ATTRIBUTION.txt`, `DATA_LICENSES.md`) and `bundle_manifest_v2` carry the same registry-driven metadata for portable distribution.

## License

### Software code

Dual-licensed under **MIT OR Apache-2.0** (you may choose either license).

See `LICENSE-MIT` and `LICENSE-APACHE`.

### Lexical and data content

**Data/content retains source-specific licensing.** The repository software
license does not relicense third-party lexical content.

See [`DATA_LICENSES.md`](DATA_LICENSES.md) for per-source rights, including:

- Mali-pense / Malidaba-derived data: **CC BY-NC-SA 4.0** (`src_malipense`)
- Owner-reviewed additions: governed separately (`src_siralex_lexical_review`)

## Project posture (non-commercial, community)

SiraLex is built as **non-commercial language infrastructure** for learners and communities.

- We ask that downstream use **preserves attribution** and respects **source licensing/permissions**.
- We do **not** intend paywalls, “API resale”, or other extractive commercialization of the lexicon.
- Not all repository contents are "open source" under one license: **code** is MIT/Apache-2.0; **lexical data** follows source-specific terms.

