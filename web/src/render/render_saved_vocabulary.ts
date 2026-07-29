/**
 * LS1I3 — Saved Vocabulary surface renderer (presentation only).
 */

import { t } from "../i18n";
import type {
  SavedVocabularyRowVm,
  SavedVocabularyViewModel,
} from "../learning/saved_vocabulary_session";

export type SavedVocabularyRendererCallbacks = {
  onBack: () => void;
  onOpen: (irId: string) => void;
  onRemove: (irId: string) => void;
};

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function statusText(vm: SavedVocabularyViewModel): string {
  switch (vm.state) {
    case "loading":
      return t("learning.loading");
    case "empty":
      return t("learning.empty");
    case "unavailable":
      return t("learning.noActiveBundle");
    case "error":
      return t("learning.listError");
    case "removing":
      return t("learning.removing");
    case "populated":
      if (vm.statusMessage === "remove_failed") return t("learning.removeError");
      if (vm.statusMessage === "open_failed") return t("learning.openFailed");
      return "";
    default:
      return "";
  }
}

function renderRow(
  row: SavedVocabularyRowVm,
  callbacks: SavedVocabularyRendererCallbacks,
  listBusy: boolean,
): HTMLElement {
  const item = el("li", "saved-vocab-item");
  item.dataset.irId = row.ir_id;

  const main = el("div", "saved-vocab-item-main");
  const title = el("div", "saved-vocab-headword", row.headword_latin);
  main.appendChild(title);
  if (row.headword_nko) {
    main.appendChild(el("div", "saved-vocab-nko", row.headword_nko));
  }
  if (row.gloss_short) {
    main.appendChild(el("div", "saved-vocab-gloss", row.gloss_short));
  }
  if (row.unresolved) {
    main.appendChild(el("div", "saved-vocab-unresolved", t("learning.unresolved")));
  }
  item.appendChild(main);

  const actions = el("div", "saved-vocab-item-actions");

  if (row.openable) {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "btn saved-vocab-open";
    openBtn.textContent = t("learning.openEntry");
    openBtn.disabled = listBusy || row.removing;
    openBtn.addEventListener("click", () => {
      if (listBusy || row.removing) return;
      callbacks.onOpen(row.ir_id);
    });
    actions.appendChild(openBtn);
  }

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn saved-vocab-remove";
  removeBtn.textContent = row.removing ? t("learning.removing") : t("learning.remove");
  removeBtn.disabled = listBusy || row.removing;
  removeBtn.setAttribute("aria-busy", row.removing ? "true" : "false");
  removeBtn.addEventListener("click", () => {
    if (listBusy || row.removing) return;
    callbacks.onRemove(row.ir_id);
  });
  actions.appendChild(removeBtn);

  item.appendChild(actions);
  return item;
}

/**
 * Apply an immutable view-model to a Saved Vocabulary root element.
 */
export function applySavedVocabularyView(
  root: HTMLElement,
  vm: SavedVocabularyViewModel,
  callbacks: SavedVocabularyRendererCallbacks,
): void {
  root.replaceChildren();
  root.className = "saved-vocab-surface";
  root.setAttribute("aria-busy", vm.state === "loading" || vm.state === "removing" ? "true" : "false");

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "btn entry-back saved-vocab-back";
  backBtn.textContent = t("learning.backToSearch");
  backBtn.addEventListener("click", callbacks.onBack);
  root.appendChild(backBtn);

  root.appendChild(el("h2", "saved-vocab-title", t("learning.savedVocabulary")));

  const status = el("div", "saved-vocab-status");
  status.id = "saved-vocab-status";
  status.setAttribute("role", "status");
  const message = statusText(vm);
  status.textContent = message;
  status.hidden = message === "";
  root.appendChild(status);

  if (vm.state === "loading" || vm.state === "unavailable" || vm.state === "error" || vm.state === "empty") {
    return;
  }

  const list = document.createElement("ul");
  list.className = "saved-vocab-list";
  list.setAttribute("aria-label", t("learning.savedVocabulary"));

  const listBusy = vm.state === "removing";
  for (const row of vm.rows) {
    list.appendChild(renderRow(row, callbacks, listBusy));
  }
  root.appendChild(list);
}

export function renderSavedVocabularySurface(
  vm: SavedVocabularyViewModel,
  callbacks: SavedVocabularyRendererCallbacks,
): HTMLElement {
  const root = el("div", "saved-vocab-surface");
  applySavedVocabularyView(root, vm, callbacks);
  return root;
}
