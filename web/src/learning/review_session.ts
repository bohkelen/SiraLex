/**
 * LS2I2 — ephemeral Review session (headless).
 *
 * Snapshot queue at load; Reveal before Reflect; advance only after durable
 * persistence via reflectOnLearningRecord. Session state is not written to IDB.
 *
 * Database ownership: opens via injected `openDb()` per load/reflect operation
 * and does not close the connection. The host owns shared application DB
 * lifecycle (same pattern as entry/saved-vocabulary sessions). Do not hold
 * transactions open across Reveal/user interaction; each reflection uses the
 * LS2I1 transaction inside `reflectOnLearningRecord`.
 *
 * Persistence may complete after navigation away, but stale presentation
 * updates are dropped when `isCurrent()` is false or the controller is disposed.
 */

import type { ActiveBundleMeta } from "../idb/siralex_db";
import {
  LearningRecordNotFoundError,
  type LearningReflectionOutcome,
} from "./learning_record_types";
import { reflectOnLearningRecord } from "./learning_record_store";
import {
  buildReviewQueue,
  type ReviewQueueItem,
  type ReviewQueueBuildResult,
} from "./review_queue";

export type ReviewSessionModel =
  | { surface: "loading" }
  | { surface: "unavailable"; reason: "no_active_bundle" }
  | {
      surface: "empty";
      reason: "no_saved_records" | "no_resolved_records";
      unresolved_count: number;
    }
  | {
      surface: "reviewing";
      item: ReviewQueueItem;
      position: number;
      total: number;
      revealed: boolean;
      busy: boolean;
      error?: "reflection_failed";
      completed_count: number;
      unresolved_at_start_count: number;
    }
  | {
      surface: "complete";
      reviewed_count: number;
      still_learning_count: number;
      remembered_count: number;
      skipped_count: number;
      unresolved_at_start_count: number;
    }
  | { surface: "error"; reason: "load_failed" };

export type ReviewSessionState = {
  bundle_id: string;
  items: ReviewQueueItem[];
  current_index: number;
  revealed: boolean;
  busy: boolean;
  completed_count: number;
  still_learning_count: number;
  remembered_count: number;
  skipped_count: number;
  unresolved_at_start_count: number;
  reflection_error: boolean;
};

export type ReviewSessionDeps = {
  getActiveMeta: () => ActiveBundleMeta | undefined;
  openDb: () => Promise<IDBDatabase>;
  isCurrent: () => boolean;
  onUpdate: (model: ReviewSessionModel) => void;
  /** Deterministic timestamp injection for tests. */
  now?: () => string;
  /** Optional seams for tests. */
  buildQueue?: typeof buildReviewQueue;
  reflect?: typeof reflectOnLearningRecord;
};

export type ReviewSessionController = {
  load(): Promise<void>;
  reveal(): void;
  reflect(outcome: LearningReflectionOutcome): Promise<void>;
  dispose(): void;
  /** Test helper — returns undefined when no active snapshot. */
  getState(): ReviewSessionState | undefined;
};

function emitIfCurrent(deps: ReviewSessionDeps, model: ReviewSessionModel): void {
  if (!deps.isCurrent()) return;
  deps.onUpdate(model);
}

function reviewingModel(state: ReviewSessionState): ReviewSessionModel {
  const item = state.items[state.current_index];
  if (!item) {
    return {
      surface: "complete",
      reviewed_count: state.completed_count,
      still_learning_count: state.still_learning_count,
      remembered_count: state.remembered_count,
      skipped_count: state.skipped_count,
      unresolved_at_start_count: state.unresolved_at_start_count,
    };
  }
  return {
    surface: "reviewing",
    item,
    position: state.current_index + 1,
    total: state.items.length,
    revealed: state.revealed,
    busy: state.busy,
    ...(state.reflection_error ? { error: "reflection_failed" as const } : {}),
    completed_count: state.completed_count,
    unresolved_at_start_count: state.unresolved_at_start_count,
  };
}

function completeModel(state: ReviewSessionState): ReviewSessionModel {
  return {
    surface: "complete",
    reviewed_count: state.completed_count,
    still_learning_count: state.still_learning_count,
    remembered_count: state.remembered_count,
    skipped_count: state.skipped_count,
    unresolved_at_start_count: state.unresolved_at_start_count,
  };
}

function queueResultToModel(result: ReviewQueueBuildResult): ReviewSessionModel | null {
  if (result.state === "unavailable") {
    return { surface: "unavailable", reason: "no_active_bundle" };
  }
  if (result.state === "empty") {
    return {
      surface: "empty",
      reason: result.reason,
      unresolved_count: result.unresolved_count,
    };
  }
  return null;
}

