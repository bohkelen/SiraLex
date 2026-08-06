# ML1C1 — English Index + Bundle Capability

## Decision

```text
ML1C1_ENGLISH_INDEX_BUNDLE_ACCEPTED
ML1C1A_IMMUTABLE_ARTIFACT_OUTPUT_FIXED
ML1C1A1_ARTIFACT_IDEMPOTENCY_VERIFIED
```

## BASE_COMMIT

```text
53807716f154167a1df0c75f3f6648a51983f625
```

`git log -1`: `5380771 Define multilingual search and bundle identity contracts` (ML1B + ML1B1).

This slice implements English search-index emission and bundle capability metadata. It does **not** enable English consumer search UI, does not publish/update `catalog.json`, does not modify Learning/CF1/CF2/IndexedDB/Russian display.

ML1C1A separates physical artifact directory naming from logical `bundle_id` so compatible content versions can coexist without destructive overwrite.

---

## Explicit `--bundle-id`

| Check | Result |
|-------|--------|
| Optional CLI `--bundle-id` | PASS |
| Absent → convenience `generate_bundle_id` unchanged | PASS |
| Present → manifest uses exact logical id | PASS |
| Invalid shapes rejected | PASS |
| `content_sha256` independent of bundle_id | PASS |
| Featured id hardcoded | NO |

---

## `en_gloss_key_v1`

Module: `api/search_index/en_gloss_key_v1.py`

| Rule | Result |
|------|--------|
| Sense `gloss_en` only | PASS |
| Unitary + multiword exact | PASS |
| Comma alternatives | PASS |
| Trailing parenthetical strip | PASS |
| `(not) yet` preserved | PASS |
| No `or` / `/` / whitespace tokenization | PASS |
| Examples / subentries excluded | PASS |

---

## English index emission

Additive merge onto frozen featured index via `--base-search-index`:

- `src_*` / `tgt_*` copied with **exact posting lists preserved**
- `en_casefold|diacritics_insensitive|punct_stripped|nospace` added from glosses
- Normalization via record `norm_version` (`norm_v3` for featured)

Full rebuild-from-records alone is insufficient for featured continuity (alias/supplement `src_*` keys are not in records). That path remains available for greenfield/tests.

---

## English provenance

Artifact (outside consumer bundle):

`data/local_evidence/ml1c1_english_index_candidate/en_gloss_key_v1_provenance.jsonl`

Fields: `ir_id`, `sense_index`, `gloss_en_raw`, `extraction_rule`, `key_normalized`, `key_surface`, `split_kind`.

| Metric | Value |
|--------|------:|
| Source senses | 12127 |
| Extracted candidates | 16768 |
| Unique English keys | 8737 |
| Split kinds | unitary 8432 / comma_alternative 8336 |
| `en_*` index rows | 34913 |

---

## Manifest capability

Candidate emits:

```json
{
  "languages": {
    "source_lang": "fr",
    "target_lang": "mnk",
    "lexical_language": "mnk",
    "lookup_languages": ["fr", "en", "mnk"]
  },
  "search_key_families": ["en", "src", "tgt"],
  "rule_versions": {
    "normalization": "norm_v3",
    "en_gloss_key": "en_gloss_key_v1"
  }
}
```

Runtime parser (`web/src/bundle_manifest.ts`) accepts additive fields; legacy manifests without them still parse. UI labels unchanged. Search UI does not select `en_*`.

---

## Candidate

| Field | Value |
|-------|-------|
| Location | `data/local_evidence/ml1c1_english_index_candidate/bundles/bundle_full_20260710_337619ff__d076558b/` |
| `bundle_id` (logical) | `bundle_full_20260710_337619ff` |
| Artifact directory name | `bundle_full_20260710_337619ff__d076558b` |
| `content_sha256` | `sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a` |
| `storage_scope_id` | `bundle_full_20260710_337619ff::sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a` |
| Same logical id as featured | PASS |
| New immutable content version | PASS |
| `records.jsonl` byte-identical to featured | PASS |
| Bundle verify | PASS |
| Catalog updated | NO |
| Featured public tree overwritten | NO |

### Physical artifact identity (ML1C1A)

| Layer | Identity |
|-------|----------|
| Logical dictionary | `manifest.bundle_id` = `bundle_full_20260710_337619ff` |
| Immutable content version | `manifest.content_sha256` = `sha256:d076558b…` |
| Physical artifact directory | `{bundle_id}__{content_sha256_prefix8}` |

