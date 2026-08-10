import { describe, expect, it } from "vitest";

import {
  deriveMatchedDeepLadder,
  deriveResultStatus,
  formatLookupModeDisplay,
  getQueryLogMatchedKey,
  getQueryLogMatchedKeyType,
  getQueryLogResultCount,
  getQueryLogStatusLabel,
  isQueryLogEventV2,
  isQueryLogEventV3,
  resolveLookupModeFromQueryLog,
} from "./query_log_derive";
import {
  QUERY_LOG_CONSENT_VERSION,
  QUERY_LOG_EVENT_V2,
  QUERY_LOG_EVENT_V3,
  type QueryLogEventV1,
  type QueryLogEventV2,
  type QueryLogEventV3,
} from "./query_log_types";

function recentIso(offsetMs = 0): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

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
    norm_version: "norm_v3",
    app_version: "0.0.0",
    timestamp_iso: recentIso(),
    logging_enabled: true,
    ...overrides,
  };
}

function makeV2Row(overrides: Partial<QueryLogEventV2> = {}): QueryLogEventV2 {
  return {
    schema_version: QUERY_LOG_EVENT_V2,
    event_id: "evt-1",
    timestamp_iso: recentIso(),
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
    result_status: "hit_single",
    result_count: 1,
    top_ir_ids: ["ir-1"],
    matched_key_type: "casefold",
    matched_key: "bonjour",
    matched_deep_ladder: false,
    latency_ms: 12,
    offline_or_online: true,
    session_bucket_id: "session-1",
    logging_enabled: true,
    consent_version: QUERY_LOG_CONSENT_VERSION,
    ...overrides,
  };
}

describe("deriveResultStatus", () => {
  it("maps zero to miss", () => {
    expect(deriveResultStatus(0)).toBe("miss");
  });

  it("maps one to hit_single", () => {
    expect(deriveResultStatus(1)).toBe("hit_single");
  });

  it("maps two to hit_multi", () => {
    expect(deriveResultStatus(2)).toBe("hit_multi");
  });

  it("throws for negative counts", () => {
    expect(() => deriveResultStatus(-1)).toThrow(/integer >= 0/);
  });

  it("throws for non-integer counts", () => {
    expect(() => deriveResultStatus(1.5)).toThrow(/integer >= 0/);
  });
});

describe("deriveMatchedDeepLadder", () => {
  it("returns true for punct_stripped", () => {
    expect(deriveMatchedDeepLadder("punct_stripped")).toBe(true);
  });

  it("returns true for nospace", () => {
    expect(deriveMatchedDeepLadder("nospace")).toBe(true);
  });

  it("returns false for other ladder levels", () => {
    expect(deriveMatchedDeepLadder("casefold")).toBe(false);
    expect(deriveMatchedDeepLadder("diacritics_insensitive")).toBe(false);
    expect(deriveMatchedDeepLadder("none")).toBe(false);
  });
});

describe("isQueryLogEventV2", () => {
  it("detects v2 rows", () => {
    expect(isQueryLogEventV2(makeV2Row())).toBe(true);
  });

  it("rejects v1 rows", () => {
    expect(isQueryLogEventV2(makeV1Row())).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isQueryLogEventV2(null)).toBe(false);
    expect(isQueryLogEventV2("query_log_event_v2")).toBe(false);
  });
});

describe("v1 and v2 inspect fallbacks", () => {
  it("reads v1 result count from ir_ids_count", () => {
    expect(getQueryLogResultCount(makeV1Row({ ir_ids_count: 3 }))).toBe(3);
  });

  it("derives v1 status label from ir_ids_count", () => {
    expect(getQueryLogStatusLabel(makeV1Row({ ir_ids_count: 0 }))).toBe("miss");
    expect(getQueryLogStatusLabel(makeV1Row({ ir_ids_count: 1 }))).toBe("hit_single");
    expect(getQueryLogStatusLabel(makeV1Row({ ir_ids_count: 2 }))).toBe("hit_multi");
  });

  it("reads v1 matched key type from ladder_level_hit", () => {
    expect(getQueryLogMatchedKeyType(makeV1Row({ ladder_level_hit: "nospace" }))).toBe("nospace");
  });

  it("returns null matched key for v1 rows", () => {
    expect(getQueryLogMatchedKey(makeV1Row())).toBeNull();
  });

  it("reads v2 result count, status, matched key type, and matched key", () => {
    const row = makeV2Row({
      result_count: 2,
      result_status: "hit_multi",
      matched_key_type: "punct_stripped",
      matched_key: "a-b",
    });
    expect(getQueryLogResultCount(row)).toBe(2);
    expect(getQueryLogStatusLabel(row)).toBe("hit_multi");
    expect(getQueryLogMatchedKeyType(row)).toBe("punct_stripped");
    expect(getQueryLogMatchedKey(row)).toBe("a-b");
  });
});

function makeV3Row(overrides: Partial<QueryLogEventV3> = {}): QueryLogEventV3 {
  return {
    ...makeV2Row(),
    schema_version: QUERY_LOG_EVENT_V3,
    input_lang: "fr",
    output_lang: "mnk",
    ...overrides,
  };
}

describe("query-log LookupMode provenance", () => {
  it("resolves historical v1/v2 direction to FR↔MNK only", () => {
    expect(resolveLookupModeFromQueryLog(makeV1Row({ direction: "source_to_target" }))).toEqual({
      from: "fr",
      to: "mnk",
    });
    expect(resolveLookupModeFromQueryLog(makeV2Row({ direction: "target_to_source" }))).toEqual({
      from: "mnk",
      to: "fr",
    });
  });

  it("resolves explicit V3 EN pairs without ambiguity", () => {
    expect(
      resolveLookupModeFromQueryLog(
        makeV3Row({
          input_lang: "en",
          output_lang: "mnk",
          direction: "source_to_target",
        }),
      ),
    ).toEqual({ from: "en", to: "mnk" });
    expect(
      resolveLookupModeFromQueryLog(
        makeV3Row({
          input_lang: "mnk",
          output_lang: "en",
          direction: "target_to_source",
        }),
      ),
    ).toEqual({ from: "mnk", to: "en" });
  });

  it("formats lookup pair labels for diagnostics", () => {
    expect(formatLookupModeDisplay({ from: "fr", to: "mnk" })).toBe("FR → MNK");
    expect(formatLookupModeDisplay({ from: "en", to: "mnk" })).toBe("EN → MNK");
    expect(formatLookupModeDisplay({ from: "mnk", to: "fr" })).toBe("MNK → FR");
    expect(formatLookupModeDisplay({ from: "mnk", to: "en" })).toBe("MNK → EN");
  });

  it("detects V3 and rejects V2 as V3", () => {
    expect(isQueryLogEventV3(makeV3Row())).toBe(true);
    expect(isQueryLogEventV3(makeV2Row())).toBe(false);
    expect(isQueryLogEventV2(makeV3Row())).toBe(false);
  });
});
