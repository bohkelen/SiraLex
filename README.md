# SiraLex

Offline-first dictionary and sentence analysis tooling for the Manding language family — starting with **Maninka (Guinea)** — with **Latin + N’Ko** treated as first-class scripts throughout. Domain: **siralx.org**.
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

## Credits and thanks (data sources)

This project builds on and modernizes existing scholarly/lexicographic resources. We are deeply grateful to the authors, maintainers, and contributors of these works.

Primary Phase 1 sources (initial ingestion targets):

- **Mali-pense French → Maninka dictionary** (lexicographic backbone)
- **Corpus Maninka de Référence** (examples selectively; not intended for bulk redistribution without explicit permission)

Design rule: provenance is stored at **entry**, **sense**, and **example** levels, and the app includes a local offline **Credits / Sources** section. If any source maintainer requests modification or removal, the system is designed to make that process straightforward.

## License

Dual-licensed under **MIT OR Apache-2.0** (you may choose either license).

See `LICENSE-MIT` and `LICENSE-APACHE`.

## Project posture (non-commercial, community)

SiraLex is built as **non-commercial language infrastructure** for learners and communities.

- We ask that downstream use **preserves attribution** and respects **source licensing/permissions**.
- We do **not** intend paywalls, “API resale”, or other extractive commercialization of the lexicon.

Note: the **code** is dual-licensed under MIT/Apache-2.0 as stated above. **Data/content** may have separate provenance and usage constraints depending on its source.

