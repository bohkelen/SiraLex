/**
 * Phase 2.0.4 — Record resolution.
 *
 * Given an ordered list of ir_id values (from searchQuery), fetch the
 * corresponding enriched records from the IndexedDB records store.
 *
 * Uses a single readonly transaction with parallel get() calls via
 * Promise.all — never one transaction per record.
 */

import { STORE_RECORDS } from "../idb/nkokan_db";
import type { EnrichedRecord } from "../types/records";

function idbGet<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.addEventListener("success", () => resolve(req.result as T | undefined));
    req.addEventListener("error", () => reject(req.error));
  });
}

/**
 * Fetch enriched records for the given ir_ids, preserving input order.
 *
 * Missing records (ir_id present in search index but absent from records
 * store) are omitted from the result — the output may be shorter than
 * the input.
 */
export async function resolveRecords(
  db: IDBDatabase,
  irIds: string[],
): Promise<EnrichedRecord[]> {
  if (irIds.length === 0) return [];

  const tx = db.transaction(STORE_RECORDS, "readonly");
  const store = tx.objectStore(STORE_RECORDS);

  const results = await Promise.all(
    irIds.map((id) => idbGet<EnrichedRecord>(store, id)),
  );

  const records: EnrichedRecord[] = [];
  for (const rec of results) {
    if (rec != null) records.push(rec);
  }
  return records;
}
