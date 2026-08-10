/**
 * ML1D2 — LookupMode-driven Search chrome presentation + partner language picker.
 */

import type { LookupLanguage, LookupMode } from "../search/lookup_mode";
import { t } from "../i18n";
import { ensureSearchSwapIcon } from "./render_search_chrome";

export type LookupLanguageLabels = {
  fr: string;
  en: string;
  mnk: string;
};

export type LookupModePresentation = {
  fromHost: HTMLElement;
  toHost: HTMLElement;
  swapButton: HTMLButtonElement;
  searchLabelEl: HTMLElement;
  mode: LookupMode;
  labels: LookupLanguageLabels;
  englishAvailable: boolean;
  disabled?: boolean;
  onPartnerChange?: (partner: "fr" | "en") => void;
};

function labelForLanguage(lang: LookupLanguage, labels: LookupLanguageLabels): string {
  if (lang === "fr") return labels.fr;
  if (lang === "en") return labels.en;
  return labels.mnk;
}

function renderStaticLabel(host: HTMLElement, text: string): void {
  host.replaceChildren();
  const span = document.createElement("span");
  span.className = "ux2-search-language-text";
  span.textContent = text;
  host.appendChild(span);
}

function renderPartnerPicker(
  host: HTMLElement,
  options: {
    selected: "fr" | "en";
    englishAvailable: boolean;
    labels: LookupLanguageLabels;
    disabled: boolean;
    onPartnerChange?: (partner: "fr" | "en") => void;
  },
): void {
  host.replaceChildren();
  if (!options.englishAvailable) {
    renderStaticLabel(host, options.labels.fr);
    return;
  }

  const select = document.createElement("select");
  select.className = "ux2-search-partner-select";
  select.dataset.testid = "search-partner-language";
  select.setAttribute("aria-label", t("lookup.partnerSelect"));
  select.disabled = options.disabled;

  const frOpt = document.createElement("option");
  frOpt.value = "fr";
  frOpt.textContent = options.labels.fr;
  const enOpt = document.createElement("option");
  enOpt.value = "en";
  enOpt.textContent = options.labels.en;
  select.append(frOpt, enOpt);
  select.value = options.selected;

  select.addEventListener("change", () => {
    const next = select.value === "en" ? "en" : "fr";
    options.onPartnerChange?.(next);
  });

  host.appendChild(select);
}

function renderEndpoint(
  host: HTMLElement,
  language: LookupLanguage,
  options: {
    isPartnerSide: boolean;
    englishAvailable: boolean;
    labels: LookupLanguageLabels;
    disabled: boolean;
    onPartnerChange?: (partner: "fr" | "en") => void;
  },
): void {
  if (options.isPartnerSide) {
    renderPartnerPicker(host, {
      selected: language === "en" ? "en" : "fr",
      englishAvailable: options.englishAvailable,
      labels: options.labels,
      disabled: options.disabled,
      onPartnerChange: options.onPartnerChange,
    });
    return;
  }
  renderStaticLabel(host, labelForLanguage(language, options.labels));
}

/**
 * Sync chrome from LookupMode (not legacy SearchDirection).
 * FR/EN endpoint becomes a picker when English capability is present.
 */
export function applyLookupModePresentation(view: LookupModePresentation): void {
  const fromIsPartner = view.mode.from === "fr" || view.mode.from === "en";
  const disabled = view.disabled === true;

  renderEndpoint(view.fromHost, view.mode.from, {
    isPartnerSide: fromIsPartner,
    englishAvailable: view.englishAvailable,
    labels: view.labels,
    disabled,
    onPartnerChange: view.onPartnerChange,
  });
  renderEndpoint(view.toHost, view.mode.to, {
    isPartnerSide: !fromIsPartner,
    englishAvailable: view.englishAvailable,
    labels: view.labels,
    disabled,
    onPartnerChange: view.onPartnerChange,
  });

  const fromLabel = labelForLanguage(view.mode.from, view.labels);
  const toLabel = labelForLanguage(view.mode.to, view.labels);
  const directionText = `${fromLabel} → ${toLabel}`;
  view.searchLabelEl.textContent = t("search.queryLabel", { direction: directionText });
  view.swapButton.setAttribute(
    "aria-label",
    t("search.switchDirection", { from: fromLabel, to: toLabel }),
  );
  ensureSearchSwapIcon(view.swapButton);
}

export function lookupModeInputLanguageLabel(
  mode: LookupMode,
  labels: LookupLanguageLabels,
): string {
  return labelForLanguage(mode.from, labels);
}
