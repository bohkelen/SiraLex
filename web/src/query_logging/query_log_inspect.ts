import {
  getQueryLogMatchedKey,
  getQueryLogMatchedKeyType,
  getQueryLogResultCount,
  getQueryLogStatusLabel,
} from "./query_log_derive";
import type { QueryLogEvent, QueryLogEventV1 } from "./query_log_types";

export function queryLogHitMiss(
  row: Pick<QueryLogEventV1, "ir_ids_count"> | QueryLogEvent,
): "hit" | "miss" {
  return getQueryLogResultCount(row as QueryLogEvent) > 0 ? "hit" : "miss";
}

export function recentLogStatusLabel(row: QueryLogEvent): string {
  return getQueryLogStatusLabel(row);
}

export function recentLogResultCount(row: QueryLogEvent): number {
  return getQueryLogResultCount(row);
}

export function recentLogMatchedKeyDisplay(row: QueryLogEvent): string | null {
  return getQueryLogMatchedKey(row);
}

export function recentLogMatchedKeyTypeDisplay(row: QueryLogEvent): string {
  return getQueryLogMatchedKeyType(row);
}
