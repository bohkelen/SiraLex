# Phase 7L — Curated Search Regression Matrix Plan

**Status:** planning only — no implementation until reviewed  
**Baseline:** Phase 7K complete (runtime evidence logging, offline analyzer, tester/governance packets)  
**Default replay bundle:** `bundle_full_20260616_phase7j_alias_round2_candidate` (featured catalog entry at plan time)  
**Related:** `docs/PHASE_7K_TRACK_C_TESTER_OPERATIONS_PACKET.md`, `docs/PHASE_7K_QUERY_EVIDENCE_GOVERNANCE.md`, `docs/QUERY_VALIDATION_ROUND_1.md`

---

## Purpose

Phase 7L plans a **curated, human-reviewed search regression matrix** that protects known SiraLex lookup behavior independently of user telemetry.

The matrix answers engineering questions:

| Question | Matrix answers |
|----------|----------------|
| Does a known French lemma still hit the expected posting? | Yes/no + ordered `ir_ids` |
| Do approved alias rows still resolve? | Alias-family cases |
| Do approved supplements still resolve? | Supplement-family cases |
| Does the norm_v3 ladder still stop at the expected rung? | Ladder/key metadata |
| Did a bundle or search change regress a previously signed-off path? | Historical-regression cases |
| Do Python offline replay and TypeScript runtime agree? | Dual-runner parity |

**Core rule:**

```text
This regression matrix contains curated reviewed expectations.
It is not user telemetry.
It must never be used to infer product demand, tester frequency, or dictionary-gap priority.
```

Query-evidence exports (Phase 7K) may **inform** which cases to add during maintainer review, but mined log rows must never be copied directly into the matrix without a separate human review step and explicit `source_of_expectation`.

---

## Scope and non-goals

### In scope

- Schema for curated regression cases (JSONL) with one primary `case_family` and optional `case_tags` per row
- Thirteen case families including `unicode_canonicalization`
- Expected-result contract (status, count, ordered IDs, ladder metadata)
- Dual execution: Python replay + TypeScript runtime
- Bundle-version pinning, checksum metadata, and human-governed golden updates
- Validator, golden outputs, CI hook plan, and reviewed update procedure

### Non-goals

- Changing search behavior, bundles, catalog, aliases, supplements, or runtime code in this phase
- Processing real tester exports or promoting query-evidence candidates
- Replacing Phase 7K telemetry governance or conflating matrix rows with `phase7k_query_candidates.jsonl`
- Auto-mining cases from logs, gap miners, or analyzer output without review
- Broad calibration suites (156-query Round 1 style) as the default CI gate — those remain reference material, not the curated matrix

---

## Separation from query-evidence telemetry

| Dimension | Phase 7L regression matrix | Phase 7K query evidence |
|-----------|---------------------------|-------------------------|
| **Source** | Maintainer-authored, reviewed expectations | Opt-in tester exports |
| **Intent** | Engineering QC / regression protection | Product triage / gap hypotheses |
| **Cohort** | N/A (not traffic) | `tester` only for triage |
| **Demand signal** | **Must never** be interpreted as demand | Natural-use only for demand |
| **Row status** | `review_status: approved` for shipped matrix rows | Analyzer emits `candidate` only |
| **Location** | `shared/search_regression/` (planned) | `shared/query_evidence/` (analyzer artifacts) |
| **Probe strings** | `zzzz-nohit-test` = intentional regression probe | Same string **excluded** from product triage |

The matrix may reuse **query strings** that also appear in logs, but the matrix row proves **contractual behavior**, not user frequency. Track C explicitly excludes `zzzz-nohit-test` and structured-usability probes from demand analysis; Track 7L **includes** `zzzz-nohit-test` as a permanent no-hit control.

---

## Regression case schema

