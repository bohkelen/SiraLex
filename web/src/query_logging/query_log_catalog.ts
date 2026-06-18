import { getCachedBundleCatalog } from "../idb/siralex_db";

export async function resolveCatalogVersionForBundle(
  db: IDBDatabase,
  bundleId: string,
): Promise<string | undefined> {
  if (typeof bundleId !== "string" || bundleId.trim() === "") {
    return undefined;
  }

  try {
    const cached = await getCachedBundleCatalog(db);
    const bundles = cached?.catalog?.bundles;
    if (!Array.isArray(bundles)) {
      return undefined;
    }

    const match = bundles.find((entry) => entry.bundle_id === bundleId);
    const version = match?.version;
    if (typeof version !== "string" || version.trim() === "") {
      return undefined;
    }

    return version;
  } catch {
    return undefined;
  }
}
