import { openSiralexDb } from "../idb/siralex_db";
import { resolveCatalogVersionForBundle } from "./query_log_catalog";
import {
  getQueryLoggingConsentStatus,
  getSessionBucketPrefixForDiagnostics,
  hasValidQueryLoggingConsent,
} from "./query_log_consent";
import { clearAllQueryLogs, countQueryLogs, exportQueryLogsJsonl, getQueryLogStats } from "./query_log_store";
import type { QueryLogStats } from "./query_log_types";

export type QueryLogUiResult = {
  count: number;
  message: string;
  ok: boolean;
};

export type QueryLogStatsResult = {
  stats: QueryLogStats;
  message: string;
  ok: boolean;
};

export type QueryLogDiagnosticsContext = {
  appVersion: string;
  bundleId: string | undefined;
  catalogVersion: string | undefined;
  normVersion: string | undefined;
  uiLanguage: string;
  stats: QueryLogStats;
  loggingEnabled: boolean;
  consentVersion: string | undefined;
  sessionBucketPrefix: string | undefined;
};

type QueryLogControlsDeps = {
  clearLogs?: typeof clearAllQueryLogs;
  confirmFn?: (message: string) => boolean;
  countLogs?: typeof countQueryLogs;
  statsLogs?: typeof getQueryLogStats;
  createObjectUrl?: (blob: Blob) => string;
  documentRef?: Document;
  exportLogs?: typeof exportQueryLogsJsonl;
  now?: () => Date;
  openDb?: typeof openSiralexDb;
  resolveCatalogVersion?: typeof resolveCatalogVersionForBundle;
  revokeObjectUrl?: (url: string) => void;
  writeClipboard?: (text: string) => Promise<void>;
  translate?: (
    key:
      | "queryLogs.clearConfirm"
      | "queryLogs.noLogsToExport"
      | "queryLogs.clearCancelled"
      | "queryLogs.cleared"
      | "queryLogs.count.one"
      | "queryLogs.count.many"
      | "queryLogs.countError"
      | "queryLogs.exported.one"
      | "queryLogs.exported.many"
      | "queryLogs.exportFailed"
      | "queryLogs.clearFailed"
      | "logging.statsLine"
      | "logging.statsOldestNone"
      | "logging.diagnosticsCopied"
      | "logging.diagnosticsCopyFailed",
    vars?: Record<string, string | number>,
  ) => string;
};

