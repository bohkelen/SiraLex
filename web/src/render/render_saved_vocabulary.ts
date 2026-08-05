/**
 * LS1I3 / LS2I4 / LS3I2 / UX2I5A — Saved Vocabulary surface renderer (presentation only).
 *
 * Top-level Saved destination: no permanent Back-to-search control.
 * Progress/Review action derive only from the session model.
 */

import { getCurrentLocale, t, type Locale, type TranslationKey } from "../i18n";
import type { SavedVocabularyProgressVm } from "../learning/saved_vocabulary_progress";
import type {
  SavedVocabularyModel,
  SavedVocabularyReviewStatus,
  SavedVocabularyRowVm,
} from "../learning/saved_vocabulary_session";
import { rowKey } from "../learning/saved_vocabulary_session";

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

/** Deterministic locale-aware date for last-reviewed (no relative timers). */
export function formatReviewTimestamp(iso: string, locale: Locale = getCurrentLocale()): string | undefined {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  try {
    return new Intl.DateTimeFormat(locale === "fr" ? "fr" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(ms));
  } catch {
    return undefined;
  }
}

export type SavedVocabularyCallbacks = {
  /** Empty-state contextual action → Search destination (not a Back control). */
  onSearch: () => void;
  onOpen: (row: SavedVocabularyRowVm & { state: "resolved" }) => void;
  onRemove: (row: SavedVocabularyRowVm) => void;
  onStartReview: () => void;
};

export type SavedVocabularyView = {
  root: HTMLElement;
  /** Preferred focus target after a successful remove (may be null). */
  focusAfterRemove: HTMLElement | null;
  /** Start / Continue Review control when present. */
  startReviewButton: HTMLButtonElement | null;
  heading: HTMLElement | null;
};

function appendReviewStatus(host: HTMLElement, status: SavedVocabularyReviewStatus): void {
  if (status.state === "unknown") {
    return;
  }

  const label = el("div", "saved-vocab-review-status ux2-type-metadata", t(status.labelKey));
  label.setAttribute("data-review-status", status.state);
  host.appendChild(label);
}

function appendLastReviewed(host: HTMLElement, status: SavedVocabularyReviewStatus): void {
  if (status.state !== "still_learning" && status.state !== "remembered") return;
  const formatted = formatReviewTimestamp(status.last_reviewed);
  if (!formatted) return;
  host.appendChild(
    el("div", "saved-vocab-last-reviewed ux2-type-helper", t("review.lastReviewed", { date: formatted })),
  );
}

function appendMetric(dl: HTMLElement, labelKey: TranslationKey, value: number, testId: string): void {
  const row = el("div", "saved-vocab-progress-item");
  row.setAttribute("data-progress-metric", testId);
  const dt = document.createElement("dt");
  dt.className = "saved-vocab-progress-label";
  dt.textContent = t(labelKey);
  const dd = document.createElement("dd");
  dd.className = "saved-vocab-progress-value";
  dd.textContent = String(value);
  row.appendChild(dt);
  row.appendChild(dd);
  dl.appendChild(row);
}

function renderProgressSummary(progress: SavedVocabularyProgressVm): HTMLElement {
  const section = el("section", "saved-vocab-progress ux2-saved-progress");
  section.setAttribute("aria-labelledby", "saved-vocab-progress-heading");

  const heading = el("h3", "saved-vocab-progress-heading ux2-type-section-heading", t("progress.heading"));
  heading.id = "saved-vocab-progress-heading";
  section.appendChild(heading);

  const dl = document.createElement("dl");
  dl.className = "saved-vocab-progress-list";
  appendMetric(dl, "progress.saved", progress.total_saved, "saved");
  appendMetric(dl, "progress.notReviewed", progress.not_reviewed, "not_reviewed");
  appendMetric(dl, "progress.stillLearning", progress.still_learning, "still_learning");
  appendMetric(dl, "progress.remembered", progress.remembered, "remembered");
  if (progress.showUnavailable) {
    appendMetric(dl, "progress.unavailable", progress.unavailable, "unavailable");
  }
  section.appendChild(dl);
  return section;
}

