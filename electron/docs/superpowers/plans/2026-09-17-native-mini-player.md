# Native Mini Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the existing Electron main window into a compact always-on-top mini player and restore the original window exactly when the in-card close button is pressed.

**Architecture:** Main process owns window geometry and restoration state. Preload exposes two narrow IPC methods. Vue owns visible mini-player state, uses native-window styling only after IPC succeeds, and keeps an in-page fallback for browser development.

**Tech Stack:** Electron BrowserWindow, Electron IPC/contextBridge, Vue 3, TypeScript, Node contract tests, Playwright CLI.

---

### Task 1: Lock the native mini-mode contract

**Files:**
- Create: `tests/native-mini-window-contract.test.cjs`
- Modify: `package.json`

- [ ] Write assertions for `enter-mini-mode` and `exit-mini-mode`, saved bounds/maximized state, always-on-top changes, preload methods, renderer fallback, top-right close button, and centered control order.
- [ ] Run `node tests/native-mini-window-contract.test.cjs` and confirm it fails because the IPC bridge and native mode do not exist.

### Task 2: Add Electron window mode switching

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/preload/preload.ts`
- Modify: `src/renderer/src/env.d.ts`

- [ ] Store the active main window and one immutable pre-mini snapshot.
- [ ] Add a short `setBounds` interpolation that clamps the compact window to the active display work area.
- [ ] Implement idempotent enter/exit IPC handlers without intercepting native minimize or close events.
- [ ] Expose `enterMiniMode()` and `exitMiniMode()` from preload and declare their result types.
- [ ] Run the native contract test and confirm the Electron bridge assertions pass.

### Task 3: Connect Vue native mode and refine layout

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/components/MiniPlayer.vue`
- Modify: `tests/mini-player-contract.test.cjs`

- [ ] Add renderer state that distinguishes Electron native mode from browser floating mode.
- [ ] Render only the mini player in native mode; enter IPC after Vue paints and restore the window before showing the main interface.
- [ ] Add native drag-region styling while retaining JavaScript card dragging in browser mode.
- [ ] Move the close button to the top-right and center the five shared controls below the content.
- [ ] Run both mini-player contract tests and confirm they pass.

### Task 4: Regression and visual verification

**Files:**
- Verify: `src/main/main.ts`
- Verify: `src/preload/preload.ts`
- Verify: `src/renderer/src/App.vue`
- Verify: `src/renderer/src/components/MiniPlayer.vue`

- [ ] Run `npm test` and require the complete suite to pass.
- [ ] Run `npm run build` and require main, preload, and renderer bundles to compile.
- [ ] In the browser fallback, verify the close button is top-right, controls are centered on hover, playback state switches correctly, and closing restores the global player bar.
- [ ] Launch Electron and verify entering mini mode shrinks/raises the same window, dragging moves it, and exiting restores previous bounds and maximized state.

