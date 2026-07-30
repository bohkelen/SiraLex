/**
 * Resolve a stored Learning Record against the active dictionary scope for UI.
 * Does not refresh display_cache. Does not promote cache to lexical authority.
 */

import type { ActiveBundleMeta } from "../idb/siralex_db";
import { getBundleStorageScopeId } from "../idb/siralex_db";
import { resolveRecords } from "../search/resolve_records";
import type { EnrichedRecord } from "../types/records";
import type { LearningRecordUnresolvedReason, LearningRecordV1 } from "./learning_record_types";

export type LearningRecordUiResolution =
  | {
      state: "resolved";
      learningRecord: LearningRecordV1;
      liveEntry: EnrichedRecord;
    }
  | {
      state: "unresolved";
      learningRecord: LearningRecordV1;
      liveEntry?: undefined;
      reason: LearningRecordUnresolvedReason;
    };

export async function resolveLearningRecordForUi(
  db: IDBDatabase,
  learningRecord: LearningRecordV1,
  activeMeta: ActiveBundleMeta | undefined,
): Promise<LearningRecordUiResolution> {
  if (!activeMeta) {
    return {
      state: "unresolved",
      learningRecord,
      reason: "no_active_bundle",
    };
  }

  if (activeMeta.bundle_id !== learningRecord.bundle_id) {
    return {
      state: "unresolved",
      learningRecord,
      reason: "bundle_mismatch",
    };
  }

  const scopeId = getBundleStorageScopeId(activeMeta);
  const live = await resolveRecords(db, scopeId, [learningRecord.ir_id]);
  const entry = live[0];

  if (!entry) {
    return {
      state: "unresolved",
      learningRecord,
      reason: "entry_missing",
    };
  }

  if (entry.ir_kind !== "lexicon_entry") {
    return {
      state: "unresolved",
      learningRecord,
      reason: "not_lexicon_entry",
    };
  }

  return {
    state: "resolved",
    learningRecord,
    liveEntry: entry,
  };
}
