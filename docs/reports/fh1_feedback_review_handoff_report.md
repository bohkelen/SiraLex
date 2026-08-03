# FH1 — Feedback Review Handoff

## Decision

```text
FH1_FEEDBACK_REVIEW_HANDOFF_IMPLEMENTED
```

SiraLex can prepare existing CF1/CF2 governed export packages for external review without creating a second feedback format, without changing draft status, and without claiming delivery or receipt.

---

## Operating loop

```text
CF1 / CF2
  → local draft
  → prepare existing governed export
  → explicit "Send for review"
  → privacy confirmation
  → native file share when supported
       OR download + prepared email fallback
  → owner's review inbox
```

---

## Core architectural rule

Do **not** create a second feedback format.

Reuse exactly:

```text
CF1 → siralex_correction_feedback_v1
CF2 → siralex_search_feedback_v1
```

Transport moves the existing artifact. It does not reinterpret it.

Module:

```text
web/src/feedback/feedback_handoff.ts
```

Unify transport, not evidence models.

---

## Configuration

```text
VITE_FEEDBACK_EMAIL
```

- No personal email hard-coded in modules or translations.
- If absent/invalid: Export remains available; Send for review is disabled with an understandable message.
- Commented placeholder only in `web/.env.production` (operator must set a real inbox).

---

## User-facing actions

On Manage Corrections and Manage Search Feedback:

```text
Export
Send for review
```

EN/FR.

Privacy confirmation before leave-device transport:

> This feedback is currently stored only on this device. Continuing may share the exported feedback file with another app or email service.

```text
Cancel
Continue
```

---

## Transport

1. Capability check: `navigator.share` + `navigator.canShare({ files })`
2. If supported: build production export → `File` → `navigator.share({ files })`
3. Else: download governed JSON + open pre-addressed `mailto:` and explain that the file must be attached

Same validator/package/reparse pipeline as Export is reused before handoff.

---

## Status semantics

```text
navigator.share() resolves  ≠  moderator received it
mailto opened               ≠  email sent
```

Draft `status` remains `"draft"`. No schema changes. No submitted/sent/received states.

Copy:

```text
Feedback prepared for sharing.
```

Fallback:

```text
The feedback file was downloaded and your email app was opened.
Attach the downloaded file before sending.
```

Never: “Feedback submitted successfully.”

---

## Offline behavior

```text
Capture / manage / export → offline-capable
External delivery         → transport-dependent
```

CF1/CF2 local offline behavior is unchanged.

---

## Verification

### Unit

- `web/src/feedback/feedback_handoff.test.ts` — email config, package bridging, share, cancel, fallback mailto
- `web/src/feedback/feedback_handoff_session.test.ts` — CF1/CF2 packages unchanged; drafts remain draft; unavailable email keeps Export

### Browser smoke

`npm run test:e2e:handoff` (build with test `VITE_FEEDBACK_EMAIL` + mocked Web Share):

- CF2 privacy confirm EN/FR; cancel; share receives governed package; drafts remain listed
- CF1 share branch with governed `siralex_correction_feedback_v1`

Result: **PASS** (Chromium). Physical Android sharing remains PV1B.

---

## Explicit non-goals

- No new package schema
- No draft status expansion
- No server upload endpoint
- No hard-coded review inbox in source
- No weakening of CF1/CF2 offline capture