One JSON object per line (`search_regression_case_v1`). All cases are hand-authored or human-approved migrations from reviewed baselines — never raw log imports.

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `case_id` | string | yes | Stable id, e.g. `sr7l_001_fruit_exact` |
| `query` | string | yes | Exact UTF-8 lookup literal passed to the runner (see below) |
| `query_unicode_form` | enum | no | `"nfc"` \| `"nfd"` \| `"mixed"` \| `"not_applicable"` — fixture intent only |
| `direction` | enum | yes | `source_to_target` \| `target_to_source` |
| `expected_result_status` | enum | yes | `miss` \| `hit_single` \| `hit_multi` |
| `expected_result_count` | int ≥ 0 | yes | Must equal `len(expected_ir_ids)` |
| `expected_ir_ids` | string[] | yes | **Ordered** posting list; `[]` on miss |
| `expected_matched_key_type` | string | yes | Ladder rung: `casefold`, `diacritics_insensitive`, `punct_stripped`, `nospace`, or `none` |
| `expected_matched_key` | string \| null | yes | Normalized key that matched; `null` on miss |
| `expected_deep_ladder` | boolean | yes | `true` iff matched rung ∈ `{punct_stripped, nospace}` |
| `case_family` | enum | yes | **One required primary family** for coverage accounting — see § Case families |
| `case_tags` | string[] | no | Optional secondary behavioral labels — see below |
| `source_of_expectation` | string | yes | Provenance tag, e.g. `phase7j_golden_replay`, `roadmap_ui_signoff`, `alias_table_src_alias_phase7j_0001`, `maintainer_review_YYYY-MM-DD` |
| `bundle_id` | string | yes | Bundle the expectation was reviewed against |
| `norm_version` | string | yes | e.g. `norm_v3` |
| `review_status` | enum | yes | `approved` for matrix rows (contrast with 7K analyzer `candidate`) |
| `notes` | string | no | Human rationale, policy context, ordering rationale |

### `query` literal preservation

```text
query: Exact UTF-8 lookup literal passed to the runner.
The fixture must preserve the supplied code-point sequence; it must not normalize query text before execution.
Most rows should use NFC literals.
unicode_canonicalization rows may intentionally use decomposed NFD input.
```

**Normalization happens inside the search implementation under test, never in fixture loading.** Runners and fixture loaders must pass `query` to search exactly as stored in the matrix JSONL.

### `query_unicode_form` (optional)

```text
query_unicode_form: "nfc" | "nfd" | "mixed" | "not_applicable"
Optional metadata describing the authored literal.
It documents fixture intent only; runners must use query exactly as stored.
```

| Seed query | Required `query_unicode_form` |
|------------|-------------------------------|
| `Kùn` | `nfc` |
| `kùn` | `nfd` |
| All ordinary French seed queries | `nfc` |
| `zzzz-nohit-test` | `not_applicable` |

### `case_tags` (optional)

```text
case_tags: string[]
Optional secondary behavioral labels.
Examples: ["multi_hit", "alias_expanded"], ["unicode_nfc"], ["historical_phase7j"].
case_family remains the one required primary family used for coverage accounting.
```

Tags describe cross-cutting behavior; they do **not** replace the primary `case_family`. Multi-hit behavior is independently enforced by `expected_result_status`, `expected_result_count`, and `expected_ir_ids` — not by assigning multiple primary families.

Optional metadata (recommended on matrix manifest, may duplicate per row):

- `catalog_version`
- `bundle_content_sha256` or `search_index_sha256`

### Example row (illustrative shape only)

```json
{
  "case_id": "sr7l_probe_nohit",
  "query": "zzzz-nohit-test",
  "direction": "source_to_target",
  "expected_result_status": "miss",
  "expected_result_count": 0,
  "expected_ir_ids": [],
  "expected_matched_key_type": "none",
  "expected_matched_key": null,
  "expected_deep_ladder": false,
  "case_family": "intentional_no_hit",
  "query_unicode_form": "not_applicable",
  "source_of_expectation": "phase7k_fixture_probe",
  "bundle_id": "bundle_full_20260616_phase7j_alias_round2_candidate",
  "norm_version": "norm_v3",
  "review_status": "approved",
  "notes": "Intentional regression probe only; not demand evidence."
}
```

**Exact-outcome rule:** A regression matrix row may not contain alternative expected outcomes. Every field in the expected-result contract must be a single approved value — no “single or multi-hit”, no optional ID lists, no runner-specific branches.

---

## Case families

Thirteen primary families. Each row has exactly **one** `case_family`. Use `case_tags` for secondary labels.

