# Phase 7K Track C — Tester Operations Packet

**Status:** operational guidance — documentation only  
**Audience:** maintainers coordinating opt-in tester sessions and local evidence collection  
**Prerequisite:** Track A runtime logging + consent; Track B offline analyzer available locally  
**Related:** `docs/PHASE_7K_QUERY_EVIDENCE_GOVERNANCE.md`, `docs/PHASE_7K_QUERY_EVIDENCE_PLAN.md`

---

## Purpose

This packet defines how to collect query-log evidence so future search and content decisions rest on **trustworthy provenance**, not mixed traffic.

The offline analyzer (Track B) can summarize exports and emit candidate rows. Its output is only as reliable as the **cohort label**, **collection mode**, and **exclusion rules** applied before aggregation. Smoke checks, developer probes, structured usability runs, and natural tester behavior must never be interpreted as one undifferentiated product-demand signal.

This document is the operational contract for maintainers and testers. It does not change runtime behavior, bundles, or analyzer code.

---

## Scope and non-goals

### In scope

- Cohort labeling for every export received or generated locally
- Two collection modes: natural use vs structured usability
- Tester consent, privacy, and local storage rules
- Export handoff procedure and provenance records (non-sensitive fields only)
- Exclusion rules before product-triage aggregate analysis
- Aggregate-analysis procedure and reviewer checklist
- Baseline threshold for “sufficient evidence” before production-artifact consideration

### Non-goals

- Changing search, logging, UI, bundles, catalog, aliases, supplements, or source data
- Committing raw tester exports, real candidate JSONL, summaries, or audit reports without explicit maintainer approval
- Processing new real exports as part of this documentation phase
- Creating production-named evidence artifacts in the repository
- Replacing human review packets (Phase 7I / 7J) or auto-approving analyzer classifications
- Training testers on internal taxonomy (`gap_class`, ladder levels, bundle IDs) unless they are blocked and need recovery steps only

---

## Cohort labels

Every export and every analyzer run against real data must be tagged with exactly one cohort. Cohort is assigned by the **maintainer** at receipt time, using export context (who sent it, why logging was on, what instructions were given). Testers do not self-assign cohort labels in the app.

| Cohort | Meaning | Raw export: local analysis OK? | May enter product-triage aggregate? | May support future production review artifact? |
|--------|---------|----------------------------------|-------------------------------------|-----------------------------------------------|
| `smoke` | Maintainer or CI smoke verification of logging, export, or deploy health. Often short, repetitive, or scripted checks. | Yes — for tooling verification only | **No** | **No** |
| `developer` | Maintainer or contributor exploration, debugging, replay checks, or feature validation. Not opt-in tester natural use. | Yes — for engineering diagnosis only | **No** | **No** |
| `tester` | Opt-in participant using the app under Track C protocols (natural use and/or structured usability). Export received with consent confirmed. | Yes — primary evidence input | **Yes** — only this cohort | **Yes** — only this cohort, after governance gate |
| `synthetic_debug` | Hand-authored or fixture JSONL used to validate analyzer behavior. Not human search behavior. | Yes — fixture / debug only | **No** | **No** |

**Required rule:** Only `cohort=tester` may support product-triage evidence or a future production review artifact.

If an export’s cohort is uncertain, treat it as **excluded** from product-triage aggregate until provenance is resolved. Do not default ambiguous exports to `tester`.

---

## Collection modes

Collection mode describes **how** logging was produced within a `tester` cohort session. Mode is recorded in the provenance record alongside cohort.

| Mode | Purpose | Demand-frequency interpretation |
|------|---------|--------------------------------|
| `natural_use` | Tester uses the app normally after opt-in; no prescribed query list. | **Allowed** — repeated natural misses and query shapes may inform product demand and gap prioritization (subject to exclusion rules). |
| `structured_usability` | Limited controlled matrix to validate interaction behavior, discover confusion, and exercise known cases. | **Not allowed** — counts and repeats from this mode must **not** be interpreted as demand frequency. |

**Required distinction:**

- **Natural-use** evidence may inform product demand and gap prioritization.
- **Structured-usability** evidence may validate interaction behavior, discover confusion, and test known cases, but must **not** be interpreted as demand frequency.

A single tester may contribute exports in both modes across separate sessions. Tag each export with one mode. When running the analyzer for product triage, **exclude** `structured_usability` rows from frequency-based ranking (occurrence counts, P1/P2 repeat thresholds) unless the maintainer explicitly runs a separate usability-only report.