function t(
  deps: QueryLogControlsDeps,
  key:
    | "queryLogs.clearConfirm"
    | "queryLogs.noLogsToExport"
    | "queryLogs.clearCancelled"
    | "queryLogs.cleared"
    | "queryLogs.count.one"
    | "queryLogs.count.many"
    | "queryLogs.countError"
    | "queryLogs.exported.one"
    | "queryLogs.exported.many"
    | "queryLogs.exportFailed"
    | "queryLogs.clearFailed"
    | "logging.statsLine"
    | "logging.statsOldestNone"
    | "logging.diagnosticsCopied"
    | "logging.diagnosticsCopyFailed",
  vars?: Record<string, string | number>,
): string {
  if (deps.translate) {
    return deps.translate(key, vars);
  }
  switch (key) {
    case "queryLogs.clearConfirm":
      return "Clear all local query logs from this device?";
    case "queryLogs.noLogsToExport":
      return "No logs to export.";
    case "queryLogs.clearCancelled":
      return "Clear cancelled.";
    case "queryLogs.cleared":
      return "Cleared query logs.";
    case "queryLogs.count.one":
      return "1 log";
    case "queryLogs.count.many":
      return `${vars?.count ?? 0} logs`;
    case "queryLogs.countError":
      return `Log count error: ${String(vars?.error ?? "")}`;
    case "queryLogs.exported.one":
      return "Exported 1 log.";
    case "queryLogs.exported.many":
      return `Exported ${vars?.count ?? 0} logs.`;
    case "queryLogs.exportFailed":
      return `Export failed: ${String(vars?.error ?? "")}`;
    case "queryLogs.clearFailed":
      return `Clear failed: ${String(vars?.error ?? "")}`;
    case "logging.statsLine":
      return `${vars?.count ?? 0} logs · oldest ${String(vars?.oldest ?? "—")} · cap 2000 / 90d`;
    case "logging.statsOldestNone":
      return "—";
    case "logging.diagnosticsCopied":
      return "Diagnostic info copied.";
    case "logging.diagnosticsCopyFailed":
      return `Could not copy diagnostic info: ${String(vars?.error ?? "")}`;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatQueryLogExportFilename(now: Date = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = pad2(now.getUTCMonth() + 1);
  const dd = pad2(now.getUTCDate());
  const hh = pad2(now.getUTCHours());
  const mi = pad2(now.getUTCMinutes());
  const ss = pad2(now.getUTCSeconds());
  return `siralex-query-logs-${yyyy}${mm}${dd}T${hh}${mi}${ss}Z.jsonl`;
}

export function formatQueryLogStatsLine(stats: QueryLogStats, deps: QueryLogControlsDeps = {}): string {
  const oldest = stats.oldest_timestamp_iso ?? t(deps, "logging.statsOldestNone");
  return t(deps, "logging.statsLine", { count: stats.count, oldest });
}

export function buildQueryLogDiagnosticsText(context: QueryLogDiagnosticsContext): string {
  const lines = [
    `app_version: ${context.appVersion}`,
    `bundle_id: ${context.bundleId ?? "unknown"}`,
    `catalog_version: ${context.catalogVersion ?? "unknown"}`,
    `norm_version: ${context.normVersion ?? "unknown"}`,
    `ui_language: ${context.uiLanguage}`,
    `query_log_count: ${context.stats.count}`,
    `query_log_oldest: ${context.stats.oldest_timestamp_iso ?? "unknown"}`,
    `logging_enabled: ${context.loggingEnabled}`,
    `consent_version: ${context.consentVersion ?? "none"}`,
  ];
  if (context.sessionBucketPrefix) {
    lines.push(`session_bucket_prefix: ${context.sessionBucketPrefix}`);
  }
  return lines.join("\n");
}

export async function buildQueryLogDiagnosticsContext(
  params: {
    appVersion: string;
    bundleId?: string;
    normVersion?: string;
    uiLanguage: string;
    loggingEnabled: boolean;
  },
  deps: QueryLogControlsDeps = {},
): Promise<QueryLogDiagnosticsContext> {
  const openDbFn = deps.openDb ?? openSiralexDb;
  const statsFn = deps.statsLogs ?? getQueryLogStats;
  const resolveCatalogVersion = deps.resolveCatalogVersion ?? resolveCatalogVersionForBundle;
  let db: IDBDatabase | undefined;
  try {
    db = await openDbFn();
    const stats = await statsFn(db);
    const catalogVersion =
      params.bundleId !== undefined
        ? await resolveCatalogVersion(db, params.bundleId)
        : undefined;
    const consent = getQueryLoggingConsentStatus();
    return {
      appVersion: params.appVersion,
      bundleId: params.bundleId,
      catalogVersion,
      normVersion: params.normVersion,
      uiLanguage: params.uiLanguage,
      stats,
      loggingEnabled: params.loggingEnabled,
      consentVersion: hasValidQueryLoggingConsent() ? consent.version : undefined,
      sessionBucketPrefix: getSessionBucketPrefixForDiagnostics(),
    };
  } finally {
    db?.close();
  }
}

export async function copyQueryLogDiagnosticsFromUi(
  context: QueryLogDiagnosticsContext,
  deps: QueryLogControlsDeps = {},
): Promise<QueryLogUiResult> {
  const writeClipboard =
    deps.writeClipboard ??
    (async (text: string) => {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      throw new Error("clipboard unavailable");
    });

  try {
    await writeClipboard(buildQueryLogDiagnosticsText(context));
    return {
      count: context.stats.count,
      message: t(deps, "logging.diagnosticsCopied"),
      ok: true,
    };
  } catch (error) {
    return {
      count: context.stats.count,
      message: t(deps, "logging.diagnosticsCopyFailed", { error: String(error) }),
      ok: false,
    };
  }
}

export async function getQueryLogCountFromDb(
  deps: QueryLogControlsDeps = {},
): Promise<QueryLogUiResult> {
  const openDbFn = deps.openDb ?? openSiralexDb;
  const countLogsFn = deps.countLogs ?? countQueryLogs;
  let db: IDBDatabase | undefined;
  try {
    db = await openDbFn();
    const count = await countLogsFn(db);
    return {
      count,
      message: count === 1 ? t(deps, "queryLogs.count.one") : t(deps, "queryLogs.count.many", { count }),
      ok: true,
    };
  } catch (error) {
    return {
      count: 0,
      message: t(deps, "queryLogs.countError", { error: String(error) }),
      ok: false,
    };
  } finally {
    db?.close();
  }
}

export async function getQueryLogStatsFromDb(
  deps: QueryLogControlsDeps = {},
): Promise<QueryLogStatsResult> {
  const openDbFn = deps.openDb ?? openSiralexDb;
  const statsFn = deps.statsLogs ?? getQueryLogStats;
  let db: IDBDatabase | undefined;
  try {
    db = await openDbFn();
    const stats = await statsFn(db);
    return {
      stats,
      message:
        stats.count === 1
          ? t(deps, "queryLogs.count.one")
          : t(deps, "queryLogs.count.many", { count: stats.count }),
      ok: true,
    };
  } catch (error) {
    return {
      stats: { count: 0, oldest_timestamp_iso: null },
      message: t(deps, "queryLogs.countError", { error: String(error) }),
      ok: false,
    };
  } finally {
    db?.close();
  }
}

export async function exportQueryLogsFromUi(
  deps: QueryLogControlsDeps = {},
): Promise<QueryLogUiResult> {
  const openDbFn = deps.openDb ?? openSiralexDb;
  const countLogsFn = deps.countLogs ?? countQueryLogs;
  const exportLogsFn = deps.exportLogs ?? exportQueryLogsJsonl;
  const now = deps.now ?? (() => new Date());

  let db: IDBDatabase | undefined;
  try {
    db = await openDbFn();
    const count = await countLogsFn(db);
    if (count === 0) {
      return {
        count: 0,
        message: t(deps, "queryLogs.noLogsToExport"),
        ok: true,
      };
    }

    const blob = await exportLogsFn(db);
    const filename = formatQueryLogExportFilename(now());
    const documentRef = deps.documentRef ?? document;
    const createObjectUrl = deps.createObjectUrl ?? ((downloadBlob: Blob) => URL.createObjectURL(downloadBlob));
    const revokeObjectUrl = deps.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url));
    const url = createObjectUrl(blob);
    try {
      const link = documentRef.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
    } finally {
      setTimeout(() => revokeObjectUrl(url), 1000);
    }

    return {
      count,
      message:
        count === 1
          ? t(deps, "queryLogs.exported.one")
          : t(deps, "queryLogs.exported.many", { count }),
      ok: true,
    };
  } catch (error) {
    return {
      count: 0,
      message: t(deps, "queryLogs.exportFailed", { error: String(error) }),
      ok: false,
    };
  } finally {
    db?.close();
  }
}

export async function clearQueryLogsFromUi(
  deps: QueryLogControlsDeps = {},
): Promise<QueryLogUiResult> {
  const confirmFn = deps.confirmFn ?? ((message: string) => window.confirm(message));
  if (!confirmFn(t(deps, "queryLogs.clearConfirm"))) {
    return {
      count: -1,
      message: t(deps, "queryLogs.clearCancelled"),
      ok: true,
    };
  }

  const openDbFn = deps.openDb ?? openSiralexDb;
  const clearLogsFn = deps.clearLogs ?? clearAllQueryLogs;
  let db: IDBDatabase | undefined;
  try {
    db = await openDbFn();
    await clearLogsFn(db);
    const count = await countQueryLogs(db);
    return {
      count,
      message: t(deps, "queryLogs.cleared"),
      ok: true,
    };
  } catch (error) {
    return {
      count: 0,
      message: t(deps, "queryLogs.clearFailed", { error: String(error) }),
      ok: false,
    };
  } finally {
    db?.close();
  }
}

