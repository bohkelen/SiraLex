# ML1B — Multilingual Search and Release Contract

## Decision

```text
ML1B_MULTILINGUAL_CONTRACT_APPROVED
```

### ML1B1 addendum (bundle identity reconciliation)

```text
ML1B1_BUNDLE_IDENTITY_RECONCILED
ML1C_BLOCKED_BY_BUNDLE_IDENTITY: NO
```

Canonical specs now distinguish logical `bundle_id` from immutable `content_sha256` / `storage_scope_id`. See §12. No production/runtime code changed in ML1B1.

## BASE_COMMIT

```text
a13f6c774b400e56e169df97fa4d2134e019a840
```

`git log -1`: `a13f6c7 Audit English search and Russian visibility` (ML1A).

ML1B / ML1B1 are **contract / design (+ specification reconciliation) only**. No English indexing, UI, production bundle rebuild/publish, Learning/CF1/CF2 schema implementation, IndexedDB migration, or runtime behavior change was performed.

Featured dictionary under contract: `bundle_full_20260710_337619ff` (8826 lexicon entries; 10509 French `index_mapping` rows; English display-rich, search-inert per ML1A).

---

## 1. Product language model

### Verdict

Recommend a **refined Option A** that stays compatible with the existing binary catalog pair while naming the real product geometry:

| Concept | Contract value | Must not be conflated with |
|---------|----------------|----------------------------|
| **Dictionary lexical authority** | Maninka lexicon entries (`ir_kind: lexicon_entry`, `ir_id`) | UI locale, search input language |
| **Lexical language** | `mnk` | — |
| **Lookup / input languages** | `fr`, `en`, `mnk` | Interface locale |
| **Requested display / gloss language** | `fr` or `en` (consumer); `ru` retained in data only | Search input language |
| **Bundle identity** | Logical `bundle_id` + exact `content_sha256` / `storage_scope_id` | Language preference |
| **Interface locale** | `siralex.ui_locale` (`en` / `fr` UI chrome) | Dictionary search language |

Conceptual model:

```text
lexical_language = mnk
lookup_languages = [fr, en, mnk]
consumer_gloss_languages = [fr, en]   # ru excluded from ordinary consumer preference
```

Catalog / manifest **legacy pair** remains valid and required for old clients:

```text
languages.source_lang / target_lang   # today: fr / mnk
```

Interpretation going forward:

- `source_lang` / `target_lang` describe the **primary catalog pair** and legacy chrome, **not** an exclusive claim that only one non-Maninka language exists.
- Multilingual capability is advertised separately (see §13).
- **One featured bundle** holds FR↔MNK and EN↔MNK lookup over the **same** Maninka `ir_id` space (ML1A Option A). Separate EN↔MNK bundles are rejected (Learning identity split).

### Rejected conflations

- English UI locale ≠ English dictionary search.
- Changing UI language must not silently change lookup language (§8).
- Russian remains provenance/display data, not a lookup language and never a gloss fallback (§7).

---

## 2. Search mode model

### Options evaluated

| Option | Shape | Pros | Cons |
|--------|-------|------|------|
| **A** | Keep `direction` + add `sourceLanguage: "fr" \| "en"` | Small delta from today | Awkward for MNK→FR vs MNK→EN (same index, different display); “sourceLanguage” is misleading when input is Maninka |
| **B** | Explicit `"fr_to_mnk"` … `"mnk_to_en"` | Very clear | Language-hardcoded; poor extension |
| **C** | Generic `{ from, to }` | Simple, extensible, matches product pairs | Requires adapter to legacy `SearchDirection` |

### Recommendation: **C (generic from/to)** with a legacy adapter

TypeScript-level semantics (contract only — not implemented):

```typescript
/** Languages that participate in dictionary lookup for this product. */
export type DictionaryLookupLang = "fr" | "en" | "mnk";

/**
 * One lookup request.
 * Invariant: exactly one of from/to is "mnk"; from !== to.
 * Unsupported: fr↔en, same-language, or any pair involving "ru".
 */
export type LookupMode = {
  from: DictionaryLookupLang;
  to: DictionaryLookupLang;
};

export function isValidLookupMode(mode: LookupMode): boolean {
  if (mode.from === mode.to) return false;
  const langs = new Set([mode.from, mode.to]);
  return langs.has("mnk") && langs.size === 2;
}

/** Index family selection (directional bundle). */
export function indexFamilyForInput(from: DictionaryLookupLang): "src" | "en" | "tgt" {
  if (from === "fr") return "src"; // legacy French namespace
  if (from === "en") return "en";
  return "tgt";
}

/** Gloss preference for result cards / entry primary gloss. */
export function preferredGlossLang(to: DictionaryLookupLang): "fr" | "en" {
  // to === "mnk" implies user is searching into Maninka; primary gloss still
  // needs a consumer language — use persisted display preference (default fr).
  return to === "en" ? "en" : "fr";
}

/** Legacy bridge for current SearchDirection-only call sites / CF2 drafts. */
export function toLegacySearchDirection(
  mode: LookupMode,
): "source_to_target" | "target_to_source" {
  return mode.from === "mnk" ? "target_to_source" : "source_to_target";
}
```

