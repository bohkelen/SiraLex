# PRODUCT1B — Noncommercial Distribution Compliance

## 1. Gate identity

**PRODUCT1B_NONCOMMERCIAL_DISTRIBUTION_COMPLIANCE**

**Supersedes (cancelled):** `PRODUCT1B_COMMERCIAL_PERMISSION_AND_INDEPENDENT_EVIDENCE_ROADMAP`

## 2. Why this gate exists

PRODUCT1A measured *commercial-exploitation eligibility* and correctly returned
0% commercial-safe coverage under CC BY-NC-SA Malidaba. That result is **not**
a SiraLex distribution blocker.

SiraLex is explicitly **non-commercial language infrastructure** (`README.md`).
The operational rights target is:

```text
NONCOMMERCIAL DISTRIBUTION COMPLIANCE
```

not commercial licensing or commercial-safe product construction.

## 3. Project posture (repository authority)

| Layer | License / posture |
|-------|-------------------|
| Application code | MIT OR Apache-2.0 (`LICENSE-MIT`, `LICENSE-APACHE`) |
| Malidaba-derived lexical data | CC BY-NC-SA 4.0 (`shared/sources/malipense.yaml`) |
| Owner-reviewed additions | `project-internal-review` (`shared/sources/siralex_lexical_review.yaml`) |
| Project mission | Non-commercial; no paywalls, API resale, or extractive commercialization |

**Critical distinction:** CC BY-NC-SA data inside an MIT/Apache repository does
not become MIT/Apache data. Code license and data license remain separate.

## 4. Malidaba CC BY-NC-SA obligations (distribution scope)

For Malidaba-derived material SiraLex distributes or adapts:

| Term | Obligation |
|------|------------|
| **BY (Attribution)** | Credit Valentin Vydrine / Jean-Jacques Méric / Malidaba; identify source URL |
| **NC (NonCommercial)** | Distribution and use remain genuinely noncommercial |
| **SA (ShareAlike)** | Adapted Malidaba-derived lexical data shared by SiraLex remains under CC BY-NC-SA 4.0 or compatible ShareAlike terms |

PRODUCT1B verifies these operationally in artifacts and user-facing surfaces.

## 5. Scope

PRODUCT1B is a **compliance verification and packaging gate**, not a new
linguistic acquisition slice.

### In scope

1. **Attribution surfaces**
   - README / user-facing credits
   - Bundle manifest / download metadata
   - In-app about / source credits (where applicable)

2. **Data-license notices**
   - Explicit separation: code (MIT/Apache) vs Malidaba data (CC BY-NC-SA)
   - Per-source license fields in bundle manifests
   - No implied “open source” conflation for NC-licensed data

3. **ShareAlike treatment**
   - Document which distributed artifacts are Malidaba-derived adaptations
   - Ensure distributed adapted lexical data carries CC BY-NC-SA (or compatible) notice

4. **Provenance persistence**
   - Record-level provenance survives normalize → enrich → bundle pipeline
   - Bundle downloads retain traceability to source registry entries

5. **Noncommercial posture enforcement (engineering)**
   - Verify project/README/manifest language does not authorize commercial exploitation of NC data
   - Align with G10 internal=allowed, noncommercial=requires_rights_review posture

### Out of scope

- Commercial licensing negotiation with Malidaba rights holders
- Building a commercial-safe product candidate
- Mass independent re-creation of Malidaba entries for commercial purposes
- Publication authorization (separate gate after compliance PASS)

## 6. Preconditions

| Item | Requirement |
|------|-------------|
| Base | Post-refresh canonical state committed (`88ea05ad…` or later) |
| PRODUCT1A | Rights-boundary audit machinery available (optional re-run) |
| Source registry | `shared/sources/malipense.yaml`, `siralex_lexical_review.yaml` current |
| Internal product | INTERNAL_FULL build reproducible (30/0 regression with overlay) |

## 7. Compliance checklist (PASS criteria)

PRODUCT1B **PASS** requires all of:

| # | Check | Evidence |
|---|-------|----------|
| C1 | Malidaba attribution text present in user-facing credits | README and/or in-app about |
| C2 | Data-license notice distinguishes code vs data | README + bundle manifest |
| C3 | Bundle manifest includes per-source license for `src_malipense` | `bundle.manifest.json` |
| C4 | CC BY-NC-SA ShareAlike notice on distributed Malidaba-derived payload | manifest + optional `DATA_LICENSE` file |
| C5 | Record provenance fields present in published bundle records sample | audit `records.jsonl` |
| C6 | Source registry `claimed_license` matches manifest | hash-frozen cross-check |
| C7 | No commercial-exploitation language in distribution artifacts | manifest/README audit |
| C8 | Owner source license (`project-internal-review`) separately noted where included | manifest sources block |

## 8. Known gaps (current repository)

Audit at gate definition time:

- `bundle.manifest.json` lists `sources.included` but **lacks** per-source
  `claimed_license`, attribution template, or ShareAlike notice block
- README states code/data distinction at high level; bundle-level notices not yet wired
- PRODUCT1A `NONCOMMERCIAL_CANDIDATE` profile marked `NEXT_GATE_PRODUCT1B`

These are expected PRODUCT1B implementation targets.

## 9. Deliverables

| Artifact | Role |
|----------|------|
| `docs/reports/product1b_noncommercial_distribution_compliance.md` | This gate definition + audit record |
| Bundle manifest schema extension (or companion file) | Machine-readable license/attribution |
| Compliance evaluator (optional CLI) | Deterministic C1–C8 checks |
| Tests | Manifest + provenance + notice regressions |

## 10. Success / block decisions

| Decision | Meaning |
|----------|---------|
| `PRODUCT1B_NONCOMMERCIAL_DISTRIBUTION_COMPLIANCE_READY` | All C1–C8 PASS; distribution packaging compliant |
| `PRODUCT1B_NONCOMMERCIAL_DISTRIBUTION_COMPLIANCE_BLOCKED` | Missing attribution, license notice, SA treatment, or provenance break |

## 11. Relationship to PRODUCT1A

| PRODUCT1A | PRODUCT1B |
|-----------|-----------|
| Commercial-safe projection | Noncommercial distribution compliance |
| 0% commercial-safe (expected) | Not a blocker |
| Provenance graph machinery | Reused for C5/C6 |
| Fail-closed commercial filter | Not the distribution gate |

## 12. Cancelled path

```text
PRODUCT1B_COMMERCIAL_PERMISSION_AND_INDEPENDENT_EVIDENCE_ROADMAP
  → CANCELLED
```

No Malidaba commercial-permission dossier, negotiation track, or 11k-entry
independent commercial re-creation is required for the current SiraLex roadmap.

## 13. Recommended gate after PRODUCT1B

After PRODUCT1B PASS, proceed to dictionary/corpus development and publication
readiness gates that assume **noncommercial** distribution only, unless project
posture explicitly changes.
