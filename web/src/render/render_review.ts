/**
 * LS2I3 — Review surface renderer (presentation only).
 *
 * Renders ReviewSessionModel. Does not open IndexedDB, build queues, or persist
 * reflections. Host owns session callbacks and navigation.
 */

import { t } from "../i18n";
import type { LearningReflectionOutcome } from "../learning/learning_record_types";
import type { ReviewSessionModel } from "../learning/review_session";
import { extractReviewLiveDisplay } from "./review_display";

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export type ReviewRenderCallbacks = {
  onReveal(): void;
  onReflect(outcome: LearningReflectionOutcome): void;
  onBack(): void;
  onReviewAgain(): void;
};

export type ReviewView = {
  root: HTMLElement;
  /** Preferred focus target for meaningful surface transitions. */
  focusTarget: HTMLElement | null;
};

function appendBackButton(root: HTMLElement, callbacks: ReviewRenderCallbacks): HTMLButtonElement {
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "btn entry-back review-back";
  backBtn.textContent = t("review.backToSaved");
  backBtn.addEventListener("click", () => callbacks.onBack());
  root.appendChild(backBtn);
  return backBtn;
}

function appendTitle(root: HTMLElement, text: string, id = "review-heading"): HTMLElement {
  const heading = el("h2", "review-title", text);
  heading.id = id;
  root.appendChild(heading);
  return heading;
}

function renderSupportRegion(display: NonNullable<ReturnType<typeof extractReviewLiveDisplay>>): HTMLElement {
  const region = el("section", "review-revealed");
  region.setAttribute("aria-labelledby", "review-meaning-heading");

  const meaningHeading = el("h3", "review-meaning-heading", t("review.meaningHeading"));
  meaningHeading.id = "review-meaning-heading";
  meaningHeading.tabIndex = -1;
  region.appendChild(meaningHeading);

  for (const sense of display.senses) {
    const senseEl = el("div", "review-sense");
    const header = el("div", "review-sense-header");
    if (sense.sense_num !== undefined) {
      header.appendChild(el("span", "review-sense-num", `${sense.sense_num}.`));
    }
    if (sense.glosses.length > 0) {
      header.appendChild(el("span", "review-sense-gloss", sense.glosses.join(" / ")));
    }
    senseEl.appendChild(header);

    for (const ex of sense.examples) {
      const exEl = el("div", "review-example");
      exEl.appendChild(el("div", "review-example-text", ex.text_latin));
      if (ex.text_nko) {
        exEl.appendChild(el("div", "review-example-nko", ex.text_nko));
      }
      if (ex.translations.length > 0) {
        exEl.appendChild(el("div", "review-example-trans", ex.translations.join(" / ")));
      }
      senseEl.appendChild(exEl);
    }
    region.appendChild(senseEl);
  }

  if (display.variants.length > 0) {
    region.appendChild(
      el("div", "review-variants", t("entry.variants", { value: display.variants.join(", ") })),
    );
  }

  return region;
}

/**
 * Whether the host should move focus after applying this model.
 * Skips busy-only toggles and duplicate same-card redraws.
 */
export function shouldMoveReviewFocus(
  previous: ReviewSessionModel | undefined,
  next: ReviewSessionModel,
): boolean {
  if (!previous) return true;
  if (previous.surface !== next.surface) return true;
  if (next.surface === "reviewing" && previous.surface === "reviewing") {
    if (previous.position !== next.position) return true;
    if (!previous.revealed && next.revealed) return true;
    return false;
  }
  return false;
}

/**
 * Render the Review surface for the given session model.
 */