| Family | Protects | Typical signals |
|--------|----------|-----------------|
| `source_exact_hit` | Canonical source→target lookup | `hit_single`, `casefold`, alias-free |
| `source_multi_hit` | Multi-posting source queries (primary family when multi-hit is the main coverage goal) | `hit_multi`, ordered `ir_ids` contractual |
| `target_exact_hit` | Target→source lookup | `tgt_*` ladder, often `casefold` |
| `source_alias_hit` | Approved alias table resolution | Hits via alias-expanded index keys |
| `source_supplement_hit` | Approved supplement mappings | Hits via supplement-expanded keys |
| `punctuation_normalization` | Punct/dot/hyphen variants | May use `punct_stripped` |
| `diacritic_normalization` | Accent-stripped or alternate spellings | `diacritics_insensitive` |
| `spacing_normalization` | Nospace / collapsed spacing | `nospace` or `punct_stripped` |
| `unicode_canonicalization` | NFC/NFD-equivalent query handling | Expected behavior may still resolve at `casefold` after canonical normalization; must **not** be assumed to mean `diacritics_insensitive` ladder matching |
| `deep_ladder_hit` | Fallback rung behavior | `expected_deep_ladder: true` |
| `intentional_no_hit` | Controlled miss probes | `miss`, empty `ir_ids` |
| `target_side_ambiguity` | Target-side policy / homograph precision | Exact posting contract per reviewed policy |
| `historical_regression` | Behavior that changed across bundle milestones | Captures before/after with review note |

**Coverage model:** `case_family` = one required primary family per row. `case_tags` = optional secondary labels. **`unicode_canonicalization` is required family coverage** (seed: `kùn`). The plan defines **13** primary families.

Every required seed query maps to exactly one primary `case_family`. Optional `case_tags` annotate cross-cutting behavior (e.g. `multi_hit` on an alias-primary row). Do not use compound family strings such as `source_multi_hit + source_alias_hit`.

---

## Required current cases

The matrix **must** include the following named queries as approved seed rows against the featured bundle `bundle_full_20260616_phase7j_alias_round2_candidate`. Slice A0 replay (`norm_v3`, first-hit ladder) pins exact contracts below. Rows marked **approved baseline** are maintainer decisions from Slice A0 — regression controls only, not a policy or search-behavior change.

| Query | Direction | Primary `case_family` | `case_tags` | `query_unicode_form` | Reviewed expectation | Cited IDs / sources |
|-------|-----------|------------------------|--------------|----------------------|----------------------|---------------------|
| `fruit` | `source_to_target` | `source_exact_hit` | — | `nfc` | `hit_single`, `casefold`, key `fruit` | `7cdb6070ce427a6d` — golden replay |
| `fruits` | `source_to_target` | `source_alias_hit` | — | `nfc` | `hit_single`, alias `fruits`→`fruit` | `7cdb6070ce427a6d`; `src_alias_phase7j_0001` |
| `grand-parents` | `source_to_target` | `source_alias_hit` | `["multi_hit", "historical_phase7j"]` | `nfc` | `hit_multi` (2), ordered grand-mère then grand-père | `1f6d3a5919110b21`, `957bd76b41fda053`; `src_alias_phase7j_0011` |
| `mère` | `source_to_target` | `source_multi_hit` | — | `nfc` | `hit_multi` (3), `casefold` | golden replay |
| `bras` | `source_to_target` | `source_exact_hit` | — | `nfc` | `hit_single`, `casefold` | Slice A0 replay |
| `manger` | `source_to_target` | `source_exact_hit` | — | `nfc` | `hit_single`, `casefold` | Slice A0 replay |
| `mou` | `source_to_target` | `source_exact_hit` | — | `nfc` | `hit_single`, `casefold` | Slice A0 replay |
| `tête` | `source_to_target` | `source_exact_hit` | — | `nfc` | `hit_single`, `casefold` | Slice A0 replay; ROADMAP UI sign-off |
| `poil` | `source_to_target` | `source_supplement_hit` | — | `nfc` | **Approved baseline** — see below | `src_supp_phase7b_0001`; Slice A0 replay |
| `zzzz-nohit-test` | `source_to_target` | `intentional_no_hit` | — | `not_applicable` | `miss`, ladder `none` | golden replay |
| `Kun` | `target_to_source` | `target_exact_hit` | — | `nfc` | `hit_single`, `casefold`, key `kun` | `b07ae7bd61ff3c85` — golden replay |
| `Kùn` | `target_to_source` | `target_side_ambiguity` | — | `nfc` | **Approved baseline** — see below | ROADMAP UI sign-off; Slice A0 replay |
| `kùn` | `target_to_source` | `unicode_canonicalization` | `["target_side", "decomposed_unicode"]` | `nfd` | **Approved baseline** — see below | ROADMAP sign-off; Slice A0 replay |

