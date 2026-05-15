import {
  QUERY_LOG_INDEX_BY_BUNDLE_ID,
  QUERY_LOG_INDEX_BY_STORAGE_SCOPE_ID,
  STORE_QUERY_LOGS,
} from "../idb/siralex_db";
import type {
  AppendQueryLogInput,
  ExportQueryLogsOptions,
  ListQueryLogsOptions,
  ListRecentQueryLogsOptions,
  QueryLogDirection,
  QueryLogEventV1,
  QueryLogLadderLevel,
  QueryLogNormalizedKeys,
  QueryLogScopeFilter,
} from "./query_log_types";

const QUERY_LOG_SCHEMA_VERSION = "query_log_event_v1" as const;

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isValidDirection(value: unknown): value is QueryLogDirection {
  return value === "source_to_target" || value === "target_to_source";
}

function isValidLadderLevel(value: unknown): value is QueryLogLadderLevel {
  return (
    value === "casefold" ||
    value === "diacritics_insensitive" ||
    value === "punct_stripped" ||
    value === "nospace" ||
    value === "none"
  );
}

function validateNormalizedKeys(value: unknown): asserts value is QueryLogNormalizedKeys {
  if (typeof value !== "object" || value === null) {
    throw new Error("appendQueryLog: query_normalized_keys must be an object");
  }

  const record = value as Record<string, unknown>;
  const requiredKeys: Array<keyof QueryLogNormalizedKeys> = [
    "casefold",
    "diacritics_insensitive",
    "punct_stripped",
    "nospace",
  ];

  for (const key of requiredKeys) {
    if (!isStringArray(record[key])) {
      throw new Error(`appendQueryLog: query_normalized_keys.${key} must be a string[]`);
    }
  }
}

function validateAppendInput(input: AppendQueryLogInput): void {
  if (typeof input.query_raw !== "string") {
    throw new Error("appendQueryLog: query_raw must be a string");
  }
  validateNormalizedKeys(input.query_normalized_keys);

  if (!isValidDirection(input.direction)) {
    throw new Error("appendQueryLog: direction must be source_to_target or target_to_source");
  }
  if (!isValidLadderLevel(input.ladder_level_hit)) {
    throw new Error("appendQueryLog: ladder_level_hit must be a supported ladder level");
  }
  if (!Number.isInteger(input.ir_ids_count) || input.ir_ids_count < 0) {
    throw new Error("appendQueryLog: ir_ids_count must be an integer >= 0");
  }
  if (!isNonEmptyString(input.bundle_id)) {
    throw new Error("appendQueryLog: bundle_id must be a non-empty string");
  }
  if (input.bundle_version !== undefined && !isNonEmptyString(input.bundle_version)) {
    throw new Error("appendQueryLog: bundle_version must be omitted or a non-empty string");
  }
  if (!isNonEmptyString(input.storage_scope_id)) {
    throw new Error("appendQueryLog: storage_scope_id must be a non-empty string");
  }
  if (!isNonEmptyString(input.norm_version)) {
    throw new Error("appendQueryLog: norm_version must be a non-empty string");
  }
  if (!isNonEmptyString(input.app_version)) {
    throw new Error("appendQueryLog: app_version must be a non-empty string");
  }
  if (!isNonEmptyString(input.timestamp_iso)) {
    throw new Error("appendQueryLog: timestamp_iso must be a non-empty string");
  }
  if (input.logging_enabled !== true) {
    throw new Error("appendQueryLog: logging_enabled must be true");
  }
}

function cloneEvent(row: QueryLogEventV1): QueryLogEventV1 {
  return {
    ...row,
    query_normalized_keys: {
      casefold: [...row.query_normalized_keys.casefold],
      diacritics_insensitive: [...row.query_normalized_keys.diacritics_insensitive],
      punct_stripped: [...row.query_normalized_keys.punct_stripped],
      nospace: [...row.query_normalized_keys.nospace],
    },
  };
}

async function getAllForFilter(
  db: IDBDatabase,
  filter: QueryLogScopeFilter,
): Promise<QueryLogEventV1[]> {
  const tx = db.transaction(STORE_QUERY_LOGS, "readonly");
  const store = tx.objectStore(STORE_QUERY_LOGS);

  let rows: QueryLogEventV1[];
  if (filter.storage_scope_id) {
    rows = (await reqToPromise(
      store.index(QUERY_LOG_INDEX_BY_STORAGE_SCOPE_ID).getAll(IDBKeyRange.only(filter.storage_scope_id)),
    )) as QueryLogEventV1[];
  } else if (filter.bundle_id) {
    rows = (await reqToPromise(
      store.index(QUERY_LOG_INDEX_BY_BUNDLE_ID).getAll(IDBKeyRange.only(filter.bundle_id)),
    )) as QueryLogEventV1[];
  } else {
    rows = (await reqToPromise(store.getAll())) as QueryLogEventV1[];
  }

  await txDone(tx);

  if (filter.bundle_id && filter.storage_scope_id) {
    rows = rows.filter(
      (row) => row.bundle_id === filter.bundle_id && row.storage_scope_id === filter.storage_scope_id,
    );
  }

  rows.sort((a, b) => (a.log_id ?? 0) - (b.log_id ?? 0));
  return rows.map(cloneEvent);
}

