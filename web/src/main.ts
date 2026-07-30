import "./style.css";
import { registerSW } from "virtual:pwa-register";
import appPackage from "../package.json";

import { probeJsonlFile } from "./bundle_probe";
import {
  buildLanguageMetaFromManifest,
  getBundleDisplayName,
  getSearchDirectionText,
  getSearchPlaceholder,
  getSourceLabel,
  getTargetLabel,
  getTargetEntriesLabel,
  type SearchDirection,
} from "./bundle_labels";
import {
  compareCatalogEntryToInstalled,
  deriveBundleAssetUrls,
  fetchBundleCatalog,
  type BundleCatalogEntryV1,
} from "./bundle_catalog";
import {
  parseAndValidateManifestJson,
  validateSelectedFilesAgainstManifest,
  type BundleManifestV1,
} from "./bundle_manifest";
import { prepareVerifiedBundlePackage } from "./import/bundle_package_integrity";
import { installVerifiedBundlePackage } from "./import/bundle_package_install";
import {
  wireManualPackageImportControls,
  type ManualPackageImportDeps,
} from "./import/manual_package_import_flow";
import {
  deleteBundleData,
  deleteSiralexDb,
  getActiveBundleId,
  getActiveBundleMeta,
  getBundleStorageScopeId,
  getCachedBundleCatalog,
  getInstalledBundleMeta,
  listInstalledBundles,
  openSiralexDb,
  recoverInterruptedBundleInstall,
  setCachedBundleCatalog,
  setActiveBundleId,
  storeHasData,
  type ActiveBundleMeta,
  type CachedBundleCatalog,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
} from "./idb/siralex_db";
import {
  installBundleIntoDb,
  installRemoteCatalogBundle,
  type InstallProgressMode,
} from "./install/bundle_install";
import {
  buildQueryLogDiagnosticsContext,
  clearQueryLogsFromUi,
  copyQueryLogDiagnosticsFromUi,
  exportQueryLogsFromUi,
  formatQueryLogStatsLine,
  getQueryLogStatsFromDb,
} from "./query_logging/query_log_controls";
import {
  getQueryLoggingConsentStatus,
  hasValidQueryLoggingConsent,
  recordQueryLoggingConsent,
} from "./query_logging/query_log_consent";
import {
  getCurrentLocale,
  type Locale,
  resolveDefaultLocale,
  setCurrentLocale,
  setCurrentLocaleWithPersistence,
  t,
} from "./i18n";
import {
  recentLogMatchedKeyDisplay,
  recentLogMatchedKeyTypeDisplay,
  recentLogResultCount,
  recentLogStatusLabel,
} from "./query_logging/query_log_inspect";
import { listRecentQueryLogs } from "./query_logging/query_log_store";
import {
  appendSearchQueryLogIfEnabled,
  getQueryLoggingEnabled,
  setQueryLoggingEnabled,
} from "./query_logging/query_log_runtime";
import type { QueryLogEvent } from "./query_logging/query_log_types";
import { searchQuery } from "./search/search_query";
import { resolveRecords } from "./search/resolve_records";
import {
  getNoResultMessage,
  renderResultsList,
  type ResultDisplayContext,
} from "./render/render_results";
import { renderEntryDetail, showTargetEntryUnavailable } from "./render/render_entry";
import { renderSavedVocabulary } from "./render/render_saved_vocabulary";
import { createReviewSurfaceHost } from "./learning/review_surface_host";
import {
  canOfferLearningSave,
  createEntryLearningSession,
  type LearningSaveControlState,
} from "./learning/entry_learning_session";
import {
  createSavedVocabularySession,
  type SavedVocabularyModel,
} from "./learning/saved_vocabulary_session";
import { openTargetLexiconEntry } from "./navigation/open_target_lexicon_entry";
import type { EnrichedRecord, TargetEntry } from "./types/records";
import { isLexiconDisplay } from "./types/records";

registerSW({ immediate: true });

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root");
}

const DEFAULT_LOCALE = resolveDefaultLocale(
  import.meta.env.VITE_DEFAULT_LOCALE,
  typeof navigator !== "undefined" ? navigator.language : undefined,
);
setCurrentLocale(DEFAULT_LOCALE);

const FEATURED_CATALOG_URL =
  import.meta.env.VITE_FEATURED_CATALOG_URL?.trim() || "/catalog.json";
const FEATURED_BUNDLE_ID = import.meta.env.VITE_FEATURED_BUNDLE_ID?.trim() || undefined;

app.innerHTML = `
  <div class="container">
    <div class="card">
      <div class="row" style="align-items: start; justify-content: space-between; gap: 12px">
        <div>
          <h1 class="title">SiraLex</h1>
          <p class="subtitle">${t("app.subtitle")}</p>
        </div>
        <div class="field locale-control">
          <div class="label">${t("locale.selectorLabel")}</div>
          <select id="localeSelect">
            <option value="fr" ${DEFAULT_LOCALE === "fr" ? "selected" : ""}>${t("locale.french")}</option>
            <option value="en" ${DEFAULT_LOCALE === "en" ? "selected" : ""}>${t("locale.english")}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 16px">
      <h2 class="title" style="font-size: 16px; margin-bottom: 8px">${t("search.title")}</h2>
      <p class="subtitle">${t("search.subtitle")}</p>
      <div id="dictStatus" class="mono"></div>
      <div id="firstRun" style="display: none; margin-top: 12px; padding: 10px; border: 1px solid var(--border); border-radius: 8px">
        <div class="label">${t("firstRun.title")}</div>
        <p class="subtitle" style="margin: 6px 0 0 0">${t("firstRun.intro")}</p>
        <div id="featuredInstallStatus" class="mono"></div>
        <div class="row" style="margin-top: 10px; gap: 8px">
          <button id="featuredInstall" class="btn">${t("firstRun.install")}</button>
          <button id="retryFeaturedInstall" class="btn" style="display: none">${t("firstRun.retryInstall")}</button>
        </div>
      </div>

      <div id="activeDictionaryRow" style="margin-top: 12px; padding: 10px; border: 1px solid var(--border); border-radius: 8px">
        <div class="row" style="align-items: center; justify-content: space-between; gap: 8px">
          <div class="mono" id="activeDictionarySummary">${t("activeDictionary.none")}</div>
          <div class="row" style="gap: 8px; flex-wrap: wrap">
            <button id="openSavedVocabulary" class="btn" type="button">${t("learning.openSaved")}</button>
            <button id="openManageDictionaries" class="btn" type="button">${t("manage.open")}</button>
          </div>
        </div>
      </div>

      <div id="searchControlsRow" class="row" style="display: none; margin-top: 12px; align-items: center">
        <div class="field" style="flex: 1">
          <div class="label" id="searchLabel">${t("search.queryLabel", { direction: `${t("language.source")} → ${t("language.target")}` })}</div>
          <input id="searchInput" type="text" placeholder="${t("search.placeholder", { language: t("language.source") })}" disabled autocomplete="off" />
        </div>
        <button id="langToggle" class="btn" disabled>${t("language.source")} → ${t("language.target")}</button>
      </div>

      <div id="searchMeta" class="mono" style="margin-top: 12px"></div>
      <div id="searchResults" style="margin-top: 12px"></div>
    </div>

    <details id="manageDictionariesPanel" style="margin-top: 16px">
      <summary style="color: var(--muted); font-size: 13px; cursor: pointer; padding: 8px 0">${t("manage.summary")}</summary>
      <div class="card" style="margin-top: 8px">
        <h2 class="title" style="font-size: 16px; margin-bottom: 8px">${t("manage.title")}</h2>
        <p class="subtitle" style="margin: 0 0 8px 0">${t("manage.surfaceHint")}</p>
        <div class="row" style="margin-top: 12px; align-items: center">
          <div class="field" style="flex: 1">
            <div class="label">${t("manage.installedLabel")}</div>
            <select id="bundleSelect" disabled>
              <option value="">${t("manage.noneInstalled")}</option>
            </select>
          </div>
        </div>
        <div id="installedBundleStatus" class="mono" style="margin-top: 12px"></div>
        <div id="installedBundleList" style="margin-top: 12px"></div>

        <div style="margin-top: 12px; padding: 10px; border: 1px solid var(--border); border-radius: 8px">
          <div class="label">${t("import.packageTitle")}</div>
          <p class="subtitle" style="margin: 6px 0 0 0">${t("import.packageChooseHint")}</p>
          <div class="row" style="margin-top: 10px; gap: 8px">
            <button id="packageImport" class="btn" type="button">${t("import.packageChooseButton")}</button>
            <input id="packageImportFile" type="file" accept=".siralex.zip,application/zip" style="display: none" />
          </div>
        </div>

        <details style="margin-top: 12px">
          <summary style="color: var(--muted); font-size: 13px; cursor: pointer">${t("advancedSetup.summary")}</summary>
          <p class="subtitle" style="margin: 8px 0 0 0">${t("advancedSetup.surfaceHint")}</p>
          <div class="row" style="margin-top: 12px; align-items: end">
            <div class="field" style="flex: 1">
              <div class="label">${t("catalog.urlLabel")}</div>
              <input id="catalogUrl" type="text" placeholder="${t("catalog.urlPlaceholder")}" autocomplete="off" />
            </div>
            <button id="loadCatalog" class="btn">${t("catalog.load")}</button>
          </div>
          <div id="catalogStatus" class="mono" style="margin-top: 12px"></div>
          <div id="catalogList" style="margin-top: 12px"></div>
          <div style="margin-top: 12px">
            <div class="label">${t("import.legacyThreeFileLabel")}</div>
            <p class="subtitle" style="margin: 4px 0 0 0">${t("import.legacyThreeFileHint")}</p>
          </div>
          <div class="row" style="margin-top: 8px">
            <button id="quickImport" class="btn">${t("import.legacyThreeFileButton")}</button>
            <input id="quickImportFiles" type="file" multiple style="display: none" />
            <button id="cancelInstall" class="btn" style="display: none">${t("import.cancel")}</button>
          </div>
        </details>

        <div id="importProgress" class="mono" style="margin-top: 12px; display: none"></div>
        <div class="row" style="margin-top: 12px">
          <button id="clearDb" class="btn">${t("db.delete")}</button>
        </div>
      </div>
    </details>

    <details style="margin-top: 16px">
      <summary style="color: var(--muted); font-size: 13px; cursor: pointer; padding: 8px 0">${t("diagnostics.summary")}</summary>
      <div class="card" style="margin-top: 8px">
        <h2 class="title" style="font-size: 16px; margin-bottom: 8px">${t("diagnostics.title")}</h2>
        <p class="subtitle" style="margin: 0 0 8px 0">${t("diagnostics.surfaceHint")}</p>
        <div class="row" style="align-items: center; justify-content: space-between; gap: 12px">
          <div>
            <div class="label">${t("logging.label")}</div>
            <div id="queryLoggingStatus" class="mono">${t("logging.off")}</div>
            <div id="queryLoggingStats" class="mono" style="margin-top: 4px">${t("logging.statsLine", { count: 0, oldest: t("logging.statsOldestNone") })}</div>
            <div id="queryLoggingConsentStatus" class="mono" style="margin-top: 4px">${t("logging.consentStatusNotRecorded")}</div>
          </div>
          <button id="queryLoggingToggle" class="btn" type="button">${t("logging.turnOn")}</button>
        </div>
        <div class="row" style="margin-top: 8px; gap: 8px">
          <button id="queryLogExport" class="btn" type="button">${t("logging.export")}</button>
          <button id="queryLogClear" class="btn" type="button">${t("logging.clear")}</button>
          <button id="queryLogCopyDiagnostics" class="btn" type="button">${t("logging.copyDiagnostics")}</button>
        </div>
        <p class="subtitle" style="margin: 8px 0 0 0">
          ${t("logging.localOnly")}
        </p>
        <div id="queryLogMessage" class="mono" style="margin-top: 8px"></div>
        <div style="margin-top: 12px">
          <div class="label">${t("logging.recentTitle")}</div>
          <p id="recentQueryLogsOffNote" class="mono" style="margin: 8px 0 0 0; display: none">${t("logging.offNote")}</p>
          <div id="recentQueryLogsActive" style="display: none; margin-top: 8px">
            <div class="row" style="margin-bottom: 8px">
              <button id="recentQueryLogsRefresh" class="btn" type="button">${t("logging.refresh")}</button>
            </div>
            <div id="recentQueryLogsTableHost"></div>
          </div>
        </div>
      </div>
    </details>

    <details style="margin-top: 16px">
      <summary style="color: var(--muted); font-size: 13px; cursor: pointer; padding: 8px 0">${t("dev.summary")}</summary>

      <div class="card" style="margin-top: 8px">
        <h3 class="title" style="font-size: 14px; margin-bottom: 8px">${t("dev.gatingTitle")}</h3>
        <p class="subtitle">
          ${t("dev.gatingSubtitle")}
        </p>

        <div class="row" style="margin-top: 12px">
          <div class="field">
            <div class="label">bundle.manifest.json</div>
            <input id="manifestFile" type="file" accept=".json,application/json" />
          </div>
        </div>

        <div class="row" style="margin-top: 12px">
          <div class="field">
            <div class="label">${t("dev.recordsLabel")}</div>
            <input id="recordsFile" type="file" />
          </div>
          <div class="field">
            <div class="label">search_index.jsonl</div>
            <input id="indexFile" type="file" />
          </div>
        </div>

        <div class="row" style="margin-top: 12px">
          <button id="validateManifest" class="btn" disabled>${t("dev.validateManifest")}</button>
          <button id="importBundle" class="btn" disabled>${t("dev.importBundle")}</button>
        </div>

        <div id="manifestOut" class="mono" style="margin-top: 12px"></div>
        <div id="dbOut" class="mono" style="margin-top: 12px"></div>
      </div>

      <div class="card" style="margin-top: 8px">
        <h3 class="title" style="font-size: 14px; margin-bottom: 8px">${t("dev.probeTitle")}</h3>
        <p class="subtitle">
          ${t("dev.probeSubtitle")}
        </p>

        <div class="row" style="margin-top: 12px">
          <button id="probeRecords" class="btn" disabled>${t("dev.probeRecords")}</button>
          <button id="probeIndex" class="btn" disabled>${t("dev.probeIndex")}</button>
          <button id="probeAll" class="btn" disabled>${t("dev.probeBoth")}</button>
        </div>

        <div id="probeOut" class="mono" style="margin-top: 12px"></div>
      </div>
    </details>
  </div>
`;

