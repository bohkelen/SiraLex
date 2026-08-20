# AL1A — Alias and Content Gap Audit

## 1. Decision

```text
AL1A_ALIAS_AND_CONTENT_GAP_AUDIT_COMPLETE
```

Audit only. No runtime, UI, schema, dictionary, corpus, index, CF2, or
query-log changes. No automatic alias generation. No automatic dictionary
correction.

Key invariant:

```text
Aliases are reviewed dictionary artifacts.
CF2/query logs are evidence only.
No automatic truth from user search behavior.
```

## 2. Base commit

```text
88a2be6286ab48fda14281bd31395eebcf8c6d68
```

`git log -1`: `88a2be6 Close SQ1 search engine series`.

Working tree at audit start:

```text
?? web/scripts/
```

(`web/scripts/` remains excluded local tooling; not part of AL1A.)

## 3. Problem definition

SQ1 closed the search-engine series. Consumer LookupMode search now covers a
safer floor for reasonable typing variation:

- SQ1B prefix suggestions
- SQ1C1 FR/EN hyphen↔space exact retry
- SQ1C2 FR œ→oe exact retry
- SQ1D1 FR exact source-term promotion

After exact + variants + prefix, remaining misses are often **not** retrieval
bugs. They may be:

1. true dictionary content gaps
2. missing aliases (alternate FR forms of existing indexed concepts)
3. missing alternate spellings / common forms
4. missing common French/English entry points into existing Maninka postings
5. missing Maninka forms (target-side; no v1 alias path today)
6. user misunderstanding (wrong direction, phrase/sentence, expectation mismatch)

AL1 must define a **reviewed** alias / content-gap workflow that turns repeated
no-result evidence into human decisions without mutating dictionary truth from
raw search behavior.

Illustrative residual class from SQ1E / SQ1 series closure (not a demand list):
`bonjour`, `poulet`, `hello`, and similar everyday misses that survive the SQ1
floor.

## 4. Difference between search miss, alias, content gap, and correction

| Concept | Meaning in SiraLex | Authority | Needs existing `ir_id`? | Destination |
|---------|--------------------|-----------|-------------------------|-------------|
| **Search failure (CF2)** | User reports unmet search need (`no_result` or `results_not_useful`) | Non-authoritative evidence | No | Export → human triage |
| **Query-log miss** | Observational `result_status: miss` (consent-gated) | Non-authoritative telemetry | No | Export / Phase 7K evidence → candidates only |
| **Alias candidate** | Alternate **source form** that should route to **existing** canonical source posting(s) | Becomes search metadata only after review + build | Yes (`resolved_ir_ids`) | `shared/aliases/source_aliases_v1.jsonl` |
| **Spelling / common-form variant** | Orthographic or everyday form of an indexed French source concept (`Yeux`→`oeil`, `maman`→`mère`) | If reviewed → alias; if wrong entry text → CF1; if noise → reject | Yes for alias | Alias table **or** CF1 `issue_type: spelling` |
| **Content gap** | Lemma/mapping truly absent, or incomplete mapping with no safe convenience alias | Needs lexical / index research | Often yes for supplements; may need new IR | Supplement table and/or new lexical IR — **not** alias |
| **Dictionary correction (CF1)** | Challenge to a **known openable** `lexicon_entry` | Non-authoritative suggestion | **Yes** (`ir_id` required) | `siralex_correction_feedback_v1` → later governed review |
| **New entry request** | “Please add this word” as product truth | **Not a runtime product claim** | N/A | Human research after triage; never auto-asserted by CF2 |

**Alias vs content gap (worked example: `bonjour`)**

- If a Maninka greeting entry already exists under another French gloss, and a
  reviewer can declare exact `resolved_ir_ids` for that concept, `bonjour` may
  be a **source alias** or a **source-index supplement**, depending on whether
  the need is convenience routing to existing postings vs a reviewed new/additive
  `index_mapping`.
- If no safe greeting concept / posting set exists, `bonjour` is a **true
  content gap** (owner lexical / new entry research). It must **not** be forced
  into `source_alias_table_v1`.

Spec boundary (`shared/specs/source-alias-table-v1.md`): the alias table MUST
NOT represent missing source-index mappings (e.g. standalone `poil`), content
corrections, phrases/sentences, or ranking changes. Those belong to supplements,
CF1, phrase-review, or policy — not aliases.

