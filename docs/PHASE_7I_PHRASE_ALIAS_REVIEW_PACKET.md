# Phase 7I Phrase Alias Review Packet

Purpose: human review packet for deciding whether two inflected phrase variants
are safe future phrase aliases under `source_phrase_alias_v1`.

This packet is planning and review guidance only. It does **not** create phrase
aliases, modify bundles, or change runtime behavior.

## Scope

- Spec: `shared/specs/source-phrase-alias-v1.md`
- Future artifact (not created in this phase): `shared/phrase_review/source_phrase_aliases_v1.jsonl`
- Evidence source (inert; not a generation input): `shared/phrase_review/phrase_miss_review_v1.jsonl`

Approved architecture: **Option B** — dedicated phrase-specific artifact. Do not
silently extend `source_alias_table_v1`.

## Candidate rows

Only the following two candidates are in scope for Phase 7I Round 1 human
review. Each maps an inflected or placeholder phrase variant to an existing
reviewed canonical phrase.

---

### Candidate 1 — plural placeholder variant

| Field | Value |
| --- | --- |
| Phase 7H `review_id` | `phase7h_phrase_0004` |
| Query | `à l'insu de qqns` |
| Canonical phrase | `à l'insu de qqn` |
| Candidate resolved `ir_id` | `ef0667f3fb422851` |

**Why it may be safe**

- A reviewed canonical phrase `à l'insu de qqn` already exists and resolves to
  a single deterministic posting (`ef0667f3fb422851`).
- The query differs only by a placeholder inflection (`qqns` vs `qqn`), not by
  compositional structure or single-word collapse.
- Phase 7H classified this as `inflected_phrase_form`, matching the allowed v1
  category.
- Meaning is plausibly preserved: both forms express the same idiomatic phrase
  with a plural indefinite placeholder.

**Why it may be unsafe**

- `qqns` is not independently validated as equivalent to `qqn` in all contexts;
  placeholder conventions may not be symmetric across singular/plural.
- Related single terms (`insu`, `qqn`) resolve independently; that evidence alone
  does not prove phrase equivalence.
- If `qqns` were ever a distinct lexical item elsewhere, routing could broaden
  phrase lookup unexpectedly.

| Review field | Value |
| --- | --- |
| Review decision | `deferred` |
| Reviewer | pending human reviewer |
| Reviewed_at | `2026-06-15` |
| Rationale | Canonical phrase `à l'insu de qqn` resolves to a single deterministic posting (`ef0667f3fb422851`), and the surface difference is limited to placeholder inflection (`qqns` vs `qqn`). No human reviewer has yet confirmed that `qqns` is a safe plural placeholder variant of `qqn` in this phrase context. Defer until a reviewer verifies meaning equivalence and that placeholder pluralization does not broaden scope beyond the attested canonical entry. |

---

### Candidate 2 — preposition inflection variant

| Field | Value |
| --- | --- |
| Phase 7H `review_id` | `phase7h_phrase_0006` |
| Query | `à la mesure des` |
| Canonical phrase | `à la mesure de` |
| Candidate resolved `ir_id` | `ba5714fa586bd031` |

**Why it may be safe**

- A reviewed canonical phrase `à la mesure de` already exists and resolves to
  a single deterministic posting (`ba5714fa586bd031`).
- The variation is a small inflectional/prepositional surface form (`de` vs
  `des`), not decomposition into component terms.
- Phase 7H classified this as `inflected_phrase_form`.
- Both forms may express the same fixed expression with a predictable
  determiner/preposition alternation.

**Why it may be unsafe**

- `de` to `des` can alter scope (singular vs plural complement) in French; the
  reviewer must confirm the dictionary entry covers both usages equivalently.
- The related single term `mesure` resolves independently but does not establish
  phrase-level equivalence.
- If the canonical entry is glossed or attested only for the singular-complement
  form, aliasing the plural-preposition variant could misroute queries.

| Review field | Value |
| --- | --- |
| Review decision | `deferred` |
| Reviewer | pending human reviewer |
| Reviewed_at | `2026-06-15` |
| Rationale | Canonical phrase `à la mesure de` resolves to a single deterministic posting (`ba5714fa586bd031`), but `de → des` may change grammatical scope (singular vs plural complement). No human reviewer has confirmed that the dictionary entry covers both forms with equivalent meaning. Defer with higher caution: reviewer must inspect the attested gloss, examples, and intended scope of `ba5714fa586bd031` before any alias approval. |

---

## Explicit rejects

The following Phase 7H evidence rows are **explicitly rejected** for v1 phrase
aliases. They MUST NOT be promoted to `source_phrase_aliases_v1.jsonl` under the
current spec.

### `ferme la bouche` → `bouche`

| Field | Value |
| --- | --- |
| Phase 7H `review_id` | `phase7h_phrase_0001` |
| Proposed unsafe routing | phrase → single word `bouche` |

**Why rejected**

