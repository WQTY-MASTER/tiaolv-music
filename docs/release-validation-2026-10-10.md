# Release Validation: 2026-10-10

## Artifact

- Windows x64 NSIS, application version 0.1.0.
- Path: `electron/release/调律音乐 Setup 0.1.0.exe`.
- Built: 2026-10-10 23:47:31, Asia/Shanghai. This replaces the 23:11 artifact.
- Size: 185691568 bytes.
- SHA-256: `FEE080237E3582222BEA9BAF2F971A44AA2AC0ACC12A4DBD285717B650A3DE0B`.
- Authenticode status: `NotSigned`.
- Build host: Windows 10.0.26200; bundled Java 21 and Electron 35.7.5.

## Passed Checks

Fresh checks for the 23:47 artifact:

- Full frontend/script verification, all three TypeScript projects, production
  build and Windows x64 NSIS packaging passed.
- New metadata/parser regressions passed Music Director credit extraction and
  sung-line exclusion in LRC/QRC while preserving normal sung colons.
- Browser rhythm/layout passed desktop, narrow and mobile sizes, with tight
  bilingual pairs, separated groups and even untranslated pitch. Startup
  translation and QRC lyric regression smokes passed.
- Mini local-clock unit/component tests passed frame projection, a 150 ms cap,
  no cumulative drift with slow media, pause/seek/track reset and frame cleanup.
- Native frameless mini passed actual between-IPC character-fill frames, pause
  freeze, smooth upward transitions, immediate seeks, QQ words/NetEase lines,
  translated groups, cover/layout bounds, all tools, queue and return. This also
  passed when loading the final packaged app.asar with isolated data and the
  matching development Electron runtime, not full installed-account playback.
- Native startup/layout passed transparent roots and centered controls.
  Packaged screen-first corners passed five non-topmost entries, shrink/enlarge
  and pin-on/pin-off. An initial screen run was obstructed by another isolated
  UI test; a separate serial rerun passed every backdrop pixel assertion.
- Packaged assets passed six matching entries, PNG and nine exact ICO frames,
  runtime validation and matching service files. git diff --check passed.
- User services on 17890/3000/3300 and the installed player were not stopped.
  The owned preview on 5174 was closed; service runtime smoke was not repeated.

Detailed evidence: docs/lyric-rhythm-mini-fill-validation-2026-10-10.md.
The installer remains unsigned. Fully exit the tray process before upgrading.
Real-account playback and other GPUs/drivers remain manual acceptance checks.

## Earlier 23:11 Checks

The following is historical evidence for the preceding artifact.

Fresh checks for the 23:11 artifact:

- Full frontend/script verification, including the new lyric-session tests,
  all three TypeScript projects, production build and NSIS packaging passed.
- Startup translation smoke passed QQ, NetEase and cloud with isolated mocked
  responses: one lyric request, translation available before opening detail and
  reused by mini, with paused state, position and volume preserved.
- Compact bilingual layout passed at 1600/900/390 widths with approximately
  2 px original/translation clearance, equal row padding and no overlap.
- Opening quotes retain source punctuation and timing while hanging outside
  the text body. Main and mini quote alignment/visibility checks passed.
- Actual playback-clock tests passed approximately 100 ms mini time updates
  between line boundaries. Native mini smoke passed intermediate upward
  movement and immediate seek positioning, keeping QQ word/NetEase line fill.
- Native startup/layout and QRC lyric smoke passed. Native frameless-mini and
  five-entry screen-first corner/resize/pin smoke also passed against files
  loaded from the new packaged app.asar with isolated data and the matching
  development Electron runtime. This is not full installed-executable playback.
- Packaged asset checks passed six matching build entries, PNG and nine exact
  ICO frames in app/installer resources, runtime validation and service files.
- User player and services were left running; service runtime smoke was not
  repeated. Real-account playback after installation remains user acceptance.

Detailed lyric evidence: docs/lyric-startup-spacing-motion-2026-10-10.md.
The installer remains unsigned. Fully exit the tray process before upgrading.

## Earlier 22:30 Checks

The following is historical evidence for the previous artifact.

Fresh checks for the 22:30 artifact:

- Full frontend/script verification and all three TypeScript projects passed.
- Production build and Windows x64 assisted NSIS packaging exited 0.
- Non-topmost screen-first native corner smoke passed five repeated entries,
  saved 720 x 320 bounds/radius 31, shrink/enlarge and pin-on/pin-off. It also
  passed against main/renderer files loaded directly from the packaged app.asar
  using the matching development Electron runtime and isolated user data.
  This is not a complete launch of the packaged executable or NSIS installation.
