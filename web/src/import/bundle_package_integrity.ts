/**
 * Browser-side first-pass integrity verification for `.siralex.zip` packages.
 *
 * Structural ZIP validation (Slice 1) plus manifest and streaming payload checks.
 * Does not install bundles or write to IndexedDB.
 */

import {
  parseAndValidateManifestJson,
  type BundleManifestV1,
  type BundleManifestV1FileEntry,
} from "../bundle_manifest";
import {
  openStoredBundlePackage,
  type BundlePackageMetadata,
} from "./bundle_package";
import { computeContentSha256 } from "./content_sha256";
import { sha256BlobStream } from "./stream_sha256";

export const MANIFEST_MAX_BYTES = 1 * 1024 * 1024;

const REQUIRED_PAYLOAD_PATHS = {
  records: "records.jsonl",
  searchIndex: "search_index.jsonl",
} as const;

export type VerifiedBundlePackage = {
  readonly manifest: BundleManifestV1;
  readonly manifestBlob: Blob;
  readonly recordsBlob: Blob;
  readonly searchIndexBlob: Blob;
  readonly packageMetadata: BundlePackageMetadata;
  readonly observedIntegrity: {
    readonly recordsSha256: string;
    readonly searchIndexSha256: string;
    readonly contentSha256: string;
  };
};

export type InstallEligibleSnapshot = {
  readonly manifest: BundleManifestV1;
  readonly manifestBlob: Blob;
  readonly recordsBlob: Blob;
  readonly searchIndexBlob: Blob;
  readonly storageBytes: number;
};

export class BundlePackageIntegrityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BundlePackageIntegrityError";
    this.code = code;
  }
}

const installEligibleSnapshots = new WeakMap<object, InstallEligibleSnapshot>();

export function getInstallEligibleVerifiedPackageSnapshot(value: VerifiedBundlePackage): InstallEligibleSnapshot {
  const snapshot = installEligibleSnapshots.get(value);
  if (!snapshot) {
    throw new BundlePackageIntegrityError(
      "package_not_verified",
      "Package must be prepared through prepareVerifiedBundlePackage() before installation",
    );
  }
  return snapshot;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return value;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }

  return value;
}

function cloneAndFreezeManifest(manifest: BundleManifestV1): BundleManifestV1 {
  return deepFreeze(structuredClone(manifest));
}

function freezeVerifiedPackageSurface(value: VerifiedBundlePackage): VerifiedBundlePackage {
  deepFreeze(value.observedIntegrity);
  deepFreeze(value.packageMetadata.entryByteLengths);
  Object.freeze(value.packageMetadata);
  Object.freeze(value);
  return value;
}

function createInstallEligibleSnapshot(
  manifest: BundleManifestV1,
  manifestBlob: Blob,
  recordsBlob: Blob,
  searchIndexBlob: Blob,
  storageBytes: number,
): InstallEligibleSnapshot {
  return Object.freeze({
    manifest: cloneAndFreezeManifest(manifest),
    manifestBlob,
    recordsBlob,
    searchIndexBlob,
    storageBytes,
  });
}

export async function prepareVerifiedBundlePackage(file: File): Promise<VerifiedBundlePackage> {
  const opened = await openStoredBundlePackage(file);

  if (opened.manifestBlob.size > MANIFEST_MAX_BYTES) {
    throw new BundlePackageIntegrityError(
      "manifest_too_large",
      `Manifest exceeds adapter read cap (${MANIFEST_MAX_BYTES} bytes)`,
    );
  }

  const manifestText = await decodeManifestText(opened.manifestBlob);
  const validation = parseAndValidateManifestJson(manifestText);
  if (validation.ok && validation.manifest) {
    validateManifestPayloadMapping(validation.manifest);
  } else {
    rejectManifestPayloadMappingIfApplicable(manifestText);
    const detail = validation.errors.join("; ");
    throw new BundlePackageIntegrityError(
      "manifest_invalid",
      detail.length > 0 ? detail : "Manifest validation failed",
    );
  }

  const manifest = validation.manifest!;
  const { records: recordsEntry, searchIndex: searchIndexEntry } = validateManifestPayloadMapping(manifest);

  assertPayloadByteLength(opened.recordsBlob, recordsEntry, REQUIRED_PAYLOAD_PATHS.records);
  assertPayloadByteLength(opened.searchIndexBlob, searchIndexEntry, REQUIRED_PAYLOAD_PATHS.searchIndex);

  const recordsObserved = await sha256BlobStream(opened.recordsBlob);
  assertStreamLength(recordsObserved.byteLength, recordsEntry, REQUIRED_PAYLOAD_PATHS.records);
  assertObservedSha256(recordsObserved.digest, recordsEntry, REQUIRED_PAYLOAD_PATHS.records);

  const searchIndexObserved = await sha256BlobStream(opened.searchIndexBlob);
  assertStreamLength(searchIndexObserved.byteLength, searchIndexEntry, REQUIRED_PAYLOAD_PATHS.searchIndex);
  assertObservedSha256(searchIndexObserved.digest, searchIndexEntry, REQUIRED_PAYLOAD_PATHS.searchIndex);

  const computedContentSha256 = computeContentSha256([
    {
      path: REQUIRED_PAYLOAD_PATHS.records,
      byte_length: recordsObserved.byteLength,
      sha256: recordsObserved.digest,
    },
    {
      path: REQUIRED_PAYLOAD_PATHS.searchIndex,
      byte_length: searchIndexObserved.byteLength,
      sha256: searchIndexObserved.digest,
    },
  ]);

  if (computedContentSha256 !== manifest.content_sha256) {
    throw new BundlePackageIntegrityError(
      "content_sha256_mismatch",
      `content_sha256 mismatch: expected ${manifest.content_sha256}, observed ${computedContentSha256}`,
    );
  }

  const frozenManifest = cloneAndFreezeManifest(manifest);
  const verified = freezeVerifiedPackageSurface({
    manifest: frozenManifest,
    manifestBlob: opened.manifestBlob,
    recordsBlob: opened.recordsBlob,
    searchIndexBlob: opened.searchIndexBlob,
    packageMetadata: opened.packageMetadata,
    observedIntegrity: {
      recordsSha256: recordsObserved.digest,
      searchIndexSha256: searchIndexObserved.digest,
      contentSha256: computedContentSha256,
    },
  });
  installEligibleSnapshots.set(
    verified,
    createInstallEligibleSnapshot(
      manifest,
      opened.manifestBlob,
      opened.recordsBlob,
      opened.searchIndexBlob,
      opened.packageMetadata.totalUncompressedBytes,
    ),
  );
  return verified;
}

