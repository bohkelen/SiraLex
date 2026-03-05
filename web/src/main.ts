import "./style.css";
import { registerSW } from "virtual:pwa-register";

import { probeJsonlFile } from "./bundle_probe";
import {
  parseAndValidateManifestJson,
  validateSelectedFilesAgainstManifest,
  type BundleManifestV1,
} from "./bundle_manifest";
import {
  deleteNkokanDb,
  getActiveBundleMeta,
  openNkokanDb,
  setActiveBundleMeta,
  storeHasData,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
} from "./idb/nkokan_db";
import { importRecordsJsonl } from "./import/import_records";
import { importSearchIndexJsonl } from "./import/import_search_index";
import { searchQuery } from "./search/search_query";
import { resolveRecords } from "./search/resolve_records";
import { renderResultsList } from "./render/render_results";
import { renderEntryDetail } from "./render/render_entry";
import type { EnrichedRecord } from "./types/records";

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
        Web/PWA scaffolding is in place. Next: bundle loading and minimal offline lookup UI.
      </p>
      <p class="subtitle" style="margin-top: 12px">
        See <code>docs/ROADMAP.md</code> for the Phase 2.0 ordering.
      </p>
    </div>

    <div class="card" style="margin-top: 16px">
      <h2 class="title" style="font-size: 16px; margin-bottom: 8px">Bundle manifest gating (Phase 2.0.3)</h2>
      <p class="subtitle">
        Select <code>bundle.manifest.json</code> and validate it before any import. This enforces ruleset/schema compatibility and REPLACE_ALL semantics.
      </p>

      <div class="row" style="margin-top: 12px">
        <div class="field">
          <div class="label">bundle.manifest.json</div>
          <input id="manifestFile" type="file" accept=".json,application/json" />
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <button id="validateManifest" class="btn" disabled>Validate manifest + selected files</button>
        <button id="importBundle" class="btn" disabled>Import bundle (records + search index)</button>
        <button id="clearDb" class="btn">Delete entire local IndexedDB database</button>
      </div>

      <div id="manifestOut" class="mono" style="margin-top: 12px"></div>
      <div id="dbOut" class="mono" style="margin-top: 12px"></div>
    </div>

    <div class="card" style="margin-top: 16px">
      <h2 class="title" style="font-size: 16px; margin-bottom: 8px">Search + Results (Phase 2.0.4)</h2>
      <p class="subtitle">
        Type a query to search the dictionary. Uses the exactness ladder: casefold → diacritics_insensitive → punct_stripped → nospace.
      </p>

      <div class="row" style="margin-top: 12px; align-items: center">
        <div class="field" style="flex: 1">
          <div class="label" id="searchLabel">Query (FR → Maninka)</div>
          <input id="searchInput" type="text" placeholder="Type a French word…" disabled autocomplete="off" />
        </div>
        <button id="langToggle" class="btn" disabled>FR → Maninka</button>
      </div>

      <div id="searchMeta" class="mono" style="margin-top: 12px"></div>
      <div id="searchResults" style="margin-top: 12px"></div>
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
const manifestFile = mustGetEl<HTMLInputElement>("#manifestFile");
const validateManifestBtn = mustGetEl<HTMLButtonElement>("#validateManifest");
const importBundleBtn = mustGetEl<HTMLButtonElement>("#importBundle");
const clearDbBtn = mustGetEl<HTMLButtonElement>("#clearDb");
const probeRecordsBtn = mustGetEl<HTMLButtonElement>("#probeRecords");
const probeIndexBtn = mustGetEl<HTMLButtonElement>("#probeIndex");
const probeAllBtn = mustGetEl<HTMLButtonElement>("#probeAll");
const probeOut = mustGetEl<HTMLDivElement>("#probeOut");
const manifestOut = mustGetEl<HTMLDivElement>("#manifestOut");
const dbOut = mustGetEl<HTMLDivElement>("#dbOut");
const searchInput = mustGetEl<HTMLInputElement>("#searchInput");
const searchLabel = mustGetEl<HTMLDivElement>("#searchLabel");
const searchMeta = mustGetEl<HTMLDivElement>("#searchMeta");
const searchResults = mustGetEl<HTMLDivElement>("#searchResults");
const langToggle = mustGetEl<HTMLButtonElement>("#langToggle");

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
  const hasManifest = (manifestFile.files?.length ?? 0) > 0;
  probeRecordsBtn.disabled = !hasRecords;
  probeIndexBtn.disabled = !hasIndex;
  probeAllBtn.disabled = !(hasRecords && hasIndex);
  validateManifestBtn.disabled = !(hasManifest && hasRecords && hasIndex);
  importBundleBtn.disabled = !lastValidatedManifest;
}

