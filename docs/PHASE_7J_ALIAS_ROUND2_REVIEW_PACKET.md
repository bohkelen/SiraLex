# Phase 7J Alias Round 2 Review Packet

Purpose: human review packet for deciding which Phase 7J P2 source-alias
candidates are safe for a future `shared/aliases/source_aliases_v1.jsonl`
update under `source_alias_table_v1`.

This packet is planning and review guidance only. It does **not** create
approved alias rows, modify bundles, or change runtime behavior.

## 1. Purpose

Phase 7J classified eleven French source-side misses as
`reviewed_source_alias_candidate`. This packet narrows that set to **source
alias Round 2** human review only.

A reviewer decides, per candidate, whether a future build-time alias may:

- route the query term to an existing canonical source posting set; and
- copy that posting set **exactly** without broadening targets or changing
  ranking.

No candidate in this packet is approved until a named human reviewer records a
decision with rationale.

## 2. Scope

### In scope

- single-term French source alias candidates
- plural or form variants
- existing canonical source entries
- build-time source alias review

### Out of scope

- phrase aliases
- source-index supplements
- runtime fuzzy search
- runtime decomposition
- typo correction
- target-side behavior
- ranking changes
- bundle publication

### Source evidence

- Phase 7J audit rows: `shared/source_index_gap_discovery/phase7j_gap_candidates.jsonl`
- Alias spec: `shared/specs/source-alias-table-v1.md`
- Phase 7F precedent: seven approved plural/form aliases in
  `shared/aliases/source_aliases_v1.jsonl`
- Baseline bundle: `bundle_full_20260609_phase7f_alias_candidate`
  (`norm-v3-featured-enriched-source-aliases-2-source-index-supplements-2`)

## 3. Candidate summary table

| Phase 7J `review_id` | Query | Likely canonical entry | Candidate `ir_ids` | Risk | Priority | Recommended decision |
|---|---|---|---|---|---|---|
| `phase7j_gap_0015` | `fruits` | `fruit` | `7cdb6070ce427a6d` | low | 65 (P2) | `approved` |
| `phase7j_gap_0016` | `grains` | `grain` | `3971b2e32e2dfc1c` | low | 65 (P2) | `approved` |
| `phase7j_gap_0017` | `griots` | `griot` | `025ed3968e2bc6e3` | low | 65 (P2) | `approved` |
| `phase7j_gap_0018` | `jambes` | `jambe` | `251b2a72627a7ef9` | low | 65 (P2) | `approved` |
| `phase7j_gap_0019` | `mots` | `mot` | `1f9cbaa868644b73` | low | 65 (P2) | `approved` |
| `phase7j_gap_0020` | `nuages` | `nuage` | `9ca98df7409dde23` | low | 65 (P2) | `approved` |
| `phase7j_gap_0021` | `parents` | `parent` | `5437cc8267a78303` | low | 65 (P2) | `approved` |
| `phase7j_gap_0022` | `paroles` | `parole` | `cf9e314229c86efc` | low | 65 (P2) | `approved` |
| `phase7j_gap_0023` | `enfants` | `enfant` | `99e6cda40390d1fb` | low | 65 (P2) | `approved` |
| `phase7j_gap_0024` | `feuilles` | `feuille` | `f67a64559d2f6c63` | low | 65 (P2) | `approved` |
| `phase7j_gap_0001` | `grand-parents` | `grand-mère`, `grand-père` | `1f6d3a5919110b21`, `957bd76b41fda053` | medium | 55 (P2) | `approved` |

Human review completed 2026-06-15: **11 approved**, **0 deferred**, **0 rejected** in this
packet. Decisions are recorded below; they do **not** by themselves modify
`source_aliases_v1.jsonl` or any bundle.

## 4. Candidate detail sections

### `fruits` — plural form alias

| Field | Value |
| --- | --- |
| Query | `fruits` |
| Phase 7J `review_id` | `phase7j_gap_0015` |
| Likely canonical entry | `fruit` |
| Candidate resolved `ir_ids` | `7cdb6070ce427a6d` |
| `gap_class` | `reviewed_source_alias_candidate` |
| `current_result` | miss |
| `recommended_destination_artifact` | `shared/aliases/source_aliases_v1.jsonl` |

**Related existing entries**

- `fruit` → hit (`7cdb6070ce427a6d`)

**Source evidence (summary)**

- Miner: `plural_form_gap`, score 103, tier_2
- Gloss: example text containing `fruits` tied to attested bundle evidence

**Why it may be safe**