- The old forced software-rendering configuration reproduced blue corners;
  restoring only that setting in the new test instance reproduced the defect
  again. Removed unconditional app.disableHardwareAcceleration(), retaining
  Chromium's default compositor. No system or driver setting was changed.
- Native 32 px antialiasing test passed eight stages, including rapid resizing,
  with 298-299 partially transparent pixels checked per stage and zero blending
  mismatches. Native clipping remains and permanent topmost is not forced.
- Startup/layout smoke passed prepared display ordering, transparent full-size
  card/roots, whole-window-centered controls and compact untranslated lyrics.
- Frameless-mini smoke passed 180 px cover, translated groups, QQ word/NetEase
  line highlighting, smooth lyric movement, seeks, appearance sync, all tools,
  lock/pin/minimize, queue and return. Windows titlebar smoke passed.
- Packaged asset check passed six build entries, exact PNG and nine ICO frames,
  runtime validation and matching service files. git diff --check passed.
- Service runtime smoke was not rerun: user listeners occupied 17890, 3000 and
  3300. They were left running. Backend and staged service code are unchanged
  by these UI/compositor updates.

The reported Cannot redefine property: BrowserWindow dialog came from a failed
isolated test constructor override, not the installed application. That test was
stopped and the override removed. No installed app, user account or music library
was altered. Fully exit the existing tray process before upgrading: replacing
files does not switch an already-running process to the new compositor setting.

User-installed visual confirmation and other GPUs/drivers remain manual checks.
Detailed causal evidence: docs/mini-blue-corners-diagnostic-2026-10-10.md.

## Earlier 21:17 Checks

The following belongs to the preceding build; descriptions and counts below are
historical and must not be confused with fresh evidence for the current artifact.

- `node scripts/verify.cjs frontend`: 100 frontend test files and 10 script suites
  passed, including ten executable mini-window lifecycle/IPC/geometry tests.
  Missing-controller, hidden-main timer, maximum-resize and lightweight-clock
  regressions were observed failing before their fixes and passing afterward.
- `node scripts/verify.cjs typecheck`: all three TypeScript projects passed.
- Electron production build and `electron-builder --win nsis --x64` exited 0.
- Builder confirmed `oneClick=false`, `perMachine=false`. Directory selection,
  the finish-page launch checkbox and data-preserving uninstall are configured
  with standard NSIS options. Cancel before installation uses stock wizard
  behavior; no forced mid-extraction interruption or rollback is promised.
- `node tests/window-menu.smoke.cjs` from Electron: the real built main window
  had no application menu, including after Alt and entering/leaving mini mode.
  The native Windows caption overlay was visible and the drag region excluded
  its button area and left app tools. Native close/minimize/maximize/resize
  capabilities remained enabled. Programmatic maximize/minimize/restore, guide
  theme changes, system light/dark changes, mini-mode controls and tray close
  passed. No renderer page errors were observed.
- `node tests/frameless-mini.smoke.cjs` from Electron passed: mini uses a separate
  transparent frameless window with no native caption strip or duplicate X.
  Transparent corner pixels, all five toolbar actions, lock/unlock, native
  always-on-top, minimize/recovery, queue height restoration, repeated entry and
  return, appearance-editor synchronization and rejected arbitrary image reads
  were checked. The main window retained its bounds and remained the only audio
  owner; its background throttling was disabled while hidden and restored on
  return. Metadata and lightweight time updates have separate IPC paths.
- Mini lyric repair passed with synthetic parsed lyrics through the real main
  preload/IPC path: QQ QRC character fills, NetEase YRC whole-line color, local
  `online-netease` matching, lightweight forward/backward time updates, centered
  1/3/5-line slots, stationary short lines, overflowing long lines and paused
  seek restoration. Pure model tests also cover NetEase cloud sources. Native
  card inset and outer shadow are removed and all surface effects clipped to
  the rounded card. The former corner pixel had alpha 2; strict alpha-zero
  regression now passes. Previous alpha-below-40 checks missed that shell.
- Native corner follow-up: renderer alpha-zero checks alone did not detect the
  Windows blue rectangular corners reported afterward. This build disables
  `thickFrame` and synchronizes a native rounded window region with the selected
  radius, resizing and queue expansion. The real-window harness uses Windows
  `GetWindowRgn`, `PtInRegion` and `GetWindowLongPtrW`: both corners are excluded,
  center/top/side points remain accessible, the thick-frame style is absent,
  and changing radius from 8 to 32 changes the native top inset. Pure tests
  ensure unchanged metadata does not repeatedly apply the native shape.
