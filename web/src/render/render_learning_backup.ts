/**
 * LP1I4 — Manage Learning Data renderer (presentation only).
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

export function renderLearningBackupSurface(
  host: HTMLElement,
  vm: LearningBackupSurfaceVm,
  callbacks: LearningBackupRenderCallbacks,
): LearningBackupRenderResult {
  host.replaceChildren();
  const root = el("section", "learning-backup-surface");
  root.setAttribute("aria-labelledby", "learning-backup-heading");
  if (vm.surfaceBusy) root.setAttribute("aria-busy", "true");

  const heading = el("h2", "title learning-backup-heading", tt("learningBackup.heading"));
  heading.id = "learning-backup-heading";
  root.appendChild(heading);

  root.appendChild(el("p", "subtitle", tt("learningBackup.localOnly")));

  const privacy = el("div", "learning-backup-privacy");
  privacy.setAttribute("role", "note");
  privacy.appendChild(el("p", undefined, tt("learningBackup.privacy.contains")));
  privacy.appendChild(el("p", undefined, tt("learningBackup.privacy.store")));
  privacy.appendChild(el("p", undefined, tt("learningBackup.privacy.trust")));
  root.appendChild(privacy);

  // --- Export ---
  const exportBlock = el("div", "learning-backup-export");
  const exportHeading = el("h3", "learning-backup-subheading", tt("learningBackup.export.title"));
  exportBlock.appendChild(exportHeading);

  if (vm.recordCount === null) {
    exportBlock.appendChild(el("p", "mono", tt("learningBackup.export.loading")));
  } else if (vm.recordCount === 0) {
    exportBlock.appendChild(el("p", undefined, tt("learningBackup.export.empty")));
  } else {
    exportBlock.appendChild(
      el("p", "mono", tt("learningBackup.export.count", { count: vm.recordCount })),
    );
  }

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "btn";
  exportBtn.textContent = tt("learningBackup.export.button");
  exportBtn.disabled = !vm.exportEnabled;
  exportBtn.addEventListener("click", () => callbacks.onExport());
  exportBlock.appendChild(exportBtn);
  root.appendChild(exportBlock);

  // --- Restore ---
  const restoreBlock = el("div", "learning-backup-restore");
  restoreBlock.appendChild(el("h3", "learning-backup-subheading", tt("learningBackup.restore.title")));

  const fileLabel = el("label", "label learning-backup-file-label", tt("learningBackup.restore.chooseFile"));
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

  const phase = vm.restore.phase;

  if (phase === "reading" || phase === "validating") {
    const status = el(
      "p",
      "learning-backup-status",
      phase === "reading"
        ? tt("learningBackup.restore.reading", { filename: vm.restore.filename })
        : tt("learningBackup.restore.validating", { filename: vm.restore.filename }),
    );
    status.setAttribute("role", "status");
    restoreBlock.appendChild(status);
  }

  if (phase === "invalid") {
    invalidHeading = el("h3", "learning-backup-subheading", tt("learningBackup.restore.invalidHeading"));
    invalidHeading.tabIndex = -1;
    restoreBlock.appendChild(invalidHeading);
    restoreBlock.appendChild(
      el("p", undefined, tt(vm.restore.error.messageKey)),
    );
    restoreBlock.appendChild(
      el("p", "mono", tt("learningBackup.restore.selectedFile", { filename: vm.restore.filename })),
    );
  }

  if (phase === "preview" || phase === "confirming" || phase === "restoring") {
    const preview = vm.restore.preview;
    previewHeading = el("h3", "learning-backup-subheading", tt("learningBackup.preview.heading"));
    previewHeading.id = "learning-backup-preview-heading";
    previewHeading.tabIndex = -1;
    restoreBlock.appendChild(previewHeading);

    restoreBlock.appendChild(
      el("p", "mono", tt("learningBackup.restore.selectedFile", { filename: vm.restore.filename })),
    );
    restoreBlock.appendChild(
      el("p", undefined, tt("learningBackup.preview.exportedAt", { value: preview.exported_at })),
    );
    restoreBlock.appendChild(
      el("p", undefined, tt("learningBackup.preview.schema", { value: preview.package_schema })),
    );
    restoreBlock.appendChild(
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

    if (preview.local_validation.state === "invalid") {
      const warn = el("div", "learning-backup-local-invalid");
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

    const compatHeading = el("h4", "learning-backup-subheading", tt("learningBackup.compat.heading"));
    restoreBlock.appendChild(compatHeading);
    const table = document.createElement("table");
    table.className = "learning-backup-compat-table";
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
    fieldset.className = "learning-backup-policies";
    fieldset.disabled = phase !== "preview" || vm.restoreBusy;
    const legend = document.createElement("legend");
    legend.textContent = tt("learningBackup.policy.legend");
    fieldset.appendChild(legend);

    const addAvailable = preview.add_missing.state === "available";
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
    addLabel.appendChild(document.createTextNode(tt("learningBackup.policy.addMissing")));
    fieldset.appendChild(addLabel);
    fieldset.appendChild(el("p", "subtitle", tt("learningBackup.policy.addMissingHelp")));
    if (addAvailable && preview.add_missing.state === "available") {
      fieldset.appendChild(
        el(
          "p",
          "mono",
          tt("learningBackup.policy.addMissingCounts", {
            add: preview.add_missing.add_count,
            skip: preview.add_missing.skipped_existing_count,
          }),
        ),
      );
    } else {
      fieldset.appendChild(el("p", "subtitle", tt("learningBackup.localInvalid.addUnavailable")));
    }

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
    replaceLabel.appendChild(document.createTextNode(tt("learningBackup.policy.replaceAll")));
    fieldset.appendChild(replaceLabel);
    fieldset.appendChild(el("p", "subtitle", tt("learningBackup.policy.replaceAllHelp")));
    fieldset.appendChild(
      el(
        "p",
        "mono",
        tt("learningBackup.policy.replaceAllCounts", {
          previous: preview.replace_all.previous_count,
          restored: preview.replace_all.restored_count,
        }),
      ),
    );
    restoreBlock.appendChild(fieldset);

    if (phase === "preview") {
      const actions = el("div", "row learning-backup-actions");
      const commitBtn = document.createElement("button");
      commitBtn.type = "button";
      commitBtn.className = "btn";
      commitBtn.textContent =
        vm.restore.selectedPolicy === "replace_all"
          ? tt("learningBackup.policy.replaceAll")
          : tt("learningBackup.policy.addMissing");
      commitBtn.disabled = vm.restore.selectedPolicy == null || vm.surfaceBusy;
      commitBtn.addEventListener("click", () => callbacks.onRequestCommit());
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn";
      cancelBtn.textContent = tt("learningBackup.cancel");
      cancelBtn.disabled = vm.surfaceBusy;
      cancelBtn.addEventListener("click", () => callbacks.onCancelRestore());
      actions.append(commitBtn, cancelBtn);
      restoreBlock.appendChild(actions);
    }

    if (phase === "restoring") {
      const status = el("p", "learning-backup-status", tt("learningBackup.restore.restoring"));
      status.setAttribute("role", "status");
      restoreBlock.appendChild(status);
    }
  }

  if (phase === "confirming") {
    const dialog = document.createElement("dialog");
    dialog.className = "learning-backup-confirm-dialog";
    dialog.setAttribute("aria-labelledby", "learning-backup-confirm-heading");
    confirmHeading = el("h3", "learning-backup-subheading", tt("learningBackup.confirm.heading"));
    confirmHeading.id = "learning-backup-confirm-heading";
    confirmHeading.tabIndex = -1;
    dialog.appendChild(confirmHeading);
    dialog.appendChild(el("p", undefined, tt("learningBackup.confirm.replaceWarning")));
    const actions = el("div", "row");
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn";
    cancelBtn.textContent = tt("learningBackup.cancel");
    cancelBtn.addEventListener("click", () => {
      dialog.close();
      callbacks.onCancelConfirm();
    });
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "btn";
    confirmBtn.textContent = tt("learningBackup.confirm.replaceAction");
    confirmBtn.addEventListener("click", () => {
      dialog.close();
      callbacks.onConfirmReplaceAll();
    });
    actions.append(cancelBtn, confirmBtn);
    dialog.appendChild(actions);
    restoreBlock.appendChild(dialog);
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  if (phase === "success") {
    resultHeading = el("h3", "learning-backup-subheading", tt("learningBackup.restore.completed"));
    resultHeading.tabIndex = -1;
    restoreBlock.appendChild(resultHeading);
    if (vm.restore.policy === "add_missing") {
      restoreBlock.appendChild(
        el(
          "p",
          undefined,
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
          undefined,
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
      openBtn.className = "btn";
      openBtn.textContent = tt("learningBackup.openSaved");
      openBtn.addEventListener("click", () => callbacks.onOpenSavedVocabulary?.());
      restoreBlock.appendChild(openBtn);
    }
  }

  if (phase === "error") {
    resultHeading = el("h3", "learning-backup-subheading", tt("learningBackup.restore.failedHeading"));
    resultHeading.tabIndex = -1;
    restoreBlock.appendChild(resultHeading);
    restoreBlock.appendChild(el("p", undefined, tt(vm.restore.messageKey)));
    restoreBlock.appendChild(el("p", undefined, tt("learningBackup.restore.noDataChanged")));
  }

  root.appendChild(restoreBlock);

  // Export / shared result region
  const resultRegion = el("div", "learning-backup-result");
  resultRegion.setAttribute("role", "status");
  if (vm.exportResult?.kind === "success") {
    if (!resultHeading) {
      resultHeading = el("h3", "learning-backup-subheading", tt("learningBackup.export.created"));
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
      resultHeading = el("h3", "learning-backup-subheading", tt("learningBackup.export.failedHeading"));
      resultHeading.tabIndex = -1;
      resultRegion.appendChild(resultHeading);
    }
    resultRegion.appendChild(el("p", undefined, tt(vm.exportResult.messageKey)));
    resultRegion.appendChild(el("p", undefined, tt("learningBackup.restore.noDataChanged")));
  }
  root.appendChild(resultRegion);

  host.appendChild(root);

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
