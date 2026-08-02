# CF1I5 — Offline Correction Lifecycle Verification Report

## 1. Decision

```text
CF1_OFFLINE_CORRECTION_LIFECYCLE_VERIFIED
```

Executable Playwright and Vitest evidence covers the correction lifecycle as a
real offline product flow. No new product scope was added. Defects discovered
during verification were bounded harness/test issues only (export chrome on
detail, Delete role ambiguity, IndexedDB delete timing).

---

## 2. Commit/build identity

| Item | Value |
| --- | --- |
| Branch | `feat/phase-2.0.5-offline-pwa` |
| Verification commit | (this CF1I5 commit) |
| App package version | `0.0.0` (`web/package.json`) |
| Build | `npm run build` (tsc + vite + PWA generateSW) |

---

## 3. Test environment

| Item | Value |
| --- | --- |
| OS | Linux |
| Browser | Playwright Chromium (`web/playwright.config.ts`) |
| Base URL | `http://127.0.0.1:4173` (vite preview) |
| Spec | `web/e2e/correction_lifecycle.spec.ts` |
| Vitest lifecycle | `web/src/corrections/cf1i5_offline_correction_lifecycle_verification.test.ts` |
| Script | `npm run test:e2e:corrections` |

---

## 4. Test dictionary identity

| Field | Value |
| --- | --- |
| Fixture | `web/public/debug-bundles/test_directional_bundle` |
| `bundle_id` | `bundle_full_20260418_e1c98a70` |
| `content_sha256` | `sha256:e1c98a70d17d67436f434d229ac50c5d8ddff5737a0a1aa0dd3e32307aef6a31` |
| Lexicon probe | `alpha_mnk` / `diag_lex_alpha` |

---

## 5. Lifecycle matrix

| Scenario | Layer | Status |
| --- | --- | --- |
| Online create → manage → edit → export → reload → delete | Playwright | PASS |
| Offline create → manage → edit → export → reload | Playwright | PASS |
| Offline shell reload | Playwright | PASS |
| Reload persistence (hard reload) | Playwright | PASS |
| Bundle removal retention + unavailable | Playwright | PASS |
| Bundle update H1→H2 content differs | Vitest | PASS |
| Database deletion reminder | Playwright | PASS |
| Export artifact structural inspection | Playwright + CF1I1 parser | PASS |
| Duplicate create/edit save | Playwright | PASS |
| Stale host after navigate/bundle remove | Playwright + Vitest CF1I3A | PASS |
| EN complete lifecycle | Playwright | PASS |
| FR smoke lifecycle | Playwright | PASS |
| Accessibility smoke | Playwright | PASS |
| Network isolation (offline) | Playwright | PASS |

Status vocabulary used: `PASS` / `FAIL` / `BLOCKED_EXTERNAL` / `NOT_APPLICABLE` / `NOT_RUN`.

Browser bundle-update UI path: `NOT_APPLICABLE` (no second-hash fixture seam).
Executable Vitest covers H1→H2 retention and neutral `dictionary_content_differs`.

---

## 6. Online create/manage/edit/export

**Precondition:** Fresh app; debug dictionary installed; EN locale.

**Action:** Suggest → fill issue/target/description/proposal → Save → Manage
Corrections → detail → Edit → Save changes → Export → reload → Delete.

**Expected:** One draft; export download; draft persists across reload; empty
after delete.

**Observed:** As expected. Filename
`siralex-correction-feedback-YYYY-MM-DDTHH-MM-SSZ.json`.

**Status:** PASS

**Evidence:** Playwright test 1; `exported-correction-package.json` under evidence run.

---

## 7. Offline create/manage/edit/export

**Precondition:** Dictionary + shell ready; SW controller waited when available;
`context.setOffline(true)`.

**Action:** Offline reload → open entry → create → manage → edit → export →
offline reload → list still present.

**Expected:** No remote dependency; draft available offline.

