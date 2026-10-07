# Audio and Lyrics Checkpoint

## Resumed Work Status

### Latest Follow-Up

Local-source switching is now implemented. Local tracks continue playing their local file by default. Opening the quality menu searches NetEase and QQ independently, conservatively checks title/version, artist and duration, and caches results for five minutes per local metadata/account combination. Matched sources expose the existing requested-quality preferences (not guaranteed resolved tiers). Manual switching preserves local identity, lyrics, likes, position and play/pause state; returning to local is always available. Failed/unauthorized requests and preview-only audio restore local playback. New-track requests cancel pending source switches and start with local audio again. No external URL is persisted into the local library.

The lyric baseline is now 22px, matching the upper song information. The old persisted 18px default migrates once; subsequent intentional size choices remain configurable. The user's final follow-up also requests regular weight: defaults and the old semibold 600 setting migrate once to 400, matching song metadata, while future intentional custom weights remain available. Active originals are 27.5px at the default setting without extra bolding; translations are unchanged. Tail spacing now relies on the measured spacer rather than redundant fixed list padding, retaining end alignment at narrow sizes.

Verification: 119 frontend test entries and all 209 backend tests passed. Isolated browser tests cover local/NetEase/QQ switching, progress, pause/resume, failure/preview rollback, cached matching, cancellation during next-track playback, desktop/narrow menus, QRC visibility and first/last lyric alignment. Renderer preview remains http://127.0.0.1:5173. Real provider availability/Hi-Res entitlement still depends on the logged-in account; the switch regression uses synthetic silent audio and mocked search responses, not user account playback.

The paragraphs below retain historical checkpoints.

The user confirmed headphone audio now works. They reported QRC originals disappearing except on the active line and missing preface information. Fixed the CSS specificity conflict (legacy word-timed rule kept `color: transparent` after removing its background), decoded per-word timing in QRC credits, and excluded tagged opening titles, vocal role annotations and slash separators from sung lines. Preserve prior local credits if an online upgrade carries none. New parser/metadata and QRC browser regression tests reproduce the old failures and now pass, covering all originals visible, exactly one enlarged original at each playback boundary, rewind, and unchanged translations. Read-only verification against the user's actual cached song yields first sung time 12.131, 41 sung lines and 17 credits. Frontend build and existing layout tests passed. No audio/backend production changes in this follow-up.

At the preceding checkpoint, the user described local-default playback with matched NetEase/QQ online qualities and switching back to local. Their term "redis" was interpreted as Hi-Res. That feature was not implemented at that checkpoint; it is now covered by the latest follow-up above.

Resumed on 2026-10-07. Production changes are now implemented:

- Added anonymous CORS to the audio element and recovery of the existing suspended Web Audio graph when disabling matching.
- Reproduced silent samples with progressing playback in Chromium and Electron 35.7.5. With the actual new audio configuration RMS changed from 0 to approximately 0.173; graph resume and default sink checks passed. Tests mute the final destination, so physical headphone audibility is still not verified.
- QQ word-timed lyrics can upgrade existing local lyrics without overwriting embedded/sidecar records. Without local lyrics, QQ precedes NetEase. Responses carry translations and credits. The renderer accepts upgrades even when it already has lyrics and ignores stale track responses.
- Lyric seek positioning now measures the first visible text line. CSS and scroll calculations share one measured anchor. End spacing includes scroller padding. Active original text is 1.25x while translations keep their existing size. Default colors are blue; custom colors remain configurable. Resize and preference changes remeasure geometry.
- Browser layout/race tests pass at 1600, 900 and 390px, including wrapped preface, final lyric alignment, unchanged translation size, non-overlapping timestamps, QQ translation/timing, quick track switching and online-match opt-out.
- Electron production build passed. Targeted frontend tests and backend service/controller/cache tests passed. Cache tests required an unsandboxed rerun because sandbox cleanup denied a JUnit temporary directory.

The user then reported an Electron `0x80000003` native exception dialog. The first sandboxed isolated Electron test had hung and was interrupted; its verified test main PID 31644 was stopped. A later unsandboxed isolated test completed successfully. No more Electron test processes remain. The user's original player main PID 25672 and renderer PID 13820 (both started 11:42) were still running when checked. Windows logs did NOT establish the dialog's origin; do not claim it is definitely the test or definitely the player. Asked whether their original player remains interactive; awaiting reply. Do not change production startup flags speculatively.

Renderer preview server started at http://127.0.0.1:5173 (PID 31736 when launched). No backend was launched, stopped, or restarted. User must reload/restart their app and backend to load all changes. Preserve their running player and data.

The historical notes below describe the original paused state, not outstanding unimplemented fixes.

## User Requirements

1. Fix silent headphone playback, including switching the Windows default output while loudness matching is enabled.
2. Align the lyric seek triangle and timestamp with the first visual text line, including wrapped preface entries.
3. Enlarge the active original lyric only; keep translation size unchanged and maintain left alignment.
4. Use blue as the default active/sweep lyric color. Preserve intentional custom colors.
5. For local tracks with a logged-in QQ account, prefer QQ word-timed lyrics. If unavailable, retain existing local lyrics. When no local lyrics exist, try QQ lyrics, then NetEase. Respect the online-matching toggle.