- Canonical singular `fruit` already resolves to a single deterministic posting.
- Pattern matches Phase 7F approved plurals (`mains → main`, `jours → jour`, etc.).
- Alias would copy the singular posting set exactly; no new target breadth.

**Why it may be unsafe**

- French plural surface form alone does not prove lexical equivalence in every
  dictionary sense; reviewer must confirm `fruit` posting covers plural-query intent.
- Gloss evidence is contextual (example text), not a standalone source mapping.

| Review field | Value |
| --- | --- |
| Review decision | `approved` |
| Reviewer | `phase7j_alias_round2_human_review` |
| Reviewed_at | `2026-06-15` |
| Rationale | Human reviewer approved based on French grammar. `fruits` is the regular plural of `fruit`; alias may route to canonical `fruit` posting `7cdb6070ce427a6d` exactly, following Phase 7F plural precedent without broadening targets. |

---

### `grains` — plural form alias

| Field | Value |
| --- | --- |
| Query | `grains` |
| Phase 7J `review_id` | `phase7j_gap_0016` |
| Likely canonical entry | `grain` |
| Candidate resolved `ir_ids` | `3971b2e32e2dfc1c` |
| `gap_class` | `reviewed_source_alias_candidate` |
| `current_result` | miss |
| `recommended_destination_artifact` | `shared/aliases/source_aliases_v1.jsonl` |

**Related existing entries**

- `grain` → hit (`3971b2e32e2dfc1c`)

**Source evidence (summary)**

- Miner: `plural_form_gap`, score 103, tier_2
- Gloss: `le poulet a picoré des grains (à l'intérieur d'un récipient)`

**Why it may be safe**

- Single canonical posting for `grain`; clean plural→singular routing candidate.
- Phase 7F precedent applies for direct plural copies.

**Why it may be unsafe**

- `grains` may appear in idiomatic or mass-noun contexts distinct from countable
  `grain`; reviewer should inspect attested gloss scope.

| Review field | Value |
| --- | --- |
| Review decision | `approved` |
| Reviewer | `phase7j_alias_round2_human_review` |
| Reviewed_at | `2026-06-15` |
| Rationale | Human reviewer approved based on French grammar. `grains` is the regular plural of `grain`; alias may copy canonical `grain` posting `3971b2e32e2dfc1c` exactly per Phase 7F plural precedent. |

---

### `griots` — plural form alias

| Field | Value |
| --- | --- |
| Query | `griots` |
| Phase 7J `review_id` | `phase7j_gap_0017` |
| Likely canonical entry | `griot` |
| Candidate resolved `ir_ids` | `025ed3968e2bc6e3` |
| `gap_class` | `reviewed_source_alias_candidate` |
| `current_result` | miss |
| `recommended_destination_artifact` | `shared/aliases/source_aliases_v1.jsonl` |

**Related existing entries**

- `griot` → hit (`025ed3968e2bc6e3`)

**Source evidence (summary)**

- Miner: `plural_form_gap`, score 103, tier_2
- Gloss: `canne de chef de griots`

**Why it may be safe**

- Singular `griot` resolves deterministically; plural miss is likely inflection only.
- Cultural/domain term with attested plural usage in bundle gloss.

**Why it may be unsafe**

- Plural `griots` may denote a group/category reading not identical to singular
  `griot` posting; reviewer must confirm target scope.

| Review field | Value |
| --- | --- |
| Review decision | `approved` |
| Reviewer | `phase7j_alias_round2_human_review` |
| Reviewed_at | `2026-06-15` |
| Rationale | Human reviewer approved based on French grammar. `griots` is the regular plural of `griot`; alias may copy canonical `griot` posting `025ed3968e2bc6e3` exactly. |

---

### `jambes` — plural form alias

| Field | Value |
| --- | --- |
| Query | `jambes` |
| Phase 7J `review_id` | `phase7j_gap_0018` |
| Likely canonical entry | `jambe` |
| Candidate resolved `ir_ids` | `251b2a72627a7ef9` |
| `gap_class` | `reviewed_source_alias_candidate` |
| `current_result` | miss |
| `recommended_destination_artifact` | `shared/aliases/source_aliases_v1.jsonl` |

**Related existing entries**

- `jambe` → hit (`251b2a72627a7ef9`)

**Source evidence (summary)**

- Miner: `plural_form_gap`, score 103, tier_2
- Gloss: `agiter ses jambes (en restant debout ou assis)`

**Why it may be safe**

- Body-part vocabulary; canonical `jambe` has single posting.
- Strong Phase 7F parallel (`pieds → pied`, `mains → main`).

**Why it may be unsafe**

