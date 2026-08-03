# CF2I6A — Feedback Renderer Input Stability Amendment

## 1. Decision

```text
FEEDBACK_INPUT_STABILITY_DEFECT_FIXED
```

Editable CF1/CF2 feedback controls no longer destroy and recreate DOM nodes on
ordinary keystrokes. Product contracts, schemas, stores, and authority models
are unchanged. CF1 and CF2 remain CLOSED.

---

## 2. Defect discovery

Immediately after CF2I6 closure, ordinary typing in search-feedback and
correction textareas was observed to lose focus after one character.

Classification:

```text
renderer lifecycle defect
```

Impact: users cannot reliably type free-form feedback.  
Authority/data semantics: unaffected.  
CF1/CF2 product contracts: unchanged.

---

## 3. User-visible impact

```text
type one character
→ focused textarea destroyed by paint()
→ cursor leaves the field
→ user must re-click to continue
```

Affected human paths: Report this search notes, Manage Search Feedback edit
notes, Suggest a correction description/proposal, Manage Corrections edit.

---

## 4. Why prior verification missed it

CF2I5/CF1I5 lifecycle suites primarily used Playwright `.fill()` and final-value
assertions. That validates state transfer, not interaction continuity.

Missing regression:

```text
nodeBefore === nodeAfter across sequential keystrokes
```

Lesson: human-style `.press()` / `.type()` testing is required alongside `.fill()`.

---

## 5. Root cause

```text
textarea input
→ controller setter
→ emit() / onModel
→ view.update(vm)
→ paint()
→ root.replaceChildren()
→ focused control destroyed
```

CF1 form partially masked the defect by restoring focus by element id after
rebuild, without preserving browser editing state (caret/IME/selection).

---

## 6. Affected surfaces

| Surface | Before | After |
| --- | --- | --- |
| CF2 capture | Full rebuild each keystroke; focus lost | Stable textareas + incremental sync |
| CF2 management edit | Full rebuild each keystroke | Stable textareas + incremental sync |
| CF1 correction form | Full rebuild; id-refocus | Stable textareas + incremental sync |
| CF1 management edit | Full rebuild each keystroke | Stable textareas + incremental sync |

---

## 7. Renderer strategy before

Every view-model emission reconstructed the entire form root via
`replaceChildren()`, recreating listeners and controls.

---

## 8. Renderer strategy after

Preferred stable-DOM / incremental update:

```text
build editing shell once
→ ordinary field emissions sync counters/errors/disabled/busy only
→ syncTextControl skips .value while control is focused
→ full replaceChildren reserved for layout transitions
  (editing ↔ saved / list ↔ detail ↔ editing)
```

Rejected approach: recreate + `focus()` + `setSelectionRange` as the normal path.

---

## 9. DOM-node stability contract

For ordinary typing:

```text
nodeBefore === nodeAfter
```

must hold for each editable control after every keystroke.

---

## 10. Focus/caret contract

While actively editing:

* focus remains on the same control;
* caret advances naturally;
* selection is not forcibly rewritten;
* controller/model sync happens behind the DOM control.

---

## 11. Composition/Unicode considerations

Skipping `.value` assignment while focused avoids disturbing IME composition and
complex-script input (including N’Ko). Unit tests type N’Ko sequences on CF2 and
CF1 surfaces.

---

## 12. CF2 capture fix

`render_search_feedback_capture.ts`: layout-gated rebuild (`editing` / `saved`);
stable meaning/details textareas; incremental counters, errors, stale/error
hosts, save/cancel busy state.

---

## 13. CF2 management fix

`render_search_feedback_management.ts`: while `phase === "editing"` for the same
`feedback_id`, sync in place; otherwise full paint.

---

## 14. CF1 correction fix

`render_correction_form.ts`: stable description/proposed/other-field controls;
proposed/other toggled via `hidden`; removed per-keystroke id-refocus.

Also amended `render_correction_management.ts` with the same stable-edit pattern
so Manage Corrections edit does not reintroduce the defect.

### Residual follow-up (same amendment)

After the first CF2I6A ship, Manage Corrections **description**
(“Décrivez le problème”) still lost focus after one character.

Second root cause (distinct from `replaceChildren`):

