import { buildLanguageMetaFromManifest } from "../bundle_labels";
import {
  deriveBundleAssetUrls,
  validateRemoteUrlPolicy,
  type BundleCatalogEntryV1,
} from "../bundle_catalog";
import {
  parseAndValidateManifestJson,
  type BundleManifestV1,
  type BundleManifestV1FileEntry,
} from "../bundle_manifest";
import {
  clearBundleInstallSession,
  deleteBundleScopeData,
  getBundleStorageScopeId,
  getInstalledBundleMeta,
  recoverInterruptedBundleInstall,
  setActiveBundleMeta,
  setBundleInstallSession,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import {
  importRecordsJsonl,
  type ImportRecordsProgress,
} from "../import/import_records";
import {
  importSearchIndexJsonl,
  type ImportSearchIndexProgress,
} from "../import/import_search_index";
import type { JsonlByteSource } from "../import/jsonl_stream";

export const DEFAULT_BUNDLE_FETCH_TIMEOUT_MS = 30_000;

export type InstallBundleResult = {
  recordsCount: number;
  indexCount: number;
  elapsedMs: number;
  cleanupWarning?: string;
  skippedBecauseCurrent?: boolean;
};

export type InstallBundleSources = {
  recordsSource: JsonlByteSource;
  searchIndexSource: JsonlByteSource;
};

export type InstallRemoteBundleOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  onUpdate?: (message: string) => void;
  storageEstimate?: () => Promise<{ usage?: number; quota?: number }>;
};

function createLinkedAbortSignal(timeoutMs: number, externalSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Bundle request timed out after ${timeoutMs} ms`));
  }, timeoutMs);

  const onAbort = () => {
    controller.abort(externalSignal?.reason ?? new Error("Bundle request aborted"));
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      onAbort();
    } else {
      externalSignal.addEventListener("abort", onAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onAbort);
    },
  };
}

function getManifestFileEntry(manifest: BundleManifestV1, path: string): BundleManifestV1FileEntry {
  const entry = manifest.files.find((file) => file.path === path);
  if (!entry) {
    throw new Error(`Manifest missing required payload entry: ${path}`);
  }
  return entry;
}

function createByteLengthValidatedStream(
  source: ReadableStream<Uint8Array>,
  expectedBytes: number,
): ReadableStream<Uint8Array> {
  let bytesRead = 0;
  const reader = source.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        if (bytesRead !== expectedBytes) {
          controller.error(
            new Error(`Remote payload byte_length mismatch: expected ${expectedBytes}, got ${bytesRead}`),
          );
          return;
        }
        controller.close();
        return;
      }
      if (value) {
        bytesRead += value.byteLength;
        if (bytesRead > expectedBytes) {
          controller.error(
            new Error(`Remote payload byte_length mismatch: expected ${expectedBytes}, got at least ${bytesRead}`),
          );
          await reader.cancel().catch(() => undefined);
          return;
        }
        controller.enqueue(value);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}

async function fetchBodyStream(
  url: string,
  expectedBytes: number,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
  currentBaseUrl?: string,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/octet-stream,application/json,text/plain" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Bundle request failed: ${response.status} ${response.statusText} (${url})`);
  }
  validateRemoteUrlPolicy(response.url || url, currentBaseUrl);

  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed !== expectedBytes) {
      throw new Error(`Remote payload byte_length mismatch: expected ${expectedBytes}, got ${parsed}`);
    }
  }
  if (!response.body) {
    throw new Error(`Bundle response body missing for ${url}`);
  }

  return createByteLengthValidatedStream(response.body, expectedBytes);
}