- Native lifecycle/antialiasing follow-up: show/focus/blur/restore reapply the
  region even at unchanged geometry. Simulated lost clipping failed before this
  change and passed after it. Pixel-center clipping previously removed partially
  covered CSS edge pixels (including 24,0 at radius 32), producing a hard edge.
  The native mask now retains every pixel box intersecting the CSS curve so the
  renderer's antialiasing survives, without restoring rectangular corners.
  `node tests/mini-native-corners.smoke.cjs` checks radius 32 against actual
  Windows screen captures over a known backdrop: focus, simulated lost-region
  recovery, movement, pin toggling, blur, resize and restore passed. Each capture
  checked 683-684 partially transparent corner-area pixels against renderer alpha
  compositing (channel tolerance 3), with zero mismatches; all four outer corners
  exposed the backdrop and the native thick frame remained absent.
- Cover/translation follow-up: the outer cover grows from 72 to 180 px, with the
  actual loaded image reaching at least 164 px at 720x320. Height limits still
  constrain wide/short windows. Songs with translations use centered one/three
  original/translation groups; untranslated songs retain one/three/five rows.
  Missing translations render no empty label, and long translations are bounded
  to two complete lines even in the minimum window. The real Electron smoke
  checked original/translation geometry and unchanged QQ word/NetEase line rules.
  Maximum/minimum screenshots `mini-cover-translation-720.png`,
  `mini-cover-translation-412.png` and the actual desktop capture
  `mini-desktop-cover-translation.png` were inspected. The fixture uses the app
  icon and synthetic lyrics, not the user's music library.
- Lyric motion/responsive follow-up: stable keyed rows have 280 ms transform
  transitions on normal adjacent changes, with one offscreen buffer per side.
  The harness checked an actual intermediate transform, final position and
  immediate backward-seek positioning. Line/layout changes trigger text
  measurement; ordinary word/clock progress does not. Cover ring and actual
  loaded image both grow within bounded geometry; fixed lyric size tiers and
  row spacing use available height, and wide windows shift the lyric column
  right. Playback buttons and toolbar dimensions are unchanged. Real geometry
  passed at 340x168, 412x168, 680x260 and 720x320, with centered 1/3/5 lyrics
  and unchanged QQ/NetEase highlight rules.
- Simplified black/white/gold logo preserves the record/needle motif. The ICO
  includes 16, 20, 24, 32, 40, 48, 64, 128 and 256 pixel PNG-backed frames. The
  branding contract validates all dimensions/entries; PE resource inspection
  verifies the application executable and installer embed all nine exact new
  frames. The packaged PNG matches its project source. Icon previews at 16 and
  48 pixels were inspected. Icon generation uses Electron's existing image
  APIs, adds no dependency and is reproducible from the stored 512-pixel PNG.
- Mini limits: width 340-720, collapsed height 168-320 CSS pixels; optional
  equalizer/time display adds 20/16 to minimum height. Queue expansion adds 208
  to both height limits; bounds also fit the active display's work area. The
  minimum layout initially overlapped by two pixels; raising the height floor
  resolved it and the real-window geometry test passed afterward.
- Desktop-lyrics transparency was not changed. Song-detail caption contrast has
  focused tests for the original light surface and configured image overrides.
- UI checks used the existing isolated development-mode harness with backend
  requests blocked; they did not install NSIS or run full packaged service
  startup. Renderer screenshots were inspected at 1280/1600 pixels and mini size:
  `electron/.playwright-cli/titlebar-local-1280.png`, `titlebar-local-1600.png`,
  `titlebar-mini.png`, `titlebar-onboarding-light.png`, and
  `titlebar-onboarding-dark.png`. Mini screenshots `mini-frameless-340.png`,
  `mini-frameless-412.png`, `mini-frameless-680.png`, `mini-frameless-720.png` and
  `mini-appearance-editor.png` were also inspected. Native caption buttons are not included in
  renderer screenshots; their overlay geometry is checked separately.
  New lyric screenshots `mini-lyrics-1-lines.png`, `mini-lyrics-5-lines.png` and
  `mini-lyrics-netease-line.png` were inspected for colors, layout and clipping.
- `node electron/tests/packaged-assets.smoke.cjs`: all six `out` files in
  `app.asar` matched the tested build byte-for-byte, application/installer icon
  resources matched the new ICO, and packaged runtime validation passed.
