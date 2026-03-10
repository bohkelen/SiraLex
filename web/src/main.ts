import "./style.css";
import { registerSW } from "virtual:pwa-register";

import { probeJsonlFile } from "./bundle_probe";
import {
  buildLanguageMetaFromManifest,
  getBundleDisplayName,
  getSearchDirectionText,
  getSearchPlaceholder,
  getSourceLabel,
  getTargetEntriesLabel,
  type SearchDirection,
} from "./bundle_labels";
import {
  parseAndValidateManifestJson,
  validateSelectedFilesAgainstManifest,
  type BundleManifestV1,
} from "./bundle_manifest";
import {
  clearActiveBundleId,
  deleteBundleData,
  deleteSiralexDb,
  getActiveBundleId,
  getActiveBundleMeta,
  getInstalledBundleMeta,
  listInstalledBundles,
  openSiralexDb,
  setActiveBundleId,
  setActiveBundleMeta,
  storeHasData,
  type ActiveBundleMeta,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
} from "./idb/siralex_db";
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
      <h1 class="title">SiraLex</h1>
      <p class="subtitle">Offline-first dictionary</p>
    </div>

    <div class="card" style="margin-top: 16px">
      <h2 class="title" style="font-size: 16px; margin-bottom: 8px">Dictionary</h2>
      <div id="dictStatus" class="mono"></div>
      <div class="row" style="margin-top: 12px; align-items: center">
        <div class="field" style="flex: 1">
          <div class="label">Installed dictionaries</div>
          <select id="bundleSelect" disabled>
            <option value="">No dictionaries installed</option>
          </select>
        </div>
      </div>
      <div id="firstRun" style="display: none; margin-top: 12px">
        <p style="color: var(--muted); font-size: 14px; margin: 0 0 12px 0">
          No dictionary installed.<br>
          Download a dictionary bundle and import it.
        </p>
      </div>
      <div class="row" style="margin-top: 12px">
        <button id="quickImport" class="btn">Install bundle files</button>
        <input id="quickImportFiles" type="file" multiple accept=".json,.jsonl" style="display: none" />
      </div>
      <div id="importProgress" class="mono" style="margin-top: 12px; display: none"></div>
      <div class="row" style="margin-top: 12px">
        <button id="clearDb" class="btn">Delete database</button>
      </div>
    </div>

    <div class="card" style="margin-top: 16px">
      <h2 class="title" style="font-size: 16px; margin-bottom: 8px">Search</h2>
      <p class="subtitle">
        Type a query to search the dictionary. Uses the exactness ladder: casefold → diacritics_insensitive → punct_stripped → nospace.
      </p>

      <div class="row" style="margin-top: 12px; align-items: center">
        <div class="field" style="flex: 1">
          <div class="label" id="searchLabel">Query (Source → Target)</div>
          <input id="searchInput" type="text" placeholder="Type a Source word…" disabled autocomplete="off" />
        </div>
        <button id="langToggle" class="btn" disabled>Source → Target</button>
      </div>

      <div id="searchMeta" class="mono" style="margin-top: 12px"></div>
      <div id="searchResults" style="margin-top: 12px"></div>
    </div>

    <details style="margin-top: 16px">
      <summary style="color: var(--muted); font-size: 13px; cursor: pointer; padding: 8px 0">Developer tools</summary>

      <div class="card" style="margin-top: 8px">
        <h3 class="title" style="font-size: 14px; margin-bottom: 8px">Bundle manifest gating</h3>
        <p class="subtitle">
          Select <code>bundle.manifest.json</code> and validate it before any import.
        </p>

        <div class="row" style="margin-top: 12px">
          <div class="field">
            <div class="label">bundle.manifest.json</div>
            <input id="manifestFile" type="file" accept=".json,application/json" />
          </div>
        </div>

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
          <button id="validateManifest" class="btn" disabled>Validate manifest + selected files</button>
          <button id="importBundle" class="btn" disabled>Import bundle</button>
        </div>

        <div id="manifestOut" class="mono" style="margin-top: 12px"></div>
        <div id="dbOut" class="mono" style="margin-top: 12px"></div>
      </div>

      <div class="card" style="margin-top: 8px">
        <h3 class="title" style="font-size: 14px; margin-bottom: 8px">Bundle size &amp; memory probe</h3>
        <p class="subtitle">
          Select the bundle JSONL files from disk and run a parse probe.
        </p>

        <div class="row" style="margin-top: 12px">
          <button id="probeRecords" class="btn" disabled>Probe records</button>
          <button id="probeIndex" class="btn" disabled>Probe index</button>
          <button id="probeAll" class="btn" disabled>Probe both</button>
        </div>

        <div id="probeOut" class="mono" style="margin-top: 12px"></div>
      </div>
    </details>
  </div>
