import { MAX_JSONL_LINE_BYTES } from "../constants";

export type JsonlStreamProgress = {
  bytesRead: number;
  linesEmitted: number;
};

export type StreamJsonlOptions = {
  /**
   * Hard safety cap for a single JSONL line (UTF-8 bytes).
   * If exceeded, streaming aborts with an error.
   */
  maxLineBytes?: number;
  /**
   * Called occasionally as bytes are read / lines emitted.
   */
  onProgress?: (p: JsonlStreamProgress) => void;
  /**
   * Optional abort signal for cancellation.
   */
  signal?: AbortSignal;
};

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new Error("Aborted");
  }
}

/**
 * Stream a File as JSONL lines without building large intermediate arrays.
 *
 * Important:
 * - This does NOT trim whitespace: JSONL is line-delimited JSON; leading/trailing
 *   spaces are part of the line and should be handled by the consumer if desired.
 * - Uses incremental newline scanning (avoids buffer.split("\n") blowups).
 */
export async function* streamJsonlLines(
  file: File,
  options: StreamJsonlOptions = {},
): AsyncGenerator<string> {
  const maxLineBytes = options.maxLineBytes ?? MAX_JSONL_LINE_BYTES;
  const { onProgress, signal } = options;

  const reader = file.stream().getReader();

  let bytesRead = 0;
  let linesEmitted = 0;

  const report = () => onProgress?.({ bytesRead, linesEmitted });

  const decoder = new TextDecoder("utf-8");

  // We keep pending bytes as chunk slices, and only allocate a contiguous
  // line buffer when we have a full line to emit. This avoids split("\n")
  // and keeps memory bounded by maxLineBytes.
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;

  const pushPending = (chunk: Uint8Array) => {
    pending.push(chunk);
    pendingBytes += chunk.byteLength;
    if (pendingBytes > maxLineBytes) {
      // This means we have a line (no newline yet) larger than the cap.
      throw new Error(`JSONL line exceeds MAX_JSONL_LINE_BYTES (${maxLineBytes}): ${pendingBytes}`);
    }
  };

  const takeLineBytes = (lineParts: Uint8Array[], lineBytesTotal: number): Uint8Array => {
    const out = new Uint8Array(lineBytesTotal);
    let off = 0;
    for (const p of lineParts) {
      out.set(p, off);
      off += p.byteLength;
    }
    return out;
  };

  try {
    while (true) {
      throwIfAborted(signal);
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      bytesRead += value.byteLength;
      // Search for newlines inside this chunk and emit complete lines.
      // We keep any tail bytes (after the last newline) in pending.
      let start = 0;
      for (let i = 0; i < value.byteLength; i += 1) {
        if (value[i] !== 0x0a) continue; // '\n'

        // Bytes from `start` to `i` are part of the current line.
        const segment = value.subarray(start, i);
        const lineParts: Uint8Array[] = [];
        let lineBytesTotal = 0;

        if (pending.length > 0) {
          lineParts.push(...pending);
          lineBytesTotal += pendingBytes;
          pending = [];
          pendingBytes = 0;
        }
        if (segment.byteLength > 0) {
          lineParts.push(segment);
          lineBytesTotal += segment.byteLength;
        }

        if (lineBytesTotal > maxLineBytes) {
          throw new Error(`JSONL line exceeds MAX_JSONL_LINE_BYTES (${maxLineBytes}): ${lineBytesTotal}`);
        }

        // Decode and emit line (skip empty/whitespace-only lines).
        const lineBytes = takeLineBytes(lineParts, lineBytesTotal);
        let line = decoder.decode(lineBytes);
        if (line.endsWith("\r")) line = line.slice(0, -1); // handle CRLF
        if (line.trim() !== "") {
          linesEmitted += 1;
          if (linesEmitted % 200 === 0) report();
          yield line;
        }

        start = i + 1;
      }

      // Tail (no newline): store for the next chunk.
      if (start < value.byteLength) {
        pushPending(value.subarray(start));
      }

      report();
    }

    // Flush remainder as a final line.
    if (pendingBytes > 0) {
      if (pendingBytes > maxLineBytes) {
        throw new Error(`JSONL line exceeds MAX_JSONL_LINE_BYTES (${maxLineBytes}): ${pendingBytes}`);
      }
      const lineBytes = takeLineBytes(pending, pendingBytes);
      let line = decoder.decode(lineBytes);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.trim() !== "") {
        linesEmitted += 1;
        report();
        yield line;
      }
    }

    report();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

