# LS1I1R1 — Atomic Idempotency and Timestamp Validation Correction

## Decision

```text
LS1_PERSISTENCE_ATOMICITY_CONFIRMED
```

Focused persistence correction only. No UI, catalog, bundle, source, package,
Review, Reflect, progress, morphology, or audio changes.

---

## 1. Original defects

| Gap | Risk |
| --- | --- |
| `saveLearningRecord` used separate readonly get + readwrite put transactions | Concurrent Saves could both observe absence and overwrite (or race) rather than true first-write-wins |
| Timestamp checks accepted any non-empty string | Invalid values like `"yesterday"` could pass write validation |

---

## 2. Corrected Save transaction design

`saveLearningRecord` now:

1. Validates save input (outside the transaction).
2. Opens **one** `readwrite` transaction on `STORE_LEARNING_RECORDS` only.
3. `get([bundle_id, ir_id])` on that store/transaction.
4. If present → complete transaction → return stored record unchanged (no write).
5. If absent → build record (`created_at` via `new Date().toISOString()`), validate, **`add`** (create-only).
6. On successful `add` → await transaction complete → return the new record.
7. On `ConstraintError` → return the persisted winner via a follow-up `getLearningRecord` (never return the losing speculative object).

Does **not** call `getLearningRecord` for the primary existence check (that would open a separate transaction).

No mutex, global lock, generic repository, or cross-store transaction.

---

## 3. Concurrent Save / collision behavior

| Behavior | Contract |
| --- | --- |
| Concurrent Saves same identity | All resolve successfully |
| Row count | Exactly one |
| Returned values | All equal the final persisted record |
| Fields preserved | Same `created_at`, stamps, cache, status, review fields |
| Overwrite | Losing callers cannot replace the first committed record |

Covered by `concurrent saves first-write-wins without overwrite` using deliberately divergent stamps/caches.

---

## 4. Timestamp-validation rule

`isValidIsoTimestamp`:

- Non-empty string with no leading/trailing whitespace
- `Date.parse` yields a finite time
- Round-trips by instant through `Date` / `toISOString`
- No date library

Applied to:

- `created_at` (required)
- `last_reviewed` when non-null (`null` remains allowed)

Continue generating create timestamps with `new Date().toISOString()`.

---

## 5. Tests added

- Concurrent multi-Save first-write-wins
- Valid `created_at`
- Malformed `created_at` (`yesterday`, whitespace)
- Invalid calendar (`2026-99-99`)
- Valid non-null `last_reviewed`
- Malformed non-null `last_reviewed`
- Null `last_reviewed`

Existing LS1I1 guarantees retained (isolation, list order, resolution, `deleteBundleData`, query-log independence).

---

## 6. Validation results

| Check | Result |
| --- | --- |
| Focused learning tests | **28 passed** |
| IndexedDB-adjacent (`query_log_store`, `phase3_bundle_runtime`) | **45 passed** |
| Full `npm run test:run` | **27 files / 291 tests passed** |
| `npm run build` | **Pass** |
| UI / catalog / bundle / package files | **Unchanged** |

---

## 7. Deviations

None material relative to the LS1I1R1 brief.

---

## 8. Next slice

```text
LS1I2 — Implement Entry Save Affordance
```

---

## Summary

| Field | Value |
| --- | --- |
| Decision | `LS1_PERSISTENCE_ATOMICITY_CONFIRMED` |
| Save | Single-tx get + create-only `add`; ConstraintError → winner |
| Timestamps | ISO round-trip validation for `created_at` / non-null `last_reviewed` |
