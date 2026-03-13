import type { ActiveBundleMeta } from "./idb/siralex_db";

export type BundleCatalogLanguageMeta = {
  source_lang?: string;
  target_lang?: string;
  source_label?: string;
  target_label?: string;
};

export type BundleCatalogEntryV1 = {
  bundle_id: string;
  name: string;
  version?: string;
  size_bytes: number;
  url_base: string;
  content_sha256: string;
  language_meta?: BundleCatalogLanguageMeta;
};

export type BundleCatalogV1 = {
  catalog_schema_version: string;
  bundles: BundleCatalogEntryV1[];
};

export type BundleCatalogValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  catalog?: BundleCatalogV1;
};

export type FetchBundleCatalogOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
};

export type FetchBundleCatalogResult = {
  requestUrl: string;
  responseUrl: string;
  catalog: BundleCatalogV1;
  warnings: string[];
};

export const EXPECTED_BUNDLE_CATALOG_SCHEMA_VERSION = "bundle_catalog_v1";
export const DEFAULT_CATALOG_FETCH_TIMEOUT_MS = 10_000;
export const DEFAULT_CATALOG_MAX_BYTES = 1_048_576;
export const BUNDLE_MANIFEST_FILENAME = "bundle.manifest.json";
export const BUNDLE_RECORDS_FILENAME = "records.jsonl";
export const BUNDLE_SEARCH_INDEX_FILENAME = "search_index.jsonl";

export type BundleRemoteAssetUrls = {
  base_url: string;
  manifest_url: string;
  records_url: string;
  search_index_url: string;
};

export type BundleCatalogUpdateState =
  | "not_installed"
  | "installed_current"
  | "update_available";

