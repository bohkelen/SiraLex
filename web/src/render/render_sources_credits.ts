/**
 * UX2 — Credits / Sources surface (offline, manifest-driven).
 */

import { t } from "../i18n";
import type { BundleCreditsProjection, BundleSourceCredit } from "../bundle_credits";

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

export type SourcesCreditsViewModel = {
  credits: BundleCreditsProjection;
  bundleId?: string;
  bundleLabel?: string;
};

export type SourcesCreditsView = {
  root: HTMLElement;
  heading: HTMLElement;
};

function renderSourceBlock(source: BundleSourceCredit): HTMLElement {
  const block = el("article", "ux2-credits-source-block");
  block.setAttribute("aria-labelledby", `credits-source-${source.source_id}`);

  const title = source.source_title ?? source.source_id;
  block.appendChild(el("h3", "ux2-type-section-heading ux2-credits-source-title", title)).id =
    `credits-source-${source.source_id}`;

  block.appendChild(el("p", "ux2-credits-meta", `${t("credits.sourceId")}: ${source.source_id}`));

  if (source.claimed_license) {
    block.appendChild(
      el("p", "ux2-credits-meta", `${t("credits.dataLicense")}: ${source.claimed_license}`),
    );
  }

  if (source.source_url) {
    const row = el("p", "ux2-credits-meta");
    row.appendChild(document.createTextNode(`${t("credits.reference")}: `));
    const link = document.createElement("a");
    link.href = source.source_url;
    link.textContent = source.source_url;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
    row.appendChild(link);
    block.appendChild(row);
  }

  if (source.attribution) {
    const attr = el("pre", "ux2-credits-attribution", source.attribution);
    block.appendChild(attr);
  }

  if (source.sharealike_required) {
    block.appendChild(el("p", "ux2-credits-notice", t("credits.shareAlikeRequired")));
  }

  if (source.noncommercial_distribution) {
    block.appendChild(el("p", "ux2-credits-notice", t("credits.nonCommercialData")));
  }

  return block;
}

export function renderSourcesCredits(model: SourcesCreditsViewModel): SourcesCreditsView {
  const root = el("div", "ux2-sources-credits-inner");
  const heading = el("h2", "ux2-type-page-title ux2-credits-title", t("credits.title"));
  heading.id = "sourcesCreditsHeading";
  heading.tabIndex = -1;
  root.appendChild(heading);

  if (model.bundleLabel || model.bundleId) {
    const sub = el(
      "p",
      "ux2-credits-bundle-context",
      model.bundleLabel ?? model.bundleId ?? "",
    );
    root.appendChild(sub);
  }

  root.appendChild(el("p", "ux2-credits-intro", t("credits.intro")));

  const software = el("section", "ux2-credits-section");
  software.setAttribute("aria-labelledby", "credits-software-heading");
  software.appendChild(
    el("h3", "ux2-type-section-heading", t("credits.softwareSection")),
  ).id = "credits-software-heading";
  software.appendChild(
    el("p", "ux2-credits-meta", `${t("credits.softwareLicense")}: ${model.credits.software_license}`),
  );
  software.appendChild(el("p", "ux2-credits-help", t("credits.softwareHelp")));
  root.appendChild(software);

  const dataSection = el("section", "ux2-credits-section");
  dataSection.setAttribute("aria-labelledby", "credits-data-heading");
  dataSection.appendChild(el("h3", "ux2-type-section-heading", t("credits.dataSection"))).id =
    "credits-data-heading";
  if (model.credits.data_license_policy) {
    dataSection.appendChild(
      el(
        "p",
        "ux2-credits-meta",
        `${t("credits.dataPolicy")}: ${model.credits.data_license_policy}`,
      ),
    );
  }
  if (model.credits.noncommercial_distribution) {
    dataSection.appendChild(el("p", "ux2-credits-notice", t("credits.bundleNonCommercial")));
  }
  if (model.credits.sharealike_notice) {
    dataSection.appendChild(el("p", "ux2-credits-notice", model.credits.sharealike_notice));
  } else if (model.credits.sharealike_license) {
    dataSection.appendChild(
      el(
        "p",
        "ux2-credits-notice",
        `${t("credits.shareAlikeLicense")}: ${model.credits.sharealike_license}`,
      ),
    );
  }
  root.appendChild(dataSection);

  const sourcesSection = el("section", "ux2-credits-section");
  sourcesSection.setAttribute("aria-labelledby", "credits-sources-heading");
  sourcesSection.appendChild(el("h3", "ux2-type-section-heading", t("credits.sourcesSection"))).id =
    "credits-sources-heading";

  for (const source of model.credits.sources) {
    sourcesSection.appendChild(renderSourceBlock(source));
  }
  root.appendChild(sourcesSection);

  root.appendChild(el("p", "ux2-credits-offline-note", t("credits.offlineNote")));

  return { root, heading };
}
