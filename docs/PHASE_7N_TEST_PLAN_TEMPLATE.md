# Phase 7N Test Plan Template

**Status:** template — documentation only  
**Use when:** a Phase 7N intervention has implementation authorization  
**Companion:** `docs/PHASE_7N_RELEASE_PLAN_TEMPLATE.md`, `docs/reports/search_regression_changelog.md`

Complete one copy per intervention. Tests must cover the **bounded change** and **non-regression of unrelated behavior**.

---

## Test plan metadata

| Field | Value |
|---|---|
| Test plan ID | `phase7n_test_YYYYMMDD_NNN` |
| Release plan ID | |
| Intervention category | |
| Pinned `bundle_id` | |
| Pinned `catalog_version` | |

---

## No behavior change expected (readiness-only work)

Use this section when the change set is **governance documentation only** (Phase 7N0 readiness package or similar).

**Expected product behavior change:** none

**Verification:**

- [ ] `git diff` shows only approved documentation paths
- [ ] No changes under `web/src/search/`, `web/public/bundle_*`, `shared/aliases/`, `shared/source_index_supplements/`, `shared/search_regression/`
- [ ] Phase 7L CI would be unchanged if run

**Sign-off:** Readiness work does not require Phase 7L rerun unless accidentally touching protected paths.

---

## 1. Unit / validator tests

Category-specific schema and table validators.

| Test area | Command | Pass criteria |
|---|---|---|
| Alias table validator | `python3 -m pytest api/source_aliases/tests/ -q` | all pass |
| Supplement validator | `python3 -m pytest api/source_index_supplements/tests/ -q` | all pass |
| Phrase review validator | `python3 -m pytest api/phrase_review/tests/ -q` | all pass |
| Matrix schema validator | `python3 -m pytest api/search_regression/tests/test_validate_matrix.py -q` | all pass |
| Bundle builder | `python3 -m pytest api/bundle_builder/tests/ -q` | all pass |

**Intervention-specific unit cases:**

| Case | Input | Expected |
|---|---|---|
| | | |

---

## 2. Artifact integrity tests

Confirm reviewed tables and reports remain internally consistent.

| Check | Method | Expected |
|---|---|---|
| Alias row copies canonical `resolved_ir_ids` exactly | validator + manual diff | no broadened ID set |
| Supplement row provenance | application report | applied / already_present / conflict classified |
| `records.jsonl` unchanged | SHA-256 compare to baseline | identical for alias/supplement releases |
| New bundle checksums | `checksums.sha256` + manifest | consistent |
| Search index delta report | application report | only expected `src_*` / `tgt_*` keys |

---

## 3. Bundle / index diff checks

| Field | Baseline | After change |
|---|---|---|
| `search_index.jsonl` SHA-256 | | |
| New keys | | |
| Changed keys | | **must be empty** unless explicitly approved |
| Removed keys | | **must be empty** unless explicitly approved |
| Target-side keys touched? | | yes / no |

**Posting-order note:** If a multi-hit case changes, document **exact expected order** in matrix `expected_ir_ids` before accepting.

---

## 4. Phase 7L contract checks

Required for any release that repins bundle, matrix, or goldens.

### Python replay

```bash
python3 -m pytest \
  api/search_regression/tests/test_validate_matrix.py \
  api/search_regression/tests/test_replay_golden.py \
  -q
```

### Runtime replay

```bash
cd web
npm ci
npx vitest run -c vitest.search_regression.config.ts
npx vitest run src/search/search_query.test.ts
```

| Requirement | Pass? |
|---|---|
| All pinned baseline cases pass, plus every newly approved intervention case. | |
| Python/runtime parity on parity fields | |
| New intervention case(s) added with `review_status: approved` | |
| Both goldens updated in same change set (if expectations changed) | |
| `matrix_manifest_v1.json` checksums match pinned bundle | |

**New or updated matrix rows:**

| `case_id` | Query | Expected ordered `ir_ids` |
|---|---|---|
| | | |

