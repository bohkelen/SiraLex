/**
 * LS1I2 — Entry Save control state + Save input construction.
 * Application owns persistence; renderer only displays state and fires callbacks.
 */

import type { ActiveBundleMeta } from "../idb/siralex_db";
import { getBundleStorageScopeId } from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import { buildDisplayCache } from "./build_display_cache";
import {
  isLearningRecordSaved,
  removeLearningRecord,
  saveLearningRecord,
} from "./learning_record_store";
import type { SaveLearningRecordInput } from "./learning_record_types";

export type LearningSaveControlState =
  | "loading"
  | "not_saved"
  | "saving"
  | "saved"
  | "removing"
  | "error_not_saved"
  | "error_saved"
  | "unavailable";

/**
 * Build a Save input from a live lexicon entry and active registry metadata.
 * Returns null when stamps/metadata are insufficient (no partial writes).
 * Logical bundle_id comes from registry meta — never parsed from storage_scope_id.
 */
export function buildSaveInputFromActiveEntry(
  entry: EnrichedRecord,
  activeMeta: ActiveBundleMeta,
): SaveLearningRecordInput | null {
  if (entry.ir_kind !== "lexicon_entry") return null;
  if (typeof entry.ir_id !== "string" || entry.ir_id.trim() === "") return null;
  if (typeof activeMeta.bundle_id !== "string" || activeMeta.bundle_id.trim() === "") return null;

  const contentSha = activeMeta.expected_content_sha256;
  if (typeof contentSha !== "string" || contentSha.trim() === "") return null;

  const storageScopeId = getBundleStorageScopeId(activeMeta);
  if (typeof storageScopeId !== "string" || storageScopeId.trim() === "") return null;

  try {
    const display_cache = buildDisplayCache(entry);
    return {
      bundle_id: activeMeta.bundle_id,
      ir_id: entry.ir_id,
      ir_kind: "lexicon_entry",
      content_sha256: contentSha,
      storage_scope_id: storageScopeId,
      display_cache,
    };
  } catch {
    return null;
  }
}

export function canOfferLearningSave(
  entry: EnrichedRecord,
  activeMeta: ActiveBundleMeta | undefined,
): boolean {
  if (!activeMeta) return false;
  return buildSaveInputFromActiveEntry(entry, activeMeta) != null;
}

export type EntryLearningSessionDeps = {
  record: EnrichedRecord;
  getActiveMeta: () => ActiveBundleMeta | undefined;
  openDb: () => Promise<IDBDatabase>;
  /** Returns true while this entry detail generation is still current. */
  isCurrent: () => boolean;
  setState: (state: LearningSaveControlState) => void;
};

/**
 * Owns Learning persistence sequencing for one entry-detail generation.
 */
export function createEntryLearningSession(deps: EntryLearningSessionDeps) {
  let inflight = false;

  return {
    async loadInitial(): Promise<void> {
      const meta = deps.getActiveMeta();
      if (!canOfferLearningSave(deps.record, meta) || !meta) {
        if (deps.isCurrent()) deps.setState("unavailable");
        return;
      }
      try {
        const db = await deps.openDb();
        if (!deps.isCurrent()) return;
        const saved = await isLearningRecordSaved(db, meta.bundle_id, deps.record.ir_id);
        if (!deps.isCurrent()) return;
        deps.setState(saved ? "saved" : "not_saved");
      } catch {
        if (!deps.isCurrent()) return;
        deps.setState("error_not_saved");
      }
    },

    async save(): Promise<void> {
      if (inflight || !deps.isCurrent()) return;
      const meta = deps.getActiveMeta();
      const input = meta ? buildSaveInputFromActiveEntry(deps.record, meta) : null;
      if (!input) {
        deps.setState("unavailable");
        return;
      }
      inflight = true;
      deps.setState("saving");
      try {
        const db = await deps.openDb();
        if (!deps.isCurrent()) return;
        await saveLearningRecord(db, input);
        if (!deps.isCurrent()) return;
        deps.setState("saved");
      } catch {
        if (!deps.isCurrent()) return;
        deps.setState("error_not_saved");
      } finally {
        inflight = false;
      }
    },

    async unsave(): Promise<void> {
      if (inflight || !deps.isCurrent()) return;
      const meta = deps.getActiveMeta();
      if (!meta || typeof meta.bundle_id !== "string" || meta.bundle_id.trim() === "") {
        deps.setState("unavailable");
        return;
      }
      inflight = true;
      deps.setState("removing");
      try {
        const db = await deps.openDb();
        if (!deps.isCurrent()) return;
        await removeLearningRecord(db, meta.bundle_id, deps.record.ir_id);
        if (!deps.isCurrent()) return;
        deps.setState("not_saved");
      } catch {
        if (!deps.isCurrent()) return;
        deps.setState("error_saved");
      } finally {
        inflight = false;
      }
    },
  };
}
