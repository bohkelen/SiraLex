# UXT1 — Appearance / Theme Preference

## Decision

```text
UXT1_APPEARANCE_PREFERENCE_IMPLEMENTED
```

SiraLex supports System, Light, and Dark appearance preferences. The preference is local, persisted, offline-capable, takes effect without reload, and System follows operating-system color-scheme changes.

---

## Product behavior

| Preference | Effect |
|------------|--------|
| System (default) | Follows `prefers-color-scheme` |
| Light | Forces light palette |
| Dark | Forces the existing dark palette |

UI control label:

```text
EN: Theme
FR: Thème
```

Control type: dropdown (same pattern as Language), not radios.

Persistence:

```text
localStorage key: siralex.ui_theme
values: system | light | dark
```

Runtime application:

```text
document.documentElement[data-theme] = light | dark
color-scheme matches resolved theme
```

Changing Theme does not reload the page. Changing Language still reloads (existing behavior).

---

## Architecture

- Preference module: `web/src/theme.ts` (mirror of locale persistence pattern)
- CSS variables on `[data-theme="light"]` / `[data-theme="dark"]` in `web/src/style.css`
- Semantic tokens: `--background`, `--surface`, `--text`, `--muted-text`, `--border`, `--input-background`, `--button-background` (+ hover/divider/accent/danger)
- Compatibility aliases: `--bg`, `--panel`, `--muted`
- Early boot script in `web/index.html` sets `data-theme` before module CSS paint
- Surfaces inherit tokens (Search, Entry, Saved Vocabulary, Review, Progress, Manage Dictionaries, CF1, CF2, LP1, Diagnostics)

### Boot invariant

Inability to read the saved preference means “no usable saved preference” (= System), **not** “force light.”

Storage failure affects only retrieval of the saved override. OS `prefers-color-scheme` detection still runs in the early boot script and in `theme.ts`.

---

## Verification

### Unit

- `web/src/theme.test.ts` — normalize, persist, resolve system/light/dark, apply `data-theme`
- `web/src/theme_contrast.test.ts` — essential pair contrast sanity (text/background/surface/input/button; muted threshold)
- `web/src/i18n.test.ts` — Theme / Thème labels

### Browser smoke (Playwright)

`web/e2e/theme_preference.spec.ts` (`npm run test:e2e:theme`):

1. Clean + OS light → System → `data-theme=light`
2. Clean + OS dark → System → `data-theme=dark`
3. Select Light while OS dark → immediate, no reload, persists across hard reload
4. Select Dark while OS light → immediate + persists
5. Select System → OS color-scheme change updates UI without reload
6. Invalid stored value → System behavior
7. Storage throw → still boots from OS preference (no light flash forced)
8. EN/FR labels
9. Representative surfaces readable in both themes (Search, Entry, Saved Vocabulary, Manage Dictionaries, CF1/CF2 shells)

Result: **PASS** (Chromium preview).

---

## Explicit non-goals

- No second stylesheet / theme package
- No server-synced preference
- No schema or IndexedDB changes
- No PWA `theme_color` dynamic sync in this slice (optional follow-up)
- Not a full WCAG audit — contrast test is a sanity guard only

---

## Closure statement

SiraLex supports System, Light, and Dark appearance preferences. The preference is local, persisted, offline-capable, takes effect without reload, and System follows operating-system color-scheme changes.
