// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { BundlePackageError } from "./bundle_package";
import { BundlePackageIntegrityError, type VerifiedBundlePackage } from "./bundle_package_integrity";
import { BundlePackageInstallError } from "./bundle_package_install";
import {
  mapPackageImportError,
  PACKAGE_IMPORT_DOM_IDS,
  runManualPackageImport,
  wireManualPackageImportControls,
  type ManualPackageImportDeps,
  type ManualPackageImportMessages,
} from "./manual_package_import_flow";

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/bundle_package_integrity");
const MAIN_TS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "main.ts");

function fixtureFile(name: string): File {
  const bytes = readFileSync(path.join(FIXTURE_DIR, name));
  return new File([bytes], name, { type: "application/zip" });
}

function makeFileList(file: File): FileList {
  return {
    length: 1,
    0: file,
    item: (index: number) => (index === 0 ? file : null),
    [Symbol.iterator]: function* () {
      yield file;
    },
  } as FileList;
}

function makeMessages(): ManualPackageImportMessages {
  return {
    preparing: "Preparing package…",
    verifying: "Verifying dictionary data…",
    installing: "Installing dictionary…",
    installed: "Dictionary installed.",
    tooManyFiles: "Select one .siralex.zip package only.",
    invalidStructure: "The selected file is not a valid dictionary package.",
    invalidManifest: "The package manifest is invalid.",
    verificationFailed: "Package verification failed.",
    contentsMismatch: "Package contents do not match the manifest.",
    installationFailed: "Dictionary installation failed.",
    partialRemovedReimport: "Partial bundle data removed. Re-import required.\n",
    writerBusy: "Another dictionary operation is already in progress. Try again when it finishes.",
  };
}

