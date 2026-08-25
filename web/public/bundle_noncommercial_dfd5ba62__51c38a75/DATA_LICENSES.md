# SiraLex data licenses

This document describes licensing for **lexical and corpus data** in SiraLex.
It does **not** replace the software license.

## Software code

Application code in this repository is dual-licensed under **MIT OR Apache-2.0**
(your choice). See `LICENSE-MIT` and `LICENSE-APACHE`.

The repository-level software license does **not** apply to third-party lexical
or corpus content ingested from external sources.

## Lexical and data content

Lexical records, search indexes, aliases, supplements, and other data artifacts
retain **source-specific** rights recorded in `shared/sources/*.yaml`.

SiraLex is developed as **non-commercial language infrastructure**. Distribution
of data content must respect each source's recorded license and attribution
requirements.

## Mali-pense / Malidaba (`src_malipense`)

| Field | Value |
| --- | --- |
| Source ID | `src_malipense` |
| Title | Mali-pense / Malidaba Maninka dictionary |
| URL | https://www.mali-pense.net/ |
| Claimed license | CC BY-NC-SA 4.0 |
| License evidence | https://www.mali-pense.net/emk/lexicon/indexfr.htm |

Registry authority: `shared/sources/malipense.yaml`

Adapted Mali-pense / Malidaba lexical content distributed in SiraLex bundles:

- requires **attribution** to the source and authors recorded in the registry;
- is **NonCommercial** (NC);
- carries **ShareAlike** (SA) obligations on adapted lexical data derivatives.

Attribution text is generated from durable registry metadata, not hard-coded
report prose.

## SiraLex owner-reviewed lexical additions (`src_siralex_lexical_review`)

| Field | Value |
| --- | --- |
| Source ID | `src_siralex_lexical_review` |
| Claimed license | `project-internal-review` |
| External noncommercial distribution | **not recorded** |

Registry authority: `shared/sources/siralex_lexical_review.yaml`

Rows under this source identity reflect owner-reviewed lexical governance.
`project-internal-review` records review state; it does **not** by itself
authorize external distribution. Such content is excluded from distributable
noncommercial candidates until explicit distribution permission is recorded in
the source registry from documented authority.

## Bundle manifests

Offline bundles that include lexical data carry machine-readable per-source
license metadata in `bundle.manifest.json` (`bundle_manifest_v2`), plus portable
`ATTRIBUTION.txt` and this document when present in the bundle directory.

Software license metadata in the manifest applies to the bundle packaging
software/schema only. Data licenses remain source-specific.

## Questions and takedown

Source maintainers may request modification or removal via the project's data
removal / source maintainer request process documented in source registry entries.
