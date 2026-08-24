// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { setCurrentLocale } from "../i18n";
import { renderSourcesCredits } from "./render_sources_credits";

describe("renderSourcesCredits", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("renders software and data license sections separately", () => {
    const { root } = renderSourcesCredits({
      credits: {
        software_license: "MIT OR Apache-2.0",
        data_license_policy: "source_specific",
        noncommercial_distribution: true,
        sharealike_license: "CC BY-NC-SA 4.0",
        sources: [
          {
            source_id: "src_malipense",
            source_title: "Mali-pense / Malidaba",
            claimed_license: "CC BY-NC-SA 4.0",
            attribution: "Source: Mali-pense",
            noncommercial_distribution: true,
            sharealike_required: true,
          },
        ],
      },
      bundleLabel: "French ↔ Maninka",
    });
    expect(root.textContent).toContain("MIT OR Apache-2.0");
    expect(root.textContent).toContain("CC BY-NC-SA 4.0");
    expect(root.textContent).toContain("Mali-pense");
    expect(root.textContent).not.toContain("src_siralex_lexical_review");
  });

  it("notes offline manifest source", () => {
    const { root } = renderSourcesCredits({
      credits: {
        software_license: "MIT OR Apache-2.0",
        noncommercial_distribution: true,
        sources: [],
      },
    });
    expect(root.textContent).toMatch(/installed on this device|network/i);
  });
});
