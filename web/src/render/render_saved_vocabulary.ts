/**
 * LS1I3 — Saved Vocabulary surface renderer (presentation only).
 */

import { t } from "../i18n";
import type {
  SavedVocabularyModel,
  SavedVocabularyRowVm,
} from "../learning/saved_vocabulary_session";
import { rowKey } from "../learning/saved_vocabulary_session";

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export type SavedVocabularyCallbacks = {
  onBack: () => void;
  onOpen: (row: SavedVocabularyRowVm & { state: "resolved" }) => void;
  onRemove: (row: SavedVocabularyRowVm) => void;
};

export type SavedVocabularyView = {
  root: HTMLElement;
  /** Preferred focus target after a successful remove (may be null). */
  focusAfterRemove: HTMLElement | null;
};

function renderRow(
  row: SavedVocabularyRowVm,
  callbacks: SavedVocabularyCallbacks,
  removingKey: string | undefined,
  rowError: string | undefined,
): HTMLElement {
  const key = rowKey(row.bundle_id, row.ir_id);
  const li = el("li", "saved-vocab-row");
  li.setAttribute("data-row-key", key);

  const main = el("div", "saved-vocab-row-main");
  const title = el("div", "saved-vocab-primary");
  const primaryText =
    row.primaryText.trim() !== "" ? row.primaryText : t("learning.unresolvedFallback");
  title.textContent = primaryText;
  main.appendChild(title);

  if (row.nkoText) {
    main.appendChild(el("div", "saved-vocab-nko", row.nkoText));
  }
  if (row.secondaryText) {
    main.appendChild(el("div", "saved-vocab-secondary", row.secondaryText));
  }

  if (row.state === "unresolved") {
    const badge = el("div", "saved-vocab-unresolved", t("learning.unresolved"));
    badge.setAttribute("data-reason", row.reason);
    main.appendChild(badge);
  }

  li.appendChild(main);

  const actions = el("div", "saved-vocab-actions");
  const busy = removingKey === key;

  if (row.state === "resolved") {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "btn saved-vocab-open";
    openBtn.textContent = t("learning.open");
    openBtn.disabled = busy;
    openBtn.addEventListener("click", () => {
      if (busy) return;
      callbacks.onOpen(row);
    });
    actions.appendChild(openBtn);
  }

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn saved-vocab-remove";
  removeBtn.textContent = t("learning.remove");
  removeBtn.disabled = busy;
  removeBtn.setAttribute("aria-busy", busy ? "true" : "false");
  removeBtn.addEventListener("click", () => {
    if (busy) return;
    callbacks.onRemove(row);
  });
  actions.appendChild(removeBtn);
  li.appendChild(actions);

  if (rowError) {
    const err = el("div", "saved-vocab-row-error", t("learning.removeError"));
    err.id = `saved-vocab-error-${key.replace(/\0/g, "-")}`;
    err.setAttribute("role", "status");
    removeBtn.setAttribute("aria-describedby", err.id);
    li.appendChild(err);
  }

  if (busy) {
    li.setAttribute("aria-busy", "true");
  }

  return li;
}

/**
 * Render the Saved Vocabulary surface for the given model.
 */
export function renderSavedVocabulary(
  model: SavedVocabularyModel,
  callbacks: SavedVocabularyCallbacks,
): SavedVocabularyView {
  const root = el("div", "saved-vocab-surface");

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "btn entry-back saved-vocab-back";
  backBtn.textContent = t("learning.backToSearch");
  backBtn.addEventListener("click", () => callbacks.onBack());
  root.appendChild(backBtn);

  const heading = el("h2", "saved-vocab-title", t("learning.savedVocabulary"));
  heading.id = "saved-vocab-heading";
  root.appendChild(heading);

  let focusAfterRemove: HTMLElement | null = null;

  if (model.surface === "loading") {
    const status = el("p", "saved-vocab-status", t("learning.loading"));
    status.setAttribute("role", "status");
    status.setAttribute("aria-busy", "true");
    root.appendChild(status);
    return { root, focusAfterRemove: null };
  }

  if (model.surface === "unavailable") {
    root.appendChild(el("p", "saved-vocab-status", t("learning.noActiveBundle")));
    focusAfterRemove = backBtn;
    return { root, focusAfterRemove };
  }

  if (model.surface === "error") {
    const err = el("p", "saved-vocab-status saved-vocab-page-error", t("learning.listError"));
    err.setAttribute("role", "alert");
    root.appendChild(err);
    focusAfterRemove = backBtn;
    return { root, focusAfterRemove };
  }

  if (model.surface === "empty") {
    root.appendChild(el("p", "saved-vocab-status", t("learning.empty")));
    focusAfterRemove = backBtn;
    return { root, focusAfterRemove };
  }

  const list = document.createElement("ul");
  list.className = "saved-vocab-list";
  list.setAttribute("aria-labelledby", heading.id);

  for (const row of model.rows) {
    const key = rowKey(row.bundle_id, row.ir_id);
    const rowError = model.rowErrors[key];
    list.appendChild(renderRow(row, callbacks, model.removingKey, rowError));
  }
  root.appendChild(list);

  // Prefer focusing the next row's Open/Remove after a remove; caller may use this.
  const firstAction =
    list.querySelector<HTMLButtonElement>(".saved-vocab-open, .saved-vocab-remove") ?? backBtn;
  focusAfterRemove = firstAction;

  return { root, focusAfterRemove };
}
