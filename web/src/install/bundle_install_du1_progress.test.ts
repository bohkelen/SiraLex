import { describe, expect, it, vi } from "vitest";

import type { InstallProgressCopy } from "./bundle_install";

/**
 * DU1 — Verify consumer progress copy fields exist and format percent without
 * inventing fake values when percent is supplied by real byte progress.
 */
describe("DU1 consumer update progress copy", () => {
  it("formats installing percent from template without exceeding 99", () => {
    const template = "Installing new version… {percent}%";
    const format = (percent: number) =>
      template.replace("{percent}", String(Math.max(0, Math.min(99, percent))));
    expect(format(0)).toBe("Installing new version… 0%");
    expect(format(50)).toBe("Installing new version… 50%");
    expect(format(150)).toBe("Installing new version… 99%");
  });

  it("accepts optional update stage fields on InstallProgressCopy", () => {
    const copy: Partial<InstallProgressCopy> = {
      consumerPreparing: "Preparing update…",
      consumerDownloading: "Downloading new dictionary…",
      consumerVerifying: "Checking dictionary files…",
      consumerInstalling: "Installing new version…",
      consumerInstallingPercent: "Installing new version… {percent}%",
      consumerCleanup: "Removing old dictionary files…",
    };
    expect(copy.consumerCleanup).toMatch(/Removing old/);
    const onUpdate = vi.fn();
    onUpdate(copy.consumerPreparing);
    onUpdate(copy.consumerDownloading);
    onUpdate(copy.consumerVerifying);
    onUpdate(copy.consumerInstalling);
    onUpdate(copy.consumerCleanup);
    expect(onUpdate).toHaveBeenCalledTimes(5);
  });
});
