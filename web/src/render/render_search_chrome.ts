/**
 * UX2I3 — Search direction presentation helpers (presentation only).
 */

import type { SearchDirection } from "../bundle_labels";
import { t } from "../i18n";

export type SearchDirectionPresentation = {
  sourceLabelEl: HTMLElement;
  targetLabelEl: HTMLElement;
  swapButton: HTMLButtonElement;
  searchLabelEl: HTMLElement;
  direction: SearchDirection;
  /** Bundle-derived source language label (dictionary source side). */
  sourceLanguageLabel: string;
  /** Bundle-derived target language label (dictionary target side). */
  targetLanguageLabel: string;
};

function swapIconSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("ux2-search-swap-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M7 7h11M18 7l-3-3M18 7l-3 3M17 17H6M6 17l3-3M6 17l3 3",
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

/**
 * Ensure the swap control contains only the decorative icon (idempotent).
 */
export function ensureSearchSwapIcon(swapButton: HTMLButtonElement): void {
  if (swapButton.querySelector(".ux2-search-swap-icon")) return;
  swapButton.replaceChildren(swapIconSvg());
}

/**
 * Sync visible source/target labels, accessible swap name, and compatibility #searchLabel.
 * Visible left/right always show the active search-from / search-to languages.
 */
export function applySearchDirectionPresentation(view: SearchDirectionPresentation): void {
  const fromLabel =
    view.direction === "source_to_target" ? view.sourceLanguageLabel : view.targetLanguageLabel;
  const toLabel =
    view.direction === "source_to_target" ? view.targetLanguageLabel : view.sourceLanguageLabel;

  view.sourceLabelEl.textContent = fromLabel;
  view.targetLabelEl.textContent = toLabel;

  const directionText = `${fromLabel} → ${toLabel}`;
  view.searchLabelEl.textContent = t("search.queryLabel", { direction: directionText });
  view.swapButton.setAttribute(
    "aria-label",
    t("search.switchDirection", { from: fromLabel, to: toLabel }),
  );
  ensureSearchSwapIcon(view.swapButton);
}
