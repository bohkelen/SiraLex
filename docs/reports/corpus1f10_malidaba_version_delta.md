# CORPUS1F10 — Malidaba Version-Delta Comparison

## 1. Decision

**CORPUS1F10_MALIDABA_VERSION_DELTA_BLOCKED**

Blocked by **parser compatibility FAIL**: current official lexicon HTML nests
`<p class="lxP2">` inside `<p class="lxP">`, so the existing sibling-based
`MalipenseLexiconParser` extracts **0 senses** from all current pages. Semantic
change classification is therefore untrusted and was not emitted as lexical
growth.

Identity-level evidence was still produced under a conservative PARTIAL matching
hierarchy. Those NEW/MISSING counts are **source-maintenance evidence**, not
approved lexical additions.

## 2. Base commit

`bdcb156081fa7244974bfb6084e07f7c198f8b27`

(CORPUS1F9 commit: *Record existing SiraLex source inventory*)

## 3. Existing source identity

| Field | Value |
|-------|-------|
| `source_id` | `src_malipense` |
| Product name | Mali-pense / Malidaba |
| Role | PRIMARY / CORE LEXICOGRAPHIC SOURCE |
| Registry | `shared/sources/malipense.yaml` |
| Homepage | https://www.mali-pense.net/ |

## 4. Baseline snapshot / IR identity

| Artifact | Identity |
|----------|----------|
| Lexicon IR | `data/ir/malipense_lexicon_v3.jsonl` |
| Rows | **8,823** |
| Parser field in rows | `malipense_lexicon_v1` |
| SHA-256 | `97529fc9bb69d9eb3a3ce40ffa30cc6a1b881f7f2b5edb2709ae7ed3db4dafe1` |
| Primary crawl | `data/snapshots/src_malipense/crawl_20260122_042746_100_5a30_src_malipense` (26 lexicon payloads) |
| Baseline payload-set SHA-256 | `729b061a3c940b4e87b1472ff4196d107230599534142ff6c182872ce12d9abf` |
| Registry crawl-note claim | ~7,283 lexemes / ~8,799 entries (older `indexfr.htm`) |

## 5. Current official source identity

| Field | Observed |
|-------|----------|
| Official origin | https://www.mali-pense.net/emk/lexicon/ |
| Edition claim (indexen.htm) | **May 2026** version |
| Public count claim | **7,913** base + **1,950** addon |
| License claim | **CC BY-NC-SA 4.0** |
| Offline ZIP | https://mali-pense.net/IMG/zip/maninka-web.zip |

**Offline ZIP finding (important):**

- ZIP SHA-256: `176ba16a6eda7ff0d0c101bca9c5bf03ef7d56c6a41ca2beadfbe789d1c98ad5`
- `emk/lexicon/a.htm` inside ZIP is **byte-identical** to the Jan 2026 baseline snapshot
- ZIP `index.htm` still claims **December 2023** (7,283 lexemes / 8,827 entries)
- Therefore the offline package is **not** the current May 2026 live source and was **not** used as comparison authority (kept only as local evidence under `data/malidaba_delta/current/evidence/`)

## 6. Capture method

Isolated HTTP crawl via existing `siralex-crawl` / `snapshot_engine`:

- URL list: `data/url_lists/lexicon_urls.txt`
- Output root: `data/malidaba_delta/current/snapshots/` (**not** `data/snapshots/`)
- Crawl id: `crawl_20260821_170103_554_2876_src_malipense`
- Results: **27** lexicon pages stored; `ŋ.htm` still `http_404`; **`z.htm` now present** (was 404 at baseline)
- Capture receipt: `data/malidaba_delta/current/evidence/capture_receipt.json`

All 26 overlapping letter pages have **different** `content_sha256` vs baseline (plus new `z.htm`).

## 7. Rights posture

Unchanged.

- Recorded license: CC BY-NC-SA 4.0
- This slice = internal source-maintenance / evidence only
- Candidate delta ≠ publication authorization
- No bundle / search / catalog promotion

## 8. Parser reuse

Reused canonical parser only:

- `api/ir_parser/malipense_lexicon.py` (`MalipenseLexiconParser`, `malipense_lexicon_v1`)
- Comparison package: `api/malipense_version_delta/` (new; source-specific)
- CLI: `siralex-malipense-version-delta`