- `node scripts/runtime-smoke.cjs --packaged`: current artifact started all
  three packaged services with synthetic data, passed 12 HTTP authorization
  checks, stopped all owned children and released 17890/3000/3300. Port preflight
  was free and no existing user process was stopped.
- Packaged resource validation passed: required Java/API resources and dependency
  packages present; excluded private/development files and symbolic links absent.
  Backend jar, NetEase server and local-access helper hashes matched their source
  or build output, staged files and packaged files.

All UI checks used temporary synthetic home/data/token directories and blocked
backend access. The existing music library and account data were not used. No
existing player or service was stopped by the tests. The current packaged smoke
used free ports and left no owned services running. Fully quit the existing
player before upgrading. Backend sources and staged workers were not changed
by this mini-player polish, and packaged runtime validation/hash checks passed.

The user reported the preceding installer installed and opened successfully.
That report does not replace clean-machine installation or playback acceptance
of the newly rebuilt artifact. The installed preceding main/preload bytes matched
the tested 19:47 build; the user's persistent blue corners were not reproduced
in the isolated environment. This update adds native clipping recovery and
preserves antialiased edge pixels, expands the cover and displays translations;
the installation wizard, service resources and real user data remain unchanged.
The user subsequently reported that corners were removed but the edge looked
jagged. The hard-clipping regression above was reproduced in tests and fixed;
visual confirmation in the user's installed environment remains a manual check.

## Earlier Checks

These checks belong to the earlier validation run, not the rebuilt artifact's
current runtime smoke:

- The 15:35:28 frameless-mini artifact's packaged runtime smoke started all
  three services with synthetic data, passed 12 HTTP authorization checks,
  stopped all owned children and released all ports. This is historical evidence
  for unchanged service resources, not a fresh service run of the 17:42 artifact.

- The 17:42:19 lyric-repair artifact did not rerun packaged runtime smoke because
  user services occupied its ports. Its Chromium corner-alpha check passed but
  did not cover the Windows native-region leak. Both gaps have fresh checks in
  the current 19:47:07 artifact.

- `node scripts/verify.cjs offline`: frontend/script suites, all three TypeScript
  projects, and 277 backend tests with zero failures/errors/skips. Backend code
  and the staged service resources were not changed by the wizard/menu/title-bar
  or frameless-mini updates; backend tests were not rerun for those UI updates.
- Runtime staging rebuilt the backend, QQ API and Java 21 runtime, and installed
  production API dependencies from the existing lockfiles. The offline attempt
  failed on one uncached QQ dependency; the online retry passed without changing
  dependency versions or lockfiles. Staged runtime smoke passed.
- `node scripts/verify.cjs e2e`: QQ playlist refresh/error retention, QRC timing
  and lyric layout at 1600, 900 and 390 pixels passed with synthetic data.
- Java temporary-directory regression: observed failure before the fix; all
  13 runtime unit tests passed afterward. A short OS temporary path also allowed
  the real-data backend to start without resetting or repairing its database.
- `node scripts/start-services.cjs --check`: protected services verified and ready
  after restoring services with the existing user data, as authorized.
- At that earlier run's completion, listeners were 127.0.0.1 only on 17890,
  3000, 3300 and preview port 5173.
- Real preview proxy read: same-origin request 200; hostile Origin request 403.
  Neither account data nor token values were printed in the check output.

Builder used the installed Electron distribution and a workspace-local cache.
The verified Windows 7zip tool was supplied through `ELECTRON_BUILDER_7ZIP_PATH`.
These paths are build-host workarounds, not prerequisites for installed users.

## Not Verified

NSIS installation on a clean Windows machine, full packaged UI workflows,
antivirus acceptance, code signing, third-party license distribution and actual
QQ/NetEase account playback remain manual release gates. Browser tests mock
upstream data; runtime smoke uses isolated synthetic data and does not exercise
the full packaged Electron main-window startup. Native mouse-driven window
dragging/resizing, multiple physical displays, double-click maximization and Windows snap gestures remain manual
checks; automated window checks invoke native Electron APIs and inspect the CSS
drag region. No real-user backup restore was
performed, and no user database reset, repair or rollback was executed.

The installer is the current local-first desktop build, not a public-server
client. It has no independent project account or invitation requirement; QQ and
NetEase login remain optional platform features. The current scope is recorded
in `docs/local-first-product-scope.md` and `docs/release-checklist.md`. Public
online services, if added later, require a separate design and acceptance.
