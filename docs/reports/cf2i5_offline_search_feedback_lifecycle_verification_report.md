# CF2I5 — Offline Search Feedback Lifecycle Verification Report

## 1. Decision

```text
CF2_OFFLINE_SEARCH_FEEDBACK_LIFECYCLE_VERIFIED
```

Chromium Playwright and supporting Vitest evidence show CF2 works as a complete
local evidence loop in the browser—including offline use—without converting
unmet-search evidence into dictionary truth or community submission.

---

## 2. Verification scope

Verification-only slice. No new CF2 product fields. No community/server
submission. No Playwright-driven product changes. Bounded harness fixes only.

---

## 3. Product claim under test

> A user can deliberately preserve an unmet search need as local evidence,
> manage and export it offline, retain its original dictionary provenance
> across bundle lifecycle changes, and do so without changing dictionary
> authority or coupling CF2 to query logs, CF1, or Learning.

---

## 4. Environment

| Item | Value |
| --- | --- |
| OS | Linux (`linux` / `Linux x86_64`) |
| Browser | Playwright Chromium (`@playwright/test` 1.61.1; headless shell chromium-1228) |
| Browser UA (recorded) | Chrome/149.0.7827.55 (Playwright Linux Chromium) |
| Preview URL | `http://127.0.0.1:4173` (vite preview after `npm run build`) |
| Spec | `web/e2e/search_feedback_lifecycle.spec.ts` |
| Script | `npm run test:e2e:search-feedback` |
| Vitest lifecycle | `web/src/search_feedback/cf2i5_offline_search_feedback_lifecycle_verification.test.ts` |

---

## 5. Build identity

| Item | Value |
| --- | --- |
| Branch | `feat/phase-2.0.5-offline-pwa` |
| Base (CF2I4) | `9a6f456` |
| Verification commit | (this CF2I5 commit) |
| App package version | `0.0.0` (`web/package.json`) |
| Build | `npm run build` (tsc + vite + PWA generateSW) PASS |

---

## 6. Bundle identity

| Field | Value |
| --- | --- |
| Fixture | `web/public/debug-bundles/test_directional_bundle` |
| `bundle_id` | `bundle_full_20260418_e1c98a70` |
| `content_sha256` | `sha256:e1c98a70d17d67436f434d229ac50c5d8ddff5737a0a1aa0dd3e32307aef6a31` |
| `storage_scope_id` | `bundle_full_20260418_e1c98a70::sha256:e1c98a70…` |
| No-result probe | `zzzz_cf2_nohit` |
| Results probe | `alpha_fr` |

---

## 7. Scenario matrix

| Scenario | Layer | Status |
| --- | --- | --- |
| Online create → manage → edit → export → reload → delete | Playwright | PASS |
| No-result capture | Playwright | PASS |
| Results-not-useful capture | Playwright | PASS |
| Offline create → manage → edit → export → reload | Playwright | PASS |
| Offline shell reload | Playwright | PASS |
| Reload persistence (hard reload) | Playwright | PASS |
| Bundle removal retention + unavailable | Playwright | PASS |
| Bundle update H1→H2 content differs | Vitest | PASS |
| Bundle update UI path | Browser | NOT_APPLICABLE |
| Database deletion reminder | Playwright | PASS |
| Duplicate create/edit save | Playwright | PASS |
| Stale capture after new search | Playwright | PASS |
| Stale edit/delete | Vitest (session) | PASS |
| Query-log isolation (off/on) | Playwright | PASS |
| CF1 / Learning / dictionary isolation | Vitest | PASS |
| EN full lifecycle | Playwright | PASS |
| FR smoke | Playwright | PASS |
| Accessibility smoke | Playwright | PASS |
| Network isolation (offline) | Playwright | PASS |
| Community/server non-goal | Playwright | PASS |
| Export artifact structural inspection | Playwright + `parseSearchFeedbackJson` | PASS |

Status vocabulary: `PASS` / `FAIL` / `BLOCKED_EXTERNAL` / `NOT_APPLICABLE`.

---

## 8. Online lifecycle

**Path:** install debug dictionary → no-result search → Report → Save → Manage
Search Feedback → detail → Edit notes → Save → Export all → hard reload →
Delete.

