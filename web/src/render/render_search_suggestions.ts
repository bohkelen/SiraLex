/**
 * SQ1B — Prefix suggestion list (DOM only).
 *
 * Shown only on the exact-miss path. Selecting a suggestion is a query
 * rewrite; the host re-runs existing exact search.
 */

import { t } from "../i18n";

export type SearchSuggestionSelectHandler = (suggestionKey: string) => void;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderSearchSuggestions(
  suggestionKeys: readonly string[],
  onSelect: SearchSuggestionSelectHandler,
): HTMLElement | null {
  if (suggestionKeys.length === 0) return null;

  const root = el("div", "ux2-search-suggestions");
  root.setAttribute("data-testid", "search-suggestions");

  const heading = el("h2", "ux2-search-suggestions-heading ux2-type-metadata", t("search.suggestionsHeading"));
  heading.id = "search-suggestions-heading";
  root.appendChild(heading);

  const list = el("ul", "ux2-search-suggestions-list");
  list.setAttribute("role", "list");
  list.setAttribute("aria-labelledby", heading.id);

  for (const key of suggestionKeys) {
    const item = el("li", "ux2-search-suggestion-item");
    const button = el("button", "ux2-search-suggestion");
    button.type = "button";
    button.textContent = key;
    button.setAttribute("data-testid", "search-suggestion");
    button.setAttribute("data-suggestion-key", key);
    button.setAttribute("aria-label", t("search.suggestionAria", { suggestion: key }));
    button.addEventListener("click", () => {
      onSelect(key);
    });
    item.appendChild(button);
    list.appendChild(item);
  }

  root.appendChild(list);
  return root;
}