`;

function mustGetEl<T extends Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el as T;
}

// Primary UI elements
const dictStatus = mustGetEl<HTMLDivElement>("#dictStatus");
const bundleSelect = mustGetEl<HTMLSelectElement>("#bundleSelect");
const firstRun = mustGetEl<HTMLDivElement>("#firstRun");
const quickImportBtn = mustGetEl<HTMLButtonElement>("#quickImport");
const quickImportFiles = mustGetEl<HTMLInputElement>("#quickImportFiles");
const importProgress = mustGetEl<HTMLDivElement>("#importProgress");
const clearDbBtn = mustGetEl<HTMLButtonElement>("#clearDb");
const searchInput = mustGetEl<HTMLInputElement>("#searchInput");
const searchLabel = mustGetEl<HTMLDivElement>("#searchLabel");
const searchMeta = mustGetEl<HTMLDivElement>("#searchMeta");
const searchResults = mustGetEl<HTMLDivElement>("#searchResults");
const langToggle = mustGetEl<HTMLButtonElement>("#langToggle");

// Developer tools elements
const recordsFile = mustGetEl<HTMLInputElement>("#recordsFile");
const indexFile = mustGetEl<HTMLInputElement>("#indexFile");
const manifestFile = mustGetEl<HTMLInputElement>("#manifestFile");
const validateManifestBtn = mustGetEl<HTMLButtonElement>("#validateManifest");
const importBundleBtn = mustGetEl<HTMLButtonElement>("#importBundle");
const probeRecordsBtn = mustGetEl<HTMLButtonElement>("#probeRecords");
const probeIndexBtn = mustGetEl<HTMLButtonElement>("#probeIndex");
const probeAllBtn = mustGetEl<HTMLButtonElement>("#probeAll");
const probeOut = mustGetEl<HTMLDivElement>("#probeOut");
const manifestOut = mustGetEl<HTMLDivElement>("#manifestOut");
const dbOut = mustGetEl<HTMLDivElement>("#dbOut");

let lastValidatedManifest: BundleManifestV1 | undefined;
let busy = false;
let installedBundles: ActiveBundleMeta[] = [];
let currentActiveBundle: ActiveBundleMeta | undefined;

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

bundleSelect.addEventListener("change", () => {
  const nextBundleId = bundleSelect.value;
  if (!nextBundleId) return;
  void withSingleWriterLock("switch active bundle", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleId(db, nextBundleId);
    } finally {
      db.close();
    }
    await refreshDbStatus();
  });
});

// --- Dictionary status ---

let hasActiveBundle = false;

function renderBundleSelectOptions(activeBundleId: string | undefined) {
  bundleSelect.innerHTML = "";
  if (installedBundles.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No dictionaries installed";
    bundleSelect.appendChild(option);
    bundleSelect.disabled = true;
    return;
  }

  for (const bundle of installedBundles) {
    const option = document.createElement("option");
    option.value = bundle.bundle_id;
    option.textContent = getBundleDisplayName(bundle.bundle_id, bundle.language_meta);
    if (bundle.bundle_id === activeBundleId) {
      option.selected = true;
    }
    bundleSelect.appendChild(option);
  }

  bundleSelect.disabled = busy;
}

async function refreshDbStatus() {
  try {
    const db = await openSiralexDb();
    const activeBundleId = await getActiveBundleId(db);
    const active = await getActiveBundleMeta(db);
    const bundles = await listInstalledBundles(db);
    installedBundles = bundles;
    currentActiveBundle = active;
    renderBundleSelectOptions(activeBundleId);
    if (active) {
      hasActiveBundle = true;
      firstRun.style.display = "none";
      const statusText =
        `Active: ${getBundleDisplayName(active.bundle_id, active.language_meta)}\n` +
        `Bundle ID: ${active.bundle_id}\n` +
        `Normalization: ${active.normalization_ruleset}\n` +
        `Schema: ${active.record_schema_id}@${active.record_schema_version}\n` +
        `Imported: ${active.imported_at_iso}\n` +
        `Records: ${active.records_count ?? "n/a"} | Index entries: ${active.index_entries_count ?? "n/a"}\n` +
        `Installed bundles: ${bundles.length}\n`;
      dictStatus.textContent = statusText;
      dbOut.textContent = statusText;
    } else {
      hasActiveBundle = false;
      const hasRecordsData = await storeHasData(db, STORE_RECORDS);
      const hasIndexData = await storeHasData(db, STORE_SEARCH_INDEX);
      if (bundles.length > 0) {
        firstRun.style.display = "none";
        importProgress.style.display = "none";
        const warnText =
          `Installed bundles present, but no active bundle is selected.\n` +
          `Choose a dictionary from the selector above to enable search.\n`;
        dictStatus.textContent = warnText;
        dbOut.textContent = warnText;
      } else if (hasRecordsData || hasIndexData) {
        firstRun.style.display = "none";
        importProgress.style.display = "none";
        const warnText =
          `Warning: partial data from a failed or interrupted import.\n` +
          `No active bundle. Search is disabled.\n` +
          `Delete the database and re-import.\n`;
        dictStatus.textContent = warnText;
        dbOut.textContent = warnText;
      } else {
        firstRun.style.display = "";
        importProgress.style.display = "none";
        dictStatus.textContent = "";
        dbOut.textContent = "No active bundle.\n";
      }
    }
    db.close();
  } catch (e) {
    hasActiveBundle = false;
    installedBundles = [];
    currentActiveBundle = undefined;
    renderBundleSelectOptions(undefined);
    firstRun.style.display = "none";
    importProgress.style.display = "none";
    dictStatus.textContent = `Database error: ${String(e)}\n`;
    dbOut.textContent = dictStatus.textContent;
  }
  searchInput.disabled = !hasActiveBundle;
  langToggle.disabled = !hasActiveBundle || busy;
  if (!hasActiveBundle) {
    searchMeta.textContent = "";
    searchResults.innerHTML = "";
  }
  updateLangToggle();
}

// --- Writer lock (prevents concurrent import/delete operations) ---

async function withSingleWriterLock(label: string, fn: () => Promise<void>) {
  if (busy) return;
  busy = true;
  const prev = {
    validate: validateManifestBtn.disabled,
    importBundle: importBundleBtn.disabled,
    clearDb: clearDbBtn.disabled,
    probeRecords: probeRecordsBtn.disabled,
    probeIndex: probeIndexBtn.disabled,
    probeAll: probeAllBtn.disabled,
    quickImport: quickImportBtn.disabled,
    bundleSelect: bundleSelect.disabled,
  };
  validateManifestBtn.disabled = true;
  importBundleBtn.disabled = true;
  clearDbBtn.disabled = true;
  probeRecordsBtn.disabled = true;
  probeIndexBtn.disabled = true;
  probeAllBtn.disabled = true;
  quickImportBtn.disabled = true;
  bundleSelect.disabled = true;
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
    quickImportBtn.disabled = prev.quickImport;
    bundleSelect.disabled = prev.bundleSelect;
    updateButtons();
    await refreshDbStatus();
  }
}

function buildInstalledBundleMeta(
  manifest: BundleManifestV1,
  recordsCount: number,
  indexCount: number,
): ActiveBundleMeta {
  return {
    bundle_id: manifest.bundle_id,
    manifest_schema_version: manifest.manifest_schema_version,
    record_schema_id: manifest.record_schema_id,
    record_schema_version: manifest.record_schema_version,
    normalization_ruleset: manifest.rule_versions.normalization,
    update_mode: manifest.update_mode,
    reconciliation_action: manifest.reconciliation_action,
    expected_content_sha256: manifest.content_sha256,
    imported_at_iso: new Date().toISOString(),
    records_count: recordsCount,
    index_entries_count: indexCount,
    language_meta: buildLanguageMetaFromManifest(manifest),
  };
}

async function installBundleIntoDb(
  db: IDBDatabase,
  manifest: BundleManifestV1,
  records: File,
  searchIndex: File,
  onUpdate: (message: string) => void,
): Promise<{ recordsCount: number; indexCount: number; elapsedMs: number }> {
  await deleteBundleData(db, manifest.bundle_id);

  const t0 = performance.now();
  let recordsCount = 0;
  let indexCount = 0;
  try {
    const recRes = await importRecordsJsonl(db, records, {
      bundleId: manifest.bundle_id,
      batchSize: 500,
      onProgress: (p) => {
        onUpdate(
          `Installing ${manifest.bundle_id}\n\n` +
            `[records.jsonl]\n` +
            `bytes read: ${p.bytesRead}\n` +
            `lines seen: ${p.linesSeen}\n` +
            `records written: ${p.recordsWritten}\n` +
            `batches committed: ${p.batchesCommitted}\n`,
        );
      },
    });
    recordsCount = recRes.recordsWritten;

    const idxRes = await importSearchIndexJsonl(db, searchIndex, {
      bundleId: manifest.bundle_id,
      batchSize: 500,
      onProgress: (p) => {
        onUpdate(
          `Installing ${manifest.bundle_id}\n\n` +
            `[records.jsonl] written: ${recordsCount}\n` +
            `\n[search_index.jsonl]\n` +
            `bytes read: ${p.bytesRead}\n` +
            `lines seen: ${p.linesSeen}\n` +
            `entries written: ${p.entriesWritten}\n` +
            `batches committed: ${p.batchesCommitted}\n`,
        );
      },
    });
    indexCount = idxRes.entriesWritten;

    await setActiveBundleMeta(db, buildInstalledBundleMeta(manifest, recordsCount, indexCount));
  } catch (e) {
    await deleteBundleData(db, manifest.bundle_id);
    throw e;
  }

  return {
    recordsCount,
    indexCount,
    elapsedMs: performance.now() - t0,
  };
}

// --- Quick import (single-action file picker) ---

quickImportBtn.addEventListener("click", () => {
  quickImportFiles.value = "";
  quickImportFiles.click();
});

quickImportFiles.addEventListener("change", () => {
  const files = quickImportFiles.files;
  if (!files || files.length === 0) return;
  void withSingleWriterLock("import bundle", () => quickImportBundle(files));
});

async function quickImportBundle(fileList: FileList) {
  let manifestFileObj: File | undefined;
  let recordsFileObj: File | undefined;
  let searchIndexFileObj: File | undefined;

  for (const file of Array.from(fileList)) {
    if (file.name === "bundle.manifest.json") manifestFileObj = file;
    else if (file.name === "records.jsonl") recordsFileObj = file;
    else if (file.name === "search_index.jsonl") searchIndexFileObj = file;
  }

  const missing: string[] = [];
  if (!manifestFileObj) missing.push("bundle.manifest.json");
  if (!recordsFileObj) missing.push("records.jsonl");
  if (!searchIndexFileObj) missing.push("search_index.jsonl");

  if (missing.length > 0) {
    importProgress.style.display = "";
    importProgress.textContent =
      `Missing required files: ${missing.join(", ")}\n\n` +
      `Select all 3 bundle files:\n  bundle.manifest.json\n  records.jsonl\n  search_index.jsonl`;
    return;
  }

  importProgress.style.display = "";
  importProgress.textContent = "Validating manifest...\n";

  const txt = await manifestFileObj!.text();
  const parsed = parseAndValidateManifestJson(txt);
  if (!parsed.ok || !parsed.manifest) {
    importProgress.textContent = "Manifest validation failed:\n";
    for (const err of parsed.errors) importProgress.textContent += `  ${err}\n`;
    return;
  }

  const mfst = parsed.manifest;

  const fileCheck = validateSelectedFilesAgainstManifest(mfst, {
    records: recordsFileObj!,
    search_index: searchIndexFileObj!,
  });
  if (fileCheck.errors.length > 0) {
    importProgress.textContent = `File validation failed for ${mfst.bundle_id}:\n`;
    for (const err of fileCheck.errors) importProgress.textContent += `  ${err}\n`;
    return;
  }

  try {
    const existingDb = await openSiralexDb();
    const installed = await getInstalledBundleMeta(existingDb, mfst.bundle_id);
    if (installed) {
      await setActiveBundleId(existingDb, mfst.bundle_id);
      existingDb.close();
      importProgress.textContent = `Bundle already installed. Marked active: ${mfst.bundle_id}\n`;
      await refreshDbStatus();
      return;
    }
    existingDb.close();
  } catch {
    // DB may not exist yet; proceed with import
  }

  firstRun.style.display = "none";
  importProgress.textContent = `Installing ${mfst.bundle_id}...\n`;

  const db = await openSiralexDb();
  try {
    const result = await installBundleIntoDb(
      db,
      mfst,
      recordsFileObj!,
      searchIndexFileObj!,
      (message) => {
        importProgress.textContent = message;
      },
    );
    importProgress.textContent =
      `Install complete: ${mfst.bundle_id}\n` +
      `${result.recordsCount} records, ${result.indexCount} index entries\n` +
      `${result.elapsedMs.toFixed(0)} ms\n`;
  } catch (e) {
    importProgress.textContent += `\nImport failed: ${String(e)}\n`;
    importProgress.textContent += `Partial bundle data removed. Re-import required.\n`;
  } finally {
    db.close();
  }
}

// --- Developer tools: manifest validation ---

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
  manifestOut.textContent += `dictionary: ${getBundleDisplayName(mfst.bundle_id, buildLanguageMetaFromManifest(mfst))}\n`;
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

// --- Developer tools: harness import ---

importBundleBtn.addEventListener("click", () => {
  void withSingleWriterLock("import bundle (records + index)", async () => {
    const mfst = lastValidatedManifest;
    const rf = recordsFile.files?.[0];
    const ix = indexFile.files?.[0];
    if (!mfst || !rf || !ix) return;

    try {
      const existingDb = await openSiralexDb();
      const installed = await getInstalledBundleMeta(existingDb, mfst.bundle_id);
      if (installed) {
        await setActiveBundleId(existingDb, mfst.bundle_id);
        existingDb.close();
        dbOut.textContent = `Bundle already installed. Marked active: ${mfst.bundle_id}\n`;
        return;
      }
      existingDb.close();
    } catch {
      // ignore and proceed; database may not exist yet
    }

    const db = await openSiralexDb();
    try {
      dbOut.textContent = `Installing bundle ${mfst.bundle_id}...\n`;
      const result = await installBundleIntoDb(db, mfst, rf, ix, (message) => {
        dbOut.textContent = message;
      });
      dbOut.textContent =
        `Install COMPLETE\n` +
        `bundle_id: ${mfst.bundle_id}\n` +
        `records: ${result.recordsCount}\n` +
        `index entries: ${result.indexCount}\n` +
        `elapsed: ${result.elapsedMs.toFixed(0)} ms\n` +
        `\nNote: expected_content_sha256 stored from manifest; NOT verified client-side.\n`;
    } catch (e) {
      dbOut.textContent += `\nImport FAILED: ${String(e)}\n`;
      dbOut.textContent += `Partial bundle data was removed. Please re-validate and re-import.\n`;
      dbOut.textContent += `No bundle has been marked active.\n`;
      lastValidatedManifest = undefined;
    } finally {
      db.close();
    }
  });
});

// --- Delete database ---

clearDbBtn.addEventListener("click", () => {
  void withSingleWriterLock("delete db", async () => {
    manifestOut.textContent = "";
    lastValidatedManifest = undefined;
    importProgress.style.display = "";
    importProgress.textContent = "Deleting database...\n";
    try {
      await deleteSiralexDb();
      importProgress.textContent = "Database deleted.\n";
    } catch (e) {
      importProgress.textContent += `Delete failed: ${String(e)}\n`;
    }
    await refreshDbStatus();
  });
});

// --- Developer tools: probe ---

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

let searchDirection: SearchDirection = "source_to_target";

function updateLangToggle() {
  const directionText = getSearchDirectionText(searchDirection, currentActiveBundle?.language_meta);
  langToggle.textContent = directionText;
  searchLabel.textContent = `Query (${directionText})`;
  searchInput.placeholder = getSearchPlaceholder(searchDirection, currentActiveBundle?.language_meta);
}

langToggle.addEventListener("click", () => {
  searchDirection = searchDirection === "source_to_target" ? "target_to_source" : "source_to_target";
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

function triggerSearch(query: string) {
  searchInput.value = query;
  searchSeq += 1;
  void runSearch(query);
}

function showEntryDetail(record: EnrichedRecord) {
  searchResults.innerHTML = "";
  const detail = renderEntryDetail(record, {
    onBack: () => showResultsList(),
    onSearch: (query) => triggerSearch(query),
    targetEntriesLabel: getTargetEntriesLabel(currentActiveBundle?.language_meta),
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
    db = await openSiralexDb();
    const activeBundleId = await getActiveBundleId(db);
    if (!activeBundleId) {
      searchMeta.textContent = "Search disabled: no active bundle.";
      searchResults.innerHTML = "";
      lastSearchRecords = [];
      return;
    }

    const result = await searchQuery(db, activeBundleId, query);
    if (seq !== searchSeq) return;

    if (result.ir_ids.length === 0) {
      const elapsedMs = performance.now() - t0;
      searchMeta.textContent =
        `Query: "${query}" — No matches (all 4 levels checked). ${elapsedMs.toFixed(1)} ms`;
      searchResults.innerHTML = "";
      lastSearchRecords = [];
      return;
    }

    const records = await resolveRecords(db, activeBundleId, result.ir_ids);
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