**Observed:** Complete UI loop works. One draft; export download; persistence
across reload; empty after delete.

**Status:** PASS

---

## 9. No-result path

Real search `zzzz_cf2_nohit`; zero-result CTA; exact query on form; Save creates
one draft with `result_state=no_result`, `result_count=0`, no `matched_ir_ids`;
local-only success copy; Back to search restores surface.

**Status:** PASS

---

## 10. Results-not-useful path

Real search `alpha_fr` (≥1 result); bottom-of-results Report CTA only (no
per-result control); draft `result_state=results_not_useful`,
`result_count` matches visible result rows, `matched_ir_ids` present ≤25.

**Status:** PASS

---

## 11. Offline lifecycle

After shell + dictionary available: `context.setOffline(true)` → reload →
search → report → save → manage → edit → export → offline reload → feedback
persists.

Conservative claim:

```text
Core CF2 operations operate without a remote network dependency once the
application shell and dictionary are locally available.
```

Do **not** claim zero HTTP requests.

**Status:** PASS

---

## 12. Offline reload

Hard reload while offline; Manage Search Feedback still lists the draft.

**Status:** PASS

---

## 13. Export inspection

Downloaded artifact reparsed with production `parseSearchFeedbackJson`.

| Field | Observed |
| --- | --- |
| Filename pattern | `siralex-search-feedback-YYYY-MM-DDTHH-MM-SSZ.json` |
| Byte length (sample) | 1039 |
| `package_schema` | `siralex_search_feedback_v1` |
| `authority_label` | `unreviewed_search_failure_feedback_must_not_be_treated_as_missing_entry_truth` |
| `feedback_count` | 1 |
| Provenance | debug bundle id / H1 hash / scope retained |
| `query_raw` | `zzzz_cf2_nohit` |
| `result_state` / `result_count` | `no_result` / `0` |
| `matched_ir_ids` | absent |
| Notes | multiline + N’Ko retained |
| CF1 / Phase 1.5 / query-log / Learning / account fields | absent |

**Status:** PASS

---

## 14. Bundle removal

Create against H1 → Remove bundle via product UI → Manage Search Feedback still
reachable → `dictionary_unavailable` → edit/export/delete still work →
export retains H1 `content_sha256`.

**Status:** PASS

---

## 15. Bundle update

Browser H1→H2 UI path: **NOT_APPLICABLE** (fixture lacks second-hash update
seam; same strategy as CF1I5).

Executable Vitest
`cf2i5_offline_search_feedback_lifecycle_verification.test.ts`:

- retained H1 hash + scope
- `dictionary_content_differs`
- no automatic resolved state
- edit/export keep H1 provenance

**Status:** Vitest PASS / browser NOT_APPLICABLE

---

## 16. Database deletion reminder

0 CF2 → reminder hidden → create → visible → edit/export still visible →
delete last → hidden → recreate → clear database → reminder hidden.
Independent of Learning and CF1 reminders.

**Status:** PASS

---

## 17. Duplicate suppression

Rapid double Save on capture and edit via sync double-dispatch → one draft /
one update (browser). Supporting controller coalescing covered by CF2I3/I4
Vitest.

**Status:** PASS (browser + Vitest)

---

## 18. Stale capture

Search A → open capture → new search B → Save blocked / form disposed → 0 new
draft; no retargeting.

**Status:** PASS

---

## 19. Stale edit/delete

Browser harness injection for external mutation not used.
Supporting executable evidence:
`search_feedback_management_session.test.ts` stale edit/delete paths.

**Classification:** Vitest PASS (not browser)

---

## 20. Query-log isolation

Logging OFF: CF2 save does not change query-log count.
Logging ON (Diagnostics panel opened; consent accepted): search may log; CF2
save/manage/export do not add rows.

**Status:** PASS

---

## 21. CF1 isolation

Vitest seeds one CF1 draft; CF2 create/edit/export/delete leave CF1 count
unchanged. Export contains no CF1 fields.

**Status:** PASS (Vitest)

---

## 22. Learning isolation

Vitest seeds one Learning Record; CF2 lifecycle leaves Learning + query-log +
records/index counts unchanged. Export excludes Learning data.

**Status:** PASS (Vitest)

---

## 23. Dictionary isolation

