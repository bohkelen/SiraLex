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

**Why:** A reproducible candidate package has been built and recorded from the exact currently featured logical bundle. No human tester has begun the real-device matrix. Release status remains `not_ready_for_validation`.

Advance to `in_device_validation` only after a reproducible candidate is built, recorded in the evidence file, and a human tester begins the device matrix.

---

## Candidate identity

| Field | Value |
|---|---|
| Recorded? | yes |
| Primary `bundle_id` | `bundle_full_20260616_phase7j_alias_round2_candidate` |
| Primary `content_sha256` | `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef` |
| Package filename | `bundle_full_20260616_phase7j_alias_round2_candidate.siralex.zip` |
| Package SHA-256 | `sha256:d8273a18b739b8f0c165335dd104f944cb4079ed826a54f43b28d77ba26f7903` |
| git commit at build | `befccc6ddec2a06dba5f609cfd20df067764f646` |
| Evidence record link | `docs/reports/phase7n1_slice5_device_evidence_record.md` |
| Provenance | Package constructed as a deterministic STORED-ZIP transport envelope around the exact currently featured logical bundle. Records, index, manifest identity, and content hash were not regenerated or altered. |

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
| Decision rationale | A reproducible candidate package has been built and recorded from the exact currently featured logical bundle. No human tester has begun the real-device matrix. Release status remains not_ready_for_validation. |
| Follow-up items | Transfer the recorded featured-bundle package to real devices; execute Android and iPhone matrix; attach evidence; review blockers. |
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
