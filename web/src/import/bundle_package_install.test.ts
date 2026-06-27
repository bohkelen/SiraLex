import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteSiralexDb,
  getActiveBundleMeta,
  getInstalledBundleMeta,
  listInstalledBundles,
  openSiralexDb,
  recoverInterruptedBundleInstall,
} from "../idb/siralex_db";
import { searchQuery } from "../search/search_query";
import * as bundleInstall from "../install/bundle_install";
import * as bundlePackage from "./bundle_package";
import * as bundlePackageIntegrity from "./bundle_package_integrity";
import {
  getInstallEligibleVerifiedPackageSnapshot,
  prepareVerifiedBundlePackage,
} from "./bundle_package_integrity";
import {
  BundlePackageInstallError,
  installVerifiedBundlePackage,
} from "./bundle_package_install";

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/bundle_package_integrity");
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

function fixtureFile(name: string): File {
  const bytes = readFileSync(path.join(FIXTURE_DIR, name));
  return new File([bytes], name, { type: "application/zip" });
}

function forgedVerifiedPackage(): bundlePackageIntegrity.VerifiedBundlePackage {
  return {
    manifest: {
      manifest_schema_version: "bundle_manifest_v1",
      bundle_id: "bundle_forged_00000000",
      bundle_type: "full",
      bundle_format: "directory",
      compression: "none",
      record_schema_id: "normalized_v1",
      record_schema_version: "1",
      rule_versions: { normalization: "norm_v1" },
      sources: { included: ["src_malipense"], excluded: [] },
      reconciliation_action: "REPLACE_ALL",
      update_mode: "REPLACE_ALL",
      files: [
        { path: "records.jsonl", byte_length: 1, sha256: "sha256:" + "a".repeat(64) },
        { path: "search_index.jsonl", byte_length: 1, sha256: "sha256:" + "b".repeat(64) },
      ],
      content_sha256: "sha256:" + "c".repeat(64),
    },
    manifestBlob: new Blob(['{"manifest_schema_version":"bundle_manifest_v1"}'], { type: "application/json" }),
    recordsBlob: new Blob(["{}\n"], { type: "application/x-ndjson" }),
    searchIndexBlob: new Blob(["{}\n"], { type: "application/x-ndjson" }),
    packageMetadata: {
      packageFormatVersion: "siralex_bundle_package_v1",
      archiveByteLength: 1,
      totalUncompressedBytes: 2,
      entryByteLengths: {
        "bundle.manifest.json": 1,
        "records.jsonl": 1,
        "search_index.jsonl": 1,
      },
    },
    observedIntegrity: {
      recordsSha256: "sha256:" + "a".repeat(64),
      searchIndexSha256: "sha256:" + "b".repeat(64),
      contentSha256: "sha256:" + "c".repeat(64),
    },
  };
}

function expectStrictAssignmentFailure(run: () => void): void {
  expect(run).toThrow(TypeError);
}

