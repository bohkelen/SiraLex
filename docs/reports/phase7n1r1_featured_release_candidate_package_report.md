# Phase 7N1R1 — Featured Release Candidate Package

> **PRODUCT2E-A supersession (2026-08-25):** This report remains the durable record of the
> Phase 7N1R1 package build. Classification now:
> **`HISTORICAL_PHASE7N1R1_DEVICE_VALIDATION_CANDIDATE`**.
> It wraps then-featured `bundle_full_20260710_337619ff` (now previous featured / rollback).
> Repository featured after PRODUCT2D is `bundle_noncommercial_dfd5ba62`. Statements below that
> say “current featured” or “only primary identity for remaining 7N1 work” are **true of R1
> time**, not of post-PRODUCT2D repository state. Device matrix evidence was never executed
> (`not_run`). A new package must be built before validating current featured via the manual route.

## Decision

```text
FEATURED_RELEASE_PACKAGE_READY
```

*(Decision at R1 time: package ready for then-featured 7N2B. Not a claim that the package
remains current-featured after PRODUCT2D.)*

One immutable primary release-candidate `.siralex.zip` was generated from the
then-featured bundle directory, verified, and recorded. Deterministic
rebuild produced a byte-identical archive with the same package SHA-256.
Product behavior, catalog, bundle payloads, runtime, installer, verifier,
search, lexical data, and package format were not modified.

---

## 1. Purpose

Establish exactly one Phase 7N1 release-candidate package identity for all
remaining device evidence, closing the R0 blocker
`DEVICE_GATE_BLOCKED_BY_MISSING_PACKAGE`.

Input reconciliation: `docs/reports/phase7n1r0_current_featured_device_gate_reconciliation.md`.

---

## 2. Source identity

| Field | Value |
|---|---|
| Featured selector | `web/.env.production` → `VITE_FEATURED_BUNDLE_ID=bundle_full_20260710_337619ff` |
| Bundle directory | `web/public/bundle_full_20260710_337619ff` |
| Bundle ID | `bundle_full_20260710_337619ff` |
| Bundle content SHA-256 | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| Catalog version | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` |
| Catalog content SHA-256 match | yes (identical to manifest) |
| Records SHA-256 | `sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90` |
| Search-index SHA-256 | `sha256:55bf98fc99a592f7003aa338fc7b4790bc9cd642b676c99a725d83a5f9ca79e3` |
| Bundle payload mutated? | **No** |

---

## 3. Generation

| Field | Value |
|---|---|
| Generation timestamp | 2026-07-23 18:08:25 EDT |
| git commit at generation | `6ce089186a79fb970c2fd519a0bae8895f4a59a8` |
| branch | `feat/phase-2.0.5-offline-pwa` |
| Builder environment | Linux 6.8.0-117-generic; Python 3.10.12; `siralex-api` 0.1.0 |
| Candidate output root | `build/phase7n1r1_featured_rc_20260723_180825` |
| Package format version | `siralex_bundle_package_v1` |

### Commands (exact)

```bash
pip install -e ./api

CANDIDATE_ROOT="build/phase7n1r1_featured_rc_20260723_180825"
FEATURED_BUNDLE_DIR="web/public/bundle_full_20260710_337619ff"
mkdir -p "$CANDIDATE_ROOT/packages"

siralex-build-bundle verify "$FEATURED_BUNDLE_DIR"

siralex-build-bundle package \
  --bundle-dir "$FEATURED_BUNDLE_DIR" \
  --output "$CANDIDATE_ROOT/packages/bundle_full_20260710_337619ff.siralex.zip"
