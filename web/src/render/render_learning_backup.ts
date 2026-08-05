/**
 * LP1 / UX2I6B2 — Manage Learning Data renderer (presentation only).
 */

import { t, type TranslationKey } from "../i18n";
import { LEARNING_BACKUP_FILE_ACCEPT } from "../learning/learning_backup_file";
import type {
  LearningBackupFocusTarget,
  LearningBackupSurfaceVm,
} from "../learning/learning_backup_surface";
import type { LearningBackupRestorePolicy } from "../learning/learning_backup_package";

export type LearningBackupRenderCallbacks = {
  onExport: () => void;
  onFileSelected: (file: File | null) => void;
  onSelectPolicy: (policy: LearningBackupRestorePolicy) => void;
  onRequestCommit: () => void;
  onCancelConfirm: () => void;
  onConfirmReplaceAll: () => void;
  onCancelRestore: () => void;
  onOpenSavedVocabulary?: () => void;
};

export type LearningBackupRenderResult = {
  root: HTMLElement;
  fileInput: HTMLInputElement;
  focusTarget: HTMLElement | null;
};

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function tt(key: TranslationKey, vars?: Record<string, string | number>): string {
  return t(key, vars);
}

function compatibilityLabel(
  state: "installed_matching" | "installed_hash_mismatch" | "not_installed",
): string {
  if (state === "installed_matching") return tt("learningBackup.compat.matching");
  if (state === "installed_hash_mismatch") return tt("learningBackup.compat.mismatch");
  return tt("learningBackup.compat.notInstalled");
}

function applyFocus(target: LearningBackupFocusTarget, map: Record<string, HTMLElement | null>): HTMLElement | null {
  const node = map[target] ?? null;
  if (node && typeof node.focus === "function") {
    node.focus();
  }
  return node;
}

function appendNonMutationBoundary(parent: HTMLElement): void {
  parent.appendChild(el("p", "ux2-learning-boundary", tt("learningBackup.restore.noLearningChanged")));
  parent.appendChild(el("p", "ux2-learning-boundary", tt("learningBackup.restore.noDataChanged")));
}

