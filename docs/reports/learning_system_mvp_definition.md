# Learning System MVP Definition

## Decision

```text
LEARNING_SYSTEM_MVP_DEFINED
LEARNING_SYSTEM_MVP_OWNER_REFINED
```

Planning / product-definition only. No runtime, UI, storage schema code,
catalog, bundles, source data, tests, or packages are changed by this
document. Morphological Intelligence and Pronunciation and Audio are **not**
part of this MVP. Teacher mode, classroom sync, and cloud accounts are
**not** part of this MVP.

Authoritative prior decision:
`docs/reports/next_product_milestone_learning_system_direction.md`
(`NEXT_PRODUCT_MILESTONE_LEARNING_SYSTEM_SELECTED`).

### Owner refinements preserved in this definition

Three decisions are treated as stable product principles:

1. **The dictionary remains the lexical authority.** The Learning System is a
   personal overlay, not a second source of linguistic truth.
2. **The review model stays intentionally simple.** No spaced repetition,
   gamification, or quizzes beyond simple recall in the MVP.
3. **Implementation sequence is LS1 → LS2 → LS3.** Each milestone delivers
   usable value on its own.

Two architectural refinements are adopted before any implementation slice:

- The fundamental managed object is the **Learning Record** (not a loose bag
  of “saved word” attributes).
- The loop step after review is **Reflect**; “Remembered” and “Still learning”
  are reflection outcomes, not the workflow name.

---

## 1. Purpose

Define the **smallest complete Learning System** that turns SiraLex from a
reference dictionary into an offline vocabulary-learning application.

This is not a design of every learning feature. It identifies the smallest
**closed learning loop** that answers:

> How does a user go from discovering a new word to confidently remembering it?

This document marks a product transition: prior work strengthened the
**dictionary engine**; the Learning System shifts focus to the **learner’s
experience** while keeping the lexical engine as the stable foundation.

---

## 2. Current baseline (architecture context)

SiraLex today is an offline-first PWA dictionary:

| Layer | Today |
| --- | --- |
| Lexical authority | Installed dictionary bundles (`records` + `search_index`) |
| Search | Directional exactness ladder; results → entry detail |
| Offline storage | IndexedDB for bundles/registry/meta/optional query logs; localStorage for UI locale / log consent |
| Learning state | **None** — no Learning Records, review, or progress stores |

The MVP adds a **personal learning layer** on top of lookup. It does not
change lexical content, search ranking, or bundle packaging.

---

## 3. Core architectural concept — Learning Record

The Learning System manages **Learning Records**.

A Learning Record is the personal overlay attached to one dictionary entry.
The dictionary entry never changes because of learning. The Learning Record
changes as the learner progresses.

```text
Dictionary Entry
        │
        │ (authoritative lexical data — unchanged by learning)
        ▼
Learning Record
    • entry reference
    • confidence / status
    • saved timestamp
    • last reviewed
    • review count
    • (future attachments: favorite, audio progress, morphology mastery,
       teacher assignment — not MVP)
```

### Why this object matters

| Without Learning Record | With Learning Record |
| --- | --- |
| “Saved words,” confidence, timestamps, and history feel like separate features | One object owns personal state for an entry |
| Future favorites / audio / morphology / teacher fields risk attaching to lexical rows | Extensions attach to the Learning Record |
| Dictionary and learner state blur | Lexical authority and personal progress stay separated |

**Product rule:** Create or update a Learning Record when the learner saves;
never mutate dictionary bundle records for learning state.

“Saved vocabulary” in user-facing language means the learner’s set of
Learning Records. Implementation and planning should prefer the Learning
Record name so the model stays clear.

---

## 4. Primary learning loop

The MVP closed loop is:

```text
Search
  → Discover
  → Save (create Learning Record)
  → Review
  → Reflect
  → Continue
```

### Loop intent

| Step | Role |
| --- | --- |
| Search / Discover | Existing dictionary value — discovery stays search-first |
| Save | Creates a Learning Record from a resolved dictionary entry |
| Review | Practices recall against that Learning Record’s entry |
| Reflect | Learner self-assesses; MVP outcomes are **Remembered** or **Still learning** |
| Continue | Review remaining records and/or discover more words to save |

### Reflection outcomes (MVP)

“Remembered” and “Still learning” are **outcomes of Reflect**, not separate
workflow stages. Naming the step Reflect keeps room for later self-assessment
outcomes (for example “Not sure” or “Needs pronunciation practice”) without
redesigning the loop. Those additional outcomes are **not** in MVP scope.

### Why this loop (not a broader one)

