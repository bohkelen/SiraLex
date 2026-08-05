import "./style.css";
import { registerSW } from "virtual:pwa-register";
import appPackage from "../package.json";

import { probeJsonlFile } from "./bundle_probe";
import {
  buildLanguageMetaFromManifest,
  getBundleDisplayName,
  getSearchPlaceholder,
  getSourceLabel,
  getTargetLabel,
  getTargetEntriesLabel,
  localizeStoredBundleDisplayName,
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
import { createLearningBackupSurface } from "./learning/learning_backup_surface";
import { renderLearningBackupSurface } from "./render/render_learning_backup";
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
  putInstalledBundleMeta,
  recoverInterruptedBundleInstall,
  setCachedBundleCatalog,
  setActiveBundleId,
  setActiveBundleMeta,
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
  getCurrentUiThemePreference,
  initUiTheme,
  setUiThemePreferenceWithPersistence,
  type UiThemePreference,
} from "./theme";
import {
  handoffFeedbackForReview,
  isFeedbackHandoffConfigured,
  resolveFeedbackEmailFromEnv,
  toFeedbackHandoffArtifact,
  type FeedbackHandoffKind,
} from "./feedback/feedback_handoff";
import { downloadCorrectionFeedbackArtifact } from "./corrections/correction_feedback_file";
import { downloadSearchFeedbackArtifact } from "./search_feedback/search_feedback_export";
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
import { applySearchDirectionPresentation } from "./render/render_search_chrome";
import { renderEntryDetail, showTargetEntryUnavailable } from "./render/render_entry";
import { renderCorrectionForm } from "./render/render_correction_form";
import {
  renderNoResultSearchFeedbackEntry,
  renderResultsNotUsefulSearchFeedbackEntry,
  renderSearchFeedbackCapture,
} from "./render/render_search_feedback_capture";
import { renderSavedVocabulary } from "./render/render_saved_vocabulary";
import { renderMore } from "./render/render_more";
import { renderInstalledDictionaryList } from "./render/render_dictionary_management";
import {
  renderPrimaryNavigation,
  type PrimaryDestination,
  type PrimaryNavigationView,
} from "./render/render_primary_navigation";
import {
  createSearchFeedbackCaptureController,
  type SearchFeedbackCaptureController,
} from "./search_feedback/search_feedback_capture_controller";
import {
  buildSearchFeedbackCaptureContext,
  canOfferSearchFeedbackCapture,
  deriveMatchedIrIdsFromRecords,
  type ExecutedSearchSnapshot,
} from "./search_feedback/search_feedback_capture_model";
import {
  createSearchFeedbackManagementSession,
  type SearchFeedbackManagementSession,
} from "./search_feedback/search_feedback_management_session";
import { countSearchFeedbackDrafts } from "./search_feedback/search_feedback_store";
import { renderSearchFeedbackManagement } from "./render/render_search_feedback_management";
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
import {
  createCorrectionFormController,
  type CorrectionFormController,
} from "./corrections/correction_form_controller";
import {
  buildCorrectionEntryContext,
  canOfferCorrectionSuggestion,
} from "./corrections/correction_form_model";
import {
  createCorrectionManagementSession,
  type CorrectionManagementSession,
} from "./corrections/correction_management_session";
import { countCorrectionDrafts } from "./corrections/correction_draft_store";
import { renderCorrectionManagement } from "./render/render_correction_management";
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
initUiTheme();

const FEATURED_CATALOG_URL =
  import.meta.env.VITE_FEATURED_CATALOG_URL?.trim() || "/catalog.json";
const FEATURED_BUNDLE_ID = import.meta.env.VITE_FEATURED_BUNDLE_ID?.trim() || undefined;
const FEEDBACK_EMAIL = resolveFeedbackEmailFromEnv();
const FEEDBACK_HANDOFF_AVAILABLE = isFeedbackHandoffConfigured(FEEDBACK_EMAIL);

async function performConfiguredFeedbackHandoff(
  artifact: { filename: string; mediaType: "application/json"; text: string },
  kind: FeedbackHandoffKind,
): Promise<Awaited<ReturnType<typeof handoffFeedbackForReview>>> {
  const bridged = toFeedbackHandoffArtifact(artifact, kind);
  if (!bridged) {
    return { ok: false, reason: "invalid_artifact" };
  }
  const email = FEEDBACK_EMAIL ?? "";
  const copy =
    kind === "correction_feedback"
      ? {
          shareTitle: t("correctionFeedback.manage.send.shareTitle"),
          shareText: t("correctionFeedback.manage.send.shareText", { email }),
          mailtoSubject: t("correctionFeedback.manage.send.mailtoSubject"),
          mailtoBody: t("correctionFeedback.manage.send.mailtoBody", {
            filename: bridged.filename,
            email,
          }),
        }
      : {
          shareTitle: t("searchFeedback.manage.send.shareTitle"),
          shareText: t("searchFeedback.manage.send.shareText", { email }),
          mailtoSubject: t("searchFeedback.manage.send.mailtoSubject"),
          mailtoBody: t("searchFeedback.manage.send.mailtoBody", {
            filename: bridged.filename,
            email,
          }),
        };
  return handoffFeedbackForReview(bridged, {
    feedbackEmail: FEEDBACK_EMAIL,
    // Privacy confirmation is handled by the management confirm_handoff UI.
    confirmPrivacy: () => true,
    copy,
    downloadArtifact: (handoffArtifact) => {
      if (kind === "correction_feedback") {
        downloadCorrectionFeedbackArtifact({
          filename: handoffArtifact.filename,
          mediaType: "application/json",
          text: handoffArtifact.text,
          byteLength: new TextEncoder().encode(handoffArtifact.text).byteLength,
          draftCount: 0,
          exportedAt: new Date(0).toISOString(),
        });
        return;
      }
      downloadSearchFeedbackArtifact({
        filename: handoffArtifact.filename,
        mediaType: "application/json",
        text: handoffArtifact.text,
        byteLength: new TextEncoder().encode(handoffArtifact.text).byteLength,
        feedbackCount: 0,
        exportedAt: new Date(0).toISOString(),
      });
    },
  });
}

