import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteSiralexDb, openSiralexDb } from "../idb/siralex_db";
import { appendQueryLog, countQueryLogs } from "./query_log_store";
import {
  clearQueryLogsFromUi,
  exportQueryLogsFromUi,
  formatQueryLogExportFilename,
  getQueryLogCountFromDb,
} from "./query_log_controls";

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
});

