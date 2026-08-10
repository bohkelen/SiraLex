/**
 * ML1D2A1 — Explicit E2E-only test hooks (fail closed for ordinary builds).
 *
 * Enabled only when Vite embeds VITE_E2E_TEST_HOOKS=true at build time.
 * Ordinary `npm run build` / production preview must leave hooks undefined.
 *
 * Call sites should also gate on `import.meta.env.VITE_E2E_TEST_HOOKS === "true"`
 * so production bundles can dead-code-eliminate the install path.
 */

export type E2ETestHooksEnv = {
  VITE_E2E_TEST_HOOKS?: string;
};

export function shouldExposeE2ERefreshHook(
  env: E2ETestHooksEnv = {
    VITE_E2E_TEST_HOOKS: import.meta.env.VITE_E2E_TEST_HOOKS,
  },
): boolean {
  return env.VITE_E2E_TEST_HOOKS === "true";
}

export function installE2ERefreshDbStatusHook(
  refreshDbStatus: () => Promise<void>,
  env: E2ETestHooksEnv = {
    VITE_E2E_TEST_HOOKS: import.meta.env.VITE_E2E_TEST_HOOKS,
  },
  target: { __siralexRefreshDbStatus?: () => Promise<void> } = globalThis as {
    __siralexRefreshDbStatus?: () => Promise<void>;
  },
): void {
  if (!shouldExposeE2ERefreshHook(env)) {
    delete target.__siralexRefreshDbStatus;
    return;
  }
  target.__siralexRefreshDbStatus = () => refreshDbStatus();
}
