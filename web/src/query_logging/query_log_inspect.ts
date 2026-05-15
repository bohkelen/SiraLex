import type { QueryLogEventV1 } from "./query_log_types";

export function queryLogHitMiss(row: Pick<QueryLogEventV1, "ir_ids_count">): "hit" | "miss" {
  return row.ir_ids_count > 0 ? "hit" : "miss";
}
