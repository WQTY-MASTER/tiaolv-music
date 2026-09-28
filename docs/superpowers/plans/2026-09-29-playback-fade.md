# Playback Fade Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent QQ-style playback setting that fades audio out and in only when moving to the previous or next track.

**Architecture:** Keep the existing shared `HTMLAudioElement` for every source. Add a small pure `playbackFade.ts` domain module for duration clamping and interpolation, while `App.vue` owns the animation lifecycle and routes previous/next actions through one transition function.

**Tech Stack:** Vue 3 Composition API, TypeScript, HTMLAudioElement, requestAnimationFrame, Node assertion contract tests.

---

### Task 1: Fade domain rules

**Files:**
- Create: `electron/src/renderer/src/services/playbackFade.ts`
- Create: `electron/tests/playback-fade.test.cjs`
- Modify: `electron/package.json`

- [ ] **Step 1: Write the failing unit test**

Test `normalizeFadeDurationMs`, `boundFadeDurationMs`, and `interpolateFadeVolume` for the `10–2000ms` setting range, remaining-track upper bounds, zero remaining time, and interpolation endpoints.

- [ ] **Step 2: Run test to verify it fails**

Run: `node electron/tests/playback-fade.test.cjs`

Expected: FAIL because `services/playbackFade.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Export constants `MIN_FADE_DURATION_MS`, `MAX_FADE_DURATION_MS`, `DEFAULT_FADE_DURATION_MS` and the three pure functions. Clamp stored values to the setting range, then cap runtime duration by finite available media seconds.

- [ ] **Step 4: Run test to verify it passes**

Run: `node electron/tests/playback-fade.test.cjs`

Expected: `播放渐进渐出逻辑通过`.

### Task 2: Previous/next playback transition

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Create: `electron/tests/playback-fade-contract.test.cjs`
- Modify: `electron/package.json`

- [ ] **Step 1: Write the failing integration contract**

Require a shared `transitionToTrack` path from `previousTrack` and `nextTrack`, a `requestAnimationFrame` volume animation, a bounded old-track remaining duration, optional fade-in support in `playTrack`, and direct `playTrack` use for ordinary song selection.

- [ ] **Step 2: Run test to verify it fails**

Run: `node electron/tests/playback-fade-contract.test.cjs`

Expected: FAIL because transition functions and fade settings are absent.

- [ ] **Step 3: Implement the minimal transition lifecycle**

Add a generation token so rapid switching cancels stale animations. Fade the current audio toward zero, abort if superseded, call `playTrack(track, { fadeIn: true, transitionToken })`, start the new source at zero, then fade toward the latest user volume. Skip old-track fading when audio is paused or ended, cap both phases with `boundFadeDurationMs`, and invalidate animation state on unmount.

- [ ] **Step 4: Run focused tests**

Run: `node electron/tests/playback-fade.test.cjs && node electron/tests/playback-fade-contract.test.cjs`

Expected: both tests pass.

### Task 3: Playback settings UI and persistence

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/tests/playback-fade-contract.test.cjs`

- [ ] **Step 1: Extend the failing contract**

Require “音乐渐进渐出” directly below the playback card heading, a `10–2000ms` range input, current millisecond output, a switch, disabled slider state when off, default `500ms`, default enabled state, legacy-key migration, and localStorage watchers.

- [ ] **Step 2: Run test to verify it fails**

Run: `node electron/tests/playback-fade-contract.test.cjs`

Expected: FAIL on the first missing UI or persistence assertion.

- [ ] **Step 3: Implement UI and persistence**

Add `playback-fade-enabled` and `playback-fade-duration-ms` storage keys/readers/refs/watchers. Render a reference-inspired horizontal row with explanatory copy on the left and duration label, slider, value, and switch on the right. Style a compact light surface and responsive stacked layout; apply disabled opacity and pointer feedback when switched off.

- [ ] **Step 4: Run regression verification**

Run: `npm test && npm run build`

Expected: all Electron contracts pass and `electron-vite build` completes successfully.

- [ ] **Step 5: Smoke test development mode**

Run `npm run dev` from `electron`, verify Electron starts and `http://127.0.0.1:5173/` returns HTTP 200, then stop the process.
