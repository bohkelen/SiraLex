export const SIRALEX_DB_NAME = "siralex_db";
export const SIRALEX_DB_VERSION = 2;

export const STORE_META = "meta" as const;
export const STORE_RECORDS = "records" as const;
export const STORE_SEARCH_INDEX = "search_index" as const;
export const STORE_BUNDLES_REGISTRY = "bundles_registry" as const;

const INDEX_BY_BUNDLE_ID = "by_bundle_id";

export type SiralexObjectStoreName =
  | typeof STORE_META
  | typeof STORE_RECORDS
  | typeof STORE_SEARCH_INDEX
  | typeof STORE_BUNDLES_REGISTRY;

export type BundleLanguageMeta = {
  source_lang?: string;
  target_lang?: string;
  source_label?: string;
  target_label?: string;
  target_scripts?: string[];
};

export type ActiveBundleMeta = {
  bundle_id: string;
  storage_scope_id?: string;
  manifest_schema_version: string;
  record_schema_id: string;
  record_schema_version: string;
  normalization_ruleset: string;
  update_mode: string;
  reconciliation_action: string;
  expected_content_sha256?: string;
  imported_at_iso: string;
  records_count?: number;
  index_entries_count?: number;
  language_meta?: BundleLanguageMeta;
};

export type CachedBundleCatalog = {
  request_url: string;
  response_url: string;
  fetched_at_iso: string;
  warnings: string[];
  catalog: {
    catalog_schema_version: string;
    bundles: Array<{
      bundle_id: string;
      name: string;
      version?: string;
      size_bytes: number;
      url_base: string;
      content_sha256: string;
      language_meta?: {
        source_lang?: string;
        target_lang?: string;
        source_label?: string;
        target_label?: string;
      };
    }>;
  };
};

export type BundleInstallSession = {
  bundle_id: string;
  storage_scope_id: string;
  started_at_iso: string;
  phase: "staging" | "committed";
  previous_storage_scope_id?: string;
};

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

export async function openSiralexDb(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const req = indexedDB.open(SIRALEX_DB_NAME, SIRALEX_DB_VERSION);

    req.addEventListener("upgradeneeded", (event) => {
      const db = req.result;
      const tx = req.transaction;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }

      // Phase 3 storage migration: recreate bundle-scoped stores and clear legacy meta.
      // Previous installs are development-only at this stage, so we intentionally
      // reset the old single-bundle schema instead of attempting a complex
      // in-place migration into bundle-scoped storage.
      if (oldVersion < 2) {
        if (db.objectStoreNames.contains(STORE_RECORDS)) {
          db.deleteObjectStore(STORE_RECORDS);
        }
        if (db.objectStoreNames.contains(STORE_SEARCH_INDEX)) {
          db.deleteObjectStore(STORE_SEARCH_INDEX);
        }
        if (db.objectStoreNames.contains(STORE_BUNDLES_REGISTRY)) {
          db.deleteObjectStore(STORE_BUNDLES_REGISTRY);
        }
      }

      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const records = db.createObjectStore(STORE_RECORDS, { keyPath: ["bundle_id", "ir_id"] });
        records.createIndex(INDEX_BY_BUNDLE_ID, "bundle_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SEARCH_INDEX)) {
        const searchIndex = db.createObjectStore(STORE_SEARCH_INDEX, { keyPath: ["bundle_id", "key_type", "key"] });
        searchIndex.createIndex(INDEX_BY_BUNDLE_ID, "bundle_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_BUNDLES_REGISTRY)) {
        db.createObjectStore(STORE_BUNDLES_REGISTRY, { keyPath: "bundle_id" });
      }

      if (oldVersion < 2 && tx != null) {
        tx.objectStore(STORE_META).clear();
      }
    });

    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

export async function deleteSiralexDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(SIRALEX_DB_NAME);
    req.addEventListener("success", () => resolve());
    req.addEventListener("error", () => reject(req.error));
    req.addEventListener("blocked", () => {
      reject(new Error("IndexedDB delete blocked (close other tabs using this app)."));
    });
  });
}

export async function metaGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  const tx = db.transaction(STORE_META, "readonly");
  const store = tx.objectStore(STORE_META);
  const req = store.get(key);
  const val = await reqToPromise(req);
  return val as T | undefined;
}

export async function metaSet<T>(db: IDBDatabase, key: string, value: T): Promise<void> {
  const tx = db.transaction(STORE_META, "readwrite");
  const store = tx.objectStore(STORE_META);
  store.put(value, key);
  await txDone(tx);
}

export async function metaDelete(db: IDBDatabase, key: string): Promise<void> {
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).delete(key);
  await txDone(tx);
}

export const META_ACTIVE_BUNDLE_ID_KEY = "active_bundle_id";
export const META_CACHED_BUNDLE_CATALOG_KEY = "cached_bundle_catalog";
export const META_BUNDLE_INSTALL_SESSION_KEY = "bundle_install_session";

export async function getActiveBundleId(db: IDBDatabase): Promise<string | undefined> {
  return await metaGet<string>(db, META_ACTIVE_BUNDLE_ID_KEY);
}

export async function setActiveBundleId(db: IDBDatabase, bundleId: string): Promise<void> {
  await metaSet(db, META_ACTIVE_BUNDLE_ID_KEY, bundleId);
}

export async function clearActiveBundleId(db: IDBDatabase): Promise<void> {
  await metaDelete(db, META_ACTIVE_BUNDLE_ID_KEY);
}

