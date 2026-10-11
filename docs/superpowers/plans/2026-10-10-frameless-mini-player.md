# Frameless Mini Player Implementation Plan

> Execute inline using executing-plans and test-driven-development. Do not change
> unrelated dirty files or stop the user's running player.

**Goal:** Preserve the current mini card while removing native chrome and adding
the approved toolbar, live appearance editor, lock/pin/minimize and resizing.

**Architecture:** A dedicated transparent BrowserWindow displays MiniPlayer.
App remains mounted as the sole audio and data owner. A focused main-process
controller owns mini/editor lifecycle, bounded resizing, local geometry and
validated IPC. Shared typed snapshots/actions link the windows.

**Tech Stack:** Electron 35, Vue 3, TypeScript, Lucide, Node tests, Playwright.

## 1. Regression Tests

- [x] Add `scripts/tests/mini-window.test.cjs` with executable controller tests
  for frame/transparent options, main preservation, return, minimize, locked
  resizing, queue height/width restoration and rejected foreign IPC senders.
- [x] Run the test before implementation and observe failure for the missing
  controller; keep tests exercising real controller code with fake native APIs.
- [x] Add shared action-validation tests including finite numeric values,
  queue keys and invalid actions. Update old contracts only where the approved
  separate-window/toolbar behavior explicitly supersedes their assumptions.

## 2. Main And Shared Boundaries

- [x] Add `electron/src/shared/miniPlayer.ts`: minimal track/presentation
  snapshots, action union, finite bounded geometry and action guards.
- [x] Add `electron/src/main/miniPlayerWindows.ts`: create frameless transparent
  windows, show after ready, preserve main bounds, return/cleanup/failure recovery,
  local geometry, lock/pin/minimize/editor and custom edge resizing.
- [x] Integrate the controller in `electron/src/main/main.ts`; replace shrinking
  the main window. Keep main native titlebar, shortcuts and tray restoration.
- [x] Expose only the mini-specific bridge in mini/editor preload modes. Permit
  editor image reads only after selection in its own file dialog. Keep cover
  requests authenticated without expanding account access to auxiliary windows.

## 3. Renderer And Appearance

- [x] Add mini/editor entry components; neither mounts App nor an audio element.
- [x] Add snapshots/actions to preload and `env.d.ts`; synchronize main App
  presentation, preferences and existing queue handlers by current queue keys.
- [x] Replace X with hover/focus toolbar in MiniPlayer using Lucide icons.
  Add position-lock styling and responsive header/queue sizing. Keep web fallback.
- [x] Reuse MiniPlayerAppearanceSettings with an initially expanded editor mode;
  commit through the main App preferences so existing persistence remains owner.
- [x] Add custom transparent resize grips with pointer capture and bounded native
  resize sessions; disable grips and dragging while locked.

## 4. Verification And Installer

- [x] Run controller tests, frontend acceptance and all three TS projects.
- [x] Build production assets and update isolated Windows smoke to check main
  titlebar plus independent mini/editor windows, transparency, actions, resizing,
  lock/pin/minimize/recovery and repeated return without duplicate audio owners.
- [x] Capture and inspect screenshots at minimum/default/large sizes and editor.
- [x] Rebuild NSIS, verify ASAR contents against the current build, record the
  new artifact hash and exact validation results. Leave live services untouched.

Commands use the cached Node executable and existing `scripts/verify.cjs` runner.
Native GUI/build commands may require normal-process approval in this workspace.

## Verification Notes

The frontend runner passed 99 Electron test files and 10 script suites. Seven
executable mini-controller tests passed, including hidden-main timer throttling,
lightweight clock transport and bounded resizing. All three TypeScript projects
passed. Production-build mini and main-titlebar Electron smoke tests passed with
synthetic user data and blocked backend requests; screenshots were inspected at
340x168, 412x168 and 680x260, plus the appearance editor.

Collapsed width is limited to 340-720 and height to 168-320 CSS pixels. Equalizer
and time display add 20 and 16 pixels to the minimum height respectively. Queue
expansion adds 208 pixels to both height limits. Bounds also fit the active
display's work area. Native pointer-driven dragging/resizing, multiple physical
displays and real third-party playback remain manual checks; automated checks
exercise the controller and invoke native window APIs, not OS pointer gestures.

NSIS rebuilt at 15:35:28 Asia/Shanghai. Packaged main/preload/renderer entries
matched the tested output byte-for-byte; packaged runtime validation passed.
Packaged runtime smoke started all three services with synthetic data, passed
12 authorization checks, stopped all owned children and released all ports.
Artifact metadata and manual gates are in `docs/release-validation-2026-10-10.md`.
