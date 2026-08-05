// @vitest-environment jsdom

import { describe, expect, it, beforeEach, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import {
  applySearchDirectionPresentation,
  ensureSearchSwapIcon,
} from "./render_search_chrome";

function mountDirectionDom() {
  document.body.innerHTML = `
    <span id="searchSourceLanguage"></span>
    <button id="langToggle" type="button"></button>
    <span id="searchTargetLanguage"></span>
    <label id="searchLabel" for="searchInput"></label>
  `;
  return {
    sourceLabelEl: document.querySelector<HTMLElement>("#searchSourceLanguage")!,
    targetLabelEl: document.querySelector<HTMLElement>("#searchTargetLanguage")!,
    swapButton: document.querySelector<HTMLButtonElement>("#langToggle")!,
    searchLabelEl: document.querySelector<HTMLElement>("#searchLabel")!,
  };
}

describe("UX2I3 search direction presentation", () => {
  beforeEach(() => {
    setCurrentLocale("en");
    document.body.innerHTML = "";
  });

  it("derives visible source/target labels from provided metadata (not hardcoded)", () => {
    const els = mountDirectionDom();
    applySearchDirectionPresentation({
      ...els,
      direction: "source_to_target",
      sourceLanguageLabel: "N’Ko Source",
      targetLanguageLabel: "Custom Target",
    });

    expect(els.sourceLabelEl.textContent).toBe("N’Ko Source");
    expect(els.targetLabelEl.textContent).toBe("Custom Target");
    expect(els.searchLabelEl.textContent).toContain("N’Ko Source → Custom Target");
    expect(document.body.textContent).not.toContain("French");
    expect(document.body.textContent).not.toContain("Maninka");
  });

  it("swaps visible labels and accessible name for target_to_source", () => {
    const els = mountDirectionDom();
    applySearchDirectionPresentation({
      ...els,
      direction: "target_to_source",
      sourceLanguageLabel: "French",
      targetLanguageLabel: "Maninka",
    });

    expect(els.sourceLabelEl.textContent).toBe("Maninka");
    expect(els.targetLabelEl.textContent).toBe("French");
    expect(els.swapButton.getAttribute("aria-label")).toBe(
      "Switch search direction: Maninka to French",
    );
  });

  it("updates French accessible swap label with direction", () => {
    setCurrentLocale("fr");
    const els = mountDirectionDom();
    applySearchDirectionPresentation({
      ...els,
      direction: "source_to_target",
      sourceLanguageLabel: "Français",
      targetLanguageLabel: "Maninka",
    });

    expect(els.swapButton.getAttribute("aria-label")).toBe(
      "Changer le sens de recherche : Français vers Maninka",
    );
  });

  it("ensures decorative swap icon is aria-hidden and callback wiring stays with host", () => {
    const els = mountDirectionDom();
    const onSwap = vi.fn();
    els.swapButton.addEventListener("click", onSwap);
    ensureSearchSwapIcon(els.swapButton);
    ensureSearchSwapIcon(els.swapButton);

    expect(els.swapButton.querySelectorAll(".ux2-search-swap-icon")).toHaveLength(1);
    expect(els.swapButton.querySelector(".ux2-search-swap-icon")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    els.swapButton.click();
    expect(onSwap).toHaveBeenCalledTimes(1);
  });
});
