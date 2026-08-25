# LX1A — Learning Experience Audit

## 1. Decision

```text
LX1A_LEARNING_EXPERIENCE_AUDIT_COMPLETE
```

Audit only. No runtime, UI, schema, IndexedDB, dictionary, corpus, index,
search, CF1/CF2, or AL1 changes. No Learning Record field additions. No
spaced-repetition implementation.

Key framing:

```text
AL1 is paused until real failed-search evidence exists.
LX1 asks whether a learner can use SiraLex every day to build Maninka vocabulary.
```

Product question:

> Can a learner actually use this app every day to build Maninka vocabulary?

Target loop:

```text
search → understand → save → review → remember → reuse
```

Current shipped loop (LS1–LS3 + LP1 + UX2 polish):

```text
search → open lexicon entry → save → saved/progress → review (reveal → reflect) → return
```

---

## 2. Base commit

```text
feb36e57a28bbf4365dfc712dec233a5251f7973
```

`git log -1`: `feb36e5 Define governed alias append write contract`.

Working tree at audit start:

```text
?? web/scripts/
```

(`web/scripts/` remains excluded local tooling; not part of LX1A.)

---

## 3. Why LX1 now

SiraLex already has search, saved vocabulary, review/reflect, corrections,
search-failure feedback, dictionary updates, learning backup, and (paused)
alias governance. Lexical and governance depth is strong. Daily learner value
is thinner: the app is still primarily a lookup tool with a personal overlay,
not yet a retention habit.

AL1D1–D6 closed a governed alias path, but without real failed-search evidence
further AL1 infrastructure is the wrong product investment. LX1 audits the
existing Learning System before building the next retention slice.

---

## 4. Existing Learning System baseline

| Milestone | Status | Capability |
|-----------|--------|------------|
| LS1 | Closed | Learning Record persistence; Save/Unsave on lexicon entry detail; Saved Vocabulary list |
| LS2 | Closed | Review queue; Reveal → Reflect (`still_learning` / `remembered`); offline persistence |
| LS3 | Closed | Derived Progress & Return cues on Saved |
| LS4 | Defined, deferred | Guided Review Sessions (status-filtered queues) — not implemented (`pd0`) |
| LP1 | Closed | Local Learning backup / restore (`siralex_learning_backup_v1`) |
| UX2I5A / UX2I5B / UX2I6B2 | Closed | Saved / Review / Manage Learning Data consumer redesign |

Authority invariant (unchanged):

```text
Installed dictionary = lexical truth.
Learning Record = personal overlay only.
Learning never mutates records.jsonl / search_index / aliases.
```

Primary destinations (no SPA routes): `search | saved | review | more`
(`web/src/render/render_primary_navigation.ts`).

---

## 5. Answers to audit questions

### 5.1 What can the user save?

| Can save | Cannot save |
|----------|-------------|
| Genuine dictionary `lexicon_entry` only (`ir_kind === "lexicon_entry"`) | Search query strings, `index_mapping` rows, arbitrary translation pairs, phrases as first-class learning objects |

**UI entry:** Save / Unsave on **entry detail** (`#entry-learning-save`), after opening a real lexicon entry from Search. Not offered on search-result rows alone.

**Identity:** `(bundle_id, ir_id)`. First Save wins; re-Save is a no-op for an existing row.

**Where saved items appear:** Primary nav **Saved** → `showSavedVocabulary()`; open row → entry detail (can Unsave); Remove on list with confirm.

### 5.2 What metadata is stored?

IndexedDB: `siralex_db` store `learning_records` (keyPath `[bundle_id, ir_id]`, index `by_bundle_id`).

Schema: `learning_record_v1` (`web/src/learning/learning_record_types.ts`):

| Field | Role |
|-------|------|
| `schema_version` | `"learning_record_v1"` |
| `bundle_id`, `ir_id` | Identity |
| `ir_kind` | Always `"lexicon_entry"` |
| `content_sha256`, `storage_scope_id` | Resolution stamps (not identity) |
| `status` | `"still_learning"` \| `"remembered"` |
| `created_at` | Save ISO timestamp |
| `display_cache` | Offline/orphan list fallback (`headword_latin`, optional `headword_nko`, `gloss_short`) |
| `last_reviewed` | `string \| null` — last successful Reflect |
| `review_count` | Non-negative int; +1 per successful Reflect |

No separate Review/Flashcard store. Session state is ephemeral in memory.

Derived (not stored): **never reviewed** = `review_count === 0 && last_reviewed === null` (new saves still have `status: "still_learning"`).

**Absent fields (relevant to LX1):** `next_review_at`, due interval, ease/streak, language-pair tag, lookup-mode at save, known/unknown labels, mastery score.

### 5.3 Can saved words be reviewed?

**Yes.** Entry points:

1. Primary nav **Review** → `showReviewSurface()`
2. Saved **Start / Continue Review** → same path
3. Completion **Review again**

