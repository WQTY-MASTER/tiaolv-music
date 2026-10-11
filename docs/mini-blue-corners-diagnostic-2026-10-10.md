# Mini Blue Corners: Live Diagnostic

## Resolved In Source: Forced Software Compositing

The original non-topmost configuration now reproduces the user's blue corners
reliably in an isolated instance. With identical 720 x 320 bounds, radius 31,
transparent roots and rounded native region, forced software rendering produces
RGB(0,120,212) in all four corners. Ordinary invalidation, resetting the region,
disabling native clipping, backgroundMaterial none and accentColor false did
not eliminate it. Topmost-only checks had missed this configuration.

Removing the unconditional app.disableHardwareAcceleration() keeps Chromium's
default compositor. The same screen-first test passed five consecutive entries,
then passed non-topmost shrinking, enlarging and pin-on/pin-off. Restoring only
the software-rendering setting in the isolated helper reproduced the blue again.
The native extended style changed from 0x80000 (layered software presentation)
to 0 in the successful non-topmost runs. This identifies the application setting
that triggers the defect on this Windows build; it does not prove an internal
Windows implementation cause or guarantee every GPU/driver combination.

The production change restores the default rendering path, without forcing
permanent topmost, changing system settings, minimizing automatically or adding
CSS margins. Native clipping and antialiased CSS edges remain. A separate
32 px native screen test passed all eight lifecycle/resize stages, with zero
antialiasing mismatches at each stage. UI startup/layout and frameless mini smoke
passed, as did the Windows titlebar smoke, full frontend tests and TypeScript.

The failed test-constructor override caused the reported BrowserWindow property
exception in an isolated test only. The test instance was stopped, and the
constructor override was removed from the helper. No installed user app was
closed. Installer rebuilding and installed-environment confirmation are separate
steps; earlier evidence below documents the investigation, not the final cure.

Installer rebuilding completed at 22:30:13 Asia/Shanghai. Asset equality and
screen-first checks against packaged app.asar passed. SHA-256 and remaining
manual gates are recorded in docs/release-validation-2026-10-10.md. User services
still occupied 17890/3000/3300, so packaged backend smoke was not repeated. The
real installed app was not replaced or restarted by this run.

## Confirmed Evidence

The user kept a blue mini window open for read-only inspection. Screen capture
electron/.playwright-cli/mini-user-blue-3871208.png confirms RGB(0,120,212) at all
four corner samples. The exact same window has a native rounded region:

- GetWindowRgn kind: 3, region bounds: 720 x 320.
- Window and client dimensions: both 720 x 320.
- Region corner and opposite-corner membership: false; center: true.
- Style: 0x14020000; extended style: 0x80000; no WS_THICKFRAME.
- Chromium child: Chrome_RenderWidgetHostHWND, 720 x 320.
- OS: Windows 11 Pro, build 26200.
- The blue matches the Windows accent color. No other top-level rectangular
  window covering that corner was found; corner hit-testing falls through to
  the desktop, despite blue pixels being presented there.
- DWM non-client rendering enabled: false; native corner preference: 1
  (do not round). These are already disabled, so duplicating those options is
  not evidence of a fix.

An earlier mini window, handle 3805672, had correct rounded screen pixels when
brought forward. The user subsequently reopened the mini (new handle 3871208),
and blue was captured. The user reports minimize/restore reliably removes the
blue. Investigate stale native/compositor presentation rather than assuming
the page root has a blue CSS background. Exact cause is not yet established.

## Current Workspace Changes And Checks

- Main-process display now waits for both initial paint and an owned mini
  renderer acknowledgement after snapshot/DOM rendering. Native region is
  reapplied before showing. Startup timeout, load failure and disposal recover
  or retain the main window.
- Main renderer no longer hides its content while native mini preparation is
  pending; browser fallback remains available.
- Native bottom controls have symmetric 20 px horizontal insets at all sizes,
  including extra controls. This fixes centers 215 vs 170 at width 340 and
  475.5 vs 360 at width 720 in the failing UI test.
- Main untranslated lyric padding is reduced from 12 px per row to 4 px.
  Translation spacing, active-line scale, QQ word and NetEase line rules remain.
- Native shape/lifecycle/size changes schedule a debounced full surface repaint
  through webContents.invalidate(). This is a guarded presentation refresh,
  not yet proof of elimination of the user's blue symptom.

Fresh verification: frontend/script suites and all three TypeScript projects
passed. Mini controller tests: 14/14, including readiness ordering, timeout,
repaint coalescing, closure cancellation, native antialiasing and foreign IPC.
Built Electron startup/layout test passed after initially exposing hidden main
content, off-center tools and excess untranslated padding. It also confirmed
html/body/#app are transparent and the mini card fills each tested viewport.

## Pending Experiment And Release

The user approved a single full native redraw of the held blue window. The
same handle 3871208 was recaptured before and after exactly one RedrawWindow
call (RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW | RDW_FRAME).
The API returned true. All four screen corner samples remained RGB(0,120,212)
after 350 ms. Native region, styles and window/client dimensions were unchanged.
This experiment did NOT eliminate the blue. No minimize, close, focus, setting
change or account/library write was performed.

Screen captures: electron/.playwright-cli/mini-redraw-before-3871208.png and
electron/.playwright-cli/mini-redraw-after-3871208.png. Ordinary native invalidation
is insufficient; do not claim the debounced webContents.invalidate() guard is a
proven cure on this evidence (it uses a different compositor path).

Next isolated checks should capture screen pixels BEFORE renderer screenshots,
focus/moveTop or any minimize/restore. Existing native smoke takes renderer
screenshots first, which may force a compositor update and mask presentation
defects. Test first opening at saved 720 x 320 bounds, radius 30 and repeated
entry, alongside the previous minimum-to-maximum resize coverage. The user's
latest question asks whether a blue root CSS background explains the symptom;
current code explicitly makes html/body/#app transparent and fills the window
with the card. The root-background diagnosis is not established.

Latest source has been built but no new installer was packaged in this run.
The existing delivered installer remains the 21:17:19 artifact described in
docs/release-validation-2026-10-10.md. Its isolated checks did not demonstrate
the absence of this live user-environment failure. After the experiment, rerun
mini-startup-layout, frameless-mini, mini-native-corners (including added rapid
resizing) and window-menu smoke checks with isolated data. Then package and
validate assets; run packaged service smoke only if its ports are free.

No user player or service was stopped and no real data was written. The only
live native operation beyond read-only inspection was the one authorized
RedrawWindow call; it did not resolve the blue.
