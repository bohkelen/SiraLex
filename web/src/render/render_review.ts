/**
 * LS2I3 / UX2I5B — Review surface renderer (presentation only).
 *
 * Renders ReviewSessionModel. Does not open IndexedDB, build queues, or persist
 * reflections. Host owns session callbacks and navigation.
 *
 * UX2_REVIEW_ACTION_LABEL_AMENDMENT: reflection buttons show conversational
 * "Not yet" / "Got it" while callbacks remain still_learning / remembered.
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

function nkoText(text: string, cls: string): HTMLElement {
  const node = el("div", cls, text);
  node.classList.add("ux2-text-nko");
  node.setAttribute("lang", "nqo");
  node.dir = "rtl";
  return node;
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
  backBtn.className = "btn entry-back review-back ux2-review-back";
  backBtn.textContent = t("review.backToSaved");
  backBtn.addEventListener("click", () => callbacks.onBack());
  root.appendChild(backBtn);
  return backBtn;
}

function appendTitle(root: HTMLElement, text: string, id = "review-heading"): HTMLElement {
  const heading = el("h2", "review-title ux2-type-page-title ux2-review-title", text);
  heading.id = id;
  root.appendChild(heading);
  return heading;
}

function renderSupportRegion(display: NonNullable<ReturnType<typeof extractReviewLiveDisplay>>): HTMLElement {
  const region = el("section", "review-revealed ux2-review-meaning");
  region.setAttribute("aria-labelledby", "review-meaning-heading");

  const meaningHeading = el(
    "h3",
    "review-meaning-heading ux2-type-section-heading ux2-review-meaning-heading",
    t("review.meaningHeading"),
  );
  meaningHeading.id = "review-meaning-heading";
  meaningHeading.tabIndex = -1;
  region.appendChild(meaningHeading);

  for (const sense of display.senses) {
    const senseEl = el("div", "review-sense ux2-review-sense");
    if (sense.sense_num !== undefined) {
      senseEl.appendChild(el("div", "review-sense-num ux2-type-metadata", `${sense.sense_num}.`));
    }
    for (const gloss of sense.glosses) {
      senseEl.appendChild(el("div", "review-sense-gloss ux2-review-gloss", gloss));
    }

    for (const ex of sense.examples) {
      const exEl = el("div", "review-example ux2-review-example");
      exEl.appendChild(el("div", "review-example-text", ex.text_latin));
      if (ex.text_nko) {
        exEl.appendChild(nkoText(ex.text_nko, "review-example-nko"));
      }
      for (const tr of ex.translations) {
        exEl.appendChild(el("div", "review-example-trans", tr));
      }
      senseEl.appendChild(exEl);
    }
    region.appendChild(senseEl);
  }

  if (display.variants.length > 0) {
    const variants = el("div", "review-variants ux2-review-variants");
    variants.appendChild(el("div", "ux2-type-section-heading", t("review.variantsHeading")));
    variants.appendChild(el("div", "ux2-review-variants-list", display.variants.join(", ")));
    region.appendChild(variants);
  }

  return region;
}

function renderCompleteSummary(
  model: Extract<ReviewSessionModel, { surface: "complete" }>,
): HTMLElement {
  const summary = el("div", "review-complete-summary ux2-review-complete-summary");
  summary.setAttribute("role", "status");

  const appendCount = (key: string, text: string, testId: string): void => {
    const row = el("p", "review-count ux2-review-complete-row", text);
    row.setAttribute("data-complete-metric", testId);
    summary.appendChild(row);
    void key;
  };

  appendCount("reviewed", t("review.reviewed", { count: model.reviewed_count }), "reviewed");
  appendCount(
    "still_learning",
    t("review.stillLearningCount", { count: model.still_learning_count }),
    "still_learning",
  );
  appendCount(
    "remembered",
    t("review.rememberedCount", { count: model.remembered_count }),
    "remembered",
  );
  if (model.skipped_count > 0) {
    appendCount("skipped", t("review.skipped", { count: model.skipped_count }), "skipped");
  }
  if (model.unresolved_at_start_count > 0) {
    appendCount(
      "unavailable",
      t("review.unavailableCount", { count: model.unresolved_at_start_count }),
      "unavailable",
    );
  }
  return summary;
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
  const root = el("div", "review-surface ux2-review-surface");
  const workspace = el("div", "ux2-review-workspace");
  const backBtn = appendBackButton(workspace, callbacks);

  if (model.surface === "loading") {
    const heading = appendTitle(workspace, t("review.title"));
    const status = el("p", "review-status", t("review.loading"));
    status.setAttribute("role", "status");
    status.setAttribute("aria-busy", "true");
    workspace.appendChild(status);
    root.appendChild(workspace);
    return { root, focusTarget: heading };
  }

  if (model.surface === "unavailable") {
    const heading = appendTitle(workspace, t("review.title"));
    workspace.appendChild(el("p", "review-status", t("review.noActiveBundle")));
    root.appendChild(workspace);
    return { root, focusTarget: heading };
  }

  if (model.surface === "error") {
    const heading = appendTitle(workspace, t("review.title"));
    const err = el("p", "review-status review-page-error", t("review.loadFailed"));
    err.setAttribute("role", "alert");
    workspace.appendChild(err);
    root.appendChild(workspace);
    return { root, focusTarget: heading };
  }

  if (model.surface === "empty") {
    const heading = appendTitle(workspace, t("review.title"));
    if (model.reason === "no_saved_records") {
      workspace.appendChild(el("p", "review-status ux2-review-empty-lead", t("review.noSavedLead")));
      workspace.appendChild(el("p", "review-status ux2-review-empty-hint", t("review.noSaved")));
    } else {
      workspace.appendChild(el("p", "review-status ux2-review-empty-lead", t("review.noResolved")));
      if (model.unresolved_count > 0) {
        workspace.appendChild(
          el("p", "review-status", t("review.unresolvedNote", { count: model.unresolved_count })),
        );
      }
    }
    root.appendChild(workspace);
    return { root, focusTarget: heading };
  }

  if (model.surface === "complete") {
    const heading = appendTitle(workspace, t("review.complete"), "review-complete-heading");
    heading.tabIndex = -1;
    heading.classList.add("ux2-review-complete-heading");

    workspace.appendChild(renderCompleteSummary(model));

    const actions = el("div", "review-actions ux2-review-actions");
    const again = document.createElement("button");
    again.type = "button";
    again.className = "btn review-again ux2-review-again";
    again.textContent = t("review.again");
    again.addEventListener("click", () => callbacks.onReviewAgain());
    actions.appendChild(again);
    workspace.appendChild(actions);

    root.appendChild(workspace);
    return { root, focusTarget: heading };
  }

  // reviewing
  const header = el("div", "ux2-review-header");
  const heading = appendTitle(header, t("review.title"));
  const position = el(
    "p",
    "review-position ux2-review-position ux2-type-metadata",
    t("review.position", { current: model.position, total: model.total }),
  );
  position.id = "review-position";
  header.appendChild(position);
  workspace.appendChild(header);

  const card = el("article", "review-card ux2-review-card");
  card.setAttribute("aria-labelledby", "review-headword");
  if (model.busy) {
    card.setAttribute("aria-busy", "true");
  }

  const display = extractReviewLiveDisplay(model.item.liveEntry);
  const headwordText = display?.headword_latin ?? model.item.liveEntry.preferred_form ?? "";

  const prompt = el("div", "ux2-review-prompt");
  const headword = el("h3", "review-headword ux2-review-headword ux2-type-headword-large", headwordText);
  headword.id = "review-headword";
  headword.tabIndex = -1;
  prompt.appendChild(headword);

  if (display?.headword_nko) {
    prompt.appendChild(nkoText(display.headword_nko, "review-nko ux2-review-nko"));
  }
  if (display?.pos) {
    prompt.appendChild(el("div", "review-pos ux2-review-pos ux2-type-metadata", display.pos));
  }
  card.appendChild(prompt);

  // Live entry only — Learning Record display_cache is never rendered as support.

  if (!model.revealed) {
    card.appendChild(el("p", "review-prompt ux2-review-recall", t("review.recall")));
  } else if (display) {
    card.appendChild(renderSupportRegion(display));
  }

  const actions = el("div", "review-actions ux2-review-actions");
  actions.setAttribute("role", "group");
  actions.setAttribute("aria-labelledby", "review-headword");
  if (model.busy) {
    actions.setAttribute("aria-busy", "true");
  }

  const revealBtn = document.createElement("button");
  revealBtn.type = "button";
  revealBtn.className = "btn review-reveal ux2-review-reveal";
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

  const reflection = el("div", "ux2-review-reflection");
  if (model.revealed) {
    reflection.appendChild(
      el("p", "ux2-review-reflection-prompt", t("review.reflectionPrompt")),
    );
  }

  const outcomes = el("div", "ux2-review-outcomes");
  const stillBtn = document.createElement("button");
  stillBtn.type = "button";
  stillBtn.className = "btn review-still-learning ux2-review-outcome";
  stillBtn.textContent = t("review.notYet");
  stillBtn.disabled = model.busy || !model.revealed;
  stillBtn.hidden = !model.revealed;
  stillBtn.setAttribute("aria-busy", model.busy ? "true" : "false");
  stillBtn.addEventListener("click", () => {
    if (model.busy || !model.revealed) return;
    callbacks.onReflect("still_learning");
  });

  const rememberedBtn = document.createElement("button");
  rememberedBtn.type = "button";
  rememberedBtn.className = "btn review-remembered ux2-review-outcome";
  rememberedBtn.textContent = t("review.gotIt");
  rememberedBtn.disabled = model.busy || !model.revealed;
  rememberedBtn.hidden = !model.revealed;
  rememberedBtn.setAttribute("aria-busy", model.busy ? "true" : "false");
  rememberedBtn.addEventListener("click", () => {
    if (model.busy || !model.revealed) return;
    callbacks.onReflect("remembered");
  });

  if (model.revealed) {
    outcomes.appendChild(stillBtn);
    outcomes.appendChild(rememberedBtn);
    reflection.appendChild(outcomes);
    actions.appendChild(reflection);
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

  workspace.appendChild(card);
  root.appendChild(workspace);

  let focusTarget: HTMLElement = headword;
  if (model.revealed) {
    const meaning = card.querySelector<HTMLElement>("#review-meaning-heading");
    if (meaning) focusTarget = meaning;
  }

  void heading;
  void backBtn;
  return { root, focusTarget };
}