**Flow:** Load active-bundle queue → show headword (+ N’Ko / POS) → **Reveal** meaning from **live entry only** (never `display_cache`) → Reflect → advance. Queue is snapshotted at load. Soft orphans / unresolved rows are excluded from Review but may remain on Saved.

**Queue order** (`review_queue.ts`): never-reviewed → reviewed `still_learning` → reviewed `remembered`; then oldest `created_at` / `last_reviewed`; tie-break `bundle_id`, `ir_id`.

### 5.4 Is there spaced repetition?

**No.** Explicitly rejected in Learning MVP / LS2 / LSN0–LSN1 for the shipped system. No due dates, intervals, Leitner, SM-2, reminders, or notifications.

`last_reviewed` and `review_count` are history counters only — not a schedule.

LS4 is status filters only (and still deferred) — also not SRS.

### 5.5 Can users mark known / unknown?

**Not those labels.** Reflect outcomes:

| Persistence | Review buttons (EN) | Saved / Progress labels |
|-------------|---------------------|-------------------------|
| `still_learning` | **Not yet** | Still learning |
| `remembered` | **Got it** | Remembered |

Also: derived **not reviewed**; **Remove** deletes the Learning Record (from Saved list, not as a first-class in-Review outcome).

Docs: `remembered` ≠ mastered; reversible. Internal inconsistent-field handling is not shown as a user “unknown” control.

### 5.6 Can they filter by language pair?

**No** learning filters by language pair or lookup mode.

- Saved / Review = **active bundle only**.
- Lookup mode affects Search and Saved gloss *presentation* preference; it is not stored on the Learning Record.
- Review reveal shows FR and EN glosses when present.
- LS4 status filters (not reviewed / still learning / remembered) = defined, deferred.

### 5.7 Can they see progress?

**Yes, on Saved** — derived counts only (`saved_vocabulary_progress.ts`):

- Saved, Not reviewed, Still learning, Remembered
- Unavailable (soft orphans, if any)
- Start vs Continue CTA; return cues: `review_new` / `review_still_learning` / `review_again` / `none`

No Progress store, charts, streaks, percentages, “due today”, or “reviewed this week”.

**Continue ≠ resume:** Continue starts a **fresh** full-queue session, not a mid-session resume.

### 5.8 Can they export / backup learning data?

**Yes — LP1 closed.** More → Manage Learning Data.

| Capability | Detail |
|------------|--------|
| Export | All Learning Records → `siralex_learning_backup_v1` JSON (`.siralex-learning-backup.json`) |
| Restore | Validate → preview → **Add missing** or **Replace all** (Replace needs confirm) |
| Scope | Learning only — not dictionary / query logs / corrections / CF drafts |
| Offline | Export + restore verified offline |

### 5.9 What breaks offline?

**Works offline** (after dictionary install): Save, list, open, remove, Review/Reflect, Progress, LP1 export/restore, reload persistence (LS1/LS2/LS3/LP1 E2E).

| Situation | Effect |
|-----------|--------|
| No active / installed dictionary | Saved/Review/Save unavailable |
| Soft orphan (entry gone / bundle mismatch / hash update) | Row may remain with cache; **excluded from Review** |
| Other-bundle records while another bundle is active | Not listed until that bundle is active |
| Catalog / new dictionary install | Network |
| Clear site data without backup | Learning lost until LP1 restore |

### 5.10 What is confusing in the UI?

From code/docs (not new usability research):

1. **Not yet / Got it** vs **Still learning / Remembered** — intentional wording split; same outcomes.
2. New save: stored `status: still_learning` but Progress shows **Not reviewed** until first Reflect.
3. **Continue** does not resume a paused session — it rebuilds the full queue.
4. Dual Review entry (nav + Saved CTA); Back from Review → Saved.
5. Review nav remains available when the queue is empty.
6. Cannot Save from search results — must open a real lexicon entry.
7. Soft orphans: “Unavailable in this dictionary” — kept but not reviewable.
8. `remembered` reads stronger than the product claim (soft self-assessment, not mastery).

---

## 6. Gap analysis vs daily learner loop

| Loop step | Status today | Gap for daily habit |
|-----------|--------------|---------------------|
| **Search** | Strong | — |
| **Understand** | Strong (entry detail) | — |
| **Save** | Works | Friction: save only from entry detail, not results |
| **Review** | Works (full queue) | No “due today”; no status-scoped session (LS4 deferred); Remove not in-session |
| **Remember** | Self-assessment only | No schedule that brings words back before forgetting |
| **Reuse** | Reopen from Saved / search again | No reuse prompts, contextual revisit, or practice-from-context |
| **Protect state** | LP1 backup closed | — |

Honest verdict:

```text
SiraLex already has a lightweight learning loop (LS1–LS3).
It does not yet create daily retention pressure.
The missing product is habit + memory scheduling, not another governance layer.
```

Largest product gaps for everyday Maninka vocabulary building:

