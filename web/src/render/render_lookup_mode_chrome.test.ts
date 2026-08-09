// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import {
  applyLookupModePresentation,
  lookupModeInputLanguageLabel,
} from "./render_lookup_mode_chrome";

function mountChrome() {
  document.body.innerHTML = `
    <div id="searchSourceLanguage" class="ux2-search-language"></div>
    <button id="langToggle" type="button"></button>
    <div id="searchTargetLanguage" class="ux2-search-language"></div>
    <label id="searchLabel" for="searchInput"></label>
  `;
  return {
    fromHost: document.querySelector<HTMLElement>("#searchSourceLanguage")!,
    toHost: document.querySelector<HTMLElement>("#searchTargetLanguage")!,
    swapButton: document.querySelector<HTMLButtonElement>("#langToggle")!,
    searchLabelEl: document.querySelector<HTMLElement>("#searchLabel")!,
  };
}

const labels = {
  fr: "French",
  en: "English",
  mnk: "Maninka",
};

describe("ML1D2 LookupMode search chrome", () => {
  beforeEach(() => {
    setCurrentLocale("en");
    document.body.innerHTML = "";
  });

  it("presents FR→MNK with partner picker when English is available", () => {
    const els = mountChrome();
    const onPartnerChange = vi.fn();
    applyLookupModePresentation({
      ...els,
      mode: { from: "fr", to: "mnk" },
      labels,
      englishAvailable: true,
      onPartnerChange,
    });

    const select = els.fromHost.querySelector<HTMLSelectElement>(
      '[data-testid="search-partner-language"]',
    );
    expect(select?.value).toBe("fr");
    expect(els.toHost.textContent).toBe("Maninka");
    expect(els.searchLabelEl.textContent).toContain("French → Maninka");
    expect(els.swapButton.getAttribute("aria-label")).toContain("French to Maninka");

    select!.value = "en";
    select!.dispatchEvent(new Event("change"));
    expect(onPartnerChange).toHaveBeenCalledWith("en");
  });

  it("presents EN→MNK and MNK→EN without using SearchDirection", () => {
    const els = mountChrome();
    applyLookupModePresentation({
      ...els,
      mode: { from: "en", to: "mnk" },
      labels,
      englishAvailable: true,
    });
    expect(
      els.fromHost.querySelector<HTMLSelectElement>('[data-testid="search-partner-language"]')
        ?.value,
    ).toBe("en");
    expect(els.toHost.textContent).toBe("Maninka");
    expect(lookupModeInputLanguageLabel({ from: "en", to: "mnk" }, labels)).toBe("English");

    applyLookupModePresentation({
      ...els,
      mode: { from: "mnk", to: "en" },
      labels,
      englishAvailable: true,
    });
    expect(els.fromHost.textContent).toBe("Maninka");
    expect(
      els.toHost.querySelector<HTMLSelectElement>('[data-testid="search-partner-language"]')
        ?.value,
    ).toBe("en");
    expect(lookupModeInputLanguageLabel({ from: "mnk", to: "en" }, labels)).toBe("Maninka");
  });

  it("hides English option when capability is absent", () => {
    const els = mountChrome();
    applyLookupModePresentation({
      ...els,
      mode: { from: "fr", to: "mnk" },
      labels,
      englishAvailable: false,
    });
    expect(els.fromHost.querySelector("select")).toBeNull();
    expect(els.fromHost.textContent).toBe("French");
    expect(els.toHost.textContent).toBe("Maninka");
  });

  it("localizes accessible swap label in French UI", () => {
    setCurrentLocale("fr");
    const els = mountChrome();
    applyLookupModePresentation({
      ...els,
      mode: { from: "fr", to: "mnk" },
      labels: { fr: "Français", en: "Anglais", mnk: "Maninka" },
      englishAvailable: true,
    });
    expect(els.swapButton.getAttribute("aria-label")).toBe(
      "Changer le sens de recherche : Français vers Maninka",
    );
  });
});