function returnCueKey(
  cue: SavedVocabularyProgressVm["returnCue"],
): TranslationKey | undefined {
  if (cue === "review_new") return "progress.cue.reviewNew";
  if (cue === "review_still_learning") return "progress.cue.reviewStillLearning";
  if (cue === "review_again") return "progress.cue.reviewAgain";
  return undefined;
}

function renderReturnCue(progress: SavedVocabularyProgressVm): HTMLElement | null {
  const key = returnCueKey(progress.returnCue);
  if (!key) return null;
  const cue = el("p", "saved-vocab-return-cue", t(key));
  cue.setAttribute("data-return-cue", progress.returnCue);
  return cue;
}

function renderStartReviewRegion(
  model: Extract<SavedVocabularyModel, { surface: "populated" | "removing" }>,
  callbacks: SavedVocabularyCallbacks,
): { region: HTMLElement; button: HTMLButtonElement | null } {
  const region = el("div", "saved-vocab-start-review-region ux2-saved-review-region");

  const action = model.progress.reviewAction;
  if (action.state === "hidden") {
    return { region, button: null };
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn saved-vocab-start-review ux2-saved-review-cta";
  button.id = "saved-vocab-start-review";
  button.textContent =
    action.state === "enabled" && action.label === "continue"
      ? t("progress.continueReview")
      : t("progress.startReview");

  const removing = model.surface === "removing";
  const enabled = action.state === "enabled" && !removing;
  button.disabled = !enabled;
  button.addEventListener("click", () => {
    if (button.disabled) return;
    callbacks.onStartReview();
  });
  region.appendChild(button);

  if (action.state === "disabled") {
    const hint = el("p", "saved-vocab-start-review-hint", t("review.noResolved"));
    hint.id = "saved-vocab-start-review-hint";
    hint.setAttribute("role", "status");
    button.setAttribute("aria-describedby", hint.id);
    region.appendChild(hint);
  }

  return { region, button };
}

function renderResolvedRow(
  row: SavedVocabularyRowVm & { state: "resolved" },
  callbacks: SavedVocabularyCallbacks,
  busy: boolean,
  rowError: string | undefined,
): HTMLElement {
  const key = rowKey(row.bundle_id, row.ir_id);
  const li = el("li", "saved-vocab-row ux2-saved-row ux2-saved-row-resolved");
  li.setAttribute("data-row-key", key);

  const body = el("div", "ux2-saved-row-body");

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "saved-vocab-open ux2-saved-row-open";
  openBtn.disabled = busy;
  openBtn.setAttribute(
    "aria-label",
    t("learning.openEntry", { headword: row.primaryText.trim() || t("learning.unresolvedFallback") }),
  );

  const lexical = el("div", "ux2-saved-row-lexical");
  const title = el(
    "div",
    "saved-vocab-primary ux2-type-headword-medium",
    row.primaryText.trim() !== "" ? row.primaryText : t("learning.unresolvedFallback"),
  );
  lexical.appendChild(title);
  if (row.nkoText) {
    lexical.appendChild(nkoText(row.nkoText, "saved-vocab-nko ux2-saved-row-nko"));
  }
  if (row.secondaryText) {
    lexical.appendChild(el("div", "saved-vocab-secondary", row.secondaryText));
  }
  openBtn.appendChild(lexical);

  const meta = el("div", "ux2-saved-row-meta");
  appendReviewStatus(meta, row.reviewStatus);
  openBtn.appendChild(meta);

  openBtn.addEventListener("click", () => {
    if (busy) return;
    callbacks.onOpen(row);
  });
  body.appendChild(openBtn);

  const footer = el("div", "ux2-saved-row-footer");
  appendLastReviewed(footer, row.reviewStatus);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "saved-vocab-remove ux2-saved-remove";
  removeBtn.textContent = t("learning.remove");
  removeBtn.disabled = busy;
  removeBtn.setAttribute("aria-busy", busy ? "true" : "false");
  removeBtn.addEventListener("click", () => {
    if (busy) return;
    callbacks.onRemove(row);
  });
  footer.appendChild(removeBtn);
  body.appendChild(footer);

  if (rowError) {
    const err = el("div", "saved-vocab-row-error", t("learning.removeError"));
    err.id = `saved-vocab-error-${key.replace(/\0/g, "-")}`;
    err.setAttribute("role", "status");
    removeBtn.setAttribute("aria-describedby", err.id);
    body.appendChild(err);
  }

  li.appendChild(body);
  if (busy) li.setAttribute("aria-busy", "true");
  return li;
}

function renderUnresolvedRow(
  row: SavedVocabularyRowVm & { state: "unresolved" },
  callbacks: SavedVocabularyCallbacks,
  busy: boolean,
  rowError: string | undefined,
): HTMLElement {
  const key = rowKey(row.bundle_id, row.ir_id);
  const li = el("li", "saved-vocab-row ux2-saved-row ux2-saved-row-unresolved");
  li.setAttribute("data-row-key", key);

  const body = el("div", "ux2-saved-row-body");
  const lexical = el("div", "ux2-saved-row-lexical");
  const primaryText =
    row.primaryText.trim() !== "" ? row.primaryText : t("learning.unresolvedFallback");
  lexical.appendChild(el("div", "saved-vocab-primary ux2-type-headword-medium", primaryText));
  if (row.nkoText) {
    lexical.appendChild(nkoText(row.nkoText, "saved-vocab-nko ux2-saved-row-nko"));
  }
  if (row.secondaryText) {
    lexical.appendChild(el("div", "saved-vocab-secondary", row.secondaryText));
  }
  body.appendChild(lexical);

  const badge = el("div", "saved-vocab-unresolved", t("learning.unresolved"));
  badge.setAttribute("data-reason", row.reason);
  body.appendChild(badge);

  const meta = el("div", "ux2-saved-row-meta");
  appendReviewStatus(meta, row.reviewStatus);
  body.appendChild(meta);

  const footer = el("div", "ux2-saved-row-footer");
  appendLastReviewed(footer, row.reviewStatus);
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "saved-vocab-remove ux2-saved-remove";
  removeBtn.textContent = t("learning.remove");
  removeBtn.disabled = busy;
  removeBtn.setAttribute("aria-busy", busy ? "true" : "false");
  removeBtn.addEventListener("click", () => {
    if (busy) return;
    callbacks.onRemove(row);
  });
  footer.appendChild(removeBtn);
  body.appendChild(footer);

  if (rowError) {
    const err = el("div", "saved-vocab-row-error", t("learning.removeError"));
    err.id = `saved-vocab-error-${key.replace(/\0/g, "-")}`;
    err.setAttribute("role", "status");
    removeBtn.setAttribute("aria-describedby", err.id);
    body.appendChild(err);
  }

  li.appendChild(body);
  if (busy) li.setAttribute("aria-busy", "true");
  return li;
}

function renderRow(
  row: SavedVocabularyRowVm,
  callbacks: SavedVocabularyCallbacks,
  removingKey: string | undefined,
  rowError: string | undefined,
): HTMLElement {
  const key = rowKey(row.bundle_id, row.ir_id);
  const busy = removingKey === key;
  if (row.state === "resolved") {
    return renderResolvedRow(row, callbacks, busy, rowError);
  }
  return renderUnresolvedRow(row, callbacks, busy, rowError);
}

function renderEmptyState(callbacks: SavedVocabularyCallbacks): {
  root: HTMLElement;
  searchBtn: HTMLButtonElement;
} {
  const wrap = el("div", "ux2-saved-empty");
  wrap.appendChild(el("p", "saved-vocab-status ux2-saved-empty-lead", t("learning.emptyLead")));
  wrap.appendChild(el("p", "saved-vocab-status ux2-saved-empty-hint", t("learning.emptyHint")));
  const searchBtn = document.createElement("button");
  searchBtn.type = "button";
  searchBtn.className = "ux2-saved-search-cta";
  searchBtn.textContent = t("learning.searchForWord");
  searchBtn.addEventListener("click", () => callbacks.onSearch());
  wrap.appendChild(searchBtn);
  return { root: wrap, searchBtn };
}

/**
 * Render the Saved Vocabulary surface for the given model.
 */
export function renderSavedVocabulary(
  model: SavedVocabularyModel,
  callbacks: SavedVocabularyCallbacks,
): SavedVocabularyView {
  const root = el("div", "saved-vocab-surface ux2-saved-surface");

  const layout = el("div", "ux2-saved-layout");
  const context = el("div", "ux2-saved-context");
  const collection = el("div", "ux2-saved-collection");

  const heading = el("h2", "saved-vocab-title ux2-type-page-title", t("learning.savedVocabulary"));
  heading.id = "saved-vocab-heading";
  heading.tabIndex = -1;
  context.appendChild(heading);

  let focusAfterRemove: HTMLElement | null = null;
  let startReviewButton: HTMLButtonElement | null = null;

  if (model.surface === "loading") {
    const status = el("p", "saved-vocab-status", t("learning.loading"));
    status.setAttribute("role", "status");
    status.setAttribute("aria-busy", "true");
    context.appendChild(status);
    layout.appendChild(context);
    layout.appendChild(collection);
    root.appendChild(layout);
    return { root, focusAfterRemove: null, startReviewButton: null, heading };
  }

  if (model.surface === "unavailable") {
    context.appendChild(el("p", "saved-vocab-status", t("learning.noActiveBundle")));
    layout.appendChild(context);
    layout.appendChild(collection);
    root.appendChild(layout);
    focusAfterRemove = heading;
    return { root, focusAfterRemove, startReviewButton: null, heading };
  }

  if (model.surface === "error") {
    const err = el("p", "saved-vocab-status saved-vocab-page-error", t("learning.listError"));
    err.setAttribute("role", "alert");
    context.appendChild(err);
    layout.appendChild(context);
    layout.appendChild(collection);
    root.appendChild(layout);
    focusAfterRemove = heading;
    return { root, focusAfterRemove, startReviewButton: null, heading };
  }

  if (model.surface === "empty") {
    const empty = renderEmptyState(callbacks);
    collection.appendChild(empty.root);
    layout.appendChild(context);
    layout.appendChild(collection);
    root.appendChild(layout);
    focusAfterRemove = empty.searchBtn;
    return { root, focusAfterRemove, startReviewButton: null, heading };
  }

  // populated | removing
  context.appendChild(renderProgressSummary(model.progress));

  if (model.progress.showUnavailable) {
    const explanation = el(
      "p",
      "saved-vocab-unavailable-explanation",
      t("progress.unavailableExplanation"),
    );
    explanation.id = "saved-vocab-unavailable-explanation";
    context.appendChild(explanation);
  }

  const cue = renderReturnCue(model.progress);
  if (cue) context.appendChild(cue);

  const { region, button } = renderStartReviewRegion(model, callbacks);
  context.appendChild(region);
  startReviewButton = button;

  const list = document.createElement("ul");
  list.className = "saved-vocab-list ux2-saved-list";
  list.setAttribute("aria-labelledby", heading.id);

  for (const row of model.rows) {
    const key = rowKey(row.bundle_id, row.ir_id);
    const rowError = model.rowErrors[key];
    list.appendChild(renderRow(row, callbacks, model.removingKey, rowError));
  }
  collection.appendChild(list);

  layout.appendChild(context);
  layout.appendChild(collection);
  root.appendChild(layout);

  const firstAction =
    list.querySelector<HTMLButtonElement>(".saved-vocab-open, .saved-vocab-remove") ?? heading;
  focusAfterRemove = firstAction;

  return { root, focusAfterRemove, startReviewButton, heading };
}