## Current Findings

- `electron/src/renderer/src/App.vue` has an audio element without `crossorigin`. Audio comes from the backend on port 17890, while the renderer uses another origin. Loudness matching creates a MediaElementAudioSource in `services/audioOutput.ts`. Cross-origin media without CORS can produce silence in that graph. This is a strong hypothesis, not yet a browser/signal-level reproduction or a physical headphone verification.
- Backend `config/WebConfig.java` already allows localhost/127.0.0.1:5173 and the null origin.
- `AudioOutputController.setLoudnessMatching(false)` resets gain but does not resume a previously created suspended context. Turning matching off cannot bypass an already connected graph.
- Earlier changes already preserve the default sink alias rather than pinning a physical endpoint, and reapply routing on play, focus and devicechange. Do not claim these proved audible output.
- `LocalLyricsMatchService` immediately returns local embedded/sidecar lyrics, and tries NetEase before QQ. The renderer also skips automatic matching whenever lyrics already exist. Both layers need changes.
- The match service persists replacement lyrics into TrackRepository. Preserve original embedded/sidecar lyrics as a reliable fallback when upgrading to QQ. Cache full LyricData, including translation.
- `LocalLyricsMatchResult` currently returns only Track and message, so translations need an explicit response path if online lyrics replace local lyrics.
- `playTrack` starts matching before `audio.play()` completes, then overwrites currentTrack with playbackTrack. Avoid this race when applying matched lyrics.
- The global `localLyricsMatchPending` guard can suppress matching after a fast track change. Review request identity and stale results.
- Lyric anchor code around `updateLyricAnchorFromScroll` and `followActiveLyricItem` uses half the entire element height, plus `LYRIC_START_VISUAL_OFFSET = 14`. Measure the first visual text line instead; account for first/last scroll spacers and translations.
- Final lyric CSS rules in App.vue use the same active font size as inactive. Apply enlargement only to `.lyric-original` and avoid overlap.
- Default theme lyric colors currently use `appearanceAccent.value` (green); stored default activeColor is `#2f9fc8`. The word-timed gradient must retain a distinct unsung color rather than making both stops blue.

## Changes Made in This Paused Work

Only regression tests were added; production fixes have NOT been applied in this work segment:

- `electron/tests/audio-output.test.cjs`: test for audio CORS configuration and resuming the graph when disabling matching.
- `backend/src/test/java/com/listenmusic/service/LocalLyricsMatchServiceTest.java`: three QQ priority/fallback scenarios.

Tests were intentionally run before implementation:

- Audio: 7 passed, 2 failed (missing CORS attribute; missing resume).
- LocalLyricsMatchServiceTest: 5 passed, 2 failed (QQ word lyrics skipped with local lyrics; NetEase queried before available QQ regular lyrics).

Do not remove these tests merely to make the suite green. Add further coverage for provider failures, translations, stale requests and visual geometry.

## Environment and Safety

- Workspace has many existing modified/untracked files. Preserve unrelated work. Use apply_patch for edits.
- Do not stop the user's backend/IDE process or start a duplicate on 17890. An earlier duplicate caused a port conflict. At inspection backend PID was 21864 and Vite 5173 PID was 13384; re-check, do not assume these PIDs remain valid.
- Node executable: `C:/Users/WQTY/AppData/Local/Author Software/nvm/installs/v24.21.0/node.exe`. Generic npm/node shims may fail.
- Audio tests: explicit Node executable with `--test electron/tests/audio-output.test.cjs`.
- Backend tests: from `backend`, `mvn -q -Dtest=LocalLyricsMatchServiceTest test`.
- Maven build output follows user.home into a Codex visualization directory. In sandbox the user is CodexSandboxOffline. Do not launch the application against a different profile/database accidentally.
- Browser testing is still needed. The bundled runtime directory `C:/Users/WQTY/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules` exists; check for Playwright there. Project node_modules did not visibly contain Playwright.
- Use isolated fixtures/user data for UI and audio graph tests. Do not mutate real accounts, library, or playback settings for tests.
- Physical headphone audibility requires user confirmation; do not infer it solely from passing unit tests or advancing playback time.

## Suggested Next Steps

1. Reproduce cross-origin graph silence with a browser and a local CORS-enabled WAV fixture, inspecting analyser amplitude. Fix audio request configuration and context recovery, then rerun routing tests.
2. Implement/test QQ-first matching with local fallback, translation propagation and request identity guards.
3. Implement/test first-visual-line anchor geometry, original-only enlargement and default blue highlight.
4. Run targeted backend/frontend tests, build/type checks, and desktop/mobile visual checks. Update brittle geometry contract tests to assert the corrected behavior rather than retaining the old 14px offset.
5. Ask the user to test physical headphone output after restarting/reloading the updated app; do not restart their backend without coordination.
