# Player Control Button Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved light-outline style to every global player control while preserving existing behavior and the mini player's compact layout.

**Architecture:** Keep playback controls in the existing shared `PlayerControlButton.vue` component and align the remaining `PlayerBar.vue` utility buttons to the same dimensions and interaction tokens. Add a source contract test that prevents the lyrics button or other tools from drifting back to one-off sizing.

**Tech Stack:** Vue 3 SFC, scoped CSS, Node.js contract tests, Electron Vite, Playwright CLI.

---

### Task 1: Lock The Unified Button Contract

**Files:**
- Create: `tests/player-control-style-contract.test.cjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing contract test**

Read `PlayerControlButton.vue` and `PlayerBar.vue`, then assert that shared normal buttons use `40px`, compact buttons use `30px`, the primary play button uses `48px`, and right-side utility buttons use the same `40px`, `1px` border and `10px` radius. Assert that the lyrics button no longer uses `!important` sizing overrides.

- [x] **Step 2: Add the contract to the test script**

Insert `node tests/player-control-style-contract.test.cjs` after the existing player layout contract so it runs with `npm test`.

- [x] **Step 3: Verify the test fails for the missing unified styles**

Run: `node tests/player-control-style-contract.test.cjs`

Expected: FAIL because the current shared buttons are `34px`, the primary button is `44px`, and the lyrics button still has a unique compact style.

### Task 2: Apply The Approved A Style

**Files:**
- Modify: `src/renderer/src/components/PlayerControlButton.vue`
- Modify: `src/renderer/src/components/PlayerBar.vue`

- [x] **Step 1: Update the shared button foundation**

Set regular buttons to `40px × 40px`, `1px solid #d7dddf`, `10px` radius and white translucent background. Use one hover rule with `#f3f5f6` background, `#c2cacc` border and existing active color. Set the primary play button to `48px × 48px` while retaining its circular burgundy emphasis.

- [x] **Step 2: Preserve a proportional compact variant**

Set compact buttons to `30px × 30px`, `1px` border and `8px` radius. Keep the compact primary play control circular at `36px × 36px` so the existing mini-player card remains within its fixed bounds.

- [x] **Step 3: Normalize PlayerBar utility buttons**

Give direct utility buttons `40px × 40px`, the same border/background/radius/transition tokens, remove the lyrics button's `!important` overrides, normalize tool icons to approximately `20px`, and set tool spacing to `9px`.

- [x] **Step 4: Verify the focused contract passes**

Run: `node tests/player-control-style-contract.test.cjs`

Expected: PASS with `播放器控制按钮统一样式契约通过`.

### Task 3: Regression And Visual Verification

**Files:**
- Verify: `src/renderer/src/components/PlayerBar.vue`
- Verify: `src/renderer/src/components/MiniPlayer.vue`

- [x] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all contracts pass.

- [x] **Step 2: Build production bundles**

Run: `npm run build`

Expected: Electron main, preload and renderer bundles build successfully.

- [x] **Step 3: Inspect desktop and compact layouts**

Open the app with Playwright, capture the global player at desktop width and the mini player in its native-sized viewport, and verify button alignment, even gaps, hover feedback and no clipping.

- [x] **Step 4: Record repository limitation**

No commit is created because `G:\倾听音乐\electron` is not a Git repository. Do not initialize or modify repository metadata.
