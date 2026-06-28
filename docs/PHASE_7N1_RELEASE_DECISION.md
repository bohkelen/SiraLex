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

**Why:** Slice 5A establishes protocol and evidence templates only. No candidate package identity is recorded and no real-device evidence rows are `passed`. Documentation work alone cannot advance this gate.

Advance to `in_device_validation` only after a reproducible candidate is built, recorded in the evidence file, and a human tester begins the device matrix.

---

## Candidate identity

| Field | Value |
|---|---|
| Recorded? | no |
| Primary `bundle_id` | |
| Primary `content_sha256` | |
| Package filename | |
| Package SHA-256 | |
| git commit at build | |
| Evidence record link | `docs/reports/phase7n1_slice5_device_evidence_record.md` |

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
- [ ] candidate package identity is recorded
- [ ] offline persistence passes on Android and iPhone
- [ ] release decision signed by designated project owner

All boxes remain unchecked.

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
| Decision rationale | Protocol and evidence templates created in Slice 5A; device matrix not executed. |
| Follow-up items | Build recorded candidate; execute device matrix; attach evidence; review blockers. |
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
