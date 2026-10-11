# Windows Installer and Window Polish Implementation Plan

**Goal:** Deliver the approved installer wizard and remove Windows default menus.

**Architecture:** Use stock electron-builder NSIS options, and disable the Windows
application menu before Electron readiness. Keep existing window and tray logic.

**Tech Stack:** Electron 35, electron-builder 26, NSIS, node:test, TypeScript.

## 1. Regression Tests

- [x] Extend `scripts/tests/before-pack.test.cjs`: require assisted installation,
  directory selection, per-user default, finish launch checkbox, and data-safe
  uninstall. Parse `electron/package.json`, checking exact boolean values.
- [x] Add a Windows-menu regression to the same automatically discovered suite:
  use the installed TypeScript AST to find the Windows-guarded
  `Menu.setApplicationMenu(null)` before `app.whenReady()`. Assert the existing
  tray menu builder and native main-window frame remain intact.
- [x] Run `node --test scripts/tests/before-pack.test.cjs` and observe the new
  assertions fail because the options and menu suppression are absent.

## 2. Minimal Implementation

- [x] In `electron/package.json`, add `build.nsis` with `oneClick: false`,
  `perMachine: false`, `allowToChangeInstallationDirectory: true`,
  `runAfterFinish: true`, and `deleteAppDataOnUninstall: false`.
- [x] In `electron/src/main/main.ts`, add
  `if (process.platform === "win32") Menu.setApplicationMenu(null);` before
  startup readiness. Keep tray, mini-mode restoration and keyboard logic.
- [x] Rerun the focused tests, `node scripts/verify.cjs frontend` and
  `node scripts/verify.cjs typecheck`; expect exit 0.

## 3. Artifact

- [x] Build with the installed Electron Vite CLI, then package with
  `electron-builder --win nsis --x64`, using the already validated staged runtime
  and cached Windows builder tools. Expect exit 0 and `oneClick=false`.
- [x] Record installer SHA-256, byte size and signature status in
  `docs/release-validation-2026-10-10.md`; retain manual UI/install gates.

Use the real installed Node executable if the version-manager shim fails.
No commits, resets, real-data startup or forced termination of user processes.

Additional check: `electron/tests/window-menu.smoke.cjs` uses the existing
isolated main-window harness to verify actual Electron menu state, native
controls, Alt and mini-mode restoration. It passed; packaged `app.asar` contains
the byte-identical tested main entry. Packaged runtime smoke also passed.
