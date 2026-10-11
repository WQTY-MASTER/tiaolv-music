# Mini Lyrics Repair Implementation Plan

> Execute inline using executing-plans and test-driven-development. Keep the
> existing dirty worktree and user processes intact; do not commit other work.

**Goal:** Remove the translucent outer shell and display responsive, colored,
playback-synchronized lyrics without short-line drift.

**Architecture:** Main App sends parsed lyrics in metadata snapshots; lightweight
time IPC remains separate. A focused lyric model reuses existing timing helpers,
and a small renderer component owns measured lyric space and overflowing text.
The existing MiniPlayer remains owner of cover, toolbar and queue presentation.

**Tech Stack:** Vue 3, TypeScript, Electron 35, Node tests and Playwright.

## 1. Regression Tests

- [x] Add `electron/tests/mini-player-lyrics.test.cjs` exercising a TypeScript
  model: `getMiniLyricLineCount(40/110/180)` returns `1/3/5`; centered slots have
  empty edges; QQ characters and NetEase whole-line highlighting honor pause/seek updates;
  `getMiniLyricOffset(100,200,0.5)` is zero and overflowing offsets are bounded.
- [x] Run the new test with cached Node and observe missing-model failure.
- [x] Extend `electron/tests/frameless-mini.smoke.cjs` with synthetic parsed
  lyrics delivered through the main bridge, inspect 1/3/5 slots, color fills,
  stationary short text and overflow movement, and assert alpha zero outside
  the rounded card rather than alpha below 40 at one corner.

## 2. Model, Snapshot And Renderer

- [x] Create `electron/src/renderer/src/services/miniPlayerLyrics.ts` with
  `getMiniLyricLineCount`, `getMiniLyricSlots`, `getMiniLyricProgress`,
  `getMiniLyricCharacterFill` and `getMiniLyricOffset`. Reuse lyricSync and
  desktopLyricsOverflow; clamp invalid measurements and use no independent clock.
- [x] Add optional `lyricLines: LyricLine[]` to the shared snapshot and mini
  props. Populate it from `lyricLines.value` in App, watch parsed lines and retain
  existing currentTime/progress transport rather than resending queues each tick.
- [x] Create `MiniPlayerLyrics.vue`: ResizeObserver on available region, 30-pixel
  centered slots, per-character fills for QQ QRC, whole-line NetEase fill, measured
  active text width, no unconditional CSS animation. Clean up the observer.
- [x] Integrate it in MiniPlayer. Remove native inset/outer shadows, clip native
  surface effects inside rounded corners; keep appearance options and resize
  grips usable. Give the lyric area actual remaining height above controls.

## 3. Verification And Package

- [x] Run the focused test, `node scripts/verify.cjs frontend`, and
  `node scripts/verify.cjs typecheck`; require exit zero for all checks.
- [x] Build production assets and run both `frameless-mini.smoke.cjs` and
  `window-menu.smoke.cjs` with isolated data and blocked backend requests.
  Inspect minimum/large, timed/current/adjacent, paused and appearance screenshots.
- [x] Rebuild NSIS with the existing cached tools; compare packaged main,
  preload and renderer to tested output and validate packaged runtime resources.
- [x] Run packaged service smoke only if all three ports are free, record the
  installer hash/time and remaining physical-compositor/playback manual checks.

## Results

Frontend acceptance passed 100 explicit test files and 10 script suites; all
three TypeScript projects and the production build passed. Both real Electron
window smokes passed with synthetic data. Screenshots at 1/3/5 lines and NetEase
whole-line color were inspected; the strict outside pixel regression failed
with alpha 2 before the fix and passed with alpha zero afterward. QQ character
fills, forward/backward lightweight time updates, local `online-netease` marker,
paused seek restoration and existing toolbar/queue/main-window behavior passed.

NSIS rebuilt at 17:42:19 Asia/Shanghai. Main/preload/renderer bytes matched the
tested build; runtime validation and source/staged/packaged service hashes
matched. Existing service ports were occupied, so packaged service startup was
not rerun and no user process was stopped. Full packaged real-account playback,
physical compositor appearance and OS pointer gestures remain manual gates.
See `docs/release-validation-2026-10-10.md` for the current artifact hash.