- One default path from lookup to first successful recall + reflection.
- No second vocabulary system (no multi-list LMS) required to close the loop.
- No morphology or audio required to practice what the dictionary already shows.
- Favorites, recent searches, and multiple lists can accelerate the loop later;
  they are not required to complete it once.

---

## 5. User stories (MVP-essential only)

| ID | Story | Why essential |
| --- | --- | --- |
| US1 | As a learner, I can **save a word from an entry** (create a Learning Record) after search so I can study it later. | Starts the loop |
| US2 | As a learner, I can **view my Learning Records** (saved vocabulary) offline. | Makes saves useful |
| US3 | As a learner, I can **remove a Learning Record** from my collection. | Correct mistakes / declutter |
| US4 | As a learner, I can **start a simple review session** over records that are still learning. | Enables practice |
| US5 | As a learner, I can **recall a word** (prompt → reveal answer) against dictionary meaning. | Core practice |
| US6 | As a learner, I can **reflect** after recall by choosing Remembered or Still learning. | Closes confidence loop |
| US7 | As a learner, I can see **minimal progress** derived from Learning Records. | Supports return without gamification |
| US8 | As a learner, my Learning Records **persist offline across app restarts** with no network. | Offline-first constraint |

Out of MVP user stories (explicitly deferred): multi-list management, favorite
star as a separate system, recent-search browsing as a required path, streaks,
SRS scheduling, shared/classroom lists, audio playback, morphological variants,
extra reflection outcomes beyond the two MVP states.

---

## 6. MVP features

### Required

| Feature | Notes |
| --- | --- |
| Create Learning Record from entry | Save from a resolved dictionary entry after search |
| Learning Record collection | Single personal set of Learning Records |
| Remove Learning Record | Delete from the collection |
| Simple review session | Session over records with status still learning (incl. newly saved) |
| Flashcard-style recall | Show prompt side → user attempts recall → reveal answer side |
| Reflect | Two MVP outcomes after reveal: **Remembered** / **Still learning** |
| Lightweight progress | Counts derived from Learning Records (see Progress model) |
| Offline persistence | Learning Records local; works without network |
| Dictionary reopen | Open the underlying entry from a Learning Record for full gloss |

### Nice to have (same milestone family; not required to close the loop)

| Feature | Notes |
| --- | --- |
| Recently searched words | Shortcut to re-open and save; optional discovery aid |
| Favorite on Learning Record | Priority flag on the record (not a second product; not a dictionary field) |
| Session length cap | e.g. “review up to N cards” for short sessions |
| Mastered filter | Hide remembered from default list while keeping the Learning Record |
| Direction-aware prompt | Prefer source↔target prompt based on last search direction |

### Future (after MVP; not commitments of this definition)

| Feature | Notes |
| --- | --- |
| Multiple personal vocabulary lists | Beyond one Learning Record collection |
| Additional Reflect outcomes | e.g. “Not sure”; pronunciation-oriented outcomes later |
| Spaced repetition scheduling | Only if simple review proves insufficient |
| Example-sentence practice | Depends on richer lesson content later |
| Teacher mode / classroom workflows | Later possibilities; attach to Learning Records if ever built |
| Export/import of Learning Records | Multi-device / backup — owner decision later |
| Morphological Intelligence | Approved roadmap; attach mastery to Learning Record later — not MVP |
| Pronunciation and Audio | Approved roadmap; attach audio progress to Learning Record later — not MVP |

---

## 7. Storage model (user-owned offline data)

Conceptual model only — no schema or API design here.

### Fundamental unit: Learning Record

Durable fields conceptually owned by each Learning Record:

| Field | Purpose |
| --- | --- |
| Entry reference | Stable link to the dictionary entry (lexical authority stays in the bundle) |
| Status / confidence | MVP: `still_learning` \| `remembered` |
| Saved timestamp | When the Learning Record was created |
| Last reviewed | When the learner last reviewed this record |
| Review count | Lightweight practice signal |
| Bundle context | Learning remains meaningful relative to the installed bundle identity |

Progress aggregates are **derived** from the Learning Record collection (stored
or computed — implementation choice later).

### Useful but not required for loop closure

| Data | Purpose |
| --- | --- |
| Recently searched words | Revisit discovery; nice-to-have (may sit outside Learning Records) |
| Favorite flag | Optional field **on** the Learning Record; nice-to-have |

### Identity rules (product constraints)

- Learning Records **reference** dictionary entries; they do not copy or invent
  lexical content as authority.
- References must remain meaningful relative to the **installed bundle** the
  user studied against. Exact key fields are an implementation concern later.
- Learning Records are **user-owned and device-local** for MVP. No cloud account.
- Optional query logs already in the app are **not** Learning Records; they
  must not be treated as vocabulary authority or demand evidence.

