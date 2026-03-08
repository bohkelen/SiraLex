# Contributing to SiraLex

Thanks for helping build SiraLex. This project touches sensitive areas (language correctness, community trust, and third‑party sources), so we optimize for **traceability** and **respect for provenance**.

## Ground rules

- **No silent changes to meaning**: if you change translations, POS tags, examples, or transliteration logic, explain the rationale and expected impact.
- **Provenance matters**: do not paste large blocks of third‑party content unless we have clear permission. Always link sources and preserve attribution.
- **No hallucinated language**: uncertain outputs must be marked as such; do not invent “authoritative” forms.
- **Keep changes scoped**: one PR should do one thing.

## How to propose changes

1. Open an issue first if the change is non-trivial (new source, normalization rules, transliteration rules, schema changes).
2. Create a branch from `main`.
3. Open a PR. Fill out the PR template checklist.

## What belongs in issues vs PRs

- **Issues**:
  - new data sources / licensing questions
  - normalization rule changes
  - transliteration mapping changes
  - “removal request” from a source maintainer
- **PRs**:
  - code + tests (once they exist)
  - documentation improvements
  - small refactors

## Reporting translation/transliteration problems

If you spot something wrong:
- file a **Transliteration bug** issue (for Latin ↔ N’Ko mapping behavior), or
- file a **Bug report** (for UI/search/behavior).

Include:
- input (Latin and/or N’Ko)
- expected output
- actual output
- device/browser info (if relevant)

## Code of conduct

Be respectful. This is language infrastructure work for real communities.