Contract:

- Explicit `--bundle-id` defaults to **versioned output** so same logical id + different content hashes coexist under one output root.
- Existing versioned directories are **never** `rmtree`'d: identical rebuild is idempotent; conflicting hash **fails closed**.
- Idempotent reuse verifies the complete existing artifact; matching manifest text alone is insufficient.
- Convenience builds (no explicit `--bundle-id`) keep directory name == generated `bundle_id`.
- Physical directory name is **not** Learning identity.

Coexistence proof (builder tests + candidate rebuild): two payloads with the same logical id produce two directories; both verify; manifests share `bundle_id`; `content_sha256` differs; prior retained.

#### ML1C1A1 — Idempotent reuse integrity

Before treating an existing versioned directory as identical:

1. Run full `verify_bundle()` (manifest, payload presence, sizes, per-file SHA-256, canonical `content_sha256`).
2. Only if verification **passes** and verified `content_sha256` equals the newly built hash may the builder skip and retain the existing directory.
3. On verification failure or verified-hash mismatch: fail closed with `ArtifactDirectoryConflictError`; do not overwrite, delete, or repair the existing immutable directory; clean the new temp build.

Tamper-regression results (builder tests):

| Case | Result |
|------|--------|
| Exact identical existing artifact | Idempotent reuse; original retained |
| Tampered `records.jsonl` | Fail closed; corrupted dir untouched; temp cleaned |
| Tampered `search_index.jsonl` | Fail closed; corrupted dir untouched; temp cleaned |
| Missing payload | Fail closed; corrupted dir untouched; temp cleaned |
| Manifest `content_sha256` matches new hash but payload bytes differ | Fail closed (exact prior defect) |
| Existing valid artifact at path with conflicting verified hash | Fail closed; both dirs retained |
| `verify_bundle` on normal artifacts | Still validates |

---

## Size

| Metric | Featured | Candidate | Delta |
|--------|--------:|--------:|------:|
| Index rows | 112265 | 147178 | +34913 |
| `en_*` rows | 0 | 34913 | +34913 |
| Index bytes | 10209943 | 13834042 | +3624099 (~+3.46 MB) |
| Payload (records+index) | 26169580 | 29793679 | +3624099 |

ML1B estimate was ~+35k rows / ~+3.2 MB — **aligned** (unique keys 8737 exact match to ML1B `en_gloss_key_v1` estimate).

---

## English probe matrix (candidate `en_*`)

All ladder hits at `casefold` unless noted.

| Query | Count | Headwords (prefix) |
|-------|------:|--------------------|
| house | 1 | `bón` |
| father | 3 | `fà`, `bàba`, `bàwa` |
| eat | 4 | `dómun`, `dúmu`, `dáwun`, `dámun` |
| come | 5 | `sɛ́nɛma`, `sɛ́nɛ`, `bɔ́`, `n\``, `nà` |
| hand | 7 | `kɔ̀ɲɔ`, `dɛ́n`, `bólo`, … |
| arm | 5 | `kɔ̀ɲɔ`, `bólo`, … |
| head | 5 | `dátii`, `sín`, `sála`, `kùn`, … |
| right hand | 2 | `kíninbolo`, `bóloba` |
| very | 25 | intensifiers |
| now | 19 | … |
| respect | 18 | … |
| pick up | 10 | … |
| come back | 9 | … |
| calm down | 8 | … |
| take away | 7 | … |
| mix up | 9 | … |
| as far as | 9 | … |
| fall prone | 7 | … |
| settle down | 6 | … |
| wound | 17 | … |
| gather | 17 | … |
| plant | 16 | … |
| water | 2 | `jí`, `sɔ́` |
| mother | 3 | `bá`, `dénba`, `ná` |
| green | 7 | … |
| Guinea sorrel | 4 | `dà`, … |
| intransitive aorist | 2 | `-ra`, `-da` |
| (not) yet | 8 | … |
| odd number | 0 | — |
| right side | 1 | `kíninbolo` |

Deliberate non-extractions / miss behaviors:

- Multiword phrases stay exact (`come back`, `right hand`); no whitespace bag-of-words.
- Parenthetical interiors not mined (`very (dark)` → `very` only).
- Examples / subentries not indexed (unit tests + provenance limited to sense `gloss_en`).
- `odd number` → miss (no exact gloss key).

