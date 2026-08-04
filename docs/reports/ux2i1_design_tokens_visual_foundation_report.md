# UX2I1 — Design Tokens and Visual Foundation

## 1. Decision

```text
UX2I1_DESIGN_FOUNDATION_IMPLEMENTED
```

SiraLex now has a reusable UX2 visual foundation (semantic color, typography, spacing, focus, responsive, and N’Ko primitives) extracted from the published Figma Engineering Handoff. Existing screens are not redesigned; UXT1 theme behavior is preserved via legacy CSS variable aliases.

---

## 2. BASE_COMMIT

```text
72ed80a66a0523eb098974c26b283e2d16e0edca
```

Working tree at start (unrelated untracked path only):

```text
?? web/scripts/
```

---

## 3. Figma reference

```text
https://coach-spider-78723578.figma.site/
```

Inspected via published site HTML/CSS/JS assets and the embedded **Design System · Engineering Handoff** section (tokens, typography, spacing, layout, accessibility).

Figma source inspected: **PASS**

---

## 4. Selected visual direction

```text
UX2_VISUAL_DIRECTION_SELECTED
Contemporary West African Modernism
```

Figma summary: DM Serif Display + DM Sans · terracotta palette · warm cream ground · geometric diamond mark.

---

## 5. Extracted Light tokens

| Semantic token | Value |
|---|---|
| background | `#f5ede0` |
| surface | `#ece4d0` |
| surface-subtle / elevatedSurface | `#e3d8c4` |
| text-primary | `#1c1410` |
| text-secondary | `#5c4c3a` |
| text-muted | `#6c5c4a` |
| divider / border | `rgba(0,0,0,0.10)` |
| input-background | `#ece4d0` |
| accent | `#b85225` |
| accent-hover | `#9e4420` |
| accent-pressed | `#8a3a1c` |
| success | `#3d7a52` |
| success-soft | `#e0ede6` |
| warning | `#a06c1a` |
| warning-soft | `#f2e6cc` |
| danger | `#b83025` |
| danger-soft | `#f2dbd8` |
| focus | `#b85225` |

---

## 6. Extracted Dark tokens

| Semantic token | Value |
|---|---|
| background | `#1e1810` |
| surface | `#171208` |
| surface-subtle / elevatedSurface | `#26200e` |
| text-primary | `#ede4d4` |
| text-secondary | `#c0ae96` |
| text-muted | `#9a8872` |
| divider / border | `rgba(255,255,255,0.10)` |
| input-background | `#171208` |
| accent | `#cf6535` |
| accent-hover | `#e07040` |
| accent-pressed | `#d46830` |
| success | `#5aad74` |
| success-soft | `#0e2a18` |
| warning | `#d4922a` |
| warning-soft | `#2a1d08` |
| danger | `#d94030` |
| danger-soft | `#2a0e0a` |
| focus | `#cf6535` |

---

## 7. Serif typography

Figma family: **DM Serif Display**

Roles (serif = lexical/editorial):

| Role | Family | Weight | Size (mob/desk) | Line height | Tracking |
|---|---|---|---|---|---|
| SiraLex wordmark | DM Serif Display | 400 | 18 / 20 px | 1 | −0.01em |
| Large lexical headword | DM Serif Display | 400 | 44 / 72 px | 1 | −0.02em |
| Standard lexical headword | DM Serif Display | 400 | 21 / 26 px | 1.2 | −0.01em |
| Page heading | DM Serif Display | 400 | 28 / 32 px | 1.1 | −0.015em |

CSS: `--font-serif`, `.ux2-type-wordmark`, `.ux2-type-headword-large`, `.ux2-type-headword-medium`, `.ux2-type-page-title`

---

## 8. Sans-serif typography

Figma family: **DM Sans**

Roles (sans = UI/control/instructional):

