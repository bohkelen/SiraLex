# Query Validation Round 1 (Controlled Calibration)

Date: 2026-05-15  
Bundle under test: `bundle_full_20260427_ad0e7deb` (norm_v2 directional)  
Execution path: real runtime `searchQuery(...)` with IndexedDB import via `importRecordsJsonl` + `importSearchIndexJsonl` (no alternate lookup implementation)

## Summary

- total queries run: **156**
- hit count: **108**
- miss count: **48**
- hit rate: **69.2%**
- miss rate: **30.8%**
- directional check status (Task 6 strict path assertions): **39 pass / 0 contract failures**, plus **1 invalid control query** (Q088; normalization collision case, not leakage)
- ladder-level distribution:
  - casefold: 79
  - diacritics_insensitive: 10
  - punct_stripped: 12
  - nospace: 7
  - none: 48

## Interpretation pass: control misses vs actionable misses

### A) Expected-control misses (not retrieval failures)

- Directional opposite-path controls (expected miss, got miss): **19**
- Deliberate language-mismatch probes (expected miss, got miss): **6**
- Deliberate nonsense/missing-entry probes (expected miss, got miss): **6**

Total expected-control misses: **31**

### B) Actionable retrieval misses

Actionable misses here are controlled probes that point to potential indexing/coverage gaps rather than contract controls:

- spelling probes missed: **6**
- partial phrase probes missed: **5**
- inflection-like probes missed: **6**

Total actionable retrieval misses: **17**

### C) Probe-category outcomes

- directional controls: 40 total -> 39 as expected, 1 reclassified invalid control (Q088)
- spelling probes: 8 total -> 6 misses, 2 hits
- partial phrase probes: 6 total -> 5 misses, 1 hit
- inflection-like probes: 6 total -> 6 misses
- language mismatch probes: 6 total -> 6 misses (expected)
- missing-entry probes: 6 total -> 6 misses (expected)

## Query set methodology

This round is a **controlled calibration exercise**, not real-user behavior analysis.

