# CF1I3 — Entry Suggestion Surface Report

## 1. Decision

```text
CF1_ENTRY_SUGGESTION_SURFACE_IMPLEMENTED
```

Users can open **Suggest a correction** from a genuine live lexicon entry, describe
a problem, optionally propose corrected content, and save one local
non-authoritative draft through CF1I2. No Manage Corrections list, edit/delete,
export, Phase 1.5 conversion, corpus mutation, or cloud submission was added.

---

## 2. User loop

```text
genuine dictionary entry
→ Suggest a correction
→ describe the problem
→ optionally propose corrected content
→ save one local non-authoritative draft
→ return to the entry
```

---

## 3. Entry-point placement

Button `#entry-suggest-correction` on lexicon entry detail:

- after senses / core lexical content;
- before technical/debug metadata (`corpus_count`);
- separate from Learning Save controls;
- not on search rows, `index_mapping`, Review, Saved Vocabulary, or Progress.

---

## 4. Genuine-entry boundary

Action offered only when:

- `ir_kind === "lexicon_entry"` with lexicon display;
- active-bundle provenance is complete and canonical (`sha256:` + 64 hex);
- `buildCorrectionEntryContext` succeeds.

`index_mapping` and incomplete stamps never open the form.

---

## 5. Navigation

Local view-host pattern (no router):

```text
entry detail → correction form → success → Back to entry
correction form Cancel → original entry detail
```

Return uses the retained entry record + `EntryNavOrigin` without re-running search.

---

## 6. Bound entry context

```ts
CorrectionEntryContext = {
  bundle_id, ir_id, ir_kind: "lexicon_entry",
  content_sha256, storage_scope_id, entry
}
```

Captured at form open from live entry + active registry meta. Entry is cloned for
in-memory form use only; whole `EnrichedRecord` is not persisted.

---

## 7. Stale-context policy

Before save: host generation current; active bundle identity/hash/scope match;
live entry resolvable as `lexicon_entry` with same `ir_id`.

On bundle switch, hash change, removal, or host invalidation:

- Save disabled;
- neutral stale copy (`entry_context_changed`);
- Cancel/back remain available;
- no silent retarget; no provenance rewrite; no draft from snapshot alone.

---

## 8. Form fields

Issue type; target; problem description; mode; proposed value (conditional);
other-field label (conditional); Save; Cancel. No wizard, autosave, or automatic
submission.

---

## 9. Issue taxonomy labels

Stored CF1I1 enums with EN/FR UI labels only (Spelling / Orthographe, …, Other /
Autre). Localized labels are never stored.

---

## 10. Mode behavior

Default `problem_report`. Switching to `problem_report` clears proposed value
before save so hidden text cannot persist.

---

## 11. Target-option model

Built only from live entry. Always: `entry`, `headword`, `other_field`.
Conditional: POS, N’Ko, per-sense sense/translation/example/usage_note.
Structural keys (`sense:0`, `translation:0:fr`, …) map only to preconstructed
options.

---

## 12. Russian preservation boundary

`gloss_lang: "ru"` appears only when that exact live sense field exists.
No general Russian language selector or product-language support.

---

## 13. Snapshot construction

`buildCorrectionDisplaySnapshot(entry, target)` captures bounded evidence:
always `headword_latin`; optional N’Ko/POS; target-relevant selected fields.
No whole-entry serialization; no transliteration/normalization.

---

## 14. Snapshot truncation

`boundCorrectionSnapshotText` truncates by Unicode code points to CF1I1 snapshot
limits with an in-limit ellipsis. Affects evidence display only. User-authored
description/proposed value are never silently truncated.

---

## 15. Form validation

Client-side checks for issue, target, description, mode/proposed rules,
other-field label, option membership, control characters, and Unicode limits.
Store validator remains authoritative on write.

---

## 16. Whitespace/Unicode policy

`.trim()` used only for emptiness. Non-empty text preserved exactly. No line-ending
or Unicode normalization.

---

## 17. Save orchestration

Validate → verify context → busy → one `createCorrectionDraft` → await completion
→ invalidate correction-management generation seam → success with Back to entry.

---

## 18. Duplicate activation

Controller coalesces concurrent `save()` calls (`savePromise`). After success,
further Save on the same controller instance creates no second draft.

---

## 19. Error mapping

| Store code | User-facing meaning |
| --- | --- |
| invalid_input | review fields |
| invalid_timestamp | local clock error; no draft |
| id_generation_failed | secure ID unavailable; no draft |
| draft_id_conflict | retry |
| database_write_failed | local save failed; no draft |

No internal codes shown; no “server submit” wording.

---

## 20. Success copy

EN: “Correction draft saved on this device. / It has not been submitted or applied to the dictionary.”  
FR: “Brouillon de correction enregistré sur cet appareil. / Il n’a pas été envoyé ni appliqué au dictionnaire.”

---

## 21. Privacy and authority notice

Visible before Save: local draft only; no dictionary change; nothing sent online;
may later appear in an exported file; exported drafts remain unreviewed.

---

## 22. Offline behavior

Depends only on live entry, active-bundle meta, IndexedDB, and static shell.
No fetch, telemetry, or background upload.

---

## 23. Accessibility

Page heading; entry name; labeled selects; mode fieldset; counters; error summary
with field links; focus error summary after failed Save; focus success heading;
`aria-busy` while saving; Save disabled when busy/stale; Cancel available when
stale; N’Ko `lang`/`dir` where shown.

---

## 24. Localization

Dedicated `correctionFeedback.form.*` EN/FR keys. No Russian locale. French tests
do not accept English fallbacks for primary affordances.

---

## 25. Storage isolation

Successful save changes only `correction_drafts`. Records, search index, registry,
Learning, query logs, and consent are unchanged. No query-log append for form
actions.

---

## 26. Tests

Focused regressions (pre-commit):

```text
npx vitest run src/corrections src/render/render_entry \
  src/render/render_correction_form src/i18n.test.ts \
  src/learning/entry_learning_session.test.ts \
  src/learning/learning_record_persistence.test.ts \
  src/navigation
→ Test Files  15 passed (15)
→ Tests  153 passed (153)
```

Full suite:

```text
npm run test:run
→ Test Files  62 passed (62)
→ Tests  658 passed (658)
```

Build:

```text
npm run build
→ tsc + vite build succeeded
```

---


## 27. Deviations

- Automatic post-save navigation is not forced; success shows accessible heading
  plus explicit **Back to entry**.
- `correctionManagementGeneration` is an invalidation seam for CF1I4 (no Manage
  Corrections UI yet).
- Russian target label exists only to identify existing live Russian content.

---

## 28. Repository hygiene

Changed/added:

- `web/src/corrections/correction_form_model.ts` (+ tests)
- `web/src/corrections/correction_form_controller.ts` (+ tests)
- `web/src/corrections/correction_form_integration.test.ts`
- `web/src/render/render_correction_form.ts` (+ tests)
- `web/src/render/render_entry.ts` / `render_entry_correction.test.ts`
- `web/src/main.ts` (narrow host wiring)
- `web/src/i18n.ts` / `i18n.test.ts`
- `web/src/style.css`
- `docs/reports/cf1i3_entry_suggestion_surface_report.md`
- `docs/ROADMAP.md`

No IndexedDB schema bump; no CF1I1/I2 semantics change; no Learning/query-log/
Phase 1.5/corpus/Playwright/PV1/LS4 behavior changes.
