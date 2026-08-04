import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Sanity guard for essential UX2/UXT1 theme token pairs.
 * Not a full WCAG certification — fails only on clearly unreadable palettes.
 */

const STYLE_CSS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "style.css");
const MIN_BODY_CONTRAST = 4.5;
const MIN_MUTED_CONTRAST = 3.0;
const MIN_UI_CONTRAST = 3.0;

type Rgb = { r: number; g: number; b: number };

function parseHexColor(value: string): Rgb {
  const hex = value.trim();
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  const digits = match?.[1];
  if (!digits) {
    throw new Error(`Expected #RRGGBB color, got: ${value}`);
  }
  const n = Number.parseInt(digits, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: Rgb): number {
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(parseHexColor(foreground));
  const l2 = relativeLuminance(parseHexColor(background));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractThemeBlock(css: string, theme: "light" | "dark"): string {
  const marker = `[data-theme="${theme}"]`;
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${marker} block in style.css`);
  const open = css.indexOf("{", start);
  if (open < 0) throw new Error(`Missing opening brace for ${marker}`);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`Unclosed ${marker} block`);
}

function readCssVars(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = /^\s*(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/.exec(line);
    const name = match?.[1];
    const value = match?.[2];
    if (name && value) vars[name] = value;
  }
  return vars;
}

function requireVar(vars: Record<string, string>, name: string): string {
  const value = vars[name];
  if (!value) throw new Error(`Missing CSS variable ${name}`);
  return value;
}

describe("theme contrast sanity", () => {
  const css = readFileSync(STYLE_CSS, "utf8");

  for (const theme of ["light", "dark"] as const) {
    it(`${theme} essential pairs stay readable`, () => {
      const vars = readCssVars(extractThemeBlock(css, theme));
      const text = requireVar(vars, "--color-text-primary");
      const secondary = requireVar(vars, "--color-text-secondary");
      const background = requireVar(vars, "--color-background");
      const surface = requireVar(vars, "--color-surface");
      const muted = requireVar(vars, "--color-text-muted");
      const inputBackground = requireVar(vars, "--color-input-background");
      const buttonBackground = requireVar(vars, "--color-surface-subtle");
      const accent = requireVar(vars, "--color-accent");
      const actionText = requireVar(vars, "--color-action-text");
      const focus = requireVar(vars, "--color-focus");
      const surfaceSubtle = requireVar(vars, "--color-surface-subtle");

      expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
      expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
      expect(contrastRatio(secondary, background)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
      expect(contrastRatio(muted, background)).toBeGreaterThanOrEqual(MIN_MUTED_CONTRAST);
      expect(contrastRatio(text, inputBackground)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
      expect(contrastRatio(text, buttonBackground)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
      // Accent/focus are interactive indicators; UI-component AA (≥3:1).
      expect(contrastRatio(accent, background)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
      expect(contrastRatio(focus, background)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
      expect(contrastRatio(focus, surface)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
      // Action-text is for small terracotta text; normal-text AA (≥4.5:1).
      expect(contrastRatio(actionText, background)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
      expect(contrastRatio(actionText, surface)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
      expect(contrastRatio(actionText, surfaceSubtle)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
    });
  }

  it("exposes required semantic color tokens in both themes", () => {
    const required = [
      "--color-background",
      "--color-surface",
      "--color-surface-subtle",
      "--color-text-primary",
      "--color-text-secondary",
      "--color-text-muted",
      "--color-input-background",
      "--color-accent",
      "--color-accent-hover",
      "--color-accent-pressed",
      "--color-action-text",
      "--color-success",
      "--color-warning",
      "--color-danger",
      "--color-focus",
    ];
    for (const theme of ["light", "dark"] as const) {
      const vars = readCssVars(extractThemeBlock(css, theme));
      for (const name of required) {
        expect(vars[name], `${theme} ${name}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it("keeps UXT1 legacy aliases wired to the semantic system", () => {
    for (const theme of ["light", "dark"] as const) {
      const block = extractThemeBlock(css, theme);
      expect(block).toMatch(/--background\s*:\s*var\(--color-background\)/);
      expect(block).toMatch(/--surface\s*:\s*var\(--color-surface\)/);
      expect(block).toMatch(/--text\s*:\s*var\(--color-text-primary\)/);
      expect(block).toMatch(/--muted-text\s*:\s*var\(--color-text-muted\)/);
      expect(block).toMatch(/--accent\s*:\s*var\(--color-accent\)/);
      expect(block).toMatch(/--danger\s*:\s*var\(--color-danger\)/);
    }
  });
});
