import { describe, expect, it } from "vitest";

import {
  getQueryLogMatchedKey,
  getQueryLogMatchedKeyType,
  getQueryLogStatusLabel,
} from "./query_log_derive";
import { queryLogHitMiss } from "./query_log_inspect";
import {
  QUERY_LOG_CONSENT_VERSION,
  QUERY_LOG_EVENT_V2,
  type QueryLogEventV2,
} from "./query_log_types";

function makeV2Row(overrides: Partial<QueryLogEventV2> = {}): QueryLogEventV2 {
  return {
    schema_version: QUERY_LOG_EVENT_V2,
    event_id: "evt-1",
    timestamp_iso: "2026-06-18T00:00:00.000Z",
    app_version: "0.0.0",
    bundle_id: "bundle-a",
    storage_scope_id: "bundle-a::sha256:1",
    norm_version: "norm_v3",
    query_raw: "bonjour",
    query_normalized_primary: "bonjour",
    query_normalized_keys: {
      casefold: ["bonjour"],
      diacritics_insensitive: ["bonjour"],
      punct_stripped: ["bonjour"],
      nospace: ["bonjour"],
    },
    direction: "source_to_target",
    ui_language: "fr",
    result_status: "hit_multi",
    result_count: 2,
    top_ir_ids: ["ir-1", "ir-2"],
    matched_key_type: "punct_stripped",
    matched_key: "bon-jour",
    matched_deep_ladder: true,
    latency_ms: 20,
    offline_or_online: false,
    session_bucket_id: "session-1",
    logging_enabled: true,
    consent_version: QUERY_LOG_CONSENT_VERSION,
    ...overrides,
  };
}

describe("queryLogHitMiss", () => {
  it("returns hit when ir_ids_count is positive", () => {
    expect(queryLogHitMiss({ ir_ids_count: 1 })).toBe("hit");
    expect(queryLogHitMiss({ ir_ids_count: 99 })).toBe("hit");
  });

  it("returns miss when ir_ids_count is zero", () => {
    expect(queryLogHitMiss({ ir_ids_count: 0 })).toBe("miss");
  });

  it("supports v2 rows via result_count", () => {
    expect(queryLogHitMiss(makeV2Row({ result_count: 0, result_status: "miss" }))).toBe("miss");
    expect(queryLogHitMiss(makeV2Row({ result_count: 2, result_status: "hit_multi" }))).toBe("hit");
  });
});

describe("v2 inspect helpers via derive", () => {
  it("reads v2 status label and matched key metadata", () => {
    const row = makeV2Row();
    expect(getQueryLogStatusLabel(row)).toBe("hit_multi");
    expect(getQueryLogMatchedKeyType(row)).toBe("punct_stripped");
    expect(getQueryLogMatchedKey(row)).toBe("bon-jour");
  });
});