---

## Tester consent and privacy

### Before logging

1. Send the tester the app link and this packet’s relevant sections (natural use **or** structured protocol — not both mixed in one undifferentiated session without labeling).
2. Tester reads the in-app first-enable consent (Track A) and explicitly turns query logging **On** only if they agree.
3. Maintainer records `consent_confirmed: yes` in the provenance record only after the tester confirms they enabled logging knowingly.

### During logging

- Logging is local-only (IndexedDB). No automatic upload.
- Tester may turn logging off or clear logs at any time via Advanced diagnostics.
- Maintainer must not ask for exports until the tester agrees to share.

### After logging

- Export stays on the tester’s device until they choose to share.
- Tester may inspect or delete the export file before sharing.
- Shared exports are **confidential**. Treat contents as personal lookup behavior, not public data.
- Do not request name or email in provenance records. Use opaque tester labels (`tester_A`) only in separate private maintainer notes if needed — not in git.

### What never belongs in the repository

- Raw `.jsonl` exports
- Full local filesystem paths
- Session UUIDs, `event_id` lists tied to individuals
- Unreviewed real candidate / summary / audit outputs

---

## Natural-use collection protocol

Use this mode to capture **organic** search behavior for product-triage evidence.

1. **Tester opts in before logging.** In-app consent + toggle on before meaningful searching.
2. **Tester uses the app normally.** No prescribed query list. No maintainer dictation of search terms during the session.
3. **No prescribed query list.** Do not hand the tester a spreadsheet of strings to type for demand measurement.
4. **Tester may stop logging at any time.** Off toggle or clear logs ends collection without penalty.
5. **Tester export stays local and outside the repository.** Download via Advanced diagnostics → Export logs; file remains on device until voluntary share.
6. **Tester may inspect or delete the export before sharing it for local analysis.** Maintainer analyzes only what the tester chooses to send.

### Maintainer instructions (natural use)

- Ask what felt confusing or wrong in plain language (see Phase 6C-style feedback questions if useful).
- Do **not** explain catalog, bundle, normalization, or ladder mechanics unless the tester is blocked.
- When requesting export, remind the tester they can review the file first and decline to send.

### Labeling

- Provenance: `cohort: tester`, `collection_mode: natural_use`.
- Note approximate session count if one export spans multiple days (estimate only).

---

## Structured usability protocol

Use this mode to **validate UX and known cases**, not to measure how often users want a given lemma.

Label every structured session explicitly in provenance: `collection_mode: structured_usability`.

### Session rules

1. Same consent and opt-in requirements as natural use.
2. Maintainer provides a **short controlled checklist** (below) — not an open-ended “search anything” brief.
3. Tester performs checks in one sitting when possible; separate export per structured session is preferred.
4. Tell the tester these queries are **checks**, not a ranking of what the dictionary should contain.
5. **Do not write fake user queries into production data.** These strings are controlled checks only; they must not be inserted into bundles, aliases, supplements, or git-tracked fixtures as if they were organic demand.

### Controlled test matrix (one check per row)

Complete each row once per structured session. Pick concrete strings at session time from the featured bundle or maintainer’s private checklist — do not commit chosen strings to the repo as evidence.

| Check ID | Coverage goal | What to observe |
|----------|---------------|-----------------|
| S1 | One **known source-side hit** | Direction `source_to_target`; single-hit or clear top result; confirms baseline search path works. |
| S2 | One **multi-hit source-side query** | Direction `source_to_target`; multiple results; note ranking / interpretability confusion if any. |
| S3 | One **target-side query** | Direction `target_to_source`; confirms reverse direction behavior. |
| S4 | One **punctuation/diacritic variation** | Same lemma intent with different spacing, punctuation, or diacritics; confirms normalization UX. |
| S5 | One **no-hit query** | Deliberate miss or out-of-scope string **labeled in provenance** as a structured no-hit check (not organic demand). |
| S6 | One **multi-token query** | Phrase or multi-word lookup; note phrase vs compositional behavior. |

After the matrix, the tester may add brief qualitative notes (outside the export). Export JSONL when done.

### Analyzer handling

- Ingest structured exports for usability review tables (confusion, direction errors, UI copy signals).
- **Exclude** structured-usability events from product-demand frequency aggregates and repeat-miss P1/P2 promotion unless a row is also supported by natural-use evidence from another export.

