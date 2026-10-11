# Theme-Aligned Caption Buttons Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan
> inline, task by task. No parallel delegation is needed for this small change.

**Goal:** Match the approved pale gray-blue caption hover without a red close button.

**Architecture:** Keep the Windows resize frame with a hidden title bar, but remove
the native overlay. WindowTitlebar renders three fixed-size Lucide buttons.
Validated main-renderer-only IPC executes native window commands and synchronizes
maximize state without altering the existing close event handler.

**Tech Stack:** Electron 35, Vue 3, TypeScript, Lucide, Node test, Playwright Electron.

## Task 1: Regression Tests

Files: `scripts/tests/window-titlebar.test.cjs`.

- [x] Replace overlay expectations with `assert.equal(options.titleBarOverlay,
  undefined)` and preserve `assert.notEqual(options.frame, false)`.
- [x] Extract and execute the real `main-window-command` and
  `main-window-get-maximized` handlers with TypeScript AST and VM, following the
  existing test style. Assert minimize, toggle-maximize/restore and close calls;
  reject unknown commands, wrong senders, subframes, destroyed windows and
  non-Windows platforms. Assert maximize/unmaximize events publish state.
- [x] Execute preload in a VM with main, mini-player and mini-editor query strings.
  Assert only the main bridge exposes commands/state and listener disposal works.
- [x] Run `node --test scripts/tests/window-titlebar.test.cjs` and observe failures
  caused by the native overlay and missing caption APIs before implementation.

## Task 2: Native Commands And Vue Controls

Files: `electron/src/shared/desktopIntegration.ts`,
`electron/src/main/main.ts`, `electron/src/preload/preload.ts`,
`electron/src/renderer/src/env.d.ts`,
`electron/src/renderer/src/components/WindowTitlebar.vue`.

- [x] Add the exact command contract:

  ```ts
  export type MainWindowCommand = "minimize" | "toggle-maximize" | "close";
  ```

- [x] Remove the Windows `titleBarOverlay` option and obsolete contrast IPC.
  Resolve only an alive Windows main window whose sender and senderFrame match
  its webContents and mainFrame. Getter returns `boolean | null`; commands return
  `false` if rejected. Execute `.minimize()`, `.maximize()`/`.unmaximize()` and
  `.close()`; keep the existing close callback untouched.
- [x] Publish `main-window-maximized` on maximize and unmaximize. Expose
  `mainWindowCommand`, `getMainWindowMaximized`, `onMainWindowMaximized` only in
  mainBridge, and mirror signatures in env.d.ts. Remove the obsolete theme API.
- [x] Render three accessible Lucide buttons (`Minus`, `Square`/`Copy`, `X`).
  Subscribe before reading initial maximize state; ignore a stale initial result
  after a newer event and unsubscribe on unmount. No optimistic state updates.
- [x] Keep each button 46 by 32 CSS pixels, control strip top/right zero, no-drag.
  Use transparent idle background, light hover `#e5eaf4`, light pressed `#d8dfed`,
  and dark hover/pressed `rgba(226,234,248,0.14)`/`rgba(226,234,248,0.22)`.
  Keep the existing 144px left and 140px right drag-region exclusions.
- [x] Re-run the regression test and require all cases to pass.

## Task 3: Actual Electron Interaction

Files: `electron/tests/window-menu.smoke.cjs`.

- [x] Replace native-overlay assertions with rendered button count, 46x32 bounds,
  no-drag styling and theme contrast assertions. Check all three light/dark hover
  backgrounds and pressed-state colors, with screenshots of the close hover.
- [x] Click the actual maximize/restore/minimize buttons; verify native state and
  restore label. Exercise native maximize events, mini-player return and close to
  tray. Keep the existing isolated data directory and blocked backend requests.
- [x] Run `node scripts/verify.cjs frontend`, `node scripts/verify.cjs typecheck`,
  `npm --prefix electron run build`, then
  `node electron/tests/window-menu.smoke.cjs`. Require exit zero and inspect the
  emitted light/dark hover screenshots for overlap and correct rendering.

## Task 4: Review And Delivery

- [x] Review `git diff --check` and changed-file scope; leave provider and account
  logic untouched. Record fresh test results and manual OS gesture limitations.
- [x] Update these checkboxes only after the corresponding checks complete.
- [x] Save code with `git commit -m "fix: use theme-aligned Windows caption buttons"`.
  Do not push or rewrite history unless the user requests it.

## Verification Results

- Regression red: 11 expected failures, 2 unchanged behaviors passed. Green: all
  13 caption tests passed, including sender/frame isolation and stale state.
- Full frontend acceptance passed (102 frontend and 10 script test files).
  All three TypeScript projects and the Electron production build passed.
- Real Electron smoke passed on built and packaged code: neutral light/dark
  hover/pressed colors, onboarding, width changes, minimize, maximize/restore,
  mini return and tray close. A modal-overlay regression failed before raising
  the caption strip above the existing duplicate-finder backdrop; it passed with
  caption z-index 500. Physical OS drag/resize/snap gestures remain manual checks.
- Hover checks explicitly focus the test window and re-hover after screenshots.
  Concurrent packaging load caused a transient hover timeout; the final isolated
  packaged-code smoke passed after packaging stopped.
- NSIS generation initially hit an encrypted user-cache EXDEV and later official
  resource download ECONNRESET/EOF. No application code or dependencies were
  changed for these tool errors. The previous successful workspace build cache
  supplied NSIS resources whose SHA256 matched the builder's expected value.
- Final NSIS generation exited zero using the already validated unpacked app.
  Main, preload, renderer HTML and every JS/CSS asset in app.asar were verified
  byte-for-byte against the final build. Output:
  `electron/release/window-controls/调律音乐 Setup 0.1.0.exe` (185749327 bytes).
  No installation, account mutation, upload or remote push was performed.