app.innerHTML = `
  <div class="ux2-app-shell" id="ux2AppShell" data-primary="search" data-search-view="search">
    <header class="ux2-app-header">
      <div class="ux2-wordmark ux2-type-wordmark" id="ux2Wordmark">SiraLex</div>
      <div id="ux2PrimaryNavHost" class="ux2-primary-nav-host"></div>
    </header>

    <main class="ux2-main">
      <div id="searchChrome" class="ux2-search-chrome" data-search-ready="false">
        <h2 class="ux2-visually-hidden" id="searchHeading" tabindex="-1">${t("search.title")}</h2>
        <p class="subtitle ux2-search-setup-copy">${t("search.subtitle")}</p>
        <div id="dictStatus" class="mono ux2-search-diagnostic"></div>
        <div id="firstRun" class="ux2-search-first-run" style="display: none">
          <div class="label">${t("firstRun.title")}</div>
          <p class="subtitle" style="margin: 6px 0 0 0">${t("firstRun.intro")}</p>
          <div id="featuredInstallStatus" class="mono"></div>
          <div class="row" style="margin-top: 10px; gap: 8px">
            <button id="featuredInstall" class="btn">${t("firstRun.install")}</button>
            <button id="retryFeaturedInstall" class="btn" style="display: none">${t("firstRun.retryInstall")}</button>
          </div>
        </div>

        <div id="activeDictionaryRow" class="ux2-search-diagnostic ux2-active-dictionary-row">
          <div class="mono" id="activeDictionarySummary">${t("activeDictionary.none")}</div>
        </div>

        <div id="searchControlsRow" class="ux2-search-controls" style="display: none">
          <div class="ux2-search-direction" data-testid="ux2-search-direction">
            <span id="searchSourceLanguage" class="ux2-search-language"></span>
            <button id="langToggle" class="ux2-search-swap" type="button" disabled aria-label="${t("search.switchDirection", { from: t("language.source"), to: t("language.target") })}"></button>
            <span id="searchTargetLanguage" class="ux2-search-language"></span>
          </div>
          <label class="ux2-visually-hidden" id="searchLabel" for="searchInput">${t("search.queryLabel", { direction: `${t("language.source")} → ${t("language.target")}` })}</label>
          <div class="ux2-search-field">
            <span class="ux2-search-field-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </span>
            <input id="searchInput" type="search" enterkeyhint="search" placeholder="${t("search.placeholder", { language: t("language.source") })}" disabled autocomplete="off" />
          </div>
        </div>

        <div id="searchMeta" class="ux2-search-meta" aria-live="polite"></div>
      </div>

      <div id="searchResults" class="ux2-surface-host ux2-search-results"></div>

      <section id="moreDestination" class="ux2-more-landing" hidden></section>

    <div id="moreManagementHost" class="ux2-more-management-host" hidden>
      <button id="moreManagementBack" class="ux2-more-management-back" type="button">${t("more.back")}</button>

    <section id="dictionaryManagementSurface" class="ux2-dictionary-management" aria-labelledby="dictionary-management-heading">
      <div id="manageDictionariesPanel" class="ux2-manage-dictionaries-panel">
        <h2 id="dictionary-management-heading" class="ux2-type-page-title ux2-dict-title" tabindex="-1">${t("dictionaries.title")}</h2>

        <div class="ux2-dict-layout">
          <section class="ux2-dict-section ux2-dict-installed-section" aria-labelledby="dictionaries-installed-heading">
            <h3 id="dictionaries-installed-heading" class="ux2-type-section-heading ux2-dict-section-heading">${t("dictionaries.installed")}</h3>
            <div class="ux2-dict-active-control">
              <label class="ux2-dict-active-label" for="bundleSelect" id="bundleSelectLabel">${t("dictionaries.activeDictionary")}</label>
              <select id="bundleSelect" disabled aria-labelledby="bundleSelectLabel">
                <option value="">${t("manage.noneInstalled")}</option>
              </select>
            </div>
            <div id="installedBundleList" class="ux2-dict-installed-host"></div>
          </section>

          <section class="ux2-dict-section ux2-dict-add-section" aria-labelledby="dictionaries-add-heading">
            <h3 id="dictionaries-add-heading" class="ux2-type-section-heading ux2-dict-section-heading">${t("dictionaries.add")}</h3>
            <p class="ux2-dict-add-help">${t("dictionaries.addHelp")}</p>
            <div class="ux2-dict-add-actions">
              <button id="packageImport" class="ux2-dict-package-btn" type="button">${t("dictionaries.chooseFile")}</button>
              <input id="packageImportFile" type="file" accept=".siralex.zip,application/zip" style="display: none" />
            </div>
            <div id="importProgress" class="ux2-dict-progress" role="status" style="display: none"></div>
          </section>
        </div>

        <details id="dictionariesAdvanced" class="ux2-dict-advanced">
          <summary>${t("dictionaries.advanced")}</summary>
          <p class="ux2-dict-advanced-hint">${t("advancedSetup.surfaceHint")}</p>
          <div id="installedBundleStatus" class="mono ux2-dict-tech-status"></div>
          <div class="ux2-dict-advanced-block">
            <div class="label">${t("catalog.urlLabel")}</div>
            <div class="row" style="margin-top: 8px; align-items: end">
              <div class="field" style="flex: 1">
                <input id="catalogUrl" type="text" placeholder="${t("catalog.urlPlaceholder")}" autocomplete="off" />
              </div>
              <button id="loadCatalog" class="btn">${t("catalog.load")}</button>
            </div>
            <div id="catalogStatus" class="mono" style="margin-top: 12px"></div>
            <div id="catalogList" style="margin-top: 12px"></div>
          </div>
          <div class="ux2-dict-advanced-block">
            <div class="label">${t("import.legacyThreeFileLabel")}</div>
            <p class="subtitle" style="margin: 4px 0 0 0">${t("import.legacyThreeFileHint")}</p>
            <div class="row" style="margin-top: 8px">
              <button id="quickImport" class="btn">${t("import.legacyThreeFileButton")}</button>
              <input id="quickImportFiles" type="file" multiple style="display: none" />
              <button id="cancelInstall" class="btn" style="display: none">${t("import.cancel")}</button>
            </div>
          </div>
        </details>
      </div>
    </section>

    <section id="learningDataSurface" class="ux2-learning-data-surface" aria-label="${t("more.learningData")}" hidden>
      <div id="learningBackupHost" class="learning-backup-host"></div>
    </section>

    <section id="dictionariesDestructive" class="ux2-dict-destructive" aria-labelledby="dictionaries-data-heading">
      <h3 id="dictionaries-data-heading" class="ux2-type-section-heading ux2-dict-section-heading">${t("dictionaries.dataManagement")}</h3>
      <p class="ux2-dict-destructive-hint">${t("dictionaries.dataManagementHelp")}</p>
      <div class="ux2-dict-destructive-body">
        <p id="learningBackupDeleteReminder" class="learning-backup-delete-reminder" hidden></p>
        <p id="correctionFeedbackDeleteReminder" class="correction-manage-delete-reminder" hidden></p>
        <p id="searchFeedbackDeleteReminder" class="search-feedback-manage-delete-reminder" hidden></p>
        <button id="clearDb" class="btn ux2-dict-clear-db" type="button">${t("db.delete")}</button>
      </div>
    </section>

    <details class="ux2-more-legacy-advanced">
      <summary>${t("diagnostics.summary")}</summary>
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

    <details class="ux2-more-legacy-advanced" style="margin-top: 16px">
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
    </main>
  </div>
`;

const APP_VERSION = typeof appPackage.version === "string" ? appPackage.version : "0.0.0";

function mustGetEl<T extends Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el as T;
}

// Primary UI elements
const appShell = mustGetEl<HTMLDivElement>("#ux2AppShell");
const primaryNavHost = mustGetEl<HTMLDivElement>("#ux2PrimaryNavHost");
const searchHeading = mustGetEl<HTMLHeadingElement>("#searchHeading");
const moreDestination = mustGetEl<HTMLElement>("#moreDestination");
const moreManagementHost = mustGetEl<HTMLElement>("#moreManagementHost");
const moreManagementBackBtn = mustGetEl<HTMLButtonElement>("#moreManagementBack");
let moreHeading: HTMLHeadingElement | null = null;
const dictionaryManagementSurface = mustGetEl<HTMLElement>("#dictionaryManagementSurface");
const learningDataSurface = mustGetEl<HTMLElement>("#learningDataSurface");
const dictionaryManagementHeading = mustGetEl<HTMLHeadingElement>("#dictionary-management-heading");
const manageDictionariesPanel = mustGetEl<HTMLElement>("#manageDictionariesPanel");
const dictionariesAdvanced = mustGetEl<HTMLDetailsElement>("#dictionariesAdvanced");
const dictStatus = mustGetEl<HTMLDivElement>("#dictStatus");
const activeDictionarySummary = mustGetEl<HTMLDivElement>("#activeDictionarySummary");
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
const learningBackupHost = mustGetEl<HTMLDivElement>("#learningBackupHost");
const learningBackupDeleteReminder = mustGetEl<HTMLParagraphElement>("#learningBackupDeleteReminder");
const correctionFeedbackDeleteReminder = mustGetEl<HTMLParagraphElement>(
  "#correctionFeedbackDeleteReminder",
);
const searchFeedbackDeleteReminder = mustGetEl<HTMLParagraphElement>(
  "#searchFeedbackDeleteReminder",
);
const searchChrome = mustGetEl<HTMLDivElement>("#searchChrome");
const searchInput = mustGetEl<HTMLInputElement>("#searchInput");
const searchLabel = mustGetEl<HTMLLabelElement>("#searchLabel");
const searchSourceLanguage = mustGetEl<HTMLSpanElement>("#searchSourceLanguage");
const searchTargetLanguage = mustGetEl<HTMLSpanElement>("#searchTargetLanguage");
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

