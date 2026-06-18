import {
  QUERY_LOG_INDEX_BY_BUNDLE_ID,
  QUERY_LOG_INDEX_BY_STORAGE_SCOPE_ID,
  QUERY_LOG_INDEX_BY_TIMESTAMP_ISO,
  STORE_QUERY_LOGS,
} from "../idb/siralex_db";
import { deriveMatchedDeepLadder, deriveResultStatus, isQueryLogEventV2 } from "./query_log_derive";
import type {
  AppendQueryLogInput,
  AppendQueryLogV2Input,
  ExportQueryLogsOptions,
  ListQueryLogsOptions,
  ListRecentQueryLogsOptions,
  QueryLogDirection,
  QueryLogEvent,
  QueryLogEventV1,
  QueryLogEventV2,
  QueryLogLadderLevel,
  QueryLogNormalizedKeys,
  QueryLogResultStatus,
  QueryLogScopeFilter,
  QueryLogStats,
} from "./query_log_types";
import {
  QUERY_LOG_EVENT_V2,
  QUERY_LOG_MAX_AGE_MS,
  QUERY_LOG_MAX_ROWS,
  QUERY_LOG_TOP_IR_IDS_LIMIT,
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

function isValidUiLanguage(value: unknown): value is "en" | "fr" {
  return value === "en" || value === "fr";
}

function isValidResultStatus(value: unknown): value is QueryLogResultStatus {
  return value === "miss" || value === "hit_single" || value === "hit_multi";
}

function validateNormalizedKeys(value: unknown, label = "appendQueryLog"): asserts value is QueryLogNormalizedKeys {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label}: query_normalized_keys must be an object`);
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
      throw new Error(`${label}: query_normalized_keys.${key} must be a string[]`);
    }
  }
}

function cloneNormalizedKeys(keys: QueryLogNormalizedKeys): QueryLogNormalizedKeys {
  return {
    casefold: [...keys.casefold],
    diacritics_insensitive: [...keys.diacritics_insensitive],
    punct_stripped: [...keys.punct_stripped],
    nospace: [...keys.nospace],
  };
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

function validateAppendV2Input(input: AppendQueryLogV2Input): void {
  const label = "appendQueryLogV2";

  if (!isNonEmptyString(input.event_id)) {
    throw new Error(`${label}: event_id must be a non-empty string`);
  }
  if (typeof input.query_raw !== "string") {
    throw new Error(`${label}: query_raw must be a string`);
  }
  validateNormalizedKeys(input.query_normalized_keys, label);
  if (input.query_normalized_primary !== null && typeof input.query_normalized_primary !== "string") {
    throw new Error(`${label}: query_normalized_primary must be a string or null`);
  }
  if (!isValidDirection(input.direction)) {
    throw new Error(`${label}: direction must be source_to_target or target_to_source`);
  }
  if (!isValidUiLanguage(input.ui_language)) {
    throw new Error(`${label}: ui_language must be en or fr`);
  }
  if (!isValidResultStatus(input.result_status)) {
    throw new Error(`${label}: result_status must be miss, hit_single, or hit_multi`);
  }
  if (!Number.isInteger(input.result_count) || input.result_count < 0) {
    throw new Error(`${label}: result_count must be an integer >= 0`);
  }
  if (!isStringArray(input.top_ir_ids)) {
    throw new Error(`${label}: top_ir_ids must be a string[]`);
  }
  if (input.top_ir_ids.length > QUERY_LOG_TOP_IR_IDS_LIMIT) {
    throw new Error(`${label}: top_ir_ids must contain at most ${QUERY_LOG_TOP_IR_IDS_LIMIT} entries`);
  }
  if (!isValidLadderLevel(input.matched_key_type)) {
    throw new Error(`${label}: matched_key_type must be a supported ladder level`);
  }
  if (input.matched_key !== null && typeof input.matched_key !== "string") {
    throw new Error(`${label}: matched_key must be a string or null`);
  }
  if (typeof input.matched_deep_ladder !== "boolean") {
    throw new Error(`${label}: matched_deep_ladder must be a boolean`);
  }
  if (!Number.isInteger(input.latency_ms) || input.latency_ms < 0) {
    throw new Error(`${label}: latency_ms must be an integer >= 0`);
  }
  if (typeof input.offline_or_online !== "boolean") {
    throw new Error(`${label}: offline_or_online must be a boolean`);
  }
  if (!isNonEmptyString(input.bundle_id)) {
    throw new Error(`${label}: bundle_id must be a non-empty string`);
  }
  if (input.bundle_version !== undefined && !isNonEmptyString(input.bundle_version)) {
    throw new Error(`${label}: bundle_version must be omitted or a non-empty string`);
  }
  if (input.catalog_version !== undefined && !isNonEmptyString(input.catalog_version)) {
    throw new Error(`${label}: catalog_version must be omitted or a non-empty string`);
  }
  if (!isNonEmptyString(input.storage_scope_id)) {
    throw new Error(`${label}: storage_scope_id must be a non-empty string`);
  }
  if (!isNonEmptyString(input.norm_version)) {
    throw new Error(`${label}: norm_version must be a non-empty string`);
  }
  if (!isNonEmptyString(input.app_version)) {
    throw new Error(`${label}: app_version must be a non-empty string`);
  }
  if (!isNonEmptyString(input.timestamp_iso)) {
    throw new Error(`${label}: timestamp_iso must be a non-empty string`);
  }
  if (!isNonEmptyString(input.session_bucket_id)) {
    throw new Error(`${label}: session_bucket_id must be a non-empty string`);
  }
  if (!isNonEmptyString(input.consent_version)) {
    throw new Error(`${label}: consent_version must be a non-empty string`);
  }
  if (input.logging_enabled !== true) {
    throw new Error(`${label}: logging_enabled must be true`);
  }

  const expectedStatus = deriveResultStatus(input.result_count);
  if (input.result_status !== expectedStatus) {
    throw new Error(
      `${label}: result_status must equal deriveResultStatus(result_count) (expected ${expectedStatus})`,
    );
  }

  const expectedDeepLadder = deriveMatchedDeepLadder(input.matched_key_type);
  if (input.matched_deep_ladder !== expectedDeepLadder) {
    throw new Error(
      `${label}: matched_deep_ladder must equal deriveMatchedDeepLadder(matched_key_type) (expected ${expectedDeepLadder})`,
    );
  }
}

function cloneEvent(row: QueryLogEvent): QueryLogEvent {
  if (isQueryLogEventV2(row)) {
    return {
      ...row,
      query_normalized_keys: cloneNormalizedKeys(row.query_normalized_keys),
      top_ir_ids: [...row.top_ir_ids],
    };
  }

  return {
    ...row,
    query_normalized_keys: cloneNormalizedKeys(row.query_normalized_keys),
  };
}

async function getAllForFilter(db: IDBDatabase, filter: QueryLogScopeFilter): Promise<QueryLogEvent[]> {
  const tx = db.transaction(STORE_QUERY_LOGS, "readonly");
  const store = tx.objectStore(STORE_QUERY_LOGS);

  let rows: QueryLogEvent[];
  if (filter.storage_scope_id) {
    rows = (await reqToPromise(
      store.index(QUERY_LOG_INDEX_BY_STORAGE_SCOPE_ID).getAll(IDBKeyRange.only(filter.storage_scope_id)),
    )) as QueryLogEvent[];
  } else if (filter.bundle_id) {
    rows = (await reqToPromise(
      store.index(QUERY_LOG_INDEX_BY_BUNDLE_ID).getAll(IDBKeyRange.only(filter.bundle_id)),
    )) as QueryLogEvent[];
  } else {
    rows = (await reqToPromise(store.getAll())) as QueryLogEvent[];
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

async function deleteQueryLogKeys(db: IDBDatabase, keys: IDBValidKey[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }

  const tx = db.transaction(STORE_QUERY_LOGS, "readwrite");
  const store = tx.objectStore(STORE_QUERY_LOGS);
  for (const key of keys) {
    store.delete(key);
  }
  await txDone(tx);
}

async function pruneQueryLogsOlderThanMaxAge(db: IDBDatabase): Promise<void> {
  const cutoffIso = new Date(Date.now() - QUERY_LOG_MAX_AGE_MS).toISOString();
  const keysToDelete: IDBValidKey[] = [];

  const tx = db.transaction(STORE_QUERY_LOGS, "readonly");
  const store = tx.objectStore(STORE_QUERY_LOGS);
  const index = store.index(QUERY_LOG_INDEX_BY_TIMESTAMP_ISO);

  await new Promise<void>((resolve, reject) => {
    const req = index.openCursor(IDBKeyRange.upperBound(cutoffIso, true));
    req.addEventListener("success", () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      keysToDelete.push(cursor.primaryKey as IDBValidKey);
      cursor.continue();
    });
    req.addEventListener("error", () => reject(req.error));
  });

  await txDone(tx);
  await deleteQueryLogKeys(db, keysToDelete);
}

async function pruneQueryLogsOverMaxRows(db: IDBDatabase): Promise<void> {
  const countTx = db.transaction(STORE_QUERY_LOGS, "readonly");
  const total = await reqToPromise(countTx.objectStore(STORE_QUERY_LOGS).count());
  await txDone(countTx);

  if (total <= QUERY_LOG_MAX_ROWS) {
    return;
  }

  const excess = total - QUERY_LOG_MAX_ROWS;
  const keysToDelete: IDBValidKey[] = [];

  const tx = db.transaction(STORE_QUERY_LOGS, "readonly");
  const store = tx.objectStore(STORE_QUERY_LOGS);

  await new Promise<void>((resolve, reject) => {
    const req = store.openCursor();
    req.addEventListener("success", () => {
      const cursor = req.result;
      if (!cursor || keysToDelete.length >= excess) {
        resolve();
        return;
      }
      keysToDelete.push(cursor.primaryKey as IDBValidKey);
      cursor.continue();
    });
    req.addEventListener("error", () => reject(req.error));
  });

  await txDone(tx);
  await deleteQueryLogKeys(db, keysToDelete);
}

async function pruneQueryLogsAfterAppend(db: IDBDatabase): Promise<void> {
  try {
    await pruneQueryLogsOlderThanMaxAge(db);
    await pruneQueryLogsOverMaxRows(db);
  } catch (error) {
    console.warn("Query log retention prune failed:", error);
  }
}

export async function appendQueryLog(db: IDBDatabase, input: AppendQueryLogInput): Promise<number> {
  validateAppendInput(input);

  const tx = db.transaction(STORE_QUERY_LOGS, "readwrite");
  const store = tx.objectStore(STORE_QUERY_LOGS);
  const row: QueryLogEventV1 = {
    schema_version: QUERY_LOG_SCHEMA_VERSION,
    ...input,
    query_normalized_keys: cloneNormalizedKeys(input.query_normalized_keys),
  };

  const key = await reqToPromise(store.add(row));
  await txDone(tx);

  await pruneQueryLogsAfterAppend(db);
  return Number(key);
}

export async function appendQueryLogV2(db: IDBDatabase, input: AppendQueryLogV2Input): Promise<number> {
  validateAppendV2Input(input);

  const tx = db.transaction(STORE_QUERY_LOGS, "readwrite");
  const store = tx.objectStore(STORE_QUERY_LOGS);
  const row: QueryLogEventV2 = {
    schema_version: QUERY_LOG_EVENT_V2,
    ...input,
    query_normalized_keys: cloneNormalizedKeys(input.query_normalized_keys),
    top_ir_ids: [...input.top_ir_ids],
  };

  const key = await reqToPromise(store.add(row));
  await txDone(tx);

  await pruneQueryLogsAfterAppend(db);
  return Number(key);
}

export async function listQueryLogs(
  db: IDBDatabase,
  options: ListQueryLogsOptions = {},
): Promise<QueryLogEvent[]> {
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
): Promise<QueryLogEvent[]> {
  const limit = Math.max(0, Math.floor(options.limit));
  if (limit === 0) {
    return [];
  }

  const tx = db.transaction(STORE_QUERY_LOGS, "readonly");
  const store = tx.objectStore(STORE_QUERY_LOGS);

  const rows = await new Promise<QueryLogEvent[]>((resolve, reject) => {
    const out: QueryLogEvent[] = [];

    const rowMatchesFilter = (row: QueryLogEvent): boolean => {
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

      const value = cursor.value as QueryLogEvent;
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

export async function getQueryLogStats(
  db: IDBDatabase,
  options: QueryLogScopeFilter = {},
): Promise<QueryLogStats> {
  const rows = await getAllForFilter(db, options);
  if (rows.length === 0) {
    return { count: 0, oldest_timestamp_iso: null };
  }

  let oldestTimestampIso = rows[0]?.timestamp_iso ?? null;
  for (const row of rows) {
    if (oldestTimestampIso === null || row.timestamp_iso < oldestTimestampIso) {
      oldestTimestampIso = row.timestamp_iso;
    }
  }

  return {
    count: rows.length,
    oldest_timestamp_iso: oldestTimestampIso,
  };
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
