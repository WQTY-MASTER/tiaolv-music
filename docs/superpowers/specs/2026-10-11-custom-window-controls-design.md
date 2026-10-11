# Theme-Aligned Windows Caption Buttons

Approved visual direction: match the user's second reference. Replace the
Windows-native caption buttons with three application-rendered icon buttons.
This supersedes only the main-window native-overlay requirements in
`2026-10-10-integrated-window-titlebar-design.md`.

## Scope

- Windows main window only; keep the native resize frame and hidden title bar.
  Disable the native caption overlay so its red close hover cannot appear.
- Keep three stable 46 by 32 CSS pixel buttons at the top right: minimize,
  maximize/restore and close. Use existing Lucide icons and accessible labels.
- Default backgrounds are transparent. All three buttons share a pale gray-blue
  hover and a slightly stronger pressed state, with no red close variant.
  Adapt foreground and highlight contrast to the existing effective theme.
- Preserve the existing top drag region, leaving application tools and caption
  buttons outside it. Double-click dragging, native resizing and normal window
  operations remain available. Native maximize-hover Snap Layouts are not
  recreated; ordinary Windows snapping remains unchanged.
- Expose only validated caption commands and maximize-state reads/events to the
  main renderer. Reject other senders, subframes, invalid commands and destroyed
  windows. Mini-player and editor bridges receive no new caption permissions.
- Close calls the existing window close path, preserving exit, tray and mini
  settings. No changes to playback, provider accounts, local data or installer
  identity. Non-Windows and browser-preview behavior remains unchanged.

## State And Errors

Subscribe to maximize/unmaximize updates before reading initial state. Native
and button-driven changes update the restore icon. Dispose the renderer listener
on unmount. Report failed window commands without changing application state.

## Verification

First add regression tests for window options, command validation, sender/frame
isolation, maximize state, close routing and preload separation. Observe failure,
then implement and run the frontend suites, TypeScript checks and Electron build.
An isolated Electron smoke verifies actual buttons, light/dark hover and pressed
colors, onboarding, bounds at multiple widths, maximize/restore, minimize,
mini-player return and tray close. Inspect screenshots before completion.

Physical drag/resize and Windows Snap Layout gestures remain manual checks.
