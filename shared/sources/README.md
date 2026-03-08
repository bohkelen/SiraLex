# Source Registry entries

This directory contains **source registry entries** (YAML files) for each data source SiraLex ingests.

See `shared/specs/source-registry.md` for field definitions and requirements.

## Files

- `malipense.yaml` — Mali-pense / Malidaba French → Maninka dictionary (Phase 1 primary source)

## Adding a new source

1. Create a new YAML file named after the source (e.g., `newsource.yaml`).
2. Include all required fields from `source-registry.md`.
3. Set `contact_status: "not_attempted"` until outreach is done.
4. Open a PR with the `data` and `sources` labels.

## License status lifecycle

Source entries MUST track license/permission status through these stages:

| Status | Meaning |
|--------|---------|
| `unknown` | No license information found on site |
| `claimed` | License text found on site (record `license_evidence_url`) |
| `pending` | Outreach sent; awaiting response |
| `confirmed` | Explicit permission received (record date + evidence) |
| `denied` | Permission explicitly refused (do not ingest) |
| `conditional` | Permission granted with conditions (document them) |

After any outreach attempt:
- Update `contact_status` to `attempted`, `responded`, `granted`, or `denied`
- Update `contact_attempted_at` with the date
- Add notes to `license_inference_note` documenting what was communicated

## Legal/ethics review labels

When opening PRs that affect source data or licensing:

| Label | When to use |
|-------|-------------|
| `sources` | Any change to source registry entries |
| `data` | Any change affecting ingested data |
| `legal` | License questions, permission status changes, takedown requests |
| `ethics-review` | Content that may have cultural sensitivity (consult before merging) |

For PRs touching `legal` or `ethics-review`, request explicit maintainer sign-off before merging.

## Removal / disable process

If a source must be disabled:

1. Set `disabled_at` to the current ISO-8601 timestamp.
2. Set `disable_reason` explaining why (takedown request, license issue, etc.).
3. Do NOT delete the file — keep it for audit trail.
4. Open an issue using the "Data removal / source maintainer request" template.