function invalidateManifestValidation() {
  lastValidatedManifest = undefined;
  manifestOut.textContent = "";
}

recordsFile.addEventListener("change", () => {
  invalidateManifestValidation();
  updateButtons();
});
indexFile.addEventListener("change", () => {
  invalidateManifestValidation();
  updateButtons();
});
manifestFile.addEventListener("change", () => {
  invalidateManifestValidation();
  updateButtons();
});
updateButtons();

async function refreshDbStatus() {
  try {
    const db = await openNkokanDb();
    const active = await getActiveBundleMeta(db);
    if (active) {
      hasActiveBundle = true;
      dbOut.textContent =
        `IndexedDB: present\nActive bundle: ${active.bundle_id}\n` +
        `Normalization: ${active.normalization_ruleset}\n` +
        `Schema: ${active.record_schema_id}@${active.record_schema_version}\n` +
        `Imported: ${active.imported_at_iso}\n` +
        `Records: ${active.records_count ?? "n/a"} | Index entries: ${active.index_entries_count ?? "n/a"}\n`;
    } else {
      hasActiveBundle = false;
      const hasRecordsData = await storeHasData(db, STORE_RECORDS);
      const hasIndexData = await storeHasData(db, STORE_SEARCH_INDEX);
      if (hasRecordsData || hasIndexData) {
        dbOut.textContent =
          `⚠ INACTIVE DATABASE — partial data from a failed or interrupted import.\n` +
          `No active bundle is committed. Search is disabled.\n` +
          `Use "Delete entire local IndexedDB database" to reset, then re-import.\n`;
      } else {
        dbOut.textContent = "IndexedDB: present\nActive bundle: none (not imported yet)\n";
      }
    }
    db.close();
  } catch (e) {
    hasActiveBundle = false;
    dbOut.textContent = `IndexedDB status error: ${String(e)}\n`;
  }
  searchInput.disabled = !hasActiveBundle;
  langToggle.disabled = !hasActiveBundle;
  if (!hasActiveBundle) {
    searchMeta.textContent = "";
    searchResults.innerHTML = "";
  }
}

let hasActiveBundle = false;

let lastValidatedManifest: BundleManifestV1 | undefined;
let busy = false;

async function withSingleWriterLock(label: string, fn: () => Promise<void>) {
  if (busy) return;
  busy = true;
  manifestOut.textContent += `\n[busy] ${label}\n`;
  // Disable all interactive buttons while running.
  const prev = {
    validate: validateManifestBtn.disabled,
    importBundle: importBundleBtn.disabled,
    clearDb: clearDbBtn.disabled,
    probeRecords: probeRecordsBtn.disabled,
    probeIndex: probeIndexBtn.disabled,
    probeAll: probeAllBtn.disabled,
  };
  validateManifestBtn.disabled = true;
  importBundleBtn.disabled = true;
  clearDbBtn.disabled = true;
  probeRecordsBtn.disabled = true;
  probeIndexBtn.disabled = true;
  probeAllBtn.disabled = true;
  try {
    await fn();
  } finally {
    busy = false;
    validateManifestBtn.disabled = prev.validate;
    importBundleBtn.disabled = prev.importBundle;
    clearDbBtn.disabled = prev.clearDb;
    probeRecordsBtn.disabled = prev.probeRecords;
    probeIndexBtn.disabled = prev.probeIndex;
    probeAllBtn.disabled = prev.probeAll;
    updateButtons();
  }
}

