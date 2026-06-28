# Result Interpretability Feasibility Audit

Status: analysis only. Do not implement before Phase 6C confirms this is a priority relative to setup, search misses, and content coverage.

## Question

When a French query maps to multiple Maninka target forms, can the current bundle data already help users distinguish the choices?

Example user signal:

- `amour` returns multiple target forms such as `díyaɲɛ`, `jàrabi`, `kànin`, `ládiyaɲɛ`, `tìn`, and `yàrabi`.
- The user may not know which one to choose.

## Current Data Shape

The featured `norm_v3` display-enriched bundle has two relevant record shapes:

- `lexicon_entry` records: often include `display.senses`, French/English/Russian glosses, examples, synonyms, sub-entries, N'Ko, and corpus counts.
- `index_mapping` records: represent French source terms and include `display.target_entries` with target form display text plus original lexicon URL/anchor references.

Important current limitation:

- `index_mapping.display.target_entries` contains target display text and source anchor references, but not the target entry's gloss/sense summary.
- The current committed bundle does not expose a direct join key from `target_entries[].anchor` to `lexicon_entry.display.anchor_names`; a quick audit found no links joinable through that field.

So the underlying lexicon records often contain useful differentiating content, but the French-to-target index mapping surface does not currently carry enough of that content directly.

## Frequency Snapshot

Measured against `web/public/bundle_full_20260518_15605571`:

- Total records: 19,324
- `index_mapping` records: 10,501
- French index mappings with more than one target entry: 3,830
- Multi-target mapping rate: 36.47%
- Largest mapping: 27 target entries

Target-count distribution for French index mappings:

- 1 target: 6,671 records
- 2 targets: 2,117 records
- 3 targets: 787 records
- 4 targets: 416 records
- 5 targets: 209 records
- 6 or more targets: 301 records

Examples with many targets:

- `très`: 27 targets
- `maintenant`: 19 targets
- `NOM.M`: 17 targets
- `commencer`: 15 targets
- `esprit`: 15 targets
- `mélanger`: 14 targets
- `salut`: 14 targets
- `tomber`: 14 targets
- `parce que`: 13 targets
- `sérieux`: 13 targets

Search-index ambiguity is broader than French index-mapping ambiguity:

- Ambiguous search-index entries: 12,313
- Source-side ambiguous entries: 478
- Target-side ambiguous entries: 11,835
- Unique records appearing in ambiguous search-index results: 5,586
- Of those ambiguous records, 5,280 have some gloss text, 3,887 have French gloss or French sub-entry text, and 672 have examples.

Interpretation:

- Multi-target French results are common enough to justify a real product track if Phase 6C confirms user friction.
- Target-side ambiguity is very common, especially for short N'Ko/Latin target forms, but it may be a different problem from French-to-Maninka sense choice.

## Feasibility Assessment

### Does Current Display Data Contain Enough To Help?

Partly.

For full `lexicon_entry` records, yes: many records already have glosses, examples, synonyms, and sub-entry text that could differentiate senses or near-synonyms.

For `index_mapping` search results, not yet: the result currently exposes a list of target forms, but not enough attached explanation to distinguish those forms in-place.

The most sustainable path would likely enrich or link `index_mapping.target_entries` to a compact target summary during bundle generation, not scrape or infer this in the runtime.

### How Often Do Multi-Target Ambiguous Results Occur?

Often on French index mappings: 3,830 of 10,501 mappings have more than one target entry.

Most ambiguous mappings are small:

- 2-target mappings account for more than half of multi-target cases.
- A smaller tail has 6+ targets and may need stronger UI treatment or curation.

### Content Problem, Result-Card Design Problem, Or Both?

Both.

Content/data problem:

- The source-to-target mapping does not currently include compact sense labels or differentiating glosses per target.
- Some target entries may have enough detail in lexicon records, but the bundle does not currently expose a direct runtime join path for the mapping surface.
- Some distinctions may genuinely require editorial/sense curation rather than automatic display.

Result-card design problem:

- A flat list of forms is not enough when users need to choose between near-synonyms or sense-specific translations.
- Even one-line gloss chips, usage labels, or short examples could help if the data is available.
- Large mappings need prioritization or grouping so the card does not become noisy.

## Possible Future Tracks

1. **Compact target summaries in bundle generation**
   - Add generated per-target summary fields to `index_mapping.display.target_entries`.
   - Keep the runtime simple.
   - Version the display contract.

2. **Result-card grouping**
   - Group targets by sense/gloss when reliable summaries exist.
   - Keep a fallback flat list for entries without summaries.

3. **Manual curation for high-friction mappings**
   - Use Phase 6C logs to identify frequently searched ambiguous French terms.
   - Curate only the highest-value mappings first.

4. **Correction/content workflow integration**
   - Treat unclear target differentiation as correction/content feedback when the issue is data quality, not UI layout.

## Recommendation For Now

Do not implement yet.

During Phase 6C, track:

- Which French queries produce "I do not know which result to pick" feedback.
- Whether those queries overlap with high target-count mappings.
- Whether users need glosses, examples, usage labels, or ranking.
- Whether the issue appears in fresh-user sessions or only after deeper dictionary use.

If confirmed, start with a bundle/display-contract design for compact target summaries before changing the runtime UI.
