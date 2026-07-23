# Phase 7N Device Validation Checklist

**Status:** operational checklist — documentation only  
**Audience:** maintainers running Phase 7M / Phase 7N field validation  
**Aligned with:** `docs/PHASE_7K_TRACK_C_TESTER_OPERATIONS_PACKET.md`, `docs/PHASE_6C_TESTER_PACKET.md`, `docs/PHASE_7N_INTERVENTION_REVIEW_PACKET.md`

This checklist records **field behavior** on real devices. It does not change runtime code, bundles, or catalogs.

---

## Evidence rules (read first)

### Session types

| Session type | Purpose | May influence demand ranking? |
|---|---|---|
| **Structured usability tasks** | Validate UX, direction, known cases, confusion discovery | **No** — not demand frequency |
| **Natural-use queries** | Organic lookup behavior after opt-in consent | **Yes** — primary demand signal |
| **Developer smoke testing** | Deploy health, logging, replay checks | **No** — engineering only |

**Required rule:** Only **natural-use**, **opt-in**, **consented** tester evidence may influence demand ranking or support `approve_for_workflow` on product/search interventions.

Structured usability may inform confusion or UX defects. It must **not** be counted as repeated user demand without separate natural-use corroboration.

### What never belongs in the repository

- Raw `.jsonl` exports
- Full local filesystem paths
- Session UUIDs tied to individuals
- Unreviewed production Phase 7K candidate outputs

Exports stay outside git until Phase 7K production-artifact governance gate passes.

---

## Session record (fill per device session)

| Field | Value |
|---|---|
| Checklist session ID | `phase7m_device_YYYYMMDD_NNN` |
| Date | |
| Maintainer / observer | |
| Tester label (opaque, e.g. `tester_A`) | |
| Returning or fresh user | |
| Device model | |
| OS + version | |
| Browser + version | |
| PWA installed? | yes / no |
| App URL used | |
| App version / build | |
| Collection mode | `natural_use` / `structured_usability` / `developer_smoke` |
| Cohort | `tester` / `developer` / `smoke` — product triage requires `tester` |
| Consent confirmed before logging | yes / no |
| Query logging enabled during session | yes / no |

### Exact catalog / bundle identity (required)

Record from in-app diagnostics or maintainer verification **at session start**.

| Field | Value |
|---|---|
| Featured `catalog_version` | |
| Installed `bundle_id` | |
| `norm_version` | |
| Matches `web/public/catalog.json` featured entry? | yes / no |

**Featured baseline at template time (Phase 7N1R1):**

- `bundle_id`: `bundle_full_20260710_337619ff`
- `catalog_version`: `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass`
- package release candidate: `bundle_full_20260710_337619ff.siralex.zip` (`sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0`)

---

## Tester-facing boundaries

**Do not expose to ordinary testers unless they are explicitly in the validation workflow:**

- Advanced diagnostics menus (except when tester agreed to export logs afterward)
- catalog / bundle / manifest vocabulary
- normalization ladder or `norm_v3` internals
- internal probe strings as “things the dictionary should contain”
- gap_class, matrix IDs, or miner taxonomy

Use plain-language questions from `docs/PHASE_6C_TESTER_PACKET.md` for consumer sessions.

---

## A. Install and acquisition

| # | Check | Pass? | Notes |
|---|---|---|---|
| A1 | App link opens successfully | | |
| A2 | First-run purpose understandable without maintainer explanation | | |
| A3 | **First install** — featured dictionary offered / discoverable | | |
| A4 | **Featured dictionary acquisition** completes (catalog path) | | |
| A5 | Search available immediately after install | | |
| A6 | **Manual-import fallback** (only if testing advanced path) — three-file flow works | | N/A if catalog-only session |
| A7 | No spurious duplicate bundle prompts | | |

---

## B. Persistence and offline

| # | Check | Pass? | Notes |
|---|---|---|---|
| B1 | **Offline reopen** — airplane mode or network off | | |
| B2 | Previously installed dictionary still searchable offline | | |
| B3 | **Active-bundle persistence** after reload / PWA reopen | | |
| B4 | Direction toggle state reasonable after reopen | | |

---

## C. Source-to-target search

| # | Check | Pass? | Notes |
|---|---|---|---|
| C1 | Single-word French hit (tester-chosen or structured S1) | | |
| C2 | **Plural / form search** (e.g. plural lemma if natural) | | |
| C3 | Known alias path if relevant (e.g. `fruits`) | | |
| C4 | Supplement path if relevant (e.g. `poil`, `oncle`) | | |
| C5 | **Multi-result interpretation** — user can tell what to pick | | |
| C6 | **Phrase-like miss handling** — multi-word query behavior observed | | Do not coach decomposition |
| C7 | Intentional or accidental miss behaves safely (no wild guess hits) | | |

---

## D. Target-to-source search

