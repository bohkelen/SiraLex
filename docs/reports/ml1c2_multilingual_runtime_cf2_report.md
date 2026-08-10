# ML1C2 — Multilingual Runtime + CF2 Search-Language Provenance

## Decision

```text
ML1C2_MULTILINGUAL_RUNTIME_ACCEPTED
ML1C2A_CF2_SCHEMA_VERSIONING_FIXED
```

## BASE_COMMIT

```text
8ddbbedeeacd6b97f89c4441d65338d4cf83b0e7
```

This slice adds the runtime language model for FR↔MNK and EN↔MNK lookup, persists installed English capability metadata, and makes CF2 capable of recording which lookup pair produced a reported search.

It does **not** expose an English selector in the consumer Search UI (ML1D), does not change Learning/CF1/bundle-builder/index generation, does not bump IndexedDB version, and does not expand the query-log schema.

---

## LookupMode

Module: `web/src/search/lookup_mode.ts`

```typescript
type LookupLanguage = "fr" | "en" | "mnk";
type LookupMode = { from: LookupLanguage; to: LookupLanguage };
```

| Check | Result |
|-------|--------|
| Valid pairs: fr→mnk, en→mnk, mnk→fr, mnk→en | PASS |
| Invalid pairs rejected (fr↔en, same-lang, etc.) | PASS |
| Centralized `isValidLookupMode` / assert helpers | PASS |
| No pair validation scattered into UI chrome | PASS |

### Key-family mapping

| Lookup | Family |
|--------|--------|
| fr → mnk | `src_*` |
| en → mnk | `en_*` |
| mnk → fr | `tgt_*` |
| mnk → en | `tgt_*` |

No `tgt_fr_*` / `tgt_en_*`. Preferred gloss language is separate from index family.

### Legacy adapter

| Legacy `SearchDirection` | LookupMode |
|--------------------------|------------|
| `source_to_target` | `{ from:"fr", to:"mnk" }` |
| `target_to_source` | `{ from:"mnk", to:"fr" }` |

`source_to_target` is **never** silently reinterpreted as English.

### Search API

- Preferred: `searchQueryForLookupMode(db, storageScopeId, lookupMode, query, directional, capabilityMeta)`
- Legacy: `searchQuery(...)` unchanged semantically (FR↔MNK via `src_*`/`tgt_*`)
- Ladder reused exactly; only key-family prefix selection changes
- No fuzzy / stemming / tokenization / cross-language fallback

### Capability gating

English endpoints require **both**:

- `lookup_languages` includes `"en"`
- `search_key_families` includes `"en"`

Otherwise fail closed with `LookupCapabilityError` (`english_lookup_unsupported`). Never silently search `src_*` for English.

Legacy bundles without those fields remain FR↔MNK only.

### Preferred gloss helper

`preferredGlossLanguage(mode)` + `glossFallbackChain(preferred)`:

| Mode | Preferred gloss |
|------|-----------------|
| mnk → fr | fr |
| mnk → en | en |
| fr → mnk | fr |
| en → mnk | en |

Fallback: preferred → FR|EN alternate → unavailable. **Russian is NEVER fallback.**

---

## Installed bundle metadata

Persisted on install into `ActiveBundleMeta` (optional document fields):

- `lexical_language`
- `lookup_languages`
- `search_key_families`

IndexedDB version: **unchanged at 6** (no new stores/indexes).

`en_gloss_key` rule version is not required for runtime gating and is not duplicated into registry meta.

---

## CF2 language provenance

Chosen representation: **A — `input_lang` + `output_lang`**

Rationale: `input_lang` alone cannot distinguish MNK→FR from MNK→EN under `target_to_source`. Storing the actual lookup pair while retaining `search_direction` as the legacy mirror.

| Field | Values |
|-------|--------|
| `input_lang` | `"fr" \| "en" \| "mnk"` |
| `output_lang` | `"fr" \| "en" \| "mnk"` |
| `search_direction` | retained |

See **ML1C2A — CF2 schema versioning** below for the V1/V2 split (V1 frozen without langs; V2 requires both).

### Legacy-record interpretation