describe("installVerifiedBundlePackage", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await deleteSiralexDb();
  });

  it("installs a prepared verified package through the existing installer", async () => {
    const verified = await prepareVerifiedBundlePackage(fixtureFile("valid_package.siralex.zip"));
    const result = await installVerifiedBundlePackage(verified);

    expect(result.recordsCount).toBe(1);
    expect(result.indexCount).toBe(1);
    expect(result.skippedBecauseCurrent).toBeUndefined();
    expect(typeof result.elapsedMs).toBe("number");

    const db = await openSiralexDb();
    try {
      const active = await getActiveBundleMeta(db);
      expect(active?.bundle_id).toBe("bundle_full_20260625_1370567f");
      expect(active?.expected_content_sha256).toBe("sha256:1370567f2135ea9964359943c1be2960207edbfb2e1ee5189386cf30730a4c3c");
      expect(active?.records_count).toBe(1);
      expect(active?.index_entries_count).toBe(1);
      expect(active?.storage_scope_id).toBe(
        "bundle_full_20260625_1370567f::sha256:1370567f2135ea9964359943c1be2960207edbfb2e1ee5189386cf30730a4c3c",
      );
      expect(active).toBeDefined();

      const installed = await listInstalledBundles(db);
      expect(installed).toHaveLength(1);
      expect(installed[0]?.bundle_id).toBe("bundle_full_20260625_1370567f");

      const storageScopeId = active!.storage_scope_id ?? active!.bundle_id;
      const search = await searchQuery(
        db,
        storageScopeId,
        "target_to_source",
        "test",
        active!.search_index_directional === true,
      );
      expect(search.ir_ids).toEqual(["aaaa1111bbbb2222"]);
    } finally {
      db.close();
    }
  });

  it("does not expose a raw package or File install entry point", async () => {
    const exports = await import("./bundle_package_install");
    expect(Object.keys(exports).sort()).toEqual(["BundlePackageInstallError", "installVerifiedBundlePackage"]);
    expect("installPackageFromFile" in exports).toBe(false);
    expect("installBundlePackage" in exports).toBe(false);

    await expect(installVerifiedBundlePackage(fixtureFile("valid_package.siralex.zip") as never)).rejects.toMatchObject({
      code: "unverified_package",
    });
  });

  it("rejects forged verified-package objects before IndexedDB writes", async () => {
    const installSpy = vi.spyOn(bundleInstall, "installBundleIntoDb");
    const forged = forgedVerifiedPackage();

    await expect(installVerifiedBundlePackage(forged)).rejects.toBeInstanceOf(BundlePackageInstallError);
    await expect(installVerifiedBundlePackage(forged)).rejects.toMatchObject({ code: "unverified_package" });
    expect(installSpy).not.toHaveBeenCalled();

    const db = await openSiralexDb();
    try {
      expect(await getActiveBundleMeta(db)).toBeUndefined();
      expect(await listInstalledBundles(db)).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("does not re-open ZIPs, re-prepare packages, or materialize JSONL payloads in the adapter", async () => {
    const verified = await prepareVerifiedBundlePackage(fixtureFile("valid_package.siralex.zip"));
    const snapshot = getInstallEligibleVerifiedPackageSnapshot(verified);
    const openSpy = vi.spyOn(bundlePackage, "openStoredBundlePackage");
    const prepareSpy = vi.spyOn(bundlePackageIntegrity, "prepareVerifiedBundlePackage");
    const installSpy = vi.spyOn(bundleInstall, "installBundleIntoDb");

    const originalText = Blob.prototype.text;
    const originalArrayBuffer = Blob.prototype.arrayBuffer;
    const textSpy = vi.spyOn(Blob.prototype, "text").mockImplementation(function text(this: Blob) {
      if (this.type === "application/x-ndjson") {
        throw new Error("Blob.text must not be used during verified package handoff");
      }
      return originalText.call(this);
    });
    const arrayBufferSpy = vi.spyOn(Blob.prototype, "arrayBuffer").mockImplementation(function arrayBuffer(this: Blob) {
      if (this.type === "application/x-ndjson") {
        throw new Error("Blob.arrayBuffer must not be used during verified package handoff");
      }
      return originalArrayBuffer.call(this);
    });

    try {
      await installVerifiedBundlePackage(verified);
    } finally {
      textSpy.mockRestore();
      arrayBufferSpy.mockRestore();
    }

    expect(openSpy).not.toHaveBeenCalled();
    expect(prepareSpy).not.toHaveBeenCalled();
    expect(installSpy).toHaveBeenCalledTimes(1);
    expect(installSpy.mock.calls[0]?.[1]).toBe(snapshot.manifest);
    expect(installSpy.mock.calls[0]?.[2]).toEqual({
      recordsSource: snapshot.recordsBlob,
      searchIndexSource: snapshot.searchIndexBlob,
    });
    expect(installSpy.mock.calls[0]?.[5]).toEqual({ storageBytes: snapshot.storageBytes });
  });

  it("propagates installer failures without leaving an active bundle", async () => {
    const verified = await prepareVerifiedBundlePackage(fixtureFile("valid_package.siralex.zip"));
    const installSpy = vi
      .spyOn(bundleInstall, "installBundleIntoDb")
      .mockRejectedValueOnce(new Error("simulated install failure"));

    await expect(installVerifiedBundlePackage(verified)).rejects.toThrow("simulated install failure");
    expect(installSpy).toHaveBeenCalledTimes(1);

    const db = await openSiralexDb();
    try {
      expect(await getActiveBundleMeta(db)).toBeUndefined();
      expect(await listInstalledBundles(db)).toEqual([]);
      expect(await recoverInterruptedBundleInstall(db)).toBeUndefined();

      const installed = await getInstalledBundleMeta(db, verified.manifest.bundle_id);
      expect(installed).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it("rejects top-level mutation of verified package fields", async () => {
    const verified = await prepareVerifiedBundlePackage(fixtureFile("valid_package.siralex.zip"));
    const snapshot = getInstallEligibleVerifiedPackageSnapshot(verified);
    const originalRecords = verified.recordsBlob;
    const originalIndex = verified.searchIndexBlob;
    const originalManifestHash = verified.manifest.content_sha256;

    expectStrictAssignmentFailure(() => {
      (verified as { recordsBlob: Blob }).recordsBlob = new Blob(["mutated\n"], { type: "application/x-ndjson" });
    });
    expectStrictAssignmentFailure(() => {
      (verified as { searchIndexBlob: Blob }).searchIndexBlob = new Blob(["mutated\n"], { type: "application/x-ndjson" });
    });
    expectStrictAssignmentFailure(() => {
      (verified as { manifest: typeof verified.manifest }).manifest = {
        ...verified.manifest,
        content_sha256: "sha256:" + "f".repeat(64),
      };
    });
    expectStrictAssignmentFailure(() => {
      (verified as { packageMetadata: typeof verified.packageMetadata }).packageMetadata = {
        ...verified.packageMetadata,
        totalUncompressedBytes: 0,
      };
    });

    expect(verified.recordsBlob).toBe(originalRecords);
    expect(verified.searchIndexBlob).toBe(originalIndex);
    expect(verified.manifest.content_sha256).toBe(originalManifestHash);
    expect(getInstallEligibleVerifiedPackageSnapshot(verified).recordsBlob).toBe(originalRecords);
    expect(getInstallEligibleVerifiedPackageSnapshot(verified).manifest.content_sha256).toBe(originalManifestHash);

    const installSpy = vi.spyOn(bundleInstall, "installBundleIntoDb");
    await installVerifiedBundlePackage(verified);
    expect(installSpy.mock.calls[0]?.[1]).toBe(snapshot.manifest);
    expect(installSpy.mock.calls[0]?.[2]?.recordsSource).toBe(originalRecords);
    expect(installSpy.mock.calls[0]?.[2]?.searchIndexSource).toBe(originalIndex);
  });

  it("rejects nested manifest mutation on the public verified-package façade", async () => {
    const verified = await prepareVerifiedBundlePackage(fixtureFile("valid_package.siralex.zip"));
    const snapshotBefore = getInstallEligibleVerifiedPackageSnapshot(verified);
    const originalContentSha256 = snapshotBefore.manifest.content_sha256;
    const originalRecordsSha256 = snapshotBefore.manifest.files[0]?.sha256;

    expectStrictAssignmentFailure(() => {
      (verified.manifest as { content_sha256: string }).content_sha256 = "sha256:" + "f".repeat(64);
    });
    expectStrictAssignmentFailure(() => {
      const files = verified.manifest.files as Array<{ sha256: string }>;
      files[0]!.sha256 = "sha256:" + "e".repeat(64);
    });

    const snapshotAfter = getInstallEligibleVerifiedPackageSnapshot(verified);
    expect(snapshotAfter.manifest.content_sha256).toBe(originalContentSha256);
    expect(snapshotAfter.manifest.files[0]?.sha256).toBe(originalRecordsSha256);
    expect(snapshotAfter.manifest).toBe(snapshotBefore.manifest);
  });

  it("hands the private install snapshot to the existing installer", async () => {
    const verified = await prepareVerifiedBundlePackage(fixtureFile("valid_package.siralex.zip"));
    const snapshot = getInstallEligibleVerifiedPackageSnapshot(verified);

    expectStrictAssignmentFailure(() => {
      (verified as { recordsBlob: Blob }).recordsBlob = new Blob(["mutated\n"], { type: "application/x-ndjson" });
    });
    expectStrictAssignmentFailure(() => {
      (verified.manifest as { content_sha256: string }).content_sha256 = "sha256:" + "f".repeat(64);
    });

    const installSpy = vi.spyOn(bundleInstall, "installBundleIntoDb");
    await installVerifiedBundlePackage(verified);

    expect(installSpy).toHaveBeenCalledTimes(1);
    expect(installSpy.mock.calls[0]?.[1]).toBe(snapshot.manifest);
    expect(installSpy.mock.calls[0]?.[1]).not.toBe(verified.manifest);
    expect(installSpy.mock.calls[0]?.[2]?.recordsSource).toBe(snapshot.recordsBlob);
    expect(installSpy.mock.calls[0]?.[2]?.searchIndexSource).toBe(snapshot.searchIndexBlob);
    expect(installSpy.mock.calls[0]?.[5]).toEqual({ storageBytes: snapshot.storageBytes });
  });

  it("does not import UI, main, or catalog modules", () => {
    const source = readFileSync(path.join(MODULE_DIR, "bundle_package_install.ts"), "utf-8");
    expect(source.includes("main.ts")).toBe(false);
    expect(source.includes("../main")).toBe(false);
    expect(source.includes("bundle_catalog")).toBe(false);
    expect(source.includes("document.")).toBe(false);
    expect(source.includes("withSingleWriterLock")).toBe(false);
    expect(source.includes("verifiedPackage.manifest")).toBe(false);
    expect(source.includes("verifiedPackage.recordsBlob")).toBe(false);
    expect(source.includes("verifiedPackage.searchIndexBlob")).toBe(false);
    expect(source.includes("verifiedPackage.packageMetadata")).toBe(false);
  });
});
