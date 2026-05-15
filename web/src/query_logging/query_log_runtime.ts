import appPackage from "../../package.json";

import type { SearchDirection } from "../bundle_labels";
import type { ActiveBundleMeta } from "../idb/siralex_db";
import { openSiralexDb } from "../idb/siralex_db";
import { computeSearchKeys, normalizeNfc, type SearchKeys } from "../norm/norm_v1";
import { appendQueryLog } from "./query_log_store";

const QUERY_LOGGING_ENABLED_STORAGE_KEY = "siralex.query_logging.enabled";
const APP_VERSION = typeof appPackage.version === "string" ? appPackage.version : "0.0.0";

type SearchLogResult = {
  ir_ids: string[];
  matched_key_type: keyof SearchKeys | null;
};

type AppendSearchQueryLogParams = {
  queryRaw: string;
  direction: SearchDirection;
  result: SearchLogResult;
  activeBundleMeta: Pick<ActiveBundleMeta, "bundle_id" | "version" | "normalization_ruleset">;
  storageScopeId: string;
  timestampIso?: string;
};

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

// TODO(phase5b-roadmap): Normalization logic is mirrored from search_query.ts.
// Long-term fix: searchQuery() should return the normalized keys it actually
// used, and logging should consume that instead of recomputing.
function computeNormalizedKeysForLogging(queryRaw: string): SearchKeys {
  const trimmed = queryRaw.trim();
  if (trimmed === "") {
    return {
      casefold: [],
      diacritics_insensitive: [],
      punct_stripped: [],
      nospace: [],
    };
  }

  return computeSearchKeys([normalizeNfc(trimmed)]);
}

export async function appendSearchQueryLogIfEnabled(params: AppendSearchQueryLogParams): Promise<void> {
  if (!getQueryLoggingEnabled()) {
    return;
  }

  let db: IDBDatabase | undefined;
  try {
    db = await openSiralexDb();
    await appendQueryLog(db, {
      query_raw: params.queryRaw,
      query_normalized_keys: computeNormalizedKeysForLogging(params.queryRaw),
      direction: params.direction,
      ladder_level_hit: params.result.matched_key_type ?? "none",
      ir_ids_count: params.result.ir_ids.length,
      bundle_id: params.activeBundleMeta.bundle_id,
      bundle_version: params.activeBundleMeta.version,
      storage_scope_id: params.storageScopeId,
      norm_version: params.activeBundleMeta.normalization_ruleset,
      app_version: APP_VERSION,
      timestamp_iso: params.timestampIso ?? new Date().toISOString(),
      logging_enabled: true,
    });
  } catch (error) {
    console.warn("Query logging failed:", error);
  } finally {
    db?.close();
  }
}

