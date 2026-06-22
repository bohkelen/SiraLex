import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteSiralexDb, openSiralexDb, setCachedBundleCatalog } from "../idb/siralex_db";
import {
  buildQueryLogDiagnosticsContext,
  buildQueryLogDiagnosticsText,
  clearQueryLogsFromUi,
  copyQueryLogDiagnosticsFromUi,
  exportQueryLogsFromUi,
  formatQueryLogExportFilename,
  formatQueryLogStatsLine,
  getQueryLogCountFromDb,
  getQueryLogStatsFromDb,
} from "./query_log_controls";
import { appendQueryLog, appendQueryLogV2, countQueryLogs } from "./query_log_store";
import { QUERY_LOG_CONSENT_VERSION } from "./query_log_types";

describe("query log controls", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine if db does not exist yet
    }
    vi.restoreAllMocks();
  });

  it("formats export filenames as siralex-query-logs-YYYYMMDDTHHMMSSZ.jsonl", () => {
    expect(formatQueryLogExportFilename(new Date("2026-05-08T17:00:01.000Z"))).toBe(
      "siralex-query-logs-20260508T170001Z.jsonl",
    );
  });

  it("exports a JSONL blob through a download path when logs exist", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, {
        query_raw: "one",
        query_normalized_keys: {
          casefold: ["one"],
          diacritics_insensitive: ["one"],
          punct_stripped: ["one"],
          nospace: ["one"],
        },
        direction: "source_to_target",
        ladder_level_hit: "casefold",
        ir_ids_count: 1,
        bundle_id: "bundle-a",
        bundle_version: "1.0.0",
        storage_scope_id: "bundle-a::sha256:1",
        norm_version: "norm_v2",
        app_version: "test",
        timestamp_iso: "2026-05-08T17:00:00.000Z",
        logging_enabled: true,
      });
    } finally {
      db.close();
    }

    const clickSpy = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click: clickSpy,
    } as unknown as HTMLAnchorElement;
    const createObjectUrl = vi.fn(() => "blob:test-url");
    const revokeObjectUrl = vi.fn();

    const result = await exportQueryLogsFromUi({
      createObjectUrl,
      revokeObjectUrl,
      documentRef: {
        createElement: vi.fn(() => anchor),
      } as unknown as Document,
      now: () => new Date("2026-05-08T17:00:01.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.message).toBe("Exported 1 log.");
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(anchor.download).toBe("siralex-query-logs-20260508T170001Z.jsonl");
    expect(anchor.href).toBe("blob:test-url");
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("handles zero logs safely without attempting a download", async () => {
    const createObjectUrl = vi.fn(() => "blob:test-url");

    const result = await exportQueryLogsFromUi({
      createObjectUrl,
      documentRef: {
        createElement: vi.fn(),
      } as unknown as Document,
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toBe("No logs to export.");
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("clear calls clearAllQueryLogs only after confirmation", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, {
        query_raw: "one",
        query_normalized_keys: {
          casefold: ["one"],
          diacritics_insensitive: ["one"],
          punct_stripped: ["one"],
          nospace: ["one"],
        },
        direction: "source_to_target",
        ladder_level_hit: "casefold",
        ir_ids_count: 1,
        bundle_id: "bundle-a",
        bundle_version: "1.0.0",
        storage_scope_id: "bundle-a::sha256:1",
        norm_version: "norm_v2",
        app_version: "test",
        timestamp_iso: "2026-05-08T17:00:00.000Z",
        logging_enabled: true,
      });
    } finally {
      db.close();
    }

    const result = await clearQueryLogsFromUi({
      confirmFn: () => true,
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toBe("Cleared query logs.");

    const dbAfter = await openSiralexDb();
    try {
      expect(await countQueryLogs(dbAfter)).toBe(0);
    } finally {
      dbAfter.close();
    }
  });

  it("cancel confirmation does not clear logs", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, {
        query_raw: "one",
        query_normalized_keys: {
          casefold: ["one"],
          diacritics_insensitive: ["one"],
          punct_stripped: ["one"],
          nospace: ["one"],
        },
        direction: "source_to_target",
        ladder_level_hit: "casefold",
        ir_ids_count: 1,
        bundle_id: "bundle-a",
        bundle_version: "1.0.0",
        storage_scope_id: "bundle-a::sha256:1",
        norm_version: "norm_v2",
        app_version: "test",
        timestamp_iso: "2026-05-08T17:00:00.000Z",
        logging_enabled: true,
      });
    } finally {
      db.close();
    }

    const result = await clearQueryLogsFromUi({
      confirmFn: () => false,
    });

    expect(result.ok).toBe(true);
    expect(result.message).toBe("Clear cancelled.");

    const dbAfter = await openSiralexDb();
    try {
      expect(await countQueryLogs(dbAfter)).toBe(1);
    } finally {
      dbAfter.close();
    }
  });

  it("getQueryLogCountFromDb reports updated count after clear", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLog(db, {
        query_raw: "one",
        query_normalized_keys: {
          casefold: ["one"],
          diacritics_insensitive: ["one"],
          punct_stripped: ["one"],
          nospace: ["one"],
        },
        direction: "source_to_target",
        ladder_level_hit: "casefold",
        ir_ids_count: 1,
        bundle_id: "bundle-a",
        bundle_version: "1.0.0",
        storage_scope_id: "bundle-a::sha256:1",
        norm_version: "norm_v2",
        app_version: "test",
        timestamp_iso: "2026-05-08T17:00:00.000Z",
        logging_enabled: true,
      });
    } finally {
      db.close();
    }

    expect((await getQueryLogCountFromDb()).count).toBe(1);
    await clearQueryLogsFromUi({ confirmFn: () => true });
    expect((await getQueryLogCountFromDb()).count).toBe(0);
  });

  it("surfaces failures without throwing into callers", async () => {
    const result = await exportQueryLogsFromUi({
      openDb: async () => {
        throw new Error("db unavailable");
      },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Export failed/);
  });

  it("getQueryLogStatsFromDb reports count and oldest timestamp", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLogV2(db, {
        event_id: "evt-stats-1",
        timestamp_iso: "2026-06-01T00:00:00.000Z",
        app_version: "test",
        bundle_id: "bundle-a",
        storage_scope_id: "bundle-a::sha256:1",
        norm_version: "norm_v3",
        query_raw: "older",
        query_normalized_primary: "older",
        query_normalized_keys: {
          casefold: ["older"],
          diacritics_insensitive: ["older"],
          punct_stripped: ["older"],
          nospace: ["older"],
        },
        direction: "source_to_target",
        ui_language: "fr",
        result_status: "hit_single",
        result_count: 1,
        top_ir_ids: ["ir-1"],
        matched_key_type: "casefold",
        matched_key: "older",
        matched_deep_ladder: false,
        latency_ms: 10,
        offline_or_online: true,
        session_bucket_id: "session-1",
        logging_enabled: true,
        consent_version: QUERY_LOG_CONSENT_VERSION,
      });
      await appendQueryLogV2(db, {
        event_id: "evt-stats-2",
        timestamp_iso: "2026-06-18T00:00:00.000Z",
        app_version: "test",
        bundle_id: "bundle-a",
        storage_scope_id: "bundle-a::sha256:1",
        norm_version: "norm_v3",
        query_raw: "newer",
        query_normalized_primary: "newer",
        query_normalized_keys: {
          casefold: ["newer"],
          diacritics_insensitive: ["newer"],
          punct_stripped: ["newer"],
          nospace: ["newer"],
        },
        direction: "source_to_target",
        ui_language: "fr",
        result_status: "hit_single",
        result_count: 1,
        top_ir_ids: ["ir-2"],
        matched_key_type: "casefold",
        matched_key: "newer",
        matched_deep_ladder: false,
        latency_ms: 11,
        offline_or_online: true,
        session_bucket_id: "session-1",
        logging_enabled: true,
        consent_version: QUERY_LOG_CONSENT_VERSION,
      });
    } finally {
      db.close();
    }

    const result = await getQueryLogStatsFromDb();
    expect(result.ok).toBe(true);
    expect(result.stats.count).toBe(2);
    expect(result.stats.oldest_timestamp_iso).toBe("2026-06-01T00:00:00.000Z");
    expect(result.message).toBe("2 logs");
  });

  it("formats localized stats line with oldest timestamp or dash", () => {
    const translate = (key: string, vars?: Record<string, string | number>) => {
      if (key === "logging.statsOldestNone") {
        return "—";
      }
      return `${key}:${vars?.count}:${vars?.oldest}`;
    };

    expect(
      formatQueryLogStatsLine({ count: 4, oldest_timestamp_iso: "2026-06-01T00:00:00.000Z" }, { translate }),
    ).toBe("logging.statsLine:4:2026-06-01T00:00:00.000Z");

    expect(formatQueryLogStatsLine({ count: 0, oldest_timestamp_iso: null }, { translate })).toBe(
      "logging.statsLine:0:—",
    );
  });

  it("builds copy diagnostics text with app/bundle/norm/log stats", async () => {
    const db = await openSiralexDb();
    try {
      await appendQueryLogV2(db, {
        event_id: "evt-copy-1",
        timestamp_iso: "2026-06-01T00:00:00.000Z",
        app_version: "test",
        bundle_id: "bundle-a",
        storage_scope_id: "bundle-a::sha256:1",
        norm_version: "norm_v3",
        query_raw: "secret-query",
        query_normalized_primary: "secret-query",
        query_normalized_keys: {
          casefold: ["secret-query"],
          diacritics_insensitive: ["secret-query"],
          punct_stripped: ["secret-query"],
          nospace: ["secret-query"],
        },
        direction: "source_to_target",
        ui_language: "fr",
        result_status: "hit_single",
        result_count: 1,
        top_ir_ids: ["ir-1"],
        matched_key_type: "casefold",
        matched_key: "secret-query",
        matched_deep_ladder: false,
        latency_ms: 10,
        offline_or_online: true,
        session_bucket_id: "1234567890abcdef",
        logging_enabled: true,
        consent_version: QUERY_LOG_CONSENT_VERSION,
      });
      await setCachedBundleCatalog(db, {
        request_url: "/catalog.json",
        response_url: "/catalog.json",
        fetched_at_iso: "2026-06-18T00:00:00.000Z",
        warnings: [],
        catalog: {
          catalog_schema_version: "bundle_catalog_v1",
          bundles: [
            {
              bundle_id: "bundle-a",
              name: "Bundle A",
              version: "norm-v3-featured",
              size_bytes: 1,
              url_base: "/bundle-a",
              content_sha256: "sha256:abc",
            },
          ],
        },
      });
    } finally {
      db.close();
    }

    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        if (key === "siralex.query_logging.consent_version") {
          return QUERY_LOG_CONSENT_VERSION;
        }
        if (key === "siralex.query_logging.consent_at_iso") {
          return "2026-06-18T12:00:00.000Z";
        }
        if (key === "siralex.query_logging.session_bucket_id") {
          return "1234567890abcdef";
        }
        return null;
      },
      setItem() {},
      removeItem() {},
      clear() {},
    });

    const context = await buildQueryLogDiagnosticsContext({
      appVersion: "1.2.3",
      bundleId: "bundle-a",
      normVersion: "norm_v3",
      uiLanguage: "fr",
      loggingEnabled: true,
    });

    const text = buildQueryLogDiagnosticsText(context);
    expect(text).toContain("app_version: 1.2.3");
    expect(text).toContain("bundle_id: bundle-a");
    expect(text).toContain("catalog_version: norm-v3-featured");
    expect(text).toContain("norm_version: norm_v3");
    expect(text).toContain("ui_language: fr");
    expect(text).toContain("query_log_count: 1");
    expect(text).toContain("query_log_oldest: 2026-06-01T00:00:00.000Z");
    expect(text).toContain("logging_enabled: true");
    expect(text).toContain(`consent_version: ${QUERY_LOG_CONSENT_VERSION}`);
    expect(text).toContain("session_bucket_prefix: 12345678…");
    expect(text).not.toContain("secret-query");
    expect(text).not.toContain("1234567890abcdef");
  });

  it("copy diagnostics handles clipboard failure", async () => {
    const result = await copyQueryLogDiagnosticsFromUi(
      {
        appVersion: "1.2.3",
        bundleId: "bundle-a",
        catalogVersion: undefined,
        normVersion: "norm_v3",
        uiLanguage: "en",
        stats: { count: 0, oldest_timestamp_iso: null },
        loggingEnabled: false,
        consentVersion: undefined,
        sessionBucketPrefix: undefined,
      },
      {
        writeClipboard: async () => {
          throw new Error("clipboard unavailable");
        },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Could not copy diagnostic info/);
  });
});