- The whole phrase is a miss; only related single terms resolve.
- Routing to `bouche` would be **phrase-to-single-word routing**, which v1
  forbids.
- No reviewed phrase-level target exists; related-term hits are insufficient
  evidence for phrase equivalence.
- Would imply unsafe phrase understanding without phrase-level attestation.

### `Grand chose` → `grand` + `chose`

| Field | Value |
| --- | --- |
| Phase 7H `review_id` | `phase7h_phrase_0002` |
| Proposed unsafe routing | compositional decomposition |

**Why rejected**

- Classified as `compositional_phrase_should_decompose`.
- Component terms resolve independently, but the phrase may have idiomatic or
  compositional meaning that must not be inferred automatically.
- v1 forbids **compositional phrase routing** and **runtime decomposition**.

### `grande bouche` → `grand` + `bouche`

| Field | Value |
| --- | --- |
| Phase 7H `review_id` | `phase7h_phrase_0003` |
| Proposed unsafe routing | compositional / partial phrase collapse |

**Why rejected**

- The whole phrase is not exposed as a reviewed phrase entry.
- Related gender and single-term hits do not prove a safe phrase-level mapping.
- Would require compositional or partial decomposition, both forbidden in v1.

### `à l'intérieurs` → `à l'intérieur`

| Field | Value |
| --- | --- |
| Phase 7H `review_id` | `phase7h_phrase_0005` |
| Proposed unsafe routing | typo-like correction to reviewed phrase |

**Why rejected**

- Classified as `bad_query_typo_unsupported_phrase`.
- The query appears to be a malformed plural or typo of the reviewed phrase.
- Approving it would behave like **typo correction**, which v1 explicitly
  rejects.
- Phase 7H recommendation: `reject_keep_no_hit`.

### `à la vue perçantes` → `à la vue perçante`

| Field | Value |
| --- | --- |
| Phase 7H `review_id` | `phase7h_phrase_0007` |
| Proposed unsafe routing | agreement-error correction |

**Why rejected**

- Classified as `bad_query_typo_unsupported_phrase`.
- The query appears to be an agreement or number error against an existing
  singular phrase.
- Approving it would imply unsupported **typo/agreement correction**.
- Phase 7H recommendation: `reject_keep_no_hit`.

### `à parts` → `part`

| Field | Value |
| --- | --- |
| Phase 7H `review_id` | `phase7h_phrase_0008` |
| Proposed unsafe routing | phrase → single word `part` |

**Why rejected**

- Classified as `should_remain_no_hit`.
- The related single term `part` exists, but `à parts` is not safely equivalent
  to a reviewed phrase or target entry.
- Would be **phrase-to-single-word routing**, forbidden in v1.
- Phase 7H recommendation: `reject_keep_no_hit`.

### `à part ças` → `à part ça`

| Field | Value |
| --- | --- |
| Phase 7H `review_id` | `phase7h_phrase_0009` |
| Proposed unsafe routing | fuzzy typo correction |

**Why rejected**

- Classified as `bad_query_typo_unsupported_phrase`.
- The query appears to be a malformed form of the reviewed phrase `à part ça`.
- Approving it would imply **fuzzy correction** rather than reviewed inflected
  phrase lookup.
- Phase 7H recommendation: `reject_keep_no_hit`.

---

## Review checklist

Before marking a candidate `approved` in a future `source_phrase_aliases_v1.jsonl`
row, the reviewer MUST confirm:

- [ ] **Does the canonical phrase already exist?** — `canonical_phrase` MUST
  resolve in the base source search index with a deterministic posting set.
- [ ] **Does the query preserve meaning?** — the variant MUST NOT change idiomatic
  or semantic scope relative to the canonical entry.
- [ ] **Is this inflection/placeholder variation, not typo correction?** — the
  difference MUST be a reviewed morphological or placeholder alternation, not a
  misspelling, agreement error, or malformed form.
- [ ] **Does it avoid decomposition?** — routing MUST NOT split the phrase into
  component single-term postings.
- [ ] **Does it avoid target-side behavior?** — the alias MUST generate `src_*`
  keys only; no target-side alias semantics.
- [ ] **Is there a single deterministic ir_id posting set?** — `resolved_ir_ids`
  MUST match the canonical phrase postings exactly, in order.
- [ ] **Is reviewer/date/rationale present?** — `reviewer`, `reviewed_at`, and
  `rationale` MUST be filled for every approved row.

---

## After review

When human review completes:

1. Record decisions in this packet (decision, reviewer, date, rationale).
2. If approved, a separate implementation phase may create
   `shared/phrase_review/source_phrase_aliases_v1.jsonl` rows conforming to
   `shared/specs/source-phrase-alias-v1.md`.
3. Do not use `phrase_miss_review_v1.jsonl` as a build input; copy provenance
   into approved alias rows via `source_review_id` only.
4. Validator, applier, report, and pipeline wiring remain future work.
