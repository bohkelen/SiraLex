/**
 * LS1I3 — Saved Vocabulary session / view-model owner.
 * Presentation stays in the renderer; this module owns IDB and async sequencing.
 */

import type { ActiveBundleMeta } from "../idb/siralex_db";
import { getBundleStorageScopeId } from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import { resolveLearningRecordForUi } from "./learning_record_resolve";
import { listLearningRecordsByBundle, removeLearningRecord } from "./learning_record_store";
import type { LearningRecordV1 } from "./learning_record_types";

export type SavedVocabularySurfaceState =
  | "loading"
  | "empty"
  | "populated"
  | "removing"
  | "unavailable"
  | "error";

export type SavedVocabularyRowVm = {
  ir_id: string;
  bundle_id: string;
  storage_scope_id: string;
  headword_latin: string;
  headword_nko?: string;
  gloss_short?: string;
  openable: boolean;
  unresolved: boolean;
  removing: boolean;
};

export type SavedVocabularyViewModel = {
  state: SavedVocabularySurfaceState;
  boundBundleId: string | null;
  boundStorageScopeId: string | null;
  rows: SavedVocabularyRowVm[];
  /** Optional status line for remove failure while list remains visible. */
  statusMessage: "none" | "remove_failed" | "open_failed";
};

export function createEmptySavedVocabularyViewModel(
  state: SavedVocabularySurfaceState = "loading",
): SavedVocabularyViewModel {
  return {
    state,
    boundBundleId: null,
    boundStorageScopeId: null,
    rows: [],
    statusMessage: "none",
  };
}

function rowFromRecord(record: LearningRecordV1, openable: boolean, removing: boolean): SavedVocabularyRowVm {
  const headword =
    typeof record.display_cache.headword_latin === "string" &&
    record.display_cache.headword_latin.trim() !== ""
      ? record.display_cache.headword_latin
      : record.ir_id;

  return {
    ir_id: record.ir_id,
    bundle_id: record.bundle_id,
    storage_scope_id: record.storage_scope_id,
    headword_latin: headword,
    ...(record.display_cache.headword_nko
      ? { headword_nko: record.display_cache.headword_nko }
      : {}),
    ...(record.display_cache.gloss_short ? { gloss_short: record.display_cache.gloss_short } : {}),
    openable,
    unresolved: !openable,
    removing,
  };
}

/**
 * Keep only Learning Records for the active logical bundle_id and active storage scope.
 * No silent fallback to another bundle or scope.
 */
export function filterRecordsForActiveScope(
  records: LearningRecordV1[],
  bundleId: string,
  storageScopeId: string,
): LearningRecordV1[] {
  return records.filter(
    (record) => record.bundle_id === bundleId && record.storage_scope_id === storageScopeId,
  );
}

export type SavedVocabularySessionDeps = {
  getActiveMeta: () => ActiveBundleMeta | undefined;
  openDb: () => Promise<IDBDatabase>;
  /** True while this surface generation is still current. */
  isCurrent: () => boolean;
  /** Active binding still matches the binding used when the async work started. */
  isBindingCurrent: (bundleId: string, storageScopeId: string) => boolean;
  publish: (vm: SavedVocabularyViewModel) => void;
  onOpenEntry: (entry: EnrichedRecord) => void;
  confirmRemove: (row: SavedVocabularyRowVm) => boolean;
};

