# Prefer Local Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted playback setting that safely prefers a matching local-library audio file for QQ and NetEase tracks, with automatic network fallback.

**Architecture:** Keep matching and ranking in a pure renderer service so it can be tested independently. `App.vue` owns persistence and UI, applies the chosen local URL after online metadata loads, and retries once with the preserved network URL when local playback fails.

**Tech Stack:** Vue 3, TypeScript, HTMLAudioElement, Node test runner, Vite/Electron

---

### Task 1: Local playback candidate matcher

**Files:**
- Create: `electron/src/renderer/src/services/preferredLocalPlayback.ts`
- Create: `electron/tests/preferred-local-playback.test.cjs`

- [ ] **Step 1: Write failing matcher tests**

Cover exact normalized title/artist matching, rejection beyond the three-second duration tolerance, rejection for non-streaming sources, and deterministic preference for lossless/high-bit-depth/high-sample-rate candidates.

- [ ] **Step 2: Verify the tests fail**

Run: `node electron/tests/preferred-local-playback.test.cjs`

Expected: FAIL because `preferredLocalPlayback.ts` does not exist.

- [ ] **Step 3: Implement the pure matcher**

Export `selectPreferredLocalPlaybackTrack(onlineTrack, localTracks)` with small structural types. Normalize comparison text with `NFKC`, lowercase conversion, and removal of whitespace/common punctuation. Filter candidates by local source, audio URL, exact normalized metadata, and duration tolerance; then sort by lossless codec, bit depth, sample rate, duration distance, and stable ID.

- [ ] **Step 4: Verify matcher tests pass**

Run: `node electron/tests/preferred-local-playback.test.cjs`

Expected: PASS with all candidate-selection cases.

### Task 2: Playback setting and network fallback

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Create: `electron/tests/preferred-local-playback-contract.test.cjs`
- Modify: `electron/package.json`

- [ ] **Step 1: Write failing integration contract tests**

Assert that the setting defaults to enabled, migrates and persists through the existing storage pattern, appears below fade settings, invokes the matcher only for online asset loading, preserves a network fallback URL, and retries the network source after a failed preferred-local start.

- [ ] **Step 2: Verify the contract test fails**

Run: `node electron/tests/preferred-local-playback-contract.test.cjs`

Expected: FAIL because the setting and playback integration are absent.

- [ ] **Step 3: Add persistence and the settings row**

Add `prefer-local-download-playback` to migrated setting names, define its storage key and default-enabled reader, create a Vue ref and watcher, and render the standard settings toggle directly below “音乐渐进渐出”.

- [ ] **Step 4: Integrate local selection and one-shot fallback**

After resolving platform detail/lyrics, retain the resolved network audio URL. When enabled, call the pure matcher against `currentLibrary`, set the matched local URL for this playback attempt, and retain the network URL in transient `Track` fields. Refactor the audio-start branch so a failed preferred-local start resets the source to the network URL and retries once without duplicating success side effects.

- [ ] **Step 5: Register and run focused tests**

Run: `node electron/tests/preferred-local-playback.test.cjs; node electron/tests/preferred-local-playback-contract.test.cjs; node electron/tests/playback-fade-contract.test.cjs`

Expected: all focused tests PASS.

### Task 3: Regression verification

**Files:**
- Verify: `electron/src/renderer/src/App.vue`
- Verify: `electron/src/renderer/src/services/preferredLocalPlayback.ts`
- Verify: `electron/tests/preferred-local-playback.test.cjs`
- Verify: `electron/tests/preferred-local-playback-contract.test.cjs`

- [ ] **Step 1: Run the complete Electron test suite**

Run: `npm test` from `electron`

Expected: PASS; existing Node module-type warnings may remain.

- [ ] **Step 2: Build the Electron application**

Run: `npm run build` from `electron`

Expected: renderer, preload, and main bundles build successfully.

- [ ] **Step 3: Check formatting and the running preview**

Run: `git diff --check` and request `http://127.0.0.1:5173` without restarting the user's existing dev process.

Expected: no whitespace errors; preview responds with HTTP 200 and retains the 调律音乐 title.

- [ ] **Step 4: Commit and push**

Stage only the files from this feature plus the already approved playback-background unification, commit with a focused message, push `main`, and confirm the worktree is clean and local/remote hashes match.
