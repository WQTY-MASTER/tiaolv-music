# QQ Favorites And Lyric Clock Implementation Plan

**Goal:** Repair QQ favorites discovery, write diagnostics and lyric clock drift, then deliver a tested Windows installer.

**Architecture:** Keep existing account favorites routes and global toast. Add missing library metadata only at the presentation boundary. Keep API writes in the QQ service and bounded interpolation in playbackClock.

**Tech Stack:** Vue, TypeScript, Node/Vitest, Electron, Java backend.

1. Add executable regressions for omitted favorites, save failures/concurrent clicks, and frozen media clocks. Observe expected failures.
2. Implement the scoped UI and clock fixes. Add QQ write-envelope tests before adding TID/UTF-8 parameters.
3. Run focused tests, all frontend tests/type checks, and QQ API build/tests/lint. Perform the one authorized addition without automatic uncertain retries, then read back.
4. Stage the current QQ runtime, build Electron and NSIS, check packaged assets and isolated playback/library scenarios. Record results and unresolved cloud-sync limitations.

No commits or unrelated cleanup are part of this task.
