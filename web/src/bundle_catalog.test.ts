import { describe, expect, it } from "vitest";

import {
  compareCatalogEntryToInstalled,
  deriveBundleAssetUrls,
  fetchBundleCatalog,
  parseAndValidateBundleCatalogJson,
  resolveBundleBaseUrl,
  resolveCatalogUrl,
  validateRemoteUrlPolicy,
} from "./bundle_catalog";

describe("Phase 4.1 bundle catalog parsing", () => {
  it("parses a valid catalog with two bundles", () => {
    const result = parseAndValidateBundleCatalogJson(
      JSON.stringify({
        catalog_schema_version: "bundle_catalog_v1",
        bundles: [
          {
            bundle_id: "maninka_fr_v1",
            name: "French ↔ Maninka",
            version: "1.0.0",
            size_bytes: 20971520,
            url_base: "/bundles/maninka_fr_v1/",
            content_sha256: "sha256:aaa",
            languages: { source_lang: "fr", target_lang: "mnk" },
            language_labels: { source: "French", target: "Maninka" },
          },
          {
            bundle_id: "fula_fr_v1",
            name: "French ↔ Fula",
            version: "1.0.0",
            size_bytes: 25165824,
            url_base: "/bundles/fula_fr_v1/",
            content_sha256: "sha256:bbb",
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.catalog?.bundles).toHaveLength(2);
    expect(result.catalog?.bundles.map((bundle) => bundle.bundle_id)).toEqual(["fula_fr_v1", "maninka_fr_v1"]);
    expect(result.catalog?.bundles[1]).toMatchObject({
      bundle_id: "maninka_fr_v1",
      name: "French ↔ Maninka",
      version: "1.0.0",
      size_bytes: 20971520,
      url_base: "/bundles/maninka_fr_v1/",
      content_sha256: "sha256:aaa",
      language_meta: {
        source_lang: "fr",
        target_lang: "mnk",
        source_label: "French",
        target_label: "Maninka",
      },
    });
    expect(result.warnings).toEqual([]);
  });

  it("rejects duplicate bundle ids and invalid sizes", () => {
    const result = parseAndValidateBundleCatalogJson(
      JSON.stringify({
        catalog_schema_version: "bundle_catalog_v1",
        bundles: [
          {
            bundle_id: "bundle_a",
            name: "Bundle A",
            size_bytes: 10.5,
            url_base: "/bundles/a/",
            content_sha256: "sha256:aaa",
          },
          {
            bundle_id: "bundle_a",
            name: "Bundle A copy",
            size_bytes: 20,
            url_base: "/bundles/a-copy/",
            content_sha256: "sha256:bbb",
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("bundles[0].size_bytes must be a non-negative integer");
    expect(result.errors).toContain("Duplicate bundle_id in catalog: bundle_a");
  });

  it("rejects missing content_sha256 and non-directory url_base", () => {
    const result = parseAndValidateBundleCatalogJson(
      JSON.stringify({
        catalog_schema_version: "bundle_catalog_v1",
        bundles: [
          {
            bundle_id: "bundle_a",
            name: "Bundle A",
            size_bytes: 20,
            url_base: "/bundles/a",
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("bundles[0].content_sha256 must be a non-empty string");
    expect(result.errors).toContain(
      "bundles[0].url_base must be a directory prefix ending with '/' and must not contain '?' or '#'",
    );
  });
});

describe("Phase 4.1 bundle catalog fetch", () => {
  it("fetches, validates, and resolves relative bundle URLs", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          catalog_schema_version: "bundle_catalog_v1",
          bundles: [
            {
              bundle_id: "maninka_fr_v1",
              name: "French ↔ Maninka",
              size_bytes: 20971520,
              url_base: "../bundles/maninka_fr_v1/",
              content_sha256: "sha256:aaa",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

    const result = await fetchBundleCatalog("./catalogs/guinea.json", {
      baseUrl: "https://example.test/app/",
      fetchImpl,
    });

    expect(result.requestUrl).toBe("https://example.test/app/catalogs/guinea.json");
    expect(resolveCatalogUrl("./catalogs/guinea.json", "https://example.test/app/")).toBe(result.requestUrl);
    expect(resolveBundleBaseUrl(result.responseUrl, result.catalog.bundles[0]!.url_base)).toBe(
      "https://example.test/app/bundles/maninka_fr_v1/",
    );
    expect(deriveBundleAssetUrls(result.responseUrl, result.catalog.bundles[0]!)).toEqual({
      base_url: "https://example.test/app/bundles/maninka_fr_v1/",
      manifest_url: "https://example.test/app/bundles/maninka_fr_v1/bundle.manifest.json",
      records_url: "https://example.test/app/bundles/maninka_fr_v1/records.jsonl",
      search_index_url: "https://example.test/app/bundles/maninka_fr_v1/search_index.jsonl",
    });
  });

  it("throws on non-200 catalog responses", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 404, statusText: "Not Found" });

    await expect(
      fetchBundleCatalog("https://example.test/catalog.json", {
        fetchImpl,
      }),
    ).rejects.toThrow("Catalog request failed: 404 Not Found");
  });

  it("rejects unsafe remote schemes and non-local http hosts", () => {
    expect(() => validateRemoteUrlPolicy("javascript:alert(1)")).toThrow(
      "Remote URL must use https: or approved local http:",
    );
    expect(() => validateRemoteUrlPolicy("file:///tmp/catalog.json")).toThrow(
      "Remote URL must use https: or approved local http:",
    );
    expect(() => validateRemoteUrlPolicy("http://example.com/catalog.json")).toThrow(
      "Remote http: URLs are only allowed for same-origin or local hosts",
    );
    expect(() => validateRemoteUrlPolicy("http://192.168.1.10/catalog.json")).not.toThrow();
    expect(() => validateRemoteUrlPolicy("http://siralex.local/catalog.json")).not.toThrow();
  });

  it("enforces catalog fetch size limits", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("x".repeat(32), {
        status: 200,
        headers: { "content-length": "32" },
      });

    await expect(
      fetchBundleCatalog("https://example.test/catalog.json", {
        fetchImpl,
        maxBytes: 16,
      }),
    ).rejects.toThrow("Catalog response too large: 32 bytes exceeds 16 bytes");
  });

  it("supports abort signals", async () => {
    const controller = new AbortController();
    controller.abort(new Error("User cancelled"));

    await expect(
      fetchBundleCatalog("https://example.test/catalog.json", {
        signal: controller.signal,
      }),
    ).rejects.toThrow("User cancelled");
  });

  it("times out stalled catalog requests", async () => {
    const fetchImpl: typeof fetch = async (_input, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            reject(init.signal?.reason ?? new Error("aborted"));
          },
          { once: true },
        );
      });

    await expect(
      fetchBundleCatalog("https://example.test/catalog.json", {
        fetchImpl,
        timeoutMs: 5,
      }),
    ).rejects.toThrow("Catalog request timed out after 5 ms");
  });
});

describe("Phase 4.1 update semantics", () => {
  it("treats content_sha256 as authoritative update identity", () => {
    const entry = {
      bundle_id: "maninka_fr_v1",
      name: "French ↔ Maninka",
      version: "1.0.1",
      size_bytes: 20,
      url_base: "/bundles/maninka_fr_v1/",
      content_sha256: "sha256:new",
    };

    expect(compareCatalogEntryToInstalled(entry)).toMatchObject({
      state: "not_installed",
      installed: false,
      contentMatches: false,
    });

    expect(
      compareCatalogEntryToInstalled(entry, {
        bundle_id: "maninka_fr_v1",
        expected_content_sha256: "sha256:new",
      }),
    ).toMatchObject({
      state: "installed_current",
      installed: true,
      contentMatches: true,
    });

    expect(
      compareCatalogEntryToInstalled(entry, {
        bundle_id: "maninka_fr_v1",
        expected_content_sha256: "sha256:old",
      }),
    ).toMatchObject({
      state: "update_available",
      installed: true,
      contentMatches: false,
    });
  });
});
