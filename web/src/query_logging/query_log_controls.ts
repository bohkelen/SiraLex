import { openSiralexDb } from "../idb/siralex_db";
import { clearAllQueryLogs, countQueryLogs, exportQueryLogsJsonl } from "./query_log_store";

export type QueryLogUiResult = {
  count: number;
  message: string;
  ok: boolean;
};

type QueryLogControlsDeps = {
  clearLogs?: typeof clearAllQueryLogs;
  confirmFn?: (message: string) => boolean;
  countLogs?: typeof countQueryLogs;
  createObjectUrl?: (blob: Blob) => string;
  documentRef?: Document;
  exportLogs?: typeof exportQueryLogsJsonl;
  now?: () => Date;
  openDb?: typeof openSiralexDb;
  revokeObjectUrl?: (url: string) => void;
};

const CLEAR_CONFIRMATION_MESSAGE = "Clear all local query logs from this device?";
const NO_LOGS_TO_EXPORT_MESSAGE = "No logs to export.";

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
      message: count === 1 ? "1 log" : `${count} logs`,
      ok: true,
    };
  } catch (error) {
    return {
      count: 0,
      message: `Log count error: ${String(error)}`,
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
        message: NO_LOGS_TO_EXPORT_MESSAGE,
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
      message: `Exported ${count === 1 ? "1 log" : `${count} logs`}.`,
      ok: true,
    };
  } catch (error) {
    return {
      count: 0,
      message: `Export failed: ${String(error)}`,
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
  if (!confirmFn(CLEAR_CONFIRMATION_MESSAGE)) {
    return {
      count: -1,
      message: "Clear cancelled.",
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
      message: "Cleared query logs.",
      ok: true,
    };
  } catch (error) {
    return {
      count: 0,
      message: `Clear failed: ${String(error)}`,
      ok: false,
    };
  } finally {
    db?.close();
  }
}