export async function appendQueryLog(db: IDBDatabase, input: AppendQueryLogInput): Promise<number> {
  validateAppendInput(input);

  const tx = db.transaction(STORE_QUERY_LOGS, "readwrite");
  const store = tx.objectStore(STORE_QUERY_LOGS);
  const row: QueryLogEventV1 = {
    schema_version: QUERY_LOG_SCHEMA_VERSION,
    ...input,
    query_normalized_keys: {
      casefold: [...input.query_normalized_keys.casefold],
      diacritics_insensitive: [...input.query_normalized_keys.diacritics_insensitive],
      punct_stripped: [...input.query_normalized_keys.punct_stripped],
      nospace: [...input.query_normalized_keys.nospace],
    },
  };

  const key = await reqToPromise(store.add(row));
  await txDone(tx);
  return Number(key);
}

export async function listQueryLogs(
  db: IDBDatabase,
  options: ListQueryLogsOptions = {},
): Promise<QueryLogEventV1[]> {
  const rows = await getAllForFilter(db, options);
  const ordered = options.newest_first ? [...rows].reverse() : rows;
  if (options.limit === undefined) {
    return ordered;
  }
  return ordered.slice(0, Math.max(0, options.limit));
}

/**
 * Newest-first slice without loading the full table: walks the primary key or an
 * index with a reverse cursor until `limit` matching rows are collected.
 */
export async function listRecentQueryLogs(
  db: IDBDatabase,
  options: ListRecentQueryLogsOptions,
): Promise<QueryLogEventV1[]> {
  const limit = Math.max(0, Math.floor(options.limit));
  if (limit === 0) {
    return [];
  }

  const tx = db.transaction(STORE_QUERY_LOGS, "readonly");
  const store = tx.objectStore(STORE_QUERY_LOGS);

  const rows = await new Promise<QueryLogEventV1[]>((resolve, reject) => {
    const out: QueryLogEventV1[] = [];

    const rowMatchesFilter = (row: QueryLogEventV1): boolean => {
      if (options.bundle_id && options.storage_scope_id) {
        return row.bundle_id === options.bundle_id && row.storage_scope_id === options.storage_scope_id;
      }
      if (options.storage_scope_id) {
        return row.storage_scope_id === options.storage_scope_id;
      }
      if (options.bundle_id) {
        return row.bundle_id === options.bundle_id;
      }
      return true;
    };

    let req: IDBRequest<IDBCursorWithValue | null>;
    if (options.storage_scope_id) {
      req = store
        .index(QUERY_LOG_INDEX_BY_STORAGE_SCOPE_ID)
        .openCursor(IDBKeyRange.only(options.storage_scope_id), "prev");
    } else if (options.bundle_id) {
      req = store.index(QUERY_LOG_INDEX_BY_BUNDLE_ID).openCursor(IDBKeyRange.only(options.bundle_id), "prev");
    } else {
      req = store.openCursor(null, "prev");
    }

    req.addEventListener("success", () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }

      const value = cursor.value as QueryLogEventV1;
      if (rowMatchesFilter(value)) {
        out.push(value);
        if (out.length >= limit) {
          resolve(out);
          return;
        }
      }
      cursor.continue();
    });
    req.addEventListener("error", () => reject(req.error));
  });

  await txDone(tx);
  return rows.map(cloneEvent);
}

export async function countQueryLogs(
  db: IDBDatabase,
  options: QueryLogScopeFilter = {},
): Promise<number> {
  const rows = await getAllForFilter(db, options);
  return rows.length;
}

export async function exportQueryLogsJsonl(
  db: IDBDatabase,
  options: ExportQueryLogsOptions = {},
): Promise<Blob> {
  const rows = await listQueryLogs(db, { ...options, newest_first: false });
  const text = rows.map((row) => JSON.stringify(row)).join("\n");
  const jsonl = text === "" ? "" : `${text}\n`;
  return new Blob([jsonl], { type: "application/x-ndjson;charset=utf-8" });
}

export async function clearAllQueryLogs(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE_QUERY_LOGS, "readwrite");
  tx.objectStore(STORE_QUERY_LOGS).clear();
  await txDone(tx);
}

export async function clearQueryLogsForStorageScope(
  db: IDBDatabase,
  storageScopeId: string,
): Promise<void> {
  if (!isNonEmptyString(storageScopeId)) {
    throw new Error("clearQueryLogsForStorageScope: storageScopeId must be a non-empty string");
  }

  const tx = db.transaction(STORE_QUERY_LOGS, "readwrite");
  const store = tx.objectStore(STORE_QUERY_LOGS);
  const primaryKeys = await reqToPromise(
    store.index(QUERY_LOG_INDEX_BY_STORAGE_SCOPE_ID).getAllKeys(IDBKeyRange.only(storageScopeId)),
  );
  for (const key of primaryKeys) {
    store.delete(key);
  }
  await txDone(tx);
}
