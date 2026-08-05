# UX2I7B — CF2 Search Feedback Consumer Visual Migration

## 1. Decision

```text
UX2I7B_CF2_CONSUMER_EXPERIENCE_IMPLEMENTED
```

## 2. BASE_COMMIT

```text
c6864f3ae10557418556bd96efac24984e42902e
```

Verified at slice start as `c6864f3` — “Fix UX2 correction conditional fields”.

## 3. Pre-flight

```text
HIGH_RISK_FILES_EXPECTED_TO_CHANGE: NONE
```

Presentation-only edit surface:

```text
web/src/render/render_search_feedback_capture.ts
web/src/render/render_search_feedback_management.ts
web/src/style.css
web/src/i18n.ts (Back / privacy / local-only copy EN/FR)
web/e2e/ux2_search_feedback.spec.ts
web/package.json (test:e2e:ux2-search-feedback)
```

Left unchanged: search feedback types/validator/store/export/package, FH1 transport, Search algorithms, query logging, CF1.

## 4. Capture

- Root `search-feedback-capture ux2-search-feedback-capture`; UX2 page title + editorial search-evidence / privacy / fields / actions
- Existing IDs preserved (`#search-feedback-capture-*`, counters, busy, stale, success)
- Hierarchy: heading → immutable query → secondary direction/result-state → optional meaning/details → local-authority copy → Save/Cancel
- Privacy remains prominent; success copy still states local / not sent / does not change dictionary
- Stable text-control sync (CF2I6A caret) unchanged
- Entry CTAs unchanged: Report this search / Tell us what you were looking for

## 5. Management

- Root `search-feedback-manage ux2-search-feedback-manage`
- Editorial list rows (hairline dividers; no card wall)
- Provenance remains `<details>` secondary
- Export + Send for review controls preserved with UX2 button classes
- Handoff confirm visual polish; IDs and privacy/destination copy unchanged in semantics
- Back label: `← Back to More` / `← Retour à Plus` (routing unchanged)

## 6. Export + FH1

`siralex_search_feedback_v1` package/export/handoff semantics untouched. Draft remains `draft`. Send does not claim received/submitted.

## 7. Conditional visibility (UX2I7A1 lesson)

Author `display:flex` on fields accompanied by `[hidden] { display: none !important; }` safeguard.
E2E asserts Playwright `not.toBeVisible()` and computed `display === "none"` on field-error nodes.

## 8. Visual system

Existing UX2 tokens only. No gradients/glass/new icon library. Bound reading width; 44px controls; EN/FR.

## 9. High-risk behavioral files changed

```text
NONE
```

## 10. Unexpected changes / scope deviations

```text
NONE
```

## 11. Tests

| Suite | Result |
|-------|--------|
| Focused CF2 renderer units | PASS (9) |
| Unit suite | **863 passed**; **9** known `query_log_store` baseline failures |
| Requested regression E2Es | PASS |
| `test:e2e:ux2-search-feedback` | PASS (4/4 after UX2I7B1) |
| `test:e2e:search-feedback` | PASS (7/7) |
| `test:e2e:handoff` | PASS (2/2) |
| `test:e2e:ux2-search` | PASS (2/2) |
| `test:e2e:ux2-more` | PASS (2/2) |
| `test:e2e:ux2-corrections` | PASS (4/4) |
| `test:e2e:theme` | PASS (3/3) |
| Build | PASS |
| git diff --check | PASS |

## 12. Visual evidence

```text
data/local_evidence/ux2_search_feedback/2026-08-05T23-32-35-466Z/
```

### Evidence matrix (UX2I7B1)

```text
mobile-light-no-result-feedback.png
viewport: 390x844
surface: CF2 capture (Report this search)
theme: light
result_state: no_result

mobile-light-results-not-useful-feedback.png
viewport: 390x844
surface: CF2 capture (Report this search)
theme: light
result_state: results_not_useful

mobile-dark-search-feedback.png
viewport: 390x844
surface: CF2 capture (Report this search)
theme: dark
result_state: no_result

mobile-light-search-feedback-management.png
viewport: 390x844
surface: CF2 management (Search feedback)
theme: light
result_state: n/a (list)

desktop-light-search-feedback.png
viewport: 1280x800
surface: CF2 capture (Report this search)
theme: light
result_state: results_not_useful

desktop-dark-search-feedback.png
viewport: 1280x800
surface: CF2 capture (Report this search)
theme: dark
result_state: no_result

desktop-light-search-feedback-management.png
viewport: 1280x800
surface: CF2 management (Search feedback)
theme: light
result_state: n/a (list)

desktop-light-search-feedback-handoff-confirm.png
viewport: 1280x800
surface: CF2 FH1 handoff confirm
theme: light
result_state: n/a
```

PNG pixel widths match the named class (mobile width 390; desktop width 1280). Full-page captures may exceed viewport height.

## 13. Final decision

```text
UX2I7B_CF2_CONSUMER_EXPERIENCE_IMPLEMENTED
```

---

# UX2I7B1 — CF2 Visual Evidence Integrity Fix

## Decision

```text
UX2I7B1_CF2_VISUAL_EVIDENCE_FIXED
```

## Defect

`mobile-light-results-not-useful-feedback.png` was previously captured at desktop `1280×800` without a mobile viewport switch.

## Fix

Dedicated mobile results-not-useful E2E path at `390×844`. Desktop test no longer writes any `mobile-*` artifact. Viewport asserted before each named screenshot.

## Behavior

```text
CF2 behavior changed: NO
High-risk files changed: NONE
```

## Final decision

```text
UX2I7B1_CF2_VISUAL_EVIDENCE_FIXED
```
