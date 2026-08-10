import appPackage from "../../package.json";

import type { ActiveBundleMeta } from "../idb/siralex_db";
import { openSiralexDb } from "../idb/siralex_db";
import type { SearchKeys } from "../norm/norm_v1";
import {
  lookupModeToLanguagePair,
  toLegacySearchDirection,
  type LookupMode,
} from "../search/lookup_mode";
import type { SearchResult } from "../search/search_query";
import { resolveCatalogVersionForBundle } from "./query_log_catalog";
import {
  getOrCreateSessionBucketId,
  hasValidQueryLoggingConsent,
} from "./query_log_consent";
import { deriveMatchedDeepLadder, deriveResultStatus } from "./query_log_derive";
import { appendQueryLogV3 } from "./query_log_store";
import type { AppendQueryLogV3Input, QueryLogNormalizedKeys } from "./query_log_types";
import {
  QUERY_LOG_CONSENT_VERSION,
  QUERY_LOG_TOP_IR_IDS_LIMIT,
} from "./query_log_types";

const QUERY_LOGGING_ENABLED_STORAGE_KEY = "siralex.query_logging.enabled";
const APP_VERSION = typeof appPackage.version === "string" ? appPackage.version : "0.0.0";

type AppendSearchQueryLogParams = {
  queryRaw: string;
  /** Exact LookupMode used for the settled search generation. */
  lookupMode: LookupMode;
  result: SearchResult;
  activeBundleMeta: Pick<ActiveBundleMeta, "bundle_id" | "version" | "normalization_ruleset">;
  storageScopeId: string;
  uiLanguage: "en" | "fr";
  latencyMs: number;
  timestampIso?: string;
};

function createEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function mapSearchKeysToQueryLogKeys(keys: SearchKeys): QueryLogNormalizedKeys {
  return {
    casefold: [...keys.casefold],
    diacritics_insensitive: [...keys.diacritics_insensitive],
    punct_stripped: [...keys.punct_stripped],
    nospace: [...keys.nospace],
  };
}

function hasSearchResultMetadata(result: SearchResult): boolean {
  return (
    Array.isArray(result.ir_ids) &&
    result.query_normalized_keys !== undefined &&
    typeof result.query_normalized_keys === "object" &&
    result.query_normalized_keys !== null
  );
}

function readNavigatorOnline(): boolean {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      return navigator.onLine;
    }
  } catch {
    // Fail closed to offline=false? Plan says default true.
  }
  return true;
}

function resolveQueryNormalizedPrimary(result: SearchResult): string | null {
  if (result.matched_key !== null) {
    return result.matched_key;
  }
  return result.last_tried_normalized_key;
}

export function getQueryLoggingEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(QUERY_LOGGING_ENABLED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setQueryLoggingEnabled(enabled: boolean): void {
  try {
    if (!globalThis.localStorage) {
      return;
    }
    if (enabled) {
      globalThis.localStorage.setItem(QUERY_LOGGING_ENABLED_STORAGE_KEY, "true");
    } else {
      globalThis.localStorage.removeItem(QUERY_LOGGING_ENABLED_STORAGE_KEY);
    }
  } catch {
    // Fail closed: if localStorage is unavailable, leave logging disabled.
  }
}

export function isQueryLoggingEnabled(): boolean {
  return getQueryLoggingEnabled();
}

export async function appendSearchQueryLogIfEnabled(params: AppendSearchQueryLogParams): Promise<void> {
  if (!getQueryLoggingEnabled()) {
    return;
  }
  if (!hasValidQueryLoggingConsent()) {
    return;
  }
  if (params.queryRaw.trim() === "") {
    return;
  }
  if (!hasSearchResultMetadata(params.result)) {
    return;
  }

  let db: IDBDatabase | undefined;
  try {
    db = await openSiralexDb();
    const catalogVersion = await resolveCatalogVersionForBundle(db, params.activeBundleMeta.bundle_id);
    const matchedKeyType = params.result.matched_key_type ?? "none";
    const resultCount = params.result.ir_ids.length;
    const pair = lookupModeToLanguagePair(params.lookupMode);
    const direction = toLegacySearchDirection(params.lookupMode);

    const input: AppendQueryLogV3Input = {
      event_id: createEventId(),
      timestamp_iso: params.timestampIso ?? new Date().toISOString(),
      app_version: APP_VERSION,
      bundle_id: params.activeBundleMeta.bundle_id,
      bundle_version: params.activeBundleMeta.version,
      storage_scope_id: params.storageScopeId,
      norm_version: params.activeBundleMeta.normalization_ruleset,
      query_raw: params.queryRaw,
      query_normalized_primary: resolveQueryNormalizedPrimary(params.result),
      query_normalized_keys: mapSearchKeysToQueryLogKeys(params.result.query_normalized_keys),
      direction,
      input_lang: pair.input_lang,
      output_lang: pair.output_lang,
      ui_language: params.uiLanguage,
      result_status: deriveResultStatus(resultCount),
      result_count: resultCount,
      top_ir_ids: params.result.ir_ids.slice(0, QUERY_LOG_TOP_IR_IDS_LIMIT),
      matched_key_type: matchedKeyType,
      matched_key: params.result.matched_key,
      matched_deep_ladder: deriveMatchedDeepLadder(matchedKeyType),
      latency_ms: Math.max(0, Math.round(params.latencyMs)),
      offline_or_online: readNavigatorOnline(),
      session_bucket_id: getOrCreateSessionBucketId(),
      logging_enabled: true,
      consent_version: QUERY_LOG_CONSENT_VERSION,
    };

    if (catalogVersion !== undefined) {
      input.catalog_version = catalogVersion;
    }

    await appendQueryLogV3(db, input);
  } catch (error) {
    console.warn("Query logging failed:", error);
  } finally {
    db?.close();
  }
}
