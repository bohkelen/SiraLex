// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import { renderMore } from "./render_more";

function callbacks(extra: Partial<Parameters<typeof renderMore>[1]> = {}) {
  return {
    onOpenCorrections: vi.fn(),
    onOpenSearchFeedback: vi.fn(),
    onOpenDictionaries: vi.fn(),
    onOpenLearningData: vi.fn(),
    onOpenSourcesCredits: vi.fn(),
    onThemeChange: vi.fn(),
    onLocaleChange: vi.fn(),
    ...extra,
  };
}

describe("UX2I6A More landing renderer", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("renders sections in intended order without diagnostics or metrics", () => {
    const { root } = renderMore(
      {
        theme: "system",
        locale: "en",
        appVersion: "0.0.0",
        hasActiveDictionary: false,
      },
      callbacks(),
    );
    const headings = [...root.querySelectorAll(".ux2-more-section-heading")].map(
      (n) => n.textContent,
    );
    expect(headings).toEqual(["Contribute", "Dictionary & data", "Preferences", "About"]);
    expect(root.querySelector("#moreHeading")?.textContent).toBe("More");
    expect(root.textContent).not.toMatch(/diagnostic|developer|session count|streak|analytics/i);
    expect(root.textContent).not.toMatch(/\b67\b|\b12 submissions\b|community score/i);
  });

  it("wires navigation callbacks with real buttons", () => {
    const cb = callbacks();
    const { root } = renderMore(
      { theme: "light", locale: "en", appVersion: "1.2.3", hasActiveDictionary: true },
      cb,
    );
    for (const id of [
      "openManageCorrections",
      "openManageSearchFeedback",
      "openManageDictionaries",
      "openManageLearningData",
      "openSourcesCredits",
    ]) {
      const btn = root.querySelector<HTMLButtonElement>(`#${id}`)!;
      expect(btn.tagName).toBe("BUTTON");
      expect(btn.querySelector("button")).toBeNull();
    }
    root.querySelector<HTMLButtonElement>("#openManageCorrections")!.click();
    root.querySelector<HTMLButtonElement>("#openManageSearchFeedback")!.click();
    root.querySelector<HTMLButtonElement>("#openManageDictionaries")!.click();
    root.querySelector<HTMLButtonElement>("#openManageLearningData")!.click();
    root.querySelector<HTMLButtonElement>("#openSourcesCredits")!.click();
    expect(cb.onOpenCorrections).toHaveBeenCalledTimes(1);
    expect(cb.onOpenSearchFeedback).toHaveBeenCalledTimes(1);
    expect(cb.onOpenDictionaries).toHaveBeenCalledTimes(1);
    expect(cb.onOpenLearningData).toHaveBeenCalledTimes(1);
    expect(cb.onOpenSourcesCredits).toHaveBeenCalledTimes(1);
  });

  it("reflects Theme options and current value", () => {
    const cb = callbacks();
    const { root } = renderMore(
      { theme: "dark", locale: "en", appVersion: "0.0.0", hasActiveDictionary: false },
      cb,
    );
    const select = root.querySelector<HTMLSelectElement>("#themeSelect")!;
    expect([...select.options].map((o) => o.value)).toEqual(["system", "light", "dark"]);
    expect(select.value).toBe("dark");
    select.value = "light";
    select.dispatchEvent(new Event("change"));
    expect(cb.onThemeChange).toHaveBeenCalledWith("light");
  });

  it("reflects Interface language options and current value", () => {
    const cb = callbacks();
    const { root } = renderMore(
      { theme: "system", locale: "fr", appVersion: "0.0.0", hasActiveDictionary: false },
      cb,
    );
    const select = root.querySelector<HTMLSelectElement>("#localeSelect")!;
    expect([...select.options].map((o) => o.value).sort()).toEqual(["en", "fr"]);
    expect(select.value).toBe("fr");
    select.value = "en";
    select.dispatchEvent(new Event("change"));
    expect(cb.onLocaleChange).toHaveBeenCalledWith("en");
  });

  it("renders About version and conditional local-dictionary copy", () => {
    const withDict = renderMore(
      { theme: "system", locale: "en", appVersion: "9.9.9", hasActiveDictionary: true },
      callbacks(),
    );
    expect(withDict.root.textContent).toContain("SiraLex");
    expect(withDict.root.textContent).toContain("Version 9.9.9");
    expect(withDict.root.textContent).toContain("Dictionary stored on this device");
    expect(withDict.root.textContent).not.toContain("No dictionary stored for offline search");

    const without = renderMore(
      { theme: "system", locale: "en", appVersion: "9.9.9", hasActiveDictionary: false },
      callbacks(),
    );
    expect(without.root.textContent).toContain("No dictionary stored for offline search");
  });

  it("localizes French More labels", () => {
    setCurrentLocale("fr");
    const { root } = renderMore(
      { theme: "system", locale: "fr", appVersion: "0.0.0", hasActiveDictionary: false },
      callbacks(),
    );
    expect(root.querySelector("#moreHeading")?.textContent).toBe("Plus");
    expect(root.textContent).toContain("Contribuer");
    expect(root.textContent).toContain("Corrections");
    expect(root.textContent).toContain("Retours de recherche");
    expect(root.textContent).toContain("Données d’apprentissage");
    expect(root.querySelector("#openManageLearningData")?.textContent).toContain(
      "Données d’apprentissage",
    );
  });
});