async function validateManifestAndFiles() {
  const mf = manifestFile.files?.[0];
  const rf = recordsFile.files?.[0];
  const ix = indexFile.files?.[0];
  if (!mf || !rf || !ix) return;

  manifestOut.textContent = "";
  lastValidatedManifest = undefined;

  const txt = await mf.text();
  const parsed = parseAndValidateManifestJson(txt);
  if (!parsed.ok || !parsed.manifest) {
    manifestOut.textContent += `Manifest INVALID\n`;
    for (const err of parsed.errors) manifestOut.textContent += `ERROR: ${err}\n`;
    for (const w of parsed.warnings) manifestOut.textContent += `WARN: ${w}\n`;
    return;
  }

  const mfst = parsed.manifest;
  const fileCheck = validateSelectedFilesAgainstManifest(mfst, {
    records: rf,
    search_index: ix,
  });
  if (fileCheck.errors.length > 0) {
    manifestOut.textContent += `Manifest OK but selected files INVALID\n`;
    manifestOut.textContent += `bundle_id: ${mfst.bundle_id}\n`;
    for (const err of fileCheck.errors) manifestOut.textContent += `ERROR: ${err}\n`;
    for (const w of [...parsed.warnings, ...fileCheck.warnings]) manifestOut.textContent += `WARN: ${w}\n`;
    return;
  }

  lastValidatedManifest = mfst;
  manifestOut.textContent += `Manifest OK\n`;
  manifestOut.textContent += `bundle_id: ${mfst.bundle_id}\n`;
  manifestOut.textContent += `normalization: ${mfst.rule_versions.normalization}\n`;
  manifestOut.textContent += `schema: ${mfst.record_schema_id}@${mfst.record_schema_version}\n`;
  manifestOut.textContent += `mode: ${mfst.update_mode} / ${mfst.reconciliation_action}\n`;
  manifestOut.textContent += `payloads: ${mfst.files.map((f) => f.path).join(", ")}\n`;
  for (const w of [...parsed.warnings, ...fileCheck.warnings]) manifestOut.textContent += `WARN: ${w}\n`;
  manifestOut.textContent += `\nNote: content_sha256 is stored from manifest but NOT verified client-side (hash verification deferred).\n`;
  manifestOut.textContent += `Manifest schema versions are hard-gated; newer manifest versions require a frontend update.\n`;
  manifestOut.textContent += `\nNext step: import streaming → IndexedDB\n`;
  updateButtons();
}

validateManifestBtn.addEventListener("click", () => {
  void withSingleWriterLock("validate manifest", validateManifestAndFiles);
});

importBundleBtn.addEventListener("click", () => {
  void withSingleWriterLock("import bundle (records + index)", async () => {
    const mfst = lastValidatedManifest;
    const rf = recordsFile.files?.[0];
    const ix = indexFile.files?.[0];
    if (!mfst || !rf || !ix) return;

    // No-op if already imported (REPLACE_ALL semantics).
    try {
      const existingDb = await openNkokanDb();
      const active = await getActiveBundleMeta(existingDb);
      existingDb.close();
      if (active?.bundle_id === mfst.bundle_id) {
        dbOut.textContent = `Bundle already imported: ${mfst.bundle_id}\n(No-op)\n`;
        return;
      }
    } catch {
      // ignore and proceed; we'll recreate DB via delete+open
    }

    // REPLACE_ALL v1 semantics for import: delete entire DB at import start.
    dbOut.textContent = "Import starting: deleting IndexedDB...\n";
    try {
      await deleteNkokanDb();
    } catch (e) {
      dbOut.textContent += `Delete failed: ${String(e)}\n`;
      dbOut.textContent += "Close other tabs using this app, then retry.\n";
      lastValidatedManifest = undefined;
      await refreshDbStatus();
      return;
    }

    const db = await openNkokanDb();
    const t0 = performance.now();
    let recordsCount = 0;
    let indexCount = 0;
    try {
      dbOut.textContent = `Deleted. Importing bundle ${mfst.bundle_id}...\n`;

      const recRes = await importRecordsJsonl(db, rf, {
        batchSize: 500,
        onProgress: (p) => {
          dbOut.textContent =
            `Importing bundle (NOT active yet)\n` +
            `bundle_id: ${mfst.bundle_id}\n` +
            `\n[records.jsonl]\n` +
            `bytes read: ${p.bytesRead}\n` +
            `lines seen: ${p.linesSeen}\n` +
            `records written: ${p.recordsWritten}\n` +
            `batches committed: ${p.batchesCommitted}\n`;
        },
      });
      recordsCount = recRes.recordsWritten;

      const idxRes = await importSearchIndexJsonl(db, ix, {
        batchSize: 500,
        onProgress: (p) => {
          dbOut.textContent =
            `Importing bundle (NOT active yet)\n` +
            `bundle_id: ${mfst.bundle_id}\n` +
            `\n[records.jsonl] written: ${recordsCount}\n` +
            `\n[search_index.jsonl]\n` +
            `bytes read: ${p.bytesRead}\n` +
            `lines seen: ${p.linesSeen}\n` +
            `entries written: ${p.entriesWritten}\n` +
            `batches committed: ${p.batchesCommitted}\n`;
        },
      });
      indexCount = idxRes.entriesWritten;

      // Commit marker: only write active bundle metadata after BOTH imports succeed.
      await setActiveBundleMeta(db, {
        bundle_id: mfst.bundle_id,
        manifest_schema_version: mfst.manifest_schema_version,
        record_schema_id: mfst.record_schema_id,
        record_schema_version: mfst.record_schema_version,
        normalization_ruleset: mfst.rule_versions.normalization,
        update_mode: mfst.update_mode,
        reconciliation_action: mfst.reconciliation_action,
        expected_content_sha256: mfst.content_sha256,
        imported_at_iso: new Date().toISOString(),
        records_count: recordsCount,
        index_entries_count: indexCount,
      });

      const elapsedMs = performance.now() - t0;
      dbOut.textContent =
        `Import COMPLETE\n` +
        `bundle_id: ${mfst.bundle_id}\n` +
        `records: ${recordsCount}\n` +
        `index entries: ${indexCount}\n` +
        `elapsed: ${elapsedMs.toFixed(0)} ms\n` +
        `\nNote: expected_content_sha256 stored from manifest; NOT verified client-side.\n`;
    } catch (e) {
      dbOut.textContent += `\nImport FAILED: ${String(e)}\n`;
      dbOut.textContent += `Database was cleared at import start (REPLACE_ALL). Please re-validate and re-import.\n`;
      dbOut.textContent += `No bundle has been marked active.\n`;
      lastValidatedManifest = undefined;
    } finally {
      db.close();
    }

    await refreshDbStatus();
  });
});

