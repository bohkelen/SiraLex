/**
 * PRODUCT2D — offline install + Credits against the committed public bundle.
 */
import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { projectCreditsFromManifestJson } from "./bundle_credits";
import { parseAndValidateManifestJson } from "./bundle_manifest";
import { deleteSiralexDb, getActiveBundleMeta, openSiralexDb } from "./idb/siralex_db";
import { installBundleIntoDb } from "./install/bundle_install";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const PUBLIC_BUNDLE = join(
  REPO_ROOT,
  "web/public/bundle_noncommercial_dfd5ba62__51c38a75",
);
const CATALOG_PATH = join(REPO_ROOT, "web/public/catalog.json");
const ENV_PROD = join(REPO_ROOT, "web/.env.production");

function fileBlob(path: string): Blob {
  return new Blob([readFileSync(path)]);
}

describe("PRODUCT2D public noncommercial publication", () => {
  beforeEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  afterEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  it("catalog featured entry resolves to authorized public path", () => {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8")) as {
      bundles: Array<{
        bundle_id: string;
        url_base: string;
        content_sha256: string;
        release_artifact_fingerprint?: string;
      }>;
    };
    const entry = catalog.bundles.find((b) => b.bundle_id === "bundle_noncommercial_dfd5ba62");
    expect(entry).toBeDefined();
    expect(entry!.url_base).toBe("./bundle_noncommercial_dfd5ba62__51c38a75/");
    expect(entry!.content_sha256).toBe(
      "sha256:dfd5ba62514caa72f9e282d16160ded01c26164c5c982fd6d164b78b6f7aeb33",
    );
    expect(entry!.release_artifact_fingerprint).toBe(
      "sha256:51c38a75d5a663caf591d27b1b73da9b7ddc3776c7c96ff724deeaca4b078838",
    );

    const env = readFileSync(ENV_PROD, "utf-8");
    expect(env).toContain("VITE_FEATURED_BUNDLE_ID=bundle_noncommercial_dfd5ba62");

    const old = catalog.bundles.find((b) => b.bundle_id === "bundle_full_20260710_337619ff");
    expect(old).toBeDefined();
  });

  it(
    "installs public published bundle and exposes Credits/Sources",
    async () => {
      const manifestText = readFileSync(join(PUBLIC_BUNDLE, "bundle.manifest.json"), "utf-8");
      const parsed = parseAndValidateManifestJson(manifestText);
      expect(parsed.ok).toBe(true);

      const sourceCredits = projectCreditsFromManifestJson(manifestText);
      expect(sourceCredits).not.toBeNull();
      expect(
        sourceCredits!.sources.some((s) => s.claimed_license === "CC BY-NC-SA 4.0"),
      ).toBe(true);

      const db = await openSiralexDb();
      try {
        await installBundleIntoDb(
          db,
          parsed.manifest!,
          {
            recordsSource: fileBlob(join(PUBLIC_BUNDLE, "records.jsonl")),
            searchIndexSource: fileBlob(join(PUBLIC_BUNDLE, "search_index.jsonl")),
          },
          () => undefined,
          undefined,
          { sourceCredits: sourceCredits ?? undefined },
        );
        const active = await getActiveBundleMeta(db);
        expect(active?.source_credits?.software_license).toContain("MIT");
        expect(active?.manifest_schema_version).toBe("bundle_manifest_v2");
      } finally {
        db.close();
      }
    },
    120_000,
  );
});
