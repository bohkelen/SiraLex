/**
 * LS2I3 — minimal Review surface host (session + renderer wiring).
 *
 * Application layer owns mount element and navigation. This helper keeps
 * session lifecycle, stale-update guards, and render mapping testable without
 * a router. Final Saved Vocabulary Start Review affordance belongs to LS2I4.
 */

import type { ActiveBundleMeta } from "../idb/siralex_db";
import { renderReview, shouldMoveReviewFocus } from "../render/render_review";
import {
  createReviewSession,
  type ReviewSessionController,
  type ReviewSessionDeps,
  type ReviewSessionModel,
} from "./review_session";

export type ReviewSurfaceHostDeps = {
  mount: HTMLElement;
  getActiveMeta: () => ActiveBundleMeta | undefined;
  openDb: () => Promise<IDBDatabase>;
  /** Host-level currency (navigation generation / context). */
  isHostCurrent: () => boolean;
  onBack: () => void;
  now?: () => string;
  /** Test seam — override reflect persistence. */
  reflect?: ReviewSessionDeps["reflect"];
};

export type ReviewSurfaceHost = {
  /** Start or restart a review session and begin loading. */
  start(): void;
  /** Dispose the active session and stop accepting updates. */
  dispose(): void;
  /** True while this host instance has not been disposed. */
  isActive(): boolean;
};

/**
 * Bind createReviewSession to renderReview on a mount element.
 */
export function createReviewSurfaceHost(deps: ReviewSurfaceHostDeps): ReviewSurfaceHost {
  let disposed = false;
  let session: ReviewSessionController | undefined;
  let lastModel: ReviewSessionModel | undefined;
  let sessionEpoch = 0;

  function alive(): boolean {
    return !disposed && deps.isHostCurrent();
  }

  function applyModel(model: ReviewSessionModel): void {
    if (!alive()) return;

    const view = renderReview(model, {
      onReveal: () => {
        if (!alive()) return;
        session?.reveal();
      },
      onReflect: (outcome) => {
        if (!alive()) return;
        void session?.reflect(outcome);
      },
      onBack: () => {
        if (!alive()) return;
        dispose();
        deps.onBack();
      },
      onReviewAgain: () => {
        if (!alive()) return;
        start();
      },
    });

    deps.mount.replaceChildren(view.root);
    if (shouldMoveReviewFocus(lastModel, model) && view.focusTarget) {
      view.focusTarget.focus();
    }
    lastModel = model;
  }

  function start(): void {
    if (disposed) return;
    session?.dispose();
    session = undefined;
    lastModel = undefined;
    const epoch = ++sessionEpoch;

    const controller = createReviewSession({
      getActiveMeta: deps.getActiveMeta,
      openDb: deps.openDb,
      isCurrent: () => alive() && epoch === sessionEpoch,
      onUpdate: (model) => {
        if (!alive() || epoch !== sessionEpoch) return;
        applyModel(model);
      },
      now: deps.now,
      reflect: deps.reflect,
    });
    session = controller;
    applyModel({ surface: "loading" });
    void controller.load();
  }

  function dispose(): void {
    disposed = true;
    sessionEpoch += 1;
    session?.dispose();
    session = undefined;
    lastModel = undefined;
  }

  return {
    start,
    dispose,
    isActive: () => !disposed,
  };
}