---

## 5. Runtime / browser checks

Local dev server or staging; uses real `searchQuery()` + IndexedDB import path.

| Check | Steps | Expected |
|---|---|---|
| Featured install | Open app → add featured dictionary | success |
| Intervention query | | |
| Matched key type / ladder | record in smoke notes | matches matrix |
| Multi-hit order | if applicable | **exact order** matches approved contract |
| Direction toggle | source ↔ target | unrelated direction unchanged |

**Browser matrix (minimum):**

- [ ] Chromium desktop
- [ ] Mobile Safari or Chrome (if device checklist not yet run)

---

## 6. Device checks

Follow `docs/PHASE_7N_DEVICE_VALIDATION_CHECKLIST.md`.

| Session type | Included in demand ranking? | Run for this release? |
|---|---|---|
| Natural-use tester | yes | |
| Structured usability | no (confusion signals only) | |
| Developer smoke | no | |

**Device record:** model, OS, browser, app version, bundle/catalog identity

---

## 7. Production smoke

After catalog pointer update on deployed URL.

| Query / action | Direction | Expected status | Expected ordered IDs (if hit) |
|---|---|---|---|
| **Intervention under test** | | | |
| Control: `fruit` | source_to_target | hit_single | `7cdb6070ce427a6d` |
| Control: `fruits` | source_to_target | hit_single (alias) | unchanged if not in scope |
| Control: `poil` | source_to_target | hit_single | `ff499fdee22b2b86` |
| Control: `mère` | source_to_target | hit_multi (3) | order unchanged if not in scope |
| Control: `Kun` | target_to_source | hit_single | unchanged if not in scope |
| Control: `Kùn` / decomposed `kùn` | target_to_source | hit_multi (2) | order unchanged if not in scope |
| Control: `zzzz-nohit-test` | source_to_target | miss | |

---

## 8. Negative safety tests

Confirm forbidden behaviors do **not** appear.

| Negative test | Input | Must remain |
|---|---|---|
| Fuzzy typo correction | e.g. `à part ças` | miss |
| Phrase decomposition | e.g. `ferme la bouche` | miss (no route to `bouche`) |
| Unapproved plural | *(example outside scope)* | miss |
| Cross-direction leakage | French lemma in target direction | miss |
| Probe string as content gap | `zzzz-nohit-test` | miss |

**Category-specific negatives:**

> 

---

## 9. Non-regression of unrelated behavior (required)

Explicitly assert unrelated contracts still hold.

**Control query set (minimum):**

```text
fruit, fruits, grand-parents, mère, poil, tête, bras, Kun, Kùn, zzzz-nohit-test
```

| Query | Must match baseline? | Actual pass? | Notes |
|---|---|---|---|
| | yes | | |

**Rule:** Any unintentional diff → fix data or search before accepting golden/matrix change.

---

## 10. Posting-list order tests (required when posting list changes)

When an alias, supplement, or index change alters **multi-hit** results:

1. Record baseline ordered `ir_ids` from Phase 7L replay or golden.
2. Record post-change ordered `ir_ids`.
3. If order changed intentionally, update matrix + both goldens with human review note.
4. If order changed unintentionally, **fail** the release.

| Query | Baseline ordered `ir_ids` | New ordered `ir_ids` | Intentional? |
|---|---|---|---|
| | | | |

**First-seen index posting order doctrine:** multi-hit order follows search-index first-seen posting order for the matched key unless a separate ranking policy was explicitly approved (none authorized in Phase 7N by default).

---

## 11. Test sign-off

| Section | Complete? | Owner |
|---|---|---|
| Unit / validator | | |
| Artifact integrity | | |
| Bundle / index diff | | |
| Phase 7L contracts | | |
| Runtime / browser | | |
| Device | | |
| Production smoke | | |
| Negative safety | | |
| Non-regression controls | | |
| Posting-order (if applicable) | | |

**Release test gate:** FAIL / PASS

**Notes:**

> 