- Query set intentionally mixes:
  - known expected hits (source terms/phrases, target latin/N'Ko keys)
  - strict directional checks (expected opposite-direction misses)
  - normalization ladder probes (case, punctuation, diacritics, spacing)
  - failure probes (spelling, phrase truncation, inflection-like variants, language mismatch, missing-entry probes)
- Target volume exceeded 100 queries to surface recurring patterns under deterministic conditions.
- Failure-class labels are **analyst interpretation**, applied manually per probe intent and observed outcome (not automated classification).

## Results table

| id | query | direction | expected outcome | actual outcome | hit/miss | ladder level | failure class (analyst) | notes |
|---|---|---|---|---|---|---|---|---|
| Q001 | (fruit) blet | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q002 | à cause de | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q003 | à côté | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q004 | à côté de | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q005 | à deux entrées | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q006 | à l'extérieur | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q007 | à l'extérieur de | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q008 | à l'insu de | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q009 | à l'insu de qqn | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q010 | à l’intérieur | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q011 | à la mesure de | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q012 | à la vue perçante | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q013 | à part | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q014 | à part ça | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q015 | à partir d'aujourd'hui | source_to_target | hit | hit (1) | hit | casefold |  | known_source_hit; known source casefold term |
| Q016 | (fruit) blet | source_to_target | hit | hit (1) | hit | casefold |  | known_source_phrase_hit; known multiword source phrase |
| Q017 | à cause de | source_to_target | hit | hit (1) | hit | casefold |  | known_source_phrase_hit; known multiword source phrase |
| Q018 | à côté | source_to_target | hit | hit (1) | hit | casefold |  | known_source_phrase_hit; known multiword source phrase |
| Q019 | à côté de | source_to_target | hit | hit (1) | hit | casefold |  | known_source_phrase_hit; known multiword source phrase |
| Q020 | à deux entrées | source_to_target | hit | hit (1) | hit | casefold |  | known_source_phrase_hit; known multiword source phrase |
| Q021 | à l'extérieur | source_to_target | hit | hit (1) | hit | casefold |  | known_source_phrase_hit; known multiword source phrase |
| Q022 | à l'extérieur de | source_to_target | hit | hit (1) | hit | casefold |  | known_source_phrase_hit; known multiword source phrase |
| Q023 | à l'insu de | source_to_target | hit | hit (1) | hit | casefold |  | known_source_phrase_hit; known multiword source phrase |
| Q024 | à l'insu de qqn | source_to_target | hit | hit (1) | hit | casefold |  | known_source_phrase_hit; known multiword source phrase |
| Q025 | à l’intérieur | source_to_target | hit | hit (1) | hit | casefold |  | known_source_phrase_hit; known multiword source phrase |
| Q026 | (fruit) blet | source_to_target | hit | hit (1) | hit | casefold |  | known_source_punct_hit; punctuation-heavy source phrase |
| Q027 | à la différences des bambara où l'homme visite ses femmes dans leurs maisons) | source_to_target | hit | hit (1) | hit | casefold |  | known_source_punct_hit; punctuation-heavy source phrase |
| Q028 | à partir de x jusqu'à y, de x à y | source_to_target | hit | hit (1) | hit | casefold |  | known_source_punct_hit; punctuation-heavy source phrase |
| Q029 | à.cause.de | source_to_target | hit | hit (1) | hit | casefold |  | known_source_punct_hit; punctuation-heavy source phrase |
| Q030 | à.côté | source_to_target | hit | hit (1) | hit | casefold |  | known_source_punct_hit; punctuation-heavy source phrase |
| Q031 | ߊ߫ | target_to_source | hit | hit (1) | hit | casefold |  | known_target_nko_hit; known N'Ko target key |
| Q032 | ߊ߬ | target_to_source | hit | hit (1) | hit | casefold |  | known_target_nko_hit; known N'Ko target key |
| Q033 | ߊ߯ | target_to_source | hit | hit (1) | hit | casefold |  | known_target_nko_hit; known N'Ko target key |
| Q034 | ߊ߰ | target_to_source | hit | hit (2) | hit | casefold |  | known_target_nko_hit; known N'Ko target key |
| Q035 | ߊ߲ | target_to_source | hit | hit (1) | hit | casefold |  | known_target_nko_hit; known N'Ko target key |
| Q036 | ߊ߬ ߊ߫ | target_to_source | hit | hit (1) | hit | casefold |  | known_target_nko_hit; known N'Ko target key |
| Q037 | ߊ߬ ߊ߬ | target_to_source | hit | hit (1) | hit | casefold |  | known_target_nko_hit; known N'Ko target key |
| Q038 | ߊ߫ ߊ߫ ߊ߫ | target_to_source | hit | hit (1) | hit | casefold |  | known_target_nko_hit; known N'Ko target key |
| Q039 | ߊߌ߬ | target_to_source | hit | hit (1) | hit | casefold |  | known_target_nko_hit; known N'Ko target key |
| Q040 | ߊߒ߬ߞߍ߫ | target_to_source | hit | hit (2) | hit | casefold |  | known_target_nko_hit; known N'Ko target key |
| Q041 | -ba | target_to_source | hit | hit (1) | hit | casefold |  | known_target_latin_hit; known latin target key |
| Q042 | -baa | target_to_source | hit | hit (1) | hit | casefold |  | known_target_latin_hit; known latin target key |
| Q043 | -bali | target_to_source | hit | hit (1) | hit | casefold |  | known_target_latin_hit; known latin target key |
| Q044 | -da | target_to_source | hit | hit (1) | hit | casefold |  | known_target_latin_hit; known latin target key |
| Q045 | -ka | target_to_source | hit | hit (1) | hit | casefold |  | known_target_latin_hit; known latin target key |
| Q046 | -la | target_to_source | hit | hit (5) | hit | casefold |  | known_target_latin_hit; known latin target key |
| Q047 | -lama | target_to_source | hit | hit (1) | hit | casefold |  | known_target_latin_hit; known latin target key |
| Q048 | -lan | target_to_source | hit | hit (2) | hit | casefold |  | known_target_latin_hit; known latin target key |
| Q049 | -len | target_to_source | hit | hit (1) | hit | casefold |  | known_target_latin_hit; known latin target key |
| Q050 | -li | target_to_source | hit | hit (1) | hit | casefold |  | known_target_latin_hit; known latin target key |
| Q051 | à partir d'aujourd'hui et jusqu'à demain | source_to_target | hit | hit (1) | hit | casefold |  | directional_src_expected_hit; source key in source_to_target should hit |
| Q052 | à partir d'aujourd'hui et jusqu'à demain | target_to_source | miss | miss | miss | none | language_mismatch | directional_src_expected_miss; same source key in opposite direction should miss |
| Q053 | à partir de | source_to_target | hit | hit (1) | hit | casefold |  | directional_src_expected_hit; source key in source_to_target should hit |
| Q054 | à partir de | target_to_source | miss | miss | miss | none | language_mismatch | directional_src_expected_miss; same source key in opposite direction should miss |
| Q055 | à partir de x jusqu'à y | source_to_target | hit | hit (1) | hit | casefold |  | directional_src_expected_hit; source key in source_to_target should hit |
| Q056 | à partir de x jusqu'à y | target_to_source | miss | miss | miss | none | language_mismatch | directional_src_expected_miss; same source key in opposite direction should miss |
| Q057 | à partir de x jusqu'à y, de x à y | source_to_target | hit | hit (1) | hit | casefold |  | directional_src_expected_hit; source key in source_to_target should hit |
| Q058 | à partir de x jusqu'à y, de x à y | target_to_source | miss | miss | miss | none | language_mismatch | directional_src_expected_miss; same source key in opposite direction should miss |
| Q059 | à propos | source_to_target | hit | hit (1) | hit | casefold |  | directional_src_expected_hit; source key in source_to_target should hit |
| Q060 | à propos | target_to_source | miss | miss | miss | none | language_mismatch | directional_src_expected_miss; same source key in opposite direction should miss |
| Q061 | à ras bord | source_to_target | hit | hit (1) | hit | casefold |  | directional_src_expected_hit; source key in source_to_target should hit |
| Q062 | à ras bord | target_to_source | miss | miss | miss | none | language_mismatch | directional_src_expected_miss; same source key in opposite direction should miss |
| Q063 | à tout hasard | source_to_target | hit | hit (1) | hit | casefold |  | directional_src_expected_hit; source key in source_to_target should hit |
| Q064 | à tout hasard | target_to_source | miss | miss | miss | none | language_mismatch | directional_src_expected_miss; same source key in opposite direction should miss |
| Q065 | à ventre gonflé | source_to_target | hit | hit (1) | hit | casefold |  | directional_src_expected_hit; source key in source_to_target should hit |
| Q066 | à ventre gonflé | target_to_source | miss | miss | miss | none | language_mismatch | directional_src_expected_miss; same source key in opposite direction should miss |
| Q067 | à.cause.de | source_to_target | hit | hit (1) | hit | casefold |  | directional_src_expected_hit; source key in source_to_target should hit |
| Q068 | à.cause.de | target_to_source | miss | miss | miss | none | language_mismatch | directional_src_expected_miss; same source key in opposite direction should miss |
| Q069 | à.côté | source_to_target | hit | hit (1) | hit | casefold |  | directional_src_expected_hit; source key in source_to_target should hit |
| Q070 | à.côté | target_to_source | miss | miss | miss | none | language_mismatch | directional_src_expected_miss; same source key in opposite direction should miss |
| Q071 | ߊ߬ߓߊߙߌߞߊ | target_to_source | hit | hit (1) | hit | casefold |  | directional_tgt_expected_hit; target key in target_to_source should hit |
| Q072 | ߊ߬ߓߊߙߌߞߊ | source_to_target | miss | miss | miss | none | language_mismatch | directional_tgt_expected_miss; same target key in opposite direction should miss |
| Q073 | ߊ߲ߓߍ߫ | target_to_source | hit | hit (1) | hit | casefold |  | directional_tgt_expected_hit; target key in target_to_source should hit |
| Q074 | ߊ߲ߓߍ߫ | source_to_target | miss | miss | miss | none | language_mismatch | directional_tgt_expected_miss; same target key in opposite direction should miss |
| Q075 | ߊ߬ߓߎ߬ | target_to_source | hit | hit (1) | hit | casefold |  | directional_tgt_expected_hit; target key in target_to_source should hit |
| Q076 | ߊ߬ߓߎ߬ | source_to_target | miss | miss | miss | none | language_mismatch | directional_tgt_expected_miss; same target key in opposite direction should miss |
| Q077 | ߊߓߖߊߘߊ | target_to_source | hit | hit (1) | hit | casefold |  | directional_tgt_expected_hit; target key in target_to_source should hit |
| Q078 | ߊߓߖߊߘߊ | source_to_target | miss | miss | miss | none | language_mismatch | directional_tgt_expected_miss; same target key in opposite direction should miss |
| Q079 | ߊ߲ߔߎߟߌ | target_to_source | hit | hit (1) | hit | casefold |  | directional_tgt_expected_hit; target key in target_to_source should hit |
| Q080 | ߊ߲ߔߎߟߌ | source_to_target | miss | miss | miss | none | language_mismatch | directional_tgt_expected_miss; same target key in opposite direction should miss |
| Q081 | -lu | target_to_source | hit | hit (1) | hit | casefold |  | directional_tgt_expected_hit; target key in target_to_source should hit |
| Q082 | -lu | source_to_target | miss | miss | miss | none | language_mismatch | directional_tgt_expected_miss; same target key in opposite direction should miss |
| Q083 | -lú | target_to_source | hit | hit (2) | hit | diacritics_insensitive |  | directional_tgt_expected_hit; target key in target_to_source should hit |
| Q084 | -lú | source_to_target | miss | miss | miss | none | language_mismatch | directional_tgt_expected_miss; same target key in opposite direction should miss |
| Q085 | -lù | target_to_source | hit | hit (2) | hit | diacritics_insensitive |  | directional_tgt_expected_hit; target key in target_to_source should hit |
| Q086 | -lù | source_to_target | miss | miss | miss | none | language_mismatch | directional_tgt_expected_miss; same target key in opposite direction should miss |
| Q087 | -ma | target_to_source | hit | hit (2) | hit | casefold |  | directional_tgt_expected_hit; target key in target_to_source should hit |
| Q088 | -ma | source_to_target | miss | hit (1) | hit | punct_stripped |  | directional_tgt_expected_miss; same target key in opposite direction should miss |
| Q089 | -man | target_to_source | hit | hit (2) | hit | casefold |  | directional_tgt_expected_hit; target key in target_to_source should hit |
| Q090 | -man | source_to_target | miss | miss | miss | none | language_mismatch | directional_tgt_expected_miss; same target key in opposite direction should miss |
| Q091 | À.L'EXTÉRIEUR | source_to_target | hit | hit (1) | hit | casefold |  | normalization_case_variant; uppercase variant probe |
| Q092 | À.L’INTÉRIEUR | source_to_target | hit | hit (1) | hit | casefold |  | normalization_case_variant; uppercase variant probe |
| Q093 | À.LA.VUE.PERÇANTE | source_to_target | hit | hit (1) | hit | casefold |  | normalization_case_variant; uppercase variant probe |
| Q094 | À.PART | source_to_target | hit | hit (1) | hit | casefold |  | normalization_case_variant; uppercase variant probe |
| Q095 | À.PROPOS | source_to_target | hit | hit (1) | hit | casefold |  | normalization_case_variant; uppercase variant probe |
| Q096 | À.RAS.BORD | source_to_target | hit | hit (1) | hit | casefold |  | normalization_case_variant; uppercase variant probe |
| Q097 | A) IL A PANIQUÉ | source_to_target | hit | hit (1) | hit | casefold |  | normalization_case_variant; uppercase variant probe |
| Q098 | ABAISSER | source_to_target | hit | hit (1) | hit | casefold |  | normalization_case_variant; uppercase variant probe |
| Q099 | ABAISSER LE DRAPEAU | source_to_target | hit | hit (1) | hit | casefold |  | normalization_case_variant; uppercase variant probe |
| Q100 | ABANDONNER | source_to_target | hit | hit (1) | hit | casefold |  | normalization_case_variant; uppercase variant probe |
| Q101 | àlextérieur | source_to_target | hit | hit (1) | hit | punct_stripped |  | normalization_punct_variant; punctuation-stripped variant probe |
| Q102 | àlintérieur | source_to_target | hit | hit (1) | hit | punct_stripped |  | normalization_punct_variant; punctuation-stripped variant probe |
| Q103 | àlavueperçante | source_to_target | hit | hit (1) | hit | punct_stripped |  | normalization_punct_variant; punctuation-stripped variant probe |
| Q104 | àpart | source_to_target | hit | hit (1) | hit | punct_stripped |  | normalization_punct_variant; punctuation-stripped variant probe |
| Q105 | àpropos | source_to_target | hit | hit (1) | hit | punct_stripped |  | normalization_punct_variant; punctuation-stripped variant probe |
| Q106 | àrasbord | source_to_target | hit | hit (1) | hit | punct_stripped |  | normalization_punct_variant; punctuation-stripped variant probe |
| Q107 | a il a paniqué | source_to_target | hit | hit (1) | hit | punct_stripped |  | normalization_punct_variant; punctuation-stripped variant probe |
| Q108 | abandonner sa femme divorcer de sa femme | source_to_target | hit | hit (1) | hit | punct_stripped |  | normalization_punct_variant; punctuation-stripped variant probe |
| Q109 | a | source_to_target | hit | hit (1) | hit | diacritics_insensitive |  | normalization_diacritic_variant; diacritics-insensitive variant probe |
| Q110 | a cause de | source_to_target | hit | hit (1) | hit | diacritics_insensitive |  | normalization_diacritic_variant; diacritics-insensitive variant probe |
| Q111 | a cote | source_to_target | hit | hit (1) | hit | diacritics_insensitive |  | normalization_diacritic_variant; diacritics-insensitive variant probe |
| Q112 | a cote de | source_to_target | hit | hit (1) | hit | diacritics_insensitive |  | normalization_diacritic_variant; diacritics-insensitive variant probe |
| Q113 | a deux entrees | source_to_target | hit | hit (1) | hit | diacritics_insensitive |  | normalization_diacritic_variant; diacritics-insensitive variant probe |
| Q114 | a l'exterieur | source_to_target | hit | hit (1) | hit | diacritics_insensitive |  | normalization_diacritic_variant; diacritics-insensitive variant probe |
| Q115 | a l'exterieur de | source_to_target | hit | hit (1) | hit | diacritics_insensitive |  | normalization_diacritic_variant; diacritics-insensitive variant probe |
| Q116 | a l'insu de | source_to_target | hit | hit (1) | hit | diacritics_insensitive |  | normalization_diacritic_variant; diacritics-insensitive variant probe |
| Q117 | àlamesurede | source_to_target | hit | hit (1) | hit | nospace |  | normalization_nospace_variant; nospace variant probe |
| Q118 | àlavueperçante | source_to_target | hit | hit (1) | hit | punct_stripped |  | normalization_nospace_variant; nospace variant probe |
| Q119 | àpart | source_to_target | hit | hit (1) | hit | punct_stripped |  | normalization_nospace_variant; nospace variant probe |
| Q120 | àpartça | source_to_target | hit | hit (1) | hit | nospace |  | normalization_nospace_variant; nospace variant probe |
| Q121 | àpartird'aujourd'hui | source_to_target | hit | hit (1) | hit | nospace |  | normalization_nospace_variant; nospace variant probe |
| Q122 | àpartird'aujourd'huietjusqu'àdemain | source_to_target | hit | hit (1) | hit | nospace |  | normalization_nospace_variant; nospace variant probe |
| Q123 | àpartirde | source_to_target | hit | hit (1) | hit | nospace |  | normalization_nospace_variant; nospace variant probe |
| Q124 | àpartirdexjusqu'ày | source_to_target | hit | hit (1) | hit | nospace |  | normalization_nospace_variant; nospace variant probe |
| Q125 | (fruit blet | source_to_target | miss | hit (1) | hit | punct_stripped |  | failure_spelling_probe; plausible learner misspelling |
| Q126 | à caue de | source_to_target | miss | miss | miss | none | spelling_error | failure_spelling_probe; plausible learner misspelling |
| Q127 | à cté | source_to_target | miss | hit (1) | hit | nospace |  | failure_spelling_probe; plausible learner misspelling |
| Q128 | à côé de | source_to_target | miss | miss | miss | none | spelling_error | failure_spelling_probe; plausible learner misspelling |
| Q129 | à deux ntrées | source_to_target | miss | miss | miss | none | spelling_error | failure_spelling_probe; plausible learner misspelling |
| Q130 | à l'exérieur | source_to_target | miss | miss | miss | none | spelling_error | failure_spelling_probe; plausible learner misspelling |
| Q131 | à l'extéieur de | source_to_target | miss | miss | miss | none | spelling_error | failure_spelling_probe; plausible learner misspelling |
| Q132 | à l'isu de | source_to_target | miss | miss | miss | none | spelling_error | failure_spelling_probe; plausible learner misspelling |
| Q133 | à partir | source_to_target | miss | miss | miss | none | phrase_mismatch | failure_partial_phrase_probe; partial phrase attempt |
| Q134 | à propos | source_to_target | miss | hit (1) | hit | casefold |  | failure_partial_phrase_probe; partial phrase attempt |
| Q135 | à ras | source_to_target | miss | miss | miss | none | phrase_mismatch | failure_partial_phrase_probe; partial phrase attempt |
| Q136 | à tout | source_to_target | miss | miss | miss | none | phrase_mismatch | failure_partial_phrase_probe; partial phrase attempt |
| Q137 | à ventre | source_to_target | miss | miss | miss | none | phrase_mismatch | failure_partial_phrase_probe; partial phrase attempt |
| Q138 | a) il | source_to_target | miss | miss | miss | none | phrase_mismatch | failure_partial_phrase_probe; partial phrase attempt |
| Q139 | à l'insu de qqns | source_to_target | miss | miss | miss | none | index_gap | failure_inflection_probe; inflection/pluralized probe |
| Q140 | à l’intérieurs | source_to_target | miss | miss | miss | none | index_gap | failure_inflection_probe; inflection/pluralized probe |
| Q141 | à la mesure des | source_to_target | miss | miss | miss | none | index_gap | failure_inflection_probe; inflection/pluralized probe |
| Q142 | à la vue perçantes | source_to_target | miss | miss | miss | none | index_gap | failure_inflection_probe; inflection/pluralized probe |
| Q143 | à parts | source_to_target | miss | miss | miss | none | index_gap | failure_inflection_probe; inflection/pluralized probe |
| Q144 | à part ças | source_to_target | miss | miss | miss | none | index_gap | failure_inflection_probe; inflection/pluralized probe |
| Q145 | hello | source_to_target | miss | miss | miss | none | language_mismatch | failure_language_mismatch_probe; cross-language mismatch probe |
| Q146 | thank you | source_to_target | miss | miss | miss | none | language_mismatch | failure_language_mismatch_probe; cross-language mismatch probe |
| Q147 | good morning | source_to_target | miss | miss | miss | none | language_mismatch | failure_language_mismatch_probe; cross-language mismatch probe |
| Q148 | work hard | source_to_target | miss | miss | miss | none | language_mismatch | failure_language_mismatch_probe; cross-language mismatch probe |
| Q149 | dictionary | source_to_target | miss | miss | miss | none | language_mismatch | failure_language_mismatch_probe; cross-language mismatch probe |
| Q150 | lesson | source_to_target | miss | miss | miss | none | language_mismatch | failure_language_mismatch_probe; cross-language mismatch probe |
| Q151 | zzqv | source_to_target | miss | miss | miss | none | missing_entry | failure_missing_entry_probe; likely missing entry probe |
| Q152 | qzmx | source_to_target | miss | miss | miss | none | missing_entry | failure_missing_entry_probe; likely missing entry probe |
| Q153 | nonexistent terme | source_to_target | miss | miss | miss | none | missing_entry | failure_missing_entry_probe; likely missing entry probe |
| Q154 | abracadabra lexique | source_to_target | miss | miss | miss | none | missing_entry | failure_missing_entry_probe; likely missing entry probe |
| Q155 | no such headword | source_to_target | miss | miss | miss | none | missing_entry | failure_missing_entry_probe; likely missing entry probe |
| Q156 | xyz987 | source_to_target | miss | miss | miss | none | missing_entry | failure_missing_entry_probe; likely missing entry probe |