---

## Export procedure

### Tester steps

1. Open the app → **Advanced diagnostics**.
2. Confirm query logging is **On** (and was on during the session being exported).
3. Press **Export logs** → save `siralex-query-logs-*.jsonl` locally.
4. Optionally review or delete the file before sharing.
5. Send the file to the maintainer through an agreed private channel (not git).

If logging was off during part of the session, the export reflects only logged events — do not reconstruct missing events manually.

### Maintainer steps on receipt

1. Store the file **outside** the repository (private directory only).
2. Assign `cohort` (must be `tester` for product triage).
3. Assign `collection_mode` (`natural_use` or `structured_usability`).
4. Fill the provenance record (non-sensitive fields only).
5. Note `schema_mix` (predominantly v2 vs v1) from a quick line count or analyzer ingest summary.
6. List any **known smoke or probe queries** present in the export (for exclusion).
7. Do **not** rename the export to look like a repo fixture.

### Multiple exports

- One provenance record per received file (or per clearly defined bundle of files from one tester session — document merge rationale in `notes`).
- Deduplicate by `event_id` at analyzer ingest; mark duplicate exports in provenance to avoid double-counting sessions.

---

## Local storage rules

| Artifact | Allowed location | Git |
|----------|------------------|-----|
| Raw tester `.jsonl` exports | Private directory outside repo (e.g. `~/siralex-evidence/incoming/`) | **Never commit** |
| Provenance records (non-sensitive) | Maintainer private notes or `docs/` only after redaction review | Commit **only** redacted templates, not filled exports |
| Analyzer outputs from real exports | `/tmp`, `~/siralex-evidence/analysis/`, or other private local path | **Do not commit** without explicit maintainer approval per governance doc |
| Synthetic fixtures | `shared/query_evidence/fixtures/` (analyzer tests only) | Allowed per Track B policy |

**Hard rules:**

- Raw exports must remain outside the repository.
- Generated real-analysis outputs should remain under `/tmp` or another private local directory until reviewed.
- Do not commit raw logs.
- Do not commit real candidates, summary, or audit artifacts without explicit maintainer approval.
- Do not place exports under `shared/`, `docs/`, `fixtures/`, `build/`, or any Git-tracked directory.

---

## Provenance record template

Copy one block per received export. Store completed records outside git unless every field is non-sensitive and maintainer-approved for publication.

```yaml
export_basename: siralex-query-logs-YYYYMMDDTHHMMSSZ.jsonl
collection_date: YYYY-MM-DD
cohort: tester
collection_mode: natural_use
schema_mix: v2_majority
known_smoke_or_probe_queries:
  - zzzz-nohit-test
  - (list deliberate probes only; no full query dump)
tester_session_count_estimate: 1
consent_confirmed: yes
notes: Optional context — device type, returning vs fresh user, structured matrix S1-S6 completed yes/no
```

### Prohibited in provenance records committed or shared widely

Do **not** include:

- full local path
- tester name
- email
- session UUID
- raw query export (full JSONL body or complete query list)

Use `export_basename` only, not absolute paths. Session breadth is captured by `tester_session_count_estimate`, not `session_bucket_id`.

---

## Exclusion rules

Exclude the following from **product-demand analysis** and from **product-triage aggregate** inputs (remove events, entire exports, or down-rank before P1/P2 consideration):

| Exclusion | Action |
|-----------|--------|
| `synthetic_debug` traffic | Never merge with tester aggregate |
| Smoke verification (`cohort: smoke`) | Drop export or entire file from triage |
| Developer probes (`cohort: developer`) | Drop export or entire file from triage |
| Duplicated exports | Dedupe by `event_id`; count each session once |
| Known deliberate no-hit strings | Exclude events listed in provenance `known_smoke_or_probe_queries` (e.g. structured S5 probes, maintainer test strings) |
| Structured-usability frequency counts | Do not use occurrence_count or repeat thresholds from `collection_mode: structured_usability` alone |

When in doubt, exclude. Under-counting demand is safer than mixing cohorts.

---

## Aggregate-analysis procedure

Run only after provenance records exist for every input file and cohorts are verified.

