export type UiThemePreference = "system" | "light" | "dark";
export type ResolvedUiTheme = "light" | "dark";

export const UI_THEME_STORAGE_KEY = "siralex.ui_theme";
export const DEFAULT_UI_THEME: UiThemePreference = "system";

const SUPPORTED_THEMES: readonly UiThemePreference[] = ["system", "light", "dark"] as const;
type ThemeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

let currentPreference: UiThemePreference = DEFAULT_UI_THEME;
let systemSchemeListener: ((event: MediaQueryListEvent) => void) | undefined;
let systemSchemeQuery: MediaQueryList | undefined;

function getDefaultStorage(): ThemeStorage | undefined {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as { localStorage?: ThemeStorage }).localStorage;
  }
  return undefined;
}

export function normalizeUiThemePreference(value: string | undefined | null): UiThemePreference | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return SUPPORTED_THEMES.includes(normalized as UiThemePreference)
    ? (normalized as UiThemePreference)
    : undefined;
}

export function getSavedUiThemePreference(
  storage: ThemeStorage | undefined = getDefaultStorage(),
): UiThemePreference | undefined {
  try {
    return normalizeUiThemePreference(storage?.getItem(UI_THEME_STORAGE_KEY) ?? undefined);
  } catch {
    return undefined;
  }
}

export function setSavedUiThemePreference(
  theme: UiThemePreference,
  storage: ThemeStorage | undefined = getDefaultStorage(),
): void {
  try {
    storage?.setItem(UI_THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage write failures (offline/private mode).
  }
}

export function clearSavedUiThemePreference(storage: ThemeStorage | undefined = getDefaultStorage()): void {
  try {
    storage?.removeItem(UI_THEME_STORAGE_KEY);
  } catch {
    // Ignore storage remove failures.
  }
}

export function resolveUiThemePreference(
  storage: ThemeStorage | undefined = getDefaultStorage(),
): UiThemePreference {
  return getSavedUiThemePreference(storage) ?? DEFAULT_UI_THEME;
}

export function getSystemPrefersDark(
  mediaQuery: { matches: boolean } | undefined = getSystemDarkMediaQuery(),
): boolean {
  return mediaQuery?.matches ?? false;
}

function getSystemDarkMediaQuery(): MediaQueryList | undefined {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return undefined;
  }
  return window.matchMedia("(prefers-color-scheme: dark)");
}

export function resolveEffectiveTheme(
  preference: UiThemePreference,
  systemPrefersDark: boolean = getSystemPrefersDark(),
): ResolvedUiTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

export function getCurrentUiThemePreference(): UiThemePreference {
  return currentPreference;
}

export function applyResolvedTheme(
  resolved: ResolvedUiTheme,
  root: HTMLElement | undefined = typeof document !== "undefined" ? document.documentElement : undefined,
): void {
  if (!root) return;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
}

function detachSystemSchemeListener(): void {
  if (!systemSchemeQuery || !systemSchemeListener) return;
  if (typeof systemSchemeQuery.removeEventListener === "function") {
    systemSchemeQuery.removeEventListener("change", systemSchemeListener);
  } else if (typeof systemSchemeQuery.removeListener === "function") {
    systemSchemeQuery.removeListener(systemSchemeListener);
  }
  systemSchemeListener = undefined;
  systemSchemeQuery = undefined;
}

function attachSystemSchemeListener(): void {
  detachSystemSchemeListener();
  if (currentPreference !== "system") return;

  const query = getSystemDarkMediaQuery();
  if (!query) return;

  const onChange = (event: MediaQueryListEvent) => {
    if (currentPreference !== "system") return;
    applyResolvedTheme(event.matches ? "dark" : "light");
  };

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", onChange);
  } else if (typeof query.addListener === "function") {
    query.addListener(onChange);
  }

  systemSchemeQuery = query;
  systemSchemeListener = onChange;
}

export function applyUiThemePreference(
  preference: UiThemePreference,
  options: {
    root?: HTMLElement;
    systemPrefersDark?: boolean;
    syncSystemListener?: boolean;
  } = {},
): ResolvedUiTheme {
  currentPreference = preference;
  const resolved = resolveEffectiveTheme(
    preference,
    options.systemPrefersDark ?? getSystemPrefersDark(),
  );
  applyResolvedTheme(resolved, options.root);
  if (options.syncSystemListener !== false) {
    attachSystemSchemeListener();
  }
  return resolved;
}

export function setUiThemePreferenceWithPersistence(
  preference: UiThemePreference,
  storage: ThemeStorage | undefined = getDefaultStorage(),
  options: {
    root?: HTMLElement;
    systemPrefersDark?: boolean;
  } = {},
): ResolvedUiTheme {
  setSavedUiThemePreference(preference, storage);
  return applyUiThemePreference(preference, options);
}

/**
 * Boot theme from localStorage (default: system). Safe offline; no network.
 * Call once at app startup. Re-applies when OS preference changes if mode is system.
 */
export function initUiTheme(
  storage: ThemeStorage | undefined = getDefaultStorage(),
  options: {
    root?: HTMLElement;
    systemPrefersDark?: boolean;
  } = {},
): ResolvedUiTheme {
  const preference = resolveUiThemePreference(storage);
  return applyUiThemePreference(preference, options);
}