clearDbBtn.addEventListener("click", () => {
  void withSingleWriterLock("delete db", async () => {
    manifestOut.textContent = "";
    dbOut.textContent = "Deleting IndexedDB...\n";
    try {
      await deleteNkokanDb();
      dbOut.textContent += "Deleted.\n";
    } catch (e) {
      dbOut.textContent += `Delete failed: ${String(e)}\n`;
    }
    await refreshDbStatus();
  });
});

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

// --- Language toggle ---

type SearchDirection = "fr_to_mnk" | "mnk_to_fr";
let searchDirection: SearchDirection = "fr_to_mnk";

function updateLangToggle() {
  if (searchDirection === "fr_to_mnk") {
    langToggle.textContent = "FR → Maninka";
    searchLabel.textContent = "Query (FR → Maninka)";
    searchInput.placeholder = "Type a French word…";
  } else {
    langToggle.textContent = "Maninka → FR";
    searchLabel.textContent = "Query (Maninka → FR)";
    searchInput.placeholder = "Type a Maninka word…";
  }
}

langToggle.addEventListener("click", () => {
  searchDirection = searchDirection === "fr_to_mnk" ? "mnk_to_fr" : "fr_to_mnk";
  updateLangToggle();
});

// --- Search + results ---

let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let searchSeq = 0;
let lastSearchRecords: EnrichedRecord[] = [];

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  const query = searchInput.value;
  if (query.trim() === "") {
    searchSeq += 1;
    searchMeta.textContent = "";
    searchResults.innerHTML = "";
    lastSearchRecords = [];
    return;
  }
  searchDebounceTimer = setTimeout(() => {
    void runSearch(query);
  }, 150);
});

function showResultsList() {
  searchResults.innerHTML = "";
  if (lastSearchRecords.length === 0) return;

  const list = renderResultsList(lastSearchRecords, (record) => {
    showEntryDetail(record);
  });
  if (list) searchResults.appendChild(list);
}

function showEntryDetail(record: EnrichedRecord) {
  searchResults.innerHTML = "";
  const detail = renderEntryDetail(record, () => {
    showResultsList();
  });
  searchResults.appendChild(detail);
}

async function runSearch(query: string) {
  if (!hasActiveBundle) {
    searchMeta.textContent = "Search disabled: no active bundle.";
    return;
  }
  const seq = ++searchSeq;
  const t0 = performance.now();
  let db: IDBDatabase | undefined;
  try {
    db = await openNkokanDb();
    const result = await searchQuery(db, query);
    if (seq !== searchSeq) return;

    if (result.ir_ids.length === 0) {
      const elapsedMs = performance.now() - t0;
      searchMeta.textContent =
        `Query: "${query}" — No matches (all 4 levels checked). ${elapsedMs.toFixed(1)} ms`;
      searchResults.innerHTML = "";
      lastSearchRecords = [];
      return;
    }

    const records = await resolveRecords(db, result.ir_ids);
    if (seq !== searchSeq) return;
    const elapsedMs = performance.now() - t0;

    searchMeta.textContent =
      `Query: "${query}" — ${records.length} result(s) at level: ${result.matched_key_type} ` +
      `[key: "${result.matched_key}"] ${elapsedMs.toFixed(1)} ms`;

    lastSearchRecords = records;
    showResultsList();
  } catch (e) {
    if (seq !== searchSeq) return;
    searchMeta.textContent = `Search error: ${String(e)}`;
    searchResults.innerHTML = "";
    lastSearchRecords = [];
  } finally {
    db?.close();
  }
}

void refreshDbStatus();