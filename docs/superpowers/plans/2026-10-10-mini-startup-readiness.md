# Mini Startup Readiness Plan

- [x] Observe failing startup tests for delayed content and paint ordering.
- [x] Add owned-renderer readiness, pre-show clipping and failure recovery.
- [x] Keep main content visible during preparation; preserve web fallback.
- [x] Check first display and repeated entry, including actual Windows pixels.
- [x] Run frontend/typechecks and rebuild/verify the installation artifact.
- [x] Record fresh artifact metadata and outstanding user-environment validation.

## Additional User Requests

- [x] Observe failing UI assertions for native controls offset and untranslated row padding.
- [x] Center native controls across the full card at all sizes, including optional controls.
- [x] Reduce untranslated main lyrics padding from 12 px per row to 4 px without changing translation spacing or provider highlighting.
- [x] Add debounced full-surface repaint after native shape/lifecycle/size changes; observe failing and passing controller tests.
- [ ] Confirm the blue-corner symptom is eliminated in the user's installed environment, not only an isolated test.

## Captured User-Environment Evidence

The held blue window was captured read-only at native handle 3871208. All four
screen corner samples were RGB(0,120,212), despite GetWindowRgn returning kind 3,
720 x 320 bounds and corner membership false. Native/client sizes both matched
720 x 320 and WS_THICKFRAME was absent. The color matches the Windows accent
color; the blue cannot be explained solely by a missing native rounded region.
The preceding window at handle 3805672 was already normal when brought forward.
User reports that minimize/restore clears the blue. These observations support
investigating Windows presentation/redraw, but do not yet prove its exact cause.

User-window screenshots are local ignored test artifacts in
electron/.playwright-cli/mini-user-blue-3871208.png. A single full native redraw
experiment was approved and performed. It returned success but all four corner
samples remained blue. Ordinary native invalidation did not resolve the symptom;
the compositor refresh guard is not yet a proven fix.

## Verified Rendering Fix

The screen-first non-topmost test reproduced the blue five times with software
rendering and passed five entries with default hardware rendering. Re-enabling
only software rendering in an isolated instance reproduced the blue again.
Removed the global app.disableHardwareAcceleration() call. Non-topmost shrink,
enlarge and pin-off checks and all eight native antialiasing stages passed.
Frontend, TypeScript, startup/layout, frameless-mini and titlebar checks passed.
User-installed confirmation remains unchecked until the rebuilt installer is
installed and the previous real process has fully exited.

Installer rebuilt at 2026-10-10 22:30:13 Asia/Shanghai. Packaged assets and the
screen-first test against packaged app.asar passed. Runtime service smoke was
not repeated because user services still occupy 17890/3000/3300. No service was
stopped. Metadata and manual gates are in docs/release-validation-2026-10-10.md.
