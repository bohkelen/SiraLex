import { BundlePackageError } from "./bundle_package";
import {
  BundlePackageIntegrityError,
  type VerifiedBundlePackage,
} from "./bundle_package_integrity";
import { BundlePackageInstallError } from "./bundle_package_install";
import type { InstallBundleResult } from "../install/bundle_install";

export const PACKAGE_IMPORT_DOM_IDS = {
  packageImportButton: "packageImport",
  packageImportFile: "packageImportFile",
  quickImportButton: "quickImport",
  quickImportFiles: "quickImportFiles",
  devImportBundleButton: "importBundle",
} as const;

export type ManualPackageImportMessages = {
  preparing: string;
  verifying: string;
  installing: string;
  installed: string;
  tooManyFiles: string;
  invalidStructure: string;
  invalidManifest: string;
  verificationFailed: string;
  contentsMismatch: string;
  installationFailed: string;
  partialRemovedReimport: string;
  writerBusy: string;
};

export type ManualPackageImportDeps = {
  prepareVerifiedBundlePackage: (file: File) => Promise<VerifiedBundlePackage>;
  installVerifiedBundlePackage: (verifiedPackage: VerifiedBundlePackage) => Promise<InstallBundleResult>;
  withSingleWriterLock: (label: string, fn: () => Promise<void>) => Promise<void>;
  messages: ManualPackageImportMessages;
  formatErrorDetails: (error: unknown) => string;
  setImportProgress: (visible: boolean, text: string) => void;
  appendImportProgress: (text: string) => void;
  setDbOutDiagnostic: (text: string) => void;
  hideFirstRun: () => void;
  clearPackageInput: () => void;
  setPackageControlsEnabled: (enabled: boolean) => void;
  getPackageImportInProgress: () => boolean;
  setPackageImportInProgress: (value: boolean) => void;
  getBusy: () => boolean;
};

export type ManualPackageImportOutcome = "ignored" | "completed" | "failed";

export function mapPackageImportError(
  error: unknown,
  messages: ManualPackageImportMessages,
  formatErrorDetails: (error: unknown) => string,
): { userMessage: string; diagnostic: string } {
  const diagnostic = formatErrorDetails(error);

  if (error instanceof BundlePackageError) {
    return { userMessage: messages.invalidStructure, diagnostic };
  }

  if (error instanceof BundlePackageIntegrityError) {
    switch (error.code) {
      case "manifest_invalid":
      case "manifest_invalid_utf8":
      case "manifest_too_large":
      case "manifest_payload_mapping_invalid":
        return { userMessage: messages.invalidManifest, diagnostic };
      case "payload_byte_length_mismatch":
      case "payload_stream_length_mismatch":
      case "payload_sha256_mismatch":
      case "content_sha256_mismatch":
        return { userMessage: messages.contentsMismatch, diagnostic };
      default:
        return { userMessage: messages.verificationFailed, diagnostic };
    }
  }

  if (error instanceof BundlePackageInstallError) {
    return { userMessage: messages.installationFailed, diagnostic };
  }

  return { userMessage: messages.installationFailed, diagnostic };
}

function renderPackageImportProgressFailure(
  deps: ManualPackageImportDeps,
  error: unknown,
  includePartialRemovedNote: boolean,
): void {
  const mapped = mapPackageImportError(error, deps.messages, deps.formatErrorDetails);
  deps.setImportProgress(true, mapped.userMessage);
  if (includePartialRemovedNote) {
    deps.appendImportProgress(deps.messages.partialRemovedReimport);
  }
}

function renderPackageImportFailure(
  deps: ManualPackageImportDeps,
  error: unknown,
  includePartialRemovedNote: boolean,
): void {
  renderPackageImportProgressFailure(deps, error, includePartialRemovedNote);
  deps.setDbOutDiagnostic(deps.formatErrorDetails(error));
}

export type WireManualPackageImportControlsArgs = {
  button: HTMLButtonElement;
  input: HTMLInputElement;
  buildDeps: () => ManualPackageImportDeps;
};

export function wireManualPackageImportControls(args: WireManualPackageImportControlsArgs): void {
  args.button.addEventListener("click", () => {
    const deps = args.buildDeps();
    if (deps.getPackageImportInProgress() || deps.getBusy()) return;
    args.input.value = "";
    args.input.click();
  });

  args.input.addEventListener("change", () => {
    void runManualPackageImport(args.input.files, args.buildDeps());
  });
}

export async function runManualPackageImport(
  files: FileList | null,
  deps: ManualPackageImportDeps,
): Promise<ManualPackageImportOutcome> {
  if (deps.getPackageImportInProgress() || deps.getBusy()) {
    deps.clearPackageInput();
    return "ignored";
  }

  if (!files || files.length === 0) {
    deps.clearPackageInput();
    return "ignored";
  }

  if (files.length > 1) {
    deps.setImportProgress(true, deps.messages.tooManyFiles);
    deps.clearPackageInput();
    return "failed";
  }

  const file = files[0];
  if (!file) {
    deps.clearPackageInput();
    return "ignored";
  }

  deps.setPackageImportInProgress(true);
  deps.setPackageControlsEnabled(false);
  deps.setImportProgress(true, deps.messages.preparing);

  let verified: VerifiedBundlePackage | undefined;
  try {
    deps.setImportProgress(true, deps.messages.verifying);
    verified = await deps.prepareVerifiedBundlePackage(file);
  } catch (error) {
    renderPackageImportFailure(deps, error, false);
    deps.clearPackageInput();
    deps.setPackageImportInProgress(false);
    deps.setPackageControlsEnabled(true);
    return "failed";
  }

  let installCallbackStarted = false;
  let callbackFailure: unknown;
  let callbackFailureRendered = false;
  try {
    await deps.withSingleWriterLock("install package", async () => {
      installCallbackStarted = true;
      deps.hideFirstRun();
      deps.setImportProgress(true, deps.messages.installing);
      try {
        const result = await deps.installVerifiedBundlePackage(verified!);
        deps.setImportProgress(
          true,
          `${deps.messages.installed}\n${result.recordsCount} records, ${result.indexCount} index entries\n`,
        );
      } catch (error) {
        callbackFailure = error;
        callbackFailureRendered = true;
        renderPackageImportProgressFailure(deps, error, true);
        throw error;
      }
    });
  } catch (error) {
    const effectiveError = callbackFailure ?? error;

    if (!callbackFailureRendered) {
      renderPackageImportProgressFailure(deps, effectiveError, false);
    }

    deps.setDbOutDiagnostic(deps.formatErrorDetails(effectiveError));

    deps.clearPackageInput();
    deps.setPackageImportInProgress(false);
    deps.setPackageControlsEnabled(true);
    return "failed";
  }

  if (!installCallbackStarted) {
    deps.setImportProgress(true, deps.messages.writerBusy);
    deps.clearPackageInput();
    deps.setPackageImportInProgress(false);
    deps.setPackageControlsEnabled(true);
    return "failed";
  }

  deps.clearPackageInput();
  deps.setPackageImportInProgress(false);
  deps.setPackageControlsEnabled(true);
  return "completed";
}