### Approved baseline: `Kùn` (Slice A0)

Featured-bundle regression contract — documents current search behavior; **not** a future policy change.

```yaml
query: Kùn
query_unicode_form: nfc
direction: target_to_source
expected_result_status: hit_multi
expected_result_count: 2
expected_ir_ids:
  - 753fa18e0a6df4ab
  - e28e149f57ab616b
expected_matched_key_type: casefold
expected_matched_key: kùn
expected_deep_ladder: false
case_family: target_side_ambiguity
```

Compare to plain `Kun` in matrix `notes` and `docs/PLAIN_KUN_POLICY_DECISION_MEMO.md` for policy context only — the matrix pins both outcomes as separate regression rows.

### Approved baseline: `kùn` (Slice A0)

Same outcome contract as `Kùn` after norm_v3 search normalization; **decomposed NFD query literal** must be preserved in the fixture.

```yaml
query: kùn   # decomposed: k + U+0300 + n
query_unicode_form: nfd
direction: target_to_source
expected_result_status: hit_multi
expected_result_count: 2
expected_ir_ids:
  - 753fa18e0a6df4ab
  - e28e149f57ab616b
expected_matched_key_type: casefold
expected_matched_key: kùn
expected_deep_ladder: false
case_family: unicode_canonicalization
case_tags:
  - target_side
  - decomposed_unicode
```

`Kùn` and `kùn` need not differ in matched ladder rung; the test verifies canonical-equivalent behavior after norm_v3 normalization — not `diacritics_insensitive` matching.

### Approved baseline: `poil` (Slice A0)

```yaml
query: poil
query_unicode_form: nfc
direction: source_to_target
expected_result_status: hit_single
expected_result_count: 1
expected_ir_ids:
  - ff499fdee22b2b86
expected_matched_key_type: casefold
expected_matched_key: poil
expected_deep_ladder: false
case_family: source_supplement_hit
source_of_expectation: src_supp_phase7b_0001 plus maintainer replay review
```

```text
The supplement row provides provenance for why poil belongs in the matrix.
The regression contract asserts the actual search-index posting returned by the pinned bundle.
It must not substitute the supplement source's cited lexicon IR for the runtime search result.
```

The supplement cites lexicon `43b64456edacdbe0`; the pinned bundle returns index-mapping IR `ff499fdee22b2b86` at `src_casefold` — that mapping IR is the contractual search result.

**Remaining Slice A pins:** `bras`, `manger`, `mou`, and `tête` — exact IR IDs from Slice A0 replay (single-hit, casefold); no maintainer ambiguity reported.

**`zzzz-nohit-test` clarification:**

```text
zzzz-nohit-test is an intentional regression probe only.
It is not user-demand evidence or a candidate dictionary gap.
```

**Historical note:** `grand-parents` was a miss on pre-7J bundle `bundle_full_20260609_phase7f_alias_candidate` (`docs/reports/phase7j_regression_replay.json`) and a hit after alias round 2 — the `historical_phase7j` tag and `notes` capture this; do not add a second contradictory row for the same bundle.

---

## Expected-result contract

Each case verifies, where applicable:

| Assertion | Contract |
|-----------|----------|
| Result status | `expected_result_status` matches derived status from count |
| Exact ordered IR ID list | Actual `ir_ids` **equal** expected list — order is contractual for multi-hit cases |
| Result count | `expected_result_count === len(expected_ir_ids)` |
| Matched ladder/key type | `expected_matched_key_type` matches first-hit ladder rung |
| Matched normalized key | `expected_matched_key` matches ladder key (casefold rules per direction) |
| Deep-ladder boolean | `expected_deep_ladder` true iff rung ∈ `{punct_stripped, nospace}` |
| Direction | Runner must honor `direction`; no cross-direction fallback |

**Ordering rule:** For multi-hit cases (`mère`, `grand-parents` via `case_tags: ["multi_hit"]`), tie-break order follows search-index first-seen posting order for the matched key — same doctrine as runtime `searchQuery()`. Any intentional ranking change requires a human review note and simultaneous Python + TS golden update.

