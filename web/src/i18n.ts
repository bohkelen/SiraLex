export type Locale = "en" | "fr";
export const UI_LOCALE_STORAGE_KEY = "siralex.ui_locale";

const SUPPORTED_LOCALES: readonly Locale[] = ["en", "fr"] as const;
type LocaleStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function normalizeLocaleTag(value: string | undefined): Locale | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace("_", "-");
  if (normalized === "") return undefined;
  const base = normalized.split("-")[0];
  return SUPPORTED_LOCALES.includes(base as Locale) ? (base as Locale) : undefined;
}

export function resolveDefaultLocale(
  configuredDefault: string | undefined,
  runtimeLocale: string | undefined,
  storage?: LocaleStorage,
): Locale {
  const saved = getSavedLocalePreference(storage);
  if (saved) return saved;
  const configured = normalizeLocaleTag(configuredDefault);
  if (configured) return configured;
  const runtime = normalizeLocaleTag(runtimeLocale);
  if (runtime) return runtime;
  return "fr";
}

function getDefaultStorage(): LocaleStorage | undefined {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as { localStorage?: LocaleStorage }).localStorage;
  }
  return undefined;
}

export function getSavedLocalePreference(storage: LocaleStorage | undefined = getDefaultStorage()): Locale | undefined {
  try {
    const raw = storage?.getItem(UI_LOCALE_STORAGE_KEY) ?? undefined;
    return normalizeLocaleTag(raw);
  } catch {
    return undefined;
  }
}