1. **No due / spaced schedule** — Review is “everything eligible,” not “what I should see today.”
2. **Progress is orientation, not a habit coach** — counts without due/week signals.
3. **Save friction** — discovery → save requires entry open.
4. **Label / outcome clarity** — Known / Still learning / Remove (as proposed for LX1B) is clearer than the current dual vocabulary, but the underlying two-state Reflect already exists.
5. **LS4 selective queues** remain deferred; may become unnecessary if LX1C due-scheduling replaces the need for manual status filtering.

---

## 7. Relationship to proposed LX1B–D

Owner-proposed track (post-audit builds):

| Slice | Intent | Relation to shipped system |
|-------|--------|----------------------------|
| **LX1B — Saved Word Review Queue** | Save → Review → Known / Still learning / Remove | **Mostly exists as LS2.** LX1B should not rebuild Review. If accepted later, treat as a **loop clarity / outcome UX** slice: align labels, ensure Remove-from-learning is first-class where needed, and make Review the daily primary habit surface — without schema/SRS. |
| **LX1C — Lightweight Spaced Repetition** | Simple intervals (1d / 3d / 7d / 30d) | **Net-new.** Requires schedule fields and due queue. Largest daily-value leap. Keep non-Anki. |
| **LX1D — Learning Progress Dashboard** | Saved / Due today / Known / Still learning / Reviewed this week | **Partially exists as LS3.** “Due today” and “Reviewed this week” need LX1C (or at least review timestamps used as week windows). Prefer enhancement of Saved Progress over a separate dashboard product. |

Recommended sequencing after LX1A acceptance:

```text
LX1A (this audit) → LX1B only if UX clarity gaps are confirmed as blocking
                 → LX1C as the first true retention upgrade
                 → LX1D as Progress enrichment once due-state exists
```

Do **not** auto-start LS4I1. LS4 remains deferred unless real use proves selective status queues are needed after LX1C.

Do **not** resume AL1 infrastructure in parallel unless real failed-search evidence arrives.

---

## 8. Authority and offline boundaries (LX1 must preserve)

| Layer | Role |
|-------|------|
| Dictionary bundle | Lexical authority |
| Learning Record | Personal overlay only |
| Backup package | User-owned local copy of learning state |
| CF1 / CF2 | Feedback evidence — not learning truth |
| Aliases / supplements | Reviewed search metadata — out of LX1 scope |

Offline-first: any LX1B–D feature must work offline after dictionary install, degrade gracefully without an active bundle, and must not require accounts/cloud.

No hardcoding of linguistic assumptions into learning scheduling (intervals are product policy, versioned/configurable if introduced — not buried magic in UI strings alone).

---

## 9. Key file map

| Path | Role |
|------|------|
| `web/src/learning/learning_record_types.ts` | Schema + validation |
| `web/src/learning/learning_record_store.ts` | IDB CRUD + Reflect |
| `web/src/learning/entry_learning_session.ts` | Entry Save/Unsave |
| `web/src/learning/saved_vocabulary_session.ts` | List / remove |
| `web/src/learning/saved_vocabulary_progress.ts` | Progress derivation |
| `web/src/learning/review_queue.ts` | Queue build + eligibility |
| `web/src/learning/review_session.ts` | Ephemeral session |
| `web/src/learning/learning_backup_*.ts` | LP1 pipeline |
| `web/src/render/render_saved_vocabulary.ts` | Saved + Progress UI |
| `web/src/render/render_review.ts` | Review UI |
| `web/src/render/render_learning_backup.ts` | Manage Learning Data |
| `docs/reports/learning_system_mvp_definition.md` | Original MVP loop |
| `docs/reports/ls1|ls2|ls3_*_closure_report.md` | Milestone closures |
| `docs/reports/ls4d0_*` / `pd0_*` | Guided Review deferred; LP1 selected |
| `docs/reports/lp1_*` | Backup/restore |

---

## 10. Recommended next slice (after acceptance)

```text
Do not implement LX1B/C/D in this audit.
```

After LX1A acceptance, the highest-value **product** follow-up is expected to be either:

1. **LX1B (narrow)** — clarify Review outcomes / daily entry if owner confirms UX friction, **or**
2. **LX1C (preferred retention leap)** — lightweight spaced repetition on existing Learning Records,

with LX1D following once due-state exists.

Explicit non-goals until owner directs otherwise:

- AL1D7 write mode
- LS4I1 Guided Review implementation
- Anki clone / gamification / cloud sync / teacher mode
- Automatic dictionary mutation from learning behavior

---

## 11. Success criteria for this slice

| Criterion | Result |
|-----------|--------|
| Audit answers all listed learner-loop questions | PASS |
| Documents shipped LS1–LS3 + LP1 honestly | PASS |
| Identifies gaps vs daily retention | PASS |
| Maps LX1B–D without pretending Review is absent | PASS |
| No code / schema changes | PASS |
| AL1 remains paused; LS4 remains deferred | PASS |

```text
LX1A_LEARNING_EXPERIENCE_AUDIT_COMPLETE
```
