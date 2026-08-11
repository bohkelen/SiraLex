/**
 * DU1 — Consumer dictionary update presentation (Search notice + dialog phases).
 *
 * Presentation only: does not install or open IndexedDB.
 */

import { t } from "../i18n";
import type { DictionaryUpdateConsumerPhase } from "../dictionary_update/dictionary_update_consumer_state";

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export type SearchUpdateNoticeCallbacks = {
  onUpdate(): void;
  onNotNow(): void;
};

/** Non-blocking Search notice when a featured dictionary update is available. */
export function renderSearchUpdateNotice(callbacks: SearchUpdateNoticeCallbacks): HTMLElement {
  const root = el("aside", "ux2-dict-update-notice");
  root.setAttribute("role", "status");
  root.setAttribute("aria-labelledby", "dictionary-update-notice-title");
  root.dataset.testid = "dictionary-update-notice";

  const title = el("h3", "ux2-dict-update-notice-title", t("dictionaryUpdate.availableTitle"));
  title.id = "dictionary-update-notice-title";
  root.appendChild(title);
  root.appendChild(el("p", "ux2-dict-update-notice-body", t("dictionaryUpdate.availableBodyShort")));

  const actions = el("div", "ux2-dict-update-notice-actions");
  const updateBtn = document.createElement("button");
  updateBtn.type = "button";
  updateBtn.className = "ux2-dict-action ux2-dict-action-update";
  updateBtn.textContent = t("dictionaryUpdate.actionShort");
  updateBtn.addEventListener("click", () => callbacks.onUpdate());
  actions.appendChild(updateBtn);

  const notNowBtn = document.createElement("button");
  notNowBtn.type = "button";
  notNowBtn.className = "ux2-dict-action ux2-dict-action-secondary";
  notNowBtn.textContent = t("dictionaryUpdate.notNow");
  notNowBtn.addEventListener("click", () => callbacks.onNotNow());
  actions.appendChild(notNowBtn);

  root.appendChild(actions);
  return root;
}

export type DictionaryUpdateDialogCallbacks = {
  onConfirmUpdate(): void;
  onCancel(): void;
  onRetry(): void;
  onContinue(): void;
  onCloseFailure(): void;
};

export type DictionaryUpdateDialogModel = {
  phase: DictionaryUpdateConsumerPhase;
  progressMessage: string;
  failureMessage?: string;
  cleanupWarning?: string;
};

/**
 * Lightweight confirmation / progress / success / failure dialog for dictionary update.
 */
export function renderDictionaryUpdateDialog(
  model: DictionaryUpdateDialogModel,
  callbacks: DictionaryUpdateDialogCallbacks,
): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "ux2-dict-update-dialog";
  dialog.setAttribute("aria-labelledby", "dictionary-update-dialog-title");
  dialog.dataset.testid = "dictionary-update-dialog";
  dialog.dataset.phase = model.phase;

  if (model.phase === "confirming") {
    const title = el("h2", "ux2-dict-update-dialog-title", t("dictionaryUpdate.confirmTitle"));
    title.id = "dictionary-update-dialog-title";
    title.tabIndex = -1;
    dialog.appendChild(title);
    dialog.appendChild(el("p", "ux2-dict-update-dialog-body", t("dictionaryUpdate.confirmBody")));
    dialog.appendChild(el("p", "ux2-dict-update-dialog-help", t("dictionaryUpdate.whatsUpdated")));

    const actions = el("div", "ux2-dict-update-dialog-actions");
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "ux2-dict-action ux2-dict-action-update";
    confirmBtn.textContent = t("dictionaryUpdate.action");
    confirmBtn.addEventListener("click", () => callbacks.onConfirmUpdate());
    actions.appendChild(confirmBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ux2-dict-action ux2-dict-action-secondary";
    cancelBtn.textContent = t("dictionaryUpdate.cancel");
    cancelBtn.addEventListener("click", () => callbacks.onCancel());
    actions.appendChild(cancelBtn);
    dialog.appendChild(actions);
    return dialog;
  }

  if (model.phase === "progress") {
    const title = el("h2", "ux2-dict-update-dialog-title", t("dictionaryUpdate.progressTitle"));
    title.id = "dictionary-update-dialog-title";
    title.tabIndex = -1;
    dialog.appendChild(title);
    const status = el("p", "ux2-dict-update-dialog-progress", model.progressMessage);
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.dataset.testid = "dictionary-update-progress";
    dialog.appendChild(status);
    return dialog;
  }

  if (model.phase === "success") {
    const title = el("h2", "ux2-dict-update-dialog-title", t("dictionaryUpdate.successTitle"));
    title.id = "dictionary-update-dialog-title";
    title.tabIndex = -1;
    dialog.appendChild(title);
    dialog.appendChild(el("p", "ux2-dict-update-dialog-body", t("dictionaryUpdate.successBody")));
    if (model.cleanupWarning) {
      dialog.appendChild(
        el("p", "ux2-dict-update-dialog-warning", t("dictionaryUpdate.cleanupWarning")),
      );
    }
    const actions = el("div", "ux2-dict-update-dialog-actions");
    const continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "ux2-dict-action ux2-dict-action-update";
    continueBtn.textContent = t("dictionaryUpdate.continue");
    continueBtn.addEventListener("click", () => callbacks.onContinue());
    actions.appendChild(continueBtn);
    dialog.appendChild(actions);
    return dialog;
  }

  if (model.phase === "failure") {
    const title = el("h2", "ux2-dict-update-dialog-title", t("dictionaryUpdate.failureTitle"));
    title.id = "dictionary-update-dialog-title";
    title.tabIndex = -1;
    dialog.appendChild(title);
    dialog.appendChild(el("p", "ux2-dict-update-dialog-body", t("dictionaryUpdate.failureBody")));
    if (model.failureMessage) {
      const detail = el("p", "ux2-dict-update-dialog-detail mono", model.failureMessage);
      detail.dataset.testid = "dictionary-update-failure-detail";
      dialog.appendChild(detail);
    }
    const actions = el("div", "ux2-dict-update-dialog-actions");
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "ux2-dict-action ux2-dict-action-update";
    retryBtn.textContent = t("dictionaryUpdate.retry");
    retryBtn.addEventListener("click", () => callbacks.onRetry());
    actions.appendChild(retryBtn);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ux2-dict-action ux2-dict-action-secondary";
    closeBtn.textContent = t("dictionaryUpdate.close");
    closeBtn.addEventListener("click", () => callbacks.onCloseFailure());
    actions.appendChild(closeBtn);
    dialog.appendChild(actions);
    return dialog;
  }

  // idle — empty dialog should not be shown
  const title = el("h2", "ux2-dict-update-dialog-title", t("dictionaryUpdate.availableTitle"));
  title.id = "dictionary-update-dialog-title";
  dialog.appendChild(title);
  return dialog;
}

export function openDictionaryUpdateDialog(dialog: HTMLDialogElement): void {
  if (!dialog.isConnected) {
    document.body.appendChild(dialog);
  }
  try {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  } catch {
    dialog.setAttribute("open", "");
  }
  dialog.querySelector<HTMLElement>("#dictionary-update-dialog-title")?.focus();
}

export function closeDictionaryUpdateDialog(dialog: HTMLDialogElement | null | undefined): void {
  if (!dialog) return;
  try {
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  } catch {
    dialog.removeAttribute("open");
  }
  dialog.remove();
}
