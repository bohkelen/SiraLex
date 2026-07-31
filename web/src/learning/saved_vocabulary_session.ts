/**
 * LS1I3 / LS2I4 — Saved Vocabulary session: list, resolve, remove for active bundle.
 * Presentation stays in render_saved_vocabulary.ts.
 */

import type { ActiveBundleMeta } from "../idb/siralex_db";
import { isLexiconDisplay, type EnrichedRecord } from "../types/records";
import {
  resolveLearningRecordForUi,
  type LearningRecordUiResolution,
} from "./learning_record_resolve";
import { listLearningRecordsByBundle, removeLearningRecord } from "./learning_record_store";
import type { LearningRecordUnresolvedReason, LearningRecordV1 } from "./learning_record_types";
import {
  hasConsistentReviewFields,
  hasLearningRecordBeenReviewed,
} from "./review_queue";
import {
  deriveSavedVocabularyProgress,
  type SavedVocabularyProgressVm,
} from "./saved_vocabulary_progress";

export type SavedVocabularyReviewStatus =
  | {
      state: "not_reviewed";
      labelKey: "review.notReviewed";
    }
  | {
      state: "still_learning";
      labelKey: "review.stillLearning";
      last_reviewed: string;
    }
  | {
      state: "remembered";
      labelKey: "review.remembered";
      last_reviewed: string;
    }
  | {
      state: "unknown";
    };

export type SavedVocabularyRowVm =
  | {
      state: "resolved";
      bundle_id: string;
      ir_id: string;
      learningRecord: LearningRecordV1;
      liveEntry: EnrichedRecord;
      primaryText: string;
      secondaryText?: string;
      nkoText?: string;
      reviewStatus: SavedVocabularyReviewStatus;
    }
  | {
      state: "unresolved";
      bundle_id: string;
      ir_id: string;
      learningRecord: LearningRecordV1;
      primaryText: string;
      secondaryText?: string;
      nkoText?: string;
      reason: LearningRecordUnresolvedReason;
      reviewStatus: SavedVocabularyReviewStatus;
    };

export type SavedVocabularySurfaceState =
  | "loading"
  | "empty"
  | "populated"
  | "removing"
  | "unavailable"
  | "error";

export type SavedVocabularyModel =
  | { surface: "loading" }
  | { surface: "unavailable" }
  | { surface: "error" }
  | { surface: "empty" }
  | {
      surface: "populated" | "removing";
      rows: SavedVocabularyRowVm[];
      removingKey?: string;
      rowErrors: Record<string, string>;
      /** Derived Progress & Return summary (LS3I1 / LS3I2). */
      progress: SavedVocabularyProgressVm;
    };

export function rowKey(bundleId: string, irId: string): string {
  return `${bundleId}\0${irId}`;
}

/**
 * Derive collection review status from Learning Record fields.
 * Never derives from `status` alone; reuses LS2I2 review-field helpers.
 */
export function deriveSavedVocabularyReviewStatus(
  record: LearningRecordV1,
): SavedVocabularyReviewStatus {
  if (!hasConsistentReviewFields(record)) {
    return { state: "unknown" };
  }
  if (!hasLearningRecordBeenReviewed(record)) {
    return { state: "not_reviewed", labelKey: "review.notReviewed" };
  }
  if (record.status === "still_learning" && record.last_reviewed) {
    return {
      state: "still_learning",
      labelKey: "review.stillLearning",
      last_reviewed: record.last_reviewed,
    };
  }
  if (record.status === "remembered" && record.last_reviewed) {
    return {
      state: "remembered",
      labelKey: "review.remembered",
      last_reviewed: record.last_reviewed,
    };
  }
  return { state: "unknown" };
}

function firstLiveGloss(entry: EnrichedRecord): string | undefined {
  if (!isLexiconDisplay(entry) || !entry.display.senses) return undefined;
  for (const sense of entry.display.senses) {
    if (typeof sense.gloss_fr === "string" && sense.gloss_fr.trim() !== "") {
      return sense.gloss_fr.trim();
    }
  }
  for (const sense of entry.display.senses) {
    if (typeof sense.gloss_en === "string" && sense.gloss_en.trim() !== "") {
      return sense.gloss_en.trim();
    }
  }
  return undefined;
}

