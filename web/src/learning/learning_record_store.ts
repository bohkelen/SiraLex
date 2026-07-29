/**
 * LS1 Learning Record IndexedDB store API.
 *
 * Transactions touch STORE_LEARNING_RECORDS only — never dictionary or query logs.
 */

import {
  LEARNING_RECORD_INDEX_BY_BUNDLE_ID,
  STORE_LEARNING_RECORDS,
} from "../idb/siralex_db";
import {
  LEARNING_RECORD_SCHEMA_VERSION,
  type LearningRecordV1,
  type SaveLearningRecordInput,
  validateLearningRecordForWrite,
  validateSaveLearningRecordInput,
} from "./learning_record_types";

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

function compareCreatedAtDesc(a: LearningRecordV1, b: LearningRecordV1): number {
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? 1 : -1;
  }
  // Deterministic tie-break on ir_id.
  return a.ir_id.localeCompare(b.ir_id);
}

export async function getLearningRecord(
  db: IDBDatabase,
  bundleId: string,
  irId: string,
): Promise<LearningRecordV1 | undefined> {
  if (bundleId.trim() === "" || irId.trim() === "") return undefined;
  const tx = db.transaction(STORE_LEARNING_RECORDS, "readonly");
  const value = await reqToPromise(tx.objectStore(STORE_LEARNING_RECORDS).get([bundleId, irId]));
  await txDone(tx);
  return value as LearningRecordV1 | undefined;
}

export async function isLearningRecordSaved(
  db: IDBDatabase,
  bundleId: string,
  irId: string,
): Promise<boolean> {
  const existing = await getLearningRecord(db, bundleId, irId);
  return existing != null;
}

/**
 * Create a Learning Record when absent; return existing unchanged when present.
 */
export async function saveLearningRecord(
  db: IDBDatabase,
  input: SaveLearningRecordInput,
): Promise<LearningRecordV1> {
  validateSaveLearningRecordInput(input);

  const existing = await getLearningRecord(db, input.bundle_id, input.ir_id);
  if (existing) {
    return existing;
  }

  const record: LearningRecordV1 = {
    schema_version: LEARNING_RECORD_SCHEMA_VERSION,
    bundle_id: input.bundle_id,
    ir_id: input.ir_id,
    ir_kind: "lexicon_entry",
    content_sha256: input.content_sha256,
    storage_scope_id: input.storage_scope_id,
    status: "still_learning",
    created_at: new Date().toISOString(),
    display_cache: {
      headword_latin: input.display_cache.headword_latin,
      ...(input.display_cache.headword_nko !== undefined
        ? { headword_nko: input.display_cache.headword_nko }
        : {}),
      ...(input.display_cache.gloss_short !== undefined
        ? { gloss_short: input.display_cache.gloss_short }
        : {}),
    },
    last_reviewed: null,
    review_count: 0,
  };

  validateLearningRecordForWrite(record, "saveLearningRecord");

  const tx = db.transaction(STORE_LEARNING_RECORDS, "readwrite");
  tx.objectStore(STORE_LEARNING_RECORDS).put(record);
  await txDone(tx);
  return record;
}

export async function listLearningRecordsByBundle(
  db: IDBDatabase,
  bundleId: string,
): Promise<LearningRecordV1[]> {
  if (bundleId.trim() === "") return [];
  const tx = db.transaction(STORE_LEARNING_RECORDS, "readonly");
  const index = tx.objectStore(STORE_LEARNING_RECORDS).index(LEARNING_RECORD_INDEX_BY_BUNDLE_ID);
  const rows = (await reqToPromise(index.getAll(IDBKeyRange.only(bundleId)))) as LearningRecordV1[];
  await txDone(tx);
  return [...rows].sort(compareCreatedAtDesc);
}

/**
 * Delete only from learning_records.
 * @returns true if a row was present and removed; false if absent.
 */
export async function removeLearningRecord(
  db: IDBDatabase,
  bundleId: string,
  irId: string,
): Promise<boolean> {
  if (bundleId.trim() === "" || irId.trim() === "") return false;

  const existing = await getLearningRecord(db, bundleId, irId);
  if (!existing) return false;

  const tx = db.transaction(STORE_LEARNING_RECORDS, "readwrite");
  tx.objectStore(STORE_LEARNING_RECORDS).delete([bundleId, irId]);
  await txDone(tx);
  return true;
}