## 5. Existing evidence sources

| Source | Path / schema | Useful fields | Authority |
|--------|---------------|---------------|-----------|
| CF2 drafts / export | `web/src/search_feedback/*`; package `siralex_search_feedback_v2` (default) | `query_raw`, `input_lang`/`output_lang`, `result_state`, `result_count`, `matched_ir_ids?`, `requested_meaning?`, `user_description?`, bundle provenance | `unreviewed_search_failure_feedback_must_not_be_treated_as_missing_entry_truth` |
| Query logs | `web/src/query_logging/query_log_types.ts` (`query_log_event_v3`); JSONL export | `query_raw`, normalized keys, langs, `result_status`, `result_count`, `top_ir_ids`, matched key meta, `bundle_id` | Consent-gated observational evidence |
| Phase 7K query evidence | `api/query_evidence/` (`phase7k_query_evidence_v1`) | Replay + `gap_class` + `recommended_destination_artifact`; always `review_status: candidate` | Heuristic candidates only; never auto-apply |
| Current dictionary records | bundle `records.jsonl` | Lexical / mapping authority | Installed dictionary truth |
| Current search index | bundle `search_index.jsonl` | `key`, `key_type`, `ir_ids` (`src_*` / `en_*` / `tgt_*`) | Search metadata derived from build |
| Reviewed aliases | `shared/aliases/source_aliases_v1.jsonl` (`source_alias_table_v1`) | `alias_source_term`, `canonical_source_terms`, `resolved_ir_ids`, `candidate_type`, `status` | Reviewed search configuration |
| Reviewed supplements | `shared/source_index_supplements/source_index_supplements_v1.jsonl` | `supplement_mode`, source term → target IRs | Reviewed discoverability overlays |
| Phrase-miss evidence | `shared/phrase_review/phrase_miss_review_v1.jsonl` (phrase alias table file not present) | Phrase candidates | Review packet only today |
| CF1 correction drafts | `web/src/corrections/*`; package `siralex_correction_feedback_v1` | Requires `ir_id`; entry-scoped issues | `unreviewed_user_suggestions_must_not_be_applied_automatically` |
| Search regression matrices | `shared/search_regression/` | Approved lookup contracts (incl. alias guards like `maman` / `moto`) | Engineering QC, not demand telemetry |

Current reviewed table sizes at audit: **24** alias rows; **8** supplement rows.

Offline helpers already present: `api/source_aliases/validate_alias_table.py`,
`api/source_aliases/apply_aliases_to_search_index.py`, supplement generate/merge
modules, `scripts/analyze_query_logs.py`.

## 6. Authority model

```text
Installed dictionary (records.jsonl)
    ↓ lexical authority

Search index (search_index.jsonl)
    ↓ search metadata (includes approved aliases / supplements after build)

CF2 / query logs / exports
    ↓ evidence only (non-authoritative)

Human review (outside app or governed packets)
    ↓ decides: alias | supplement | true gap | noise | CF1 | policy

Reviewed alias / supplement tables (shared/*.jsonl)
    ↓ candidate → approved only after reviewer + provenance

Bundle rebuild (validate + apply fail-closed)
    ↓ new catalog / featured publish

Runtime search
    ↓ consumes installed index only; does not invent aliases
```

Frozen claims:

- CF2 does **not** prove a missing dictionary entry.
- Query-log volume does **not** authorize matrix or alias auto-updates.
- Approved aliases do **not** rewrite `records.jsonl`; they add `src_*` keys.
- Supplements may generate reviewed `index_mapping` records with explicit
  provenance; they are not convenience aliases.
- CF1 requires an existing entry; it is not the path for zero-result gaps.

## 7. Possible storage / pipeline options

