import { STORE_SEARCH_INDEX } from "../idb/siralex_db";
import { streamJsonlLines, type JsonlByteSource, type JsonlStreamProgress } from "./jsonl_stream";

export type ImportSearchIndexProgress = {
  bytesRead: number;
  linesSeen: number;
  entriesWritten: number;
  batchesCommitted: number;
};

export type ImportSearchIndexOptions = {
  bundleId: string;
  batchSize?: number; // max writes per transaction
  onProgress?: (p: ImportSearchIndexProgress) => void;
  signal?: AbortSignal;
  debugDetectDuplicateKeys?: boolean;
};

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("abort", () => reject(tx.error ?? new Error("Transaction aborted")));
    tx.addEventListener("error", () => reject(tx.error ?? new Error("Transaction error")));
  });
}

export type SearchIndexEntry = {
  bundle_id?: string;
  key_type: string;
  key: string;
  ir_ids: string[];
};

function describeError(e: unknown): {
  error: unknown;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
} {
  if (e instanceof Error) {
    return {
      error: e,
      errorName: e.name,
      errorMessage: e.message,
      errorStack: e.stack,
    };
  }
  if (typeof e === "object" && e !== null) {
    const maybe = e as { name?: unknown; message?: unknown; stack?: unknown };
    return {
      error: e,
      errorName: typeof maybe.name === "string" ? maybe.name : undefined,
      errorMessage: typeof maybe.message === "string" ? maybe.message : undefined,
      errorStack: typeof maybe.stack === "string" ? maybe.stack : undefined,
    };
  }
  return {
    error: e,
    errorMessage: String(e),
  };
}

function summarizeEntry(entry: SearchIndexEntry | undefined) {
  if (!entry) return undefined;
  return {
    key_type: entry.key_type,
    key:
      entry.key.length > 160
        ? `${entry.key.slice(0, 157)}...`
        : entry.key,
    ir_ids_count: entry.ir_ids.length,
    ir_ids_sample: entry.ir_ids.slice(0, 3),
  };
}