function resolveInstalledLanguageMeta(
  bundle: ActiveBundleMeta,
): ActiveBundleMeta["language_meta"] | undefined {
  if (bundle.language_meta?.source_lang || bundle.language_meta?.target_lang) {
    return bundle.language_meta;
  }
  // Featured manifests historically omit languages; catalog carries them.
  const fromCatalog = getLoadedCatalogEntry(bundle.bundle_id)?.language_meta;
  if (!fromCatalog) return bundle.language_meta;
  return {
    source_lang: fromCatalog.source_lang,
    target_lang: fromCatalog.target_lang,
    source_label: fromCatalog.source_label,
    target_label: fromCatalog.target_label,
    target_scripts: bundle.language_meta?.target_scripts,
  };
}

function getInstalledBundleName(bundle: ActiveBundleMeta): string {
  const languageMeta = resolveInstalledLanguageMeta(bundle);
  if (languageMeta?.source_lang || languageMeta?.target_lang || languageMeta?.source_label) {
    return getLocalizedBundleDisplayName(bundle.bundle_id, languageMeta);
  }
  if (bundle.display_name) {
    // Already-installed featured bundles often have English display_name and no language_meta.
    return localizeStoredBundleDisplayName(bundle.display_name, getCurrentLocale());
  }
  return getLocalizedBundleDisplayName(bundle.bundle_id, languageMeta);
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

  const rows = installedBundles.map((bundle) => {
    const catalogEntry = getLoadedCatalogEntry(bundle.bundle_id);
    const catalogState = catalogEntry ? getCatalogEntryRuntimeState(catalogEntry) : undefined;
    return {
      bundleId: bundle.bundle_id,
      displayName: getInstalledBundleName(bundle),
      versionLabel: bundle.version
        ? t("catalog.meta.version", { value: bundle.version })
        : undefined,
      languageDirection: `${getLocalizedSourceLabel(bundle.language_meta)} → ${getLocalizedTargetLabel(bundle.language_meta)}`,
      isActive: currentActiveBundle?.bundle_id === bundle.bundle_id,
      updateAvailable: catalogState?.comparison.state === "update_available",
    };
  });

  const list = renderInstalledDictionaryList(rows, {
    isBusy: () => busy,
    onUse: (bundleId) => {
      void withSingleWriterLock(`switch active bundle ${bundleId}`, async () => {
        const db = await openSiralexDb();
        try {
          await setActiveBundleId(db, bundleId);
        } finally {
          db.close();
        }
        importProgress.style.display = "";
        importProgress.textContent = t("bundle.activeSet", { bundleId });
        await refreshDbStatus();
      });
    },
    onRemove: (bundleId) => {
      const confirmed =
        typeof window === "undefined" ||
        window.confirm(t("bundle.removeConfirm", { bundleId }));
      if (!confirmed) return;
      void withSingleWriterLock(`remove bundle ${bundleId}`, async () => {
        const db = await openSiralexDb();
        try {
          await deleteBundleData(db, bundleId);
        } finally {
          db.close();
        }
        learningBackupSurface?.invalidatePreviewForBundleChange();
        importProgress.style.display = "";
        importProgress.textContent = t("bundle.removed", { bundleId });
        await refreshDbStatus();
      });
    },
    onUpdate: (bundleId) => {
      if (!loadedCatalogUrl) return;
      const bundle = installedBundles.find((b) => b.bundle_id === bundleId);
      if (!bundle) return;
      const catalogEntry = getLoadedCatalogEntry(bundle.bundle_id);
      const catalogState = catalogEntry ? getCatalogEntryRuntimeState(catalogEntry) : undefined;
      if (!catalogEntry || catalogState?.comparison.state !== "update_available") return;
      void withSingleWriterLock(`update bundle ${bundle.bundle_id}`, async () => {
        await installCatalogEntry(
          catalogEntry,
          catalogState?.activateOnCommit ??
            currentActiveBundle?.bundle_id === bundle.bundle_id,
        );
      });
    },
  });
  installedBundleList.replaceChildren(list);
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
  // Installed bundles may already be loaded (catalog refresh); boot path backfills after refreshDbStatus.
  void backfillInstalledLanguageMetaFromCatalog(cached.catalog.bundles).then((changed) => {
    if (!changed) return;
    renderBundleSelectOptions(currentActiveBundle?.bundle_id);
    renderInstalledBundleManager();
    if (currentActiveBundle) {
      activeDictionarySummary.textContent = t("activeDictionary.usingReady", {
        name: getInstalledBundleName(currentActiveBundle),
      });
    }
  });
}