| Stored shape | Interpretation |
|--------------|----------------|
| V1 (missing langs) + `source_to_target` | FR→MNK |
| V1 (missing langs) + `target_to_source` | MNK→FR |

Safe because English was not previously consumer-accessible.

### New records

Capture context always writes explicit `input_lang` / `output_lang` from the executed LookupMode as **draft schema V2** (consumer UI currently maps binary direction → FR↔MNK via the legacy adapter; harness/tests may supply EN pairs).

### Validation / export / management

| Check | Result |
|-------|--------|
| Invalid pairs rejected on V2 | PASS |
| Package schemas: V1 historical + V2 export default | PASS |
| Export upgrades V1 copies to V2 without mutating local rows | PASS |
| Import still not added | PASS (unchanged) |
| Bundle-removal retention | PASS (unchanged store behavior) |
| Stale edit/delete | PASS (unchanged; langs preserved on V2 update; V1 never upgraded in place) |
| Management visuals | No redesign; records remain manageable |

---

## ML1C2A — CF2 schema versioning

Previous ML1C2 attempt incorrectly reused strict v1 identifiers for additive
language fields. Matching manifest/package text labeled `v1` was therefore not
parseable by a historical v1 parser — that violates schema identity.

Resolved model:

- local V1 retained (frozen; no language fields)
- multilingual local V2 (`search_failure_feedback_draft_v2`)
- package V1 retained (`siralex_search_feedback_v1`, V1 drafts only)
- new governed export V2 (`siralex_search_feedback_v2`)
- no IndexedDB migration (store holds mixed V1/V2 documents; version stays 6)

### Draft schemas

| Schema | Constant | Language fields |
|--------|----------|-----------------|
| V1 (frozen) | `search_failure_feedback_draft_v1` | **Absent** — `input_lang`/`output_lang` are `unknown_field` |
| V2 | `search_failure_feedback_draft_v2` | **Required** — both must form a valid LookupMode mirroring `search_direction` |

Union type: `SearchFeedbackDraft = SearchFeedbackDraftV1 | SearchFeedbackDraftV2`.

`SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION` remains a deprecated alias for V1.

### Package schemas

| Schema | Constant | Nested drafts |
|--------|----------|---------------|
| V1 | `siralex_search_feedback_v1` | V1 drafts only |
| V2 | `siralex_search_feedback_v2` | V2 drafts only |

`SEARCH_FEEDBACK_PACKAGE_SCHEMA` aliases V1 for historical identity checks.

- `buildSearchFeedbackPackageV1` — historical V1 builder (tests / V1 archives).
- `buildSearchFeedbackPackage` — **default export builder**: always produces PackageV2.
  - V1 local drafts → deterministic **export copies** upgraded to V2 (`source_to_target`→fr/mnk, `target_to_source`→mnk/fr); inputs are not mutated.
  - V2 local drafts → cloned as V2.

Authority label unchanged:
`unreviewed_search_failure_feedback_must_not_be_treated_as_missing_entry_truth`.
Status remains `draft`. No import UI.

### Store behavior

- **Create** always writes V2 with required `input_lang`/`output_lang`.
- **Update** preserves `schema_version` and (for V2) language pair; never upgrades a V1 row in place.
- Stored V1 rows remain readable/listable/editable for user-evidence fields only.

### English undirected fail-closed

`searchQueryForLookupMode` rejects EN endpoints when `searchIndexDirectional !== true`, even if capability meta advertises `en`. FR↔MNK undirected lookups remain permitted.

---

## IndexedDB / query-log impact

| Item | Result |
|------|--------|
| IndexedDB version changed | **NO** (still 6) |
| Query-log schema changed | **NO** — consumer Search still only executes FR↔MNK via `SearchDirection`; CF2 holds multilingual provenance. Expanding query logs deferred rather than broadening scope. |

---

## EN runtime probes (synthetic)

Index:

- `src_casefold maison → rec-house`
- `en_casefold house → rec-house`
- `tgt_casefold bón → rec-house`

| Query | Mode | Result |
|-------|------|--------|
| maison | FR→MNK | rec-house |
| house | EN→MNK | rec-house |
| bón | MNK→FR | rec-house |
| bón | MNK→EN | rec-house |
| house | FR→MNK | miss |
| maison | EN→MNK | miss |
| house | MNK→FR | miss |