export function createSavedVocabularySession(deps: SavedVocabularySessionDeps) {
  let inflightRemove = false;
  let lastVm = createEmptySavedVocabularyViewModel("loading");

  function publish(vm: SavedVocabularyViewModel): void {
    if (!deps.isCurrent()) return;
    lastVm = vm;
    deps.publish(vm);
  }

  async function buildPopulatedVm(
    db: IDBDatabase,
    meta: ActiveBundleMeta,
    bundleId: string,
    storageScopeId: string,
    removingIrId: string | null,
    statusMessage: SavedVocabularyViewModel["statusMessage"],
  ): Promise<SavedVocabularyViewModel> {
    const listed = await listLearningRecordsByBundle(db, bundleId);
    const scoped = filterRecordsForActiveScope(listed, bundleId, storageScopeId);

    const rows: SavedVocabularyRowVm[] = [];
    for (const record of scoped) {
      const resolution = await resolveLearningRecordForUi(db, record, meta);
      const openable = resolution.state === "resolved";
      rows.push(rowFromRecord(record, openable, removingIrId === record.ir_id));
    }

    return {
      state: removingIrId ? "removing" : rows.length === 0 ? "empty" : "populated",
      boundBundleId: bundleId,
      boundStorageScopeId: storageScopeId,
      rows,
      statusMessage,
    };
  }

  return {
    getLastViewModel(): SavedVocabularyViewModel {
      return lastVm;
    },

    async load(): Promise<void> {
      publish(createEmptySavedVocabularyViewModel("loading"));

      const meta = deps.getActiveMeta();
      if (!meta || typeof meta.bundle_id !== "string" || meta.bundle_id.trim() === "") {
        publish(createEmptySavedVocabularyViewModel("unavailable"));
        return;
      }
      const bundleId = meta.bundle_id;
      const storageScopeId = getBundleStorageScopeId(meta);
      if (typeof storageScopeId !== "string" || storageScopeId.trim() === "") {
        publish(createEmptySavedVocabularyViewModel("unavailable"));
        return;
      }

      try {
        const db = await deps.openDb();
        if (!deps.isCurrent() || !deps.isBindingCurrent(bundleId, storageScopeId)) return;
        const vm = await buildPopulatedVm(db, meta, bundleId, storageScopeId, null, "none");
        if (!deps.isCurrent() || !deps.isBindingCurrent(bundleId, storageScopeId)) return;
        publish(vm);
      } catch {
        if (!deps.isCurrent() || !deps.isBindingCurrent(bundleId, storageScopeId)) return;
        publish({
          ...createEmptySavedVocabularyViewModel("error"),
          boundBundleId: bundleId,
          boundStorageScopeId: storageScopeId,
        });
      }
    },

    async openRow(irId: string): Promise<void> {
      if (!deps.isCurrent()) return;
      const meta = deps.getActiveMeta();
      if (!meta) {
        publish({ ...lastVm, statusMessage: "open_failed" });
        return;
      }
      const bundleId = meta.bundle_id;
      const storageScopeId = getBundleStorageScopeId(meta);
      const row = lastVm.rows.find((r) => r.ir_id === irId);
      if (!row || !row.openable) return;
      if (row.bundle_id !== bundleId || row.storage_scope_id !== storageScopeId) return;

      try {
        const db = await deps.openDb();
        if (!deps.isCurrent() || !deps.isBindingCurrent(bundleId, storageScopeId)) return;
        const listed = await listLearningRecordsByBundle(db, bundleId);
        const record = listed.find(
          (r) => r.ir_id === irId && r.storage_scope_id === storageScopeId,
        );
        if (!record) {
          if (!deps.isCurrent()) return;
          publish({ ...lastVm, statusMessage: "open_failed" });
          return;
        }
        const resolution = await resolveLearningRecordForUi(db, record, meta);
        if (!deps.isCurrent() || !deps.isBindingCurrent(bundleId, storageScopeId)) return;
        if (resolution.state !== "resolved") {
          publish({ ...lastVm, statusMessage: "open_failed" });
          return;
        }
        deps.onOpenEntry(resolution.liveEntry);
      } catch {
        if (!deps.isCurrent()) return;
        publish({ ...lastVm, statusMessage: "open_failed" });
      }
    },

    async removeRow(irId: string): Promise<void> {
      if (inflightRemove || !deps.isCurrent()) return;
      const meta = deps.getActiveMeta();
      if (!meta) return;
      const bundleId = meta.bundle_id;
      const storageScopeId = getBundleStorageScopeId(meta);
      const row = lastVm.rows.find((r) => r.ir_id === irId);
      if (!row) return;
      if (row.bundle_id !== bundleId || row.storage_scope_id !== storageScopeId) return;
      if (!deps.confirmRemove(row)) return;

      inflightRemove = true;
      const previous = lastVm;
      publish({
        ...previous,
        state: "removing",
        statusMessage: "none",
        rows: previous.rows.map((r) =>
          r.ir_id === irId ? { ...r, removing: true } : { ...r, removing: false },
        ),
      });

      try {
        const db = await deps.openDb();
        if (!deps.isCurrent() || !deps.isBindingCurrent(bundleId, storageScopeId)) return;
        await removeLearningRecord(db, bundleId, irId);
        if (!deps.isCurrent() || !deps.isBindingCurrent(bundleId, storageScopeId)) return;
        const vm = await buildPopulatedVm(db, meta, bundleId, storageScopeId, null, "none");
        if (!deps.isCurrent() || !deps.isBindingCurrent(bundleId, storageScopeId)) return;
        publish(vm);
      } catch {
        if (!deps.isCurrent() || !deps.isBindingCurrent(bundleId, storageScopeId)) return;
        publish({
          ...previous,
          state: previous.rows.length === 0 ? "empty" : "populated",
          statusMessage: "remove_failed",
          rows: previous.rows.map((r) => ({ ...r, removing: false })),
        });
      } finally {
        inflightRemove = false;
      }
    },
  };
}
