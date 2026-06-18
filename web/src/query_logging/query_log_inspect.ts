import { getQueryLogResultCount } from "./query_log_derive";
import type { QueryLogEventV1, QueryLogEventV2 } from "./query_log_types";

export function queryLogHitMiss(
  row: Pick<QueryLogEventV1, "ir_ids_count"> | QueryLogEventV1 | QueryLogEventV2,
): "hit" | "miss" {
  return getQueryLogResultCount(row as QueryLogEventV1 | QueryLogEventV2) > 0 ? "hit" : "miss";
}
