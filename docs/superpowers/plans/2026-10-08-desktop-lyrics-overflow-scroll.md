# Desktop Lyrics Overflow Scroll Implementation Plan

> **For agentic workers:** Implement inline with focused red-green tests; no unrelated refactors.

**Goal:** Enlarge desktop lyric translations and reveal long active lyrics by scrolling them left in sync with playback.

**Architecture:** A pure progress helper converts word or line timing into a bounded scroll ratio. `DesktopLyricsWindow.vue` supplies that ratio through CSS variables to an overflow viewport, allowing CSS to derive the exact travel distance without layout reads on playback frames.

**Tech Stack:** Vue 3, TypeScript, scoped CSS, Node contract/unit tests.

---

### Task 1: Add scroll progress logic

**Files:**
- Create: `electron/src/renderer/src/services/desktopLyricsOverflow.ts`
- Create: `electron/tests/desktop-lyrics-overflow.test.cjs`

- [ ] Add failing tests for timed, word-synced, clamped, and animation-disabled progress.
- [ ] Run the focused test and confirm the helper is missing.
- [ ] Implement the minimal pure functions and rerun the test.

### Task 2: Render overflowing lyrics

**Files:**
- Modify: `electron/src/renderer/src/components/DesktopLyricsWindow.vue`
- Modify: `electron/tests/desktop-lyrics-window-contract.test.cjs`
- Modify: `electron/package.json`

- [ ] Add failing contracts for active-line progress, overflow viewports, CSS travel, and `0.62em` translation text.
- [ ] Wrap original, phonetic, and translation text in independent overflow viewports.
- [ ] Bind active-line progress while preserving alignment and static inactive lines.
- [ ] Add the unit test to the Electron test script and rerun focused checks.

### Task 3: Stabilize QQ lyric updates

**Files:**
- Modify: `electron/src/shared/desktopLyrics.ts`
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/src/renderer/src/components/DesktopLyricsWindow.vue`
- Modify: `electron/src/renderer/src/services/desktopLyricsClock.ts`
- Modify: `electron/tests/desktop-lyrics-clock.test.cjs`
- Modify: `electron/tests/desktop-lyrics-window-contract.test.cjs`

- [ ] Add failing tests that same-track state refreshes cannot rewind and different tracks can reset time.
- [ ] Remove playback time from the full-state watch and keep it on the existing throttled time IPC channel.
- [ ] Cache character counts and active scroll style so QQ QRC rendering does not repeat grapheme segmentation for each visible text row.
- [ ] Rerun the desktop lyrics clock and window contracts.

### Task 4: Verify production compilation

**Files:**
- Verify the files above.

- [ ] Run the focused unit and contract tests.
- [ ] Run an Electron production build into a temporary output directory.
- [ ] Remove the temporary build output and run `git diff --check`.
