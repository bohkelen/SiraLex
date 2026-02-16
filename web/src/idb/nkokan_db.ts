export const NKOKAN_DB_NAME = "nkokan_offline";
export const NKOKAN_DB_VERSION = 1;

export const STORE_META = "meta" as const;
export const STORE_RECORDS = "records" as const;
export const STORE_SEARCH_INDEX = "search_index" as const;

export type NkokanObjectStoreName =
  | typeof STORE_META
  | typeof STORE_RECORDS
  | typeof STORE_SEARCH_INDEX;

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

export async function openNkokanDb(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const req = indexedDB.open(NKOKAN_DB_NAME, NKOKAN_DB_VERSION);

    req.addEventListener("upgradeneeded", () => {
      const db = req.result;

      // v1: create the three canonical stores even if empty.
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        db.createObjectStore(STORE_RECORDS, { keyPath: "ir_id" });
      }
      if (!db.objectStoreNames.contains(STORE_SEARCH_INDEX)) {
        db.createObjectStore(STORE_SEARCH_INDEX, { keyPath: ["key_type", "key"] });
      }
    });

    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

export async function deleteNkokanDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(NKOKAN_DB_NAME);
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
  await new Promise<void>((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

export type ActiveBundleMeta = {
  bundle_id: string;
  manifest_schema_version: string;
  record_schema_id: string;
  record_schema_version: string;
  normalization_ruleset: string;
  update_mode: string;
  reconciliation_action: string;
  content_sha256?: string;
  imported_at_iso: string;
  records_count?: number;
  index_entries_count?: number;
};

export const META_ACTIVE_BUNDLE_KEY = "active_bundle";

export async function getActiveBundleMeta(db: IDBDatabase): Promise<ActiveBundleMeta | undefined> {
  return await metaGet<ActiveBundleMeta>(db, META_ACTIVE_BUNDLE_KEY);
}

export async function setActiveBundleMeta(db: IDBDatabase, meta: ActiveBundleMeta): Promise<void> {
  // IMPORTANT (Phase 2.0.3 atomicity invariant):
  // META_ACTIVE_BUNDLE_KEY MUST only be written AFTER both:
  // - records.jsonl import completes successfully, AND
  // - search_index.jsonl import completes successfully.
  //
  // Never mark a bundle "active" while import is in progress. If the page refreshes
  // mid-import, we intentionally prefer "no active bundle" (forcing a re-import)
  // over a partially-imported DB being treated as valid.
  await metaSet(db, META_ACTIVE_BUNDLE_KEY, meta);
}