- Anatomical plural queries may intend paired-body-part semantics; reviewer should
  confirm the singular posting covers plural lookup intent.

| Review field | Value |
| --- | --- |
| Review decision | `approved` |
| Reviewer | `phase7j_alias_round2_human_review` |
| Reviewed_at | `2026-06-15` |
| Rationale | Human reviewer approved based on French grammar. `jambes` is the regular plural of `jambe`; alias may copy canonical `jambe` posting `251b2a72627a7ef9` exactly, matching Phase 7F body-part plural precedent (`pieds → pied`, `mains → main`). |

---

### `mots` — plural form alias

| Field | Value |
| --- | --- |
| Query | `mots` |
| Phase 7J `review_id` | `phase7j_gap_0019` |
| Likely canonical entry | `mot` |
| Candidate resolved `ir_ids` | `1f9cbaa868644b73` |
| `gap_class` | `reviewed_source_alias_candidate` |
| `current_result` | miss |
| `recommended_destination_artifact` | `shared/aliases/source_aliases_v1.jsonl` |

**Related existing entries**

- `mot` → hit (`1f9cbaa868644b73`)

**Source evidence (summary)**

- Miner: `plural_form_gap`, score 103, tier_2
- Gloss: `jurer, dire des gros mots`

**Why it may be safe**

- Singular `mot` resolves to one posting; plural miss likely inflectional.
- Common basic vocabulary candidate.

**Why it may be unsafe**

- Plural `mots` often appears in fixed expressions (`gros mots`, etc.); reviewer
  must confirm alias does not imply phrase-level routing.

| Review field | Value |
| --- | --- |
| Review decision | `approved` |
| Reviewer | `phase7j_alias_round2_human_review` |
| Reviewed_at | `2026-06-15` |
| Rationale | Human reviewer approved based on French grammar. `mots` is the regular plural of `mot`; alias may copy canonical `mot` posting `1f9cbaa868644b73` exactly. This is single-term plural routing only, not phrase-level decomposition. |

---

### `nuages` — plural form alias

| Field | Value |
| --- | --- |
| Query | `nuages` |
| Phase 7J `review_id` | `phase7j_gap_0020` |
| Likely canonical entry | `nuage` |
| Candidate resolved `ir_ids` | `9ca98df7409dde23` |
| `gap_class` | `reviewed_source_alias_candidate` |
| `current_result` | miss |
| `recommended_destination_artifact` | `shared/aliases/source_aliases_v1.jsonl` |

**Related existing entries**

- `nuage` → hit (`9ca98df7409dde23`)

**Source evidence (summary)**

- Miner: `plural_form_gap`, score 103, tier_2
- Gloss: `le ciel est couvert de nuages de plomb`

**Why it may be safe**

- Singular `nuage` posting is deterministic; plural is standard French inflection.
- Nature/basic vocabulary; low structural ambiguity.

**Why it may be unsafe**

- Meteorological plural usage may differ from lexical headword scope; gloss-derived
  evidence still requires human confirmation.

| Review field | Value |
| --- | --- |
| Review decision | `approved` |
| Reviewer | `phase7j_alias_round2_human_review` |
| Reviewed_at | `2026-06-15` |
| Rationale | Human reviewer approved based on French grammar. `nuages` is the regular plural of `nuage`; alias may copy canonical `nuage` posting `9ca98df7409dde23` exactly. |

---

### `parents` — plural form alias (kinship-adjacent)

| Field | Value |
| --- | --- |
| Query | `parents` |
| Phase 7J `review_id` | `phase7j_gap_0021` |
| Likely canonical entry | `parent` |
| Candidate resolved `ir_ids` | `5437cc8267a78303` |
| `gap_class` | `reviewed_source_alias_candidate` |
| `current_result` | miss |
| `recommended_destination_artifact` | `shared/aliases/source_aliases_v1.jsonl` |

**Related existing entries**

- `parent` → hit (`5437cc8267a78303`)

**Source evidence (summary)**

- Miner: `plural_form_gap`, score 93, tier_2
- Gloss: `insulte des parents de l'époux ou de l'épouse`

**Why it may be safe**

- Singular `parent` resolves to one posting; surface form is regular plural.
- Same structural pattern as Phase 7F `hommes → homme` / `femmes → femme`.

**Why it may be unsafe**

- Kinship/family vocabulary can carry broader semantic scope in plural (`parents`
  as a couple vs individual `parent`); reviewer must inspect posting breadth.
- Not a simple body-part noun; slightly higher semantic risk than `fruits`/`mots`.

