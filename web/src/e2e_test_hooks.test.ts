import { describe, expect, it } from "vitest";

import {
  installE2ERefreshDbStatusHook,
  shouldExposeE2ERefreshHook,
} from "./e2e_test_hooks";

describe("e2e_test_hooks gate", () => {
  it("fails closed unless VITE_E2E_TEST_HOOKS is exactly true", () => {
    expect(shouldExposeE2ERefreshHook({})).toBe(false);
    expect(shouldExposeE2ERefreshHook({ VITE_E2E_TEST_HOOKS: undefined })).toBe(false);
    expect(shouldExposeE2ERefreshHook({ VITE_E2E_TEST_HOOKS: "" })).toBe(false);
    expect(shouldExposeE2ERefreshHook({ VITE_E2E_TEST_HOOKS: "1" })).toBe(false);
    expect(shouldExposeE2ERefreshHook({ VITE_E2E_TEST_HOOKS: "TRUE" })).toBe(false);
    expect(shouldExposeE2ERefreshHook({ VITE_E2E_TEST_HOOKS: "true" })).toBe(true);
  });

  it("installs the refresh hook only when the gate is enabled", async () => {
    const calls: number[] = [];
    const refresh = async () => {
      calls.push(1);
    };
    const target: { __siralexRefreshDbStatus?: () => Promise<void> } = {
      __siralexRefreshDbStatus: async () => {
        throw new Error("stale hook");
      },
    };

    installE2ERefreshDbStatusHook(refresh, { VITE_E2E_TEST_HOOKS: "false" }, target);
    expect(target.__siralexRefreshDbStatus).toBeUndefined();

    installE2ERefreshDbStatusHook(refresh, { VITE_E2E_TEST_HOOKS: "true" }, target);
    expect(typeof target.__siralexRefreshDbStatus).toBe("function");
    await target.__siralexRefreshDbStatus?.();
    expect(calls).toEqual([1]);
  });
});