### Important split

| Pair | Index family | Display driver |
|------|--------------|----------------|
| FR → MNK | `src_*` | Maninka headword; FR gloss secondary as today |
| EN → MNK | `en_*` | Maninka headword; EN gloss secondary preferred |
| MNK → FR | `tgt_*` | Prefer `gloss_fr` |
| MNK → EN | `tgt_*` | Prefer `gloss_en` |

Maninka→French and Maninka→English **share the same search keys**. Only requested gloss language differs. Do not invent a second Maninka index.

Runtime today (`web/src/search/search_query.ts`) maps only `source_to_target`→`src_*` and `target_to_source`→`tgt_*`. ML1C/D must extend family selection without mixing FR and EN under `src_*`.

---

## 3. Index key namespace

### Long-term contract

| Family | Meaning | Authority |
|--------|---------|-----------|
| `src_*` | **Legacy French** reverse-index search (`index_mapping` → French `source_term`) | Curated FR index |
| `tgt_*` | Maninka lexicon headword / form search | Lexicon entries |
| `en_*` | English gloss-derived search (new, additive) | Sense `gloss_en` under `en_gloss_key_v1` |

### Explicit answers

| Question | Answer |
|----------|--------|
| Is `src_*` permanently equivalent to French? | **De facto yes** for all current and ML1C featured builds. Treat as **frozen legacy-French namespace**. Do not put English into `src_*`. |
| Would `fr_*` be cleaner long term? | **Yes conceptually**, but **renaming is out of scope** and would break Phase 7L / directional contracts. Optional future aliasing only after an explicit migration slice. |
| Document `src_*` as legacy-French while new languages get explicit namespaces? | **Yes.** `en_*`, future `es_*`, etc. |
| How should manifests advertise families? | Additive capability metadata (§13). Absence ⇒ legacy FR/`src` + MNK/`tgt` only. |
| How do legacy bundles keep working? | Unchanged: `search_index_directional` + `src_*`/`tgt_*` only; unknown families ignored by old clients; new clients must not require `en_*` when absent. |

**Do not rename existing `src_*` in ML1B/C.** Bundle builder today rejects non-`src`/`tgt` families (`api/bundle_builder/build_bundle.py` `DIRECTIONAL_KEY_TYPES`) — ML1C must widen allow-list **additively**.

Ladder rungs remain: `casefold` → `diacritics_insensitive` → `punct_stripped` → `nospace` (same as FR/MNK).

---

## 4. English gloss keying policy

### Rule version

```text
en_gloss_key_v1
```

### Authoritative material (v1)

| Source | Indexed? |
|--------|----------|
| Sense-level `display.senses[].gloss_en` | **YES** |
| Exact complete unitary gloss | **YES** |
| Comma-separated alternatives inside a gloss | **YES** (each alternative) |
| Multiword phrases without commas | **YES** as one exact normalized phrase key |
| Parenthetical material | **Trailing `(…)` strip only**; do not mine interior parentheticals as keys |
| Free-definition prose without list structure | **YES as one exact key only** (no tokenization) |
| `examples[].trans_en` | **NO** |
| Subentry `gloss_en` | **NO** in v1 |
| Whitespace tokens of a phrase | **NO** |
| Semicolon / slash / ` or ` splits | **NO** |
| Stemming, stopwords, fuzzy, AI, inferred synonyms | **NO** |

### Deterministic extraction (`en_gloss_key_v1`)

For each lexicon entry sense with nonempty `gloss_en`:

1. Take the raw `gloss_en` string (source-derived; never synthesize).
2. Trim; NFC; apply **trailing** parenthetical strip: remove a final `\s*\([^)]*\)\s*$` only if a nonempty remainder remains; otherwise keep original (protects glosses whose whole text is parenthetical).
3. Whitespace-collapse + casefold for the key form (via the same normalization family used for other search keys at build time).
4. **If** the stripped gloss contains `,`:
   - Emit **each** nonempty comma-separated alternative as its own exact key.
   - Do **not** also emit the raw multi-alternative string as a key (users do not type `hand, arm, foreleg, forefoot`).
5. **Else**:
   - Emit the full normalized string as one exact key.
6. Deduplicate keys within a sense; attach posting to owning lexicon `ir_id`.
7. After collecting all postings for a key: **first-occurrence dedupe in record stream order, then lexicographic `ir_id` sort** — same as `api/search_index/build_index.py` today.

### Separator policy (from featured data)

| Separator | Sense gloss rate | v1 policy |
|-----------|-----------------:|-----------|
| Comma `,` | ~30.5% (3695/12127) | **Approved** list delimiter |
| Semicolon `;` | ~0.1% | **Not** a delimiter (rare; often clause-like) |
| Slash `/` | ~0.1% | **Not** a delimiter (orthography / “sth /smb.” hazards) |
| Word `or` | ~0.2% | **Not** a delimiter (`green or yellowish scorpion`) |