```text
startEdit() sets focusTarget = "heading"
→ user types in #correction-manage-description
→ syncStableEdit() re-called applyFocus("heading") on every keystroke
→ caret stolen to heading
```

CF2 manage incremental sync never re-applied focus; CF1 manage incorrectly did.
Unit coverage had masked this by forcing `focusTarget: "none"`.

Fix:

* `syncStableEdit` applies focus only for `error_summary` / `status`
* edit field setters clear `focusTarget` to `"none"` (and clear `errorCode`)
* unit test now keeps production-like `focusTarget: "heading"` across keystrokes
* Playwright human-typing covers FR suggest + manage description paths

---

## 15. Controller/schema boundaries preserved

Unchanged:

```text
CF1 draft schema
CF2 draft schema
IndexedDB
validation rules
save semantics
optimistic concurrency
authority models
export
bundle lifecycle
```

Controller `emit()` remains; renderers no longer interpret every emission as
destructive reconstruction during editing.

---

## 16. Regression tests

Unit (jsdom):

* CF2 capture node/focus/caret/N’Ko stability
* CF2 management edit dual-field stability
* CF1 correction description/proposed stability
* CF1 management edit stability

State transitions (invalid/saving/stale/success) remain covered by existing
renderer tests.

---

## 17. Browser human-typing evidence

```text
npm run test:e2e:feedback-input
→ 1 Chromium test PASS
```

Uses sequential `locator.press(...)` (not `.fill()`) on:

* CF2 capture meaning
* CF2 manage edit meaning
* CF1 suggest correction description (FR “Décrivez le problème”)
* CF1 manage edit description (FR; residual heading-focus path)

Plus lifecycle regressions:

```text
CF1I5 E2E: 7 PASS
CF2I5 E2E: 7 PASS
```

Harness note: CF1 lifecycle duplicate-Save clicks switched to sync
`HTMLElement.click()` double-dispatch (same class of detach race previously
fixed for CF2I5).

---

## 18. CF1 closure impact

```text
CF1 remains CLOSED
```

Post-closure defect amended in renderer/input lifecycle only.

---

## 19. CF2 closure impact

```text
CF2 remains CLOSED
```

Post-closure defect amended; product evidence loop semantics unchanged.

---

## 20. PV1 impact

PV1A should proceed only after this amendment. Desktop smoke against a build
where ordinary feedback typing is broken would be meaningless.

---

## 21. Deviations

* Also stabilized CF1 Manage Corrections edit (same underlying pattern), beyond
  the minimum three surfaces, to avoid shipping a known residual typing break.
* CF1 lifecycle harness duplicate-Save dispatch adjusted (HARNESS fix).

No schema/scope expansion.

---

## 22. Files changed — exact A/M/D list

Generated after commit from:

```bash
git diff --name-status aec8cc3..HEAD
```

```text
Files changed
-------------
M  docs/ROADMAP.md
A  docs/reports/cf2i6a_feedback_input_stability_amendment_report.md
M  web/e2e/correction_lifecycle.spec.ts
A  web/e2e/feedback_input_stability.spec.ts
M  web/package.json
M  web/src/render/render_correction_form.test.ts
M  web/src/render/render_correction_form.ts
M  web/src/render/render_correction_management.test.ts
M  web/src/render/render_correction_management.ts
M  web/src/render/render_search_feedback_capture.test.ts
M  web/src/render/render_search_feedback_capture.ts
M  web/src/render/render_search_feedback_management.test.ts
M  web/src/render/render_search_feedback_management.ts
```

---

## 23. Untracked files

```text
Untracked files: none
```

---

## 24. Test baseline

Recorded at amendment close:

```text
Focused renderer suites: PASS
Human-typing E2E: 1 PASS
CF1 + CF2 lifecycle E2E: 14 PASS
Full suite: (see commit validation)
Build: PASS
```

---

## 25. Build

```text
npm run build
→ PASS
```

---

## 26. Repository hygiene

- Renderer/harness/docs only for the defect class.
- No secrets.
- Working tree clean after commit.

---

## 27. Final decision

```text
FEEDBACK_INPUT_STABILITY_DEFECT_FIXED
```

Ordinary free-form feedback typing is again a continuous browser editing
session. PV1A may proceed on this amended build.
