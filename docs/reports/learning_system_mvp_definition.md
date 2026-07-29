# Learning System MVP Definition

## Decision

```text
LEARNING_SYSTEM_MVP_DEFINED
```

Planning / product-definition only. No runtime, UI, storage schema code,
catalog, bundles, source data, tests, or packages are changed by this
document. Morphological Intelligence and Pronunciation and Audio are **not**
part of this MVP. Teacher mode, classroom sync, and cloud accounts are
**not** part of this MVP.

Authoritative prior decision:
`docs/reports/next_product_milestone_learning_system_direction.md`
(`NEXT_PRODUCT_MILESTONE_LEARNING_SYSTEM_SELECTED`).

---

## 1. Purpose

Define the **smallest complete Learning System** that turns SiraLex from a
reference dictionary into an offline vocabulary-learning application.

This is not a design of every learning feature. It identifies the smallest
**closed learning loop** that answers:

> How does a user go from discovering a new word to confidently remembering it?

---

## 2. Current baseline (architecture context)

SiraLex today is an offline-first PWA dictionary:

| Layer | Today |
| --- | --- |
| Lexical authority | Installed dictionary bundles (`records` + `search_index`) |
| Search | Directional exactness ladder; results → entry detail |
| Offline storage | IndexedDB for bundles/registry/meta/optional query logs; localStorage for UI locale / log consent |
| Learning state | **None** — no saved vocabulary, review, or progress stores |

The MVP adds a **personal learning layer** on top of lookup. It does not
change lexical content, search ranking, or bundle packaging.

---

## 3. Primary learning loop

The MVP closed loop is:

```text
Search
  → Discover word (open entry)
  → Save word
  → Return later
  → Review (flashcard recall)
  → Mark remembered or still learning
  → Continue (review remaining / save more from search)
```

### Loop intent

| Step | Role |
| --- | --- |
| Search / Discover | Existing dictionary value — discovery stays search-first |
| Save | Converts a one-time lookup into owned vocabulary |
| Return later | Creates the habit reason to reopen the app |
| Review / Recall | Practices memory against the saved entry |
| Mark confidence | Closes the loop: remembered vs needs more practice |
| Continue | Keeps the set alive without requiring new content types |

### Why this loop (not a broader one)

- One default path from lookup to first successful recall.
- No second vocabulary system (no multi-list LMS) required to close the loop.
- No morphology or audio required to practice what the dictionary already shows.
- Favorites, recent searches, and multiple lists can accelerate the loop later;
  they are not required to complete it once.

---

## 4. User stories (MVP-essential only)

| ID | Story | Why essential |
| --- | --- | --- |
| US1 | As a learner, I can **save a word from an entry** after search so I can study it later. | Starts the loop |
| US2 | As a learner, I can **view my saved vocabulary** offline. | Makes saves useful |
| US3 | As a learner, I can **remove a word** from my saved vocabulary. | Correct mistakes / declutter |
| US4 | As a learner, I can **start a simple review session** over words I am still learning. | Enables practice |
| US5 | As a learner, I can **recall a word** (prompt → reveal answer) against dictionary meaning. | Core practice |
| US6 | As a learner, I can **mark a word remembered or still learning** after recall. | Closes confidence loop |
| US7 | As a learner, I can see **minimal progress** (how many saved / still learning / remembered). | Supports return without gamification |
| US8 | As a learner, my learning data **persists offline across app restarts** with no network. | Offline-first constraint |

Out of MVP user stories (explicitly deferred): multi-list management, favorite
star as a separate system, recent-search browsing as a required path, streaks,
SRS scheduling, shared/classroom lists, audio playback, morphological variants.

---

## 5. MVP features

### Required

| Feature | Notes |
| --- | --- |
| Save word from entry | From a resolved dictionary entry after search |
| Saved vocabulary list | Single personal set of saved words |
| Unsave / remove | Remove from the set |
| Simple review session | Session over “still learning” (and newly saved) words |
| Flashcard-style recall | Show prompt side → user attempts recall → reveal answer side |
| Confidence mark | Two states after reveal: **remembered** / **still learning** |
| Lightweight progress | Counts only (see Progress model) |
| Offline persistence | Learning data local; works without network |
| Dictionary reopen | Open the underlying entry from saved/review for full gloss |

### Nice to have (same milestone family; not required to close the loop)

| Feature | Notes |
| --- | --- |
| Recently searched words | Shortcut to re-open and save; optional discovery aid |
| Favorites | Priority subset within saved words (not a second product) |
| Session length cap | e.g. “review up to N cards” for short sessions |
| Mastered filter | Hide remembered from default list while keeping history |
| Direction-aware prompt | Prefer source↔target prompt based on last search direction |

