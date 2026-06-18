import {
  QUERY_LOG_EVENT_V2,
  type QueryLogEventV1,
  type QueryLogEventV2,
  type QueryLogLadderLevel,
  type QueryLogResultStatus,
} from "./query_log_types";

export function deriveResultStatus(resultCount: number): QueryLogResultStatus {
  if (!Number.isInteger(resultCount) || resultCount < 0) {
    throw new Error("deriveResultStatus: resultCount must be an integer >= 0");
  }
  if (resultCount === 0) {
    return "miss";
  }
  if (resultCount === 1) {
    return "hit_single";
  }
  return "hit_multi";
}

export function deriveMatchedDeepLadder(matchedKeyType: QueryLogLadderLevel): boolean {
  return matchedKeyType === "punct_stripped" || matchedKeyType === "nospace";
}

export function isQueryLogEventV2(row: unknown): row is QueryLogEventV2 {
  if (typeof row !== "object" || row === null) {
    return false;
  }
  return (row as QueryLogEventV2).schema_version === QUERY_LOG_EVENT_V2;
}

export function getQueryLogResultCount(row: QueryLogEventV1 | QueryLogEventV2): number {
  if (isQueryLogEventV2(row)) {
    return row.result_count;
  }
  return row.ir_ids_count;
}

export function getQueryLogStatusLabel(row: QueryLogEventV1 | QueryLogEventV2): QueryLogResultStatus {
  if (isQueryLogEventV2(row)) {
    return row.result_status;
  }
  return deriveResultStatus(row.ir_ids_count);
}

export function getQueryLogMatchedKeyType(row: QueryLogEventV1 | QueryLogEventV2): QueryLogLadderLevel {
  if (isQueryLogEventV2(row)) {
    return row.matched_key_type;
  }
  return row.ladder_level_hit;
}

export function getQueryLogMatchedKey(row: QueryLogEventV1 | QueryLogEventV2): string | null {
  if (isQueryLogEventV2(row)) {
    return row.matched_key;
  }
  return null;
}
