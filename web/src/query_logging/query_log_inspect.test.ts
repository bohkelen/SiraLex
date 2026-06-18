import { describe, expect, it } from "vitest";

import {
  getQueryLogMatchedKey,
  getQueryLogMatchedKeyType,
  getQueryLogStatusLabel,
} from "./query_log_derive";
import {
  queryLogHitMiss,
  recentLogMatchedKeyDisplay,
  recentLogMatchedKeyTypeDisplay,
  recentLogResultCount,
  recentLogStatusLabel,
} from "./query_log_inspect";
import {
  QUERY_LOG_CONSENT_VERSION,
  QUERY_LOG_EVENT_V2,
  type QueryLogEventV1,
  type QueryLogEventV2,
} from "./query_log_types";

function makeV1Row(overrides: Partial<QueryLogEventV1> = {}): QueryLogEventV1 {
  return {
    schema_version: "query_log_event_v1",
    query_raw: "bonjour",
    query_normalized_keys: {
      casefold: ["bonjour"],
      diacritics_insensitive: ["bonjour"],
      punct_stripped: ["bonjour"],
      nospace: ["bonjour"],
    },
    direction: "source_to_target",
    ladder_level_hit: "casefold",
    ir_ids_count: 1,
    bundle_id: "bundle-a",
    storage_scope_id: "bundle-a::sha256:1",
    norm_version: "norm_v2",
    app_version: "0.0.0",
    timestamp_iso: "2026-06-18T00:00:00.000Z",
    logging_enabled: true,
    ...overrides,
  };
}

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

describe("recent log display helpers", () => {
  it("reads v1 status/count and shows ladder type with no matched key", () => {
    const row = makeV1Row({ ir_ids_count: 0, ladder_level_hit: "nospace" });
    expect(recentLogStatusLabel(row)).toBe("miss");
    expect(recentLogResultCount(row)).toBe(0);
    expect(recentLogMatchedKeyDisplay(row)).toBeNull();
    expect(recentLogMatchedKeyTypeDisplay(row)).toBe("nospace");
    expect(getQueryLogMatchedKey(row)).toBeNull();
    expect(getQueryLogStatusLabel(row)).toBe("miss");
    expect(getQueryLogMatchedKeyType(row)).toBe("nospace");
  });

  it("reads v2 status/count/matched_key/matched_key_type", () => {
    const row = makeV2Row();
    expect(recentLogStatusLabel(row)).toBe("hit_multi");
    expect(recentLogResultCount(row)).toBe(2);
    expect(recentLogMatchedKeyDisplay(row)).toBe("bon-jour");
    expect(recentLogMatchedKeyTypeDisplay(row)).toBe("punct_stripped");
  });

  it("handles mixed v1 and v2 rows without throwing", () => {
    const rows = [
      makeV1Row({ ir_ids_count: 1, ladder_level_hit: "casefold" }),
      makeV2Row({ result_count: 0, result_status: "miss", matched_key: null, matched_key_type: "none" }),
    ];

    expect(() =>
      rows.map((row) => ({
        status: recentLogStatusLabel(row),
        count: recentLogResultCount(row),
        matchedKey: recentLogMatchedKeyDisplay(row),
        matchedKeyType: recentLogMatchedKeyTypeDisplay(row),
      })),
    ).not.toThrow();

    expect(recentLogStatusLabel(rows[0]!)).toBe("hit_single");
    expect(recentLogStatusLabel(rows[1]!)).toBe("miss");
  });
});