async function decodeManifestText(manifestBlob: Blob): Promise<string> {
  if (manifestBlob.size > MANIFEST_MAX_BYTES) {
    throw new BundlePackageIntegrityError(
      "manifest_too_large",
      `Manifest exceeds adapter read cap (${MANIFEST_MAX_BYTES} bytes)`,
    );
  }

  const bytes = new Uint8Array(await manifestBlob.arrayBuffer());
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new BundlePackageIntegrityError("manifest_invalid_utf8", "Manifest is not valid UTF-8");
  }
}

function extractManifestFilesList(manifestText: string): BundleManifestV1FileEntry[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(manifestText);
  } catch {
    return null;
  }

  if (typeof raw !== "object" || raw === null || !("files" in raw)) {
    return null;
  }

  const filesRaw = (raw as Record<string, unknown>).files;
  if (!Array.isArray(filesRaw)) {
    return null;
  }

  const files: BundleManifestV1FileEntry[] = [];
  for (const entry of filesRaw) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const path = record.path;
    const byteLength = record.byte_length;
    const sha256 = record.sha256;
    if (typeof path !== "string" || typeof byteLength !== "number" || typeof sha256 !== "string") {
      continue;
    }
    files.push({ path, byte_length: byteLength, sha256 });
  }

  return files;
}

function rejectManifestPayloadMappingIfApplicable(manifestText: string): void {
  const files = extractManifestFilesList(manifestText);
  if (files === null) {
    return;
  }

  validateManifestPayloadMapping({ files } as BundleManifestV1);
}

function validateManifestPayloadMapping(manifest: BundleManifestV1): {
  records: BundleManifestV1FileEntry;
  searchIndex: BundleManifestV1FileEntry;
} {
  if (manifest.files.length !== 2) {
    throw new BundlePackageIntegrityError(
      "manifest_payload_mapping_invalid",
      `Manifest files[] must contain exactly 2 entries, got ${manifest.files.length}`,
    );
  }

  const recordsMatches = manifest.files.filter((entry) => entry.path === REQUIRED_PAYLOAD_PATHS.records);
  const searchIndexMatches = manifest.files.filter((entry) => entry.path === REQUIRED_PAYLOAD_PATHS.searchIndex);

  if (recordsMatches.length !== 1) {
    throw new BundlePackageIntegrityError(
      "manifest_payload_mapping_invalid",
      `Manifest files[] must contain exactly one entry for ${REQUIRED_PAYLOAD_PATHS.records}`,
    );
  }

  if (searchIndexMatches.length !== 1) {
    throw new BundlePackageIntegrityError(
      "manifest_payload_mapping_invalid",
      `Manifest files[] must contain exactly one entry for ${REQUIRED_PAYLOAD_PATHS.searchIndex}`,
    );
  }

  for (const entry of manifest.files) {
    if (entry.path !== REQUIRED_PAYLOAD_PATHS.records && entry.path !== REQUIRED_PAYLOAD_PATHS.searchIndex) {
      throw new BundlePackageIntegrityError(
        "manifest_payload_mapping_invalid",
        `Manifest files[] contains unexpected path: ${entry.path}`,
      );
    }
  }

  return {
    records: recordsMatches[0]!,
    searchIndex: searchIndexMatches[0]!,
  };
}

function assertPayloadByteLength(blob: Blob, entry: BundleManifestV1FileEntry, label: string): void {
  if (blob.size !== entry.byte_length) {
    throw new BundlePackageIntegrityError(
      "payload_byte_length_mismatch",
      `byte_length mismatch for ${label}: expected ${entry.byte_length}, got ${blob.size}`,
    );
  }
}

function assertStreamLength(
  observedLength: number,
  entry: BundleManifestV1FileEntry,
  label: string,
): void {
  if (observedLength !== entry.byte_length) {
    throw new BundlePackageIntegrityError(
      "payload_stream_length_mismatch",
      `stream byte count mismatch for ${label}: expected ${entry.byte_length}, got ${observedLength}`,
    );
  }
}

function assertObservedSha256(
  observedDigest: string,
  entry: BundleManifestV1FileEntry,
  label: string,
): void {
  if (observedDigest !== entry.sha256) {
    throw new BundlePackageIntegrityError(
      "payload_sha256_mismatch",
      `SHA-256 mismatch for ${label}: expected ${entry.sha256}, observed ${observedDigest}`,
    );
  }
}