# CORPUS1F — Real-Evidence Manual Corpus Pilot

## 1. Decision

```text
CORPUS1F_REAL_EVIDENCE_PILOT_READY_FOR_HUMAN_REVIEW
```

A rights-gated adult Maninka subset from OpenSLR SLR106 was registered locally,
validated end-to-end through annotations, and exported as an unreviewed human
worksheet. No AI linguistic decisions were filled. No production review writer.
No dictionary/runtime mutation. Real media remains outside git.

---

## 2. Base commit

```text
4ef8269d23a398043a5f51dfedc5abcc107fce14
```

`git log -1`: `4ef8269 Add governed corpus annotation review workflow`.

---

## 3. Pilot objective

Encounter a small amount of **real Maninka speech evidence** with the existing
CORPUS1B–E contracts:

```text
source → artifacts → segments → imported annotations → review worksheet
→ HUMAN REVIEW READY
```

Not scale. Not ASR. Not ELAN. Not promotion.

---

## 4. Official source investigated

| Item | Official reference |
|------|--------------------|
| OpenSLR page | https://www.openslr.org/106/ |
| Resource id | SLR106 |
| Package name | `nicolingua-0004-west-african-va-asr-corpus` |
| Official download | https://www.openslr.org/resources/106/nicolingua-0004-west-african-va-asr-corpus.tgz |
| Alternate (project) | https://nicolingua.s3.eu-west-2.amazonaws.com/nicolingua-0004-west-african-va-asr-corpus.tgz |
| Project repo | https://github.com/mdoumbouya/nicolingua |
| Paper | Doumbouya, Einstein, Piech — AAAI 2021 *Using Radio Archives for Low-Resource Speech Recognition…* |
| OpenSLR license claim | Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) |
| `info.txt` | Confirms CC BY-SA 4.0 + alternate URL |

Re-verified from OpenSLR/project docs for this slice (not only CORPUS1A).

Dataset claims: 10,083 utterances; French, **Maninka**, Pular, Susu; 49 speakers;
ages 5–76; VA closed vocabulary (wake word, commands, digits, parents, names).

Metadata confirmed after download: per-file `language`, `speaker_age`,
pseudonymous `speaker_id`, utterance class ids, plus vocab CSVs with Maninka
orthography columns.

---

## 5. License / rights posture

Local source row posture (controlled internal pilot):

| Field | Value |
|-------|-------|
| `rights_basis` | `licensed` |
| `rights_review_status` | `requires_rights_review` |
| `license_reference` | CC-BY-SA-4.0 (creativecommons.org/licenses/by-sa/4.0/) |
| `attribution_required` | true |

`usage_permissions` (sparse):

- allowed: `internal_analysis`, `local_storage`, `transcription`, `corpus_storage`
- blocked: `dictionary_example_publication`, `pronunciation_publication`,
  `audio_redistribution`, `transcript_redistribution`, `commercial_redistribution`
- unknown: `model_training`, `model_evaluation`

**Invariant preserved:** CC BY-SA ≠ dictionary publication approval. ShareAlike
implications for derivatives remain unresolved pending separate rights review.

---

## 6. Ethical / minor handling

Ages are present in metadata. Pilot selection requires `speaker_age >= 18` and
`language = maninka`.

No speaker personal names were copied into SiraLex tables. Dataset speaker ids
(`sNNN`) are used as pseudonymous labels only. Dataset speaker “name” fields are
hashes and were not imported.

---

## 7. Local workspace strategy

Gitignored via existing `data/*`:

```text
data/corpus1f/
```

Contains archive, extracted meta, selected pilot audio, local JSONL tables,
worksheet CSV, validation/dry-run outputs, selection manifest.

No `.gitignore` change required.

---

## 8. Source rows created

**1** local `corpus_sources_v1` row:

- `source_id`: `csrc_openslr_slr106_nicolingua_va`
- `source_type`: `public_audio`
- claimed language: Maninka (dataset claim; not SiraLex linguistic truth)
- one source → many artifacts (no fake multi-source inflation)

---

## 9. Artifact count

**24** `corpus_source_artifacts_v1` rows.

Each hash/`byte_length`/`media_type=audio/wav` computed from local bytes.
`capture_method=download`. Media not committed.

---

## 10. Speaker / context diversity

| Dimension | Pilot result |
|-----------|--------------|
| Distinct speakers | 4 (`s023`, `s024`, `s025`, `s027`) |
| Age gate | all ≥ 18 |
| Language gate | `language=maninka` |
| Utterance categories | wake (4), command (8), digit (8), parent (4) |