| Option | Location | Verdict for AL1 MVP |
|--------|----------|---------------------|
| **A. Reviewed source alias file (existing)** | `shared/aliases/source_aliases_v1.jsonl` → apply to `search_index.jsonl` | **Recommended primary for aliases** |
| **B. Reviewed source-index supplements (existing)** | `shared/source_index_supplements/…` → `index_mapping` | **Recommended for missing/incomplete mappings** |
| **C. Phrase alias file (spec only)** | Intended `shared/phrase_review/source_phrase_aliases_v1.jsonl` | Deferred until approved phrase rows exist |
| **D. Future dictionary source pipeline** | Upstream IR / Mali-Pense ingestion | Required for true new lemmas; slower track |
| **E. Generated search-index supplemental keys only** | Ad-hoc index edits without table | **Reject** — loses auditable provenance |
| **F. Local-only user alias layer** | Device-local overrides | **Reject for MVP** — splits authority; offline confusion; hard to review |
| **G. Feedback export only** | CF2/query-log files with no reviewed table | Necessary evidence stage; **insufficient alone** |

Build order already documented in Phase 7:

```text
IR → normalize → enrich
  → build base search_index.jsonl
  → [optional] generate/merge supplements
  → validate + apply source_aliases (search_index only)
  → [phrase aliases if ever approved]
  → assemble / verify bundle + catalog
```

## 8. Recommended AL1 architecture

**Reuse and govern the existing Phase 7 reviewed-artifact pipeline.** Do not invent
a parallel runtime synonym engine.

```text
CF2 export + optional query-log JSONL
        ↓
Offline triage / Phase 7K candidate classes (heuristic only)
        ↓
Human classification
   ├─ reviewed_source_alias_candidate → source_aliases_v1.jsonl
   ├─ missing/incomplete mapping → source_index_supplements_v1.jsonl
   ├─ phrase miss → phrase review track
   ├─ true_dictionary_entry_gap → owner lexical / new IR research
   ├─ known-entry defect → CF1 (separate)
   └─ typo / ambiguity / misunderstanding → reject / defer
        ↓
status: candidate → approved (reviewer, rationale, resolved_ir_ids)
        ↓
validate + apply fail-closed → new search_index (+ supplements if any)
        ↓
bundle/catalog publish → device update path (DU1)
```

Architectural rules:

1. **Aliases** = reviewed FR source convenience forms with explicit
   `resolved_ir_ids` (`french_plural_singular_alias`, `french_gender_alias`,
   `hyphenation_or_compound_alias`, `french_common_form_alias`).
2. **Content gaps** that need new/additive mappings use **supplements** or new
   lexical IR — never forced aliases.
3. **No EN or MNK alias table in v1**; target-side / EN gloss variants stay
   deferred policy work.
4. **No runtime query synonym expansion**; aliases enter only via index build.
5. **No automatic promotion** from CF2, query logs, or classifier scores.
6. **Provenance stays outside silent index edits** (alias/supplement JSONL +
   application reports).

This preserves dictionary authority while still improving discoverability for
reviewed common entry points (`maman`, `moto`, plurals/genders already shipped).

## 9. Recommended next slice

```text
AL1B — Alias / Content-Gap Candidate Evidence Report
```

**Type:** offline evidence → human review worksheet (still no auto-apply).

**Scope shape:**

- Define how to collect CF2 (`siralex_search_feedback_v2`) and optional
  consent-gated query-log exports for a pinned featured `bundle_id` /
  `content_sha256`.
- Produce a deterministic, human-readable candidate report (or extend existing
  `api/query_evidence` emit) that lists repeated misses with proposed
  **gap_class** and **destination artifact**, always as `candidate`.
- Explicit routing labels: alias vs supplement vs true gap vs noise vs CF1 vs
  phrase.
- Document operator steps to draft `status: candidate` rows in the correct
  shared table — without approving them in AL1B.

**Why this next, not schema/runtime:**

- Alias schema + index applier **already exist** (user-proposed AL1C/AL1D are
  largely present as `source_alias_table_v1` + `apply_aliases_to_search_index.py`).
- The missing AL1 product seam after SQ1 is a **safe evidence→review handoff**,
  not another search rung and not a new runtime alias layer.

Possible later slices (program menu; not started here):

| Slice | Intent | Note |
|-------|--------|------|
| AL1B | Local/offline candidate report from CF2 + logs | **Recommend next** |
| AL1C | Reviewed alias import / row drafting discipline | Mostly exists; may be docs + validation hardening |
| AL1D | Alias-backed search index generation | **Exists**; use/publish rounds, don’t reimplement |
| AL1E | Alias provenance display / audit surfaces | Optional consumer/maintainer visibility |
| AL1F | Content-gap review queue (supplement / new IR track) | Parallel to alias track for `bonjour`-class gaps |

