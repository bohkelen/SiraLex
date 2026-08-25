# PRODUCT2D — Noncommercial Publication Persistence

## 1. Decision

**PRODUCT2D_NONCOMMERCIAL_PUBLICATION_COMMITTED**

The explicitly authorized noncommercial release was audited against public bytes,
durable authorization evidence was added to tracked Git state, and the publication
tree was committed. Commercial use is **not** authorized.

## 2. Authorization event

| Field | Value |
|-------|-------|
| Decision | `authorize_noncommercial_publication` |
| Reviewer | `bohkelen` |
| Reviewed at | `2026-08-25T12:29:26Z` |
| Method | `explicit_statement_in_cursor_chat` |
| `publication_authorized` | `true` |
| Profile | `NONCOMMERCIAL_DISTRIBUTION` |
| Commercial authorization | **NO** |

Durable tracked record:

`shared/publication_authorizations/pubauth_542387db78552c18.json`

(`siralex_publication_authorization_record_v1`)

## 3. Exact release identity

| Field | Value |
|-------|-------|
| Semantic bundle id | `bundle_noncommercial_dfd5ba62` |
| Semantic content SHA | `sha256:dfd5ba62514caa72f9e282d16160ded01c26164c5c982fd6d164b78b6f7aeb33` |
| Semantic fingerprint | `sha256:77b9773c05750e9138971f64217c1071394406bdebdd48adc357d5f4c434c053` |
| Release artifact fingerprint | `sha256:51c38a75d5a663caf591d27b1b73da9b7ddc3776c7c96ff724deeaca4b078838` |
| Physical immutable path | `bundle_noncommercial_dfd5ba62__51c38a75` |

## 4. Six file hashes

| File | SHA-256 |
|------|---------|
| `records.jsonl` | `e18c2583a60e8e4a12ce0dc2f21f11cfc1ab2d7f8c9eeb3f2219d2ca8417c1fd` |
| `search_index.jsonl` | `1ab532d9885ea8fd1216936fd1564e950260f9015911b0f9a3908a1f6eb7e44a` |
| `bundle.manifest.json` | `4472c9e2602006d87975a29ac6b43807818bd85f5da71e24bc885cbd186f0e62` |
| `checksums.sha256` | `cf4ae66c4db75ac85fb9196a5483993f70f7d615f82137c026fdc918748933aa` |
| `ATTRIBUTION.txt` | `f9d747fef3acef5ab2f6800ae190d58c274cc5238eb26c75495c3ccd608aec6e` |
| `DATA_LICENSES.md` | `cdbec942ebd3ae8dfb5bd21f2925884a4fe94df7d4306ee72020ec54d52ee3c7` |

## 5. Rights posture

- Substantive source: `src_malipense`
- License: **CC BY-NC-SA 4.0**
- Posture: NONCOMMERCIAL_DISTRIBUTION_ALLOWED_SHAREALIKE
- Owner/SiraLex rows: **excluded** (0 included)
- Noncommercial only; commercial authorization: **NO**

## 6. Public destination

`web/public/bundle_noncommercial_dfd5ba62__51c38a75/`

Six distributed files only. Seal marker **not** distributed.

## 7. Catalog before/after

| | Value |
|--|-------|
| Before | 3 bundles (no `bundle_noncommercial_dfd5ba62`) |
| After | 4 bundles |
| New entry `url_base` | `./bundle_noncommercial_dfd5ba62__51c38a75/` |
| New entry `content_sha256` | `sha256:dfd5ba62514caa72f9e282d16160ded01c26164c5c982fd6d164b78b6f7aeb33` |
| New entry release fingerprint | `sha256:51c38a75d5a663caf591d27b1b73da9b7ddc3776c7c96ff724deeaca4b078838` |

## 8. Featured pointer before/after

| | Value |
|--|-------|
| Before | `bundle_full_20260710_337619ff` |
| After | `bundle_noncommercial_dfd5ba62` |
| Mechanism | `web/.env.production` → `VITE_FEATURED_BUNDLE_ID` |

## 9. Rollback target

`bundle_full_20260710_337619ff` remains addressable at
`web/public/bundle_full_20260710_337619ff__d076558b/`.

## 10. Public byte verification

Computed from `web/public/bundle_noncommercial_dfd5ba62__51c38a75/`:

- 6/6 files present
- 6/6 SHA-256 match authorization worksheet
- recomputed release fingerprint = `51c38a75…`
- directory suffix = `51c38a75`
- `verify_bundle` = valid
- unexpected files = 0
- seal marker = absent

## 11. Authorization / public byte equality

**PASS** — worksheet protected hashes equal public hashes; `can_publish` bind holds.

## 12. Durable authorization record

Tracked:

- `shared/publication_authorizations/pubauth_542387db78552c18.json`
  (record SHA-256: `2c3649366da44377f12ebeb3d93719aaa85f4fde993fb9efe0321568ffb899f6`)
- `shared/publication_authorizations/README.md`
- `shared/specs/publication-authorization-record-v1.md`

Gitignored operational evidence (not sole proof):

- `data/product2/publication_authorization_worksheet_v2.json`
- `data/product2/siralex_noncommercial_publication_transaction_receipt_v1.json`

## 13. Transaction receipt SHA

File SHA-256 of gitignored receipt (current bytes):

`e3074f13ca43c431e220249a0ace0da9b8f516b8730c559f014846d4fa3e04da`

(Embedded self-hash field in receipt: `5df39f05659aae5d8bd70769a4986f34622e2dd6ad438877d5722f7e955be811`
— hash of receipt body prior to embedding.)

## 14. Runtime / catalog validation

- Catalog parse: PASS
- Featured entry resolves to public path: PASS
- Offline install of public copy: covered by `web/src/product2d_public_publication.test.ts`
- Credits/Sources from public manifest: PASS
- Public search regression accounting: 26 PASS + 4 expected owner exclusions + 0 unexpected
- INTERNAL_FULL baseline: 30/0

## 15. Tests

See commit message / CI run summary for exact counts. Suites include
`publication_readiness`, distribution compliance, and public publication tests.

## 16. web/public diff

- added `web/public/bundle_noncommercial_dfd5ba62__51c38a75/**`
- updated `web/public/catalog.json`
- updated `web/.env.production`

No lexical/source truth changes. `web/scripts/` untouched.

## 17. Noncommercial-only boundary

This publication and authorization:

- authorize NONCOMMERCIAL distribution only
- preserve CC BY-NC-SA obligations
- do **not** authorize commercial exploitation
- do **not** authorize owner-governed excluded rows
- do **not** authorize future different release bytes

## 18. Commit

Pre-commit HEAD: `7e4ce3f5c9dda6131350ff76f030717fbfd430e8`

Publication commit subject: `Publish noncommercial SiraLex bundle`

Recommended next gate: **POST_PUBLICATION_MONITORING_AND_DICTIONARY_CORPUS_ROADMAP**
