# Dictionary update summary v1

Optional catalog-side (or application-side) metadata for consumer dictionary update notices.

## Purpose

Expose friendly release notes for a catalog entry **without** mutating the immutable six-file release artifact.

## Placement

Prefer `update_summary` on a `bundle_catalog_v1` entry. Do not put mutable editorial text inside sealed release bytes.

## Fields

| Field | Required | Notes |
|-------|----------|-------|
| `schema_version` | no | `dictionary_update_summary_v1` when present |
| `title` | no | Short title; UI may fall back to i18n |
| `short_summary` | **yes** | Plain-language summary derived from measured product delta |
| `highlights` | no | Short bullet strings |
| `size_bytes` | no | Approximate download size |
| `applies_from_bundle_ids` | no | Prior catalog identities this note targets |

## Rules

- Do not invent claims that cannot be measured from published bundles.
- Do not expose developer identifiers (bundle ids, fingerprints, IndexedDB) in primary user copy.
- Primary UX may still fall back to i18n strings when `update_summary` is absent.
