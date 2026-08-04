# FH1A — Explicit Review Destination Amendment

## Decision

```text
FH1_REVIEW_DESTINATION_AMENDMENT_IMPLEMENTED
```

FH1 remains accepted (`FH1_FEEDBACK_REVIEW_HANDOFF_IMPLEMENTED`). This amendment makes the configured review inbox explicit during handoff without claiming delivery.

---

## Gap corrected

Web Share can attach a file but cannot standardize “open email pre-addressed to X with this attachment.”

```text
share success ≠ email to owner's inbox
```

Desktop mailto fallback was already destination-aware. The share path was not.

---

## Required behavior (implemented)

```text
configured review email (VITE_FEEDBACK_EMAIL)
→ displayed in privacy/handoff confirmation (EN/FR)
→ included in Web Share text
→ remains pre-addressed in mailto fallback
```

Address comes from configuration only — never hard-coded in translations.

Confirm UI now includes:

- heading (“Send this feedback to SiraLex review” / “Envoyer ce retour pour révision”)
- local-only privacy warning
- “Share the feedback file with {email}.” (mailto link)
- “On the next screen, choose your email app…”

Share text conceptually:

```text
SiraLex … feedback for review.
Please send this file to {email}.
```

---

## Invariants kept

- Draft `status` remains `"draft"`
- No submitted / sent / received claims
- `{ ok: true, method: "share" }` means share handoff completed, not delivered
- No schema, IndexedDB, backend, or export-format changes

---

## Production configuration

Current production env sets:

```text
VITE_FEEDBACK_EMAIL=diabilasekou@gmail.com
```

Operational closure completed in PVR1 (`docs/reports/pvr1_theme_feedback_production_resmoke_report.md`):

```text
FH1_PRODUCTION_HANDOFF_OPERATIONAL
```

after production Send-for-review + operator-confirmed inbox receipt.

Prefer migrating later to a durable inbox (`feedback@siralex.org` or equivalent) without changing user-facing destination semantics beyond the configured value.

---

## Verification

- Unit: share text / mailto recipient carry configured inbox; confirm UI EN/FR shows email; drafts unchanged
- Playwright handoff smoke: destination visible; Web Share text contains inbox; package schemas preserved

---

## Status

```text
FH1_FEEDBACK_REVIEW_HANDOFF_IMPLEMENTED   — Accepted
FH1_REVIEW_DESTINATION_AMENDMENT_IMPLEMENTED — Complete
FH1_PRODUCTION_HANDOFF_OPERATIONAL — PVR1 verified
```