/**
 * Create a headless Review session controller.
 */
export function createReviewSession(deps: ReviewSessionDeps): ReviewSessionController {
  let generation = 0;
  let disposed = false;
  let state: ReviewSessionState | undefined;

  const buildQueue = deps.buildQueue ?? buildReviewQueue;
  const reflectFn = deps.reflect ?? reflectOnLearningRecord;
  const now = deps.now ?? (() => new Date().toISOString());

  function alive(gen: number): boolean {
    return !disposed && gen === generation && deps.isCurrent();
  }

  function emitReviewing(gen: number): void {
    if (!alive(gen) || !state) return;
    if (state.current_index >= state.items.length) {
      deps.onUpdate(completeModel(state));
      return;
    }
    deps.onUpdate(reviewingModel(state));
  }

  return {
    async load(): Promise<void> {
      const gen = ++generation;
      state = undefined;
      emitIfCurrent(deps, { surface: "loading" });

      const meta = deps.getActiveMeta();
      if (!meta || typeof meta.bundle_id !== "string" || meta.bundle_id.trim() === "") {
        if (alive(gen)) deps.onUpdate({ surface: "unavailable", reason: "no_active_bundle" });
        return;
      }

      try {
        const db = await deps.openDb();
        if (!alive(gen)) return;

        const result = await buildQueue(db, meta);
        if (!alive(gen)) return;

        const early = queueResultToModel(result);
        if (early) {
          deps.onUpdate(early);
          return;
        }

        if (result.state !== "ready") {
          deps.onUpdate({ surface: "error", reason: "load_failed" });
          return;
        }

        state = {
          bundle_id: result.bundle_id,
          items: result.items.map((item) => ({
            identity: { ...item.identity },
            learningRecord: item.learningRecord,
            liveEntry: item.liveEntry,
          })),
          current_index: 0,
          revealed: false,
          busy: false,
          completed_count: 0,
          still_learning_count: 0,
          remembered_count: 0,
          skipped_count: 0,
          unresolved_at_start_count: result.unresolved_count,
          reflection_error: false,
        };
        emitReviewing(gen);
      } catch {
        if (!alive(gen)) return;
        state = undefined;
        deps.onUpdate({ surface: "error", reason: "load_failed" });
      }
    },

    reveal(): void {
      if (disposed || !deps.isCurrent() || !state) return;
      if (state.busy) return;
      if (state.current_index >= state.items.length) return;
      if (state.revealed) return;
      state.revealed = true;
      state.reflection_error = false;
      emitReviewing(generation);
    },

    async reflect(outcome: LearningReflectionOutcome): Promise<void> {
      if (disposed || !deps.isCurrent() || !state) return;
      if (state.busy) return;
      if (!state.revealed) return;
      if (state.current_index >= state.items.length) return;
      if (outcome !== "still_learning" && outcome !== "remembered") return;

      const gen = generation;
      const item = state.items[state.current_index]!;
      state.busy = true;
      state.reflection_error = false;
      emitReviewing(gen);

      try {
        const db = await deps.openDb();
        if (!alive(gen) || !state) return;

        const updated = await reflectFn(
          db,
          item.identity.bundle_id,
          item.identity.ir_id,
          outcome,
          now(),
        );

        if (!alive(gen) || !state) {
          // Persistence may have committed; drop presentation update.
          return;
        }

        state.items[state.current_index] = {
          ...item,
          learningRecord: updated,
        };
        state.completed_count += 1;
        if (outcome === "still_learning") {
          state.still_learning_count += 1;
        } else {
          state.remembered_count += 1;
        }
        state.busy = false;
        state.reflection_error = false;
        state.current_index += 1;
        state.revealed = false;
        emitReviewing(gen);
      } catch (err) {
        if (!alive(gen) || !state) return;

        if (err instanceof LearningRecordNotFoundError) {
          state.skipped_count += 1;
          state.busy = false;
          state.reflection_error = false;
          state.current_index += 1;
          state.revealed = false;
          emitReviewing(gen);
          return;
        }

        state.busy = false;
        state.reflection_error = true;
        // Remain revealed for retry.
        emitReviewing(gen);
      }
    },

    dispose(): void {
      disposed = true;
      generation += 1;
      state = undefined;
    },

    getState(): ReviewSessionState | undefined {
      if (!state) return undefined;
      return {
        ...state,
        items: [...state.items],
      };
    },
  };
}
