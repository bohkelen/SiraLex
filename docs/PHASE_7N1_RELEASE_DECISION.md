# Phase 7N1 Release Decision — Manual Package Import Gate

**Status:** `not_ready_for_validation`  
**Scope:** single-file `.siralex.zip` manual-install route (Slice 4 UI + Slice 3A/3B pipeline)  
**Does not authorize production release:** this document records governance state only  
**Companion:** `docs/PHASE_7N1_DEVICE_ACCEPTANCE_PROTOCOL.md`, `docs/reports/phase7n1_slice5_device_evidence_record.md`

---

## Decision status vocabulary

Allowed values:

```text
not_ready_for_validation
in_device_validation
blocked
conditional_release_candidate
approved_for_limited_field_validation
approved_for_release
rejected
```

**Current status:** `not_ready_for_validation`

**Why:** Phase 7N1R1 recorded one immutable release-candidate `.siralex.zip` wrapping the current featured 7N2B bundle (`bundle_full_20260710_337619ff`). No human tester has begun the real-device matrix. Release status remains `not_ready_for_validation`.

Advance to `in_device_validation` only after a reproducible candidate is built, recorded in the evidence file, and a human tester begins the device matrix.

**Identity provenance:** Phase 7N1R1 (`docs/reports/phase7n1r1_featured_release_candidate_package_report.md`) retires the stale Phase 7J package identity from the original Slice 5 record. Do not use the old 7J package SHA for remaining Phase 7N1 device evidence.

---

## Candidate identity

| Field | Value |
|---|---|
| Recorded? | yes |
| Primary `bundle_id` | `bundle_full_20260710_337619ff` |
| Primary `content_sha256` | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| Featured catalog version | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` |
| Package filename | `bundle_full_20260710_337619ff.siralex.zip` |
| Package SHA-256 | `sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0` |
| Package byte length | `26171149` |
| git commit at build | `6ce089186a79fb970c2fd519a0bae8895f4a59a8` |
| Evidence record link | `docs/reports/phase7n1_slice5_device_evidence_record.md` |
| R1 package report | `docs/reports/phase7n1r1_featured_release_candidate_package_report.md` |
| Provenance | Package constructed as a deterministic STORED-ZIP transport envelope around the exact currently featured logical bundle (`VITE_FEATURED_BUNDLE_ID=bundle_full_20260710_337619ff`). Records, index, manifest identity, and content hash were not regenerated or altered. |

---

## Validation matrix summary

Source of truth: `docs/reports/phase7n1_slice5_device_evidence_record.md`

| Scenario group | Desktop | Android | iPhone | Gate impact |
|---|---|---|---|---|
| A — first valid install | `not_run` | `not_run` | `not_run` | release-blocking |
| B — valid replacement | `not_run` | `not_run` | `not_run` | major |
| C — offline persistence | `not_run` | `not_run` | `not_run` | release-blocking |
| D — invalid structure | `not_run` | `not_run` | `not_run` | release-blocking |
| E — integrity mismatch | `not_run` | `not_run` | `not_run` | release-blocking |
| F — same-file retry | `not_run` | `not_run` | `not_run` | release-blocking |
| G — concurrency protection | `not_run` | `not_run` | `not_run` | release-blocking |
| H — three-file fallback | `not_run` | `not_run` | `not_run` | release-blocking |
| I — file-picker behavior | `not_applicable` | `not_run` | `not_run` | major |

**Matrix completion:** 0% — no executed device evidence

---

## Known issues

| Issue ID | Class | Severity | Environment | Disposition | Status |
|---|---|---|---|---|---|
| *(none recorded)* | | | | | `not_run` |

---

## Release-blocking criteria (mechanical)

Do **not** set status to `conditional_release_candidate`, `approved_for_limited_field_validation`, or `approved_for_release` if any required environment shows:

- [ ] valid package cannot be installed on Android Chrome
- [ ] valid package cannot be installed on iPhone Safari
- [ ] installed dictionary fails after offline restart
- [ ] invalid or integrity-failed package changes active dictionary state
- [ ] same-file retry fails
- [ ] a second write can begin while one is in progress
- [ ] legacy three-file fallback is broken
- [ ] candidate identity cannot be reproduced

All boxes remain unchecked — validation not started.

---

## Conditional release criteria

Required before any approval status:

- [ ] all required environments have completed evidence
- [ ] all blocker scenarios pass
- [ ] all major issues have explicit accepted disposition
- [x] candidate package identity is recorded
- [ ] offline persistence passes on Android and iPhone
- [ ] release decision signed by designated project owner

Device-evidence boxes remain unchecked; candidate identity recorded in Phase 7N1R1.

---

## What does not count as validation evidence

- unit tests
- Vitest/jsdom tests
- `npm run build`
- desktop-only testing
- screenshots without candidate identity
- unverified install claims

---

## Decision record

| Field | Value |
|---|---|
| Decision status | `not_ready_for_validation` |
| Decision owner | |
| Decision date | |
| Decision rationale | Phase 7N1R1 established the immutable featured release-candidate package for `bundle_full_20260710_337619ff` (package SHA-256 `sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0`). No human tester has begun the real-device matrix. Release status remains not_ready_for_validation. |
| Follow-up items | Build/record replacement package for scenario B if needed; transfer the recorded 7N2B package to real devices; execute Android and iPhone matrix; attach evidence; review blockers. |
| Rollback / recovery note | No package release authorized. Existing catalog and featured bundle paths unchanged. Invalid package attempts must leave prior active dictionary intact per Slice 4 behavior. |

---

## Integrity claim (release copy boundary)

Approved release messaging may state that `.siralex.zip` packages are **structurally and content-consistency verified** at install time.

Approved release messaging must **not** claim publisher authentication, code signing, or protection against malicious senders.

---

## Related governance (unchanged by this gate)

| Document | Role |
|---|---|
| `docs/PHASE_7N_RELEASE_PLAN_TEMPLATE.md` | Search/data intervention releases (separate track) |
| `docs/PHASE_7N_INTERVENTION_REVIEW_PACKET.md` | Bounded search intervention proposals |
| `shared/specs/phase7n_candidate_decision_v1.md` | Phase 7N intervention decision schema |
| `web/public/catalog.json` | Featured catalog install path (unchanged by Slice 5A) |

---

## Sign-off

| Role | Name | Date | Status approval |
|---|---|---|---|
| Project owner | | | not signed |
| Device validation lead | | | not signed |

**Automatic release approval:** prohibited by this document.
