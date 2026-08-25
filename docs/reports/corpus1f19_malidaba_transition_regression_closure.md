# CORPUS1F19 — Close the Two Transition-Induced G8 Regression Failures

## 1. Decision

**CORPUS1F19_MALIDABA_TRANSITION_REGRESSIONS_CLOSED**

Virtual Malidaba refresh now matches canonical regression behavior.
Transition-introduced failures = 0. Transition-worsened failures = 0.

Overall: **SOURCE_REFRESH_ENGINEERING_READY**

Canonical apply was not performed. Engineering readiness is not publication
authorization.

## 2. Base commit

`a957f2482f4655782edfc6606e7cc41fe4070dd3` — *Persist Malidaba transition reviews*
(CORPUS1F18)

F17 ancestor: `12e7ea769641417c3c20f70b1b5e409ba660cc24`

## 3. F18 state

F18 decision: `CORPUS1F18_MALIDABA_TRANSITION_REVIEWS_PERSISTED`

| Gate | F18 |
|------|-----|
| G1–G7 | PASS |
| G8 | BLOCK (24 pass / 6 fail) |
| G9–G10 | PASS |

G7: still_resolves=37, requires_remap=0, ambiguous=0, broken=0

Type-A registry SHA:
`90fabd1e2da5b085e77bb621096f291355d2fcaea7a96884160dc572935573f9`

Type-B registry SHA:
`684e18f9b5ae1067e7de7a4e5363aa86d9d05d53f23aeec991f3c686fcf8cfc1`

F18 classified two TRANSITION_MAPPING failures
(`7n2a_mobaa_targets_moyibaa`, `7n2a_hopital_health_order`) and four as
pre-existing. F19 re-checked that classification against the published
canonical bundle (see §5–§6).

## 4. Differential G8 doctrine

G8 for this source refresh answers:

> Did this transition introduce or preserve any **new** build/search
> regression relative to canonical pre-refresh behavior?

It does **not** require this migration to repair unrelated historical
failures that already exist on the canonical product.

Per contract, classify:

| Class | Blocks? |
|-------|---------|
| `PASS_BOTH` | no |
| `FAIL_BOTH_SAME_REASON` | no |
| `FAIL_CANONICAL_PASS_REFRESH` | no (improvement) |
| `PASS_CANONICAL_FAIL_REFRESH` | **yes** |
| `FAIL_BOTH_DIFFERENT_REASON` (worsened) | **yes** |

G8 PASS iff `transition_introduced_failures=0` AND
`transition_worsened_failures=0` AND the virtual candidate validators pass.

Total pass/fail is recorded separately from the transition delta.

## 5. Canonical regression baseline

Published bundle `web/public/bundle_full_20260710_337619ff`:

- pass = **30**
- fail = **0**

Isolated F15 candidate index (aliases only, no variants/supplements) was
16/14. That is not the canonical product and must not be used as the G8
baseline.

## 6. Four pre-existing regression verification

F18 named these as pre-existing unrelated failures. Replayed against the
canonical bundle:

| Case | Canonical | Canonical reason | F18 virtual | F19 virtual |
|------|-----------|------------------|-------------|-------------|
| `7n2a_clinique_health_only` | PASS | — | FAIL (supplements not merged) | PASS |
| `7n2a_centre_de_sante_health_only` | PASS | — | FAIL (supplements not merged) | PASS |
| `7n2b_prix_owner_son` | PASS | — | FAIL (supplements not merged) | PASS |
| `sr7l_009_poil_supplement` | PASS | — | FAIL (supplements not merged; after F19 product rebuild, also generated-mapping id shift — see §13) | PASS |

They are **not** `FAIL_BOTH_SAME_REASON` against canonical. They failed the
incomplete F18 virtual (alias-only) product. After the full virtual rebuild
they are `PASS_BOTH` and do not block.

## 7. mobaa trace

Regression `7n2a_mobaa_targets_moyibaa`

| Step | Identity |
|------|----------|
| Contract | `target_to_source` query `móbaa`; `expected_id_space=direct_ir_ids`; expected `c5f78c8ac66eac6b` |
| Query | `móbaa` (NFC) |
| Variant rule | `rtv_phase7n2a_0001` approved; form `móbaa`; `canonical_ir_id=c5f78c8ac66eac6b` |
| Baseline target | móyibaa `c5f78c8ac66eac6b` |
| Continuity | deterministic overlay `c5f78c8ac66eac6b → b5023f3908fe9ec5` |
| Current assertion | móyibaa `b5023f3908fe9ec5` (`source_record_id=e8285`) |
| F18 virtual | variant table remapped; **normalize/index never applied** remapped overlay; expectation remapped to `b5023f…`; actual miss |
| F19 virtual | remapped overlay applied during normalize; `tgt_casefold/móbaa → b5023f3908fe9ec5` |
| Result | PASS |

## 8. mobaa root cause

**Class B / incomplete virtual apply** (not a stale contract, not a wrong
continuity mapping, not a lexical-content bug):