const APP_VERSION = typeof appPackage.version === "string" ? appPackage.version : "0.0.0";

function mustGetEl<T extends Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el as T;
}

// Primary UI elements
const localeSelect = mustGetEl<HTMLSelectElement>("#localeSelect");
const dictStatus = mustGetEl<HTMLDivElement>("#dictStatus");
const activeDictionarySummary = mustGetEl<HTMLDivElement>("#activeDictionarySummary");
const openSavedVocabularyBtn = mustGetEl<HTMLButtonElement>("#openSavedVocabulary");
const openManageDictionariesBtn = mustGetEl<HTMLButtonElement>("#openManageDictionaries");
const manageDictionariesPanel = mustGetEl<HTMLDetailsElement>("#manageDictionariesPanel");
const featuredInstallStatus = mustGetEl<HTMLDivElement>("#featuredInstallStatus");
const featuredInstallBtn = mustGetEl<HTMLButtonElement>("#featuredInstall");
const retryFeaturedInstallBtn = mustGetEl<HTMLButtonElement>("#retryFeaturedInstall");
const bundleSelect = mustGetEl<HTMLSelectElement>("#bundleSelect");
const installedBundleStatus = mustGetEl<HTMLDivElement>("#installedBundleStatus");
const installedBundleList = mustGetEl<HTMLDivElement>("#installedBundleList");
const catalogUrlInput = mustGetEl<HTMLInputElement>("#catalogUrl");
const loadCatalogBtn = mustGetEl<HTMLButtonElement>("#loadCatalog");
const catalogStatus = mustGetEl<HTMLDivElement>("#catalogStatus");
const catalogList = mustGetEl<HTMLDivElement>("#catalogList");
const firstRun = mustGetEl<HTMLDivElement>("#firstRun");
const quickImportBtn = mustGetEl<HTMLButtonElement>("#quickImport");
const quickImportFiles = mustGetEl<HTMLInputElement>("#quickImportFiles");
const packageImportBtn = mustGetEl<HTMLButtonElement>("#packageImport");
const packageImportFile = mustGetEl<HTMLInputElement>("#packageImportFile");
const cancelInstallBtn = mustGetEl<HTMLButtonElement>("#cancelInstall");
const importProgress = mustGetEl<HTMLDivElement>("#importProgress");
const clearDbBtn = mustGetEl<HTMLButtonElement>("#clearDb");
const searchInput = mustGetEl<HTMLInputElement>("#searchInput");
const searchLabel = mustGetEl<HTMLDivElement>("#searchLabel");
const searchMeta = mustGetEl<HTMLDivElement>("#searchMeta");
const searchResults = mustGetEl<HTMLDivElement>("#searchResults");
const searchControlsRow = mustGetEl<HTMLDivElement>("#searchControlsRow");
const langToggle = mustGetEl<HTMLButtonElement>("#langToggle");
const queryLoggingStatus = mustGetEl<HTMLDivElement>("#queryLoggingStatus");
const queryLoggingStats = mustGetEl<HTMLDivElement>("#queryLoggingStats");
const queryLoggingConsentStatus = mustGetEl<HTMLDivElement>("#queryLoggingConsentStatus");
const queryLoggingToggleBtn = mustGetEl<HTMLButtonElement>("#queryLoggingToggle");
const queryLogExportBtn = mustGetEl<HTMLButtonElement>("#queryLogExport");
const queryLogClearBtn = mustGetEl<HTMLButtonElement>("#queryLogClear");
const queryLogCopyDiagnosticsBtn = mustGetEl<HTMLButtonElement>("#queryLogCopyDiagnostics");
const queryLogMessage = mustGetEl<HTMLDivElement>("#queryLogMessage");
const recentQueryLogsOffNote = mustGetEl<HTMLParagraphElement>("#recentQueryLogsOffNote");
const recentQueryLogsActive = mustGetEl<HTMLDivElement>("#recentQueryLogsActive");
const recentQueryLogsRefreshBtn = mustGetEl<HTMLButtonElement>("#recentQueryLogsRefresh");
const recentQueryLogsTableHost = mustGetEl<HTMLDivElement>("#recentQueryLogsTableHost");

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
let catalogLoading = false;
let loadedCatalogBundles: BundleCatalogEntryV1[] = [];
let loadedCatalogUrl: string | undefined;
let loadedCatalogWarnings: string[] = [];
let loadedCatalogFetchedAtIso: string | undefined;
let loadedCatalogSource: "network" | "cache" | undefined;
let remoteInstallAbortController: AbortController | undefined;
let remoteInstallBundleId: string | undefined;
let currentStorageEstimate: { usage?: number; quota?: number } | undefined;
let featuredInstallInProgress = false;
let packageImportInProgress = false;

function formatErrorDetails(e: unknown): string {
  const details = [`String(e): ${String(e)}`];
  if (e && typeof e === "object") {
    const maybeError = e as {
      name?: unknown;
      message?: unknown;
      stack?: unknown;
    };
    details.push(`e.name: ${String(maybeError.name ?? "")}`);
    details.push(`e.message: ${String(maybeError.message ?? "")}`);
    if (maybeError.stack !== undefined) {
      details.push(`e.stack:\n${String(maybeError.stack)}`);
    }
  }
  return details.join("\n");
}

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

function getManifestPayloadBytes(manifest: BundleManifestV1): number | undefined {
  const total = manifest.files.reduce((sum, file) => sum + file.byte_length, 0);
  return total > 0 ? total : undefined;
}

function getInstalledBundleName(bundle: ActiveBundleMeta): string {
  if (bundle.language_meta) {
    return getLocalizedBundleDisplayName(bundle.bundle_id, bundle.language_meta);
  }
  return bundle.display_name ?? getLocalizedBundleDisplayName(bundle.bundle_id, bundle.language_meta);
}