### Parenthetical policy

| Example | Indexed key(s) |
|---------|----------------|
| `very (dark)` | `very` |
| `red object (?)` | `red object` |
| `(not) yet` | `(not) yet` (leading paren kept; not trailing) |
| Long encyclopedia note with trailing `(…)` | Stem before trailing paren only |
| Interior “right side” inside a prose note | **Not** extracted as its own key unless it appears as a gloss or comma alternative |

### Subentries

Subentry `gloss_en` (~1710 nonempty in featured data) often starts with infinitival `to …` and lacks independent `ir_id`. **v1: do not index.** Parent-entry search must not pretend subentry glosses are headword-equivalent without a lexical-identity decision (future slice).

### Examples deliberately NOT indexed

- Sentence-length `trans_en` (median ~7 words; 1317 examples).
- Whitespace tokens of `right hand`, `come back`, `pick up`, etc.
- Slash fragments (`sth`, `smb.`, `Geoffroy's`).
- Synonyms inferred from French or Russian.
- Any AI/backfill English.

---

## 5. English search provenance

Every future `en_*` key must be explainable as:

| Field | Required |
|-------|----------|
| `ir_id` | Lexicon entry that produced the key |
| `sense_index` | 0-based sense in `display.senses` |
| `gloss_en_raw` | Original sense gloss string |
| `extraction_rule` | `en_gloss_key_v1` |
| `key_normalized` | Emitted key |
| `split_kind` | `unitary` \| `comma_alternative` |

### Where provenance lives

| Location | Role |
|----------|------|
| **Build / audit report** (required) | Reviewer-facing counts, samples, rule version |
| **Reviewed generated artifact** (recommended for ML1C) | e.g. under `data/local_evidence/…` JSONL — not shipped in the consumer offline payload unless product later requires it |
| **Runtime `search_index.jsonl` rows** | **Do not expand** beyond `{ key, key_type, ir_ids }` unless a later slice proves necessity |
| **Lexicon records** | Already hold authoritative `gloss_en`; no duplicate EN index blob inside records |

Runtime payload growth should be **index keys only**, not per-key provenance documents.

---

## 6. Result order

### Existing French / index contract (evidence)

`api/search_index/build_index.py`:

1. Deduplicate by **first occurrence** while scanning normalized records.
2. Sort each posting list **lexicographically by `ir_id`**.
3. Runtime returns that list unchanged (`search_query.ts`); resolve/render preserve order.

There is **no** relevance ranking and **no** “source record order” in the final posting list after sort.

### English contract

Use the **same** deterministic rule for `en_*` postings:

```text
first-occurrence dedupe (lexicon record stream order)
→ lexicographic ir_id sort
→ runtime preserves stored ir_ids[]
```

Do not invent ranking. Ambiguity (many Maninka entries per English key) is expected and acceptable; order must be reproducible across rebuilds given the same inputs and rule version.

---

## 7. Maninka → English / French display

Live lexical entry remains authority. Do not duplicate dictionary records for language pairs.

### Primary gloss selection

| Mode | Primary consumer gloss |
|------|------------------------|
| MNK → FR | Prefer `gloss_fr` (sense order: first nonempty) |
| MNK → EN | Prefer `gloss_en` (sense order: first nonempty) |
| FR/EN → MNK result cards | Prefer gloss in the **input** language when present; else fallback below |

### Fallback (explicit)

**English preferred:**

```text
gloss_en → gloss_fr → "no translation available"
```

**French preferred:**

```text
gloss_fr → gloss_en → "no translation available"
```

### Russian fallback

```text
NEVER
```

Do not use `gloss_ru` / `trans_ru` as silent fallback on search cards, entry primary gloss, Saved, or Review. Russian may remain in Entry only until RL1 presentation exclusion; it must never substitute for missing FR/EN.

Today’s search subtitle (`render_results.ts`: `gloss_fr ?? gloss_en ?? gloss_ru`) **violates** this contract and is an RL1 / ML1D fix target — documented here, not changed in ML1B.

Learning `display_cache` already uses FR then EN, never RU (`build_display_cache.ts`) — compatible.

---

## 8. Language selector UX contract

No CSS. Interaction only.

### Model

Search header shows the **active lookup pair**:

```text
[ English ] ⇄ [ Maninka ]
```

or

```text
[ French ] ⇄ [ Maninka ]
```

**Source-language control** (not UI locale):

- Choices: English, French (the non-Maninka endpoint of the pair).
- Persists as lookup preference (§9).

**Swap control:**

- Reverses `from` ↔ `to` within the current pair.
- Does **not** change which of EN/FR is the paired language.
- Example: English→Maninka swap → Maninka→English; French remains deselected until the user picks French.

### Persistence vs session