Capability:

| Bundle | EN→MNK |
|--------|--------|
| legacy (no en meta) | fail closed |
| multilingual (both fields) | permitted |

---

## High-risk files

### `web/src/search/lookup_mode.ts` (new)

- **Reason:** central LookupMode contract, mapping, capability, gloss helper, CF2 resolve helper.
- **Before:** none.
- **After:** single source of truth for valid pairs and family mapping.

### `web/src/search/search_query.ts`

- **Reason:** multilingual ladder API + shared exactness ladder.
- **Before:** `SearchDirection` → `src_*`/`tgt_*` only.
- **After:** `searchQueryForLookupMode` selects `src_*`/`en_*`/`tgt_*`; legacy `searchQuery` unchanged.

### `web/src/idb/siralex_db.ts` + `web/src/install/bundle_install.ts`

- **Reason:** persist capability metadata for runtime gating.
- **Before:** directional flag + FR/MNK chrome labels only.
- **After:** optional `lexical_language` / `lookup_languages` / `search_key_families` on install; DB version still 6.

### CF2 types / validation / store / package / capture

- **Reason:** schema-versioned language provenance (ML1C2A).
- **Before:** optional additive langs on a single V1 draft/package shape.
- **After:** V1 frozen without langs; V2 requires langs; default export package is V2 with upgrade-on-export for V1 rows; package schema strings V1+V2.

### `web/src/main.ts`

- **Reason:** CF2 snapshot receives exact LookupMode for the executed search.
- **Before:** snapshot carried `search_direction` only.
- **After:** also `input_lang`/`output_lang` from legacy adapter (FR↔MNK). **No language picker UI.**

---

## Scope deviations

```text
NONE
```

Unexpected changes:

```text
NONE
```

Learning / CF1 / bundle-builder / English index builder / Russian:

```text
NONE
```

Search UI language selector:

```text
NO
```

---

## Tests / build / check

| Suite | Result |
|-------|--------|
| Focused lookup/search/CF2 unit tests | **126 passed** |
| `npm --prefix web run test:run` | **895 passed**, 12 failed known `query_log_*` baseline only |
| `test:e2e:search-feedback` | **7 passed** |
| `test:e2e:ux2-search-feedback` | **4 passed** |
| `test:e2e:ux2-search` | **2 passed** |
| `npm --prefix web run build` | PASS |
| `git diff --check` | PASS |

---

## Files committed

```text
A  web/src/search/lookup_mode.ts
A  web/src/search/lookup_mode.test.ts
A  docs/reports/ml1c2_multilingual_runtime_cf2_report.md
M  web/src/search/search_query.ts
M  web/src/search/search_query.test.ts
M  web/src/idb/siralex_db.ts
M  web/src/install/bundle_install.ts
M  web/src/main.ts
M  web/src/phase3_bundle_runtime.test.ts
M  web/src/search_feedback/search_feedback_types.ts
M  web/src/search_feedback/search_feedback_validation.ts
M  web/src/search_feedback/search_feedback_validation.test.ts
M  web/src/search_feedback/search_feedback_store.ts
M  web/src/search_feedback/search_feedback_store.test.ts
M  web/src/search_feedback/search_feedback_package.ts
M  web/src/search_feedback/search_feedback_package.test.ts
M  web/src/search_feedback/search_feedback_export.ts
M  web/src/search_feedback/search_feedback_export.test.ts
M  web/src/search_feedback/search_feedback_capture_model.ts
M  web/src/search_feedback/search_feedback_capture_model.test.ts
M  web/src/search_feedback/search_feedback_capture_controller.ts
M  web/src/search_feedback/search_feedback_capture_controller.test.ts
M  web/src/search_feedback/search_feedback_management_session.ts
M  web/src/search_feedback/search_feedback_management_session.test.ts
M  web/src/search_feedback/cf2i5_offline_search_feedback_lifecycle_verification.test.ts
M  web/e2e/search_feedback_lifecycle.spec.ts
M  web/src/feedback/feedback_handoff_session.test.ts
```

## Commit

```text
Add multilingual search runtime and CF2 provenance
```