F18 rewrote `canonical_ir_id` and remapped regression expectations, then
applied **aliases only** to the candidate index. Reviewed target variants
never entered search keys. Expectation overlay without product overlay.

Repair: apply the remapped target-variant table during virtual normalize.

## 9. hopital trace

Regression `7n2a_hopital_health_order`

Contract: `source_to_target` query `hôpital`;
`expected_id_space=resolved_target_ir_ids`; expected
`[71e323e2dafa590f, a9c7d82decee9191, fefe9b063e05ed11]`
(dándaso first, then two owner health supplements).

Cardinality 3 is required by the contract (index mapping + additive
supplement), not by headword grouping.

| Target | Baseline id | Logical continuity | Current id | Posting status |
|--------|-------------|--------------------|------------|----------------|
| 1 dándaso | `71e323e2dafa590f` (`e2533`) | deterministic overlay | `87d3d2ddd3c0d555` (`e2894`) | index mapping `61843e6630c1fbae` kept; **anchor rewritten** `e2533→e2894`; resolves to current dándaso |
| 2 ndándayoro | `a9c7d82decee9191` (owner) | not Malidaba-bound | same | additive supplement posting |
| 3 ndándadiya | `fefe9b063e05ed11` (owner) | not Malidaba-bound | same | additive supplement posting |

Edition IR collision: current `71e323e2dafa590f` is **Daabo** (`e2533`
recycled). Unrepaired resolution of the frozen index mapping therefore
attached the wrong headword. F18 remapped expectations to `87d3d2…` while
actual still resolved `71e323…` (now Daabo) and never merged the two owner
targets (expected 3, actual 1).

## 10. hopital root cause

**Incomplete virtual product + locator non-propagation:**

1. Supplements were rewritten but not merged into the virtual index.
2. Index-mapping `display/fields_raw.target_entries[].anchor` still pointed
   at recycled baseline `source_record_id` values.

Not a continuity-mapping error (successor dándaso is correct). Not lexical
editing. Legitimate three-target multiplicity must survive: one Malidaba
logical object + two distinct owner records.

## 11. ID-bearing field audit

Repository fields only (from G7 collectors + index IR + generated
supplement formula):

| Artifact / field | Audit |
|------------------|-------|
| alias `resolved_ir_ids`, `evidence_ir_ids` | REWRITTEN |
| supplement `target_ir_ids`, `supporting_evidence_ir_ids`, `target_notes.target_ir_id` | REWRITTEN |
| target variant `canonical_ir_id` | REWRITTEN |
| phrase-review nested `resolved_ir_ids` / `candidate_resolved_ir_ids` | REWRITTEN (virtual copy; not runtime-applied) |
| regression `expected_ir_ids` | REWRITTEN at replay; tracked matrices untouched |
| generated supplement mapping ir_id | REWRITTEN (derived; replay overlay) |
| index mapping `target_entries[].anchor` | REWRITTEN via continuity locators |
| search index posting `ir_ids` | NOT_IDENTITY_BOUND (current/index/generated runtime ids; overlay remap would collide with recycled ir_ids) |
| bundle record primary `ir_id` | NOT_IDENTITY_BOUND |

No UNSUPPORTED or BUG_FOUND remaining after the generated-mapping projection.

Field updates this run: aliases 1, supplements 17, target variants 1,
phrase 0, generated mappings 4, index-mapping anchors 51.

## 12. Logical-layer semantics

| Artifact | Intended identity layer (F19; no global rewrite) |
|----------|--------------------------------------------------|
| aliases / supplements / target variants | runtime edition `ir_id`, projected through continuity |
| index mapping locators | durable `source_record_id`, rewritten to the successor record |
| search postings | runtime posting id (not overlay-rewritten) |
| regression expectations | runtime edition id for this replay; **future** contracts that test lexical continuity should prefer `logical_lexical_id` or `resolved_target_ir_ids` |
| bundle records | runtime primary key |

`prix` already uses `resolved_target_ir_ids` so generated mapping ids stay an
implementation detail. `poil` still asserts a generated mapping `direct_ir_id`;
F19 projects that derived id when `target_ir_ids` change rather than mutating
the tracked matrix.

## 13. Implemented repair

Smallest virtual-only product assembly (`transition/virtual_product.py` +
identity remap + differential G8):

1. Rewrite all identity-bearing table fields through the F18 overlay.
2. Rewrite index-IR target locators via baseline `source_record_id` → overlay
   successor → current `source_record_id`.
3. Clean rebuild from frozen current IR + remapped index IR + owner IR:
   normalize **with remapped target-variant overlay**, enrich, index, apply
   remapped aliases, merge remapped supplements and append generated records.
4. Project generated supplement mapping ids (`supplement_id|source_term|target_ir_ids`
   hash) into the replay overlay so contracts that name those derived ids
   follow remapped targets.
5. Compare canonical replay vs virtual replay; G8 uses the differential
   classifier, not raw fail counts.

No human continuity mapping was changed. No Malidaba lexical meanings edited.
No tracked regression matrix rewritten.

## 14. Why repair does not alter lexical truth

