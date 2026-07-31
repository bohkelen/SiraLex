/**
 * LP1I4 — Learning backup renderer / i18n presentation tests.
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
    expect(root.textContent).toContain("This backup contains your saved vocabulary");
    expect(root.textContent).toContain("Export Learning Backup");
    expect(root.textContent).toContain("Restore Learning Backup");
    expect(fileInput.getAttribute("id")).toBe("learning-backup-file-input");
    expect(root.querySelector("label[for='learning-backup-file-input']")).toBeTruthy();
    expect(root.querySelector("button")?.tagName).toBe("BUTTON");
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
    expect(host.textContent).toContain("Dictionary not installed");
    expect(host.textContent).toContain("Add missing is unavailable");
    expect(host.querySelector("table.learning-backup-compat-table")).toBeTruthy();
    expect(host.querySelector("fieldset.learning-backup-policies")).toBeTruthy();
  });

  it("opens accessible replace confirmation dialog", () => {
    const host = document.createElement("div");
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
  });
});
