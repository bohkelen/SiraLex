# CORPUS1F18 — Persist Human Transition Decisions + Virtual Gate Rerun

## 1. Decision

**CORPUS1F18_MALIDABA_TRANSITION_REVIEWS_PERSISTED**

Human Type-A and Type-B reviews were validated, persisted into separate
governed registries, and used to build a complete virtual continuity overlay.

Source-refresh engineering is **not** ready: G8 remains BLOCK on two
transition-mapping regression failures.

Canonical apply was not performed.

## 2. Base commit

`12e7ea769641417c3c20f70b1b5e409ba660cc24` — *Add Malidaba lexical continuity gate* (CORPUS1F17)

F16 ancestor: `604a0927fa870e93a1736da55a2de46bf2b0c76f`

## 3. Human Type-A decisions supplied

5 / 5 = `confirmed_continuity`

| Baseline | Selected current `ir_id` |
|----------|--------------------------|
| `bári` | `85a55bf8072fbb53` |
| `kùn` — to / for | `294714956aec1624` |
| `kùn` — head / hair / end | `6ce45fcce8546c6f` |
| `sí` — hair/fleece / feather | `eccca9525fe88a67` |
| `ɲá` — eye / face / outlook | `b0c569ca42cf6d71` |

`reviewer_id=Reviewer_001` · `review_method=manual_review` ·
`reviewed_at=2026-08-24T13:15:00+00:00`

## 4. Human Type-B decisions supplied

42 / 42 = `retain_baseline_record`

`selected_current_ir_id` blank × 42

`reviewer_id=Reviewer_001` · `reviewed_at=2026-08-24T12:00:00+00:00`

## 5. Frozen worksheet validation

| Worksheet | SHA-256 |
|-----------|---------|
| Type A completed | `d15c587a91427442e55153ae8decd3280d56935edb5d4dcb93e6159d748ed166` |
| Type B completed | `424104119bcc575a57704245d84a94b793641c33b8effc89490d283b3dd49157` |

Local files matched the frozen human-reviewed bytes. Schema v2; 5 + 42 rows.

## 6. Type-A dry-run

```
rows_read=5
rows_skipped_unreviewed=0
preview_row_count=5
error_count=0
confirmed_continuity=5
```

## 7. Type-B dry-run

```
rows_read=42
rows_skipped_unreviewed=0
preview_row_count=42
error_count=0
retain_baseline_record=42
```

## 8. Two review persistence contracts

| Contract | Subject | Registry |
|----------|---------|----------|
| `malidaba_continuity_reviews_v1` | one Type-A migration/continuity subject | `f18/malidaba_continuity_reviews_v1.jsonl` |
| `malidaba_missing_disposition_reviews_v1` | one baseline record disposition | `f18/malidaba_missing_disposition_reviews_v1.jsonl` |

Not stored in the F13 source-delta review registry.

Immutable events + explicit same-reviewer supersession. No latest-wins.

## 9. First apply results

Type A: `rows_before=0`, `candidate=5`, `new=5`, `rows_after=5`

Type B: `rows_before=0`, `candidate=42`, `new=42`, `rows_after=42`

## 10. Idempotence

Type A second apply: `new=0`, `already_present_identical=5`, `rows_after=5`

Type B second apply: `new=0`, `already_present_identical=42`, `rows_after=42`

Registry SHAs unchanged on second apply.

## 11. Review registry SHAs

| Registry | SHA-256 |
|----------|---------|
| Type A | `90fabd1e2da5b085e77bb621096f291355d2fcaea7a96884160dc572935573f9` |
| Type B | `684e18f9b5ae1067e7de7a4e5363aa86d9d05d53f23aeec991f3c686fcf8cfc1` |

## 12. Logical continuity graph

57 objects. Graph validation **ok**. No contradictory identities. No unintended
many-to-one collapse. Homograph `kùn` pair remains two logical IDs.

## 13. 10 deterministic + 5 human mappings

Virtual identity overlay size = **15** (baseline → current `ir_id`).

Human mappings are 1:1 continuations through `logical_lexical_id`. Source
records are not merged. Unselected same-spelling current records remain
independent.

## 14. 42 legacy-retained subjects