export function renderReview(
  model: ReviewSessionModel,
  callbacks: ReviewRenderCallbacks,
): ReviewView {
  const root = el("div", "review-surface");
  const backBtn = appendBackButton(root, callbacks);

  if (model.surface === "loading") {
    const heading = appendTitle(root, t("review.title"));
    const status = el("p", "review-status", t("review.loading"));
    status.setAttribute("role", "status");
    status.setAttribute("aria-busy", "true");
    root.appendChild(status);
    return { root, focusTarget: heading };
  }

  if (model.surface === "unavailable") {
    const heading = appendTitle(root, t("review.title"));
    root.appendChild(el("p", "review-status", t("review.noActiveBundle")));
    return { root, focusTarget: heading };
  }

  if (model.surface === "error") {
    const heading = appendTitle(root, t("review.title"));
    const err = el("p", "review-status review-page-error", t("review.loadFailed"));
    err.setAttribute("role", "alert");
    root.appendChild(err);
    return { root, focusTarget: heading };
  }

  if (model.surface === "empty") {
    const heading = appendTitle(root, t("review.title"));
    const msg =
      model.reason === "no_saved_records" ? t("review.noSaved") : t("review.noResolved");
    root.appendChild(el("p", "review-status", msg));
    if (model.reason === "no_resolved_records" && model.unresolved_count > 0) {
      root.appendChild(
        el("p", "review-status", t("review.unresolvedNote", { count: model.unresolved_count })),
      );
    }
    return { root, focusTarget: heading };
  }

  if (model.surface === "complete") {
    const heading = appendTitle(root, t("review.complete"), "review-complete-heading");
    heading.tabIndex = -1;

    const summary = el("div", "review-complete-summary");
    summary.setAttribute("role", "status");
    summary.appendChild(el("p", "review-count", t("review.reviewed", { count: model.reviewed_count })));
    summary.appendChild(
      el("p", "review-count", t("review.stillLearningCount", { count: model.still_learning_count })),
    );
    summary.appendChild(
      el("p", "review-count", t("review.rememberedCount", { count: model.remembered_count })),
    );
    if (model.skipped_count > 0) {
      summary.appendChild(
        el("p", "review-count", t("review.skipped", { count: model.skipped_count })),
      );
    }
    if (model.unresolved_at_start_count > 0) {
      summary.appendChild(
        el(
          "p",
          "review-count",
          t("review.unavailableCount", { count: model.unresolved_at_start_count }),
        ),
      );
    }
    root.appendChild(summary);

    const actions = el("div", "review-actions");
    const again = document.createElement("button");
    again.type = "button";
    again.className = "btn review-again";
    again.textContent = t("review.again");
    again.addEventListener("click", () => callbacks.onReviewAgain());
    actions.appendChild(again);
    root.appendChild(actions);

    return { root, focusTarget: heading };
  }

  // reviewing
  const heading = appendTitle(root, t("review.title"));
  const card = el("article", "review-card");
  card.setAttribute("aria-labelledby", "review-headword");
  if (model.busy) {
    card.setAttribute("aria-busy", "true");
  }

  const position = el(
    "p",
    "review-position",
    t("review.position", { current: model.position, total: model.total }),
  );
  position.id = "review-position";
  card.appendChild(position);

  const display = extractReviewLiveDisplay(model.item.liveEntry);
  const headwordText = display?.headword_latin ?? model.item.liveEntry.preferred_form ?? "";
  const headword = el("h3", "review-headword", headwordText);
  headword.id = "review-headword";
  headword.tabIndex = -1;
  card.appendChild(headword);

  if (display?.headword_nko) {
    card.appendChild(el("div", "review-nko", display.headword_nko));
  }
  if (display?.pos) {
    card.appendChild(el("div", "review-pos", display.pos));
  }

  // Live entry only — Learning Record display_cache is never rendered as support.

  if (!model.revealed) {
    card.appendChild(el("p", "review-prompt", t("review.recall")));
  } else if (display) {
    card.appendChild(renderSupportRegion(display));
  }

  const actions = el("div", "review-actions");
  actions.setAttribute("role", "group");
  actions.setAttribute("aria-labelledby", "review-headword");
  if (model.busy) {
    actions.setAttribute("aria-busy", "true");
  }

  const revealBtn = document.createElement("button");
  revealBtn.type = "button";
  revealBtn.className = "btn review-reveal";
  revealBtn.textContent = t("review.reveal");
  revealBtn.disabled = model.busy || model.revealed;
  revealBtn.hidden = model.revealed;
  revealBtn.setAttribute("aria-busy", model.busy ? "true" : "false");
  revealBtn.addEventListener("click", () => {
    if (model.busy || model.revealed) return;
    callbacks.onReveal();
  });
  if (!model.revealed) {
    actions.appendChild(revealBtn);
  }

  const stillBtn = document.createElement("button");
  stillBtn.type = "button";
  stillBtn.className = "btn review-still-learning";
  stillBtn.textContent = t("review.stillLearning");
  stillBtn.disabled = model.busy || !model.revealed;
  stillBtn.hidden = !model.revealed;
  stillBtn.setAttribute("aria-busy", model.busy ? "true" : "false");
  stillBtn.addEventListener("click", () => {
    if (model.busy || !model.revealed) return;
    callbacks.onReflect("still_learning");
  });

  const rememberedBtn = document.createElement("button");
  rememberedBtn.type = "button";
  rememberedBtn.className = "btn review-remembered";
  rememberedBtn.textContent = t("review.remembered");
  rememberedBtn.disabled = model.busy || !model.revealed;
  rememberedBtn.hidden = !model.revealed;
  rememberedBtn.setAttribute("aria-busy", model.busy ? "true" : "false");
  rememberedBtn.addEventListener("click", () => {
    if (model.busy || !model.revealed) return;
    callbacks.onReflect("remembered");
  });

  if (model.revealed) {
    actions.appendChild(stillBtn);
    actions.appendChild(rememberedBtn);
  }

  card.appendChild(actions);

  if (model.busy) {
    const busyStatus = el("p", "review-busy-status", t("review.saving"));
    busyStatus.setAttribute("role", "status");
    busyStatus.id = "review-busy-status";
    card.appendChild(busyStatus);
  }

  if (model.error === "reflection_failed") {
    const err = el("p", "review-card-error", t("review.updateFailed"));
    err.id = "review-card-error";
    err.setAttribute("role", "alert");
    stillBtn.setAttribute("aria-describedby", err.id);
    rememberedBtn.setAttribute("aria-describedby", err.id);
    card.appendChild(err);
  }

  root.appendChild(card);

  let focusTarget: HTMLElement = headword;
  if (model.revealed) {
    const meaning = card.querySelector<HTMLElement>("#review-meaning-heading");
    if (meaning) focusTarget = meaning;
  }

  void heading;
  void backBtn;
  return { root, focusTarget };
}