function getLocalizedBundleDisplayName(
  bundleId: string,
  meta?: ActiveBundleMeta["language_meta"],
): string {
  return getBundleDisplayName(
    bundleId,
    meta,
    t("language.source"),
    t("language.target"),
    getCurrentLocale(),
  );
}

function formatInstalledAt(iso: string | undefined): string {
  return iso?.trim() ? iso : "n/a";
}

function getKnownBundlePayloadBytes(bundles: ActiveBundleMeta[]): number | undefined {
  const known = bundles
    .map((bundle) => bundle.storage_bytes)
    .filter((value): value is number => typeof value === "number" && value >= 0);
  if (known.length === 0) return undefined;
  return known.reduce((sum, value) => sum + value, 0);
}

function getLoadedCatalogEntry(bundleId: string): BundleCatalogEntryV1 | undefined {
  return loadedCatalogBundles.find((entry) => entry.bundle_id === bundleId);
}

function getLocalizedSourceLabel(meta?: ActiveBundleMeta["language_meta"]): string {
  return getSourceLabel(meta, t("language.source"), getCurrentLocale());
}

function getLocalizedTargetLabel(meta?: ActiveBundleMeta["language_meta"]): string {
  return getTargetLabel(meta, t("language.target"), getCurrentLocale());
}

function getCatalogEntryRuntimeState(entry: BundleCatalogEntryV1): {
  installed?: ActiveBundleMeta;
  isActive: boolean;
  comparison: ReturnType<typeof compareCatalogEntryToInstalled>;
  activateOnCommit: boolean;
} {
  const installed = installedBundles.find((bundle) => bundle.bundle_id === entry.bundle_id);
  const isActive = currentActiveBundle?.bundle_id === entry.bundle_id;
  return {
    installed,
    isActive,
    comparison: compareCatalogEntryToInstalled(entry, installed),
    activateOnCommit: !installed || isActive,
  };
}