| Role | Family | Weight | Size (mob/desk) | Line height | Tracking |
|---|---|---|---|---|---|
| Section heading | DM Sans | 600 | 10 / 10 px | 1 | +0.08em · uppercase |
| Body text | DM Sans | 400 | 15 / 15 px | 1.6 | 0 |
| UI/control label | DM Sans | 500 | 13 / 13 px | 1 | 0 |
| Metadata | DM Sans | 600 | 10 / 10 px | 1 | +0.06em · uppercase |
| Helper text | DM Sans | 400 | 11 / 12 px | 1.5 | 0 |
| Nav label | DM Sans | 500 | 10 / 12.5 px | 1 | 0 |

CSS: `--font-sans`, `.ux2-type-section-heading`, `.ux2-type-body`, `.ux2-type-ui-label`, `.ux2-type-metadata`, `.ux2-type-helper`, `.ux2-type-nav-label`

---

## 9. N’Ko typography / fallback strategy

Primitive class: `.ux2-text-nko`

| Requirement | Implementation |
|---|---|
| `lang="nqo"` | Documented for markup consumers (class does not set lang) |
| RTL | `direction: rtl; unicode-bidi: embed; text-align: right` |
| No glyph clipping | `overflow: visible; overflow-wrap: anywhere` |
| Line height | `--type-nko-line-height: 1.45` |
| Size | entry 24–30px; min readable 14px (Figma) |
| Fallback stack | `"Noto Sans NKo", "Noto Sans N'Ko", "Noto Sans", "Noto Sans Arabic", "Segoe UI", sans-serif` |

Entry-detail redesign deferred.

---

## 10. Type scale

Implemented as CSS custom properties (`--type-*`) plus opt-in `.ux2-type-*` classes. Desktop sizes activate at `min-width: 768px`. Existing screens do not yet consume these classes.

---

## 11. Spacing scale

Figma 8-based scale with canonical **22px** mobile gutter (not 24px):

| Token | Value | Primary uses |
|---|---|---|
| `--space-1` | 4px | Icon-to-label, chip gaps |
| `--space-2` | 8px | Row spacing, nav icon-to-label |
| `--space-3` | 12px | Small component padding |
| `--space-4` | 16px | Default component padding |
| `--space-5` | 22px | Mobile page gutters / card padding |
| `--space-6` | 32px | Desktop column gap |
| `--space-7` | 48px | Section spacing |
| `--space-8` | 64px | Large page section spacing |

Named aliases: `--space-gutter-mobile`, `--space-component`, `--space-row`, `--space-section`, `--space-column-gap-desktop`.

Current page layout (`.container` padding etc.) left unchanged.

---

## 12. Responsive primitives

Figma binary breakpoint (no tablet-specific layout):

| Concept | Value |
|---|---|
| mobile | `< 768px` |
| tablet/intermediate | none (collapses to mobile) |
| desktop | `≥ 768px` |
| mobile horizontal gutter | 22px |
| desktop max content width | 1100px (production may extend to 1200px) |
| desktop navigation height | 48px |
| mobile bottom nav height | 58px (+ safe-area) |
| desktop contextual rail width | 286–300px |
| preferred reading-column width | ≤820px |
| minimum interactive target | 44 × 44 CSS px (`--touch-target-min`) |

CSS: `--layout-*` custom properties only. Shell/nav migration deferred.

---

## 13. Accessibility / contrast results

Computed ratios (WCAG relative luminance):

### Light

| Pair | Ratio | Target |
|---|---|---|
| primary text / background | 15.62:1 | ≥4.5 PASS |
| primary text / surface | 14.33:1 | ≥4.5 PASS |
| secondary text / background | 7.09:1 | ≥4.5 PASS |
| muted text / background | 5.53:1 | ≥3.0 / AA large PASS |
| input text / input background | 14.33:1 | ≥4.5 PASS |
| accent / background | 4.23:1 | UI ≥3.0 PASS; normal-text AA marginal |
| focus / surface | 3.88:1 | UI ≥3.0 PASS |

### Dark

| Pair | Ratio | Target |
|---|---|---|
| primary text / background | 13.95:1 | ≥4.5 PASS |
| primary text / surface | 14.78:1 | ≥4.5 PASS |
| secondary text / background | 8.16:1 | ≥4.5 PASS |
| muted text / background | 5.14:1 | ≥3.0 / AA large PASS |
| input text / input background | 14.78:1 | ≥4.5 PASS |
| accent / background | 4.66:1 | ≥4.5 PASS |
| focus / surface | 4.94:1 | ≥3.0 PASS |