### Explicitly not stored in MVP

- Spaced-repetition interval math beyond simple Reflect outcomes
- Social / shared list state
- Teacher assignments
- Audio assets or pronunciation metadata
- Achievements, streaks-as-product, leaderboards

---

## 8. Review model

Keep the first review experience intentionally simple.

### Session shape

1. User opens **Review**.
2. App builds a queue from Learning Records with status **still learning**
   (including newly saved records that have never been reviewed).
3. For each card:
   - Show a **prompt** (one side of the pair — typically the form the user is
     practicing from).
   - User attempts recall mentally (no typing required for MVP).
   - User **reveals** the answer (gloss / counterpart from the dictionary entry).
   - User **Reflects**: chooses **Remembered** or **Still learning**.
4. Session ends when the queue is empty or the user stops.

### Rules (MVP)

| Rule | Choice |
| --- | --- |
| Algorithm | **No spaced repetition.** Order may be stable or lightly shuffled; do not introduce SRS intervals. |
| Scope | Global Learning Record collection, filtered to still learning. |
| Pass criteria | Reflect is self-assessment only — no auto-scoring, no quiz timer. |
| Still learning | Record stays in the review pool. |
| Remembered | Record leaves the default review pool; remains in the collection unless removed. |
| Empty state | If nothing to review, prompt the user to search and save (create Learning Records). |
| Dictionary trust | Answer side comes from the installed dictionary entry display — Learning does not invent glosses. |

### Non-goals for review

- Multi-choice quizzes, typing drills, cloze tests
- Adaptive difficulty engines
- Audio-first cards
- Lesson units or curricula

---

## 9. Progress model

Minimum progress that **helps learning**, not entertainment.

### Show

| Signal | Intent |
| --- | --- |
| Learning Records saved | Size of personal vocabulary collection |
| Still learning | How many remain in the review pool |
| Remembered | How many Reflect outcomes are confident |
| Last reviewed (optional) | Encourages return without a streak product |

### Do not show in MVP

- Streaks as a primary mechanic
- Points, XP, levels, badges, leaderboards
- Daily goals with punishment UX
- Charts beyond simple counts

Progress answers: *Do I have Learning Records to practice, and am I moving any
to remembered?* — nothing more.

---

## 10. Success criteria

### Learner success

- User can complete the full loop: discover → save → review → reflect → continue.
- User can **build a personal vocabulary collection** of Learning Records.
- User has a reason to **return after the initial search** (records waiting).
- User can **review that collection offline** and update Reflect outcomes.
- User can retain a useful personal set without network.
- Lookup remains fast; learning actions do not replace search as the primary
  discovery path.

### Product / release readiness (definition level)

| Criterion | Pass condition |
| --- | --- |
| Closed loop | All Required features above are present and usable offline |
| Persistence | Learning Records survive app restart without network |
| Authority | Dictionary remains sole lexical engine; no invented senses |
| Scope discipline | Explicit exclusions below are not shipped as MVP |
| No network dependency | Save / list / review / reflect / progress work offline after dictionary install |

### Non-criteria for MVP

- Improved morphological recall or fuzzy search
- Pronunciation quality
- Classroom adoption metrics
- Multi-device sync rates

---

## 11. Explicit exclusions

Do **not** include in the Learning System MVP:

| Exclusion | Notes |
| --- | --- |
| Pronunciation / audio | Future roadmap item |
| Morphological Intelligence | Future roadmap item |
| AI tutoring | Out of product scope for MVP |
| Quizzes beyond simple recall | No multi-choice / timed tests |
| Teacher mode | Later possibility only |
| Classroom synchronization | Later possibility only |
| Cloud accounts | Device-local personal layer |
| Social features | Sharing, follows, comments |
| Achievements / leaderboards | Gamification excluded |
| Spaced repetition engine | Not necessary for first closed loop |
| Multiple vocabulary lists | Defer past one Learning Record collection |
| Extra Reflect outcomes beyond two MVP states | Flexibility reserved; not implemented yet |
| Full LMS / lesson curricula | Explicit anti-goal |
| Reopening Phase 7N / 7N1 device-matrix as Learning work | Separate tracks |

---

## 12. Relationship to the dictionary

| Concern | MVP stance |
| --- | --- |
| Lexical engine | Dictionary bundles + search remain authoritative |
| Learning System | Personal overlay of Learning Records: save, review, reflect, progress |
| Content creation | Learning does not add lemmas, senses, or examples |
| Search workflow | Unchanged as discovery path; Save creates a Learning Record on entry |
| Bundles / catalog | Unchanged content distribution; Learning Records are not catalog data |
| Offline-first | Dictionary install still required for content; Learning Records also offline |
| Provenance | Dictionary provenance rules unchanged; Learning Records are preference/progress |