export async function getInstalledBundleMeta(
  db: IDBDatabase,
  bundleId: string,
): Promise<ActiveBundleMeta | undefined> {
  const tx = db.transaction(STORE_BUNDLES_REGISTRY, "readonly");
  const req = tx.objectStore(STORE_BUNDLES_REGISTRY).get(bundleId);
  const value = await reqToPromise(req);
  return value as ActiveBundleMeta | undefined;
}

export function getBundleStorageScopeId(meta: Pick<ActiveBundleMeta, "bundle_id" | "storage_scope_id">): string {
  return meta.storage_scope_id ?? meta.bundle_id;
}

export async function listInstalledBundles(db: IDBDatabase): Promise<ActiveBundleMeta[]> {
  const tx = db.transaction(STORE_BUNDLES_REGISTRY, "readonly");
  const req = tx.objectStore(STORE_BUNDLES_REGISTRY).getAll();
  const value = await reqToPromise(req);
  return (value as ActiveBundleMeta[]).sort((a, b) => a.bundle_id.localeCompare(b.bundle_id));
}

export async function putInstalledBundleMeta(db: IDBDatabase, meta: ActiveBundleMeta): Promise<void> {
  const tx = db.transaction(STORE_BUNDLES_REGISTRY, "readwrite");
  tx.objectStore(STORE_BUNDLES_REGISTRY).put(meta);
  await txDone(tx);
}

export async function deleteInstalledBundleMeta(db: IDBDatabase, bundleId: string): Promise<void> {
  const tx = db.transaction(STORE_BUNDLES_REGISTRY, "readwrite");
  tx.objectStore(STORE_BUNDLES_REGISTRY).delete(bundleId);
  await txDone(tx);
}

export async function getCachedBundleCatalog(db: IDBDatabase): Promise<CachedBundleCatalog | undefined> {
  return await metaGet<CachedBundleCatalog>(db, META_CACHED_BUNDLE_CATALOG_KEY);
}

export async function setCachedBundleCatalog(db: IDBDatabase, cached: CachedBundleCatalog): Promise<void> {
  await metaSet(db, META_CACHED_BUNDLE_CATALOG_KEY, cached);
}

export async function clearCachedBundleCatalog(db: IDBDatabase): Promise<void> {
  await metaDelete(db, META_CACHED_BUNDLE_CATALOG_KEY);
}

export async function getBundleInstallSession(db: IDBDatabase): Promise<BundleInstallSession | undefined> {
  return await metaGet<BundleInstallSession>(db, META_BUNDLE_INSTALL_SESSION_KEY);
}

export async function setBundleInstallSession(db: IDBDatabase, session: BundleInstallSession): Promise<void> {
  await metaSet(db, META_BUNDLE_INSTALL_SESSION_KEY, session);
}

export async function clearBundleInstallSession(db: IDBDatabase): Promise<void> {
  await metaDelete(db, META_BUNDLE_INSTALL_SESSION_KEY);
}

export async function getActiveBundleMeta(db: IDBDatabase): Promise<ActiveBundleMeta | undefined> {
  const activeBundleId = await getActiveBundleId(db);
  if (!activeBundleId) return undefined;
  return await getInstalledBundleMeta(db, activeBundleId);
}

export async function storeHasData(db: IDBDatabase, storeName: SiralexObjectStoreName): Promise<boolean> {
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const count = await reqToPromise(store.count());
  return count > 0;
}

async function deleteStoreRowsByBundleId(
  db: IDBDatabase,
  storeName: typeof STORE_RECORDS | typeof STORE_SEARCH_INDEX,
  bundleId: string,
): Promise<void> {
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const index = store.index(INDEX_BY_BUNDLE_ID);
  const primaryKeys = await reqToPromise(index.getAllKeys(IDBKeyRange.only(bundleId)));
  for (const key of primaryKeys) {
    store.delete(key);
  }
  await txDone(tx);
}

export async function deleteBundleScopeData(db: IDBDatabase, storageScopeId: string): Promise<void> {
  await deleteStoreRowsByBundleId(db, STORE_RECORDS, storageScopeId);
  await deleteStoreRowsByBundleId(db, STORE_SEARCH_INDEX, storageScopeId);
}

export async function deleteBundleData(db: IDBDatabase, bundleId: string): Promise<void> {
  const installed = await getInstalledBundleMeta(db, bundleId);
  await deleteBundleScopeData(db, installed ? getBundleStorageScopeId(installed) : bundleId);
  await deleteInstalledBundleMeta(db, bundleId);
  const activeBundleId = await getActiveBundleId(db);
  if (activeBundleId === bundleId) {
    await clearActiveBundleId(db);
  }
}

export async function setActiveBundleMeta(db: IDBDatabase, meta: ActiveBundleMeta): Promise<void> {
  // IMPORTANT:
  // The active bundle pointer must only be updated after both bundle payloads
  // are fully imported and the registry entry has been written successfully.
  await putInstalledBundleMeta(db, meta);
  await setActiveBundleId(db, meta.bundle_id);
}

export async function recoverInterruptedBundleInstall(db: IDBDatabase): Promise<string | undefined> {
  const session = await getBundleInstallSession(db);
  if (!session) return undefined;

  if (session.phase === "staging") {
    await deleteBundleScopeData(db, session.storage_scope_id);
    await clearBundleInstallSession(db);
    return `Recovered interrupted staged install for ${session.bundle_id}. Partial staged data was removed.`;
  }

  if (session.previous_storage_scope_id && session.previous_storage_scope_id !== session.storage_scope_id) {
    await deleteBundleScopeData(db, session.previous_storage_scope_id);
  }
  await clearBundleInstallSession(db);
  return `Recovered committed install for ${session.bundle_id}. Previous bundle data cleanup completed.`;
}
