// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale } from "../i18n";
import {
  isLearningBackupVisibleInDictionariesMode,
  renderInstalledDictionaryList,
} from "./render_dictionary_management";

describe("UX2I6B1 dictionary management presentation", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("renders empty state without technical dump copy", () => {
    const root = renderInstalledDictionaryList([], {
      onUse: vi.fn(),
      onRemove: vi.fn(),
      isBusy: () => false,
    });
    expect(root.textContent).toContain("No dictionaries installed");
    expect(root.textContent).toContain("Add a dictionary to search offline on this device");
    expect(root.textContent).not.toMatch(/0 bundles|0 bytes|No installed bundle metadata/i);
  });

  it("renders active textual state and remove action without nested buttons", () => {
    const onUse = vi.fn();
    const onRemove = vi.fn();
    const root = renderInstalledDictionaryList(
      [
        {
          bundleId: "b1",
          displayName: "French ↔ Maninka Dictionary",
          versionLabel: "Version 1",
          languageDirection: "French → Maninka",
          isActive: true,
          updateAvailable: false,
        },
      ],
      { onUse, onRemove, isBusy: () => false },
    );
    expect(root.querySelector(".ux2-dict-row-title")?.textContent).toBe(
      "French ↔ Maninka Dictionary",
    );
    expect(root.querySelector(".ux2-dict-row-active")?.textContent).toBe("Active");
    expect(root.textContent).toContain("Available offline on this device");
    expect(root.textContent).toContain("Saved learning data and local feedback are kept");
    expect(root.textContent).not.toMatch(/storage scope|sha256|bundle_full_/i);
    const remove = root.querySelector<HTMLButtonElement>(".ux2-dict-action-remove")!;
    expect(remove.tagName).toBe("BUTTON");
    expect(remove.querySelector("button")).toBeNull();
    remove.click();
    expect(onRemove).toHaveBeenCalledWith("b1");
    expect(onUse).not.toHaveBeenCalled();
  });

  it("wires Use for inactive dictionaries", () => {
    const onUse = vi.fn();
    const root = renderInstalledDictionaryList(
      [
        {
          bundleId: "b2",
          displayName: "Other",
          languageDirection: "A → B",
          isActive: false,
          updateAvailable: false,
        },
      ],
      { onUse, onRemove: vi.fn(), isBusy: () => false },
    );
    root.querySelector<HTMLButtonElement>(".ux2-dict-action-use")!.click();
    expect(onUse).toHaveBeenCalledWith("b2");
  });

  it("keeps Learning Backup out of dictionaries mode by contract", () => {
    expect(isLearningBackupVisibleInDictionariesMode()).toBe(false);
  });
});