```text
[ Catalog / Bundle install ]
        ↓
[ Dictionary search + entry display ]  ← lexical authority (unchanged)
        ↓
[ Learning Record layer: save / review / reflect / progress ]  ← personal only
```

---

## 13. Risks

| Risk | Why it matters | Mitigation in this definition |
| --- | --- | --- |
| Feature creep | Direction boundary is wider than a closed loop | Required vs nice-to-have vs future split; one Learning Record collection |
| Excessive complexity | SRS, multi-list, analytics delay value | Explicit no-SRS review; counts-only progress; Reflect kept to two outcomes |
| Turning MVP into a full LMS | Teacher/classroom/lessons absorb the milestone | Listed as exclusions / later possibilities only |
| Reducing lookup speed | Learning UI competes with search-first UX | Learning actions attach to entry / collection / review; search stays primary |
| Orphaned references | Bundle update/removal breaks Learning Record links | Product rule: records reference installed dictionary identity; handle missing entries gracefully in later implementation |
| Confusing logs with learning | Query logs mistaken for vocabulary | Keep Learning Records separate from optional query logs |
| Scope bleed into morphology/audio | Attractive adjacent work | Named future roadmap; blocked from MVP; future fields attach to Learning Record, not dictionary |
| Starting with flashcards before collection quality | Review depends on a usable saved set | LS1 answers collection first; LS2 adds review |

---

## 14. Recommended implementation milestones

Each milestone should ship a usable product improvement. No code in this
document — sequencing only.

**Build Learning Records first — not flashcards first.** Review quality depends
on the quality of the personal collection.

### LS1 — Learning Records (personal vocabulary collection)

**Guiding question:** Can the user build a personal vocabulary collection?

**Outcome:** User can create Learning Records from entries, view the
collection, remove records, offline.

**Delivers:** US1–US3, US8 (partial: Learning Record persistence).

### LS2 — Review & Reflect

**Guiding question:** Can the user review that collection?

**Outcome:** User can run a simple flashcard review and Reflect with
Remembered / Still learning.

**Delivers:** US4–US6, US8 (review + Reflect persistence on Learning Records).

### LS3 — Progress & Return Surface

**Outcome:** Minimal progress counts visible; clear empty states that send
users back to search or review; optional nice-to-haves only if they do not
expand scope (e.g. recently searched).

**Delivers:** US7; closes MVP success criteria for return habit.

### Gate between milestones

Do not start LS2 until LS1 is usable offline — the review experience depends
entirely on the Learning Record collection. Do not treat nice-to-haves as
blockers for declaring the MVP loop complete after LS2+LS3 Required items.

Suggested planning label continuation:

```text
LS-MVP → LS1 / LS2 / LS3
```

---

## 15. Answers to prior open product questions

Mapped from
`docs/reports/next_product_milestone_learning_system_direction.md` §11:

| Question | MVP answer |
| --- | --- |
| Primary user journey | Search → Discover → Save → Review → Reflect → Continue |
| Minimum feature set | Required table in §6 |
| Storage model | Device-local Learning Records (§7) |
| Review-session behavior | Simple queue; Reflect self-assessment; no SRS (§8) |
| Success criteria | §10 |
| Additional exclusions | §11 (incl. SRS, multi-list, gamification, extra Reflect outcomes) |
| Roadmap reorder triggers | Only with new owner evidence; morphology/audio stay after Learning unless owner reorders |

Remaining implementation-level choices (exact prompt side, card shuffle,
missing-entry UX after bundle change, exact Learning Record key fields) are
deferred to LS1–LS3 design slices — not blockers for this definition.

---

## 16. Validation note

Documentation-only change. Validate with `git diff --check`,
`git diff --name-status`, and `git status --short`. No runtime, catalog,
bundle, source, test, or package changes.

---

## Summary

| Field | Value |
| --- | --- |
| Decision labels | `LEARNING_SYSTEM_MVP_DEFINED` + `LEARNING_SYSTEM_MVP_OWNER_REFINED` |
| Fundamental object | Learning Record (personal overlay on a dictionary entry) |
| Closed loop | Search → Discover → Save → Review → Reflect → Continue |
| Reflect outcomes (MVP) | Remembered \| Still learning |
| Required core | Learning Record collection + simple flashcard review + Reflect + minimal counts + offline persistence |
| Not in MVP | Morphology, audio, SRS, teacher/classroom, cloud, social, gamification, multi-list LMS |
| Implementation sequence | LS1 Learning Records → LS2 Review & Reflect → LS3 Progress |
| Code / data changes | None |
