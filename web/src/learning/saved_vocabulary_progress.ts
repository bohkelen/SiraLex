/**
 * LS3I1 — pure Progress & Return derivation from Saved Vocabulary row VMs.
 *
 * No IndexedDB, no resolution, no Review queue construction, no i18n, no writes.
 */

import { isResolvedLexiconReviewEligible } from "./review_queue";
import type { SavedVocabularyRowVm } from "./saved_vocabulary_session";

export type SavedVocabularyProgressVm = {
  total_saved: number;
  not_reviewed: number;
  still_learning: number;
  remembered: number;
  unavailable: number;
  reviewable: number;
  reviewAction:
    | {
        state: "enabled";
        label: "start" | "continue";
      }
    | {
        state: "disabled";
        reason: "no_reviewable_entries";
      }
    | {
        state: "hidden";
        reason: "empty_collection";
      };
  returnCue: "review_new" | "review_still_learning" | "review_again" | "none";
  showUnavailable: boolean;
};

export type SavedVocabularyProgressDiagnostics = {
  unknown_state_count: number;
};

export type SavedVocabularyProgressResult = {
  progress: SavedVocabularyProgressVm;
  diagnostics: SavedVocabularyProgressDiagnostics;
};

/**
 * Whether a Saved Vocabulary row is eligible for LS2 Review.
 * Matches queue inclusion rules without constructing a queue.
 */
export function isSavedVocabularyRowReviewable(row: SavedVocabularyRowVm): boolean {
  if (row.state !== "resolved") return false;
  try {
    return isResolvedLexiconReviewEligible(row.learningRecord, row.liveEntry);
  } catch {
    return false;
  }
}

function classifyReviewBucket(
  row: SavedVocabularyRowVm,
): "not_reviewed" | "still_learning" | "remembered" | "unknown" {
  try {
    const status = row.reviewStatus;
    if (!status || typeof status !== "object") return "unknown";
    if (status.state === "not_reviewed") return "not_reviewed";
    if (status.state === "still_learning") return "still_learning";
    if (status.state === "remembered") return "remembered";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function deriveReviewAction(
  totalSaved: number,
  reviewable: number,
  stillLearning: number,
  remembered: number,
): SavedVocabularyProgressVm["reviewAction"] {
  if (totalSaved === 0) {
    return { state: "hidden", reason: "empty_collection" };
  }
  if (reviewable === 0) {
    return { state: "disabled", reason: "no_reviewable_entries" };
  }
  if (stillLearning === 0 && remembered === 0) {
    return { state: "enabled", label: "start" };
  }
  return { state: "enabled", label: "continue" };
}

function deriveReturnCue(
  reviewable: number,
  notReviewed: number,
  stillLearning: number,
  remembered: number,
): SavedVocabularyProgressVm["returnCue"] {
  if (reviewable === 0) return "none";
  if (notReviewed > 0) return "review_new";
  if (stillLearning > 0) return "review_still_learning";
  if (remembered > 0) return "review_again";
  return "none";
}

/**
 * Derive Progress & Return state from already-built Saved Vocabulary rows.
 * One pass. Pure. Does not mutate inputs.
 */
export function deriveSavedVocabularyProgress(
  rows: readonly SavedVocabularyRowVm[],
): SavedVocabularyProgressResult {
  let notReviewed = 0;
  let stillLearning = 0;
  let remembered = 0;
  let unavailable = 0;
  let reviewable = 0;
  let unknownStateCount = 0;

  for (const row of rows) {
    const bucket = classifyReviewBucket(row);
    if (bucket === "not_reviewed") notReviewed += 1;
    else if (bucket === "still_learning") stillLearning += 1;
    else if (bucket === "remembered") remembered += 1;
    else unknownStateCount += 1;

    if (row.state === "unresolved") {
      unavailable += 1;
    }

    if (isSavedVocabularyRowReviewable(row)) {
      reviewable += 1;
    }
  }

  const totalSaved = rows.length;
  const progress: SavedVocabularyProgressVm = {
    total_saved: totalSaved,
    not_reviewed: notReviewed,
    still_learning: stillLearning,
    remembered,
    unavailable,
    reviewable,
    reviewAction: deriveReviewAction(totalSaved, reviewable, stillLearning, remembered),
    returnCue: deriveReturnCue(reviewable, notReviewed, stillLearning, remembered),
    showUnavailable: unavailable > 0,
  };

  return {
    progress,
    diagnostics: { unknown_state_count: unknownStateCount },
  };
}