## Recurring failure patterns

Failure class distribution among misses (raw):

- language_mismatch: 25 (primarily control/probe behavior)
- spelling_error: 6
- index_gap: 6
- missing_entry: 6 (deliberate nonsense/missing-entry probes)
- phrase_mismatch: 5

Notable unexpected misses (expected hit but missed):
- none in this round

Observed recurring themes from controlled probes:

- inflection/pluralization-like source variants frequently miss where base forms hit
- partial phrase attempts often miss when only longer extracted phrase units are indexed
- opposite-direction queries reliably miss (expected under strict directional behavior)

### Q088 investigation (`-ma` in `source_to_target`)

- Query id: `Q088`
- Scenario label: `directional_tgt_expected_miss`
- Expected: miss
- Actual: hit at `punct_stripped`

Observed match details:

- normalized lookup key at `punct_stripped`: **`ma`**
- matched index family: **`src_punct_stripped`** (source-side, directional path)
- matched source-side index entry:
  - key_type: `src_punct_stripped`
  - key: `ma`
  - ir_id: `e1417929926cd93a`
  - record kind: `index_mapping`
  - source term/preferred form: `ma`

Conclusion:

- This is a **legitimate source-side match** after punctuation stripping (`-ma` -> `ma`), not a directional leakage bug.
- Reclassification: `Q088` is an **invalid directional-control query** (normalization-collision case), not a Task 6 contract failure.

## Improvement candidates (grounded in this round)

- Candidate A (softened): run a narrower follow-up probe focused on plausible high-frequency French morphological variants before proposing inflection-coverage expansion; current controlled examples mix realistic and synthetic forms.
- Candidate B (primary): review phrase extraction granularity for source-side multiword entries where partial phrase probes repeatedly miss, and evaluate whether additional deterministic subphrase keys are warranted in a future versioned ruleset.

## Honest limitations

- Android real-device validation remains deferred pending hardware access.
- This is not real-user field telemetry; it is controlled calibration.
- Findings should be validated again later against real exported query logs before norm_v3 planning.
