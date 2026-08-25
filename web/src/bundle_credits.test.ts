// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  projectCreditsFromManifest,
  projectCreditsFromManifestJson,
  storedCreditsMatchManifest,
} from "./bundle_credits";

const SAMPLE_V2_MANIFEST = {
  manifest_schema_version: "bundle_manifest_v2",
  software_license: { spdx_expression: "MIT OR Apache-2.0", applies_to: "application_software" },
  data_license_policy: "source_specific",
  distribution: { noncommercial_distribution: true, publication_authorized: false },
  sharealike_notice: {
    license: "CC BY-NC-SA 4.0",
    notice: "Adapted Mali-pense lexical data requires ShareAlike.",
  },
  sources: {
    included: [
      {
        source_id: "src_malipense",
        source_title: "Mali-pense / Malidaba",
        source_url: "https://example.com/malipense",
        claimed_license: "CC BY-NC-SA 4.0",
        attribution: "Source: Mali-pense\nLicense: CC BY-NC-SA 4.0",
        noncommercial_distribution: true,
        sharealike_required: true,
      },
    ],
  },
};

describe("bundle_credits", () => {
  it("projects source credits from v2 manifest", () => {
    const credits = projectCreditsFromManifest(SAMPLE_V2_MANIFEST);
    expect(credits).not.toBeNull();
    expect(credits!.software_license).toBe("MIT OR Apache-2.0");
    expect(credits!.sources).toHaveLength(1);
    expect(credits!.sources[0]!.claimed_license).toBe("CC BY-NC-SA 4.0");
    expect(credits!.noncommercial_distribution).toBe(true);
  });

  it("works from manifest JSON text offline", () => {
    const text = JSON.stringify(SAMPLE_V2_MANIFEST);
    const credits = projectCreditsFromManifestJson(text);
    expect(credits?.sources[0]?.source_title).toContain("Mali-pense");
  });

  it("separates software and data licenses in projection", () => {
    const credits = projectCreditsFromManifest(SAMPLE_V2_MANIFEST)!;
    expect(credits.software_license).toContain("MIT");
    expect(credits.sources[0]!.claimed_license).toBe("CC BY-NC-SA 4.0");
  });

  it("validates stored credits match manifest", () => {
    const text = JSON.stringify(SAMPLE_V2_MANIFEST);
    const projected = projectCreditsFromManifestJson(text)!;
    expect(storedCreditsMatchManifest(projected, text)).toBe(true);
  });

  it("does not include owner review source in manifest projection", () => {
    const withExcluded = {
      ...SAMPLE_V2_MANIFEST,
      sources: {
        included: SAMPLE_V2_MANIFEST.sources.included,
        excluded: [
          {
            source_id: "src_siralex_lexical_review",
            source_title: "Internal review",
          },
        ],
      },
    };
    const credits = projectCreditsFromManifest(withExcluded)!;
    expect(credits.sources.map((s) => s.source_id)).not.toContain("src_siralex_lexical_review");
  });
});
