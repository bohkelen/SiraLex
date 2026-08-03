# CF2I4 — Manage Search Feedback and Export Report

## 1. Decision

```text
CF2_SEARCH_FEEDBACK_MANAGEMENT_EXPORT_IMPLEMENTED
```

Users can locally list, inspect, edit explanations, delete, and export-all CF2
search-feedback drafts. Exporting that evidence does not make it
community-visible, reviewed, submitted, or authoritative.

---

## 2. User loop

```text
Manage Search Feedback
→ list local search-feedback drafts
→ inspect
→ edit user-authored explanation
→ delete
→ export all validated feedback
→ retain drafts unchanged after export
```

---

## 3. Management placement

Distinct button near Saved Vocabulary / Manage Corrections / Manage Dictionaries:

```text
Manage Search Feedback
```

French: `Gérer les retours sur la recherche`.

CF1 `Manage Corrections` is unchanged. Surfaces remain separate products.

Reachable when feedback exists even if the originating dictionary is removed.

---

## 4. List semantics/order

Management order (CF2I2 comparator):

```text
updated_at desc → created_at desc → feedback_id asc
```

All bundles; no active-bundle filter.

Primary row shows query, result state, direction, updated time, optional meaning
preview, and dictionary availability. No `feedback_id` / hash / scope /
matched IDs in the primary row.

Corrupt stored row → whole surface `error` (`invalid_stored_feedback`).

---

## 5. Detail

Shows exact query, direction, result state, count, optional notes, timestamps,
availability, plus optional technical provenance (`bundle_id`, hash, scope,
`feedback_id`, `matched_ir_ids`).

---

## 6. Dictionary availability resolution

```ts
export function deriveSearchFeedbackAvailability(
  draft: SearchFeedbackDraftV1,
  installed: ActiveBundleMeta | undefined,
): SearchFeedbackAvailabilityState {
  if (!installed) return "dictionary_unavailable";
  const installedHash = installed.expected_content_sha256;
  if (
    typeof installedHash === "string" &&
    installedHash.trim() !== "" &&
    installedHash !== draft.content_sha256
  ) {
    return "dictionary_content_differs";
  }
  return "dictionary_current";
}
```

Uses logical `bundle_id` + content hash only. Does not rewrite
`storage_scope_id`. No automatic rerun or status mutation.

Neutral content-diff copy: recorded against an earlier dictionary version.

---

## 7. Editing boundary

Editable only: `requested_meaning`, `user_description`.

Immutable search-event fields are never accepted by the update API or edit UI.

Blank optional UI fields → absence; nonblank text preserved exactly.

---

## 8. Optimistic concurrency

Edit open retains `expected_updated_at = selected.updated_at`.

```ts
updateSearchFeedbackDraft(db, {
  feedback_id,
  expected_updated_at,
  requested_meaning,
  user_description,
}, { now })
```

On `stale_feedback`: no overwrite; reload current row; phase `stale_edit`;
require another edit action. No merge / last-write-wins.

---

## 9. Delete behavior

Explicit confirmation. Always supplies `expectedUpdatedAt`.

On stale delete: no delete; reload; phase `stale_delete`.

On success: reload list; refresh CF2 reminder; no tombstone.

Corrupt delete remains non-destructively blocked.

---

## 10. Export pipeline

```text
listSearchFeedbackDrafts
→ one readonly snapshot
→ validate all
→ buildSearchFeedbackPackage
→ serializeSearchFeedbackPackage
→ getSearchFeedbackUtf8ByteLength (25 MiB)
→ parseSearchFeedbackJson
→ Blob download
→ revoke object URL
```

Empty export disabled. Export does not mutate drafts. Repeat export allowed.

Filename: `siralex-search-feedback-YYYY-MM-DDTHH-mm-ssZ.json`.

Package order remains `bundle_id → created_at → feedback_id`.

---

## 11. Export authority semantics

UI warning:

```text
This file contains unreviewed search feedback.
It does not establish that dictionary entries are missing.
```

Package authority label is unchanged:

```text
unreviewed_search_failure_feedback_must_not_be_treated_as_missing_entry_truth
```

---

## 12. Determinism

Same feedback snapshot + `exportedAt` → same filename, schema, authority,
ordering, and serialized package content (CF2I1 serializers).

---

## 13. Browser download lifecycle

```ts
type SearchFeedbackDownloadAdapter = {
  createObjectURL(blob: Blob): string;
  clickDownload(url: string, filename: string): void;
  revokeObjectURL(url: string): void;
};
```

Always revokes in `finally`.

---

## 14. Database deletion reminder

Third independent reminder above Clear DB:

```text
Before deleting the database, export your search feedback if you want to keep it.
```

Action opens Manage Search Feedback. Not merged with Learning or CF1 reminders.

---

## 15. Generation/invalidation

Dedicated `searchFeedbackManagementGeneration` host lifetime.

CF2I3 `onFeedbackSaved` → invalidate generation + refresh reminder.

CF2I4 edit/delete → refresh model + reminder without destroying the session.

---

## 16. DB ownership

Production: `controller_owned` (every `openDb` closed in `finally`).

Tests: `caller_owned` for shared DB.

---

## 17. Privacy

Management privacy copy states exact searches + notes are included; exports are
plain JSON. No encryption/anonymity claims beyond no account/device identity
fields in CF2 packages.

---

## 18. Query-log isolation

Management/export never read or write query logs. Regression covered in session
and integration isolation snapshots.

---

## 19. CF1 isolation

Separate button, store, package schema, and session. No CF1 list/export/mutation.

---

## 20. Learning isolation

No Learning/LP1 coupling. CF2 not added to LP1 backup.

---

## 21. Community/server non-goal

```text
Manage Search Feedback → local management
Export → local file
Neither sends to server / other users / moderators
```

---

## 22. EN/FR

Namespace `searchFeedback.manage.*` (EN + FR). French focused tests assert no
English heading fallback.

---

## 23. Accessibility

Heading, semantic list, labeled edit fields, optional markers, counters, error
summary, stale announcements, delete confirmation, `aria-busy`, focus targets,
keyboard buttons, text availability states, N’Ko query attrs when detected.

---

## 24. Integration evidence

`search_feedback_management_integration.test.ts`:

- CF2I3 capture → manage list shows one row
- edit preserves immutable search event; updates explanation
- export reparses with production parser; IndexedDB unchanged
- delete → empty
- bundle remove → unavailable; edit/export still work
- bundle update H2 → content-diff; export still H1 hash
- isolation snapshots for CF1/Learning/query logs/dictionary stores

---

## 25. Tests

| Suite | Role |
| --- | --- |
| `search_feedback_management_session.test.ts` | load/order/corrupt/detail/availability/edit/stale/delete/export/ownership/isolation |
| `search_feedback_export.test.ts` | empty/one/multi/order/filename/schema/authority/N’Ko/IDs/corrupt/size/reparse/download revoke |
| `render_search_feedback_management.test.ts` | EN/FR UI states, no diagnosis/Submit, no primary-row internals |
| `search_feedback_management_integration.test.ts` | create→manage→edit→export→delete + bundle lifecycle |

---

## 26. Deviations

None material.

---

## 27. Files changed — exact `A/M/D` list

Generated after commit from `0ca58a4..HEAD` (CF2I3 → CF2I4). See final response
section 20 for the authoritative post-commit list.

---

## 28. Untracked files

See final response section 21 after commit.

---

## 29. Repository hygiene

Allowed-scope CF2I4 files only. No DB version/schema, CF2I1/I2/I3 semantics,
CF1, Learning, query-log, ranking, Playwright, Phase 1.5, or PV1 changes.

---

## 30. Next slice

```text
CF2I5 — Offline Search Feedback Lifecycle Verification
```

---

## High-risk excerpts

### Availability resolution

```ts
if (!installed) return "dictionary_unavailable";
if (installedHash && installedHash !== draft.content_sha256) {
  return "dictionary_content_differs";
}
return "dictionary_current";
```

### Optimistic update

```ts
const result = await updateSearchFeedbackDraft(db, {
  feedback_id: selected.feedback_id,
  expected_updated_at: expectedUpdatedAt,
  requested_meaning: validated.requested_meaning,
  user_description: validated.user_description,
}, { now: deps.now });
```

### Stale delete

```ts
const result = await deleteSearchFeedbackDraft(db, feedbackId, {
  expectedUpdatedAt: expected,
});
if (result.code === "stale_feedback") {
  // reload + phase = "stale_delete"
}
```

### Readonly export snapshot + reparse-before-download

```ts
feedbacks = await listSearchFeedbackDrafts(db);
return buildSearchFeedbackExportArtifact(feedbacks, options);
// inside builder: serialize → byte check → parseSearchFeedbackJson → artifact
```

### URL revoke

```ts
try {
  adapter.clickDownload(url, artifact.filename);
} finally {
  adapter.revokeObjectURL(url);
}
```

### Post-mutation reminder refresh

```ts
onFeedbackSaved: () => {
  invalidateSearchFeedbackManagementGeneration();
  void updateSearchFeedbackDeleteReminder();
},
onFeedbackChanged: () => {
  void updateSearchFeedbackDeleteReminder();
},
```
