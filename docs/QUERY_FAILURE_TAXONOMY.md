# Query failure taxonomy

**Documentation only.** This document defines vocabulary for **classifying user query outcomes** during manual review of logs or sessions. It is **not** implemented as automatic labels in the app or in the query log schema today.

A single query may invite **multiple** tags in discussion (for example spelling plus phrase shape); pick the **primary** driver when prioritizing fixes.

---

## spelling_error

**Definition:** The user’s intent is a known lemma or name, but the typed string deviates by **orthographic** or **typographic** error (wrong letter, transposition, missing accent that the user still considers “the same word” in everyday use) such that the **exactness ladder** does not reach a stored key.

**Examples:**

- Typed `recieve` for the headword `receive`.
- Typed `Malipeense` with one vowel wrong vs the canonical `Malipense` (if the bundle only indexes the canonical form).
- Single-character phone-keyboard slip on an otherwise correct word.

**Not the same as:** `missing_entry` (the correct spelling is also absent from the dictionary).

---

## phrase_mismatch

**Definition:** The user submits a **multi-word string** or **idiom** as one query, but the bundle indexes **single lexical units** (or different phrasing), so no single record or index key covers the full phrase.

**Examples:**

- Query `piece of cake` when only `piece` and `cake` exist as separate entries, not the idiom.
- Query `high school student` expecting a compound gloss that was never ingested as a phrase.

**Not the same as:** `spelling_error` on one token inside the phrase (though both can coexist).

---

## language_mismatch

**Definition:** The query is **interpreted under the wrong language or direction**, or the user mixes **scripts or languages** such that the normalized keys belong to a different language than the active search leg, so hits are absent or misleading.

**Examples:**

- Arabic script query while the active bundle leg expects Latin source script (or vice versa), with no bridging transliteration in scope.
- English word typed in **Target → Source** mode when the user meant **Source → Target**.
- Mixed-script token that normalizes to keys the bundle never populated for that direction.

**Not the same as:** `index_gap` inside the correct language leg (where direction and script are already correct).

---

## missing_entry

**Definition:** The dictionary **content** does not contain a defensible lemma or sense for the concept, even under correct spelling, normalization, and direction. No amount of index repair fixes it without **adding or importing** content.

**Examples:**

- Regional neologism not yet in the corpus.
- Domain-specific term the bundle explicitly excludes.
- Competitor product name never modeled as a headword.

**Not the same as:** `spelling_error` (the lemma exists under another spelling you did not try) or `phrase_mismatch` (content exists but only as parts).

---

## index_gap

**Definition:** A **record exists** that should be discoverable for a defensible normalized key and direction, but the **search index** is wrong or incomplete (missing row, wrong `ir_ids`, wrong `key_type` chain, stale index relative to records).

**Examples:**

- Headword visible in `records.jsonl` but no corresponding ladder keys in `search_index.jsonl` for that `ir_id`.
- Index row points to an `ir_id` that was deleted or never committed during a partial build.
- Norm version bump in records without a matching rebuild of the index slice.

**Not the same as:** `missing_entry` (no record to index) or `normalization` mismatch between **spec** and **indexer implementation** (that is often traced as norm pipeline vs index build; still often filed under index until proven otherwise).

---

## Using this taxonomy with logs

Exported lines include `query_raw`, `ir_ids_count`, `ladder_level_hit`, and `query_normalized_keys`. They do **not** include a `failure_class` field. Reviewers assign a class **after** checking records, index, and norm behavior as in [LOG_ANALYSIS_WORKFLOW.md](./LOG_ANALYSIS_WORKFLOW.md).