/** Persist catalog languages onto installed metas that were saved without them. */
async function backfillInstalledLanguageMetaFromCatalog(
  bundles: BundleCatalogEntryV1[],
): Promise<boolean> {
  if (installedBundles.length === 0 || bundles.length === 0) return false;
  const byId = new Map(bundles.map((entry) => [entry.bundle_id, entry]));
  const db = await openSiralexDb();
  try {
    let changed = false;
    const nextInstalled: ActiveBundleMeta[] = [];
    for (const installed of installedBundles) {
      if (installed.language_meta?.source_lang || installed.language_meta?.target_lang) {
        nextInstalled.push(installed);
        continue;
      }
      const entry = byId.get(installed.bundle_id);
      if (!entry?.language_meta) {
        nextInstalled.push(installed);
        continue;
      }
      const updated: ActiveBundleMeta = {
        ...installed,
        language_meta: {
          source_lang: entry.language_meta.source_lang,
          target_lang: entry.language_meta.target_lang,
          source_label: entry.language_meta.source_label,
          target_label: entry.language_meta.target_label,
        },
      };
      await putInstalledBundleMeta(db, updated);
      if (currentActiveBundle?.bundle_id === updated.bundle_id) {
        await setActiveBundleMeta(db, updated);
        currentActiveBundle = updated;
      }
      nextInstalled.push(updated);
      changed = true;
    }
    if (changed) {
      installedBundles = nextInstalled;
    }
    return changed;
  } finally {
    db.close();
  }
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

moreManagementBackBtn.addEventListener("click", () => {
  closeMoreManagementBridge();
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
      if (loadedCatalogBundles.length > 0) {
        await backfillInstalledLanguageMetaFromCatalog(loadedCatalogBundles);
      }
      const nextBundleId = active?.bundle_id;
      const nextContentSha = active?.expected_content_sha256;
      if (
        lastKnownActiveBundleId !== nextBundleId ||
        lastKnownActiveContentSha !== nextContentSha
      ) {
        const bundleIdentityChanged = lastKnownActiveBundleId !== nextBundleId;
        lastKnownActiveBundleId = nextBundleId;
        lastKnownActiveContentSha = nextContentSha;
        learningBackupSurface?.invalidatePreviewForBundleChange();
        activeCorrectionForm?.notifyBundleLifecycleChanged();
        activeSearchFeedbackForm?.notifyBundleLifecycleChanged();
        if (bundleIdentityChanged) {
          if (
            resultsHostContext === "review" ||
            resultsHostContext === "saved_vocabulary" ||
            resultsHostContext === "entry_from_saved"
          ) {
            invalidateCollectionAndReviewContexts();
            resultsHostContext = "search";
            searchResults.innerHTML = "";
            disposeActiveCorrectionForm();
          } else {
            invalidateCollectionAndReviewContexts();
          }
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
  searchChrome.dataset.searchReady = hasActiveBundle ? "true" : "false";
  searchInput.disabled = !hasActiveBundle || busy;
  langToggle.disabled = !hasActiveBundle || busy;
  updateFeaturedInstallControls();
  if (!hasActiveBundle) {
    searchMeta.textContent = "";
    searchResults.innerHTML = "";
  }
  updateLangToggle();
  if (
    appShell.dataset.primary === "more" &&
    appShell.dataset.moreView === "landing" &&
    !moreDestination.hidden
  ) {
    mountMoreLanding();
  }
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
      // Drop Saved Vocabulary / Review / correction hosts and focus intent before refresh.
      disposeActiveCorrectionManagement();
      disposeActiveSearchFeedbackManagement();
      disposeActiveCorrectionForm();
      disposeActiveSearchFeedbackForm();
      invalidateCollectionAndReviewContexts();
      learningBackupSurface?.dispose();
      learningBackupSurface = createAndMountLearningBackupSurface();
      resultsHostContext = "search";
      searchResults.innerHTML = "";
      lastKnownActiveBundleId = undefined;
      importProgress.textContent = t("db.deleted");
    } catch (e) {
      importProgress.textContent += t("db.deleteFailed", { error: String(e) });
    }
    await refreshDbStatus();
    await updateLearningBackupDeleteReminder();
    await updateCorrectionFeedbackDeleteReminder();
    await updateSearchFeedbackDeleteReminder();
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
  const locale = getCurrentLocale();
  const sourceLanguageLabel = getSourceLabel(
    currentActiveBundle?.language_meta,
    t("language.source"),
    locale,
  );
  const targetLanguageLabel = getTargetLabel(
    currentActiveBundle?.language_meta,
    t("language.target"),
    locale,
  );
  applySearchDirectionPresentation({
    sourceLabelEl: searchSourceLanguage,
    targetLabelEl: searchTargetLanguage,
    swapButton: langToggle,
    searchLabelEl: searchLabel,
    direction: searchDirection,
    sourceLanguageLabel,
    targetLanguageLabel,
  });
  searchInput.placeholder = getSearchPlaceholder(
    searchDirection,
    currentActiveBundle?.language_meta,
    t("language.source"),
    t("language.target"),
    (label) => t("search.placeholder", { language: label }),
    locale,
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
  // Direction change invalidates any prior executed-search capture context.
  clearExecutedSearchSnapshot();
  activeSearchFeedbackForm?.notifySearchChanged();
  if (
    resultsHostContext === "search" &&
    !activeSearchFeedbackForm &&
    lastSearchResults.length > 0
  ) {
    showResultsList();
  } else if (resultsHostContext === "search" && !activeSearchFeedbackForm) {
    const entry = searchResults.querySelector("[data-testid^='search-feedback-entry']");
    entry?.remove();
  }
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
/**
 * One-use intent: focus the enabled Start/Continue Review action after returning
 * from Review (LS3I3). Falls back to the Saved Vocabulary heading when the
 * action is missing or disabled.
 */
let focusReviewActionOnce = false;
let lastSearchResults: ResultDisplayContext[] = [];
/** Track active bundle id so switches invalidate collection/Review contexts. */
let lastKnownActiveBundleId: string | undefined;
/** Track content hash so dictionary updates invalidate live correction forms. */
let lastKnownActiveContentSha: string | undefined;
let learningBackupSurface: ReturnType<typeof createLearningBackupSurface> | undefined;
/** CF1I4 seam: bump when a local correction draft is created/edited/deleted. */
let correctionManagementGeneration = 0;
let correctionFormGeneration = 0;
let activeCorrectionForm: CorrectionFormController | undefined;
let activeCorrectionManagement: CorrectionManagementSession | undefined;
/** Settled search-event snapshot for CF2 capture (cleared when a new search starts). */
let lastExecutedSearch: ExecutedSearchSnapshot | undefined;
let searchFeedbackFormGeneration = 0;
let activeSearchFeedbackForm: SearchFeedbackCaptureController | undefined;
/** CF2I4 seam: bump when local search feedback is created (invalidates mounted manage host). */
let searchFeedbackManagementGeneration = 0;
let activeSearchFeedbackManagement: SearchFeedbackManagementSession | undefined;

/** Explicit host context for #searchResults navigation (LS1I3 / LS2I3 / LS2I4 / LS3I3). */
type ResultsHostContext =
  | "search"
  | "saved_vocabulary"
  | "entry_from_search"
  | "entry_from_saved"
  | "review";
let resultsHostContext: ResultsHostContext = "search";

/**
 * UX2I2 — top-level consumer destination (separate from ResultsHostContext).
 * UX2_NAVIGATION_AMENDMENT: Review is a stable primary destination.
 */
let primaryDestination: PrimaryDestination = "search";
let primaryNavView: PrimaryNavigationView | undefined;
type ManagementReturnTo = "more" | "search";

function setPrimaryDestination(destination: PrimaryDestination): void {
  primaryDestination = destination;
  appShell.dataset.primary = destination;
  primaryNavView?.setActive(destination);
}

/** Presentation-only Search workspace mode (not persisted). */
type SearchViewMode = "search" | "entry";

function setSearchView(view: SearchViewMode): void {
  appShell.dataset.searchView = view;
}

function focusPrimaryHeading(destination: PrimaryDestination): void {
  if (destination === "search") {
    searchHeading.focus();
    return;
  }
  if (destination === "more") {
    moreHeading?.focus();
    return;
  }
  if (destination === "saved") {
    const heading = searchResults.querySelector<HTMLElement>("#saved-vocab-heading");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
    return;
  }
  if (destination === "review") {
    const heading = searchResults.querySelector<HTMLElement>(
      ".review-title, #review-heading, [data-testid='review-title']",
    );
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
  }
}

type MoreViewMode = "landing" | "management";
type MoreManagementMode = "dictionaries" | "learning_data";

function setMoreView(view: MoreViewMode): void {
  appShell.dataset.moreView = view;
}

function hideMoreLanding(): void {
  moreDestination.hidden = true;
}

function hideMoreManagementHost(): void {
  moreManagementHost.hidden = true;
  delete appShell.dataset.moreManagement;
  dictionaryManagementSurface.hidden = true;
  learningDataSurface.hidden = true;
}

function setMoreManagementMode(mode: MoreManagementMode): void {
  const token = mode === "learning_data" ? "learning-data" : "dictionaries";
  appShell.dataset.moreManagement = token;
  const showDictionaries = mode === "dictionaries";
  dictionaryManagementSurface.hidden = !showDictionaries;
  learningDataSurface.hidden = showDictionaries;
}

function openMoreManagement(mode: MoreManagementMode): void {
  setPrimaryDestination("more");
  hideMoreLanding();
  disposeActiveReviewHost();
  disposeActiveCorrectionForm();
  disposeActiveSearchFeedbackForm();
  disposeActiveCorrectionManagement();
  disposeActiveSearchFeedbackManagement();
  searchResults.innerHTML = "";
  setMoreView("management");
  setMoreManagementMode(mode);
  moreManagementHost.hidden = false;
  void learningBackupSurface?.refreshCount();
  void updateCorrectionFeedbackDeleteReminder();
  void updateSearchFeedbackDeleteReminder();
  if (mode === "learning_data") {
    learningBackupHost.scrollIntoView({ behavior: "smooth", block: "start" });
    const backupHeading =
      learningBackupHost.querySelector<HTMLElement>("#learning-backup-heading") ??
      learningBackupHost.querySelector<HTMLElement>("h2, h3, .title");
    backupHeading?.setAttribute("tabindex", "-1");
    backupHeading?.focus();
    return;
  }
  dictionariesAdvanced.open = false;
  dictionaryManagementHeading.focus();
}

function mountMoreLanding(): void {
  const view = renderMore(
    {
      theme: getCurrentUiThemePreference(),
      locale: getCurrentLocale(),
      appVersion: APP_VERSION,
      hasActiveDictionary: hasActiveBundle,
    },
    {
      onOpenCorrections: () => {
        showCorrectionManagement({ returnTo: "more" });
      },
      onOpenSearchFeedback: () => {
        showSearchFeedbackManagement({ returnTo: "more" });
      },
      onOpenDictionaries: () => {
        openMoreManagement("dictionaries");
      },
      onOpenLearningData: () => {
        openMoreManagement("learning_data");
      },
      onThemeChange: (theme) => {
        if (theme === getCurrentUiThemePreference()) return;
        setUiThemePreferenceWithPersistence(theme);
        if (appShell.dataset.primary === "more" && appShell.dataset.moreView === "landing") {
          mountMoreLanding();
        }
      },
      onLocaleChange: (locale) => {
        if (locale === getCurrentLocale()) return;
        setCurrentLocaleWithPersistence(locale);
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      },
    },
  );
  moreDestination.replaceChildren(view.root);
  moreHeading = view.heading as HTMLHeadingElement;
}

function showMoreLandingSurface(): void {
  hideMoreManagementHost();
  setMoreView("landing");
  mountMoreLanding();
  moreDestination.hidden = false;
}

function closeMoreManagementBridge(): void {
  hideMoreManagementHost();
  setPrimaryDestination("more");
  showMoreLandingSurface();
  focusPrimaryHeading("more");
}

/** @deprecated Prefer openMoreManagement("dictionaries") */
function openDictionariesFromMore(): void {
  openMoreManagement("dictionaries");
}

function restoreSearchDestinationSurface(): void {
  disposeActiveCorrectionForm();
  disposeActiveCorrectionManagement();
  disposeActiveSearchFeedbackForm();
  disposeActiveSearchFeedbackManagement();
  if (lastSearchResults.length > 0) {
    showResultsList();
    return;
  }
  if (lastExecutedSearch?.result_state === "no_result") {
    showNoResultSearchSurface(lastExecutedSearch.query_raw);
    return;
  }
  invalidateCollectionAndReviewContexts();
  resultsHostContext = "search";
  searchResults.innerHTML = "";
}

/**
 * Application-owned primary navigation coordinator (UX2I2).
 * Preserves search query/direction/results; does not persist destination.
 */
function navigatePrimary(destination: PrimaryDestination): void {
  if (destination === "search") {
    hideMoreLanding();
    hideMoreManagementHost();
    setPrimaryDestination("search");
    if (
      resultsHostContext === "search" &&
      (lastSearchResults.length > 0 || lastExecutedSearch?.result_state === "no_result")
    ) {
      // Already on Search with a valid surface — keep it.
      if (searchResults.childElementCount === 0) {
        restoreSearchDestinationSurface();
      }
      focusPrimaryHeading("search");
      return;
    }
    if (resultsHostContext === "entry_from_search") {
      restoreSearchDestinationSurface();
      focusPrimaryHeading("search");
      return;
    }
    restoreSearchDestinationSurface();
    focusPrimaryHeading("search");
    return;
  }

  if (destination === "saved") {
    hideMoreLanding();
    hideMoreManagementHost();
    setSearchView("search");
    showSavedVocabulary();
    return;
  }

  if (destination === "review") {
    hideMoreLanding();
    hideMoreManagementHost();
    setSearchView("search");
    showReviewSurface();
    return;
  }

  // more
  disposeActiveReviewHost();
  disposeActiveCorrectionForm();
  disposeActiveSearchFeedbackForm();
  disposeActiveCorrectionManagement();
  disposeActiveSearchFeedbackManagement();
  savedVocabularyGeneration += 1;
  entryDetailGeneration += 1;
  resultsHostContext = "search";
  setSearchView("search");
  searchResults.innerHTML = "";
  hideMoreManagementHost();
  setPrimaryDestination("more");
  showMoreLandingSurface();
  focusPrimaryHeading("more");
}

function disposeActiveReviewHost() {
  activeReviewHost?.dispose();
  activeReviewHost = undefined;
  reviewGeneration += 1;
}

function disposeActiveCorrectionForm() {
  activeCorrectionForm?.dispose();
  activeCorrectionForm = undefined;
  correctionFormGeneration += 1;
}

function disposeActiveSearchFeedbackForm() {
  activeSearchFeedbackForm?.dispose();
  activeSearchFeedbackForm = undefined;
  searchFeedbackFormGeneration += 1;
}

function invalidateCorrectionManagementGeneration() {
  correctionManagementGeneration += 1;
  // Stale async results from a mounted management session are ignored via isCurrent.
}

function invalidateSearchFeedbackManagementGeneration() {
  searchFeedbackManagementGeneration += 1;
}

function disposeActiveSearchFeedbackManagement() {
  activeSearchFeedbackManagement?.dispose();
  activeSearchFeedbackManagement = undefined;
  searchFeedbackManagementGeneration += 1;
}

async function updateSearchFeedbackDeleteReminder(): Promise<void> {
  try {
    const db = await openSiralexDb();
    try {
      const count = await countSearchFeedbackDrafts(db);
      if (count > 0) {
        searchFeedbackDeleteReminder.hidden = false;
        searchFeedbackDeleteReminder.replaceChildren();
        searchFeedbackDeleteReminder.appendChild(
          document.createTextNode(`${t("searchFeedback.manage.deleteReminder")} `),
        );
        const link = document.createElement("button");
        link.type = "button";
        link.className = "btn";
        link.textContent = t("searchFeedback.manage.deleteReminderAction");
        link.addEventListener("click", () => {
          showSearchFeedbackManagement({ returnTo: "more" });
        });
        searchFeedbackDeleteReminder.appendChild(link);
      } else {
        searchFeedbackDeleteReminder.hidden = true;
        searchFeedbackDeleteReminder.replaceChildren();
      }
    } finally {
      db.close();
    }
  } catch {
    searchFeedbackDeleteReminder.hidden = true;
    searchFeedbackDeleteReminder.replaceChildren();
  }
}

function clearExecutedSearchSnapshot(): void {
  lastExecutedSearch = undefined;
}

function getCurrentExecutedSearch(): ExecutedSearchSnapshot | undefined {
  return lastExecutedSearch;
}

function disposeActiveCorrectionManagement() {
  activeCorrectionManagement?.dispose();
  activeCorrectionManagement = undefined;
  correctionManagementGeneration += 1;
}

async function updateCorrectionFeedbackDeleteReminder(): Promise<void> {
  try {
    const db = await openSiralexDb();
    try {
      const count = await countCorrectionDrafts(db);
      if (count > 0) {
        correctionFeedbackDeleteReminder.hidden = false;
        correctionFeedbackDeleteReminder.replaceChildren();
        correctionFeedbackDeleteReminder.appendChild(
          document.createTextNode(`${t("correctionFeedback.manage.deleteReminder")} `),
        );
        const link = document.createElement("button");
        link.type = "button";
        link.className = "btn";
        link.textContent = t("correctionFeedback.manage.deleteReminderAction");
        link.addEventListener("click", () => {
          showCorrectionManagement({ returnTo: "more" });
        });
        correctionFeedbackDeleteReminder.appendChild(link);
      } else {
        correctionFeedbackDeleteReminder.hidden = true;
        correctionFeedbackDeleteReminder.replaceChildren();
      }
    } finally {
      db.close();
    }
  } catch {
    correctionFeedbackDeleteReminder.hidden = true;
    correctionFeedbackDeleteReminder.replaceChildren();
  }
}

function showSearchFeedbackManagement(
  options: { returnTo?: ManagementReturnTo } = {},
): void {
  const returnTo = options.returnTo ?? "more";
  disposeActiveReviewHost();
  disposeActiveCorrectionForm();
  disposeActiveSearchFeedbackForm();
  disposeActiveCorrectionManagement();
  disposeActiveSearchFeedbackManagement();
  const generation = ++searchFeedbackManagementGeneration;
  resultsHostContext = "search";
  entryDetailGeneration += 1;
  savedVocabularyGeneration += 1;
  hideMoreLanding();
  hideMoreManagementHost();
  setPrimaryDestination("more");
  searchResults.innerHTML = "";

  let viewUpdate:
    | ((vm: ReturnType<SearchFeedbackManagementSession["getVm"]>) => void)
    | undefined;
  const session = createSearchFeedbackManagementSession({
    openDb: openSiralexDb,
    dbOwnership: "controller_owned",
    now: () => new Date().toISOString(),
    appVersion: APP_VERSION,
    sendForReviewAvailable: FEEDBACK_HANDOFF_AVAILABLE,
    reviewEmail: FEEDBACK_EMAIL,
    performHandoff: (artifact) =>
      performConfiguredFeedbackHandoff(artifact, "search_feedback"),
    isCurrent: () =>
      generation === searchFeedbackManagementGeneration &&
      activeSearchFeedbackManagement === session,
    onModel: (vm) => {
      viewUpdate?.(vm);
    },
    onFeedbackChanged: () => {
      void updateSearchFeedbackDeleteReminder();
    },
  });
  activeSearchFeedbackManagement = session;

  const view = renderSearchFeedbackManagement(session.getVm(), {
    onOpenDetail: (feedbackId) => {
      void session.openDetail(feedbackId);
    },
    onBackToList: () => session.backToList(),
    onStartEdit: () => session.startEdit(),
    onCancelEdit: () => session.cancelEdit(),
    onSaveEdit: () => {
      void session.saveEdit();
    },
    onRequestedMeaningChange: (value) => session.setEditRequestedMeaning(value),
    onUserDescriptionChange: (value) => session.setEditUserDescription(value),
    onRequestDelete: () => session.requestDelete(),
    onCancelDelete: () => session.cancelDelete(),
    onConfirmDelete: () => {
      void session.confirmDelete();
    },
    onExport: () => {
      void session.exportAll();
    },
    onAcknowledgeExport: () => session.acknowledgeExport(),
    onRequestSendForReview: () => session.requestSendForReview(),
    onCancelSendForReview: () => session.cancelSendForReview(),
    onConfirmSendForReview: () => {
      void session.confirmSendForReview();
    },
    onAcknowledgeHandoff: () => session.acknowledgeHandoff(),
    onBack: () => {
      disposeActiveSearchFeedbackManagement();
      if (returnTo === "more") {
        navigatePrimary("more");
        return;
      }
      if (lastSearchResults.length > 0) {
        showResultsList();
      } else if (lastExecutedSearch?.result_state === "no_result") {
        showNoResultSearchSurface(lastExecutedSearch.query_raw);
      } else {
        searchResults.innerHTML = "";
      }
    },
  });
  viewUpdate = view.update;
  searchResults.appendChild(view.root);
  void session.load();
}

function showCorrectionManagement(options: { returnTo?: ManagementReturnTo } = {}): void {
  const returnTo = options.returnTo ?? "more";
  disposeActiveReviewHost();
  disposeActiveCorrectionForm();
  disposeActiveSearchFeedbackForm();
  disposeActiveSearchFeedbackManagement();
  disposeActiveCorrectionManagement();
  const generation = ++correctionManagementGeneration;
  resultsHostContext = "search";
  entryDetailGeneration += 1;
  savedVocabularyGeneration += 1;
  hideMoreLanding();
  hideMoreManagementHost();
  setPrimaryDestination("more");
  searchResults.innerHTML = "";

  let viewUpdate: ((vm: ReturnType<CorrectionManagementSession["getVm"]>) => void) | undefined;
  const session = createCorrectionManagementSession({
    openDb: openSiralexDb,
    dbOwnership: "controller_owned",
    now: () => new Date().toISOString(),
    appVersion: APP_VERSION,
    sendForReviewAvailable: FEEDBACK_HANDOFF_AVAILABLE,
    reviewEmail: FEEDBACK_EMAIL,
    performHandoff: (artifact) =>
      performConfiguredFeedbackHandoff(artifact, "correction_feedback"),
    isCurrent: () =>
      generation === correctionManagementGeneration && activeCorrectionManagement === session,
    onModel: (vm) => {
      viewUpdate?.(vm);
    },
    onDraftsChanged: () => {
      // Do not bump generation here — this session is the live host.
      void updateCorrectionFeedbackDeleteReminder();
    },
  });
  activeCorrectionManagement = session;

  const view = renderCorrectionManagement(session.getVm(), {
    onOpenDetail: (draftId) => {
      void session.openDetail(draftId);
    },
    onBackToList: () => session.backToList(),
    onStartEdit: () => session.startEdit(),
    onCancelEdit: () => session.cancelEdit(),
    onSaveEdit: () => {
      void session.saveEdit();
    },
    onIssueTypeChange: (value) => session.setEditIssueType(value),
    onModeChange: (mode) => session.setEditMode(mode),
    onTargetChange: (key) => session.setEditTargetKey(key),
    onProblemDescriptionChange: (value) => session.setEditProblemDescription(value),
    onProposedValueChange: (value) => session.setEditProposedValue(value),
    onOtherFieldLabelChange: (value) => session.setEditOtherFieldLabel(value),
    onRequestDelete: () => session.requestDelete(),
    onCancelDelete: () => session.cancelDelete(),
    onConfirmDelete: () => {
      void session.confirmDelete();
    },
    onExport: () => {
      void session.exportAll();
    },
    onAcknowledgeExport: () => session.acknowledgeExport(),
    onRequestSendForReview: () => session.requestSendForReview(),
    onCancelSendForReview: () => session.cancelSendForReview(),
    onConfirmSendForReview: () => {
      void session.confirmSendForReview();
    },
    onAcknowledgeHandoff: () => session.acknowledgeHandoff(),
    onBack: () => {
      disposeActiveCorrectionManagement();
      if (returnTo === "more") {
        navigatePrimary("more");
        return;
      }
      if (lastSearchResults.length > 0) {
        showResultsList();
      } else {
        searchResults.innerHTML = "";
      }
    },
  });
  viewUpdate = view.update;
  searchResults.appendChild(view.root);
  void session.load();
}

function invalidateCollectionAndReviewContexts() {
  disposeActiveReviewHost();
  savedVocabularyGeneration += 1;
  entryDetailGeneration += 1;
  focusReviewActionOnce = false;
  // Keep mounted correction / search-feedback forms; mark stale so Save cannot retarget.
  activeCorrectionForm?.notifyHostInvalidated();
  activeSearchFeedbackForm?.notifyHostInvalidated();
}

function mountLearningBackupModel(
  surface: NonNullable<typeof learningBackupSurface>,
): void {
  renderLearningBackupSurface(learningBackupHost, surface.getVm(), {
    onExport: () => {
      void surface.startExport();
    },
    onFileSelected: (file) => {
      void surface.selectRestoreFile(file);
    },
    onSelectPolicy: (policy) => surface.selectPolicy(policy),
    onRequestCommit: () => surface.requestCommit(),
    onCancelConfirm: () => surface.cancelConfirm(),
    onConfirmReplaceAll: () => surface.confirmReplaceAll(),
    onCancelRestore: () => surface.cancelRestore(),
    onOpenSavedVocabulary: () => showSavedVocabulary(),
  });
}

function createAndMountLearningBackupSurface(): NonNullable<typeof learningBackupSurface> {
  // `createLearningBackupSurface` emits synchronously during construction. Do not close over a
  // `const surface = create...` binding — that is still in the TDZ when onModel runs.
  let surface: NonNullable<typeof learningBackupSurface> | undefined;
  const created = createLearningBackupSurface(
    {
      openDb: openSiralexDb,
      now: () => new Date().toISOString(),
      appVersion: APP_VERSION,
    },
    {
      onModel: () => {
        if (!surface || learningBackupSurface !== surface) return;
        mountLearningBackupModel(surface);
        void updateLearningBackupDeleteReminder();
      },
      onAfterRestoreSuccess: () => {
        invalidateCollectionAndReviewContexts();
        if (
          resultsHostContext === "review" ||
          resultsHostContext === "saved_vocabulary" ||
          resultsHostContext === "entry_from_saved"
        ) {
          resultsHostContext = "search";
          searchResults.innerHTML = "";
        }
      },
    },
  );
  surface = created;
  learningBackupSurface = created;
  mountLearningBackupModel(created);
  return created;
}

async function updateLearningBackupDeleteReminder(): Promise<void> {
  const count = learningBackupSurface?.getVm().recordCount ?? null;
  if (count != null && count > 0) {
    learningBackupDeleteReminder.hidden = false;
    learningBackupDeleteReminder.replaceChildren();
    learningBackupDeleteReminder.appendChild(
      document.createTextNode(`${t("learningBackup.deleteReminder")} `),
    );
    const link = document.createElement("button");
    link.type = "button";
    link.className = "btn";
    link.textContent = t("learningBackup.deleteReminderAction");
    link.addEventListener("click", () => {
      openMoreManagement("learning_data");
    });
    learningBackupDeleteReminder.appendChild(link);
  } else {
    learningBackupDeleteReminder.hidden = true;
    learningBackupDeleteReminder.replaceChildren();
  }
}

createAndMountLearningBackupSurface();
void updateCorrectionFeedbackDeleteReminder();
void updateSearchFeedbackDeleteReminder();

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
    clearExecutedSearchSnapshot();
    activeSearchFeedbackForm?.notifySearchChanged();
    disposeActiveSearchFeedbackForm();
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

function showNoResultSearchSurface(query: string): void {
  resultsHostContext = "search";
  setSearchView("search");
  disposeActiveCorrectionForm();
  disposeActiveCorrectionManagement();
  disposeActiveSearchFeedbackForm();
  disposeActiveSearchFeedbackManagement();
  searchResults.innerHTML = "";
  if (!canOfferSearchFeedbackCapture(lastExecutedSearch)) return;
  searchResults.appendChild(
    renderNoResultSearchFeedbackEntry(query, () => {
      showSearchFeedbackCapture();
    }),
  );
}

function restoreSearchSurfaceAfterFeedback(): void {
  // Detach controller without bumping host generation twice via surface restore helpers.
  activeSearchFeedbackForm?.dispose();
  activeSearchFeedbackForm = undefined;
  searchFeedbackFormGeneration += 1;
  if (!lastExecutedSearch) {
    searchResults.innerHTML = "";
    return;
  }
  if (lastExecutedSearch.result_state === "no_result") {
    searchMeta.textContent = getNoResultMessage(lastExecutedSearch.query_raw);
    // Avoid disposeActiveSearchFeedbackForm again inside showNoResultSearchSurface —
    // generation already advanced above; rebuild surface directly.
    resultsHostContext = "search";
    disposeActiveCorrectionForm();
    disposeActiveCorrectionManagement();
    searchResults.innerHTML = "";
    if (canOfferSearchFeedbackCapture(lastExecutedSearch)) {
      searchResults.appendChild(
        renderNoResultSearchFeedbackEntry(lastExecutedSearch.query_raw, () => {
          showSearchFeedbackCapture();
        }),
      );
    }
    return;
  }
  if (lastSearchResults.length > 0) {
    // showResultsList disposes search-feedback form; keep results + CTA.
    resultsHostContext = "search";
    disposeActiveCorrectionForm();
    disposeActiveCorrectionManagement();
    invalidateCollectionAndReviewContexts();
    searchResults.innerHTML = "";
    const list = renderResultsList(lastSearchResults, (record) => {
      showEntryDetail(record, {
        kind: "search",
        restoreDirection: searchDirection,
      });
    });
    if (list) searchResults.appendChild(list);
    if (canOfferSearchFeedbackCapture(lastExecutedSearch)) {
      searchResults.appendChild(
        renderResultsNotUsefulSearchFeedbackEntry(() => {
          showSearchFeedbackCapture();
        }),
      );
    }
    return;
  }
  searchResults.innerHTML = "";
}

function showSearchFeedbackCapture(): void {
  const context = lastExecutedSearch
    ? buildSearchFeedbackCaptureContext(lastExecutedSearch)
    : undefined;
  if (!context) return;

  disposeActiveSearchFeedbackForm();
  disposeActiveCorrectionForm();
  disposeActiveCorrectionManagement();
  disposeActiveReviewHost();
  const generation = ++searchFeedbackFormGeneration;
  resultsHostContext = "search";
  setSearchView("search");
  entryDetailGeneration += 1;
  searchResults.innerHTML = "";

  let viewUpdate:
    | ((vm: ReturnType<SearchFeedbackCaptureController["getViewModel"]>) => void)
    | undefined;

  const controller = createSearchFeedbackCaptureController({
    context,
    openDb: openSiralexDb,
    dbOwnership: "controller_owned",
    getActiveMeta: () => currentActiveBundle,
    getCurrentExecutedSearch,
    isCurrent: () =>
      generation === searchFeedbackFormGeneration &&
      activeSearchFeedbackForm === controller,
    onModel: (vm) => {
      viewUpdate?.(vm);
    },
    onCancel: () => {
      restoreSearchSurfaceAfterFeedback();
    },
    onBackToSearch: () => {
      restoreSearchSurfaceAfterFeedback();
    },
    onFeedbackSaved: () => {
      invalidateSearchFeedbackManagementGeneration();
      void updateSearchFeedbackDeleteReminder();
    },
  });
  activeSearchFeedbackForm = controller;

  const formView = renderSearchFeedbackCapture(controller.getViewModel(), {
    onRequestedMeaningChange: (value) => controller.setRequestedMeaning(value),
    onUserDescriptionChange: (value) => controller.setUserDescription(value),
    onSave: () => {
      void controller.save();
    },
    onCancel: () => controller.cancel(),
    onBackToSearch: () => controller.backToSearch(),
  });
  viewUpdate = formView.update;
  searchResults.appendChild(formView.root);
  controller.start();

  const heading = formView.root.querySelector<HTMLElement>(
    "#search-feedback-capture-heading",
  );
  heading?.setAttribute("tabindex", "-1");
  heading?.focus();
}

function showResultsList() {
  resultsHostContext = "search";
  setSearchView("search");
  disposeActiveCorrectionForm();
  disposeActiveCorrectionManagement();
  disposeActiveSearchFeedbackForm();
  disposeActiveSearchFeedbackManagement();
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

  if (canOfferSearchFeedbackCapture(lastExecutedSearch)) {
    searchResults.appendChild(
      renderResultsNotUsefulSearchFeedbackEntry(() => {
        showSearchFeedbackCapture();
      }),
    );
  }
}

/**
 * Open Review from Saved Vocabulary (LS2I4 / LS3I3).
 * Start and Continue share this path: one fresh ephemeral LS2 Review session.
 * Back returns to Saved Vocabulary with one-use Review-action focus restoration.
 */
function showReviewSurface() {
  disposeActiveReviewHost();
  disposeActiveCorrectionForm();
  disposeActiveSearchFeedbackForm();
  disposeActiveCorrectionManagement();
  disposeActiveSearchFeedbackManagement();
  const generation = ++reviewGeneration;
  resultsHostContext = "review";
  entryDetailGeneration += 1;
  savedVocabularyGeneration += 1;
  focusReviewActionOnce = false;
  hideMoreLanding();
  hideMoreManagementHost();
  setPrimaryDestination("review");
  searchResults.innerHTML = "";

  const host = createReviewSurfaceHost({
    mount: searchResults,
    getActiveMeta: () => currentActiveBundle,
    openDb: openSiralexDb,
    isHostCurrent: () =>
      generation === reviewGeneration && resultsHostContext === "review",
    onBack: () => {
      disposeActiveReviewHost();
      focusReviewActionOnce = true;
      // UX2: Review Back returns to Saved and syncs primary nav.
      showSavedVocabulary();
    },
  });
  // Ownership: only this host may present while active; dispose before replace.
  activeReviewHost = host;
  host.start();
  queueMicrotask(() => focusPrimaryHeading("review"));
}

function showSavedVocabulary() {
  disposeActiveReviewHost();
  disposeActiveCorrectionForm();
  disposeActiveSearchFeedbackForm();
  disposeActiveCorrectionManagement();
  disposeActiveSearchFeedbackManagement();
  const generation = ++savedVocabularyGeneration;
  resultsHostContext = "saved_vocabulary";
  entryDetailGeneration += 1;
  hideMoreLanding();
  hideMoreManagementHost();
  setPrimaryDestination("saved");
  searchResults.innerHTML = "";

  let lastFocusTarget: HTMLElement | null = null;
  const restoreReviewActionFocus = focusReviewActionOnce;
  focusReviewActionOnce = false;
  let didRestoreFocus = false;

  const applyModel = (model: SavedVocabularyModel) => {
    if (generation !== savedVocabularyGeneration || resultsHostContext !== "saved_vocabulary") {
      return;
    }
    const view = renderSavedVocabulary(model, {
      onSearch: () => {
        savedVocabularyGeneration += 1;
        navigatePrimary("search");
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
        // Application-owned suppression: one Review host at a time (Start or Continue).
        if (activeReviewHost?.isActive()) return;
        showReviewSurface();
      },
    });
    searchResults.innerHTML = "";
    searchResults.appendChild(view.root);
    lastFocusTarget = view.focusAfterRemove;

    if (restoreReviewActionFocus && !didRestoreFocus && model.surface !== "loading") {
      didRestoreFocus = true;
      if (view.startReviewButton && !view.startReviewButton.disabled) {
        view.startReviewButton.focus();
      } else if (view.heading) {
        view.heading.focus();
      }
    } else if (!restoreReviewActionFocus && !didRestoreFocus && model.surface !== "loading") {
      didRestoreFocus = true;
      view.heading?.setAttribute("tabindex", "-1");
      view.heading?.focus();
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

primaryNavView = renderPrimaryNavigation("search", {
  onNavigate: (destination) => {
    navigatePrimary(destination);
  },
});
primaryNavHost.appendChild(primaryNavView.root);

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

function showCorrectionForm(record: EnrichedRecord, origin: EntryNavOrigin): void {
  const context = currentActiveBundle
    ? buildCorrectionEntryContext(record, currentActiveBundle)
    : null;
  if (!context) return;

  disposeActiveCorrectionForm();
  disposeActiveSearchFeedbackForm();
  disposeActiveReviewHost();
  entryDetailGeneration += 1;
  const generation = ++correctionFormGeneration;
  resultsHostContext = origin.kind === "saved_vocabulary" ? "entry_from_saved" : "entry_from_search";
  if (origin.kind === "search") {
    setSearchView("entry");
  }
  searchResults.innerHTML = "";

  let viewUpdate: ((vm: ReturnType<CorrectionFormController["getViewModel"]>) => void) | undefined;

  const controller = createCorrectionFormController({
    context,
    // Production: controller opens fresh connections and closes them in finally (CF1I3A).
    openDb: openSiralexDb,
    dbOwnership: "controller_owned",
    getActiveMeta: () => currentActiveBundle,
    isCurrent: () => generation === correctionFormGeneration,
    onModel: (vm) => {
      viewUpdate?.(vm);
    },
    onCancel: () => {
      disposeActiveCorrectionForm();
      showEntryDetail(record, origin);
    },
    onBackToEntry: () => {
      disposeActiveCorrectionForm();
      showEntryDetail(record, origin);
    },
    onDraftSaved: () => {
      // Invalidate any mounted management session; refresh deletion reminder.
      invalidateCorrectionManagementGeneration();
      void updateCorrectionFeedbackDeleteReminder();
    },
  });
  activeCorrectionForm = controller;

  const formView = renderCorrectionForm(controller.getViewModel(), {
    onIssueTypeChange: (value) => controller.setIssueType(value),
    onTargetChange: (key) => controller.setTargetKey(key),
    onModeChange: (mode) => controller.setMode(mode),
    onProblemDescriptionChange: (value) => controller.setProblemDescription(value),
    onProposedValueChange: (value) => controller.setProposedValue(value),
    onOtherFieldLabelChange: (value) => controller.setOtherFieldLabel(value),
    onSave: () => {
      void controller.save();
    },
    onCancel: () => controller.cancel(),
    onBackToEntry: () => controller.backToEntry(),
  });
  viewUpdate = formView.update;
  searchResults.appendChild(formView.root);
  controller.start();

  const heading = formView.root.querySelector<HTMLElement>("#correction-form-heading");
  heading?.setAttribute("tabindex", "-1");
  heading?.focus();
}

function showEntryDetail(record: EnrichedRecord, origin: EntryNavOrigin) {
  const generation = ++entryDetailGeneration;
  resultsHostContext = origin.kind === "saved_vocabulary" ? "entry_from_saved" : "entry_from_search";
  disposeActiveReviewHost();
  disposeActiveCorrectionForm();
  disposeActiveSearchFeedbackForm();
  disposeActiveCorrectionManagement();
  disposeActiveSearchFeedbackManagement();
  if (origin.kind === "search") {
    savedVocabularyGeneration += 1;
    setSearchView("entry");
  } else {
    setSearchView("search");
  }
  searchResults.innerHTML = "";

  const offerLearning = isLexiconDisplay(record);
  const learningAvailable = offerLearning && canOfferLearningSave(record, currentActiveBundle);
  const offerCorrection =
    offerLearning && canOfferCorrectionSuggestion(record, currentActiveBundle);

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
    backLabel:
      origin.kind === "saved_vocabulary" ? t("entry.backToSaved") : t("entry.back"),
    onBack: () => {
      if (origin.kind === "saved_vocabulary") {
        setSearchView("search");
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
    onSuggestCorrection: offerCorrection
      ? () => {
          if (generation !== entryDetailGeneration) return;
          showCorrectionForm(record, origin);
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
  // New execution invalidates any prior capture context immediately.
  clearExecutedSearchSnapshot();
  activeSearchFeedbackForm?.notifySearchChanged();
  const executedDirection = searchDirection;
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
      executedDirection,
      query,
      activeBundleMeta.search_index_directional === true,
    );
    if (seq !== searchSeq) return;

    if (result.ir_ids.length === 0) {
      searchMeta.textContent = getNoResultMessage(query);
      invalidateCollectionAndReviewContexts();
      resultsHostContext = "search";
      lastSearchResults = [];
      const contentSha = activeBundleMeta.expected_content_sha256;
      if (contentSha) {
        lastExecutedSearch = {
          generation: seq,
          query_raw: query,
          search_direction: executedDirection,
          result_state: "no_result",
          result_count: 0,
          bundle_id: activeBundleMeta.bundle_id,
          content_sha256: contentSha,
          storage_scope_id: activeStorageScopeId,
        };
      }
      showNoResultSearchSurface(query);
      scheduleSettledQueryLog({
        seq,
        query,
        direction: executedDirection,
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
      count: records.length,
    });

    lastSearchResults = records.map((record) => ({
      rawQuery: query,
      searchDirection: executedDirection,
      matched_key_type: result.matched_key_type,
      matched_key: result.matched_key,
      sourceLabel: getLocalizedSourceLabel(activeBundleMeta.language_meta),
      targetLabel: getLocalizedTargetLabel(activeBundleMeta.language_meta),
      record,
    }));
    const matchedIrIds = deriveMatchedIrIdsFromRecords(records);
    const contentSha = activeBundleMeta.expected_content_sha256;
    if (contentSha) {
      lastExecutedSearch = {
        generation: seq,
        query_raw: query,
        search_direction: executedDirection,
        result_state: "results_not_useful",
        result_count: records.length,
        ...(matchedIrIds !== undefined ? { matched_ir_ids: matchedIrIds } : {}),
        bundle_id: activeBundleMeta.bundle_id,
        content_sha256: contentSha,
        storage_scope_id: activeStorageScopeId,
      };
    }
    showResultsList();
    scheduleSettledQueryLog({
      seq,
      query,
      direction: executedDirection,
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
    clearExecutedSearchSnapshot();
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