No parallel Malidaba parser was introduced.

## 9. Parser compatibility

**FAIL**

| Check | Baseline | Current |
|-------|----------|---------|
| Entries with senses | 8,776 / 8,823 | **0 / 11,694** |
| `no_senses` ratio | ~0.5% | **100%** |
| Nested `lxP2` inside `lxP` (raw HTML) | not the baseline pattern | **27 / 27 pages** |

Root cause (deterministic): current HTML places sense blocks as nested
`<p class="lxP2">…</p>` before the outer `lxP` closes. The existing parser walks
**siblings** after each `lxP` header, so senses are never collected.

This would fabricate mass “gloss deleted / sense emptied” CHANGED rows if
semantic compare were allowed. Semantic compare was therefore **blocked**.

## 10. Stable identity rule

`identity_rule_id`: **`malipense_identity_v1_partial`**

Inspected IR uses `record_locator.kind = source_record_id` with
`(url_canonical, source_record_id)` unique in baseline (8,823 / 8,823).

**Cross-version finding:** `source_record_id` is **not** stable across editions.
Same page id often points at a different headword after rebuild/renumber
(e.g. `a.htm`: 176 shared ids, only **13** keep the same headword).

Conservative hierarchy used:

1. **STRONG** — `(url_canonical, source_record_id)` **and** equal `headword_latin`
2. **PROVISIONAL** — unique `(url_canonical, headword_latin)` among remaining
3. **AMBIGUOUS** — duplicated headword on a page (homonyms / multi-id)
4. Else **UNMATCHED_*** → NEW / MISSING evidence

Overall identity confidence: **PARTIAL**

## 11. Semantic comparison projection

Projection fields (from actual `fields_raw` / locator; operational provenance excluded):

- `headword_latin`, `headword_nko_provided`
- `ps_raw`, `pos_hint`
- `variants_raw`, `synonyms_raw`, `etymology_raw`, `literal_meaning_raw`
- `anchor_names`
- senses: glosses, examples, sub_entries, usage/synonyms

Explicitly ignored: `evidence`, `parse_warnings`, snapshot ids, crawl timestamps,
`corpus_count` (volatile vs MRC).

**Not applied** to live current IR because parser compatibility FAIL.

## 12–18. Counts (identity evidence; semantic blocked)

| Metric | Value |
|--------|------:|
| Baseline IR rows | 8,823 |
| Current comparison IR rows | 11,694 |
| UNCHANGED | 0 (semantic blocked) |
| NEW_IN_CURRENT_SOURCE | **2,799** |
| MISSING_FROM_CURRENT_SOURCE | **42** |
| CHANGED_EXISTING_RECORD | 0 (semantic blocked) |
| IDENTITY_AMBIGUOUS | **5,214** (one row per involved record) |
| SEMANTIC_COMPARE_BLOCKED | **6,231** (= 13 STRONG + 6,218 PROVISIONAL) |

Identity confidence breakdown:

| Confidence | Count |
|------------|------:|
| STRONG | 13 |
| PROVISIONAL | 6,218 |
| AMBIGUOUS | 5,214 |
| UNMATCHED_BASELINE | 42 |
| UNMATCHED_CURRENT | 2,799 |

## 19. Change subtype counts

**Not computed** (parser compatibility FAIL). Would be misleading under empty senses.

## 20. Unique descriptive new-headword count

Among `NEW_IN_CURRENT_SOURCE` (unmatched current after PARTIAL matching):

| Descriptor | Value |
|------------|------:|
| New records | 2,799 |
| Unique descriptive headwords | **2,755** |
| Duplicate-headword new records (homonym structure) | 44 headwords with >1 new id |

**Not** approved SiraLex words / publication candidates.

## 21. N’Ko delta observations

- Current header extraction still yields `headword_nko_provided` for all 2,799 NEW rows sampled via parser fields
- Sense/example N’Ko unavailable because sense parse coverage = 0
- Baseline records with N’Ko in IR: 8,823; current comparison IR also carries header N’Ko, but sense-level N’Ko is unreadable with current parser

## 22. Example / idiom delta observations

**Blocked.** Current comparison IR has 0 examples / 0 sense sub-entries extracted
due to nested `lxP2` structure. No trustworthy example/idiom delta.

## 23. Source-count reconciliation