| # | Check | Pass? | Notes |
|---|---|---|---|
| D1 | Latin target hit (tester-chosen or structured S3) | | |
| D2 | **Accented input** (e.g. `Kùn`) | | |
| D3 | **Unaccented input** (e.g. `Kun`) — record user expectation | | Policy-sensitive |
| D4 | **NFC / NFD target-side check** — same lemma entered in composed vs decomposed form if feasible | | Compare outcomes |
| D5 | N'Ko input if tester can provide (optional) | | |

---

## E. Structured usability matrix (optional — not demand evidence)

Complete only when `collection_mode = structured_usability`. One row per check.

| Check ID | Coverage goal | Query used (session-local) | Pass? | Confusion notes |
|---|---|---|---|---|
| S1 | Known source-side hit | | | |
| S2 | Multi-hit source-side | | | |
| S3 | Target-side query | | | |
| S4 | Punctuation/diacritic variant | | | |
| S5 | Deliberate no-hit probe | | | Label as probe in provenance |
| S6 | Multi-token / phrase query | | | |

**Reminder:** S5 probes must not be promoted as dictionary gaps.

---

## F. Natural-use observation (demand-eligible when consented)

For `collection_mode = natural_use` only.

| Field | Record |
|---|---|
| Queries tried (tester report or export) | |
| Misses reported | |
| Confusing hits reported | |
| Setup friction vs search/content issues | |
| French UI naturalness issues | |

**Do not rank by raw count alone.** Classify each miss before triage.

---

## G. Opt-in logging and export handoff

| # | Check | Pass? | Notes |
|---|---|---|---|
| G1 | **Opt-in logging confirmation** — tester enabled knowingly | | |
| G2 | Logging status visible to maintainer if tester shares screen | | |
| G3 | **Export procedure** — tester can export when willing | | |
| G4 | Export stays local until voluntary share | | |
| G5 | Maintainer assigns cohort=`tester` and collection_mode on receipt | | |
| G6 | Provenance record filled (non-sensitive fields) | | |

**Export handoff (maintainer):**

1. Store file outside repository.
2. Record consent, mode, bundle/catalog identity, schema mix (v1/v2).
3. Exclude smoke/developer strings from product triage aggregate.
4. Do **not** commit raw export to git.

---

## H. Issue classification (required for actionable rows)

Use one primary class per reported issue:

| Class | Meaning |
|---|---|
| `phrase_mismatch` | Phrase behavior unlike user expectation |
| `missing_entry` | User believes dictionary lacks entry |
| `index_gap` | Likely source-index / alias / supplement gap |
| `language_mismatch` | Direction or language choice issue |
| `spelling_error` | User typo; not a product gap |
| `setup_ux` | Install, direction, or shell confusion |
| `interpretability` | Hit correct but user cannot choose among targets |
| `probe_or_test` | Deliberate test string — exclude from demand |

| Query / issue | Class | Useful? | Notes |
|---|---|---|---|
| | | useful / technically correct but confusing / not useful / uncertain | |

---

## I. Usefulness judgment (required)

For each actionable search/content issue:

```text
[ ] useful — would help real lookup
[ ] technically correct but confusing — hit exists but UX/sense choice fails
[ ] not useful — out of scope or user error
[ ] uncertain — needs more natural-use evidence
```

**Session summary usefulness judgment:**

> 

---

## J. Developer smoke (non-tester cohort)

Use only for engineering verification. **Never** merge into product triage.

| Check | Pass? |
|---|---|
| Logging toggle / export / clear | |
| Featured catalog fetch | |
| Probe queries (`zzzz-nohit-test`) remain miss | |
| Deploy URL matches expected catalog pointer | |

---

## K. Session sign-off

| Gate | Pass? |
|---|---|
| Catalog/bundle identity recorded | |
| Collection mode labeled correctly | |
| Consent confirmed (if logging) | |
| Structured vs natural-use separated in notes | |
| Issues classified | |
| No raw export committed to git | |
| Ready for Phase 7N intervention packet (if warranted) | defer / yes |

**Maintainer summary:**

> 

---

## Related documents

| Document | Role |
|---|---|
| `docs/PHASE_7K_TRACK_C_TESTER_OPERATIONS_PACKET.md` | Cohort, consent, export rules |
| `docs/PHASE_7K_QUERY_EVIDENCE_GOVERNANCE.md` | Production-artifact gate |
| `docs/PHASE_6C_TESTER_PACKET.md` | Consumer tester messaging |
| `docs/PHASE_7N_INTERVENTION_REVIEW_PACKET.md` | Escalate one bounded intervention |
| `docs/PHASE_7N1_DEVICE_ACCEPTANCE_PROTOCOL.md` | Phase 7N1 `.siralex.zip` manual-install device matrix |
| `docs/PHASE_7N1_RELEASE_DECISION.md` | Phase 7N1 package-import release gate |
| `docs/reports/phase7n1_slice5_device_evidence_record.md` | Phase 7N1 device evidence tables |
| `shared/specs/phase7n_candidate_decision_v1.md` | Record human disposition |