### Future (after MVP; not commitments of this definition)

| Feature | Notes |
| --- | --- |
| Multiple personal vocabulary lists | Beyond one saved set |
| Spaced repetition scheduling | Only if simple review proves insufficient |
| Example-sentence practice | Depends on richer lesson content later |
| Teacher mode / classroom workflows | Later possibilities from direction doc |
| Export/import of learning data | Multi-device / backup — owner decision later |
| Morphological Intelligence | Approved roadmap; not Learning MVP |
| Pronunciation and Audio | Approved roadmap; not Learning MVP |

---

## 6. Storage model (user-owned offline data)

Conceptual model only — no schema or API design here.

### Durable learning data (must survive restarts)

| Data | Purpose |
| --- | --- |
| Saved word references | Stable links to dictionary entries the user chose to keep |
| Confidence state | `still_learning` \| `remembered` (per saved word) |
| Saved / confidence timestamps | When saved; when last marked |
| Review history (lightweight) | Enough to know a word was reviewed (e.g. last reviewed time, review count) |
| Progress aggregates | Derivable from the above; may be stored or computed |

### Useful but not required for loop closure

| Data | Purpose |
| --- | --- |
| Recently searched words | Revisit discovery; nice-to-have |
| Favorite flag | Priority within saved set; nice-to-have |

### Identity rules (product constraints)

- Learning items **reference** dictionary entries; they do not copy or invent
  lexical content as authority.
- References must remain meaningful relative to the **installed bundle** the
  user studied against (bundle identity is part of the personal layer’s
  context). Exact key fields are an implementation concern later.
- Learning data is **user-owned and device-local** for MVP. No cloud account.
- Optional query logs already in the app are **not** the Learning System;
  they must not be treated as vocabulary authority or demand evidence.

### Explicitly not stored in MVP

- Spaced-repetition interval math beyond simple confidence
- Social / shared list state
- Teacher assignments
- Audio assets or pronunciation metadata
- Achievements, streaks-as-product, leaderboards

---

## 7. Review model

Keep the first review experience intentionally simple.

### Session shape

1. User opens **Review**.
2. App builds a queue from saved words in **still learning** (including newly
   saved words that have never been reviewed).
3. For each card:
   - Show a **prompt** (one side of the pair — typically the form the user is
     practicing from).
   - User attempts recall mentally (no typing required for MVP).
   - User **reveals** the answer (gloss / counterpart from the dictionary entry).
   - User marks **Remembered** or **Still learning**.
4. Session ends when the queue is empty or the user stops.

### Rules (MVP)

| Rule | Choice |
| --- | --- |
| Algorithm | **No spaced repetition.** Order may be stable or lightly shuffled; do not introduce SRS intervals. |
| Scope | Global saved set (single list), filtered to still learning. |
| Pass criteria | User self-mark only — no auto-scoring, no quiz timer. |
| Fail / still learning | Word stays in the review pool. |
| Remembered | Word leaves the default review pool; remains in saved vocabulary unless removed. |
| Empty state | If nothing to review, prompt the user to search and save words. |
| Dictionary trust | Answer side comes from the installed dictionary entry display — Learning does not invent glosses. |

### Non-goals for review

- Multi-choice quizzes, typing drills, cloze tests
- Adaptive difficulty engines
- Audio-first cards
- Lesson units or curricula

---

## 8. Progress model

Minimum progress that **helps learning**, not entertainment.

### Show

| Signal | Intent |
| --- | --- |
| Words saved | Size of personal vocabulary |
| Still learning | How many remain in the review pool |
| Remembered | How many the user has marked confident |
| Last reviewed (optional) | Encourages return without a streak product |

### Do not show in MVP

- Streaks as a primary mechanic
- Points, XP, levels, badges, leaderboards
- Daily goals with punishment UX
- Charts beyond simple counts

Progress answers: *Do I have words to practice, and am I moving any to
remembered?* — nothing more.

---

## 9. Success criteria

### Learner success

- User can complete the full loop: discover → save → review → mark confidence.
- User has a reason to **return after the initial search** (saved words waiting).
- User can **review vocabulary offline** and update confidence.
- User can retain a useful personal set of words without network.
- Lookup remains fast; learning actions do not replace search as the primary
  discovery path.

### Product / release readiness (definition level)

| Criterion | Pass condition |
| --- | --- |
| Closed loop | All Required features above are present and usable offline |
| Persistence | Learning data survives app restart without network |
| Authority | Dictionary remains sole lexical engine; no invented senses |
| Scope discipline | Explicit exclusions below are not shipped as MVP |
| No network dependency | Save / list / review / progress work offline after dictionary install |

### Non-criteria for MVP