1. **Gate:** Confirm all product-triage inputs are `cohort: tester`. Move smoke/developer/synthetic files to separate analysis folders.
2. **Split by mode:** Separate natural-use exports for demand signals; keep structured-usability exports for usability appendix only.
3. **Apply exclusions:** Strip known probe queries; dedupe duplicate exports.
4. **Run analyzer locally** (Track B entrypoint) with private paths only:
   - Inputs: natural-use tester exports (structured optional as separate `--input` with audit flag).
   - Outputs: write to `/tmp` or private analysis dir — not `shared/query_evidence/` until approval gate passes.
5. **Review ingest health:** v1/v2 mix, parse errors, `distinct_tester_buckets_hashed`, bundle/catalog mismatch flags.
6. **Product triage:** Prioritize P1/P2 from **natural-use** repeat misses only; cross-check structured findings separately.
7. **Manual row review:** Every P1/P2 candidate and every `true_dictionary_entry_gap` row — see governance doc.
8. **Record decisions** in maintainer decision log (template in governance doc); do not change analyzer `review_status`.

---

## Reviewer checklist

Before treating an analyzer run as input to content or search prioritization:

- [ ] Every input export has a completed provenance record
- [ ] All product-triage exports are `cohort: tester` with `consent_confirmed: yes`
- [ ] Smoke, developer, and synthetic_debug exports excluded from triage aggregate
- [ ] Structured-usability frequency not used for demand ranking
- [ ] Known probe / no-hit strings excluded per provenance list
- [ ] Duplicate exports deduped
- [ ] Raw exports and analysis outputs still outside git
- [ ] Ingest report reviewed (schema mix, session buckets, bundle mismatch)
- [ ] Sufficient evidence threshold assessed (see below) — not assumed met
- [ ] Every P1/P2 and `true_dictionary_entry_gap` candidate manually reviewed
- [ ] No production-named artifacts committed without governance approval gate

---

## Escalation and decision rules

| Situation | Action |
|-----------|--------|
| Cohort unknown or mixed in one file | Stop triage; split or re-collect; do not commit artifacts |
| Only v1 exports, no session buckets | Allow local analysis with written v1 limitations; do not claim multi-tester repeat without v2 evidence |
| Single tester session | Usable for qualitative review; **insufficient** alone for production-artifact gate |
| Analyzer `gap_class` conflicts with replay | Trust current featured-bundle replay; escalate row to human review — analyzer does not auto-correct |
| Privacy concern in export (unexpected PII) | Halt analysis; delete local copies per retention rules; do not commit anything |
| Tester withdraws consent | Delete maintainer copies of export and derived outputs; remove from aggregate |

Content or search **implementation** decisions require a separate Phase 7I/7J (or later) review packet — not analyzer output alone.

---

## Definition of sufficient evidence

The following baseline must be **met and documented** before proposing product-triage conclusions that could lead to a production review artifact. Meeting the threshold does **not** auto-approve any candidate row or bundle change.

| Criterion | Requirement |
|-----------|-------------|
| Independent sessions | At least **3** independent opt-in tester sessions (distinct exports or distinct session-bucket evidence in v2 logs) |
| Schema quality | Predominantly **v2** logs, **or** a written explanation of v1 limitations (no reliable session-bucket dedupe) |
| Natural misses | Evidence of **natural source-side misses** (not probe-only no-hits) |
| Query shape breadth | At least one natural **phrase-like or multi-token** query |
| Direction breadth | At least one **target-side** query (`target_to_source`) |
| Cross-session signal | At least one **repeated query across distinct sessions** (same normalized case/direction intent, different session buckets) |
| Cohort purity | **No** known smoke/developer probes in the product-triage aggregate |
| Manual review | Manual review of **every P1/P2 candidate** and **every `true_dictionary_entry_gap` candidate** |

If any criterion is unmet, analysis may continue for learning, but maintainers must label conclusions as **preliminary** and must not pass the production-artifact approval gate.

---

## References

- `docs/PHASE_7K_QUERY_EVIDENCE_GOVERNANCE.md` — maintainer decision document and approval gate
- `docs/PHASE_7K_QUERY_EVIDENCE_PLAN.md` — schema and pipeline overview
- `docs/PHASE_7K_TRACK_B_QUERY_EVIDENCE_ANALYZER_PLAN.md` — analyzer outputs and invariants
- `docs/PHASE_6C_TESTER_PACKET.md` — consumer UX testing messages (complementary; does not replace cohort rules)