export async function importSearchIndexJsonl(
  db: IDBDatabase,
  indexFile: JsonlByteSource,
  options: ImportSearchIndexOptions,
): Promise<{ entriesWritten: number; linesSeen: number; batchesCommitted: number; duplicateKeysFound: string[] }> {
  const batchSize = options.batchSize ?? 500;
  const { bundleId, onProgress, signal, debugDetectDuplicateKeys } = options;

  if (typeof bundleId !== "string" || bundleId.trim() === "") {
    throw new Error("importSearchIndexJsonl requires a non-empty bundleId");
  }

  let bytesRead = 0;
  let linesSeen = 0;
  let entriesWritten = 0;
  let batchesCommitted = 0;
  const duplicateKeysFound: string[] = [];
  let lastProcessedLineNumber = 0;
  let currentPhase:
    | "stream"
    | "json-parse"
    | "validation"
    | "store.put"
    | "txDone"
    | "idle" = "stream";

  const batch: SearchIndexEntry[] = [];
  const batchKeySet = debugDetectDuplicateKeys ? new Set<string>() : undefined;

  const report = () => onProgress?.({ bytesRead, linesSeen, entriesWritten, batchesCommitted });

  const handleStreamProgress = (p: JsonlStreamProgress) => {
    bytesRead = p.bytesRead;
    report();
  };

  async function flushBatch() {
    if (batch.length === 0) return;
    const batchNumber = batchesCommitted + 1;
    const batchStartLineNumber = linesSeen - batch.length + 1;
    const batchEndLineNumber = linesSeen;
    let firstRequestError:
      | {
          requestIndex: number;
          errorName?: string;
          errorMessage?: string;
        }
      | undefined;
    const tx = db.transaction(STORE_SEARCH_INDEX, "readwrite");
    const store = tx.objectStore(STORE_SEARCH_INDEX);
    currentPhase = "store.put";
    for (const [requestIndex, entry] of batch.entries()) {
      const req = store.put(entry);
      req.addEventListener("error", () => {
        const reqDetails = describeError(req.error);
        if (!firstRequestError) {
          firstRequestError = {
            requestIndex,
            errorName: reqDetails.errorName,
            errorMessage: reqDetails.errorMessage,
          };
        }
      });
    }
    try {
      currentPhase = "txDone";
      await txDone(tx);
    } catch (e) {
      const details = describeError(e);
      const txDetails = describeError(tx.error);
      throw new Error(
        `search_index.jsonl transaction failed in batch ${batchNumber} (lines ${batchStartLineNumber}-${batchEndLineNumber}) after ${entriesWritten} committed entries at line ${lastProcessedLineNumber}: ${details.errorMessage ?? String(e)}; tx.error=${txDetails.errorName ?? "unknown"}:${txDetails.errorMessage ?? "unknown"}; firstRequestError=${
          firstRequestError
            ? `${firstRequestError.requestIndex}@line${batchStartLineNumber + firstRequestError.requestIndex}:${firstRequestError.errorName ?? "unknown"}:${firstRequestError.errorMessage ?? "unknown"}`
            : "none"
        }; firstEntry=${JSON.stringify(summarizeEntry(batch[0]))}; lastEntry=${JSON.stringify(summarizeEntry(batch[batch.length - 1]))}`,
      );
    }
    batchesCommitted += 1;
    entriesWritten += batch.length;
    batch.length = 0;
    batchKeySet?.clear();
    currentPhase = "idle";
    report();
    await nextAnimationFrame();
  }

  try {
    for await (const line of streamJsonlLines(indexFile, { onProgress: handleStreamProgress, signal })) {
      currentPhase = "stream";
      if (signal?.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason ?? "Aborted"));
      }
      linesSeen += 1;
      lastProcessedLineNumber = linesSeen;

      let obj: unknown;
      try {
        currentPhase = "json-parse";
        obj = JSON.parse(line) as unknown;
      } catch (e) {
        throw new Error(`search_index.jsonl parse error on line ${linesSeen}: ${String(e)}`);
      }

      currentPhase = "validation";
      if (typeof obj !== "object" || obj === null) {
        throw new Error(`search_index.jsonl line ${linesSeen}: expected object, got ${typeof obj}`);
      }
      const rec = obj as Record<string, unknown>;
      const keyType = rec["key_type"];
      const key = rec["key"];
      const irIds = rec["ir_ids"];

      if (typeof keyType !== "string" || keyType.trim() === "") {
        throw new Error(`search_index.jsonl line ${linesSeen}: missing/invalid key_type`);
      }
      if (typeof key !== "string" || key.trim() === "") {
        throw new Error(`search_index.jsonl line ${linesSeen}: missing/invalid key`);
      }
      if (!Array.isArray(irIds)) {
        throw new Error(`search_index.jsonl line ${linesSeen}: missing/invalid ir_ids (array)`);
      }
      const ids: string[] = [];
      for (const x of irIds) {
        if (typeof x !== "string" || x.trim() === "") continue;
        ids.push(x);
      }
      if (ids.length === 0) {
        throw new Error(`search_index.jsonl line ${linesSeen}: ir_ids[] is empty or non-string`);
      }

      if (batchKeySet) {
        const compoundKey = `${bundleId}\0${keyType}\0${key}`;
        if (batchKeySet.has(compoundKey)) {
          duplicateKeysFound.push(
            `search_index line ${linesSeen}: duplicate [${bundleId}, ${keyType}, ${key}] within batch`,
          );
        }
        batchKeySet.add(compoundKey);
      }

      batch.push({ bundle_id: bundleId, key_type: keyType, key, ir_ids: ids });
      if (batch.length >= batchSize) {
        await flushBatch();
      }
    }

    await flushBatch();
    report();
  } catch (e) {
    const details = describeError(e);
    throw new Error(
      `importSearchIndexJsonl failed during ${currentPhase}: ${details.errorMessage ?? String(e)}; linesSeen=${linesSeen}; entriesWritten=${entriesWritten}; batchesCommitted=${batchesCommitted}; lastProcessedLineNumber=${lastProcessedLineNumber}; pendingBatchSize=${batch.length}; pendingBatchLines=${
        batch.length > 0 ? `${linesSeen - batch.length + 1}-${linesSeen}` : "none"
      }; firstEntry=${JSON.stringify(summarizeEntry(batch[0]))}; lastEntry=${JSON.stringify(summarizeEntry(batch[batch.length - 1]))}`,
    );
  }

  return { entriesWritten, linesSeen, batchesCommitted, duplicateKeysFound };
}

