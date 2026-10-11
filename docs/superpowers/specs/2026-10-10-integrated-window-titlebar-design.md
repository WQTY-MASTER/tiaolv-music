# Integrated Windows Title Bar

Approved scope: make the installed app's top edge blend into its existing UI,
as in the user's third screenshot. The preceding installer opens successfully;
its wizard, runtime services, app identity and user-data locations stay unchanged.

The mini-mode caption-strip behavior below is historical and was superseded by
`2026-10-10-frameless-mini-player-design.md` after the user's approval. The main
window still uses this integrated native caption overlay; the dedicated mini
window instead has no native frame or caption strip.

## Behavior

- On Windows, use `titleBarStyle: "hidden"` and a transparent native
  `titleBarOverlay`, 32 CSS pixels high. Keep native caption buttons and window
  resize behavior, rather than recreating their commands in the renderer.
- Add a transparent fixed drag region covering the empty top area. Leave space
  for the left application tools and right native window buttons. During the
  first-run guide, keep dragging and caption buttons available.
- Synchronize caption symbol contrast with the effective app theme, including
  system theme changes. The default light song-detail surface uses dark symbols
  even with the global dark theme; an image override follows the selected theme.
  A narrow, validated main-window-only IPC accepts a
  boolean, not arbitrary window operations or user-supplied colors.
- Mini mode keeps the transparent native button strip; its existing card starts
  beneath it, preserving usable playback controls and the return-to-main button.
  Its exposed window background is explicitly light so dark caption symbols do
  not sit on the fallback black window surface. Scope this to the Windows mini
  drag region; leave desktop-lyrics transparency untouched.
- Native close continues through the existing exit/tray/mini behavior. Do not
  change navigation, recommendation, playback, authentication or local data.
- Other platforms and the web preview keep their previous behavior.

## Verification

Add failing tests for real window options and IPC sender/payload checks, then
implement the minimum change. Run frontend suites and all TypeScript projects.
Use an isolated Electron window to verify light/dark themes, onboarding, native
caption bounds, drag styling, maximize/minimize, mini-mode restoration and tray
close. Inspect screenshots, rebuild NSIS and verify packaged main bytes.

Clean-machine NSIS installation, OS drag/snap gestures and real provider playback
remain manual gates. The user has already confirmed the preceding installer opens.