| State | Persistence |
|-------|-------------|
| Active pair’s non-Maninka language (`fr` \| `en`) | **Persisted** UI preference |
| Direction within pair (`from` mnk or not) | Session is acceptable; may also persist if cheap |
| UI locale | Existing `siralex.ui_locale` only |

### RULE

```text
Interface language MUST NOT silently change search language.
```

Changing More → Language (UI) leaves `LookupMode` untouched. Dictionary chrome labels may localize (“Anglais” vs “English”) without changing `from`/`to` codes.

---

## 9. Persistence

Yes — search-language preference needs persistence (users will expect EN↔MNK to stick across reloads).

### UI preference key (localStorage only)

```text
siralex.search_lookup_lang = "fr" | "en"
```

Optional second key (if direction should persist):

```text
siralex.search_lookup_direction = "into_mnk" | "from_mnk"
```

### Forbidden

- Learning Record fields
- IndexedDB schema bump solely for this preference
- Encoding preference into `bundle_id` / CF drafts as mutable identity

Defaults for legacy installs / missing key: **`fr`** (preserves current French-first product behavior).

---

## 10. CF2 provenance

### Finding: ML1A “CF2 impact NONE” is too optimistic

Current draft (`web/src/search_feedback/search_feedback_types.ts`):

- `query_raw`
- `search_direction: "source_to_target" | "target_to_source"`
- bundle/hash/scope stamps

With English lookup, **`source_to_target` + `query_raw: "house"` cannot tell a reviewer whether the search was English→Maninka or French→Maninka.**

### Contract resolution (do not implement in ML1B)

```text
CF2 impact: SCHEMA_ADDITION_REQUIRED
```

Additive fields (backward compatible for old drafts):

```typescript
// Additive on SearchFeedbackDraftV1 — names illustrative until CF2 implementation slice
input_lang: "fr" | "en" | "mnk";
display_lang: "fr" | "en"; // requested gloss language when relevant
// Keep search_direction as derived legacy mirror for old exporters/readers
```

| Existing drafts | Behavior |
|-----------------|----------|
| Missing `input_lang` | Interpret via installed bundle’s primary pair: `source_to_target` ⇒ `fr`, `target_to_source` ⇒ `mnk` |
| New EN searches | Must set `input_lang: "en"` (and `display_lang` as applicable) |

**Shipping gate:** ML1D must not enable English search failure capture until this additive CF2 field is implemented and validated. Schema change is **documented**, not performed here. No IndexedDB version migration is implied if CF2 validation treats new fields as optional-with-default for reads and required for new EN writes.

---

## 11. CF1

### Schema change

```text
CF1 impact: NONE (schema)
```

`gloss_lang: "fr" | "en" | "ru"` already exists. English corrections are already first-class targets.

### Consumer behavior after RL1 (display policy, not ML1B)

| Behavior | Contract |
|----------|----------|
| FR / EN translation targets | Visible when live gloss exists |
| RU target for **new** correction capture | Hidden |
| Existing `gloss_lang: "ru"` drafts | Remain renderable / manageable |
| IR / enriched `gloss_ru` | Retained for provenance |

---

## 12. Learning / bundle identity — CRITICAL

### Evidence (runtime already implements the preferred model)

| Fact | Evidence |
|------|----------|
| Default rebuild **convenience-mints** `bundle_id` = `bundle_{type}_{yyyymmdd}_{first8(content_sha256)}` | `api/bundle_builder/build_bundle.py` `generate_bundle_id` — **not** an explicit `--bundle-id` pin |
| Featured catalog history used **distinct** ids (`…20260616…`, `…20260708…`, `…20260710_337619ff`) | `web/public/catalog.json` (historical artifact naming; not a requirement to keep minting new ids) |
| Install scope = `{bundle_id}::{content_sha256}` | `web/src/install/bundle_install.ts` |
| Same scope ⇒ skip; different hash same id ⇒ REPLACE_ALL records/index, cleanup previous scope | same |
| Learning primary key = `(bundle_id, ir_id)` deliberately **not** `storage_scope_id` | `docs/reports/ls1_architecture_and_boundary_definition.md` §4 |
| Same `bundle_id` + new `content_sha256` + same `ir_id` ⇒ Learning **survives** and re-resolves live | `ls1i4` lifecycle verification |
| New `bundle_id` + same `ir_id` ⇒ **different Learning identity** (fragmentation) | LS1 architecture §4.4 |
| `deleteBundleData` / scope cleanup does **not** cascade-delete Learning/CF1/CF2 | `siralex_db.ts` + LS1/CF2 lifecycle tests |
| Distribution docs treat `bundle_id` as stable install identity; `content_sha256` detects content change | `docs/BUNDLE_DISTRIBUTION.md` |

### Canonical identity model (ML1B1 reconciled)

Prior contradiction: `shared/specs/offline-bundle-versioning.md` said/implied `bundle_id` was unique per content artifact, while installer/Learning/distribution already treated it as a stable logical product-line id. **ML1B1** amended the offline-bundle-versioning spec (and aligned distribution docs) so the canonical rule is:

| Identifier | Canonical meaning |
|------------|-------------------|
| `bundle_id` | Stable **logical dictionary / product-line** identity |
| `content_sha256` | Immutable **content / artifact version** identity |
| `storage_scope_id` | Local installed version scope: `` `${bundle_id}::${content_sha256}` `` |

```text
same bundle_id + new content_sha256
= compatible update/release in the same logical dictionary line

new bundle_id
= distinct dictionary lineage / intentionally separate Learning namespace
```

**Immutability:** stable `bundle_id` does **not** mean mutable bytes. Each artifact remains immutable under `content_sha256`; a replacement install creates a new `storage_scope_id` and retires the previous dictionary payload scope while retaining personal overlays per existing lifecycle rules.

**Reuse MAY** when: same product line, same `ir_id` domain, compatible record semantics, Learning continuity intended, REPLACE_ALL supported, no intentional personal-data fork.

**New id MUST** when: unrelated dictionary, changed lexical identity domain / incompatible `ir_id` reassignment, or intentionally separate edition/product line.

Canonical specs: `shared/specs/offline-bundle-versioning.md`, `docs/BUNDLE_DISTRIBUTION.md` (ML1B1).

### Test / doc impact classification (ML1B1)

| Item | Classification |
|------|----------------|
| `shared/specs/offline-bundle-versioning.md` former “unique across all time” / “MUST … new `bundle_id`” | **Updated now** — normative wording was wrong relative to installer/Learning |
| `docs/BUNDLE_DISTRIBUTION.md` field meanings | **Updated now** — aligned with three-layer identity model |
| `api/bundle_builder` `generate_bundle_id` / `TestGenerateBundleId` | **Builder-default behavior only** — format helper tests; not a claim that every content change must mint a new logical id; **no code change** |
| Historical featured `bundle_id`s in catalog / public tree | **Historical artifact naming; no change required** — do not rewrite |
| LS1 / LP1 / CF1 / CF2 lifecycle tests | **Already encode the canonical model** (same `bundle_id` + new hash continuity); **no change** |

---

### Answers

| Question | Answer |
|----------|--------|
| Does every published featured rebuild receive a new `bundle_id`? | **Default builder convenience path: yes.** Canonical contract: **no** — compatible releases SHOULD reuse the logical id. |
| Can installer update same `bundle_id` with new `content_sha256`? | **Yes** — supported and tested; this **is** the compatible-update path. |
| Learning on same `ir_id` + **new** `bundle_id` | New primary key; old saves do not attach to the new dictionary line. |
| Learning on same `bundle_id` + **new** `content_sha256` | Continuity; soft-orphan if `ir_id` removed. |
| CF1/CF2 in both cases | Bound to logical `bundle_id` (+ stamped hash); same-id update retains drafts with possible `dictionary_content_differs`; new id isolates drafts to the old line. |
| Builder explicit `--bundle-id` support today? | **NO** — ML1C must add explicit logical bundle-id input (or equivalent reviewed pin step). Do not hardcode the featured id in production code as a silent default. |

### Recommended release strategy

```text
A. Stable logical bundle_id across compatible releases
```

For ML1C English-index publication into the **current featured product line**:

1. **Pin** featured `bundle_id` to the existing logical id (`bundle_full_20260710_337619ff`) **or** an explicitly chosen successor id that is then held stable.
2. Allow `content_sha256` (and directory/url payload) to change.
3. Do **not** treat naive `generate_bundle_id()` as the release identity for compatible additive index releases.
4. Prefer implementing explicit builder `--bundle-id` (ML1C builder requirement); until then, pin via reviewed packaging that preserves the logical id in the published manifest/catalog.
5. Update catalog entry in place (same `bundle_id`, new hash/size/url if needed).
6. Treat a **new** `bundle_id` as a **new dictionary product line** requiring explicit Learning migration/lineage (not in ML1B/C scope).

### Alternatives

| Option | Verdict |
|--------|---------|
| B. New immutable `bundle_id` + Learning migration | Possible later; **not** required if A is followed; migration is a separate program |
| C. Keep old dictionary + add second bundle | Rejected for dual Maninka identity / offline duplication (ML1A) |
| D. Other | None safer than A given current installer + Learning design |

### ML1C blocked by bundle identity?

```text
ML1C_BLOCKED_BY_BUNDLE_IDENTITY: NO
```

Canonical specs now align with installer/Learning. Safe path exists **without** Learning schema or IndexedDB change: **reuse/pin featured `bundle_id`**. ML1C remains **process/tooling-gated** on explicit logical-id input (or equivalent pin), not schema-blocked.

If a future release **refuses** to pin and mints a new id, Learning continuity is broken unless a migration slice exists — that would then set `ML1C_BLOCKED_BY_BUNDLE_IDENTITY: YES` for continuity-preserving English rollout.

---

## 13. Bundle / manifest contract

### Existing conventions (do not break)

