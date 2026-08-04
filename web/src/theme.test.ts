import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_UI_THEME,
  UI_THEME_STORAGE_KEY,
  applyUiThemePreference,
  getCurrentUiThemePreference,
  getSavedUiThemePreference,
  initUiTheme,
  normalizeUiThemePreference,
  resolveEffectiveTheme,
  resolveUiThemePreference,
  setSavedUiThemePreference,
  setUiThemePreferenceWithPersistence,
} from "./theme";

function createMockStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

function createMockRoot() {
  const attrs = new Map<string, string>();
  const style: { colorScheme: string } = { colorScheme: "" };
  return {
    style,
    setAttribute: (name: string, value: string) => {
      attrs.set(name, value);
    },
    getAttribute: (name: string) => attrs.get(name) ?? null,
  } as unknown as HTMLElement & { style: { colorScheme: string } };
}

describe("theme preference normalization", () => {
  it("accepts system, light, and dark", () => {
    expect(normalizeUiThemePreference("system")).toBe("system");
    expect(normalizeUiThemePreference("light")).toBe("light");
    expect(normalizeUiThemePreference("DARK")).toBe("dark");
  });

  it("rejects unknown values", () => {
    expect(normalizeUiThemePreference("auto")).toBeUndefined();
    expect(normalizeUiThemePreference("")).toBeUndefined();
    expect(normalizeUiThemePreference(null)).toBeUndefined();
  });
});

describe("theme persistence", () => {
  it("defaults to system when nothing is saved", () => {
    const storage = createMockStorage();
    expect(resolveUiThemePreference(storage)).toBe(DEFAULT_UI_THEME);
    expect(DEFAULT_UI_THEME).toBe("system");
  });

  it("reads and writes siralex.ui_theme", () => {
    const storage = createMockStorage();
    setSavedUiThemePreference("light", storage);
    expect(storage.getItem(UI_THEME_STORAGE_KEY)).toBe("light");
    expect(getSavedUiThemePreference(storage)).toBe("light");
  });

  it("ignores invalid saved values", () => {
    const storage = createMockStorage({ [UI_THEME_STORAGE_KEY]: "sepia" });
    expect(getSavedUiThemePreference(storage)).toBeUndefined();
    expect(resolveUiThemePreference(storage)).toBe("system");
  });
});

describe("effective theme resolution", () => {
  it("forces light and dark", () => {
    expect(resolveEffectiveTheme("light", true)).toBe("light");
    expect(resolveEffectiveTheme("dark", false)).toBe("dark");
  });

  it("follows system preference", () => {
    expect(resolveEffectiveTheme("system", true)).toBe("dark");
    expect(resolveEffectiveTheme("system", false)).toBe("light");
  });
});

describe("theme application", () => {
  afterEach(() => {
    applyUiThemePreference("system", { systemPrefersDark: false, root: createMockRoot() });
  });

  it("sets data-theme and color-scheme on the root", () => {
    const root = createMockRoot();
    const resolved = applyUiThemePreference("dark", { root, systemPrefersDark: false });
    expect(resolved).toBe("dark");
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
    expect(getCurrentUiThemePreference()).toBe("dark");
  });

  it("persists and applies preference without reload", () => {
    const storage = createMockStorage();
    const root = createMockRoot();
    const resolved = setUiThemePreferenceWithPersistence("light", storage, {
      root,
      systemPrefersDark: true,
    });
    expect(resolved).toBe("light");
    expect(storage.getItem(UI_THEME_STORAGE_KEY)).toBe("light");
    expect(root.getAttribute("data-theme")).toBe("light");
  });

  it("initUiTheme uses saved preference and system fallback", () => {
    const storage = createMockStorage({ [UI_THEME_STORAGE_KEY]: "system" });
    const root = createMockRoot();
    const resolved = initUiTheme(storage, { root, systemPrefersDark: true });
    expect(resolved).toBe("dark");
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(getCurrentUiThemePreference()).toBe("system");
  });
});