function makeVerifiedStub(): VerifiedBundlePackage {
  return {
    manifest: {
      manifest_schema_version: "bundle_manifest_v1",
      bundle_id: "bundle_full_test_00000000",
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
    manifestBlob: new Blob(["{}"], { type: "application/json" }),
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

function createDeps(overrides: Partial<ManualPackageImportDeps> = {}) {
  const state = { inProgress: false, busy: false, inputValue: "set", progress: "", dbOut: "" };
  const clearInput = vi.fn(() => {
    state.inputValue = "";
  });
  const setEnabled = vi.fn();
  const setProgress = vi.fn((_visible: boolean, text: string) => {
    state.progress = text;
  });
  const appendProgress = vi.fn((text: string) => {
    state.progress += text;
  });
  const setDbOut = vi.fn((text: string) => {
    state.dbOut = text;
  });
  const hideFirstRun = vi.fn();

  const deps: ManualPackageImportDeps = {
    prepareVerifiedBundlePackage: vi.fn(async () => makeVerifiedStub()),
    installVerifiedBundlePackage: vi.fn(async () => ({ recordsCount: 1, indexCount: 1, elapsedMs: 1 })),
    withSingleWriterLock: vi.fn(async (_label: string, fn: () => Promise<void>) => {
      await fn();
    }),
    messages: makeMessages(),
    formatErrorDetails: (error) => String(error),
    setImportProgress: setProgress,
    appendImportProgress: appendProgress,
    setDbOutDiagnostic: setDbOut,
    hideFirstRun,
    clearPackageInput: clearInput,
    setPackageControlsEnabled: setEnabled,
    getPackageImportInProgress: () => state.inProgress,
    setPackageImportInProgress: (value) => {
      state.inProgress = value;
    },
    getBusy: () => state.busy,
    ...overrides,
  };

  return {
    deps,
    prepare: vi.mocked(deps.prepareVerifiedBundlePackage),
    install: vi.mocked(deps.installVerifiedBundlePackage),
    lock: vi.mocked(deps.withSingleWriterLock),
    clearInput,
    setEnabled,
    state,
    setDbOut,
  };
}

describe("manual package import UI surface", () => {
  it("declares package picker and legacy fallback controls in main.ts", () => {
    const mainSource = readFileSync(MAIN_TS, "utf-8");
    expect(mainSource.includes(`id="${PACKAGE_IMPORT_DOM_IDS.packageImportButton}"`)).toBe(true);
    expect(mainSource.includes(`id="${PACKAGE_IMPORT_DOM_IDS.packageImportFile}"`)).toBe(true);
    expect(mainSource.includes('accept=".siralex.zip,application/zip"')).toBe(true);
    expect(mainSource.includes(`id="${PACKAGE_IMPORT_DOM_IDS.quickImportButton}"`)).toBe(true);
    expect(mainSource.includes(`id="${PACKAGE_IMPORT_DOM_IDS.quickImportFiles}"`)).toBe(true);
    expect(mainSource.includes(`id="${PACKAGE_IMPORT_DOM_IDS.devImportBundleButton}"`)).toBe(true);
  });

  it("wires package import without calling installBundleIntoDb directly", () => {
    const mainSource = readFileSync(MAIN_TS, "utf-8");
    const packageHandlerStart = mainSource.indexOf("// --- Package import");
    const packageHandlerEnd = mainSource.indexOf("// --- Quick import");
    const packageSection = mainSource.slice(packageHandlerStart, packageHandlerEnd);
    const depsSection = mainSource.slice(
      mainSource.indexOf("function buildManualPackageImportDeps"),
      packageHandlerStart,
    );
    expect(packageSection.includes("wireManualPackageImportControls")).toBe(true);
    expect(packageSection.includes("buildManualPackageImportDeps")).toBe(true);
    expect(depsSection.includes("prepareVerifiedBundlePackage")).toBe(true);
    expect(depsSection.includes("installVerifiedBundlePackage")).toBe(true);
    expect(packageSection.includes("installBundleIntoDb")).toBe(false);
    expect(depsSection.includes("installBundleIntoDb")).toBe(false);
  });
});

describe("runManualPackageImport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("runs prepare, lock, install, and clears the input on success", async () => {
    const { deps, prepare, install, lock, clearInput, setEnabled, state } = createDeps();
    const file = fixtureFile("valid_package.siralex.zip");
    const outcome = await runManualPackageImport(makeFileList(file), deps);
    expect(outcome).toBe("completed");
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledWith(file);
    expect(lock).toHaveBeenCalledTimes(1);
    expect(lock.mock.calls[0]?.[0]).toBe("install package");
    expect(install).toHaveBeenCalledTimes(1);
    expect(state.progress).toContain("Dictionary installed.");
    expect(state.inputValue).toBe("");
    expect(setEnabled.mock.calls.at(-1)).toEqual([true]);
  });

  it("fails preparation without calling the installer", async () => {
    const diagnostic = "BundlePackageIntegrityError: payload_sha256_mismatch hash mismatch";
    const { deps, install, lock, clearInput, setDbOut, state } = createDeps({
      prepareVerifiedBundlePackage: vi.fn(async () => {
        throw new BundlePackageIntegrityError("payload_sha256_mismatch", "hash mismatch");
      }),
      formatErrorDetails: () => diagnostic,
    });
    const outcome = await runManualPackageImport(makeFileList(fixtureFile("records_sha_mismatch.siralex.zip")), deps);
    expect(outcome).toBe("failed");
    expect(install).not.toHaveBeenCalled();
    expect(lock).not.toHaveBeenCalled();
    expect(clearInput).toHaveBeenCalled();
    expect(setDbOut).toHaveBeenCalledWith(diagnostic);
    expect(state.progress).toContain("Package contents do not match the manifest.");
    expect(state.progress).not.toContain("payload_sha256_mismatch");
    expect(state.progress).not.toContain("BundlePackageIntegrityError");
  });

  it("propagates install adapter failure after preparation succeeds", async () => {
    const diagnostic = "BundlePackageInstallError: installation_failed simulated install failure";
    const refreshDiagnostic = "Active: Refreshed Bundle\nRecords: 1";
    const { deps, prepare, lock, install, clearInput, state, setDbOut } = createDeps({
      installVerifiedBundlePackage: vi.fn(async () => {
        throw new BundlePackageInstallError("installation_failed", "simulated install failure");
      }),
      formatErrorDetails: () => diagnostic,
      withSingleWriterLock: vi.fn(async (_label, fn) => {
        try {
          await fn();
        } catch (error) {
          state.dbOut = refreshDiagnostic;
          throw error;
        }
      }),
    });
    const outcome = await runManualPackageImport(makeFileList(fixtureFile("valid_package.siralex.zip")), deps);
    expect(outcome).toBe("failed");
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledTimes(1);
    expect(clearInput).toHaveBeenCalled();
    expect(state.progress).toContain("Dictionary installation failed.");
    expect(state.progress).toContain("Partial bundle data removed. Re-import required.");
    expect(state.progress).not.toContain("Dictionary installed.");
    expect(state.progress).not.toContain("installation_failed");
    expect(state.dbOut).toBe(diagnostic);
    expect(setDbOut).toHaveBeenLastCalledWith(diagnostic);
  });

  it("fails when the writer lock rejects before invoking its callback", async () => {
    const lockError = new Error("lock infrastructure exploded");
    const diagnostic = "Error: lock infrastructure exploded";
    const { deps, prepare, install, clearInput, setEnabled, state, setDbOut } = createDeps({
      withSingleWriterLock: vi.fn(async () => {
        throw lockError;
      }),
      formatErrorDetails: (error) => (error instanceof Error ? `Error: ${error.message}` : String(error)),
    });
    const outcome = await runManualPackageImport(makeFileList(fixtureFile("valid_package.siralex.zip")), deps);
    expect(outcome).toBe("failed");
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(install).not.toHaveBeenCalled();
    expect(state.progress).toContain("Dictionary installation failed.");
    expect(state.progress).not.toContain("Dictionary installed.");
    expect(state.progress).not.toContain("Partial bundle data removed.");
    expect(state.dbOut).toBe(diagnostic);
    expect(setDbOut).toHaveBeenLastCalledWith(diagnostic);
    expect(clearInput).toHaveBeenCalled();
    expect(setEnabled.mock.calls.at(-1)).toEqual([true]);
  });

  it("fails when the writer lock is unavailable after preparation succeeds", async () => {
    const { deps, prepare, install, lock, clearInput, setEnabled, state, setDbOut } = createDeps({
      withSingleWriterLock: vi.fn(async () => {}),
    });
    const outcome = await runManualPackageImport(makeFileList(fixtureFile("valid_package.siralex.zip")), deps);
    expect(outcome).toBe("failed");
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledTimes(1);
    expect(install).not.toHaveBeenCalled();
    expect(state.progress).toContain("Another dictionary operation is already in progress.");
    expect(state.progress).not.toContain("Dictionary installed.");
    expect(state.progress).not.toContain("Partial bundle data removed.");
    expect(setDbOut).not.toHaveBeenCalled();
    expect(clearInput).toHaveBeenCalled();
    expect(setEnabled.mock.calls.at(-1)).toEqual([true]);
  });

  it("prevents concurrent package import attempts", async () => {
    let resolvePrepare: ((value: VerifiedBundlePackage) => void) | undefined;
    const preparePromise = new Promise<VerifiedBundlePackage>((resolve) => {
      resolvePrepare = resolve;
    });
    const { deps, prepare } = createDeps({
      prepareVerifiedBundlePackage: vi.fn(() => preparePromise),
    });
    const files = makeFileList(fixtureFile("valid_package.siralex.zip"));
    const first = runManualPackageImport(files, deps);
    const second = await runManualPackageImport(files, deps);
    expect(second).toBe("ignored");
    expect(prepare).toHaveBeenCalledTimes(1);
    resolvePrepare?.(makeVerifiedStub());
    await first;
  });

  it("allows selecting the same package again after clearing the input", async () => {
    const { deps, prepare, clearInput } = createDeps({
      prepareVerifiedBundlePackage: vi.fn(async () => {
        throw new BundlePackageIntegrityError("payload_sha256_mismatch", "hash mismatch");
      }),
    });
    const files = makeFileList(fixtureFile("records_sha_mismatch.siralex.zip"));
    await runManualPackageImport(files, deps);
    await runManualPackageImport(files, deps);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(clearInput).toHaveBeenCalledTimes(2);
  });

  it("never passes a raw File to installVerifiedBundlePackage", async () => {
    const { deps, install } = createDeps();
    await runManualPackageImport(makeFileList(fixtureFile("valid_package.siralex.zip")), deps);
    const installArg = install.mock.calls[0]?.[0] as VerifiedBundlePackage | undefined;
    expect(installArg).toBeDefined();
    expect(installArg).not.toBeInstanceOf(File);
  });

  it("maps known package errors to concise user messages", () => {
    const messages = makeMessages();
    expect(mapPackageImportError(new BundlePackageError("corrupt_eocd", "bad zip"), messages, String).userMessage).toBe(
      messages.invalidStructure,
    );
  });
});