- Gated: `manifest_schema_version`, `bundle_id`, `content_sha256`, `update_mode`/`reconciliation_action` = `REPLACE_ALL`, `rule_versions.normalization`, `files[]`, …
- Language: optional `languages.source_lang` / `target_lang`, `language_labels`, `scripts`
- Search: `search_index_directional` (boolean)
- Catalog: `bundle_catalog_v1` with parallel language fields

### Additive metadata (conceptual; finalize names in ML1C against builder/validator)

Prefer extending known objects rather than inventing unrelated top-level vocab:

```json
{
  "languages": {
    "source_lang": "fr",
    "target_lang": "mnk",
    "lexical_language": "mnk",
    "lookup_languages": ["fr", "en", "mnk"]
  },
  "search_index_directional": true,
  "search_key_families": ["src", "tgt", "en"]
}
```

Notes:

- `source_lang`/`target_lang` remain for legacy chrome; do not remove.
- Absence of `lookup_languages` / `search_key_families` ⇒ legacy FR↔MNK only.
- Old clients ignore unknown fields.
- Builder must accept `en_*` key types when families advertise `en`.
- Optional: `rule_versions.en_gloss_key = "en_gloss_key_v1"` for auditability (does **not** by itself force a new `bundle_id` under Learning-preserving pin policy; document in release notes).

### Catalog naming

Product name may later become e.g. `French / English ↔ Maninka` (ML1D). Not required to finalize string copy in ML1B.

---

## 14. Size estimate (analytical; no publish)

Authority: featured `web/public/bundle_full_20260710_337619ff/records.jsonl`.

| Metric | Count / size |
|--------|-------------:|
| Lexicon entries | 8826 |
| Entries with `gloss_en` | 8713 |
| Sense `gloss_en` | 12127 |
| French `index_mapping` | 10509 |
| Current `search_index.jsonl` rows | 112265 (~10.2 MB) |
| Current bundle payload (records+index) | ~26.2 MB |

### Candidate extraction counts

| Rule | Unique normalized keys | Postings (key→ir_id) | ≈ index rows (×4 rungs) |
|------|----------------------:|---------------------:|------------------------:|
| A. Exact complete gloss only | 7838 | 12114 | ~31.4k |
| **B / `en_gloss_key_v1`** (unitary exact; comma → alternatives; trailing paren strip) | **8737** | **16598** | **~34.9k** |
| C. Also keep raw comma-list strings | 11303 | 20285 | ~45.2k |
| + subentry glosses (not approved) | ~10.2k+ | — | larger / noisier |

### Recommended estimate (`en_gloss_key_v1`)

| Estimate | Value |
|----------|------:|
| Unique English keys | **~8737** (~83% of FR mapping count) |
| Added index rows | **~34950** (~**+31%** vs current index row count) |
| Approx. index file growth | **~+3.2 MB** (~+31% of `search_index.jsonl`) |
| Approx. full payload growth | **~+12%** of current records+index bytes |

French asymmetry remains: FR keys are curated reverse-index phrases; EN keys are gloss-derived.

---

## 15. Search quality sample (audit-only in-memory prototype)

**Rule:** `en_gloss_key_v1` against featured records. **No** production index writes.

Posting order shown = lexicographic `ir_id` (contract §6).

| Query | Candidate key | Ambiguity | Headwords (prefix) |
|-------|---------------|----------:|--------------------|
| house | house | 1 | `bón` |
| father | father | 3 | `fà`, `bàba`, `bàwa` |
| eat | eat | 4 | `dómun`, `dúmu`, `dáwun`, `dámun` |
| come | come | 5 | `sɛ́nɛma`, `sɛ́nɛ`, `bɔ́`, `n\``, `nà` |
| hand | hand | 7 | `kɔ̀ɲɔ`, `dɛ́n`, `bólo`, `wɔ̀nsere`, `kɔ̀ɲɛ`, … |
| arm | arm | 5 | `kɔ̀ɲɔ`, `bólo`, `bólokala`, `wɔ̀nsere`, `kɔ̀ɲɛ` |
| head | head | 5 | `dátii`, `sín`, `sála`, `kùn`, `kùnnasìi` |
| right hand | right hand | 2 | `kíninbolo`, `bóloba` |
| very | very | 25 | intensifiers (`tɔ́n`, `tánintanin`, …) |
| now | now | 19 | `sínɛ̀n`, `búdùn`, … |
| respect | respect | 18 | `gbíliya`, `gbílinya`, … |
| pick up | pick up | 10 | `tɛ̀`, `tɔ̀mɔn`, … |
| come back | come back | 9 | `sèyin`, `sèyi`, … |
| calm down | calm down | 8 | `dɔ́suma`, `bámasìi`, … |
| take away | take away | 7 | `jàson`, `wá`, … |
| mix up | mix up | 9 | `bàsan`, `kálanson`, … |
| as far as | as far as | 9 | `báwò`, `bári`, … |
| fall prone | fall prone | 7 | `dáfidin`, `fídi`, … |
| settle down | settle down | 6 | `rɔ́bɛ̀n`, `básìi`, … |
| wound | wound | 17 | `báramanɔ`, … |
| gather | gather | 17 | `bánsan`, … |
| plant | plant | 16 | `fɛ́rɛn`, … |
| water | water | 2 | `jí`, `sɔ́` |
| mother | mother | 3 | `bá`, `dénba`, `ná` |
| green | green | 7 | `fírisi`, … |
| Guinea sorrel | Guinea sorrel | 4 | `dà`, `dàkumunin`, `dàkumu`, `dàkumun` |
| intransitive aorist | intransitive aorist | 2 | `-ra`, `-da` |
| (not) yet | (not) yet | 8 | `búdùn`, `múnùn`, … |
| odd number | odd number | 0 | — (no exact gloss key) |
| right side | right side | 1 | `kíninbolo` |