**No alternative outcomes:** Every row asserts exactly one outcome bundle (status, count, ordered IDs, ladder fields). Runners must fail on any deviation; there is no valid “expected A or expected B” form.

**Miss contract:** On `intentional_no_hit`, assert empty `ir_ids`, `matched_key_type: none`, `matched_key: null`, `expected_deep_ladder: false`.

---

## Fixture and execution design

### Planned repository layout

```text
shared/search_regression/
  search_regression_matrix_v1.jsonl      # curated approved cases
  matrix_manifest_v1.json               # bundle/catalog/hash metadata
  tests/
    golden_python_replay_v1.json        # Slice B golden (per bundle id)
    golden_runtime_replay_v1.json       # Slice C golden
api/search_regression/                  # Slice A/B Python package (planned)
scripts/run_search_regression.py        # Slice B CLI (planned)
web/src/search_regression/              # Slice C runtime adapter (planned)
```

### Fixture rules

- Matrix JSONL contains **reviewed expectations only** — no log exports, no analyzer candidate rows
- **`query` literals preserved exactly** — no NFC/NFD normalization at load time; see `query_unicode_form` metadata
- Golden files store **expected outputs** for a pinned `bundle_id` + content hash
- Do not store raw tester exports or Phase 7K summary/candidate artifacts in this tree
- Synthetic probe strings (`zzzz-nohit-test`) are allowed as **controls**, not as content-gap evidence

### Execution inputs

- `search_index.jsonl` from pinned bundle directory
- `norm_v3` ladder (`shared/normalization/norm_v3.py` Python; `web/src/norm/` TypeScript)
- Optional read-only cross-check: approved alias/supplement tables for `source_of_expectation` strings (do not mutate)

---

## Review and change-control rules

1. **Add case:** Maintainer proposes row → replay on featured bundle → dual-runner agreement → `review_status: approved` → commit matrix + goldens together.
2. **Change expectation:** Forbidden without review note citing one of: intended behavior change, data correction, ranking change, alias/supplement addition, or regression fix.
3. **Remove case:** Only when behavior is intentionally retired; note in matrix changelog.
4. **Never auto-sync from logs:** Query-evidence analyzer output may suggest candidates; humans author matrix rows separately.
5. **Never auto-sync from miners:** Gap discovery remains out of scope for matrix ingestion.
6. **Parity failures:** If Python passes and TS fails (or reverse), treat as **release blocker** for search-touching changes until resolved or documented as known divergence with expiry date.

Matrix row `review_status` is **`approved`**, unlike Phase 7K analyzer output. This is intentional: the matrix **is** the reviewed contract.

---

## Bundle-version policy

Every matrix run must record in `matrix_manifest_v1.json` (or CLI stdout in CI):

| Field | Requirement |
|-------|-------------|
| `bundle_id` | Exact bundle directory name under `web/public/` |
| `catalog_version` | From `web/public/catalog.json` when available; else `(missing)` with audit flag |
| `norm_version` | From bundle manifest / records contract |
| `search_index_checksum` or `bundle_content_hash` | SHA-256 of `search_index.jsonl` or bundle `checksums.sha256` when available |

### Updating expectations when a bundle changes

```text
No silent golden update.
A changed expectation requires a human review note explaining whether it reflects an intended behavior change, data correction, ranking change, alias/supplement addition, or regression.
```

Procedure:

1. Run matrix against new bundle → collect diffs
2. Classify each diff using the categories above
3. Update matrix rows + both goldens in one commit with review note in commit body or `docs/reports/search_regression_changelog.md`
4. If diff is unintentional → fix search/bundle before accepting golden change

Featured bundle pointer changes in `catalog.json` trigger a mandatory full matrix re-run before release sign-off.

---

## Test architecture

Two execution paths share one reviewed matrix file but emit separate goldens so divergence is detectable.

### Path 1 — Python replay regression

- **Engine:** Extend `api/query_evidence/replay.py` patterns or extract shared `lookup` helper into `api/search_regression/replay.py`
- **Input:** `search_index.jsonl` + matrix JSONL
- **Ladder:** `norm_v3` offline, first-hit doctrine, directional `src_*` / `tgt_*` prefix
- **Output:** Per-case pass/fail + manifest metadata
- **Tests:** `pytest api/search_regression/tests/` against `golden_python_replay_v1.json`

