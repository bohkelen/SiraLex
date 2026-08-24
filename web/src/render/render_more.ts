/**
 * UX2I6A — More landing renderer (presentation only).
 *
 * Does not write localStorage, reload, open IndexedDB, or navigate.
 */

import { t, type Locale } from "../i18n";
import type { UiThemePreference } from "../theme";

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function chevron(): HTMLElement {
  const wrap = el("span", "ux2-more-row-chevron");
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML =
    '<svg viewBox="0 0 24 24" focusable="false" width="18" height="18"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return wrap;
}

function navRow(opts: {
  id: string;
  title: string;
  help: string;
  onClick: () => void;
}): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = opts.id;
  btn.className = "ux2-more-row";
  const text = el("span", "ux2-more-row-text");
  text.appendChild(el("span", "ux2-more-row-title", opts.title));
  text.appendChild(el("span", "ux2-more-row-help", opts.help));
  btn.appendChild(text);
  btn.appendChild(chevron());
  btn.addEventListener("click", () => opts.onClick());
  return btn;
}

export type MoreViewModel = {
  theme: UiThemePreference;
  locale: Locale;
  appVersion: string;
  hasActiveDictionary: boolean;
};

export type MoreCallbacks = {
  onOpenCorrections(): void;
  onOpenSearchFeedback(): void;
  onOpenDictionaries(): void;
  onOpenLearningData(): void;
  onOpenSourcesCredits(): void;
  onThemeChange(theme: UiThemePreference): void;
  onLocaleChange(locale: Locale): void;
};

export type MoreView = {
  root: HTMLElement;
  heading: HTMLElement;
};

/**
 * Render the consumer More landing.
 */
export function renderMore(model: MoreViewModel, callbacks: MoreCallbacks): MoreView {
  const root = el("div", "ux2-more-landing-inner");

  const heading = el("h2", "ux2-type-page-title ux2-more-title", t("more.title"));
  heading.id = "moreHeading";
  heading.tabIndex = -1;
  root.appendChild(heading);

  const layout = el("div", "ux2-more-layout");

  const primary = el("div", "ux2-more-primary");

  const contribute = el("section", "ux2-more-section");
  contribute.setAttribute("aria-labelledby", "more-contribute-heading");
  contribute.appendChild(
    el("h3", "ux2-type-section-heading ux2-more-section-heading", t("more.contributeSection")),
  ).id = "more-contribute-heading";
  const contributeList = el("div", "ux2-more-rows");
  contributeList.appendChild(
    navRow({
      id: "openManageCorrections",
      title: t("more.corrections"),
      help: t("more.correctionsHelp"),
      onClick: () => callbacks.onOpenCorrections(),
    }),
  );
  contributeList.appendChild(
    navRow({
      id: "openManageSearchFeedback",
      title: t("more.searchFeedback"),
      help: t("more.searchFeedbackHelp"),
      onClick: () => callbacks.onOpenSearchFeedback(),
    }),
  );
  contribute.appendChild(contributeList);
  primary.appendChild(contribute);

  const dictionaryData = el("section", "ux2-more-section");
  dictionaryData.setAttribute("aria-labelledby", "more-dictionary-data-heading");
  dictionaryData.appendChild(
    el(
      "h3",
      "ux2-type-section-heading ux2-more-section-heading",
      t("more.dictionaryDataSection"),
    ),
  ).id = "more-dictionary-data-heading";
  const dataList = el("div", "ux2-more-rows");
  dataList.appendChild(
    navRow({
      id: "openManageDictionaries",
      title: t("more.dictionaries"),
      help: t("more.dictionariesHelp"),
      onClick: () => callbacks.onOpenDictionaries(),
    }),
  );
  dataList.appendChild(
    navRow({
      id: "openManageLearningData",
      title: t("more.learningData"),
      help: t("more.learningDataHelp"),
      onClick: () => callbacks.onOpenLearningData(),
    }),
  );
  dataList.appendChild(
    navRow({
      id: "openSourcesCredits",
      title: t("more.sourcesCredits"),
      help: t("more.sourcesCreditsHelp"),
      onClick: () => callbacks.onOpenSourcesCredits(),
    }),
  );
  dictionaryData.appendChild(dataList);
  primary.appendChild(dictionaryData);

  const secondary = el("div", "ux2-more-secondary");

  const preferences = el("section", "ux2-more-section ux2-more-preferences");
  preferences.setAttribute("aria-labelledby", "more-preferences-heading");
  preferences.appendChild(
    el("h3", "ux2-type-section-heading ux2-more-section-heading", t("more.preferencesSection")),
  ).id = "more-preferences-heading";

  const themeRow = el("div", "ux2-more-preference-row");
  const themeLabel = el("div", "ux2-more-preference-label", t("theme.selectorLabel"));
  themeLabel.id = "themeSelectorLabel";
  const themeSelect = document.createElement("select");
  themeSelect.id = "themeSelect";
  themeSelect.setAttribute("aria-labelledby", "themeSelectorLabel");
  for (const [value, labelKey] of [
    ["system", "theme.system"],
    ["light", "theme.light"],
    ["dark", "theme.dark"],
  ] as const) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = t(labelKey);
    if (model.theme === value) opt.selected = true;
    themeSelect.appendChild(opt);
  }
  themeSelect.addEventListener("change", () => {
    const next = themeSelect.value;
    if (next !== "system" && next !== "light" && next !== "dark") return;
    callbacks.onThemeChange(next);
  });
  themeRow.appendChild(themeLabel);
  themeRow.appendChild(themeSelect);
  preferences.appendChild(themeRow);

  const localeRow = el("div", "ux2-more-preference-row");
  const localeLabel = el("div", "ux2-more-preference-label", t("more.interfaceLanguage"));
  localeLabel.id = "localeSelectorLabel";
  const localeSelect = document.createElement("select");
  localeSelect.id = "localeSelect";
  localeSelect.setAttribute("aria-labelledby", "localeSelectorLabel");
  for (const [value, labelKey] of [
    ["en", "locale.english"],
    ["fr", "locale.french"],
  ] as const) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = t(labelKey);
    if (model.locale === value) opt.selected = true;
    localeSelect.appendChild(opt);
  }
  localeSelect.addEventListener("change", () => {
    const next = localeSelect.value;
    if (next !== "en" && next !== "fr") return;
    callbacks.onLocaleChange(next);
  });
  localeRow.appendChild(localeLabel);
  localeRow.appendChild(localeSelect);
  preferences.appendChild(localeRow);
  secondary.appendChild(preferences);

  const about = el("section", "ux2-more-section ux2-more-about");
  about.setAttribute("aria-labelledby", "more-about-heading");
  about.appendChild(
    el("h3", "ux2-type-section-heading ux2-more-section-heading", t("more.aboutSection")),
  ).id = "more-about-heading";
  about.appendChild(el("p", "ux2-more-about-brand", "SiraLex"));
  about.appendChild(
    el("p", "ux2-more-about-version", t("more.version", { version: model.appVersion })),
  );
  about.appendChild(
    el(
      "p",
      "ux2-more-about-local",
      model.hasActiveDictionary ? t("more.dictionaryStoredLocal") : t("more.noOfflineDictionary"),
    ),
  );
  secondary.appendChild(about);

  layout.appendChild(primary);
  layout.appendChild(secondary);
  root.appendChild(layout);

  return { root, heading };
}
