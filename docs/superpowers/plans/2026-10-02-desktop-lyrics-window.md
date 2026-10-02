# Desktop Lyrics Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-window desktop lyric preview with a persisted, always-on-top Electron lyrics window whose toolbar auto-hides and supports click-through locking.

**Architecture:** The main renderer remains the only audio owner and publishes lyric/playback state through the main process. A query-selected Vue root renders the desktop lyrics UI, while the Electron main process owns native window lifecycle, bounds persistence, mouse passthrough, global unlock registration, and action routing.

**Tech Stack:** Electron 35, Vue 3, TypeScript, lucide-vue-next, Node contract/unit tests, electron-vite

---

### Task 1: Shared desktop lyrics state and preferences

**Files:**
- Create: `electron/src/shared/desktopLyrics.ts`
- Create: `electron/tests/desktop-lyrics-state.test.cjs`

- [ ] **Step 1: Write failing tests** for default preferences, persisted value normalization, font-size clamping, supported actions, and per-character fill that remains at 100% after completion.
- [ ] **Step 2: Run** `node electron/tests/desktop-lyrics-state.test.cjs` and confirm failure because the module does not exist.
- [ ] **Step 3: Implement** serializable playback/preference/action types plus pure normalization and character-fill helpers.
- [ ] **Step 4: Re-run the focused test** and confirm all cases pass.

### Task 2: Native Electron lyrics window lifecycle

**Files:**
- Modify: `electron/src/main/main.ts`
- Modify: `electron/src/preload/preload.ts`
- Modify: `electron/src/renderer/src/env.d.ts`
- Create: `electron/tests/desktop-lyrics-native-contract.test.cjs`

- [ ] **Step 1: Write failing contracts** for the frameless transparent always-on-top window, query-based renderer load, persisted bounds/preferences, visibility broadcasts, state relay, action relay, mouse passthrough, and `Ctrl+Alt+L` unlock registration.
- [ ] **Step 2: Run the native contract** and confirm it fails on missing desktop-lyrics IPC/window code.
- [ ] **Step 3: Implement main-process persistence and lifecycle** with validated bounds, debounced writes, show/close/toggle helpers, and tray state refresh.
- [ ] **Step 4: Implement secure preload APIs and renderer typings** for state publishing, time publishing, visibility, preferences, and actions.
- [ ] **Step 5: Re-run the native contract** and confirm it passes.

### Task 3: Desktop lyrics renderer

**Files:**
- Create: `electron/src/renderer/src/DesktopLyricsWindow.vue`
- Modify: `electron/src/renderer/src/main.ts`
- Create: `electron/tests/desktop-lyrics-ui-contract.test.cjs`

- [ ] **Step 1: Write failing UI contracts** for query-based mounting, toolbar order and tooltips, hover-only visibility, locked suppression, translation/font controls, full lyric DOM reuse, active-line following, and progressive word fill.
- [ ] **Step 2: Run the UI contract** and confirm it fails because the component is absent.
- [ ] **Step 3: Build the component** using existing lyric parsing/synchronization utilities and lucide controls. Render all lines once per song, update classes/styles from time state, and scroll only when active line changes.
- [ ] **Step 4: Route the renderer entry** using `window=desktop-lyrics` without creating a second HTML entry.
- [ ] **Step 5: Re-run UI and state tests** and confirm they pass.

### Task 4: Main player integration

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/src/renderer/src/components/PlayerBar.vue`
- Modify: `electron/tests/player-ui-contract.test.cjs`
- Modify: `electron/tests/system-tray-contract.test.cjs`
- Create: `electron/tests/desktop-lyrics-integration-contract.test.cjs`
- Modify: `electron/package.json`

- [ ] **Step 1: Write failing integration contracts** for replacing the preview ref, toggling the native window from “词” and tray, syncing metadata/lyrics/play state, throttling clock updates, handling desktop actions, reflecting visibility, and displaying the unlock shortcut in settings.
- [ ] **Step 2: Run the integration contract** and confirm it fails against the old preview implementation.
- [ ] **Step 3: Replace preview logic** with native visibility state and bridge calls; remove the old preview template/CSS.
- [ ] **Step 4: Publish full state on track/lyrics/play-mode changes** and current time at a bounded interval during playback and seeking.
- [ ] **Step 5: Route desktop actions** to existing transport and play-mode functions, and update shortcut/settings and tray state.
- [ ] **Step 6: Register all new tests in `npm test`** and run focused desktop lyric tests.

### Task 5: Regression and delivery

**Files:**
- Verify all files above.

- [ ] **Step 1: Run** `npm test` from `electron` and confirm the complete suite passes.
- [ ] **Step 2: Run** `npm run build` from `electron` and confirm main, preload, and renderer bundles compile.
- [ ] **Step 3: Run** `git diff --check` and inspect the final diff for unrelated changes.
- [ ] **Step 4: Commit focused changes**, push `main` to `origin`, and verify local/remote hashes match with a clean worktree.