Closed-vocabulary VA content (not open narrative speech).

---

## 11. Segment count / types

**24** segments, all `span_type=whole_artifact`.

Each SLR106 file is one short utterance; inventing millisecond boundaries would
be false precision.

---

## 12. Annotation count / types

**24** annotations, all `annotation_type=transcript_raw`,
`creation_method=import`.

---

## 13. What dataset annotation actually represents

Imported content is the **Maninka column** from official SLR106 vocab CSVs for
the utterance class id (wake/command/digit/parent).

This is dataset-provided orthography for a closed VA vocabulary class — **not**
a trusted-speaker transcription session, **not** reviewed linguistic truth, and
**not** free conversational transcript.

Name utterances are labeled `_language_independent` in metadata; they were
**not** included in this Maninka language-gated pilot subset.

No ASR was run.

---

## 14. Full-chain validation results

Local validators (full cross-reference):

| Table | Result |
|-------|--------|
| sources | PASS (1) |
| artifacts + sources | PASS (24) |
| segments + artifacts + sources | PASS (24) |
| annotations + segments + artifacts + sources | PASS (24) |

Outputs stored under `data/corpus1f/outputs/` (untracked).

---

## 15. Worksheet export result

`siralex-export-corpus-review-worksheet` against pilot annotations (leaves only):

- 24 rows
- includes `worksheet_schema`, fingerprint, context columns, review fill columns,
  `evidence_refs`
- written locally to `data/corpus1f/outputs/review_worksheet.csv`

---

## 16. Unedited worksheet dry-run result

`siralex-corpus-review-dry-run` on the unedited export:

```text
ok=true
rows_read=24
rows_skipped_unreviewed=24
error_count=0
preview_row_count=0
```

Structural round-trip clean before human edit.

---

## 17. Schema friction discovered from real data

1. **Closed vocab ≠ conversational transcript.** Contracts still work via
   `import` + clear notes, but reviewers must understand class orthography is
   not open speech transcription.
2. **Language-independent names.** Filename language token ≠ metadata
   `language` field; gating must use metadata, not filenames alone.
3. **Archive granularity.** Official package is a single ~243–254MB tarball;
   subset selection still required downloading the complete archive.
4. **Adult selection is possible** because ages are in metadata — good fit for
   the ethics gate.
5. **No contract change required** for this pilot; friction is workflow /
   interpretation, not ontology breakage.

---

## 18. Rights / legal uncertainties

- ShareAlike obligations for derivatives / redistributed packages.
- Whether any dictionary-facing excerpt would be compatible with CC BY-SA and
  SiraLex publication policy.
- Attribution packaging for any future public research release.

Publication/redistribution uses remain blocked in the pilot row.

---

## 19. Linguistic uncertainties

- Orthography may not match SiraLex dictionary norms.
- Dataset “Maninka” claim ≠ assessed Guinean Maninka variety confirmation.
- Short VA phrases are weak evidence for general lexicon promotion.

These are exactly what human review should surface via decisions / issue codes.

---

## 20. Human review required

**REQUIRED — NOT PERFORMED BY AI.**

Local AI did not accept/reject annotations, invent reviewer ids, or fill
linguistic decisions.

Next human step: fill the local worksheet; dry-run again; only then consider a
governed review persistence writer (later slice).

---

## 21. Files added / modified in git

**Added (tracked):**

- `docs/reports/corpus1f_real_evidence_manual_pilot.md`

**Modified (tracked):** none required for the pilot itself.

---

## 22. Local / untracked pilot artifacts

Under `data/corpus1f/` (gitignored), including:

- official archive `.tgz`
- extracted metadata / selected wavs
- `tables/*.jsonl`
- `outputs/review_worksheet.csv`
- validation / dry-run outputs
- selection manifest (ids/hashes only; no report-side transcript dump)

---

## 23. git diff --check

PASS for tracked CORPUS1F report change (when staged/written).

---

## 24. Working tree

CORPUS1F report uncommitted for review. Unrelated `web/scripts/` remains
untracked/untouched. Pilot media/tables ignored under `data/`.

---

## 25. Recommended next action after human review

1. Trusted speaker / linguistic reviewer fills local worksheet decisions.
2. Re-run dry-run; fix stale/context errors by re-export if needed.
3. Decide whether CORPUS1G should start ELAN/workbench import **or** a governed
   `corpus_annotation_reviews_v1` append writer first.
4. Keep promotion / dictionary candidacy blocked until separate governance.
