import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Sanity guard for essential theme token pairs.
 * Not a full WCAG certification — fails only on clearly unreadable palettes.
 */

const STYLE_CSS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "style.css");
const MIN_BODY_CONTRAST = 4.5;
const MIN_MUTED_CONTRAST = 3.0;

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
      const text = requireVar(vars, "--text");
      const background = requireVar(vars, "--background");
      const surface = requireVar(vars, "--surface");
      const muted = requireVar(vars, "--muted-text");
      const inputBackground = requireVar(vars, "--input-background");
      const buttonBackground = requireVar(vars, "--button-background");

      expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
      expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
      expect(contrastRatio(muted, background)).toBeGreaterThanOrEqual(MIN_MUTED_CONTRAST);
      expect(contrastRatio(text, inputBackground)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
      expect(contrastRatio(text, buttonBackground)).toBeGreaterThanOrEqual(MIN_BODY_CONTRAST);
    });
  }
});
