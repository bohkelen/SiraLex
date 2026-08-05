/**
 * UX2I6B1 — Dictionaries consumer presentation helpers.
 *
 * Presentation only: does not install, remove, switch, or open IndexedDB.
 */

import { t } from "../i18n";

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export type InstalledDictionaryRowModel = {
  bundleId: string;
  displayName: string;
  versionLabel?: string;
  languageDirection: string;
  isActive: boolean;
  updateAvailable: boolean;
};

export type InstalledDictionaryListCallbacks = {
  onUse(bundleId: string): void;
  onRemove(bundleId: string): void;
  onUpdate?(bundleId: string): void;
  isBusy(): boolean;
};

/**
 * Render consumer installed-dictionary rows (editorial list, not dashboard cards).
 */
export function renderInstalledDictionaryList(
  rows: InstalledDictionaryRowModel[],
  callbacks: InstalledDictionaryListCallbacks,
): HTMLElement {
  const root = el("div", "ux2-dict-installed-list");

  if (rows.length === 0) {
    const empty = el("div", "ux2-dict-empty");
    empty.appendChild(el("p", "ux2-dict-empty-lead", t("dictionaries.none")));
    empty.appendChild(el("p", "ux2-dict-empty-hint", t("dictionaries.noneHelp")));
    root.appendChild(empty);
    return root;
  }

  for (const row of rows) {
    root.appendChild(renderInstalledDictionaryRow(row, callbacks));
  }
  return root;
}

export function renderInstalledDictionaryRow(
  row: InstalledDictionaryRowModel,
  callbacks: InstalledDictionaryListCallbacks,
): HTMLElement {
  const item = el("article", "ux2-dict-row");
  item.dataset.bundleId = row.bundleId;

  const main = el("div", "ux2-dict-row-main");
  const titleRow = el("div", "ux2-dict-row-title-row");
  titleRow.appendChild(el("div", "ux2-dict-row-title", row.displayName));
  if (row.isActive) {
    const active = el("span", "ux2-dict-row-active", t("dictionaries.active"));
    active.setAttribute("aria-label", t("dictionaries.active"));
    titleRow.appendChild(active);
  }
  main.appendChild(titleRow);

  const metaParts = [row.versionLabel, row.languageDirection].filter(
    (part): part is string => Boolean(part),
  );
  if (metaParts.length > 0) {
    main.appendChild(el("div", "ux2-dict-row-meta", metaParts.join(" · ")));
  }
  main.appendChild(el("div", "ux2-dict-row-offline", t("dictionaries.availableOffline")));
  if (row.updateAvailable) {
    main.appendChild(el("div", "ux2-dict-row-update", t("catalog.badge.updateAvailable")));
  }
  main.appendChild(el("p", "ux2-dict-row-retain", t("dictionaries.savedDataRetained")));

  const actions = el("div", "ux2-dict-row-actions");
  if (row.updateAvailable && callbacks.onUpdate) {
    const updateBtn = document.createElement("button");
    updateBtn.type = "button";
    updateBtn.className = "ux2-dict-action ux2-dict-action-update";
    updateBtn.textContent = t("catalog.action.update");
    updateBtn.disabled = callbacks.isBusy();
    updateBtn.addEventListener("click", () => callbacks.onUpdate?.(row.bundleId));
    actions.appendChild(updateBtn);
  }

  if (!row.isActive) {
    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "ux2-dict-action ux2-dict-action-use";
    useBtn.textContent = t("catalog.action.use");
    useBtn.disabled = callbacks.isBusy();
    useBtn.addEventListener("click", () => callbacks.onUse(row.bundleId));
    actions.appendChild(useBtn);
  }

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "ux2-dict-action ux2-dict-action-remove";
  removeBtn.textContent = t("dictionaries.removeFromDevice");
  removeBtn.disabled = callbacks.isBusy();
  removeBtn.addEventListener("click", () => callbacks.onRemove(row.bundleId));
  actions.appendChild(removeBtn);

  item.append(main, actions);
  return item;
}

/**
 * True when Learning Backup host should be hidden for dictionaries mode.
 * Pure predicate for unit tests / coordinator checks.
 */
export function isLearningBackupVisibleInDictionariesMode(): boolean {
  return false;
}