Focus primitive: 3px solid `--color-focus`, 2px offset (`.ux2-focus-ring`).

Touch-target invariant recorded: **44 × 44 CSS px** (enforcement in later component slices).

Accessibility: **PASS** (exact Figma values retained; accent-as-small-text in light noted as UI-component-grade).

---

## 14. UXT1 compatibility

Preserved:

```text
localStorage key: siralex.ui_theme
values: system | light | dark
runtime: html[data-theme="light"|"dark"]
```

- `theme.ts` not replaced
- No second preference store
- System / Light / Dark behavior unchanged
- Legacy aliases: `--background`, `--surface`, `--text`, `--muted-text`, `--border`, `--input-background`, `--button-background`, `--hover-surface`, `--divider`, `--accent`, `--danger`, `--bg`, `--panel`, `--muted`

UXT1 regression (unit + core theme E2E): **PASS**

---

## 15. Offline-font handling

Figma fonts: **DM Serif Display**, **DM Sans**.

This slice does **not** download/embed remote font files and does **not** add a Google Fonts / CDN runtime dependency.

Local/system fallback stacks are defined on `--font-serif` / `--font-sans` / `--font-nko`.

**Fidelity gap:** until approved local font assets are embedded, devices without DM Serif Display / DM Sans installed will render Georgia/Palatino-class serif and system UI sans fallbacks.

---

## 16. Explicitly deferred UX2 work

Not implemented in UX2I1:

- Search / Saved / Review / More navigation
- Bottom / desktop top navigation
- Desktop context rail
- Moving Theme / Language into More
- Moving Dictionaries / Corrections / Search Feedback
- Search / results / entry-detail / Saved / Review / CF1 / CF2 / More redesigns
- Recent searches, automatic dictionary update setting, text-size setting
- Session/submission counts, fake app version
- Invented pronunciation / examples / N’Ko
- Touch-target enforcement across controls
- Full typography application to existing screens

Consumer advanced surfaces (Diagnostics, Developer tools, manual bundle import, catalog tooling, query-log tooling) left intact.

---

## 17. Tests

### Focused theme unit tests

```text
npm --prefix web run test:run -- src/theme_contrast.test.ts src/theme.test.ts
→ 2 files, 14 tests passed
```

### Full suite

```text
npm --prefix web run test:run
→ Test Files  1 failed | 82 passed (83)
→ Tests       9 failed | 826 passed (835)
```

The 9 failures are all in `src/query_logging/query_log_store.test.ts` and **reproduce on BASE_COMMIT** with UX2I1 changes stashed. They are pre-existing IndexedDB store failures unrelated to design tokens.

### Theme E2E

```text
npm --prefix web run test:e2e:theme
→ 2 passed, 1 failed (pre-existing)
```

| Case | Result |
|---|---|
| System follows OS; Light/Dark persist; labels EN/FR | PASS |
| Storage throw still boots from system | PASS |
| Representative surfaces remain readable | FAIL (timeout on `.saved-vocab-back` instability) |

The surface-navigation failure **reproduces on BASE_COMMIT** (identical timeout / detached `.saved-vocab-back`). Not introduced by UX2I1.

---

## 18. Build

```text
npm --prefix web run build
→ PASS (tsc + vite build + PWA generateSW)
```

---

## 19. git diff --check

```text
PASS (no whitespace errors)
```

---

## 20. Exact files changed A/M/D

Relative to `BASE_COMMIT` working tree (pre-commit):

```text
M  docs/ROADMAP.md
A  docs/reports/ux2i1_design_tokens_visual_foundation_report.md
M  web/src/style.css
M  web/src/theme_contrast.test.ts
```

---

## 21. Exact untracked files

At completion (excluding this report once added):

```text
?? web/scripts/   (pre-existing; not part of UX2I1)
```

---

## 22. Working-tree status

See completion response / post-commit `git status --short`.

---

## 23. Final decision

```text
UX2I1_DESIGN_FOUNDATION_IMPLEMENTED
```