function buildInstalledBundleMeta(
  manifest: BundleManifestV1,
  storageScopeId: string,
  recordsCount: number,
  indexCount: number,
): ActiveBundleMeta {
  return {
    bundle_id: manifest.bundle_id,
    storage_scope_id: storageScopeId,
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

export async function installBundleIntoDb(
  db: IDBDatabase,
  manifest: BundleManifestV1,
  sources: InstallBundleSources,
  onUpdate: (message: string) => void,
  signal?: AbortSignal,
): Promise<InstallBundleResult> {
  const recovered = await recoverInterruptedBundleInstall(db);
  if (recovered) {
    onUpdate(`${recovered}\n`);
  }

  const installedBefore = await getInstalledBundleMeta(db, manifest.bundle_id);
  const previousStorageScopeId = installedBefore ? getBundleStorageScopeId(installedBefore) : undefined;
  const nextStorageScopeId = `${manifest.bundle_id}::${manifest.content_sha256}`;

  if (previousStorageScopeId === nextStorageScopeId) {
    return {
      recordsCount: installedBefore?.records_count ?? 0,
      indexCount: installedBefore?.index_entries_count ?? 0,
      elapsedMs: 0,
      skippedBecauseCurrent: true,
    };
  }

  await setBundleInstallSession(db, {
    bundle_id: manifest.bundle_id,
    storage_scope_id: nextStorageScopeId,
    previous_storage_scope_id: previousStorageScopeId,
    started_at_iso: new Date().toISOString(),
    phase: "staging",
  });

  const t0 = performance.now();
  let recordsCount = 0;
  let indexCount = 0;
  let cleanupWarning: string | undefined;
  try {
    const recRes = await importRecordsJsonl(db, sources.recordsSource, {
      bundleId: nextStorageScopeId,
      batchSize: 500,
      signal,
      onProgress: (p: ImportRecordsProgress) => {
        onUpdate(
          `Installing ${manifest.bundle_id}\n` +
            `Stage: staging payloads\n\n` +
            `[records.jsonl]\n` +
            `bytes read: ${p.bytesRead}\n` +
            `lines seen: ${p.linesSeen}\n` +
            `records written: ${p.recordsWritten}\n` +
            `batches committed: ${p.batchesCommitted}\n`,
        );
      },
    });
    recordsCount = recRes.recordsWritten;

    const idxRes = await importSearchIndexJsonl(db, sources.searchIndexSource, {
      bundleId: nextStorageScopeId,
      batchSize: 500,
      signal,
      onProgress: (p: ImportSearchIndexProgress) => {
        onUpdate(
          `Installing ${manifest.bundle_id}\n` +
            `Stage: staging payloads\n\n` +
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

    await setActiveBundleMeta(db, buildInstalledBundleMeta(manifest, nextStorageScopeId, recordsCount, indexCount));
    await setBundleInstallSession(db, {
      bundle_id: manifest.bundle_id,
      storage_scope_id: nextStorageScopeId,
      previous_storage_scope_id: previousStorageScopeId,
      started_at_iso: new Date().toISOString(),
      phase: "committed",
    });

    if (previousStorageScopeId && previousStorageScopeId !== nextStorageScopeId) {
      try {
        await deleteBundleScopeData(db, previousStorageScopeId);
        await clearBundleInstallSession(db);
      } catch (e) {
        cleanupWarning =
          `New bundle is active, but previous bundle data cleanup did not complete: ${String(e)}\n` +
          `Cleanup will be retried on next app load.`;
      }
    } else {
      await clearBundleInstallSession(db);
    }
  } catch (e) {
    await deleteBundleScopeData(db, nextStorageScopeId);
    await clearBundleInstallSession(db);
    throw e;
  }

  return {
    recordsCount,
    indexCount,
    elapsedMs: performance.now() - t0,
    cleanupWarning,
  };
}

export async function installRemoteCatalogBundle(
  db: IDBDatabase,
  entry: BundleCatalogEntryV1,
  catalogUrl: string,
  options: InstallRemoteBundleOptions = {},
): Promise<{ manifest: BundleManifestV1; result: InstallBundleResult }> {
  const onUpdate = options.onUpdate ?? (() => undefined);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_BUNDLE_FETCH_TIMEOUT_MS;
  const { signal, cleanup } = createLinkedAbortSignal(timeoutMs, options.signal);

  try {
    const urls = deriveBundleAssetUrls(catalogUrl, entry);
    onUpdate(`Installing ${entry.bundle_id}\nStage: fetching manifest\n`);
    const manifestResponse = await fetchImpl(urls.manifest_url, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!manifestResponse.ok) {
      throw new Error(`Bundle request failed: ${manifestResponse.status} ${manifestResponse.statusText} (${urls.manifest_url})`);
    }
    validateRemoteUrlPolicy(manifestResponse.url || urls.manifest_url, catalogUrl);
    const manifestText = await manifestResponse.text();
    const parsed = parseAndValidateManifestJson(manifestText);
    if (!parsed.ok || !parsed.manifest) {
      throw new Error(`Manifest validation failed: ${parsed.errors.join("; ")}`);
    }

    const manifest = parsed.manifest;
    if (manifest.bundle_id !== entry.bundle_id) {
      throw new Error(
        `Catalog/manifest bundle_id mismatch: catalog=${entry.bundle_id}, manifest=${manifest.bundle_id}`,
      );
    }
    if (manifest.content_sha256 !== entry.content_sha256) {
      throw new Error(
        `Catalog/manifest content_sha256 mismatch: catalog=${entry.content_sha256}, manifest=${manifest.content_sha256}`,
      );
    }

    const installed = await getInstalledBundleMeta(db, entry.bundle_id);
    if (installed?.expected_content_sha256 === entry.content_sha256) {
      await setActiveBundleMeta(
        db,
        {
          ...installed,
          imported_at_iso: installed.imported_at_iso,
        },
      );
      return {
        manifest,
        result: {
          recordsCount: installed.records_count ?? 0,
          indexCount: installed.index_entries_count ?? 0,
          elapsedMs: 0,
          skippedBecauseCurrent: true,
        },
      };
    }

    const recordsEntry = getManifestFileEntry(manifest, "records.jsonl");
    const indexEntry = getManifestFileEntry(manifest, "search_index.jsonl");

    if (options.storageEstimate) {
      const estimate = await options.storageEstimate();
      const usage = estimate.usage ?? 0;
      const quota = estimate.quota;
      const requiredBytes = recordsEntry.byte_length + indexEntry.byte_length;
      if (typeof quota === "number" && quota - usage < requiredBytes) {
        throw new Error(
          `Insufficient storage headroom: need ${requiredBytes} bytes, have ${Math.max(0, quota - usage)} bytes`,
        );
      }
    }

    onUpdate(`Installing ${entry.bundle_id}\nStage: fetching records.jsonl\n`);
    const recordsStream = await fetchBodyStream(
      urls.records_url,
      recordsEntry.byte_length,
      fetchImpl,
      signal,
      catalogUrl,
    );
    onUpdate(`Installing ${entry.bundle_id}\nStage: fetching search_index.jsonl\n`);
    const indexStream = await fetchBodyStream(
      urls.search_index_url,
      indexEntry.byte_length,
      fetchImpl,
      signal,
      catalogUrl,
    );

    const result = await installBundleIntoDb(
      db,
      manifest,
      {
        recordsSource: recordsStream,
        searchIndexSource: indexStream,
      },
      onUpdate,
      signal,
    );

    return { manifest, result };
  } finally {
    cleanup();
  }
}
