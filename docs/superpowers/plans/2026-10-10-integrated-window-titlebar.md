# Integrated Window Title Bar Implementation Plan

**Goal:** Remove the Windows color strip while preserving native window behavior.

**Architecture:** Windows-only Electron title-bar overlay, a small Vue drag-region
component, and one guarded theme IPC. Reuse existing close and mini-mode logic.

**Tech Stack:** Electron 35, Vue 3, TypeScript, node:test, Playwright, NSIS.

## 1. Regression Tests

- [x] Add `scripts/tests/window-titlebar.test.cjs`. Parse actual `main.ts` with
  TypeScript, execute `createWindow()` with a minimal fake window, and require
  Windows-only hidden/transparent native caption options, height 32.
- [x] Execute the actual `set-window-titlebar-theme` handler extracted from the
  AST. Require main-window identity, Windows platform and a boolean payload;
  valid true/false must apply fixed light/dark symbols with transparent color.
- [x] Run `node --test scripts/tests/window-titlebar.test.cjs` and confirm the
  missing window options/handler cause failures.

## 2. Implementation

- [x] Add Windows-only `titleBarStyle: "hidden"` and `titleBarOverlay` to the
  existing main window; register the guarded theme IPC. Keep menu suppression.
- [x] Expose `setWindowTitlebarTheme(dark: boolean): Promise<boolean>` in preload
  and renderer bridge typing; do not expose arbitrary window actions.
- [x] Add `WindowTitlebar.vue`: theme watcher and a Windows-only transparent drag
  region at top 0, height 32, left 144, right 140, z-index 400. Mini left inset is
  0. Use `-webkit-app-region: drag` and hide the region in unsupported previews.
- [x] Render the component outside the normal app shell and onboarding so it
  survives guide/mini transitions; pass effective dark mode and native mini state.
- [x] Mark the native mini card with a Windows overlay class and add top 40px
  instead of the previous 8px, reserving the 32px caption strip.
- [x] Rerun focused tests, `node scripts/verify.cjs frontend` and
  `node scripts/verify.cjs typecheck`; expect exit 0.

## 3. Runtime and Artifact

- [x] Build Electron, extend and run `electron/tests/window-menu.smoke.cjs` with
  isolated data. Verify native overlay bounds, theme changes, drag exclusions,
  guide/local screenshots, mini-mode controls, maximize/minimize and tray close.
- [x] Package using the validated staged runtime and existing cached NSIS tools:
  `electron-builder --win nsis --x64`. Verify the packaged main matches the build.
- [x] Run packaged runtime smoke if the required ports are free; never terminate
  foreign listeners. Record artifact size/hash/signature and verification limits.
- [x] Update release records and checklist for the integrated title bar.

No real-user startup, data migration, forced termination, resets or commits.

Additional regressions: mini caption pixels exposed a global transparent body
style from desktop lyrics. A Windows-mini-only body background fixes contrast
without changing desktop-lyrics transparency. Five focused title-bar tests also
cover the default light song-detail surface. Full frontend (99 files, 9 script
suites), typecheck, isolated UI smoke and packaged runtime smoke passed.

Actual OS mouse drag, double-click and snap gestures remain manual checks.