`continuity_status=LEGACY_RETAINED`, `current_ir_ids=[]`,
`current_edition_attribution=false`.

## 15. G7 rerun

| Metric | Value |
|--------|------:|
| still_resolves | **37** |
| requires_remap | **0** |
| ambiguous | **0** |
| broken | **0** |

**G7 PASS**

## 16. Alias / supplement virtual application

`alias_apply_note=applied_virtual_aliases`

Ambiguous evidence id `755e1dd98e5f4535` is now in the overlay
(`b0c569ca42cf6d71`). Virtual copies only under `f18/virtual/`.

## 17. G8 rerun

Previous (F17): 17 pass / 13 fail

After complete Type-A overlay: **24 pass / 6 fail**

**G8 BLOCK** — 2 failures classified `TRANSITION_MAPPING`:

- `7n2a_mobaa_targets_moyibaa` — expected remapped posting `b5023f3908fe9ec5` missing (miss)
- `7n2a_hopital_health_order` — expected 3 resolved target IDs after overlay, got 1

Pre-existing unrelated (4; do not by themselves constitute transition-mapping G8 block):

- `7n2a_clinique_health_only`
- `7n2a_centre_de_sante_health_only`
- `7n2b_prix_owner_son`
- `sr7l_009_poil_supplement`

The former 2 `AMBIGUOUS_REFERENCE` kùn cases now pass.

## 18. G9 rerun

**PASS** under VERSIONED LEXICAL CONTINUITY

missing=42 · retain_baseline_record=42 · destructive unresolved=0

## 19. Stable logical reference validation

PASS: one logical ID per continuity object; edition `ir_id`s remain immutable
provenance; 42 legacy records independently addressable.

## 20. Future-renumbering assessment

**YES** — provided future editions attach new source assertions to governed
`logical_lexical_id` values. Virtual proof only; tracked artifacts not migrated.

## 21. Source-refresh acceptance rerun

| Gate | Status |
|------|--------|
| G1 | PASS |
| G2 | PASS |
| G3 | PASS |
| G4 | PASS |
| G5 | PASS |
| G6 | PASS |
| G7 | PASS |
| G8 | **BLOCK** |
| G9 | PASS |
| G10 | PASS |

Overall: **SOURCE_REFRESH_BLOCKED_BUILD_REGRESSION**

## 22. Rights state

Unchanged:

- claimed_license = CC BY-NC-SA 4.0
- internal = allowed
- noncommercial = requires_rights_review
- commercial = blocked

## 23. Canonical apply status

**NONE.** No snapshots, IR replacement, tracked alias/supplement rewrite,
bundle, catalog, or web/public mutation.

## 24. Local artifacts

Under `data/malidaba_delta/current/source_refresh/f18/` (gitignored):

- `malidaba_continuity_reviews_v1.jsonl`
- `malidaba_missing_disposition_reviews_v1.jsonl`
- persist receipts
- `transition_review_persist.json`
- `source_refresh_acceptance_f18.json`
- `virtual/` overlay + continuity objects

## 25. Tests

`api/malipense_version_delta/tests/test_transition_review_persist.py`

Full relevant suite: **177 passed**

## 26. Non-mutation

| Target | Result |
|--------|--------|
| Canonical IR | UNCHANGED (`97529fc9…`) |
| F13 registry | UNCHANGED (`6ada0ee6…`) |
| F15 acceptance / manifests | UNCHANGED |
| Tracked aliases / supplements / variants | NONE |
| Bundles / search / web/public | NONE |
| `web/scripts/` | UNTOUCHED |

## 27. git diff --check

PASS

## 28. Working tree

F17 committed. F18 tracked code/tests/report **uncommitted**.

Also present: `?? web/scripts/` (untouched)

## 29. Recommended next slice

Not guarded canonical apply.

**Diagnose and resolve the 2 G8 TRANSITION_MAPPING failures**
(`7n2a_mobaa_targets_moyibaa`, `7n2a_hopital_health_order`) in the virtual
overlay/regression replay, then re-evaluate G8.

Only if overall becomes `SOURCE_REFRESH_ENGINEERING_READY`:

**GUARDED CANONICAL MALIDABA SOURCE-REFRESH TRANSACTION DESIGN**
