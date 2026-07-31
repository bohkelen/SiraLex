/**
 * LS2I2 — deterministic review queue construction (headless).
 *
 * Active-bundle Learning Records only. Resolved lexicon entries only.
 * Display cache is never used as a review card.
 */

import type { ActiveBundleMeta } from "../idb/siralex_db";
import { isLexiconDisplay, type EnrichedRecord } from "../types/records";
import { resolveLearningRecordForUi } from "./learning_record_resolve";
import { listLearningRecordsByBundle } from "./learning_record_store";
import {
  validateLearningRecordForWrite,
  type LearningRecordV1,
} from "./learning_record_types";

export type ReviewQueueIdentity = {
  bundle_id: string;
  ir_id: string;
};

export type ReviewQueueItem = {
  identity: ReviewQueueIdentity;
  learningRecord: LearningRecordV1;
  liveEntry: EnrichedRecord;
};

export type ReviewQueueBuildResult =
  | {
      state: "ready";
      bundle_id: string;
      items: ReviewQueueItem[];
      unresolved_count: number;
      total_saved_count: number;
    }
  | {
      state: "empty";
      bundle_id: string;
      unresolved_count: number;
      total_saved_count: number;
      reason: "no_saved_records" | "no_resolved_records";
    }
  | {
      state: "unavailable";
      reason: "no_active_bundle";
    };

/** Never-reviewed is derived — not a stored status. */
export function hasLearningRecordBeenReviewed(record: LearningRecordV1): boolean {
  return record.review_count > 0 && record.last_reviewed !== null;
}

export function isNeverReviewed(record: LearningRecordV1): boolean {
  return !hasLearningRecordBeenReviewed(record);
}

/**
 * Consistent reviewed/never-reviewed field pairing required for queue eligibility.
 * Inconsistent pairs are treated as invalid (excluded), not repaired.
 */
export function hasConsistentReviewFields(record: LearningRecordV1): boolean {
  const reviewed = hasLearningRecordBeenReviewed(record);
  if (reviewed) {
    return record.review_count > 0 && record.last_reviewed !== null;
  }
  return record.review_count === 0 && record.last_reviewed === null;
}

/**
 * Pure LS2 Review eligibility after a Learning Record has already been resolved
 * to a live entry. Shared by queue construction and LS3 Progress derivation.
 * Does not access IndexedDB or mutate inputs.
 */
export function isResolvedLexiconReviewEligible(
  learningRecord: LearningRecordV1,
  liveEntry: EnrichedRecord,
): boolean {
  if (!hasConsistentReviewFields(learningRecord)) return false;
  if (liveEntry.ir_kind !== "lexicon_entry" || !isLexiconDisplay(liveEntry)) return false;
  if (liveEntry.ir_id !== learningRecord.ir_id) return false;
  return true;
}

function reviewQueueGroup(record: LearningRecordV1): 0 | 1 | 2 {
  if (!hasLearningRecordBeenReviewed(record)) return 0;
  if (record.status === "still_learning") return 1;
  return 2;
}

/**
 * Exact deterministic comparator for Review queue items.
 * Groups: never-reviewed → reviewed still_learning → reviewed remembered.
 */
export function compareReviewQueueItems(a: ReviewQueueItem, b: ReviewQueueItem): number {
  return compareLearningRecordsForReview(a.learningRecord, b.learningRecord);
}

export function compareLearningRecordsForReview(a: LearningRecordV1, b: LearningRecordV1): number {
  const groupDiff = reviewQueueGroup(a) - reviewQueueGroup(b);
  if (groupDiff !== 0) return groupDiff;

  if (reviewQueueGroup(a) === 0) {
    const byCreated = a.created_at.localeCompare(b.created_at);
    if (byCreated !== 0) return byCreated;
  } else {
    const byReviewed = (a.last_reviewed ?? "").localeCompare(b.last_reviewed ?? "");
    if (byReviewed !== 0) return byReviewed;
  }

  const byBundle = a.bundle_id.localeCompare(b.bundle_id);
  if (byBundle !== 0) return byBundle;
  return a.ir_id.localeCompare(b.ir_id);
}

function tryValidateLearningRecord(record: unknown): LearningRecordV1 | undefined {
  try {
    validateLearningRecordForWrite(record, "review_queue");
    return record as LearningRecordV1;
  } catch {
    return undefined;
  }
}

function identityKey(bundleId: string, irId: string): string {
  return `${bundleId}\0${irId}`;
}

/**
 * Build an active-bundle review queue. Performs no Learning writes.
 */
export async function buildReviewQueue(
  db: IDBDatabase,
  activeMeta: ActiveBundleMeta | undefined,
): Promise<ReviewQueueBuildResult> {
  if (!activeMeta || typeof activeMeta.bundle_id !== "string" || activeMeta.bundle_id.trim() === "") {
    return { state: "unavailable", reason: "no_active_bundle" };
  }

  const bundleId = activeMeta.bundle_id;
  const listed = await listLearningRecordsByBundle(db, bundleId);
  const totalSavedCount = listed.length;

  if (totalSavedCount === 0) {
    return {
      state: "empty",
      bundle_id: bundleId,
      unresolved_count: 0,
      total_saved_count: 0,
      reason: "no_saved_records",
    };
  }

  // Deduplicate by identity (stable: first occurrence in list order before sort).
  const uniqueByIdentity = new Map<string, LearningRecordV1>();
  for (const raw of listed) {
    const validated = tryValidateLearningRecord(raw);
    if (!validated) continue;
    const key = identityKey(validated.bundle_id, validated.ir_id);
    if (!uniqueByIdentity.has(key)) {
      uniqueByIdentity.set(key, validated);
    }
  }

  const malformedOrDuplicateExtra = totalSavedCount - uniqueByIdentity.size;
  let unresolvedCount = malformedOrDuplicateExtra;

  const eligible: ReviewQueueItem[] = [];

  for (const record of uniqueByIdentity.values()) {
    if (!hasConsistentReviewFields(record)) {
      unresolvedCount += 1;
      continue;
    }

    let resolution;
    try {
      resolution = await resolveLearningRecordForUi(db, record, activeMeta);
    } catch {
      unresolvedCount += 1;
      continue;
    }

    if (resolution.state !== "resolved") {
      unresolvedCount += 1;
      continue;
    }

    const live = resolution.liveEntry;
    if (!isResolvedLexiconReviewEligible(record, live)) {
      unresolvedCount += 1;
      continue;
    }

    eligible.push({
      identity: { bundle_id: record.bundle_id, ir_id: record.ir_id },
      learningRecord: record,
      liveEntry: live,
    });
  }

  eligible.sort(compareReviewQueueItems);

  if (eligible.length === 0) {
    return {
      state: "empty",
      bundle_id: bundleId,
      unresolved_count: unresolvedCount,
      total_saved_count: totalSavedCount,
      reason: "no_resolved_records",
    };
  }

  return {
    state: "ready",
    bundle_id: bundleId,
    items: eligible,
    unresolved_count: unresolvedCount,
    total_saved_count: totalSavedCount,
  };
}