CF2-only mutations do not alter records / search_index / registry (except when
the test deliberately removes a bundle). Separated in evidence from explicit
dictionary lifecycle ops.

**Status:** PASS

---

## 24. Network evidence

Offline CF2 path recorded request lines. Success did not require remote
endpoints. Observed traffic classified as same-origin preview shell
(`127.0.0.1:4173`) when present. No upload/submit/community/moderator endpoint.

**Status:** PASS (conservative; not “zero HTTP”)

---

## 25. Community/server non-goal

CF2 capture/manage UI contains no Submit / Send / Send to community / Publish
actions. Export remains local Blob download.

**Status:** PASS

---

## 26. EN/FR

EN: full lifecycle through UI.
FR smoke: no-result CTA, capture form, save, Manage labels, export warning,
delete confirmation — primary controls do not fall back to English.

**Status:** PASS

---

## 27. Accessibility

Smoke only (not WCAG claim): capture heading focus; invalid form error-summary
focus; success heading focus; management heading focus; keyboard open detail;
labeled edit fields; delete confirm dialog focus; N’Ko retained in notes.

**Status:** PASS (smoke)

---

## 28. Defects found

None classified as `PRODUCT_DEFECT`.

---

## 29. Harness fixes

| Issue | Class | Fix |
| --- | --- | --- |
| Rapid double Save detached button / unstable click | HARNESS_DEFECT | Sync double `HTMLElement.click()` dispatch |
| Delete regex matched `#clearDb` (“Delete database”) | HARNESS_DEFECT | Scope Delete to manage root; exact names |
| Query-logging toggle inside closed `<details>` | HARNESS_DEFECT | Open Diagnostics details before click |

---

## 30. Supporting focused tests

Focused Vitest (search_feedback + isolation-related): **13 files / 143 tests**
PASS, including:

- CF2I1–I4 model/store/capture/manage/export suites
- `cf2i5_offline_search_feedback_lifecycle_verification.test.ts` (3)
- CF1I5 lifecycle + correction store + learning persistence (isolation support)

---

## 31. E2E results

```text
npm run test:e2e:search-feedback
→ 7 passed (Chromium)
```

Evidence overall_status: PASS  
Run id example: `cf2i5_2026-08-03T14-46-00-319Z`

---

## 32. Full test baseline

```text
npm run test:run
→ Test Files  79 passed (79)
→ Tests       794 passed (794)
```

(Previous CF2I4 baseline: 78 files / 791 tests; CF2I5 adds the lifecycle Vitest file.)

---

## 33. Build

```text
npm run build
→ PASS (tsc + vite + PWA generateSW)
```

---

## 34. Evidence path

```text
data/local_evidence/cf2_offline_lifecycle/<run_id>/
  summary.json
  browser_metadata.json
  console.txt
  network.json
  screenshots/   (empty unless failure)
  downloads/exported-search-feedback-package.json
```

Gitignored via `data/*`. Not repository pollution.

---

## 35. Deviations

- Browser H1→H2 marked `NOT_APPLICABLE`; Vitest covers exact hash-mismatch retention.
- Stale edit/delete classified as Vitest evidence (session tests), not browser injection.
- CF1/Learning isolation demonstrated primarily via Vitest with meaningful seeded rows.

---

## 36. Files changed — exact A/M/D list

Generated after CF2I5 commit from:

```bash
git diff --name-status 9a6f456..HEAD
```

```text
Files changed
-------------
A  docs/reports/cf2i5_offline_search_feedback_lifecycle_verification_report.md
M  docs/ROADMAP.md
A  web/e2e/search_feedback/evidence.ts
A  web/e2e/search_feedback_lifecycle.spec.ts
M  web/package.json
A  web/src/search_feedback/cf2i5_offline_search_feedback_lifecycle_verification.test.ts
```

---

## 37. Untracked files

```text
Untracked files: none
```

Gitignored evidence under `data/local_evidence/cf2_offline_lifecycle/` is present
locally and correctly excluded by `.gitignore` (`data/*`).

---

## 38. Repository hygiene

- No production runtime changes.
- No secrets / user data committed.
- Evidence path gitignored.
- Working tree clean after commit.

---

## 39. Next slice

```text
CF2I6 — Search Feedback Closure
```