export function renderLearningBackupSurface(
  host: HTMLElement,
  vm: LearningBackupSurfaceVm,
  callbacks: LearningBackupRenderCallbacks,
): LearningBackupRenderResult {
  host.replaceChildren();
  const root = el("section", "learning-backup-surface ux2-learning-backup");
  root.setAttribute("aria-labelledby", "learning-backup-heading");
  if (vm.surfaceBusy) root.setAttribute("aria-busy", "true");

  const heading = el(
    "h2",
    "title learning-backup-heading ux2-type-page-title ux2-learning-title",
    tt("learningBackup.heading"),
  );
  heading.id = "learning-backup-heading";
  heading.tabIndex = -1;
  root.appendChild(heading);

  root.appendChild(el("p", "subtitle ux2-learning-intro", tt("learningBackup.pageIntro")));
  root.appendChild(el("p", "ux2-learning-local-only", tt("learningBackup.localOnly")));

  const privacy = el("div", "learning-backup-privacy ux2-learning-privacy");
  privacy.setAttribute("role", "note");
  privacy.appendChild(el("p", undefined, tt("learningBackup.privacy.contains")));
  privacy.appendChild(el("p", undefined, tt("learningBackup.privacy.store")));
  root.appendChild(privacy);

  const layout = el("div", "ux2-learning-layout");
  const phase = vm.restore.phase;
  const previewActive =
    phase === "preview" || phase === "confirming" || phase === "restoring";
  if (previewActive) {
    layout.classList.add("ux2-learning-layout--preview");
  }

  // --- Export / Backup ---
  const exportBlock = el("div", "learning-backup-export ux2-learning-section");
  exportBlock.appendChild(
    el("h3", "learning-backup-subheading ux2-type-section-heading", tt("learningBackup.export.title")),
  );
  exportBlock.appendChild(
    el("p", "ux2-learning-section-help", tt("learningBackup.backupSectionHelp")),
  );

  if (vm.recordCount === null) {
    exportBlock.appendChild(el("p", "ux2-learning-count", tt("learningBackup.export.loading")));
  } else if (vm.recordCount === 0) {
    exportBlock.appendChild(el("p", "ux2-learning-count", tt("learningBackup.export.empty")));
  } else {
    exportBlock.appendChild(
      el("p", "ux2-learning-count", tt("learningBackup.export.count", { count: vm.recordCount })),
    );
  }

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "btn ux2-learning-primary-btn";
  exportBtn.textContent = tt("learningBackup.export.button");
  exportBtn.disabled = !vm.exportEnabled;
  exportBtn.addEventListener("click", () => callbacks.onExport());
  exportBlock.appendChild(exportBtn);
  layout.appendChild(exportBlock);

  // --- Restore ---
  const restoreBlock = el("div", "learning-backup-restore ux2-learning-section");
  restoreBlock.appendChild(
    el("h3", "learning-backup-subheading ux2-type-section-heading", tt("learningBackup.restore.title")),
  );
  restoreBlock.appendChild(
    el("p", "ux2-learning-section-help", tt("learningBackup.restoreSectionHelp")),
  );
  restoreBlock.appendChild(
    el("p", "ux2-learning-trust", tt("learningBackup.privacy.trust")),
  );

  const fileLabel = el(
    "label",
    "label learning-backup-file-label ux2-learning-file-label",
    tt("learningBackup.restore.chooseFile"),
  );
  fileLabel.setAttribute("for", "learning-backup-file-input");
  const fileInput = document.createElement("input");
  fileInput.id = "learning-backup-file-input";
  fileInput.type = "file";
  fileInput.accept = LEARNING_BACKUP_FILE_ACCEPT;
  fileInput.disabled = !vm.restoreFileEnabled;
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0] ?? null;
    callbacks.onFileSelected(file);
    fileInput.value = "";
  });
  fileLabel.appendChild(fileInput);
  restoreBlock.appendChild(fileLabel);

  let invalidHeading: HTMLElement | null = null;
  let previewHeading: HTMLElement | null = null;
  let confirmHeading: HTMLElement | null = null;
  let resultHeading: HTMLElement | null = null;
  let policyAdd: HTMLInputElement | null = null;
  let policyReplace: HTMLInputElement | null = null;

  if (phase === "reading" || phase === "validating") {
    const status = el(
      "p",
      "learning-backup-status ux2-learning-status",
      phase === "reading"
        ? tt("learningBackup.restore.reading", { filename: vm.restore.filename })
        : tt("learningBackup.restore.validating", { filename: vm.restore.filename }),
    );
    status.setAttribute("role", "status");
    restoreBlock.appendChild(status);
  }

  if (phase === "invalid") {
    invalidHeading = el(
      "h3",
      "learning-backup-subheading ux2-type-section-heading",
      tt("learningBackup.restore.invalidHeading"),
    );
    invalidHeading.tabIndex = -1;
    restoreBlock.appendChild(invalidHeading);
    const err = el("p", "ux2-learning-error", tt(vm.restore.error.messageKey));
    err.setAttribute("role", "alert");
    restoreBlock.appendChild(err);
    restoreBlock.appendChild(
      el("p", "ux2-learning-meta-secondary", tt("learningBackup.restore.selectedFile", {
        filename: vm.restore.filename,
      })),
    );
    appendNonMutationBoundary(restoreBlock);
  }

  if (phase === "preview" || phase === "confirming" || phase === "restoring") {
    const preview = vm.restore.preview;
    previewHeading = el(
      "h3",
      "learning-backup-subheading ux2-type-section-heading",
      tt("learningBackup.preview.heading"),
    );
    previewHeading.id = "learning-backup-preview-heading";
    previewHeading.tabIndex = -1;
    restoreBlock.appendChild(previewHeading);

    const backupMeta = el("div", "ux2-learning-preview-meta");
    backupMeta.appendChild(
      el("p", undefined, tt("learningBackup.preview.exportedAt", { value: preview.exported_at })),
    );
    backupMeta.appendChild(
      el(
        "p",
        undefined,
        tt("learningBackup.preview.counts", {
          backup: preview.record_count,
          local: preview.current_local_record_count,
          bundles: preview.bundle_compatibility.length,
        }),
      ),
    );
    backupMeta.appendChild(
      el(
        "p",
        "ux2-learning-meta-secondary",
        tt("learningBackup.preview.schema", { value: preview.package_schema }),
      ),
    );
    backupMeta.appendChild(
      el(
        "p",
        "ux2-learning-meta-secondary",
        tt("learningBackup.restore.selectedFile", { filename: vm.restore.filename }),
      ),
    );
    restoreBlock.appendChild(backupMeta);

    if (preview.local_validation.state === "invalid") {
      const warn = el("div", "learning-backup-local-invalid ux2-learning-local-invalid");
      warn.appendChild(
        el(
          "p",
          undefined,
          tt("learningBackup.localInvalid.explanation", {
            count: preview.local_validation.invalid_record_count,
          }),
        ),
      );
      warn.appendChild(el("p", undefined, tt("learningBackup.localInvalid.addUnavailable")));
      restoreBlock.appendChild(warn);
    }

    const compatHeading = el(
      "h4",
      "learning-backup-subheading ux2-learning-compat-heading",
      tt("learningBackup.compat.heading"),
    );
    restoreBlock.appendChild(compatHeading);
    const table = document.createElement("table");
    table.className = "learning-backup-compat-table ux2-learning-compat-table";
    table.setAttribute("aria-label", tt("learningBackup.compat.heading"));
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    for (const key of [
      "learningBackup.compat.colBundle",
      "learningBackup.compat.colRecords",
      "learningBackup.compat.colState",
    ] as const) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = tt(key);
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const row of preview.bundle_compatibility) {
      const tr = document.createElement("tr");
      const tdBundle = document.createElement("td");
      tdBundle.textContent = row.bundle_id;
      const tdCount = document.createElement("td");
      tdCount.textContent = String(row.record_count);
      const tdState = document.createElement("td");
      tdState.textContent = compatibilityLabel(row.state);
      tr.append(tdBundle, tdCount, tdState);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    restoreBlock.appendChild(table);

    const fieldset = document.createElement("fieldset");
    fieldset.className = "learning-backup-policies ux2-learning-policies";
    fieldset.disabled = phase !== "preview" || vm.restoreBusy;
    const legend = document.createElement("legend");
    legend.textContent = tt("learningBackup.policy.legend");
    fieldset.appendChild(legend);

    const addAvailable = preview.add_missing.state === "available";
    const addPanel = el("div", "ux2-learning-policy-panel");
    const addLabel = el("label", "learning-backup-policy-option");
    policyAdd = document.createElement("input");
    policyAdd.type = "radio";
    policyAdd.name = "learning-backup-policy";
    policyAdd.value = "add_missing";
    policyAdd.disabled = !addAvailable || phase !== "preview";
    policyAdd.checked =
      (phase === "preview" && vm.restore.selectedPolicy === "add_missing") ||
      (phase === "restoring" && vm.restore.selectedPolicy === "add_missing");
    policyAdd.addEventListener("change", () => {
      if (policyAdd?.checked) callbacks.onSelectPolicy("add_missing");
    });
    addLabel.appendChild(policyAdd);
    addLabel.appendChild(document.createTextNode(` ${tt("learningBackup.policy.addMissing")}`));
    addPanel.appendChild(addLabel);
    addPanel.appendChild(el("p", "subtitle ux2-learning-policy-help", tt("learningBackup.policy.addMissingHelp")));
    if (addAvailable && preview.add_missing.state === "available") {
      addPanel.appendChild(
        el(
          "p",
          "ux2-learning-policy-counts",
          tt("learningBackup.policy.addMissingCounts", {
            add: preview.add_missing.add_count,
            skip: preview.add_missing.skipped_existing_count,
          }),
        ),
      );
    } else {
      addPanel.appendChild(
        el("p", "subtitle ux2-learning-policy-help", tt("learningBackup.localInvalid.addUnavailable")),
      );
    }
    fieldset.appendChild(addPanel);

    const replacePanel = el("div", "ux2-learning-policy-panel ux2-learning-policy-panel--replace");
    const replaceLabel = el("label", "learning-backup-policy-option");
    policyReplace = document.createElement("input");
    policyReplace.type = "radio";
    policyReplace.name = "learning-backup-policy";
    policyReplace.value = "replace_all";
    policyReplace.disabled = phase !== "preview";
    policyReplace.checked =
      (phase === "preview" && vm.restore.selectedPolicy === "replace_all") ||
      phase === "confirming" ||
      (phase === "restoring" && vm.restore.selectedPolicy === "replace_all");
    policyReplace.addEventListener("change", () => {
      if (policyReplace?.checked) callbacks.onSelectPolicy("replace_all");
    });
    replaceLabel.appendChild(policyReplace);
    replaceLabel.appendChild(document.createTextNode(` ${tt("learningBackup.policy.replaceAll")}`));
    replacePanel.appendChild(replaceLabel);
    replacePanel.appendChild(
      el("p", "subtitle ux2-learning-policy-help", tt("learningBackup.policy.replaceAllHelp")),
    );
    replacePanel.appendChild(
      el(
        "p",
        "ux2-learning-policy-counts",
        tt("learningBackup.policy.replaceAllCounts", {
          previous: preview.replace_all.previous_count,
          restored: preview.replace_all.restored_count,
        }),
      ),
    );
    fieldset.appendChild(replacePanel);
    restoreBlock.appendChild(fieldset);

    if (phase === "preview") {
      const actions = el("div", "row learning-backup-actions ux2-learning-actions");
      const commitBtn = document.createElement("button");
      commitBtn.type = "button";
      commitBtn.className = "btn ux2-learning-primary-btn";
      commitBtn.textContent =
        vm.restore.selectedPolicy === "replace_all"
          ? tt("learningBackup.policy.continueReplace")
          : tt("learningBackup.policy.restoreAction");
      commitBtn.disabled = vm.restore.selectedPolicy == null || vm.surfaceBusy;
      commitBtn.addEventListener("click", () => callbacks.onRequestCommit());
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn ux2-learning-secondary-btn";
      cancelBtn.textContent = tt("learningBackup.cancel");
      cancelBtn.disabled = vm.surfaceBusy;
      cancelBtn.addEventListener("click", () => callbacks.onCancelRestore());
      actions.append(commitBtn, cancelBtn);
      restoreBlock.appendChild(actions);
    }

    if (phase === "restoring") {
      const status = el(
        "p",
        "learning-backup-status ux2-learning-status",
        tt("learningBackup.restore.restoring"),
      );
      status.setAttribute("role", "status");
      restoreBlock.appendChild(status);
    }
  }

  if (phase === "confirming") {
    const dialog = document.createElement("dialog");
    dialog.className = "learning-backup-confirm-dialog ux2-learning-confirm-dialog";
    dialog.setAttribute("aria-labelledby", "learning-backup-confirm-heading");
    confirmHeading = el(
      "h3",
      "learning-backup-subheading ux2-type-section-heading",
      tt("learningBackup.confirm.heading"),
    );
    confirmHeading.id = "learning-backup-confirm-heading";
    confirmHeading.tabIndex = -1;
    dialog.appendChild(confirmHeading);
    dialog.appendChild(el("p", undefined, tt("learningBackup.confirm.replaceWarning")));
    const actions = el("div", "row ux2-learning-actions");
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn ux2-learning-secondary-btn";
    cancelBtn.textContent = tt("learningBackup.cancel");
    cancelBtn.addEventListener("click", () => {
      dialog.close();
      callbacks.onCancelConfirm();
    });
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "btn ux2-learning-primary-btn";
    confirmBtn.textContent = tt("learningBackup.confirm.replaceAction");
    confirmBtn.addEventListener("click", () => {
      dialog.close();
      callbacks.onConfirmReplaceAll();
    });
    actions.append(cancelBtn, confirmBtn);
    dialog.appendChild(actions);
    restoreBlock.appendChild(dialog);
  }

  if (phase === "success") {
    resultHeading = el(
      "h3",
      "learning-backup-subheading ux2-type-section-heading",
      tt("learningBackup.restore.completed"),
    );
    resultHeading.tabIndex = -1;
    restoreBlock.appendChild(resultHeading);
    if (vm.restore.policy === "add_missing") {
      restoreBlock.appendChild(
        el(
          "p",
          "ux2-learning-success-detail",
          tt("learningBackup.restore.successAdd", {
            added: vm.restore.added_count ?? 0,
            kept: vm.restore.unchanged_count ?? 0,
          }),
        ),
      );
    } else {
      restoreBlock.appendChild(
        el(
          "p",
          "ux2-learning-success-detail",
          tt("learningBackup.restore.successReplace", {
            previous: vm.restore.previous_count ?? 0,
            restored: vm.restore.restored_count ?? 0,
          }),
        ),
      );
    }
    if (callbacks.onOpenSavedVocabulary) {
      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "btn ux2-learning-primary-btn";
      openBtn.textContent = tt("learningBackup.openSaved");
      openBtn.addEventListener("click", () => callbacks.onOpenSavedVocabulary?.());
      restoreBlock.appendChild(openBtn);
    }
  }

  if (phase === "error") {
    resultHeading = el(
      "h3",
      "learning-backup-subheading ux2-type-section-heading",
      tt("learningBackup.restore.failedHeading"),
    );
    resultHeading.tabIndex = -1;
    restoreBlock.appendChild(resultHeading);
    const err = el("p", "ux2-learning-error", tt(vm.restore.messageKey));
    err.setAttribute("role", "alert");
    restoreBlock.appendChild(err);
    appendNonMutationBoundary(restoreBlock);
  }

  layout.appendChild(restoreBlock);
  root.appendChild(layout);

  // Export / shared result region
  const resultRegion = el("div", "learning-backup-result ux2-learning-result");
  resultRegion.setAttribute("role", "status");
  if (vm.exportResult?.kind === "success") {
    if (!resultHeading) {
      resultHeading = el(
        "h3",
        "learning-backup-subheading ux2-type-section-heading",
        tt("learningBackup.export.created"),
      );
      resultHeading.tabIndex = -1;
      resultRegion.appendChild(resultHeading);
    }
    resultRegion.appendChild(
      el(
        "p",
        undefined,
        tt("learningBackup.export.createdDetail", {
          count: vm.exportResult.recordCount,
          filename: vm.exportResult.filename,
        }),
      ),
    );
  } else if (vm.exportResult?.kind === "error") {
    if (!resultHeading) {
      resultHeading = el(
        "h3",
        "learning-backup-subheading ux2-type-section-heading",
        tt("learningBackup.export.failedHeading"),
      );
      resultHeading.tabIndex = -1;
      resultRegion.appendChild(resultHeading);
    }
    const err = el("p", "ux2-learning-error", tt(vm.exportResult.messageKey));
    err.setAttribute("role", "alert");
    resultRegion.appendChild(err);
    appendNonMutationBoundary(resultRegion);
  }
  root.appendChild(resultRegion);

  host.appendChild(root);

  const confirmDialog = root.querySelector("dialog.learning-backup-confirm-dialog");
  if (confirmDialog instanceof HTMLDialogElement) {
    if (confirmDialog.isConnected && typeof confirmDialog.showModal === "function") {
      try {
        confirmDialog.showModal();
      } catch {
        confirmDialog.setAttribute("open", "");
      }
    } else {
      confirmDialog.setAttribute("open", "");
    }
  }

  const focusNode = applyFocus(vm.focusTarget, {
    none: null,
    invalid_heading: invalidHeading,
    preview_heading: previewHeading,
    confirm_heading: confirmHeading,
    result_heading: resultHeading,
    policy_add_missing: policyAdd,
    policy_replace_all: policyReplace,
  });

  return { root, fileInput, focusTarget: focusNode };
}