**Observed:** PASS for create/manage/edit/export and offline reload persistence.
Offline shell reload PASS in this harness.

**Status:** PASS

---

## 8. Reload persistence

**Precondition:** Draft created and edited online.

**Action:** Hard `page.reload`.

**Expected:** List and updated description remain.

**Observed:** Updated multiline/N’Ko description retained.

**Status:** PASS

---

## 9. Bundle removal

**Precondition:** Draft against installed bundle A.

**Action:** Remove bundle via installed-catalog Remove → Manage Corrections.

**Expected:** Draft retained; provenance unchanged; dictionary unavailable;
snapshot readable; user text editable; retarget unavailable; export succeeds
with original hash.

**Observed:** As expected.

**Status:** PASS

### High-risk path — availability after removal

```ts
// correction_management_session.ts
export function deriveCorrectionAvailability(draft, installed, live) {
  if (!installed) return "dictionary_unavailable";
  if (installedHash && installedHash !== draft.content_sha256) {
    return "dictionary_content_differs"; // neutral; does not imply draft is wrong
  }
  if (!live || live.ir_kind !== "lexicon_entry") return "entry_unavailable";
  return "matching_live_content";
}
```

---

## 10. Bundle update/hash mismatch

**Precondition:** Draft stamped with H1.

**Action (Vitest):** Install meta/records at H2 for same logical bundle_id.

**Expected:** Draft retained with H1 provenance; availability
`dictionary_content_differs`; no retarget; export contains H1.

**Observed:** As expected.

**Status:** PASS (Vitest). Browser UI update path NOT_APPLICABLE for this fixture.

---

## 11. Database deletion reminder

| Step | Expected | Observed | Status |
| --- | --- | --- | --- |
| 0 drafts | correction reminder hidden | hidden | PASS |
| create draft | reminder visible; Learning reminder independent | visible / Learning hidden | PASS |
| edit | reminder remains | remains | PASS |
| export | reminder remains | remains | PASS |
| delete last | reminder hidden | hidden | PASS |
| create → Delete database | drafts = 0; reminder hidden | cleared | PASS |

---

## 12. Export artifact inspection

Reparsed with production `parseCorrectionFeedbackJson`:

| Check | Result |
| --- | --- |
| `package_schema === siralex_correction_feedback_v1` | PASS |
| `authority_label` exact machine label | PASS |
| `draft_count` exact | PASS |
| Provenance fields preserved | PASS |
| Unicode / N’Ko / multiline preserved | PASS |
| No Phase 1.5 / query logs / Learning / account fields | PASS |

---

## 13. Duplicate activation

| Action | Expected | Observed | Status |
| --- | --- | --- | --- |
| Rapid double Save on form | one draft | count === 1 | PASS |
| Rapid double Save changes on edit | one update | count === 1; text updated once | PASS |

### High-risk path — create coalescing

```ts
// correction_form_controller.ts (save)
if (savePromise) return savePromise;
// ...
completedSuccessfully = true;
notifyDraftSavedOnce(); // exactly once after successful commit
```

---

## 14. Stale navigation

| Action | Expected | Observed | Status |
| --- | --- | --- | --- |
| Open form → Cancel | form disposed | form count 0 | PASS |
| Open form → remove bundle | Save unavailable; no draft | stale UI / count unchanged | PASS |
| Commit while host goes stale after write queued | draft persisted + `onDraftSaved` | Vitest CF1I3A | PASS |

### High-risk path — CF1I3A notify vs UI

```ts
// After successful createDraft:
completedSuccessfully = true;
notifyDraftSavedOnce(); // always — invalidates management generation
if (disposed || !deps.isCurrent()) return; // UI success may be suppressed
state = "saved";
emit();
```

### High-risk path — generation guard

```ts
// correction_management_session.ts
function emit(): void {
  if (disposed || !deps.isCurrent()) return;
  deps.onModel(/* snapshot */);
}
```

---

