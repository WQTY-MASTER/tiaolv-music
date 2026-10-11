# Mini Player Polish Implementation Plan

> Execute inline using executing-plans. Preserve all unrelated worktree changes; no commit or user-service shutdown is requested.

**Goal:** Fix native corners and lyric motion, balance resized mini-player layouts and ship a clear multi-size application icon.

**Architecture:** A pure rounded-region helper feeds the native controller. Pure layout/motion helpers feed the existing Vue mini-player components; stable positioned lyric rows keep clock packets free of repeated DOM measurements. Existing branding paths remain unchanged.

**Tech Stack:** Electron 35, Vue 3, TypeScript, Node assertions, Playwright Electron and NSIS.

## Task 1: Native Rounded Shape

- [x] Add regression assertions to `scripts/tests/mini-window.test.cjs`: `thickFrame === false`, corner exclusion, center inclusion, radius edits, resize and queue shape refresh, non-Windows behavior.
- [x] Run `node --test scripts/tests/mini-window.test.cjs` and observe the expected missing-frame/shape failure.
- [x] Add `electron/src/shared/miniWindowShape.ts` returning coalesced horizontal rounded-rectangle strips. Add guarded, cached Win32 shape synchronization to `electron/src/main/miniPlayerWindows.ts`.
- [x] Re-run the controller tests until all pass.

## Task 2: Lyric Motion and Responsive Layout

- [x] Extend `electron/tests/mini-player-lyrics.test.cjs` with fixed type metrics, cover bounds and adjacent-step/seek policy assertions. Observe missing-helper failures with `node electron/tests/mini-player-lyrics.test.cjs`.
- [x] Implement the metrics and motion policy in `electron/src/renderer/src/services/miniPlayerLyrics.ts`.
- [x] Update `MiniPlayerLyrics.vue` to stable keyed absolute rows with one offscreen buffer on each side, 280 ms transform transitions, and measurements only on line/layout/content changes.
- [x] Update `MiniPlayer.vue` with content ResizeObserver metrics, bounded cover size and responsive left column. Leave browser fallback and buttons unchanged.
- [x] Extend `electron/tests/frameless-mini.smoke.cjs` to check intermediate normal-step positions, immediate seeks, responsive cover/font/column geometry and native clipping.

## Task 3: Application Icon

- [x] Extend `electron/tests/branding-contract.test.cjs` to require valid PNG-backed ICO entries at 16, 20, 24, 32, 40, 48, 64, 128 and 256 pixels. Run and observe the current single-size failure.
- [x] Generate a simplified edit of `electron/resources/app-icon.png` using the built-in image tool; inspect and copy the selected asset into the workspace.
- [x] Add a deterministic Node/Electron icon conversion utility that resizes the master PNG and writes the multi-size ICO. Verify frame sizes and rebuildability.

## Task 4: Release Verification

- [x] Run `node scripts/verify.cjs typecheck` and `node scripts/verify.cjs frontend`.
- [x] Build with `electron-vite build`; run `frameless-mini.smoke.cjs` and `window-menu.smoke.cjs` using the cached Playwright module.
- [x] Inspect generated small/wide mini-player screenshots and icon previews. Verify Windows native region and frame style using the owned test window only.
- [x] Build NSIS with the existing cached builder tools; verify archive/source and icon equality and runtime staging.
- [x] Run packaged runtime smoke only when 17890/3000/3300 are free; otherwise document the skip. Update release validation with artifact size/hash, actual tests and remaining manual checks.

## Outcome

All scoped checks passed. The current artifact is recorded in `docs/release-validation-2026-10-10.md`. Test processes used isolated data and were fully stopped. Real-provider playback, clean-machine installation, native mouse gestures and multi-monitor/DPI behavior remain manual checks.
