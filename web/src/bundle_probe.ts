export type JsonlProbeResult = {
  bytesRead: number;
  linesSeen: number;
  jsonParsed: number;
  parseErrors: number;
  elapsedMs: number;
  heapUsedBefore?: number;
  heapUsedAfter?: number;
};

type ProbeOptions = {
  maxLines?: number;
  jsonParse?: boolean;
};

function getUsedHeapBytes(): number | undefined {
  // Chrome-only (not standardized). Good enough for sanity checks.
  const anyPerf = performance as unknown as { memory?: { usedJSHeapSize: number } };
  return anyPerf.memory?.usedJSHeapSize;
}

export async function probeJsonlFile(
  file: File,
  options: ProbeOptions = {},
): Promise<JsonlProbeResult> {
  const { maxLines, jsonParse = true } = options;

  const heapUsedBefore = getUsedHeapBytes();
  const t0 = performance.now();

  const decoder = new TextDecoder("utf-8");
  const reader = file.stream().getReader();

  let bytesRead = 0;
  let buffer = "";

  let linesSeen = 0;
  let jsonParsed = 0;
  let parseErrors = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      bytesRead += value.byteLength;
      buffer += decoder.decode(value, { stream: true });
    }

    // Process full lines; keep trailing partial line in buffer
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";

    for (const rawLine of parts) {
      const line = rawLine.trim();
      if (!line) continue;

      linesSeen += 1;
      if (jsonParse) {
        try {
          JSON.parse(line);
          jsonParsed += 1;
        } catch {
          parseErrors += 1;
        }
      }

      if (maxLines !== undefined && linesSeen >= maxLines) {
        await reader.cancel();
        const elapsedMs = performance.now() - t0;
        const heapUsedAfter = getUsedHeapBytes();
        return {
          bytesRead,
          linesSeen,
          jsonParsed,
          parseErrors,
          elapsedMs,
          heapUsedBefore,
          heapUsedAfter,
        };
      }
    }
  }

  // Flush remainder
  const finalText = buffer + decoder.decode();
  const finalLine = finalText.trim();
  if (finalLine) {
    linesSeen += 1;
    if (jsonParse) {
      try {
        JSON.parse(finalLine);
        jsonParsed += 1;
      } catch {
        parseErrors += 1;
      }
    }
  }

  const elapsedMs = performance.now() - t0;
  const heapUsedAfter = getUsedHeapBytes();

  return {
    bytesRead,
    linesSeen,
    jsonParsed,
    parseErrors,
    elapsedMs,
    heapUsedBefore,
    heapUsedAfter,
  };
}