## 15. EN/FR verification

| Locale | Path | Status |
| --- | --- | --- |
| EN | Full lifecycle | PASS |
| FR | Suggest → save → Manage → export; primary controls French (no EN fallback) | PASS |

No Russian locale path.

---

## 16. Accessibility smoke

| Check | Status |
| --- | --- |
| Form heading focus on open | PASS |
| Invalid Save focuses error summary | PASS |
| Successful save focuses success heading | PASS |
| Management heading focus | PASS |
| Keyboard open row / Delete confirm / Cancel | PASS |
| `aria-busy` present on management root | PASS |

Not a full WCAG audit.

---

## 17. Network isolation

Offline context after shell ready: correction create/manage/edit/export used only
local app origin / Blob download. No remote dictionary fetch required.

**Status:** PASS

---

## 18. Evidence artifacts

Ignored by git (`data/*`). Example run:

```text
data/local_evidence/cf1_offline_lifecycle/<run_id>/
  summary.json
  browser-info.json
  exported-correction-package.json
  console.log
  network.log
  screenshots/
```

`summary.json` records commit, browser, OS, timestamp, bundle id/hash, scenario
statuses, artifact names.

---

## 19. Defects discovered

1. Export button only rendered on list/empty/exporting surfaces — detail-phase
   export clicks timed out in the first offline draft of the e2e harness.
2. `getByRole('button', { name: 'Delete' })` matched both draft Delete and
   Delete database.
3. Immediate Delete database while management load still held an IndexedDB
   connection could surface `IndexedDB delete blocked` (transient; dispose +
   retry in harness).

---

## 20. Defects fixed

All three were **test harness** fixes in `correction_lifecycle.spec.ts`
(navigate to list before export; scope Delete to management actions; dispose
management host before clearDb / retry). No production product change required
for closure.

---

## 21. Remaining blocked items

None required for closure.

Browser-only bundle-update UI remains `NOT_APPLICABLE` for this fixture; covered
by Vitest executable proof.

---

## 22. Scope confirmation

Did not add: new correction fields; import; moderation; cloud; missing-entry
feedback; Learning features; search behavior; IndexedDB schema changes;
Playwright product scope beyond verification.

---

## 23. Exact test commands/results

```text
npx vitest run src/corrections/cf1i5_offline_correction_lifecycle_verification.test.ts
→ Test Files  1 passed (1)
→ Tests  5 passed (5)

npm run test:e2e:corrections
→ 7 passed (Chromium)

Focused CF1 + Learning + query-log regressions
→ Test Files  22 passed (22)
→ Tests  258 passed (258)

npm run test:run
→ Test Files  67 passed (67)
→ Tests  698 passed (698)

npm run build
→ tsc + vite build succeeded

git diff --check
→ clean
```

### High-risk path — export order / no mutation

```ts
// correction_feedback_export.ts
const drafts = await listCorrectionDrafts(db); // one readonly snapshot
return buildCorrectionFeedbackExportArtifact(drafts, options);
// validate all → build → serialize → UTF-8 cap → reparse → artifact
// no draft row writes
```

### High-risk path — DB ownership close

```ts
async function withDb(fn) {
  let db;
  try {
    db = await deps.openDb();
    return await fn(db);
  } finally {
    closeIfOwned(db, ownership); // controller_owned closes; caller_owned does not
  }
}
```

---

## 24. Repository hygiene

Changed/added:

- `web/e2e/correction_lifecycle.spec.ts`
- `web/e2e/corrections/evidence.ts`
- `web/src/corrections/cf1i5_offline_correction_lifecycle_verification.test.ts`
- `web/package.json` (`test:e2e:corrections`)
- `docs/reports/cf1i5_offline_correction_lifecycle_verification_report.md`
- `docs/ROADMAP.md`

Evidence under `data/local_evidence/` remains gitignored.

---

## Next slice

```text
CF1I6 — Correction Feedback Closure
```
