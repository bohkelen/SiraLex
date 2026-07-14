# Phase 7N2B4G7 — Review Artifact Inspection and Catalog-Candidate Decision

## Decision

```text
STAGE_AS_CATALOG_VISIBLE_CANDIDATE_NEXT_SLICE
```

The packaged 7N2B review artifact passed identity, checksum, extraction, semantic,
provenance, and replay gates. G7 does **not** stage it. Featured remains
`bundle_full_20260708_27643bb0`.

## 1. Artifact identity

| Field | Value |
| --- | --- |
| Review ZIP | `artifacts/review/phase7n2b/bundle_full_20260710_337619ff.review.zip` |
| Review manifest | `artifacts/review/phase7n2b/bundle_full_20260710_337619ff.review_manifest.json` |
| Review checksums | `artifacts/review/phase7n2b/bundle_full_20260710_337619ff.review_checksums.txt` |
| `bundle_id` | `bundle_full_20260710_337619ff` |
| `promotion_status` | `review_artifact_only_not_promoted` |
| Featured (unchanged) | `bundle_full_20260708_27643bb0` |
| Inspection workspace | `/tmp/phase7n2b4g7_review_inspection/` |

## 2. Checksum verification

| Object | Expected | Result |
| --- | --- | --- |
| review ZIP | `sha256:1dd2e9abe8803b825b0bf02f881456280ca9c761e2d0d35aaca47d23b8a0ccbd` | PASS |
| review manifest | `sha256:31a83cf5b66e78d429f5cc05fd7575f93606affd4c0f3dfadd7c0e18130c1c3d` | PASS |
| content | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` | PASS |
| records | `sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90` | PASS |
| search_index | `sha256:55bf98fc99a592f7003aa338fc7b4790bc9cd642b676c99a725d83a5f9ca79e3` | PASS |

ZIP and manifest SHA-256 values match `review_checksums.txt` and the review
manifest fields.

## 3. ZIP extraction inventory

Extracted under
`/tmp/phase7n2b4g7_review_inspection/extracted/bundle_full_20260710_337619ff/`.

Exact member set:

```text
bundle.manifest.json
checksums.sha256
records.jsonl
search_index.jsonl
```

No temporary replay reports, matrices, manifests, stage files, logs, or `/tmp`
metadata were present in the ZIP.

## 4. Bundle manifest verification

| Check | Result |
| --- | --- |
| Extracted `bundle_id` | `bundle_full_20260710_337619ff` |
| Recomputed `content_sha256` | matches accepted |
| `verify_bundle` | VALID |

## 5. Semantic spot checks

| Query | Result |
| --- | --- |
| `moto` | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` → `pópo` |
| `maman` | `["e5164efcdf5e6ca4"]` |
| `prix` | direct `["ffbf014bd96ffabf"]`; resolved `["3b8c3b7a0c5e897d"]` → `Son` |
| `fièvre` | miss |
| `comment dit-on école` | miss |
| `combien ça coûte` | miss |
| `merci beaucoup` | miss |
| `papa` | `["b8053579e3035e88"]` → `bàba` / `bàwa` |
| `père` | `["423369d78d42c100"]` → `fà` |

## 6. Closed 7N2A guardrail checks

| Query | Result |
| --- | --- |
| `hôpital` | resolved `["71e323e2dafa590f", "a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `clinique` | resolved `["a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `centre de santé` | resolved `["a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `place` | `["96b72ff71179d689"]`; excludes owner health IDs |
| `location` | miss |
| `yoro` | miss |

## 7. Schema / provenance checks

| Check | Result |
| --- | --- |
| Duplicate `ir_id` count | `0` |
| Owner lexical `3b8c3b7a0c5e897d` present | PASS (`Son`) |
| `record_locator.source_record_id` | `7n2b_son_v1` |
| `record_locator.url_canonical` | `siralex://lexical-review/7n2b/son` |
| Orthography / starter-form note for `Son` | PASS (provisional accents/tones language present) |
| Every `lexicon_entry` has top-level `record_locator` | PASS |
| No `index_mapping` has top-level `record_locator` | PASS |
| Locator tuple uniqueness | duplicate count `0` |
| Multi-posting lex sort | PASS with documented contract exception below |

### Multi-posting order note

Of `12329` multi-posting search-index keys, `4` are not pure lexicographic
`ir_id` order. All four are the approved `moto` alias key types
(`src_casefold`, `src_diacritics_insensitive`, `src_punct_stripped`,
`src_nospace`) preserving declared alias `resolved_ir_ids`:

```text
["b5c9a49f6db2a991", "0a56b8047aeaf117"]
```

That order matches the G3 alias row and the G4 additive matrix case
`7n2b_moto_transport_alias` (replay PASS). Featured baseline had `0` unsorted
keys; these four are the only 7N2B delta. This is **not** treated as a packaging
blocker.

## 8. Replay verification

Temporary candidate-specific manifests/matrices under
`/tmp/phase7n2b4g7_review_inspection/replay/` (tracked matrices untouched).

| Gate | Result |
| --- | --- |
| Frozen 7L | **13 / 13 passed** |
| Additive 7N2A | **8 / 8 passed** |
| Additive 7N2B | **9 / 9 passed** |

## 9. Catalog-candidate decision

```text
STAGE_AS_CATALOG_VISIBLE_CANDIDATE_NEXT_SLICE
```

Meaning: the review artifact is approved for catalog-visible candidate staging
in the **next** slice. G7 does not stage, promote, or change featured/runtime
pointers.

## 10. Confirmation: no catalog / web-public / production / runtime / source / matrix / package / review-artifact changes

G7 created only this report. Featured remains `bundle_full_20260708_27643bb0`.
No edits to `web/`, catalog, review artifacts, aliases, supplements, owner
lexical IR, regression matrices, API, or packages.

## 11. Next slice definition

**Phase 7N2B4G8 — Stage 7N2B as Catalog-Visible Candidate**

Purpose: copy the approved 7N2B review artifact into the candidate bundle area
and update catalog metadata so it is visible as a candidate, without making it
the featured or default runtime bundle.
