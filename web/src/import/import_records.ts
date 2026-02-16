import { STORE_RECORDS } from "../idb/nkokan_db";
import { streamJsonlLines, type JsonlStreamProgress } from "./jsonl_stream";

export type ImportRecordsProgress = {
  bytesRead: number;
  linesSeen: number;
  recordsWritten: number;
  batchesCommitted: number;
};

export type ImportRecordsOptions = {
  batchSize?: number; // max writes per transaction
  onProgress?: (p: ImportRecordsProgress) => void;
  signal?: AbortSignal;
};

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("abort", () => reject(tx.error ?? new Error("Transaction aborted")));
    tx.addEventListener("error", () => reject(tx.error ?? new Error("Transaction error")));
  });
}

export async function importRecordsJsonl(
  db: IDBDatabase,
  recordsFile: File,
  options: ImportRecordsOptions = {},
): Promise<{ recordsWritten: number; linesSeen: number; batchesCommitted: number }> {
  const batchSize = options.batchSize ?? 500;
  const { onProgress, signal } = options;

  let bytesRead = 0;
  let linesSeen = 0;
  let recordsWritten = 0;
  let batchesCommitted = 0;

  const batch: unknown[] = [];

  const report = () =>
    onProgress?.({ bytesRead, linesSeen, recordsWritten, batchesCommitted });

  const handleStreamProgress = (p: JsonlStreamProgress) => {
    bytesRead = p.bytesRead;
    // We intentionally do not treat p.linesEmitted as authoritative for JSONL "linesSeen"
    // because we count only non-empty lines in the stream.
    report();
  };

  async function flushBatch() {
    if (batch.length === 0) return;
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    const store = tx.objectStore(STORE_RECORDS);
    for (const rec of batch) {
      store.put(rec as Record<string, unknown>);
    }
    await txDone(tx);
    batchesCommitted += 1;
    recordsWritten += batch.length;
    batch.length = 0;
    report();
    await nextAnimationFrame();
  }

  for await (const line of streamJsonlLines(recordsFile, { onProgress: handleStreamProgress, signal })) {
    if (signal?.aborted) throw new Error("Aborted");
    linesSeen += 1;

    let obj: unknown;
    try {
      obj = JSON.parse(line) as unknown;
    } catch (e) {
      throw new Error(`records.jsonl parse error on line ${linesSeen}: ${String(e)}`);
    }

    // Minimum structural requirement: must be an object with ir_id string (external deterministic key).
    if (typeof obj !== "object" || obj === null) {
      throw new Error(`records.jsonl line ${linesSeen}: expected object, got ${typeof obj}`);
    }
    const irId = (obj as Record<string, unknown>)["ir_id"];
    if (typeof irId !== "string" || irId.trim() === "") {
      throw new Error(`records.jsonl line ${linesSeen}: missing/invalid ir_id`);
    }

    batch.push(obj);
    if (batch.length >= batchSize) {
      await flushBatch();
    }
  }

  await flushBatch();
  report();

  return { recordsWritten, linesSeen, batchesCommitted };
}

