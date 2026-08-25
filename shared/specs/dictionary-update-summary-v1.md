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
| `title` | no | English title; UI may fall back to i18n |
| `title_fr` | no | French title (same meaning) |
| `short_summary` | **yes** | English plain-language summary derived from measured product delta |
| `short_summary_fr` | no | French summary of the **same** measured facts |
| `highlights` | no | English short bullet strings |
| `highlights_fr` | no | French bullets (same facts) |
| `size_bytes` | no | Approximate download size |
| `applies_from_bundle_ids` | no | Prior catalog identities this note targets |

Nested locale maps are also accepted for compatibility:

```json
"short_summary": { "en": "...", "fr": "..." },
"highlights": { "en": ["..."], "fr": ["..."] }
```

## Runtime locale resolution

Uses the active SiraLex UI locale (`getCurrentLocale()`).

| Locale | Order |
|--------|--------|
| `fr` | catalog `*_fr` → French i18n → English catalog (last resort) |
| `en` | English catalog → English i18n |

Do not render blank text when a locale-specific field is absent.

## Rules

- Do not invent claims that cannot be measured from published bundles.
- French copy must communicate the same measured facts as English.
- Do not expose developer identifiers (bundle ids, fingerprints, IndexedDB) in primary user copy.
- Primary UX may still fall back to i18n strings when `update_summary` is absent.
- Legacy English-only `update_summary` remains valid.