Full JSON: `data/local_evidence/ml1c1_english_index_candidate/english_probe_matrix.json`.

---

## FR / MNK regression

Comparing featured index vs candidate (families `src_*` / `tgt_*` only):

| Check | Result |
|-------|--------|
| Removed keys | **0** |
| Added core keys | **0** |
| Changed posting lists | **0** |
| FR control `maison` / `mère` | PASS |
| MNK control `kùn` | PASS |

Note: full rebuild without `--base-search-index` would drop alias/supplement `src_*` rows and is **not** the ML1C1 featured-extension path.

---

## Phase 7L

Pinned 7J curated matrix (unchanged FR/MNK gate):

| Field | Value |
|-------|-------|
| Bundle | `bundle_full_20260616_phase7j_alias_round2_candidate` |
| Cases | 13 |
| Passed | 13 |
| Failed | 0 |

Artifact: `data/local_evidence/ml1c1_english_index_candidate/phase7l_result.json`.

---

## High-risk files

### `api/search_index/build_index.py`

- **Reason:** emit additive `en_*`; preserve featured `src_*`/`tgt_*` via base merge.
- **Previous:** `search_keys` → `src_*`/`tgt_*` only.
- **New:** optional English gloss emission; `--base-search-index` merge path preserves base posting order.
- **FR/MNK proof:** candidate vs featured core diff = 0/0/0; unit tests for merge.

### `api/bundle_builder/build_bundle.py`

- **Reason:** `--bundle-id`; allow `en_*`; emit capability metadata; **ML1C1A** versioned artifact dirs + fail-closed overwrite.
- **Previous:** convenience id only; `DIRECTIONAL_KEY_TYPES` = src/tgt; final dir = `bundle_id` with unconditional `rmtree`.
- **New:** optional logical id; families src/tgt/en; optional `search_key_families` / `lookup_languages` / `en_gloss_key`; physical `{bundle_id}__{hashprefix}` when versioned; no destructive overwrite of versioned artifacts.
- **FR/MNK proof:** legacy undirected + directional src/tgt fixtures still validate; additive en fixture accepted; coexistence tests.

### `web/src/bundle_manifest.ts`

- **Reason:** parse additive capability fields without breaking legacy.
- **Previous:** languages = source/target strings only.
- **New:** optional `lexical_language`, `lookup_languages`, `search_key_families`; `rule_versions.en_gloss_key` passthrough.
- **FR/MNK proof:** phase3 legacy manifest tests still pass; new additive test added.

No Learning / CF1 / CF2 / IndexedDB / Search UI / renderer changes.

---

## Runtime boundary

- Manifest parser may surface capability metadata.
- `search_query.ts` **not** changed to select `en_*` from UI.
- LookupMode deferred to ML1C2.
- English probes exercised offline against candidate index files only.

---

## Tests / build / check

| Suite | Result |
|-------|--------|
| `api` search_index + bundle_builder tests | **102 passed** |
| `web` `phase3_bundle_runtime.test.ts` | **18 passed** |
| `npm run build` | PASS |
| Phase 7L curated | **13/13 PASS** |
| `git diff --check` | PASS |

---

## Scope deviations

```text
NONE
```

Unexpected changes:

```text
NONE
```

Learning / CF1 / CF2 / Search UI files changed:

```text
NONE / NO
```

---

## Files committed

```text
A  api/search_index/en_gloss_key_v1.py
A  api/search_index/tests/test_en_gloss_key_v1.py
A  docs/reports/ml1c1_english_index_bundle_report.md
M  api/search_index/build_index.py
M  api/search_index/cli.py
M  api/search_index/tests/test_search_index.py
M  api/bundle_builder/build_bundle.py
M  api/bundle_builder/cli.py
M  api/bundle_builder/tests/test_bundle_builder.py
M  web/src/bundle_manifest.ts
M  web/src/phase3_bundle_runtime.test.ts
M  docs/BUNDLE_DISTRIBUTION.md
M  shared/specs/offline-bundle-versioning.md
```

Local evidence / unrelated untracked (not committed):

```text
data/local_evidence/ml1c1_english_index_candidate/
web/scripts/capture_ui_screenshots.mjs
```

## Commit

```text
Add English search index capability
```
