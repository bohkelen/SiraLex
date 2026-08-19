// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { setCurrentLocale } from "../i18n";
import { renderSearchSuggestions } from "./render_search_suggestions";

describe("renderSearchSuggestions", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("returns null for an empty list", () => {
    expect(renderSearchSuggestions([], () => undefined)).toBeNull();
  });

  it("renders a labeled list of suggestion buttons", () => {
    const selected: string[] = [];
    const root = renderSearchSuggestions(["house", "hour"], (key) => {
      selected.push(key);
    });
    expect(root).not.toBeNull();
    if (!root) return;
    expect(root.getAttribute("data-testid")).toBe("search-suggestions");
    expect(root.querySelector("#search-suggestions-heading")?.textContent).toBe("Suggestions");
    const buttons = root.querySelectorAll<HTMLButtonElement>("[data-testid='search-suggestion']");
    expect([...buttons].map((button) => button.textContent)).toEqual(["house", "hour"]);
    expect(buttons[0]?.getAttribute("aria-label")).toBe("Search house");
    buttons[0]?.click();
    expect(selected).toEqual(["house"]);
  });

  it("uses French chrome copy when the UI locale is French", () => {
    setCurrentLocale("fr");
    const root = renderSearchSuggestions(["enfant"], () => undefined);
    expect(root?.querySelector("#search-suggestions-heading")?.textContent).toBe("Suggestions");
    expect(
      root?.querySelector("[data-testid='search-suggestion']")?.getAttribute("aria-label"),
    ).toBe("Chercher « enfant »");
  });
});
