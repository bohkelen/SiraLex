# Phase 7N2A Lexical Review — `ndándadiya`

```text
Status: owner linguistic approval recorded
Implementation authorization: eligible for staged source-record planning
Candidate scope: Phase 7N2A only
```

This sheet records owner linguistic approval for the 7N2A candidate `ndándadiya`. It does not authorize immediate source-data changes, alias changes, index changes, bundle generation, or release actions.

---

## Required Review Fields

| Field | Value |
| --- | --- |
| Candidate form: | `ndándadiya` |
| Canonical NFC form: | `[pending source-record normalization and provenance review]` |
| Canonical display form: | `ndándadiya` (same as candidate form) |
| Tone marks: | `[pending source-record normalization and provenance review]` |
| ASCII/transliteration fallback, if any: | `[pending source-record normalization and provenance review]` |
| Part of speech: | `[pending source-record normalization and provenance review]` |
| French primary gloss: | health institution |
| French secondary glosses: | hôpital; clinique; centre de santé |
| Definition: | A location where health-related care or services are received. |
| Usage context: | Health care, treatment, clinic, hospital, or health-centre context. |
| Register: | `[pending source-record normalization and provenance review]` |
| Geographic or dialect scope: | `[pending source-record normalization and provenance review]` |
| Relationship to the other approved candidate: | See **Cross-candidate distinction** below |
| Relationship to existing dándaso record: | `[pending source-record normalization and provenance review]` |
| Should it retrieve for hôpital?: | yes |
| Should it retrieve for clinique?: | yes |
| Should it retrieve for centre de santé?: | yes |
| Should it retrieve for place?: | no |
| Should it retrieve for location?: | no |
| Source/provenance: | `[pending source-record normalization and provenance review]` |
| Owner linguistic approval: | approved by project owner in project review session |
| Reviewer role: | project owner / native-speaker linguistic authority |
| Review date: | `[pending source-record normalization and provenance review]` |
| Open semantic questions: | See **Open semantic questions** below |

The exact NFC representation and tone-mark encoding must be verified mechanically from the owner-approved form before source-data insertion. Do not silently alter spellings.

---

## Retrieval-path clarification

```text
The existing French retrieval path `place → diya` remains unchanged.

Standalone `yoro` remains unresolved. It must not be entered as a standalone
lexical record, source alias, target alias, or source-index mapping under
`place`, `location`, or any other Phase 7N2A retrieval path.

The approved candidate `ndándadiya` must be evaluated only as a complete
health-institution lexical candidate. It must not be decomposed into a generic
`yoro → place` relationship.
```

---

### Open semantic questions

The following remain unclassified and must not be inferred:

- part of speech
- dialect scope
- geographic scope
- etymology
- standalone meaning of yoro
- standalone meaning of diya
- whether ndándayoro and ndándadiya are synonyms
- whether they are dialectal variants
- whether one is broader or narrower

Is yoro an independently valid lexical form? If so, what is its exact spelling,
tone pattern, meaning, scope, and retrieval behavior? This question is outside
the current ndándadiya review and must not be answered by inference.

---

### Non-negotiable constraints

- Do not infer meaning from component strings.
- Do not infer a general `yoro → place` relationship.
- Do not infer a general `diya → place` relationship.
- Do not treat either candidate as an alias unless a reviewed source record already exists.
- Do not replace the existing `hôpital → dándaso` retrieval path.
- Do not use these sheets to modify source data automatically.
- Preserve the existing French retrieval path `place → diya`.
- Do not add `yoro` under `place`.
- Do not infer that a component inside an approved health-institution candidate is independently a
  dictionary entry or retrieval mapping.
- Standalone `yoro` remains unresolved pending separate owner linguistic review.
- The existing French retrieval path `place → diya` remains unchanged.
- Standalone `yoro` remains unresolved and must not be added under `place`,
  `location`, or any other retrieval path in Phase 7N2A.

---

### Cross-candidate distinction

Both ndándayoro and ndándadiya are approved as separate canonical health-
institution lexical candidates. Both may retrieve for hôpital, clinique, and
centre de santé.

Their exact relationship remains unclassified: they must not be represented as
synonyms, interchangeable spellings, or dialectal variants unless later source
provenance or linguistic review establishes that relationship.

Until then, any future implementation must preserve them as separate canonical
records and may map both to the same approved French health-institution
retrieval labels.

---

### Final lexical decision

Canonical source-record addition approved:

- [x] yes
- [ ] no
- [ ] pending

Approved French retrieval labels:

- hôpital: [x]
- clinique: [x]
- centre de santé: [x]
- place: [ ]
- location: [ ]

Relationship type:

- [ ] synonym of an existing record
- [ ] subtype of an existing record
- [x] distinct health-institution concept
- [ ] phrase or compound
- [ ] unresolved

“Distinct health-institution concept” is operational only: this candidate is a separate canonical record for implementation. It does not assert a final linguistic taxonomy beyond that.

---

## Related Documents

| Document | Role |
| --- | --- |
| `docs/PHASE_7N2A_IMPLEMENTATION_AUTHORIZATION.md` | Staged implementation authorization |
| `docs/reports/phase7n2a_source_record_audit.md` | Source-record audit |
| `docs/reviews/phase7n2a_ndandayoro_lexical_review.md` | Companion review sheet |
