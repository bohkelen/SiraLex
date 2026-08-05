// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { getCurrentLocale, setCurrentLocale } from "../i18n";
import {
  renderPrimaryNavigation,
  type PrimaryDestination,
} from "./render_primary_navigation";

describe("renderPrimaryNavigation", () => {
  it("renders Search/Saved/Review/More in English", () => {
    const previous = getCurrentLocale();
    setCurrentLocale("en");
    try {
      const view = renderPrimaryNavigation("search", { onNavigate: () => undefined });
      const labels = [...view.root.querySelectorAll(".ux2-primary-nav-label")].map(
        (node) => node.textContent,
      );
      expect(labels).toEqual(["Search", "Saved", "Review", "More"]);
      expect(view.root.getAttribute("aria-label")).toBe("Primary");
    } finally {
      setCurrentLocale(previous);
    }
  });

  it("renders French equivalents", () => {
    const previous = getCurrentLocale();
    setCurrentLocale("fr");
    try {
      const view = renderPrimaryNavigation("search", { onNavigate: () => undefined });
      const labels = [...view.root.querySelectorAll(".ux2-primary-nav-label")].map(
        (node) => node.textContent,
      );
      expect(labels).toEqual(["Recherche", "Enregistré", "Révision", "Plus"]);
      expect(view.root.getAttribute("aria-label")).toBe("Principal");
    } finally {
      setCurrentLocale(previous);
    }
  });

  it("marks only the active destination with aria-current", () => {
    const view = renderPrimaryNavigation("saved", { onNavigate: () => undefined });
    const buttons = [...view.root.querySelectorAll<HTMLButtonElement>(".ux2-primary-nav-item")];
    const currents = buttons.map((button) => ({
      destination: button.dataset.destination,
      current: button.getAttribute("aria-current"),
    }));
    expect(currents).toEqual([
      { destination: "search", current: null },
      { destination: "saved", current: "page" },
      { destination: "review", current: null },
      { destination: "more", current: null },
    ]);
  });

  it("invokes onNavigate with the clicked destination", () => {
    const onNavigate = vi.fn();
    const view = renderPrimaryNavigation("search", { onNavigate });
    view.root.querySelector<HTMLButtonElement>('[data-testid="ux2-nav-review"]')?.click();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("review");
  });

  it("updates active state without destroying nav nodes", () => {
    const view = renderPrimaryNavigation("search", { onNavigate: () => undefined });
    const before = [...view.root.querySelectorAll(".ux2-primary-nav-item")];
    view.setActive("more");
    const after = [...view.root.querySelectorAll(".ux2-primary-nav-item")];
    expect(after).toHaveLength(4);
    expect(after.every((node, index) => node === before[index])).toBe(true);
    expect(view.getActive()).toBe("more");
    expect(
      view.root.querySelector('[data-testid="ux2-nav-more"]')?.getAttribute("aria-current"),
    ).toBe("page");
    expect(
      view.root.querySelector('[data-testid="ux2-nav-search"]')?.getAttribute("aria-current"),
    ).toBeNull();
  });

  it("keeps icons aria-hidden and labels visible", () => {
    const view = renderPrimaryNavigation("search", { onNavigate: () => undefined });
    const icons = [...view.root.querySelectorAll(".ux2-primary-nav-icon")];
    expect(icons).toHaveLength(4);
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
    for (const label of view.root.querySelectorAll(".ux2-primary-nav-label")) {
      expect(label.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("accepts each primary destination as active", () => {
    const destinations: PrimaryDestination[] = ["search", "saved", "review", "more"];
    for (const destination of destinations) {
      const view = renderPrimaryNavigation(destination, { onNavigate: () => undefined });
      expect(view.getActive()).toBe(destination);
      expect(
        view.root
          .querySelector(`[data-destination="${destination}"]`)
          ?.classList.contains("ux2-primary-nav-item-active"),
      ).toBe(true);
    }
  });
});