~40.8% of v1 keys map to ≥2 `ir_id`s (comparable order to French multi-target terms).

### Naive whitespace tokenization — undesirable

| Phrase | Exact phrase hits | Token damage |
|--------|------------------:|--------------|
| right hand | 2 | `hand` alone → 7 entries (wrong for the phrase) |
| come back | 9 | `come` alone → 5 different verbs |
| pick up / take away / mix up / calm down | 7–10 | bare verbs hit unrelated lemmas; particles often 0 |
| Guinea sorrel | 4 | tokens miss or partial-wrong |
| intransitive aorist | 2 | tokens alone → 0 |
| odd number | 0 | tokens hit unrelated `odd` / `number` senses |

**Conclusion:** exact / list-alternative keys only; never bag-of-words.

---

## 16. Compatibility matrix

| Surface | FR old bundle | FR multilingual bundle (same id + EN keys) | EN multilingual search |
|---------|---------------|--------------------------------------------|------------------------|
| Existing FR search | UNCHANGED | UNCHANGED (`src_*` untouched) | N/A |
| Maninka search | UNCHANGED | UNCHANGED (`tgt_*`) | UNCHANGED (same `tgt_*`) |
| Saved | UNCHANGED | UNCHANGED if `bundle_id` pinned | UNCHANGED (entry identity) |
| Review | UNCHANGED | UNCHANGED | ADDITIVE display preference only |
| LP1 backup/restore | UNCHANGED | UNCHANGED if identity pinned | UNCHANGED |
| CF1 | UNCHANGED | UNCHANGED schema | UNCHANGED schema; RL1 hides new RU targets |
| CF2 | UNCHANGED | UNCHANGED for FR/MNK drafts | **ADDITIVE** schema fields required for EN provenance |
| Bundle install/update | UNCHANGED | ADDITIVE payload; same-id update path | Same |
| Offline | UNCHANGED | ADDITIVE size (~+3 MB index) | Works offline once installed |

Legend: **UNCHANGED** / **ADDITIVE** / **MIGRATION_REQUIRED** / **BLOCKED**.

No cell is **BLOCKED** if featured `bundle_id` is pinned. A new featured `bundle_id` without migration marks Saved/Review/LP1/CF1/CF2 attachment as **MIGRATION_REQUIRED** for continuity.

---

## 17. Decision checklist

| Requirement | Status |
|-------------|--------|
| English extraction policy defined | PASS (`en_gloss_key_v1`) |
| Search mode defined | PASS (`LookupMode` from/to) |
| Key namespace defined | PASS (`src` legacy-FR, `tgt` MNK, `en` additive) |
| Display fallback defined | PASS (never RU) |
| CF2 provenance resolved | PASS as **SCHEMA_ADDITION_REQUIRED** (documented; not implemented) |
| Bundle/Learning identity resolved | PASS — ML1B1 canonical specs align with installer/Learning; pin `bundle_id` (no Learning schema change) |
| Backward compatibility defined | PASS |

```text
ML1B_MULTILINGUAL_CONTRACT_APPROVED
```

---

## 18. High-risk implementation files for ML1C / ML1D

| Area | Files |
|------|-------|
| Index emit | `api/search_index/build_index.py`, normalizer touchpoints if EN keys materialize pre-index |
| Bundle allow-list / manifest | `api/bundle_builder/build_bundle.py`, `web/src/bundle_manifest.ts` |
| Runtime search | `web/src/search/search_query.ts` |
| Labels / chrome | `web/src/bundle_labels.ts`, `web/src/render/render_search_chrome.ts`, `web/src/main.ts` |
| Install / catalog | `web/src/install/bundle_install.ts`, `web/public/catalog.json`, featured bundle tree |
| Display / RU policy | `web/src/render/render_results.ts`, `render_entry.ts` (RL1) |
| CF2 additive fields | `web/src/search_feedback/search_feedback_types.ts` + capture/export tests |
| Regression | `api/search_regression/`, `scripts/run_search_regression.py`, Phase 7L matrix |
| Preferences | `web/src/i18n.ts` pattern → new `siralex.search_lookup_lang` module |

---

## 19. Return block