### Path 2 — Runtime / UI regression (TypeScript)

- **Engine:** Existing `searchQuery()` after `importSearchIndexJsonl` / bundle import (same path as `web/src/query_validation/` and `web/tools/norm_v3_matrix_runner.ts`)
- **Input:** Same matrix JSONL
- **Environment:** `fake-indexeddb` + vitest (tools config pattern)
- **Output:** Same assertion shape as Python golden
- **Tests:** `web/src/search_regression/search_regression.test.ts` (planned)

### Parity test (Slice C)

- A dedicated test loads both runners on the **same** matrix subset (minimum: thirteen seed queries) and fails on any field mismatch (`ir_ids` order, ladder, count, status).
- Parity failures must not be silenced with runner-specific expected files except during explicit migration windows documented in changelog.

```text
1. Python replay regression against search_index.jsonl and norm_v3.
2. Runtime/UI regression through the TypeScript search path.
```

They must share the same reviewed matrix but remain separate tests so divergence is detectable.

---

## Acceptance criteria

Phase 7L implementation is complete when:

| # | Criterion |
|---|-----------|
| 1 | Matrix schema validator rejects missing fields, bad enums, count/IR mismatches, and compound/ambiguous expectations |
| 2 | All thirteen named seed cases exist (including `poil`) with `review_status: approved` and exactly one primary `case_family` each |
| 3 | `poil` row matches approved baseline (`ff499fdee22b2b86` mapping IR, not supplement lexicon IR) |
| 4 | At least one `unicode_canonicalization` case exists (`kùn` seed, NFD literal) with exact approved contract fields |
| 5 | `Kùn` (NFC) and `kùn` (NFD) rows match approved multi-hit contracts; `query_unicode_form` set correctly |
| 6 | `query_unicode_form` validated when present; loaders/runners do not pre-normalize `query` |
| 7 | Python runner passes golden on featured bundle with manifest checksum recorded |
| 8 | TypeScript runner passes runtime golden on same bundle |
| 9 | Parity test passes for seed subset (or documented exceptions with expiry) |
| 10 | CI runs Python matrix on PRs touching search, norm, bundle import, or index build |
| 11 | Documentation describes update procedure, telemetry separation, `case_family` / `case_tags`, and query literal rules |
| 12 | No matrix row sourced directly from raw query logs without `source_of_expectation` review tag |
| 13 | `zzzz-nohit-test` remains `intentional_no_hit` in all bundle versions unless deliberately retired |

---

## Risks and open questions

| Risk | Mitigation |
|------|------------|
| Python vs TS ladder drift | Parity test + shared matrix; extract shared test vectors |
| Bundle rotation breaks goldens | Manifest hash gate; changelog-driven updates |
| Matrix confused with 7K evidence | Separate paths, doc banners, no shared JSONL files |
| Over-large matrix slows CI | Keep curated core ≤ ~40 cases in default CI; optional extended profile locally |
| Unicode normalization (`Kùn` vs `kùn`) | Approved Slice A0 baselines pinned; NFD literal for `kùn`; no loader pre-normalization |
| Multi-hit order disputes | Document first-seen index order doctrine in `notes` per case |
| Featured bundle not in CI checkout size | CI uses pinned subset or LFS policy already used for bundles |

**Open questions (resolve before Slice A merge):**

1. Should extended Round 1 queries migrate selectively into 7L, or remain a separate calibration doc only?
2. Single manifest file vs per-row `bundle_id` when testing candidate bundles pre-release?
3. Wire matrix into release checklist alongside existing Phase 7J bundle verification scripts?

---

## Proposed implementation slices

No more than four small commits. Each slice is independently reviewable.

### Slice A — Schema + curated fixture + validator

#### Slice A validator requirements (mandatory)

Slice A must implement tests requiring:

- `query_unicode_form` enum validation when the field is present (`nfc`, `nfd`, `mixed`, `not_applicable`)
- `unicode_canonicalization` rows preserve their authored literal (no silent NFC rewrite in the fixture file)
- `kùn` seed must be NFD; `Kùn` seed must be NFC (validator checks `query_unicode_form` and/or Unicode normalization form of `query`)
- Runners and fixture loaders **must not** pre-normalize `query` before search execution (documented invariant; test via loader contract or integration smoke)
- Approved baseline contracts for `Kùn`, `kùn`, and `poil` match Slice A0 values in this plan

