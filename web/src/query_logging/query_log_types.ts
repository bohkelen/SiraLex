export type QueryLogSchemaVersion = "query_log_event_v1";

export type QueryLogLadderLevel =
  | "casefold"
  | "diacritics_insensitive"
  | "punct_stripped"
  | "nospace"
  | "none";

export type QueryLogDirection = "source_to_target" | "target_to_source";

export type QueryLogNormalizedKeys = {
  casefold: string[];
  diacritics_insensitive: string[];
  punct_stripped: string[];
  nospace: string[];
};

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

export type AppendQueryLogInput = Omit<QueryLogEventV1, "log_id" | "schema_version">;

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
