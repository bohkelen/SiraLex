import "./style.css";
import { registerSW } from "virtual:pwa-register";

import { probeJsonlFile } from "./bundle_probe";

registerSW({ immediate: true });

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root");
}

app.innerHTML = `
  <div class="container">
    <div class="card">
      <h1 class="title">Nkokan (Phase 2 harness)</h1>
      <p class="subtitle">
        Web/PWA scaffolding is in place. Next: bundle loading, JS normalization parity, and minimal offline lookup UI.
      </p>
      <p class="subtitle" style="margin-top: 12px">
        See <code>docs/ROADMAP.md</code> for the Phase 2.0 ordering.
      </p>
    </div>

    <div class="card" style="margin-top: 16px">
      <h2 class="title" style="font-size: 16px; margin-bottom: 8px">Bundle size & memory sanity probe</h2>
      <p class="subtitle">
        Select the bundle JSONL files from disk and run a parse probe. This intentionally does not use IndexedDB yet.
      </p>

      <div class="row" style="margin-top: 12px">
        <div class="field">
          <div class="label">records.jsonl (enriched)</div>
          <input id="recordsFile" type="file" accept=".jsonl,.txt,application/json" />
        </div>
        <div class="field">
          <div class="label">search_index.jsonl</div>
          <input id="indexFile" type="file" accept=".jsonl,.txt,application/json" />
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <button id="probeRecords" class="btn" disabled>Probe records</button>
        <button id="probeIndex" class="btn" disabled>Probe index</button>
        <button id="probeAll" class="btn" disabled>Probe both</button>
      </div>

      <div id="probeOut" class="mono" style="margin-top: 12px"></div>
    </div>
  </div>
`;

function mustGetEl<T extends Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el as T;
}

const recordsFile = mustGetEl<HTMLInputElement>("#recordsFile");
const indexFile = mustGetEl<HTMLInputElement>("#indexFile");
const probeRecordsBtn = mustGetEl<HTMLButtonElement>("#probeRecords");
const probeIndexBtn = mustGetEl<HTMLButtonElement>("#probeIndex");
const probeAllBtn = mustGetEl<HTMLButtonElement>("#probeAll");
const probeOut = mustGetEl<HTMLDivElement>("#probeOut");

function fmtBytes(n: number | undefined): string {
  if (n === undefined) return "n/a";
  const units = ["B", "KB", "MB", "GB"];
  let x = n;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i += 1;
  }
  return `${x.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function fmtMs(ms: number): string {
  return `${ms.toFixed(0)} ms`;
}

function updateButtons() {
  const hasRecords = (recordsFile.files?.length ?? 0) > 0;
  const hasIndex = (indexFile.files?.length ?? 0) > 0;
  probeRecordsBtn.disabled = !hasRecords;
  probeIndexBtn.disabled = !hasIndex;
  probeAllBtn.disabled = !(hasRecords && hasIndex);
}

recordsFile.addEventListener("change", updateButtons);
indexFile.addEventListener("change", updateButtons);
updateButtons();

async function runProbe(label: string, file: File) {
  probeOut.textContent += `\n[${label}] ${file.name} (${fmtBytes(file.size)})\n`;
  probeOut.textContent += `Parsing JSONL (JSON.parse per line, no retention)...\n`;

  const res = await probeJsonlFile(file, { jsonParse: true });
  const heapBefore = res.heapUsedBefore;
  const heapAfter = res.heapUsedAfter;
  const heapDelta = heapBefore !== undefined && heapAfter !== undefined ? heapAfter - heapBefore : undefined;

  probeOut.textContent += `Lines: ${res.linesSeen} | Parsed: ${res.jsonParsed} | Errors: ${res.parseErrors}\n`;
  probeOut.textContent += `Elapsed: ${fmtMs(res.elapsedMs)} | Bytes read: ${fmtBytes(res.bytesRead)}\n`;
  probeOut.textContent += `Heap before: ${fmtBytes(heapBefore)} | after: ${fmtBytes(heapAfter)} | delta: ${fmtBytes(heapDelta)}\n`;
}

async function withUiLock(fn: () => Promise<void>) {
  const prev = {
    records: probeRecordsBtn.disabled,
    index: probeIndexBtn.disabled,
    all: probeAllBtn.disabled,
  };
  probeRecordsBtn.disabled = true;
  probeIndexBtn.disabled = true;
  probeAllBtn.disabled = true;
  try {
    await fn();
  } finally {
    probeRecordsBtn.disabled = prev.records;
    probeIndexBtn.disabled = prev.index;
    probeAllBtn.disabled = prev.all;
  }
}

probeRecordsBtn.addEventListener("click", () => {
  const f = recordsFile.files?.[0];
  if (!f) return;
  void withUiLock(async () => {
    probeOut.textContent = "";
    await runProbe("records", f);
  });
});

probeIndexBtn.addEventListener("click", () => {
  const f = indexFile.files?.[0];
  if (!f) return;
  void withUiLock(async () => {
    probeOut.textContent = "";
    await runProbe("search_index", f);
  });
});

probeAllBtn.addEventListener("click", () => {
  const fr = recordsFile.files?.[0];
  const fi = indexFile.files?.[0];
  if (!fr || !fi) return;
  void withUiLock(async () => {
    probeOut.textContent = "";
    await runProbe("records", fr);
    await runProbe("search_index", fi);
  });
});