```

### Verification result

| Step | Result |
|---|---|
| `siralex-build-bundle verify web/public/bundle_full_20260710_337619ff` | **VALID** — `Bundle bundle_full_20260710_337619ff is VALID` |
| Package builder preflight verify + emitted-package verify | **PASS** (command completed; reported package identity) |

---

## 4. Release-candidate package identity (immutable R1 record)

| Field | Value |
|---|---|
| Package filename | `bundle_full_20260710_337619ff.siralex.zip` |
| Package path (local, untracked; under `/build/`) | `build/phase7n1r1_featured_rc_20260723_180825/packages/bundle_full_20260710_337619ff.siralex.zip` |
| Package SHA-256 | `sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0` |
| Package size (bytes) | `26171149` |
| Bundle ID | `bundle_full_20260710_337619ff` |
| Bundle content SHA-256 | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| Catalog version | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` |
| Entries | `bundle.manifest.json`, `records.jsonl`, `search_index.jsonl` |
| Published to catalog? | no (transport artifact only) |

At R1 time this was the only primary release-candidate identity for remaining
Phase 7N1 device work against then-featured 7N2B. After PRODUCT2D, treat it as
**historical** for that wrapped identity; do not retarget it as current-featured
`bundle_noncommercial_dfd5ba62`. Current-featured manual validation requires a
**new** recorded package (not created in PRODUCT2E-A).

---

## 5. Determinism

### Builder guarantee (existing implementation)

`api/bundle_builder/package_bundle.py` already documents and implements a
deterministic STORED-ZIP envelope:

- fixed entry order (`REQUIRED_PACKAGE_ENTRIES`)
- STORED (no compression) entries
- fixed ZIP timestamps `(1980, 1, 1, 0, 0, 0)`
- fixed create system / external attrs / flag bits
- no package-format changes in this slice

### Reproducibility demonstration (this slice)

| Build | Package SHA-256 | Byte length |
|---|---|---|
| Primary | `sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0` | `26171149` |
| Immediate rebuild | `sha256:f27530705132bf0fb81628f129d49d985b8456b63734bfbb93a966ded7c143b0` | `26171149` |

```text
cmp -s primary rebuild → PASS (byte-identical)
```

Rebuild artifact removed after confirmation; only the primary package file is
retained locally under the candidate root.

**Determinism verification:** PASS — same input → identical output.

---

## 6. Identity records updated (docs only)

| Document | Update |
|---|---|
| `docs/PHASE_7N1_RELEASE_DECISION.md` | Candidate identity retargeted to 7N2B package; rationale/follow-ups updated; candidate-identity conditional checkbox marked recorded |
| `docs/reports/phase7n1_slice5_device_evidence_record.md` | Primary candidate table + build commands retargeted; historical 7J identity retired |
| `docs/PHASE_7N_DEVICE_VALIDATION_CHECKLIST.md` | Featured baseline template updated to 7N2B + package SHA |
| This report | Permanent generation/verification record |

Matrix status remains `not_run`. Release status remains
`not_ready_for_validation` (no device execution in R1).

---

## 7. Explicit non-changes

| Area | Changed? |
|---|---|
| Bundle directory contents | No |
| `web/public/catalog.json` | No |
| Runtime / installer / verifier / search | No |
| Lexical data / source data | No |
| Package format / builder implementation | No |
| Deployment configuration | No |
| Device testing | No |

---

## 8. Decision detail

```text
FEATURED_RELEASE_PACKAGE_READY
```

Rationale:

- Featured bundle verified VALID
- Package generated and reported by current builder
- Package SHA reproduced on rebuild (`cmp` PASS)
- Exactly one primary RC identity recorded for remaining 7N1 work
- No implementation or product changes required

Not selected: `FEATURED_RELEASE_PACKAGE_BLOCKED` (determinism demonstrated).

---

## 9. Next slice

**Phase 7N1R2 — Build/record replacement package + stage invalid fixtures**
(or begin desktop control smoke if replacement is deferred until scenario B day)

Per R0 remaining path: after primary RC exists, prepare scenario B replacement
(distinct `bundle_id`) and local invalid fixtures, then desktop control + Android
+ iPhone matrix execution. No roadmap/Phase 8 work.

---

## 10. Confirmation

R1 created/updated only documentation identity records and generated an
untracked local package under `/build/`. No runtime, catalog, bundle payload,
source, test, package-format, or deployment changes.
