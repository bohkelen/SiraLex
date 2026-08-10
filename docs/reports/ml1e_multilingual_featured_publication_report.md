# ML1E — Featured Multilingual Publication + Continuity Regression

## Decision

```text
ML1E_MULTILINGUAL_FEATURED_PUBLICATION_ACCEPTED
```

## BASE_COMMIT

```text
31d3ae94173269424f4a8d73e38e59a323e5f69a
```

`git log -1` at base: `31d3ae9 Remove Russian from consumer surfaces`.

This slice publishes the accepted ML1C1 English-capable candidate as the featured
production dictionary under the **same** logical `bundle_id`, and proves continuity
across Learning / Review / CF1 / CF2 / search preference / query-log / offline /
catalog update UX. It does **not** introduce new product features.

---

## Final publication contract

### OLD featured

| Field | Value |
|-------|-------|
| Logical `bundle_id` | `bundle_full_20260710_337619ff` |
| `content_sha256` | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| Physical path | `web/public/bundle_full_20260710_337619ff/` |
| Catalog `url_base` (pre) | `./bundle_full_20260710_337619ff/` |
| Catalog `version` (pre) | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` |
| Catalog `size_bytes` (pre) | `26169580` |
| Manifest capability | FR↔MNK only (`lookup_languages` / `search_key_families` absent) |

### NEW featured

| Field | Value |
|-------|-------|
| Logical `bundle_id` | `bundle_full_20260710_337619ff` (**unchanged**) |
| `content_sha256` | `sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a` |
| Published physical path | `web/public/bundle_full_20260710_337619ff__d076558b/` |
| Catalog `url_base` | `./bundle_full_20260710_337619ff__d076558b/` |
| Catalog `version` | `norm-v3-featured-ml1e-multilingual-en-index` |
| Catalog `size_bytes` | `29793679` |
| `storage_scope_id` | `bundle_full_20260710_337619ff::sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a` |

Stable logical bundle preserved: **PASS**.

---

## Continuity / contract invariants (preserved)

| Invariant | Result |
|-----------|--------|
| Same logical bundle identity | PASS |
| Immutable new physical artifact | PASS |
| Candidate byte-identical to published copy | PASS |
| Learning identity continuity `(bundle_id, ir_id)` | PASS |
| Review continuity | PASS |
| Old CF1 provenance retained (OLD hash/scope) | PASS |
| New CF1 new-hash provenance | PASS |
| Old CF2 provenance retained | PASS |
| New CF2 V2 new-hash provenance | PASS |
| EN preference false→true capability recovery | PASS |
| FR→MNK / EN→MNK / MNK→FR / MNK→EN production search | PASS |
| LookupMode-aware presentation | PASS |
| No Russian consumer fallback | PASS |
| No new RU CF1 target | PASS |
| Query-log V3 unchanged | PASS |
| IndexedDB remains v6 | PASS |
| No schema migrations | PASS |
| Offline FR/EN + Saved/Review/CF1/CF2 | PASS |
| One logical installed dictionary | PASS |
| PWA does not precache catalog or featured JSONL payloads | PASS |

---

## Candidate verification

Accepted ML1C1 artifact:

`data/local_evidence/ml1c1_english_index_candidate/bundles/bundle_full_20260710_337619ff__d076558b/`

| Check | Result |
|-------|--------|
| Artifact present | PASS |
| `verify_bundle()` candidate | PASS (`valid: true`, hash `d076558b…`) |
| `verify_bundle()` published | PASS |
| Logical `bundle_id` | `bundle_full_20260710_337619ff` |
| Candidate payload modified | **NO** |
| Byte identity (`cmp`) manifest/records/search_index/checksums | PASS |

---

## Catalog publication

`web/public/catalog.json` featured entry:

- same `bundle_id`
- new `content_sha256` / `size_bytes` / `version`
- `url_base` → immutable `./bundle_full_20260710_337619ff__d076558b/`
- not the unversioned old directory

`VITE_FEATURED_BUNDLE_ID=bundle_full_20260710_337619ff` (logical id unchanged).

---

## Manifest capabilities (new featured)

From published `bundle.manifest.json` (not hand-patched):

```json
{
  "languages": {
    "source_lang": "fr",
    "target_lang": "mnk",
    "lexical_language": "mnk",
    "lookup_languages": ["fr", "en", "mnk"]
  },
  "search_key_families": ["en", "src", "tgt"],
  "search_index_directional": true
}
```

---

## ML1EA high-risk final audit

### A. Versioned artifact directory validation

Accepted physical naming:

- legacy: `{bundle_id}`
- immutable versioned: `{bundle_id}__{first8(content_sha256)}`

Call sites pass manifest `content_sha256` so the suffix is checked against the hash
prefix (not arbitrary `__anything`).

**TypeScript** (`web/src/search_regression/run_matrix.ts`):

```ts
export function isAcceptableBundleArtifactDirName(
  dirBasename: string,
  bundleId: string,
  contentSha256?: string,
): boolean {
  if (dirBasename === bundleId) return true;
  const prefix = `${bundleId}__`;
  if (!dirBasename.startsWith(prefix)) return false;
  const hashPrefix = dirBasename.slice(prefix.length);
  if (!/^[0-9a-f]{8}$/i.test(hashPrefix)) return false;
  if (typeof contentSha256 === "string" && contentSha256.trim() !== "") {
    const hex = contentSha256.replace(/^sha256:/i, "").toLowerCase();
    if (!hex.startsWith(hashPrefix.toLowerCase())) return false;
  }
  return true;
}
```

**Python** (`api/search_regression/replay.py`):

```python
def is_acceptable_bundle_artifact_dir_name(
    dir_name: str, bundle_id: str, content_sha256: str | None = None
) -> bool:
    """Accept logical id dirname or ML1C1A `{bundle_id}__{content_sha256_prefix8}`."""
    if dir_name == bundle_id:
        return True
    prefix = f"{bundle_id}__"
    if not dir_name.startswith(prefix):
        return False
    hash_prefix = dir_name[len(prefix) :]
    if len(hash_prefix) != 8 or any(c not in "0123456789abcdefABCDEF" for c in hash_prefix):
        return False
    if isinstance(content_sha256, str) and content_sha256.strip():
        hex_part = content_sha256.split(":", 1)[-1].lower()
        if not hex_part.startswith(hash_prefix.lower()):
            return False
    return True