## 10. Explicit non-goals

Do **not** implement in AL1A (and do not smuggle into AL1B without new auth):

- alias search / synonym expansion at runtime
- alias UI
- new reviewed-alias schema (v1 already exists)
- index rebuild / corpus edit / dictionary mutation in this audit
- automatic synonym expansion
- AI semantic matching
- fuzzy search
- morphology / stemming engines
- CF2 schema change
- query-log schema change
- local-only user alias authority
- treating CF2 `no_result` as missing-entry truth
- EN/MNK alias tables without a separate reviewed design
- automatic Phase 7K candidate → approved promotion

What should **not** become an alias:

- fuzzy typos
- wrong translations
- ambiguous queries
- broad semantic approximation
- personal guesses
- unreviewed user suggestions (CF2/CF1 raw)
- ranking preferences among multi-hits
- phrase/sentence expectations (phrase track or reject)
- true missing lemmas with no safe `resolved_ir_ids`

## 11. Risks

| Risk | Rating | Mitigation |
|------|--------|------------|
| Promoting CF2 volume into dictionary truth | High | Keep authority label; AL1B candidates only; human approve |
| Forcing content gaps into alias rows | High | Spec forbid-list; route to supplements / owner IR |
| Over-broad `french_common_form_alias` posting sets | High | Require explicit narrowed `resolved_ir_ids` (maman pattern) |
| Classifier heuristics treated as linguistic proof | Medium | `api/query_evidence` remains candidate-only |
| Local user aliases splitting offline authority | Medium | Reject Option F for MVP |
| Reopening SQ1 with more query expansion | Medium | Series closed; AL1 is content/review, not engine |
| EN/MNK “alias” pressure without schema | Medium | Explicit deferral; no silent `en_*`/`tgt_*` aliasing |
| Phrase alias file absence causing ad-hoc index edits | Medium | Keep phrase on review packets until table exists |

## 12. Test plan for next implementation slice (AL1B)

AL1B (when authorized) should prove evidence handoff without authority mutation:

1. **Fixture CF2 package** with mixed `no_result` / `results_not_useful` and
   known langs parses; authority label preserved.
2. **Pinned bundle identity** required on every candidate row
   (`bundle_id` / content hash).
3. **Deterministic ordering** of emitted candidates (stable sort keys).
4. **Gap-class routing assertions:** plural-ish miss →
   `reviewed_source_alias_candidate` destination
   `shared/aliases/source_aliases_v1.jsonl`; unknown single-token miss →
   `true_dictionary_entry_gap` with **null** destination; never auto-`approved`.
5. **Negative:** running AL1B tooling does not modify `records.jsonl`,
   `source_aliases_v1.jsonl`, IndexedDB schemas, or runtime search modules.
6. **Regression smoke:** existing `pytest api/source_aliases/tests/` and
   `api/query_evidence/tests/` still pass if AL1B only adds report glue.
7. **Manual checklist:** reviewer can map one fixture miss to a draft
   `status: candidate` alias row **by hand** using the report — approval remains
   a later slice.

No unit/build required for this AL1A report-only slice.

## 13. Files changed

```text
docs/reports/al1a_alias_and_content_gap_audit.md
```

Runtime / tests / index / shared alias tables: unchanged.

## 14. git diff --check

```text
PASS
```

(report-only addition; no whitespace errors expected on new markdown.)

## 15. Working tree

Expected after this audit (uncommitted):

```text
?? docs/reports/al1a_alias_and_content_gap_audit.md
?? web/scripts/
```

Commit not created for AL1A.

---

## Audit matrix (core questions)

| # | Question | Answer |
|---|----------|--------|
| 1 | Search failure vs alias vs gap vs correction? | §4 table |
| 2 | Existing evidence sources? | §5 |
| 3 | What an alias means (`bonjour`)? | Convenience / mapped routing only if safe `resolved_ir_ids`; else content gap / supplement |
| 4 | What must not be an alias? | §10 |
| 5 | Where reviewed aliases live? | Existing `source_aliases_v1.jsonl` (+ supplements for gaps) |
| 6 | Safest MVP workflow? | Export → human triage → reviewed tables → validate/apply → publish |
| 7 | What AL1 eventually implements? | §9 menu; next = AL1B candidate evidence report |