These are Slice A scope only — not deferred to Slice B/C.

| Item | Detail |
|------|--------|
| **Allowed files** | `shared/search_regression/search_regression_matrix_v1.jsonl`, `shared/search_regression/matrix_manifest_v1.json`, `api/search_regression/schema.py`, `api/search_regression/validate_matrix.py`, `api/search_regression/tests/test_validate_matrix.py`, `docs/PHASE_7L_SEARCH_REGRESSION_MATRIX_PLAN.md` (cross-link only if needed) |
| **Tests** | Validator unit tests (mandatory for Slice A): required fields; enum guards for `case_family`, `query_unicode_form` when present; count/IR consistency; single primary `case_family`; optional `case_tags`; seed query presence; `zzzz-nohit-test` no-hit shape; **`unicode_canonicalization` rows must preserve authored literal** — `kùn` seed must be NFD, `Kùn` seed must be NFC; **`runners/fixture loaders must not pre-normalize `query` before search execution**; approved `Kùn`/`kùn`/`poil` baseline contracts |
| **Artifact boundaries** | Matrix rows only; embed Slice A0 approved contracts for `Kùn`, `kùn`, `poil`, and remaining single-hit pins (`bras`, `manger`, `mou`, `tête`) — no log imports |
| **Commit message** | `Add Phase 7L search regression matrix schema and seed fixture` |

### Slice B — Python replay runner + golden results

| Item | Detail |
|------|--------|
| **Allowed files** | `api/search_regression/replay.py`, `scripts/run_search_regression.py`, `shared/search_regression/tests/golden_python_replay_v1.json`, `api/search_regression/tests/test_replay_golden.py` |
| **Tests** | Golden replay against featured bundle; manifest records `bundle_id`, `catalog_version`, `norm_version`, search-index SHA-256 |
| **Artifact boundaries** | Reuse replay ladder from query evidence; do not modify `api/query_evidence/` behavior; goldens are test fixtures only |
| **Commit message** | `Add Phase 7L Python search regression runner` |

### Slice C — Runtime adapter + parity test

| Item | Detail |
|------|--------|
| **Allowed files** | `web/src/search_regression/matrix_loader.ts`, `web/src/search_regression/run_matrix.ts`, `web/src/search_regression/search_regression.test.ts`, `shared/search_regression/tests/golden_runtime_replay_v1.json`, optional `web/vitest.search_regression.config.ts` |
| **Tests** | Runtime golden pass; parity test vs Python output for seed cases (CI may invoke Python script or compare committed parity snapshot) |
| **Artifact boundaries** | Read-only matrix import; no changes to production search UX |
| **Commit message** | `Add Phase 7L runtime search regression and parity tests` |

### Slice D — CI / documentation and reviewed update procedure

| Item | Detail |
|------|--------|
| **Allowed files** | `.github/workflows/` or existing CI config (search regression job only), `docs/reports/search_regression_changelog.md`, README cross-link in `docs/ROADMAP.md` or developer doc (minimal) |
| **Tests** | CI job runs `pytest api/search_regression/` + `vitest` regression config |
| **Artifact boundaries** | Docs describe telemetry separation and golden update rules; no bundle/catalog changes |
| **Commit message** | `Wire Phase 7L search regression into CI and docs` |

---

## References

| Artifact | Role |
|----------|------|
| `shared/query_evidence/fixtures/tests/golden_replay_summary.json` | Seed IR expectations for fruit, fruits, mère, grand-parents, zzzz-nohit-test, Kun |
| `shared/aliases/source_aliases_v1.jsonl` | Alias-family provenance (`fruits`, `grand-parents`) |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Supplement-family seed (`poil`) |
| `docs/ROADMAP.md` | Manual UI sign-off: `tête`, `Kùn`, decomposed `kùn` |
| `docs/QUERY_VALIDATION_ROUND_1.md` | Calibration reference — not auto-imported |
| `docs/reports/phase7j_regression_replay.json` | Historical regression context |
| `api/query_evidence/replay.py` | Offline replay reference implementation |
