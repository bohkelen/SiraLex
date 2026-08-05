/**
 * LP1I4 / UX2I6B2 — Learning backup renderer / i18n presentation tests.
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale, t } from "../i18n";
import type { LearningBackupSurfaceVm } from "../learning/learning_backup_surface";
import { LEARNING_BACKUP_PACKAGE_SCHEMA } from "../learning/learning_backup_package";
import { renderLearningBackupSurface } from "../render/render_learning_backup";

function baseVm(overrides: Partial<LearningBackupSurfaceVm> = {}): LearningBackupSurfaceVm {
  return {
    generation: 1,
    recordCount: 2,
    exportBusy: false,
    restoreBusy: false,
    surfaceBusy: false,
    privacyVisible: true,
    exportEnabled: true,
    restoreFileEnabled: true,
    focusTarget: "none",
    restore: { phase: "idle" },
    exportResult: null,
    ...overrides,
  };
}

const noopCallbacks = {
  onExport: vi.fn(),
  onFileSelected: vi.fn(),
  onSelectPolicy: vi.fn(),
  onRequestCommit: vi.fn(),
  onCancelConfirm: vi.fn(),
  onConfirmReplaceAll: vi.fn(),
  onCancelRestore: vi.fn(),
};

function previewVm(
  overrides: Partial<LearningBackupSurfaceVm> = {},
): LearningBackupSurfaceVm {
  return baseVm({
    focusTarget: "preview_heading",
    restore: {
      phase: "preview",
      filename: "b.json",
      selectedPolicy: "add_missing",
      addMissingAvailable: true,
      preview: {
        package_schema: LEARNING_BACKUP_PACKAGE_SCHEMA,
        exported_at: "2026-07-30T22:30:00.000Z",
        record_count: 12,
        current_local_record_count: 8,
        local_validation: { state: "valid" },
        bundle_compatibility: [
          { bundle_id: "b1", record_count: 12, state: "installed_matching" },
        ],
        add_missing: { state: "available", add_count: 4, skipped_existing_count: 8 },
        replace_all: { previous_count: 8, restored_count: 12 },
      },
    },
    ...overrides,
  });
}

beforeEach(() => {
  setCurrentLocale("en");
});

describe("renderLearningBackupSurface", () => {
  it("renders EN management heading, privacy, export/restore controls, and file label", () => {
    const host = document.createElement("div");
    const { root, fileInput } = renderLearningBackupSurface(host, baseVm(), noopCallbacks);
    expect(root.querySelector("#learning-backup-heading")?.textContent).toBe(
      "Manage Learning Data",
    );
    expect(root.classList.contains("ux2-learning-backup")).toBe(true);
    expect(root.textContent).toContain("Protect your saved vocabulary");
    expect(root.textContent).toContain("This backup contains your saved vocabulary");
    expect(root.textContent).toContain("Store it somewhere you trust");
    expect(root.textContent).toContain("Only restore files you trust");
    expect(root.textContent).toContain("Export Learning Backup");
    expect(root.textContent).toContain("Restore Learning Backup");
    expect(root.textContent).toContain("2 Learning Records on this device");
    expect(fileInput.getAttribute("id")).toBe("learning-backup-file-input");
    expect(root.querySelector("label[for='learning-backup-file-input']")).toBeTruthy();
    expect(root.querySelector("button")?.tagName).toBe("BUTTON");
    expect(root.querySelector(".learning-backup-export")).toBeTruthy();
    expect(root.querySelector(".learning-backup-restore")).toBeTruthy();
  });

  it("disables export when empty and does not invent backup content", () => {
    const host = document.createElement("div");
    const { root } = renderLearningBackupSurface(
      host,
      baseVm({ recordCount: 0, exportEnabled: false }),
      noopCallbacks,
    );
    expect(root.textContent).toContain("No learning data to back up");
    const exportBtn = root.querySelector(".learning-backup-export button") as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(true);
  });

  it("renders preview radios, compatibility table, and disables Add missing when unavailable", () => {
    const host = document.createElement("div");
    renderLearningBackupSurface(
      host,
      baseVm({
        focusTarget: "preview_heading",
        restore: {
          phase: "preview",
          filename: "b.json",
          selectedPolicy: null,
          addMissingAvailable: false,
          preview: {
            package_schema: LEARNING_BACKUP_PACKAGE_SCHEMA,
            exported_at: "2026-07-30T22:30:00.000Z",
            record_count: 1,
            current_local_record_count: 1,
            local_validation: { state: "invalid", invalid_record_count: 1 },
            bundle_compatibility: [
              { bundle_id: "b1", record_count: 1, state: "not_installed" },
            ],
            add_missing: { state: "unavailable", reason: "invalid_local_records" },
            replace_all: { previous_count: 1, restored_count: 1 },
          },
        },
      }),
      noopCallbacks,
    );
    const add = host.querySelector(
      'input[name="learning-backup-policy"][value="add_missing"]',
    ) as HTMLInputElement | null;
    const replace = host.querySelector(
      'input[name="learning-backup-policy"][value="replace_all"]',
    ) as HTMLInputElement | null;
    expect(add?.disabled).toBe(true);
    expect(replace?.disabled).toBe(false);
    expect(replace?.checked).toBe(false);
    expect(host.textContent).toContain("Dictionary not installed");
    expect(host.textContent).toContain("Add missing is unavailable");
    expect(host.textContent).toContain("Records in backup: 1");
    expect(host.textContent).toContain("Records currently on this device: 1");
    expect(host.textContent).not.toContain("sha256:");
    expect(host.querySelector("table.learning-backup-compat-table")).toBeTruthy();
    expect(host.querySelector("fieldset.learning-backup-policies")).toBeTruthy();
    expect(host.querySelector("#learning-backup-preview-heading")).toBeTruthy();
  });

  it("renders ready preview with add-missing and replace-all impact counts", () => {
    const host = document.createElement("div");
    renderLearningBackupSurface(host, previewVm(), noopCallbacks);
    expect(host.textContent).toContain("Records to add: 4");
    expect(host.textContent).toContain("Existing identities to keep: 8");
    expect(host.textContent).toContain("Previous Learning Records: 8");
    expect(host.textContent).toContain("Restored Learning Records: 12");
    expect(host.textContent).toContain("Dictionary installed and matching");
    expect(host.textContent).toContain("Restore learning data");
    expect(host.textContent).not.toContain("alpha_mnk");
  });

  it("uses Continue for replace-all preview action", () => {
    const host = document.createElement("div");
    renderLearningBackupSurface(
      host,
      previewVm({
        restore: {
          phase: "preview",
          filename: "b.json",
          selectedPolicy: "replace_all",
          addMissingAvailable: true,
          preview: {
            package_schema: LEARNING_BACKUP_PACKAGE_SCHEMA,
            exported_at: "2026-07-30T22:30:00.000Z",
            record_count: 12,
            current_local_record_count: 8,
            local_validation: { state: "valid" },
            bundle_compatibility: [],
            add_missing: { state: "available", add_count: 4, skipped_existing_count: 8 },
            replace_all: { previous_count: 8, restored_count: 12 },
          },
        },
      }),
      noopCallbacks,
    );
    const commit = host.querySelector(".learning-backup-actions .btn") as HTMLButtonElement;
    expect(commit.textContent).toBe("Continue");
  });

  it("opens accessible replace confirmation dialog", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    try {
      renderLearningBackupSurface(
        host,
        baseVm({
          focusTarget: "confirm_heading",
          restore: {
            phase: "confirming",
            filename: "b.json",
            selectedPolicy: "replace_all",
            preview: {
              package_schema: LEARNING_BACKUP_PACKAGE_SCHEMA,
              exported_at: "2026-07-30T22:30:00.000Z",
              record_count: 1,
              current_local_record_count: 1,
              local_validation: { state: "valid" },
              bundle_compatibility: [],
              add_missing: { state: "available", add_count: 0, skipped_existing_count: 1 },
              replace_all: { previous_count: 1, restored_count: 1 },
            },
          },
        }),
        noopCallbacks,
      );
      const dialog = host.querySelector("dialog.learning-backup-confirm-dialog");
      expect(dialog).toBeTruthy();
      expect(dialog?.textContent).toContain("permanently remove the current Learning Records");
      expect(dialog?.textContent).toContain("Dictionary data will not be changed");
      expect(dialog?.textContent).toContain("Cancel");
      expect(dialog?.textContent).toContain("Replace all learning records");
      expect(dialog?.isConnected).toBe(true);
      expect(
        dialog instanceof HTMLDialogElement
          ? dialog.open || dialog.hasAttribute("open")
          : dialog?.hasAttribute("open"),
      ).toBe(true);
      expect(host.querySelector("#learning-backup-heading")).toBeTruthy();
    } finally {
      host.remove();
    }
  });

  it("renders restore success with Open Saved action", () => {
    const onOpen = vi.fn();
    const host = document.createElement("div");
    renderLearningBackupSurface(
      host,
      baseVm({
        focusTarget: "result_heading",
        restore: {
          phase: "success",
          policy: "replace_all",
          previous_count: 8,
          restored_count: 12,
        },
      }),
      { ...noopCallbacks, onOpenSavedVocabulary: onOpen },
    );
    expect(host.textContent).toContain("Restore completed");
    expect(host.textContent).toContain("Previous Learning Records: 8");
    expect(host.textContent).toContain("Restored Learning Records: 12");
    const openBtn = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Open saved vocabulary"),
    );
    expect(openBtn).toBeTruthy();
    openBtn?.click();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("renders invalid and error states with non-mutation boundary", () => {
    const host = document.createElement("div");
    renderLearningBackupSurface(
      host,
      baseVm({
        focusTarget: "invalid_heading",
        restore: {
          phase: "invalid",
          filename: "bad.json",
          error: { code: "invalid_json", messageKey: "learningBackup.error.invalidJson" },
          detailCodes: [],
        },
      }),
      noopCallbacks,
    );
    expect(host.textContent).toContain("Backup file is invalid");
    expect(host.textContent).toContain("No Learning data was changed");
    expect(host.textContent).toContain("Dictionary data was not changed");
    expect(host.textContent).not.toContain("TypeError");
  });

  it("renders focused French copy for heading, policies, and privacy", () => {
    setCurrentLocale("fr");
    const host = document.createElement("div");
    renderLearningBackupSurface(host, baseVm(), noopCallbacks);
    expect(host.textContent).toContain("Gérer les données d’apprentissage");
    expect(host.textContent).toContain("Exporter la sauvegarde d’apprentissage");
    expect(host.textContent).toContain("Restaurer la sauvegarde d’apprentissage");
    expect(host.textContent).toContain("vocabulaire enregistré");
    expect(t("learningBackup.policy.addMissing")).toContain("manquants");
    expect(t("learningBackup.policy.replaceAll")).toContain("Remplacer");
    expect(t("learningBackup.confirm.replaceWarning")).toContain("définitivement");
    expect(t("learningBackup.policy.continueReplace")).toBe("Continuer");
  });
});