describe("wireManualPackageImportControls", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function wireControls(overrides: Partial<ManualPackageImportDeps> = {}) {
    const built = createDeps(overrides);
    const button = document.createElement("button");
    const input = document.createElement("input");
    input.type = "file";
    wireManualPackageImportControls({
      button,
      input,
      buildDeps: () => built.deps,
    });
    return { ...built, button, input };
  }

  function setInputFiles(input: HTMLInputElement, file: File): void {
    Object.defineProperty(input, "files", {
      configurable: true,
      value: makeFileList(file),
    });
  }

  it("clears the input and opens the file picker on button click", () => {
    const { button, input } = wireControls();
    let inputValue = "C:\\fakepath\\package.siralex.zip";
    Object.defineProperty(input, "value", {
      configurable: true,
      get: () => inputValue,
      set: (next) => {
        inputValue = next;
      },
    });
    const clickSpy = vi.spyOn(input, "click").mockImplementation(() => {});

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(inputValue).toBe("");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores button click when package work or writer work is already active", () => {
    const { button, input } = wireControls({ getBusy: () => true });
    let inputValue = "C:\\fakepath\\package.siralex.zip";
    Object.defineProperty(input, "value", {
      configurable: true,
      get: () => inputValue,
      set: (next) => {
        inputValue = next;
      },
    });
    const clickSpy = vi.spyOn(input, "click").mockImplementation(() => {});

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(inputValue).toBe("C:\\fakepath\\package.siralex.zip");
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("runs the package import flow once on input change", async () => {
    const { input, prepare } = wireControls();
    setInputFiles(input, fixtureFile("valid_package.siralex.zip"));

    input.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(prepare).toHaveBeenCalledTimes(1);
    });
  });

  it("prevents a second change event while preparation is pending", async () => {
    let resolvePrepare: ((value: VerifiedBundlePackage) => void) | undefined;
    const preparePromise = new Promise<VerifiedBundlePackage>((resolve) => {
      resolvePrepare = resolve;
    });
    const { input, prepare } = wireControls({
      prepareVerifiedBundlePackage: vi.fn(() => preparePromise),
    });
    const file = fixtureFile("valid_package.siralex.zip");
    setInputFiles(input, file);

    input.dispatchEvent(new Event("change", { bubbles: true }));
    setInputFiles(input, file);
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(prepare).toHaveBeenCalledTimes(1);
    resolvePrepare?.(makeVerifiedStub());
    await vi.waitFor(() => {
      expect(prepare).toHaveBeenCalledTimes(1);
    });
  });

  it("reports lock-unavailable failure through wired controls", async () => {
    const { input, prepare, install, clearInput, setEnabled, state } = wireControls({
      withSingleWriterLock: vi.fn(async () => {}),
    });
    setInputFiles(input, fixtureFile("valid_package.siralex.zip"));

    input.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(state.progress).toContain("Another dictionary operation is already in progress.");
    });

    expect(install).not.toHaveBeenCalled();
    expect(state.progress).not.toContain("Dictionary installed.");
    expect(clearInput).toHaveBeenCalled();
    expect(setEnabled.mock.calls.at(-1)).toEqual([true]);
  });

  it("keeps raw diagnostics out of user-facing progress for wired failures", async () => {
    const diagnostic = "BundlePackageIntegrityError: payload_sha256_mismatch hash mismatch";
    const { input, state } = wireControls({
      prepareVerifiedBundlePackage: vi.fn(async () => {
        throw new BundlePackageIntegrityError("payload_sha256_mismatch", "hash mismatch");
      }),
      formatErrorDetails: () => diagnostic,
    });
    setInputFiles(input, fixtureFile("records_sha_mismatch.siralex.zip"));

    input.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(state.dbOut).toBe(diagnostic);
    });

    expect(state.progress).toContain("Package contents do not match the manifest.");
    expect(state.progress).not.toContain("payload_sha256_mismatch");
    expect(state.progress).not.toContain("BundlePackageIntegrityError");
  });
});