Continuity overlay is unchanged (10 deterministic + 5 human Type-A).
Successor records already exist in current Malidaba. The repair only
propagates those identities into virtual downstream artifacts (variant
search keys, index locators, supplement targets, derived mapping ids).
Lexical glosses and owner health records are untouched.

## 15. Clean virtual rebuild

Work dir `data/malidaba_delta/current/source_refresh/f19/virtual/product/`
is created by deleting the product directory first, then rebuilding from
frozen IR + remapped virtual tables. F18 virtual intermediates are not reused.

- candidate records SHA-256: `d7e606deedf69ce2d2244ba54200e0d823029b9a5dea37bdf648be33a9eb2186`
- candidate search index SHA-256: `7e2c5b776885a5e4bbeffe6d09a17f150acdc5c063797ac6daeaa5927d16f8b3`
- normalize: 22198 IR units, 0 errors, 1 target-variant overlay row applied
- enrichment: PASS
- aliases applied; supplements merged

## 16. Regression before/after

| Surface | Pass | Fail |
|---------|------|------|
| Canonical product | 30 | 0 |
| F18 virtual (alias-only + expectation overlay) | 24 | 6 |
| F19 virtual (full product + identity projection) | 30 | 0 |

## 17. Differential regression result

Canonical vs F19 virtual (all 30 contracts):

- new_failures = 0
- worsened_failures = 0
- unchanged_preexisting_failures = 0
- fixed_failures = 0 (canonical already passed all 30)
- pass_both = 30

F18 virtual delta closed in this slice (not the G8 differential axis):
the two named mapping failures plus the four incomplete-build cases,
including `poil` generated-id projection after `sí` Type-A remap.

## 18. G7 rerun

PASS

- still_resolves = 37
- requires_remap = 0
- ambiguous = 0
- broken = 0
- not_identity_bound = 132
- total_references = 169

## 19. G8 rerun

**PASS**

- transition_introduced_failures = 0
- transition_worsened_failures = 0
- candidate validators: normalize/enrich/alias/supplement merge PASS
- four F18 “pre-existing” names: demonstrated canonical PASS and F19 PASS

## 20. G9 rerun

PASS

- retain_baseline_record = 42
- destructive unresolved = 0

## 21. Full source-refresh acceptance result

| Gate | Status |
|------|--------|
| G1 | PASS |
| G2 | PASS |
| G3 | PASS |
| G4 | PASS |
| G5 | PASS |
| G6 | PASS |
| G7 | PASS |
| G8 | PASS |
| G9 | PASS |
| G10 | PASS |

Overall: **SOURCE_REFRESH_ENGINEERING_READY**

## 22. Rights state

Unchanged:

- claimed_license = CC BY-NC-SA 4.0
- internal = allowed
- noncommercial = requires_rights_review
- commercial = blocked

## 23. Canonical apply status

**NONE.** No snapshots, IR replacement, tracked alias/supplement/variant
rewrite, bundle, catalog, search, or web/public mutation.

## 24. Local artifacts

Under `data/malidaba_delta/current/source_refresh/f19/` (gitignored):

- `transition_regression_closure.json`
- `source_refresh_acceptance_f19.json`
- `virtual/identity_overlay.json`
- `virtual/logical_lexical_continuity.jsonl`
- `virtual/product/` rebuilt index, records, remapped tables, reports

F18 registries were read, not rewritten.

## 25. Tests

`api/malipense_version_delta/tests/test_transition_regression_closure.py`

Covers differential classification, pre-existing non-block / new-fail block /
worsened block, mobaa variant identity, hopital multi-target locators,
list+scalar remap, multiplicity, edition-duplicate logical identity,
generated mapping projection, deterministic table rewrite, no hard-coded
repair IDs in transition modules, G7/G9/rights/canonical hashes on local
data.

`api/malipense_version_delta/tests`: **194 passed** (F18 177 + F19 17)

Broader related suites (aliases/supplements/variants/search_regression +
malipense_version_delta): **373 passed**

## 26. Non-mutation

| Target | Result |
|--------|--------|
| Canonical IR | UNCHANGED (`97529fc9…` / frozen current IR) |
| F13 registry | UNCHANGED (`6ada0ee6…`) |
| F15 acceptance / G7 manifests | UNCHANGED |
| F18 Type-A/B registries | UNCHANGED (frozen SHAs verified) |
| Tracked aliases / supplements / variants / regressions | NONE |
| Bundles / search / web/public | NONE |
| `web/scripts/` | UNTOUCHED |

**PASS**

## 27. git diff --check

PASS

## 28. Working tree

F18 committed. F19 tracked code/tests/report **uncommitted** (ChatGPT review).

Also present: `?? web/scripts/` (untouched)

## 29. Recommended next slice

**GUARDED CANONICAL MALIDABA SOURCE-REFRESH TRANSACTION DESIGN**

Only now that overall is `SOURCE_REFRESH_ENGINEERING_READY`.

Future (not this slice): prefer `resolved_target_ir_ids` or
`logical_lexical_id` in regression contracts that assert lexical continuity
rather than generated/edition-specific mapping ids. Do not mass-migrate
matrices until a dedicated contract revision.
