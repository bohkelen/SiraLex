export type QueryLogSchemaVersion = "query_log_event_v1";

export const QUERY_LOG_EVENT_V2 = "query_log_event_v2" as const;
/** Multilingual provenance: required input_lang + output_lang (LookupMode pair). */
export const QUERY_LOG_EVENT_V3 = "query_log_event_v3" as const;
export const QUERY_LOG_CONSENT_VERSION = "phase7k_tester_consent_v1" as const;
export const QUERY_LOG_TOP_IR_IDS_LIMIT = 5 as const;
export const QUERY_LOG_MAX_ROWS = 2000 as const;
export const QUERY_LOG_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export type QueryLogLadderLevel =
  | "casefold"
  | "diacritics_insensitive"
  | "punct_stripped"
  | "nospace"
  | "none";

export type QueryLogDirection = "source_to_target" | "target_to_source";

/** LookupMode language endpoints persisted on V3 query-log rows. */
export type QueryLogLookupLanguage = "fr" | "en" | "mnk";

export type QueryLogNormalizedKeys = {
  casefold: string[];
  diacritics_insensitive: string[];
  punct_stripped: string[];
  nospace: string[];
};

export type QueryLogResultStatus = "miss" | "hit_single" | "hit_multi";

export type QueryLogEventV1 = {
  schema_version: QueryLogSchemaVersion;
  log_id?: number;
  query_raw: string;
  query_normalized_keys: QueryLogNormalizedKeys;
  direction: QueryLogDirection;
  ladder_level_hit: QueryLogLadderLevel;
  ir_ids_count: number;
  bundle_id: string;
  bundle_version?: string;
  storage_scope_id: string;
  norm_version: string;
  app_version: string;
  timestamp_iso: string;
  logging_enabled: true;
};

export type QueryLogEventV2 = {
  schema_version: typeof QUERY_LOG_EVENT_V2;
  event_id: string;
  log_id?: number;
  timestamp_iso: string;
  app_version: string;
  bundle_id: string;
  bundle_version?: string;
  catalog_version?: string;
  storage_scope_id: string;
  norm_version: string;
  query_raw: string;
  query_normalized_primary: string | null;
  query_normalized_keys: QueryLogNormalizedKeys;
  direction: QueryLogDirection;
  ui_language: "en" | "fr";
  result_status: QueryLogResultStatus;
  result_count: number;
  top_ir_ids: string[];
  matched_key_type: QueryLogLadderLevel;
  matched_key: string | null;
  matched_deep_ladder: boolean;
  latency_ms: number;
  offline_or_online: boolean;
  session_bucket_id: string;
  logging_enabled: true;
  consent_version: string;
};

/**
 * V3 freezes V2 shape and adds required LookupMode provenance.
 * `direction` remains as the legacy mirror of the pair.
 */
export type QueryLogEventV3 = Omit<QueryLogEventV2, "schema_version"> & {
  schema_version: typeof QUERY_LOG_EVENT_V3;
  input_lang: QueryLogLookupLanguage;
  output_lang: QueryLogLookupLanguage;
};

export type QueryLogEvent = QueryLogEventV1 | QueryLogEventV2 | QueryLogEventV3;

export type AppendQueryLogInput = Omit<QueryLogEventV1, "log_id" | "schema_version">;

export type AppendQueryLogV2Input = Omit<QueryLogEventV2, "log_id" | "schema_version">;

export type AppendQueryLogV3Input = Omit<QueryLogEventV3, "log_id" | "schema_version">;

export type QueryLogScopeFilter = {
  bundle_id?: string;
  storage_scope_id?: string;
};

export type ListQueryLogsOptions = QueryLogScopeFilter & {
  limit?: number;
  newest_first?: boolean;
};

export type ListRecentQueryLogsOptions = QueryLogScopeFilter & {
  limit: number;
};

export type ExportQueryLogsOptions = QueryLogScopeFilter;

export type QueryLogStats = {
  count: number;
  oldest_timestamp_iso: string | null;
};