function renderInstalledBundleManager() {
  installedBundleList.innerHTML = "";

  const knownPayloadBytes = getKnownBundlePayloadBytes(installedBundles);
  const unknownSizeCount = installedBundles.filter((bundle) => bundle.storage_bytes === undefined).length;
  const statusLines = [
    t("manage.status.installedBundles", { count: installedBundles.length }),
    t("manage.status.activeBundle", {
      name: currentActiveBundle ? getInstalledBundleName(currentActiveBundle) : "none",
    }),
    t("manage.status.knownPayloadTotal", { value: fmtBytes(knownPayloadBytes) }),
    t("manage.status.browserStorageUsage", {
      usage: fmtBytes(currentStorageEstimate?.usage),
      quota: fmtBytes(currentStorageEstimate?.quota),
    }),
  ];
  if (unknownSizeCount > 0) {
    statusLines.push(t("manage.status.sizeMetadataMissing", { count: unknownSizeCount }));
  }
  installedBundleStatus.textContent = statusLines.join("\n");

  if (installedBundles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "catalog-empty";
    empty.textContent = t("manage.noInstalledMetadata");
    installedBundleList.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "catalog-list";

  for (const bundle of installedBundles) {
    const item = document.createElement("article");
    item.className = "catalog-item";

    const header = document.createElement("div");
    header.className = "catalog-item-header";

    const titleBlock = document.createElement("div");
    const title = document.createElement("div");
    title.className = "catalog-item-title";
    title.textContent = getInstalledBundleName(bundle);
    const bundleId = document.createElement("div");
    bundleId.className = "catalog-item-subtitle";
    bundleId.textContent = bundle.bundle_id;
    titleBlock.append(title, bundleId);

    const isActive = currentActiveBundle?.bundle_id === bundle.bundle_id;
    const catalogEntry = getLoadedCatalogEntry(bundle.bundle_id);
    const catalogState = catalogEntry ? getCatalogEntryRuntimeState(catalogEntry) : undefined;
    const updateAvailable = catalogState?.comparison.state === "update_available";
    const badges = document.createElement("div");
    badges.className = "row";
    if (isActive) {
      const activeBadge = document.createElement("span");
      activeBadge.className = "catalog-badge catalog-badge-active";
      activeBadge.textContent = t("catalog.badge.active");
      badges.appendChild(activeBadge);
    }
    if (updateAvailable) {
      const updateBadge = document.createElement("span");
      updateBadge.className = "catalog-badge catalog-badge-update";
      updateBadge.textContent = t("catalog.badge.updateAvailable");
      badges.appendChild(updateBadge);
    } else if (!isActive) {
      const installedBadge = document.createElement("span");
      installedBadge.className = "catalog-badge catalog-badge-installed";
      installedBadge.textContent = t("catalog.badge.installed");
      badges.appendChild(installedBadge);
    }
    header.append(titleBlock, badges);

    const meta = document.createElement("div");
    meta.className = "catalog-item-meta";
    const labels = `${getLocalizedSourceLabel(bundle.language_meta)} → ${getLocalizedTargetLabel(bundle.language_meta)}`;
    const metaParts = [
      bundle.version ? t("catalog.meta.version", { value: bundle.version }) : undefined,
      labels,
      t("catalog.meta.records", { count: bundle.records_count ?? "n/a" }),
      t("catalog.meta.indexEntries", { count: bundle.index_entries_count ?? "n/a" }),
      fmtBytes(bundle.storage_bytes),
    ].filter((part): part is string => part !== undefined);
    meta.textContent = metaParts.join(" | ");

    const note = document.createElement("div");
    note.className = "catalog-item-note";
    note.textContent =
      `${t("catalog.note.installed", { value: formatInstalledAt(bundle.imported_at_iso) })}\n` +
      `${t("catalog.note.storageScope", { value: getBundleStorageScopeId(bundle) })}\n` +
      t("catalog.note.normalizationSchema", {
        normalization: bundle.normalization_ruleset,
        schema: `${bundle.record_schema_id}@${bundle.record_schema_version}`,
      });
    if (updateAvailable && catalogEntry) {
      note.textContent +=
        `\n${t("catalog.note.installedHash", { value: bundle.expected_content_sha256 ?? "unknown" })}` +
        `\n${t("catalog.note.catalogHash", { value: catalogEntry.content_sha256 })}`;
    }

    const actions = document.createElement("div");
    actions.className = "row";

    if (updateAvailable && catalogEntry) {
      const updateBtn = document.createElement("button");
      updateBtn.className = "btn";
      updateBtn.textContent = t("catalog.action.update");
      updateBtn.disabled = busy || !loadedCatalogUrl;
      updateBtn.addEventListener("click", () => {
        void withSingleWriterLock(`update bundle ${bundle.bundle_id}`, async () => {
          await installCatalogEntry(catalogEntry, catalogState?.activateOnCommit ?? isActive);
        });
      });
      actions.appendChild(updateBtn);
    }

    const useBtn = document.createElement("button");
    useBtn.className = "btn";
    useBtn.textContent = isActive ? t("catalog.badge.active") : t("catalog.action.use");
    useBtn.disabled = busy || isActive;
    useBtn.addEventListener("click", () => {
      void withSingleWriterLock(`switch active bundle ${bundle.bundle_id}`, async () => {
        const db = await openSiralexDb();
        try {
          await setActiveBundleId(db, bundle.bundle_id);
        } finally {
          db.close();
        }
        importProgress.style.display = "";
        importProgress.textContent = t("bundle.activeSet", { bundleId: bundle.bundle_id });
      });
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn";
    removeBtn.textContent = t("catalog.action.remove");
    removeBtn.disabled = busy;
    removeBtn.addEventListener("click", () => {
      const confirmed =
        typeof window === "undefined" ||
        window.confirm(t("bundle.removeConfirm", { bundleId: bundle.bundle_id }));
      if (!confirmed) return;
      void withSingleWriterLock(`remove bundle ${bundle.bundle_id}`, async () => {
        const db = await openSiralexDb();
        try {
          await deleteBundleData(db, bundle.bundle_id);
        } finally {
          db.close();
        }
        importProgress.style.display = "";
        importProgress.textContent = t("bundle.removed", { bundleId: bundle.bundle_id });
      });
    });

    actions.append(useBtn, removeBtn);
    item.append(header, meta, note, actions);
    list.appendChild(item);
  }

  installedBundleList.appendChild(list);
}

function updatePackageImportControls() {
  packageImportBtn.disabled = busy || packageImportInProgress;
  packageImportFile.disabled = busy || packageImportInProgress;
}

function buildManualPackageImportDeps(): ManualPackageImportDeps {
  return {
    prepareVerifiedBundlePackage,
    installVerifiedBundlePackage,
    withSingleWriterLock,
    messages: {
      preparing: t("import.packagePreparing"),
      verifying: t("import.packageVerifying"),
      installing: t("import.packageInstalling"),
      installed: t("import.packageInstalled"),
      tooManyFiles: t("import.packageTooManyFiles"),
      invalidStructure: t("import.packageErrorInvalidStructure"),
      invalidManifest: t("import.packageErrorInvalidManifest"),
      verificationFailed: t("import.packageErrorVerificationFailed"),
      contentsMismatch: t("import.packageErrorContentsMismatch"),
      installationFailed: t("import.packageErrorInstallationFailed"),
      partialRemovedReimport: t("import.partialRemovedReimport"),
      writerBusy: t("import.packageWriterBusy"),
    },
    formatErrorDetails,
    setImportProgress: (visible, text) => {
      importProgress.style.display = visible ? "" : "none";
      importProgress.textContent = text;
    },
    appendImportProgress: (text) => {
      importProgress.textContent += text;
    },
    setDbOutDiagnostic: (text) => {
      dbOut.textContent = text;
    },
    hideFirstRun: () => {
      firstRun.style.display = "none";
    },
    clearPackageInput: () => {
      packageImportFile.value = "";
    },
    setPackageControlsEnabled: (enabled) => {
      if (!enabled) {
        packageImportBtn.disabled = true;
        packageImportFile.disabled = true;
        return;
      }
      updatePackageImportControls();
    },
    getPackageImportInProgress: () => packageImportInProgress,
    setPackageImportInProgress: (value) => {
      packageImportInProgress = value;
      updatePackageImportControls();
    },
    getBusy: () => busy,
  };
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

function updateCatalogControls() {
  catalogUrlInput.disabled = busy || catalogLoading;
  loadCatalogBtn.disabled = busy || catalogLoading || catalogUrlInput.value.trim() === "";
}

function updateInstallControls() {
  const installInProgress = remoteInstallAbortController !== undefined;
  cancelInstallBtn.style.display = installInProgress ? "" : "none";
  cancelInstallBtn.disabled = !installInProgress;
}

function updateFeaturedInstallControls() {
  const disabled = busy || featuredInstallInProgress;
  featuredInstallBtn.disabled = disabled;
  retryFeaturedInstallBtn.disabled = disabled;
}

function buildCachedCatalogSnapshot(
  requestUrl: string,
  responseUrl: string,
  warnings: string[],
  bundles: BundleCatalogEntryV1[],
): CachedBundleCatalog {
  return {
    request_url: requestUrl,
    response_url: responseUrl,
    fetched_at_iso: new Date().toISOString(),
    warnings,
    catalog: {
      catalog_schema_version: "bundle_catalog_v1",
      bundles: bundles.map((bundle) => ({
        bundle_id: bundle.bundle_id,
        name: bundle.name,
        version: bundle.version,
        size_bytes: bundle.size_bytes,
        url_base: bundle.url_base,
        content_sha256: bundle.content_sha256,
        language_meta: bundle.language_meta,
      })),
    },
  };
}

function applyCachedCatalog(cached: CachedBundleCatalog, source: "network" | "cache") {
  loadedCatalogBundles = cached.catalog.bundles;
  loadedCatalogUrl = cached.response_url;
  loadedCatalogWarnings = cached.warnings;
  loadedCatalogFetchedAtIso = cached.fetched_at_iso;
  loadedCatalogSource = source;
  catalogUrlInput.value = cached.request_url;
  updateCatalogControls();
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
updateCatalogControls();
updateInstallControls();
updateFeaturedInstallControls();

localeSelect.addEventListener("change", () => {
  const nextLocale = localeSelect.value;
  if (nextLocale !== "fr" && nextLocale !== "en") return;
  if (nextLocale === getCurrentLocale()) return;
  setCurrentLocaleWithPersistence(nextLocale as Locale);
  if (typeof window !== "undefined") {
    window.location.reload();
  }
});

openManageDictionariesBtn.addEventListener("click", () => {
  manageDictionariesPanel.open = true;
  manageDictionariesPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

openSavedVocabularyBtn.addEventListener("click", () => {
  showSavedVocabulary();
});

catalogUrlInput.addEventListener("input", () => {
  updateCatalogControls();
});

cancelInstallBtn.addEventListener("click", () => {
  remoteInstallAbortController?.abort(new Error(`Install cancelled by user for ${remoteInstallBundleId ?? "bundle"}`));
});

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

function getCatalogPresentationState(entry: BundleCatalogEntryV1): {
  badgeClass: string;
  badgeLabel: string;
  note?: string;
} {
  const { comparison, isActive } = getCatalogEntryRuntimeState(entry);

  if (comparison.state === "update_available") {
    return {
      badgeClass: "catalog-badge-update",
      badgeLabel: t("catalog.badge.updateAvailable"),
      note: isActive
        ? t("catalog.note.activeInstalledVersion")
        : t("catalog.note.installedVersionDiffers"),
    };
  }

  if (comparison.state === "installed_current") {
    return {
      badgeClass: isActive ? "catalog-badge-active" : "catalog-badge-installed",
      badgeLabel: isActive ? t("catalog.badge.active") : t("catalog.badge.installed"),
      note: entry.version ? t("catalog.note.catalogVersion", { value: entry.version }) : undefined,
    };
  }

  return {
    badgeClass: "catalog-badge-available",
    badgeLabel: t("catalog.badge.available"),
  };
}

function getCatalogActionLabel(entry: BundleCatalogEntryV1): string {
  const { comparison, isActive } = getCatalogEntryRuntimeState(entry);
  if (isActive && comparison.state === "installed_current") {
    return t("catalog.badge.active");
  }
  if (comparison.state === "update_available") return t("catalog.action.update");
  if (comparison.state === "installed_current") return t("catalog.action.useInstalled");
  return t("catalog.action.install");
}

function renderCatalogList() {
  catalogList.innerHTML = "";

  if (loadedCatalogBundles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "catalog-empty";
    empty.textContent = t("catalog.empty");
    catalogList.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "catalog-list";

  for (const entry of loadedCatalogBundles) {
    const item = document.createElement("article");
    item.className = "catalog-item";

    const header = document.createElement("div");
    header.className = "catalog-item-header";

    const titleBlock = document.createElement("div");
    const title = document.createElement("div");
    title.className = "catalog-item-title";
    title.textContent = entry.language_meta
      ? getLocalizedBundleDisplayName(entry.bundle_id, entry.language_meta)
      : entry.name;
    const bundleId = document.createElement("div");
    bundleId.className = "catalog-item-subtitle";
    bundleId.textContent = entry.bundle_id;
    titleBlock.append(title, bundleId);

    const presentation = getCatalogPresentationState(entry);
    const badge = document.createElement("span");
    badge.className = `catalog-badge ${presentation.badgeClass}`;
    badge.textContent = presentation.badgeLabel;
    header.append(titleBlock, badge);

    const meta = document.createElement("div");
    meta.className = "catalog-item-meta";
    const metaParts = [
      entry.version ? t("catalog.meta.version", { value: entry.version }) : undefined,
      fmtBytes(entry.size_bytes),
      t("catalog.meta.hash", { value: entry.content_sha256 }),
    ].filter((part): part is string => part !== undefined);
    meta.textContent = metaParts.join(" | ");

    const source = document.createElement("div");
    source.className = "catalog-item-subtitle";
    if (loadedCatalogUrl) {
      const urls = deriveBundleAssetUrls(loadedCatalogUrl, entry);
      source.textContent = t("catalog.meta.bundleSource", { value: urls.base_url });
      const files = document.createElement("div");
      files.className = "catalog-item-subtitle";
      files.textContent =
        `${t("catalog.meta.manifest", { value: urls.manifest_url })}\n` +
        `${t("catalog.meta.recordsFile", { value: urls.records_url })}\n` +
        t("catalog.meta.indexFile", { value: urls.search_index_url });
      item.append(header, meta, source, files);
    } else {
      source.textContent = t("catalog.meta.sourceBase", { value: entry.url_base });
      item.append(header, meta, source);
    }

    if (presentation.note) {
      const note = document.createElement("div");
      note.className = "catalog-item-note";
      note.textContent = presentation.note;
      item.append(note);
    }

    const actions = document.createElement("div");
    actions.className = "row";
    const actionBtn = document.createElement("button");
    actionBtn.className = "btn";
    actionBtn.textContent = getCatalogActionLabel(entry);
    actionBtn.disabled = busy || !loadedCatalogUrl || actionBtn.textContent === t("catalog.badge.active");
    actionBtn.addEventListener("click", () => {
      const { activateOnCommit } = getCatalogEntryRuntimeState(entry);
      void withSingleWriterLock(`install catalog bundle ${entry.bundle_id}`, async () => {
        await installCatalogEntry(entry, activateOnCommit);
      });
    });
    actions.appendChild(actionBtn);
    item.append(actions);
    list.appendChild(item);
  }

  catalogList.appendChild(list);
}

function renderBundleSelectOptions(activeBundleId: string | undefined) {
  bundleSelect.innerHTML = "";
  if (installedBundles.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("manage.noneInstalled");
    bundleSelect.appendChild(option);
    bundleSelect.disabled = true;
    return;
  }

  for (const bundle of installedBundles) {
    const option = document.createElement("option");
    option.value = bundle.bundle_id;
    option.textContent = getInstalledBundleName(bundle);
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
    try {
      const activeBundleId = await getActiveBundleId(db);
      const active = await getActiveBundleMeta(db);
      const bundles = await listInstalledBundles(db);
      currentStorageEstimate =
        typeof navigator !== "undefined" && navigator.storage?.estimate
          ? await navigator.storage.estimate()
          : undefined;
      installedBundles = bundles;
      currentActiveBundle = active;
      const nextBundleId = active?.bundle_id;
      if (lastKnownActiveBundleId !== nextBundleId) {
        lastKnownActiveBundleId = nextBundleId;
        if (
          resultsHostContext === "review" ||
          resultsHostContext === "saved_vocabulary" ||
          resultsHostContext === "entry_from_saved"
        ) {
          invalidateCollectionAndReviewContexts();
          resultsHostContext = "search";
          searchResults.innerHTML = "";
        } else {
          invalidateCollectionAndReviewContexts();
        }
      }
      renderBundleSelectOptions(activeBundleId);
      renderInstalledBundleManager();
      if (active) {
        hasActiveBundle = true;
        firstRun.style.display = "none";
        retryFeaturedInstallBtn.style.display = "none";
        featuredInstallStatus.textContent = "";
        activeDictionarySummary.textContent = t("activeDictionary.usingReady", {
          name: getInstalledBundleName(active),
        });
        const statusText =
          `Active: ${getInstalledBundleName(active)}\n` +
          `Bundle ID: ${active.bundle_id}\n` +
          `Storage scope: ${getBundleStorageScopeId(active)}\n` +
          `Normalization: ${active.normalization_ruleset}\n` +
          `Schema: ${active.record_schema_id}@${active.record_schema_version}\n` +
          `Imported: ${active.imported_at_iso}\n` +
          `Records: ${active.records_count ?? "n/a"} | Index entries: ${active.index_entries_count ?? "n/a"}\n` +
          `Approx payload: ${fmtBytes(active.storage_bytes)}\n`;
        dictStatus.textContent = t("status.dictionaryReady");
        dbOut.textContent = statusText;
      } else {
        hasActiveBundle = false;
        activeDictionarySummary.textContent = t("activeDictionary.none");
        const hasRecordsData = await storeHasData(db, STORE_RECORDS);
        const hasIndexData = await storeHasData(db, STORE_SEARCH_INDEX);
        if (bundles.length > 0) {
          firstRun.style.display = "none";
          importProgress.style.display = "none";
          const warnText = t("status.noActiveSelection");
          dictStatus.textContent = warnText;
          dbOut.textContent = warnText;
        } else if (hasRecordsData || hasIndexData) {
          firstRun.style.display = "none";
          importProgress.style.display = "none";
          const warnText = t("status.partialDataWarning");
          dictStatus.textContent = warnText;
          dbOut.textContent = warnText;
        } else {
          firstRun.style.display = "";
          importProgress.style.display = "none";
          if (!navigator.onLine) {
            featuredInstallStatus.textContent =
              t("firstRun.offlineNoDictionary");
            retryFeaturedInstallBtn.style.display = "";
          } else {
            featuredInstallStatus.textContent =
              t("firstRun.onlinePrompt");
            retryFeaturedInstallBtn.style.display = "none";
          }
          dictStatus.textContent = t("status.noActiveDictionaryInstalled");
          dbOut.textContent = t("status.noActiveBundle");
        }
      }
    } finally {
      db.close();
    }
  } catch (e) {
    hasActiveBundle = false;
    installedBundles = [];
    currentActiveBundle = undefined;
    currentStorageEstimate = undefined;
    renderBundleSelectOptions(undefined);
    renderInstalledBundleManager();
    firstRun.style.display = "none";
    importProgress.style.display = "none";
    dictStatus.textContent = t("status.dbError", { error: String(e) });
    dbOut.textContent = dictStatus.textContent;
  }
  renderCatalogList();
  searchControlsRow.style.display = hasActiveBundle ? "" : "none";
  searchInput.disabled = !hasActiveBundle || busy;
  langToggle.disabled = !hasActiveBundle || busy;
  updateFeaturedInstallControls();
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
  clearTimeout(searchDebounceTimer);
  searchSeq += 1;
  const prev = {
    validate: validateManifestBtn.disabled,
    importBundle: importBundleBtn.disabled,
    clearDb: clearDbBtn.disabled,
    probeRecords: probeRecordsBtn.disabled,
    probeIndex: probeIndexBtn.disabled,
    probeAll: probeAllBtn.disabled,
    quickImport: quickImportBtn.disabled,
    packageImport: packageImportBtn.disabled,
    bundleSelect: bundleSelect.disabled,
    loadCatalog: loadCatalogBtn.disabled,
    catalogUrl: catalogUrlInput.disabled,
  };
  validateManifestBtn.disabled = true;
  importBundleBtn.disabled = true;
  clearDbBtn.disabled = true;
  probeRecordsBtn.disabled = true;
  probeIndexBtn.disabled = true;
  probeAllBtn.disabled = true;
  quickImportBtn.disabled = true;
  packageImportBtn.disabled = true;
  packageImportFile.disabled = true;
  bundleSelect.disabled = true;
  loadCatalogBtn.disabled = true;
  catalogUrlInput.disabled = true;
  searchInput.disabled = true;
  langToggle.disabled = true;
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
    packageImportBtn.disabled = prev.packageImport;
    packageImportFile.disabled = prev.packageImport || packageImportInProgress;
    bundleSelect.disabled = prev.bundleSelect;
    loadCatalogBtn.disabled = prev.loadCatalog;
    catalogUrlInput.disabled = prev.catalogUrl;
    updateButtons();
    updateCatalogControls();
    updatePackageImportControls();
    await refreshDbStatus();
  }
}

// --- Package import (single .siralex.zip) ---

wireManualPackageImportControls({
  button: packageImportBtn,
  input: packageImportFile,
  buildDeps: buildManualPackageImportDeps,
});

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
      t("import.missingRequiredFiles", { files: missing.join(", ") }) +
      t("import.selectAllThreeFiles");
    return;
  }

  importProgress.style.display = "";
  importProgress.textContent = t("import.validatingManifest");

  const txt = await manifestFileObj!.text();
  const parsed = parseAndValidateManifestJson(txt);
  if (!parsed.ok || !parsed.manifest) {
    importProgress.textContent = t("import.manifestValidationFailed");
    for (const err of parsed.errors) importProgress.textContent += `  ${err}\n`;
    return;
  }

  const mfst = parsed.manifest;

  const fileCheck = validateSelectedFilesAgainstManifest(mfst, {
    records: recordsFileObj!,
    search_index: searchIndexFileObj!,
  });
  if (fileCheck.errors.length > 0) {
    importProgress.textContent = t("import.fileValidationFailedFor", { bundleId: mfst.bundle_id });
    for (const err of fileCheck.errors) importProgress.textContent += `  ${err}\n`;
    return;
  }

  let activateOnCommit = true;
  try {
    const existingDb = await openSiralexDb();
    const installed = await getInstalledBundleMeta(existingDb, mfst.bundle_id);
    const activeBundleId = await getActiveBundleId(existingDb);
    if (installed) {
      if (installed.expected_content_sha256 === mfst.content_sha256) {
        await setActiveBundleId(existingDb, mfst.bundle_id);
        existingDb.close();
        importProgress.textContent = t("import.bundleAlreadyInstalledMarkedActive", {
          bundleId: mfst.bundle_id,
        });
        await refreshDbStatus();
        return;
      }
      activateOnCommit = activeBundleId === mfst.bundle_id;
      importProgress.textContent =
        t("import.updatingBundle", { bundleId: mfst.bundle_id }) +
        t("import.existingHash", { hash: installed.expected_content_sha256 ?? "unknown" }) +
        t("import.newHash", { hash: mfst.content_sha256 }) +
        (activateOnCommit
          ? t("import.updatedBundleRemainActive")
          : t("import.currentActiveRemainUnchanged"));
    }
    existingDb.close();
  } catch {
    // DB may not exist yet; proceed with import
  }

  firstRun.style.display = "none";
  importProgress.textContent = t("import.installingBundle", { bundleId: mfst.bundle_id });

  const db = await openSiralexDb();
  try {
    const result = await installBundleIntoDb(
      db,
      mfst,
      {
        recordsSource: recordsFileObj!,
        searchIndexSource: searchIndexFileObj!,
      },
      (message) => {
        importProgress.textContent = message;
      },
      undefined,
      {
        displayName: getBundleDisplayName(
          mfst.bundle_id,
          buildLanguageMetaFromManifest(mfst),
          t("language.source"),
          t("language.target"),
          getCurrentLocale(),
        ),
        storageBytes: getManifestPayloadBytes(mfst),
      },
      activateOnCommit,
    );
    importProgress.textContent =
      t("import.installComplete", {
        bundleId: mfst.bundle_id,
        records: result.recordsCount,
        indexEntries: result.indexCount,
        elapsed: result.elapsedMs.toFixed(0),
      });
    if (result.cleanupWarning) {
      importProgress.textContent += `\n${result.cleanupWarning}\n`;
    }
  } catch (e) {
    importProgress.textContent += t("import.importFailed", { error: String(e) });
    importProgress.textContent += t("import.partialRemovedReimport");
  } finally {
    db.close();
  }
}

// --- Catalog loading (Phase 4.1) ---

async function loadCatalogFromUrl(
  catalogUrlOverride?: string,
  statusTarget: HTMLDivElement = catalogStatus,
  opts: { updateCatalogInput?: boolean } = {},
) {
  const catalogUrl = (catalogUrlOverride ?? catalogUrlInput.value).trim();
  if (catalogUrl === "") return;

  catalogLoading = true;
  updateCatalogControls();
  statusTarget.textContent = t("catalog.loading", { url: catalogUrl });

  try {
    const result = await fetchBundleCatalog(catalogUrl, {
      baseUrl: window.location.href,
    });
    const cached = buildCachedCatalogSnapshot(
      result.requestUrl,
      result.responseUrl,
      result.warnings,
      result.catalog.bundles,
    );
    const db = await openSiralexDb();
    try {
      await setCachedBundleCatalog(db, cached);
    } finally {
      db.close();
    }
    applyCachedCatalog(cached, "network");
    if (opts.updateCatalogInput !== false) {
      catalogUrlInput.value = catalogUrl;
    }
    statusTarget.textContent = t("catalog.loaded", {
      source: result.responseUrl,
      count: result.catalog.bundles.length,
      fetchedAt: cached.fetched_at_iso,
    });
    for (const warning of result.warnings) {
      statusTarget.textContent += t("catalog.warnPrefix", { warning });
    }
    return result.catalog.bundles;
  } catch (e) {
    statusTarget.textContent = t("catalog.loadFailed", { error: String(e) });
    if (loadedCatalogBundles.length > 0 && loadedCatalogUrl && loadedCatalogFetchedAtIso) {
      statusTarget.textContent += t("catalog.showingCachedFrom", {
        url: loadedCatalogUrl,
        fetchedAt: loadedCatalogFetchedAtIso,
      });
    }
    throw e;
  } finally {
    catalogLoading = false;
    updateCatalogControls();
    renderCatalogList();
  }
}

function getFeaturedCatalogEntry(): BundleCatalogEntryV1 | undefined {
  if (FEATURED_BUNDLE_ID) {
    return loadedCatalogBundles.find((entry) => entry.bundle_id === FEATURED_BUNDLE_ID);
  }
  return loadedCatalogBundles[0];
}

async function installFeaturedDictionary() {
  if (busy || featuredInstallInProgress) return;
  featuredInstallInProgress = true;
  updateFeaturedInstallControls();
  retryFeaturedInstallBtn.style.display = "none";
  featuredInstallStatus.textContent = t("featured.installStarted");

  try {
    if (!navigator.onLine && installedBundles.length === 0) {
      featuredInstallStatus.textContent = t("firstRun.offlineNoDictionary");
      retryFeaturedInstallBtn.style.display = "";
      return;
    }

    featuredInstallStatus.textContent += t("featured.downloading");
    await withSingleWriterLock("install featured dictionary", async () => {
      await loadCatalogFromUrl(FEATURED_CATALOG_URL, featuredInstallStatus, { updateCatalogInput: false });
      const entry = getFeaturedCatalogEntry();
      if (!entry) {
        throw new Error(t("featured.noEntryFound"));
      }
      const installResult = await installCatalogEntry(entry, true, featuredInstallStatus, "consumer");
      if (!installResult.ok) {
        throw new Error(installResult.message);
      }
    });

    featuredInstallStatus.textContent =
      t("featured.installed");
    dictStatus.textContent = t("status.dictionaryReady");
  } catch (e) {
    featuredInstallStatus.textContent = t("featured.installFailed", { error: String(e) });
    retryFeaturedInstallBtn.style.display = "";
  } finally {
    featuredInstallInProgress = false;
    updateFeaturedInstallControls();
  }
}

async function restoreCachedCatalogFromDb() {
  const db = await openSiralexDb();
  try {
    const cached = await getCachedBundleCatalog(db);
    if (!cached) return;
    applyCachedCatalog(cached, "cache");
    catalogStatus.textContent = t("catalog.cachedRestored", {
      source: cached.response_url,
      fetchedAt: cached.fetched_at_iso,
    });
    for (const warning of cached.warnings) {
      catalogStatus.textContent += t("catalog.warnPrefix", { warning });
    }
  } finally {
    db.close();
  }
}

async function installCatalogEntry(
  entry: BundleCatalogEntryV1,
  activateOnCommit = true,
  progressTarget: HTMLDivElement = importProgress,
  progressMode: InstallProgressMode = "detailed",
): Promise<{ ok: boolean; message: string }> {
  if (!loadedCatalogUrl) {
    progressTarget.style.display = "";
    progressTarget.textContent = t("catalog.missingSourceUrl");
    return { ok: false, message: "missing catalog source URL" };
  }

  const existingDb = await openSiralexDb();
  try {
    const installed = await getInstalledBundleMeta(existingDb, entry.bundle_id);
    if (installed?.expected_content_sha256 === entry.content_sha256) {
      await setActiveBundleId(existingDb, entry.bundle_id);
      progressTarget.style.display = "";
      progressTarget.textContent = t("import.bundleAlreadyInstalledMarkedActive", {
        bundleId: entry.bundle_id,
      });
      return { ok: true, message: "already installed; activated" };
    }
  } finally {
    existingDb.close();
  }

  const controller = new AbortController();
  remoteInstallAbortController = controller;
  remoteInstallBundleId = entry.bundle_id;
  updateInstallControls();
  progressTarget.style.display = "";
  progressTarget.textContent =
    progressMode === "consumer"
      ? t("progress.consumer.preparing")
      : t("catalog.prepareRemoteInstall", { bundleId: entry.bundle_id });

  const db = await openSiralexDb();
  try {
    const { manifest, result } = await installRemoteCatalogBundle(db, entry, loadedCatalogUrl, {
      activateOnCommit,
      signal: controller.signal,
      onUpdate: (message) => {
        progressTarget.textContent = message;
      },
      progressCopy: {
        installingPrefix: t("progress.installingPrefix"),
        stageLabel: t("progress.stageLabel"),
        stageFetchingManifest: t("progress.stage.fetchManifest"),
        stageFetchingRecords: t("progress.stage.fetchRecords"),
        stageFetchingSearchIndex: t("progress.stage.fetchSearchIndex"),
        stageStagingPayloads: t("progress.stage.stagingPayloads"),
        bytesReadLabel: t("progress.bytesReadLabel"),
        linesSeenLabel: t("progress.linesSeenLabel"),
        recordsWrittenLabel: t("progress.recordsWrittenLabel"),
        entriesWrittenLabel: t("progress.entriesWrittenLabel"),
        batchesCommittedLabel: t("progress.batchesCommittedLabel"),
        consumerAddingPercent: t("progress.consumer.addingPercent"),
        consumerPreparing: t("progress.consumer.preparing"),
      },
      progressMode,
      storageEstimate:
        typeof navigator !== "undefined" && navigator.storage?.estimate
          ? async () => await navigator.storage.estimate()
          : undefined,
    });

    if (result.skippedBecauseCurrent) {
      await setActiveBundleId(db, manifest.bundle_id);
      progressTarget.textContent = t("import.bundleAlreadyInstalledMarkedActive", {
        bundleId: manifest.bundle_id,
      });
      return { ok: true, message: "already installed; activated" };
    } else {
      progressTarget.textContent =
        t("catalog.remoteInstallComplete", {
          bundleId: manifest.bundle_id,
          records: result.recordsCount,
          indexEntries: result.indexCount,
          elapsed: result.elapsedMs.toFixed(0),
        });
      if (result.cleanupWarning) {
        progressTarget.textContent += `\n${result.cleanupWarning}\n`;
      }
      return { ok: true, message: "installed" };
    }
  } catch (e) {
    console.error("REMOTE INSTALL FAILED", e);
    progressTarget.textContent =
      t("catalog.installFailedHeader") +
      `${formatErrorDetails(e)}\n`;
    return { ok: false, message: String(e) };
  } finally {
    remoteInstallAbortController = undefined;
    remoteInstallBundleId = undefined;
    updateInstallControls();
    db.close();
  }
}

loadCatalogBtn.addEventListener("click", () => {
  void loadCatalogFromUrl(undefined, catalogStatus, { updateCatalogInput: true });
});

featuredInstallBtn.addEventListener("click", () => {
  void installFeaturedDictionary();
});

retryFeaturedInstallBtn.addEventListener("click", () => {
  void installFeaturedDictionary();
});

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
  manifestOut.textContent += `dictionary: ${getBundleDisplayName(
    mfst.bundle_id,
    buildLanguageMetaFromManifest(mfst),
    t("language.source"),
    t("language.target"),
    getCurrentLocale(),
  )}\n`;
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

    let activateOnCommit = true;
    try {
      const existingDb = await openSiralexDb();
      const installed = await getInstalledBundleMeta(existingDb, mfst.bundle_id);
      const activeBundleId = await getActiveBundleId(existingDb);
      if (installed) {
        if (installed.expected_content_sha256 === mfst.content_sha256) {
          await setActiveBundleId(existingDb, mfst.bundle_id);
          existingDb.close();
          dbOut.textContent = `Bundle already installed. Marked active: ${mfst.bundle_id}\n`;
          return;
        }
        activateOnCommit = activeBundleId === mfst.bundle_id;
        dbOut.textContent =
          `Updating installed bundle ${mfst.bundle_id}.\n` +
          `Existing hash: ${installed.expected_content_sha256 ?? "unknown"}\n` +
          `New hash: ${mfst.content_sha256}\n` +
          `${activateOnCommit ? "Updated bundle will remain active." : "Current active bundle will remain unchanged."}\n`;
      }
      existingDb.close();
    } catch {
      // ignore and proceed; database may not exist yet
    }

    const db = await openSiralexDb();
    try {
      dbOut.textContent = `Installing bundle ${mfst.bundle_id}...\n`;
      const result = await installBundleIntoDb(
        db,
        mfst,
        {
          recordsSource: rf,
          searchIndexSource: ix,
        },
        (message) => {
          dbOut.textContent = message;
        },
        undefined,
        {
          displayName: getBundleDisplayName(
            mfst.bundle_id,
            buildLanguageMetaFromManifest(mfst),
            t("language.source"),
            t("language.target"),
            getCurrentLocale(),
          ),
          storageBytes: getManifestPayloadBytes(mfst),
        },
        activateOnCommit,
      );
      dbOut.textContent =
        `Install COMPLETE\n` +
        `bundle_id: ${mfst.bundle_id}\n` +
        `records: ${result.recordsCount}\n` +
        `index entries: ${result.indexCount}\n` +
        `elapsed: ${result.elapsedMs.toFixed(0)} ms\n` +
        `\nNote: expected_content_sha256 stored from manifest; NOT verified client-side.\n`;
      if (result.cleanupWarning) {
        dbOut.textContent += `\n${result.cleanupWarning}\n`;
      }
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
    importProgress.textContent = t("db.deleting");
    try {
      await deleteSiralexDb();
      importProgress.textContent = t("db.deleted");
    } catch (e) {
      importProgress.textContent += t("db.deleteFailed", { error: String(e) });
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

const RECENT_QUERY_LOGS_LIMIT = 50;

async function fetchRecentQueryLogs(limit: number): Promise<QueryLogEvent[]> {
  let db: IDBDatabase | undefined;
  try {
    db = await openSiralexDb();
    return await listRecentQueryLogs(db, { limit });
  } finally {
    db?.close();
  }
}

function styleInspectCell(el: HTMLElement): void {
  el.style.border = "1px solid var(--border)";
  el.style.padding = "4px 6px";
  el.style.textAlign = "left";
  el.style.verticalAlign = "top";
}

function renderRecentQueryLogs(rows: QueryLogEvent[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "mono";
    empty.textContent = t("logging.noLogsYet");
    frag.appendChild(empty);
    return frag;
  }

  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";
  table.style.fontSize = "13px";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of [
    t("logging.recentColQuery"),
    t("logging.recentColStatus"),
    t("logging.recentColCount"),
    t("logging.recentColMatchedKey"),
    t("logging.recentColMatchedKeyType"),
    t("logging.recentColTimestamp"),
  ]) {
    const th = document.createElement("th");
    th.textContent = label;
    styleInspectCell(th);
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    const tdRaw = document.createElement("td");
    tdRaw.textContent = row.query_raw;
    styleInspectCell(tdRaw);
    const tdStatus = document.createElement("td");
    tdStatus.textContent = recentLogStatusLabel(row);
    styleInspectCell(tdStatus);
    const tdCount = document.createElement("td");
    tdCount.textContent = String(recentLogResultCount(row));
    styleInspectCell(tdCount);
    const tdMatchedKey = document.createElement("td");
    tdMatchedKey.textContent = recentLogMatchedKeyDisplay(row) ?? "—";
    styleInspectCell(tdMatchedKey);
    const tdMatchedKeyType = document.createElement("td");
    tdMatchedKeyType.textContent = recentLogMatchedKeyTypeDisplay(row);
    styleInspectCell(tdMatchedKeyType);
    const tdTs = document.createElement("td");
    tdTs.textContent = row.timestamp_iso;
    styleInspectCell(tdTs);
    tr.append(tdRaw, tdStatus, tdCount, tdMatchedKey, tdMatchedKeyType, tdTs);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  const tableScroll = document.createElement("div");
  tableScroll.className = "recent-query-logs-table-scroll";
  tableScroll.appendChild(table);
  frag.appendChild(tableScroll);
  return frag;
}

async function updateRecentQueryLogsView() {
  if (!getQueryLoggingEnabled()) {
    recentQueryLogsOffNote.style.display = "";
    recentQueryLogsActive.style.display = "none";
    recentQueryLogsTableHost.replaceChildren();
    return;
  }

  recentQueryLogsOffNote.style.display = "none";
  recentQueryLogsActive.style.display = "";

  try {
    const rows = await fetchRecentQueryLogs(RECENT_QUERY_LOGS_LIMIT);
    recentQueryLogsTableHost.replaceChildren(renderRecentQueryLogs(rows));
  } catch (e) {
    recentQueryLogsTableHost.replaceChildren();
    const err = document.createElement("p");
    err.className = "mono";
    err.textContent = t("logging.recentLogsError", { error: String(e) });
    recentQueryLogsTableHost.appendChild(err);
  }
}

function updateQueryLoggingConsentDisplay() {
  if (hasValidQueryLoggingConsent()) {
    const status = getQueryLoggingConsentStatus();
    queryLoggingConsentStatus.textContent = t("logging.consentStatusRecorded", {
      version: status.version ?? "unknown",
      date: status.atIso ?? "unknown",
    });
  } else {
    queryLoggingConsentStatus.textContent = t("logging.consentStatusNotRecorded");
  }
}

async function refreshQueryLoggingDiagnostics() {
  const statsResult = await getQueryLogStatsFromDb({ translate: t });
  queryLoggingStats.textContent = statsResult.ok
    ? formatQueryLogStatsLine(statsResult.stats, { translate: t })
    : statsResult.message;
  if (!statsResult.ok) {
    queryLogMessage.textContent = statsResult.message;
  }
  updateQueryLoggingConsentDisplay();
}

function updateQueryLoggingToggleState() {
  const enabled = getQueryLoggingEnabled();
  queryLoggingStatus.textContent = enabled ? t("logging.on") : t("logging.off");
  queryLoggingToggleBtn.textContent = enabled ? t("logging.turnOff") : t("logging.turnOn");
  queryLoggingToggleBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
}

async function renderQueryLoggingToggle() {
  updateQueryLoggingToggleState();
  queryLogMessage.textContent = "";
  await refreshQueryLoggingDiagnostics();
  await updateRecentQueryLogsView();
}

function updateLangToggle() {
  const directionText = getSearchDirectionText(
    searchDirection,
    currentActiveBundle?.language_meta,
    t("language.source"),
    t("language.target"),
    getCurrentLocale(),
  );
  langToggle.textContent = directionText;
  searchLabel.textContent = t("search.queryLabel", { direction: directionText });
  searchInput.placeholder = getSearchPlaceholder(
    searchDirection,
    currentActiveBundle?.language_meta,
    t("language.source"),
    t("language.target"),
    (label) => t("search.placeholder", { language: label }),
    getCurrentLocale(),
  );
}

queryLoggingToggleBtn.addEventListener("click", () => {
  const currentlyEnabled = getQueryLoggingEnabled();
  if (currentlyEnabled) {
    setQueryLoggingEnabled(false);
    cancelPendingSettledQueryLog();
    updateQueryLoggingToggleState();
    updateQueryLoggingConsentDisplay();
    queryLogMessage.textContent = "";
    void updateRecentQueryLogsView();
    return;
  }

  if (!hasValidQueryLoggingConsent()) {
    const agreed = window.confirm(t("logging.consentPrompt"));
    if (!agreed) {
      setQueryLoggingEnabled(false);
      updateQueryLoggingToggleState();
      updateQueryLoggingConsentDisplay();
      return;
    }
    recordQueryLoggingConsent();
  }

  setQueryLoggingEnabled(true);
  updateQueryLoggingToggleState();
  updateQueryLoggingConsentDisplay();
  queryLogMessage.textContent = "";
  void updateRecentQueryLogsView();
});

queryLogExportBtn.addEventListener("click", () => {
  void (async () => {
    const result = await exportQueryLogsFromUi({ translate: t });
    queryLogMessage.textContent = result.message;
    await refreshQueryLoggingDiagnostics();
  })();
});

queryLogClearBtn.addEventListener("click", () => {
  void (async () => {
    const result = await clearQueryLogsFromUi({ translate: t });
    queryLogMessage.textContent = result.message;
    await refreshQueryLoggingDiagnostics();
    await updateRecentQueryLogsView();
  })();
});

queryLogCopyDiagnosticsBtn.addEventListener("click", () => {
  void (async () => {
    const context = await buildQueryLogDiagnosticsContext(
      {
        appVersion: APP_VERSION,
        bundleId: currentActiveBundle?.bundle_id,
        normVersion: currentActiveBundle?.normalization_ruleset,
        uiLanguage: getCurrentLocale(),
        loggingEnabled: getQueryLoggingEnabled(),
      },
      { translate: t },
    );
    const result = await copyQueryLogDiagnosticsFromUi(context, { translate: t });
    queryLogMessage.textContent = result.message;
  })();
});

recentQueryLogsRefreshBtn.addEventListener("click", () => {
  void updateRecentQueryLogsView();
});

langToggle.addEventListener("click", () => {
  searchDirection = searchDirection === "source_to_target" ? "target_to_source" : "source_to_target";
  updateLangToggle();
});

// --- Search + results ---

const QUERY_LOGGING_SETTLE_DELAY_MS = 800;

type SettledQueryLogPayload = {
  seq: number;
  query: string;
  direction: SearchDirection;
  result: Awaited<ReturnType<typeof searchQuery>>;
  activeBundleMeta: ActiveBundleMeta;
  storageScopeId: string;
  latencyMs: number;
  uiLanguage: Locale;
};

let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let queryLoggingSettleTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSettledLogPayload: SettledQueryLogPayload | undefined;
let searchSeq = 0;
let entryDetailGeneration = 0;
let savedVocabularyGeneration = 0;
let reviewGeneration = 0;
let activeReviewHost: ReturnType<typeof createReviewSurfaceHost> | undefined;
/** One-use intent: focus Start Review after returning from Review. */
let focusStartReviewOnce = false;
let lastSearchResults: ResultDisplayContext[] = [];
/** Track active bundle id so switches invalidate collection/Review contexts. */
let lastKnownActiveBundleId: string | undefined;

/** Explicit host context for #searchResults navigation (LS1I3 / LS2I3 / LS2I4). */
type ResultsHostContext =
  | "search"
  | "saved_vocabulary"
  | "entry_from_search"
  | "entry_from_saved"
  | "review";
let resultsHostContext: ResultsHostContext = "search";

function disposeActiveReviewHost() {
  activeReviewHost?.dispose();
  activeReviewHost = undefined;
  reviewGeneration += 1;
}

function invalidateCollectionAndReviewContexts() {
  disposeActiveReviewHost();
  savedVocabularyGeneration += 1;
  entryDetailGeneration += 1;
  focusStartReviewOnce = false;
}
function cancelPendingSettledQueryLog() {
  if (queryLoggingSettleTimer !== undefined) {
    clearTimeout(queryLoggingSettleTimer);
    queryLoggingSettleTimer = undefined;
  }
  pendingSettledLogPayload = undefined;
}

function scheduleSettledQueryLog(payload: SettledQueryLogPayload) {
  cancelPendingSettledQueryLog();
  pendingSettledLogPayload = payload;

  queryLoggingSettleTimer = setTimeout(() => {
    const pending = pendingSettledLogPayload;
    queryLoggingSettleTimer = undefined;
    pendingSettledLogPayload = undefined;

    if (!pending) return;
    if (pending.seq !== searchSeq) return;
    if (pending.query.trim() === "") return;
    if (searchInput.value !== pending.query) return;
    if (searchDirection !== pending.direction) return;
    if (!currentActiveBundle) return;
    if (currentActiveBundle.bundle_id !== pending.activeBundleMeta.bundle_id) return;
    if (getBundleStorageScopeId(currentActiveBundle) !== pending.storageScopeId) return;
    if (!getQueryLoggingEnabled()) return;

    void appendSearchQueryLogIfEnabled({
      queryRaw: pending.query,
      direction: pending.direction,
      result: pending.result,
      activeBundleMeta: pending.activeBundleMeta,
      storageScopeId: pending.storageScopeId,
      latencyMs: pending.latencyMs,
      uiLanguage: pending.uiLanguage,
    }).then(async () => {
      await refreshQueryLoggingDiagnostics();
      await updateRecentQueryLogsView();
    });
  }, QUERY_LOGGING_SETTLE_DELAY_MS);
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  cancelPendingSettledQueryLog();
  const query = searchInput.value;
  if (query.trim() === "") {
    searchSeq += 1;
    invalidateCollectionAndReviewContexts();
    resultsHostContext = "search";
    searchMeta.textContent = "";
    searchResults.innerHTML = "";
    lastSearchResults = [];
    return;
  }
  searchDebounceTimer = setTimeout(() => {
    void runSearch(query);
  }, 150);
});

/** Origin for entry-detail Back navigation (no router). */
type EntryNavOrigin =
  | { kind: "search"; restoreDirection: SearchDirection }
  | { kind: "saved_vocabulary" };

function showResultsList() {
  resultsHostContext = "search";
  invalidateCollectionAndReviewContexts();
  searchResults.innerHTML = "";
  if (lastSearchResults.length === 0) return;

  const list = renderResultsList(lastSearchResults, (record) => {
    showEntryDetail(record, {
      kind: "search",
      restoreDirection: searchDirection,
    });
  });
  if (list) searchResults.appendChild(list);
}

/**
 * Open Review from Saved Vocabulary (LS2I4). Ephemeral session; Back returns
 * to Saved Vocabulary with one-use Start Review focus restoration.
 */
function showReviewSurface() {
  disposeActiveReviewHost();
  const generation = ++reviewGeneration;
  resultsHostContext = "review";
  entryDetailGeneration += 1;
  savedVocabularyGeneration += 1;
  focusStartReviewOnce = false;
  searchResults.innerHTML = "";

  const host = createReviewSurfaceHost({
    mount: searchResults,
    getActiveMeta: () => currentActiveBundle,
    openDb: openSiralexDb,
    isHostCurrent: () =>
      generation === reviewGeneration && resultsHostContext === "review",
    onBack: () => {
      disposeActiveReviewHost();
      focusStartReviewOnce = true;
      showSavedVocabulary();
    },
  });
  activeReviewHost = host;
  host.start();
}

function showSavedVocabulary() {
  disposeActiveReviewHost();
  const generation = ++savedVocabularyGeneration;
  resultsHostContext = "saved_vocabulary";
  entryDetailGeneration += 1;
  searchResults.innerHTML = "";

  let lastFocusTarget: HTMLElement | null = null;
  const restoreStartReviewFocus = focusStartReviewOnce;
  focusStartReviewOnce = false;
  let didRestoreFocus = false;

  const applyModel = (model: SavedVocabularyModel) => {
    if (generation !== savedVocabularyGeneration || resultsHostContext !== "saved_vocabulary") {
      return;
    }
    const view = renderSavedVocabulary(model, {
      onBack: () => {
        savedVocabularyGeneration += 1;
        showResultsList();
      },
      onOpen: (row) => {
        showEntryDetail(row.liveEntry, { kind: "saved_vocabulary" });
      },
      onRemove: (row) => {
        void session.remove(row.bundle_id, row.ir_id).then((result) => {
          if (generation !== savedVocabularyGeneration) return;
          if (result === "ok" && lastFocusTarget) {
            lastFocusTarget.focus();
          }
        });
      },
      onStartReview: () => {
        if (generation !== savedVocabularyGeneration || resultsHostContext !== "saved_vocabulary") {
          return;
        }
        showReviewSurface();
      },
    });
    searchResults.innerHTML = "";
    searchResults.appendChild(view.root);
    lastFocusTarget = view.focusAfterRemove;

    if (restoreStartReviewFocus && !didRestoreFocus && model.surface !== "loading") {
      didRestoreFocus = true;
      if (view.startReviewButton && !view.startReviewButton.disabled) {
        view.startReviewButton.focus();
      } else if (view.heading) {
        view.heading.focus();
      }
    }
  };

  const session = createSavedVocabularySession({
    getActiveMeta: () => currentActiveBundle,
    openDb: openSiralexDb,
    isCurrent: () =>
      generation === savedVocabularyGeneration && resultsHostContext === "saved_vocabulary",
    onUpdate: applyModel,
    confirmRemove: () => window.confirm(t("learning.removeConfirm")),
  });

  applyModel({ surface: "loading" });
  void session.load();
}

function setSearchDirection(direction: SearchDirection) {
  if (searchDirection === direction) {
    updateLangToggle();
    return;
  }
  searchDirection = direction;
  updateLangToggle();
}

function handleOpenTargetLexiconEntry(target: TargetEntry, mappingRoot: HTMLElement) {
  const pendingEntryGen = entryDetailGeneration;
  const pendingSearchSeq = searchSeq;
  const pendingHost = resultsHostContext;
  const pendingBundleId = currentActiveBundle?.bundle_id;
  const restoreDirection = searchDirection;
  const preservedQuery = searchInput.value;

  void openTargetLexiconEntry({
    target,
    restoreDirection,
    getActiveMeta: () => currentActiveBundle,
    openDb: openSiralexDb,
    isCurrent: () =>
      entryDetailGeneration === pendingEntryGen &&
      searchSeq === pendingSearchSeq &&
      resultsHostContext === pendingHost &&
      currentActiveBundle?.bundle_id === pendingBundleId &&
      searchInput.value === preservedQuery,
    setDirectionTargetToSource: () => {
      setSearchDirection("target_to_source");
    },
    openEntryDetail: (record, backDirection) => {
      showEntryDetail(record, { kind: "search", restoreDirection: backDirection });
      const headword = searchResults.querySelector<HTMLElement>(".entry-headword");
      headword?.focus();
    },
    onUnavailable: () => {
      if (
        entryDetailGeneration !== pendingEntryGen ||
        resultsHostContext !== pendingHost ||
        searchSeq !== pendingSearchSeq
      ) {
        return;
      }
      showTargetEntryUnavailable(mappingRoot);
    },
  });
}

function showEntryDetail(record: EnrichedRecord, origin: EntryNavOrigin) {
  const generation = ++entryDetailGeneration;
  resultsHostContext = origin.kind === "saved_vocabulary" ? "entry_from_saved" : "entry_from_search";
  disposeActiveReviewHost();
  if (origin.kind === "search") {
    savedVocabularyGeneration += 1;
  }
  searchResults.innerHTML = "";

  const offerLearning = isLexiconDisplay(record);
  const learningAvailable = offerLearning && canOfferLearningSave(record, currentActiveBundle);

  let setLearningSaveState: ((state: LearningSaveControlState) => void) | undefined;

  const session = offerLearning
    ? createEntryLearningSession({
        record,
        getActiveMeta: () => currentActiveBundle,
        openDb: openSiralexDb,
        isCurrent: () => generation === entryDetailGeneration,
        setState: (state) => {
          if (generation !== entryDetailGeneration) return;
          setLearningSaveState?.(state);
        },
      })
    : undefined;

  let entryRoot: HTMLElement | null = null;
  const view = renderEntryDetail(record, {
    onBack: () => {
      if (origin.kind === "saved_vocabulary") {
        showSavedVocabulary();
        return;
      }
      setSearchDirection(origin.restoreDirection);
      showResultsList();
    },
    onOpenTargetEntry: (target) => {
      if (entryRoot) handleOpenTargetLexiconEntry(target, entryRoot);
    },
    targetEntriesLabel: getTargetEntriesLabel(
      currentActiveBundle?.language_meta,
      t("language.target"),
      (label) => t("entry.targetEntries", { label }),
      getCurrentLocale(),
    ),
    learning: offerLearning
      ? {
          initialState: learningAvailable ? "loading" : "unavailable",
          onSave: () => {
            void session?.save();
          },
          onUnsave: () => {
            void session?.unsave();
          },
        }
      : undefined,
  });

  entryRoot = view.root;
  setLearningSaveState = view.setLearningSaveState;
  searchResults.appendChild(view.root);

  const headword = view.root.querySelector<HTMLElement>(".entry-headword");
  if (headword && !headword.hasAttribute("tabindex")) {
    headword.tabIndex = -1;
  }
  headword?.focus();

  if (offerLearning && learningAvailable && session) {
    void session.loadInitial();
  } else if (offerLearning && !learningAvailable) {
    view.setLearningSaveState?.("unavailable");
  }
}

async function runSearch(query: string) {
  if (busy) {
    searchMeta.textContent = t("search.disabledBusy");
    return;
  }
  if (!hasActiveBundle) {
    searchMeta.textContent = t("search.disabledNoActiveBundle");
    return;
  }
  const seq = ++searchSeq;
  const t0 = performance.now();
  let db: IDBDatabase | undefined;
  try {
    db = await openSiralexDb();
    const activeBundleMeta = await getActiveBundleMeta(db);
    if (!activeBundleMeta) {
      searchMeta.textContent = t("search.disabledNoActiveBundle");
      searchResults.innerHTML = "";
      lastSearchResults = [];
      return;
    }
    const activeStorageScopeId = getBundleStorageScopeId(activeBundleMeta);

    const result = await searchQuery(
      db,
      activeStorageScopeId,
      searchDirection,
      query,
      activeBundleMeta.search_index_directional === true,
    );
    if (seq !== searchSeq) return;

    if (result.ir_ids.length === 0) {
      searchMeta.textContent = getNoResultMessage(query);
      invalidateCollectionAndReviewContexts();
      resultsHostContext = "search";
      searchResults.innerHTML = "";
      lastSearchResults = [];
      scheduleSettledQueryLog({
        seq,
        query,
        direction: searchDirection,
        result,
        activeBundleMeta,
        storageScopeId: activeStorageScopeId,
        latencyMs: Math.round(performance.now() - t0),
        uiLanguage: getCurrentLocale(),
      });
      return;
    }

    const records = await resolveRecords(db, activeStorageScopeId, result.ir_ids);
    if (seq !== searchSeq) return;

    searchMeta.textContent = t("search.resultMeta", {
      query,
      count: records.length,
    });

    lastSearchResults = records.map((record) => ({
      rawQuery: query,
      searchDirection,
      matched_key_type: result.matched_key_type,
      matched_key: result.matched_key,
      sourceLabel: getLocalizedSourceLabel(activeBundleMeta.language_meta),
      targetLabel: getLocalizedTargetLabel(activeBundleMeta.language_meta),
      record,
    }));
    showResultsList();
    scheduleSettledQueryLog({
      seq,
      query,
      direction: searchDirection,
      result,
      activeBundleMeta,
      storageScopeId: activeStorageScopeId,
      latencyMs: Math.round(performance.now() - t0),
      uiLanguage: getCurrentLocale(),
    });
  } catch (e) {
    if (seq !== searchSeq) return;
    searchMeta.textContent = t("search.error", { error: String(e) });
    searchResults.innerHTML = "";
    lastSearchResults = [];
  } finally {
    db?.close();
  }
}

async function initializeAppState() {
  await renderQueryLoggingToggle();
  let recoveryMessage: string | undefined;
  const db = await openSiralexDb();
  try {
    recoveryMessage = await recoverInterruptedBundleInstall(db);
  } finally {
    db.close();
  }

  await restoreCachedCatalogFromDb();
  if (recoveryMessage) {
    importProgress.style.display = "";
    importProgress.textContent = `${recoveryMessage}\n`;
  }
  await refreshDbStatus();
  updatePackageImportControls();
}

void initializeAppState();
