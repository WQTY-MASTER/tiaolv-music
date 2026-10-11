# Mini Cover And Translation Implementation

Scope: approved spec in ../specs/2026-10-10-mini-cover-translation-design.md.

- [x] Add failing model/UI tests for 180 px cover and translated group sizing.
- [x] Implement height-limited cover growth and original/translation groups.
- [x] Run model, frontend, typecheck and real Electron UI/native corner tests.
- [x] Inspect maximum-size screenshots and show the user the updated preview.
- [x] Add tested native clipping restoration and preserve antialiasing edge pixels.
- [x] Rebuild installer, verify packaged assets and record artifact metadata.

Completed: 21:17:19 Asia/Shanghai artifact, frontend/typecheck/build, real mini
and titlebar tests, native compositor/antialiasing checks, packaged assets and
three-service isolated runtime smoke all passed. No user service was stopped.

Keep real accounts/library untouched. Preserve unrelated workspace changes.
