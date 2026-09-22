# Streaming Daily Mix Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the logged-in streaming home with the approved Daily Mix banner and two personalized entry cards.

**Architecture:** Keep the existing provider-aware account endpoints and derive a stable home view model in `App.vue`. Reuse the existing playback queue and playlist detail state instead of adding backend endpoints.

**Tech Stack:** Vue 3, TypeScript, Electron Vite, Lucide Vue, Node contract tests.

---

### Task 1: Lock the new homepage contract

**Files:**
- Modify: `electron/tests/streaming-home-contract.test.cjs`

- [ ] Assert the search toolbar, Daily Mix copy, cover stack, both personalized cards, provider-aware copy, play-all action, detail action, and transition hooks.
- [ ] Run `node tests/streaming-home-contract.test.cjs` and confirm it fails because the old recommendation layout is still rendered.

### Task 2: Add the Daily Mix view model and actions

**Files:**
- Modify: `electron/src/renderer/src/App.vue`

- [ ] Add computed date labels and provider-aware Daily Mix descriptions.
- [ ] Add `playStreamingDailyMix`, `openStreamingDailyMix`, `openPrivateRoaming`, and `openPrivateRadar` using the existing playback queue and selected-playlist state.
- [ ] Keep empty recommendation and missing playlist behavior deterministic.

### Task 3: Replace the logged-in template and styles

**Files:**
- Modify: `electron/src/renderer/src/App.vue`

- [ ] Add the search field beside the cloud source selector.
- [ ] Replace the old featured-song/list/playlist grid with the Daily Mix banner and two action cards.
- [ ] Add provider refresh animation, reduced-motion handling, responsive cover stacking, and narrow-window layout.
- [ ] Run the streaming home contract and production build.

### Task 4: Verify behavior and regressions

**Files:**
- Verify: `electron/tests/*.test.cjs`

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Use headed Playwright at wide and narrow widths to verify the source menu, logged-out card, mocked logged-in Daily Mix view, and no overflow.

