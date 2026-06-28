# Phase 7N Release Plan Template

**Status:** template — documentation only  
**Use when:** a Phase 7N intervention has `approve_for_workflow` **and** separate implementation authorization  
**Companion:** `docs/PHASE_7N_INTERVENTION_REVIEW_PACKET.md`, `docs/PHASE_7N_TEST_PLAN_TEMPLATE.md`, `docs/reports/search_regression_changelog.md`

Complete one copy per release. A release plan authorizes **one category**, **one bounded problem**, **one reviewed change set**.

---

## Release rejection rules (read first)

**Do not combine in one release:**

- source aliases **and** source-index supplements
- search/data changes **and** catalog/install UX work
- phrase mappings **and** alias rows
- result-interpretability bundle work **and** unrelated UI polish
- multiple unrelated user problems

If more than one category or problem appears in this plan, **stop** and split into separate Phase 7N rounds.

---

## 1. Release metadata

| Field | Value |
|---|---|
| Release ID | `phase7n_release_YYYYMMDD_NNN` |
| Intervention packet ID | |
| Decision record ID | |
| Author | |
| Reviewer | |
| Implementation authorized by | |
| Authorization date | |
| Target merge branch | |

---

## 2. One category only

```text
[ ] source_aliases
[ ] source_index_supplements
[ ] safe_phrase_aliases
[ ] result_interpretability
[ ] catalog_install_friction
```

**Selected category:** ____________________

---

## 3. One bounded problem only

**Problem (user terms):**

> 

**In scope (exact strings / surfaces):**

> 

**Out of scope:**

> 

---

## 4. Baseline bundle / catalog identity

Record the **pre-change** featured identity. This is the rollback target if publication fails validation.

| Field | Baseline value |
|---|---|
| `bundle_id` | |
| `catalog_version` | |
| `content_sha256` | |
| `search_index_sha256` | |
| `norm_version` | |
| Catalog path | `web/public/catalog.json` |

---

## 5. Changed artifacts

List every file or directory expected to change in this release.

| Path | Change summary |
|---|---|
| | |

**Expected derived outputs (if applicable):**

- [ ] `search_index.jsonl` keys added/changed (list queries)
- [ ] new bundle directory under `web/public/`
- [ ] `web/public/catalog.json` pointer update
- [ ] alias / supplement / phrase JSONL rows
- [ ] Phase 7L matrix rows
- [ ] Python golden
- [ ] Runtime golden
- [ ] `docs/reports/search_regression_changelog.md` entry
- [ ] UI files (category E or interpretability UI only)

---

## 6. Unchanged / protected artifacts

Confirm each remains unchanged **unless explicitly listed in §5**.

```text
[ ] searchQuery() implementation unchanged (categories A–C; default)
[ ] norm_v3 normalization unchanged (categories A–C; default)
[ ] directional ladder unchanged (categories A–C; default)
[ ] records.jsonl byte-identical (alias/supplement path; default)
[ ] unrelated search_index.jsonl keys unchanged
[ ] unrelated alias / supplement / phrase rows unchanged
[ ] query logging behavior unchanged
[ ] unrelated ordinary-user UI unchanged
```

**Additional protected items:**

> 

---

## 7. Exact validation commands

Run from repository root unless noted. All commands must pass before merge.

### Phase 7L Python regression

```bash
python3 -m pytest \
  api/search_regression/tests/test_validate_matrix.py \
  api/search_regression/tests/test_replay_golden.py \
  -q
```

### Phase 7L runtime regression

```bash
cd web
npm ci
npx vitest run -c vitest.search_regression.config.ts
npx vitest run src/search/search_query.test.ts
```

### Category-specific validators

| Category | Command |
|---|---|
| `source_aliases` | `python3 -m pytest api/source_aliases/tests/ -q` |
| `source_index_supplements` | `python3 -m pytest api/source_index_supplements/tests/ -q` |
| `safe_phrase_aliases` | *(phrase validator when implemented)* |
| `result_interpretability` | *(bundle verify + UI tests as applicable)* |
| `catalog_install_friction` | `cd web && npx vitest run src/bundle_catalog.test.ts` |

**Additional commands:**

> 

### Bundle verification

```bash
# Replace BUNDLE_DIR with the new bundle path after build
siralex-build-bundle verify --bundle-dir web/public/BUNDLE_DIR
```

**Expected:** VALID; checksums match manifest.

### Catalog verification

- [ ] `web/public/catalog.json` lists exactly one featured entry (or documented exception)
- [ ] `catalog_version` matches `shared/search_regression/matrix_manifest_v1.json` when matrix repinned
- [ ] `url_base` resolves relative to deployed `/catalog.json`
- [ ] `content_sha256` matches bundle manifest

### Manual production smoke

After deploy (or staging URL), verify:

| Check | Query / action | Expected |
|---|---|---|
| Primary intervention | | |
| Control: unrelated hit | e.g. `fruit`, `tête` | unchanged |
| Control: supplement | e.g. `poil` | unchanged if not in scope |
| Control: alias | e.g. `fruits` | unchanged if not in scope |
| Control: target ambiguity | e.g. `Kùn` | unchanged if not in scope |
| Control: intentional miss | e.g. `zzzz-nohit-test` | miss |

**Smoke URL:**

> 

---

## 8. Rollback bundle / catalog target

| Field | Rollback value |
|---|---|
| `bundle_id` | *(same as §4 baseline)* |
| `catalog_version` | |
| Git revert commit / tag | |

**Rollback procedure:**

1. Restore `web/public/catalog.json` pointer to baseline bundle.
2. Re-run Phase 7L Python + runtime regression against baseline manifest.
3. Deploy previous catalog pointer if production was updated.
4. Record incident note in changelog or maintainer log.

---

## 9. Human changelog entry

Add an entry to `docs/reports/search_regression_changelog.md` when matrix, bundle, or expectations change.

```markdown
### YYYY-MM-DD — <short title>

- **Reviewer:**
- **Commit / PR:**
- **Change category:** alias_supplement_data | bundle_rotation | catalog_pointer | golden_update | regression_fix | ...
- **Pinned bundle:** `bundle_id` + `search_index_sha256`
- **Matrix cases affected:**
- **Review note:** Why this change is approved and what contract it preserves or intentionally changes.
- **Validation:** Python pytest pass; runtime vitest pass; parity confirmed.
```

**Changelog text drafted:**

> 

---

## 10. Post-release device checks

Use `docs/PHASE_7N_DEVICE_VALIDATION_CHECKLIST.md` after production pointer update.

| Check | Pass? | Notes |
|---|---|---|
| Featured dictionary install from live `/catalog.json` | | |
| Offline reopen | | |
| Intervention scenario on device | | |
| Control queries unchanged on device | | |
| No new install/direction confusion (category E) | | |

**Device / browser record:**

> 

---

## 11. Release sign-off

| Gate | Pass? | Sign-off |
|---|---|---|
| One category only | | |
| One bounded problem only | | |
| Test plan complete | | |
| Phase 7L dual-runner pass | | |
| Bundle verify VALID | | |
| Catalog verify pass | | |
| Changelog entry ready | | |
| Rollback target recorded | | |

**Release approved for merge:** NO / YES

**Approved by / date:**

> 
