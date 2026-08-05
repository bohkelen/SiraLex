/**
 * UX2I2 — Primary destination navigation (presentation only).
 * Owns mobile/desktop primary nav chrome; no IndexedDB, search, or learning logic.
 */

import { t, type TranslationKey } from "../i18n";

export type PrimaryDestination = "search" | "saved" | "review" | "more";

export const PRIMARY_DESTINATIONS: readonly PrimaryDestination[] = [
  "search",
  "saved",
  "review",
  "more",
] as const;

type NavItemDef = {
  destination: PrimaryDestination;
  labelKey: TranslationKey;
  testId: string;
  /** Optional stable id for transitional e2e compatibility (at most one). */
  elementId?: string;
  icon: (svg: SVGSVGElement) => void;
};

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function svgIcon(draw: (svg: SVGSVGElement) => void): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("ux2-primary-nav-icon");
  draw(svg);
  return svg;
}

function path(d: string, attrs: Record<string, string> = {}): SVGPathElement {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
  node.setAttribute("d", d);
  node.setAttribute("fill", "none");
  node.setAttribute("stroke", "currentColor");
  node.setAttribute("stroke-width", "2");
  node.setAttribute("stroke-linecap", "round");
  node.setAttribute("stroke-linejoin", "round");
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

function circle(cx: string, cy: string, r: string): SVGCircleElement {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  node.setAttribute("cx", cx);
  node.setAttribute("cy", cy);
  node.setAttribute("r", r);
  node.setAttribute("fill", "none");
  node.setAttribute("stroke", "currentColor");
  node.setAttribute("stroke-width", "2");
  return node;
}

const NAV_ITEMS: readonly NavItemDef[] = [
  {
    destination: "search",
    labelKey: "nav.search",
    testId: "ux2-nav-search",
    icon: (svg) => {
      svg.appendChild(circle("11", "11", "7"));
      svg.appendChild(path("M20 20l-3.5-3.5"));
    },
  },
  {
    destination: "saved",
    labelKey: "nav.saved",
    testId: "ux2-nav-saved",
    elementId: "openSavedVocabulary",
    icon: (svg) => {
      svg.appendChild(path("M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1z"));
    },
  },
  {
    destination: "review",
    labelKey: "nav.review",
    testId: "ux2-nav-review",
    icon: (svg) => {
      svg.appendChild(path("M5 5h9a2 2 0 0 1 2 2v12H7a2 2 0 0 0-2 2V5z"));
      svg.appendChild(path("M16 5h2a2 2 0 0 1 2 2v12h-4"));
    },
  },
  {
    destination: "more",
    labelKey: "nav.more",
    testId: "ux2-nav-more",
    icon: (svg) => {
      svg.appendChild(path("M5 7h14"));
      svg.appendChild(path("M5 12h14"));
      svg.appendChild(path("M5 17h14"));
    },
  },
];

export type PrimaryNavigationCallbacks = {
  onNavigate: (destination: PrimaryDestination) => void;
};

export type PrimaryNavigationView = {
  root: HTMLElement;
  setActive: (destination: PrimaryDestination) => void;
  getActive: () => PrimaryDestination;
};

function applyActiveState(buttons: HTMLButtonElement[], active: PrimaryDestination): void {
  for (const button of buttons) {
    const destination = button.dataset.destination as PrimaryDestination | undefined;
    const isActive = destination === active;
    button.classList.toggle("ux2-primary-nav-item-active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  }
}

export function renderPrimaryNavigation(
  active: PrimaryDestination,
  callbacks: PrimaryNavigationCallbacks,
): PrimaryNavigationView {
  const root = el("nav", "ux2-primary-nav");
  root.setAttribute("aria-label", t("nav.primaryAriaLabel"));

  const buttons: HTMLButtonElement[] = [];
  let current = active;

  for (const item of NAV_ITEMS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ux2-primary-nav-item";
    button.dataset.destination = item.destination;
    button.setAttribute("data-testid", item.testId);
    if (item.elementId) button.id = item.elementId;

    const icon = svgIcon(item.icon);
    const label = el("span", "ux2-primary-nav-label ux2-type-nav-label", t(item.labelKey));
    button.appendChild(icon);
    button.appendChild(label);

    button.addEventListener("click", () => {
      callbacks.onNavigate(item.destination);
    });

    buttons.push(button);
    root.appendChild(button);
  }

  applyActiveState(buttons, current);

  return {
    root,
    getActive: () => current,
    setActive: (destination: PrimaryDestination) => {
      current = destination;
      applyActiveState(buttons, current);
    },
  };
}
