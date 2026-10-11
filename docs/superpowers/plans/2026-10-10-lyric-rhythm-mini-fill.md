# Lyric Rhythm And Mini Fill Implementation Plan

> Execute sequentially in the current workspace using executing-plans.
> Preserve unrelated changes. No commits or user-service shutdown are needed.

**Goal:** Match the supplied single/bilingual lyric rhythm, fix misplaced
music-director credits and smooth QQ mini word fill.

**Architecture:** Extend existing metadata recognizers; use font-relative CSS
in App.vue and the existing mini layout. Project authoritative mini time using
the existing desktop clock primitives, with a 150 ms cap and a component-owned
animation frame. Audio remains owned only by the main renderer.

**Tech Stack:** Vue, TypeScript, Node tests, Playwright/Electron, NSIS.

## Tasks

- [x] Add failing Music Director LRC/QRC assertions in lyric-metadata and
  lyric-parser tests; run each with Node and observe missing credits/leaked text.
- [x] Add bounded projection tests in mini-player-lyrics.test.cjs and native
  intermediate-fill/pause/seek assertions in frameless-mini.smoke.cjs.
- [x] Extend existing browser layout smoke to measure original/translation
  clearance, separated bilingual groups and even single-language line pitch.
- [x] Add Chinese/English director labels to the paired existing recognizers.
- [x] Add projectMiniLyricTime to miniPlayerLyrics.ts, reusing desktop clock
  projection. Cap elapsed time at 150 ms and clamp to track duration.
- [x] MiniPlayerLyrics.vue receives isPlaying, owns renderTime/frame anchor,
  reanchors on pause/seek/track change and cancels frames on unmount. Watch
  renderTime for smooth normal line steps; keep large/backward seeks immediate.
- [x] App.vue marks translated rows and sets padding relative to font size;
  mini translation has 2 px clearance. Preserve active scale-room calculation.
- [x] Run focused tests, frontend verification and all TypeScript projects.
  Build and run browser/native lyric, startup and corner regressions.
- [x] Package Windows x64 NSIS; verify packaged files and native mini behavior
  from app.asar. Record exact artifact time, hash and verification limitations.

Commands use the cached Codex Node runtime when Node is not on PATH. Browser
smokes use an isolated Vite preview; native smokes use isolated user data and
mocked API responses. Stop only the preview owned by these tests.