Units are **not** identical; do not force equality:

| Unit | Figure | Notes |
|------|------:|-------|
| Public “base entries” (May 2026 page) | 7,913 | Marketing/source claim |
| Public “addon” | 1,950 | Names/surnames/toponyms claim |
| Public sum | 9,863 | ≠ IR rows |
| Older crawl note lexemes/entries | ~7,283 / ~8,799 | Registry capture-time |
| Offline ZIP claim (Dec 2023) | 7,283 / 8,827 | Stale vs live |
| Baseline lexicon IR rows | 8,823 | Parsed entry blocks |
| Current comparison IR rows | 11,694 | Headers still parse; senses do not |
| Baseline index IR rows | 10,501 | Out of scope for this lexicon delta |

## 24. Determinism hashes

| Artifact | SHA-256 |
|----------|---------|
| Baseline IR | `97529fc9bb69d9eb3a3ce40ffa30cc6a1b881f7f2b5edb2709ae7ed3db4dafe1` |
| Current comparison IR | `28927ddd3b7a3686438983fb27373ec74d46a447fd60ac8a3848bd463e45c5c4` |
| Delta JSONL | `1ca414dee6a100ea56b5f32d64b3990e5b6ae399314cd3884f9e02a17d2ef83f` |

Two independent runs over the same baseline IR + crawl produced **identical**
current-IR and delta hashes.

## 25. Local output paths (gitignored)

```
data/malidaba_delta/current/
  evidence/maninka-web.zip
  evidence/capture_receipt.json
  evidence/crawl_log.txt
  snapshots/src_malipense/crawl_20260821_170103_554_2876_src_malipense/
  artifacts/malidaba_current_ir.jsonl
  artifacts/malidaba_version_delta.jsonl
  artifacts/malidaba_version_delta_summary.json
```

## 26. Non-mutation proof

| Check | Result |
|-------|--------|
| Canonical IR SHA unchanged | PASS (`97529fc9…`) |
| Baseline lexicon payload-set SHA unchanged | PASS (`729b061a…`) |
| Canonical snapshots overwritten | **NONE** (crawl wrote under `data/malidaba_delta/…`) |
| Bundles / search / catalog / supplements | **NONE** |
| Current source promoted into canonical IR | **NONE** |

## 27. Tests

`api/malipense_version_delta/tests/test_compare.py` — **13 passed**

Covers: identical→unchanged; new; missing; gloss change; provenance ignored;
ambiguous identity; duplicate primary key rejection; deterministic ordering /
serialization; baseline/current inputs not mutated; parser-failure blocks
semantic CHANGED; nested-`lxP2` detector; provisional renumber match.

Synthetic fixtures only (no live network).

## 28. git diff --check

**PASS**

## 29. Working tree

Uncommitted CORPUS1F10 tracked changes (per commit policy):

- `api/malipense_version_delta/` (new)
- `api/pyproject.toml` (package + `siralex-malipense-version-delta` script)
- `docs/reports/corpus1f10_malidaba_version_delta.md` (this report)

Pre-existing unrelated untracked: `web/scripts/` (untouched by this slice).

Canonical data trees unchanged. Comparison captures remain gitignored under `data/`.

## 30. Recommended next governance step

**HUMAN REVIEW OF MALIDABA VERSION-DELTA EVIDENCE**, then:

1. Update `MalipenseLexiconParser` (or a versioned successor) to accept nested
   `lxP2` while preserving baseline sibling behavior / golden fixtures
2. Re-run this delta under the same crawl + baseline (expect COMPLETE, not BLOCKED)
3. Only then consider governed promotion workflow (review → rights → rebuild → gates)

Do **not** merge current comparison IR into canonical IR based on this blocked run.

---

### Bounded samples (from summary artifact)

**NEW (first deterministic):** e.g. `a.htm` / `àa` (`source_record_id=e10` on current; id space renumbered vs baseline).

**MISSING (first deterministic):** e.g. `b.htm` / `bɔ́ńmàli` (`e1810`) — evidence only; not automatic deletion.

**AMBIGUOUS:** e.g. duplicated page headwords such as `ámerikɛn` on `a.htm`.

**SEMANTIC_COMPARE_BLOCKED:** e.g. provisional headword match `àasɔɛ` (baseline `e10` → current `e12`) with semantic compare withheld.
