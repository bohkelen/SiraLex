import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { deleteSiralexDb, openSiralexDb, setCachedBundleCatalog } from "../idb/siralex_db";
import { resolveCatalogVersionForBundle } from "./query_log_catalog";

describe("resolveCatalogVersionForBundle", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine if db does not exist yet
    }
  });

  it("returns version when cached catalog contains bundle_id", async () => {
    const db = await openSiralexDb();
    try {
      await setCachedBundleCatalog(db, {
        request_url: "/catalog.json",
        response_url: "/catalog.json",
        fetched_at_iso: "2026-06-18T00:00:00.000Z",
        warnings: [],
        catalog: {
          catalog_schema_version: "bundle_catalog_v1",
          bundles: [
            {
              bundle_id: "bundle-a",
              name: "Bundle A",
              version: "norm-v3-featured",
              size_bytes: 1,
              url_base: "/bundle-a",
              content_sha256: "sha256:abc",
            },
          ],
        },
      });

      expect(await resolveCatalogVersionForBundle(db, "bundle-a")).toBe("norm-v3-featured");
    } finally {
      db.close();
    }
  });

  it("returns undefined when catalog cache is missing", async () => {
    const db = await openSiralexDb();
    try {
      expect(await resolveCatalogVersionForBundle(db, "bundle-a")).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it("returns undefined when bundle is missing from cached catalog", async () => {
    const db = await openSiralexDb();
    try {
      await setCachedBundleCatalog(db, {
        request_url: "/catalog.json",
        response_url: "/catalog.json",
        fetched_at_iso: "2026-06-18T00:00:00.000Z",
        warnings: [],
        catalog: {
          catalog_schema_version: "bundle_catalog_v1",
          bundles: [
            {
              bundle_id: "bundle-a",
              name: "Bundle A",
              version: "norm-v3-featured",
              size_bytes: 1,
              url_base: "/bundle-a",
              content_sha256: "sha256:abc",
            },
          ],
        },
      });

      expect(await resolveCatalogVersionForBundle(db, "bundle-missing")).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it("returns undefined when catalog lookup throws", async () => {
    await expect(
      resolveCatalogVersionForBundle({} as IDBDatabase, "bundle-a"),
    ).resolves.toBeUndefined();
  });
});
