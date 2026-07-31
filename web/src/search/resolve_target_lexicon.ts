/**
 * Resolve a TargetEntry from an index mapping to a live lexicon_entry.
 *
 * Featured Mali-pense bundles store HTML fragment ids in `target.anchor`
 * (e.g. "e1385") that match `record_locator.source_record_id`, not `ir_id`.
 * Debug / curated fixtures may place the `ir_id` directly in `anchor`.
 */

import { STORE_RECORDS } from "../idb/siralex_db";
import type { EnrichedRecord, TargetEntry } from "../types/records";
import { isLexiconDisplay } from "../types/records";
import { resolveRecords } from "./resolve_records";

const INDEX_BY_BUNDLE_ID = "by_bundle_id";

type StoredRecord = EnrichedRecord & {
  bundle_id?: string;
  record_locator?: {
    source_record_id?: string;
  };
};

/**
 * Find a lexicon entry in `bundleId` scope whose locator source_record_id
 * equals `sourceRecordId`. Stops at the first match.
 */
export async function findLexiconBySourceRecordId(
  db: IDBDatabase,
  bundleId: string,
  sourceRecordId: string,
): Promise<EnrichedRecord | undefined> {
  if (bundleId.trim() === "" || sourceRecordId.trim() === "") return undefined;

  const tx = db.transaction(STORE_RECORDS, "readonly");
  const index = tx.objectStore(STORE_RECORDS).index(INDEX_BY_BUNDLE_ID);

  return await new Promise((resolve, reject) => {
    const req = index.openCursor(IDBKeyRange.only(bundleId));
    req.addEventListener("error", () => reject(req.error));
    req.addEventListener("success", () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(undefined);
        return;
      }
      const rec = cursor.value as StoredRecord;
      if (
        rec.ir_kind === "lexicon_entry" &&
        rec.record_locator?.source_record_id === sourceRecordId &&
        isLexiconDisplay(rec)
      ) {
        resolve(rec);
        return;
      }
      cursor.continue();
    });
  });
}

/**
 * Resolve a mapping target to a lexicon entry without text search.
 * Order: treat anchor as ir_id, then as source_record_id.
 */
export async function resolveTargetLexiconEntry(
  db: IDBDatabase,
  storageScopeId: string,
  target: TargetEntry,
): Promise<EnrichedRecord | undefined> {
  const anchor = target.anchor.trim();
  if (anchor === "") return undefined;

  const byIrId = await resolveRecords(db, storageScopeId, [anchor]);
  const direct = byIrId[0];
  if (direct && direct.ir_kind === "lexicon_entry" && isLexiconDisplay(direct)) {
    return direct;
  }

  return await findLexiconBySourceRecordId(db, storageScopeId, anchor);
}