| Review field | Value |
| --- | --- |
| Review decision | `approved` |
| Reviewer | `phase7j_alias_round2_human_review` |
| Reviewed_at | `2026-06-15` |
| Rationale | Human reviewer approved based on French grammar with moderate-attention kinship review. `parents` is the regular plural of `parent`; alias may copy canonical `parent` posting `5437cc8267a78303` exactly without broadening beyond the singular entry scope. |

---

### `paroles` — plural form alias

| Field | Value |
| --- | --- |
| Query | `paroles` |
| Phase 7J `review_id` | `phase7j_gap_0022` |
| Likely canonical entry | `parole` |
| Candidate resolved `ir_ids` | `cf9e314229c86efc` |
| `gap_class` | `reviewed_source_alias_candidate` |
| `current_result` | miss |
| `recommended_destination_artifact` | `shared/aliases/source_aliases_v1.jsonl` |

**Related existing entries**

- `parole` → hit (`cf9e314229c86efc`)

**Source evidence (summary)**

- Miner: `plural_form_gap`, score 93, tier_2
- Gloss: `il contrôle bien ses paroles`

**Why it may be safe**

- Singular `parole` has deterministic posting; plural likely inflectional miss.
- Common vocabulary with attested plural usage in bundle.

**Why it may be unsafe**

- `paroles` can mean "lyrics/words" collectively; reviewer must confirm singular
  posting covers intended plural-query senses.

| Review field | Value |
| --- | --- |
| Review decision | `approved` |
| Reviewer | `phase7j_alias_round2_human_review` |
| Reviewed_at | `2026-06-15` |
| Rationale | Human reviewer approved based on French grammar. `paroles` is the regular plural of `parole`; alias may copy canonical `parole` posting `cf9e314229c86efc` exactly. |

---

### `enfants` — plural form alias

| Field | Value |
| --- | --- |
| Query | `enfants` |
| Phase 7J `review_id` | `phase7j_gap_0023` |
| Likely canonical entry | `enfant` |
| Candidate resolved `ir_ids` | `99e6cda40390d1fb` |
| `gap_class` | `reviewed_source_alias_candidate` |
| `current_result` | miss |
| `recommended_destination_artifact` | `shared/aliases/source_aliases_v1.jsonl` |

**Related existing entries**

- `enfant` → hit (`99e6cda40390d1fb`)

**Source evidence (summary)**

- Miner: `plural_form_gap`, score 91, tier_2
- Gloss: `elle les aidait à élever leurs enfants`

**Why it may be safe**

- High-frequency kinship/basic vocabulary; singular posting is single-target.
- Strong Phase 7F plural precedent.

**Why it may be unsafe**

- Plural `enfants` may imply group semantics beyond singular `enfant` entry;
  reviewer must confirm posting scope and ordering acceptability.

| Review field | Value |
| --- | --- |
| Review decision | `approved` |
| Reviewer | `phase7j_alias_round2_human_review` |
| Reviewed_at | `2026-06-15` |
| Rationale | Human reviewer approved based on French grammar with moderate-attention kinship review. `enfants` is the regular plural of `enfant`; alias may copy canonical `enfant` posting `99e6cda40390d1fb` exactly without introducing a broader target set. |

---

### `feuilles` — plural form alias

| Field | Value |
| --- | --- |
| Query | `feuilles` |
| Phase 7J `review_id` | `phase7j_gap_0024` |
| Likely canonical entry | `feuille` |
| Candidate resolved `ir_ids` | `f67a64559d2f6c63` |
| `gap_class` | `reviewed_source_alias_candidate` |
| `current_result` | miss |
| `recommended_destination_artifact` | `shared/aliases/source_aliases_v1.jsonl` |

**Related existing entries**

- `feuille` → hit (`f67a64559d2f6c63`)

**Source evidence (summary)**

- Miner: `plural_form_gap`, score 90, tier_2
- Gloss: `feuilles.tombées.sèches, feuilles tombées sèches`

**Why it may be safe**

- Singular `feuille` resolves deterministically; regular plural inflection.
- Nature/plant vocabulary with direct gloss support.

**Why it may be unsafe**

- `feuille` vs `feuilles` may distinguish document/page vs botanical leaf in some
  contexts; reviewer must inspect attested senses for the canonical posting.

| Review field | Value |
| --- | --- |
| Review decision | `approved` |
| Reviewer | `phase7j_alias_round2_human_review` |
| Reviewed_at | `2026-06-15` |
| Rationale | Human reviewer approved based on French grammar. `feuilles` is the regular plural of `feuille`; alias may copy canonical `feuille` posting `f67a64559d2f6c63` exactly per Phase 7F plural precedent. |

---