/** Build a row VM from a resolution result. Does not mutate display_cache. */
export function buildSavedVocabularyRowVm(resolution: LearningRecordUiResolution): SavedVocabularyRowVm {
  const lr = resolution.learningRecord;
  const reviewStatus = deriveSavedVocabularyReviewStatus(lr);

  if (resolution.state === "resolved") {
    const live = resolution.liveEntry;
    let primaryText = "";
    let nkoText: string | undefined;
    if (isLexiconDisplay(live)) {
      primaryText = live.display.headword_latin.trim();
      const nko = live.display.headword_nko_provided?.trim();
      if (nko) nkoText = nko;
    }
    if (!primaryText) {
      primaryText = lr.display_cache?.headword_latin?.trim() || "";
    }
    const secondary = firstLiveGloss(live);
    return {
      state: "resolved",
      bundle_id: lr.bundle_id,
      ir_id: lr.ir_id,
      learningRecord: lr,
      liveEntry: live,
      primaryText,
      reviewStatus,
      ...(nkoText ? { nkoText } : {}),
      ...(secondary ? { secondaryText: secondary } : {}),
    };
  }

  const cache = lr.display_cache;
  const primaryText =
    typeof cache?.headword_latin === "string" ? cache.headword_latin.trim() : "";
  const nko =
    typeof cache?.headword_nko === "string" && cache.headword_nko.trim() !== ""
      ? cache.headword_nko.trim()
      : undefined;
  const secondary =
    typeof cache?.gloss_short === "string" && cache.gloss_short.trim() !== ""
      ? cache.gloss_short.trim()
      : undefined;

  return {
    state: "unresolved",
    bundle_id: lr.bundle_id,
    ir_id: lr.ir_id,
    learningRecord: lr,
    primaryText,
    reviewStatus,
    ...(nko ? { nkoText: nko } : {}),
    ...(secondary ? { secondaryText: secondary } : {}),
    reason: resolution.reason,
  };
}

export type SavedVocabularySessionDeps = {
  getActiveMeta: () => ActiveBundleMeta | undefined;
  openDb: () => Promise<IDBDatabase>;
  isCurrent: () => boolean;
  onUpdate: (model: SavedVocabularyModel) => void;
  /** Return true to proceed with remove. */
  confirmRemove: (row: SavedVocabularyRowVm) => boolean;
};

/**
 * Load/resolve/remove Saved Vocabulary for the active logical bundle.
 */
export function createSavedVocabularySession(deps: SavedVocabularySessionDeps) {
  let rows: SavedVocabularyRowVm[] = [];
  let rowErrors: Record<string, string> = {};
  let removingKey: string | undefined;
  let inflightRemove = false;

  function emitPopulated(surface: "populated" | "removing" = "populated"): void {
    if (!deps.isCurrent()) return;
    if (rows.length === 0) {
      deps.onUpdate({ surface: "empty" });
      return;
    }
    const { progress } = deriveSavedVocabularyProgress(rows);
    deps.onUpdate({
      surface,
      rows: [...rows],
      removingKey,
      rowErrors: { ...rowErrors },
      progress,
    });
  }

  return {
    async load(): Promise<void> {
      deps.onUpdate({ surface: "loading" });
      const meta = deps.getActiveMeta();
      if (!meta || typeof meta.bundle_id !== "string" || meta.bundle_id.trim() === "") {
        if (deps.isCurrent()) deps.onUpdate({ surface: "unavailable" });
        return;
      }

      try {
        const db = await deps.openDb();
        if (!deps.isCurrent()) return;

        const listed = await listLearningRecordsByBundle(db, meta.bundle_id);
        if (!deps.isCurrent()) return;

        if (listed.length === 0) {
          rows = [];
          rowErrors = {};
          removingKey = undefined;
          deps.onUpdate({ surface: "empty" });
          return;
        }

        const resolved = await Promise.all(
          listed.map(async (lr) => {
            try {
              return await resolveLearningRecordForUi(db, lr, meta);
            } catch {
              return {
                state: "unresolved" as const,
                learningRecord: lr,
                reason: "entry_missing" as const,
              };
            }
          }),
        );
        if (!deps.isCurrent()) return;

        rows = resolved.map(buildSavedVocabularyRowVm);
        rowErrors = {};
        removingKey = undefined;
        emitPopulated("populated");
      } catch {
        if (!deps.isCurrent()) return;
        deps.onUpdate({ surface: "error" });
      }
    },

    async remove(bundleId: string, irId: string): Promise<"cancelled" | "ok" | "stale" | "failed"> {
      if (inflightRemove || !deps.isCurrent()) return "stale";
      const key = rowKey(bundleId, irId);
      const row = rows.find((r) => r.bundle_id === bundleId && r.ir_id === irId);
      if (!row) return "stale";

      if (!deps.confirmRemove(row)) {
        return "cancelled";
      }

      inflightRemove = true;
      removingKey = key;
      delete rowErrors[key];
      emitPopulated("removing");

      try {
        const db = await deps.openDb();
        if (!deps.isCurrent()) return "stale";
        await removeLearningRecord(db, bundleId, irId);
        if (!deps.isCurrent()) return "stale";

        rows = rows.filter((r) => !(r.bundle_id === bundleId && r.ir_id === irId));
        removingKey = undefined;
        delete rowErrors[key];
        emitPopulated("populated");
        return "ok";
      } catch {
        if (!deps.isCurrent()) return "stale";
        removingKey = undefined;
        rowErrors[key] = "remove_failed";
        emitPopulated("populated");
        return "failed";
      } finally {
        inflightRemove = false;
      }
    },

    /** Test/helper: current in-memory rows (empty if not populated). */
    getRows(): SavedVocabularyRowVm[] {
      return [...rows];
    },
  };
}