export function setSavedLocalePreference(
  locale: Locale,
  storage: LocaleStorage | undefined = getDefaultStorage(),
): void {
  try {
    storage?.setItem(UI_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage write failures.
  }
}

export function clearSavedLocalePreference(storage: LocaleStorage | undefined = getDefaultStorage()): void {
  try {
    storage?.removeItem(UI_LOCALE_STORAGE_KEY);
  } catch {
    // Ignore storage remove failures.
  }
}

const MESSAGES = {
  en: {
    "app.subtitle": "Offline-first dictionary",
    "locale.selectorLabel": "Language",
    "locale.french": "Français",
    "locale.english": "English",
    "search.title": "Search",
    "search.subtitle": "Dictionary-first experience. Install a dictionary if needed, then search.",
    "firstRun.install": "Install dictionary",
    "firstRun.retryInstall": "Retry install",
    "activeDictionary.none": "No active dictionary",
    "manage.open": "Manage dictionaries",
    "search.queryLabel": "Query ({direction})",
    "search.placeholder": "Type a {language} word…",
    "manage.summary": "Manage dictionaries",
    "manage.title": "Manage dictionaries",
    "manage.installedLabel": "Installed dictionaries",
    "manage.noneInstalled": "No dictionaries installed",
    "manage.noInstalledMetadata": "No installed bundle metadata yet.",
    "manage.status.installedBundles": "Installed bundles: {count}",
    "manage.status.activeBundle": "Active bundle: {name}",
    "manage.status.knownPayloadTotal": "Known payload total: {value}",
    "manage.status.browserStorageUsage": "Browser storage usage: {usage} / {quota}",
    "manage.status.sizeMetadataMissing": "Size metadata missing for {count} installed bundle(s).",
    "advancedSetup.summary": "Advanced setup",
    "catalog.urlLabel": "Catalog URL",
    "catalog.urlPlaceholder": "https://example.org/catalog.json or /catalog.json",
    "catalog.load": "Load catalog",
    "import.installFiles": "Install bundle files",
    "import.cancel": "Cancel install",
    "db.delete": "Delete database",
    "diagnostics.summary": "Advanced diagnostics",
    "diagnostics.title": "Validation diagnostics",
    "logging.label": "Validation logging",
    "logging.off": "Off",
    "logging.on": "On",
    "logging.turnOn": "Turn On",
    "logging.turnOff": "Turn Off",
    "logging.export": "Export logs",
    "logging.clear": "Clear logs",
    "logging.localOnly": "Logs stay on this device. No automatic upload.",
    "logging.recentTitle": "Recent query logs (debug)",
    "logging.offNote": "Logging is off.",
    "logging.refresh": "Refresh",
    "dev.summary": "Developer tools",
    "dev.gatingTitle": "Bundle manifest gating",
    "dev.gatingSubtitle": "Select bundle.manifest.json and validate it before any import.",
    "dev.recordsLabel": "records.jsonl (enriched)",
    "dev.validateManifest": "Validate manifest + selected files",
    "dev.importBundle": "Import bundle",
    "dev.probeTitle": "Bundle size & memory probe",
    "dev.probeSubtitle": "Select the bundle JSONL files from disk and run a parse probe.",
    "dev.probeRecords": "Probe records",
    "dev.probeIndex": "Probe index",
    "dev.probeBoth": "Probe both",
    "language.source": "Source",
    "language.target": "Target",
    "catalog.badge.active": "Active",
    "catalog.badge.updateAvailable": "Update available",
    "catalog.badge.installed": "Installed",
    "catalog.badge.available": "Available",
    "catalog.meta.version": "Version {value}",
    "catalog.meta.records": "{count} records",
    "catalog.meta.indexEntries": "{count} index entries",
    "catalog.meta.hash": "Hash {value}",
    "catalog.meta.bundleSource": "Bundle source: {value}",
    "catalog.meta.manifest": "Manifest: {value}",
    "catalog.meta.recordsFile": "Records: {value}",
    "catalog.meta.indexFile": "Index: {value}",
    "catalog.meta.sourceBase": "Source base: {value}",
    "catalog.note.installed": "Installed: {value}",
    "catalog.note.storageScope": "Storage scope: {value}",
    "catalog.note.normalizationSchema": "Normalization: {normalization} | Schema: {schema}",
    "catalog.note.installedHash": "Installed hash: {value}",
    "catalog.note.catalogHash": "Catalog hash: {value}",
    "catalog.note.activeInstalledVersion": "Installed version is active on this device.",
    "catalog.note.installedVersionDiffers": "Installed version differs from catalog hash.",
    "catalog.note.catalogVersion": "Catalog version {value}",
    "catalog.action.update": "Update",
    "catalog.action.use": "Use",
    "catalog.action.remove": "Remove",
    "catalog.action.useInstalled": "Use installed",
    "catalog.action.install": "Install",
    "catalog.empty": "No catalog loaded.",
    "bundle.activeSet": "Active bundle set: {bundleId}\n",
    "bundle.removed": "Removed bundle: {bundleId}\n",
    "bundle.removeConfirm": "Remove installed bundle {bundleId} from this device?",
    "activeDictionary.usingReady": "Using: {name} — ready to search",
    "status.noActiveSelection":
      "Installed bundles are present, but no active bundle is selected.\nChoose a dictionary from the selector or installed-bundles list to enable search.\n",
    "status.partialDataWarning":
      "Warning: partial data from a failed or interrupted import.\nNo active bundle. Search is disabled.\nDelete the database and re-import.\n",
    "import.validatingManifest": "Validating manifest...\n",
    "import.manifestValidationFailed": "Manifest validation failed:\n",
    "import.missingRequiredFiles": "Missing required files: {files}\n\n",
    "import.selectAllThreeFiles":
      "Select all 3 bundle files:\n  bundle.manifest.json\n  records.jsonl\n  search_index.jsonl",
    "import.fileValidationFailedFor": "File validation failed for {bundleId}:\n",
    "import.bundleAlreadyInstalledMarkedActive": "Bundle already installed. Marked active: {bundleId}\n",
    "import.updatingBundle": "Updating installed bundle {bundleId}.\n",
    "import.existingHash": "Existing hash: {hash}\n",
    "import.newHash": "New hash: {hash}\n",
    "import.updatedBundleRemainActive": "Updated bundle will remain active.\n",
    "import.currentActiveRemainUnchanged": "Current active bundle will remain unchanged.\n",
    "import.installingBundle": "Installing {bundleId}...\n",
    "import.installComplete":
      "Install complete: {bundleId}\n{records} records, {indexEntries} index entries\n{elapsed} ms\n",
    "import.importFailed": "\nImport failed: {error}\n",
    "import.partialRemovedReimport": "Partial bundle data removed. Re-import required.\n",
    "catalog.loading": "Loading catalog from {url}...\n",
    "catalog.loaded":
      "Catalog loaded.\nSource: {source}\nBundles: {count}\nFetched at: {fetchedAt}\nRemote policy: https anywhere; http only for same-origin or local hubs (localhost, .local, private IPs).\nBundle URL contract: url_base + bundle.manifest.json / records.jsonl / search_index.jsonl\n",
    "catalog.loadFailed": "Catalog load failed: {error}\n",
    "catalog.showingCachedFrom": "Showing cached catalog from {url}\nFetched at: {fetchedAt}\n",
    "catalog.cachedRestored":
      "Cached catalog restored.\nSource: {source}\nFetched at: {fetchedAt}\nLoad catalog to refresh from the network.\n",
    "catalog.warnPrefix": "WARN: {warning}\n",
    "featured.noEntryFound": "No featured dictionary entry found in catalog",
    "catalog.missingSourceUrl": "No catalog source URL is available for this entry.\n",
    "catalog.prepareRemoteInstall": "Preparing remote install for {bundleId}...\n",
    "catalog.remoteInstallComplete":
      "Remote install complete: {bundleId}\n{records} records, {indexEntries} index entries\n{elapsed} ms\n",
    "catalog.installFailedHeader": "Install FAILED\n",
    "progress.installingPrefix": "Installing",
    "progress.stageLabel": "Stage",
    "progress.stage.fetchManifest": "fetching manifest",
    "progress.stage.fetchRecords": "fetching records.jsonl",
    "progress.stage.fetchSearchIndex": "fetching search_index.jsonl",
    "progress.stage.stagingPayloads": "staging payloads",
    "progress.bytesReadLabel": "bytes read",
    "progress.linesSeenLabel": "lines seen",
    "progress.recordsWrittenLabel": "records written",
    "progress.entriesWrittenLabel": "entries written",
    "progress.batchesCommittedLabel": "batches committed",
    "db.deleting": "Deleting database...\n",
    "db.deleted": "Database deleted.\n",
    "db.deleteFailed": "Delete failed: {error}\n",
    "status.dictionaryReady": "Dictionary ready for offline search.",
    "status.noActiveDictionaryInstalled": "No active dictionary installed yet.",
    "status.noActiveBundle": "No active bundle.\n",
    "status.dbError": "Database error: {error}\n",
    "firstRun.offlineNoDictionary":
      "No dictionary installed and you appear to be offline.\nConnect and retry featured install, or use Manage dictionaries → Advanced setup.",
    "firstRun.onlinePrompt":
      "Install the deployment-configured featured dictionary to start searching.\nAdvanced setup is available for custom catalogs and manual import.",
    "featured.installStarted": "Install started.\n",
    "featured.downloading": "Downloading/preparing dictionary...\n",
    "featured.installed":
      "Installed and ready to search.\nManage dictionaries and advanced setup remain available from Manage dictionaries.",
    "featured.installFailed":
      "Install failed.\n{error}\nRetry install or open Manage dictionaries → Advanced setup for recovery.",
    "logging.noLogsYet": "No logs yet.",
    "logging.recentLogsError": "Recent logs error: {error}",
    "search.disabledBusy": "Search temporarily unavailable during install/update.",
    "search.disabledNoActiveBundle": "Search disabled: no active bundle.",
    "search.noMatch": "Query: \"{query}\" — No matches (all 4 levels checked). {elapsed} ms",
    "search.resultMeta":
      "Query: \"{query}\" — {count} result(s) at level: {level} [key: \"{key}\"] {elapsed} ms",
    "search.error": "Search error: {error}",
    "render.noTranslation": "(no translation available)",
    "render.kindLexicon": "lexicon",
    "render.kindIndex": "index",
    "entry.back": "← Back to results",
    "entry.targetEntriesDefault": "Target entries:",
    "entry.targetEntries": "{label} entries:",
    "entry.noDisplay": "No display data for ir_id: {id}",
    "entry.usage": "Usage: {value}",
    "entry.synShort": "Syn: {value}",
    "entry.variants": "Variants: {value}",
    "entry.synonyms": "Synonyms: {value}",
    "entry.etymology": "Etymology: {value}",
    "entry.literal": "Literal: {value}",
    "entry.meta.irId": "ir_id: {value}",
    "entry.meta.source": "source: {value}",
    "entry.meta.norm": "norm: {value}",
    "entry.meta.corpus": "corpus: {value}",
    "queryLogs.clearConfirm": "Clear all local query logs from this device?",
    "queryLogs.noLogsToExport": "No logs to export.",
    "queryLogs.clearCancelled": "Clear cancelled.",
    "queryLogs.cleared": "Cleared query logs.",
    "queryLogs.count.one": "1 log",
    "queryLogs.count.many": "{count} logs",
    "queryLogs.countError": "Log count error: {error}",
    "queryLogs.exported.one": "Exported 1 log.",
    "queryLogs.exported.many": "Exported {count} logs.",
    "queryLogs.exportFailed": "Export failed: {error}",
    "queryLogs.clearFailed": "Clear failed: {error}",
  },
  fr: {
    "app.subtitle": "Dictionnaire hors ligne d'abord",
    "locale.selectorLabel": "Langue",
    "locale.french": "Français",
    "locale.english": "English",
    "search.title": "Recherche",
    "search.subtitle": "Expérience dictionnaire d'abord. Installez un dictionnaire si nécessaire, puis recherchez.",
    "firstRun.install": "Installer le dictionnaire",
    "firstRun.retryInstall": "Réessayer l'installation",
    "activeDictionary.none": "Aucun dictionnaire actif",
    "manage.open": "Gérer les dictionnaires",
    "search.queryLabel": "Requête ({direction})",
    "search.placeholder": "Saisissez un mot en {language}…",
    "manage.summary": "Gérer les dictionnaires",
    "manage.title": "Gérer les dictionnaires",
    "manage.installedLabel": "Dictionnaires installés",
    "manage.noneInstalled": "Aucun dictionnaire installé",
    "manage.noInstalledMetadata": "Aucune métadonnée de bundle installée pour le moment.",
    "manage.status.installedBundles": "Bundles installés : {count}",
    "manage.status.activeBundle": "Bundle actif : {name}",
    "manage.status.knownPayloadTotal": "Total de charge utile connue : {value}",
    "manage.status.browserStorageUsage": "Utilisation du stockage navigateur : {usage} / {quota}",
    "manage.status.sizeMetadataMissing": "Métadonnées de taille manquantes pour {count} bundle(s) installé(s).",
    "advancedSetup.summary": "Configuration avancée",
    "catalog.urlLabel": "URL du catalogue",
    "catalog.urlPlaceholder": "https://example.org/catalog.json ou /catalog.json",
    "catalog.load": "Charger le catalogue",
    "import.installFiles": "Installer les fichiers du bundle",
    "import.cancel": "Annuler l'installation",
    "db.delete": "Supprimer la base de données",
    "diagnostics.summary": "Diagnostics avancés",
    "diagnostics.title": "Diagnostics de validation",
    "logging.label": "Journalisation de validation",
    "logging.off": "Désactivée",
    "logging.on": "Activée",
    "logging.turnOn": "Activer",
    "logging.turnOff": "Désactiver",
    "logging.export": "Exporter les journaux",
    "logging.clear": "Effacer les journaux",
    "logging.localOnly": "Les journaux restent sur cet appareil. Aucun envoi automatique.",
    "logging.recentTitle": "Journaux de requête récents (debug)",
    "logging.offNote": "La journalisation est désactivée.",
    "logging.refresh": "Actualiser",
    "dev.summary": "Outils développeur",
    "dev.gatingTitle": "Validation du manifeste de bundle",
    "dev.gatingSubtitle": "Sélectionnez bundle.manifest.json et validez-le avant tout import.",
    "dev.recordsLabel": "records.jsonl (enrichi)",
    "dev.validateManifest": "Valider le manifeste + les fichiers sélectionnés",
    "dev.importBundle": "Importer le bundle",
    "dev.probeTitle": "Sonde de taille de bundle et mémoire",
    "dev.probeSubtitle": "Sélectionnez les fichiers JSONL du bundle puis lancez la sonde.",
    "dev.probeRecords": "Sonder records",
    "dev.probeIndex": "Sonder index",
    "dev.probeBoth": "Sonder les deux",
    "language.source": "Source",
    "language.target": "Cible",
    "catalog.badge.active": "Actif",
    "catalog.badge.updateAvailable": "Mise à jour disponible",
    "catalog.badge.installed": "Installé",
    "catalog.badge.available": "Disponible",
    "catalog.meta.version": "Version {value}",
    "catalog.meta.records": "{count} enregistrements",
    "catalog.meta.indexEntries": "{count} entrées d'index",
    "catalog.meta.hash": "Empreinte {value}",
    "catalog.meta.bundleSource": "Source du bundle : {value}",
    "catalog.meta.manifest": "Manifeste : {value}",
    "catalog.meta.recordsFile": "Records : {value}",
    "catalog.meta.indexFile": "Index : {value}",
    "catalog.meta.sourceBase": "Base source : {value}",
    "catalog.note.installed": "Installé : {value}",
    "catalog.note.storageScope": "Portée de stockage : {value}",
    "catalog.note.normalizationSchema": "Normalisation : {normalization} | Schéma : {schema}",
    "catalog.note.installedHash": "Empreinte installée : {value}",
    "catalog.note.catalogHash": "Empreinte du catalogue : {value}",
    "catalog.note.activeInstalledVersion": "La version installée est active sur cet appareil.",
    "catalog.note.installedVersionDiffers": "La version installée diffère de l'empreinte du catalogue.",
    "catalog.note.catalogVersion": "Version du catalogue {value}",
    "catalog.action.update": "Mettre à jour",
    "catalog.action.use": "Utiliser",
    "catalog.action.remove": "Supprimer",
    "catalog.action.useInstalled": "Utiliser l'installé",
    "catalog.action.install": "Installer",
    "catalog.empty": "Aucun catalogue chargé.",
    "bundle.activeSet": "Bundle actif défini : {bundleId}\n",
    "bundle.removed": "Bundle supprimé : {bundleId}\n",
    "bundle.removeConfirm": "Supprimer le bundle installé {bundleId} de cet appareil ?",
    "activeDictionary.usingReady": "Utilisation : {name} — prêt pour la recherche",
    "status.noActiveSelection":
      "Des bundles installés sont présents, mais aucun bundle actif n'est sélectionné.\nChoisissez un dictionnaire dans le sélecteur ou la liste des bundles installés pour activer la recherche.\n",
    "status.partialDataWarning":
      "Avertissement : données partielles issues d'un import échoué ou interrompu.\nAucun bundle actif. La recherche est désactivée.\nSupprimez la base de données puis réimportez.\n",
    "import.validatingManifest": "Validation du manifeste...\n",
    "import.manifestValidationFailed": "Échec de validation du manifeste :\n",
    "import.missingRequiredFiles": "Fichiers requis manquants : {files}\n\n",
    "import.selectAllThreeFiles":
      "Sélectionnez les 3 fichiers du bundle :\n  bundle.manifest.json\n  records.jsonl\n  search_index.jsonl",
    "import.fileValidationFailedFor": "Échec de validation des fichiers pour {bundleId} :\n",
    "import.bundleAlreadyInstalledMarkedActive": "Bundle déjà installé. Marqué actif : {bundleId}\n",
    "import.updatingBundle": "Mise à jour du bundle installé {bundleId}.\n",
    "import.existingHash": "Empreinte existante : {hash}\n",
    "import.newHash": "Nouvelle empreinte : {hash}\n",
    "import.updatedBundleRemainActive": "Le bundle mis à jour restera actif.\n",
    "import.currentActiveRemainUnchanged": "Le bundle actif actuel restera inchangé.\n",
    "import.installingBundle": "Installation de {bundleId}...\n",
    "import.installComplete":
      "Installation terminée : {bundleId}\n{records} enregistrements, {indexEntries} entrées d'index\n{elapsed} ms\n",
    "import.importFailed": "\nÉchec d'import : {error}\n",
    "import.partialRemovedReimport": "Les données partielles du bundle ont été supprimées. Réimport requis.\n",
    "catalog.loading": "Chargement du catalogue depuis {url}...\n",
    "catalog.loaded":
      "Catalogue chargé.\nSource : {source}\nBundles : {count}\nRécupéré à : {fetchedAt}\nPolitique distante : https partout ; http uniquement en même origine ou hubs locaux (localhost, .local, IP privées).\nContrat URL bundle : url_base + bundle.manifest.json / records.jsonl / search_index.jsonl\n",
    "catalog.loadFailed": "Échec du chargement du catalogue : {error}\n",
    "catalog.showingCachedFrom": "Affichage du catalogue en cache depuis {url}\nRécupéré à : {fetchedAt}\n",
    "catalog.cachedRestored":
      "Catalogue en cache restauré.\nSource : {source}\nRécupéré à : {fetchedAt}\nChargez le catalogue pour actualiser depuis le réseau.\n",
    "catalog.warnPrefix": "WARN : {warning}\n",
    "featured.noEntryFound": "Aucune entrée de dictionnaire en vedette trouvée dans le catalogue",
    "catalog.missingSourceUrl": "Aucune URL source de catalogue disponible pour cette entrée.\n",
    "catalog.prepareRemoteInstall": "Préparation de l'installation distante pour {bundleId}...\n",
    "catalog.remoteInstallComplete":
      "Installation distante terminée : {bundleId}\n{records} enregistrements, {indexEntries} entrées d'index\n{elapsed} ms\n",
    "catalog.installFailedHeader": "ÉCHEC D'INSTALLATION\n",
    "progress.installingPrefix": "Installation de",
    "progress.stageLabel": "Étape",
    "progress.stage.fetchManifest": "récupération du manifeste",
    "progress.stage.fetchRecords": "récupération de records.jsonl",
    "progress.stage.fetchSearchIndex": "récupération de search_index.jsonl",
    "progress.stage.stagingPayloads": "préparation des données",
    "progress.bytesReadLabel": "octets lus",
    "progress.linesSeenLabel": "lignes vues",
    "progress.recordsWrittenLabel": "enregistrements écrits",
    "progress.entriesWrittenLabel": "entrées écrites",
    "progress.batchesCommittedLabel": "lots validés",
    "db.deleting": "Suppression de la base de données...\n",
    "db.deleted": "Base de données supprimée.\n",
    "db.deleteFailed": "Échec de suppression : {error}\n",
    "status.dictionaryReady": "Dictionnaire prêt pour la recherche hors ligne.",
    "status.noActiveDictionaryInstalled": "Aucun dictionnaire actif installé pour le moment.",
    "status.noActiveBundle": "Aucun bundle actif.\n",
    "status.dbError": "Erreur de base de données : {error}\n",
    "firstRun.offlineNoDictionary":
      "Aucun dictionnaire installé et vous semblez hors ligne.\nConnectez-vous puis réessayez l'installation en vedette, ou utilisez Gérer les dictionnaires → Configuration avancée.",
    "firstRun.onlinePrompt":
      "Installez le dictionnaire en vedette configuré pour ce déploiement afin de commencer la recherche.\nLa configuration avancée reste disponible pour les catalogues personnalisés et l'import manuel.",
    "featured.installStarted": "Installation démarrée.\n",
    "featured.downloading": "Téléchargement/préparation du dictionnaire...\n",
    "featured.installed":
      "Installé et prêt pour la recherche.\nGérer les dictionnaires et la configuration avancée restent disponibles depuis Gérer les dictionnaires.",
    "featured.installFailed":
      "Échec de l'installation.\n{error}\nRéessayez l'installation ou ouvrez Gérer les dictionnaires → Configuration avancée pour récupérer.",
    "logging.noLogsYet": "Aucun journal pour le moment.",
    "logging.recentLogsError": "Erreur des journaux récents : {error}",
    "search.disabledBusy": "Recherche temporairement indisponible pendant l'installation/mise à jour.",
    "search.disabledNoActiveBundle": "Recherche désactivée : aucun bundle actif.",
    "search.noMatch": "Requête : \"{query}\" — Aucun résultat (4 niveaux vérifiés). {elapsed} ms",
    "search.resultMeta":
      "Requête : \"{query}\" — {count} résultat(s) au niveau : {level} [clé : \"{key}\"] {elapsed} ms",
    "search.error": "Erreur de recherche : {error}",
    "render.noTranslation": "(pas de traduction disponible)",
    "render.kindLexicon": "lexique",
    "render.kindIndex": "index",
    "entry.back": "← Retour aux résultats",
    "entry.targetEntriesDefault": "Entrées cibles :",
    "entry.targetEntries": "Entrées {label} :",
    "entry.noDisplay": "Aucune donnée d'affichage pour ir_id : {id}",
    "entry.usage": "Usage : {value}",
    "entry.synShort": "Syn. : {value}",
    "entry.variants": "Variantes : {value}",
    "entry.synonyms": "Synonymes : {value}",
    "entry.etymology": "Étymologie : {value}",
    "entry.literal": "Sens littéral : {value}",
    "entry.meta.irId": "ir_id : {value}",
    "entry.meta.source": "source : {value}",
    "entry.meta.norm": "norme : {value}",
    "entry.meta.corpus": "corpus : {value}",
    "queryLogs.clearConfirm": "Effacer tous les journaux de requête locaux de cet appareil ?",
    "queryLogs.noLogsToExport": "Aucun journal à exporter.",
    "queryLogs.clearCancelled": "Effacement annulé.",
    "queryLogs.cleared": "Journaux de requête effacés.",
    "queryLogs.count.one": "1 journal",
    "queryLogs.count.many": "{count} journaux",
    "queryLogs.countError": "Erreur de comptage des journaux : {error}",
    "queryLogs.exported.one": "1 journal exporté.",
    "queryLogs.exported.many": "{count} journaux exportés.",
    "queryLogs.exportFailed": "Échec d'export : {error}",
    "queryLogs.clearFailed": "Échec d'effacement : {error}",
  },
} as const;

export type TranslationKey = keyof (typeof MESSAGES)["en"];

let currentLocale: Locale = "fr";

export function setCurrentLocale(locale: Locale): void {
  currentLocale = locale;
}

export function setCurrentLocaleWithPersistence(
  locale: Locale,
  storage?: LocaleStorage,
): void {
  setCurrentLocale(locale);
  setSavedLocalePreference(locale, storage);
}

export function getCurrentLocale(): Locale {
  return currentLocale;
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replaceAll(/\{([a-zA-Z0-9_]+)\}/g, (_, name: string) => {
    if (!Object.hasOwn(vars, name)) return `{${name}}`;
    return String(vars[name]);
  });
}

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const fromLocale = MESSAGES[currentLocale][key];
  const fallback = MESSAGES.en[key];
  const template = fromLocale ?? fallback ?? key;
  return vars ? interpolate(template, vars) : template;
}