```text
Decision:
ML1B_MULTILINGUAL_CONTRACT_APPROVED

BASE_COMMIT:
a13f6c774b400e56e169df97fa4d2134e019a840

Product language model:
lexical_language=mnk; lookup_languages=[fr,en,mnk]; consumer glosses=[fr,en];
legacy catalog source_lang/target_lang retained; UI locale ≠ search language.

Search mode model:
LookupMode { from, to } with exactly one endpoint mnk; index fr→src_*, en→en_*, mnk→tgt_*;
display driven by `to` / preferred gloss lang; legacy SearchDirection adapter retained.

Key namespace:
src_* = legacy French (frozen); tgt_* = Maninka; en_* = additive English; no src_* rename.

English extraction policy:
en_gloss_key_v1 — sense gloss_en only; unitary exact keys; comma alternatives;
trailing-paren strip only; no whitespace/slash/or/semicolon tokenization; no AI.

Examples indexed:
unitary glosses (house, right hand, intransitive aorist); comma alts (hand / arm / …).

Examples deliberately NOT indexed:
examples[].trans_en; subentry gloss_en; whitespace tokens; slash/or splits;
parenthetical interiors; inferred synonyms.

English provenance:
build reports + optional reviewed generated artifact; not in runtime index rows;
fields: ir_id, sense_index, gloss_en_raw, extraction_rule, key_normalized, split_kind.

Result ordering:
first-occurrence dedupe then lexicographic ir_id sort (same as French index builder).

MNK→EN display policy:
prefer gloss_en → gloss_fr → "no translation available".

MNK→FR display policy:
prefer gloss_fr → gloss_en → "no translation available".

Russian fallback:
NEVER

Language selector contract:
pair chrome [FR|EN] ⇄ [Maninka]; source picker selects FR vs EN; swap reverses pair
direction only; UI locale independent of lookup.

Interface locale independent:
PASS

Search-language persistence:
localStorage siralex.search_lookup_lang = "fr"|"en" (default fr); not Learning/IDB.

CF2 impact:
SCHEMA_ADDITION_REQUIRED — additive input_lang (+ display_lang); keep search_direction
as legacy mirror; gate EN CF2 capture on implementation.

CF1 impact:
NONE on schema; RL1 hides new RU targets; existing ru drafts remain manageable.

Bundle release behavior:
Canonical: bundle_id = logical product line; content_sha256 = immutable version;
storage_scope_id = bundle_id::content_sha256. Default builder convenience-mints a new
id (no --bundle-id yet); installer already supports same bundle_id + new hash.
ML1B1 reconciled offline-bundle-versioning + BUNDLE_DISTRIBUTION to this model.

Learning identity finding:
identity is (bundle_id, ir_id); new bundle_id fragments Learning; same-id content update
preserves Learning/CF1/CF2 attachment with soft-orphan if ir_id removed.

Recommended release strategy:
A — stable logical bundle_id across compatible EN-index releases
(ML1C: add explicit --bundle-id or equivalent pin; do not hardcode featured id).

ML1C blocked by bundle identity:
NO

Manifest impact:
ADDITIVE lookup_languages / search_key_families (and optional en_gloss_key rule version);
legacy languages.source/target retained; old bundles load unchanged.

Legacy compatibility:
Mandatory — absent EN families ⇒ FR↔MNK only; src_*/tgt_* contracts preserved.

Estimated English key count:
~8737 unique normalized keys under en_gloss_key_v1

Estimated bundle/index growth:
~+35k index rows (~+31% index rows, ~+3.2 MB search_index, ~+12% payload)

Prototype query results:
house→1 (bón); father→3; eat→4; come→5; hand→7; arm→5; head→5; right hand→2;
plus 20+ further queries in §15; naive tokenization rejected.

Compatibility matrix:
see §16 — UNCHANGED/ADDITIVE; MIGRATION_REQUIRED only if new bundle_id without migration.

High-risk implementation files for ML1C:
build_index.py, build_bundle.py (--bundle-id pin required), search_query.ts,
bundle_labels.ts, render_search_chrome.ts, main.ts, bundle_manifest.ts,
bundle_install.ts, catalog/featured bundle, search_feedback_types.ts,
search regression gates.

Files changed
-------------
A  docs/reports/ml1b_multilingual_search_contract.md
M  shared/specs/offline-bundle-versioning.md   (ML1B1)
M  docs/BUNDLE_DISTRIBUTION.md                 (ML1B1)

Untracked files:
web/scripts/ (pre-existing; unrelated capture_ui_screenshots.mjs)

Working tree:
spec + distribution + ML1B report amended; no production/runtime code edits

Commit:
NOT CREATED
```

---

## Explicit non-goals confirmed

- No English index emission or UI
- No production bundle rebuild/publish
- No Learning / IndexedDB / CF1 / CF2 schema implementation
- No ML1A report modification
- No Russian IR stripping
- No `src_*` → `fr_*` rename
- No `build_bundle.py` / runtime / IndexedDB changes in ML1B1 (spec clarity first)