```

TS and Python agree: **PASS**.

### B. IndexedDB cursor deletion

**Final** `deleteStoreRowsByBundleId` (`web/src/idb/siralex_db.ts`):

```ts
async function deleteStoreRowsByBundleId(
  db: IDBDatabase,
  storeName: typeof STORE_RECORDS | typeof STORE_SEARCH_INDEX,
  bundleId: string,
): Promise<void> {
  // Cursor delete avoids getAllKeys() materializing 100k+ primary keys in memory
  // (pathological on same-ID featured updates in fake-indexeddb / large scopes).
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const index = store.index(INDEX_BY_BUNDLE_ID);
  await new Promise<void>((resolve, reject) => {
    const cursorReq = index.openCursor(IDBKeyRange.only(bundleId));
    cursorReq.addEventListener("error", () => reject(cursorReq.error));
    cursorReq.addEventListener("success", () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    });
  });
  await txDone(tx);
}
```

`txDone` rejects on transaction `error` / `abort` (not swallowed):

```ts
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}
```

| Requirement | Result |
|-------------|--------|
| `readwrite` transaction | PASS |
| `INDEX_BY_BUNDLE_ID` | PASS |
| `IDBKeyRange.only(bundleId/storageScopeId)` | PASS (`deleteBundleScopeData` passes scope id) |
| Cursor iterates matching rows only | PASS |
| `cursor.delete()` in same transaction | PASS |
| `cursor.continue()` | PASS |
| Request error rejects | PASS |
| Transaction completion awaited | PASS (`await txDone`) |
| Abort/error not swallowed | PASS |
| No `getAllKeys()` on this path | PASS (`YES` removed) |

---

## Same-ID update lifecycle

| Layer | Proof |
|-------|-------|
| Catalog update when installed hash is old | Vitest + E2E |
| Active `bundle_id` unchanged; hash/scope move to `d076558b…` | PASS |
| No Learning / IndexedDB schema bump | PASS (`SIRALEX_DB_VERSION = 6`) |

Vitest cannot stage two full featured payloads under fake-indexeddb in bounded time.
Real-browser OLD→NEW dual-scope update: `web/e2e/ml1e_featured_update_continuity.spec.ts`.

---

## English index sanity

Exact counts on published artifact (byte-identical to ML1C1):

| Metric | Value |
|--------|------:|
| `en_*` rows | 34913 |
| Unique `en_casefold` keys | 8737 |
| `src_*` rows | 43729 |
| `tgt_*` rows | 68536 |

Phase 7L against NEW immutable featured path: **13/13** (see final validation).

---

## PWA cache audit

Production `generateSW` precaches shell assets only (typically 6 entries).

**Does not** precache:

- `catalog.json`
- `records.jsonl` / `search_index.jsonl`
- `bundle_full_20260710_337619ff/`
- `bundle_full_20260710_337619ff__d076558b/`

PWA stale-cache risk for featured artifact: **NONE**.

---

## Schema assertions

| Schema | Result |
|--------|--------|
| IndexedDB | **6** |
| Learning | unchanged |
| CF1 | `correction_draft_v1` |
| CF2 | V1 historical + V2 new |
| Query log | V3 |
| Bundle manifest | `bundle_manifest_v1` |

---

## Exact publication files

**Changed (publication / proofs / harness):**

- `web/public/catalog.json`
- `web/public/bundle_full_20260710_337619ff__d076558b/bundle.manifest.json`
- `web/public/bundle_full_20260710_337619ff__d076558b/checksums.sha256`
- `web/public/bundle_full_20260710_337619ff__d076558b/records.jsonl`
- `web/public/bundle_full_20260710_337619ff__d076558b/search_index.jsonl`
- Phase7 featured identity pins + ML1E tests/E2E
- ML1EA regression basename gate + IDB cursor delete

**Candidate artifact files NOT changed:**

- `data/local_evidence/ml1c1_english_index_candidate/bundles/bundle_full_20260710_337619ff__d076558b/*`
- Old featured tree `web/public/bundle_full_20260710_337619ff/*` retained

---

## Final validation

| Command | Result |
|---------|--------|
| `verify_bundle` candidate | PASS |
| `verify_bundle` published | PASS |
| Candidate/published byte identity | PASS |
| `npm --prefix web run test:run` | 100 files / 979 tests PASS |
| Phase 7L on NEW immutable path | **13/13 PASS** (`ml1e_featured_publication.test.ts`) |
| `npm --prefix web run test:e2e:ml1e` | **1 passed (28.4m)** |
| `test:e2e:ml1d3` | **7 passed** |
| `test:e2e:rl1` | **4 passed** |
| `test:e2e:ux2-search` | **2 passed** |
| `test:e2e:ux2-entry` | **4 passed** |
| `test:e2e:ux2-saved` | **2 passed** |
| `test:e2e:ux2-review` | **2 passed** |
| `test:e2e:ls1` | **1 passed** |
| `test:e2e:ls2` | **5 passed** |
| `test:e2e:corrections` | **7 passed** |
| `test:e2e:search-feedback` | **7 passed** |
| `test:e2e:ux2-search-feedback` | **4 passed** |
| `npm --prefix web run build` | PASS (precache 6 shell entries; no catalog/JSONL/bundles) |
| `git diff --check` | PASS |

Local evidence (gitignored):

- `data/local_evidence/ml1e_multilingual_featured_publication/baseline_before.json`
- `data/local_evidence/ml1e_multilingual_featured_publication/after_publication.json`

---

## Commit

Created after independent review + final reconciliation gate.

Message: `Publish multilingual featured dictionary`
