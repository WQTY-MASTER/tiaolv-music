# Frameless Mini Player

## Problem And Scope

The user requests preservation of the current card style, removal of the outer
rectangular window and replacement of the close button with a compact toolbar.
The current mini mode resizes the main BrowserWindow, which retains its
Windows title-bar overlay and native window frame. Its card starts 40 pixels
below the overlay, leaving an opaque shell and two close buttons on hover.

Approved by the user on 2026-10-10. This supersedes only the mini-mode portion of the
integrated-window-titlebar design; the main window keeps its native overlay.

## Alternatives

1. Recommended: a separate frameless, transparent mini BrowserWindow, following
   the existing desktop-lyrics window pattern. Preserve the main renderer as the
   sole playback owner and reuse the current MiniPlayer component.
2. Make the main window frameless and replace its native caption controls. This
   would affect the entire application's window interactions and is outside the
   requested mini-player fix.
3. Remove only the card's close button or its top margin. This leaves the outer
   frame and does not satisfy the requested appearance.

## Appearance And Interaction

- Display only the existing rounded mini-player card. The surrounding surface
  is transparent, with no native title bar, caption buttons or opaque rectangle.
- Preserve the current card colors, rounded corners, cover, typography and
  playback controls. Do not redesign the player or add a second outer shell.
- Replace the card's X with one compact upper-right toolbar, matching the user's
  reference. Its five icon buttons, in order, are customize, lock/unlock,
  pin/unpin, minimize and return to the full player. Use Lucide icons, with
  `Maximize2` for the diagonal-arrow return button, tooltips and accessible names.
- Reveal the toolbar on hover or keyboard focus. Active lock and pin states
  remain discernible; controls must not overlap song text or playback buttons.
- Return closes the mini window and restores the main window without stopping
  playback or exiting the application. There is no second X or native caption.
- Customize opens a small nonmodal companion editor using the existing
  MiniPlayerAppearanceSettings component. Keep the mini card visible for live
  preview. Both the companion editor and the main appearance settings update
  the same preferences, including themes, background images and layout.
- Closing the companion editor alone leaves mini playback running. Returning
  to the full player also closes the companion editor.
- Lock disables both window movement and resizing. Toolbar, playback, queue
  and unlock actions remain usable. Unlock restores dragging and resizing.
- Pin updates the existing miniAlwaysOnTop preference, not a second setting.
  Main settings and the toolbar must reflect the same value.
- Minimize uses the native minimize operation, without returning to main or
  stopping playback. Preserve recovery through the taskbar when enabled and
  through the tray when taskbar visibility is disabled.
- Preserve existing hover controls, native drag regions, no-drag interactive
  controls, queue actions, appearance preferences and cover/lyric presentation.
- Support resizing from edges and corners while unlocked. Use an ergonomic
  340x168 minimum and 720x320 maximum (CSS pixels), further constrained to the
  display work area. Optional equalizer/time content raises minimum height by
  20/16 pixels. Queue expansion adds 208 pixels to the height limits. Use
  responsive content; do not scale
  the entire UI bitmap or introduce text overlap at narrow sizes.
- Remember user-selected size and position locally, clamp restored bounds to
  available displays and preserve manually selected bounds on theme changes.
  An explicitly selected compact/standard/wide preset may update width while
  unlocked; background and color changes must never reset window size.
- Respect existing always-on-top and taskbar preferences. Queue expansion
  adjusts the mini window without resizing the hidden main window, preserving
  the user's chosen width and collapsed size after the queue closes. When locked,
  queue expansion may adjust height programmatically without enabling manual
  movement/resizing.
- Returning restores the main window's position, size and maximized/full-screen
  state. Switching modes does not mount a second audio player.

## State And Lifecycle

- The main renderer continues owning playback, queue, favorites and playlists.
  The mini renderer is a display/controller, not a second App instance.
- Use a typed, serializable snapshot for mini presentation. Synchronize it
  while the mini window exists, including the initial load and track changes.
- Forward validated mini actions to existing main-renderer handlers. Resolve
  queue items by their current identifiers rather than trusting supplied track
  objects. Validate IPC senders and action payloads; do not grant the mini
  window general access to account or filesystem operations. The companion
  editor may use only the existing user-initiated image-selection/import flow;
  reject arbitrary path reads and unrelated settings changes.
- Show the mini window only when ready, then hide the main window. On load
  failure, leave/restore the main window and clean up the failed mini window.
- Returning, tray restoration and application shutdown must clean up the mini
  window and subscriptions. An unexpected mini close restores the main window.
- Keep web-preview mini behavior and desktop-lyrics behavior unchanged.
- Do not modify third-party accounts, music-library data, backend services or
  installer wizard behavior.

## Verification

Write failing tests for frameless/transparent options, toolbar actions,
snapshot/action validation and lifecycle restoration before implementation.
Verify actual isolated Electron windows, transparent corner pixels, hover and
keyboard controls, live appearance synchronization, lock/unlock, pin settings,
minimize/recovery, resizing at minimum/default/large sizes, queue expansion,
playback ownership and repeated open/return cycles.
Run frontend regressions and all TypeScript projects, inspect screenshots and
rebuild the installer only after those checks pass. Do not stop the user's
running player or inspect their account data for testing.
