import { STORE_SEARCH_INDEX } from "../idb/nkokan_db";
import { streamJsonlLines, type JsonlStreamProgress } from "./jsonl_stream";

export type ImportSearchIndexProgress = {
  bytesRead: number;
  linesSeen: number;
  entriesWritten: number;
  batchesCommitted: number;
};

export type ImportSearchIndexOptions = {
  batchSize?: number; // max writes per transaction
  onProgress?: (p: ImportSearchIndexProgress) => void;
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

export type SearchIndexEntry = {
  key_type: string;
  key: string;
  ir_ids: string[];
};

export async function importSearchIndexJsonl(
  db: IDBDatabase,
  indexFile: File,
  options: ImportSearchIndexOptions = {},
): Promise<{ entriesWritten: number; linesSeen: number; batchesCommitted: number }> {
  const batchSize = options.batchSize ?? 500;
  const { onProgress, signal } = options;

  let bytesRead = 0;
  let linesSeen = 0;
  let entriesWritten = 0;
  let batchesCommitted = 0;

  const batch: SearchIndexEntry[] = [];

  const report = () => onProgress?.({ bytesRead, linesSeen, entriesWritten, batchesCommitted });

  const handleStreamProgress = (p: JsonlStreamProgress) => {
    bytesRead = p.bytesRead;
    report();
  };

  async function flushBatch() {
    if (batch.length === 0) return;
    const tx = db.transaction(STORE_SEARCH_INDEX, "readwrite");
    const store = tx.objectStore(STORE_SEARCH_INDEX);
    for (const entry of batch) {
      // Store the full object (including key_type + key) even though the compound keyPath
      // could technically omit them. This is valuable for debugging/export.
      store.put(entry);
    }
    await txDone(tx);
    batchesCommitted += 1;
    entriesWritten += batch.length;
    batch.length = 0;
    report();
    await nextAnimationFrame();
  }

  for await (const line of streamJsonlLines(indexFile, { onProgress: handleStreamProgress, signal })) {
    if (signal?.aborted) throw new Error("Aborted");
    linesSeen += 1;

    let obj: unknown;
    try {
      obj = JSON.parse(line) as unknown;
    } catch (e) {
      throw new Error(`search_index.jsonl parse error on line ${linesSeen}: ${String(e)}`);
    }

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

    batch.push({ key_type: keyType, key, ir_ids: ids });
    if (batch.length >= batchSize) {
      await flushBatch();
    }
  }

  await flushBatch();
  report();

  return { entriesWritten, linesSeen, batchesCommitted };
}