- Improved morphological recall or fuzzy search
- Pronunciation quality
- Classroom adoption metrics
- Multi-device sync rates

---

## 10. Explicit exclusions

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
| Multiple vocabulary lists | Defer past single saved set |
| Full LMS / lesson curricula | Explicit anti-goal |
| Reopening Phase 7N / 7N1 device-matrix as Learning work | Separate tracks |

---

## 11. Relationship to the dictionary

| Concern | MVP stance |
| --- | --- |
| Lexical engine | Dictionary bundles + search remain authoritative |
| Learning System | Personal overlay: save, review, confidence, progress |
| Content creation | Learning does not add lemmas, senses, or examples |
| Search workflow | Unchanged as discovery path; Save is an action on results/entry |
| Bundles / catalog | Unchanged content distribution; learning state is not catalog data |
| Offline-first | Dictionary install still required for content; learning state also offline |
| Provenance | Dictionary provenance rules unchanged; learning state is preference/progress |

```text
[ Catalog / Bundle install ]
        ↓
[ Dictionary search + entry display ]  ← lexical authority
        ↓
[ Learning layer: save / review / confidence / progress ]  ← personal only
```

---

## 12. Risks

| Risk | Why it matters | Mitigation in this definition |
| --- | --- | --- |
| Feature creep | Direction boundary is wider than a closed loop | Required vs nice-to-have vs future split; single saved set |
| Excessive complexity | SRS, multi-list, analytics delay value | Explicit no-SRS review; counts-only progress |
| Turning MVP into a full LMS | Teacher/classroom/lessons absorb the milestone | Listed as exclusions / later possibilities only |
| Reducing lookup speed | Learning UI competes with search-first UX | Learning actions attach to entry/saved/review; search path stays primary |
| Orphaned references | Bundle update/removal breaks saved links | Product rule: learning references installed dictionary identity; handle missing entries gracefully in later implementation |
| Confusing logs with learning | Query logs mistaken for vocabulary | Keep learning store separate from optional query logs |
| Scope bleed into morphology/audio | Attractive adjacent work | Named future roadmap; blocked from MVP |

---

## 13. Recommended implementation milestones

Each milestone should ship a usable product improvement. No code in this
document — sequencing only.

### LS1 — Save & Saved Vocabulary

**Outcome:** User can save words from entries, see them in one list, remove
them, offline.

**Delivers:** US1–US3, US8 (partial: save persistence).

### LS2 — Review Loop

**Outcome:** User can run a simple flashcard review and mark remembered /
still learning.

**Delivers:** US4–US6, US8 (review + confidence persistence).

### LS3 — Progress & Return Surface

**Outcome:** Minimal progress counts visible; clear empty states that send
users back to search or review; optional nice-to-haves only if they do not
expand scope (e.g. recently searched).

**Delivers:** US7; closes MVP success criteria for return habit.

### Gate between milestones

Do not start LS2 until LS1 is usable offline. Do not treat nice-to-haves as
blockers for declaring the MVP loop complete after LS2+LS3 Required items.

Suggested planning label continuation:

```text
LS-MVP → LS1 / LS2 / LS3
```

---

## 14. Answers to prior open product questions

Mapped from
`docs/reports/next_product_milestone_learning_system_direction.md` §11:

| Question | MVP answer |
| --- | --- |
| Primary user journey | Search → entry → save → return → review → mark confidence → continue |
| Minimum feature set | Required table in §5 |
| Storage model | Device-local personal references + confidence + light review history (§6) |
| Review-session behavior | Simple queue; self-mark; no SRS (§7) |
| Success criteria | §9 |
| Additional exclusions | §10 (incl. SRS, multi-list, gamification) |
| Roadmap reorder triggers | Only with new owner evidence; morphology/audio stay after Learning unless owner reorders |

Remaining implementation-level choices (exact prompt side, card shuffle,
missing-entry UX after bundle change) are deferred to LS1–LS3 design slices —
not blockers for this definition.

---

## 15. Validation note

Documentation-only change. Validate with `git diff --check`,
`git diff --name-status`, and `git status --short`. No runtime, catalog,
bundle, source, test, or package changes.

---

## Summary

| Field | Value |
| --- | --- |
| Decision label | `LEARNING_SYSTEM_MVP_DEFINED` |
| Closed loop | Discover → Save → Review → Recall → Mark confidence → Continue |
| Required core | Single saved set + simple flashcard review + two-state confidence + minimal counts + offline persistence |
| Not in MVP | Morphology, audio, SRS, teacher/classroom, cloud, social, gamification, multi-list LMS |
| Implementation sequence | LS1 Save → LS2 Review → LS3 Progress |
| Code / data changes | None |