export type BundleCatalogComparison = {
  state: BundleCatalogUpdateState;
  installed: boolean;
  contentMatches: boolean;
};

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function getOptionalStringObject(
  raw: unknown,
  allowedKeys: string[],
): Record<string, string> | undefined {
  if (!isObject(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const key of allowedKeys) {
    const value = getString(raw, key);
    if (value) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function fmtExpected(actual: string | undefined, expected: string): string {
  return `expected '${expected}', got '${actual ?? "undefined"}'`;
}

function normalizeLanguageMeta(raw: Record<string, unknown>): BundleCatalogLanguageMeta | undefined {
  const languages = getOptionalStringObject(raw["languages"], ["source_lang", "target_lang"]);
  const labels = getOptionalStringObject(raw["language_labels"], ["source", "target"]);
  const meta: BundleCatalogLanguageMeta = {
    source_lang: languages?.source_lang,
    target_lang: languages?.target_lang,
    source_label: labels?.source,
    target_label: labels?.target,
  };
  return Object.values(meta).some((value) => value !== undefined) ? meta : undefined;
}

function isSafeDirectoryPrefix(urlBase: string): boolean {
  return urlBase.endsWith("/") && !urlBase.includes("?") && !urlBase.includes("#");
}

function isPrivateIpv4Host(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = nums as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isAllowedHttpHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === "localhost" ||
    lower === "::1" ||
    lower.endsWith(".local") ||
    isPrivateIpv4Host(lower)
  );
}

export function parseAndValidateBundleCatalogJson(text: string): BundleCatalogValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      ok: false,
      errors: [`Catalog is not valid JSON: ${String(error)}`],
      warnings,
    };
  }

  if (!isObject(raw)) {
    return { ok: false, errors: ["Catalog JSON must be an object"], warnings };
  }

  const catalog_schema_version = getString(raw, "catalog_schema_version");
  if (!catalog_schema_version) {
    errors.push("Missing/invalid field: catalog_schema_version");
  } else if (catalog_schema_version !== EXPECTED_BUNDLE_CATALOG_SCHEMA_VERSION) {
    errors.push(
      `catalog_schema_version mismatch: ${fmtExpected(
        catalog_schema_version,
        EXPECTED_BUNDLE_CATALOG_SCHEMA_VERSION,
      )}`,
    );
  }

  const bundlesRaw = raw["bundles"];
  if (!Array.isArray(bundlesRaw)) {
    errors.push("Missing/invalid field: bundles (array)");
  }

  const bundles: BundleCatalogEntryV1[] = [];
  const seenBundleIds = new Set<string>();
  if (Array.isArray(bundlesRaw)) {
    for (const [index, entry] of bundlesRaw.entries()) {
      if (!isObject(entry)) {
        errors.push(`bundles[${index}] must be an object`);
        continue;
      }

      const bundle_id = getString(entry, "bundle_id");
      const name = getString(entry, "name");
      const version = getString(entry, "version");
      const url_base = getString(entry, "url_base");
      const content_sha256 = getString(entry, "content_sha256");
      const size_bytes_raw = entry["size_bytes"];
      const size_bytes =
        typeof size_bytes_raw === "number" && Number.isInteger(size_bytes_raw) && size_bytes_raw >= 0
          ? size_bytes_raw
          : undefined;

      if (!bundle_id) errors.push(`bundles[${index}].bundle_id must be a non-empty string`);
      if (!name) errors.push(`bundles[${index}].name must be a non-empty string`);
      if (!url_base) errors.push(`bundles[${index}].url_base must be a non-empty string`);
      if (url_base && !isSafeDirectoryPrefix(url_base)) {
        errors.push(
          `bundles[${index}].url_base must be a directory prefix ending with '/' and must not contain '?' or '#'`,
        );
      }
      if (!content_sha256) {
        errors.push(`bundles[${index}].content_sha256 must be a non-empty string`);
      }
      if (size_bytes === undefined) {
        errors.push(`bundles[${index}].size_bytes must be a non-negative integer`);
      }
      if (bundle_id && seenBundleIds.has(bundle_id)) {
        errors.push(`Duplicate bundle_id in catalog: ${bundle_id}`);
      }

      if (bundle_id) {
        seenBundleIds.add(bundle_id);
      }

      if (bundle_id && name && url_base && content_sha256 && size_bytes !== undefined) {
        const language_meta = normalizeLanguageMeta(entry);
        bundles.push({
          bundle_id,
          name,
          version,
          size_bytes,
          url_base,
          content_sha256,
          language_meta,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    errors,
    warnings,
    catalog: {
      catalog_schema_version: catalog_schema_version!,
      bundles: bundles.sort((a, b) => {
        const nameCmp = a.name.localeCompare(b.name);
        if (nameCmp !== 0) return nameCmp;
        return a.bundle_id.localeCompare(b.bundle_id);
      }),
    },
  };
}

export function resolveCatalogUrl(catalogUrl: string, baseUrl: string): string {
  return new URL(catalogUrl, baseUrl).toString();
}

export function validateRemoteUrlPolicy(urlString: string, currentBaseUrl?: string): void {
  const url = new URL(urlString);
  if (url.protocol === "https:") return;
  if (url.protocol !== "http:") {
    throw new Error(`Remote URL must use https: or approved local http:, got ${url.protocol}`);
  }

  const currentOrigin = currentBaseUrl ? new URL(currentBaseUrl).origin : undefined;
  const isSameOriginHttp = currentOrigin === url.origin;
  if (isSameOriginHttp || isAllowedHttpHost(url.hostname)) {
    return;
  }

  throw new Error(
    `Remote http: URLs are only allowed for same-origin or local hosts (localhost, .local, private IPs), got ${url.hostname}`,
  );
}

export function resolveBundleBaseUrl(catalogUrl: string, urlBase: string): string {
  const resolved = new URL(urlBase, catalogUrl).toString();
  validateRemoteUrlPolicy(resolved, catalogUrl);
  return resolved;
}

export function deriveBundleAssetUrls(catalogUrl: string, entry: BundleCatalogEntryV1): BundleRemoteAssetUrls {
  const base_url = resolveBundleBaseUrl(catalogUrl, entry.url_base);
  return {
    base_url,
    manifest_url: new URL(BUNDLE_MANIFEST_FILENAME, base_url).toString(),
    records_url: new URL(BUNDLE_RECORDS_FILENAME, base_url).toString(),
    search_index_url: new URL(BUNDLE_SEARCH_INDEX_FILENAME, base_url).toString(),
  };
}

export function compareCatalogEntryToInstalled(
  entry: BundleCatalogEntryV1,
  installed?: Pick<ActiveBundleMeta, "bundle_id" | "expected_content_sha256">,
): BundleCatalogComparison {
  if (!installed || installed.bundle_id !== entry.bundle_id) {
    return {
      state: "not_installed",
      installed: false,
      contentMatches: false,
    };
  }

  const contentMatches = installed.expected_content_sha256 === entry.content_sha256;
  return {
    state: contentMatches ? "installed_current" : "update_available",
    installed: true,
    contentMatches,
  };
}

function createFetchSignal(timeoutMs: number, externalSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Catalog request timed out after ${timeoutMs} ms`));
  }, timeoutMs);

  const onAbort = () => {
    controller.abort(externalSignal?.reason ?? new Error("Catalog request aborted"));
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      onAbort();
    } else {
      externalSignal.addEventListener("abort", onAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onAbort);
    },
  };
}

function getTextByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export async function fetchBundleCatalog(
  catalogUrl: string,
  options: FetchBundleCatalogOptions = {},
): Promise<FetchBundleCatalogResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_CATALOG_FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_CATALOG_MAX_BYTES;
  const requestUrl = options.baseUrl ? resolveCatalogUrl(catalogUrl, options.baseUrl) : catalogUrl;
  validateRemoteUrlPolicy(requestUrl, options.baseUrl);
  const { signal, cleanup } = createFetchSignal(timeoutMs, options.signal);

  let response: Response;
  try {
    response = await fetchImpl(requestUrl, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    cleanup();
    throw error;
  }
  cleanup();

  if (!response.ok) {
    throw new Error(`Catalog request failed: ${response.status} ${response.statusText}`);
  }

  const responseUrl = response.url || requestUrl;
  validateRemoteUrlPolicy(responseUrl, options.baseUrl);

  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new Error(`Catalog response too large: ${parsedLength} bytes exceeds ${maxBytes} bytes`);
    }
  }

  const text = await response.text();
  const actualBytes = getTextByteLength(text);
  if (actualBytes > maxBytes) {
    throw new Error(`Catalog response too large: ${actualBytes} bytes exceeds ${maxBytes} bytes`);
  }
  const parsed = parseAndValidateBundleCatalogJson(text);
  if (!parsed.ok || !parsed.catalog) {
    throw new Error(`Catalog validation failed: ${parsed.errors.join("; ")}`);
  }

  return {
    requestUrl,
    responseUrl,
    catalog: parsed.catalog,
    warnings: parsed.warnings,
  };
}
