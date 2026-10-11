# Desktop Lyrics Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, live desktop-lyrics settings page backed by the existing native lyrics window.

**Architecture:** Extend the shared desktop-lyrics state model, keep the Electron main process authoritative, and expose snapshot/preferences/bounds IPC to both renderer windows. Render the same normalized preferences in the settings preview and native desktop-lyrics window.

**Tech Stack:** Electron 35, Vue 3, TypeScript, lucide-vue-next, Node contract tests.

---

### Task 1: Extend and test the shared preference model

**Files:**
- Modify: `electron/src/shared/desktopLyrics.ts`
- Modify: `electron/tests/desktop-lyrics-state.test.cjs`

- [ ] Add failing assertions for the new defaults, legacy normalization, bounds constraints, and played/unplayed theme colors.
- [ ] Run `node tests/desktop-lyrics-state.test.cjs` and confirm the new assertions fail.
- [ ] Add typed preference fields, clamp helpers, and two-color theme resolution.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Make the main process authoritative for live settings

**Files:**
- Modify: `electron/src/main/main.ts`
- Modify: `electron/src/preload/preload.ts`
- Modify: `electron/src/renderer/src/env.d.ts`
- Modify: `electron/tests/desktop-lyrics-native-contract.test.cjs`

- [ ] Add failing contract assertions for main-window snapshot access, bounds updates, always-on-top updates, and two-window broadcasts.
- [ ] Run the native contract and confirm failure.
- [ ] Extend the snapshot type and IPC bridge, allow trusted main/lyrics renderers, apply native bounds and window flags, and persist normalized results.
- [ ] Re-run the native contract.

### Task 3: Render all preferences in the desktop lyrics window

**Files:**
- Modify: `electron/src/renderer/src/components/DesktopLyricsWindow.vue`
- Modify: `electron/tests/desktop-lyrics-window-contract.test.cjs`

- [ ] Add failing assertions for font family/weight, stroke, alignment, line mode, two colors, advanced appearance, and optional phonetics.
- [ ] Run the window contract and confirm failure.
- [ ] Add CSS variables/classes and current/next line rendering while preserving existing toolbar, QRC word fill, Netease line fill, dragging, locking, and translation.
- [ ] Re-run desktop lyrics window and state tests.

### Task 4: Build the settings panel and live preview

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Create: `electron/tests/desktop-lyrics-settings-contract.test.cjs`
- Modify: `electron/package.json`

- [ ] Write a failing settings contract covering top switches, font/layout/color controls, preview, bounds sliders, lock help, and advanced disclosure.
- [ ] Run it and confirm failure.
- [ ] Add reactive snapshot state, IPC synchronization, immediate local preview updates, and the complete settings panel.
- [ ] Add responsive styling and disabled states when desktop lyrics are off.
- [ ] Add the contract test to the full Electron test script and re-run the focused contract.

### Task 5: Verify end to end

**Files:**
- Verify all files above; do not commit or push.

- [ ] Run `npm test` in `electron` and confirm all contract/unit tests pass.
- [ ] Run `npm run build` in `electron` and confirm renderer/main/preload builds pass.
- [ ] Restart `npm run dev`, open the desktop-lyrics settings page, and verify controls update the visible native lyrics window without a save button.
- [ ] Verify existing persisted preferences and bounds survive restart and `Ctrl+Alt+L` still unlocks click-through mode.
