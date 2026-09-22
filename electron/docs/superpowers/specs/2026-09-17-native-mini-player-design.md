# Native Mini Player Design

## Goal

Use the existing Electron main window as a QQ Music-style mini player without creating a second window or duplicating playback state.

## Window Behavior

- Browser preview keeps the current in-page floating card.
- Electron enters native mini mode through preload IPC after the mini UI is rendered.
- Main process saves the normal bounds, minimum size, maximized state, fullscreen state, and always-on-top state once per mini session.
- The window unmaximizes if needed, becomes always-on-top, lowers its minimum size, and animates to a compact size inside the active display work area.
- Exiting mini mode animates back to the saved bounds, restores minimum size and always-on-top state, and re-maximizes or restores fullscreen when applicable.
- Native close and minimize events are not intercepted. The in-card X exits mini mode; the operating-system close button still closes the application.

## Renderer Behavior

- Native mini mode hides the complete application shell and renders only the mini player.
- The mini player fills the compact window with a small outer gap and uses `-webkit-app-region: drag` for native window movement.
- Interactive buttons opt out with `-webkit-app-region: no-drag`.
- The close button is independent in the top-right corner.
- The remaining controls are centered in this order: like, previous, play/pause, next, queue.
- Playback, lyrics, progress, queue, and favorite actions continue to use the existing shared state and handlers.

## Failure Handling

- IPC methods return `false` if no owning BrowserWindow exists.
- Renderer falls back to the current in-page mini player when Electron IPC is unavailable or entering native mini mode fails.
- Restore is idempotent so repeated exit requests cannot corrupt saved bounds.

## Verification

- Contract tests cover IPC exposure, state preservation/restoration, native-only rendering, top-right close placement, and centered control order.
- Production build verifies Electron main, preload, and renderer types.
- Browser Playwright checks the fallback layout and existing interactions.