### `grand-parents` — multi-target hyphenated alias (higher risk)

| Field | Value |
| --- | --- |
| Query | `grand-parents` |
| Phase 7J `review_id` | `phase7j_gap_0001` |
| Likely canonical entries | `grand-mère`, `grand-père` |
| Candidate resolved `ir_ids` | `1f6d3a5919110b21`, `957bd76b41fda053` |
| `gap_class` | `reviewed_source_alias_candidate` |
| `current_result` | miss |
| `recommended_destination_artifact` | `shared/aliases/source_aliases_v1.jsonl` |
| Prior deferred alias | `src_alias_phase7a_0004` (Phase 7A) |

**Related existing entries**

- `grand-mère` → hit (`1f6d3a5919110b21`)
- `grand-père` → hit (`957bd76b41fda053`)

**Source evidence (summary)**

- Phase 7A deferred alias row `src_alias_phase7a_0004`
- Search index: no `src_*` key for `grand-parents` on current bundle
- Phase 7J `reason_not_to_apply_automatically`: multi-target alias requires explicit
  human confirmation of combined posting order and scope

**Why it may be safe**

- Both canonical kinship terms resolve independently with stable postings.
- User query is a conventional French compound for grandparents collectively.
- Phase 7A already documented the intended mapping shape for reviewer consideration.

**Why it may be unsafe — higher risk than simple plural aliases**

- **Multi-target kinship/family term risk**: combined posting may confuse users
  expecting one grandparent sense or a specific gendered result.
- **Hyphenated form**: routing must not collide with unrelated hyphenated entries.
- **Possible mapping to multiple existing entries**: alias must define exact
  combined `resolved_ir_ids` order; not automatic union behavior.
- **Prior 7A deferred alias**: explicitly deferred for multi-target confirmation;
  human reviewer has now confirmed combined posting order and scope.

| Review field | Value |
| --- | --- |
| Review decision | `approved` |
| Reviewer | `phase7j_alias_round2_human_review` |
| Reviewed_at | `2026-06-15` |
| Rationale | Human reviewer approved this **multi-target alias** based on French grammar and conventional kinship usage. The hyphenated kinship term `grand-parents` denotes grandparents collectively. Combined posting order is accepted as `grand-mère` (`1f6d3a5919110b21`) then `grand-père` (`957bd76b41fda053`). Both `grand-mère` and `grand-père` scopes are included exactly; no broader target set is introduced. User-facing interpretability of two grandparent entries is explicitly accepted for this compound lookup. |

## 5. Explicit rejects / out of scope

The following Phase 7J rows are **not** part of this alias packet:

| Query / topic | Reason excluded |
|---|---|
| `à l'insu de qqns` | phrase track (Phase 7I) |
| `à la mesure des` | phrase track (Phase 7I) |
| `ferme la bouche` | phrase / dictionary-gap non-action |
| `Grand chose` | compositional phrase; should remain no-hit |
| `grande bouche` | phrase / dictionary-gap track |
| `à parts` | should remain no-hit |
| `à part ças` | typo/noise; no fuzzy correction |
| `Kun` | target-side policy track |
| `mère` / `mere` | ranking/ambiguity track (already hits) |
| `frère` | supplement track (incomplete mapping) |
| `soeur` | supplement track (incomplete mapping) |
| `oncle` | already-addressed supplement control |
| `poil` / `poils` | already-addressed supplement controls |

Reason summary: phrase track, policy track, ranking track, supplement track,
already-addressed controls, or explicit non-action rows.

## 6. Hard rules

- Human review decisions are recorded in this packet for all 11 candidates.
- Packet approval does **not** by itself write rows to `source_aliases_v1.jsonl` or
  publish bundles.
- Future approved alias rows must follow `source_alias_table_v1` and copy canonical
  posting sets exactly.
- No runtime fuzzy search, decomposition, typo correction, or ranking changes.
- No bundle publication from this review packet alone.

## 7. Reviewer checklist (per candidate)

Before changing any row in `source_aliases_v1.jsonl` to `approved`, confirm:

1. Canonical source term(s) still resolve on the current featured bundle.
2. `resolved_ir_ids` match the canonical posting set exactly.
3. Alias does not broaden targets beyond the canonical entry.
4. For multi-target aliases (`grand-parents`), combined order and user-facing
   interpretability are explicitly accepted.
5. `reviewer`, `reviewed_at`, and `rationale` are recorded on the approved row.

---

*Generated from Phase 7J audit evidence. Human review recorded 2026-06-15.
Planning/review only in packet form — no `source_aliases_v1.jsonl` implementation yet.*
